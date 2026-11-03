# Native parity implementation

The website remains the behavior and content reference. These are the 44 items from the parity audit, grouped by implementation. “Native” means an iOS interaction or renderer equivalent; it does not claim identical pixels across browsers and MapLibre.

The subsequent completion audit, regressions corrected and remaining release work are recorded in [COMPLETION.md](COMPLETION.md). Detailed historical city cartography is a separate task; the site-marker additions do not constitute that work.

| # | Audit item | Implementation |
|---|---|---|
| 1 | Title typeface | Bundled Ma Shan Zheng |
| 2 | Interface typefaces | Bundled Noto Sans SC and Noto Serif SC |
| 3 | Map typefaces | Bundled serif glyphs and local CJK serif font |
| 4 | Zoom typography and marker scaling | Web scale converted to native zoom expressions |
| 5 | Cartographic palette | Source territory tints and CSS colors |
| 6 | Territory opacity and blending | Source role/terrain opacity; native alpha composition |
| 7 | Semantic territory roles | Main, rival, protectorate and neighbor styling |
| 8 | Curved outlines | Original web corner rounding flattened for native rendering |
| 9 | Administrative meshes | Original mesh builders, filtering and boundary casings |
| 10 | Selected administrative area | Coordinate query supplies highlighted region/prefecture titles |
| 11 | Detail thresholds | Web thresholds for towns, passes and prefecture detail |
| 12 | Label placement | Original anchors, source priority, native collision and variable anchors |
| 13 | Cities and capitals | Source circles, capital diamond/ring and differentiated typography |
| 14 | Pass gates and selection | Gate sprite, detail card, selection ring and source pass descriptions |
| 15 | Rivers and lakes | Source ranks, widths, casings, dates and lake outlines |
| 16 | Landscape labels | Rotation, kind, spacing, historical names and detail thresholds |
| 17 | Corridors | Wall/canal/road/silk/sea styles and original label anchors |
| 18 | Terrain composition | Bundled relief with source edge fade and terrain toggle |
| 19 | Neighbor labels | Source background geography and localized names |
| 20 | Modern period | Hydrated modern regions; no synthetic historical polities |
| 21 | Province overlays | Separate boundary/name controls and real province label anchors |
| 22 | Timeline structure | Duration-weighted period bands, phase ticks and event dots |
| 23 | Playback timing | Source progress duration, minimum display ticks and milestone holds |
| 24 | Automatic event cards | Current milestone card, dismissal and localized site labels |
| 25 | Event cameras and sites | Stage overview on playback/territorial change, visible-area framing and multiple anchors |
| 26 | Same-year event stepping | Individual event IDs and previous/next selection |
| 27 | Event state and animation | Current/secondary pins, duplicate suppression, card-aware camera and idle pulse rings |
| 28 | Chronicle synchronization | Current row, map-change/seal badges and automatic scrolling |
| 29 | Boundary previews | Fading previous stage plus territorial-stage context-menu preview |
| 30 | Journey overview | Initial full-route view and return to overview |
| 31 | Journey pins | Track numbers, shared encounters and co-located pin offsets |
| 32 | Trajectories | Curves, arrows, future progress, separate tracks and convergence pills |
| 33 | Curated journeys | Original person/journey engine, waypoints, source colors and stop mapping |
| 34 | Track/encounter filtering | Era/overlap dimming and shared encounter filter on map and chronicle |
| 35 | Person details | Lifespans, era/stop statistics, distinct notes, quotes and next-stop preview |
| 36 | Administrative genealogy | Shared historical queries, capital counts, current/expanded row, event navigation and journey return |
| 37 | Polity workflow | Dossier, bounds fit, current stage, preview, related events and return to era overview |
| 38 | Search actions | Shared index, kind badges, direct event/person/polity/place actions and administrative highlighting |
| 39 | Imperial seal | Relic pins and event-card entry into the original seal journey |
| 40 | Quiz | Original deck/clues/years, distance tiers, ring labels, answer state, replay and camera/year/range restoration |
| 41 | Localization | Simplified/traditional/English, shared content refresh, quiz deck retained across language changes |
| 42 | Sharing and links | Web/native links, camera/year/range/person/route/polity/trace parameters and configurable associated domains |
| 43 | Remaining controls | Collapsible iPad inspector, grouped legend, inline music, layer controls and saved state |
| 44 | Discovery and keyboard | First-launch guide, capital history hint, space/arrows/shift-arrows/home/end/escape |

## Deliberate native differences

- MapLibre uses native text collision/layout and alpha compositing. Browser SVG label packing, CSS multiply blending and font rasterization are not pixel-identical. Hover previews become context-menu previews; touch interactions use native sheets and an iPad inspector.
- Historical geometry and query data come from the website. Additional native zoom magnifies that data; it does not create more accurate historical boundaries.
- Browser-only hosting integrations (PWA installation, iframe embedding, JavaScript/WebMCP APIs) remain website features. Dedicated macOS and visionOS UI remains outside this iOS-first port.

## Verification and delivery

Build/run checks and focused interactive checks cover the iPhone and iPad layouts, playback overview framing, event cards, person/encounter chronicle, custom route/convergence, place genealogy, quiz guessing/scoring, sidebar collapse, polity dossiers and HTTPS/custom deep links. The engine was also queried directly for localized people, routes, place resolution and quiz clues. No test suite, benchmark or performance profile was added or run for this parity work.

Web sharing uses `https://deanchen.me/jiangshan-map/` directly and does not depend on a successful app-association request. Automatic app opening from that host awaits the website owner's publication of the app-association file with the final app identity. The previously deployed Vercel host remains associated for older links; its fallback includes a physical `jiangshan-map/index.html` page. No hosting changes are part of this PR.

The signed Release build was installed on the physical iPhone 18 Pro Max on 2026-11-02. Interactive parity verification used the simulators. Subsequent physical-device camera captures, performance fixes and measurement limits are recorded in [PERFORMANCE.md](PERFORMANCE.md). The later immersive layout preserves access to these features through floating controls, compact/expanded timeline and an optional floating/docked iPad inspector. Native-only close-up additions are scoped in [DETAIL-DATA.md](DETAIL-DATA.md).
