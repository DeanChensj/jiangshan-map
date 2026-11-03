import Foundation
import Observation
import AVFoundation
import CoreLocation

extension AtlasStore {
    var selectedCoordinate: [Double]? {
        switch selection {
        case .place(let p): p.coord
        case .event(let e): e.coord
        case .coordinate(_, _, let coord): coord
        default: nil
        }
    }
    var activeStop: ExperienceStop? {
        guard let experience, experience.stops.indices.contains(experienceIndex) else { return nil }
        return experience.stops[experienceIndex]
    }
    func arguments(_ values: [String: Any] = [:]) -> [String: Any] {
        values.merging(["year": year, "lang": language]) { first, _ in first }
    }
    func refreshEra() {
        eraTask?.cancel()
        let args = arguments()
        eraTask = Task {
            do {
                try await Task.sleep(for: .milliseconds(100))
                let label: String = try await engine.query("era", args)
                guard !Task.isCancelled else { return }
                eraLabel = label
            } catch { }
        }
    }
    func inspect(_ coord: [Double], title: String = "", move: Bool = false, adminTitle:String? = nil) {
        mapNote = nil
        selection = .coordinate(id: UUID().uuidString, title: title.isEmpty ? text("此地沿革", "History of this place") : title, coord: coord)
        selectedAdminTitle=adminTitle
        refreshDetail()
        if move { fly(coord, zoom:nativeZoom(forWebScale:3.25)) }
    }
    func refreshDetail() {
        detailTask?.cancel()
        guard let coord = selectedCoordinate else { return }
        let args = arguments(["coord":coord,"label":selection?.title(english:english) ?? "","adminTitle":selectedAdminTitle ?? ""])
        detailTask = Task {
            do {
                let result: HistoricalDetail = try await engine.query("detail", args)
                guard !Task.isCancelled else { return }
                historicalDetail = result
            } catch { if !Task.isCancelled { actionError = error.localizedDescription } }
        }
    }
    func selectTerritory(_ title: String) {
        focusedPolity = focusedPolity == title ? "" : title
        Task {
            do { polityDetail = try await engine.query("polity", arguments(["key": title]), as: PolityDetail?.self);if !focusedPolity.isEmpty { fitPolity(title) } }
            catch { actionError = error.localizedDescription }
        }
    }
    func startPeople(_ query: String, stop: Int = -1) async {
        busy = true; defer { busy = false }
        do {
            let value: AtlasExperience = try await engine.query("people", arguments(["query": query]))
            journey = nil; selection = nil; quiz = nil; experience = value;focusedPolity="";polityDetail=nil;historicalDetail=nil;linkYearRange=nil;lockPeriod=false
            encountersOnly=false;routeRevision += 1
            experienceIndex = max(-1,min(value.stops.count-1,stop))
            if experienceIndex < 0 { let anchor=value.encounters.first ?? 0;setYear(value.stops[anchor].year);fitExperience() } else { showExperienceStop() }
        } catch { actionError = error.localizedDescription }
    }
    func startRoute(_ places: String, years: String) async -> Bool {
        busy = true; defer { busy = false }
        do {
            let value: AtlasExperience = try await engine.query("route", arguments(["place": places, "years": years]))
            journey = nil; selection = nil; quiz = nil; experience = value;focusedPolity="";polityDetail=nil;historicalDetail=nil;linkYearRange=nil;lockPeriod=false; experienceIndex = -1;routeRevision += 1;setYear(value.stops[0].year);fitExperience()
            return true
        } catch { actionError = error.localizedDescription; return false }
    }
    func stepExperience(_ direction: Int) {
        guard let experience else { return }
        if experienceIndex < 0 { experienceIndex=direction > 0 ? 0 : experience.stops.count-1 }
        else { experienceIndex=(experienceIndex+direction+experience.stops.count)%experience.stops.count }
        showExperienceStop()
    }
    func showExperienceStop() {
        guard let stop = activeStop else { return }
        selection=nil;historicalDetail=nil;setYear(stop.year);routeRevision += 1;fly(stop.coord,zoom:nativeZoom(forWebScale:3.25))
    }
    func handle(_ hit: SearchHit, preserveYear: Bool = false) async {
        playing=false;experience=nil;journey=nil;selection=nil;historicalDetail=nil;focusedPolity="";polityDetail=nil
        if hit.kind == "quiz" { await startQuiz(); return }
        if !hit.person.isEmpty { await startPeople(hit.person); return }
        if let id=hit.eventID,let event=catalog?.events.first(where:{ $0.id == id }) { presentEvent(event);return }
        if !preserveYear { setYear(hit.year) }
        if !hit.polity.isEmpty {
            let value: PolityDetail? = try? await engine.query("polity", arguments(["key": hit.polity]))
            polityDetail = value
            selection = .territory(id: hit.polity, title: hit.title, subtitle: hit.title)
            focusedPolity = value?.titles.first ?? hit.title
            fitPolity(focusedPolity)
            return
        }
        if let coord=hit.coord { inspect(coord,title:hit.title,move:true,adminTitle:hit.prefTitle) }
    }
    func setLanguage(_ language: String) {
        english = language == "en"; traditional = language == "zh-tw"
        refreshEra(); refreshDetail()
        if quiz != nil {
            let locale=language
            Task { if let questions:[QuizQuestion]=try? await engine.query("quiz",arguments(["reuse":true])),locale == self.language { self.quiz?.questions=questions } }
        }
        if let key=polityDetail?.key {
            Task { polityDetail=try? await engine.query("polity",arguments(["key":key]),as:PolityDetail?.self) }
        }
        if let experience {
            Task {
                let index = experienceIndex,filter=encountersOnly,camera=[cameraLongitude,cameraLatitude,cameraZoom]
                if experience.kind == "person" { await startPeople(experience.query ?? experience.id, stop: index) }
                else if await startRoute(experience.place ?? "", years: experience.years ?? String(year)) {
                    experienceIndex = min(index,(self.experience?.stops.count ?? 1)-1); if index < 0 { fitExperience() } else { showExperienceStop() }
                }
                encountersOnly=filter;routeRevision += 1;fly(Array(camera.prefix(2)),zoom:camera[2])
            }
        }
    }
    func startQuiz() async {
        busy = true; defer { busy = false }
        do {
            let questions: [QuizQuestion] = try await engine.query("quiz", arguments())
            guard !questions.isEmpty else { return }
            if quiz == nil { preQuizCamera=[cameraLongitude,cameraLatitude,cameraZoom];preQuizYear=year;preQuizLock=lockPeriod;preQuizRange=linkYearRange }
            playing=false;journey=nil;experience=nil;selection=nil;focusedPolity="";lockPeriod=false;linkYearRange=nil
            quiz=AtlasQuizState(questions:questions,originalYear:preQuizYear ?? year)
            setYear(questions[0].year); resetCamera()
        } catch { actionError = error.localizedDescription }
    }
    func guess(_ coordinate: [Double]) {
        guard quiz != nil, quiz?.answered == false else { return }
        quiz?.guess = coordinate
    }
    func confirmQuiz() {
        guard var q = quiz, let guess = q.guess, !q.answered, let question = q.current else { return }
        let dLat=(question.coord[1]-guess[1])*Double.pi/180,dLon=(question.coord[0]-guess[0])*Double.pi/180
        let hav=pow(sin(dLat/2),2)+cos(guess[1]*Double.pi/180)*cos(question.coord[1]*Double.pi/180)*pow(sin(dLon/2),2)
        let km=Int((12742*asin(sqrt(min(1,hav)))).rounded())
        let points = km <= 80 ? 100 : km <= 200 ? 80 : km <= 380 ? 55 : km <= 600 ? 25 : 0
        q.lastDistance = km; q.lastPoints = points; q.score += points; q.answered = true; quiz = q
    }
    func nextQuiz() {
        guard var q = quiz else { return }
        q.index += 1; q.guess = nil; q.answered = false; quiz = q
        if let question = q.current { setYear(question.year); resetCamera() }
    }
    func closeQuiz() {
        guard quiz != nil else { return };quiz=nil;linkYearRange=preQuizRange
        if let year=preQuizYear { setYear(year) }
        lockPeriod=preQuizLock
        if let camera=preQuizCamera { destination = .init(longitude:camera[0],latitude:camera[1],zoom:camera[2]) }
        preQuizYear=nil;preQuizCamera=nil;preQuizRange=nil
    }
    func openLink(_ url: URL) async {
        let items=URLComponents(url:url,resolvingAgainstBaseURL:false)?.queryItems ?? []
        func value(_ key:String)->String? { items.first { $0.name == key }?.value }
        func coordinate(_ values:[Double])->[Double]? {
            values.count == 2 && values.allSatisfy(\.isFinite) ? values : nil
        }
        let cameraCenter: [Double]?
        if let lng=value("lng").flatMap(Double.init),let lat=value("lat").flatMap(Double.init) { cameraCenter=coordinate([lng,lat]) }
        else { cameraCenter=value("center").flatMap { coordinate($0.split(separator:",").compactMap { Double($0) }) } }
        if quiz != nil { closeQuiz() }
        playing=false;experience=nil;journey=nil;selection=nil;polityDetail=nil;historicalDetail=nil;focusedPolity="";pendingPolityFit=nil;previewSnapshot=nil;lockPeriod=false;linkYearRange=nil
        if let language=value("lang") { setLanguage(language) }
        if let terrain=value("terrain") { showTerrain=terrain != "0" && terrain != "false" }
        if let y=value("year")?.components(separatedBy:",").first.flatMap(Int.init) { setYear(y) }
        if let key=value("polity") {
            if let detail=try? await engine.query("polity",arguments(["key":key]),as:PolityDetail?.self) {
                polityDetail=detail;focusedPolity=detail.titles.first ?? detail.title
                if year < detail.from || year > detail.to { setYear(detail.from) }
                selection = .territory(id:detail.key,title:detail.title,subtitle:detail.title);fitPolity(focusedPolity)
            }
        }
        if let person=value("person") ?? value("journey") {
            let stop=value("stop").flatMap(Int.init) ?? -1
            await startPeople(person,stop:value("journey") != nil ? -1 : stop)
            if value("journey") != nil,stop >= 0,let experience { experienceIndex=experience.stops.firstIndex { $0.journeyStopIndex == stop } ?? min(experience.stops.count-1,stop);showExperienceStop() }
        } else if let place=value("place") {
            let tokens:[Character] = [",",";","，","→","、"]
            if place.contains(where:{ tokens.contains($0) }) {
                if await startRoute(place,years:value("year") ?? String(year)),let index=value("routeStop").flatMap(Int.init),let experience { experienceIndex=max(0,min(experience.stops.count-1,index));showExperienceStop() }
            } else {
                let result:NativePlace?=try? await engine.query("locate",arguments(["place":place]))
                if let result,let coord=result.coord { inspect(coord,title:result.resolvedName ?? place,move:true) }
            }
        } else if let query=value("q") ?? value("hover") {
            let hits:[SearchHit]=(try? await engine.query("search",arguments(["query":query]))) ?? []
            if let hit=hits.first { await handle(hit,preserveYear:value("year") != nil) }
        } else if let trace=value("trace")?.split(separator:",").compactMap({ Double($0) }),trace.count == 2 { inspect(trace,move:true) }
        let target=cameraCenter ?? selectedCoordinate ?? activeStop?.coord ?? destination.map { [$0.longitude,$0.latitude] } ?? [cameraLongitude,cameraLatitude]
        if let raw=value("nativeZoom").flatMap(Double.init),raw.isFinite { fly(target,zoom:min(14,max(1,raw))) }
        else if let scale=value("zoom").flatMap(Double.init),scale.isFinite,scale > 0 { fly(target,zoom:nativeZoom(forWebScale:scale)) }
        else if let cameraCenter { fly(cameraCenter,zoom:cameraZoom) }
        if value("quiz") == "1" { await startQuiz() }
        if let from=value("from").flatMap(Int.init),let to=value("to").flatMap(Int.init),from <= to,to >= minYear,from <= maxYear { linkYearRange=max(minYear,from)...min(maxYear,to);setYear(year) }
        else { linkYearRange=nil }
    }

}

struct AtlasQuizState {
    var questions: [QuizQuestion]
    let originalYear: Int
    var index = 0, score = 0, lastDistance = 0, lastPoints = 0
    var guess: [Double]?
    var answered = false
    var current: QuizQuestion? { questions.indices.contains(index) ? questions[index] : nil }
    var revision: String { "\(index)|\(guess ?? [])|\(answered)" }
}

@MainActor @Observable final class AtlasMusicPlayer {
    var playing = false
    var index = 0
    var error: String?
    var volume: Double = 0.45 { didSet { player?.volume = Float(volume) } }
    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var endedObserver: NSObjectProtocol?
    @ObservationIgnored private var statusObserver: NSKeyValueObservation?
    func toggle(_ tracks: [MusicTrack]) {
        if playing { player?.pause(); playing = false }
        else if player != nil { player?.play(); playing = true }
        else { play(index, tracks) }
    }
    func play(_ index: Int, _ tracks: [MusicTrack]) {
        guard !tracks.isEmpty else { return }
        self.index = (index + tracks.count) % tracks.count; error = nil
        guard let url = URL(string: tracks[self.index].mp3) else { return }
        do { try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers]); try AVAudioSession.sharedInstance().setActive(true) }
        catch { self.error = error.localizedDescription; return }
        if let endedObserver { NotificationCenter.default.removeObserver(endedObserver) }
        let item = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: item); player?.volume = Float(volume)
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            if item.status == .failed {
                let message = item.error?.localizedDescription ?? "Unable to stream this track"
                Task { @MainActor in self?.playing = false; self?.error = message; self?.player = nil }
            }
        }
        endedObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            Task { @MainActor in guard let self else { return }; self.play(self.index + 1, tracks) }
        }
        playing = true; player?.play()
    }
}
