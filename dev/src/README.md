# Riddim Swap source

Edit these files, then run `python3 build_src.py` from the folder above.

| File | What's in it |
|---|---|
| `head.html` | title, fonts, the MP4 library tag, opening `<style>` |
| `style.css` | all styles |
| `markup.html` | the page markup (from `</style>` to the app's first `<script>`) |
| `../analysis.js` | tempo and beat analysis, shared with MirrorView |
| `../body.js` | body tracking, cleaning and drawing, shared with MirrorView and the pose labs |
| `app.js` | the app itself |
| `tail.html` | closing tags |

`build_src.py` writes `riddim-swap.html` (the Claude artifact page), then `build_app.py` makes the installable app in
`riddim-swap-app/`: the standalone page, service worker (version = content hash), manifest, icons, offline MP4 library,
and MirrorView (built by `mirrorview/build_mirrorview.py` from its untouched baseline plus three change files, so it can be
rolled back by building the baseline alone).

`build_src.py --check FILE` compares a build with an existing page byte-for-byte without writing anything.

`history/` keeps the old way this was built (a v20 base plus a chain of patch files), only for reference. To replay it, copy
`history/backup-v20.html` over `riddim-swap.html` and run `python3 history/patch_depth.py`; that gives the same bytes as
the source here at version rs-c39b3bf328. New changes go in `src/`, not in new patch files.
