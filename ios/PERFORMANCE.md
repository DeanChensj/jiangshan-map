# iOS performance check — 2026-11-02

## Direct presentation measurement

The signed Release of `bef202be3521ae38f5c661ad258c84005340b9a0` was measured on the physical iPhone 18 Pro Max, iOS 27.2, with Instruments 27 **Game Performance Overview + Display + Points of Interest**. Low Power Mode was off, thermal state was nominal, and the app requested 120 FPS. This run settles for six seconds, then uses the same 1415 bundled scene and automated native camera workload described below.

These numbers count the map CAMetalLayer's actual **On Display** interval starts, not SDK callbacks. FPS is new drawable presentations divided by the fixed window; P95 is the 95th percentile of the drawables' on-display durations.

| Phase | Window | Presented frames | Presented FPS | P95 on display |
|---|---:|---:|---:|---:|
| Pan | 10 s | 549 | 54.9 | 25.00 ms |
| Zoom | 10 s | 599 | 59.9 | 25.00 ms |
| Pan + zoom | 10 s | 600 | 60.0 | 25.00 ms |
| Overall | 30 s | 1,748 | 58.3 | 25.00 ms |

The pan window includes 0.826 seconds before its first new displayed frame, because the sweep's first animated target matches the initial camera. Its active presentation cadence is 59.8 FPS. The overall median on-display duration is 16.67 ms and P99 is 25.00 ms. The app requested 120 FPS; the observed movement cadence in this instrumented run was about 60 FPS. This does not establish an uninstrumented frame rate or the cause of that cadence.

Raw frame timing, phase anchors, source revision, calculation method and limitations are committed under [direct-presentation](benchmarks/2026-11-02/direct-presentation/README.md). The capture window is anchored to the phase-1 signpost minus 10 seconds; the phase-2 signpost agrees within 0.044 ms. The same run emitted 1,751 SDK render callbacks, which are a separate metric. An earlier full Metal System Trace attempt failed while saving due to disk space and is excluded. No touch-latency, battery, Today-layer or broader-device claim is made.

The older SDK-only captures below are retained as development history. They must not be interpreted as displayed FPS or as a controlled before/after comparison with this instrumented run.

## Device and workload

Physical iPhone 18 Pro Max, iOS 27.2, signed Release builds. Screen maximum 120 Hz; MapLibre requested 120 FPS. Low Power Mode was off and reported thermal state was nominal in every capture below.

The automated capture settles for six seconds, then runs ten seconds each of panning, zooming, and combined movement in the 1415 map. Historical boundaries, water, events, Chinese labels and terrain remain enabled; modern province boundaries are disabled for a repeatable scene. The app restores the previous view afterward. Production features and map detail were retained.

## Measurements

These rates count MapLibre render callbacks during the 30-second capture. They are workload measurements, not display-presentation guarantees or a benchmark of every gesture/device.

The raw final capture is committed at [benchmarks/2026-11-02/immersive-camera.json](benchmarks/2026-11-02/immersive-camera.json), with derived metrics and capture provenance in [summary.json](benchmarks/2026-11-02/summary.json). This earlier development Release capture predates the PR test suite, current official-link changes and latest upstream data refresh; no Git SHA was recorded. It is not a new profile of the latest PR commit. The automated native camera sweep does not measure touch latency.

| Final capture phase | Window | SDK callbacks / second | Median SDK encoding |
|---|---:|---:|---:|
| Pan | 10 s | 110.5 | 1.81 ms |
| Zoom | 10 s | 119.8 | 2.29 ms |
| Pan + zoom | 10 s | 119.5 | 2.64 ms |
| Overall | 30 s | 116.6 | 2.24 ms |

| Capture | Render callbacks / second | Median SDK encoding time |
|---|---:|---:|
| Original parity build, per-frame camera setters, run 1 | 31.5 | 26.58 ms |
| Original parity build, per-frame camera setters, run 2 | 33.0 | 26.32 ms |
| Candidate with cached updates, same per-frame driver | 32.0 | 26.47 ms |
| Experimental rendering clip, same per-frame driver | 31.6 | 26.75 ms |
| Candidate, native camera animations | 34.7 | 25.03 ms |
| Immersive iteration, native camera animations, 60 FPS request | 58.5 | 2.52 ms |
| Same immersive build, native camera animations, 120 FPS request | 116.7 | 2.12 ms |
| Full iteration with historical detail, native camera animations, 120 FPS | 116.6 | 2.24 ms |

The native-animation run measured 36.7, 35.1 and 32.2 callbacks/second in the three phases. Changing camera drivers changes the workload, so the difference from 32.0 to 34.7 must not be described as an optimization gain. The clipping experiment did not improve this workload and was removed.

## Changes retained

- Custom routes previously rebuilt their GeoJSON paths and pins after every camera change. They now rebuild for route/state changes or when a convergence pair crosses its merge threshold. Panning and zooming within the same merge state retain the existing map source.
- Settlement and event source updates now check their input keys before filtering the catalog, calculating duplicate-event visibility, constructing labels, and allocating map features.
- The zoom buttons previously waited 180 ms before starting every camera transition. They now start immediately. Navigation that changes card layout keeps the short settling delay needed to avoid interrupted camera transitions.
- Canonical web sharing now uses the official `https://deanchen.me/jiangshan-map/` URL directly. The official domain and legacy Vercel host are both listed in associated domains; website app association is separate from web sharing.

The immersive iteration also retains settlement/event GeoJSON when its visible content is unchanged across year changes, indexes catalog rows by period, reuses event-distance inputs, and prefetches the next stage into the existing four-entry cache. This removes repeated uploads during playback. These code changes alone do not establish the cause of the difference between the old and new captures.

## Current result and limits

The earlier slowdown did not reproduce in the latest two 120 FPS captures. The final run measured 110.5, 119.8 and 119.5 callbacks/second in pan, zoom and combined phases, with nominal thermal state. ProMotion remains enabled: the repeat at 120 FPS ruled out a permanent 60 FPS cap as necessary. The first phase includes roughly 0.75 seconds before the first render callback. These are SDK callback rates, not measured presented-frame rates. Subsequent delivery refinements corrected site headings/localization, Today road widths, iPad panel spacing and the post-gesture camera grace period; they do not change this automated historical sweep's scene or camera driver.

An earlier simulator sample showed `MTKView.currentDrawable` → `CAMetalLayer.nextDrawable` → semaphore wait. It does not establish a physical-device cause, and physical Time Profiler attachment did not yield a call tree. Cache warm-up, device/presentation state and other uncontrolled conditions may affect comparisons. No causal diagnosis of the original 35 FPS condition is claimed. The optional network-backed Today layer and all possible gestures/scenes have not been profiled; this capture uses the bundled historical scene with the new prefecture detail enabled.

## Reproduction and artifacts

- Existing developer capture: launch with `--atlas-camera-profile` for per-frame setters, or add `--atlas-profile-animated` for native camera animation. These options are inactive during normal launches.
- Captures: `ios/.build/performance-current/baseline-camera.json`, `baseline-camera-repeat.json`, `unclipped-camera.json`, `clipped-camera.json`, `animated-camera.json`.
- Latest captures: `frame-pacing-60.json`, `frame-pacing-120.json`, `immersive-camera.json` in the same directory. The 60 FPS diagnostic adds `--atlas-profile-60fps`; it does not change the production default.
- Simulator sample: `ios/.build/performance-current/simulator-camera-sample.txt`.
- Build, signing, normal launch, and focused map UI checks were used for delivery. No new test suite was added.
