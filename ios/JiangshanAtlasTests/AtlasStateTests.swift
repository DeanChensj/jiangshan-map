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
}
