# MirrorView 0.13 — verification record

## Completed on the final bundle

**36 unit tests and 35 grouped browser checks passed.** Counts are this release's targeted suites, not added totals from older releases. `node --check app.bundle.js` also succeeded.

Reports: `docs/sequence-tests.tap`, `docs/browser-tests.json`, `docs/browser.log`.

## Real browser operations

The unmodified production HTML was loaded with Playwright `set_content` in headless Chromium. Tests imported an actual local MP4/AAC file and exercised the current native audio extraction/decoding and production Pulse DSP worker. The richer generated 15-second fixture was correctly estimated at 124 BPM. A real high-frequency event produced by that analysis became a Build endpoint binding without rounding to a frame.

The source video's actual playback/currentTime, mute/pause, rate, seeks and loop boundary were used. There was no fake audio player or generated fake Pulse result. The browser tested additions from A/B and saved bookmarks, up/down reordering, duplicate/remove, fit-to-beats, custom duration, frame mapping, start placement, preserve-original A/B, the shared Practice shell, Next, looping, and non-reacquired source/camera object identities.

Export produced a real JSON Blob; the test inspected its contents through a test save callback. Restore used the actual file input and File.text/JSON validation/confirmation path. This does not certify a Safari Files download. Wrong-reference input left the current Build unchanged.

Native CDP touch input scrolled the Build dialog. Dialog bounds were checked at 320×568, 375×500, 390×760, 844×390 and 1024×600 CSS pixels. Four Practice viewports retained the same video, URL, camera fixture stream, pose cache and Pulse analysis. Unchanged main/reference Pulse was reopened after Build. No uncaught JS errors occurred in the final exercised flow.

## Synthetic or unverified components

The cached skeleton is explicitly generated test data, not actual MediaPipe inference. The camera is a canvas-generated MediaStream attached by the test fixture, not a physical webcam or real getUserMedia permission exercise. No physical iPhone, real Safari, camera acquisition, pose accuracy/FPS, on-device heat, acoustic output, Bluetooth delay, native keyboard or distance readability was measured.

Local HTTP navigation was attempted and returned `ERR_BLOCKED_BY_ADMINISTRATOR`. No policy was changed or bypassed. The agent-browser CLI is not installed; verification used Python Playwright. Real IndexedDB/host-origin persistence, quota and restore-after-browser-restart remain unverified. This test does not use a durable storage substitute to claim success; local recovery writes can fail in the test origin. Explicit JSON transfer was exercised separately.

Sequence frame mapping and snap math are real production code over synthetic poses. There is no inference that this validates choreography quality or body mechanics. Browser resizing is not a physical iPhone rotation test.

The new Prepare skeleton adapter calls the existing v0.12 preparation path. Actual model download/inference, the earlier detailed PCM/ALAC matrix, all original Worldline variants, full linked-take workflows and actual stage-recording export were not rerun in this targeted suite. Their source remains, except for the documented Build integration branches.

## Unit coverage

Snapshot independence; source/target map; multiple/reordered sections; per-Move speed; sequence origin; hard-cut boundary; native fractional timestamp tolerance; no endpoint hold; missing observations; long detection gaps; incomplete/empty skeleton refusal; range and frame-count limits; immutable/atomic edits; reference/duration mismatch; duplicate ID rejection; schema whitelisting; nonfinite coordinates; unordered timestamps; exact beat and high-frequency binding; band filtering; Free mode; finite snap tolerance; stale bindings without moving music; JSON roundtrip; sample-time preservation after an end edit.

## Publishing status

The live connected `Vercel.list_teams` returned no teams. `Vercel.deploy_to_vercel` returned JSON-RPC -32602: `Tool deploy_to_vercel not found`. No READY deployment or URL exists from this attempt. Only the local release files were created.

## Phone acceptance

Update the existing HTML and check 0.13. Prepare two short real Moves, add them to Build, reverse their order and preview with music. Pause on the cut and confirm the chosen next source section appears while the soundtrack stays continuous. Repeat the sequence, slow Practice, rotate and exit. Confirm original reference, A/B, camera and Pulse remain. Save Build to Files, make one change, restore the JSON with the same original reference, then test Undo. Confirm optional local recovery separately and retain the v0.12 rollback copy.
