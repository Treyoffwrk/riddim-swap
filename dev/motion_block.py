# ---- full screen, swipe between modes, smoother motion, a video bar that is part of the page -----------------------
MOTION_CSS = r"""
/* ===== motion and layout polish ===== */
:root{--spring:cubic-bezier(.32,.72,0,1)}
/* the video bar is part of the page: flush to the top, solid behind the status bar, nothing shows above it */
@media (max-width:860px){
  .pin{top:0!important;padding-top:calc(env(safe-area-inset-top,0px) + 8px)!important;z-index:30!important;border-bottom:1px solid transparent!important;transition:box-shadow .35s var(--spring),border-color .35s}
  .pin::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:100vh;background:var(--bg);pointer-events:none}
  .pin.stuck{border-bottom-color:var(--line)!important;box-shadow:0 14px 28px -18px rgba(0,0,0,.9)}
  .tabs{background:rgba(14,16,20,.82)!important;-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px)}
  .tab::before{transition:background-color .3s var(--spring),transform .35s var(--spring);transform:scaleX(.4)}
  .tab[aria-selected="true"]::before{transform:scaleX(1)}
}
/* presses and changes ease like iOS */
.btn,.tab,.seg button,.chip-src button,.playbtn,.dock button,.tcard{transition:transform .25s var(--spring),background-color .25s,color .25s,border-color .25s,opacity .25s}
.btn:active:not(:disabled),.playbtn:active:not(:disabled),.seg button:active,.dock button:active,.tcard:active{transform:scale(.95)}
@keyframes rs-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes rs-sheet{from{transform:translate(-50%,100%)}to{transform:translate(-50%,0)}}
@keyframes rs-fade{from{opacity:0}to{opacity:1}}
.take:not([hidden]),.start:not([hidden]),.note:not([hidden]),.fitcard:not([hidden]),#songCard:not([hidden]){animation:rs-up .45s var(--spring)}
.sheet:not([hidden]){animation:rs-sheet .45s var(--spring)}
.sheet-back:not([hidden]){animation:rs-fade .3s ease;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.panel{will-change:transform}
.swipe-col{overflow-x:clip}
/* full screen */
.fsbtn{position:absolute;top:8px;right:8px;z-index:6;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(14,16,20,.7);color:#F3F1EC;display:grid;place-items:center;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .25s var(--spring),opacity .3s}
.fsbtn:active{transform:scale(.9)}
.fsbtn svg{width:20px;height:20px}
.fsbtn .ico-exit{display:none}
.pin.fs .fsbtn .ico-exit{display:block}.pin.fs .fsbtn .ico-enter{display:none}
.pin.fs{position:fixed!important;inset:0!important;margin:0!important;z-index:200!important;background:#000!important;display:flex!important;flex-direction:column;gap:0!important;
  padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)!important;border:0!important;box-shadow:none!important;animation:rs-fade .3s ease}
.pin.fs::before{display:none}
.pin.fs .stage{flex:1 1 auto;height:auto!important;aspect-ratio:auto!important;border-radius:0!important;max-height:none}
.pin.fs .transport{position:absolute;left:0;right:0;bottom:0;z-index:7;padding:28px 16px calc(14px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,rgba(0,0,0,.85));transition:opacity .35s var(--spring),transform .35s var(--spring)}
.pin.fs .transport .recrow,.pin.fs #recMsg{display:none!important}
.pin.fs .dock{bottom:96px}
.pin.fs.idle .transport,.pin.fs.idle .fsbtn,.pin.fs.idle .dock{opacity:0;pointer-events:none}
.pin.fs.idle .transport{transform:translateY(12px)}
.pin.fs.idle{cursor:none}
body.rs-fs{overflow:hidden}
@media (prefers-reduced-motion: reduce){
  *,*::before{animation:none!important;transition:none!important}
}
"""
rep("""/* ===== Sound System: the look shared with MirrorView.""", MOTION_CSS + """/* ===== Sound System: the look shared with MirrorView.""")
rep("""          <canvas class="bodycv" id="bodyCanvas" aria-hidden="true"></canvas>""",
"""          <canvas class="bodycv" id="bodyCanvas" aria-hidden="true"></canvas>
          <button class="fsbtn" id="fsBtn" type="button" aria-label="Full screen" hidden><svg class="ico-enter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><svg class="ico-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg></button>""")
# tab changes slide in from the side they come from
rep("""function showTab(t,focus){
  tabs.forEach(x=>{""", """function showTab(t,focus,opt){
  const prevI=tabs.findIndex(x=>x.getAttribute('aria-selected')==='true'), nextI=tabs.indexOf(t);
  if(prevI>=0&&nextI>=0&&prevI!==nextI&&!(opt&&opt.noAnim))panelIn($('#'+t.getAttribute('aria-controls')),nextI>prevI?1:-1,opt&&opt.from);
  tabs.forEach(x=>{""")

MOTION_JS = r"""
/* ---------- motion: panel slide, swipe between modes, stuck video bar, full screen ---------- */
const RM=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function panelIn(p,dir,from){
  if(!p||RM()||!p.animate)return;
  const x0=from!=null?from:dir*36;
  requestAnimationFrame(()=>p.animate([{transform:`translateX(${x0}%)`,opacity:from!=null?1:0.2},{transform:'translateX(0)',opacity:1}],{duration:from!=null?320:420,easing:'cubic-bezier(.32,.72,0,1)'}));
}
/* swipe left or right on the settings to move between Clip, Song, Tempo, Moves and Routine */
(function(){
  const col=$('.tabs').closest('.col'); if(!col)return; col.classList.add('swipe-col');
  const NO='input:not([type=file]):not([type=checkbox]),textarea,select,canvas,video,.tray,.chips,.tl,.seg,.nudges,.sheet,.hitstrip,.spd-graph,[data-noswipe]';
  let sw=null;
  const cur=()=>tabs.findIndex(x=>x.getAttribute('aria-selected')==='true');
  const panelOf=i=>$('#'+tabs[i].getAttribute('aria-controls'));
  col.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||S.rec||$('.pin').classList.contains('fs'))return;
    const t=e.target; if(!t.closest('.panel')||t.closest(NO))return;
    const q=e.touches[0]; sw={x:q.clientX,y:q.clientY,t:performance.now(),mode:null,dx:0,i:cur()};
  },{passive:true});
  col.addEventListener('touchmove',e=>{
    if(!sw)return; const q=e.touches[0], dx=q.clientX-sw.x, dy=q.clientY-sw.y;
    if(!sw.mode){if(Math.abs(dx)<8&&Math.abs(dy)<8)return; sw.mode=Math.abs(dx)>Math.abs(dy)*1.2?'h':'v'; if(sw.mode==='v'){sw=null;return}}
    e.preventDefault();
    const i=sw.i, atEdge=(dx>0&&i<=0)||(dx<0&&i>=tabs.length-1);
    sw.dx=atEdge?dx*0.25:dx;   /* rubber band at the ends */
    const p=panelOf(i); p.style.transition='none'; p.style.transform=`translateX(${sw.dx}px)`;
  },{passive:false});
  const end=()=>{
    if(!sw||sw.mode!=='h'){sw=null;return}
    const {i,dx}=sw, dt=performance.now()-sw.t, vel=Math.abs(dx)/Math.max(1,dt), p=panelOf(i), W=col.clientWidth||360;
    const dir=dx<0?1:-1, j=i+dir, go=j>=0&&j<tabs.length&&(Math.abs(dx)>W*0.22||(vel>0.45&&Math.abs(dx)>30));
    sw=null;
    if(!go){p.style.transition='transform .4s cubic-bezier(.32,.72,0,1)';p.style.transform='translateX(0)';setTimeout(()=>{p.style.transition='';p.style.transform=''},420);return}
    const left=dx/W*100;
    p.style.transition='';p.style.transform='';
    showTab(tabs[j],false,{from:dir*Math.max(30,100-Math.abs(left))});
    if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}
  };
  col.addEventListener('touchend',end); col.addEventListener('touchcancel',end);
})();
/* the video bar gets a hairline and shadow once content scrolls under it */
(function(){const pin=$('.pin');const f=()=>pin.classList.toggle('stuck',(window.scrollY||document.documentElement.scrollTop)>4);window.addEventListener('scroll',f,{passive:true});f()})();
/* full screen playback: the whole video bar (video, body, play and scrub) fills the screen. Uses the browser's
   full screen where it is allowed, and fills the window where it isn't (iPhone Safari, inside other apps). */
(function(){
  const pin=$('.pin'), btn=$('#fsBtn'); let idleT=0;
  const native=()=>document.fullscreenElement||document.webkitFullscreenElement;
  function wake(){pin.classList.remove('idle');clearTimeout(idleT);if(S.playing)idleT=setTimeout(()=>{if(pin.classList.contains('fs')&&S.playing)pin.classList.add('idle')},2600)}
  function enter(){
    if(pin.classList.contains('fs'))return;
    pin.classList.add('fs');document.body.classList.add('rs-fs');btn.setAttribute('aria-label','Exit full screen');wake();
    const rq=pin.requestFullscreen||pin.webkitRequestFullscreen;
    if(rq){try{const r=rq.call(pin,{navigationUI:'hide'});if(r&&r.catch)r.catch(()=>{})}catch(e){}}
    try{screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{})}catch(e){}
  }
  function exit(fromNative){
    if(!pin.classList.contains('fs'))return;
    pin.classList.remove('fs','idle');document.body.classList.remove('rs-fs');btn.setAttribute('aria-label','Full screen');clearTimeout(idleT);
    if(!fromNative&&native()){const ex=document.exitFullscreen||document.webkitExitFullscreen;try{const r=ex.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
    try{screen.orientation&&screen.orientation.unlock&&screen.orientation.unlock()}catch(e){}
  }
  window.rsFullscreen={enter,exit};
  btn.addEventListener('click',e=>{e.stopPropagation();pin.classList.contains('fs')?exit():enter()});
  ['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,()=>{if(!native())exit(true)}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pin.classList.contains('fs'))exit()});
  /* in full screen: tap the video to play or pause; controls fade while playing and come back on touch */
  $('#stage').addEventListener('click',e=>{if(!pin.classList.contains('fs')||e.target.closest('button,label,input'))return;if(pin.classList.contains('idle')){wake();return}$('#play').click();wake()});
  pin.addEventListener('pointermove',()=>{if(pin.classList.contains('fs'))wake()});
  pin.addEventListener('touchstart',()=>{if(pin.classList.contains('fs'))setTimeout(wake,0)},{passive:true});
  setInterval(()=>{btn.hidden=!S.hasV;if(pin.classList.contains('fs')){if(!S.playing)pin.classList.remove('idle');else if(!pin.classList.contains('idle')&&!idleT)wake()}},400);
  $('#play').addEventListener('click',()=>{if(pin.classList.contains('fs'))setTimeout(wake,0)});
})();
"""
rep("""/* test hook: only with #debug in the address */""", MOTION_JS + """/* test hook: only with #debug in the address */""")
