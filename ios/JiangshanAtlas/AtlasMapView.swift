import SwiftUI
import MapLibre

/// Style loading can finish before SwiftUI attaches the map to a window.
/// Resolve the display rate when the actual screen becomes available.
final class AtlasProMotionMapView: MLNMapView {
    override func didMoveToWindow() {
        super.didMoveToWindow()
        updateDisplayPreference()
    }
    func updateDisplayPreference() {
        guard let screen=window?.windowScene?.screen else { return }
        let maximum=screen.maximumFramesPerSecond
        preferredFramesPerSecond = .init(rawValue:ProcessInfo.processInfo.isLowPowerModeEnabled ? min(60,maximum) : maximum)
    }
}

struct AtlasMapView: UIViewRepresentable {
    let store: AtlasStore
    let revision: String
    let onSelect: (AtlasSelection) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(store: store, onSelect: onSelect) }

    func makeUIView(context: Context) -> MLNMapView {
        let map = AtlasProMotionMapView(frame: .zero, styleURL: Self.styleURL())
        map.automaticallyAdjustsContentInset=false
        map.minimumZoomLevel = 1
        map.maximumZoomLevel = 14
        map.preferredFramesPerSecond = .maximum
        map.isRotateEnabled = false
        map.isPitchEnabled = false
        map.showsScale = true
        map.showsLogoView = false
        map.showsAttributionButton = false
        map.setCenter(.init(latitude: store.cameraLatitude, longitude: store.cameraLongitude), zoomLevel: store.cameraZoom, animated: false)
        map.delegate = context.coordinator
        map.accessibilityLabel = store.text("历史地图", "Historical map")
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.cancelsTouchesInView = false
        for case let zoomTap as UITapGestureRecognizer in map.gestureRecognizers ?? [] where zoomTap.numberOfTapsRequired > 1 {
            tap.require(toFail: zoomTap)
        }
        map.addGestureRecognizer(tap)
        let press = UILongPressGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pressed(_:)))
        map.addGestureRecognizer(press)
        context.coordinator.map = map
        return map
    }

    func updateUIView(_ map: MLNMapView, context: Context) {
        context.coordinator.onSelect = onSelect
        context.coordinator.refresh()
    }

    static func dismantleUIView(_ map: MLNMapView, coordinator: Coordinator) {
        coordinator.loadTask?.cancel()
        coordinator.stopGhost()
        coordinator.cameraTask?.cancel()
        coordinator.cameraProfile?.stop()
        coordinator.store.saveCamera()
        map.delegate = nil
    }

    private static func styleURL() -> URL { AtlasCartography.styleURL() }

    @MainActor final class Coordinator: NSObject, @preconcurrency MLNMapViewDelegate {
        let store: AtlasStore
        var onSelect: (AtlasSelection) -> Void
        weak var map: MLNMapView?
        var loadTask: Task<Void, Never>?
        var cameraProfile: AtlasCameraProfile?
        private var requestedSnapshot: String?
        private var visibilityKey = ""
        private var hydroYear: Int?
        private var labelLanguage: String?
        private var extrasKey = ""
        private var focusKey = ""
        private var quizKey = ""
        private var previousSnapshot: PreparedSnapshot?
        private var ghostTask: Task<Void, Never>?
        private var previewKey: String?
        private var previewTask: Task<Void,Never>?
        private var placesKey = ""
        private var placesInputKey = ""
        private var eventsInputKey = ""
        private var prefetchTask: Task<Void,Never>?
        private var eventsKey = ""
        private var journeyKey: String?
        private var routeJoinKey = ""
        private var selectionKey = ""
        private var destinationID: UUID?
        var cameraTask: Task<Void,Never>?
        private var lodKey = ""
        private var adminKey = ""
        private var todayKey = ""
        private var insetKey = ""
        private var layoutChangedAt = CACurrentMediaTime()
        private var pulses: AtlasPulseOverlay?
        private var hasLoadedStyle = false
        private let initialCamera: CameraDestination
        private let cache = NSCache<NSString, PreparedSnapshot>()

        init(store: AtlasStore, onSelect: @escaping (AtlasSelection) -> Void) {
            self.store = store; self.onSelect = onSelect
            initialCamera = .init(longitude: store.cameraLongitude, latitude: store.cameraLatitude, zoom: store.cameraZoom)
            cache.countLimit = 4
        }

        func mapView(_ mapView: MLNMapView, didFinishLoading style: MLNStyle) {
            hasLoadedStyle = true
            AtlasCartography.installSymbols(style)
            (mapView as? AtlasProMotionMapView)?.updateDisplayPreference()
            mapView.setCenter(.init(latitude: initialCamera.latitude, longitude: initialCamera.longitude), zoomLevel: initialCamera.zoom, animated: false)
            refresh()
            if ProcessInfo.processInfo.arguments.contains("--atlas-camera-profile"), cameraProfile == nil {
                cameraProfile = AtlasCameraProfile(map: mapView, store: store)
                cameraProfile?.start()
            }
        }

        func mapViewDidFinishRenderingFrame(_ mapView: MLNMapView, fullyRendered: Bool, renderingStats: MLNRenderingStats) {
            cameraProfile?.rendered(renderingStats, fully: fullyRendered)
        }

        func mapView(_ mapView: MLNMapView, regionDidChangeAnimated animated: Bool) {
            guard hasLoadedStyle else { return }
            store.cameraLongitude = mapView.centerCoordinate.longitude
            store.cameraLatitude = mapView.centerCoordinate.latitude
            store.cameraZoom = mapView.zoomLevel
            store.cameraViewportWidth = Double(mapView.bounds.width)
            if let experience=store.experience,experience.kind == "route" {
                let joins=experience.stops.enumerated().compactMap { index,stop -> String? in
                    guard let peer=stop.convergencePeer,peer > index,experience.stops.indices.contains(peer) else { return nil }
                    let a=mapView.convert(.init(latitude:stop.coord[1],longitude:stop.coord[0]),toPointTo:mapView)
                    let b=mapView.convert(.init(latitude:experience.stops[peer].coord[1],longitude:experience.stops[peer].coord[0]),toPointTo:mapView)
                    return "\(index):\(hypot(a.x-b.x,a.y-b.y) < 18)"
                }.joined(separator:"|")
                let key=experience.id+joins
                if routeJoinKey != key { routeJoinKey=key;journeyKey=nil;if let style=mapView.style { refreshFeatures(style) } }
            }
            if let style=mapView.style { refreshVisibility(style) }
        }

        func stopGhost() { ghostTask?.cancel();previewTask?.cancel();prefetchTask?.cancel();store.mapStageLoading=false;pulses?.removeFromSuperview() }

        func mapViewDidBecomeIdle(_ mapView: MLNMapView) {
            if store.isGestureActive { store.cameraInteractionUntil=Date().addingTimeInterval(3) }
            store.isGestureActive=false;store.saveCamera();refreshPulses()
        }
        func mapView(_ mapView: MLNMapView, regionWillChangeAnimated animated: Bool) {
            pulses?.isHidden=true
            if (mapView.gestureRecognizers ?? []).contains(where:{ $0.state == .began || $0.state == .changed }) {
                store.isGestureActive=true;store.cameraInteractionUntil=Date().addingTimeInterval(3);cameraTask?.cancel()
            }
        }

        func mapViewDidFailLoadingMap(_ mapView: MLNMapView, withError error: Error) {
            store.mapError = error.localizedDescription
        }

        func refresh() {
            guard let map, let style = map.style, let phase = store.phase else { return }
            if requestedSnapshot != phase.id {
                requestedSnapshot = phase.id
                store.mapStageLoading = true
                loadTask?.cancel()
                if let cached = cache.object(forKey: phase.id as NSString) { apply(cached, to: style) }
                else {
                    let key = phase.id
                    loadTask = Task { [weak self] in
                        do {
                            try await Task.sleep(for: .milliseconds(60))
                            let prepared = try await Task.detached(priority: .userInitiated) { try PreparedSnapshot(key: key) }.value
                            try Task.checkCancellation()
                            guard let self, self.requestedSnapshot == key, let currentStyle = self.map?.style else { return }
                            self.cache.setObject(prepared, forKey: key as NSString)
                            self.apply(prepared, to: currentStyle)
                            self.store.mapError = nil
                        } catch is CancellationError { }
                        catch { self?.requestedSnapshot = nil; self?.store.mapStageLoading=false;self?.store.mapError = error.localizedDescription }
                    }
                }
            }
            refreshVisibility(style)
            let referenceKey="\(store.showTodayReference)|\(store.english)|\(store.quiz != nil)"
            if todayKey != referenceKey {
                todayKey=referenceKey
                AtlasTodayReference.update(style,enabled:store.showTodayReference && store.quiz == nil,english:store.english)
            }
            if hydroYear != store.year {
                hydroYear = store.year
                for id in ["focus-dots","focus-labels"] { (style.layer(withIdentifier:id) as? MLNVectorStyleLayer)?.predicate=NSPredicate(format:"from <= %d AND until >= %d",store.year,store.year) }
                for name in ["corridor-wall","corridor-canal","corridor-silk","corridor-road","corridor-sea","corridor-labels"] {
                    let kind = name.replacingOccurrences(of:"corridor-",with:"")
                    (style.layer(withIdentifier:name) as? MLNVectorStyleLayer)?.predicate = name == "corridor-labels" ? NSPredicate(format:"from <= %d AND until >= %d",store.year,store.year) : NSPredicate(format:"kind == %@ AND from <= %d AND until >= %d",kind,store.year,store.year)
                }
                for (name,kind) in [("rivers","river"),("rivers-casing","river"),("lakes","lake"),("lake-outlines","lake")] {
                    var predicate = NSPredicate(format:"layer == %@ AND from <= %d AND until > %d",kind,store.year,store.year)
                    if name == "rivers-casing" { predicate = NSCompoundPredicate(andPredicateWithSubpredicates:[predicate,NSPredicate(format:"rank == 1")]) }
                    (style.layer(withIdentifier:name) as? MLNVectorStyleLayer)?.predicate = predicate
                }
            }
            if labelLanguage != store.language {
                labelLanguage = store.language
                for name in ["realm-labels","region-labels","prefecture-labels","focus-labels","capital-labels","city-labels","town-labels","pass-labels","hydro-labels","corridor-labels","modern-labels","neighbor-labels","selected-label","journey-labels"] {
                    (style.layer(withIdentifier:name) as? MLNSymbolStyleLayer)?.text = NSExpression(forKeyPath:store.english ? "titleEn" : store.traditional ? "titleHant" : "title")
                }
            }
            let nextFocusKey = "\(store.focusedPolity)|\(store.showTerrain)"
            if focusKey != nextFocusKey {
                focusKey = nextFocusKey
                let normal = store.showTerrain ? 0.3 : 0.38
                let expression = store.focusedPolity.isEmpty ? NSExpression(mglJSONObject:["match",["get","role"],"neighbor",0.11,"protectorate",store.showTerrain ? 0.2 : 0.24,"rival",store.showTerrain ? 0.28 : 0.35,normal]) : NSExpression(forConditional:NSPredicate(format:"title == %@",store.focusedPolity),trueExpression:NSExpression(forConstantValue:0.55),falseExpression:NSExpression(forConstantValue:0.08))
                (style.layer(withIdentifier:"realms") as? MLNFillStyleLayer)?.fillOpacity = expression
                (style.layer(withIdentifier:"land") as? MLNFillStyleLayer)?.fillOpacity = NSExpression(forConstantValue:store.showTerrain ? 0 : 1)
                (style.layer(withIdentifier:"neighbors") as? MLNFillStyleLayer)?.fillOpacity = NSExpression(forConstantValue:store.showTerrain ? 0.08 : 1)
            }
            let nextAdminKey = store.historicalDetail?.adminTitles?.joined(separator:"|") ?? ""
            if adminKey != nextAdminKey {
                adminKey = nextAdminKey
                let titles = store.historicalDetail?.adminTitles ?? []
                for name in ["selected-admin","selected-admin-outline"] { (style.layer(withIdentifier:name) as? MLNVectorStyleLayer)?.predicate = NSPredicate(format:"layer IN {'prefecture','region'} AND title IN %@",titles) }
            }
            let nextInsetKey="\(store.mapTopHeight)|\(store.mapBottomHeight)|\(store.mapCardHeight)|\(store.mapRightWidth)|\(map.bounds.height)"
            if insetKey != nextInsetKey {
                insetKey=nextInsetKey
                layoutChangedAt=CACurrentMediaTime()
                map.contentInset = .init(top:map.safeAreaInsets.top+store.mapTopHeight,left:0,bottom:min(map.bounds.height*0.68,max(store.mapBottomHeight+map.safeAreaInsets.bottom,store.mapCardHeight)),right:store.mapRightWidth)
            }
            if previewKey != store.previewSnapshot {
                previewKey=store.previewSnapshot;previewTask?.cancel()
                if let key=store.previewSnapshot {
                    ghostTask?.cancel()
                    previewTask=Task { [weak self] in
                        do {
                            let prepared=try await Task.detached { try PreparedSnapshot(key:key) }.value
                            guard let self,!Task.isCancelled,let style=self.map?.style else { return }
                            let features=(prepared.territories as? MLNShapeCollectionFeature)?.shapes.filter { $0.attribute(forKey:"layer") as? String == "polity" && $0.attribute(forKey:"role") as? String != "neighbor" } ?? []
                            self.set(features,source:"ghost",style:style)
                            (style.layer(withIdentifier:"ghost") as? MLNLineStyleLayer)?.lineOpacity=NSExpression(forConstantValue:0.45)
                            style.layer(withIdentifier:"ghost")?.isVisible=true
                        } catch { }
                    }
                } else { set([],source:"ghost",style:style) }
            }
            refreshFeatures(style)
            refreshExtras(style)
            refreshPulses()
            if let destination=store.destination,destinationID != destination.id {
                destinationID=destination.id;cameraTask?.cancel()
                cameraTask=Task { [weak self] in
                    // SwiftUI cards settle their height after the navigation state changes.
                    // Applying an inset during a MapLibre transition cancels that transition.
                    if destination.waitsForLayout {
                        do {
                            try await Task.sleep(for:.milliseconds(180))
                            while let self,CACurrentMediaTime()-self.layoutChangedAt < 0.12 { try await Task.sleep(for:.milliseconds(40)) }
                        } catch { return }
                    }
                    guard let self,let map=self.map,!self.store.isGestureActive,self.store.destination?.id == destination.id else { return }
                    if destination.ensureVisible {
                        let point=map.convert(.init(latitude:destination.latitude,longitude:destination.longitude),toPointTo:map)
                        if map.bounds.inset(by:map.contentInset).insetBy(dx:map.bounds.width*0.14,dy:24).contains(point) { return }
                        self.store.playbackHold=max(self.store.playbackHold,3)
                    }
                    let camera:MLNMapCamera
                    if let bounds=destination.bounds,bounds.count == 4 {
                        camera=map.cameraThatFitsCoordinateBounds(.init(sw:.init(latitude:bounds[1],longitude:bounds[0]),ne:.init(latitude:bounds[3],longitude:bounds[2])),edgePadding:.init(top:28,left:24,bottom:36,right:24))
                    } else {
                        let center=CLLocationCoordinate2D(latitude:destination.latitude,longitude:destination.longitude)
                        camera=MLNMapCamera(lookingAtCenter:center,altitude:MLNAltitudeForZoomLevel(destination.zoom,0,center.latitude,map.bounds.size),pitch:0,heading:0)
                    }
                    let duration=UIAccessibility.isReduceMotionEnabled || self.store.isScrubbing ? 0 : destination.waitsForLayout ? 0.7 : 0.3
                    map.setCamera(camera,withDuration:duration,animationTimingFunction:CAMediaTimingFunction(name:.easeInEaseOut),completionHandler:nil)
                }
            }
        }

        private func refreshVisibility(_ style: MLNStyle) {
            guard let map else { return }
            var span=map.visibleCoordinateBounds.ne.longitude-map.visibleCoordinateBounds.sw.longitude
            if span < 0 { span += 360 }; let webZoom=76/max(0.01,span)
            let width=map.window?.bounds.width ?? map.bounds.width, mobile=width <= 900
            let town=webZoom >= (mobile ? 3.15 : 2.18), pass=webZoom >= (mobile ? 3.25 : 2.28)
            let key="\(map.zoomLevel < 8)|\(store.showHistoricalDetail)|\(store.capitalHintSeen)|\(town)|\(pass)|\(webZoom >= 3.55)|\(store.showBoundaries)|\(store.showWater)|\(store.showModern)|\(store.showProvinceNames)|\(store.showPlaces)|\(store.showCorridors)|\(store.showTerrain)|\(store.showTerritories)|\(store.showGhost)|\(store.showEvents)|\(store.quiz?.revision ?? "")|\(store.dynasty?.id ?? "")"
            if lodKey != key {
                lodKey=key;let quizHidden=store.quiz == nil, answered=store.quiz?.answered == true
                func visible(_ names:[String],_ flag:Bool){for name in names{style.layer(withIdentifier:name)?.isVisible=flag}}
                visible(["prefectures"],store.showBoundaries && (!mobile || webZoom >= 3.55))
                visible(["regions","regions-casing","admin-hit"],store.showBoundaries)
                visible(["region-labels"],store.showBoundaries && (quizHidden || answered))
                visible(["prefecture-labels"],store.showHistoricalDetail && store.showBoundaries && webZoom >= 3.55 && (quizHidden || answered))
                visible(["focus-dots","focus-labels"],store.showHistoricalDetail && store.showPlaces && quizHidden)
                visible(["rivers","rivers-casing","lakes","lake-outlines","hydro-labels"],store.showWater)
                visible(["modern","modern-casing","modern-outer","modern-maritime"],store.showModern)
                visible(["modern-labels"],store.showProvinceNames && (quizHidden || answered))
                visible(["modern-fill"],store.dynasty?.id == "prc")
                visible(["realms","realm-borders","protectorate-borders","realm-labels"],store.showTerritories)
                visible(["city-dots","city-labels","capital-labels"],store.showPlaces && quizHidden)
                visible(["capital-hint"],store.showPlaces && quizHidden && !store.capitalHintSeen && map.zoomLevel < 8)
                visible(["town-dots","town-labels"],store.showPlaces && quizHidden && town)
                visible(["pass-labels"],store.showCorridors && quizHidden && pass && store.dynasty?.id != "prc")
                visible(["corridor-wall","corridor-canal","corridor-silk","corridor-road","corridor-sea","corridor-labels"],store.showCorridors && quizHidden)
                visible(["event-dots"],store.showEvents && (quizHidden || answered))
                visible(["relief"],store.showTerrain);visible(["ghost","ghost-fill"],store.showGhost || store.previewSnapshot != nil)
                (style.layer(withIdentifier:"hydro-labels") as? MLNVectorStyleLayer)?.predicate=pass ? nil : NSPredicate(format:"tier == 0")
            }
            // Pixel-size expressions follow the web's inverse-square-root marker scaling.
            let scaleKey=String(Int(map.bounds.width))
            if visibilityKey != scaleKey {
                visibilityKey=scaleKey
                let boost=width <= 640 ? 1.46 : mobile ? 1.22 : 1
                let coefficient=Double(map.bounds.width)/1000 * boost * sqrt(108.088/max(1,Double(map.bounds.width)))
                for (name,size) in [("realm-labels",19.0),("region-labels",9),("prefecture-labels",8),("city-labels",8.8),("capital-labels",9.8),("town-labels",8),("pass-labels",8.8),("hydro-labels",7.2),("corridor-labels",8.8),("neighbor-labels",8),("modern-labels",9.5)] {
                    var expression:[Any] = ["interpolate",["linear"],["zoom"]]
                    for zoom in 0...14 {
                        let factor=coefficient*pow(2,Double(zoom)/2)
                        if name == "realm-labels" { expression += [zoom,["match",["get","role"],"rival",max(7,min(48,15*factor)),"protectorate",max(7,min(48,12*factor)),"neighbor",max(7,min(48,14*factor)),max(7,min(48,19*factor))] as [Any]] }
                        else { expression += [zoom,max(7,min(name == "prefecture-labels" ? 16 : 24,size*factor))] }
                    }
                    (style.layer(withIdentifier:name) as? MLNSymbolStyleLayer)?.textFontSize=NSExpression(mglJSONObject:expression)
                }
                for (name,base) in [("capital-labels",0.5625),("pass-labels",0.65),("event-dots",0.7)] {
                    var expression:[Any] = ["interpolate",["linear"],["zoom"]]
                    for zoom in 0...14 { expression += [zoom,max(0.3,min(2.0,base*coefficient*pow(2,Double(zoom)/2)))] }
                    (style.layer(withIdentifier:name) as? MLNSymbolStyleLayer)?.iconScale=NSExpression(mglJSONObject:expression)
                }
                for (name,base) in [("city-dots",2.2),("town-dots",1.7)] {
                    var expression:[Any] = ["interpolate",["linear"],["zoom"]]
                    for zoom in 0...14 { expression += [zoom,max(0.9,min(7,base*coefficient*pow(2,Double(zoom)/2)))] }
                    (style.layer(withIdentifier:name) as? MLNCircleStyleLayer)?.circleRadius=NSExpression(mglJSONObject:expression)
                }
            }
        }

        private func apply(_ prepared: PreparedSnapshot, to style: MLNStyle) {
            ghostTask?.cancel()
            store.mapStageLoading=false
            let animated=previousSnapshot != nil && !store.isScrubbing && !UIAccessibility.isReduceMotionEnabled && store.previewSnapshot == nil
            if let previousSnapshot, store.showGhost, animated {
                let current = Set((prepared.territories as? MLNShapeCollectionFeature)?.shapes.compactMap { ($0).attribute(forKey: "signature") as? String } ?? [])
                let ghost = (previousSnapshot.territories as? MLNShapeCollectionFeature)?.shapes.filter { $0.attribute(forKey: "layer") as? String == "polity" && !current.contains($0.attribute(forKey: "signature") as? String ?? "") } ?? []
                set(ghost, source: "ghost", style: style)
                let fill=style.layer(withIdentifier:"ghost-fill") as? MLNFillStyleLayer
                let outline=style.layer(withIdentifier:"ghost") as? MLNLineStyleLayer
                fill?.fillOpacityTransition=MLNTransition(duration:0,delay:0)
                outline?.lineOpacityTransition=MLNTransition(duration:0,delay:0)
                fill?.fillOpacity=NSExpression(forConstantValue:0.22)
                outline?.lineOpacity=NSExpression(forConstantValue:0.55)
                store.mapTransitionUntil=Date().addingTimeInterval(0.75)
                ghostTask = Task { [weak self] in
                    do { try await Task.sleep(for:.milliseconds(40)) } catch { return }
                    fill?.fillOpacityTransition=MLNTransition(duration:0.65,delay:0)
                    outline?.lineOpacityTransition=MLNTransition(duration:0.65,delay:0)
                    fill?.fillOpacity=NSExpression(forConstantValue:0)
                    outline?.lineOpacity=NSExpression(forConstantValue:0)
                    do { try await Task.sleep(for:.milliseconds(700)) } catch { return }
                    guard let self, let style = self.map?.style else { return }; self.set([], source: "ghost", style: style)
                }
            } else if store.previewSnapshot == nil { set([],source:"ghost",style:style) }
            previousSnapshot = prepared
            store.mapPolities = prepared.polities
            if let title=store.pendingPolityFit { store.fitPolity(title) }
            (style.source(withIdentifier:"mesh") as? MLNShapeSource)?.shape = prepared.mesh
            (style.source(withIdentifier: "atlas") as? MLNShapeSource)?.shape = prepared.territories
            (style.source(withIdentifier: "labels") as? MLNShapeSource)?.shape = prepared.labels
            prefetchTask?.cancel()
            if let next=store.catalog?.dynasties.flatMap(\.phases).first(where:{ $0.from > store.year }),cache.object(forKey:next.id as NSString) == nil {
                prefetchTask=Task { [weak self] in
                    do {
                        let value=try await Task.detached(priority:.utility) { try PreparedSnapshot(key:next.id) }.value
                        guard let self,!Task.isCancelled else { return };self.cache.setObject(value,forKey:next.id as NSString)
                    } catch { }
                }
            }
        }

        private func refreshFeatures(_ style: MLNStyle) {
            guard let map else { return }
            let nextPlacesKey="\(store.catalog?.version ?? "")|\(store.year)|\(store.language)"
            if placesInputKey != nextPlacesKey {
                placesInputKey=nextPlacesKey
                let activePlaces = store.places
                let signature=store.language+activePlaces.map { "\($0.id):\($0.name(at:store.year,english:false)):\($0.name(at:store.year,english:true)):\($0.isCapital(at:store.year))" }.joined(separator:"|")
                if placesKey != signature {
                placesKey=signature
                let hintCapital=activePlaces.first { $0.isCapital(at:store.year) }?.id
                let places = activePlaces.map { place -> MLNPointFeature in
                    let point = MLNPointFeature(); point.coordinate = place.coordinate
                    point.attributes = ["id": place.id,"hintCapital":place.id == hintCapital,"hint":store.text("点我溯源","Tap for history"), "title": place.name(at: store.year, english: false), "titleEn": place.name(at: store.year, english: true), "titleHant": AtlasChinese.traditional(place.name(at: store.year, english: false)), "capital": place.isCapital(at: store.year), "tier": place.tier, "sort": place.isCapital(at:store.year) ? 0 : place.tier*10]
                    return point
                }
                set(places, source: "places", style: style)
                }
            }
            let nextEventsKey="\(store.year)|\(store.activeEventID ?? "")|\(store.selection?.id ?? "")"
            if eventsInputKey != nextEventsKey {
                eventsInputKey=nextEventsKey
                let activeEvents = store.mappedEvents
                let signature=activeEvents.map(\.id).joined(separator:"|")+(store.currentMilestone?.id ?? "")+(store.activeEventID ?? "")
                if eventsKey != signature {
                eventsKey=signature
                let events = activeEvents.flatMap { event -> [MLNPointFeature] in
                    let coordinates = event.anchors?.isEmpty == false ? event.anchors!.map(\.coord) : (event.coords?.isEmpty == false ? event.coords! : [event.coord])
                    return (event.id == store.currentMilestone?.id || event.id == store.activeEventID ? coordinates : [event.coord]).map { coord in
                        let point = MLNPointFeature(); point.coordinate = .init(latitude: coord[1], longitude: coord[0])
                        point.attributes = ["id":event.id,"current":event.id == store.currentMilestone?.id || event.id == store.activeEventID]; return point
                    }
                }
                set(events, source: "events", style: style)
                }
            }
            let nextJourneyKey="\(store.experience?.id ?? "")|\(store.routeRevision)|\(store.experienceIndex)|\(store.encountersOnly)|\(store.language)"
            if journeyKey != nextJourneyKey {
                journeyKey=nextJourneyKey
                var shapes:[MLNShape & MLNFeature]=[]
                if let experience=store.experience {
                    let visible=store.visibleTrackIDs
                    for track in experience.tracks {
                        let dimmed=store.experienceIndex >= 0 && !visible.contains(track.id)
                        for (i,stop) in track.stops.enumerated() {
                            guard i > 0 || stop.fromCoord != nil else { continue }
                            let start=stop.fromCoord ?? track.stops[max(0,i-1)].coord
                            var coords=AtlasGeometry.curve([start]+stop.via+[stop.coord])
                            let future=store.experienceIndex >= 0 && (Int(stop.id) ?? 0) > store.experienceIndex
                            let line=MLNPolylineFeature(coordinates:&coords,count:UInt(coords.count));line.attributes=["color":track.color,"future":future,"opacity":dimmed ? 0.12 : future ? 0.4 : 0.85];shapes.append(line)
                        }
                    }
                    let relic=experience.profiles?.contains { $0.relic } == true
                    for (index,stop) in experience.stops.enumerated() where !store.encountersOnly || stop.encounter {
                        let peer=stop.convergencePeer.flatMap { experience.stops.indices.contains($0) ? experience.stops[$0] : nil }
                        let joined=peer.map { hypot(map.convert(.init(latitude:$0.coord[1],longitude:$0.coord[0]),toPointTo:map).x-map.convert(.init(latitude:stop.coord[1],longitude:stop.coord[0]),toPointTo:map).x,map.convert(.init(latitude:$0.coord[1],longitude:$0.coord[0]),toPointTo:map).y-map.convert(.init(latitude:stop.coord[1],longitude:stop.coord[0]),toPointTo:map).y) < 18 } ?? false
                        if joined,index > (stop.convergencePeer ?? index) { continue }
                        let peers=experience.stops.enumerated().filter { abs($0.element.coord[0]-stop.coord[0]) < 0.25 && abs($0.element.coord[1]-stop.coord[1]) < 0.25 }.map(\.offset)
                        let primary=peers.contains(store.experienceIndex) ? store.experienceIndex : peers.first ?? index
                        let order=peers.firstIndex(of:index) ?? 0
                        let angle=Double(order)*2*Double.pi/Double(max(1,peers.count))
                        let dx=index == primary ? 0 : cos(angle)*20,dy=index == primary ? 0 : sin(angle)*20
                        let point=MLNPointFeature();point.coordinate = .init(latitude:stop.coord[1],longitude:stop.coord[0])
                        let icon=joined ? AtlasCartography.convergencePin(style,color:stop.color,peerColor:peer?.color ?? stop.color) : AtlasCartography.journeyPin(style,color:stop.color,encounter:stop.encounter,relic:relic)
                        point.attributes=["id":stop.id,"number":relic ? "玺" : joined ? (stop.number ?? String(index+1))+"·"+(peer?.number ?? "") : stop.number ?? String(index+1),"color":stop.color,"active":index == store.experienceIndex,"encounter":stop.encounter,"title":stop.site,"titleEn":stop.site,"titleHant":AtlasChinese.traditional(stop.site),"icon":icon,"iconOffset":[dx,dy],"textOffset":[dx/11,dy/11],"sort":index == store.experienceIndex ? 0 : stop.encounter ? 1 : index+2,"opacity":store.experienceIndex < 0 || index <= store.experienceIndex ? 1.0 : 0.55]
                        shapes.append(point)
                    }
                }
                set(shapes,source:"journey",style:style)
            }
            let nextSelectionKey = "\(store.experience?.id ?? "")|\(store.language)|\(store.selectionTitle)|\(store.selection?.id ?? "")|\(store.currentStop?.id ?? "")|\(store.experienceIndex)"
            guard selectionKey != nextSelectionKey else { return }
            selectionKey = nextSelectionKey
            var selected: [MLNShape & MLNFeature] = []
            var coordinate: CLLocationCoordinate2D?
            if case .place(let place) = store.selection { coordinate = place.coordinate }
            if case .event(let event) = store.selection { coordinate = event.coordinate }
            if let stop = store.currentStop { coordinate = .init(latitude: stop.coord[1], longitude: stop.coord[0]) }
            if let coord = store.selectedCoordinate { coordinate = .init(latitude: coord[1], longitude: coord[0]) }
            if store.selection == nil, let stop = store.activeStop { coordinate = .init(latitude: stop.coord[1], longitude: stop.coord[0]) }
            if let coordinate {
                let point=MLNPointFeature();point.coordinate=coordinate
                let zh: String, en: String
                if store.selection != nil { zh=store.selectionTitle;en=store.selectionTitle }
                else { zh=store.activeStop?.site ?? "";en=zh }
                point.attributes=["title":zh,"titleEn":en,"titleHant":AtlasChinese.traditional(zh),"sort":0];selected.append(point)
            }
            set(selected, source: "selection", style: style)
        }

        private func refreshPulses() {
            guard let map else { return }
            if pulses == nil { let view=AtlasPulseOverlay(frame:map.bounds);map.addSubview(view);pulses=view }
            let color=UIColor(red:0.71,green:0.27,blue:0.18,alpha:1)
            var coords:[[Double]]=[]
            if store.showPlaces { coords += store.places.filter { $0.isCapital(at:store.year) }.map(\.coord) }
            if store.showEvents,let event=store.currentMilestone { coords += event.anchors?.map(\.coord) ?? [event.coord] }
            if let stop=store.activeStop { coords.append(stop.coord) }
            let points=coords.filter { $0.count == 2 }.map { (map.convert(.init(latitude:$0[1],longitude:$0[0]),toPointTo:map),color) }
            pulses?.update(points,enabled:store.quiz == nil && !store.playing && !store.isGestureActive)
        }

        @objc func pressed(_ gesture: UILongPressGestureRecognizer) {
            guard let map, gesture.state == .began, store.quiz == nil else { return }
            let coord = map.convert(gesture.location(in: map), toCoordinateFrom: map)
            store.inspect([coord.longitude, coord.latitude])
        }

        private func refreshExtras(_ style: MLNStyle) {
            let key = "\(store.year)|\(store.language)"
            if extrasKey != key {
                extrasKey = key
                let passes = (store.catalog?.passes ?? []).filter { store.year >= $0.appear && store.year < ($0.vanish ?? 9999) }.map { pass -> MLNPointFeature in
                    let point = MLNPointFeature(); point.coordinate = .init(latitude: pass.coord[1], longitude: pass.coord[0])
                    let name = pass.name(at: store.year, english: false)
                    point.attributes = ["id": pass.id, "title": name, "titleEn": pass.name(at: store.year, english: true), "titleHant":AtlasChinese.traditional(name),"sort":15]; return point
                }
                set(passes, source: "passes", style: style)
                let labels = store.hydroLabels.filter { store.year >= ($0.appear ?? -9999) && store.year < ($0.vanish ?? 9999) }.map { label -> MLNPointFeature in
                    let point = MLNPointFeature(); point.coordinate = .init(latitude: label.coord[1], longitude: label.coord[0])
                    let era = label.eraNames?.last { store.year >= $0.from && store.year < $0.until }
                    let zh = era?.zh ?? label.zh
                    point.attributes = ["title": zh, "titleEn": era?.en ?? label.en, "titleHant":AtlasChinese.traditional(zh),"rotation":label.rot ?? 0,"kind":label.kind,"tier":label.tier ?? (label.kind == "range" || label.kind == "desert" ? 1 : 0),"sort":50]; return point
                }
                set(labels, source: "hydroLabels", style: style)
            }
            let nextQuizKey = (store.quiz?.revision ?? "")+store.language
            if quizKey != nextQuizKey {
                quizKey = nextQuizKey
                var shapes: [MLNShape & MLNFeature] = []
                if let q = store.quiz, let guess = q.guess {
                    let point = MLNPointFeature(); point.coordinate = .init(latitude: guess[1], longitude: guess[0]); point.attributes = ["title": store.text("所选位置", "Your guess"), "color":"#a34e39","kind":"guess","hit":false];shapes.append(point)
                    if q.answered, let question = q.current {
                        let answer = MLNPointFeature(); answer.coordinate = .init(latitude: question.coord[1], longitude: question.coord[0]); answer.attributes = ["title": question.title, "color":"#4b8055","kind":"answer","hit":false];shapes.append(answer)
                        var coords=[point.coordinate,answer.coordinate];let errorLine=MLNPolylineFeature(coordinates:&coords,count:2);errorLine.attributes=["hit":true];shapes.append(errorLine)
                        for km in [80.0,200,380,600] {
                            var ring = (0...90).map { i -> CLLocationCoordinate2D in
                                let angle = Double(i) / 90 * .pi * 2
                                return .init(latitude: question.coord[1] + sin(angle) * km / 111, longitude: question.coord[0] + cos(angle) * km / (111 * cos(question.coord[1] * .pi / 180)))
                            }
                            let pts=km == 80 ? 100 : km == 200 ? 80 : km == 380 ? 55 : 25
                            let line=MLNPolylineFeature(coordinates:&ring,count:UInt(ring.count));line.attributes=["hit":q.lastPoints == pts];shapes.append(line)
                            let label=MLNPointFeature();label.coordinate = .init(latitude:question.coord[1]+km/(111*sqrt(2)),longitude:question.coord[0]-km/(111*sqrt(2)*cos(question.coord[1] * .pi/180)))
                            label.attributes=["title":"\(Int(km)) km · +\(pts)","kind":"ring","hit":q.lastPoints == pts,"color":"#a78e6d"];shapes.append(label)
                        }
                    }
                }
                set(shapes, source: "quiz", style: style)
            }
        }

        private func set(_ features: [MLNShape & MLNFeature], source: String, style: MLNStyle) {
            (style.source(withIdentifier: source) as? MLNShapeSource)?.shape = MLNShapeCollectionFeature(shapes: features)
        }

        @objc func tapped(_ gesture: UITapGestureRecognizer) {
            guard let map, gesture.state == .ended else { return }
            let location = gesture.location(in: map)
            if store.quiz != nil {
                let coord = map.convert(location, toCoordinateFrom: map); store.guess([coord.longitude, coord.latitude]); return
            }
            let hitBox = CGRect(x: location.x - 12, y: location.y - 12, width: 24, height: 24)
            let points = map.visibleFeatures(in: hitBox, styleLayerIdentifiers: ["focus-dots","focus-labels","city-dots", "capital-labels", "city-labels", "town-dots", "town-labels", "event-dots", "pass-labels", "capital-hint", "journey-stops", "journey-numbers"])
            for point in points {
                guard let id = point.attribute(forKey: "id") as? String else { continue }
                if let site=store.focusSites.first(where:{$0.id == id}) {
                    store.selectFocusSite(site);return
                }
                if let pass = store.catalog?.passes.first(where: { $0.id == id }) { store.inspect(pass.coord, title: store.text(pass.ancientZh, pass.ancientEn)); return }
                if let index = store.experience?.stops.firstIndex(where: { $0.id == id }) { store.experienceIndex = index; store.showExperienceStop(); return }
                if let place = store.catalog?.places.first(where: { $0.id == id }) { onSelect(.place(place)); return }
                if let event = store.catalog?.events.first(where: { $0.id == id }) {
                    var selected=event;selected.coord=[point.coordinate.longitude,point.coordinate.latitude]
                    onSelect(.event(selected)); return
                }
            }
            if let hit = map.visibleFeatures(in: hitBox, styleLayerIdentifiers: ["corridor-wall","corridor-canal","corridor-silk","corridor-road","corridor-sea"]).first,
               let id = hit.attribute(forKey: "id") as? String,
               let corridor = store.catalog?.corridors.first(where: { $0.id == id }) {
                store.inspect(corridor.labelAt, title: store.text(corridor.title, corridor.titleEn))
                store.mapNote = .init(title: store.text(corridor.title, corridor.titleEn), detail: store.text(corridor.summary, corridor.summaryEn)); return
            }
            if let admin = map.visibleFeatures(at: location, styleLayerIdentifiers: ["admin-hit"]).first,
               let title = admin.attribute(forKey: "title") as? String {
                let coord = map.convert(location, toCoordinateFrom: map)
                store.inspect([coord.longitude,coord.latitude], title: store.text(title, admin.attribute(forKey: "titleEn") as? String ?? title)); return
            }
            if let territory = map.visibleFeatures(at: location, styleLayerIdentifiers: ["realms"]).first {
                let title = territory.attribute(forKey: "title") as? String ?? ""
                let english = territory.attribute(forKey: "titleEn") as? String ?? title
                store.selectTerritory(title)
                onSelect(.territory(id: territory.attribute(forKey: "id") as? String ?? title, title: title, subtitle: english))
            }
        }
    }

    private final class PreparedSnapshot: @unchecked Sendable {
        let territories: MLNShape
        let labels: MLNShape
        let mesh: MLNShape
        let polities: [MapPolity]
        init(key: String) throws {
            mesh = try MLNShape(data:Data(contentsOf:AtlasResources.url("meshes/\(key).geojson")),encoding:String.Encoding.utf8.rawValue)
            territories = try MLNShape(data: Data(contentsOf: AtlasResources.url("snapshots/\(key).geojson")), encoding: String.Encoding.utf8.rawValue)
            let data = try Data(contentsOf: AtlasResources.url("labels/\(key).geojson"))
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            polities = (json?["features"] as? [[String: Any]] ?? []).compactMap { feature in
                guard let p = feature["properties"] as? [String: Any], p["layer"] as? String == "polity", let coord = (feature["geometry"] as? [String: Any])?["coordinates"] as? [Double] else { return nil }
                return MapPolity(id: p["id"] as? String ?? "", title: p["title"] as? String ?? "", titleEn: p["titleEn"] as? String ?? "", tint: p["tint"] as? String ?? "#b7a389", coord: coord, bounds:p["bounds"] as? [Double],role:p["role"] as? String)
            }
            labels = try MLNShape(data: Data(contentsOf: AtlasResources.url("labels/\(key).geojson")), encoding: String.Encoding.utf8.rawValue)
        }
    }
}
