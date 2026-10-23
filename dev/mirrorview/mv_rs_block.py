# ---- MirrorView as part of Riddim Swap: same header, sound in every view, layout fixes for phones ---------------------
# 1. Header: Riddim Swap's name and a Projects button instead of MirrorView's own brand. Load video, Start here and
#    Diagnostics move into a "More" menu (the clip normally comes from Riddim Swap).
# 2. Sound, in Split, Overlay and Worldline: Song (Riddim Swap's song, kept in time with the clip the same way Riddim Swap
#    plays them: song = offset + (clip time - clip start) × song speed / clip speed), Clip (the video's own sound) or Off.
#    It doesn't depend on Pulse: when Pulse can't read the audio, sound still plays.
# 3. Layout: the quick controls sit under the video (they covered the camera's Enable button in Split and the dancer's
#    feet in Overlay); the transport row wraps instead of pushing the speed menu off screen; the bottom action row and
#    messages clear the section bar; the empty Pulse waveform is hidden until there is something to show.

RS_CSS = r"""
/* ---- Riddim Swap header ---- */
.topbar .brand{font:800 22px 'Bricolage Grotesque',Figtree,sans-serif!important;letter-spacing:-.01em;color:var(--text)!important;gap:8px}
.topbar .brand .brand-mark,.topbar .brand small,.topbar .top-center{display:none!important}
.topbar .brand .rs-swap{color:#E8A33D}
.topbar .brand .rs-sec{font:700 12px Figtree,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:3px 9px;margin-left:4px}
.top-actions>.diagnostics-button,.top-actions>.session-launch,.top-actions>.upload{display:none!important}
.rs-top-btn{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface,#171A21);color:var(--text);font:600 14px Figtree,sans-serif;cursor:pointer}
.rs-more{position:relative}
.rs-dots{width:40px;padding:0!important;font-size:20px!important;line-height:1}
.topbar{gap:8px;min-width:0}.topbar .top-actions{gap:6px;flex-shrink:0;display:flex;align-items:center}
.topbar .brand{min-width:0;white-space:nowrap}
@media (max-width:380px){.topbar .brand .rs-sec{display:none}}
/* buttons over the video: solid, so the picture never shows through them */
.stage-entry-actions button,#stage .pane-practice{background-color:#171A21!important;opacity:1!important}
.stage-entry-actions button:disabled{color:#7A8091!important}
.rs-more-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:80;display:flex;flex-direction:column;gap:4px;min-width:200px;padding:6px;border-radius:14px;border:1px solid var(--line);background:#14171D;box-shadow:0 12px 30px rgba(0,0,0,.45)}
.rs-more-menu[hidden]{display:none}
.rs-more-menu button{display:block!important;text-align:left;width:100%;min-height:42px;padding:0 12px;border-radius:10px;border:0;background:transparent;color:var(--text);font:600 14px Figtree,sans-serif}
.rs-more-menu button:hover,.rs-more-menu button:focus-visible{background:rgba(255,255,255,.06)}
.workspace-heading .eyebrow,.workspace-heading h1{display:none!important}
/* ---- sound switch ---- */
.rs-sound{display:flex;align-items:center;gap:8px;margin:8px 0 2px;flex-wrap:wrap}
.rs-sound>span{font:700 12px Figtree,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.rs-sound .seg{display:inline-grid;grid-auto-flow:column;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line)}
.rs-sound .seg button{min-height:36px;padding:0 14px;border-radius:9px;border:0;background:transparent;color:var(--muted);font:700 14px Figtree,sans-serif;cursor:pointer}
.rs-sound .seg button[aria-pressed="true"]{background:#E8A33D;color:#16120A}
.rs-sound .seg button:disabled{opacity:.4}
.rs-sound small{color:var(--muted);font:500 12px Figtree,sans-serif;flex-basis:100%}
/* ---- quick controls under the video, not over it ---- */
.mv-dock{position:static!important;margin:8px 0 0;padding:0;pointer-events:auto}
.mv-dock button{background:rgba(255,255,255,.06)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
.mv-dock button[aria-pressed="true"]{background:#6E8BFF!important;border-color:#6E8BFF!important;color:#0E1014!important}
.mv-dock button.cut[aria-pressed="true"]{background:#F3F1EC!important;color:#0E1014!important}
.mv-dock .mv-see{background:rgba(255,255,255,.06)!important}
/* ---- skeleton and view options: two labelled groups, the dancer's and yours ---- */
.mv-dock{display:flex!important;flex-direction:column;align-items:stretch;gap:8px}
.mv-dock .mv-see{align-self:stretch}
.rs-grp{display:grid;grid-template-columns:auto repeat(3,minmax(0,1fr));align-items:center;gap:6px;padding:6px 6px 6px 12px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
.rs-grp button{min-width:0;min-height:40px!important;padding:0 8px!important;font-size:13px!important;gap:5px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs-grp button svg{flex:none;width:18px;height:18px}
.rs-grp small{grid-column:1/-1}
.rs-grp>b{font:800 11px Figtree,sans-serif;letter-spacing:.07em;text-transform:uppercase;min-width:50px}
.rs-grp.dancer>b{color:#6E8BFF}.rs-grp.you>b{color:#4FD1A1}
.rs-grp button{justify-content:center}
.rs-grp.you button[aria-pressed="true"]{background:#4FD1A1!important;border-color:#4FD1A1!important;color:#0E1014!important}
.rs-grp small{flex-basis:100%;color:var(--muted);font:500 12px Figtree,sans-serif;padding:0 2px 2px}
@media (min-width:700px){.mv-dock{flex-direction:row;flex-wrap:wrap}.rs-grp{flex:1 1 300px}}
.rs-grp .rs-sub{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.rs-grp .rs-sub>button{flex:0 0 auto;padding:0 12px!important}
.rs-grp .you-line{display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap}
.rs-grp .you-line[hidden]{display:none}
.rs-grp .you-line button{min-height:36px!important;padding:0 10px!important;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text);font:700 13px Figtree,sans-serif}
.rs-grp .you-line i{font:600 12px 'JetBrains Mono',monospace;font-style:normal;color:var(--muted);padding:0 4px}
/* ---- transport row: wrap rather than push the speed menu off screen ---- */
.transport-row{flex-wrap:wrap;row-gap:8px}
.transport-right{flex-wrap:wrap;min-width:0;max-width:100%}
.transport-right select{max-width:84px}
/* ---- the bottom action row and messages clear the section bar ---- */
.launch-dock{flex-wrap:wrap}
.launch-dock>*{min-width:0}
.toast,#toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important}
main{padding-bottom:12px}
/* ---- the Pulse strip: no empty waveform box when there's nothing to draw yet ---- */
.music-card.rs-noan #music-mini{display:none}
.music-card.rs-pulse-below{margin-top:10px}
.mv-dock{margin-top:10px!important}
.music-card.rs-noan .music-mini-status{margin-top:4px}
"""
i = s.rindex('</style>')
s = s[:i] + RS_CSS + s[i:]

# header markup
rep('<button aria-label="MirrorView studio" class="brand" data-action="studio" type="button"><span class="brand-mark"><i></i><i></i></span>mirror<span>view</span><small>0.13</small></button>',
    '<button aria-label="Riddim Swap: Body and mirror" class="brand" data-action="studio" type="button"><span class="brand-mark"><i></i><i></i></span>Riddim <span class="rs-swap">Swap</span><span class="rs-sec">Body</span><small>0.13</small></button>')
rep('<title>MirrorView · Worldline</title>', '<title>Riddim Swap · Body</title>')
rep('<div class="switch-row"><span>Track my pose</span><button aria-checked="false" aria-label="Track my pose"','<div class="switch-row"><span>My skeleton (tracks your camera)</span><button aria-checked="false" aria-label="My skeleton"')
rep('<div class="switch-row"><span>Reference skeleton</span><button aria-checked="false" aria-label="Reference skeleton"','<div class="switch-row"><span>Dancer skeleton</span><button aria-checked="false" aria-label="Dancer skeleton"')

YOU_JS = r'''
/* ---- My video: a video you filmed of yourself, in the "You" half (Split) or under the dancer (Overlay), in time with
   the dancer, with your skeleton from the same tracker as Riddim Swap. you time = dancer time + you.off. ---- */
const you={el:null,url:null,name:'',samples:null,off:0,busy:false,prog:0,file:null};
state.youVideo=false;state.youPose=false;
window.__youEl=null;
window.__youPointsAt=t=>{if(!you.samples)return null;const f=nearestSample(you.samples,t,.12);return f?f.points:null;};
function youRedraw(){try{renderRevision++;lastFrame.camera='';lastFrame.reference='';}catch(e){}followYou(true);}
function youSource(src){
  const vid=src==='video'&&!!you.el;state.youVideo=vid;
  if(vid){try{if(camera.stream||camera.pending)camera.stop();}catch(e){}if(state.mode==='worldline')setMode('split');}
  else if(you.el)you.el.pause();
  try{invalidatePractice();}catch(e){}youRedraw();updateUI();
}
async function loadYou(file){
  if(!file||!/^video\//.test(file.type||'video/'))throw new Error('Choose a video of yourself.');
  if(you.url)URL.revokeObjectURL(you.url);
  const el=you.el||document.createElement('video');el.muted=true;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto';
  you.url=URL.createObjectURL(file);el.src=you.url;
  await new Promise((res,rej)=>{const ok=()=>{el.removeEventListener('error',bad);res();},bad=()=>{el.removeEventListener('loadeddata',ok);rej(new Error('This video can’t be played on this phone.'));};el.addEventListener('loadeddata',ok,{once:true});el.addEventListener('error',bad,{once:true});});
  you.el=el;window.__youEl=el;you.name=String(file.name||'My video').slice(0,80);you.samples=null;you.off=0;you.file=file;state.youPose=false;
  youSource('video');youKeep();
  trackYou().catch(e=>toast(e.message||String(e)));   /* find your body straight away; the video already plays meanwhile */
}
async function trackYou(){
  if(!you.el||you.busy)return;if(typeof RB==='undefined')throw new Error('Body tracking isn’t available here.');
  you.busy=true;you.prog=0;
  try{const B=await RB.track(you.url,{onProgress:p=>{you.prog=p;}});
    const S=1+33*3,out=[];for(let i=0;i<B.n;i++){const o=i*S,t=B.data[o];if(!Number.isFinite(t))continue;
      out.push({t,points:Number.isFinite(B.data[o+1])?Array.from({length:33},(_,j)=>({x:B.data[o+1+j*3],y:B.data[o+2+j*3],z:0,visibility:B.data[o+3+j*3]})):null});}
    if(out.filter(f=>f.points).length<3)throw new Error('No body found in your video. Film your whole body, facing the camera.');
    you.samples=out;state.youPose=true;
    const r=lineUpYou(true);youKeep();toast('Your skeleton is ready. '+r);
  }finally{you.busy=false;youRedraw();}
}
/* line up by movement: how much the body moves each moment (wrists, elbows, hips, knees, ankles), matched between the
   dancer and you over shifts of up to ±10 s. Mirror-proof (amounts of movement, not directions). */
function moveEnergy(samples,fps){
  const J=[13,14,15,16,23,24,25,26,27,28],T=samples.length?samples[samples.length-1].t:0,n=Math.max(0,Math.floor(T*fps)),e=new Float32Array(n);
  let k=0,prev=null;
  for(let i=0;i<n;i++){const t=i/fps;while(k<samples.length-1&&samples[k+1].t<=t)k++;const f=samples[k];
    if(f&&f.points&&prev){let s=0,c=0;for(const j of J){const a=f.points[j],b=prev[j];if(a&&b&&a.visibility>.4&&b.visibility>.4){s+=Math.hypot(a.x-b.x,a.y-b.y);c++;}}e[i]=c?s/c:0;}
    prev=f&&f.points?f.points:prev;}
  let m=0;for(const v of e)m+=v;m/=e.length||1;let sd=0;for(const v of e)sd+=(v-m)*(v-m);sd=Math.sqrt(sd/(e.length||1))||1;for(let i=0;i<n;i++)e[i]=(e[i]-m)/sd;return e;
}
function lineUpYou(quiet){
  const ref=state.poseSamples&&state.poseSamples.length>10?state.poseSamples:null;
  if(!you.samples)return 'Find your skeleton first (tap Skeleton).';
  if(!ref)return 'To line up by movement the dancer needs a skeleton too: tap the Dancer’s Skeleton, then Line up. Or use −0.1 / +0.1.';
  const fps=20,a=moveEnergy(ref,fps),b=moveEnergy(you.samples,fps),L=10*fps;let best=-1e9,bl=0;
  for(let l=-L;l<=L;l++){let s=0,c=0;for(let i=0;i<a.length;i++){const j=i+l;if(j<0||j>=b.length)continue;s+=a[i]*b[j];c++;}if(c<fps*3)continue;const v=s/c;if(v>best){best=v;bl=l;}}
  if(best<0.15)return 'Couldn’t match your moves to the dancer’s clearly. Use −0.1 / +0.1 to line them up by eye.';
  you.off=bl/fps;youKeep();youRedraw();
  return `Lined up: your video ${you.off>=0?'starts '+you.off.toFixed(2)+' s in':'is '+(-you.off).toFixed(2)+' s behind'} (match ${Math.round(best*100)}%).`;
}
function followYou(force){
  const el=you.el;if(!el||!state.youVideo)return;
  const want=refVideo.currentTime+you.off, dur=el.duration||0, inside=want>=0&&want<=dur-0.03;
  const playing=state.playing&&!refVideo.paused&&!refVideo.seeking&&!document.hidden&&inside;
  if(!playing){if(!el.paused)el.pause();const t=Math.max(0,Math.min(dur?dur-0.03:0,want));if(Math.abs(el.currentTime-t)>0.04||force)el.currentTime=t;return;}
  const base=refVideo.playbackRate||1, now=performance.now();
  if(el.paused||force){if(Math.abs(el.currentTime-want)>0.03)el.currentTime=want;el.playbackRate=base;you.I=you.I||0;you.t0=now;const p=el.play();if(p)p.catch(()=>{});return;}
  const d=el.currentTime-want;if(Math.abs(d)>0.25){el.currentTime=want;you.t0=now;return;}   /* a real jump: seek */
  /* steady catch-up: proportional to the gap, plus a slowly learned correction for a phone that decodes this video a
     little slow (the same idea as Riddim Swap's own sync) */
  const dt=Math.min(0.2,(now-(you.t0||now))/1000);you.t0=now;you.I=Math.max(-0.08,Math.min(0.08,(you.I||0)+d*dt*0.8));
  const r=base*(1-Math.max(-0.08,Math.min(0.08,d*1.8+you.I)));if(Math.abs(el.playbackRate-r)>0.002)el.playbackRate=r;
}
['play','playing','pause','seeked','ratechange'].forEach(ev=>refVideo.addEventListener(ev,()=>followYou(ev!=='ratechange')));
setInterval(()=>{followYou(false);if(state.youVideo){const ph=document.getElementById('camera-placeholder');if(ph&&!ph.hidden)ph.hidden=true;try{renderRevision++;}catch(e){}}},80);
/* My video stays with this dancer clip after a reload */
async function youKeep(){
  if(!you.file)return;
  try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    await new Promise((res,rej)=>{const t=db.transaction('handoff','readwrite');t.objectStore('handoff').put({id:'you-current',v:1,from:'mirrorview',file:you.file,name:you.name,off:you.off,samples:you.samples,clip:state.name,created:Date.now()});t.oncomplete=res;t.onerror=()=>rej(t.error);});db.close();}catch(e){}
}
let youSaved;
async function youRestore(){
  if(youSaved===undefined){youSaved=null;
    try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
      youSaved=await new Promise((res,rej)=>{const t=db.transaction('handoff','readonly'),q=t.objectStore('handoff').get('you-current');t.oncomplete=()=>res(q.result||null);t.onerror=()=>rej(t.error);});db.close();}catch(e){}}
  if(youSaved&&youSaved.file&&youSaved.clip===state.name&&!you.el){const r=youSaved;youSaved=null;
    try{if(you.url)URL.revokeObjectURL(you.url);const el=document.createElement('video');el.muted=true;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto';you.url=URL.createObjectURL(r.file);el.src=you.url;
      await new Promise((res,rej)=>{el.addEventListener('loadeddata',res,{once:true});el.addEventListener('error',()=>rej(new Error('video')),{once:true});});
      you.el=el;window.__youEl=el;you.file=r.file;you.name=r.name;you.off=+r.off||0;you.samples=r.samples||null;state.youPose=!!you.samples;youSource('video');}catch(e){}}
}
setInterval(()=>{if(!you.el)youRestore();},1200);
'''
RS_JS = r'''
// ---- riddim-swap-feature.js: header, sound in every view, layout ----
const rsSong={el:null,url:null,meta:null,mode:'clip',nudge:0,unlocked:false,wantPlay:false};
(()=>{
  /* header: Projects (back to Riddim Swap with Projects open) and a More menu holding MirrorView's own actions */
  const acts=document.querySelector('.top-actions');
  if(acts){
    const proj=document.createElement('button');proj.type='button';proj.className='rs-top-btn';proj.id='rs-projects';proj.textContent='Projects';
    const more=document.createElement('div');more.className='rs-more';
    more.innerHTML='<button type="button" class="rs-top-btn rs-dots" id="rs-more-btn" aria-haspopup="true" aria-expanded="false" aria-label="More" title="More">⋯</button><div class="rs-more-menu" id="rs-more-menu" hidden role="menu"></div>';
    acts.append(proj,more);
    const menu=more.querySelector('#rs-more-menu'),mb=more.querySelector('#rs-more-btn');
    const add=(label,orig)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=label;b.addEventListener('click',()=>{menu.hidden=true;mb.setAttribute('aria-expanded','false');orig&&orig.click();});menu.append(b);};
    add('Use another video…',acts.querySelector('.upload'));
    add('Start here: setup and Pulse backups',acts.querySelector('.session-launch'));
    add('Diagnostics',acts.querySelector('.diagnostics-button'));
    mb.addEventListener('click',e=>{e.stopPropagation();menu.hidden=!menu.hidden;mb.setAttribute('aria-expanded',String(!menu.hidden));});
    document.addEventListener('click',e=>{if(!more.contains(e.target)){menu.hidden=true;mb.setAttribute('aria-expanded','false');}});
    proj.addEventListener('click',()=>{try{localStorage.setItem('rs-open-proj','1');}catch(e){}document.getElementById('rs-back')?.click();});
  }
  /* quick controls under the video */
  const dock=document.getElementById('mv-dock'),stage=document.getElementById('stage');
  if(dock&&stage)stage.after(dock);
  /* the options that matter most, under the video in two labelled groups: the DANCER (the reference video) and YOU
     (your camera). Each has its own Skeleton and Mirror; yours also turns the camera on. Same actions as Controls. */
  if(dock){
    const ic=k=>dock.querySelector('#dock-'+k+' svg')?.outerHTML||'';
    const camIco='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="5" width="11" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M13 9l5-3v8l-5-3z" fill="currentColor"/></svg>';
    const g1=document.createElement('div');g1.className='rs-grp dancer';g1.setAttribute('role','group');g1.setAttribute('aria-label','The dancer');g1.innerHTML='<b>Dancer</b>';
    const g2=document.createElement('div');g2.className='rs-grp you';g2.setAttribute('role','group');g2.setAttribute('aria-label','You');
    const vidIco='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 7l5 3-5 3z" fill="currentColor"/></svg>';
    g2.innerHTML='<b>You</b><button type="button" id="you-cam" data-action="camera" aria-pressed="false">'+camIco+'<span>Camera</span></button>'
      +'<button type="button" id="you-vid" aria-pressed="false">'+vidIco+'<span>My video</span></button>'
      +'<button type="button" id="you-skel" aria-pressed="false">'+ic('body')+'<span>Skeleton</span></button>'
      +'<div class="rs-sub"><button type="button" id="you-mirror" data-action="mirror-cam" aria-pressed="false">'+ic('mirror')+'<span>Mirror</span></button>'
      +'<span class="you-line" id="you-line" hidden><button type="button" id="you-auto">Line up</button><button type="button" id="you-earlier" aria-label="My video earlier">−0.1 s</button><button type="button" id="you-later" aria-label="My video later">+0.1 s</button><i id="you-off"></i></span>'
      +'<button type="button" id="you-change" hidden>Change</button></div>'
      +'<small id="you-note"></small><input type="file" id="you-file" accept="video/*" hidden>';
    const lab=(id,t)=>{const e=dock.querySelector('#'+id+' span');if(e)e.textContent=t;};
    lab('dock-body','Skeleton');
    ['dock-body','dock-cut','dock-mirror'].forEach(id=>{const e=document.getElementById(id);if(e)g1.append(e);});
    dock.append(g1,g2);
    const camOn=()=>{const st=document.getElementById('camera-source')?.srcObject;return !!(st&&st.getVideoTracks&&st.getVideoTracks().some(t=>t.readyState==='live'));};
    const sync=()=>{const live=camOn(),vid=!!state.youVideo;
      const set=(id,v)=>{const e=document.getElementById(id);if(e&&e.getAttribute('aria-pressed')!==String(!!v))e.setAttribute('aria-pressed',String(!!v));};
      set('you-cam',live&&!vid);set('you-vid',vid);set('you-skel',vid?state.youPose:state.camPose);set('you-mirror',state.mirrorCam);
      document.getElementById('you-line').hidden=!vid;document.getElementById('you-change').hidden=!vid;
      const off=document.getElementById('you-off');if(off){const t=vid?((you.off>=0?'+':'−')+Math.abs(you.off).toFixed(2)+' s'):'';if(off.textContent!==t)off.textContent=t;}
      const sk=document.querySelector('#you-skel span');if(sk){const t=you.busy?('Tracking '+Math.round(you.prog*100)+'%'):'Skeleton';if(sk.textContent!==t)sk.textContent=t;}
      const n=document.getElementById('you-note');const t=vid?(you.busy?'Finding your body in “'+you.name+'”…':state.youPose?'Your skeleton is drawn on “'+you.name+'”. Line up matches it to the dancer’s moves.':'“'+you.name+'” plays next to the dancer. Tap Skeleton to draw yours on it.')
        :state.camPose?(live?'Your skeleton is drawn on your camera.':'Starting your camera for your skeleton…'):live?'Tap Skeleton to draw yours on your camera.':'Camera: practise live. My video: a video you filmed of yourself, next to the dancer. Skeleton draws yours on it.';if(n&&n.textContent!==t)n.textContent=t;};
    setInterval(sync,300);sync();
    /* turning your camera off also turns your skeleton off (it has nothing to draw on) */
    document.getElementById('you-cam').addEventListener('click',e=>{if(state.youVideo){youSource('camera');}else if(camOn()&&state.camPose){state.camPose=false;}},true);
    document.getElementById('you-vid').addEventListener('click',()=>{if(!you.el)document.getElementById('you-file').click();else youSource(state.youVideo?'camera':'video');});
    document.getElementById('you-change').addEventListener('click',()=>document.getElementById('you-file').click());
    document.getElementById('you-file').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)loadYou(f).catch(err=>toast(err.message||String(err)));});
    document.getElementById('you-skel').addEventListener('click',()=>{if(state.youVideo){if(!you.samples)trackYou().catch(err=>toast(err.message||String(err)));else{state.youPose=!state.youPose;youRedraw();}}else document.getElementById('cam-pose-toggle')?.click();});
    document.getElementById('you-auto').addEventListener('click',()=>{const r=lineUpYou();toast(r);});
    document.getElementById('you-earlier').addEventListener('click',()=>{you.off-=0.1;youKeep();youRedraw();});
    document.getElementById('you-later').addEventListener('click',()=>{you.off+=0.1;youKeep();youRedraw();});
    ['you-cam','you-vid','you-skel','you-mirror','dock-body','dock-mirror','you-auto','you-earlier','you-later'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>setTimeout(sync,60)));
  }
  /* sound switch, under the play row: works in Split, Overlay and Worldline */
  const row=document.querySelector('#reference-transport .transport-row');
  const box=document.createElement('div');box.className='rs-sound';box.id='rs-sound';
  box.innerHTML='<span>Sound</span><div class="seg" role="group" aria-label="Sound"><button type="button" data-snd="song" aria-pressed="false">Song</button><button type="button" data-snd="clip" aria-pressed="false">Clip</button><button type="button" data-snd="off" aria-pressed="false">Off</button></div><small id="rs-sound-note"></small>';
  (row||document.getElementById('reference-transport'))?.after(box);
  box.addEventListener('click',e=>{const b=e.target.closest('[data-snd]');if(b&&!b.disabled)setSound(b.dataset.snd,true);});
  /* the Pulse strip hides its empty waveform until there's an analysis */
  setInterval(()=>{const c=document.getElementById('music-card');if(c)c.classList.toggle('rs-noan',!(music&&music.analysis));},500);
})();
function soundNote(){
  const n=document.getElementById('rs-sound-note');if(!n)return;const m=rsSong.meta;
  n.textContent=rsSong.mode==='song'?(m?`“${m.name}” from Riddim Swap, in time with the clip${Math.abs((m.ar/m.vr)-1)>0.005?` (song ×${(m.ar/m.vr).toFixed(2)} of the clip speed)`:''}.`:'')
    :rsSong.mode==='clip'?'The video’s own sound.':'No sound.';
}
function setSound(mode,save){
  if(mode==='song'&&!rsSong.el)mode='clip';
  rsSong.mode=mode;
  if(mode==='clip')setReferenceMuted(false);else setReferenceMuted(true);
  if(mode!=='song'&&rsSong.el)rsSong.el.pause();
  document.querySelectorAll('#rs-sound [data-snd]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.snd===mode));if(b.dataset.snd==='song')b.disabled=!rsSong.el;});
  if(save)try{localStorage.setItem('rs-mv-sound',mode);}catch(e){}
  soundNote();followSong(true);
}
/* the song from Riddim Swap: offset = song position at the clip's start (cIn); ar and vr are the song and clip speeds */
function useSong(meta){
  if(!meta||!(meta.blob instanceof Blob)||!meta.blob.size)return false;
  if(rsSong.url)URL.revokeObjectURL(rsSong.url);
  const el=rsSong.el||document.createElement('audio');el.preload='auto';el.setAttribute('playsinline','');
  try{el.preservesPitch=true;el.webkitPreservesPitch=true;}catch(e){}
  rsSong.url=URL.createObjectURL(meta.blob);el.src=rsSong.url;rsSong.el=el;
  rsSong.meta={name:String(meta.name||'Song').slice(0,80),offset:+meta.offset||0,ar:+meta.ar||1,vr:+meta.vr||1,cIn:+meta.cIn||0};
  let pref=null;try{pref=localStorage.getItem('rs-mv-sound');}catch(e){}
  setSound(pref==='clip'||pref==='off'?pref:'song',false);
  return true;
}
const songAt=t=>{const m=rsSong.meta;return m.offset+(t-m.cIn)*m.ar/m.vr;};
const clipAt=x=>{const m=rsSong.meta;return m.cIn+(x-m.offset)*m.vr/m.ar;};
/* Song mode plays it the way Riddim Swap does: the song at its own speed (× MirrorView's speed), the clip at Riddim Swap's
   clip speed, and the SONG leads: the clip's speed is nudged (up to ±6%, which you can't see) to stay with it. A real
   seek on the clip moves the song. */
let rsSetting=false;
function setClipRate(r){if(Math.abs(refVideo.playbackRate-r)>0.002){rsSetting=true;refVideo.playbackRate=r;rsSetting=false;}}
function followSong(force){
  const el=rsSong.el;if(!el||!rsSong.meta)return;
  const v=refVideo, m=rsSong.meta, sp=state.speed||1, song=rsSong.mode==='song';
  if(!song){if(!el.paused)el.pause();if(rsSong.ratedClip){setClipRate(sp);rsSong.ratedClip=false;}return;}
  const on=state.playing&&!v.paused&&!v.seeking&&!document.hidden;
  const clipBase=sp*m.vr; rsSong.ratedClip=true;
  if(!on){if(!el.paused)el.pause();setClipRate(clipBase);return;}
  const tgt=songAt(v.currentTime), dur=el.duration||Infinity;
  if(tgt<0||tgt>=dur-0.05){if(!el.paused)el.pause();setClipRate(clipBase);return;}   /* this part of the clip is before (or after) the song */
  const sr=Math.max(0.25,Math.min(4,sp*m.ar));if(Math.abs(el.playbackRate-sr)>0.002)el.playbackRate=sr;
  if(el.paused||force){if(Math.abs(el.currentTime-tgt)>0.02)el.currentTime=tgt;const pp=el.play();if(pp)pp.catch(()=>{});setClipRate(clipBase);return;}
  const drift=v.currentTime-clipAt(el.currentTime);            /* + : the clip is ahead of the song */
  if(Math.abs(drift)>0.3){el.currentTime=tgt;setClipRate(clipBase);return;}   /* a real jump: move the song */
  const k=Math.max(-0.06,Math.min(0.06,-drift*1.5));setClipRate(clipBase*(1+k));
}
refVideo.addEventListener('ratechange',()=>{if(!rsSetting&&rsSong.mode==='song'&&rsSong.el)followSong(false);});
['play','playing','pause','seeked','seeking','ended'].forEach(ev=>refVideo.addEventListener(ev,()=>followSong(ev==='play'||ev==='playing'||ev==='seeked')));
setInterval(()=>followSong(false),100);
document.addEventListener('visibilitychange',()=>followSong(true));
/* iPhone: a sound can only start from a tap. The first tap anywhere unlocks the song (silently), so later plays work. */
document.addEventListener('pointerup',()=>{const el=rsSong.el;if(!el||rsSong.unlocked||!el.paused)return;rsSong.unlocked=true;el.muted=true;const p=el.play();
  const done=()=>{if(!(rsSong.mode==='song'&&state.playing))el.pause();el.muted=false;followSong(true);};if(p)p.then(done).catch(()=>{el.muted=false;rsSong.unlocked=false;});else done();},true);
/* the song stays with this clip after a reload: Riddim Swap's hand-off keeps a copy keyed by the clip */
/* Practice: its sound button cycles the same Sound setting (Song → Clip → Off), so the clip's own sound never plays over the song */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#pv-audio,#rs-pv-sound');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
  const order=rsSong.el?['song','clip','off']:['clip','off'];setSound(order[(order.indexOf(rsSong.mode)+1)%order.length],true);pvLabel();},true);
function pvLabel(){const t='Sound: '+(rsSong.mode==='song'?'Song':rsSong.mode==='clip'?'Clip':'Off');
  const b=document.getElementById('pv-audio');if(b){if(b.textContent!==t)b.textContent=t;b.disabled=false;}
  /* and one tap away on Practice's own control bar */
  const bar=document.getElementById('pv-controls');
  if(bar&&!document.getElementById('rs-pv-sound')){const s2=document.createElement('button');s2.type='button';s2.id='rs-pv-sound';s2.dataset.practice='audio';
    s2.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span></span>';
    const play=document.getElementById('pv-play');(play&&play.nextSibling)?bar.insertBefore(s2,play.nextSibling):bar.append(s2);}
  const s3=document.querySelector('#rs-pv-sound span');if(s3){const t2=rsSong.mode==='song'?'Song':rsSong.mode==='clip'?'Clip':'Muted';if(s3.textContent!==t2)s3.textContent=t2;}}
setInterval(pvLabel,300);
let rsSaved;
async function rsSongRestore(){
  if(rsSaved===undefined){rsSaved=null;
    try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
      rsSaved=await new Promise((res,rej)=>{const t=db.transaction('handoff','readonly'),q=t.objectStore('handoff').get('song-current');t.oncomplete=()=>res(q.result||null);t.onerror=()=>rej(t.error);});db.close();}catch(e){}}
  if(rsSaved&&rsSaved.song&&rsSaved.clip&&state.name===rsSaved.clip&&!rsSong.el)useSong(rsSaved.song);
}
setInterval(()=>{if(!rsSong.el&&!new URLSearchParams(location.search).get('handoff'))rsSongRestore();},1000);
async function rsSongKeep(song,clipName){
  try{const db=await new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    await new Promise((res,rej)=>{const t=db.transaction('handoff','readwrite');t.objectStore('handoff').put({id:'song-current',v:1,from:'riddim-swap',song,clip:clipName,created:Date.now()});t.oncomplete=res;t.onerror=()=>rej(t.error);});db.close();}catch(e){}
}
setTimeout(()=>{if(!rsSong.el){let pref=null;try{pref=localStorage.getItem('rs-mv-sound');}catch(e){}setSound(pref==='off'?'off':'clip',false);}},0);
'''
rep("/* test hook: only with #debug in the address */", YOU_JS + RS_JS + "\n/* test hook: only with #debug in the address */")
# the hand-off brings the song too
rep("      window.__mvHandoff.status=loaded?'opened':'not-opened';",
    "      if(loaded&&rec.meta&&rec.meta.song&&rec.meta.song.blob instanceof Blob){if(useSong(rec.meta.song)){window.__mvHandoff.song=true;rsSaved=undefined;rsSongKeep(rec.meta.song,state.name);}}\n      window.__mvHandoff.status=loaded?'opened':'not-opened';")
rep("window.__mv={state,importFile,seek,setPlaying,", "window.__mv={rsSong,setSound,followSong,you,loadYou,trackYou,lineUpYou,youSource,state,importFile,seek,setPlaying,")
# the renderer: My video takes the camera's place in the You half (Split) and under the dancer (Overlay), with your skeleton
rep("const world=s.mode==='worldline',effects=s.maskRef||s.maskCam||s.refDisplay==='skeleton',dom=native&&!world&&!effects;",
    "const world=s.mode==='worldline',effects=s.maskRef||s.maskCam||s.refDisplay==='skeleton'||!!s.youVideo,dom=native&&!world&&!effects;")
rep("cam=camVideo?.readyState>=2&&s.cameraStatus==='live'?camVideo:null;\n    if(!dom&&cam&&(split||s.mode==='overlay'))",
    "cam=camVideo?.readyState>=2&&s.cameraStatus==='live'&&!s.youVideo?camVideo:(s.youVideo&&window.__youEl&&window.__youEl.readyState>=2?window.__youEl:null);\n    if(!dom&&cam&&(split||s.mode==='overlay'))")
rep("      if(s.camPose&&performance.now()/1000-s.cameraPoseTime<.45)skeleton2D(c,s.cameraPoints,cr,s.mirrorCam,CAM,.95);",
    "      if(s.camPose&&cam===camVideo&&performance.now()/1000-s.cameraPoseTime<.45)skeleton2D(c,s.cameraPoints,cr,s.mirrorCam,CAM,.95);\n      if(cam&&cam===window.__youEl&&s.youPose){const yp=window.__youPointsAt(cam.currentTime);if(yp)skeleton2D(c,yp,cr,s.mirrorCam,CAM,.95);}")
# the You half says what it shows
rep("write(c,s.cameraStatus==='live'?'YOU · LIVE':s.cameraStatus==='preview-paused'?'YOU · PREVIEW PAUSED':'YOU · CAMERA NOT LIVE',",
    "write(c,s.youVideo?'YOU · MY VIDEO':s.cameraStatus==='live'?'YOU · LIVE':s.cameraStatus==='preview-paused'?'YOU · PREVIEW PAUSED':'YOU · CAMERA NOT LIVE',")
# order under the video, by how often it's used: play and sound, then the Dancer / You options, then Pulse
rep("""  box.addEventListener('click',e=>{const b=e.target.closest('[data-snd]');if(b&&!b.disabled)setSound(b.dataset.snd,true);});""",
    """  box.addEventListener('click',e=>{const b=e.target.closest('[data-snd]');if(b&&!b.disabled)setSound(b.dataset.snd,true);});
  {const tr=document.getElementById('reference-transport'),dk=document.getElementById('mv-dock'),mc=document.getElementById('music-card');
   if(tr&&dk){tr.after(dk);} if(dk&&mc){dk.after(mc);mc.classList.add('rs-pulse-below');}}""")

# the empty You half points to both ways in
s = s.replace('Enable your camera to practise alongside the reference.', 'Turn on your camera to practise live, or tap My video below to use a video you filmed of yourself.')
