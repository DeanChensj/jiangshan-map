# 江山时序 · Native iOS app

SwiftUI and MapLibre Native 7.0.0 for iPhone and iPad, targeting iOS/iPadOS 26 or later. Local build and test checks use Xcode 27. Compact and expanded layouts share the same features. Dedicated macOS, visionOS and fold-specific arrangements are deferred.

See [COMPLETION.md](COMPLETION.md) for the native port's completion audit, corrected regressions and the distinction between implemented functionality, historical cartography and release preparation.

## Run

```sh
bash ios/prepare.sh
open ios/JiangshanAtlas.xcodeproj
```

Preparation requires Node.js and XcodeGen (`brew install xcodegen`). It generates the native resources and Xcode project. Run the **JiangshanAtlas** scheme. Select an Apple development team to install on a physical device. Re-run preparation after changing historical data or the shared query bridge. Generated resources and build products are ignored by Git.

## Features

- All 18 periods, 188 territorial stages, full source boundary geometry, and zoom-dependent regional/prefectural/city labels.
- Terrain relief with the web map's edge fade; historical rivers and lakes, 67 landscape labels, 16 corridors, 20 strategic passes, modern province/name overlays, and fading previous boundaries.
- Timeline scrubbing, direct year entry, dynasty/stage stepping, playback speed, period locking, and individual map layer controls. General timeline playback fits the full territorial stage on start and at territorial changes; person/route playback follows its stops. Overview framing uses native viewport bounds so it adapts to iPhone and iPad.
- The web search index: places and aliases, events, people, rulers, era names, polities, passes and gazetteer entries, in simplified/traditional Chinese and English.
- 124 listed people plus dynamically resolved ruler chronicles, seven curated journeys, comparisons of up to four people, contemporary encounters, and quoted source/poetry text.
- Custom routes with one year or per-stop years, multiple parallel tracks, distances, map pins, and stop-by-stop navigation.
- Exact administrative genealogy queries at any coordinate across all 18 mapped periods, related local events, city/pass lore, polity dossiers, rulers, territorial stages and related events.
- Ten-question place challenge with the web question tiers, clue sanitization, distance scoring, answer rings, ranks and sharing.
- Five guqin streams with track selection, pause/resume, automatic next track, volume and playback errors. Music requires internet; historical content is bundled offline.
- Bookmarks including active person/route and exact native camera, saved year/camera/layer preferences, web-compatible sharing, `jiangshan://atlas?...` links, and pasted web links in the route panel.

Touch and hold any map location, or choose “Inspect map center” in the exploration menu, to inspect its history. Floating search, layers and exploration controls replace the persistent title bar. The compact timeline expands to reveal all period and stepping controls. Tap the year to enter a date; use negative numbers for BCE. The iPad inspector can float, dock or close; playback closes it automatically.

Stage changes fade the previous changed territories while the new map settles. Camera navigation uses eased transitions; scrubbing and Reduce Motion skip the decorative stage effect. Playback waits for stage preparation and transitions. Dragging interrupts camera navigation and temporarily suppresses automatic event framing.

Close-up detail adds the existing prefecture labels and a 12-site Tang Chang’an–Luoyang pack, available from the exploration menu, search or map markers. Each site has dates, context and a source link. Search groups sites by city, historical names follow the timeline where documented, and city Explore actions frame their entire regional pack. “Today · roads & buildings” adds optional OpenFreeMap vector roads, building footprints and modern locality names. It is off by default, requires internet, and has a persistent modern-reference badge and attribution. Historical content stays bundled offline. See [DETAIL-DATA.md](DETAIL-DATA.md) for scope and sources.

The interface adapts web interactions to native sheets, menus and an iPad inspector. Website hosting features (PWA installation, iframe embedding and browser JavaScript/WebMCP APIs) remain on the web. Additional zoom does not improve the accuracy of existing historical boundaries. See [PARITY.md](PARITY.md) for all 44 audit items and the deliberate renderer differences.

## Configurable app links

Edit `ios/links.json` to change the preferred share URL, working fallback share URL, web fallback, associated domains or Apple team/bundle identifier. `bash ios/prepare.sh` generates the Xcode build settings, signing entitlement and a minimal static Vercel link service under `ios/.build/link-site`. Rebuild/reinstall the app after changing associated domains, and redeploy the generated site to the intended Vercel project. Keep old associated domains during a migration so previously shared links keep working.

Web shares use the official [deanchen.me/jiangshan-map/](https://deanchen.me/jiangshan-map/) address, including when offline or the website's app-association file is unavailable. Automatic opening in iOS requires the website owner to publish the generated `apple-app-site-association` file at `https://deanchen.me/.well-known/apple-app-site-association`, using the agreed final Apple team and bundle identifier. Ordinary web sharing works before that setup.

The legacy [jiangshan-atlas-links.vercel.app](https://jiangshan-atlas-links.vercel.app) host remains in associated domains for previously shared links. It is an optional link service, not the canonical share address. Its generated deployment includes a real `jiangshan-map/index.html` fallback page that preserves query parameters. No deployment or DNS changes are made by this PR.

Changing this configuration does not reconfigure DNS or publish a deployment by itself. Apple may cache association files after a domain change. Both HTTPS app links and `jiangshan://atlas?...` links use the same native parser.

## Implementation

- `AtlasMapView.swift`: native map, background stage preparation, bounded stage cache, labels, routes, quiz overlays and hit selection. Camera gestures stay inside MapLibre.
- `AtlasStore.swift`, `AtlasFeatures.swift`, `AtlasModels.swift`: native state, navigation, persistence, music and shared data models.
- `AtlasEngine.swift`: a per-window serial JavaScriptCore context for historical queries, off the main thread. It loads the existing web data and controller without creating a DOM or running the web UI.
- `../scripts/ios_engine.js`: small pure-query adapter using the original search, person, encounter, route, genealogy, polity and quiz rules.
- `ContentView.swift`, `AtlasDetailViews.swift`, `AtlasFeatureViews.swift`: native SwiftUI interface.
- `AtlasCartography.swift`, `AtlasGeometry.swift`, `AtlasPulseOverlay.swift`: map styling, trajectories and idle marker animations.
- `AtlasPlayback.swift`, `AtlasPlaybackViews.swift`, `AtlasNavigation.swift`: weighted timeline, event cards and exploration navigation.
- `../scripts/prepare_ios_links.js`: configurable universal links and optional link-service generation; canonical sharing reads the configured official URL directly.
- `../scripts/export_ios.js`: native resource generator. `prepare_ios_terrain.swift` bakes the existing web edge fade into a PNG for the native renderer.

See [FONTS.md](FONTS.md) for bundled font sources, licenses and optional regeneration.

This port bundles the full web query data in addition to the native map stage files. Memory/storage optimization remains separate work. See [PERFORMANCE.md](PERFORMANCE.md) for physical-device camera captures and their limits, and [TESTING.md](TESTING.md) for the Node, native state and UI regression tests and CI. The signed release build was installed on the paired iPhone 18 Pro Max. Focused simulator checks covered the immersive iPhone/iPad layouts, expanded timeline, floating/docked inspector, playback overview, site details/source links, and the modern reference layer.

Content licenses and historical-source restrictions remain applicable; see the repository README and bundled notices.
