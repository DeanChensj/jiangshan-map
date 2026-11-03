import Foundation
import Observation
import CoreLocation

@MainActor @Observable
final class AtlasStore {
    @ObservationIgnored let preferences:UserDefaults
    @ObservationIgnored let engine=AtlasEngine()
    var catalog: AtlasCatalog?
    var error: String?
    var year: Int {
        didSet { preferences.set(year, forKey: "atlas.year") }
    }
    var english: Bool {
        didSet { preferences.set(english, forKey: "atlas.english") }
    }
    var traditional = false { didSet { preferences.set(traditional, forKey: "atlas.traditional") } }
    var showTerritories = true
    var showPlaces = true
    var showCorridors = true
    var showTerrain = true
    var showGhost = true
    var focusedPolity = ""
    var mapPolities: [MapPolity] = []
    var showBoundaries = true
    var showWater = true
    var showEvents = true
    var showModern = true
    var showProvinceNames = false
    var showHistoricalDetail = true
    var showTodayReference = false
    var focusSites:[AtlasFocusSite]=[]
    var playing = false
    var mapCardHeight = 0.0
    var mapTopHeight = 0.0
    var mapBottomHeight = 0.0
    var sidebarVisible = false
    var inspectorDocked=false
    var mapRightWidth=0.0
    var isScrubbing=false
    var routeRevision = 0
    var encountersOnly = false
    var autoEvent: AtlasEvent?
    var autoEventDismissed = false
    var activeEventID: String?
    var pendingPolityFit: String?
    var previewSnapshot: String?
    var capitalHintSeen=false { didSet { preferences.set(capitalHintSeen,forKey:"atlas.capitalHintSeen") } }
    var onboarding = true
    var selection: AtlasSelection? {
        didSet {
            if selection?.id != oldValue?.id {
                mapNote=nil;selectedAdminTitle=nil;historicalDetail=nil;detailTask?.cancel()
            }
        }
    }
    var selectedAdminTitle:String?
    var destination: CameraDestination?
    var journey: AtlasJourney?
    var journeyIndex = 0
    let bookmarkLibrary: AtlasBookmarkLibrary
    var bookmarks: [AtlasBookmark] { bookmarkLibrary.items }
    var mapNote: AtlasMapNote?
    var mapError: String?
    var actionError: String?
    var busy = false
    var experience: AtlasExperience?
    var experienceIndex = 0
    var historicalDetail: HistoricalDetail?
    var polityDetail: PolityDetail?
    var eraLabel = ""
    var playbackSpeed = 1.0
    var lockPeriod = false
    var linkYearRange: ClosedRange<Int>?
    var quiz: AtlasQuizState?
    var music = AtlasMusicPlayer()
    @ObservationIgnored var preQuizCamera: [Double]?
    @ObservationIgnored var preQuizYear: Int?
    @ObservationIgnored var preQuizLock = false
    @ObservationIgnored var preQuizRange: ClosedRange<Int>?
    @ObservationIgnored private var placesByDynasty:[String:[AtlasPlace]]=[:]
    @ObservationIgnored private var eventsByDynasty:[String:[AtlasEvent]]=[:]
    @ObservationIgnored var detailTask: Task<Void, Never>?
    @ObservationIgnored var eraTask: Task<Void, Never>?
    @ObservationIgnored var hydroLabels: [HydroLabel] = []
    // Camera changes don't publish to the SwiftUI view tree on every gesture frame.
    @ObservationIgnored var playbackProgress = 0.0
    @ObservationIgnored var playbackHold = 0
    @ObservationIgnored var playbackShown = 4
    @ObservationIgnored var mapStageLoading = false
    @ObservationIgnored var mapTransitionUntil = Date.distantPast
    @ObservationIgnored var cameraInteractionUntil = Date.distantPast
    @ObservationIgnored var cameraViewportWidth = 402.0
    @ObservationIgnored var isGestureActive = false
    @ObservationIgnored var cameraLongitude = 106.5
    @ObservationIgnored var cameraLatitude = 34.0
    @ObservationIgnored var cameraZoom = 2.4
    @ObservationIgnored private var pendingURL: URL?
    @ObservationIgnored private var lastSavedCamera: [Double]?
    @ObservationIgnored private var navigationRevision = 0

    @discardableResult func beginNavigation() -> Int {
        navigationRevision += 1
        busy=false
        return navigationRevision
    }
    func isCurrentNavigation(_ revision:Int) -> Bool { revision == navigationRevision && !Task.isCancelled }

    init(preferences:UserDefaults = .standard) {
        self.preferences=preferences
        bookmarkLibrary=AtlasBookmarkLibrary.library(for:preferences)
        let defaults = preferences
        year = defaults.object(forKey: "atlas.year") as? Int ?? 1415
        english = defaults.bool(forKey: "atlas.english")
        traditional=defaults.bool(forKey:"atlas.traditional")
        capitalHintSeen=defaults.bool(forKey:"atlas.capitalHintSeen")
        onboarding = !defaults.bool(forKey:"atlas.guided")
        if let camera = defaults.array(forKey: "atlas.camera") as? [Double], camera.count == 3 {
            cameraLongitude = camera[0]; cameraLatitude = camera[1]; cameraZoom = camera[2]
            lastSavedCamera = camera
        }
        if let preferences = defaults.dictionary(forKey: "atlas.layers") as? [String: Bool] {
            showTerritories = preferences["territories"] ?? true; showPlaces = preferences["places"] ?? true
            showCorridors = preferences["corridors"] ?? true; showTerrain = preferences["terrain"] ?? true
            showBoundaries = preferences["boundaries"] ?? true; showWater = preferences["water"] ?? true
            showEvents = preferences["events"] ?? true; showModern = preferences["modern"] ?? true
            showProvinceNames = preferences["provinceNames"] ?? false
            showGhost = preferences["ghost"] ?? true
            showHistoricalDetail = preferences["historicalDetail"] ?? true
            showTodayReference = preferences["todayReference"] ?? false
        }
    }

    func load() async {
        guard catalog == nil else { return }
        do {
            let url = AtlasResources.url("catalog.json")
            let loaded = try await Task.detached(priority: .userInitiated) {
                try JSONDecoder().decode(AtlasCatalog.self, from: Data(contentsOf: url))
            }.value
            applyCatalog(loaded)
            focusSites=(try? JSONDecoder().decode([AtlasFocusSite].self,from:Data(contentsOf:AtlasResources.url("focus-sites.json")))) ?? []
            hydroLabels = (try? JSONDecoder().decode([HydroLabel].self, from: Data(contentsOf: AtlasResources.url("hydro-labels.json")))) ?? []
            setYear(year)
            if let url = pendingURL { pendingURL = nil; open(url) }
        } catch { self.error = error.localizedDescription }
    }

    var dynasty: Dynasty? {
        catalog?.dynasties.last { year >= $0.from } ?? catalog?.dynasties.first
    }

    func applyCatalog(_ loaded:AtlasCatalog) {
        placesByDynasty=Dictionary(grouping:loaded.places,by:\.dynasty)
        eventsByDynasty=Dictionary(grouping:loaded.events,by:\.dynasty).mapValues { $0.sorted { $0.year < $1.year } }
        catalog=loaded
    }
    var phase: AtlasPhase? { dynasty?.phase(at: year) }
    var places: [AtlasPlace] {
        guard let dynasty else { return [] }
        return (placesByDynasty[dynasty.id] ?? []).filter { year >= $0.from && year <= $0.to }
    }
    var events: [AtlasEvent] {
        guard let dynasty else { return [] }
        return eventsByDynasty[dynasty.id] ?? []
    }
    var mappedEvents: [AtlasEvent] {
        let milestones = events.filter { $0.source == "milestone" && $0.effectiveYear <= year && $0.coord.count == 2 }
        let current = currentMilestone
        let settlementLocations=places.map { CLLocation(latitude:$0.coord[1],longitude:$0.coord[0]) }
        var occupied: [CLLocation] = []
        var visible = milestones.filter { event in
            if event.id == current?.id || event.id == activeEventID { return true }
            let location = CLLocation(latitude:event.coord[1],longitude:event.coord[0])
            if settlementLocations.contains(where:{ location.distance(from:$0) < 8000 }) { return false }
            if occupied.contains(where: { $0.distance(from:location) < 6000 }) { return false }
            occupied.append(location); return true
        }
        if case .event(let event) = selection, !visible.contains(where: { $0.id == event.id }) { visible.append(event) }
        return visible
    }
    var minYear: Int { catalog?.dynasties.first?.from ?? -403 }
    var maxYear: Int { catalog?.dynasties.last?.to ?? 2026 }
    var currentStop: JourneyStop? {
        guard let stops = journey?.stops, stops.indices.contains(journeyIndex) else { return nil }
        return stops[journeyIndex]
    }
    var mapRevision: String {
        "\(mapNote?.title ?? "")|\(showHistoricalDetail)|\(showTodayReference)|\(mapRightWidth)|\(activeEventID ?? "")|\(autoEvent?.id ?? "")|\(capitalHintSeen)|\(mapTopHeight)|\(mapBottomHeight)|\(showProvinceNames)|\(playing)|\(mapCardHeight)|\(routeRevision)|\(encountersOnly)|\(historicalDetail?.adminTitles?.joined() ?? "")|\(previewSnapshot ?? "")|\(year)|\(language)|\(showTerritories)|\(showPlaces)|\(showCorridors)|\(showTerrain)|\(showGhost)|\(focusedPolity)|\(experience?.id ?? "")|\(experienceIndex)|\(quiz?.revision ?? "")|\(showBoundaries)|\(showWater)|\(showEvents)|\(showModern)|\(journey?.id ?? "")|\(journeyIndex)|\(selection?.id ?? "")|\(destination?.id.uuidString ?? "")"
    }
    var webBaseURL: URL { URL(string:Bundle.main.object(forInfoDictionaryKey:"AtlasWebURL") as? String ?? Bundle.main.object(forInfoDictionaryKey:"AtlasFallbackShareURL") as? String ?? "https://deanchen.me/jiangshan-map/")! }
    var shareURL: URL {
        var components=URLComponents(url:webBaseURL,resolvingAgainstBaseURL:false)!
        var items=[URLQueryItem(name:"year",value:String(year)),URLQueryItem(name:"lang",value:language)]
        if let experience {
            if experience.kind == "person" {
                items.append(.init(name:"person",value:experience.query ?? experience.id))
                if experienceIndex >= 0 { items.append(.init(name:"stop",value:String(experienceIndex))) }
            } else { items.removeFirst();items += [.init(name:"place",value:experience.place),.init(name:"year",value:experience.years)];if experienceIndex >= 0 { items.append(.init(name:"routeStop",value:String(experienceIndex))) } }
        }
        if let range=linkYearRange { items += [.init(name:"from",value:String(range.lowerBound)),.init(name:"to",value:String(range.upperBound))] }
        if let polityDetail { items.append(.init(name:"polity",value:polityDetail.key)) }
        if let coord=selectedCoordinate { items.append(.init(name:"trace",value:coord.map(String.init(describing:)).joined(separator:","))) }
        let scale=76*512*pow(2,cameraZoom)/(360*cameraViewportWidth)
        items += [.init(name:"terrain",value:showTerrain ? "1":"0"),.init(name:"center",value:"\(cameraLongitude),\(cameraLatitude)"),.init(name:"zoom",value:String(min(8,max(1,scale)))),.init(name:"nativeZoom",value:String(cameraZoom))]
        components.queryItems=items;return components.url!
    }
    var nativeShareURL: URL {
        var c=URLComponents(url:shareURL,resolvingAgainstBaseURL:false)!;c.scheme="jiangshan";c.host="atlas";c.path="";return c.url!
    }

    var language: String { english ? "en" : traditional ? "zh-tw" : "zh" }
    func text(_ chinese: String, _ translated: String) -> String { english ? translated : localChinese(chinese) }
    func localChinese(_ value: String) -> String { traditional ? AtlasChinese.traditional(value) : value }
    func yearLabel(_ value: Int? = nil) -> String {
        let y = value ?? year
        return y < 0 ? text("公元前 \(-y) 年", "\(-y) BCE") : text("公元 \(y) 年", "\(y) CE")
    }
    func setYear(_ value: Int) {
        let bounded = min(timelineEnd,max(timelineStart,value))
        var target = bounded == 0 ? (year < 0 ? 1 : -1) : bounded
        if lockPeriod, let dynasty { target = min(dynasty.to, max(dynasty.from, target)) }
        if let activeEventID,catalog?.events.first(where:{ $0.id == activeEventID })?.effectiveYear != target { self.activeEventID=nil }
        year = target
        syncMilestone()
        refreshEra()
        if selection != nil { refreshDetail() }
    }
    func choose(_ dynasty: Dynasty) {
        beginNavigation()
        if dynasty.to < timelineStart || dynasty.from > timelineEnd { linkYearRange=nil }
        journey = nil; experience = nil; selection = nil; focusedPolity = ""; polityDetail=nil; historicalDetail=nil
        setYear(min(dynasty.to, max(dynasty.from, dynasty.focus)))
    }
    func step(_ direction: Int) {
        if experience != nil { stepExperience(direction); return }
        if journey != nil { stepJourney(direction); return }
        if stepSameYearEvent(direction) { return }
        let dates = timelineNodeYears
        if direction > 0 { if let next = dates.first(where: { $0 > year }) { setYear(next); if let event=currentMilestone, event.effectiveYear == year { frameMilestone(event) } } }
        else if let previous = dates.last(where: { $0 < year }) { setYear(previous); if let event=currentMilestone, event.effectiveYear == year { frameMilestone(event) } }
    }
    func select(_ place: AtlasPlace) {
        beginNavigation();playing=false
        if place.isCapital(at:year) { capitalHintSeen=true }
        mapNote = nil
        if year < place.from || year > place.to { setYear(place.from) }
        selection = .place(place)
        refreshDetail()
        fly(place.coord, zoom: nativeZoom(forWebScale:3.25))
    }
    func select(_ event: AtlasEvent) {
        presentEvent(event)
    }
    func fly(_ coord: [Double], zoom: Double, waitsForLayout: Bool = true) {
        guard coord.count == 2,coord.allSatisfy(\.isFinite),zoom.isFinite else { return }
        destination = .init(longitude: min(180,max(-180,coord[0])), latitude: min(85,max(-85,coord[1])), zoom: min(14,max(1,zoom)), waitsForLayout:waitsForLayout)
    }
    func resetCamera() {
        let bounds = phase.flatMap { catalog?.cameraBounds[$0.id] } ?? [66, 14, 142, 55]
        destination = .init(longitude: 106.5, latitude: 34, zoom: 2.4, bounds: bounds)
    }
    func beginPlayback() {
        if let experience {
            if experienceIndex < 0 { experienceIndex=0;showExperienceStop() }
            if experienceIndex >= experience.stops.count { experienceIndex=0;showExperienceStop() }
            return
        }
        if year >= timelineEnd { setYear(lockPeriod ? dynasty?.from ?? timelineStart : timelineStart) }
        playbackProgress=timelineProgress(year);playbackHold=0;playbackShown=4
        syncMilestone();autoEventDismissed=false;resetCamera()
    }
    func advancePlayback() -> Bool { playbackTick() }
    func startJourney(_ value: AtlasJourney) { let request=beginNavigation();Task { await startPeople(value.id, stop: -1,navigation:request) } }
    func stepJourney(_ direction: Int) {
        guard let journey else { return }
        journeyIndex = min(journey.stops.count - 1, max(0, journeyIndex + direction))
        showJourneyStop()
    }
    private func showJourneyStop() {
        guard let stop = currentStop else { return }
        setYear(stop.year); fly(stop.coord, zoom: 5.0)
    }
    func saveBookmark() {
        let title = selection?.title(english: english) ?? dynasty.map { english ? $0.titleEn : $0.title } ?? "江山"
        bookmarkLibrary.insert(.init(id: UUID(), title: title, year: year, longitude: cameraLongitude, latitude: cameraLatitude, zoom: cameraZoom, url: shareURL.absoluteString))
    }
    func deleteBookmarks(at offsets: IndexSet) {
        bookmarkLibrary.delete(ids:Set(offsets.compactMap { bookmarks.indices.contains($0) ? bookmarks[$0].id : nil }))
    }
    func restore(_ bookmark: AtlasBookmark) {
        let revision=beginNavigation()
        journey = nil; selection = nil; setYear(bookmark.year)
        destination = .init(longitude: bookmark.longitude, latitude: bookmark.latitude, zoom: bookmark.zoom)
        if let raw = bookmark.url, let url = URL(string: raw) {
            Task { await openLink(url,navigation:revision);guard isCurrentNavigation(revision) else { return };destination = .init(longitude: bookmark.longitude, latitude: bookmark.latitude, zoom: bookmark.zoom) }
        }
    }
    func saveCamera() {
        let layers = ["territories": showTerritories, "places": showPlaces, "corridors": showCorridors, "terrain": showTerrain, "boundaries": showBoundaries, "water": showWater, "events": showEvents, "modern": showModern, "provinceNames": showProvinceNames, "ghost": showGhost, "historicalDetail":showHistoricalDetail, "todayReference":showTodayReference]
        if preferences.dictionary(forKey: "atlas.layers") as? [String: Bool] != layers { preferences.set(layers, forKey: "atlas.layers") }
        let camera = [cameraLongitude, cameraLatitude, cameraZoom]
        guard camera != lastSavedCamera else { return }
        preferences.set(camera, forKey: "atlas.camera")
        lastSavedCamera = camera
    }
    func open(_ url: URL) {
        guard catalog != nil else { pendingURL = url; return }
        let revision=beginNavigation()
        Task { await openLink(url,navigation:revision) }
    }
}

/// Shared by windows using the same preferences object. Mutations also merge
/// against persisted data, so separately constructed suites cannot lose writes.
@MainActor @Observable final class AtlasBookmarkLibrary {
    private static let libraries=NSMapTable<UserDefaults,AtlasBookmarkLibrary>(keyOptions:.weakMemory,valueOptions:.weakMemory)
    @ObservationIgnored private let preferences:UserDefaults
    private(set) var items:[AtlasBookmark]
    static func library(for preferences:UserDefaults) -> AtlasBookmarkLibrary {
        if let library=libraries.object(forKey:preferences) { return library }
        let library=AtlasBookmarkLibrary(preferences)
        libraries.setObject(library,forKey:preferences)
        return library
    }
    private init(_ preferences:UserDefaults) {
        self.preferences=preferences
        items=Self.read(preferences)
    }
    private static func read(_ preferences:UserDefaults) -> [AtlasBookmark] {
        preferences.data(forKey:"atlas.bookmarks").flatMap { try? JSONDecoder().decode([AtlasBookmark].self,from:$0) } ?? []
    }
    func insert(_ bookmark:AtlasBookmark) { items=Self.read(preferences);items.insert(bookmark,at:0);save() }
    func delete(ids:Set<UUID>) { items=Self.read(preferences).filter { !ids.contains($0.id) };save() }
    private func save() { if let data=try? JSONEncoder().encode(items) { preferences.set(data,forKey:"atlas.bookmarks") } }
}
