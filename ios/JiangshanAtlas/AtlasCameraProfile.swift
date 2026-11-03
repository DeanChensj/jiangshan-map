import Foundation
import QuartzCore
import MapLibre
import os

/// Opt-in developer capture: launch with --atlas-camera-profile.
/// Drives the production map camera, saves a report, and restores the user's view.
/// Has no display link or measurement collection during normal app use.
@MainActor final class AtlasCameraProfile: NSObject {
    private weak var map: MLNMapView?
    private let store: AtlasStore
    private var link: CADisplayLink?
    private var startTime: CFTimeInterval?
    private var frames: [[Double]] = []
    private var cameraUpdates: [[Double]] = []
    private var beforeYear = 1415
    private var beforeSelection: AtlasSelection?
    private var beforeJourney: AtlasJourney?
    private var beforeJourneyIndex = 0
    private var beforeCamera = CLLocationCoordinate2D()
    private var beforeZoom = 0.0
    private var beforeEvents = true
    private var beforeBoundaries = true
    private var beforeWater = true
    private var beforeModern = false
    private var beforeToday = false
    private var beforeDetail = true
    private var beforeEnglish = false
    private var finished = false
    private let runID=UUID().uuidString
    private let startedAt=ISO8601DateFormatter().string(from:Date())
    private let animatedSweep=ProcessInfo.processInfo.arguments.contains("--atlas-profile-animated")
    private let requestedFPS=ProcessInfo.processInfo.arguments.contains("--atlas-profile-120fps") ? 120 : ProcessInfo.processInfo.arguments.contains("--atlas-profile-60fps") ? 60 : 0
    private var preferenceAtStart=0
    private var maximumAtStart=0
    private var lowPowerAtStart=false
    private var nextAnimatedTarget=0.0
    private var capturePhase = -1
    private let log=OSLog(subsystem:"me.jiangshan.atlas",category:.pointsOfInterest)

    init(map: MLNMapView, store: AtlasStore) {
        self.map = map; self.store = store
    }

    func start() {
        guard let map else { return }
        beforeYear = store.year; beforeSelection = store.selection
        beforeJourney = store.journey; beforeJourneyIndex = store.journeyIndex
        beforeCamera = map.centerCoordinate; beforeZoom = map.zoomLevel
        beforeEvents = store.showEvents; beforeBoundaries = store.showBoundaries
        beforeWater = store.showWater; beforeModern = store.showModern; beforeEnglish = store.english
        beforeToday=store.showTodayReference;beforeDetail=store.showHistoricalDetail
        store.selection = nil; store.journey = nil
        store.showBoundaries = true; store.showWater = true; store.showEvents = true
        store.showModern = false; store.english = false; store.setYear(1415)
        store.showTodayReference=false;store.showHistoricalDetail=true
        map.setCenter(.init(latitude: 33.2, longitude: 115.8), zoomLevel: 5.8, animated: false)
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(6))
            guard let self, let map=self.map else { return }
            guard let screen=map.window?.windowScene?.screen else { print("ATLAS_PROFILE_ERROR no attached screen");return }
            if self.requestedFPS > 0 { map.preferredFramesPerSecond = .init(rawValue:self.requestedFPS) }
            self.preferenceAtStart=Int(map.preferredFramesPerSecond.rawValue)
            self.maximumAtStart=screen.maximumFramesPerSecond
            self.lowPowerAtStart=ProcessInfo.processInfo.isLowPowerModeEnabled
            if self.requestedFPS == 120 && (self.preferenceAtStart != 120 || self.maximumAtStart < 120 || self.lowPowerAtStart) {
                print("ATLAS_PROFILE_ERROR 120 FPS request not verified");return
            }
            print("ATLAS_PROFILE_CONFIGURATION requested=\(self.requestedFPS) actualPreference=\(self.preferenceAtStart) screenMaximum=\(self.maximumAtStart) lowPower=\(self.lowPowerAtStart)")
            let displayLink = CADisplayLink(target: self, selector: #selector(self.tick(_:)))
            displayLink.preferredFrameRateRange = .init(minimum: 30, maximum: 120, preferred: 120)
            self.link = displayLink
            displayLink.add(to: .main, forMode: .common)
            print("ATLAS_PROFILE_STARTED")
        }
    }

    @objc private func tick(_ link: CADisplayLink) {
        guard let map else { stop(); return }
        if startTime == nil {
            startTime = link.timestamp
            os_signpost(.begin,log:log,name:"Atlas Camera Capture")
        }
        let time = link.timestamp - (startTime ?? link.timestamp)
        guard time < 30 else { finish(); return }
        let phase = Int(time / 10)
        if phase != capturePhase {
            capturePhase=phase
            os_signpost(.event,log:log,name:"Atlas Camera Phase","phase=%{public}d",phase)
        }
        let progress = time.truncatingRemainder(dividingBy: 10) / 10
        let wave = sin(progress * .pi * 4)
        let coordinate: CLLocationCoordinate2D
        let zoom: Double
        switch phase {
        case 0:
            coordinate = .init(latitude: 33.2 + 2 * sin(progress * .pi * 2), longitude: 115.8 + 4 * wave)
            zoom = 5.8
        case 1:
            coordinate = .init(latitude: 33.2, longitude: 115.8)
            zoom = 4.8 + 1.6 * wave
        default:
            coordinate = .init(latitude: 33.2 + 1.5 * wave, longitude: 115.8 + 3 * cos(progress * .pi * 4))
            zoom = 5.0 + 1.2 * wave
        }
        let begin = CACurrentMediaTime()
        if animatedSweep {
            guard time >= nextAnimatedTarget else { return }
            nextAnimatedTarget=time+0.75
            let camera=MLNMapCamera(lookingAtCenter:coordinate,altitude:MLNAltitudeForZoomLevel(zoom,0,coordinate.latitude,map.bounds.size),pitch:0,heading:0)
            map.setCamera(camera,withDuration:0.75,animationTimingFunction:CAMediaTimingFunction(name:.linear),completionHandler:nil)
        } else { map.setCenter(coordinate, zoomLevel: zoom, animated: false) }
        cameraUpdates.append([time, (CACurrentMediaTime() - begin) * 1000, link.targetTimestamp - link.timestamp])
    }

    func rendered(_ stats: MLNRenderingStats, fully: Bool) {
        guard let startTime, !finished else { return }
        let elapsed = CACurrentMediaTime() - startTime
        guard elapsed < 30 else { return }
        frames.append([elapsed, stats.encodingTime, stats.renderingTime, Double(stats.numDrawCalls), fully ? 1 : 0])
    }

    private func finish() {
        guard !finished else { return }
        finished = true; stop()
        os_signpost(.end,log:log,name:"Atlas Camera Capture")
        let report: [String: Any] = [
            "runID":runID,"startedAt":startedAt,
            "sourceRevision":Bundle.main.object(forInfoDictionaryKey:"AtlasSourceRevision") as? String ?? "unrecorded",
            "captureStartHostTime":startTime ?? 0,
            "motionDriver":animatedSweep ? "native camera animation" : "per-frame camera setters",
            "device": UIDevice.current.model, "os": UIDevice.current.systemVersion,
            "screenMaximumFPS": map?.window?.windowScene?.screen.maximumFramesPerSecond ?? 0,
            "mapPreferredFPS": map?.preferredFramesPerSecond ?? 0,
            "explicitRequestedFPS":requestedFPS,
            "mapPreferredFPSAtStart":preferenceAtStart,
            "screenMaximumFPSAtStart":maximumAtStart,
            "lowPowerModeAtStart":lowPowerAtStart,
            "verified120FPSRequest":requestedFPS == 120 && preferenceAtStart == 120 && map?.preferredFramesPerSecond.rawValue == 120 && maximumAtStart >= 120 && !lowPowerAtStart && !ProcessInfo.processInfo.isLowPowerModeEnabled,
            "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
            "thermalState": ProcessInfo.processInfo.thermalState.rawValue,
            "scene": "1415, Chinese, boundaries/rivers/events/detail on, modern province/Today reference off",
            "phases": ["pan", "zoom", "pan+zoom"], "phaseDurationSeconds": 10,
            "frameColumns": ["elapsedSeconds", "sdkEncodingSeconds", "sdkRenderingSeconds", "drawCalls", "fullyRendered"],
            "cameraColumns": ["elapsedSeconds", "cameraUpdateMilliseconds", "displayLinkTargetIntervalSeconds"],
            "frames": frames, "cameraUpdates": cameraUpdates
        ]
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("atlas-camera-profile.json")
        do {
            try JSONSerialization.data(withJSONObject: report).write(to: url, options: .atomic)
            print("ATLAS_PROFILE_FINISHED frames=\(frames.count) file=\(url.lastPathComponent)")
        } catch { print("ATLAS_PROFILE_ERROR \(error)") }
        store.showEvents = beforeEvents; store.showBoundaries = beforeBoundaries
        store.showWater = beforeWater; store.showModern = beforeModern; store.english = beforeEnglish
        store.showTodayReference=beforeToday;store.showHistoricalDetail=beforeDetail
        store.setYear(beforeYear); store.selection = beforeSelection
        store.journey = beforeJourney; store.journeyIndex = beforeJourneyIndex
        if let map {
            map.setCenter(beforeCamera, zoomLevel: beforeZoom, animated: false)
            store.cameraLongitude = beforeCamera.longitude; store.cameraLatitude = beforeCamera.latitude
            store.cameraZoom = beforeZoom; store.saveCamera()
        }
    }

    func stop() { link?.invalidate(); link = nil }
}
