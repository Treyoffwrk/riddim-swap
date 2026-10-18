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

## Known limits

- **Takes in Pulse:** Pulse can't analyse a Riddim Swap take until the recorder writes MP4 edit lists (see above).
- **Sound starts muted:** MirrorView keeps the reference muted until you unmute it. That's baseline behaviour, kept on purpose.
- **Pose needs the network once:** MediaPipe and its model load from CDNs on first use. They aren't stored offline.
- **Two beat engines:** they can disagree on the same song, as above. Nothing is merged yet.
- **Not in the claude.ai version:** MirrorView exists only in the installed or GitHub Pages app, not in the single-file claude.ai version.
- **Untested on a phone:** physical iPhone behaviour, heat, real pose speed and camera prompts haven't been checked.
