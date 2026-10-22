"""Build Riddim Swap from source.

  src/head.html    title, fonts, the MP4 library tag, up to <style>
  src/style.css    all styles
  src/markup.html  </style> … the page markup … <script>
  analysis.js      tempo and beat analysis   (shared with MirrorView)
  body.js          body tracking and drawing (shared with MirrorView and the pose labs)
  src/app.js       the app
  src/tail.html    closing tags

Writes riddim-swap.html (the artifact page), then runs build_app.py for the installable app and MirrorView.
  python3 build_src.py            build
  python3 build_src.py --check F  build to memory and compare byte-for-byte with file F (no writes)
"""
import pathlib, subprocess, sys
R = pathlib.Path(__file__).resolve().parent
src = R / 'src'
rd = lambda p: p.read_text()
page = (rd(src/'head.html') + rd(src/'style.css') + rd(src/'markup.html')
        + '\n' + rd(R/'analysis.js') + '\n</script>\n<script>'
        + '\n' + rd(R/'body.js') + '\n</script>\n<script>'
        + rd(src/'app.js') + rd(src/'tail.html'))
if '--check' in sys.argv:
    want = pathlib.Path(sys.argv[sys.argv.index('--check') + 1]).read_text()
    if page == want: print('identical', len(page), 'chars'); sys.exit(0)
    i = next(i for i, (a, b) in enumerate(zip(page, want)) if a != b) if len(page) == len(want) or any(a != b for a, b in zip(page, want)) else min(len(page), len(want))
    print('DIFFERENT at', i, repr(page[i-40:i+40]), 'vs', repr(want[i-40:i+40])); sys.exit(1)
(R / 'riddim-swap.html').write_text(page)
print('wrote riddim-swap.html', len(page), 'chars')
subprocess.run([sys.executable, str(R / 'build_app.py')], check=True)
