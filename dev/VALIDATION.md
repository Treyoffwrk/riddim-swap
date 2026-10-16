# Riddim Swap: beat analysis validation

How the beat, hit and alignment features were checked, and what wasn't. All numbers come from the scripts in `dev/tests/`.

## Methods

| Part | Method |
|---|---|
| Song beat | Mel-band spectral-flux onsets, with the kick band weighted up. Autocorrelation tempo that also checks the half-bar, bar and kick periodicity. Dynamic-programming beat tracker (Ellis 2007, the method behind librosa's `beat_track`). Low-end phase check. Downbeat taken from kick loudness. |
| Dance hits | Coarse-to-fine block-matching optical flow at 112 px. Camera motion removed with a median vector. A directional motion histogram ("directogram") whose sudden drops mark stops and turns, after Davis & Agrawala, "Visual Rhythm and Beat" (SIGGRAPH 2018). Peak picking, with each hit dated to the middle of the frame interval. |
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

## Not verified

- **AIST++, GTZAN and Ballroom audio and video:** not reachable from the build environment. Accuracy on real dance footage is untested; the ground truth used here is rendered.
- **Pose estimation (MediaPipe):** the model couldn't be downloaded, so hits come from image motion. Footwork hidden from the camera, or motion parallel to a panning camera, can be missed.
- **iPhone's AAC encoder lead-in:** this can't be run here. The in-app self-check measures and corrects it per phone after the first take.
- **iPhone sync numbers:** these come from running **Checks → Sync check** on the device.
- **Blind ratings by real dancers:** the kit is built and tested with simulated ratings only.
