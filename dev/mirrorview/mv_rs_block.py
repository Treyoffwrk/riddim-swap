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
.music-card.rs-noan .music-mini-status{margin-top:4px}
"""
i = s.rindex('</style>')
s = s[:i] + RS_CSS + s[i:]

# header markup
rep('<button aria-label="MirrorView studio" class="brand" data-action="studio" type="button"><span class="brand-mark"><i></i><i></i></span>mirror<span>view</span><small>0.13</small></button>',
    '<button aria-label="Riddim Swap: Body and mirror" class="brand" data-action="studio" type="button"><span class="brand-mark"><i></i><i></i></span>Riddim <span class="rs-swap">Swap</span><span class="rs-sec">Body</span><small>0.13</small></button>')
rep('<title>MirrorView · Worldline</title>', '<title>Riddim Swap · Body</title>')

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
rep("/* test hook: only with #debug in the address */", RS_JS + "\n/* test hook: only with #debug in the address */")
# the hand-off brings the song too
rep("      window.__mvHandoff.status=loaded?'opened':'not-opened';",
    "      if(loaded&&rec.meta&&rec.meta.song&&rec.meta.song.blob instanceof Blob){if(useSong(rec.meta.song)){window.__mvHandoff.song=true;rsSaved=undefined;rsSongKeep(rec.meta.song,state.name);}}\n      window.__mvHandoff.status=loaded?'opened':'not-opened';")
rep("window.__mv={state,importFile,seek,setPlaying,", "window.__mv={rsSong,setSound,followSong,state,importFile,seek,setPlaying,")
