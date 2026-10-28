# Body as part of Riddim Swap, part 2: one look and one project across both pages.
#  1. Look: the skeleton colours and glow you chose in Riddim Swap's Look sheet, and its app theme, are used in Body.
#     Riddim Swap writes the resolved look to localStorage 'rs-look-now' (same app, same storage); Body reads it at
#     start and whenever you come back to the page.
#  2. Project: the clip arrives with its cuts and speed graph. A table maps clip time to the time the song plays
#     ("output time"), so the song stays in time through the speed graph and cut parts are skipped while the song keeps
#     going. The project's name shows in the header. Cut-out's Whole / Upper / Legs is one setting for both pages.
# Runs after mv_rs_block.py, on the same text `s`.

# --- 1. Look -------------------------------------------------------------------------------------------------------
rep("const REF='#6E8BFF',CAM='#4FD1A1',HIPS='#FF5FA2';", "let REF='#6E8BFF',CAM='#4FD1A1',HIPS='#FF5FA2',REF_GLOW=0;")
rep("  if(!dashed&&alpha>=.9&&danceBody2D(ctx,points,rect,mirror,colour,stroke))return;",
    "  if(!dashed&&alpha>=.9){const g=colour===REF&&REF_GLOW>0;if(g){ctx.save();ctx.shadowColor=REF;ctx.shadowBlur=REF_GLOW*14*(window.devicePixelRatio||1);}\n"
    "    const ok=danceBody2D(ctx,points,rect,mirror,colour,stroke);if(g)ctx.restore();if(ok)return;}")
# the brand's "Swap" follows the theme's song colour
s = s.replace(".topbar .brand .rs-swap{color:#E8A33D}", ".topbar .brand .rs-swap{color:var(--song-hot,#E8A33D)}\n.topbar .brand .rs-proj{font:700 12px Figtree,sans-serif;color:var(--muted);max-width:30vw;overflow:hidden;text-overflow:ellipsis;margin-left:6px}\n.topbar .brand .rs-proj:empty{display:none}\n.topbar .brand.has-proj .rs-sec{display:none}.topbar .brand .rs-proj{display:inline-block;vertical-align:middle;border:1px solid var(--line);border-radius:999px;padding:3px 9px;font-size:12px;letter-spacing:0}", 1)
assert '.rs-proj' in s
rep('<span class="rs-sec">Body</span>', '<span class="rs-sec">Body</span><span class="rs-proj" id="rs-proj"></span>')

LINK_JS = r'''
/* ---- one look: Riddim Swap's Look sheet (skeleton colours, glow, theme) ---- */
const RS_THEME_ALIAS={'--surface':['--panel'],'--dance':['--green'],'--ink':['--text']};
let rsLookVars=[];
function rsLookLoad(){
  let L=null;try{L=JSON.parse(localStorage.getItem('rs-look-now')||'null');}catch(e){}
  const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  const sk=L&&L.skel||{};REF=hex(sk.dance)?sk.dance:'#6E8BFF';HIPS=hex(sk.hips)?sk.hips:'#FF5FA2';REF_GLOW=Math.max(0,Math.min(1,+sk.glow||0));
  const root=document.documentElement;rsLookVars.forEach(k=>root.style.removeProperty(k));rsLookVars=[];
  const set=(k,v)=>{if(/^--[a-z-]+$/.test(k)&&typeof v==='string'&&/^#[0-9a-f]{3,8}$/i.test(v)){root.style.setProperty(k,v,'important');rsLookVars.push(k);}};
  const th=L&&L.theme||{};for(const k in th){set(k,th[k]);(RS_THEME_ALIAS[k]||[]).forEach(a=>set(a,th[k]));}
  set('--ref',REF);set('--hips',HIPS);
  window.__mvLook={ref:REF,hips:HIPS,glow:REF_GLOW,vars:rsLookVars.slice()};
  try{lastFrame.reference='';renderRevision++;}catch(e){}
}
rsLookLoad();
window.addEventListener('pageshow',rsLookLoad);
window.addEventListener('storage',e=>{if(e.key==='rs-look-now')rsLookLoad();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)rsLookLoad();});

/* ---- one project: name, cuts and speed graph from Riddim Swap ---- */
const rsClip={pieces:null,map:null,project:'',skipAt:0};
function rsClipUse(meta){
  rsClip.pieces=Array.isArray(meta&&meta.pieces)&&meta.pieces.length?meta.pieces.map(p=>[+p[0],+p[1]]).filter(p=>p[1]>p[0]):null;
  rsClip.map=Array.isArray(meta&&meta.map)&&meta.map.length>1?meta.map.map(p=>[+p[0],+p[1]]):null;
  rsClip.project=String(meta&&meta.project||'').slice(0,60);
  const el=document.getElementById('rs-proj');if(el){el.textContent=rsClip.project;el.title='Project: '+rsClip.project;el.closest('.brand')?.classList.toggle('has-proj',!!rsClip.project);}
  try{localStorage.setItem('rs-mv-clipmeta',JSON.stringify({clip:state.name||'',pieces:rsClip.pieces,map:rsClip.map,project:rsClip.project}));}catch(e){}
}
/* after a reload, the same clip keeps its cuts and speed graph */
function rsClipRestore(){
  if(rsClip.pieces||rsClip.map||rsClip.project)return;let o=null;try{o=JSON.parse(localStorage.getItem('rs-mv-clipmeta')||'null');}catch(e){}
  if(o&&o.clip&&o.clip===state.name){rsClip.pieces=o.pieces||null;rsClip.map=o.map||null;rsClip.project=o.project||'';const el=document.getElementById('rs-proj');if(el){el.textContent=rsClip.project;el.title='Project: '+rsClip.project;el.closest('.brand')?.classList.toggle('has-proj',!!rsClip.project);}}
}
setInterval(rsClipRestore,1000);
/* clip time -> output time (the song's clock) and back, through the table; straight lines outside it */
function rsOut(t){const M=rsClip.map;if(!M){const m=rsSong.meta;return m?(t-m.cIn)/m.vr:t;}
  if(t<=M[0][0])return M[0][1]+(t-M[0][0])/((M[1][0]-M[0][0])/((M[1][1]-M[0][1])||1e-6));
  let lo=0,hi=M.length-1;while(hi-lo>1){const k=(lo+hi)>>1;if(M[k][0]<=t)lo=k;else hi=k;}
  const a=M[lo],b=M[hi];if(t>=b[0])return b[1];
  /* a cut (a jump in clip time with no output time between): the output time where the next piece starts */
  if(b[1]-a[1]<1e-6)return b[1];
  return a[1]+(t-a[0])*(b[1]-a[1])/((b[0]-a[0])||1e-6);}
function rsIn(x){const M=rsClip.map;if(!M){const m=rsSong.meta;return m?m.cIn+x*m.vr:x;}
  if(x<=M[0][1])return M[0][0];if(x>=M[M.length-1][1])return M[M.length-1][0];
  let lo=0,hi=M.length-1;while(hi-lo>1){const k=(lo+hi)>>1;if(M[k][1]<=x)lo=k;else hi=k;}
  const a=M[lo],b=M[hi];return a[0]+(x-a[1])*(b[0]-a[0])/((b[1]-a[1])||1e-6);}
/* how fast the clip runs against the song's clock here (the speed graph's local speed) */
function rsSlope(t){const M=rsClip.map;if(!M){const m=rsSong.meta;return m?m.vr:1;}
  const x=rsOut(t),d=0.08;const t0=rsIn(Math.max(M[0][1],x-d)),t1=rsIn(Math.min(M[M.length-1][1],x+d));const sl=(t1-t0)/(Math.min(M[M.length-1][1],x+d)-Math.max(M[0][1],x-d)||1);
  return sl>0.2&&sl<5?sl:(rsSong.meta?rsSong.meta.vr:1);}
/* cut parts are skipped: the clip jumps to the next kept part, the song just keeps going */
function rsSkipCuts(){
  const P=rsClip.pieces;if(P&&P.length>1&&state.playing&&!refVideo.seeking){const t=refVideo.currentTime;
    if(!P.some(p=>t>=p[0]-0.02&&t<p[1])){const nx=P.find(p=>p[0]>t);if(nx){rsClip.skipAt=performance.now();rsClip.skips=(rsClip.skips||0)+1;
      /* aim where the song will be when the frame arrives (the song doesn't wait), not at the piece's first frame */
      const el=rsSong.el,sm=rsSong.mode==='song'&&el&&!el.paused&&rsSong.meta;let to=nx[0];if(sm){const c=clipAt(el.currentTime+0.12*el.playbackRate);if(c>nx[0]&&c<nx[1])to=c;}refVideo.currentTime=to;}}}
  requestAnimationFrame(rsSkipCuts);}
requestAnimationFrame(rsSkipCuts);
'''
rep("/* test hook: only with #debug in the address */", LINK_JS + "\n/* test hook: only with #debug in the address */")
# the song follows the table
rep("const songAt=t=>{const m=rsSong.meta;return m.offset+(t-m.cIn)*m.ar/m.vr;};",
    "const songAt=t=>{const m=rsSong.meta;return m.offset+rsOut(t)*m.ar;};")
rep("const clipAt=x=>{const m=rsSong.meta;return m.cIn+(x-m.offset)*m.vr/m.ar;};",
    "const clipAt=x=>{const m=rsSong.meta;return rsIn((x-m.offset)/m.ar);};")
rep("  const clipBase=sp*m.vr; rsSong.ratedClip=true;", "  const clipBase=sp*rsSlope(v.currentTime); rsSong.ratedClip=true;")
# while the clip jumps over a cut it is 'seeking' for a moment: the song keeps playing through that (no pause)
rep("  const on=state.playing&&!v.paused&&!v.seeking&&!document.hidden;",
    "  const on=state.playing&&!v.paused&&(!v.seeking||performance.now()-rsClip.skipAt<800)&&!document.hidden;")
# skipping a cut moves the clip, not the song (moving the song on iPhone is a short silence)
rep("['play','playing','pause','seeked','seeking','ended'].forEach(ev=>refVideo.addEventListener(ev,()=>followSong(ev==='play'||ev==='playing'||ev==='seeked')));",
    "['play','playing','pause','seeked','seeking','ended'].forEach(ev=>refVideo.addEventListener(ev,()=>followSong((ev==='play'||ev==='playing'||ev==='seeked')&&!(performance.now()-rsClip.skipAt<800))));")
rep("  if(Math.abs(drift)>0.3){el.currentTime=tgt;setClipRate(clipBase);return;}   /* a real jump: move the song */",
    "  const sk=performance.now()-rsClip.skipAt;\n"
    "  if(sk<2000&&Math.abs(drift)>0.06&&!v.seeking&&performance.now()-(rsClip.fixAt||0)>400){rsClip.fixAt=rsClip.skipAt=performance.now();v.currentTime=clipAt(el.currentTime+0.08*el.playbackRate);setClipRate(clipBase);return;}   /* just after a cut: the clip catches up with one quick jump (the song never moves) */\n"
    "  if(Math.abs(drift)>0.3){if(sk<800){setClipRate(clipBase);return;}el.currentTime=tgt;setClipRate(clipBase);return;}   /* a real jump: move the song */")
# the hand-off brings cuts, speed graph and the project's name
rep("      if(loaded&&rec.meta&&rec.meta.song&&rec.meta.song.blob instanceof Blob){",
    "      if(loaded&&rec.meta)rsClipUse(rec.meta);\n      if(loaded&&rec.meta&&rec.meta.song&&rec.meta.song.blob instanceof Blob){")
# one Whole / Upper / Legs setting for both pages
s = s.replace("'rs-mv-cutpart'", "'rs-cutpart'")
assert "'rs-mv-cutpart'" not in s
rep("window.__mv={rsSong,", "window.__mv={rsClip,rsOut,rsIn,rsSlope,rsLookLoad,songAt:t=>songAt(t),rsSong,")

# --- 3. Pulse box: movable and collapsible ---------------------------------------------------------------------------
# It used to sit fixed over the lower part of the video (and ignore touches), covering the dancer and the view controls
# in every mode. Now: drag it anywhere on the video (kept inside it, remembered); tap it to switch between the full box
# and a small badge with just the count. It starts as the badge.
PULSE_CSS = """
.pulse-hud.rs-hud{pointer-events:auto!important;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;transition:opacity .2s}
.pulse-hud.rs-hud.rs-drag{cursor:grabbing;opacity:.85}
.pulse-hud.rs-hud.rs-placed{transform:none!important;bottom:auto!important;right:auto!important}
.pulse-hud.rs-hud.rs-mini{width:auto!important;min-width:0!important;padding:6px 10px!important;border-radius:12px!important}
.pulse-hud.rs-hud.rs-mini .pulse-hud-title small,.pulse-hud.rs-hud.rs-mini #pulse-counts,.pulse-hud.rs-hud.rs-mini .pulse-hud-title>span{display:none!important}
.pulse-hud.rs-hud.rs-mini .pulse-beat-line{gap:0!important;margin:0!important}
.pulse-hud.rs-hud.rs-mini #pulse-current{font-size:22px!important;line-height:1!important;min-width:1.2em;text-align:center}
.pulse-hud.rs-hud .rs-hud-grip{position:absolute;top:4px;right:6px;font-size:10px;letter-spacing:1px;color:#8d96b8;pointer-events:none}
.pulse-hud.rs-hud.rs-mini .rs-hud-grip{display:none}
"""
i = s.rfind('</style>')
s = s[:i] + PULSE_CSS + s[i:]
PULSE_JS = r"""
/* ---- the Pulse box: drag it anywhere on the video, tap to shrink it to the count ---- */
(function(){const hud=document.getElementById('pulse-hud');if(!hud)return;
  hud.classList.add('rs-hud');const grip=document.createElement('span');grip.className='rs-hud-grip';grip.textContent='DRAG · TAP';hud.appendChild(grip);
  let st={mini:true,x:null,y:null};try{const o=JSON.parse(localStorage.getItem('rs-mv-pulsehud')||'null');if(o)st={...st,...o};}catch(e){}
  const keep=()=>{try{localStorage.setItem('rs-mv-pulsehud',JSON.stringify(st));}catch(e){}};
  const place=()=>{hud.classList.toggle('rs-mini',!!st.mini);const par=hud.offsetParent;if(st.x==null||!par){hud.classList.remove('rs-placed');hud.style.removeProperty('left');hud.style.removeProperty('top');return;}
    const pr=par.getBoundingClientRect(),w=hud.offsetWidth,h=hud.offsetHeight;
    const x=Math.max(4,Math.min(pr.width-w-4,st.x*pr.width)),y=Math.max(4,Math.min(pr.height-h-4,st.y*pr.height));
    hud.classList.add('rs-placed');hud.style.setProperty('left',x+'px','important');hud.style.setProperty('top',y+'px','important');
    if(st.mini&&pr.width>0&&pr.height>0){st.x=x/pr.width;st.y=y/pr.height;}};   /* remember where the badge actually is (kept on the video); the full box only moves over to fit while open */
  let drag=null;
  hud.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();const r=hud.getBoundingClientRect();drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:r.left,oy:r.top,moved:false};try{hud.setPointerCapture(e.pointerId);}catch(_){} });
  hud.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.stopPropagation();const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;hud.classList.add('rs-drag');
    const par=hud.offsetParent;if(!par)return;const pr=par.getBoundingClientRect();st.x=(drag.ox+dx-pr.left)/pr.width;st.y=(drag.oy+dy-pr.top)/pr.height;place();});
  const end=e=>{if(!drag||e.pointerId!==drag.id)return;e.stopPropagation();hud.classList.remove('rs-drag');if(!drag.moved){st.mini=!st.mini;}drag=null;place();keep();};
  hud.addEventListener('pointerup',end);hud.addEventListener('pointercancel',end);
  ['click','touchstart','mousedown','wheel'].forEach(ev=>hud.addEventListener(ev,e=>e.stopPropagation(),{passive:ev!=='click'}));
  new MutationObserver(()=>{if(!hud.hidden)place();}).observe(hud,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',place);setTimeout(place,0);
  window.__mvPulseHud={get st(){return st},place};
})();
"""
rep("/* test hook: only with #debug in the address */", PULSE_JS + "\n/* test hook: only with #debug in the address */")

# --- 4. leftover MirrorView name on its dialogs: Riddim Swap · Body ---
s = s.replace('id="modal-eyebrow">MIRRORVIEW<', 'id="modal-eyebrow">RIDDIM SWAP · BODY<')
s = s.replace("'MIRRORVIEW", "'RIDDIM SWAP · BODY")
s = s.replace('>MIRRORVIEW / MOVEMENT STUDIO<', '>RIDDIM SWAP / BODY<')
