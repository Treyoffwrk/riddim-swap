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

# ---- shared look, dance body and denser prepared poses (see mv_theme_block.py) ----
exec(compile((pathlib.Path(__file__).resolve().parent / 'mv_theme_block.py').read_text(), 'mv_theme_block.py', 'exec'))

exec(compile((pathlib.Path(__file__).resolve().parent / 'mv_pulse_block.py').read_text(), 'mv_pulse_block.py', 'exec'))

# ---- bridge, inside MirrorView's own scope so it uses importFile/state/toast directly ----
m = list(re.finditer(r'<script>([\s\S]*?)</script>', s))
app = next(x for x in m if '// ---- math.js ----' in x.group(1))   # MirrorView's app script (analysis.js now loads before it)
end = app.group(1).rstrip()
assert end.endswith('})();'), 'unexpected end of the MirrorView app script'
bridge = r'''
// ---- riddim-swap-bridge.js (added for the Riddim Swap integration) ----
/* Return path and media hand-off. Riddim Swap and MirrorView share one origin, so the hand-off is a record in
   IndexedDB 'riddim-bridge' (never a URL or a message). It goes through importFile(): the same validation,
   atomic replacement and recovery as Load video. A failed import leaves the current reference as it was. */
(()=>{
  /* the shared bottom bar: the same sections as Riddim Swap. Leaving pauses, stops the camera and asks Riddim Swap to
     open the chosen section. */
  const nav=document.createElement('nav');nav.className='rs-nav';nav.setAttribute('aria-label','Riddim Swap sections');
  [['t-clip','Clip'],['t-song','Song'],['t-tempo','Tempo'],['t-moves','Moves'],['t-routine','Routine'],['','Body']].forEach(([tab,label])=>{
    const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.rsTab=tab;
    if(!tab){b.className='on';b.setAttribute('aria-current','page');b.id='rs-back-body'}else if(tab==='t-clip')b.id='rs-back';
    nav.append(b);
  });
  document.querySelector('.app')?.append(nav);
  nav.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b||!b.dataset.rsTab)return;
    try{localStorage.setItem('rs-tab-req',b.dataset.rsTab);}catch(err){}
    try{if(state.playing)await setPlaying(false);}catch(err){}
    try{camera?.stop?.();}catch(err){}
    let ref=null;try{ref=document.referrer?new URL(document.referrer):null;}catch(err){}
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
      if(loaded&&rec.meta&&rec.meta.body&&rec.meta.body.data&&rec.meta.body.n>2){
        /* Riddim Swap already tracked this clip on every frame: use those poses as the reference (no second tracking) */
        const B=rec.meta.body,S=1+33*3,out=[];
        for(let i=0;i<B.n&&i<9000;i++){const o=i*S;const t=B.data[o];if(!Number.isFinite(t))continue;
          out.push({t,points:Number.isFinite(B.data[o+1])?Array.from({length:33},(_,j)=>({x:B.data[o+1+j*3],y:B.data[o+2+j*3],z:0,visibility:B.data[o+3+j*3]})):null});}
        if(out.length>2){state.poseSamples=out;state.poseSamplesVisual=out;state.refPose=true;state.refDisplay='both';state.style='both';state.cacheVersion++;
          state.referenceAnalysis=`${out.filter(f=>f.points).length} / ${out.length} poses from Riddim Swap (every frame)`;
          try{persistReferencePoses();}catch(e){}
          const pm=$('pose-message');if(pm)pm.textContent=state.referenceAnalysis;window.__mvHandoff.body=out.length;updateUI();}
      }
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
