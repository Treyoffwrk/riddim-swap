# MirrorView inside Riddim Swap: integration notes

**Host:** Riddim Swap, an installable web app (PWA) on GitHub Pages: `https://treyoffwrk.github.io/riddim-swap/`. It's a single-page app in plain JavaScript and HTML, with no framework, account or backend. It's built by `dev/build_app.py` from `riddim-swap.html` plus `dev/patch_depth.py`.

**Guest:** MirrorView v0.13. It's plain JavaScript and HTML in one 572,966-byte file (SHA-256 `9229eb1c…cc9867`), checked against the handover's manifest.

**Route chosen:** route A from the handover (an existing browser app or PWA). MirrorView is a page inside the host at `./mirrorview/`, with the same origin, the same installed home-screen app, the same offline cache and the same on-phone storage.

## Why a separate page in the same app, not a component

| Option | Verdict |
|---|---|
| Paste MirrorView into Riddim Swap's page | Rejected. Both apps style `html`, `body`, `button`, `dialog`, `h1` and range inputs globally, and both use `id="stage"`. MirrorView has 324 global IDs, a document-level viewport/scroll script, keyboard handlers and `#modal`. Making it a scoped component means rewriting about 430 KB of tested code, which the handover says not to do before parity. |
| iframe | Rejected. It adds camera-permission delegation, fullscreen and focus problems on iPhone and isn't integration by itself. |
| **Page in the same app (chosen)** | Each app keeps its own document, so neither app's CSS or handlers can break the other. Camera, fullscreen, keep-awake and audio behave as they do for a normal page. Installation, origin, storage and offline cache are shared. The apps are connected by real navigation in both directions and a data bridge. |

## Source map

| Concern | Where |
|---|---|
| Host entry points | Riddim Swap header **MirrorView** (`#mvBtn`); Clip tab → Dance hits card **Study this clip in MirrorView** (`#mvClip`); take panel **Practise in MirrorView** (`#mvTake`). These are shown only in the installed build (`window.RS_HOSTED`); the claude.ai single-file version hides them. Code: `dev/patch_depth.py`, block "MirrorView: entry points and media hand-off". |
| Return path | MirrorView **‹ Riddim Swap** strip above its top bar (`#rs-back`), hidden in Practice. It pauses, stops the camera, then goes `history.back()` when it came from the host (back/forward cache), otherwise `../`. Riddim Swap autosaves before leaving and restores on return. |
| MirrorView media owner and clock | `#reference-source` video element; `MediaPlaybackClock` (`playback-clock.js` section) reads its `currentTime`. Unchanged. |
| Pose tasks | `TrackingService` (`tracking.js`): MediaPipe tasks-vision **0.10.18** and `pose_landmarker_lite`, loaded from jsdelivr and Google storage. Unchanged. |
| Pulse | `PulseWorkspace` and `pulse-*.js`, with the analysis cached per asset. Unchanged. |
| Build / Practice / renderer | `build-workspace.js` and `sequence.js` / `practice-view.js` / `render.js`. Unchanged. |
| Persistence | IndexedDB `mirrorview-session-v1`; `mirrorview_v2_*` localStorage keys. Unchanged. |
| Hand-off | IndexedDB `riddim-bridge`, store `handoff` (see below). New. |
| Offline | Riddim Swap's service worker, which now caches each page under its own address. |

## Merge matrix

| Host (Riddim Swap) | MirrorView counterpart | What happens now | Later |
|---|---|---|---|
| Several dance videos, moves cut across them | One reference video | Each keeps its own. A clip or take passes to MirrorView through the bridge. | Shared Move schema (source asset, interval, pose frames). |
| Overlay-song beat tracker (`analysis.js`) | Pulse (the video's own audio) | Both kept. On your clip 2 song, librosa says 129 BPM, Riddim Swap 126.2, MirrorView 50.7 (101.3 double-time, labelled low confidence). | Pulse stage: offer Riddim Swap's estimate inside Pulse as a labelled source, with tests. |
| Dance hits from image motion | MediaPipe pose | Both kept. | Derive Riddim Swap's hits from MirrorView's pose, so one tracker serves both apps. |
| Routine timeline, aligned and rendered to MP4 | Build (skeleton sequence, one reference, hard cuts) | Both kept. A Riddim Swap take can become MirrorView's reference, so you can practise your remix with its new song. | — |
| Projects in IndexedDB `riddim-swap`, `rs-*` keys | `mirrorview-session-v1`, `mirrorview_v2_*` | No key collisions. Neither app clears the other's data. | — |
| One service worker and manifest | — | MirrorView links the host manifest and icon, so it opens inside the installed app. | — |

## Bridge contract (version 1)

Riddim Swap writes one record and navigates to `mirrorview/?handoff=<id>`:

```
{ id, v: 1, from: 'riddim-swap', kind: 'clip' | 'take', name, blob: <video Blob>,
  meta: { trim:[in,out], hits:[s…] } | { songBpm }, created }
```

- Only one record is kept. Writing clears the previous one.
- MirrorView checks: the id format; `v === 1`; `from`; that the Blob is non-empty, at most 512 MiB and a `video/*` type; and that the name is a string. It then sanitises the name and calls its own `importFile()`, the same code as **Load video**. That keeps its atomic replacement, recovery copy and Pulse supply.
- On success it deletes the record and removes `?handoff=` from the address, so a reload doesn't import again. On failure it shows a message and leaves the current reference alone.
- No media goes through URLs, messages or a server; it stays on the phone. `meta` is carried across but not yet used by MirrorView.

## Files changed

- `dev/patch_depth.py`: MirrorView buttons, the hand-off and the `mv-only` visibility.
- `dev/build_app.py`: the `RS_HOSTED` flag; builds `mirrorview/`; the service worker caches pages by address (bug fix: every page was cached as `./index.html`, so opening MirrorView would have replaced the offline copy of Riddim Swap); both pages are precached.
- `dev/mirrorview/build_mirrorview.py`: makes `mirrorview/index.html` from the hash-checked baseline. The changes are additive: install meta tags, the return strip and its CSS, the bridge, and a `#debug`-only test hook.
- `dev/mirrorview/baseline/`: the unchanged v0.13 HTML, README and TESTING (rollback copy). Also `extract_mirrorview.py`, `inspection.json` and `tests/`.
- `mirrorview/index.html`: the built page.

**Rollback:** remove `mirrorview/` and the `mvBtn`/`mvClip`/`mvTake` block, or revert the integration commit. Riddim Swap's data is untouched. To publish MirrorView alone again, `dev/mirrorview/baseline/index.html` is the exact v0.13 file.

## Evidence

The tests run in headless Chromium on the local build, served over HTTP. In the test harness only, the MediaPipe CDN requests are answered with copies from npm: the same `@mediapipe/tasks-vision@0.10.18` package, and `pose_landmarker_lite.task` (5,777,746 bytes) from an npm package, because this machine can't reach jsdelivr or Google storage. The shipped app still loads the original URLs. The real clip is your clip 2 (TikTok dancer), first 15 s, re-encoded to VP9/Opus WebM because Chromium has no H.264 decoder. That means MirrorView's MP4/AAC and MOV path wasn't exercised here.

| Test | Result | Notes |
|---|---|---|
| Host still works | Passed | Riddim Swap's own suites: `ui_tracking.js` 23/23, `ui_hits.js` 10/10, `e2e_depth.js` plus `plan_check.js` (beat F 0.99, hits F 1.0, take picture 8 ms, sound 0 ms, no errors). |
| Entry and return | Passed | Header button opens MirrorView 0.13. **‹ Riddim Swap** returns with the project intact (moves, song, tempo). Second round trip also passed. |
| Real clip hand-off | Passed | Opens `c2-15s.webm` (15.03 s, 360×640) through `importFile`; record deleted; address cleaned. |
| Play and seek | Passed | Plays at about 1 s per s; seeks to 9.5 s. MirrorView keeps the reference muted until **Unmute reference audio** (baseline behaviour). |
| Output retention | Passed | Studio/Practice/Worldline, all three display modes, and a portrait→landscape→portrait resize keep the same `<video>` element, source and playhead. |
| Failed replacement | Passed | A corrupt "broken.mp4" shows MirrorView's own error ("Your previous video and cached frames have been kept") and the clip stays. |
| Real pose tracking | Passed | 89/89 frames from 2–6 s got 33 landmarks, nose above ankles, drawn on the dancer (screenshot checked). It took about 240 s in software rendering here, which says nothing about phone speed. |
| Pulse on the clip audio | Passed (accuracy weak) | Analysis completes: 77 onsets, 285 frequency events, tempo 50.7 BPM (alternative 101.3), confidence labelled low. librosa says 129 and Riddim Swap 126.2. |
| Take hand-off | Passed | A take recorded in Riddim Swap opens in MirrorView (15.04 s). |
| Pulse on a Riddim Swap take | **Failed (explained)** | MirrorView refuses to time the audio: "Decoded audio duration does not match its container edits." Riddim Swap's MP4 recorder writes no edit list for the encoder's start padding (Opus here, 6.5 ms). The video still plays with its music. The fix belongs in Riddim Swap's recorder (write `edts/elst`). It wasn't made because the iPhone AAC case can't be verified here. |
| Offline cache | Passed | After visiting both pages, the cache holds Riddim Swap and MirrorView under separate keys, and both open offline. Pose tracking still needs the network the first time (models come from the CDN). |
| Camera | Passed (fake device) | No camera until tapped; then one live stream that survives view, display and rotation changes alongside the reference and playhead. Release on leaving is by page unload (not separately measured). |
| Return strip layout | Passed | MirrorView's top bar is unchanged at 320, 375, 390, 430 and 844×390. At 375 px its own buttons overflow by 3 px; that's the baseline's, not this change. |
| iPhone Safari / installed app | **Not run** | No device here. |
| Real camera permission prompt | **Not run** | A fake device was used. |
| MOV / H.264 / AAC import and MirrorView's MP4 audio path | **Not run** | Chromium can't decode them. |
| Practice count-in, A/B loop, freeze and align, Build with two real Moves | **Not run** in this integration | These are baseline code paths and weren't touched. |
| Import/export of Pulse, take and Build JSON on the phone (Files) | **Not run** | |

## Stage 2: one app, one look, the dance body (Oct 2026)

### What changed

- **Shared look ("Sound System").** Both apps use one palette: a dark stage, blue for the dancer, amber for the music and magenta for the hips. The fonts are Figtree for text, Bricolage Grotesque for headings and JetBrains Mono for numbers.
  - Riddim Swap's colours are its CSS variables, overridden in `patch_depth.py`.
  - MirrorView hard-codes about 470 colours, so `mv_theme_block.py` translates them by rule and keeps each colour's lightness: greys become the shared neutrals, mint/green becomes blue, orange becomes amber, and a few colours are mapped exactly.
- **Shared bottom bar.** On phones, Riddim Swap's tabs move to a bottom bar: Clip, Song, Tempo, Moves, Routine and **Body**. Body opens MirrorView with the current clip and its body tracking. MirrorView shows the same bar with Body active, and tapping another section returns to that Riddim Swap tab (localStorage `rs-tab-req`). The bar hides in Practice and stand-back mode. On phones the header MirrorView button is gone, replaced by the Body tab.
- **Dance body.** The tracker landed on the body; the trouble was how the skeleton was timed and drawn. There are two parts:
  - *Tracking* (`body.js`, shared): MediaPipe tasks-vision **0.10.18** (MirrorView's pinned runtime) with `pose_landmarker_full`, run in IMAGE mode on **every frame**. It steps through the clip frame by frame (seek, wait for that frame, track), so slow phones can't skip frames. Each sample keeps its frame's media time, and drawing uses the pose for the exact frame on screen. Smoothing is light and centred (0.2·0.6·0.2), so it adds no lag, and it's skipped across jumps. Tracking is stored per clip in IndexedDB (`body:<media key>`) and survives media clean-up.
  - *Drawing*: a torso shape; a pelvis shape that narrows when the dancer turns side-on and tilts with the hips; thick limbs scaled to torso size; the head; the hips' path relative to the chest over the last second, drawn at twice its real size so a whine reads as a loop; and dotted foot trails. Riddim Swap draws it on the stage. MirrorView's one skeleton function (`skeleton2D`) draws it for the main figure, while faint after-images and dashed guides keep the thin original.
- **One tracker, one beat engine.**
  - **Tracker:** the Body tab hands Riddim Swap's every-frame tracking to MirrorView, which loads it as its reference poses (no second tracking). MirrorView's own preparation now samples 30 poses a second in every profile (it was 24).
  - **Beat engine:** Pulse keeps MirrorView's audio extraction, timeline mapping, onsets and frequency events. Its tempo and beat position now come from Riddim Swap's `analysis.js`. The two decodes are lined up by cross-correlating low-frequency energy rather than assuming the decoders start together (`mv_pulse_block.py`).
- **Hits from the body.** After body tracking, hits come from stops and turns of the hips, feet and hands (`RA.analyzePose`). The image-motion hits are kept as a fallback, and hits you marked yourself are kept. The Fewer/Normal/More merging applies to both.

### Evidence (headless Chromium; CDN requests answered with test copies as before; your clip 2, first 15 s, VP9/Opus)

| Test | Result | Notes |
|---|---|---|
| Model choice, on 10 s of clip 2 at 30 fps, against the heavy model | Measured | Hip error lite 0.027 / full 0.033 torso lengths; wrists lite 0.078 / full 0.046; ankles lite 0.057 / full 0.044. Hip-sway correlation 0.98–0.99 for all settings. The full model was picked for its limbs; for hips, the settings differ by about 3% of torso length. |
| Body tracked on every frame | Passed | 308 of 308 tracked frames have a body. The clip has 312 real frames (23.4 fps, variable). Median gap 43 ms, largest 86 ms. 143 ms a frame on the test machine's CPU (not phone speed). |
| Pose drawn is the frame on screen | Passed | Nearest stored sample within 20 ms of the playhead. |
| Dance body drawn (blue body, magenta pelvis and path) | Passed | Pixel check plus screenshots against the design. |
| Hits from the body | Passed | 19 raw hits on clip 2, then merged per move. |
| Body tracking kept after reload | Passed | |
| Body tab → MirrorView uses the same tracking | Passed | 308/308 poses loaded; the reference pose is shown with no second tracking. |
| MirrorView bottom bar → Riddim Swap Routine tab | Passed | |
| Pulse beat grid on a song with known beats (dembow 100) | Passed | Shared engine: 99.5 BPM, every beat within 70 ms, median offset 19 ms, alignment correlation 0.98. MirrorView's own estimate on the same audio: 50 BPM, no beats within 70 ms. |
| Pulse on clip 2's song | Improved | 126.2 BPM (librosa 129). MirrorView alone read 50.7. |
| Riddim Swap suites | Passed | `ui_tracking` 23/23, `ui_hits` 10/10, end-to-end (beat F 0.99, hits F 1.0, recording sound 0 ms). The take-picture check measured 36 ms on one run and 8 ms on a rerun. |
| Camera, offline cache, hand-off, failed replacement | Passed | As in stage 1. |
| Pulse on a Riddim Swap take | Still failing | The recorder still writes no MP4 edit list (stage 1 gap). |
| Body tracking accuracy on real dance | **Not verified** | No hand-labelled poses. The full model agrees with the heavy model to a few percent of torso length; that's agreement within one model family, not ground truth. |
| iPhone speed, heat and real camera | **Not run** | |

## Stage 3: clearer controls and a working person cut-out (Oct 2026)

### What changed

- **Quick controls on the video, in both apps.** Big labelled pill buttons sit on the stage, so the main switches aren't buried in settings.
  - Riddim Swap: **Track body** (shows "Tracking 40%" while it works), then **Body**, **Hips** and **Cut out**. With Cut out on, three swatches choose the background: dark, colour or blurred video.
  - MirrorView: **See-through** (a slider for the overlay; 0% is solid, 90% is almost clear), **Body**, **Cut out** and **Mirror**. See-through appears only in Overlay, where it means something. It drives MirrorView's existing Overlay opacity setting, so both stay in step.
  - The Pulse beat card on MirrorView's stage shrinks to just the count, at the top, so it never sits under the controls or the dancer's feet.
- **Person cut-out that works.** Before, MirrorView's cut-out only came from live tracking, which stops once poses are prepared, so on a prepared clip it showed the whole video. Now body tracking also saves a **person mask for every frame** (MediaPipe's segmentation output from the same pass, 120 px wide). The mask is stored with the poses and sent through the Body tab.
  - Riddim Swap draws the cut-out on the stage, under the dance body (`RB.cutout`).
  - MirrorView builds each drawn frame's cut-out from that frame's mask (`preparedCutout`), so it follows playback frame by frame.
  - Opened in MirrorView alone, **Cut out** tracks the clip first (same `body.js`), then cuts out.
- **Get started card.** A new project shows "Let's make a remix" with three numbered steps: add a dance video, add a song, press play. The next step is highlighted, finished steps get a tick, and each step has its own button. The card goes away once all three are done or a routine exists.

### Evidence (headless Chromium, your clip 2, CPU tracking; `mv/tests/cutout_test.js`)

| Test | Result | Notes |
|---|---|---|
| Get started card on a new project | Passed | Step 1 highlighted; steps update after the video is added. |
| Quick controls appear on the video | Passed | "Track body" before tracking; Hips and Cut out after. |
| A person mask for every tracked frame | Passed | 307–309 masks per run, one per pose (the clip has 312 real frames; the exact count varies by a frame or two between headless runs). |
| Cut out removes the background, keeps the dancer | Passed | Background corner brightness 9.7/255 with the dark background; dancer area 69/255. |
| Blurred background option | Passed | Corner brightness 9.7 → 60.4. |
| Body tab sends poses and masks to MirrorView | Passed | Prepared masks are used, with no second tracking. |
| See-through slider changes the overlay | Passed | 60% see-through → overlay opacity 0.40, and the Settings slider shows the same value. |
| MirrorView cut-out from the prepared masks | Passed | The cut-out frame is within 20 ms of the playhead when paused, and within 36 ms during playback. |
| Mirror button | Passed | |
| MirrorView alone: Cut out tracks, then cuts out | Passed | |
| Page errors | Passed | None in either app. |
| Earlier suites after this change | Passed, with one rerun | Riddim Swap: `ui_tracking`, `ui_hits` and the end-to-end check passed (recording sound ±0 ms). MirrorView: body, Body tab, bottom bar, Pulse (99.5 BPM, F 1.0), camera, offline cache and hand-off all passed. MirrorView's own pose preparation ended early with 0 poses once during the full run on a loaded machine, then passed when rerun alone (91/91 frames). |
| Pulse on a Riddim Swap take | Still failing | Same stage 1 gap (no MP4 edit list). |
| Cut-out edge quality on real phones, hair and loose clothes | **Not verified** | The mask is 120 px wide and softened, so edges are soft rather than exact. |

## Known limits

- **Takes in Pulse:** Pulse can't analyse a Riddim Swap take until the recorder writes MP4 edit lists (see above).
- **Sound starts muted:** MirrorView keeps the reference muted until you unmute it. That's baseline behaviour, kept on purpose.
- **Pose needs the network once:** MediaPipe and its model load from CDNs on first use. They aren't stored offline.
- **Beat engines:** since stage 2, Pulse takes its tempo and beat position from Riddim Swap's engine. MirrorView's own onset and frequency events are still its own.
- **Cut-out edges are soft:** the per-frame mask is 120 px wide, so fine detail (hair, fingers, loose clothes) isn't exact.
- **Tracking takes time:** Cut out and Body need the clip tracked once, frame by frame. That ran at about 140 ms a frame on the test machine's CPU; phone speed is unmeasured.
- **Not in the claude.ai version:** MirrorView exists only in the installed or GitHub Pages app, not in the single-file claude.ai version.
- **Untested on a phone:** physical iPhone behaviour, heat, real pose speed and camera prompts haven't been checked.

## Speed graph (Riddim Swap, Oct 2026)

A curve on the Clip tab that sets how fast the clip plays at each moment, like an editor's speed ramp.

- **How it works.** The curve is speed over the clip's own time, on a log scale from ¼× to 4×, multiplying the clip speed. Points have Bezier handles: tap to add a point, drag to move it (it snaps to 1×), drag a handle to bend the curve (the opposite handle stays opposite), double-tap or **Delete point** to remove one. There are quick shapes too: **Slow-mo here** (a dip at the playhead), **Speed up**, **Slow down** and **Normal**, plus **Undo**. The top strip moves through the clip. Blue ticks are the dance hits; orange ticks are the song's beats where they land with the current curve, so you can see hits and beats line up while you shape it.
- **One time map.** The curve becomes the same source-to-output time map the "Aligned" routine already uses (knots every 1/40 s of clip time; `speed_block.py`). So playback speed, the song sync, recording and the beat-fit line all follow it with no separate code path. The song keeps its own speed. Saved per video in the project.
- **Scope.** Whole-clip view only. In Routine mode the card says to switch to Clip.

| Test (`dev/tests/speed_test.js`, headless Chromium) | Result | Notes |
|---|---|---|
| Card shows, off by default | Passed | |
| Slow-mo here | Passed | 12.0 s clip → 13.05 s, 0.33× at the playhead |
| Time map matches the curve | Passed | Map length equals the integral of 1/speed to 0.1 ms |
| Tap to add, drag a point, drag a handle, undo | Passed | |
| Video speed follows the curve while playing | Passed | 50 samples, 0.33–1.7×, 0.4% median error |
| Song stays in time with the warped clip | Passed | 2 ms median, 10 ms at 90% |
| Recorded take has the curve's length | Passed | 9.26 s take vs 9.24 s curve; recorder's sound check ±0 ms |
| Off returns to normal speed; kept after reload; no page errors | Passed | |
| Earlier suites | Passed | `ui_tracking` 23/23, `ui_hits` 10/10, end-to-end, cut-out 15/15. The plan check scored BAS 0.71 against true beats (0.81 last run); that run found 14 hits instead of 13, and the routine path wasn't changed. |
| Slow sections on a phone | **Not run** | Below about ½× there's no frame blending, so slow-mo shows repeated frames (choppier at ¼×). Speeds are held between 0.2× and 4× overall. |

## Full screen, swipe between modes, smoother motion (Riddim Swap, Oct 2026)

- **Full screen.** A button on the video (top right) fills the screen with the video, the body drawing, play and the scrubber. Tap the video to play or pause; while playing, the controls fade after about 2.5 s and come back on a tap. It uses the browser's full screen where that's allowed (Android, desktop, iPad). Where it isn't (iPhone Safari, inside the Claude app), it fills the window instead, so it also works across routine cuts, which a single native video player couldn't do. The ✕ button or Escape exits.
- **Swipe between modes.** Swipe left or right on a settings page to move between Clip, Song, Tempo, Moves and Routine. The page follows your finger, springs back on a short drag and rubber-bands past Routine. Swipes that start on a slider, segmented control, nudge row, timeline, tray, video chips or the speed graph are left alone, so those controls work as before.
- **Video bar part of the page.** On phones the video bar is flush to the top, with solid background behind the status bar, so nothing scrolls into view above it. A hairline and shadow appear once content is under it. The bottom bar is translucent with a blur.
- **Motion.** Pages slide in from the side they come from. Buttons ease when pressed. The Projects sheet slides up over a blurred backdrop, and new cards fade up. All of this is off with Reduce Motion.

| Test (`dev/tests/motion_test.js`, phone-sized headless Chromium with touch) | Result |
|---|---|
| Swipe left/right moves between modes; a short drag springs back; nothing past Routine | Passed |
| Dragging a slider or scrolling vertically doesn't change mode | Passed |
| Video bar flush at the top after scrolling, nothing visible above it | Passed |
| Full screen fills 390×844 with video, play and scrub; tap plays; controls fade and return; ✕ and Escape exit | Passed |
| Earlier suites | Passed: end-to-end (beat F 0.99, hits F 1.0, sync ±0 ms), `ui_hits` 10/10, speed graph 13/13, `ui_tracking` 23/23 on two reruns. One run failed the "unsure beat never flashes" check once; it passed on both reruns, so it looks like a timing flake in the test. |
| Real iPhone: swipe feel, full screen in Safari and inside the Claude app | **Not run** |
