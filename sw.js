/* Riddim Swap offline support. Version changes on every build. */
const VERSION='rs-d37aa63294';
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
