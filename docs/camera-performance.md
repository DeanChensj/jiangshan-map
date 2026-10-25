# SVG camera performance

Continuous zoom previously resized and laid out SVG labels on every camera update.
Profiling on Chrome/macOS found substantial SVG text layout cost with the loaded,
segmented Noto CJK web fonts, plus repeated text-outline rasterization. Updating the
scale bar also read the SVG rectangle after writes that invalidated layout.

The map still renders through its SVG `viewBox`. This change:

- Uses local font stacks within the map, while retaining the web fonts in the UI.
- Coalesces wheel, pan and pinch rendering into one animation frame, preserving
  every input's camera coordinates and flushing pending movement on pointer end/cancel.
- Defers zoom-only label sizing and collision layout until 120 ms without camera
  changes. Newly rendered content and forced updates still refresh immediately.
- Removes label outlines during zoom motion and restores them after settling.
- Reuses the viewport rectangle during motion, invalidates it on resize, avoids
  unchanged scale-bar writes, and suspends hover hit-testing during gestures.

## Measured comparison

Measured 2026-10-24 against `ff6c91ec94d89525ee9d94cd4f653e57f4f47ae2`.

| Environment | Value |
| --- | --- |
| Hardware | Apple M4, 16 GiB RAM |
| OS | macOS 27.0.1 (26A434), arm64 |
| Browser | Google Chrome 156.0.8078.47, **headless** |
| Tooling | Node.js 24.14.0, Playwright 1.64.1 |
| Viewport | 1440 × 900 CSS pixels, device pixel ratio 2 |
| Scene | Chinese UI, year 1415, default layers, full snapshots loaded |
| Fonts | Waited for `document.fonts.ready`; required loaded Noto Serif SC faces |
| Workload | 3-second continuous camera zoom sweep; 3 runs per version, alternating order |
| Throttling | No artificial CPU/network throttling; local HTTP server |

| Metric | Before | After |
| --- | ---: | ---: |
| Animation FPS, run 1 | 5.0 | 60.0 |
| Animation FPS, run 2 | 4.9 | 59.7 |
| Animation FPS, run 3 | 4.7 | 59.7 |
| Median animation FPS | **4.9** | **59.7** |
| Frame interval p95, each run | 299.9 / 383.3 / 333.3 ms | 16.7 / 16.8 / 16.8 ms |
| Long tasks during sweep, each run | 14 / 13 / 14 | 0 / 0 / 0 |
| Label-layout calls during sweep | 15 / 14 / 14 | 0 / 0 / 0 |
| Deferred label-layout calls after sweep | 0 / 0 / 0 | 1 / 1 / 1 |

The median improvement is approximately 12.2× in this workload. FPS is the count
of `requestAnimationFrame` intervals divided by their elapsed time, **not a physical
display/presentation measurement**. The benchmark calls the production camera path
with the same time-based zoom trajectory; it does not override rendering, styles,
or layout behavior. It measures camera rendering rather than mouse-event delivery.
Browser input behavior is covered separately by the regression script below.

The post-sweep check includes deferred work: the optimized version completed its
settle check in about 133 ms (including the 120 ms debounce), performed one label
layout, restored outlines, and reported no additional long tasks. This is not a
claim that every interaction or device will reach 60 FPS. Other operating systems,
fallback fonts and browsers have not been performance-tested.

## Reproduce

The application retains zero runtime/npm dependencies. These optional developer
checks require Playwright and an installed Google Chrome. Install the test tooling
outside the checkout, then start a static server in the repository root:

```sh
npm install --prefix /tmp/jiangshan-perf-tools playwright@1.64.1
python3 -m http.server 8765 --bind 127.0.0.1
```

In another terminal:

```sh
node scripts/validate_atlas.js
PLAYWRIGHT_PATH=/tmp/jiangshan-perf-tools/node_modules/playwright \
  node scripts/validate_camera.cjs
PLAYWRIGHT_PATH=/tmp/jiangshan-perf-tools/node_modules/playwright \
  CAMERA_BASE_REF=ff6c91ec94d89525ee9d94cd4f653e57f4f47ae2 \
  CAMERA_OUTPUT=/tmp/camera-benchmark.json \
  node scripts/benchmark_camera.cjs
```

Both browser scripts always run headless. `ATLAS_URL` changes the server URL.
`CAMERA_RUNS` and `CAMERA_DURATION` adjust the benchmark repetitions and duration
in milliseconds. `CAMERA_TEST_OUTPUT` optionally saves regression screenshots.
Run benchmarks without other CPU-heavy jobs. The baseline script serves the chosen
revision's HTML, CSS and controller alongside the checkout's unchanged data files;
use a matching data revision if comparing unrelated changes.

The atlas validator passes all 36 CUJs, 169 snapshots and 2,430 timeline years.
Browser checks cover wheel anchoring/batching, final pointer movement on end/cancel,
hover suppression and recovery, resize invalidation, snapshot/language changes,
reset, city coordinate targeting, and mobile touch pinch/person labels. Browser
mobile emulation is not a physical-device performance test.

## Visual tradeoffs

Map glyph shapes depend on installed fonts (Songti/PingFang/Kaiti on macOS;
SimSun/Microsoft YaHei/KaiTi on Windows, then generic fallbacks). During motion,
labels scale with the map and temporarily lose their outlines; their usual sizing,
visibility/collision decisions and outlines return after settling. This preserves
the static map's styling while accepting a brief difference during interaction.
