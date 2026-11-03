# iOS implementation status — November 2, 2026

The original iPhone/iPad functional port is implemented, with the renderer and native interaction differences listed in PARITY.md. This is an implementation checkpoint, not App Store release certification or a claim of exhaustive device testing.

## Completion audit

- Reviewed the 44-item parity inventory against current native navigation, views, playback, map sources and shared query bridge.
- Confirmed the bundled catalog contains 18 periods, 186 territorial stages, 124 listed people and seven curated journeys. Verified snapshot, mesh and label files exist for every stage.
- Ran 17 focused queries against the bundled engine: simplified/traditional/English search, people and encounters, the Imperial Seal, a curated journey, 18-period genealogy in all three languages, parallel routes, per-stop dates, polity stages and a quiz deck retained across a language change. All passed.
- Built and launched on iPhone and iPad simulators. Checked the restored Imperial Seal entry on both layouts, iPhone detail-sheet dismissal into the journey, and named event locations. Previous UI checks cover the main playback, route, quiz, inspector, layer and historical-site flows.
- Rechecked the production Vercel share page and app-association endpoint: HTTP 200, with the configured app identifier present. This does not replace physical-device universal-link testing already recorded in PARITY.md.
- Built a signed Release for installation on the paired iPhone 18 Pro Max. No new test suite or performance profile was added to this audit; earlier performance evidence is in PERFORMANCE.md.

Three issues found and corrected:

1. The immersive event peek replaced the old milestone card, leaving the Imperial Seal shortcut only in an unused view. Event details now expose the shortcut, and starting the journey dismisses the iPhone detail sheet.
2. Event details used generic raw coordinate buttons instead of the source's named anchors. Named anchor buttons are restored and retain the event context while moving the camera.
3. The people picker displayed Traditional Chinese but filtered only the original names/aliases. Filtering now includes their Traditional Chinese forms.

No further missing core port feature was identified in this focused audit. Some browser-only integrations intentionally remain on the web, and native text layout/compositing is not pixel-identical to browser SVG.

## Separate work

- Detailed historical city cartography: the existing 12-site pack is approximate markers. Ancient city walls, palace/ward areas, streets and finer waterways require a separate sourced data implementation, now being pursued in the historical-map chat. More markers alone do not complete that task.
- Distribution: TestFlight/App Store setup, app icon/store assets, submission information and release acceptance remain pending; this project has been delivered as a development-signed app.
- Broader quality work: sustained battery/thermal and memory checks, older-device coverage, accessibility/Dynamic Type review and a full regression pass were not part of the fast implementation scope.
- Dedicated macOS, visionOS and fold-specific layouts remain deferred.

Keep new cartographic work separate from completion claims for the original native port.
