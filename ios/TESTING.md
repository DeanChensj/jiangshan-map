# iOS checks

The tests focus on data/query compatibility, native state transitions and the event controls that regressed during the immersive-layout change.

## Query and link tests

From the repository root, with Node.js 20 or newer:

```sh
node --test tests/*.test.cjs
node scripts/validate_atlas.js
```

The 24 Node tests use the real web data and native query adapter. They cover localized search, people/encounters, every curated journey, the Imperial Seal, parallel routes and dates, genealogy, polity stages/events, quiz translation, historical-site dates and generated link-service files. Additional regression checks cover landmark event IDs, administrative search identity and selected-place/camera restoration by the web parser. Link tests use temporary directories and example domains; they do not contact or modify a deployment. The existing atlas integrity workflow runs these tests on Linux.

## Native tests

```sh
bash ios/prepare.sh
xcodebuild -project ios/JiangshanAtlas.xcodeproj -scheme JiangshanAtlas \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
```

Choose an installed iPhone simulator if that name is unavailable. Seventeen native tests cover year/progress round trips for every mapped year, period/range clamps, playback loading/transition waits, same-year events, quiz restoration, share links, isolated saved preferences, Traditional Chinese people filtering, dated site names and stable map projection across event/year changes. The projection test hosts the real SwiftUI screen and checks a coordinate's screen position and the map's content insets while scrubbing across periods. Native regressions also exercise website camera URLs, selected-place shares, dynamic ruler translation/comparison links, terminal milestone dates, period-locked site navigation, stale site-note cleanup and separate window quiz engines. Four UI tests cover the Imperial Seal shortcut/sheet dismissal, named event anchors retaining their event context, playback pausing when the exploration menu opens, and stable timeline/event positions during playback and slider interaction.

State tests use temporary UserDefaults suites. UI tests use a Debug-only `ATLAS_UI_TEST_URL` launch environment value to seed the app through its real deep-link parser; this hook is excluded from Release builds. Accessibility identifiers identify event and journey controls without relying on translated labels. A synthetic same-year milestone exercises the stepping behavior even when a source-data revision contains no duplicate-year milestones.

The native GitHub workflow uses an available iPhone running iOS 26 or newer and a separate example bundle identifier, with signing disabled. Tests were run locally on the iPhone 18 Pro simulator, iOS 27, Xcode 27. CI does not install on physical devices or upload builds to App Store Connect. Test targets and generated app URL metadata derive their identifiers from `ATLAS_BUNDLE_IDENTIFIER`.

These checks do not replace accessibility review, sustained battery/memory measurements, or release acceptance on additional physical devices.

## Maintainer decisions before distribution

The current `me.jiangshan.atlas` bundle identifier, Apple development team and Vercel association configuration are provisional development values in `ios/links.json`. Changing that file and rerunning preparation updates Xcode settings, the URL type name and the generated app-association file. Associated-domain changes still require deployment and reinstallation.

Please confirm with the original author:

1. Which bundle identifier and Apple Developer account/team should own the official app?
2. Should distribution remain development-only, move to an author-owned TestFlight beta, or eventually target the App Store?

Choose ownership and the identifier before the first upload: Apple documents that a bundle identifier cannot be changed after uploading to App Store Connect. [Apple bundle identifier documentation](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleidentifier)

TestFlight can be a later beta step; external testing can require beta review. No TestFlight upload, public app distribution or App Store Connect app-record creation is part of this draft. The historical-data restrictions in the repository's Credits & License section also remain applicable. [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
