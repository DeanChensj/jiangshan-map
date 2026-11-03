import XCTest
import SwiftUI
import MapLibre
@testable import JiangshanAtlas

@MainActor final class AtlasStateTests:XCTestCase {
    func testConfiguredBundleIdentityMatchesItsURLType() throws {
        let identifier=try XCTUnwrap(Bundle.main.bundleIdentifier)
        let types=try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey:"CFBundleURLTypes") as? [[String:Any]])
        XCTAssertEqual(types.first?["CFBundleURLName"] as? String,identifier)
    }

    private func withStore(_ body:(AtlasStore,UserDefaults) async throws -> Void) async throws {
        let suite="atlas.tests.\(UUID().uuidString)"
        let defaults=try XCTUnwrap(UserDefaults(suiteName:suite))
        defaults.set(true,forKey:"atlas.guided")
        defer { defaults.removePersistentDomain(forName:suite) }
        let store=AtlasStore(preferences:defaults)
        await store.load()
        XCTAssertNil(store.error)
        XCTAssertNotNil(store.catalog)
        defer { store.detailTask?.cancel();store.eraTask?.cancel() }
        try await body(store,defaults)
    }

    func testTimelineRoundTripsAndSkipsYearZero() async throws {
        try await withStore { store,_ in
            for year in store.minYear...store.maxYear where year != 0 {
                XCTAssertEqual(store.year(atProgress:store.timelineProgress(year)),year,"\(year)")
            }
            store.setYear(-1);store.setYear(0);XCTAssertEqual(store.year,1)
            store.setYear(0);XCTAssertEqual(store.year,-1)
        }
    }

    func testYearRangeAndPeriodLockClampNavigation() async throws {
        try await withStore { store,_ in
            store.setYear(750)
            let period=try XCTUnwrap(store.dynasty)
            store.lockPeriod=true;store.setYear(1415)
            XCTAssertEqual(store.year,period.to)
            store.lockPeriod=false;store.linkYearRange=700...800
            store.setYear(600);XCTAssertEqual(store.year,700)
            store.setYear(900);XCTAssertEqual(store.year,800)
        }
    }

    func testPlaybackWaitsForStageAndTransitionAndBeginsWithOverview() async throws {
        try await withStore { store,_ in
            store.setYear(750);store.beginPlayback()
            XCTAssertEqual(store.destination?.bounds,store.catalog?.cameraBounds[store.phase!.id])
            let progress=store.playbackProgress,year=store.year
            store.mapStageLoading=true
            XCTAssertTrue(store.advancePlayback());XCTAssertEqual(store.playbackProgress,progress)
            store.mapStageLoading=false;store.mapTransitionUntil=Date().addingTimeInterval(10)
            XCTAssertTrue(store.advancePlayback());XCTAssertEqual(store.year,year)
            store.mapTransitionUntil = .distantPast
            XCTAssertTrue(store.advancePlayback());XCTAssertGreaterThan(store.playbackProgress,progress)
        }
    }

    func testSameYearEventsStepIndividually() async throws {
        try await withStore { store,_ in
            var data=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:AtlasResources.url("catalog.json"))) as? [String:Any])
            var records=try XCTUnwrap(data["events"] as? [[String:Any]])
            var duplicate=try XCTUnwrap(records.first { $0["source"] as? String=="milestone" })
            duplicate["id"]="same-year-regression-fixture"
            records.append(duplicate);data["events"]=records
            store.applyCatalog(try JSONDecoder().decode(AtlasCatalog.self,from:JSONSerialization.data(withJSONObject:data)))
            let year=try XCTUnwrap(duplicate["year"] as? Int)
            store.setYear(year)
            let events=store.events.filter { $0.source=="milestone" && $0.year==store.year }
            store.activeEventID=events[0].id
            XCTAssertTrue(store.stepSameYearEvent(1))
            XCTAssertEqual(store.activeEventID,events[1].id)
            XCTAssertEqual(store.year,year)
        }
    }

    func testScrubbingAcrossEventsKeepsMapProjectionStable() async throws {
        try await withStore { store,_ in
            store.setYear(1415)
            let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
            let previousWindow=scene.keyWindow
            let window=UIWindow(windowScene:scene)
            window.rootViewController=UIHostingController(rootView:ContentView(store:store))
            window.makeKeyAndVisible()
            defer { window.isHidden=true;window.rootViewController=nil;previousWindow?.makeKey() }
            @MainActor func mapView(in view:UIView)->MLNMapView? {
                if let map=view as? MLNMapView { return map }
                return view.subviews.lazy.compactMap { mapView(in:$0) }.first
            }
            var loadedMap:MLNMapView?
            for _ in 0..<100 {
                window.layoutIfNeeded()
                loadedMap=mapView(in:window)
                if loadedMap?.style?.layer(withIdentifier:"realms") != nil,store.mapBottomHeight > 0 { break }
                try await Task.sleep(for:.milliseconds(50))
            }
            let map=try XCTUnwrap(loadedMap)
            XCTAssertNotNil(map.style?.layer(withIdentifier:"realms"))
            try await Task.sleep(for:.milliseconds(200))
            let coordinate=CLLocationCoordinate2D(latitude:34,longitude:106.5)
            let point=map.convert(coordinate,toPointTo:map),inset=map.contentInset
            let chromeHeight=store.mapBottomHeight
            store.isScrubbing=true
            for year in [-403,-402,-397,-221,750,1415] {
                store.setYear(year)
                try await Task.sleep(for:.milliseconds(180))
                window.layoutIfNeeded()
                let updated=map.convert(coordinate,toPointTo:map)
                XCTAssertEqual(store.mapBottomHeight,chromeHeight,accuracy:0.5,"Bottom chrome changed at \(year)")
                XCTAssertEqual(map.contentInset,inset,"Event changes must not change the map viewport")
                XCTAssertEqual(updated.x,point.x,accuracy:0.5)
                XCTAssertEqual(updated.y,point.y,accuracy:0.5,"Map jumped while scrubbing to \(year)")
            }
        }
    }

    func testQuizScoresAndRestoresCameraYearAndRange() async throws {
        try await withStore { store,_ in
            store.setYear(750);store.linkYearRange=700...800;store.lockPeriod=true
            store.cameraLongitude=108.94;store.cameraLatitude=34.27;store.cameraZoom=8
            await store.startQuiz()
            let question=try XCTUnwrap(store.quiz?.current)
            store.guess(question.coord);store.confirmQuiz()
            XCTAssertEqual(store.quiz?.lastDistance,0);XCTAssertEqual(store.quiz?.score,100)
            store.confirmQuiz();XCTAssertEqual(store.quiz?.score,100,"Do not score the same answer twice")
            store.closeQuiz()
            XCTAssertNil(store.quiz);XCTAssertEqual(store.year,750)
            XCTAssertEqual(store.linkYearRange,700...800);XCTAssertTrue(store.lockPeriod)
            XCTAssertEqual(store.destination?.longitude,108.94);XCTAssertEqual(store.destination?.zoom,8)
        }
    }

    func testShareLinkRestoresYearCameraLanguageAndRange() async throws {
        try await withStore { store,defaults in
            store.setYear(750);store.linkYearRange=700...800;store.english=true
            store.cameraLongitude=112.45;store.cameraLatitude=34.62;store.cameraZoom=8.25
            XCTAssertEqual(store.shareURL.scheme,"https")
            XCTAssertEqual(store.shareURL.host,"deanchen.me")
            XCTAssertEqual(URLComponents(url:store.shareURL,resolvingAgainstBaseURL:false)?.path,"/jiangshan-map/")
            let url=store.nativeShareURL
            let restored=AtlasStore(preferences:defaults)
            await restored.load();await restored.openLink(url)
            defer { restored.detailTask?.cancel();restored.eraTask?.cancel() }
            XCTAssertEqual(restored.year,750);XCTAssertTrue(restored.english)
            XCTAssertEqual(restored.linkYearRange,700...800)
            XCTAssertEqual(restored.destination?.longitude,112.45)
            XCTAssertEqual(restored.destination?.latitude,34.62)
            XCTAssertEqual(restored.destination?.zoom,8.25)
        }
    }

    func testWebsiteCameraLinksAndSelectedPlaceSharesRestoreBothCenters() async throws {
        try await withStore { store,_ in
            for query in ["lng=120&lat=30","center=120,30"] {
                store.cameraLongitude=106.5;store.cameraLatitude=34
                await store.openLink(URL(string:"https://deanchen.me/jiangshan-map/?year=750&\(query)&zoom=4")!)
                XCTAssertEqual(store.destination?.longitude,120)
                XCTAssertEqual(store.destination?.latitude,30)
            }
            store.inspect([108.94,34.27]);store.cameraLongitude=112.45;store.cameraLatitude=34.62;store.cameraZoom=8
            let shared=store.shareURL
            let items=URLComponents(url:shared,resolvingAgainstBaseURL:false)!.queryItems!
            XCTAssertNil(items.first { $0.name == "lng" },"Camera coordinates must not override the web trace")
            XCTAssertEqual(items.first { $0.name == "center" }?.value,"112.45,34.62")
            await store.openLink(shared)
            XCTAssertEqual(store.selectedCoordinate,[108.94,34.27])
            XCTAssertEqual(store.destination?.longitude,112.45)
            XCTAssertEqual(store.destination?.latitude,34.62)
            XCTAssertEqual(store.destination?.zoom,8)
        }
    }

    func testDynamicRulerLanguageAndMixedComparisonShares() async throws {
        try await withStore { store,_ in
            await store.startPeople("汉和帝")
            store.setLanguage("en")
            for _ in 0..<100 {
                if store.experience?.title == "Emp. He" || store.actionError != nil { break }
                try await Task.sleep(for:.milliseconds(20))
            }
            XCTAssertNil(store.actionError)
            XCTAssertEqual(store.experience?.title,"Emp. He")
            await store.startPeople("苏轼,汉宣帝")
            let original=store.experience?.id
            await store.openLink(store.nativeShareURL)
            XCTAssertNil(store.actionError)
            XCTAssertEqual(store.experience?.id,original)
        }
    }

    func testSearchOpensLandmarkAndKeepsAdministrativeIdentity() async throws {
        try await withStore { store,_ in
            let events:[SearchHit]=try await store.engine.query("search",store.arguments(["query":"萧何营建未央宫成"]))
            await store.handle(try XCTUnwrap(events.first))
            XCTAssertEqual(store.activeEventID,"landmark-3")
            XCTAssertEqual(store.autoEvent?.id,"landmark-3")
            XCTAssertEqual(store.year,-200)
            if case .event(let event)=store.selection { XCTAssertEqual(event.id,"landmark-3") } else { XCTFail("Expected event details") }
            store.setYear(-218)
            let admins:[SearchHit]=try await store.engine.query("search",store.arguments(["query":"云中郡"]))
            await store.handle(try XCTUnwrap(admins.first))
            for _ in 0..<100 {
                if store.historicalDetail != nil { break }
                try await Task.sleep(for:.milliseconds(20))
            }
            XCTAssertEqual(store.historicalDetail?.adminTitles,["云中郡"])
        }
    }

    func testTerminalMilestonesUseNavigationDatesAndRetainDisplayDates() async throws {
        try await withStore { store,_ in
            store.setYear(906)
            let event=try XCTUnwrap(store.currentMilestone)
            XCTAssertEqual(event.id,"tang-event-51")
            XCTAssertEqual(event.year,907)
            XCTAssertTrue(store.mappedEvents.contains { $0.id == event.id })
            store.presentEvent(event)
            XCTAssertEqual(store.year,906);XCTAssertEqual(store.dynasty?.id,"tang")
            for event in store.catalog!.events where event.source == "milestone" {
                let dynasty=try XCTUnwrap(store.catalog!.dynasties.first { $0.id == event.dynasty })
                XCTAssertTrue((dynasty.from...dynasty.to).contains(event.effectiveYear))
            }
        }
    }

    func testHistoricalSiteNavigationEscapesLocksAndClearsNotesForNewSelections() async throws {
        try await withStore { store,_ in
            let site=try XCTUnwrap(store.focusSites.first { $0.id == "tang-dayan" })
            store.setYear(1415);store.lockPeriod=true;store.linkYearRange=1400...1500
            store.selectFocusSite(site,move:true)
            XCTAssertTrue(site.isVisible(at:store.year));XCTAssertFalse(store.lockPeriod);XCTAssertNil(store.linkYearRange)
            let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":"南诏"]))
            await store.handle(try XCTUnwrap(hits.first { !$0.polity.isEmpty }))
            XCTAssertNil(store.mapNote)
            XCTAssertNotNil(store.polityDetail)
            store.setYear(1415);store.lockPeriod=true;store.linkYearRange=1400...1500
            store.destination=nil;store.exploreFocusCity("changan")
            XCTAssertEqual(store.year,750);XCTAssertNotNil(store.destination)
        }
    }

    func testIndependentWindowStoresKeepPlaybackAndQuizDecksSeparate() async throws {
        try await withStore { first,defaults in
            let second=AtlasStore(preferences:defaults);await second.load()
            defer { second.detailTask?.cancel();second.eraTask?.cancel() }
            first.setYear(750);second.setYear(1415)
            first.beginPlayback();_ = first.advancePlayback()
            XCTAssertEqual(second.year,1415);XCTAssertFalse(second.playing)
            await first.startQuiz()
            let questions=try XCTUnwrap(first.quiz?.questions)
            await second.startQuiz()
            first.setLanguage("en")
            try await Task.sleep(for:.milliseconds(200))
            XCTAssertEqual(first.quiz?.questions.map(\.coord),questions.map(\.coord))
            XCTAssertEqual(first.quiz?.questions.map(\.id),questions.map(\.id))
        }
    }

    func testPreferencesAndBookmarksPersistInAnIsolatedStore() async throws {
        try await withStore { store,defaults in
            store.setYear(750);store.traditional=true;store.dismissOnboarding()
            store.showHistoricalDetail=false;store.showTodayReference=true
            store.cameraLongitude=109;store.cameraLatitude=34;store.cameraZoom=9
            store.saveCamera();store.saveBookmark()
            let restored=AtlasStore(preferences:defaults)
            XCTAssertEqual(restored.year,750);XCTAssertTrue(restored.traditional)
            XCTAssertFalse(restored.onboarding);XCTAssertFalse(restored.showHistoricalDetail)
            XCTAssertTrue(restored.showTodayReference);XCTAssertEqual(restored.cameraZoom,9)
            XCTAssertEqual(restored.bookmarks.count,1)
        }
    }

    func testTraditionalChinesePeopleSearchFindsNamesAndAliases() async throws {
        try await withStore { store,_ in
            let person=try XCTUnwrap(store.catalog?.people.first { $0.zh=="苏轼" })
            for query in ["苏轼","蘇軾","Su Shi"] { XCTAssertTrue(person.matches(query),query) }
            XCTAssertFalse(person.matches("unrelated_person_name"))
        }
    }

    func testHistoricalNamesAndClosureIntervals() async throws {
        try await withStore { store,_ in
            let palace=try XCTUnwrap(store.focusSites.first { $0.id=="tang-huaqing" })
            XCTAssertEqual(palace.name(at:650,english:false),"汤泉宫")
            XCTAssertEqual(palace.name(at:700,english:false),"温泉宫")
            XCTAssertEqual(palace.name(at:750,english:false),"华清宫")
            XCTAssertFalse(palace.isVisible(at:756))
            let temple=try XCTUnwrap(store.focusSites.first { $0.id=="tang-qinglong" })
            XCTAssertFalse(temple.isVisible(at:621));XCTAssertFalse(temple.isVisible(at:845))
            XCTAssertEqual(temple.name(at:846,english:true),"Huguo Temple")
        }
    }
    func testWindowsMergeBookmarkSavesAndDeletes() async throws {
        try await withStore { first,defaults in
            let second=AtlasStore(preferences:defaults)
            first.saveBookmark();second.saveBookmark()
            XCTAssertEqual(first.bookmarks.count,2);XCTAssertEqual(second.bookmarks.count,2)
            let kept=first.bookmarks[1].id
            second.deleteBookmarks(at:IndexSet(integer:0))
            first.saveBookmark()
            let restored=AtlasStore(preferences:defaults)
            XCTAssertEqual(restored.bookmarks.count,2)
            XCTAssertTrue(restored.bookmarks.contains { $0.id == kept })
        }
    }

    func testInvalidCoordinatesAreRejectedBeforeQuerySerialization() async throws {
        try await withStore { store,_ in
            for raw in ["nan,nan","inf,30","181,30","120,91","120,,30"] {
                await store.openLink(URL(string:"jiangshan://atlas?trace=\(raw)")!)
                XCTAssertNil(store.selection,raw)
            }
            do {
                let _:String=try await store.engine.query("era",["coord":[Double.nan,30]])
                XCTFail("Nonfinite JSON must throw")
            } catch { XCTAssertTrue(error.localizedDescription.contains("Invalid historical query")) }
        }
    }

    func testNewLinkSupersedesSuspendedPersonNavigation() async throws {
        try await withStore { store,_ in
            let first=Task { await store.openLink(URL(string:"jiangshan://atlas?person=sushi")!) }
            // The cold JavaScript context suspends the first request here.
            for _ in 0..<100 where !store.busy { await Task.yield() }
            XCTAssertTrue(store.busy)
            await store.openLink(URL(string:"jiangshan://atlas?year=1415&center=120,30&nativeZoom=9")!)
            await first.value
            XCTAssertEqual(store.year,1415);XCTAssertNil(store.experience)
            XCTAssertEqual(store.destination?.longitude,120);XCTAssertEqual(store.destination?.zoom,9)
            XCTAssertFalse(store.busy)
        }
    }

    func testExplicitEventEscapesConstraintsReplacesInspectorAndFramesDuringGestureGrace() async throws {
        try await withStore { store,_ in
            let event=try XCTUnwrap(store.catalog?.events.first { $0.year == 208 && $0.source == "milestone" })
            for locked in [true,false] {
                store.setYear(750);store.lockPeriod=locked;store.linkYearRange=700...800
                store.inspect([108.94,34.27]);store.destination=nil
                store.cameraInteractionUntil=Date().addingTimeInterval(30);store.isGestureActive=true
                store.presentEvent(event)
                XCTAssertEqual(store.year,event.effectiveYear)
                XCTAssertEqual(store.activeEventID,event.id)
                XCTAssertFalse(store.lockPeriod);XCTAssertNil(store.linkYearRange)
                if case .event(let selected)=store.selection { XCTAssertEqual(selected.id,event.id) }
                else { XCTFail("Old inspector must be replaced") }
                XCTAssertNotNil(store.destination,"Explicit navigation must frame immediately")
                store.destination=nil;store.cameraInteractionUntil=Date().addingTimeInterval(30);store.frameMilestone(event,automatic:true)
                XCTAssertNil(store.destination,"Automatic framing still respects the user's gesture")
            }
        }
    }

    func testBoundaryPersonStopsRetainDisplayDateAndNavigateInTheirDynasty() async throws {
        try await withStore { store,_ in
            await store.startPeople("caocao",stop:14)
            let stop=try XCTUnwrap(store.activeStop)
            XCTAssertEqual(stop.year,220);XCTAssertEqual(stop.effectiveYear,219)
            XCTAssertEqual(store.year,219);XCTAssertEqual(store.dynasty?.id,"donghan")
        }
    }

    func testRouteDelimitersAndInspectionRoundTrip() async throws {
        try await withStore { store,_ in
            for place in ["长安->洛阳","长安；洛阳"] {
                let started=await store.startRoute(place,years:"750");XCTAssertTrue(started)
                store.experienceIndex=1;store.showExperienceStop()
                store.inspect([108.94,34.27])
                let url=store.shareURL
                await store.openLink(url)
                XCTAssertEqual(store.experience?.stops.count,2)
                XCTAssertEqual(store.experienceIndex,1)
                XCTAssertEqual(store.selectedCoordinate,[108.94,34.27])
            }
            await store.startPeople("sushi",stop:2)
            store.inspect([112.45,34.62]);let url=store.shareURL
            await store.openLink(url)
            XCTAssertEqual(store.experience?.kind,"person");XCTAssertEqual(store.experienceIndex,2)
            XCTAssertEqual(store.selectedCoordinate,[112.45,34.62])
        }
    }

    func testWebsiteCoordinatesInspectButCameraCenterDoesNotAndInlinePlaceYearWins() async throws {
        try await withStore { store,_ in
            await store.openLink(URL(string:"jiangshan://atlas?year=750&lng=120&lat=30")!)
            XCTAssertEqual(store.selectedCoordinate,[120,30])
            await store.openLink(URL(string:"jiangshan://atlas?year=750&center=120,30")!)
            XCTAssertNil(store.selection)
            await store.openLink(URL(string:"jiangshan://atlas?year=1415&place=750:长安")!)
            XCTAssertEqual(store.year,750);XCTAssertNotNil(store.selectedCoordinate)
        }
    }

    func testManualInspectionPausesPlayback() async throws {
        try await withStore { store,_ in
            store.playing=true;store.inspect([120,30])
            XCTAssertFalse(store.playing)
        }
    }

}
