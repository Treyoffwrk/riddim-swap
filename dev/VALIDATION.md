# Riddim Swap: beat analysis validation

How the beat, hit and alignment features were checked, and what wasn't. All numbers come from the scripts in `dev/tests/`.

## Methods

| Part | Method |
|---|---|
| Song beat | Mel-band spectral-flux onsets, with the kick band weighted up. Autocorrelation tempo that also checks the half-bar, bar and kick periodicity. Dynamic-programming beat tracker (Ellis 2007, the method behind librosa's `beat_track`). Then three kick-based checks (v2): a **bar check** that prefers the tempo candidate whose 4-beat bar matches the kick's own repetition (fixes 4/3 and 2/3 errors on sparse one-drop and dembow); a **level check** that doubles the tempo when the kick is as strong half-way between beats as on them (Jersey club read at half speed); and a **phase search** in 1/16-beat steps for the bar slot holding the kick (off-beat skank, swung off-beats and pushed bass can no longer hold the grid off the kick). Beats refined to sub-frame peaks. A **phase certainty** compares the kick on the beat with half a beat later; below 0.2 the app says it isn't sure. Downbeat taken from kick loudness, or from the dancer's "This is the 1". |
| Dance hits | Coarse-to-fine block-matching optical flow at 112 px with **sub-pixel** refinement (most body motion at this size is under 1 px per frame). **Dancer region** (v2): a heat map of non-camera motion over the clip; the dancer is the connected region round its hottest spot, so a second person or background flicker elsewhere is ignored, and camera motion is measured from outside it. Directional motion histogram ("directogram") after Davis & Agrawala, "Visual Rhythm and Beat" (SIGGRAPH 2018). A hit is a **sustained** drop: average motion over 3 frames before against 3 after, so one jerky frame (variable frame rate, compression) doesn't count. Each hit dated to the frame boundary where motion stops, with sub-frame peak timing. A shake measure (frame-to-frame change in camera motion) and a contrast measure flag unreliable clips. |
| Alignment | Per-move piecewise-linear time warp. Dynamic programming pins strong hits to beats and "ands" (downbeats weighted up), keeping speed changes within a set limit (±20% by default). Constant speed is kept as the baseline. |
| Fit score | Beat Alignment Score (Gaussian, σ = 50 ms) of hits against beats and "ands", plus the median miss in ms. AIST++ ("AI Choreographer", Li et al. 2021) scores against beats only; the "and" is included here because the alignment targets it. |

## Results

### Song beat against ground truth (synthetic tracks, ±70 ms)

| Style | True BPM | Detected | Beat F | Half-beat-shifted control F | Downbeat right |
|---|---|---|---|---|---|
| Four-on-the-floor | 128 | 128.6 | 0.976 | 0 | yes |
| Dancehall dembow | 96 / 104 | 95.8 / 103.6 | 0.978 / 0.970 | 0 | yes |
| Dembow 3-3-2 | 92 / 100 | 92.3 / 99.5 | 0.977 / 0.979 | 0 | yes |
| Jersey club | 140 / 144 | 139.7 / 143.6 | 0.978 / 0.979 | 0 | yes |
| Slow | 75 | 74.9 | 0.972 | 0 | yes |
| In-app run (dembow 100) | 100 | 99.5 | 0.990 | | |

On the dembow 100 track, the detector's timing bias is a median of −8 ms.

### Real track against librosa 1.0 (user's 44 s dancehall MP3)

- **Tempo:** librosa 99.38, ours 99.65 BPM. Before the bar and kick periodicity checks were added, ours locked onto 133 BPM (4/3 × the true tempo) from the 3-3-2 rhythm.
- **Beat phase:** unresolved. The two grids sit half a beat apart (F = 0.22; continuity AMLt = 0.75). Low-band energy evidence was inconclusive. The app shows a click track, the tempo alternatives and a "Shift beat ½" button so the dancer decides by ear.

### Dance hits against ground truth (rendered figure, hits at known times)

| Video | F (±70 ms) | Median timing error |
|---|---|---|
| Small figure, offline | 0.867 | 7 ms |
| Large, fast figure, offline | 0.857 | 14 ms |
| Small figure, in the browser at normal speed | 0.867 | 12 ms |
| Small figure, in the browser at 2× | 0.62 | |

Normal-speed analysis is therefore used.

### Alignment and score (in-app, dembow 100 song, 3 moves)

| Measure | Value |
|---|---|
| Constant speed | 49% |
| Aligned | 75% |
| Quarter-beat off-beat control | 18% |
| Mapping the true hits through the plan, against the true beats | 0.616 (control 0.229), median miss 37 ms |

### The recorded file, checked independently (ffmpeg decode, our detectors on the file itself)

- **Picture:** the take's hits fall a median 12 ms from where the plan puts them, with 11 of 12 within 70 ms. Duration 10.84 s against a planned 10.84 s.
- **Sound:** cross-correlation against the original song puts it at +0 ms (r = 0.998). Before the fix it was +74 ms, caused by the MP4 library's default 80 ms Opus pre-skip.
- **Self-check:** a planted +50 ms error was detected (lag 50 ms) and repaired; the next take measured 0 ms.

### Sound/picture sync during playback (headless Chromium; limits from ITU-R BT.1359: sound ≤45 ms early, ≤125 ms late)

- **Before the fixes:** −110 ms, with corrections every ~0.5 s after each cut.
- **After the fixes:** +7 ms median (90% of frames within −3 to +15 ms). This took pre-roll of the next move, predictive song seeks that learn each device's seek delay, and correcting the start-up delay as playback begins. The song no longer moves mid-routine.

### Bugs found by these checks

- **Moves 2+ played without alignment:** `S.seq.map(segOf)` passed the index as the "no warp" flag. The on-screen score was computed separately and looked right; the independent file check caught it.
- **Recorded sound 74 ms early:** the Opus pre-skip default.
- **Song jumped after every cut:** video start-up latency combined with an over-eager drift correction.
- **Off-beat control compared against the wrong version:** it now uses the aligned version.

## v2: accuracy upgrade and calmer display (Oct 2026)

### Harder benchmarks (`bench_songs.py`, `bench_videos.py`, scored by `bench_eval_songs.js` / `bench_eval_videos.js`)

Songs are built to fool beat trackers the way dancehall, reggae and club music do: off-beat chord stabs on every "and", bass that avoids the beat, one-drop (kick only on beat 3), Jersey triplet kicks, swing, a legato vocal-like line, reverb and noise. Ten tracks were used while tuning; ten more with **tempos and seeds never used while tuning** (held-out) check that the fixes generalise.

| Song set | Version | Beat F (±70 ms) | Tempo right | Downbeat right |
|---|---|---|---|---|
| Tuning set | v1 | 0.385 | 8/10 | 2/10 |
| Tuning set | v2 | **0.981** | **10/10** | 4/10 |
| Held-out set | v1 | 0.554 | 9/10 | 3/10 |
| Held-out set | v2 | **0.975** | **10/10** | 5/10 |
| Tuning set | librosa 0.10 `beat_track` | 0.221 | | |

The original eight unit-test songs still score F 0.970–0.979 with the downbeat right; the in-app dembow 100 run still scores 0.990.

Videos: an out-and-back figure with hits at known times, rendered clean, small, with a second person moving off the beat, grainy and heavily compressed, irregular hits, smooth hand sway, per-frame camera jitter, and everything at once.

| Video | v1 F | v2 F | v2 median timing error |
|---|---|---|---|
| Clean | 0.72 | **1.00** | 4 ms |
| Second person in frame | 0.79 | **1.00** | 4 ms |
| Grainy, 250 kbit/s | 0.77 | **1.00** | 7 ms |
| Irregular hits | 0.71 | **0.93** | 3 ms |
| Small dancer | 0.60 | **0.87** | 10 ms |
| Smooth hand sway | | **0.96** | 9 ms |
| Per-frame camera jitter | 0.22 | 0.35 | 24 ms |
| Jitter + small + distractor + grain | 0.23 | 0.35 | 19 ms |
| **Mean** | 0.59 | **0.81** | 10 ms (v1: 20 ms) |

Per-frame jitter is still a weakness. The app now measures it and says so ("The camera shakes… prop the phone up"), and those hits are treated as not sure.

### In the app (headless Chromium, full flow on the app server)

| Measure | v1 | v2 |
|---|---|---|
| Dance hits found in the browser, F (±70 ms) | 0.867 | **1.000**, median 4 ms |
| Beat fit: constant speed → aligned | 49% → 75% | 46% → **83%** |
| Quarter-beat off-beat control | 18% | **13%** |
| True hits mapped through the plan, against the true beats | 0.616 (control 0.229) | **0.810** (control 0.140), median miss 18 ms |
| Recorded take: picture against plan | 12 ms | 9 ms, 12/12 within 70 ms |
| Recorded take: sound | 0 ms | 0 ms |
| Sync check | +7 ms | −4 to +6 ms over runs (one run −13 ms) |

The tap-to-check, "This is the 1", clear and beat-light controls are covered by `ui_tracking.js` (23 checks: reduced-motion default, Calm never flashes the frame, unsure beats never flash, on-beat taps confirm, half-beat-off taps move the grid by half a beat, double-time taps re-find the beat at double tempo, the 1, clear and re-find, hit check, clear all, and persistence across reload).

### Real track (your 44 s dancehall MP3)

Tempo unchanged (99.65; librosa 99.38). The beat positions are unchanged from v1 and still half a beat from librosa's. The new phase certainty for this track is 0.10, so the app now says it isn't sure where the beat falls and asks for a tap check, instead of showing confident lights. librosa scores only 0.22 on the benchmark's off-beat-stab songs, so it isn't a reliable referee here.

### Observed, not fixed

- In the routine playback test, v2 makes one extra small song correction about 0.5 s after play starts (v1 did not). The song is steady after that. The cause wasn't isolated.
- The downbeat (the 1) is right on only about half the benchmark songs. Kick on beats 1 and 3 leaves the 1 and the 3 indistinguishable from drums alone, and one-drop puts the kick on 3 by convention. The app says when it's unsure and offers "This is the 1".

## Not verified

- **AIST++, GTZAN and Ballroom audio and video:** not reachable from the build environment. Accuracy on real dance footage is untested; the ground truth used here is rendered.
- **Pose estimation (MediaPipe):** the model couldn't be downloaded, so hits come from image motion. Footwork hidden from the camera, or motion parallel to a panning camera, can be missed.
- **iPhone's AAC encoder lead-in:** this can't be run here. The in-app self-check measures and corrects it per phone after the first take.
- **iPhone sync numbers:** these come from running **Checks → Sync check** on the device.
- **Blind ratings by real dancers:** the kit is built and tested with simulated ratings only.
