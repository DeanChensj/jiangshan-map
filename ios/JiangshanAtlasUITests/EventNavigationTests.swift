import XCTest

final class EventNavigationTests:XCTestCase {
    private func launch(year:Int)->XCUIApplication {
        continueAfterFailure=false
        let app=XCUIApplication()
        app.launchArguments=["-atlas.guided","YES"]
        app.launchEnvironment["ATLAS_UI_TEST_URL"]="jiangshan://atlas?year=\(year)&lang=en&lng=106.5&lat=34&nativeZoom=3.5"
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
}
