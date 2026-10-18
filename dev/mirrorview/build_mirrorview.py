"""Build the MirrorView route for Riddim Swap from the verified v0.13 baseline.

Input:  mv/handoff/baseline/index.html  (MirrorView 0.13, checked against the handover's SHA-256)
Output: riddim-swap-app/mirrorview/index.html

Everything here is additive. MirrorView's own code, storage keys, MediaPipe version and model URL are unchanged.
Added:
  1. a "Riddim Swap" back button in MirrorView's top bar (the return path)
  2. a same-origin bridge: Riddim Swap leaves a clip or take in IndexedDB 'riddim-bridge'; MirrorView opens it
     through its own importFile() — the same path as Load video — then deletes it
  3. a test hook (window.__mv) only when the address ends in #debug
"""
import hashlib, pathlib, re

BASE = pathlib.Path(__file__).resolve().parent / 'baseline' / 'index.html'
OUT = pathlib.Path(__import__('os').environ.get('MV_OUT', str(pathlib.Path(__file__).resolve().parents[2] / 'mirrorview' / 'index.html')))
EXPECT = '9229eb1ccf5560e942391b23bc1f08f9bc5cbbf3f8463a5241df8f2dd4cc9867'

raw = BASE.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECT, 'baseline changed: refusing to build'
s = raw.decode('utf-8')

def rep(a, b):
    global s
    assert s.count(a) == 1, 'anchor not unique: ' + a[:80]
    s = s.replace(a, b, 1)

# ---- head: installed-app meta so it stays inside the Riddim Swap home-screen app ----
rep('<title>MirrorView · Worldline</title>', '''<title>MirrorView · Worldline</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">''')

# ---- return path: a slim strip above MirrorView's top bar, using MirrorView's own button class ----
rep('<div class="app">\n<header class="topbar">\n', '''<div class="app">
<div class="rs-strip"><button class="text-button rs-back" id="rs-back" type="button" aria-label="Back to Riddim Swap">‹ Riddim Swap</button><span class="rs-where">MirrorView inside Riddim Swap</span></div>
<header class="topbar">
''')
# styles go at the end of the last style block, so they win over MirrorView's earlier rules
STRIP_CSS = """
/* Riddim Swap integration: slim return strip above MirrorView's own top bar (hidden in Practice) */
.rs-strip{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:env(safe-area-inset-top,0px) 12px 0;min-height:36px;border-bottom:1px solid var(--line);font-size:12px}
.rs-back{white-space:nowrap;font-weight:650;min-height:34px;padding:0 6px}
.rs-where{opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.practice-active .rs-strip{display:none!important}
"""
i = s.rfind('</style>')
s = s[:i] + STRIP_CSS + s[i:]

# ---- bridge, inside MirrorView's own scope so it uses importFile/state/toast directly ----
m = list(re.finditer(r'<script>([\s\S]*?)</script>', s))
app = m[0]
end = app.group(1).rstrip()
assert end.endswith('})();'), 'unexpected end of the MirrorView app script'
bridge = r'''
// ---- riddim-swap-bridge.js (added for the Riddim Swap integration) ----
/* Return path and media hand-off. Riddim Swap and MirrorView share one origin, so the hand-off is a record in
   IndexedDB 'riddim-bridge' (never a URL or a message). It goes through importFile(): the same validation,
   atomic replacement and recovery as Load video. A failed import leaves the current reference as it was. */
(()=>{
  const back=$('rs-back');
  if(back)back.addEventListener('click',async()=>{
    try{if(state.playing)await setPlaying(false);}catch(e){}
    try{camera?.stop?.();}catch(e){}
    let ref=null;try{ref=document.referrer?new URL(document.referrer):null;}catch(e){}
    if(ref&&ref.origin===location.origin&&!/\/mirrorview\//.test(ref.pathname)&&history.length>1){history.back();return;}
    location.href='../'+(/debug/.test(location.hash)?'#debug':'');
  });
  const id=new URLSearchParams(location.search).get('handoff');
  if(!id)return;
  const clean=()=>{try{history.replaceState(history.state,'',location.pathname+location.hash);}catch(e){}};
  if(!/^[A-Za-z0-9-]{6,64}$/.test(id)){clean();return;}
  const openDb=()=>new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const tx=(db,mode,fn)=>new Promise((res,rej)=>{const t=db.transaction('handoff',mode),st=t.objectStore('handoff');const q=fn(st);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);});
  const run=async()=>{
    let db,rec;
    try{db=await openDb();rec=await tx(db,'readonly',st=>st.get(id));}
    catch(e){toast('Couldn’t read the clip from Riddim Swap on this phone. Load it here with Load video.');clean();return;}
    clean();
    const ok=rec&&rec.v===1&&rec.from==='riddim-swap'&&rec.blob instanceof Blob&&rec.blob.size>0&&rec.blob.size<=512*1024*1024
      &&typeof rec.name==='string'&&(!rec.blob.type||/^video\//.test(rec.blob.type));
    if(!ok){toast('The clip from Riddim Swap was missing or not a video. Your current reference is unchanged.');return;}
    const safe=rec.name.replace(/[\\/:*?"<>|]+/g,' ').slice(0,120)||'Riddim Swap clip';
    const file=new File([rec.blob],safe,{type:rec.blob.type||'video/mp4',lastModified:rec.created||Date.now()});
    window.__mvHandoff={id,kind:rec.kind,name:safe,meta:rec.meta||null,status:'importing'};
    try{
      const loaded=await importFile(file);
      window.__mvHandoff.status=loaded?'opened':'not-opened';
      if(loaded){try{await tx(db,'readwrite',st=>st.delete(id));}catch(e){}
        toast((rec.kind==='take'?'Opened your take':'Opened')+' “'+safe+'” from Riddim Swap.');}
    }catch(e){window.__mvHandoff.status='failed';setIssue('video',e);toast(e.message);}
  };
  if(document.readyState==='complete')setTimeout(run,0);else window.addEventListener('load',()=>setTimeout(run,0),{once:true});
})();
/* test hook: only with #debug in the address */
if(/debug/.test(location.hash))window.__mv={state,importFile,seek,setPlaying,get practiceView(){return practiceView;},get music(){return music;}};
'''
new_app = end[:-len('})();')] + bridge + '\n})();\n'
s = s[:app.start(1)] + new_app + s[app.end(1):]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(s)
print('built', OUT, len(s.encode()), 'bytes from baseline', EXPECT[:12])
