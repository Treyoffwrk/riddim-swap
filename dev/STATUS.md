# Riddim Swap + MirrorView: status, architecture and testing

_Last updated 9 Nov 2026 · version rs-21ab89be14 · repo Treyoffwrk/riddim-swap_

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
- **Tracking that doesn't give up** (1 Nov, after a phone run froze at 80% on a 32 s clip with RTMPose, ~3 min for the clip):
  - *Cause found in code:* a seek that never answers (the iPhone video stops decoding: no frame callback, no 'seeked') left the tracker waiting forever; nothing timed out, so the progress bar stood still with no error. Leaving the app or the screen locking also stops tracking on iPhone.
  - *Now:* every seek gives up after 4 s; two in a row and the video is loaded afresh in a new player (up to 4 times in a row); RTMPose not answering for 30 s (on-screen time) stops the run. Going to the background pauses tracking and saves progress; it carries on when you come back. The screen is kept on while tracking (Wake Lock).
  - *Progress is kept:* finished frames are saved every 8 s, on going to the background and when tracking stops (media store `bodypart:<clip key>` header plus `#0…` pieces; counted under tracking in Storage). If it gets stuck it starts itself again from where it was (twice, message "got stuck at X%. Starting it again from there…"); if it still stops, or the app was closed / iOS reloaded it, the Body card offers **Carry on tracking** (and **Start over**) and picks up from that frame. The finished skeleton is the same as an uninterrupted run. Kept progress only applies with the same tracker and chosen dancer.
  - Test: tests/track_resume_test.js (frozen video revived; stuck for good → auto restart → Carry on; reload part-way → Carry on; background pause; wake lock; Start over).
- **Beat clock (trial) and the speed graph's cog** (9 Nov, user: "add this as a test speed adjuster alongside speed graph … add cogs for the speed graph ui to add a new feel to the graphs functionality and for user comfortability"):
  - *Beat clock* (Clip → More options, under the speed graph; marked Trial): one 8-count of the song as a circle, the 1 at the top, the counts round the rim. The clip between where that 8-count starts and ends is split into parts (2, 4 or 8; default 4, on the counts) shown as slices with their speed (blue slower, orange faster). Drag a handle round the rim: that dance moment moves to another count (snaps to counts and "and"s with Snap on), the slice made bigger plays slower and its neighbour faster. ◀ ▶ move between the clip's 8-counts (it follows the playhead while playing); tap a slice to go to it; Back to the beat; Undo (shared with the graph). Off in a routine and, for now, on clips with parts cut out (it says why).
  - *How it writes the graph:* the curve is split exactly at the 8-count's two ends (de Casteljau, neighbours frozen), so the curve outside is untouched; the points inside are replaced by a flat stretch per part (two points, flat handles, easing into the next across the cut); each part's speed is solved through playback's own time map (`curveKnots` / `toOut`) so it takes exactly its share. The ends stay where they were in the clip and in the song, so nothing before or after moves. Past ¼×–4× it stops where it can and says "That's as far as it goes". Cuts are saved with the curve (`curve.clk`, keyed by the 8-count's clip start and number of parts). Source: `src/app.js`, `/* beat clock (trial) */` (state `BCLK`; `CLK` is the click scheduler in cues.js).
  - *Cog:* the selected point's panel has a cog dial. **Speed**: clockwise is faster, one turn doubles the speed, it clicks onto ½× ¾× 1× 1¼× 1½× 2× with Snap (with a short vibration where the phone supports it); **Curve**: tilts the curve through the point (its handles), clockwise slopes it down. One undo step per turn; arrow keys turn it by 5% / 5°. The graph's points are drawn as little cogs that turn with their speed.
  - *Fixed while testing:* the cog row made the speed card wider when a point was selected, so the graph changed width under the finger mid-drag (spd_ui_test caught it: 2 failures); the card's children can no longer widen it.
  - Test: tests/clock_test.js (18 checks with real pointer drags: song locked, measured by playback's own sum before and after: no change at the ends or outside; the moved moment lands on count 3 within 1 ms; a flat stretch per part; undo; the 4× limit; Back to the beat; editing the next 8-count leaves the first unchanged; 8 parts; tap a slice; cog quarter turn = 1.19×, snaps back to 1×, arrow +5%, Curve tilts; cogs drawn; off in a routine): 18/18.
  - Not tried on a phone: handle size for a thumb (22 px touch radius), and how the clock feels on a long clip with many 8-counts.
- **Speed graph editing refined** (9 Nov, user: "refine speed curve UI. It's functional but it takes a few tries to get it in the position needed"):
  - *Grabbing:* a point no longer jumps under your finger: it keeps the gap it had when grabbed and moves by exactly how far the finger moves, after 6 px of slack (so selecting it doesn't nudge it). Points are easier to grab (30 px reach, preferred over adding).
  - *Adding:* a tap on empty graph adds a point when the finger lifts without moving; a drag over empty space adds nothing (it used to add a point on touch-down, so near-misses made stray points). Double-tap delete removed (it fired on repeated attempts to grab); Delete point stays.
  - *Snap* (button, on by default, kept): while dragging, a point snaps to a dance hit or a song beat (where it lands with this curve) within 12 px, and to the nearest of ½× ¾× 1× 1¼× 1½× 2× within 8 px; dashed guides show what it snapped to.
  - *Readout while dragging:* "0:05.90 · 0.50× · on beat" in a label above the point, clear of the finger.
  - *Selected point:* "Point 2 of 5: 0:05.90 · 0.50×" with ◀ ▶ (a frame earlier/later), −5% +5%, and To beat (onto the nearest beat or hit).
  - *Zoom:* − / + (1× to 16×) or two fingers; the view centres on the selected point (or the playhead) and follows playback. At 4× the same finger movement moves a point 4× less. Time labels get finer when zoomed (down to 0.25 s). The graph is a little taller (230 px).
  - Test: tests/spd_ui_test.js (real touch on a 402×874 phone screen: tap adds one, drag over empty adds none; grabbed 14 px off centre it moves by the finger's movement; tap selects without moving + readout; snap to a hit and 1.5×; Snap off moves freely; ◀▶, +5%, To beat; zoom 4× around the point; finer movement when zoomed): 9/9. speed_test 13 and swipe 13 still pass.
- **Move both starts** (9 Nov, user with a screen recording of a clip with a speed graph: "a feature with clip and song which can simultaneously bring the song back a few seconds while also bringing the clip start back … to keep the moves aligned"):
  - Clip tab, under "Clip starts at": **Move both starts** −2s −1s −½s +½s +1s +2s, with "clip 0:03.0 · song 0:00.0" above. The dance starts that much earlier or later and the song's start moves by exactly the music that stretch takes, so every later moment keeps its place in the song: through the speed graph (a slowed stretch moves the song by less, a sped-up one by more), cut parts, and the clip and song speeds. Worked out by keeping the song's place at a moment both versions share.
  - Routine tab, under the routine's "Song starts at": the same buttons move the routine's first move start and the routine's song start; an aligned first move keeps its alignment (its warp is extended at the move's speed, or trimmed).
  - Limits: the song can't start before 0:00 nor the clip before its own start, so it moves as far as it can and says so ("as far as it goes: the song starts there").
  - *Speed graph kept in place* (user, 9 Nov: "preserve speed graph position where features have sped up and been moved to fit the beat"): the graph's points are stored at moments of the clip, not relative to its start, and Move both starts never touches them: every point, the speed at every moment after the old start and its place in the song stay exactly as they were. The new lead-in plays at the speed the graph had at the old start (continuous, no added point, since an added point would reshape the neighbouring curve). Moving later past points keeps them (moving back restores the graph exactly). The message says so when the clip has a graph.
  - Test: tests/both_test.js (plain clip −2, −2 limited by the song start, +1; with a speed graph; a graph fitted with 6 points: −1s keeps every point, every later speed and song position, the lead-in has no speed jump, +2s past two points then −1s back is exactly as before; a routine; a routine with an aligned first move): 10/10.
- **Learn: song in time with the moves** (7 Nov, user: "When the video is played under Learn the music gets out of sync … we need to sync music with the moves so the user can use the music as cues"):
  - *Cause (deterministic):* Study and Learn worked out the song's place as start + clip time ÷ speed, while normal playback goes through the clip's kept parts and its speed graph. On a clip with a part cut out (like the user's 32 s clip with parts off), the song was off by the length of the cut parts before that point, all through Learn; the 8-counts were also split from that wrong mapping, so Learn taught the cut part and its counts didn't start on the music's 1. With a speed graph the slowed stretch ignored the graph. Now Study and Learn (and Learn's 8-count split) use the same clip↔song mapping as normal playback (`clipToSong` / `songToClip`), and a slowed stretch follows the speed graph. Live build: song 2.0 s off on a clip with its first 2 s cut; new: 8–12 ms median.
  - *Aligned starts:* every Study/Learn loop and each new speed or 8-count starts with both stopped and in place; the song starts first and the video only when the song is really moving, at the song's spot (a phone's song player takes a moment to sound after a seek; starting both at once, the song came in late each loop and was pulled back with jumps). With a song player that starts 350 ms late: song jumps 6 → 0 in 30 s, the video never plays without its music (was 200 ms), worst gap after a loop start 85 → 51 ms. The phone check's Sound line now says how long the song took to start at Study/Learn starts.
  - Not measured on a phone. If it still drifts there, a screen recording of Learn with sound shows exactly how far, since the recordings carry the app's audio.
  - Test: tests/learn_sync_test.js (slow-starting song player through 30 s of Learn; clip with a part cut): 5/5, twice; the live build fails 2 of them.
- **Save video, progress, voice** (6 Nov, user: "Deploy next updates"; items 1, 2 and 4 of the missing-features list):
  - *Save video* (Practice results card): records the last run like a take: the clip plays once from the start with the dancer and skeleton on the left (mirrored if the clip is), your camera recording from that run on the right (as you saw yourself), each move's result ("HIT 96%", "Fix: right arm too low") under you as it happens, "7/8 hits · Riddim Swap" in the corner, and the song. Your recording is kept in time with the clip from the run's own timing (where the clip was at each moment it recorded), nudging its speed and jumping only if 0.25 s off. 960 px high (1080×960 for a portrait clip), same encoders as takes; without the camera recording it draws your skeleton. The take card then has Save (share sheet → Save Video on iPhone).
  - *Progress:* every kept run is logged for its clip (score, hits, time; last 200, `rs-runs:<clip>`), and the days you practised (`rs-days`). The results card shows the last 12 runs as bars and "Best 92% · 7 runs (3 today) · +14% since your first · 4-day streak", or "New best!".
  - *Voice* (chip, on by default): says the countdown ("3, 2, 1, Go") and after a Close or Miss the main fix ("right arm too low"), at most once every 2.5 s; quiet during replays and while saving a video. Uses the phone's speech voice (en-GB); the first word is said inside the Play tap.
  - Test: tests/run_extras_test.js (spoken countdown, spoken fix, first run logged with a 2-day streak, a better run says New best with 2 bars, Save video: 1080×960, the clip's length with the song, left half matches the clip, right half has a picture): 6/6. Not tried on a phone: the save time, the speech voice, and how well the phone's camera recording keeps time.
- **Dragging the play bar while playing** (6 Nov, user's screen recording on rs-44ac7e92b3: "when I drag back the slider while the video is playing it doesn't play from where I've dragged"; they dragged from 0:12.8 back to 0:07.1 and it jumped to 0:21, then 0:25):
  - Cause: on a clip with a part cut out (or a routine) a seek only moved the song if it was off by more than 0.4 s once settled, and the steady sync moves the VIDEO to the song when they're far apart (so a busy phone doesn't make the song cut out). Dragging the bar was treated the same as the app's own catch-up seek: the song stayed where it was and pulled the video back to it. On a plain clip it worked. Reproduced with tests/scrub_test.js on rs-44ac7e92b3 (plain clip passed; cut clip: dragged back to 2 s, it went 2.4 → 4.6, drift 1.6 s).
  - Fix: dragging the bar is marked as your move (pointer down → up, and each input). While you drag, the sync never pulls the video to the song; when the seek lands (and when you let go) the song is moved to the video. The app's own catch-up seeks and part changes are unchanged.
  - Test: tests/scrub_test.js (plain clip and clip with a part cut out, back and forward while playing; song drift under 0.15 s): 6/6, twice.
- **Layout, song picking, stalled song** (4 Nov, from the user's four screen recordings and phone check on rs-8dbbb4e8cf: "app has been really buggy"; options only reachable by scrolling to the end; the Group options laid over the others; a picked song "wasn't changing"; the scrubber should be right under the video):
  - *Player layout:* the pinned player (sticky at the top) held the video, the Cut out options, the whole Group panel (count, shapes, formation changes, floor plan), the Practice options and the play bar. With Group on it was taller than the screen, so the play bar sat at the bottom and everything under it was hidden behind it. Now only the video and the play bar (scrubber, time, Repeat … Record, the Learn and Snip strips) are pinned; the Practice, Cut out and Group options follow below in the page and scroll normally. The Practice player is a little shorter on phones (50% of the screen height, was 56%).
  - *Picking a song:* the song's name stayed on the old song until the new one was fully read, with only a note far down the Song tab, so it looked as if nothing happened (and picking again restarted the read). The name now changes at once to "Loading <name>…" (pulsing). Decoding has a way out: if the phone's offline decoder hasn't answered in 8 s the live one is tried; at 25 s it gives up and plays the file directly. Not known whether the phone's decoder actually hung; the phone check's Audio line now shows "slow song decode N×" and "song player restarted N×" when they happen.
  - *Times:* 119.97 s read "1:60.0" (rounding after splitting minutes); times are now rounded first ("2:00.0").
  - *Stalled song:* when the song's clock is stuck for 3 s the song player is given a fresh start by itself (once per play) at the video's spot; the "stopped keeping time" note only comes if it is still stuck 3 s later.
  - *Practice targets missing (found while testing):* (1) the key-move list was cached with only the number of clip parts in its key, so if it was worked out before the video's length was known it stayed empty; the key now has the parts' real extents. (2) Hits found from the body are kept with the project (saved every 2.5 s), the skeleton separately: closing or reloading the app within seconds of tracking finishing kept the skeleton but lost the hits, so Practice had no targets. Opening a clip with a skeleton and no hits now finds them again from it (counted in S.hitsRebuilt), and the project is saved as soon as tracking finishes. Seen as an intermittent failure of mirror_coach_test (1 run in 2, then 1 in 7); 0 in the runs after.
  - *Duplicate id:* two elements were both id="cmpRow" (the skeleton Compare row and Compare a try); the second is now cmpTryRow.
  - Tests: tests/layout_song_test.js (Group with the floor plan open, scrolled to the floor plan, Practice Ghost with Cut out; new song shows at once and replaces the old; 2:00.0). tests/stuck_song_test.js now 6 checks (restarts by itself once; a stall that a restart clears lines up with no tap and no message).
- **Mirror the clip, what to fix, hands-free practice** (4 Nov; the user asked "what features are missing, and do any big fixes"; Reverse now takes ~5 s on their phone):
  - *Mirror the clip:* a round button on the video (beside full screen) flips the clip left↔right, as if the dancer were your reflection. The skeleton, cut-out and Group copies are drawn flipped with it; the hip meter stays readable (its readings flipped to match what's seen) and the tilt degrees read the right way. Tapping a dancer to follow works on the flipped picture. Kept for every clip (`rs-mirror`). Until now only your camera could be mirrored, not the dancer.
  - *What to fix:* each key move remembers which body parts pointed more than 40° away from the dancer's at your best moment (left/right arm, left/right leg, shoulders, hips; named from your side) and how (too high, too low, wrong angle, not level). After a Close or Miss the flash says "Fix: right arm too low"; each move card in the results names the part; the results say "Work on: your right arm (off in N moves)" when one part was off in 2+ moves. A move with any part 60°+ off is Close, not Hit, however good the rest (one arm completely wrong used to score ~80% and count as a Hit).
  - *Countdown:* in Practice with the camera on, Play counts down 3 s (or 5 s, or off) with a big number on the camera, so you can step back; a tap cancels it. Go again uses it too. The song is primed inside the tap so it can start when the count ends.
  - *Hands up to play / pause:* both wrists above your head for 0.6 s starts (with the countdown); held 1.2 s while playing pauses (longer, so a move with both arms up doesn't stop it). Your hands must come down before it works again; a ring fills while you hold. Off in Step mode's waits (the held pose decides there). Option chip "Hands up to play" (on by default).
  - *Layout fix:* the Practice options are one row that scrolls sideways. Wrapped onto three rows they pushed the play bar under the bottom tabs on a phone (in Ghost it was already 11 px under before these chips).
  - *Erase everything test:* its long-standing failure was the test, not the app: Erase deletes the caches, then the reloaded app makes fresh ones. The test now checks that what was in the caches before is gone.
  - Test: tests/mirror_coach_test.js (12 checks: button, flip, skeleton flipped, kept after reopening, part detection, countdown, cancel, live "Fix:", results "Work on", hands up start/pause, turn off, no errors). practice_test.js and step_run_test.js turn the countdown and hands-up off (they test other things).
- **Reverse** (3 Nov; the user asked for the reverse, the dance technique of doing a move then running it backwards in one fluid motion): Clip → Cut the clip → pick a part (Split at its start and end, tap it) → **Reverse**.
  - A new copy of the clip is made on the phone: the part plays, then the same part backwards straight after it, then the rest of the clip, moved along. The original stays in the videos list. The strip marks the reversed part in pink (⇆ REVERSE).
  - The skeleton comes across without tracking again: every per-frame store (points, 3D, hips, fingers, cut-out masks) is reordered (RB.remapTrack in body.js). Hits are moved too, and the reversed part gets its own. So Ghost, Step mode, Worldline, Learn and the rest work on the reverse straight away.
  - Trim, cuts and the speed graph carry over, shifted past the reverse.
  - How: the clip plays once, hidden. Each frame is encoded to MP4 with WebCodecs (H.264 on phones, at most 1280 px), written at a steady 30 fps (a frame the phone skips repeats the one before). The part's frames are also kept as JPEGs and encoded in reverse order when the playback reaches the part's end. If frames are being dropped, the hidden playback slows down.
  - Limits: parts from 0.2 s to 12 s. Making it takes about as long as the clip, longer on a slow phone. The copy has no sound of its own (the song plays over it). It needs WebCodecs (iOS 16.4 or newer); otherwise it says so.
  - Test: tests/reverse_test.js (9 checks). Frames read back with ffmpeg match the original at the expected moments: before the part, the part backwards, and the rest moved along. In the headless browser it took ~95 s for a 15 s clip (software encoding); not yet timed on a phone.
  - Faster + strip fix (3 Nov, after the user's iPhone screen recording: "wait time is slightly long"; the Cut the clip strip "distorts"):
    - Speed: the hidden playback starts at 2× and speeds up to 4× while pictures keep coming at least every 1/30 s; it slows down when they don't (and stops slowing once slowing doesn't help). Frames of the part the fast playback skipped are then fetched one by one (seek), so the reversed part has every frame. Not yet timed on a phone; in the headless browser (software VP9) it is still ~90–130 s for a 15 s clip because the encoder is the limit there.
    - Strip: in the recording, the new copy's strip first spanned ~4.5 s and grew to the full ~37 s during playback (iPhone reported a short length that grew), so pictures were squashed/stretched and the end had none. Now the copy stores its exact length (kd, saved with the project) and uses it; every clip also follows durationchange; thumbnails fill in when the length grows (keeping the ones made). Thumbnails are now 144 px tall (were 72), so they're sharp on a 3× phone screen.
    - reverse_test.js now 10 checks (adds: real length, pictures to the end, 144 px). tests/rev_speed_probe.js (encoder stubbed) shows the playback ramps to 2× in headless.
- **Step mode, run results and replay, Group formations** (2 Nov evening; the user picked these three as the next updates):
  - *Step mode* (Body → Ghost → Step mode, with Hit targets on): the clip stops on each key move and waits. Hold the amber pose (a Hit, 75%+, for 0.4 s) and it plays on by itself; tap play to skip a move. A meter at the top shows how close you are. Test (fake camera doing the dancer's moves): stopped at each key move within 0.06 s, all 8 moves Hit (86–100%); with a pose that doesn't match it waited until play was tapped.
  - *Run results:* when a pass ends (the clip ends or loops back), it stops on a results card over the player: average score, Hit/Close/Miss counts, and a card per key move with its score. Tap a move to go to just before it; Go again starts the next pass.
  - *Replay me:* your camera is recorded during each Ghost pass (MediaRecorder, about 1.5 Mbit/s, up to 4 min, kept only in memory, never saved or uploaded) with your pose at each moment. Replay plays the clip from the start with your recording in the camera pane and your skeleton on it, matched to clip time (in Step mode the replay shows the pose you held). No scoring or Step stops during a replay; Back to live ends it. If the phone can't record video, the replay shows your skeleton only.
  - *My last run in Worldline:* your last run's poses are drawn in green on the dancer's poses through time (hips on hips, same size), past solid and next dashed; the My last run button turns it off.
  - *Group formations:* shapes Line, V, Two rows (back row in the gaps), Wedge, Circle. The Floor plan shows the stage from above (audience at the bottom); drag a dancer to move them (snaps to quarter spacings). Dancers further back are drawn smaller, higher and fainter. Change here adds a formation change on the beat nearest to now (the next shape along, to start from); dancers walk to their new spots over the 2 beats from the change. Changes show as a list (the one playing marked; tap to go there; × removes). Save this shape keeps a shape for every clip. Formations are kept per clip on the phone. The room check and touching lines now count only dancers side by side in the same row; the verdict adds how deep the group is.
  - *Tests:* tests/step_run_test.js (12 checks), tests/formation_test.js (12 checks).
  - *Not yet checked on a phone:* whether iPhone allows play() to resume the song after a Step-mode hold without a tap, MediaRecorder video on iPhone (mp4 tried first), and the floor plan drag on a small screen.
- **Ghost like Just Dance; Worldline in the player** (2 Nov, stage 3; the user found 1.2 s of warning too little and said the hits are fast, unlike Just Dance's slower moves):
  - *Key moves:* by default only the strongest hit in each 2 beats (at least 0.9 s apart) is a target (e.g. 8 of 13 on the test clip); "All hits" brings every hit back.
  - *Move cards:* along the bottom of Ghost, the next moves slide towards a "now" line as small pictures of the pose (hands/feet that make it marked), a few seconds ahead; each card takes its result colour and label (HIT/CLOSE/MISS) as it passes.
  - *Warning:* 1 beat, 2 beats (default) or 1 bar, from the song's beat (was a fixed 1.2 s); the shaded part of the card track is the warning zone, where the move is also drawn on you.
  - *Worldline* (third view in Practice, no camera needed): the dancer through time in 3D from the existing tracking (no Build): poses every 0.2 s from 1.6 s back (solid) to 0.8 s ahead (dashed), now bright, key moves amber, hand (blue) and foot (pink) trails, the frame's outline at each moment, a floor grid. Drag to turn, pinch/scroll to zoom, double-tap or Reset view. "Add my camera" puts your live pose on the now pose (hips on hips).
  - Test: tests/practice_test.js now 18 checks (key moves, cards, warning setting, Worldline shows without camera, turns, moves with the clip).
- **Body moves into the player: Practice with your camera, Ghost with hit targets** (2 Nov; the user's recording showed Body opening as a separate page with its own look and the clip reset; they chose "move into the main app"; stage 1 and 2 of 3):
  - *Body tab* now turns on Practice in the main player instead of opening the separate page (MirrorView stays, reached by "Worldline and more: open in Body ↗" under the practice controls, and the Clip tab's Body button). Because it's the same player, every edit carries over: trim, cuts, speed and speed graph, song and timing, cut-out, Upper/Legs, Group.
  - *Side by side:* the clip on the left half of a taller player, your camera (front, mirrored by default) on the right with your skeleton. *Ghost:* your camera fills the player, the dancer's skeleton is laid over you (their hips on your hips, their torso your length; smoothed), the clip small in the corner (no hip readout there).
  - *Hit targets (Ghost):* the next hit appears 1.2 s ahead as the pose to be in (dashed amber), with rings shrinking onto the hand/foot that moves most into it; on the hit (0.12 s before to 0.25 s after) your best match counts. Score = limb directions compared (10 limbs, 0-100; position and size don't matter): Hit ≥75, Close ≥55, else Miss; "Not seen" if you're out of frame. Each pass through the clip is tallied ("This pass: 5 hits, 1 close of 8"). Options: Mirror me, My skeleton, Hit targets, Flip ghost (same side as the dancer).
  - *Camera:* only from a tap; off on Stop, when Practice is turned off, and whenever the app is hidden. Live pose: RB.live() (a VIDEO-mode landmarker, one person, no masks; the tracking one stays free).
  - *Measured (browser, fake camera playing a dance clip):* a camera dancer doing the dancer's exact moves scored 6/6 Hits (89-100); the same dancer out of time scored 30-59 (Miss). Not yet checked on a phone: camera speed, tracker frame rate with the clip playing.
  - *Next (stage 3):* Worldline for the reference inside the player. In the separate Body page it needs Build (or playback) to show the reference worldline.
  - Tests: tests/practice_test.js (12 checks). Tests that open the Body page now use the Body button in the Clip tab.
- **Video looping by itself; no way to stop** (2 Nov, from the user's screen recording: the clip kept jumping back from ~1.2 s to ~0.2 s while the music played on, and the button showed play):
  - *Play button:* setPlaying set `.hidden` on the two SVG icons; SVG elements have no hidden property, so nothing changed and the button always showed ▶ (playing looked paused, and there was no visible stop). Now uses the hidden attribute.
  - *Loop:* reproduced in the browser by freezing the song element's clock: sync saw the video 0.35 s+ ahead of the song and moved the video to the song (videoToSong) every 1.2 s — to the same spot each time. Now syncSteady checks the song's clock over 0.5 s windows; while it's stuck (moving under 30% of its speed) the video plays on by itself, the song is re-seeked to the video once, and after ~3 s a note under the player says so ("Tap pause, then play, to line them up again"). Normal following resumes when the clock moves.
  - Not known: why the iPhone's song clock stopped; the fix stops the loop whatever the cause.
  - Test: tests/stuck_song_test.js (5 checks).
- **Cut out + Group together, more icons** (2 Nov, from the user's screen recording: turning Group on hid the cut-out options, so the two couldn't be used at once):
  - *Together:* with Cut out on, Group copies are the real cut-out dancer (RB.cutDancer: the masked frame, drawn once per frame and placed/mirrored per copy) on the chosen background (dark, colour, blurred; Dim shows as dark), only the chosen part (Whole / Upper / Legs, framed to fill the space when only one copy fits by height), with the skeleton on top when Body is on. Both option rows show under the video.
  - *Compact Group row:* one line (people icon − n +, mirror icon toggle, ↔ Apart slider) and a one-line verdict ("Each needs ~1.3 m · 4 need ~5.0 m across · no touching", red when they touch, with *Space them*); full sentence in its tooltip.
  - *Icons:* Whole / Upper / Legs as small figures with labels; Repeat, Study ½×, Learn, Snip, Record as icon-over-label buttons of equal width; the section tabs (Clip, Song, Tempo, Moves, Routine, Body) have icons above the labels.
  - Test: tests/group_test.js now 13 checks (adds Cut out + Group together, up to 8 dancers).
- **Group preview, Upper/Legs skeleton, header icons, speed on show** (2 Nov, from the user's marked-up screenshot and screen recordings):
  - *Show Upper / Legs* (cut-out on): the skeleton now draws only that half too (RB.draw `part`: 'upper' = head, arms, hands, torso; 'legs' = legs, feet, toes; the hips for both).
  - *Group* (dock button, after tracking): 2–8 copies (was 2–6 at first) of the skeleton side by side on a dark stage, playing with the clip; **Mirror every other**; **Apart** slider. Room check from the skeleton: per frame, how far apart two copies must stand so no joint or bone midpoint of one comes within 0.2 torso of the other at a similar height (touches count when they last 3+ frames). Shown in metres taking a torso (shoulders to hips) as about 0.5 m, so rough. Auto spacing = the room needed; closer than that shows "they'd touch N% of the time (most at m:ss)", red dashed lines between copies while touching, and **Space them so they don't touch**. Settings kept (`rs-group`).
  - *Header:* Look and Projects (and Body) are icon buttons; on phones the header stays at the top above the pinned player, so Projects is one tap from anywhere.
  - *Speed:* the clip speed shows as a pill under the time (orange when not ×1.00); tapping it opens a strip with − / slider / + and ½ ¾ 1× presets (edits the routine part's speed when Routine plays).
  - Dock buttons are slightly smaller on phones so Body / Hips / Cut out / Group fit on one line.
  - Test: tests/group_test.js (11 checks).
- **Following the dancer at the front** (1 Nov, after a phone run on a school compilation where the skeleton sat on a small kid at the back, or on nobody for ~2 s, while the main dancer was in front; on that clip nobody was followed in 36% of frames with people):
  - *Cause:* the follower kept looking for the last person (by place, size, clothes) for up to 1.5 s; same uniforms and missed scene changes meant it waited, then took whoever came first.
  - *Now* (RB.follow, CFG.follow): with nobody followed, the most prominent person (size × how clearly seen, a little for being central) is taken; someone 1.35× more prominent for 0.5 s takes over; if the followed dancer is gone for 0.25 s and someone new is there, follow them (at once if they're clearly further forward). Someone who was already dancing alongside waits 0.6 s (a dancer missed for a moment comes back), and someone who walked in to where the dancer was is treated as passing in front: the follower waits up to 1.5 s for the dancer (CFG.follow hide / alongside). A change of person is marked like a cut, so cleaning and playback don't blend two people. Choose the dancer still overrides all this. The follower also compares with the frame before last, so one odd detection beside the dancer no longer loses them.
  - *Measured:* the school clip (cut from the user's screen recording, not stored), real tracker: the skeleton is on the most prominent person in 361 of 477 frames with people; 83 frames have nobody (short waits while deciding, and a passer-by rule). The previous follower, replayed on the same detections, followed nobody in 145. The first version of this change switched to a dancer walking in front of the followed one in the two-dancer test (mv/tests/hips_test.js), fixed by the passer-by / alongside rules; that test passes 12/12 again. Test: tests/follow_test.js on tests/media/front.webm (made from c2-15s and u2; command in the test).
- **Something to do while it tracks** (1 Nov; the user picked these three): a bar under the player (#waitBar) shows tracking progress and how far the skeleton is ready.
  - *Live skeleton + Practise the tracked part:* every 4 s the tracker hands over what it has so far (RB.track `onPartial`, a light result without the cut-out mask); the player draws it on the tracked part only. **Practise** plays from the start with the song and loops back just before the untracked part.
  - *Tap the beat:* 32 beats of the song from its first beat (or a 100 BPM click with no song), tap the pad on each beat. Each tap is rated Perfect / Good / Early / Late; result shows hits, typical lateness, spread, best streak and best score (kept). Taps consistently ≥80 ms off the current Sound delay offer **Use N ms** (Bluetooth wording) which sets the Sound delay. This includes the phone's touch latency, so it is a rough setting.
  - *Ready chime:* when tracking finishes, the bar says Ready and plays a short three-note chime (switchable, `rs-wait-chime`; sound unlocked by the Track tap). If tracking stops the bar says so and offers Carry on tracking.
  - Test: tests/wait_test.js.
- **Smaller RTMPose download, fetched ahead of time** (31 Oct): models/rtmw-m8.onnx, 44 MB (39 MB as sent, gzip) instead of 65 MB (60 MB sent).
  - *How:* weights are stored at 8 bits with a scale per filter (per input channel for 3×3+ kernels), dequantised in the graph (Cast+Mul, folded at load, no speed cost), except the early backbone layers, which small errors upset; those stay at half precision. Layers were chosen by a sensitivity check (each group quantised alone, 190 real frames): early groups caused keypoint jumps on medium-confidence points, late groups and the head did not. All-8-bit (27 MB sent) moved the wrists by >12% of the torso in 2% of frames on a hard clip, so it was not used.
  - *Accuracy vs the 65 MB model:* single frames, medium-confidence points jumping >10 px: 0.14% (half precision itself: 0.07%). Whole app pipeline on two real clips: wrists differ by >12% of the torso in 0.2% / 0% of frames, ankles 0.4% / 0% (same model twice: 0, the pipeline is deterministic). Scripts: dev/models-lab.
  - *Download:* Tracking shows "about 42 MB to download the first time" or "ready on this phone"; **Download it now** fetches it ahead of time with MB and % progress; on Wi-Fi (Network Information API: Android/desktop Chrome; not iPhone) it downloads by itself after you add a video, never on mobile data or with Data Saver. Tracking shows download progress before it starts. The service worker keeps the model and removes older model files from the phone. RB.rtmPrefetch / rtmCached / rtmStatus. Test: tests/rtm_dl_test.js (7 checks).
- **Body draws the same skeleton as the player** (31 Oct): Body's dancer skeleton is drawn by RB.draw from Riddim Swap's track (sent with fingers/toes `ext` and `cuts`), in the Look colours and glow, mirrored correctly; Body's own drawing remains for videos loaded in Body itself. Test: mv/tests/body_skel_test.js (6 checks).
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

**Latest run:** on rs-21ab89be14 (9 Nov, beat clock + cog): clock 18/18, spd_ui 9, speed 13, both 10, learn_sync 5, study 6, scrub 6, cut 13, header 4, swipe 13, motion 16, audio 9, all passed; learn 15/16, failing "Back, Next, Slower and tapping a number", which fails the same way on the live build rs-2e570fd59b with the synthetic test clip (not from this change); layout_song not run (it needs the tracker's test assets, not in this workspace). Before that on rs-2e570fd59b (9 Nov, speed graph editing): spd_ui 9/9, both 10, speed 13, swipe 13, cut 13, header 4, motion 16, session 8. Before that on rs-f317e18821 (9 Nov, speed graph kept in place): both 10/10, scrub 6. Before that on rs-bdc1f12c52 (9 Nov, Move both starts): both 7/7, scrub 6, learn_sync 5, layout_song 8, cut 13, routine 8, session 8, swipe 13, header 4, motion 16, learn 16, study 6, audio 9, speed 13, storage 7, all passed. Before that on rs-0ae930e5bb (7 Nov, Learn sync): learn_sync 5/5 ×3, learn 16, study 6, scrub 6, cut 13, audio 9, slow 4, speed 13, routine 8, stuck song 6, step 12, practice 18, session 8, swipe 13, snip 10, motion 16, header 4, reverse 10, all passed. Before that on rs-52e9011e4b (6 Nov, Save video / progress / voice): run_extras 6/6, mirror_coach 12, layout_song 8, scrub 6, practice 18, step 12 (11 once: a real-camera hold scored 79% and counted as matching; 12 on the re-run), audio 9, speed 13, report 9, cut 13, reverse 10, session 8, storage 7, snip 10. Before that on rs-2b254f9417 (6 Nov, scrub fix): scrub 6/6 ×2, audio 9, cut 13, routine 8, slow 4, speed 13, stuck song 6, study 6, learn 16, snip 10, swipe 13, header 4, motion 16, all passed. Before that on rs-44ac7e92b3 (4 Nov, layout and song fixes): 27 suites, all passed apart from the cue test's dancer-ball timing (worst 78–128 ms against 60 ms, median 5–30 ms; known to fail under load) and one Tap-the-beat timing check that failed once under load and passed in the other runs. New: layout_song_test 8/8, stuck_song_test 6/6, mirror_coach_test 12/12 in its last 5 runs.

**Last full regression:** 29 suites on the live build rs-4099233b16 (4 Nov 2026, in a fresh workspace rebuilt from the repo): all passed except three checks, none an app bug. (1) Erase everything: the test checked for a cache the reloaded app makes again; fixed to check that what was cached before is gone (8/8). (2) Skeleton drawing expected RTMPose but ran with the tests' regular-model setting; with RB_HEAVY=1 it passes 5/5. (3) While tracking, "the skeleton shows on the tracked part": the re-downloaded tracker doesn't see the synthetic block figure (no pose at all), so nothing was drawn; with a real dancer clip it passes 10/10. The cue test needs a riddim with known drums (tests/riddim_bench.py → media/riddim/dembow-96): 13/13. Then on rs-8dbbb4e8cf (mirror, what to fix, countdown, hands up): the new test 12/12 and practice 18, step 12, group 13, look 24, learn 16, motion 16, swipe 13, header 4, cut 13, report 9, session 8, cue 13 all passed.

_Test setup in a fresh workspace:_ the test clip c2-15s.webm (15 s, 360×640, one dancer) is cut from one of the user's own clips and not stored in the repo; MediaPipe tasks-vision 0.10.18 from npm and the pose_landmarker lite/full/heavy models are fetched into mv/testassets; tests/make_media.py and tests/riddim_bench.py make the synthetic media; the camera input for practice tests is the clip as a .y4m.

**Previous:** 55 suites at rs-d37aa63294 (29 Oct 2026, RTMPose default, fingers and toes, multi-core): all passed, including the in-app RTMPose test (7/7: time estimate, compare, fingers and toes drawn, phone check) and the service-worker suites with cross-origin isolation on (sw 13/13, update 5/5, offline 3/3). One cue timing check failed under load and passed alone (13/13). The session suite still stops at its old update check.

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
