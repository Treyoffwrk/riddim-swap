# MirrorView 0.13 — Build: arrange captured movement

This update extends the supplied v0.12 application. It introduces an actual single-reference skeleton-sequence editor and player; it does not replace the app with a new demo or publish a website automatically.

## Phone update

Publish **index.html** over the previous file on the same existing HTTPS website. Reopen the published page directly in Safari and check **0.13** beside the logo. No ZIP extraction, computer, terminal or new browser library is required. Downloading the file does not update the website. Keep the same address for access to that origin's recovery data.

The attempted Vercel publication in this session failed: the connected account's team list was empty and its publishing action returned `Tool deploy_to_vercel not found`. No deployment URL or successful deployment was returned. The v0.12 HTML remains the rollback build.

## First Build

1. Load your original reference video. Pulse is optional for ordinary skeleton-sequence playback.
2. Mark A and B around a short Move, or save several named Moves in the existing Move library.
3. Tap **Build** beside Practice on the stage.
4. Use **Prepare A/B skeleton** (or choose a saved Move and prepare it) when its full skeleton range has not already been analysed. Then **Add A/B** or **Add chosen Move**.
5. Add another section. Its pose snapshot is copied into Build, so preparing the next section does not erase earlier captured Moves.
6. Select rows to edit them. Up/down reorder, plus duplicates, and × removes a Move from the sequence. None of these deletes its source bookmark.
7. Set movement duration or movement speed; use **Fit 4 beats / Fit 8 beats** when the Move starts on a Pulse beat and enough subsequent beats exist.
8. Choose **Music on** to hear the original soundtrack, then **Preview & practise**. Entry is paused. Use the existing large Play, Again, Next/Prev, Speed and count-in controls.

Build always uses the reference video's timeline as the soundtrack. It rearranges skeleton motion, not the original video or sound. In particular, a Move sampled from source 6–8 seconds can be placed at soundtrack 0–2 seconds without jumping the song to 6 seconds. The source-to-output mapping is explicit.

### Two different speeds

**Movement speed** in Build changes how long one captured Move takes within the choreography. The song does not change speed.

**Practice Speed** slows or accelerates the whole preview together: original video/audio clock, all sequenced skeletons and Pulse counts. Browser pitch-preservation behaviour remains the existing implementation.

## Frequency-aware timing

The Sequence start and the selected Move's target end can snap to the existing MusicAnchors. Choose Beat, Subdivision, Accent, Low accent, Mid accent, High accent or Free. Enter a nearby timestamp; the magnet is limited to 120 ms and preserves the event's numeric time rather than quantising it to a video frame.

An end-time edit changes that Move's duration (and therefore its skeleton speed). Later Moves follow it contiguously. A sequence-start edit shifts the arrangement. Pulse facts, source poses and authored Pulse movement markers do not move.

Bindings retain the anchor ID, source and timestamp. Later Pulse changes or sequence reordering can make a binding stale; Build reports that status instead of silently changing choreography. Four/eight-beat fitting uses actual available beat timestamps, not merely a BPM multiplication. It requires a beat-aligned start.

## Preview and state ownership

The existing Practice controller gains a real **Build** presentation. It supplies the same stage, safe containment, portrait/landscape reflow, large count, count-in, progress, looping, wake handling and centralised commands.

The original reference `HTMLVideoElement.currentTime` remains the authoritative clock. The sequence renderer maps that time into a captured source Move and samples its poses. It never starts a second soundtrack timer or seeks the video on every Move boundary. Build preview does not acquire a camera or run new pose inference. Existing source/camera nodes, cached analysis, editor A/B and frozen take are retained. An explicit preview/Next/Again command does move the playhead.

Previous/Next jump within the sequence without replacing the editor's original A/B. Repeat is constrained to the sequence's available soundtrack interval, including when the user selects Whole playback. Missing detections remain missing; there is no interpolation across separate Moves or long detection gaps.

## Save and restore

**Save Build** creates `MirrorView-Build.json`: sequence name, source-reference identity, captured pose snapshots, source ranges, output durations, mirror/aspect metadata and music-anchor bindings. It contains no video bytes, PCM/audio recording, microphone data, tokens or accounts. The skeleton coordinates and your labels are still project data; share deliberately.

**Restore Build** requires the same original reference metadata and matching duration. It validates the file before showing a confirmation. Applying it stays paused and leaves the reference, camera, Pulse project and source bookmarks intact. **Undo last edit** retains one in-memory prior Build, not unlimited history.

When existing session recovery is enabled, non-demo Build edits are written to one additional `build` record in the existing IndexedDB store. Explicit Resume restores that record; it does not start playback, camera or processing. Recovery can fail or be cleared. Export important Builds as well, and keep the original reference video. Build JSON and Pulse project JSON are separate backups in this version. Real-origin storage and iPhone Files delivery remain unverified here.

If a different reference is loaded during the session, the existing Build remains associated with its original source rather than being silently retargeted. Reopen the matching reference or export it before deliberately starting a new Build. Only one Build is actively edited at a time.

## Bounded first release

- One reference asset is the source and soundtrack. This is not yet a multi-video library/editor.
- Up to 12 Moves; each source section 0.1–20 seconds; 620 cached samples per Move and 7,440 in total.
- Target arrangement must fit within the reference and its first 120 seconds. Move duration is 0.1–40 seconds, with source-to-target speed between 0.25× and 2×.
- JSON imports/exports are capped at 16 MiB.
- Cuts, not automatic pose-matched transitions. There is no avatar/body mesh, joint retargeting, learned transition synthesis, foot-contact correction or 3D room reconstruction.
- Reordered source poses may jump spatially at a cut. The preview displays that honestly. Seamless physical transitions are a later feature, not something manufactured by smoothing.
- No new video/audio export button for the finished choreography in this slice. Build export is structured skeleton/timing data. Existing stage-recording code has the new render branch but was not revalidated as a complete recording workflow in this release.

The earlier audio extraction, frame-matched reference preparation, glass controls and scrolling code remain. There is no new runtime SDK/CDN/model dependency. `TESTING.md` records exactly what was exercised, not a blanket claim that all historical features or real Safari hardware have been tested.

## Source

`BUILD.json` defines ordered JavaScript fragments. `build.py` combines them into one deployable HTML, retaining the earlier viewport/scroll script and styles. Publish **index.html only**, not this source/test directory.

```sh
python3 build.py
node --check app.bundle.js
node --test tests/sequence.test.mjs
python3 tests/browser.py
```

Browser tests use Python Playwright and `/usr/bin/chromium`. Those are development dependencies only. The bundled media fixture is generated test music with a test pattern, not the user's screen recording.
