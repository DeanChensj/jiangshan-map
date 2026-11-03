import XCTest
import SwiftUI
import MapLibre
import Observation
import os
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

    private func withRenderedMap(_ store:AtlasStore,_ body:(MLNMapView,AtlasMapView.Coordinator) async throws -> Void) async throws {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous=scene.keyWindow,window=UIWindow(windowScene:scene)
        window.rootViewController=UIHostingController(rootView:ContentView(store:store));window.makeKeyAndVisible()
        defer { window.isHidden=true;window.rootViewController=nil;previous?.makeKey() }
        @MainActor func findMap(_ view:UIView)->MLNMapView? {
            if let map=view as? MLNMapView { return map }
            return view.subviews.lazy.compactMap { findMap($0) }.first
        }
        var map:MLNMapView?
        for _ in 0..<100 {
            window.layoutIfNeeded();map=findMap(window)
            if map?.style?.layer(withIdentifier:"realms") != nil,!store.mapStageLoading { break }
            try await Task.sleep(for:.milliseconds(50))
        }
        let loaded=try XCTUnwrap(map)
        let coordinator=try XCTUnwrap(loaded.delegate as? AtlasMapView.Coordinator)
        try await Task.sleep(for:.milliseconds(200))
        try await body(loaded,coordinator)
    }

    func testDismissCurrentModePausesJourneyTimelineAndQuiz() async throws {
        try await withStore { store,_ in
            await store.startPeople("libai")
            store.playing=true;store.beginPlayback()
            let year=store.year
            store.dismissCurrentMode()
            XCTAssertFalse(store.playing);XCTAssertNil(store.experience)
            XCTAssertEqual(store.year,year);XCTAssertNotNil(store.autoEvent)
            store.playing=true;store.beginPlayback()
            XCTAssertEqual(store.playbackProgress,store.timelineProgress(year),accuracy:0.000001)
            store.dismissCurrentMode();XCTAssertFalse(store.playing)
            await store.startQuiz();store.dismissCurrentMode()
            XCTAssertNil(store.quiz);XCTAssertFalse(store.playing);XCTAssertEqual(store.year,year)
        }
    }

    func testRenderedCameraEndRefreshesShareLinksWithoutPublishingRawMovement() async throws {
        try await withStore { store,_ in
            try await withRenderedMap(store) { map,_ in
                let changed=OSAllocatedUnfairLock(initialState:false)
                let previous=withObservationTracking { store.shareURL } onChange:{ changed.withLock { $0=true } }
                store.cameraLongitude=120;store.cameraLatitude=30;store.cameraZoom=7
                store.saveCamera()
                XCTAssertFalse(changed.withLock { $0 },"Raw camera changes must not refresh SwiftUI on each frame")
                map.setCenter(.init(latitude:31.5,longitude:121.25),zoomLevel:6,animated:false)
                for _ in 0..<100 {
                    if changed.withLock({$0}) { break }
                    try await Task.sleep(for:.milliseconds(20))
                }
                XCTAssertTrue(changed.withLock { $0 },"Finishing a camera move must refresh existing ShareLink values")
                let current=store.shareURL
                XCTAssertNotEqual(previous,current)
                let items=try XCTUnwrap(URLComponents(url:current,resolvingAgainstBaseURL:false)?.queryItems)
                let center=try XCTUnwrap(items.first { $0.name == "center" }?.value).split(separator:",").compactMap { Double($0) }
                XCTAssertEqual(center.count,2)
                XCTAssertEqual(center[0],121.25,accuracy:0.0001);XCTAssertEqual(center[1],31.5,accuracy:0.0001)
                XCTAssertEqual(try XCTUnwrap(items.first { $0.name == "nativeZoom" }?.value.flatMap(Double.init)),6,accuracy:0.01)
                let duplicate=OSAllocatedUnfairLock(initialState:false)
                withObservationTracking { _=store.shareURL } onChange:{ duplicate.withLock { $0=true } }
                store.publishCameraForSharing()
                XCTAssertFalse(duplicate.withLock { $0 },"Identical camera snapshots must not invalidate sharing again")
            }
        }
    }

    func testGenealogyUsesOwnerNavigationYearAndStableCatalogIdentity() async throws {
        try await withStore { store,_ in
            for language in ["zh","en","zh-tw"] {
                store.setLanguage(language)
                let detail:HistoricalDetail=try await store.engine.query("detail",store.arguments(["coord":[118.35,36.82]]))
                let row=try XCTUnwrap(detail.rows.first { $0.id == "zhanguo" })
                let event=try XCTUnwrap(row.events.first { $0.year == -221 })
                XCTAssertEqual(event.dynastyID,row.id);XCTAssertEqual(event.navigationYear,-222)
                store.inspect([118.35,36.82]);store.openGenealogyEvent(event)
                XCTAssertEqual(store.year,-222);XCTAssertEqual(store.dynasty?.id,row.id)
                let changan:HistoricalDetail=try await store.engine.query("detail",store.arguments(["coord":[108.94,34.27]]))
                let catalogEvent=try XCTUnwrap(changan.rows.flatMap(\.events).first { $0.eventID != nil })
                store.openGenealogyEvent(catalogEvent)
                if case .event(let selected)=store.selection { XCTAssertEqual(selected.id,catalogEvent.eventID) }
                else { XCTFail("A catalog event must open by identity regardless of its displayed language") }
                XCTAssertEqual(store.year,catalogEvent.navigationYear)
            }
        }
    }

    func testFormEncodedWebsiteLinksAndLiteralPlusRoundTrip() async throws {
        try await withStore { store,_ in
            await store.openLink(URL(string:"https://deanchen.me/jiangshan-map/?year=750&place=Chang%27an%2CRed+Cliffs&lang=en")!)
            XCTAssertNil(store.actionError);XCTAssertEqual(store.experience?.stops.count,2)
            await store.openLink(URL(string:"https://deanchen.me/jiangshan-map/?year=750&place=Red+Cliffs&lang=en")!)
            XCTAssertEqual(store.selectedCoordinate,[113.9,29.88])
            await store.openLink(URL(string:"jiangshan://atlas?year=%2B750&trace=%2B108.94,%2B34.27")!)
            XCTAssertEqual(store.year,750);XCTAssertEqual(store.selectedCoordinate,[108.94,34.27])
            let started=await store.startRoute("长安,洛阳",years:"+744,+745")
            XCTAssertTrue(started)
            let shared=store.nativeShareURL
            XCTAssertTrue(shared.absoluteString.contains("%2B744"))
            await store.openLink(shared)
            XCTAssertEqual(store.experience?.stops.map(\.year),[744,745])
        }
    }

    func testExplicitCameraNavigationRecoversWithoutRenderIdle() async throws {
        try await withStore { store,_ in
            try await withRenderedMap(store) { map,coordinator in
                // Rendering can still be busy after every recognizer has ended.
                store.isGestureActive=true
                store.fly([112.45,34.62],zoom:5,waitsForLayout:false)
                coordinator.refresh()
                for _ in 0..<100 {
                    if abs(map.centerCoordinate.longitude-112.45)<0.01,abs(map.zoomLevel-5)<0.01 { break }
                    try await Task.sleep(for:.milliseconds(20))
                }
                XCTAssertFalse(store.isGestureActive)
                XCTAssertEqual(map.centerCoordinate.longitude,112.45,accuracy:0.01)
                XCTAssertEqual(map.zoomLevel,5,accuracy:0.01)
            }
        }
    }

    func testWebsiteZoomUsesTheLaidOutMapViewport() async throws {
        try await withStore { store,_ in
            // Simulate receiving a link before the map has supplied its width.
            store.cameraViewportWidth=100
            await store.openLink(URL(string:"https://deanchen.me/jiangshan-map/?year=750&center=108.94,34.27&zoom=3.25")!)
            let destination=try XCTUnwrap(store.destination)
            XCTAssertEqual(destination.webScale,3.25)
            XCTAssertEqual(destination.resolvedZoom(viewportWidth:1024),4.944365301027181,accuracy:0.000001)
            await store.openLink(URL(string:"https://deanchen.me/jiangshan-map/?year=750&place=Chang%27an&lang=en")!)
            XCTAssertEqual(store.destination?.webScale,3.25)
            try await withRenderedMap(store) { map,coordinator in
                coordinator.refresh()
                for _ in 0..<150 {
                    let span=map.visibleCoordinateBounds.ne.longitude-map.visibleCoordinateBounds.sw.longitude
                    if abs(span-76/3.25)<0.03 { break }
                    try await Task.sleep(for:.milliseconds(20))
                }
                let span=map.visibleCoordinateBounds.ne.longitude-map.visibleCoordinateBounds.sw.longitude
                XCTAssertEqual(span,76/3.25,accuracy:0.03)
            }
        }
    }

    func testSelectedCorridorRetainsTranslationsAcrossLanguageChanges() async throws {
        try await withStore { store,_ in
            let corridor=try XCTUnwrap(store.catalog?.corridors.first { $0.kind == "canal" })
            store.setLanguage("zh");store.selectCorridor(corridor)
            XCTAssertEqual(store.selectionTitle,corridor.title)
            store.setLanguage("en")
            XCTAssertEqual(store.selectionTitle,corridor.titleEn)
            let note=try XCTUnwrap(store.mapNote)
            XCTAssertEqual(store.text(note.detail,note.detailEn ?? note.detail),corridor.summaryEn)
            store.setLanguage("zh-tw")
            XCTAssertEqual(store.selectionTitle,store.localChinese(corridor.title))
        }
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

    func testForwardAndBackwardSteppingVisitsEverySharedYearEvent() async throws {
        try await withStore { store,_ in
            store.setYear(616)
            let matches=try XCTUnwrap(store.catalog?.events.filter { $0.dynasty == "sui" && $0.source == "milestone" && $0.effectiveYear == 617 }.sorted { $0.year < $1.year })
            XCTAssertEqual(matches.count,2)
            store.step(1)
            XCTAssertEqual(store.year,617);XCTAssertEqual(store.currentMilestone?.id,matches.first?.id)
            store.step(1)
            XCTAssertEqual(store.year,617);XCTAssertEqual(store.currentMilestone?.id,matches.last?.id)
            store.step(1)
            XCTAssertEqual(store.year,618)
            store.step(-1)
            XCTAssertEqual(store.year,617);XCTAssertEqual(store.currentMilestone?.id,matches.last?.id)
            store.step(-1)
            XCTAssertEqual(store.year,617);XCTAssertEqual(store.currentMilestone?.id,matches.first?.id)
            store.step(1);store.lockPeriod=true;store.step(1)
            XCTAssertEqual(store.year,617);XCTAssertEqual(store.currentMilestone?.id,matches.last?.id)
        }
    }

    func testLandmarkSearchKeepsItsOwningHistoricalPeriod() async throws {
        try await withStore { store,_ in
            for (query,displayYear,navigationYear,dynasty) in [
                ("韩熙载夜宴图",960,959,"wudai"),
                ("文天祥潮阳",1279,1278,"nansong"),
                ("张献忠率军自武昌",1644,1643,"ming")
            ] {
                let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":query]))
                let hit=try XCTUnwrap(hits.first { $0.eventID != nil })
                await store.handle(hit)
                XCTAssertEqual(store.year,navigationYear,query);XCTAssertEqual(store.year,hit.year,query)
                XCTAssertEqual(store.dynasty?.id,dynasty,query)
                if case .event(let event)=store.selection { XCTAssertEqual(event.year,displayYear,query) }
                else { XCTFail("The landmark must remain selected") }
            }
        }
    }

    func testCustomRouteClearsThePreviousPeopleEncounterFilter() async throws {
        try await withStore { store,_ in
            await store.startPeople("李白,杜甫")
            store.encountersOnly=true
            let started=await store.startRoute("长安,洛阳,金陵",years:"750")
            XCTAssertTrue(started);XCTAssertFalse(store.encountersOnly)
            XCTAssertEqual(store.experience?.kind,"route");XCTAssertEqual(store.experience?.stops.count,3)
        }
    }

    func testJourneyBookmarksRestoreTheInspectedYearAndCamera() async throws {
        try await withStore { store,_ in
            for person in [true,false] {
                if person { await store.startPeople("sushi",stop:2) }
                else {
                    let started=await store.startRoute("长安,洛阳,金陵",years:"744,745,746")
                    XCTAssertTrue(started);store.experienceIndex=1;store.showExperienceStop()
                }
                let experienceID=store.experience?.id,index=store.experienceIndex
                store.inspect([108.94,34.27]);store.navigateToYear(1415)
                store.cameraLongitude=112.45;store.cameraLatitude=34.62;store.cameraZoom=6
                store.saveBookmark()
                let bookmark=try XCTUnwrap(store.bookmarks.first)
                XCTAssertEqual(bookmark.year,1415)
                store.experience=nil;store.navigateToYear(750);store.destination=nil
                store.restore(bookmark)
                for _ in 0..<200 {
                    if store.experience?.id == experienceID,store.selectedCoordinate == [108.94,34.27],store.year == bookmark.year,store.destination?.zoom == bookmark.zoom { break }
                    try await Task.sleep(for:.milliseconds(10))
                }
                XCTAssertEqual(store.experience?.id,experienceID);XCTAssertEqual(store.experienceIndex,index)
                XCTAssertEqual(store.selectedCoordinate,[108.94,34.27]);XCTAssertEqual(store.year,bookmark.year)
                XCTAssertEqual(store.destination?.longitude,bookmark.longitude)
                XCTAssertEqual(store.destination?.latitude,bookmark.latitude);XCTAssertEqual(store.destination?.zoom,bookmark.zoom)
            }
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
                let url=store.nativeShareURL
                await store.openLink(url)
                XCTAssertEqual(store.experience?.stops.count,2)
                XCTAssertEqual(store.experienceIndex,1)
                XCTAssertEqual(store.selectedCoordinate,[108.94,34.27])
            }
            await store.startPeople("sushi",stop:2)
            store.inspect([112.45,34.62]);let url=store.nativeShareURL
            await store.openLink(url)
            XCTAssertEqual(store.experience?.kind,"person");XCTAssertEqual(store.experienceIndex,2)
            XCTAssertEqual(store.selectedCoordinate,[112.45,34.62])
        }
    }

    func testGenealogyEventsEscapePeriodLocksAndLinkRanges() async throws {
        try await withStore { store,_ in
            store.setYear(750)
            let detail:HistoricalDetail=try await store.engine.query("detail",store.arguments(["coord":[108.94,34.27]]))
            let row=try XCTUnwrap(detail.rows.first { $0.id == "xihan" })
            let event=try XCTUnwrap(row.events.first { $0.year == -138 })
            for locked in [true,false] {
                store.lockPeriod=false;store.linkYearRange=nil;store.setYear(750)
                store.inspect([108.94,34.27]);store.lockPeriod=locked
                if !locked { store.linkYearRange=700...800 }
                let previousRequest=store.beginNavigation()
                store.openGenealogyEvent(event)
                XCTAssertEqual(store.year,-138);XCTAssertEqual(store.dynasty?.id,"xihan")
                XCTAssertFalse(store.lockPeriod);XCTAssertNil(store.linkYearRange)
                XCTAssertFalse(store.isCurrentNavigation(previousRequest))
                XCTAssertEqual(store.destination?.longitude,event.coord[0])
            }
        }
    }

    func testPolityFocusIncludesTheCurrentStageAcrossHistoricalNames() async throws {
        try await withStore { store,_ in
            for (key,year) in [("anbei_duhufu",647),("yangwu",902),("jingnan",951),("mingxia",1363),("manchukuo",1932),("liao",916),("liao",947)] {
                if key == "liao",store.polityDetail?.key == key { store.navigateToYear(year) }
                else { await store.openLink(URL(string:"jiangshan://atlas?year=\(year)&polity=\(key)")!) }
                let phase=try XCTUnwrap(store.phase)
                let data=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(contentsOf:AtlasResources.url("labels/\(phase.id).geojson"))) as? [String:Any])
                let features=try XCTUnwrap(data["features"] as? [[String:Any]])
                let mapped=Set(features.compactMap { feature -> String? in
                    guard let p=feature["properties"] as? [String:Any],p["layer"] as? String == "polity" else { return nil }
                    return p["title"] as? String
                })
                XCTAssertFalse(mapped.intersection(Set(store.focusedPolityTitles)).isEmpty,"\(key) at \(year)")
                store.togglePolityFocus();XCTAssertTrue(store.focusedPolityTitles.isEmpty)
                store.togglePolityFocus()
                XCTAssertFalse(mapped.intersection(Set(store.focusedPolityTitles)).isEmpty)
            }
        }
    }

    func testInspectionSharesPreserveTheViewAndNativeJourneyReturn() async throws {
        try await withStore { store,_ in
            for person in [true,false] {
                if person { await store.startPeople("sushi",stop:2) }
                else {
                    let started=await store.startRoute("长安,洛阳,金陵",years:"744,745,746")
                    XCTAssertTrue(started);store.selectExperienceStop(1)
                }
                let id=store.experience?.id,index=store.experienceIndex,stopYear=store.activeStop?.effectiveYear
                store.inspect([108.94,34.27]);store.navigateToYear(1415)
                let web=store.shareURL,native=store.nativeShareURL
                let items=URLComponents(url:web,resolvingAgainstBaseURL:false)!.queryItems!
                XCTAssertEqual(items.first { $0.name == "year" }?.value,"1415")
                XCTAssertFalse(items.contains { ["person","place","stop","routeStop","returnPerson","returnPlace"].contains($0.name) })
                await store.openLink(web)
                XCTAssertEqual(store.year,1415);XCTAssertEqual(store.selectedCoordinate,[108.94,34.27]);XCTAssertNil(store.experience)
                await store.openLink(native)
                XCTAssertEqual(store.year,1415);XCTAssertEqual(store.selectedCoordinate,[108.94,34.27])
                XCTAssertEqual(store.experience?.id,id);XCTAssertEqual(store.experienceIndex,index)
                store.returnToExperience()
                XCTAssertNil(store.selection);XCTAssertEqual(store.year,stopYear)
            }
        }
    }

    func testReturnToJourneyRestoresOverviewOrTheActiveStop() async throws {
        try await withStore { store,_ in
            for index in [-1,2] {
                await store.startPeople("sushi",stop:index)
                let bounds=store.destination?.bounds,stop=store.activeStop
                store.inspect([108.94,34.27],move:true)
                store.returnToExperience()
                XCTAssertNil(store.selection);XCTAssertNil(store.historicalDetail)
                XCTAssertEqual(store.experienceIndex,index)
                if let stop {
                    XCTAssertEqual(store.year,stop.effectiveYear);XCTAssertEqual(store.destination?.longitude,stop.coord[0])
                } else {
                    XCTAssertNotNil(bounds);XCTAssertEqual(store.destination?.bounds,bounds)
                }
            }
        }
    }

    func testManualJourneyStopSelectionPausesButAutoplayContinues() async throws {
        try await withStore { store,_ in
            await store.startPeople("libai",stop:2)
            store.playing=true;store.beginPlayback()
            store.selectExperienceStop(0)
            XCTAssertFalse(store.playing);XCTAssertEqual(store.experienceIndex,0)
            XCTAssertEqual(store.year,store.activeStop?.effectiveYear)
            store.playing=true;store.beginPlayback()
            store.mapStageLoading=false;store.mapTransitionUntil = .distantPast
            XCTAssertTrue(store.advancePlayback());XCTAssertTrue(store.playing)
            XCTAssertEqual(store.experienceIndex,1)
            store.experienceFooterNext();XCTAssertFalse(store.playing)
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

    func testPolitySearchUsesMappedStageOutsidePreviousConstraints() async throws {
        try await withStore { store,_ in
            for query in ["后唐","后秦","郑"] {
                store.setYear(750);store.lockPeriod=true;store.linkYearRange=700...800
                let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":query]))
                await store.handle(try XCTUnwrap(hits.first { !$0.polity.isEmpty }))
                let detail=try XCTUnwrap(store.polityDetail)
                XCTAssertTrue((detail.from...detail.to).contains(store.year),query)
                XCTAssertTrue(detail.stages.contains { $0.from<=store.year && store.year<=$0.to },query)
                XCTAssertFalse(store.lockPeriod);XCTAssertNil(store.linkYearRange)
            }
        }
    }

    func testUncuratedPolitySurvivesLanguageAndShareRestoration() async throws {
        try await withStore { store,_ in
            await store.openLink(URL(string:"jiangshan://atlas?year=617&polity=秦（薛举）")!)
            let original=try XCTUnwrap(store.polityDetail)
            let expected:PolityDetail=try await store.engine.query("polity",store.arguments(["key":original.key,"lang":"en"]))
            store.setLanguage("en")
            for _ in 0..<100 where store.polityDetail?.title != expected.title { try await Task.sleep(for:.milliseconds(10)) }
            XCTAssertEqual(store.polityDetail?.title,expected.title)
            XCTAssertEqual(store.polityDetail?.key,original.key)
            let url=store.nativeShareURL
            await store.openLink(url)
            XCTAssertEqual(store.polityDetail?.key,original.key)
            XCTAssertEqual(store.polityDetail?.stages.count,original.stages.count)
            XCTAssertEqual(store.year,617)
        }
    }

    func testLeavingPolityClearsPreviewAndCitySharesKeepTheirYear() async throws {
        try await withStore { store,_ in
            await store.openLink(URL(string:"jiangshan://atlas?year=230&polity=caowei")!)
            store.previewSnapshot=store.polityDetail?.stages.first?.snapKey
            store.exploreFocusCity("changan")
            XCTAssertNil(store.polityDetail);XCTAssertEqual(store.focusedPolity,"")
            XCTAssertNil(store.previewSnapshot);XCTAssertNil(store.pendingPolityFit)
            let url=store.nativeShareURL
            XCTAssertFalse(URLComponents(url:url,resolvingAgainstBaseURL:false)!.queryItems!.contains { $0.name == "polity" })
            await store.openLink(url);XCTAssertEqual(store.year,750)
            store.previewSnapshot="s_tang_b0a"
            store.choose(try XCTUnwrap(store.catalog?.dynasties.first { $0.id == "ming" }))
            XCTAssertNil(store.previewSnapshot)
            store.previewSnapshot="s_tang_b0a"
            store.presentEvent(try XCTUnwrap(store.catalog?.events.first { $0.year == 208 && $0.source == "milestone" }))
            XCTAssertNil(store.previewSnapshot)
        }
    }

    private func mapPolities(_ key:String) throws -> [MapPolity] {
        let data=try JSONSerialization.jsonObject(with:Data(contentsOf:AtlasResources.url("labels/\(key).geojson"))) as! [String:Any]
        return (data["features"] as! [[String:Any]]).compactMap { feature in
            let p=feature["properties"] as! [String:Any]
            guard p["layer"] as? String == "polity" else { return nil }
            let coord=(feature["geometry"] as! [String:Any])["coordinates"] as! [Double]
            return MapPolity(id:p["id"] as! String,title:p["title"] as! String,titleEn:p["titleEn"] as! String,tint:p["tint"] as! String,coord:coord,bounds:p["bounds"] as? [Double],role:p["role"] as? String)
        }
    }
    func testPolityFittingWaitsForTheExactTerritorialStage() async throws {
        try await withStore { store,_ in
            store.mapPolities=try mapPolities("s_qin_d")
            store.setYear(-214);store.destination=nil;store.fitPolity("秦")
            XCTAssertNil(store.destination);XCTAssertEqual(store.pendingPolityFit,"秦")
            store.mapPolities=try mapPolities("s_qin")
            store.fitPolity("秦")
            XCTAssertEqual(store.destination?.bounds,store.mapPolities.first { $0.title == "秦" }?.bounds)
            XCTAssertNil(store.pendingPolityFit)
        }
    }

    func testManualTimelineAndSelectionActionsInvalidatePendingNavigation() async throws {
        try await withStore { store,_ in
            let pending=Task { await store.startPeople("sushi") }
            for _ in 0..<1000 where !store.busy { await Task.yield() }
            XCTAssertTrue(store.busy)
            store.isScrubbing=true;store.experience=nil;store.journey=nil;store.navigateToYear(1415)
            await pending.value
            XCTAssertEqual(store.year,1415);XCTAssertNil(store.experience)
            store.selectTerritory("唐")
            store.selection = .territory(id:"test",title:"唐",subtitle:"Tang")
            store.clearSelection()
            try await Task.sleep(for:.milliseconds(200))
            XCTAssertNil(store.selection);XCTAssertNil(store.polityDetail)
            XCTAssertEqual(store.focusedPolity,"");XCTAssertNil(store.pendingPolityFit)
        }
    }

    func testFloatingInspectorReleasesItsMapInsetDuringQuiz() async throws {
        let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        guard scene.screen.bounds.width>=760 else { throw XCTSkip("Requires the iPad simulator layout") }
        try await withStore { store,_ in
            let previous=scene.keyWindow,window=UIWindow(windowScene:scene)
            store.sidebarVisible=true;store.inspectorDocked=false
            window.rootViewController=UIHostingController(rootView:ContentView(store:store));window.makeKeyAndVisible()
            defer { window.isHidden=true;window.rootViewController=nil;previous?.makeKey() }
            @MainActor func mapView(in view:UIView)->MLNMapView? {
                if let map=view as? MLNMapView { return map }
                return view.subviews.lazy.compactMap { mapView(in:$0) }.first
            }
            var map:MLNMapView?
            for _ in 0..<100 {
                window.layoutIfNeeded();map=mapView(in:window)
                if map?.style?.layer(withIdentifier:"realms") != nil,store.mapRightWidth > 0 { break }
                try await Task.sleep(for:.milliseconds(50))
            }
            let loaded=try XCTUnwrap(map)
            try await Task.sleep(for:.milliseconds(200))
            XCTAssertGreaterThan(loaded.contentInset.right,300)
            await store.startQuiz()
            try await Task.sleep(for:.milliseconds(300));window.layoutIfNeeded()
            XCTAssertNotNil(store.quiz);XCTAssertEqual(store.mapRightWidth,0)
            XCTAssertEqual(loaded.contentInset.right,0,accuracy:0.1)
        }
    }

    func testScrubbingOutOfPolityClearsContextAndPreservesSharedYear() async throws {
        try await withStore { store,_ in
            await store.openLink(URL(string:"jiangshan://atlas?year=230&polity=caowei")!)
            store.previewSnapshot=store.polityDetail?.stages.first?.snapKey
            store.isScrubbing=true;store.navigateToYear(1415);store.isScrubbing=false
            XCTAssertEqual(store.year,1415);XCTAssertNil(store.polityDetail)
            XCTAssertEqual(store.focusedPolity,"");XCTAssertNil(store.selection)
            XCTAssertNil(store.previewSnapshot);XCTAssertNil(store.pendingPolityFit)
            let url=store.nativeShareURL
            XCTAssertFalse(URLComponents(url:url,resolvingAgainstBaseURL:false)!.queryItems!.contains { $0.name == "polity" })
            await store.openLink(url);XCTAssertEqual(store.year,1415)
        }
    }

    func testEnglishPolityFocusToggleKeepsTheDossierAndRawIdentity() async throws {
        try await withStore { store,_ in
            store.setLanguage("en");store.setYear(750)
            let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":"Later Tang"]))
            await store.handle(try XCTUnwrap(hits.first { !$0.polity.isEmpty }))
            let detail=try XCTUnwrap(store.polityDetail)
            XCTAssertEqual(detail.key,"houtang");XCTAssertGreaterThan(detail.stages.count,0)
            store.mapPolities=try mapPolities(try XCTUnwrap(store.phase?.id))
            store.togglePolityFocus()
            XCTAssertEqual(store.focusedPolity,"");XCTAssertNil(store.pendingPolityFit)
            XCTAssertEqual(store.polityDetail?.key,detail.key)
            XCTAssertEqual(store.polityDetail?.stages.count,detail.stages.count)
            store.togglePolityFocus()
            XCTAssertEqual(store.focusedPolity,detail.titles.first)
            XCTAssertNotNil(store.destination?.bounds)
            XCTAssertEqual(store.polityDetail?.key,"houtang")
        }
    }

    func testEraDynastyAndPlaceSearchEscapeConflictingLocks() async throws {
        try await withStore { store,_ in
            for query in ["开元","秦","云中郡","建康"] {
                store.lockPeriod=false;store.linkYearRange=nil;store.setYear(1415)
                let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":query]))
                let hit=try XCTUnwrap(hits.first { $0.person.isEmpty && $0.polity.isEmpty && $0.eventID == nil })
                store.lockPeriod=true;store.linkYearRange=1400...1500
                await store.handle(hit)
                XCTAssertEqual(store.year,hit.year,query)
                XCTAssertFalse(store.lockPeriod);XCTAssertNil(store.linkYearRange)
            }
            store.setYear(1415);store.lockPeriod=true;store.linkYearRange=1400...1500
            let hits:[SearchHit]=try await store.engine.query("search",store.arguments(["query":"建康"]))
            await store.handle(try XCTUnwrap(hits.first),preserveYear:true)
            XCTAssertEqual(store.year,1415);XCTAssertTrue(store.lockPeriod)
            XCTAssertEqual(store.linkYearRange,1400...1500)
        }
    }

    func testLanguageChangesPreserveJourneyExplorationAndNewerStopSelection() async throws {
        try await withStore { store,_ in
            for person in [true,false] {
                store.lockPeriod=false;store.linkYearRange=nil;store.setLanguage("zh")
                if person { await store.startPeople("sushi",stop:2) }
                else { let started=await store.startRoute("长安,洛阳,金陵",years:"744,745,746");XCTAssertTrue(started);store.experienceIndex=1;store.showExperienceStop() }
                let source=try XCTUnwrap(store.experience),originalYear=store.year,index=store.experienceIndex
                store.inspect([112.45,34.62],title:"洛阳")
                let selectionID=store.selection?.id,range=(originalYear-5)...(originalYear+5),cameraID=store.destination?.id
                store.linkYearRange=range;store.lockPeriod=true;store.encountersOnly=true
                store.cameraLongitude=112.45;store.cameraLatitude=34.62;store.cameraZoom=8
                let args=person ? store.arguments(["query":source.query ?? source.id,"lang":"en"]) : store.arguments(["place":source.place!,"years":source.years!,"lang":"en"])
                let expected:AtlasExperience=try await store.engine.query(person ? "people":"route",args)
                store.setLanguage("en")
                for _ in 0..<100 where store.experience?.title != expected.title { try await Task.sleep(for:.milliseconds(10)) }
                XCTAssertEqual(store.experience?.title,expected.title)
                XCTAssertEqual(store.experienceIndex,index);XCTAssertEqual(store.year,originalYear)
                XCTAssertEqual(store.selection?.id,selectionID);XCTAssertEqual(store.selectedCoordinate,[112.45,34.62])
                XCTAssertEqual(store.linkYearRange,range);XCTAssertTrue(store.lockPeriod);XCTAssertTrue(store.encountersOnly)
                XCTAssertEqual(store.destination?.id,cameraID);XCTAssertEqual(store.cameraZoom,8)
                store.setLanguage("zh");store.experienceFooterNext()
                let nextIndex=store.experienceIndex,nextYear=store.year
                for _ in 0..<100 where store.experience?.title != source.title { try await Task.sleep(for:.milliseconds(10)) }
                XCTAssertEqual(store.experience?.title,source.title)
                XCTAssertEqual(store.experienceIndex,nextIndex);XCTAssertEqual(store.year,nextYear)
                XCTAssertEqual(store.linkYearRange,range)
            }
        }
    }

    func testComparisonSegmentsFollowTheActualPreviousEvent() async throws {
        try await withStore { store,_ in
            let value:AtlasExperience=try await store.engine.query("people",store.arguments(["query":"qinshihuang,wangjian"]))
            let track=try XCTUnwrap(value.tracks.first { $0.id == "qinshihuang" })
            let index=try XCTUnwrap(track.stops.firstIndex { $0.year == -228 && $0.site == "邯郸" })
            XCTAssertGreaterThan(index,0);XCTAssertEqual(track.stops[index-1].year,-229)
            XCTAssertEqual(track.stops[index].hasLeg,false)
            XCTAssertEqual(track.stops[index].fromCoord,track.stops[index-1].coord)
            XCTAssertTrue(track.stops[index].via.isEmpty)
            XCTAssertTrue(track.stops.contains { $0.hasLeg == true && !$0.via.isEmpty })
        }
    }

    func testQuizRejectsTimelineNavigationButAllowsQuestionProgression() async throws {
        try await withStore { store,_ in
            await store.startQuiz()
            let question=try XCTUnwrap(store.quiz?.current),year=store.year
            for target in [store.minYear,store.maxYear,year+10] {
                store.navigateToYear(target);XCTAssertEqual(store.year,year)
            }
            for direction in [-1,1] { store.step(direction);XCTAssertEqual(store.year,year) }
            store.beginPlayback();XCTAssertEqual(store.year,year)
            XCTAssertEqual(store.quiz?.current?.id,question.id)
            store.guess(question.coord);store.confirmQuiz();store.nextQuiz()
            XCTAssertEqual(store.quiz?.index,1);XCTAssertEqual(store.year,store.quiz?.current?.year)
            store.closeQuiz();XCTAssertNil(store.quiz)
        }
    }

    func testSelectedSettlementAndBookmarkUseTheDatedName() async throws {
        try await withStore { store,_ in
            let place=try XCTUnwrap(store.catalog?.places.first { $0.id == "tang-place-3" })
            store.setYear(700);store.select(place)
            XCTAssertEqual(store.selectionTitle,"神都洛阳")
            store.saveBookmark();XCTAssertEqual(store.bookmarks.first?.title,"神都洛阳")
            store.setLanguage("en");XCTAssertEqual(store.selectionTitle,"Shendu Luoyang")
            store.saveBookmark();XCTAssertEqual(store.bookmarks.first?.title,"Shendu Luoyang")
            store.setYear(705);XCTAssertEqual(store.selectionTitle,"Eastern Capital Luoyang")
        }
    }

    func testSameEventAnchorUpdatesTheRenderedSelectionSource() async throws {
        try await withStore { store,_ in
            let event=try XCTUnwrap(store.catalog?.events.first { ($0.anchors?.count ?? 0)>1 })
            store.setYear(event.effectiveYear)
            let scene=try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
            let previous=scene.keyWindow,window=UIWindow(windowScene:scene)
            window.rootViewController=UIHostingController(rootView:ContentView(store:store));window.makeKeyAndVisible()
            defer { window.isHidden=true;window.rootViewController=nil;previous?.makeKey() }
            @MainActor func findMap(_ view:UIView)->MLNMapView? {
                if let map=view as? MLNMapView { return map }
                return view.subviews.lazy.compactMap { findMap($0) }.first
            }
            var map:MLNMapView?
            for _ in 0..<100 {
                window.layoutIfNeeded();map=findMap(window)
                if map?.style?.layer(withIdentifier:"realms") != nil { break }
                try await Task.sleep(for:.milliseconds(50))
            }
            let loaded=try XCTUnwrap(map)
            for anchor in event.anchors!.prefix(2) {
                var selected=event;selected.coord=anchor.coord;store.select(selected)
                try await Task.sleep(for:.milliseconds(250));window.layoutIfNeeded()
                let source=try XCTUnwrap(loaded.style?.source(withIdentifier:"selection") as? MLNShapeSource)
                // Style-created source wrappers need not retain a Swift shape.
                // Query the tiled features actually used by the map renderer.
                var reachedAnchor=false
                for _ in 0..<60 {
                    reachedAnchor=source.features(matching:nil).contains { point in
                        abs(point.coordinate.longitude-anchor.coord[0])<0.03 && abs(point.coordinate.latitude-anchor.coord[1])<0.03
                    }
                    if reachedAnchor { break }
                    try await Task.sleep(for:.milliseconds(50))
                }
                XCTAssertTrue(reachedAnchor,"The selection source must move to the selected event anchor")
            }
        }
    }

}
