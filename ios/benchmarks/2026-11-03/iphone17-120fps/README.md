# Verified 120 FPS request — direct presentation capture

The signed Release of `3b5fca7d31d2ad97c515b8e4baff957555d6ee78` was recorded on the physical **iPhone 17 Pro Max**, iOS 27.2, on November 3, 2026 (America/New_York), using Instruments 27 **Game Performance Overview + Display + Points of Interest**. The launch included `--atlas-camera-profile --atlas-profile-animated --atlas-profile-120fps`.

The requested **120 FPS setting was verified**, rather than inferred: `mapPreferredFPSAtStart` and the final `mapPreferredFPS` both read back 120, the attached screen reported a 120 Hz maximum at both ends, and Low Power Mode was off at both ends. The report records `verified120FPSRequest: true`; thermal state was nominal at completion. The animation driver's median display-link target interval was 8.334 ms. That interval verifies the driver schedule and is not used to calculate presented FPS. Normal map setup now resolves its display preference after window attachment, avoiding the earlier pre-attachment 60 FPS fallback.

The workload settles for six seconds, then runs ten seconds each of native camera pan, zoom and combined movement over the bundled 1415 Chinese scene, with boundaries/rivers/events/historical detail on and modern province/Today reference off.

These numbers count the map CAMetalLayer's **On Display** interval starts from `metal-perf-overview-layer-per-frame-interval-metric`, filtered to the target app process and its single map layer. Presented FPS is new displayed drawables divided by the full fixed phase window. It is separate from SDK render callbacks and display-link callbacks. P95 describes how long those drawables remained on display.

| Phase | Window | Presented frames | Presented FPS | P95 on display |
|---|---:|---:|---:|---:|
| Pan | 10 s | 1,077 | 107.7 | 8.33 ms |
| Zoom | 10 s | 1,194 | 119.4 | 8.33 ms |
| Pan + zoom | 10 s | 1,200 | 120.0 | 8.33 ms |
| Overall | 30 s | 3,471 | 115.7 | 8.33 ms |

Pan includes a 0.817-second initial hold because the first animated target matches the initial camera. Its active presentation cadence is 117.3 FPS. A further 200.02 ms on-display interval occurs at 3.409 seconds; zoom has a 33.34 ms interval at 13.176 seconds. These outliers remain in the results. Overall median and P99 on-display durations are both 8.334 ms. This is not a claim of uninterrupted 120 FPS or touch latency.

Deferred logging omitted phase 0. The capture starts at the phase-1 event minus ten seconds, with phase 2 agreeing within 4.467 ms. The 3,471 published presentation rows were independently recounted in the three fixed windows. The same run emitted 3,477 SDK callbacks; those are not the presented-frame metric.

`summary.json` records counts, percentiles, source revision, configuration verification and hashes of the input exports. `presentations.csv` contains the measured map-frame timing; `phase-signposts.csv` contains the recorded phase anchors. `camera-sdk.json` is the unchanged report from this run.

The first parallel export attempt failed while available disk space had dropped to 122 MiB. After removing orphaned Instruments capture caches, serial exports from the same saved trace succeeded. Instruments also logged a dylib-overlap warning concerning GAXClient/dyld while processing the recording. No symbol or call-stack analysis is used here. Only the successfully exported map-layer timing and phase events contribute to these results.

This is one instrumented automated sweep on one device. It does not establish uninstrumented FPS, touch latency, battery use, Today-layer performance or the cause of the longer intervals. It is not a controlled comparison with the older iPhone 18 run, whose recorded preference was 60 FPS. The app was relaunched normally without capture arguments afterward.

The saved trace and unfiltered exports remain local under ignored `ios/.build/performance-2026-11-03-iphone17-120fps/`; they contain unrelated host/device/process metadata and are not committed.

To regenerate the published artifacts from those exports:

```sh
python3 scripts/summarize_ios_presentations.py \
  --intervals ios/.build/performance-2026-11-03-iphone17-120fps/metal-frame-intervals.xml \
  --events ios/.build/performance-2026-11-03-iphone17-120fps/raw-signposts.xml \
  --sdk ios/.build/performance-2026-11-03-iphone17-120fps/camera-sdk.json \
  --toc ios/.build/performance-2026-11-03-iphone17-120fps/toc.xml \
  --output ios/benchmarks/2026-11-03/iphone17-120fps
```
