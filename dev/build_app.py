"""Build the installable Riddim Swap app from the same source as the Claude artifact.

Source:  /home/claude/riddim-swap.html  (artifact page: <title>, links, <style>, markup, <script>)
Output:  /home/claude/riddim-swap-app/   (index.html, manifest, service worker, icons, vendor lib)
"""
import hashlib, json, re, pathlib

SRC = pathlib.Path('/home/claude/riddim-swap.html')
OUT = pathlib.Path('/home/claude/riddim-swap-app')
src = SRC.read_text()

# ---- split the artifact page into head bits and body ----
title = re.search(r'<title>.*?</title>', src, re.S).group(0)
links = re.findall(r'<link [^>]*>', src.split('<style>')[0])
style = re.search(r'<style>.*?</style>', src, re.S).group(0)
body_start = src.index('</style>') + len('</style>')
body = src[body_start:]

# the MP4 library ships with the app instead of coming from a CDN (works offline)
assert 'cdn.jsdelivr.net/npm/mp4-muxer' in src
lib_tag = '<script src="vendor/mp4-muxer.js"></script>'

extra_css = """<style>
/* standalone app: what the artifact viewer used to provide */
html{-webkit-text-size-adjust:100%}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;min-height:100vh;overscroll-behavior-y:none}
img{max-width:100%}
button,label,input[type=range]{touch-action:manipulation}
/* keep the status-bar strip solid while content scrolls under it */
body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);background:var(--bg);z-index:45}
.install{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px}
.install b{font-weight:600}
</style>"""

app_js = """<script>
/* offline support + updates */
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
/* iPhone/iPad in Safari, not installed yet: show how to add it to the Home Screen */
(function(){
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const installed=window.navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
  let dismissed=false; try{dismissed=localStorage.getItem('rs-install-hide')==='1'}catch(e){}
  if(!ios||installed||dismissed)return;
  const bar=document.createElement('div'); bar.className='install';
  bar.innerHTML='<span><b>Install Riddim Swap:</b> tap the Share button, then <b>Add to Home Screen</b>.</span>';
  const x=document.createElement('button'); x.className='btn sm ghost'; x.textContent='Hide';
  x.addEventListener('click',()=>{bar.remove();try{localStorage.setItem('rs-install-hide','1')}catch(e){}});
  bar.append(x);
  const wrap=document.querySelector('.wrap'); wrap.insertBefore(bar,wrap.children[1]);
})();
</script>"""

head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{title}
<meta name="description" content="Put a dance clip on a different song, cut moves and build routines on the beat.">
<meta name="theme-color" content="#ECEEF2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101216" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Riddim Swap">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
{chr(10).join(links)}
<script>window.RS_HOSTED=1</script>
{lib_tag}
{style}
{extra_css}
</head>
<body>"""

html = head + body + app_js + "\n</body>\n</html>\n"
(OUT / 'index.html').write_text(html)

# MirrorView route (built from its verified baseline; see mv/build_mirrorview.py)
import subprocess
subprocess.run(['python3', '/home/claude/mv/build_mirrorview.py'], check=True)

manifest = {
    "name": "Riddim Swap",
    "short_name": "Riddim Swap",
    "description": "Put a dance clip on a different song, cut moves and build routines on the beat.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#ECEEF2",
    "theme_color": "#16181D",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
    ]
}
(OUT / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2))

# cache version changes whenever any app file changes, so phones pick up updates
h = hashlib.sha256()
for f in sorted(OUT.rglob('*')):
    if f.is_file() and f.name not in ('sw.js',) and not f.name.endswith('.zip'):
        h.update(f.read_bytes())
version = h.hexdigest()[:10]

# each page carries the version it was built as, so the app can tell when the server has a newer one (comparing the
# server with itself, which is what the update check did before, never finds a difference)
for page in [OUT / 'index.html', OUT / 'mirrorview' / 'index.html']:
    if page.exists():
        t = page.read_text()
        assert '<head>' in t
        t = t.replace('<head>', "<head>\n<script>window.RS_BUILD='rs-%s'</script>" % version, 1)
        page.write_text(t)

sw = """/* Riddim Swap offline support. Version changes on every build. */
const VERSION='rs-%s';
const SHELL=['./','./index.html','./mirrorview/','./mirrorview/index.html','./manifest.webmanifest','./vendor/mp4-muxer.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
/* kept across app updates: the body tracker (runtime and model) and fonts. Their addresses name exact versions, so a
   saved copy never goes stale; a new tracker version would have a new address. */
const KEEP='rs-runtime-1';
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!==KEEP).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
/* cross-origin isolation: the app's own pages and files go out with COOP/COEP headers (GitHub Pages can't send them), so
   the RTMPose runtime can use several cores (SharedArrayBuffer). Everything the app loads from elsewhere allows it (CORP/CORS). */
const ISO=r=>{if(!r||r.type==='opaque'||!r.status)return r;const h=new Headers(r.headers);h.set('Cross-Origin-Opener-Policy','same-origin');h.set('Cross-Origin-Embedder-Policy','require-corp');h.set('Cross-Origin-Resource-Policy','same-origin');return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h})};
const isoP=p=>Promise.resolve(p).then(ISO);
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  const url=new URL(req.url);
  /* pages (Riddim Swap and MirrorView): newest when online, that page's saved copy when offline.
     Each page is cached under its own address, so opening MirrorView never replaces the saved Riddim Swap page. */
  if(req.mode==='navigate'||(url.origin===location.origin&&url.pathname.endsWith('.html'))){
    const key=new URL(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname,location.origin).href;
    /* always check with the server (a quick 'has it changed?'), so a new version isn't hidden by the browser's cache */
    e.respondWith(isoP(fetch(req.mode==='navigate'?new Request(url.href,{cache:'no-cache',credentials:'same-origin'}):req).then(r=>{if(r.ok&&(r.type==='basic'||r.type==='default')){const c=r.clone();caches.open(VERSION).then(x=>x.put(key,c))}return r})
      .catch(()=>caches.match(key).then(m=>m||caches.match('./index.html')))));
    return;
  }
  /* (the RTMPose runtime and model below are kept across updates, like the tracker files) */
  if(url.origin===location.origin&&((url.pathname.includes('/models/')&&url.pathname.endsWith('.onnx'))||url.pathname.includes('/vendor/ort/'))){
    e.respondWith(isoP(caches.open(KEEP).then(c=>c.match(req,{ignoreVary:true}).then(m=>m||fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r})))));
    return;
  }
  /* app files: saved copy first */
  if(url.origin===location.origin){
    e.respondWith(isoP(caches.match(req).then(m=>m||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(VERSION).then(x=>x.put(req,c))}return r}))));
    return;
  }
  /* the body tracker: MediaPipe's runtime (pinned version) and pose model. Saved the first time they load, so body
     tracking, the cut-out and MirrorView's poses work offline afterwards. */
  if((url.hostname==='cdn.jsdelivr.net'&&(url.pathname.startsWith('/npm/@mediapipe/tasks-vision@')||url.pathname.startsWith('/npm/onnxruntime-web@')))||(url.hostname==='storage.googleapis.com'&&url.pathname.startsWith('/mediapipe-models/'))){
    e.respondWith(caches.open(KEEP).then(c=>c.match(req,{ignoreVary:true}).then(m=>m||fetch(req).then(r=>{if(r.ok||r.type==='opaque')c.put(req,r.clone());return r}))));
    return;
  }
  /* fonts: use the saved copy, refresh in the background */
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(KEEP).then(c=>c.match(req).then(m=>{
      const net=fetch(req).then(r=>{if(r.ok||r.type==='opaque')c.put(req,r.clone());return r}).catch(()=>m);
      return m||net;
    })));
  }
});
""" % version
(OUT / 'sw.js').write_text(sw)
# the RTMPose runtime (ONNX Runtime Web 1.22.0): plain WASM, and the WebGPU build for browsers that have a GPU API
import shutil
ORT = pathlib.Path('/tmp/claude-0/-home-claude/c7d6fa6b-e9dd-5d62-903e-3e4d46a3b3b0/scratchpad/node_modules/onnxruntime-web/dist')
if not ORT.exists(): ORT = pathlib.Path('/home/claude/vendor-src/onnxruntime-web/dist')
(OUT / 'vendor' / 'ort').mkdir(parents=True, exist_ok=True)
for f in ['ort.wasm.bundle.min.mjs','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs','ort.webgpu.bundle.min.mjs','ort-wasm-simd-threaded.jsep.wasm','ort-wasm-simd-threaded.jsep.mjs']:
    src, dst = ORT / f, OUT / 'vendor' / 'ort' / f
    if not dst.exists() or dst.stat().st_size != src.stat().st_size: shutil.copy(src, dst)
# the RTMPose models (stored at half precision, computed at full precision)
(OUT / 'models').mkdir(exist_ok=True)
for f in pathlib.Path('/home/claude/models').glob('*.onnx'):
    dst = OUT / 'models' / f.name
    if not dst.exists() or dst.stat().st_size != f.stat().st_size: shutil.copy(f, dst)
print('built', OUT, 'version', version, 'index.html', len(html), 'bytes')
