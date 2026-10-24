# Riddim Swap + MirrorView: status, architecture and testing

_Last updated 24 Oct 2026 · version rs-e0adbf4354 · repo Treyoffwrk/riddim-swap_

**Live app:** https://treyoffwrk.github.io/riddim-swap/ (install from Safari: Share → Add to Home Screen)

## What the app does

Riddim Swap is a phone-first dance practice app (an installable web app). You load a dance clip and a song, and it:

- **Plays the song over the clip and keeps them in sync.** It finds the song's tempo and beats, and the clip's dance hits.
- **Lets you change timing.** You can fit speed to the beat, draw a speed graph, or use Study ½× (half speed, song pitch kept, 2-second loop).
- **Cuts a single clip** (Clip → Cut the clip):
  - The clip shows as a strip of pictures with the song's beats and the dancer's hits.
  - Split at the playhead, tap a part, then Cut it (or bring it back); drag the white edges to adjust.
  - Cut parts are skipped and the song keeps going. The speed graph applies to each kept part.
  - Cuts are saved with the project; recordings and ball cues follow them.
- **Builds routines.** You cut moves from clips, string them into a routine, and record takes. A take can have the dance body drawn on it.
  - The routine is a timeline: moves show as thumbnail blocks over the song's numbered bars.
  - Tap a move to select it (Play, Split here, Fit to beat, Duplicate, Remove, trims, speed).
  - Press and hold to drag a move to a new place; drag its edges to trim, snapping to the beat or "and".
  - Pinch or −/+ to zoom; a quick drag scrolls. The list view is under More options.
- **Tracks the dancer's body** (the *Body* page). One chosen dancer is followed through crowds and occlusion. The tracking draws:
  - a skeleton and pelvis with live Tilt / Sway / Turn gauges, made for Jamaican hip work;
  - hip graphs, hips-on-the-beat scoring and named hip patterns (still, circle, pulse, tilt, sway).
- **Isolates legs or upper body.** Cut out → Show: Whole / Upper / Legs, with backgrounds dark, colour, blur or Dim (the rest of the frame, darkened). Legs = around each leg from the hips to the toes, trimmed to the dancer's outline; Upper = the rest, so arms past the hips stay. Also in Body (the Dancer's Cut out). On the user's clip: Legs hid 96% of the upper body and kept 94% of the legs; Upper hid 92% of the legs and kept 99% of the upper body.
- **Compares a try with the original.** It lines your try up with the original, finds mirroring, and reports size and drift.
- **Beat cues: two balls bouncing over the video.**
  - The **Riddim** ball (left) lands on each hit of the song's drum pattern: a big amber ring for a kick or bass hit, a white ring for a snare, clap or rim.
  - The **Dancer** ball (right) lands on each of the dancer's hits.
  - You watch a ball fall to see the next hit coming. When both land together, a line joins them.
  - The 1-2-3-4 count follows the detected beats.
  - The click can play on the beat or on the riddim, so you can check the cues by ear.
  - A **Sound delay** setting (speaker or wired / Bluetooth / custom, with a check) shifts the cues and the dancer video to match what you hear.
- **Body** (the Mirror app, built in as a Riddim Swap section):
  - The reference video and your camera, side by side (Split), on top of each other (Overlay) or as a 3D path (Worldline), with the skeleton drawn on.
  - **Sound** in every view: Song (Riddim Swap's song, in time with the clip, at its own speed: song = offset + (clip time − clip start) × song speed ÷ clip speed; the song leads and the clip is nudged up to ±6%), Clip (the video's own sound) or Off. It doesn't depend on Pulse, so sound still plays when Pulse can't read a clip's audio.
  - It uses Riddim Swap's header, with Projects, and its section bar. MirrorView's own Load video, Start here and Diagnostics sit in the ⋯ menu.
- **Keeps your work.** Projects save on the phone. Backups and `.riddim` share bundles carry videos, songs and tracking.
- **Works offline after the first visit.** This includes the body tracker.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Riddim Swap page | `src/` (head, style.css, markup, app.js, tail) | Edit here; `python3 build_src.py` builds everything |
| Beat analysis | `analysis.js` | Shared with MirrorView's Pulse. `riddim()` finds the drum pattern: low hits from rises in low-band loudness (kick or bass), high hits from noisy, even rises at 1–5 kHz with some body (snare, clap, rim). It snaps them to 16 slots per bar on a smoothed beat grid (`smoothBeats`, a local line fit), and keeps a slot only when this bar has a hit there and the slot belongs to the 1-bar or 2-bar loop around it. |
| Timeline editor | `src/timeline.js` | One canvas surface (`TL`) for Clip cuts and the Routine: thumbnails from a hidden copy of each video, beat and hit ticks, playhead, tap / scroll / pinch / edge-drag / hold-to-reorder. A clip with cuts plays as its kept pieces through the same piece engine as routines (`clipCut()`, `segMode()`), so the song plays straight through. |
| Beat cues | `src/cues.js` | One clock: the smoothed song position, minus the sound delay, plus one frame. The dancer's hits are mapped into song time the same way the player lines video up with song. The ball lands exactly on each hit. Clicks are scheduled ahead on the sound engine's clock. |
| Body tracking | `body.js` (`window.RB`) | MediaPipe Pose Landmarker (full, 3 people, IMAGE mode); one-dancer follower (position, size, clothing colour); zero-phase cleaning; hip series (tilt, sway, turn, twist, thrust); drawing |
| Installable app | `build_app.py` → `riddim-swap-app/` | Service worker whose version is a content hash; it keeps the tracker model and fonts in a cache that survives updates |
| Body (MirrorView) | `mirrorview/build_mirrorview.py` | Untouched baseline plus four change files: theme, shared Pulse, shared body tracker, and `mv_rs_block.py` (Riddim Swap header, Sound switch with the song from Riddim Swap, phone layout fixes). Rollback = build the baseline alone. The song travels in the hand-off record and is kept for that clip under `song-current` in `riddim-bridge` |
| Old build chain | `history/` | v20 base plus patch files; replays to identical bytes; reference only |

**Key behaviours**

- **Sync.** The song plays steadily and is never seeked during play. The video's speed is nudged by up to ±6%; on a large drift the video jumps to the song ("video caught up" in the phone check). Video stalls don't pause the song. (Before 24 Oct the song was re-seeked on drift; on iPhone each seek is ~0.4 s of silence, which looked like new drift, so it looped every ~2 s.)
- **Updates.** The app checks for a new version when you come back to it (and every 10 minutes). It reloads when idle; otherwise it shows an Update bar.
- **Sound engine.** The live sound engine only opens when needed, and closes when the app is in the background.
- **Takes** use WebCodecs MP4 where available, and MediaRecorder otherwise. An audio edit list keeps takes in sync.
- **Projects sheet.** It has these sections:
  - *Storage on this phone*: a breakdown, plus *Clear unused*, which only removes media and tracking that no project uses.
  - *Copy phone check*: version, device, recorder, tracking speed, last sound check with screen fps, storage and recent errors. It contains no file names.
  - *Start fresh* and *Erase everything*.

## Testing

Tests use Playwright + Chromium, with the tracker files served locally; MediaPipe runs on the CPU in tests.

**Last full regression:** 43 suites, all passed (24 Oct 2026), at rs-e0adbf4354, including isolation with tracking on the GPU and a slow-video test (video plays 15% slower than asked: 0 song jumps in 10 s).

**Cut-out on phones (24 Oct 2026):** masks made on the GPU (as on iPhone) were all zero, so Upper / Legs / Cut out showed nothing. They are now drawn through MediaPipe's DrawingUtils and read back (median IoU 0.964 against CPU masks). Clips tracked before this have empty masks; Cut out detects that and offers Track again.

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

**Beat cues (22 Oct 2026)**

Why the old lights were unreliable:
- They ran their own fixed tempo, 140–170 ms off by 30 s.
- They faded in over 0.35 s.
- They didn't allow for the phone's sound delay.
- They lit up only after the beat.

| What | Result |
|---|---|
| Riddim detector, 6 synthetic riddims with known hits (bass, chord stabs, hats, vocal line, tempo drift, a drum break) | 96% of cues are real hits, 84% of hits found; no false cues in breaks; median timing 4–18 ms |
| Steady riddim cues in the app (dembow, 40 s, tempo drifting 1.2%) | Precision 1.00, recall 0.96; median error 3 ms in the first 12 s and 9 ms after 28 s, so no drift |
| Count against true beats | Median 6 ms, worst 13 ms (old lights: median 21 ms, worst 66 ms on this song; up to 170 ms on the user's MP3) |
| Ball landing | On the first frame drawn after each cue, 100% of the time |
| Cue clock | Jitter 0.2 ms |
| Riddim click | Scheduled within 0.2 ms of each cue |
| Dancer ball | When it lands, the video is at the dancer's true hit (median 10 ms) |
| Bluetooth, 200 ms | Song runs 193–205 ms ahead of the video; ball lands about 200 ms later |

On real tracks there's no ground truth. The user's clip song gives a steady dembow pattern bar after bar; their MP3 shows a two-bar riddim, now handled. The ear check is the click "on the riddim". On the MP3 the beat phase is uncertain (0.10), and the cues show that as a hollow "?" ball.

**Body sound and layout (23 Oct 2026)**, measured with a 0.9× clip and a song offset of 1.5 s:
- The song plays at its own speed with a typical gap of 4 ms (90th percentile 27 ms).
- It follows seeks (16 ms).
- At half speed: song 0.500×, clip 0.450×, pitch kept.
- Clip and Off work, including when Pulse couldn't read the audio.
- In Split, Overlay and Worldline, nothing covers the video and nothing runs off screen.
- Practice cycles Sound from its control bar.
- The song is still there after a reload; Projects returns to Riddim Swap's Projects.

**Cutting and the routine timeline (23 Oct 2026)**

Cutting (Clip):
- Splitting at 3 s and 6 s and cutting the middle gives two pieces.
- Playback never shows 3–6 s, and the song runs straight through.
- The play bar shows the kept 9 s, and a recorded take came out at 9.01 s.
- Dragging an edge and Undo both work; ball cues use only hits in the kept parts.
- Cuts work with the speed graph and are saved with the project.

Routine timeline:
- Tapping a move selects it.
- Dragging its right edge trimmed it and snapped to a beat or "and" (0 ms off).
- Press, hold and drag reordered the moves.
- Zoom works, and a quick drag scrolls.
- Split here cuts a move in two.

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

1. Listen to the riddim click on a few real tracks and note where the cues miss.
2. Run the phone check on a real iPhone after a practice session, and tune from what it shows.
3. Check the hip angles against a reference recording.
4. Get dancers to review the hip-pattern names.
