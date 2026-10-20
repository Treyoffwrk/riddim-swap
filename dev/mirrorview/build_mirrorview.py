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

exec(compile((pathlib.Path(__file__).resolve().parent / 'mv_simple_block.py').read_text(), 'mv_simple_block.py', 'exec'))

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
  /* quick controls on the video */
  const ico={body:'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4" r="2.4" fill="currentColor"/><path d="M10 7v6M10 13l-3 5M10 13l3 5M5 9.5l5-1.5 5 1.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    cut:'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="15" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="15" cy="15" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6.8 13.2L15 3M13.2 13.2L5 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    mirror:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v16M7 5L3 10l4 5M13 5l4 5-4 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'};
  const dock=document.createElement('div');dock.className='mv-dock';dock.id='mv-dock';
  dock.innerHTML='<label class="mv-see" id="dock-see"><span>See-through</span><input type="range" id="dock-opacity" min="0" max="0.9" step="0.05" aria-label="How see-through the dance video is"><b id="dock-op-val"></b></label>'
    +'<button type="button" id="dock-body" data-action="ref-pose" aria-pressed="false">'+ico.body+'<span>Body</span></button>'
    +'<button type="button" class="cut" id="dock-cut" aria-pressed="false">'+ico.cut+'<span>Cut out</span></button>'
    +'<button type="button" id="dock-mirror" data-action="mirror-ref" aria-pressed="false">'+ico.mirror+'<span>Mirror</span></button>';
  $('stage')?.append(dock);
  const opIn=$('dock-opacity');
  /* right = more see-through (the dance video fades so you can see yourself through it) */
  opIn.addEventListener('input',()=>{const op=Math.max(.1,Math.min(1,1-Number(opIn.value))),o=$('overlay-opacity');if(o){o.value=String(op);o.dispatchEvent(new Event('input',{bubbles:true}));}else{state.overlayOpacity=op;updateUI();}$('dock-op-val').textContent=Math.round((1-op)*100)+'%';opIn.style.setProperty('--fill',(Number(opIn.value)/.9*100).toFixed(1)+'%');});
  let cutBusy=false;
  $('dock-cut').addEventListener('click',async()=>{
    if(cutBusy)return;
    if(preparedReady()){await toggleMask('reference');syncDock();return;}
    if(state.demo||!state.source){toast('Load your own video first.');return;}
    /* no masks yet: track this clip once (poses + masks), then cut out */
    cutBusy=true;const b=$('dock-cut'),lab=b.querySelector('span');b.disabled=true;
    try{await trackHere(p=>{lab.textContent='Getting ready '+Math.round(p*100)+'%';});state.maskRef=true;toast('Cut-out on: only the dancer shows.');}
    catch(e){toast('Cut-out needs body tracking, which didn’t run: '+(e.message||e));}
    finally{cutBusy=false;b.disabled=false;lab.textContent='Cut out';updateUI();syncDock();}
  });
  function syncDock(){
    const overlay=state.mode==='overlay';$('dock-see').hidden=!overlay;
    if(document.activeElement!==opIn)opIn.value=String(Math.max(0,Math.min(.9,1-state.overlayOpacity)));$('dock-op-val').textContent=Math.round((1-state.overlayOpacity)*100)+'%';opIn.style.setProperty('--fill',(Math.max(0,Math.min(.9,1-state.overlayOpacity))/.9*100).toFixed(1)+'%');
    $('dock-body').setAttribute('aria-pressed',String(!!state.refPose));
    if(!cutBusy)$('dock-cut').setAttribute('aria-pressed',String(!!state.maskRef&&preparedReady()));
    $('dock-mirror').setAttribute('aria-pressed',String(!!state.mirrorRef));
    dock.hidden=!!state.demo&&!state.source;
  }
  setInterval(syncDock,250);syncDock();
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
    window.__mvHandoff={id,kind:rec.kind,name:safe,meta:rec.meta?{trim:rec.meta.trim,hits:rec.meta.hits,songBpm:rec.meta.songBpm}:null,status:'importing'};
    try{
      const loaded=await importFile(file);
      if(loaded&&rec.meta&&rec.meta.body&&rec.meta.body.data&&rec.meta.body.n>2){
        /* Riddim Swap already tracked this clip on every frame (poses + person masks): use them, no second tracking */
        const n=usePreparedBody(rec.meta.body,'from Riddim Swap');if(n)window.__mvHandoff.body=n;window.__mvHandoff.masks=!!(rec.meta.body.mask);
      }
      window.__mvHandoff.status=loaded?'opened':'not-opened';
      if(loaded){try{await tx(db,'readwrite',st=>st.delete(id));}catch(e){}
        toast((rec.kind==='take'?'Opened your take':'Opened')+' “'+safe+'” from Riddim Swap.');}
    }catch(e){window.__mvHandoff.status='failed';setIssue('video',e);toast(e.message);}
  };
  if(document.readyState==='complete')setTimeout(run,0);else window.addEventListener('load',()=>setTimeout(run,0),{once:true});
})();
/* test hook: only with #debug in the address */
if(/debug/.test(location.hash))window.__mv={state,importFile,seek,setPlaying,get preparedBody(){return preparedBody;},preparedReady,get practiceView(){return practiceView;},get music(){return music;}};
'''
new_app = end[:-len('})();')] + bridge + '\n})();\n'
s = s[:app.start(1)] + new_app + s[app.end(1):]

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(s)
print('built', OUT, len(s.encode()), 'bytes from baseline', EXPECT[:12])
