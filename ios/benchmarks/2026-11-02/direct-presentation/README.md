# Presented-frame capture

Physical iPhone 18 Pro Max, iOS 27.2, signed Release of `bef202be3521ae38f5c661ad258c84005340b9a0`. Recorded November 2, 2026, America/New_York, using Instruments 27 **Game Performance Overview**, with **Display** and **Points of Interest** added. Low Power Mode was off and the app reported nominal thermal state.

The workload settles for six seconds, then runs 10 seconds each of native camera pan, zoom and combined movement. The bundled 1415 historical scene uses Chinese, boundaries/rivers/events/detail on, and modern province/Today reference off.

`presentations.csv` contains actual map CAMetalLayer **On Display** interval starts and durations exported from `metal-perf-overview-layer-per-frame-interval-metric`, filtered to the atlas process and its single map layer. This records when drawables were displayed, not MapLibre rendering callbacks or display-link callbacks. `presentedFPS` is new presentations divided by the full phase window. P50/P95/P99 describe how long those drawables remained on display.

`phase-signposts.csv` contains the recorded camera-phase events. Deferred logging omitted phase 0; the nominal capture start is phase 1's event minus 10 seconds. Phase 2 agrees with that schedule within 0.044 ms. The first new pan presentation occurs 0.826 seconds into the window because the first animated target matches the initial camera. Pan's active presentation cadence, measured between its first and last presentation, is 59.8 FPS; the full-window average includes that initial hold.

`summary.json` contains counts, percentiles, provenance and hashes of the input exports. `camera-sdk.json` is the same run's separate SDK report, identifying the source revision and workload. Its callback count is not used to calculate presented FPS.

The recorded map preference was 60 FPS, while observed movement cadence in this instrumented run was about 60 FPS. This single capture does not establish uninstrumented FPS, a permanent cap, touch latency, battery use, or why that cadence occurred. An earlier full Metal System Trace attempt failed while saving due to disk space and is excluded.

The complete device trace and unfiltered exports remain local under ignored `ios/.build/performance-direct-fps/`; they are not published because they contain unrelated device/process metadata. The CSV files retain the measured map-frame and phase timing needed to recalculate the reported numbers.

To regenerate these artifacts from the local exports:

```sh
python3 scripts/summarize_ios_presentations.py \
  --intervals ios/.build/performance-direct-fps/metal-frame-intervals.xml \
  --events ios/.build/performance-direct-fps/raw-signposts.xml \
  --sdk ios/.build/performance-direct-fps/camera-display-sdk.json \
  --toc ios/.build/performance-direct-fps/toc.xml \
  --output ios/benchmarks/2026-11-02/direct-presentation
```
