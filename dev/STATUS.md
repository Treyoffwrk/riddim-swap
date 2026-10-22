# Riddim Swap + MirrorView: status, architecture and testing

_Last updated 22 Oct 2026 · version rs-c39b3bf328 · repo Treyoffwrk/riddim-swap_

**Live app:** https://treyoffwrk.github.io/riddim-swap/ (install from Safari: Share → Add to Home Screen)

## What the app does

Riddim Swap is a phone-first dance practice app (an installable web app). You load a dance clip and a song, and it:

- **Plays the song over the clip and keeps them in sync.** It finds the song's tempo and beats, and the clip's dance hits.
- **Lets you change timing.** You can fit speed to the beat, draw a speed graph, or use Study ½× (half speed, song pitch kept, 2-second loop).
- **Builds routines.** You cut moves from clips, string them into a routine, and record takes. A take can have the dance body drawn on it.
- **Tracks the dancer's body** (the *Body* page). One chosen dancer is followed through crowds and occlusion. The tracking draws:
  - a skeleton and pelvis with live Tilt / Sway / Turn gauges, made for Jamaican hip work;
  - hip graphs, hips-on-the-beat scoring and named hip patterns (still, circle, pulse, tilt, sway).
- **Compares a try with the original.** It lines your try up with the original, finds mirroring, and reports size and drift.
- **MirrorView** (the original Mirror app, built in) shows the reference video and your camera side by side, with the skeleton overlaid. You choose the layout and mirroring, and loop it.
- **Keeps your work.** Projects save on the phone. Backups and `.riddim` share bundles carry videos, songs and tracking.
- **Works offline after the first visit.** This includes the body tracker.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Riddim Swap page | `src/` (head, style.css, markup, app.js, tail) | Edit here; `python3 build_src.py` builds everything |
| Beat analysis | `analysis.js` | Shared with MirrorView's Pulse |
| Body tracking | `body.js` (`window.RB`) | MediaPipe Pose Landmarker (full, 3 people, IMAGE mode); one-dancer follower (position, size, clothing colour); zero-phase cleaning; hip series (tilt, sway, turn, twist, thrust); drawing |
| Installable app | `build_app.py` → `riddim-swap-app/` | Service worker whose version is a content hash; it keeps the tracker model and fonts in a cache that survives updates |
| MirrorView | `mirrorview/build_mirrorview.py` | Untouched baseline plus three change files (theme, shared Pulse, shared body tracker). Rollback = build the baseline alone |
| Old build chain | `history/` | v20 base plus patch files; replays to identical bytes; reference only |

**Key behaviours**

- **Sync.** The song plays steadily. The video's speed is nudged by up to ±6% until they line up, and the song only jumps on real seeks.
- **Updates.** The app checks for a new version when you come back to it (and every 10 minutes). It reloads when idle; otherwise it shows an Update bar.
- **Sound engine.** The live sound engine only opens when needed, and closes when the app is in the background.
- **Takes** use WebCodecs MP4 where available, and MediaRecorder otherwise. An audio edit list keeps takes in sync.
- **Projects sheet.** It has these sections:
  - *Storage on this phone*: a breakdown, plus *Clear unused*, which only removes media and tracking that no project uses.
  - *Copy phone check*: version, device, recorder, tracking speed, last sound check with screen fps, storage and recent errors. It contains no file names.
  - *Start fresh* and *Erase everything*.

## Testing

Tests use Playwright + Chromium, with the tracker files served locally; MediaPipe runs on the CPU in tests.

**Last full regression:** 34 suites, all passed, at version rs-c39b3bf328 (22 Oct 2026).

**Measured so far**

| What | Result |
|---|---|
| Tracking time per frame (CPU, test machine) | 139 ms, down from 195 ms |
| Tracking accuracy | Poses unchanged by the speed-up |
| Hip jitter | 0.035 → 0.011 |
| Tilt wobble | 1.40° → 0.44° |
| Real movement kept over 0.13 s | 93–98% |
| Pulse on recorded takes | 99.5 BPM; 24/24 beats within 70 ms |
| Song jumps over a stress run | 2–3, down from 47–50 |
| Song-to-video gap | 3–4 ms median |
| Long session (14 cycles of play, app switches, study, swipes, project reopen) | No growth in video elements, blob URLs, timers or audio engines; memory flat at about 17 MB |

**Not verified (needs a real iPhone)**

- How fast tracking runs on the phone's GPU.
- AAC priming on Safari recordings.
- How sound behaves after long backgrounding.
- Whether the hip angles are accurate against motion capture.
- Whether the pattern names match what dancers would call the moves.

The phone check report is the way to collect these.

**Known flaky under heavy load (pass when run alone):**

- the routine take hit count;
- cut-out lag;
- MirrorView pose prep.

## Possible next steps

1. Run the phone check on a real iPhone after a practice session, and tune from what it shows.
2. Check the hip angles against a reference recording.
3. Get dancers to review the hip-pattern names.
