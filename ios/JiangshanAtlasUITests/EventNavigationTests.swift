import XCTest

final class EventNavigationTests:XCTestCase {
    private func launch(year:Int)->XCUIApplication {
        continueAfterFailure=false
        let app=XCUIApplication()
        app.launchArguments=["-atlas.guided","YES"]
        app.launchEnvironment["ATLAS_UI_TEST_URL"]="jiangshan://atlas?year=\(year)&lang=en&center=106.5,34&nativeZoom=3.5"
        app.launch()
        XCTAssertTrue(app.buttons["atlas.event.peek"].waitForExistence(timeout:30))
        return app
    }

    func testImperialSealShortcutRevealsJourneyAndDismissesDetails() {
        let app=launch(year:-221)
        app.buttons["atlas.event.peek"].tap()
        let seal=app.buttons["atlas.event.imperial-seal"]
        XCTAssertTrue(seal.waitForExistence(timeout:10))
        seal.tap()
        let journey=app.buttons["atlas.journey.open"]
        XCTAssertTrue(journey.waitForExistence(timeout:15))
        XCTAssertTrue(journey.isHittable)
        XCTAssertFalse(seal.exists,"The detail sheet must close after entering the journey")
    }

    func testNamedEventAnchorsPreserveTheSelectedEvent() {
        let app=launch(year:-403)
        app.buttons["atlas.event.peek"].tap()
        let title=app.staticTexts["atlas.selection.title"]
        XCTAssertTrue(title.waitForExistence(timeout:10))
        let originalTitle=title.label
        let first=app.buttons["atlas.event.anchor.0"],second=app.buttons["atlas.event.anchor.1"]
        XCTAssertTrue(first.exists);XCTAssertTrue(second.exists)
        XCTAssertNotEqual(first.label,second.label)
        XCTAssertFalse(first.label.hasPrefix("Location "))
        second.tap()
        XCTAssertEqual(title.label,originalTitle)
        XCTAssertTrue(first.exists,"Moving to an anchor must retain the event's other locations")
    }

    func testExploreMenuPausesPlaybackAndRemainsUsable() {
        let app=launch(year:1412)
        let playback=app.buttons["atlas.playback.toggle"]
        let event=app.buttons["atlas.event.peek"]
        let originalLabel=event.label,originalY=event.frame.minY
        playback.tap()
        let running=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label == %@","Pause"),object:playback)
        XCTAssertEqual(XCTWaiter.wait(for:[running],timeout:5),.completed)
        let nextEvent=XCTNSPredicateExpectation(predicate:NSPredicate(format:"label != %@",originalLabel),object:event)
        XCTAssertEqual(XCTWaiter.wait(for:[nextEvent],timeout:10),.completed)
        XCTAssertEqual(event.frame.minY,originalY,accuracy:1,"Playback must update event text in place")
        app.buttons["atlas.explore.menu"].tap()
        let bookmarks=app.buttons["Bookmarks"]
        XCTAssertTrue(bookmarks.waitForExistence(timeout:5))
        XCTAssertEqual(playback.label,"Play","The menu must pause playback before selecting an item")
        bookmarks.tap()
        let done=app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout:5))
        done.tap()
        XCTAssertEqual(playback.label,"Play","Opening the menu must pause playback")
    }

    func testTimelineAndEventLabelsStayAnchoredWhenScrubbing() {
        let app=launch(year:1415)
        let slider=app.sliders["atlas.timeline.slider"]
        let playback=app.buttons["atlas.playback.toggle"]
        let initialY=playback.frame.midY
        var eventY:CGFloat?
        for position in [CGFloat(0),0.18,0.45,0.75,0.95] {
            let previous=slider.value as? String
            slider.adjust(toNormalizedSliderPosition:position)
            XCTAssertNotEqual(slider.value as? String,previous,"The scrub must actually change the year")
            XCTAssertEqual(playback.frame.midY,initialY,accuracy:1,"Timeline controls must stay anchored")
            let event=app.buttons["atlas.event.peek"]
            if event.exists {
                if let eventY { XCTAssertEqual(event.frame.minY,eventY,accuracy:1,"Changing event text must not move its card") }
                else { eventY=event.frame.minY }
            }
        }
    }
}
