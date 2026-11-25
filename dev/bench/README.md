# Move-card benchmark

Hand marks (by eye, by Claude, 25 Nov) for 34 beats of two clips: `labels.json`, per beat number: `step` (L/R/0),
`feet` (open/close/lift/0), `arms` (out/in/up/down/hold). Clips: the test dancer (c2-15s) with the 100 BPM test song as
its own sound, and a 13 s single-dancer export of the user's; neither is stored in the repo.

`node bench.js <page> <out.json> c2a solo` tracks each clip in the app, makes the card for each marked beat and scores
what the card shows against the marks, plus how still the limbs are at the card's moment. Results before and after the
25 Nov accuracy changes: `results-before.json`, `results-final.json`.
