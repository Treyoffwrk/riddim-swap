# Riddim Swap + MirrorView: status, architecture and testing

_Last updated 29 Oct 2026 · version rs-d37aa63294 · repo Treyoffwrk/riddim-swap_

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
- **Snip a routine** (the Snip button beside Learn). Build a choreography while you watch, without leaving the player:
  - Play any of the project's clips and tap **Start from** where a move begins and **Finish here** where it ends, again and again; switch clips whenever you like. Each pair becomes a move added to the end of the routine, in order.
  - **Finish here** again, with no new Start from, carries on from where the last snippet ended (same clip), to chop a long phrase.
  - With a song beat, Start from moves to the nearest beat you hear, and each snippet is made whole **8-counts** (or 4s, or single counts, or Off), measured on the routine song's own beats, so the next snippet starts on a 1 with no gaps. The first snippet of an empty routine starts the routine's song with the music heard at Start from, moved to the nearest 1.
  - **↶** undoes the last snippet; **Play routine on repeat** plays them back to back and loops. The strip stays in the player in full screen. Code: src/snip.js (marker `/*@snip*/`); test: tests/snip_test.js (10 checks).
- **Learn mode** (the Learn button beside Study). Splits the clip into 8-counts (8 beats of the song, each starting on a 1; without a song, the clip's own tempo, or about 4 s pieces cut at the dancer's hits). Each 8-count loops at 50%, then 75%, then full speed (song pitch kept), then it's put together with up to 3 before it from the top, then the next one starts. A 1–8 count lights up as it plays; numbered buttons jump to any 8-count; Back / Slower / Again / Next. Options: slow first, put together, move on by itself, loops per speed (1–3). Progress (where you are, which are learnt) is kept per clip on the phone. Parts cut out of the clip are skipped. It runs on the Study engine, so sync, body, cues and cut-out work as usual. Source: `src/learn.js`.
- **Learn on the phone screen** (25 Oct): Learn adds one slim row to the player (where you are, the speed, the 1–8 count, back/next); the 8-count buttons, Slower/Again and options sit in a panel below the player in the page, so nothing covers the dance or the other options. In full screen only the slim row shows, with the play bar.
- **Body as part of Riddim Swap** (25 Oct): Body uses your Look (skeleton colours and glow, app theme; a new look shows when you come back to Body). The clip arrives with the project's name, its cuts and its speed graph: a table maps clip time to song time so the song stays in time through the speed graph, and cut parts are skipped while the song keeps playing. Whole / Upper / Legs is one setting for both pages. In a routine, Body opens the clip under the playhead (it used to open nothing). Source: `mirrorview/mv_link_block.py`.
- **Skeleton on fast moves** (25 Oct):
  - *Frozen skeleton on iPhone fixed.* iPhone stops giving new frames to a video it can't see, so the hidden tracking video froze part-way; since 24 Oct the tracker kept going and tracked the same picture again and again (the skeleton stood still while the dancer moved). Now the tracking video shows as a small preview in the corner while it works, every frame is checked to have changed (a stuck video is woken with a short play, and reloaded now and then), and if it can't be woken that stretch is left empty and the clip summary says how much is covered. The phone check counts stuck frames. Test: the live build froze for 312 frames under a simulated stuck video; the new one never repeats a pose and covers 100% when a play wakes the video.
  - *Smoothing that keeps up.* Hands and feet are smoothed only while nearly still and left as tracked when they move fast; only one-frame glitches are removed; fewer gaps are filled with guesses. Measured on a dancehall clip against the heavy tracker: fast-move error for elbows −13%, ankles −14%, wrists −14% (wrists wobble a little more when still).
  - *Tracking: Accurate / Faster* under Track body. Accurate (default) uses MediaPipe's heavy pose model (more exact on fast, blurred limbs; about twice as slow; a 30 MB download kept for offline use). Both pages use the same setting.
  - The skeleton is drawn at the time of the frame actually on screen (requestVideoFrameCallback), not the player's clock.
  - Clips tracked before this keep the old smoothing; the Clip tab suggests Track again.
- **Compilations and edits** (27 Oct): the tracker finds shot changes (each frame's colours against the one next to it) and starts fresh on the main dancer of each new shot; a dancer you chose counts only for the shot you chose them in; cleaning and drawing never blend across a cut. On a 4-shot test edit the old build left 1.5 s without a skeleton after one cut (and 0% of the last two shots with a chosen dancer); the new one covers every shot (95–100%) and is back on the first frame after each cut, with or without a chosen dancer. It also found a cut inside a TikTok clip that was itself an edit.
- **Easier to see** (27 Oct): dark outline under the limbs, the dancer's left side a lighter shade than their right, a dot on each hand and foot (main player; Body still draws its own style).
- Tracking errors now stay on screen (a refresh used to replace them with the intro text).
- **Body: Pulse box movable** (27 Oct): the Pulse box (BPM and the 8-count) used to sit fixed over the lower part of the video in Split, Overlay and Worldline, covering the dancer and the view controls. Now it starts as a small badge with just the count; tap it for the full box, drag it anywhere on the video (kept inside, position remembered); touches on it don't move the 3D view underneath. Body's dialogs no longer say "MirrorView".
- **RTMPose is the default tracker** (29 Oct, after the user judged it better on real clips): Tracking → RTMPose (default) / Accurate / Faster, with a time estimate from this phone's measured speed (rough guesses before the first track). Older tracks suggest "Track again with RTMPose".
  - *Speed:* the RTMPose runtime is served with the app (vendor/ort), and the service worker adds cross-origin isolation headers (COOP/COEP) to the app's own pages and files, so the runtime uses several cores; the WebGPU build is used when the browser has a GPU API (iOS 26+, desktop). Test machine (2 cores): 409 → 271 ms/frame. Everything the app loads from elsewhere allows isolation (CORP/CORS checked).
  - *Fingers and toes:* RTMPose's 21 points per hand and 3 per foot are kept per frame (B.ext, 48 points; never blended across cuts; in backups) and drawn as thin finger bones with fingertip dots and a heel-to-toes outline per foot, with the same outline and left/right shading. Body (MirrorView) doesn't draw them yet.
- **RTMPose trial** (28 Oct): Tracking → RTMPose (trial). The regular tracker finds and follows the dancer (with the cut handling) and supplies the 3D for hip turn; RTMPose's whole-body model RTMW-m (distilled from RTMW-l, Apache-2.0) reads a 192×256 crop of them; points it isn't sure of (score < 0.3) keep the regular tracker's reading. Runs on ONNX Runtime Web 1.22 (WASM; no GPU on iOS 18). Model weights stored at half precision (65 MB, results identical to full precision; 8-bit versions broke the model), served from the app and kept across updates. Tracking again with another tracker keeps the previous skeleton: Compare → This track / Previous (orange) / Both. Phone check shows "RTMPose trial" and its ms/frame.
  - Measured on a 20 s dancehall clip (no ground truth; three-way 'odd one out' among Regular, Accurate and RTMPose, which leans against RTMPose): wrists odd one out 87 / 28 / 49 times, elbows 19 / 7 / 26, knees 13 / 1 / 8, ankles 33 / 7 / 39; bone steadiness close to Accurate. RTMW-s was less exact (wrists 69, ankles 48). Speed on the test machine: RTMW-m 497 ms/frame, RTMW-s 237. Verdict so far: about on par with Accurate, better than Regular on wrists, places shoulders/hips at the joints, adds hands/feet points; much slower. Real-phone speed and the user's judgement on their clips are the open questions.
- **Look & sound** (the Look button in the header). A sheet with free colour pickers for the balls and skeleton, and 16 cosmetic packs: balls, skeleton (some with a glow), click sounds and app themes, a free Classic plus three extras of each. Nothing is locked on the web. Paid packs are only gated when the store is on (`?store=1`, or inside the App Store app): then they show a price, Buy and Try it (a preview with a bar to buy or stop), with a note that every feature stays free. Purchases are test purchases for now (no money taken). Source: `src/look.js`, packs in `src/packs.json`.
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

**Last full regression:** 55 suites at rs-d37aa63294 (29 Oct 2026, RTMPose default, fingers and toes, multi-core): all passed, including the in-app RTMPose test (7/7: time estimate, compare, fingers and toes drawn, phone check) and the service-worker suites with cross-origin isolation on (sw 13/13, update 5/5, offline 3/3). One cue timing check failed under load and passed alone (13/13). The session suite still stops at its old update check.

**Previous:** 55 suites at rs-e6e714900c (28 Oct 2026, RTMPose trial): all passed, including the in-app trial test (6/6). One skeleton check expected two Tracking buttons (now three); updated. The session suite still stops at its old update check.

**Previous:** 54 suites at rs-3d94bb9d96 (28 Oct 2026, movable Pulse box): all passed, including the new Pulse box test (10/10: starts small, tap to open/shrink, drag in Split and Worldline, kept on the video, remembered, no touches reach the 3D view). The session suite still stops at its old update check.

**Previous:** 53 suites at rs-fae73d23f1 (27 Oct 2026, compilations): all passed, including the two compilation tests (with and without a chosen dancer). The session suite still stops at its old update check (fails on earlier builds too; the dedicated update test passes). The compilation test clip is made from the test assets (see compilation_test.js); it isn't stored in the repo.

**Previous:** 51 suites at rs-34f3c9b91f (25 Oct 2026, skeleton fixes): all passed, including the stuck-video tests (both cases), skeleton drawing with the Accurate tracker, Body link 11/11 and Look 24/24. Suites track with the regular model for speed (RB_HEAVY=1 uses the heavy one); the skeleton suite uses the heavy one. One Learn check caught the normal sync nudge at 50% speed (video at 48.5%); its tolerance now matches the 75% check and Learn passes 16/16. The session suite still stops at its old "reloads on a new version" check (also fails on the earlier live build; the dedicated update test passes).

**Previous:** 49 suites at rs-93ff901e0f (25 Oct 2026, compact Learn + Body integration): all passed, including Learn (16/16, with phone and full-screen layout checks) and the new Body link test (11/11: Look colours, glow and theme in Body, project name, cuts and speed graph with the song in time, gap p90 47 ms through a cut). In the full run: the Body header check expected the word "Body" (it now shows the project's name; check updated, 21/21 alone), Body camera start and cut-out lag failed under load and passed alone (cut-out lag 43 ms). The session suite's "coming back to a new version reloads it" check fails on the live build too, so it isn't from this change; the dedicated update test (real service worker) passes 5/5.

**Previous:** 48 suites at rs-aaad150286 (25 Oct 2026, Learn mode): all passed, including Learn (14/14) and the updated hip meter check. In the full run, one cue check (dancer ball landing, worst 151 ms) failed under load and passed alone (worst 77 ms); the Look suite couldn't start because a debug hook had lost `LOOK`, fixed and re-run 24/24 (the app itself was unaffected).

Also fixed with Learn: Repeat during Study or Learn now shows and sets your own Repeat (it used to switch their looping off), the project no longer saves Repeat as on because Study/Learn was running, and switching ball cues while paused redraws the skeleton (hip gauges come back).

**Previous:** 47 suites at rs-2acc5fd05a (24 Oct 2026, Look & sound merged): all passed, including Look (24/24), isolation with tracking on the GPU, slow video, skeleton drawing and tracking with a silent frame clock. Three checks failed in the full run: the hip meter check (it expected gauges while ball cues are on; updated for the new behaviour), and Body camera start and the quick-flick swipe, which passed when re-run alone (timing under load).

**Earlier:** 43 suites at rs-e0adbf4354, including a slow-video test (video plays 15% slower than asked: 0 song jumps in 10 s).

**Skeleton on phones (24 Oct 2026, rs-2acc5fd05a):** on iPhone, tracking could stop part-way through a clip (the hidden video stops reporting frames) and still say it was complete ("197 of 197 frames" on a 35 s clip), so the skeleton vanished after about 6 s. Tracking now carries on through to the end, and the Clip tab and phone check say how much of the clip is covered. Also: no skeleton on the old picture while a loop restarts, and the hip gauges are hidden while the ball cues use the side bars. Tests: with the frame clock going silent after 100 frames, the old build covered 2.6 s of a 12 s clip and the new one all of it.

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

- Look & sound: the skeleton glow on real tracked footage, and the sheet and store on a real iPhone.
- That tracking now covers the whole clip on iPhone (simulated in tests, not yet seen on the phone).

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
