
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let v=$('#vid'); const a=$('#aud'), cv=$('#recCanvas'), cx=cv.getContext('2d');
const S={vr:1,ar:1,offset:0,dBase:null,sBase:null,dAnchor:null,sAnchor:null,cIn:0,cOut:null,loop:false,
  playing:false,hasV:false,hasA:false,stalled:false,rec:null,
  sources:[],cur:null,markSrc:null,
  moves:[],seq:[],useSeq:false,segIdx:0,switchPending:false,markIn:null,markOut:null,markThumb:'',preview:null,
  main:{offset:0,ar:1,vr:1}, rt:{offset:0,ar:1,vr:1,fade:true,set:false,spMode:'all'},
  mainSong:null, rtSong:null, liveSong:null, sel:null, stopAtT:null, primed:null, lastFix:0,
  beatSrc:'detected', variant:null, takeWaiter:null, clickOn:false, fitPer:[], blind:null, avComp:0};
try{S.avComp=+(localStorage.getItem('rs-avcomp')||0)||0}catch(e){}
let uidCount=0;
let srcCount=0,aUrl=null,ctx=null,buf=null,loadIds={main:0,rt:0},take=null,downloads=null,moveCount=0;
let recDest=null,recSrc=null,recT=0,recPos=0;

/* iPhone: play through the silent switch like a music app */
try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
a.preservesPitch=false; a.webkitPreservesPitch=false;

/* rounded first, so 119.97 s reads 2:00.0 (it read 1:60.0) */
const fmt=t=>{if(!isFinite(t))t=0;t=Math.round(t*10)/10;const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)};
const fmt2=t=>{if(!isFinite(t))t=0;t=Math.round(t*100)/100;const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(2)};
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
function getCtx(){if(!ctx){const C=window.AudioContext||window.webkitAudioContext;ctx=new C({latencyHint:'interactive'});
  /* a call, Siri or another app took the sound: drop this engine; a fresh one is made the next time it's needed */
  ctx.onstatechange=()=>{if(ctx&&ctx.state==='interrupted'&&!S.rec)closeCtx()}}return ctx}
function songDur(){return buf?buf.duration:(a.duration||0)}
function songMsg(t,err){const m=$('#songMsg');m.textContent=t;m.classList.toggle('err',!!err)}
function recMsg(t,err){const m=$('#recMsg');m.textContent=t||'';m.hidden=!t;m.classList.toggle('err',!!err)}
function songFail(err){
  if(!err||err.name==='AbortError')return;
  if(err.name==='NotAllowedError')songMsg('The phone blocked the song. Tap play again.',true);
  else songMsg("This file's sound can't play here. Try an MP3, M4A or MP4.",true);
}

/* ---------- play order ----------
   Everything plays as a list of pieces of the dance video ("segments").
   Whole clip = one piece (start point to end point). Routine = the saved moves in order.
   Each piece has its own speed r. T = position in that list in playback seconds; the song follows T. */
function clipEnd(){return S.cOut!=null?S.cOut:(v.duration||0)}
function moveById(id){return S.moves.find(m=>m.id===id)}
function routineOn(){return S.useSeq&&S.seq.length>0&&!S.preview}
/* a clip with parts cut out plays as its kept pieces, back to back (the song keeps going) */
function clipCut(){if(routineOn()||S.preview||S.study)return false;const n=srcById(S.cur);return !!(n&&n.pieces&&n.pieces.some(p=>!p.on))}
function segMode(){return routineOn()||clipCut()}
function keptRanges(n){const a=S.cIn,b=clipEnd(),out=[];for(const p of n.pieces||[]){if(!p.on)continue;const s=Math.max(a,p.s),e=Math.min(b,p.e);if(e-s<0.05)continue;const l=out[out.length-1];if(l&&Math.abs(l[1]-s)<1e-3)l[1]=e;else out.push([s,e])}return out}
function segs(){
  if(S.preview)return [S.preview];
  if(routineOn())return S.seq.map(x=>segOf(x)).filter(Boolean);
  if(S.study){const n=srcById(S.cur),g={src:S.cur,s:S.study.a,e:S.study.b,r:S.vr*S.study.rate};
    /* with a speed graph, the slowed stretch follows the graph too (its output times stretched by the Study speed) */
    const k=n&&curveKnots(n,{src:S.cur,s:S.study.a,e:S.study.b,r:S.vr});if(k)g.k=k.map(([s,o])=>[s,o/S.study.rate]);return [g]}
  const n0=srcById(S.cur);
  if(clipCut()){const K=keptRanges(n0);if(K.length)return K.map(([s,e])=>{const g={src:S.cur,s,e,r:S.vr};const k=curveKnots(n0,g);if(k)g.k=k;return g})}
  const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}; const k=curveKnots(n0,g); if(k)g.k=k;
  return [g];
}
/* a routine move as a playable piece. k = time-warp knots [[source, output-from-start]...] when aligned */
function warpOk(x){
  return S.rt.alignOn===true&&!(S.variant&&S.variant.noWarp)&&x.warp&&x.warp.length>1&&Math.abs((x.warpR||0)-rateOf(x))<1e-6
    &&Math.abs(x.warp[0][0]-x.s)<1e-3&&Math.abs(x.warp[x.warp.length-1][0]-x.e)<1e-3;
}
function segOf(x,noWarp){const m=moveById(x.id);if(!m)return null;const g={src:m.src,s:x.s,e:x.e,r:rateOf(x)};if(!noWarp&&warpOk(x))g.k=x.warp;return g}
function segLen(g){return g.k?g.k[g.k.length-1][1]:(g.e-g.s)/segR(g)}
function toOut(g,t){
  if(!g.k)return clamp(t-g.s,0,g.e-g.s)/segR(g);
  const k=g.k; if(t<=k[0][0])return 0;
  for(let i=1;i<k.length;i++)if(t<=k[i][0]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return o1+(t-s1)*(o2-o1)/((s2-s1)||1)}
  return k[k.length-1][1];
}
function toSrc(g,o){
  if(!g.k)return g.s+clamp(o*segR(g),0,g.e-g.s);
  const k=g.k; if(o<=0)return k[0][0];
  for(let i=1;i<k.length;i++)if(o<=k[i][1]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return s1+(o-o1)*(s2-s1)/((o2-o1)||1)}
  return k[k.length-1][0];
}
function rateAt(g,t){
  if(!g||!g.k)return segR(g);
  const k=g.k; for(let i=1;i<k.length;i++)if(t<k[i][0]-1e-4||i===k.length-1){const [s1,o1]=k[i-1],[s2,o2]=k[i];return clamp((s2-s1)/((o2-o1)||1),0.2,4)}
  return segR(g);
}
/* speed of one routine move: shared, or its own when "Each move" is on */
function rateOf(x){return S.rt.spMode==='each'?(x.sp||1):S.rt.vr}
function segR(g){return g&&g.r||S.vr||1}
function curRate(){const g=segs()[S.segIdx];return g?rateAt(g,v.currentTime):S.vr}
function srcById(id){return S.sources.find(x=>x.id===id)}
/* Make one video the visible, playing one. Each video keeps its own start/end points. */
function activate(id){
  const n=srcById(id); if(!n||n.id===S.cur)return;
  if(S.study)studyOff();
  const old=srcById(S.cur); if(old){old.cIn=S.cIn;old.cOut=S.cOut}
  const prevEl=v; S.cur=n.id; v=n.el;
  S.cIn=n.cIn||0; S.cOut=n.cOut??null;
  v.playbackRate=S.vr; v.muted=!$('#origAudio').checked;
  showOnly(n.el);
  if(prevEl!==v){try{prevEl.pause()}catch(e){}}
  if(S.rec&&S.rec.mode==='codecs')watchFrames(v);
  $('#vidName').textContent=n.name+(n.dur?' · '+fmt(n.dur):'');
  renderSources(); updateTrim();
}
/* Each video can have a second, hidden copy. The next move is loaded into it ahead of time,
   so the cut is an instant swap instead of a seek (seeking is what caused the stutter). */
function allEls(){const out=[];S.sources.forEach(x=>{out.push(x.el);if(x.el2)out.push(x.el2)});return out}
function showOnly(e){allEls().forEach(x=>{x.hidden=false;x.classList.toggle('off',x!==e)})}
function ensureEl2(n){
  if(!n.el2){const e=document.createElement('video');e.setAttribute('playsinline','');e.muted=true;e.preload='auto';e.classList.add('off');e.src=n.url;$('#stage').insertBefore(e,$('#empty'));wire(e);n.el2=e}
  return n.el2;
}
function swapTo(e,srcId){
  const n=srcById(srcId), prev=v;
  if(S.cur!==srcId){const old=srcById(S.cur);if(old){old.cIn=S.cIn;old.cOut=S.cOut}S.cIn=n.cIn||0;S.cOut=n.cOut??null;S.cur=srcId;try{CUT.sel=null;if(CUT.tl)CUT.tl.fitted=false}catch(e){}$('#vidName').textContent=n.name+(n.dur?' · '+fmt(n.dur):'');renderSources()}
  const cg=segs()[S.segIdx]; v=e; e.playbackRate=cg?rateAt(cg,cg.s):S.vr; e.muted=!$('#origAudio').checked;
  showOnly(e);
  if(S.playing||S.rec)e.play().catch(()=>{});
  if(prev!==e){try{prev.pause()}catch(_){}}
  if(S.rec&&S.rec.mode==='codecs')watchFrames(e);
}
function primeNext(){
  S.primed=null;
  if(!segMode()||!(S.playing||S.rec))return;
  const L=segs(); let i=S.segIdx+1;
  if(i>=L.length){if(S.loop&&!S.rec)i=0;else return}
  if(S.stopAtT!=null&&segStart(i,L)>=S.stopAtT-0.02)return;
  const g=L[i], n=srcById(g.src); if(!n)return;
  let e=n.el; if(e===v)e=ensureEl2(n); if(e===v)return;
  /* park it a little before the move's first frame; it starts playing (hidden) that long before the cut */
  const pre=Math.min(S.preroll||0.12,Math.max(0,g.s)), park=g.s-pre*rateAt(g,g.s);
  e.playbackRate=rateAt(g,g.s); e.muted=true;
  if(e.readyState<2){
    const p=e.play(); if(p)p.then(()=>{if(e!==v){e.pause();e.currentTime=park}}).catch(()=>{});
  } else {
    try{e.pause()}catch(_){}
    if(Math.abs(e.currentTime-park)>0.03)e.currentTime=park;
  }
  S.primed={i,el:e,park,pre,started:false};
}
function segStart(i,L){let t=0;for(let k=0;k<i;k++)t+=segLen(L[k]);return t}
function tPos(){const L=segs(),i=Math.min(S.segIdx,L.length-1),g=L[i];if(!g)return 0;return segStart(i,L)+toOut(g,v.currentTime)}
/* Study and Learn: the song goes where it would be in normal playback at this moment of the clip: after any parts cut
   out, through the speed graph. (They used start + time / speed, so on a clip with a part cut out the song was off by
   the length of that part, all through Learn.) */
function normSegs(){const st=S.study;S.study=null;try{return segs()}finally{S.study=st}}
function clipToSong(t){const L=normSegs();if(!L.length)return S.offset+((t-S.cIn)/S.vr+(S.avComp||0))*S.ar;
  const n=L.length,tot=segStart(n,L),f=x=>S.offset+(x+(S.avComp||0))*S.ar;
  if(t<L[0].s)return f((t-L[0].s)/segR(L[0]));if(t>L[n-1].e)return f(tot+(t-L[n-1].e)/segR(L[n-1]));   /* before / after the clip: carried on at its speed */
  let i=L.findIndex(g=>t>=g.s-1e-3&&t<=g.e+1e-3);if(i<0){i=L.findIndex(g=>g.s>t);if(i<0)i=n-1;t=Math.min(Math.max(t,L[i].s),L[i].e)}
  return f(segStart(i,L)+toOut(L[i],t))}
function songToClip(s){const L=normSegs(),T=(s-S.offset)/S.ar-(S.avComp||0);if(!L.length)return S.cIn+T*S.vr;
  const n=L.length,tot=segStart(n,L);if(T<0)return L[0].s+T*segR(L[0]);if(T>tot)return L[n-1].e+(T-tot)*segR(L[n-1]);
  let i=0;while(i<n-1&&T>=segStart(i+1,L))i++;return toSrc(L[i],Math.max(0,T-segStart(i,L)))}
function expected(){if(S.study)return clipToSong(v.currentTime);return S.offset+(S.variant&&S.variant.shift||0)+(tPos()+(S.avComp||0))*S.ar}
function gotoSeg(i){
  const g=segs()[i]; S.segIdx=i; if(!g)return;
  const P=S.primed; S.primed=null;
  if(P&&P.i===i&&P.el!==v&&(S.playing||S.rec)&&P.el.readyState>=2&&!P.el.seeking&&P.el.currentTime>=g.s-0.06&&P.el.currentTime<g.s+0.15){
    swapTo(P.el,g.src); S.switchPending=false; S.cutAt=performance.now(); primeNext(); return;
  }
  gotoSegSeek(i,g); primeNext();
}
function gotoSegSeek(i,g){
  if(g.src&&g.src!==S.cur){
    const live=S.playing||S.rec;
    activate(g.src); v.playbackRate=rateAt(g,g.s); S.switchPending=true; v.currentTime=g.s;
    if(live){v.play().catch(()=>{})}
    return;
  }
  v.playbackRate=rateAt(g,g.s);
  if(Math.abs(v.currentTime-g.s)>0.04){S.switchPending=true;v.currentTime=g.s}else S.switchPending=false;
}
function toStart(){gotoSeg(0)}
function seekT(T){
  const L=segs(); let i=0;
  while(i<L.length-1&&T>=segStart(i+1,L))i++;
  S.segIdx=i; S.switchPending=false; if(L[i].src&&L[i].src!==S.cur)activate(L[i].src);
  const src=toSrc(L[i],T-segStart(i,L)); v.playbackRate=rateAt(L[i],src); v.currentTime=src;
  primeNext();
}
function atSegEnd(){
  const L=segs();
  if(S.segIdx<L.length-1){gotoSeg(S.segIdx+1);return}
  if(S.rec){stopRecording();return}
  if(S.preview){S.preview=null;pause();toStart();renderMoves();return}
  if(S.loop){if(S.learn)learnLoopDone();toStart();if(S.study&&S.playing){alignedStart();return}if(v.paused)v.play().catch(()=>{});syncSong(true)}
  else{pause();toStart()}
}

/* ---------- two sets of settings ----------
   Whole clip uses the Song/Clip tabs. The routine has its own song, song start and speeds,
   so tuning single clips never changes how the finished routine sounds. */
function slot(){return routineOn()?S.rt:S.main}
function liveSongWanted(){return (routineOn()&&S.rtSong)?S.rtSong:S.mainSong}
function useSong(so){
  S.liveSong=so; buf=so&&so.buf||null; S.hasA=!!(so&&so.ready); S.sAnchor=null;
  if(so&&so.blob)setSongSrc(so.blob); else {a.removeAttribute('src');try{a.load()}catch(e){}}
  enable(); prepRec();
}
function syncSlot(){
  const want=liveSongWanted(); if(want!==S.liveSong)useSong(want);
  const P=slot();
  if(P.offset!==S.offset||P.ar!==S.ar||P.vr!==S.vr){S.offset=P.offset;S.ar=P.ar;S.vr=P.vr;applyRates()}
  showSlots();
}
function setP(P,key,val){
  P[key]=val; if(P===S.rt)S.rt.set=true;
  if(P===slot()){S[key]=val; if(key==='offset'){syncSong(true);recSync(true)} else applyRates()}
  showSlots(); if(key==='vr')updateSeqStats();
}
function sDur(so){return so?(so.buf?so.buf.duration:(so.dur||0)):0}
function showSlots(){
  const m=S.main, r=S.rt, md=sDur(S.mainSong), rd=sDur(S.rtSong||S.mainSong);
  const set=(id,val)=>{const e=$(id);if(document.activeElement!==e)e.value=val};
  $('#offset').max=Math.max(1,md); set('#offset',m.offset); $('#offOut').textContent=fmt2(m.offset);
  set('#aRate',m.ar); $('#aRateOut').textContent='×'+m.ar.toFixed(2);
  set('#vRate',m.vr); $('#vRateOut').textContent='×'+m.vr.toFixed(2);
  spdShow();
  $('#rOffset').max=Math.max(1,rd); set('#rOffset',r.offset); $('#rOffOut').textContent=fmt2(r.offset);
  set('#rARate',r.ar); $('#rARateOut').textContent='×'+r.ar.toFixed(2);
  set('#rVRate',r.vr); $('#rVRateOut').textContent='×'+r.vr.toFixed(2);
  $('#rFade').checked=!!r.fade;
  const miss=so=>so&&so.missing?' · needs re-adding':'';
  $('#audName').textContent=S.songLoading?'Loading '+S.songLoading+'…':S.mainSong?S.mainSong.name+(md?' · '+fmt(md):'')+miss(S.mainSong):'No song yet';
  $('#audName').classList.toggle('loading',!!S.songLoading);
  $('#rSongName').textContent=S.rtSong?S.rtSong.name+(sDur(S.rtSong)?' · '+fmt(sDur(S.rtSong)):'')+miss(S.rtSong):(S.mainSong?'Same song as the Song tab':'No song yet');
  $('#rSongReset').hidden=!S.rtSong;
  scheduleFit();
}

/* ---------- playback: the song plays through a normal audio player (reliable on iPhone) ---------- */
function setRate(r){if(Math.abs(a.playbackRate-r)>0.002)a.playbackRate=r}
/* Moving the song makes it pause briefly while it seeks, so it lands late. Aim ahead by this phone's delay,
   check ~0.4 s later where it actually is, and learn. */
try{const sl=localStorage.getItem('rs-seeklead');if(sl!=null)S.seekLead=+sl}catch(e){}
function songLead(){return S.seekLead==null?0.06:S.seekLead}
function seekSong(e){a.currentTime=Math.max(0,e+songLead()*S.ar);S.seekCheck={at:performance.now()};S.songClk=null}
/* Playback sync (not while recording):
   The song used to follow the video by jumping: drift over 80 ms meant a jump (at most every 1.5 s), and after every
   jump a check 0.4 s later jumped again if it was still 30 ms off. When the video ran a little slow (a warm phone, a
   long session) that became a chain of jumps every 0.4 s: the song cut out and crackled. Now the song plays on
   untouched and the video's speed is nudged (up to ±6%, which you can't see) until they line up. The song only jumps
   for real seeks: pressing play, scrubbing, or drift past 0.35 s (0.5 s in a routine). Recording keeps its own,
   measured path. */
function vNudged(r){return S.rec?r:r*(1+(S.vNudge||0))}
function syncSong(force){
  if(!S.hasA||!S.hasV)return;
  if(!S.rec)return syncSteady(force);
  const e=expected(), d=songDur(), live=S.playing&&!v.paused&&!S.stalled;
  if(!live||e<0||e>=d){
    if(!a.paused)a.pause();
    if(!live&&e>=0&&e<d&&Math.abs(a.currentTime-e)>0.03)a.currentTime=e;
    return;
  }
  if(a.paused){seekSong(e);setRate(S.ar);a.play().catch(songFail);return}
  setRate(S.ar);
  const drift=a.currentTime-e, now=performance.now();
  if(S.seekCheck&&now-S.seekCheck.at>400&&!a.seeking&&!S.switchPending&&!v.seeking&&a.readyState>=3){
    S.seekLead=clamp(songLead()-0.8*drift/S.ar,0,0.4); S.seekCheck=null;
    try{localStorage.setItem('rs-seeklead',String(S.seekLead))}catch(err){}
    if(Math.abs(drift)>0.03){S.lastFix=now;S.driftEma=0;seekSong(e);return}
  }
  if(force){S.lastFix=now;S.driftEma=0;seekSong(e);return}
  if(S.seekCheck)return;   /* wait until the last move has landed */
  /* smooth the measured drift so one late frame or a cut doesn't trigger a jump */
  /* ignore the half second after a cut: the new move is still settling */
  const afterCut=now-(S.cutAt||0)<600;
  if(!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut)S.driftEma=0.85*(S.driftEma||0)+0.15*drift;
  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut&&now-S.lastFix>1500;
  /* just after pressing play the song often starts late; nudging it now (while it is only just starting) can't be heard */
  if(now-(S.playAt||0)<900&&Math.abs(drift)>0.03&&!a.seeking&&a.readyState>=3&&!S.switchPending&&now-(S.earlyFix||0)>200){S.earlyFix=now;S.driftEma=0;seekSong(e);return}
  /* a big jump (user seek): fix at once; a steady offset above 80 ms (e.g. the sound starting late): fix once it's clear */
  if((Math.abs(drift)>(segMode()?0.4:0.25)&&settled)||(Math.abs(S.driftEma)>0.08&&settled)){S.lastFix=now;S.driftEma=0;seekSong(e)}
}

/* ---- Aligned start (Study and Learn): every loop and every new speed starts with both stopped and in place; the song
   starts first and the video only when the song is really moving, at the song's spot. Starting both at once, a phone's
   song player takes a moment to sound after a seek while the video is already moving, so the song came in late at
   every loop and was then pulled back with jumps (Learn loops every few seconds). ---- */
function alignedStart(){
  if(!S.hasA||!S.hasV||!S.liveSong||!S.liveSong.ready){if(v.paused)v.play().catch(()=>{});syncSong(true);return}
  const id=S.alignId=(S.alignId||0)+1,t0=performance.now();S.aligning={at:t0};
  v.pause();a.pause();
  const e=expected()+(S.sndDelay||0)*S.ar;try{seekSong(Math.max(0,e))}catch(err){}setRate(songRate());
  const g=segs()[S.segIdx];if(g){const r=vNudged(rateAt(g,v.currentTime));v.playbackRate=r}
  const ready=el=>new Promise(r=>{if(!el.seeking&&el.readyState>=2)return r();let done=false;const f=()=>{if(!done){done=true;r()}};el.addEventListener('seeked',f,{once:true});el.addEventListener('canplay',f,{once:true});setTimeout(f,700)});
  const gone=()=>id!==S.alignId||!S.playing||!S.study;
  Promise.all([ready(v),ready(a)]).then(()=>{
    if(gone()){if(id===S.alignId)S.aligning=null;return}
    const a0=a.currentTime,st=performance.now();a.play().catch(songFail);
    const wait=()=>{
      if(gone()){if(id===S.alignId)S.aligning=null;return}
      const moving=!a.paused&&a.currentTime>a0+0.004;
      if(moving||performance.now()-st>1000){
        /* the video goes where the song is now (with the sound delay), then plays */
        const sd=S.sndDelay||0,t=songToClip(a.currentTime-sd*S.ar);
        if(moving&&S.study&&t>=S.study.a&&t<S.study.b&&Math.abs(t-v.currentTime)>0.02){S.catchUp=performance.now();v.currentTime=t}   /* our own move: the song stays put when it lands */
        v.play().catch(()=>{});S.aligning=null;S.songClk=null;S.songStuck=0;S.driftEma=0;S.vI=0;S.lastFix=performance.now();
        const L=S.alignLog||(S.alignLog=[]);L.push({wait:Math.round(performance.now()-st),seek:Math.round(st-t0),moving});if(L.length>40)L.shift();
        if(S.snd)S.snd.aligned=(S.snd.aligned||0)+1}
      else requestAnimationFrame(wait)};
    requestAnimationFrame(wait)})}

/* put the video where the song is (the inverse of expected(), with the sound delay) */
function videoToSong(){
  const sd=S.sndDelay||0, base=S.offset+(S.variant&&S.variant.shift||0);
  S.catchUp=performance.now();
  if(S.study){const t=songToClip(a.currentTime-sd*S.ar);if(t>=S.study.a&&t<S.study.b)v.currentTime=t;return}
  const T=(a.currentTime-base)/S.ar-(S.avComp||0)-sd, L=segs(), tot=segStart(L.length,L);
  if(T<0||T>=tot-0.05)return;
  seekT(T);
}
function syncSteady(force){
  if(S.aligning){if(performance.now()-S.aligning.at<2500)return;S.aligning=null}
  const e=expected()+(S.rec?0:(S.sndDelay||0)*S.ar), d=songDur(), live=S.playing&&!v.paused&&!S.stalled, now=performance.now(), snd=S.snd||(S.snd={jumps:0,maxLate:0,frames:0,within:0,started:now});
  const setV=n=>{S.vNudge=n;const g=segs()[S.segIdx];if(!g||S.switchPending)return;const r=vNudged(rateAt(g,v.currentTime));if(Math.abs(v.playbackRate-r)>0.006)v.playbackRate=r};
  if(!live||e<0||e>=d){
    S.songClk=null;S.songStuck=0;
    if(S.vNudge)setV(0);
    if(!a.paused)a.pause();
    if(!live&&e>=0&&e<d&&Math.abs(a.currentTime-e)>0.03)a.currentTime=e;
    return;
  }
  if(a.paused){seekSong(e);setRate(songRate());a.play().catch(songFail);S.lastFix=now;S.driftEma=0;S.vI=0;setV(0);return}
  setRate(songRate());
  if(!force&&(S.scrubbing||now-(S.userSeekAt||0)<700)){S.driftEma=0;S.songClk=null;return}   /* you're moving the bar: the song follows you, never the other way */
  const drift=a.currentTime-e;   /* + = song ahead of the video */
  const busy=S.switchPending||v.seeking||a.seeking||now-(S.cutAt||0)<400;
  /* right after a jump: learn how late the song lands (once), never jump again for small errors */
  if(S.seekCheck&&now-S.seekCheck.at>400&&!busy&&a.readyState>=3){
    if(Math.abs(drift)<0.25){S.seekLead=clamp(songLead()-0.8*drift/S.ar,0,0.4);try{localStorage.setItem('rs-seeklead',String(S.seekLead))}catch(err){}}
    S.seekCheck=null;
  }
  if(force){S.lastFix=now;S.driftEma=0;snd.jumps++;seekSong(e);setV(0);return}
  /* is the song's clock moving? On a phone it can stop (the sound may even carry on) while the song reports it's playing.
     Following a stuck clock dragged the video back to the same spot every second: a loop you couldn't stop. So while
     the clock is stuck the video plays on by itself; the song is nudged to the video once, and a note says what's up. */
  if(!a.seeking&&!busy){const c=S.songClk;
    if(!c||now-c.t>2000){S.songClk={t:now,at:a.currentTime}}
    else if(now-c.t>=500){const adv=(a.currentTime-c.at)/((now-c.t)/1000),stuck=adv<0.3*(a.playbackRate||1);
      S.songStuck=stuck?(S.songStuck||0)+1:0;S.songClk={t:now,at:a.currentTime};
      if(stuck){snd.songStuck=(snd.songStuck||0)+1;
        if(S.songStuck===2){S.lastFix=now;S.driftEma=0;seekSong(e);if(a.paused)a.play().catch(songFail)}
        /* still stuck after 3 s: give the song player a fresh start, once per play, at the video's spot (no tap needed);
           only if that doesn't help, say so */
        if(S.songStuck===6&&!S.songHealed&&!S.songHealing&&S.liveSong&&S.liveSong.blob){S.songHealing=true;S.songHealed=true;snd.healed=(snd.healed||0)+1;S.songHealN=(S.songHealN||0)+1;const so=S.liveSong;setSongSrc(so.blob);
          a.addEventListener('loadedmetadata',()=>{S.songHealing=false;if(!S.playing)return;try{seekSong(expected())}catch(err){}setRate(songRate());a.play().catch(songFail);S.songClk=null;S.songStuck=0},{once:true})}
        else if(S.songStuck===6&&S.songHealed&&!S.songHealing&&!S.songStuckSaid){S.songStuckSaid=true;recMsg("The song stopped keeping time on this phone, so the video plays on by itself. Tap pause, then play, to line them up again.",true)}}}}
  if(S.songStuck){if(S.vNudge)setV(0);return}
  if(S.seekCheck||busy)return;
  S.driftEma=0.8*(S.driftEma||0)+0.2*drift;
  snd.frames++;if(Math.abs(drift)<0.04)snd.within++;snd.maxLate=Math.max(snd.maxLate,Math.abs(drift));
  const limit=segMode()?0.5:0.35;
  /* far out: move the VIDEO to the song, never the song. On iPhone every song jump is ~0.4 s of silence, and if the
     video keeps falling behind (a busy phone) the song would cut out over and over; a video catching up a few frames is
     much less noticeable than the music stopping. */
  if(Math.abs(S.driftEma)>limit&&now-S.lastFix>1200){S.lastFix=now;S.driftEma=0;snd.vjumps=(snd.vjumps||0)+1;videoToSong();S.vI=0;setV(0);return}
  /* steady: nudge the video, in 0.5% steps so its speed isn't changed every frame */
  /* proportional plus a slow learned part, so a video that runs steadily slow ends up exactly in time, not 40 ms off */
  S.vI=clamp((S.vI||0)+0.015*S.driftEma,-0.05,0.05);
  let n=clamp(0.8*S.driftEma+S.vI,-0.06,0.06);if(Math.abs(n)<0.004)n=0;n=Math.round(n*200)/200;
  setV(n);   /* also restores the nudge after a cut set the plain speed */
}
/* The song's play() has to happen inside the tap, or the phone keeps it silent. */
function unlockSong(){
  if(!S.hasA)return;
  const e=S.hasV?expected():a.currentTime;
  if(!S.hasV||(e>=0&&e<songDur())){
    if(S.hasV)seekSong(e);
    setRate(S.ar); a.play().catch(songFail);
  } else {
    a.muted=true; const p=a.play();
    if(p)p.then(()=>{if(!(S.playing&&expected()>=0))a.pause();a.muted=false}).catch(()=>{a.muted=false});
  }
}
function setPlaying(p){
  S.playing=p;
  /* SVG elements have no .hidden property (setting it did nothing, so the button always showed play): use the attribute */
  $('#icoPlay').toggleAttribute('hidden',p); $('#icoPause').toggleAttribute('hidden',!p);
  $('#play').setAttribute('aria-label',p?'Pause':'Play');
}
function play(){
  S.playAt=performance.now(); S.songClk=null; S.songStuck=0; S.songStuckSaid=false; S.songHealed=false; S.songHealing=false; if(S.snd&&S.snd.frames>10){S.snd.endAt=S.snd.endAt||performance.now();S.sndLast=S.snd} S.snd={jumps:0,maxLate:0,frames:0,within:0,started:performance.now()}; S.vNudge=0; S.vI=0;
  /* the beat click needs the live engine, started inside the tap */
  if(S.clickOn){try{const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{})}catch(e){}}
  if(S.hasV&&broken(v)){healMedia(false);recMsg('Reloading the video… tap play again.');return}
  if(routineOn()){const gone=S.seq.map(x=>moveById(x.id)).filter(m=>m&&srcById(m.src)&&srcById(m.src).missing);
    if(gone.length){recMsg('Re-add "'+srcById(gone[0].src).name+'" first. Tap Projects.',true);return}}
  if(S.hasV&&!S.rec){
    const L0=segs(), g=L0[S.segIdx];
    if(!g||(g.src&&g.src!==S.cur)||v.currentTime<g.s-0.05||v.currentTime>=g.e-0.05){
      const j=clipCut()?L0.findIndex(q=>v.currentTime>=q.s-0.02&&v.currentTime<q.e-0.05):-1;
      if(j>=0){S.segIdx=j;primeNext()}else toStart()}
  }
  setPlaying(true);
  if(S.hasA&&!S.hasV&&a.ended)a.currentTime=0;
  unlockSong();
  if(S.hasV&&S.study&&!S.rec&&S.hasA){S.stalled=false;alignedStart();return}
  if(S.hasV)v.play().then(()=>{S.stalled=false;syncSong(true);recSync(true);primeNext()}).catch(err=>{setPlaying(false);a.pause();
    if(!err||err.name!=='AbortError'){if(healMedia(false))recMsg('Reloaded the video. Tap play again.')}});
}
function pause(){S.stopAtT=null;S.aligning=null;S.alignId=(S.alignId||0)+1;if(S.snd&&!S.snd.endAt&&S.playing)S.snd.endAt=performance.now();setPlaying(false);v.pause();a.pause();recStopSong()}
function toggle(){if(S.rec){stopRecording();return}
  if(PR.cd){prCdCancel();return}   /* a tap during the countdown cancels it */
  if(!S.playing&&prCdWanted()){prCdStart();return}
  S.playing?pause():play()}
/* Countdown (Practice with your camera): 3 or 5 seconds to step back into place before the clip starts. The song is
   primed inside the tap (a muted play and pause) so it may start by itself when the count ends. */
function prCdWanted(){return PR.on&&!!PR.stream&&PR.count>0&&!PR.replay&&PR.mode!=="world"&&PR.hold==null}
function primeSong(){if(!S.hasA||!a.paused)return;a.muted=true;const p=a.play();if(p)p.then(()=>{if(!S.playing)a.pause();a.muted=false}).catch(()=>{a.muted=false});else a.muted=false}
/* Voice: says the countdown and, after a Close or Miss, the main thing to fix (at most one every 2.5 s, so it never
   talks over itself). The first word is said inside a tap, which phones need before a page may speak. */
function say(t){if(!PR.voice||!t||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
  try{const u=new SpeechSynthesisUtterance(t);u.rate=1.05;u.volume=1;u.lang='en-GB';speechSynthesis.cancel();speechSynthesis.speak(u);PR.saidAt=performance.now();PR.said=(PR.said||[]).concat([t]).slice(-30)}catch(e){}}
function prCdStart(){primeSong();PR.cd={end:performance.now()+PR.count*1000,n:PR.count};say(String(PR.count));$('#pracRes').hidden=true;prMsg('Get into place…')}
function prCdCancel(){PR.cd=null;try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}pracStatus()}

function enable(){
  const hv=S.hasV;
  $('#play').disabled=!(hv||S.hasA);
  ['#scrub','#inRange','#setOut','#clearOut','#repeat','#markIn','#markOut'].forEach(id=>$(id).disabled=!hv);
  spdShow(); if(!hv){$('#spdStrip').hidden=true;$('#spdBtn').setAttribute('aria-expanded','false')}
  $$('[data-in]').forEach(b=>b.disabled=!hv);
  $('#recBtn').disabled=!(hv&&S.hasA&&buf);
  {const bn=srcById(S.cur);$('#bodyTrack').disabled=!(bn&&!bn.missing&&bn.url)||!!S.bodyBusy;$('#bodyTrack').textContent=bn&&cpOf(bn)&&!S.bodyBusy?'Carry on tracking':bn&&bodyOf(bn)?'Track again':'Track body';$('#bodyFresh').hidden=!(bn&&cpOf(bn))||!!S.bodyBusy}
  const cn=srcById(S.cur); $('#danceAnalyze').disabled=!(cn&&!cn.missing)||!!S.analyzing; renderDance();
  updateCutter();
}

function applyRates(){
  v.playbackRate=curRate();
  if(S.hasV){syncSong(true);recSync(true)} else setRate(S.ar);
  updateMatch();
}

/* ---------- dance videos (several can be loaded; moves can come from any of them) ---------- */
function wire(el){
  const me=()=>el===v;
  el.addEventListener('loadedmetadata',()=>{
    const n=S.sources.find(x=>x.el===el||x.el2===el); if(n)srcDur(n,el.duration);
    if(n&&n.el2===el)return;
    try{el.currentTime=Math.max(0.001,n&&n.cIn||0)}catch(e){}   /* makes iPhone draw the first frame */
    if(!me())return;
    v.playbackRate=curRate(); prepRec();
    if(n)$('#vidName').textContent=n.name+' · '+fmt(n.dur);
    renderSources(); updateTrim(); applyRates();
  });
  /* iPhone can report a short length first and grow it while the video loads: follow it, and keep the strip in step */
  el.addEventListener('durationchange',()=>{
    const n=S.sources.find(x=>x.el===el||x.el2===el);if(!n||!(el.readyState>=1))return;const d0=n.dur;srcDur(n,el.duration);
    if(Math.abs(n.dur-d0)>0.05&&me()){if(n.pieces)piecesOf(n);$('#vidName').textContent=n.name+' · '+fmt(n.dur);updateTrim();try{TL.redrawAll()}catch(e){}}
  });
  el.addEventListener('error',()=>{
    const n=S.sources.find(x=>x.el===el||x.el2===el);
    if(n&&n.blob&&n.errs<2){n.errs++;refreshSource(n);return}
    if(me())$('#vidName').textContent="This video can't play here";
  });
  el.addEventListener('seeked',()=>{if(me()&&!S.aligning){const user=performance.now()-(S.userSeekAt||0)<1200;if(user){S.catchUp=0;S.driftEma=0;syncSong(true)}else if(S.catchUp&&performance.now()-S.catchUp<1500){S.catchUp=0;syncSong(false)}else syncSong(!segMode());recSync(true)}});   /* our own catch-up seek doesn't move the song */
  /* a short video hiccup no longer stops the song (that was a cut-out); only a stall over 0.6 s pauses it */
  el.addEventListener('waiting',()=>{if(!me()||S.switchPending||segMode())return;
    if(S.rec){S.stalled=true;a.pause();recStopSong();return}
    /* the song keeps going through a video stall (stopping it is what you hear); the video catches up when it resumes */
    clearTimeout(S.stallTimer);S.stallTimer=setTimeout(()=>{if(me()&&el.readyState<3&&S.playing){if(S.snd)S.snd.stalls=(S.snd.stalls||0)+1}},600)});
  el.addEventListener('playing',()=>{if(me()){clearTimeout(S.stallTimer);S.stalled=false;syncSong(false);recSync(true)}});
  el.addEventListener('pause',()=>{if(me()&&S.playing&&!el.ended&&!S.rec&&!S.switchPending)pause()});
  el.addEventListener('ended',()=>{if(!me()||!(S.playing||S.rec))return;atSegEnd();if((S.playing||S.rec)&&v.paused)v.play().catch(()=>{})});
}
wire(v);
function mediaKey(f){return f.name+'|'+f.size+'|'+(f.lastModified||0)}
/* make a video slot; f can be null when restoring a project whose file isn't on this phone */
/* a clip's length: a copy the app made itself knows its exact length (kd), whatever the player says while it loads */
function srcDur(n,d){if(n.kd>0){n.dur=n.kd;return}if(isFinite(d)&&d>0)n.dur=d}
function createSource(f,meta){
  meta=meta||{};
  const vid=$('#vid'); let ve;
  if(!S.sources.some(x=>x.el===vid))ve=vid;
  else{ve=document.createElement('video');ve.setAttribute('playsinline','');ve.muted=true;ve.preload='auto';ve.classList.add('off');$('#stage').insertBefore(ve,$('#empty'));wire(ve)}
  const num=meta.num||++srcCount; if(num>srcCount)srcCount=num;
  const n={id:meta.id||('v'+num),num,el:ve,url:null,cIn:meta.cIn||0,cOut:meta.cOut??null,dur:0,pieces:Array.isArray(meta.pieces)?meta.pieces.map(p=>p.rev?{s:+p.s,e:+p.e,on:!!p.on,rev:true}:{s:+p.s,e:+p.e,on:!!p.on}):null,
    name:meta.name||(f?f.name.replace(/\.[^.]+$/,''):'')||('Video '+num),
    key:meta.key||(f?mediaKey(f):null), fname:meta.fname||(f&&f.name), size:meta.size||(f&&f.size), missing:!f, blob:f||null, errs:0,
    motion:meta.motion||null, curve:meta.curve||null, kd:+meta.kd||0};
  if(f){n.url=URL.createObjectURL(f);ve.src=n.url;ve.load()}
  S.sources.push(n); return n;
}
function relinkSource(id,f){
  const n=srcById(id); if(!n)return;
  Object.assign(n,{missing:false,fname:f.name,size:f.size,key:mediaKey(f),blob:f,errs:0});
  if(n.url)URL.revokeObjectURL(n.url); n.url=URL.createObjectURL(f);
  n.el.src=n.url; n.el.load(); if(n.el2){n.el2.src=n.url;n.el2.load()}
  saveMedia(n.key,f);
  S.hasV=true; $('#empty').hidden=true;
  const c=srcById(S.cur); if(!c||c.missing){if(S.cur===id){v=n.el;showOnly(n.el)}else activate(id)}
  enable(); renderSources(); renderMoves(); updateTrim(); updateMissing();
}
function addVideo(f){
  setTimeout(()=>{try{rtmAutoFetch()}catch(e){}},1500);
  if(!f)return; if(S.rec)stopRecording(); pause();
  const miss=S.sources.find(x=>x.missing&&x.fname===f.name&&x.size===f.size);
  if(miss){relinkSource(miss.id,f);return}
  const n=createSource(f); saveMedia(n.key,f);
  S.hasV=true; $('#empty').hidden=true;
  S.preview=null; S.useSeq=false; S.segIdx=0; resetCut();
  const c=srcById(S.cur);
  if(!c||c.missing){S.cur=n.id;v=n.el;showOnly(n.el);S.cIn=0;S.cOut=null;v.muted=!$('#origAudio').checked}
  else activate(n.id);
  enable(); renderSources(); renderMoves(); updateTrim(); updateMissing();
}
function removeVideo(id){
  if(S.rec)return; pause();
  const n=srcById(id); if(!n)return;
  const gone=new Set(S.moves.filter(m=>m.src===id).map(m=>m.id));
  S.moves=S.moves.filter(m=>m.src!==id); S.seq=S.seq.filter(x=>!gone.has(x.id)); if(!S.seq.length)S.useSeq=false;
  S.sources=S.sources.filter(x=>x!==n); URL.revokeObjectURL(n.url);
  if(S.markSrc===id)resetCut();
  if(S.cur===id){
    S.cur=null;
    if(S.sources.length){const nx=S.sources[0];S.cur=nx.id;v=nx.el;showOnly(nx.el);S.cIn=nx.cIn||0;S.cOut=nx.cOut??null;$('#vidName').textContent=nx.name+(nx.dur?' · '+fmt(nx.dur):'')}
  }
  if(n.el.id==='vid'&&S.sources.length){n.el.removeAttribute('src');n.el.load();n.el.classList.add('off')}
  else if(n.el.id==='vid'){n.el.removeAttribute('src');n.el.load()}
  else n.el.remove();
  if(n.el2)n.el2.remove();
  updateMissing();
  if(!S.sources.length){S.hasV=false;v=$('#vid');v.classList.remove('off');$('#empty').hidden=false;$('#vidName').textContent='Add one or more dance videos. Moves from any of them can go in one routine.'}
  S.preview=null; S.segIdx=0; if(S.hasV)toStart();
  enable(); renderSources(); renderMoves(); updateTrim();
}
function renderSources(){$$('.srcChips').forEach(renderChips)}
function renderChips(box){
  box.textContent='';
  S.sources.forEach(n=>{
    const c=el('span','chip-src'+(n.id===S.cur&&!routineOn()?' on':'')+(n.missing?' missing':''));
    const b=el('button'); b.append(el('span','num',String(n.num)),el('span','nm',n.name));
    b.setAttribute('aria-label','Show '+n.name); b.addEventListener('click',()=>{if(S.rec)return;if(n.missing){openSheet();return}pause();S.preview=null;S.useSeq=false;activate(n.id);S.segIdx=0;renderMoves();updateTrim()});
    const x=el('button','x','✕'); x.setAttribute('aria-label','Remove '+n.name+' and its moves'); x.addEventListener('click',()=>removeVideo(n.id));
    c.append(b,x); box.append(c);
  });
  const add=el('label','btn file sm'); add.append(document.createTextNode(S.sources.length?'+ Add video':'Choose video'));
  const inp=el('input'); inp.type='file'; inp.accept='video/*'; inp.addEventListener('change',e=>{addVideo(e.target.files[0]);e.target.value=''});
  add.append(inp); box.append(add);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(S.rec)stopRecording();else if(S.playing)pause()}});

/* ---------- song: audio file or video, sound only ---------- */
function encodeWav(b){
  const ch=Math.min(2,b.numberOfChannels), sr=b.sampleRate, n=b.length, bytes=n*ch*2;
  const ab=new ArrayBuffer(44+bytes), dv=new DataView(ab);
  const w=(o,t)=>{for(let i=0;i<t.length;i++)dv.setUint8(o+i,t.charCodeAt(i))};
  w(0,'RIFF');dv.setUint32(4,36+bytes,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);
  dv.setUint16(20,1,true);dv.setUint16(22,ch,true);dv.setUint32(24,sr,true);dv.setUint32(28,sr*ch*2,true);
  dv.setUint16(32,ch*2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,bytes,true);
  const chans=[];for(let c=0;c<ch;c++)chans.push(b.getChannelData(c));
  const out=new Int16Array(ab,44,n*ch);
  for(let i=0,k=0;i<n;i++)for(let c=0;c<ch;c++){let x=chans[c][i];x=x<-1?-1:x>1?1:x;out[k++]=x<0?x*0x8000:x*0x7FFF}
  return new Blob([ab],{type:'audio/wav'});
}
function setSongSrc(blob){if(aUrl)URL.revokeObjectURL(aUrl);aUrl=URL.createObjectURL(blob);a.src=aUrl;a.load()}
function loadSong(f,which,restoring,meta){
  if(!f)return; if(S.rec)stopRecording(); pause();
  const rt=which==='rt', slotKey=rt?'rt':'main', id=++loadIds[slotKey], isVideo=(f.type||'').startsWith('video/')||/\.(mp4|mov|m4v|webm)$/i.test(f.name);
  const msg=(t,err)=>{if(rt){const m=$('#rSongMsg');m.hidden=!t;m.textContent=t||'';m.classList.toggle('err',!!err)}else songMsg(t,err)};
  const so={name:f.name.replace(/\.[^.]+$/,'')||f.name,blob:null,buf:null,dur:0,ready:false,key:mediaKey(f),fname:f.name,size:f.size,
    forceBpm:meta&&meta.forceBpm||null,beatShift:meta&&meta.beatShift||0,an:null,
    confirmed:!!(meta&&meta.confirmed),oneAt:meta&&meta.oneAt!=null?meta.oneAt:null,cleared:!!(meta&&meta.cleared)};
  if(!restoring)saveMedia(so.key,f);
  msg('Reading the sound…');
  /* show straight away that the new song was picked (the name used to stay on the old song until it was read) */
  if(!rt){S.songLoading=so.name;showSlots()}
  const done=()=>{if(!rt&&id===loadIds[slotKey]){S.songLoading=null;showSlots()}};
  const place=()=>{if(rt)S.rtSong=so;else S.mainSong=so;S.liveSong=undefined;syncSlot();syncSong(true);updateMissing()};
  f.arrayBuffer()
    .then(ab=>decodeAudioSafe(ab))
    .then(b=>{
      if(id!==loadIds[slotKey])return;
      done();so.buf=b; so.dur=b.duration; so.blob=encodeWav(b); so.ready=true; place(); analyzeSongObj(so,!restoring);
      msg(isVideo?'Using the sound from this video. Its picture is ignored.':(rt?'':'Song ready.'));
    })
    .catch(()=>{
      if(id!==loadIds[slotKey])return;
      done();
      if(isVideo){msg("Couldn't read any sound from this video. Check it has audio.",true);return}
      so.blob=f; so.ready=true; place();   /* let the audio player try it directly */
      a.addEventListener('loadedmetadata',()=>{so.dur=a.duration;showSlots()},{once:true});
      msg('Song ready. Recording needs an MP3, M4A or WAV.');
    });
}
a.addEventListener('error',()=>{if(a.src)songMsg("This file's sound can't play here. Try an MP3, M4A or MP4.",true)});
a.addEventListener('ended',()=>{if(!S.hasV)setPlaying(false)});

$('#vidFile').addEventListener('change',e=>{addVideo(e.target.files[0]);e.target.value=''});
$('#audFile').addEventListener('change',e=>{loadSong(e.target.files[0],'main');e.target.value=''});
$('#rSongFile').addEventListener('change',e=>{loadSong(e.target.files[0],'rt');e.target.value=''});
$('#rSongReset').addEventListener('click',()=>{pause();S.rtSong=null;$('#rSongMsg').hidden=true;syncSlot()});
window.addEventListener('dragover',e=>e.preventDefault());
window.addEventListener('drop',e=>{
  e.preventDefault();
  [...(e.dataTransfer?.files||[])].forEach(f=>{
    if(f.type.startsWith('video/')&&!S.hasV)addVideo(f);
    else if(f.type.startsWith('video/')||f.type.startsWith('audio/'))loadSong(f,'main');
  });
});

$('#play').addEventListener('click',toggle);
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.target.matches('input[type=number],input[type=text],button,label'))return;
  e.preventDefault(); if(!$('#play').disabled)toggle();
});
/* dragging the bar is your move: while playing, the song follows the video to where you let go (on a clip with cut
   parts it didn't: the song stayed put and the video was pulled back to it, so dragging back jumped forward again) */
$('#scrub').addEventListener('input',e=>{const x=+e.target.value;S.userSeekAt=performance.now(); if(segMode())seekT(x); else v.currentTime=x});
['pointerdown','touchstart'].forEach(ev=>$('#scrub').addEventListener(ev,()=>{S.scrubbing=true;S.userSeekAt=performance.now()},{passive:true}));
['pointerup','pointercancel','touchend','touchcancel','change'].forEach(ev=>$('#scrub').addEventListener(ev,()=>{if(!S.scrubbing)return;S.scrubbing=false;S.userSeekAt=performance.now();S.catchUp=0;if(S.playing){S.driftEma=0;S.songStuck=0;S.songClk=null;syncSong(true)}},{passive:true}));
$('#origAudio').addEventListener('change',e=>{v.muted=!e.target.checked});

/* speeds */
$('#vRate').addEventListener('input',e=>setP(S.main,'vr',+e.target.value));
$('#aRate').addEventListener('input',e=>setP(S.main,'ar',+e.target.value));
$$('[data-v]').forEach(b=>b.addEventListener('click',()=>{
  const d=+b.dataset.v; setP(S.main,'vr',d===0?1:clamp(+(S.main.vr*(1+d)).toFixed(3),0.25,2.5));
}));
$('#rVRate').addEventListener('input',e=>setP(S.rt,'vr',+e.target.value));
/* clip speed next to the time: always shows the speed (of the clip, or the routine part when Routine plays); tap for quick changes */
function spdShow(){const v=(slot()||S.main).vr||1,b=$('#spdBtn');b.textContent='×'+v.toFixed(2);b.classList.toggle('off1',Math.abs(v-1)>0.004);b.disabled=!S.hasV;
  const r=$('#spdRange');if(document.activeElement!==r)r.value=v;$$('.spdpre button').forEach(x=>x.setAttribute('aria-pressed',String(Math.abs(+x.dataset.v-v)<0.004)))}
const spdSet=v=>{v=Math.max(0.25,Math.min(2.5,Math.round(v*100)/100));setP(slot(),'vr',v)};
$('#spdBtn').addEventListener('click',()=>{const o=$('#spdStrip').hidden;$('#spdStrip').hidden=!o;$('#spdBtn').setAttribute('aria-expanded',String(o))});
$('#spdRange').addEventListener('input',e=>spdSet(+e.target.value));
$('#spdLess').addEventListener('click',()=>spdSet(((slot()||S.main).vr||1)-0.05));
$('#spdMore').addEventListener('click',()=>spdSet(((slot()||S.main).vr||1)+0.05));
$$('.spdpre button').forEach(b=>b.addEventListener('click',()=>spdSet(+b.dataset.v)));
$$('[data-rv]').forEach(b=>b.addEventListener('click',()=>{const d=+b.dataset.rv;setP(S.rt,'vr',d===0?1:clamp(+(S.rt.vr*(1+d)).toFixed(3),0.25,2.5))}));
function setSpeedMode(mode){
  if(S.rt.spMode===mode)return;
  /* switching to "Each move": moves without their own speed start from the shared one */
  if(mode==='each')S.seq.forEach(x=>{if(x.sp==null)x.sp=S.rt.vr});
  S.rt.spMode=mode; S.rt.set=true;
  if(S.playing)pause();
  renderMoves(); updateTrim(); applyRates();
}
$('#spdAll').addEventListener('click',()=>setSpeedMode('all'));
$('#spdEach').addEventListener('click',()=>setSpeedMode('each'));
$('#rARate').addEventListener('input',e=>setP(S.rt,'ar',+e.target.value));
$('#rFade').addEventListener('change',e=>{S.rt.fade=e.target.checked});
$('#rCopy').addEventListener('click',()=>{S.rt.offset=S.main.offset;S.rt.ar=S.main.ar;S.rt.vr=S.main.vr;S.rt.set=true;syncSlot();updateSeqStats()});

/* song start */
function setOffset(x){setP(S.main,'offset',+clamp(x,0,Math.max(0,sDur(S.mainSong)-0.05)||180).toFixed(3))}
function setROffset(x){setP(S.rt,'offset',+clamp(x,0,Math.max(0,sDur(S.rtSong||S.mainSong)-0.05)||180).toFixed(3))}
$('#offset').addEventListener('input',e=>setOffset(+e.target.value));
$$('[data-o]').forEach(b=>b.addEventListener('click',()=>setOffset(S.main.offset+ +b.dataset.o)));
$('#rOffset').addEventListener('input',e=>setROffset(+e.target.value));
$$('[data-ro]').forEach(b=>b.addEventListener('click',()=>setROffset(S.rt.offset+ +b.dataset.ro)));

/* clip start / end points */
function updateTrim(){
  const d=v.duration||0, e=clipEnd(), ro=routineOn(), sm=segMode();
  $('#inVal').textContent=fmt2(S.cIn);
  {const bo=$('#bothOut');if(bo)bo.textContent='clip '+fmt(S.cIn)+' · song '+fmt(S.main.offset)}
  const ir=$('#inRange'); ir.max=d||1; if(document.activeElement!==ir)ir.value=S.cIn;
  $('#outVal').textContent=S.cOut!=null?fmt(S.cOut):(d?'End · '+fmt(d):'End');
  $('#clipNote').hidden=!ro;
  const f=$('#trimFill');
  if(sm||!d){f.style.left='0';f.style.right='0'} else {f.style.left=(S.cIn/d*100)+'%';f.style.right=(100-e/d*100)+'%'}
  $('#scrub').max=sm?Math.max(0.01,segStart(segs().length,segs())):(d||1);
  try{cutUI()}catch(err){}
  const r=$('#repeat'), rOn=S.study?!!S.study.loop:S.loop; r.classList.toggle('on',rOn); r.setAttribute('aria-pressed',rOn);   /* Study/Learn loop by themselves: show your own Repeat */
  $('#modeSeg').hidden=!S.seq.length;
  $('#modeClip').setAttribute('aria-pressed',!ro); $('#modeSeq').setAttribute('aria-pressed',ro);
  syncSlot(); scheduleFit();
}
function setIn(t){
  S.cIn=+clamp(t,0,Math.max(0,clipEnd()-0.2)).toFixed(2);
  if(!S.playing&&!routineOn()){S.segIdx=0;v.currentTime=S.cIn}
  updateTrim(); syncSong(true);
}
function setOut(t){
  const d=v.duration||0; t=clamp(t,S.cIn+0.2,d);
  S.cOut=t>=d-0.05?null:+t.toFixed(2); updateTrim();
}
$('#inRange').addEventListener('input',e=>{if(S.playing)pause();setIn(+e.target.value)});
$('#setOut').addEventListener('click',()=>setOut(v.currentTime));
$('#clearOut').addEventListener('click',()=>{S.cOut=null;updateTrim()});
$$('[data-in]').forEach(b=>b.addEventListener('click',()=>{if(S.playing)pause();setIn(S.cIn+ +b.dataset.in)}));
/* ---- Move the start, song and dance together: the clip (or the routine's first move) starts d seconds earlier or later,
   and the song's start moves by exactly the music that covers, so every moment of the dance keeps its place in the song
   (through the speed graph, cut parts and an aligned first move). The song can't start before its beginning, nor the
   clip before its own, so it moves as far as it can and says so. ---- */
function songAtSrc(t){   /* where the song is (before the sound delay) at clip moment t of the first part, in normal playback */
  const L=normSegs();if(!L.length)return null;const g=L[0];
  return S.offset+((t<g.s?(t-g.s)/segR(g):toOut(g,Math.min(t,g.e)))+(S.avComp||0))*S.ar}
function warpShift(x,s2){   /* an aligned move's warp re-based on a new start (earlier: the stretch before plays at the move's speed) */
  const W=x.warp,r=rateOf(x);if(!W||W.length<2)return null;
  if(s2<W[0][0]){const add=(W[0][0]-s2)/r;return [[s2,0],...W.map(([s,o])=>[s,o+add])]}
  let i=0;while(i<W.length-1&&W[i+1][0]<=s2)i++;const [s0,o0]=W[i],[s1,o1]=W[Math.min(i+1,W.length-1)];const o=s1>s0?o0+(o1-o0)*(s2-s0)/(s1-s0):o0;
  return [[s2,0],...W.slice(i+1).filter(k=>k[0]>s2).map(([s,o2])=>[s,o2-o])]}
function shiftBoth(d){
  if(S.rec)return;if(S.study)studyOff();if(S.playing)pause();
  const ro=routineOn(),P=slot(),msgEl=$(ro?'#rbothMsg':'#bothMsg');
  let x=null,m=null;if(ro){x=S.seq[0];m=x&&moveById(x.id);if(!x||!m){msgEl.textContent='Add a move to the routine first.';return}}
  const n=ro?srcById(m.src):srcById(S.cur);if(!n)return;
  const start=ro?x.s:S.cIn,end=ro?x.e:clipEnd(),dur=n.dur||n.el.duration||end;
  const want=start+d,lo=0,hi=end-0.5;let s2=Math.max(lo,Math.min(hi,want));
  const before={s:start,off:P.offset,warp:ro&&x.warp?x.warp.map(k=>k.slice()):null};
  const apply=s=>{if(ro){if(x.warp&&warpOk(x)){const w=warpShift({...x,warp:before.warp,s:before.s},s);x.s=s;if(w)x.warp=w}else x.s=s}else S.cIn=+s.toFixed(2)};
  const restore=()=>{if(ro){x.s=before.s;x.warp=before.warp}else S.cIn=before.s;P.offset=before.off;S.offset=before.off};
  /* the moment both versions share stays at the same place in the song */
  const solve=s=>{restore();const ref=Math.max(start,s)+0.01,e0=songAtSrc(ref);apply(s);const e1=songAtSrc(ref);return +(before.off+(e0-e1)).toFixed(3)};
  let off=solve(s2);
  if(off<0){let a=s2,b=start;for(let k=0;k<30;k++){const mid=(a+b)/2;if(solve(mid)<0)a=mid;else b=mid}s2=b;off=Math.max(0,solve(s2))}
  const sd=sDur(ro?(S.rtSong||S.mainSong):S.mainSong);if(sd&&off>sd-0.05){restore();msgEl.textContent='The song would start past its end.';return}
  P.offset=off;S.offset=off;if(P===S.rt)S.rt.set=true;
  const moved=+(s2-start).toFixed(2);
  if(!ro){S.segIdx=0;v.currentTime=S.cIn}else{S.segIdx=0;renderMoves();try{updateSeqStats()}catch(e){}}
  updateTrim();toStart();syncSong(true);recSync(true);showSlots();
  const what=ro?'The routine':'The dance';
  msgEl.textContent=Math.abs(moved)<0.01?(d<0?(start<=0.01?'The clip already starts at its beginning.':"The song already starts at its beginning, so it can't come earlier."):"Can't start any later."):
    `${what} now starts ${Math.abs(moved)}s ${moved<0?'earlier':'later'} (${fmt2(s2)} in the clip) and the song at ${fmt2(off)}`+(Math.abs(moved-d)>0.01?` (as far as it goes: ${moved<0&&s2<=0.01?'the clip starts there':'the song starts there'}).`:'.');
  if(Math.abs(moved)>=0.01&&!ro&&curveOf(n))msgEl.textContent+=' Your speed graph stays on the same moves'+(moved<0?', and the new lead-in plays at the speed it had at the old start.':' (its points before the new start are kept, for if you move back).');
  S.bothN=(S.bothN||0)+1;try{autosave(true).catch(()=>{})}catch(e){}}
$$('[data-both]').forEach(b=>b.addEventListener('click',()=>shiftBoth(+b.dataset.both)));
$$('[data-rboth]').forEach(b=>b.addEventListener('click',()=>shiftBoth(+b.dataset.rboth)));
$('#repeat').addEventListener('click',()=>{if(S.study)S.study.loop=!S.study.loop;else S.loop=!S.loop;updateTrim()});   /* during Study/Learn it sets what Repeat goes back to, and they keep looping */

/* ---------- moves ---------- */
function grabThumb(){
  try{const h=88,w=Math.max(1,Math.round(h*(v.videoWidth||9)/(v.videoHeight||16)));
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(v,0,0,w,h);return c.toDataURL('image/jpeg',0.6)}
  catch(e){return ''}
}
function setMode(seq){
  if(S.rec)return; if(S.study)studyOff();
  pause(); S.preview=null; S.useSeq=!!seq&&S.seq.length>0; toStart();
  updateTrim(); renderMoves(); renderSources();
}
function resetCut(){S.markIn=S.markOut=null;S.markThumb='';S.markSrc=null;updateCutter()}
function updateCutter(){
  const mi=$('#markIn'), mo=$('#markOut');
  $('#markInVal').textContent=S.markIn!=null?fmt2(S.markIn):'—';
  $('#markOutVal').textContent=S.markOut!=null?fmt2(S.markOut):'—';
  mi.classList.toggle('set',S.markIn!=null); mo.classList.toggle('set',S.markOut!=null);
  $('#saveMove').disabled=!(S.markIn!=null&&S.markOut!=null&&S.markOut>S.markIn+0.05);
  $('#cutReset').disabled=S.markIn==null&&S.markOut==null;
}
function needWhole(){if(routineOn()||S.preview){S.preview=null;S.useSeq=false;S.segIdx=0;updateTrim();renderMoves();renderSources()}}
$('#markIn').addEventListener('click',()=>{
  needWhole(); S.markSrc=S.cur; S.markIn=+v.currentTime.toFixed(2); S.markThumb=grabThumb();
  if(S.markOut!=null&&S.markOut<=S.markIn+0.05)S.markOut=null; updateCutter();
});
$('#markOut').addEventListener('click',()=>{
  needWhole(); const t=+v.currentTime.toFixed(2);
  if(S.markIn==null||S.markSrc!==S.cur){S.markIn=0;S.markThumb='';S.markSrc=S.cur}
  if(t>S.markIn+0.05)S.markOut=t; else {S.markOut=S.markIn;S.markIn=Math.max(0,t)}
  updateCutter();
});
$('#cutReset').addEventListener('click',resetCut);
$('#saveMove').addEventListener('click',()=>{
  if($('#saveMove').disabled)return;
  const m={id:'m'+(++moveCount),name:'Move '+moveCount,src:S.markSrc||S.cur,s:S.markIn,e:S.markOut,thumb:S.markThumb};
  if(!m.thumb){const t=v.currentTime;m.thumb='';v.currentTime=m.s;v.addEventListener('seeked',()=>{m.thumb=grabThumb();renderMoves();v.currentTime=t},{once:true})}
  S.moves.push(m); resetCut(); renderMoves();
});
function newEntry(id){const m=moveById(id);return {uid:'e'+(++uidCount),id,s:m.s,e:m.e,sp:S.rt.spMode==='each'?S.rt.vr:null}}
function seqChanged(goStart){
  if(!S.seq.length){S.useSeq=false;S.sel=null}
  if(goStart&&routineOn()&&!S.playing)toStart();
  updateTrim(); renderMoves(); renderSources();
}
function addToSeq(id,at){
  if(S.rec||!moveById(id))return;
  if(!S.seq.length&&!S.rt.set){S.rt.offset=S.main.offset;S.rt.ar=S.main.ar;S.rt.vr=S.main.vr;S.rt.set=true}  /* routine starts with your current song settings */
  const e=newEntry(id); if(at==null||at>S.seq.length)at=S.seq.length;
  S.seq.splice(at,0,e); if(S.seq.length===1)S.useSeq=true;
  if(S.playing)pause(); seqChanged(true);
}
function previewMove(m){
  if(S.rec)return; pause(); S.preview={src:m.src,s:m.s,e:m.e,id:m.id}; S.segIdx=0; activate(m.src); v.currentTime=m.s; updateTrim(); renderMoves(); play();
}
function deleteMove(id){
  if(S.rec)return; pause();
  S.moves=S.moves.filter(m=>m.id!==id); S.seq=S.seq.filter(x=>x.id!==id);
  S.preview=null; S.segIdx=0; seqChanged(false); if(S.hasV)toStart();
}
function reorder(from,to){
  if(S.rec||from===to)return; pause();
  const [x]=S.seq.splice(from,1); if(to>from)to--; S.seq.splice(to,0,x); seqChanged(true);
}
function removeSeq(i){
  if(S.rec)return; pause(); const [x]=S.seq.splice(i,1); if(x&&S.sel===x.uid)S.sel=null; seqChanged(true);
}
function dupSeq(i){
  if(S.rec)return; pause(); const x=S.seq[i]; S.seq.splice(i+1,0,{uid:'e'+(++uidCount),id:x.id,s:x.s,e:x.e,sp:x.sp}); seqChanged(true);
}
/* play part of the routine: from T, stopping at stopT */
function playRange(T,stopT){
  if(S.rec)return; pause(); S.preview=null; S.useSeq=true; updateTrim();
  seekT(Math.max(0,T)); S.stopAtT=stopT; play(); S.stopAtT=stopT;
}
/* show a frame while trimming */
function showFrame(src,t){if(S.playing)pause();activate(src);v.currentTime=Math.max(0,t)}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function iconBtn(label,text,fn){const b=el('button','btn sm',text);b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b}
function thumbEl(m){if(m.thumb){const i=el('img');i.src=m.thumb;i.alt='';return i}return el('div','ph')}
function vtag(m){return S.sources.length>1?(()=>{const n=srcById(m.src);return el('span','vtag','V'+(n?n.num:'?'))})():null}
function nameEl(m){const b=el('b');const t=vtag(m);if(t)b.append(t);b.append(document.createTextNode(m.name));return b}
/* one beat of the routine song, measured in clip seconds */
/* one beat of the routine song, in clip seconds, for a move playing at rate r */
function beatLen(r){return S.sBase?60*(r||S.rt.vr)/(S.sBase*S.rt.ar):null}
function fitEntry(x){
  const b=beatLen(rateOf(x)), m=moveById(x.id); if(!b||!m)return false;
  const n=srcById(m.src), max=n&&n.dur?n.dur:x.e+10;
  let k=Math.max(1,Math.round((x.e-x.s)/b)); while(k>1&&x.s+k*b>max)k--;
  x.e=+Math.min(max,x.s+k*b).toFixed(3); return true;
}
function beatsText(x){const b=beatLen(rateOf(x));if(!b)return '';const k=(x.e-x.s)/b, r=Math.round(k);return Math.abs(k-r)<0.04?' · '+r+(r===1?' beat':' beats'):' · '+k.toFixed(1)+' beats'}
function playLen(x){const g=segOf(x);return g?segLen(g):(x.e-x.s)/rateOf(x)}
function seqTotal(){return S.seq.reduce((t,x)=>t+playLen(x),0)}
function updateSeqStats(){
  scheduleFit();
  $('#seqLen').textContent=S.seq.length?'· '+S.seq.length+' moves · '+fmt(seqTotal()):'';
  const tot=seqTotal()||1;
  [...$('#seqBlocks').children].forEach((b,i)=>{const x=S.seq[i];if(x)b.style.flexGrow=String(playLen(x)/tot*100)});
  const each=S.rt.spMode==='each';
  $('#spdAll').setAttribute('aria-pressed',!each); $('#spdEach').setAttribute('aria-pressed',each);
  $('#spdAllBox').hidden=each; $('#spdEachHint').hidden=!each;
  try{rtlInspectorLen();RTL.tl&&RTL.tl.redraw()}catch(err){}
}
function renderMoves(){
  /* Moves tab: the library */
  const ml=$('#moveList'); ml.textContent='';
  try{patFilterUI()}catch(e){}
  S.moves.forEach(m=>{
    let pk=null;try{pk=movePattern(m)}catch(e){}
    if(S.patFilter&&S.patFilter!=='all'&&pk!==S.patFilter)return;
    const li=el('li','item nonum'); if(S.preview&&S.preview.id===m.id)li.classList.add('now');
    const meta=el('div','meta'); const nm=nameEl(m);if(pk){const tg=el('span','pattag',PAT[pk].short);tg.style.background=PAT[pk].col;nm.append(tg)}
    meta.append(nm,el('span',null,fmt(m.s)+' – '+fmt(m.e)+' · '+(m.e-m.s).toFixed(1)+'s'));
    const acts=el('div','acts');
    acts.append(iconBtn('Play '+m.name,'▶',()=>previewMove(m)),iconBtn('Add '+m.name+' to routine','+',()=>addToSeq(m.id)),iconBtn('Delete '+m.name,'✕',()=>deleteMove(m.id)));
    li.append(thumbEl(m),meta,acts); ml.append(li);
  });
  $('#moveEmpty').hidden=S.moves.length>0;

  /* Routine tab: tray of moves */
  const tray=$('#tray'); tray.textContent='';
  S.moves.forEach(m=>{
    const c=el('button','tcard'); c.type='button'; c.setAttribute('aria-label','Add '+m.name+' to the routine');
    c.append(thumbEl(m),nameEl(m),el('span',null,(m.e-m.s).toFixed(1)+'s'));
    dragSource(c,{kind:'tray',id:m.id},()=>addToSeq(m.id));
    tray.append(c);
  });
  $('#trayEmpty').hidden=S.moves.length>0; tray.hidden=!S.moves.length;

  /* Routine tab: the routine */
  const sl=$('#seqList'); sl.textContent='';
  const ro=routineOn(), cur=ro&&S.playing?S.segIdx:-1;
  S.seq.forEach((x,i)=>{
    const m=moveById(x.id); if(!m)return;
    const li=el('li','item r'); li.dataset.i=i; if(i===cur)li.classList.add('now'); if(S.sel===x.uid)li.classList.add('sel');
    const h=el('span','handle','⠿'); h.setAttribute('aria-hidden','true'); dragSource(h,{kind:'seq',i},null,li);
    const tap=el('button','tap'); tap.type='button'; tap.setAttribute('aria-expanded',S.sel===x.uid);
    const lenEl=el('span','len',lenText(x,m)); tap.append(nameEl(m),lenEl);
    const fc=el('span','chipfit idle','');fc.dataset.fit=i;fc.hidden=true;tap.querySelector('b').append(fc);
    tap.addEventListener('click',()=>{S.sel=S.sel===x.uid?null:x.uid;renderMoves();if(S.sel)showFrame(m.src,x.s)});
    const meta=el('div','meta'); meta.append(tap);
    const acts=el('div','acts');
    acts.append(iconBtn('Play from here','▶',()=>playRange(segStart(i,segsFor()),segStart(i+1,segsFor()))),iconBtn('Remove from routine','✕',()=>removeSeq(i)));
    li.append(h,el('span','n',String(i+1)),thumbEl(m),meta,acts);
    sl.append(li);
  });
  $('#seqEmpty').hidden=S.seq.length>0; $('#seqHint').hidden=!S.seq.length; $('#seqBar').hidden=true; $('#rtlWrap').hidden=!S.seq.length;
  try{rtlInspector();RTL.tl&&RTL.tl.redraw()}catch(err){}
  $('#seqClear').disabled=!S.seq.length;
  $('#fitAll').disabled=!S.seq.length||!beatLen(); $('#fitHint').hidden=!S.seq.length||!!beatLen();
  /* timeline strip */
  const bl=$('#seqBlocks'); bl.textContent='';
  S.seq.forEach((x,i)=>{
    const b=el('button',S.sel===x.uid?'sel':'',String(i+1)); b.type='button'; b.setAttribute('aria-label','Go to move '+(i+1));
    b.addEventListener('click',()=>{S.sel=x.uid;if(S.playing)pause();S.useSeq=true;S.preview=null;updateTrim();seekT(segStart(i,segsFor()));renderMoves()});
    bl.append(b);
  });
  updateSeqStats();
}
function lenText(x,m){
  const sp=S.rt.spMode==='each'&&Math.abs((x.sp||1)-1)>0.004?' · ×'+(x.sp||1).toFixed(2):'';
  return playLen(x).toFixed(2)+'s'+sp+beatsText(x)+((Math.abs(x.s-m.s)>0.005||Math.abs(x.e-m.e)>0.005)?' · trimmed':'');
}
function segsFor(){return S.seq.map(x=>segOf(x)||{s:x.s,e:x.e,r:rateOf(x)})}

/* trimming one spot in the routine (doesn't change the saved move) */
function editor(x,m,i,li){
  const box=el('div','editor');
  const n=srcById(m.src), dur=n&&n.dur||m.e+3;
  const lo=Math.max(0,m.s-3), hi=Math.min(dur,m.e+3);
  const mk=(label,key)=>{
    const row=el('div','ed-row'), top=el('div','ed-top'), val=el('span','val',fmt2(x[key]));
    top.append(el('span','label',label),val);
    const r=el('input'); r.type='range'; r.min=lo; r.max=hi; r.step=0.01; r.value=x[key]; r.setAttribute('aria-label',label);
    const nud=el('div','ed-nudge');
    const apply=(t,fin)=>{
      if(key==='s')x.s=+clamp(t,lo,x.e-0.1).toFixed(2); else x.e=+clamp(t,x.s+0.1,hi).toFixed(2);
      val.textContent=fmt2(x[key]); if(document.activeElement!==r)r.value=x[key];
      li.querySelector('.len').textContent=lenText(x,m);
      updateSeqStats(); updateTrim(); showFrame(m.src,key==='s'?x.s:x.e-0.03);
    };
    r.addEventListener('input',()=>apply(+r.value));
    [-0.1,-0.02,0.02,0.1].forEach(d=>nud.append(iconBtn(label+' '+(d>0?'+':'')+d,(d>0?'+':'−')+Math.abs(d),()=>apply(x[key]+d))));
    row.append(top,r,nud); return row;
  };
  const acts=el('div','ed-acts');
  const L=()=>segsFor();
  const pj=el('button','btn sm','▶ Join'); pj.setAttribute('aria-label','Play the end of the move before, then this one'); pj.disabled=i===0;
  pj.addEventListener('click',()=>playRange(segStart(i,L())-1.5,segStart(i+1,L())));
  const pt=el('button','btn sm','▶ This'); pt.addEventListener('click',()=>playRange(segStart(i,L()),segStart(i+1,L())));
  const rs=el('button','btn sm','Reset'); rs.addEventListener('click',()=>{x.s=m.s;x.e=m.e;renderMoves();updateTrim()});
  const du=el('button','btn sm','Duplicate'); du.addEventListener('click',()=>dupSeq(i));
  const fb=el('button','btn sm','Fit to beat'); fb.disabled=!beatLen(); fb.title=beatLen()?'Trim the end so this move lasts a whole number of beats':'Set the song BPM in the Tempo tab first';
  fb.addEventListener('click',()=>{if(fitEntry(x)){renderMoves();updateTrim();showFrame(m.src,x.e-0.03)}});
  acts.append(pj,pt,fb,rs,du);
  box.append(mk('Start','s'),mk('End','e'));
  if(S.rt.spMode==='each'){
    const row=el('div','ed-row'), top=el('div','ed-top'), val=el('span','val','×'+(x.sp||1).toFixed(2));
    top.append(el('span','label','Speed'),val);
    const r=el('input'); r.type='range'; r.min=0.25; r.max=2.5; r.step=0.01; r.value=x.sp||1; r.setAttribute('aria-label','Speed of this move');
    const setSp=t=>{
      x.sp=+clamp(t,0.25,2.5).toFixed(3); val.textContent='×'+x.sp.toFixed(2); if(document.activeElement!==r)r.value=x.sp;
      li.querySelector('.len').textContent=lenText(x,m); updateSeqStats(); updateTrim();
      if(routineOn())v.playbackRate=curRate();
    };
    r.addEventListener('input',()=>setSp(+r.value));
    const nud=el('div','ed-nudge'); nud.style.gridTemplateColumns='repeat(5,1fr)';
    [['−5%',-0.05],['−1%',-0.01],['×1',0],['+1%',0.01],['+5%',0.05]].forEach(([t,d])=>nud.append(iconBtn('Speed '+t,t,()=>setSp(d===0?1:(x.sp||1)*(1+d)))));
    const all=el('button','btn sm','Use this speed for every move');
    all.addEventListener('click',()=>{S.seq.forEach(y=>y.sp=x.sp);renderMoves();updateTrim()});
    row.append(top,r,nud,all); box.append(row);
  }
  box.append(acts);
  return box;
}

/* ---------- dragging (touch and mouse) ---------- */
function dragSource(node,info,onTap,rowEl){
  node.addEventListener('pointerdown',ev=>{
    if(S.rec||(ev.pointerType==='mouse'&&ev.button!==0))return;
    const sx=ev.clientX, sy=ev.clientY, pid=ev.pointerId; let dragging=false, D=null;
    const isHandle=info.kind==='seq';
    if(isHandle)ev.preventDefault();
    const move=e=>{
      if(e.pointerId!==pid)return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(!dragging){
        /* tray cards scroll sideways; a downward pull starts the drag */
        if(isHandle?Math.hypot(dx,dy)>3:(dy>8&&Math.abs(dy)>Math.abs(dx))||(e.pointerType==='mouse'&&Math.hypot(dx,dy)>6)){dragging=true;D=beginDrag(info,rowEl||node,e);try{node.setPointerCapture(pid)}catch(_){}}
        else if(!isHandle&&Math.abs(dx)>10){cleanup();return}
        else return;
      }
      e.preventDefault(); dragMove(D,e);
    };
    const up=e=>{
      if(e.pointerId!==pid)return; cleanup();
      if(dragging)endDrag(D,e.type!=='pointercancel'); else if(onTap&&e.type==='pointerup')onTap();
    };
    const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
    window.addEventListener('pointermove',move,{passive:false}); window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up);
  });
  if(onTap)node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onTap()}});
  node.addEventListener('click',e=>e.preventDefault());
}
function beginDrag(info,src,e){
  const r=src.getBoundingClientRect(), g=src.cloneNode(true);
  g.classList.add('drag-ghost'); g.style.width=r.width+'px'; g.style.left=r.left+'px'; g.style.top=r.top+'px';
  document.body.append(g); if(info.kind==='seq')src.classList.add('dragging');
  const D={info,src,ghost:g,offY:e.clientY-r.top,offX:e.clientX-r.left,line:el('li','drop-line'),at:null,y:e.clientY,x:e.clientX,raf:0};
  /* scroll when held near the top (under the pinned video) or bottom edge, and keep the drop spot in step */
  const scroll=()=>{
    const pinB=$('.pin').getBoundingClientRect().bottom, H=innerHeight, z=36;
    let dy=0; if(D.y<pinB+z)dy=-Math.ceil((pinB+z-D.y)/4); else if(D.y>H-z)dy=Math.ceil((D.y-(H-z))/4);
    if(dy){const before=scrollY;window.scrollBy(0,clamp(dy,-14,14));if(scrollY!==before)dragMove(D,{clientX:D.x,clientY:D.y})}
    D.raf=requestAnimationFrame(scroll);
  };
  D.raf=requestAnimationFrame(scroll);
  dragMove(D,e); return D;
}
function dragMove(D,e){
  D.y=e.clientY; D.x=e.clientX;
  D.ghost.style.top=(e.clientY-D.offY)+'px'; if(D.info.kind==='tray')D.ghost.style.left=(e.clientX-D.offX)+'px';
  const wrap=$('#seqWrap').getBoundingClientRect(), list=$('#seqList'), empty=$('#seqEmpty');
  const inside=e.clientY>wrap.top-30&&e.clientY<wrap.bottom+40;
  D.line.remove(); empty.classList.remove('over'); D.at=null;
  if(!inside&&D.info.kind==='tray')return;
  if(!S.seq.length){empty.classList.add('over');D.at=0;return}
  const rows=[...list.children].filter(c=>c.classList.contains('item'));
  let at=rows.length;
  for(let k=0;k<rows.length;k++){const rr=rows[k].getBoundingClientRect();if(e.clientY<rr.top+rr.height/2){at=k;break}}
  D.at=at; list.insertBefore(D.line,rows[at]||null);
}
function endDrag(D,ok){
  cancelAnimationFrame(D.raf); D.ghost.remove(); D.line.remove(); D.src.classList.remove('dragging'); $('#seqEmpty').classList.remove('over');
  if(!ok||D.at==null)return;
  if(D.info.kind==='tray')addToSeq(D.info.id,D.at); else reorder(D.info.i,D.at);
}
$('#modeClip').addEventListener('click',()=>setMode(false));
$('#modeSeq').addEventListener('click',()=>setMode(true));
$('#fitAll').addEventListener('click',()=>{if(S.rec)return;pause();S.seq.forEach(fitEntry);seqChanged(true)});
$('#seqClear').addEventListener('click',()=>{if(S.rec)return;pause();S.seq=[];seqChanged(false);if(S.hasV)toStart()});

/* tabs */
const tabs=$$('[role=tab]');
function showTab(t,focus,opt){
  const prevI=tabs.findIndex(x=>x.getAttribute('aria-selected')==='true'), nextI=tabs.indexOf(t);
  if(prevI>=0&&nextI>=0&&prevI!==nextI&&!(opt&&opt.noAnim))panelIn($('#'+t.getAttribute('aria-controls')),nextI>prevI?1:-1,opt&&opt.from);
  tabs.forEach(x=>{const on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;$('#'+x.getAttribute('aria-controls')).hidden=!on});
  if(focus)t.focus();
  try{localStorage.setItem('rs-tab',t.id)}catch(e){}
}
tabs.forEach((t,i)=>{
  t.addEventListener('click',()=>showTab(t));
  t.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){e.preventDefault();showTab(tabs[(i+d+tabs.length)%tabs.length],true)}});
});
try{const k=localStorage.getItem('rs-tab');const t=k&&document.getElementById(k);if(t)showTab(t)}catch(e){}

/* ---------- tempo ---------- */
function tapper(btn,label,onBpm){
  let t=[];
  btn.addEventListener('click',()=>{
    const n=performance.now();
    if(t.length&&n-t[t.length-1]>2000)t=[];
    t.push(n); if(t.length>9)t.shift();
    if(t.length>=3)onBpm(60000/((t[t.length-1]-t[0])/(t.length-1)));
    btn.textContent=label+' ('+t.length+')';
    clearTimeout(btn._r); btn._r=setTimeout(()=>{btn.textContent=label},2200);
  });
  return {reset(){t=[];clearTimeout(btn._r);btn.textContent=label}};
}
const dTap=tapper($('#dTap'),'Tap steps',bpm=>{S.dBase=bpm/S.vr;S.dAnchor=v.currentTime;$('#dBpm').value=S.dBase.toFixed(1);updateMatch()});
const sTap=tapper($('#sTap'),'Tap beat',bpm=>{S.beatSrc='tapped';
  S.sBase=bpm/S.ar;$('#sBpm').value=S.sBase.toFixed(1);
  if(!a.paused)S.sAnchor=a.currentTime;
  updateMatch();
});
$('#dBpm').addEventListener('input',e=>{const x=+e.target.value;S.dBase=x>0?x:null;updateMatch()});
$('#sBpm').addEventListener('input',e=>{const x=+e.target.value;S.sBase=x>0?x:null;S.beatSrc='tapped';updateMatch()});
function clearDance(){S.dBase=null;S.dAnchor=null;$('#dBpm').value='';dTap.reset()}
function clearSong(){S.sBase=null;S.sAnchor=null;$('#sBpm').value='';sTap.reset()}
$('#dClear').addEventListener('click',()=>{clearDance();updateMatch()});
$('#sClear').addEventListener('click',()=>{clearSong();updateMatch()});
$('#tClear').addEventListener('click',()=>{clearDance();clearSong();updateMatch()});

function updateMatch(){
  if($('#seqList').children.length)renderMoves();
  scheduleFit();
  $('#dBeats').hidden=!S.dBase; $('#sBeats').hidden=!S.sBase; $('#pulses').hidden=!S.dBase&&!S.sBase;
  const dE=S.dBase?S.dBase*S.vr:null, sE=S.sBase?S.sBase*S.ar:null;
  $('#dEff').textContent=dE?dE.toFixed(1):'—';
  $('#sEff').textContent=sE?sE.toFixed(1):'—';
  const ch=$('#verdict'), btns=$$('[data-m]');
  if(!dE||!sE){
    ch.className='chip idle';ch.textContent='Needs both tempos';
    btns.forEach(b=>{b.disabled=true;b.querySelector('b').textContent='—';b.querySelector('small').innerHTML='&nbsp;';b.classList.remove('best')});
    return;
  }
  const r=dE/sE; let err=Infinity;
  [0.5,1,2].forEach(m=>{err=Math.min(err,Math.abs(r/m-1))});
  if(err<0.015){ch.className='chip ok';ch.textContent='On the beat'}
  else if(err<0.05){ch.className='chip warn';ch.textContent='Drifts '+(err*100).toFixed(1)+'%'}
  else{ch.className='chip bad';ch.textContent='Off tempo'}
  let best=null,bestD=Infinity;
  btns.forEach(b=>{
    const m=+b.dataset.m, need=sE*m/S.dBase, ok=need>=0.25&&need<=2.5;
    b.dataset.need=need; b.disabled=!ok;
    b.querySelector('b').textContent='×'+need.toFixed(2);
    b.querySelector('small').textContent=ok?(need>1?'faster':'slower')+' clip':'out of range';
    b.classList.remove('best');
    if(ok&&Math.abs(Math.log(need))<bestD){bestD=Math.abs(Math.log(need));best=b}
  });
  if(best){best.classList.add('best');best.querySelector('small').textContent='least change'}
}
$$('[data-m]').forEach(b=>b.addEventListener('click',()=>setP(slot(),'vr',+(+b.dataset.need).toFixed(3))));

/* ---------- recording ----------
   Main path: the clip's frames are captured while it plays and encoded to MP4 on the phone,
   and the song is mixed in straight from the decoded file, so it lines up exactly even across cuts.
   Fallback: the browser's screen-style recorder. */
let vCfg=null,aCfg=null;
const canCodecs=()=>!!(window.VideoEncoder&&window.AudioEncoder&&window.VideoFrame&&window.AudioData&&window.Mp4Muxer);
function recSize(){
  const vw=v.videoWidth||720, vh=v.videoHeight||1280, sc=Math.min(1,1280/Math.max(vw,vh));
  return [Math.max(2,Math.round(vw*sc/2)*2),Math.max(2,Math.round(vh*sc/2)*2)];
}
async function prepRec(){
  if(!canCodecs())return;
  try{
    if(S.hasV&&v.videoWidth){
      const [w,h]=recSize(); vCfg=null;
      for(const codec of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f','vp09.00.10.08','vp8']){
        const avc=codec.startsWith('avc');
        const cfg=avc?{codec,width:w,height:h,bitrate:5000000,framerate:30,avc:{format:'avc'}}:{codec,width:w,height:h,bitrate:5000000,framerate:30};
        const r=await VideoEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported&&codec!=='vp8'){vCfg=cfg;vCfg.mux=avc?'avc':'vp9';break}
      }
    }
    if(buf){
      aCfg=null; const ch=Math.min(2,buf.numberOfChannels);
      for(const sr of [buf.sampleRate,48000,44100]){
        const cfg={codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:160000};
        const r=await AudioEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported){aCfg=cfg;aCfg.mux='aac';break}
      }
      if(!aCfg){const cfg={codec:'opus',sampleRate:48000,numberOfChannels:ch,bitrate:160000};
        const r=await AudioEncoder.isConfigSupported(cfg).catch(()=>null); if(r&&r.supported){aCfg=cfg;aCfg.mux='opus'}}
    }
  }catch(e){}
}
function captureFrame(mediaTime){
  const R=S.rec; if(!R||R.mode!=='codecs'||R.failed)return;
  const L=R.segs, i=S.segIdx, g=L[i]; if(!g)return;
  if(S.switchPending){ if(mediaTime>=g.s-0.002&&mediaTime<=g.s+0.5)S.switchPending=false; else return; }
  if(mediaTime<g.s-0.002||mediaTime>g.e+0.002)return;
  const T=segStart(i,L)+toOut(g,mediaTime);
  const ts=Math.round(T*1e6);
  if(ts<=R.lastTs||R.ve.encodeQueueSize>8)return;
  try{
    if(S.recCompose)drawCompose(mediaTime); else {drawFit(v); drawBodyOnTake(v,mediaTime);}
    const f=new VideoFrame(cv,{timestamp:ts,duration:33333});
    const key=R.frames===0||ts-R.lastKey>=2000000; if(key)R.lastKey=ts;
    R.ve.encode(f,{keyFrame:key}); f.close();
    R.lastTs=ts; R.frames++; if(window.__recLog)window.__recLog.push([+mediaTime.toFixed(3),i,+T.toFixed(3),!!g.k]);
  }catch(e){R.failed=e}
}
function drawFit(el){
  const W=cv.width,H=cv.height,vw=el.videoWidth||W,vh=el.videoHeight||H,k=Math.min(W/vw,H/vh),w=vw*k,h=vh*k;
  if(Math.abs(w-W)>1||Math.abs(h-H)>1){cx.fillStyle='#000';cx.fillRect(0,0,W,H)}
  cx.drawImage(el,(W-w)/2,(H-h)/2,w,h);
}
function watchFrames(el){
  if(!el.requestVideoFrameCallback||el._watching)return; el._watching=true;
  const cb=(now,meta)=>{
    if(!S.rec||S.rec.mode!=='codecs'){el._watching=false;return}
    if(el===v)captureFrame(meta&&meta.mediaTime!=null?meta.mediaTime:el.currentTime);
    el.requestVideoFrameCallback(cb);
  };
  el.requestVideoFrameCallback(cb);
}
/* iPhone's encoder leaves chunk durations blank, so supply them ourselves */
function rawChunk(c){const d=new Uint8Array(c.byteLength);c.copyTo(d);return d}
const okDur=x=>typeof x==='number'&&isFinite(x)&&x>=0;
function startCodecRec(){
  const vc=S.recCompose&&S.recCompose.cfg||vCfg;
  cv.width=vc.width; cv.height=vc.height;
  const target=new Mp4Muxer.ArrayBufferTarget();
  const muxer=new Mp4Muxer.Muxer({target,fastStart:'in-memory',firstTimestampBehavior:'offset',
    video:{codec:vc.mux||'avc',width:vc.width,height:vc.height},
    audio:{codec:aCfg.mux||'aac',numberOfChannels:aCfg.numberOfChannels,sampleRate:aCfg.sampleRate}});
  const R={mode:'codecs',segs:segs().map(g=>({src:g.src,s:g.s,e:g.e,r:segR(g),k:g.k})),fade:routineOn()&&S.rt.fade,muxer,target,vr:S.vr,ar:S.ar,offset:S.offset+(S.variant&&S.variant.shift||0),lastTs:-1,lastKey:0,frames:0,failed:null};
  R.ve=new VideoEncoder({output:(c,m)=>{try{muxer.addVideoChunkRaw(rawChunk(c),c.type,c.timestamp,okDur(c.duration)?c.duration:33333,m)}catch(e){R.failed=e}},error:e=>{R.failed=e}});
  R.ve.configure(vc);
  return R;
}
function stripAdts(d){
  if(d.length>7&&d[0]===0xFF&&(d[1]&0xF6)===0xF0){const h=(d[1]&1)?7:9;return d.subarray(h)}
  return d;
}
/* Encode the song from its start point, for the length of the recorded video. */
async function encodeSong(R,interleaved){
  const out=[], aDur=aCfg.mux==='opus'?20000:Math.round(1024/aCfg.sampleRate*1e6); let err=null;
  const ae=new AudioEncoder({output:(c,m)=>{if(m&&m.decoderConfig&&!out.meta)out.meta=m;const raw=rawChunk(c);out.push({data:aCfg.mux==='opus'?raw:stripAdts(raw),type:c.type||'key',ts:c.timestamp,dur:okDur(c.duration)?c.duration:aDur})},error:e=>{err=e}});
  try{
    ae.configure(aCfg);
    const sr=aCfg.sampleRate, ch=aCfg.numberOfChannels, total=Math.ceil((R.lastTs/1e6+1/30)*sr);
    const src=[];for(let c=0;c<ch;c++)src.push(buf.getChannelData(Math.min(c,buf.numberOfChannels-1)));
    /* encComp: measured per phone and codec by the recording self-check (encoder lead-in) */
    const step=R.ar*buf.sampleRate/sr, p0=(R.offset+encComp()*R.ar)*buf.sampleRate, N=4096;
    const fin=Math.round(0.03*sr), fout=R.fade?Math.min(Math.round(1.5*sr),Math.floor(total/3)):0;
    const gain=i=>{let g=1;if(i<fin)g=i/fin;if(fout&&i>total-fout)g=Math.min(g,(total-i)/fout);return g};
    for(let i0=0;i0<total&&!err;i0+=N){
      const n=Math.min(N,total-i0), data=new Float32Array(n*ch);
      for(let c=0;c<ch;c++){
        const s=src[c];
        for(let i=0;i<n;i++){
          const p=p0+(i0+i)*step, k=Math.floor(p);
          const x=(k<0||k+1>=s.length)?0:s[k]+(s[k+1]-s[k])*(p-k);
          data[interleaved?i*ch+c:c*n+i]=x*gain(i0+i);
        }
      }
      const ad=new AudioData({format:interleaved?'f32':'f32-planar',sampleRate:sr,numberOfFrames:n,numberOfChannels:ch,timestamp:Math.round(i0/sr*1e6),data});
      ae.encode(ad); ad.close();
      if(ae.encodeQueueSize>16)await new Promise(r=>setTimeout(r,0));
    }
    await ae.flush();
  }catch(e){err=e}
  try{ae.close()}catch(e){}
  return err?[]:out;
}
async function finishCodecRec(R){
  recMsg('Mixing in the song…');
  try{
    await R.ve.flush();
    if(R.failed)throw R.failed;
    if(!R.frames)throw new Error('no video frames were captured');
    let chunks=await encodeSong(R,false);
    if(!chunks.length)chunks=await encodeSong(R,true);   /* some encoders only take interleaved samples */
    if(!chunks.length)throw new Error("the phone produced no sound data");
    /* Opus: hand over the encoder's real header so players skip the right lead-in (the default skip is 80 ms).
       AAC: the muxer writes its own header (iPhone's encoder metadata made silent files). */
    chunks.forEach((c,i)=>R.muxer.addAudioChunkRaw(c.data,c.type,c.ts,c.dur,(i===0&&aCfg.mux==='opus'&&chunks.meta)?chunks.meta:undefined));
    if(R.failed)throw R.failed;
    R.muxer.finalize();
    let mp4=R.target.buffer;try{mp4=mp4AddAudioEdit(mp4,audioLeadSec(chunks.meta))}catch(e){mp4=R.target.buffer}
    const outBlob=new Blob([mp4],{type:'video/mp4'});
    finishRecording(outBlob); verifyTake(outBlob,R);
  }catch(e){recMsg("Couldn't finish the video ("+((e&&e.message)||e)+").",true);if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(null)}}
  finally{try{R.ve.close()}catch(e){}}
}


/* ---------- MP4 edit list for the audio's encoder lead-in ----------
   Audio encoders put a short lead-in before the first real sample (Opus: the pre-skip in its header, 6.5 ms here;
   AAC: about 1024–2112 samples). Players and decoders learn to skip it from the file's edit list. The muxer doesn't
   write one, so tools that check the timing (MirrorView's Pulse) refused takes. This adds one edit to the audio
   track: start at the lead-in, run to the end. The file is otherwise byte-identical (sizes and chunk offsets moved). */
function mp4AddAudioEdit(buf,leadSec){
  if(!(leadSec>0))return buf;
  const u8=new Uint8Array(buf),v=new DataView(buf),n=u8.length,str=p=>String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3]);
  const boxes=(V,U,from,to)=>{const out=[];for(let p=from;p+8<=to&&out.length<5000;){let size=V.getUint32(p),h=8;if(size===1){size=Number(V.getBigUint64(p+8));h=16}else if(size===0)size=to-p;if(size<h||p+size>to)break;out.push({type:String.fromCharCode(U[p+4],U[p+5],U[p+6],U[p+7]),start:p,data:p+h,end:p+size,head:h});p+=size}return out};
  const top=boxes(v,u8,0,n),moov=top.find(b=>b.type==='moov'),mdat=top.find(b=>b.type==='mdat');if(!moov)return buf;
  const kids=b=>boxes(v,u8,b.data,b.end),kid=(b,t)=>kids(b).find(x=>x.type===t);
  const time=b=>{const one=u8[b.data]===1,pos=b.data+(one?20:12);return {scale:v.getUint32(pos),dur:one?Number(v.getBigUint64(pos+4)):v.getUint32(pos+4)}};
  const mv=kid(moov,'mvhd');if(!mv)return buf;const movie=time(mv);
  let at=-1,trak=null,seg=0,mt=0;
  for(const t of kids(moov).filter(b=>b.type==='trak')){const mdia=kid(t,'mdia'),hdlr=mdia&&kid(mdia,'hdlr');if(!hdlr||str(hdlr.data+8)!=='soun')continue;
    if(kid(t,'edts'))return buf;const md=time(kid(mdia,'mdhd')),tk=kid(t,'tkhd');if(!tk||!md.scale)return buf;
    mt=Math.round(leadSec*md.scale);if(mt<=0||mt>=md.dur)return buf;seg=Math.round((md.dur-mt)/md.scale*movie.scale);at=tk.end;trak=t}
  if(at<0)return buf;
  const E=36,out=new Uint8Array(n+E),ov=new DataView(out.buffer);
  out.set(u8.subarray(0,at),0);out.set(u8.subarray(at),at+E);
  ov.setUint32(at,36);out.set([101,100,116,115],at+4);ov.setUint32(at+8,28);out.set([101,108,115,116],at+12);
  ov.setUint32(at+16,0);ov.setUint32(at+20,1);ov.setUint32(at+24,seg);ov.setInt32(at+28,mt);ov.setInt16(at+32,1);ov.setInt16(at+34,0);
  const grow=b=>{if(b.head===8)ov.setUint32(b.start,ov.getUint32(b.start)+E);else ov.setBigUint64(b.start+8,ov.getBigUint64(b.start+8)+BigInt(E))};
  grow(moov);grow(trak);
  /* the samples live in mdat; when it comes after moov, every chunk offset moves by the inserted bytes */
  if(mdat&&mdat.start>moov.start){
    const U=out,V=ov,top2=boxes(V,U,0,U.length),moov2=top2.find(b=>b.type==='moov'),k2=b=>boxes(V,U,b.data,b.end),c2=(b,t)=>k2(b).find(x=>x.type===t);
    for(const t of k2(moov2).filter(b=>b.type==='trak')){const st=c2(c2(c2(t,'mdia')||t,'minf')||t,'stbl');if(!st)continue;
      const so=c2(st,'stco'),co=c2(st,'co64');
      if(so){const cnt=V.getUint32(so.data+4);for(let i=0;i<cnt;i++){const q=so.data+8+i*4;V.setUint32(q,V.getUint32(q)+E)}}
      if(co){const cnt=V.getUint32(co.data+4);for(let i=0;i<cnt;i++){const q=co.data+8+i*8;V.setBigUint64(q,V.getBigUint64(q)+BigInt(E))}}}
  }
  return out.buffer;
}
/* the encoder's lead-in, in seconds: Opus says it in its header (pre-skip at 48 kHz); AAC encoders don't, so use the
   usual priming (Apple's 2112 samples, others 1024). The recording self-check corrects any remainder per phone. */
function audioLeadSec(meta){
  try{
    if(aCfg.mux==='opus'){const d=meta&&meta.decoderConfig&&meta.decoderConfig.description;if(!d)return 312/48000;
      const b=d instanceof ArrayBuffer?new Uint8Array(d):new Uint8Array(d.buffer,d.byteOffset,d.byteLength);
      if(b.length>=12&&String.fromCharCode(...b.subarray(0,8))==='OpusHead')return (b[10]|(b[11]<<8))/48000;return 312/48000}
    const apple=/Mac|iPhone|iPad/.test(navigator.platform||'')||/AppleWebKit/.test(navigator.userAgent)&&!/Chrome|Android/.test(navigator.userAgent);
    return (apple?2112:1024)/aCfg.sampleRate;
  }catch(e){return 0}
}

/* gather body tracking when the Projects sheet opens, so saving the backup can open the share sheet straight from the
   tap (iPhone only allows that right after a tap) */
$('#projBtn').addEventListener('click',()=>{S.bkBodies=null;bodiesForBackup().then(b=>{S.bkBodies=b}).catch(()=>{})});
/* ---------- body tracking in backups ----------
   Poses, 3D points and hip measures go into the backup as base64 (about 0.4 MB for 20 s of video); the per-frame
   cut-out masks don't (about 15 MB). On opening a backup they are stored under the video's key, so they reconnect
   as soon as the same video is added again. */
const f32ToB64=a=>{if(!a)return null;const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const b64ToF32=s=>{if(!s)return null;const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Float32Array(u.buffer)};
async function bodiesForBackup(){
  const out={};
  for(const n of S.sources){if(!n.key)continue;const B=n.body||await mediaGet('body:'+n.key);if(!B||!B.data||!B.n)continue;
    out[n.key]={v:B.v||1,cleanV:B.cleanV||0,stale:B.stale,kicks:B.kicks,rtmMs:B.rtmMs,rtmEp:B.rtmEp,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,seen:B.seen,multi:B.multi||0,clean:B.clean||null,pick:B.pick||null,start:B.start,end:B.end,
      data:f32ToB64(B.data),world:f32ToB64(B.world),hips:f32ToB64(B.hips),ext:f32ToB64(B.ext||null),cuts:B.cuts||null}}
  return out;
}
async function bodiesFromBackup(bodies){
  let k=0;if(!bodies||typeof bodies!=='object')return 0;
  for(const [key,o] of Object.entries(bodies)){try{
    if(!o||!o.n||typeof o.data!=='string')continue;const data=b64ToF32(o.data);if(!data||data.length!==o.n*RB.STRIDE)continue;
    const have=await mediaGet('body:'+key);if(have&&have.data&&have.n)continue;   /* never replace tracking already on this phone */
    const B={...o,data,world:b64ToF32(o.world),hips:b64ToF32(o.hips),ext:b64ToF32(o.ext),mask:null};await mediaPut('body:'+key,B);k++}catch(e){}}
  return k;
}

/* ---------- sound that stays clean on iPhone ----------
   Songs used to be decoded through the live audio engine (AudioContext) and re-saved at whatever rate the phone's
   audio was running at. That rate drops (16 or 24 kHz) during a call or with a Bluetooth headset's microphone, and it
   can change while the app is in the background, so the song file could come out muffled or scratchy. The engine
   also stayed open for the whole session, and iOS is known to garble page audio when an engine comes back from the
   background at a different rate. Now: songs are decoded offline at a fixed 44.1 kHz (no audio hardware involved);
   the live engine exists only for the beat click and the fallback recorder, and is closed whenever the app leaves
   the screen. */
const SONG_RATE=44100;
function decodeAudio(ab){
  const O=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!O)return new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej));
  let oc;try{oc=new O(2,SONG_RATE,SONG_RATE)}catch(e){return new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej))}
  return new Promise((res,rej)=>{const p=oc.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)});
}
/* decoding with a way out: if the phone's offline decoder hasn't answered in 8 s, try the live one; give up at 25 s
   (the song then plays straight from the file). A picked song could otherwise look as if nothing happened. */
function decodeAudioSafe(ab){
  const copy=ab.slice(0);   /* decodeAudioData takes the buffer over, so keep one for the second try */
  return new Promise((res,rej)=>{let over=false;const fin=(f,x)=>{if(!over){over=true;clearTimeout(t1);clearTimeout(t2);f(x)}};
    decodeAudio(ab).then(b=>fin(res,b),e=>{if(!over)tryLive()});
    let live=false;const tryLive=()=>{if(live)return;live=true;try{getCtx().decodeAudioData(copy.slice(0),b=>fin(res,b),e=>fin(rej,e))}catch(e){fin(rej,e)}};
    const t1=setTimeout(()=>{if(!over){S.decodeSlow=(S.decodeSlow||0)+1;tryLive()}},8000);
    const t2=setTimeout(()=>fin(rej,new Error('decode timed out')),25000)})}
function closeCtx(){
  if(!ctx)return; const c=ctx; ctx=null; recDest=null; try{c.close().catch(()=>{})}catch(e){}
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(!S.rec)closeCtx();S.awayAt=Date.now();return}
  /* back: the song player may have been interrupted while away; give it a fresh start when nothing is playing */
  const away=S.awayAt?Date.now()-S.awayAt:0; S.awayAt=0;
  if(away>3000&&!S.playing&&!S.rec&&S.liveSong&&S.liveSong.blob&&typeof refreshSong==='function')refreshSong();
});
window.addEventListener('pagehide',()=>{if(!S.rec)closeCtx()});

/* ---------- the body on recorded takes ----------
   With "Draw it on recorded takes" on, each recorded frame gets what the stage shows: the cut-out (if on) and the dance
   body with its hips (if Body is on), drawn at the take's own resolution from the pose for that exact frame. */
try{if(localStorage.getItem('rs-recbody')==='1')$('#recBody').checked=true}catch(e){}
$('#recBody').addEventListener('change',e=>{try{localStorage.setItem('rs-recbody',e.target.checked?'1':'0')}catch(err){}});
function drawBodyOnTake(el,t){
  if(!$('#recBody').checked||!window.RB)return;
  const n=srcOfEl(el),B=n&&bodyOf(n);if(!B)return;
  const rect=RB.containRect(cv.width,cv.height,el.videoWidth||B.w,el.videoHeight||B.h);
  try{
    if(S.cutOn&&RB.hasCutout(B))RB.cutout(cx,B,t,el,rect,{bg:S.cutBg,colour:'#2B2F6B',part:S.cutPart});
    if($('#bodyShow').checked)LOOK.drawBody(cx,B,t,rect,{hipPath:$('#hipShow').checked,meter:$('#hipShow').checked,tiltGuide:$('#hipShow').checked},1);
  }catch(e){}
}

/* ---------- sharing a routine ----------
   A .riddim file: a short text header, then the project (moves, routine, trims, speeds, song points), body tracking
   (poses, 3D points, hips; not the cut-out masks) and the videos and songs themselves, one after another. Built from
   the stored files without copying them into memory first. Opening it stores the media under their own keys, so the
   project opens ready to play; files already on the phone are kept, not replaced. */
const BUNDLE_MAGIC='RIDDIMSWAP1\n';
async function buildBundle(){
  await autosave(true);
  const data=snapshot(),keys=[];
  for(const n of S.sources)if(n.key&&!keys.includes(n.key))keys.push(n.key);
  for(const so of [S.mainSong,S.rtSong])if(so&&so.key&&!keys.includes(so.key))keys.push(so.key);
  const media=[],parts=[];let off=0,missing=0;
  for(const k of keys){const f=await mediaGet(k);if(!f){missing++;continue}
    media.push({key:k,name:f.name||k.split('|')[0],type:f.type||'',size:f.size,lastModified:f.lastModified||0,offset:off,length:f.size});parts.push(f);off+=f.size}
  const header=JSON.stringify({app:'riddim-swap',kind:'routine',v:1,name:PJ.name||'Routine',saved:new Date().toISOString(),data,bodies:S.bkBodies||await bodiesForBackup(),media});
  const hb=new TextEncoder().encode(header),len=new Uint8Array(4);new DataView(len.buffer).setUint32(0,hb.length,true);
  return {blob:new Blob([BUNDLE_MAGIC,len,hb,...parts],{type:'application/octet-stream'}),media:media.length,missing,bytes:off};
}
async function readBundle(file){
  const head=await file.slice(0,16).arrayBuffer(),magic=new TextDecoder().decode(new Uint8Array(head,0,BUNDLE_MAGIC.length));
  if(magic!==BUNDLE_MAGIC)return null;
  const hl=new DataView(head,BUNDLE_MAGIC.length,4).getUint32(0,true),start=BUNDLE_MAGIC.length+4;
  const j=JSON.parse(await file.slice(start,start+hl).text());if(j.app!=='riddim-swap'||j.kind!=='routine'||!j.data)throw new Error('not ours');
  const base=start+hl;let added=0;
  const end=base+(j.media||[]).reduce((m,x)=>Math.max(m,x.offset+x.length),0);if(file.size<end)throw new Error('incomplete file');
  for(const m of j.media||[]){const have=await mediaGet(m.key);if(have)continue;
    const part=file.slice(base+m.offset,base+m.offset+m.length);if(part.size!==m.length)throw new Error('incomplete file');
    await mediaPut(m.key,new File([part],m.name,{type:m.type,lastModified:m.lastModified}));added++}
  const nb=await bodiesFromBackup(j.bodies);
  return {j,added,nb};
}
$('#projShare').addEventListener('click',async()=>{
  if(!hasContent()){sheetMsg('Add a video or some moves first.',true);return}
  const b=$('#projShare');b.disabled=true;sheetMsg('Packing the routine…');
  try{
    const r=await buildBundle();
    const safe=(PJ.name||'routine').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'routine';
    const res=await saveFile(safe+'.riddim',r.blob,'application/octet-stream');
    const mb=(r.blob.size/1048576).toFixed(r.blob.size>10485760?0:1);
    sheetMsg(res==='saved'||res==='shared'||res==='downloaded'?`Routine shared (${mb} MB, ${r.media} video and song file${r.media===1?'':'s'}${r.missing?`; ${r.missing} file${r.missing>1?'s':''} weren't on this phone`:''}). They open it with "Open backup or shared routine".`:saveWords[res],res==='failed'||res==='busy');
  }catch(e){sheetMsg("Couldn't pack the routine: "+((e&&e.message)||e),true)}
  finally{b.disabled=false}
});
/* fallback recorder */
function recSongPos(){return recPos+(ctx.currentTime-recT)*S.ar}
function recStopSong(){if(!recSrc)return;const s=recSrc;recSrc=null;try{s.stop()}catch(e){}s.disconnect()}
function recStartSong(pos){
  recStopSong(); if(!buf||!recDest||pos>=buf.duration)return;
  const s=ctx.createBufferSource(); s.buffer=buf; s.playbackRate.value=S.ar; s.connect(recDest);
  const now=ctx.currentTime+0.02;
  if(pos<0){recT=now+(-pos)/S.ar;recPos=0;s.start(recT,0)} else {recT=now;recPos=pos;s.start(now,pos)}
  recSrc=s;
}
function recSync(force){
  if(!S.rec||S.rec.mode!=='mr')return;
  if(!S.playing||v.paused||S.stalled){recStopSong();return}
  const e=expected();
  if(!recSrc){if(force)recStartSong(e);return}
  if(force||Math.abs(recSongPos()-e)>0.12)recStartSong(e);
}
function pickMime(){
  const t=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  return t.find(x=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x))||'';
}
function drawFrame(){if(v.readyState>=2){if(S.recCompose)drawCompose(v.currentTime);else{drawFit(v);drawBodyOnTake(v,v.currentTime)}}}
function startMrRec(){
  const c=getCtx(); c.resume().catch(()=>{});
  if(!recDest)recDest=c.createMediaStreamDestination();
  const [w,h]=S.recCompose?[S.recCompose.lay.W,S.recCompose.lay.H]:recSize(); cv.width=w; cv.height=h; drawFrame();
  const stream=new MediaStream([...cv.captureStream(30).getVideoTracks(),...recDest.stream.getAudioTracks()]);
  const mime=pickMime();
  const mr=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:5000000}:undefined);
  const R={mode:'mr',mr,chunks:[],done:false};
  mr.ondataavailable=e=>{if(e.data&&e.data.size)R.chunks.push(e.data)};
  mr.onstop=()=>{if(R.done)return;R.done=true;finishRecording(new Blob(R.chunks,{type:mr.mimeType||mime||'video/mp4'}))};
  mr.start(500);
  return R;
}

function startRecording(){
  if(S.study)studyOff();
  const useCodecs=!!((S.recCompose?S.recCompose.cfg:vCfg)&&aCfg&&buf&&canCodecs());
  if(!useCodecs&&!(window.MediaRecorder&&cv.captureStream)){recMsg("This browser can't record video.",true);return}
  pause(); S.preview=null; S.segIdx=0; recMsg(''); updateTrim();
  const L=segs(), len=segStart(L.length,L);
  try{S.rec=useCodecs?startCodecRec():startMrRec();S.recLast=S.rec&&S.rec.mode;if(/debug/.test(location.hash))window.__lastRecMode=S.rec&&S.rec.mode}
  catch(e){S.rec=null;recMsg("Couldn't start recording on this device.",true);return}
  toStart(); if(useCodecs)S.switchPending=true;
  play();
  if(useCodecs)watchFrames(v);
  $('#recBtn span').textContent='Stop'; $('#recDot').hidden=false;
  recMsg('Recording '+(routineOn()?'the routine':'the clip')+' · '+fmt(len));
}
function stopRecording(){
  const R=S.rec; if(!R)return; S.rec=null;
  pause();
  if(S.recCompose){S.recCompose=null;try{recV.playbackRate=1}catch(e){}prReplayStop(true);if(PR.on)pracUI()}
  $('#recBtn span').textContent='Record'; $('#recDot').hidden=true;
  if(R.mode==='codecs'){finishCodecRec(R);return}
  recStopSong(); recMsg('Finishing the video…');
  try{if(R.mr.state!=='inactive'){R.mr.requestData&&R.mr.requestData();R.mr.stop()}}catch(e){}
  setTimeout(()=>{if(R.done)return;R.done=true;
    if(R.chunks.length)finishRecording(new Blob(R.chunks,{type:R.mr.mimeType||'video/mp4'}));
    else{recMsg("Recording didn't finish on this device. Try again in Safari.",true);if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(null)}}},5000);
}
function finishRecording(blob){
  if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(blob&&blob.size?blob:null);return}
  if(!blob.size){recMsg('Nothing was recorded. Try again with the clip playing.',true);return}
  if(take)URL.revokeObjectURL(take.url);
  const ext=/webm/.test(blob.type)?'webm':'mp4';
  take={blob,url:URL.createObjectURL(blob),ext};
  $('#takeVid').src=take.url;
  $('#takeInfo').textContent=(blob.size/1048576).toFixed(1)+' MB · '+ext.toUpperCase();
  $('#saveMsg').textContent=''; $('#take').hidden=false;
  recMsg('Take ready.');
  $('#take').scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('#recBtn').addEventListener('click',()=>{S.rec?stopRecording():startRecording()});
$('#discardBtn').addEventListener('click',()=>{if(take){URL.revokeObjectURL(take.url);take=null}$('#takeVid').removeAttribute('src');$('#take').hidden=true;recMsg('')});

function saveMsg(t,err){const m=$('#saveMsg');m.textContent=t;m.classList.toggle('err',!!err)}
async function getDownloads(){
  if(downloads)return downloads;
  try{if(window.claude&&window.claude.use)downloads=await window.claude.use('downloads')}catch(e){}
  return downloads;
}
/* Save a file: inside Claude via its save prompt; as an installed app via the share sheet
   (iPhone: "Save Video" puts it in Photos, "Save to Files" for anything); otherwise a normal download. */
async function saveFile(name,data,mime){
  const dl=window.claude?await getDownloads():null;
  if(dl){try{await dl.save({filename:name,data});return 'saved'}catch(e){const c=e&&e.code;return c==='declined'?'declined':c==='too_large'?'too_large':c==='rate_limited'?'busy':'failed'}}
  const blob=data instanceof Blob?data:new Blob([data],{type:mime||'application/octet-stream'});
  let file=null; try{file=new File([blob],name,{type:mime||blob.type})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file]});return 'shared'}
    catch(e){if(e&&e.name==='AbortError')return 'declined'}
  }
  try{const u=URL.createObjectURL(blob),ln=document.createElement('a');ln.href=u;ln.download=name;document.body.append(ln);ln.click();ln.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);return 'downloaded'}
  catch(e){return 'failed'}
}
const saveWords={saved:'Saved.',shared:'Done.',downloaded:'Downloaded.',declined:'Not saved.',too_large:'Too large to save. Make it shorter.',busy:'A save prompt is already open.',failed:"Couldn't save here."};
$('#saveBtn').addEventListener('click',async()=>{
  if(!take)return;
  const name='riddim-swap-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.'+take.ext;
  const r=await saveFile(name,take.blob,take.blob.type||'video/mp4');
  saveMsg(saveWords[r],r==='failed'||r==='too_large'||r==='busy');
});
getDownloads();

/* ---------- saving ----------
   Everything saves automatically on this phone (in the browser's storage for this app):
   the video and song files once, plus the moves, routine and settings every few seconds.
   Several routines can be kept as separate projects. A backup file holds everything except the media. */
let dbP=null;
function idb(){
  if(!dbP)dbP=new Promise((res,rej)=>{
    try{const r=indexedDB.open('riddim-swap',1);
      r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('media'))d.createObjectStore('media');if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects',{keyPath:'id'})};
      r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);}catch(e){rej(e)}
  });
  return dbP;
}
function idbDo(store,mode,make){
  return idb().then(d=>new Promise((res,rej)=>{
    const t=d.transaction(store,mode), r=make(t.objectStore(store));
    t.oncomplete=()=>res(r&&r.result); t.onerror=()=>rej(t.error||new Error('storage')); t.onabort=()=>rej(t.error||new Error('storage full'));
  }));
}
const mediaPut=(k,f)=>idbDo('media','readwrite',st=>st.put(f,k));
const mediaGet=k=>k?idbDo('media','readonly',st=>st.get(k)).catch(()=>null):Promise.resolve(null);
const mediaDel=k=>idbDo('media','readwrite',st=>st.delete(k)).catch(()=>{});
const projPut=p=>idbDo('projects','readwrite',st=>st.put(p));
const projGet=id=>idbDo('projects','readonly',st=>st.get(id)).catch(()=>null);
const projAll=()=>idbDo('projects','readonly',st=>st.getAll()).catch(()=>[]);
const projDel=id=>idbDo('projects','readwrite',st=>st.delete(id));
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

const PJ={id:null,name:'',busy:false,last:'',mediaFail:false,ok:true};
let saveTimer=0;
function saveState(t,warn){const e=$('#saveState');e.textContent=t;e.classList.toggle('warn',!!warn)}
function saveMedia(key,f){
  if(!key||!f)return;
  mediaPut(key,f).catch(()=>{PJ.mediaFail=true;saveState("Videos not kept: storage full",true)});
}
function songMeta(so){return so?{name:so.name,key:so.key,fname:so.fname,size:so.size,forceBpm:so.forceBpm||null,beatShift:so.beatShift||0,
  confirmed:!!so.confirmed,oneAt:so.oneAt??null,cleared:!!so.cleared}:null}
function snapshot(){
  return {v:1,
    sources:S.sources.map(n=>({id:n.id,num:n.num,name:n.name,key:n.key,fname:n.fname,size:n.size,
      cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut,motion:n.motion||null,curve:n.curve||null,kd:n.kd||null,pieces:n.pieces&&n.pieces.some(p=>!p.on)||n.pieces&&n.pieces.length>1?n.pieces:null})),
    beatSrc:S.beatSrc, blind:S.blind?{key:S.blind.key,ratings:S.blind.ratings,at:S.blind.at,revealed:!!S.blind.revealed}:null,
    cur:S.cur, moves:S.moves, seq:S.seq, main:S.main, rt:S.rt, loop:S.study?!!S.study.loop:S.loop,   /* Study and Learn turn Repeat on for themselves: save yours */ useSeq:S.useSeq,
    dBase:S.dBase, sBase:S.sBase, origAudio:$('#origAudio').checked,
    mainSong:songMeta(S.mainSong), rtSong:songMeta(S.rtSong),
    counts:{src:srcCount,move:moveCount,uid:uidCount}};
}
function hasContent(){return S.sources.length||S.mainSong||S.moves.length}
function summary(d){
  const nv=(d.sources||[]).length, nm=(d.moves||[]).length, nr=(d.seq||[]).length;
  return nv+(nv===1?' video':' videos')+' · '+nm+(nm===1?' move':' moves')+(nr?' · routine of '+nr:'');
}
async function autosave(force){
  if(PJ.busy||S.wiping)return;
  if(!PJ.id&&!hasContent())return;
  const data=JSON.stringify(snapshot());
  if(!force&&data===PJ.last)return;
  if(!PJ.id){
    const all=await projAll(); PJ.id='p'+Date.now().toString(36);
    if(!PJ.name)PJ.name='Routine '+(all.length+1); $('#projName').value=PJ.name; LS.set('rs-proj',PJ.id);
  }
  try{await projPut({id:PJ.id,name:PJ.name,updated:Date.now(),data});PJ.last=data;PJ.ok=true;
    if(!PJ.mediaFail)saveState('Saved')}
  catch(e){PJ.ok=false;saveState("Couldn't save",true)}
}
setInterval(()=>autosave(false),2500);
document.addEventListener('visibilitychange',()=>{if(document.hidden)autosave(false)});
window.addEventListener('pagehide',()=>autosave(false));

/* A file read back from storage is copied into memory: iPhone often refuses to play media
   straight out of storage, even though the file is there. */
async function toMemory(f){
  if(!f)return null;
  try{const buf=await f.arrayBuffer();return new File([buf],f.name||'media',{type:f.type||'',lastModified:f.lastModified||0})}
  catch(e){return f}
}
/* rebuild a video's players from its file (after the phone dropped them, or an error) */
function refreshSource(n){
  if(!n||!n.blob)return;
  const old=n.url; n.url=URL.createObjectURL(n.blob);
  [n.el,n.el2].forEach(e=>{if(e){e.src=n.url;e.load()}});
  if(old)setTimeout(()=>URL.revokeObjectURL(old),4000);
  if(S.primed&&(S.primed.el===n.el||S.primed.el===n.el2))S.primed=null;
}
function refreshSong(){const so=S.liveSong;if(so&&so.blob){const t=a.currentTime;setSongSrc(so.blob);a.addEventListener('loadedmetadata',()=>{try{a.currentTime=t}catch(e){}},{once:true})}}
function broken(e){return !!(e&&e.getAttribute('src')&&(e.error||(e.readyState===0&&e.networkState===3)))}
/* check every player; force=true rebuilds them all */
function healMedia(force){
  let n=0;
  S.sources.forEach(x=>{if(x.missing||!x.blob)return;if(force||broken(x.el)||broken(x.el2)){x.errs=0;refreshSource(x);n++}});
  if(S.liveSong&&S.liveSong.blob&&(force||broken(a))){refreshSong();n++}
  S.primed=null; return n;
}
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();return}
  /* back in the app: if it was away a while, the phone may have shut the players down without saying so */
  const away=hiddenAt?Date.now()-hiddenAt:0; hiddenAt=0;
  if(S.rec)return;
  const n=healMedia(away>30000);
  if(n)recMsg('');
});
window.addEventListener('pageshow',e=>{if(e.persisted)healMedia(true)});
$('#projHeal').addEventListener('click',()=>{if(S.rec)return;pause();const n=healMedia(true);sheetMsg(n?'Reloaded the videos and song. Try playing again.':'Nothing to reload yet.')});

/* wipe the workspace back to empty */
function resetAll(){
  if(S.rec)stopRecording(); pause();
  S.sources.forEach(n=>{if(n.url)URL.revokeObjectURL(n.url);if(n.el2)n.el2.remove();if(n.el.id!=='vid')n.el.remove()});
  const vid=$('#vid'); vid.removeAttribute('src'); try{vid.load()}catch(e){} vid.classList.remove('off'); v=vid;
  Object.assign(S,{sources:[],cur:null,hasV:false,cIn:0,cOut:null,moves:[],seq:[],useSeq:false,segIdx:0,preview:null,sel:null,
    primed:null,stopAtT:null,mainSong:null,rtSong:null,liveSong:undefined,loop:false,dBase:null,sBase:null,dAnchor:null,sAnchor:null,
    main:{offset:0,ar:1,vr:1},rt:{offset:0,ar:1,vr:1,fade:true,set:false,spMode:'all'},beatSrc:'detected',blind:null,fitPer:[]});
  srcCount=0;moveCount=0;uidCount=0; resetCut();
  $('#dBpm').value='';$('#sBpm').value='';$('#origAudio').checked=false;
  $('#empty').hidden=false; songMsg('MP3, M4A or a video. For a video, only its sound is used.'); $('#rSongMsg').hidden=true;
  if(take){URL.revokeObjectURL(take.url);take=null} $('#take').hidden=true; recMsg('');
  useSong(null); S.liveSong=null;
  enable(); renderSources(); renderMoves(); updateTrim(); updateMatch(); updateMissing();
}
async function restore(rec){
  PJ.busy=true;
  try{
    const d=JSON.parse(rec.data);
    resetAll();
    PJ.id=rec.id; PJ.name=rec.name; $('#projName').value=rec.name; LS.set('rs-proj',rec.id);
    const nv=(d.sources||[]).length; let k=0;
    for(const m of d.sources||[]){saveState('Loading videos '+(++k)+'/'+nv+'…');const f=await toMemory(await mediaGet(m.key));createSource(f,m)}
    const c=d.counts||{}; srcCount=Math.max(srcCount,c.src||0); moveCount=c.move||0; uidCount=c.uid||0;
    S.moves=d.moves||[]; S.seq=d.seq||[]; S.loop=!!d.loop;
    S.main=Object.assign({offset:0,ar:1,vr:1},d.main); S.rt=Object.assign({offset:0,ar:1,vr:1,fade:true,set:false,spMode:'all'},d.rt);
    S.dBase=d.dBase||null; S.sBase=d.sBase||null; S.beatSrc=d.beatSrc||'detected'; S.blind=d.blind||null;
    $('#dBpm').value=S.dBase?S.dBase.toFixed(1):''; $('#sBpm').value=S.sBase?S.sBase.toFixed(1):'';
    $('#origAudio').checked=!!d.origAudio;
    S.hasV=S.sources.some(n=>!n.missing);
    const first=srcById(d.cur)&&!srcById(d.cur).missing?srcById(d.cur):S.sources.find(n=>!n.missing)||S.sources[0];
    if(first){S.cur=first.id;v=first.el;showOnly(first.el);S.cIn=first.cIn||0;S.cOut=first.cOut??null;v.muted=!$('#origAudio').checked}
    $('#empty').hidden=S.hasV;
    for(const [slot,meta] of [['main',d.mainSong],['rt',d.rtSong]]){
      if(!meta)continue;
      saveState('Loading songs…');
      const f=await toMemory(await mediaGet(meta.key));
      if(f)loadSong(f,slot,true,meta);
      else{const so=Object.assign({blob:null,buf:null,dur:0,ready:false,missing:true},meta);if(slot==='rt')S.rtSong=so;else S.mainSong=so}
    }
    S.useSeq=!!d.useSeq&&S.seq.length>0; S.liveSong=undefined;
    enable(); renderSources(); renderMoves(); updateTrim(); updateMatch(); updateMissing(); renderBlind(); renderSongCard();
    PJ.last=JSON.stringify(snapshot()); saveState('Saved');
    return true;
  }catch(e){saveState("Couldn't open project",true);return false}
  finally{PJ.busy=false}
}
function missingItems(){
  const out=S.sources.filter(n=>n.missing).map(n=>({kind:'video',id:n.id,name:n.fname||n.name}));
  if(S.mainSong&&S.mainSong.missing)out.push({kind:'main',name:S.mainSong.fname||S.mainSong.name});
  if(S.rtSong&&S.rtSong.missing)out.push({kind:'rt',name:S.rtSong.fname||S.rtSong.name});
  return out;
}
function updateMissing(){
  const items=missingItems();
  $('#missBar').hidden=!items.length;
  $('#missText').textContent=items.length?items.length+(items.length===1?' file needs':' files need')+' re-adding on this phone':'';
  $('#missWrap').hidden=!items.length;
  const ul=$('#missList'); ul.textContent='';
  items.forEach(it=>{
    const li=el('li','miss'); li.append(el('span',null,(it.kind==='video'?'Video: ':'Song: ')+it.name));
    const lab=el('label','btn sm file','Find file'); const inp=el('input'); inp.type='file'; inp.accept=it.kind==='video'?'video/*':'';
    inp.addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
      if(it.kind==='video')relinkSource(it.id,f); else loadSong(f,it.kind)});
    lab.append(inp); li.append(lab); ul.append(li);
  });
}
async function renderProjects(){
  const all=(await projAll()).sort((x,y)=>y.updated-x.updated);
  const ul=$('#projList'); ul.textContent='';
  const others=all.filter(p=>p.id!==PJ.id);
  others.forEach(p=>{
    let d={}; try{d=JSON.parse(p.data)}catch(e){}
    const li=el('li','proj'), meta=el('div','meta');
    meta.append(el('b',null,p.name),el('span',null,summary(d)+' · '+new Date(p.updated).toLocaleDateString(undefined,{day:'numeric',month:'short'})));
    const acts=el('div','acts');
    const open=el('button','btn sm','Open'); open.addEventListener('click',async()=>{await autosave(true);await restore(p);renderProjects();sheetMsg('Opened "'+p.name+'".')});
    const del=el('button','btn sm danger','Delete'); let armed=false;
    del.addEventListener('click',async()=>{
      if(!armed){armed=true;del.textContent='Tap again';setTimeout(()=>{armed=false;del.textContent='Delete'},3000);return}
      await projDel(p.id); await cleanMedia(); renderProjects(); sheetMsg('Deleted "'+p.name+'".');
    });
    acts.append(open,del); li.append(meta,acts); ul.append(li);
  });
  $('#projEmpty').hidden=others.length>0;
  const cur=all.find(p=>p.id===PJ.id);
  $('#projInfo').textContent=cur?'Saved on this phone · '+summary(JSON.parse(cur.data)):'Saves on this phone automatically once you add a video or song.';
}
/* remove stored media that no project uses any more */
async function cleanMedia(){
  let n=0;
  try{
    if(S.wiping)return 0; try{await autosave(true)}catch(e){}       /* the open project counts as saved before anything goes */
    const keep=await mediaKeep();
    const keys=await idbDo('media','readonly',st=>st.getAllKeys());
    for(const k of keys||[])if(!isKept(keep,k)){await mediaDel(k);n++}
  }catch(e){}
  return n;
}
$('#storeClean').addEventListener('click',async()=>{const b=$('#storeClean');b.disabled=true;const before=storeLast&&storeLast.unused;
  const n=await cleanMedia();sheetMsg(n?'Cleared '+n+' unused item'+(n>1?'s':'')+(before?' ('+fmtMB(before)+')':'')+'.':'Nothing to clear.');renderStorage()});
/* what to keep: everything the open project or any saved project points at */
async function mediaKeep(){
  const keep=new Set(); S.sources.forEach(n=>n.key&&keep.add(n.key)); [S.mainSong,S.rtSong].forEach(so=>so&&so.key&&keep.add(so.key));
  (await projAll()).forEach(p=>{try{const d=JSON.parse(p.data);(d.sources||[]).forEach(m=>m&&m.key&&keep.add(m.key));[d.mainSong,d.rtSong].forEach(m=>m&&m.key&&keep.add(m.key))}catch(e){}});
  return keep;
}
const isKept=(keep,k)=>keep.has(k)||(String(k).startsWith('body:')&&keep.has(String(k).slice(5)))||(String(k).startsWith('bodypart:')&&keep.has(String(k).slice(9).replace(/#\d+$/,'')));
function sizeOf(v){
  if(!v)return 0; if(typeof Blob!=='undefined'&&v instanceof Blob)return v.size;
  if(v.data&&v.data.byteLength!=null){let s=2048;for(const f of ['data','world','hips'])if(v[f]&&v[f].byteLength)s+=v[f].byteLength;return s}
  if(v.byteLength!=null)return v.byteLength;
  if(Array.isArray(v)){let s=0;for(const q of v)if(q&&typeof q==='object')for(const f in q)if(q[f]&&q[f].byteLength)s+=q[f].byteLength;return s+v.length*64}
  try{return JSON.stringify(v).length}catch(e){return 0}
}
/* walk the media store with a cursor so nothing is read twice; blobs stay on disk, only their size is asked */
async function storageScan(){
  const keep=await mediaKeep(), out={media:0,body:0,unused:0,unusedN:0,projects:0,projectsN:0,total:null,quota:null,persisted:null};
  await idb().then(d=>new Promise((res,rej)=>{const t=d.transaction('media','readonly'),r=t.objectStore('media').openCursor();
    r.onsuccess=()=>{const c=r.result;if(!c)return;const k=String(c.key),sz=sizeOf(c.value);
      if(!isKept(keep,k)){out.unused+=sz;out.unusedN++}else if(k.startsWith('body:')||k.startsWith('bodypart:'))out.body+=sz;else out.media+=sz;c.continue()};
    t.oncomplete=res;t.onerror=()=>rej(t.error)})).catch(()=>{});
  (await projAll()).forEach(p=>{out.projectsN++;out.projects+=(p.data||'').length*2});
  try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();out.total=e.usage;out.quota=e.quota}}catch(e){}
  try{if(navigator.storage&&navigator.storage.persisted)out.persisted=await navigator.storage.persisted()}catch(e){}
  return out;
}
const fmtMB=b=>b==null?'?':b<1048576*0.1?(b/1024).toFixed(0)+' KB':b<1073741824?(b/1048576).toFixed(b<10485760?1:0)+' MB':(b/1073741824).toFixed(2)+' GB';
let storeLast=null;
async function renderStorage(){
  const list=$('#storeList');if(!list)return;
  let r;try{r=await storageScan()}catch(e){list.innerHTML='<li>Couldn’t read storage on this browser.</li>';return}
  storeLast=r;
  if(r.total!=null)r.total=Math.max(r.total,r.media+r.body+r.unused+r.projects);   /* the browser's figure can lag behind fresh writes */
  const ours=r.media+r.body+r.unused+r.projects, other=r.total!=null?Math.max(0,r.total-ours):0, all=Math.max(1,ours+other);
  const bar=$('#storeBar').children; [r.media,r.body,r.unused,other].forEach((v,i)=>{bar[i].style.width=(100*v/all).toFixed(2)+'%'});
  const li=(c,t,v)=>`<li><i class="dot ${c}"></i><span>${t}</span><b>${v}</b></li>`;
  list.innerHTML=li('u-media','Videos and songs',fmtMB(r.media))+li('u-body','Dance tracking',fmtMB(r.body))
    +li('u-unused','Unused'+(r.unusedN?' ('+r.unusedN+' item'+(r.unusedN>1?'s':'')+')':''),fmtMB(r.unused))
    +li('u-proj','Projects ('+r.projectsN+')',fmtMB(r.projects))
    +(r.total!=null?li('u-other','App and tracker files, about',fmtMB(other)):'')
    +(r.total!=null?`<li class="tot"><span>In use${r.quota?' of about '+fmtMB(r.quota)+' allowed':''}</span><b>${fmtMB(r.total)}</b></li>`:'')
    +(r.persisted===false?'<li class="warn"><span>The browser may clear these files if the phone runs low on space. Adding the app to your Home Screen makes that less likely.</span></li>':'')
    +(r.persisted===true?'<li class="ok"><span>Kept safe: the browser won’t clear these on its own.</span></li>':'');
  const b=$('#storeClean');b.disabled=!r.unusedN;b.textContent=r.unusedN?'Clear unused ('+fmtMB(r.unused)+')':'Nothing unused';
}
function sheetMsg(t,err){const m=$('#projMsg');m.hidden=!t;m.textContent=t||'';m.classList.toggle('err',!!err)}
let sheetFrom=null;
function openSheet(){sheetFrom=document.activeElement;renderStorage();$('#sheet').hidden=false;$('#sheetBack').hidden=false;sheetMsg('');$('#projName').value=PJ.name||'';renderProjects();updateMissing();$('#sheetClose').focus()}
function closeSheet(){$('#sheet').hidden=true;$('#sheetBack').hidden=true;if(sheetFrom&&sheetFrom.focus)sheetFrom.focus()}
$('#projBtn').addEventListener('click',openSheet);
$('#missFix').addEventListener('click',openSheet);
$('#sheetClose').addEventListener('click',closeSheet);
$('#sheetBack').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet()});
$('#projName').addEventListener('input',e=>{PJ.name=e.target.value.trim()||'Untitled routine';if(PJ.id)autosave(true)});
$('#projNew').addEventListener('click',async()=>{
  await autosave(true); resetAll(); PJ.id=null; PJ.name=''; PJ.last=''; $('#projName').value=''; LS.set('rs-proj','');
  saveState(''); renderProjects(); sheetMsg('New project started. Your last one is saved below.');
});
$('#projExport').addEventListener('click',async()=>{
  if(!hasContent()){sheetMsg('Add a video or some moves first.',true);return}
  autosave(true);   /* not awaited: the share sheet must open straight from the tap */
  const body=JSON.stringify({app:'riddim-swap',name:PJ.name||'Routine',saved:new Date().toISOString(),data:snapshot(),bodies:S.bkBodies||await bodiesForBackup()});
  const safe=(PJ.name||'routine').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'routine';
  const r=await saveFile(safe+'.riddim.json',body,'application/json');
  sheetMsg(r==='saved'||r==='shared'||r==='downloaded'?'Backup saved.':saveWords[r],r==='failed'||r==='busy');
});
$('#projImport').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f)return;
  try{
    sheetMsg('Opening…');
    const sh=await readBundle(f).catch(err=>{throw err});
    if(sh){await autosave(true);
      const rec={id:'p'+Date.now().toString(36),name:(sh.j.name||'Shared routine'),updated:Date.now(),data:JSON.stringify(sh.j.data)};
      await projPut(rec); await restore(rec); renderProjects();
      const n=missingItems().length;
      sheetMsg('Opened "'+rec.name+'"'+(sh.added?' with its '+sh.added+' video and song file'+(sh.added===1?'':'s'):'')+'.'+(sh.nb?' Body tracking for '+sh.nb+' video'+(sh.nb===1?'':'s')+' included.':'')+(n?' '+n+' file'+(n===1?' is':'s are')+' still missing.':' Ready to play.'));
      return}
    const j=JSON.parse(await f.text()); if(j.app!=='riddim-swap'||!j.data)throw new Error('not ours');
    await autosave(true);
    const rec={id:'p'+Date.now().toString(36),name:(j.name||'Imported routine'),updated:Date.now(),data:JSON.stringify(j.data)};
    const nb=await bodiesFromBackup(j.bodies);
    await projPut(rec); await restore(rec); renderProjects();
    const n=missingItems().length;
    sheetMsg('Opened "'+rec.name+'".'+(nb?' Body tracking for '+nb+' video'+(nb===1?'':'s')+' restored.':'')+(n?' Re-add the '+n+' file'+(n===1?'':'s')+' listed above.':''));
  }catch(err){sheetMsg("That file isn't a Riddim Swap backup or shared routine"+(err&&/incomplete/.test(err.message)?' (it looks cut short: try sending it again)':'')+'.',true)}
});
(async()=>{
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
  const id=LS.get('rs-proj'); if(!id)return;
  const rec=await projGet(id);
  if(rec&&await restore(rec)){const n=missingItems().length;saveState(n?'Restored · files missing':'Restored',!!n)}
})();

/* ================== BEAT ANALYSIS, ALIGNMENT, FIT, CHECKS ================== */

/* ---------- song beat ---------- */
function songChans(b){const out=[];for(let c=0;c<Math.min(2,b.numberOfChannels);c++)out.push(b.getChannelData(c));return out}
function analyzeSongObj(so,apply){
  if(!so||!so.buf)return;
  setTimeout(()=>{
    try{
      const an=RA.analyzeSong(songChans(so.buf),so.buf.sampleRate,{forceBpm:so.forceBpm||undefined,noPhaseFix:false});
      if(so.beatShift){const h=30/an.bpm;an.beats=an.beats.map(t=>t+h).filter(t=>t<so.buf.duration);an.downbeats=an.beats.filter((t,i)=>i%4===((an.phase||0)%4))}
      setOne(so,an);
      an.grid=RA.smoothBeats(an.beats);
      try{const R=RA.riddim(songChans(so.buf),so.buf.sampleRate,an.beats,an.downbeats);an.riddim=R?{events:R.events.map(e=>({t:e.t,kind:e.kind,w:e.w})),sure:R.sure,perBar:R.perBar}:null}catch(e){an.riddim=null}
      so.an=an;
    }catch(e){so.an=null}
    if(so===S.mainSong&&!so.cleared){if(apply)S.beatSrc='detected';if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
    renderSongCard(); scheduleFit();
    if(so._after){const f=so._after;so._after=null;f()}
  },30);
}
function riddimText(so){const R=so&&so.an&&so.an.riddim;if(!R)return '';
  if(!R.sure)return 'Riddim: no clear drums found, so the ball lands on the beat instead.';
  const k=R.events.filter(e=>e.kind!=='snare').length,s=R.events.filter(e=>e.kind!=='kick').length;
  return `Riddim: ${k} low hits (kick or bass) and ${s} snare, clap or rim hits found, about ${R.perBar.toFixed(1)} a bar. Turn the click to "on the riddim" to hear them.`}
function applyDetectedBeat(so){
  if(!so||!so.an)return;
  S.beatSrc='detected'; S.sBase=+so.an.bpm.toFixed(2); S.sAnchor=(so.an.downbeats[0]??so.an.beats[0])||0;
  $('#sBpm').value=S.sBase.toFixed(1); updateMatch();
}
/* beat grid of a song in song seconds. The Song tab's song uses taps instead when the dancer tapped. */
function songGrid(so){
  if(!so)return null;
  if(so===S.mainSong&&S.beatSrc==='tapped'&&S.sBase){
    const p=60/S.sBase, a0=S.sAnchor||0, dur=sDur(so)||600, b=[], d=[];
    let k0=Math.ceil(-a0/p); for(let k=k0;a0+k*p<dur;k++){const t=a0+k*p;b.push(t);if(((k%4)+4)%4===0)d.push(t)}
    return {beats:b,down:d,bpm:S.sBase,tapped:true};
  }
  if(so.cleared)return null;
  if(so.an&&so.an.beats.length>4)return {beats:so.an.beats,down:so.an.downbeats,bpm:so.an.bpm};
  return null;
}
function liveGrid(){return songGrid(S.liveSong)}
function routineSong(){return S.rtSong||S.mainSong}
function renderSongCard(){
  const so=S.mainSong, card=$('#songCard');
  if(!so||!so.an){card.hidden=!(so&&so.ready&&!so.an&&so.buf);if(!card.hidden){$('#songDet').textContent='Finding the beat…'}return}
  card.hidden=false; const an=so.an;
  card.classList.toggle('cleared',!!so.cleared);
  if(so.cleared){$('#songDet').textContent='Beat tracking cleared';return}
  $('#songDet').textContent=an.bpm.toFixed(1)+' BPM · '+(so.confirmed?'checked by your taps ✓':songSure()?'sure':'not sure')+(S.beatSrc==='tapped'?' · using your taps':'');
  $('#riddimMsg').textContent=riddimText(so);
  const box=$('#songCands'); box.textContent='';
  const all=[{bpm:+an.bpm.toFixed(1)}].concat((an.candidates||[]).filter(c=>Math.abs(c.bpm-an.bpm)/an.bpm>0.05)).slice(0,4);
  all.forEach((c,i)=>{const b=el('button','btn sm cand'+(i===0?' on':''),c.bpm.toFixed(1));b.setAttribute('aria-label','Use '+c.bpm.toFixed(1)+' BPM');
    b.addEventListener('click',()=>{if(i===0)return;so.forceBpm=c.bpm;so.beatShift=0;so.confirmed=false;S.beatSrc='detected';$('#songDet').textContent='Re-finding the beat…';analyzeSongObj(so,true)});box.append(b)});
  const w=$('#songWarn'); w.textContent='';
  const warn=t=>w.append(el('li',null,t));
  if(an.conf<0.35)warn('The tempo is unclear here (weak or irregular kick). Check it with the click, or tap it in the Tempo tab.');
  if(!so.confirmed&&an.conf>=0.5&&(an.phaseConf??1)<0.2)warn("Not sure whether the beat is here or half a beat later (the kick doesn't settle it). Tap to check, or listen with the click.");
  if(!so.confirmed&&an.candidates&&an.candidates.some(c=>c.score>=0.85&&(Math.abs(c.bpm/an.bpm-4/3)<0.03||Math.abs(c.bpm/an.bpm-3/4)<0.03)))warn('A 3-3-2 rhythm (like the dembow) can make a tempo 4/3 off look strong. If the clicks drift against the kick, try the other number, or Tap to check.');
  if(an.downConf<0.15&&so.oneAt==null)warn('Not sure which beat is the 1 of the bar. Press "This is the 1" on a 1 while it plays.');
}
$('#beatHalf').addEventListener('click',()=>{const so=S.mainSong;if(!so)return;so.beatShift=so.beatShift?0:0.5;so.confirmed=false;S.beatSrc='detected';analyzeSongObj(so,true)});
$('#beatUseDet').addEventListener('click',()=>{const so=S.mainSong;if(so&&so.an)applyDetectedBeat(so);renderSongCard();scheduleFit()});
$('#clickOn').addEventListener('change',e=>{S.clickOn=e.target.checked;if(S.clickOn){const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{})}});
/* ---------- trust, beat lights setting, clearing, tap to check ---------- */
function songSure(){
  if(S.beatSrc==='tapped')return true;
  const so=S.mainSong; if(!so||!so.an||so.cleared)return !!S.sBase;
  if(so.confirmed)return true;
  return so.an.conf>=0.5&&(so.an.phaseConf??1)>=0.2;
}
function danceSure(){
  if(S.danceSrc!=='detected')return true;
  const n=srcById(S.cur), m=n&&n.motion; if(!m)return true;
  if(m.confirmed)return true;
  if(m.source==='pose')return (m.seen??1)>=0.8;   /* body tracking: sure when the dancer was found on most frames */
  return (m.contrast??1)>=0.6&&(m.shake||0)<0.6;
}
function setBeatView(v0,save){
  S.beatView=v0; document.body.classList.remove('bv-off','bv-calm','bv-flash','bv-ball'); document.body.classList.add('bv-'+v0);
  $$('#bvSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bv===v0)));
  if(save)try{localStorage.setItem('rs-cues',v0)}catch(e){}
}
(()=>{let v0=null;try{v0=localStorage.getItem('rs-cues')}catch(e){}
  if(!['off','calm','ball'].includes(v0)){let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}v0=rm?'off':'ball'}
  setBeatView(v0,false)})();
$$('#bvSeg button').forEach(b=>b.addEventListener('click',()=>setBeatView(b.dataset.bv,true)));
/* the dancer's "1": downbeats are every 4th beat counting from the beat nearest to where they pressed */
function setOne(so,an){
  if(!so||!an||so.oneAt==null||!an.beats.length)return;
  let bi=0;an.beats.forEach((t,i)=>{if(Math.abs(t-so.oneAt)<Math.abs(an.beats[bi]-so.oneAt))bi=i});
  an.downbeats=an.beats.filter((t,i)=>(i-bi)%4===0); an.downConf=1;
}
/* ---- hits shown: a move often has two stops close together (feet land, then the arms hit). Merge stops closer than
   part of a beat into the strongest. Hits you marked are always kept, and detected ones right next to them are dropped. ---- */
function beatPer(){const G=liveGrid();return G&&G.bpm?60/G.bpm:0.48}
function hitCfg(){return {fewer:[0.9,0.35],normal:[0.65,0.25],more:[0,0.18]}[S.hitLevel||'normal']||[0.65,0.25]}
function mergeGap(){const c=hitCfg();return c[0]?Math.max(0.2,c[0]*beatPer()):0}
function hitsOf(n){
  if(!n||!n.motion)return [];
  const all=n.motion.beats, mine=all.filter(b=>b.mine), p=beatPer();
  const cfg=hitCfg();
  let det=all.filter(b=>!b.mine&&b.w>=cfg[1]&&!mine.some(m=>Math.abs(m.t-b.t)<0.15));
  if(cfg[0])det=RA.mergeHits(det,Math.max(0.2,cfg[0]*p));
  return det.concat(mine).sort((x,y)=>x.t-y.t);
}
function setHitLevel(l,save){S.hitLevel=l;$$('#hitLevel button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hl===l)));if(save)try{localStorage.setItem('rs-hitlevel',l)}catch(e){}}
try{const l=localStorage.getItem('rs-hitlevel');setHitLevel(['fewer','normal','more'].includes(l)?l:'normal',false)}catch(e){setHitLevel('normal',false)}
$$('#hitLevel button').forEach(b=>b.addEventListener('click',()=>{setHitLevel(b.dataset.hl,true);renderDance();renderMoves();scheduleFit();drawHitStrip()}));
/* ---- mark hits yourself: play the clip and tap on each hit; your taps replace the hits in the part you played ---- */
const TAP_LAT=0.03;   /* touch-to-event delay on phones, roughly */
let mark=null, undoStack=[];
function curVid(){return [...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'))||v}
function pushUndo(n){undoStack.push({id:n.id,motion:n.motion?JSON.parse(JSON.stringify(n.motion)):null});if(undoStack.length>20)undoStack.shift();$('#hitUndo').hidden=false}
function setMarkUI(on){$('#hitTap').hidden=!on;$('#hitMark').textContent=on?'Done marking':'Mark hits myself';$('#hitStrip').classList.toggle('edit',!on&&!!(srcById(S.cur)||{}).motion)}
$('#hitMark').addEventListener('click',()=>{
  const n=srcById(S.cur); if(!n||routineOn()){hMsg('Marking works on a single clip: switch to Clip mode first.');return}
  if(!mark){mark={n,taps:[],start:null};setMarkUI(true);hMsg('Press Hit on every hit while the clip plays. Only the part you play gets replaced.');if(curVid().paused)play();return}
  /* done */
  const m=mark; mark=null; setMarkUI(false); if(!curVid().paused)pause();
  if(m.taps.length<1){hMsg('No hits marked.');return}
  const end=m.end??m.taps[m.taps.length-1]+0.3, start=m.start;
  pushUndo(m.n);
  const old=m.n.motion&&m.n.motion.beats?m.n.motion.beats.filter(b=>b.t<start||b.t>end):[];
  const beats=old.concat(m.taps.map(t=>({t:+t.toFixed(3),w:1,mine:true}))).sort((x,y)=>x.t-y.t);
  const iv=[];for(let i=1;i<m.taps.length;i++)iv.push(m.taps[i]-m.taps[i-1]);
  m.n.motion=Object.assign({bpm:iv.length?60/RA.median(iv):0,conf:1,contrast:1,shake:0,cam:0},m.n.motion||{},{beats,confirmed:true,edited:true});
  hMsg('✓ '+m.taps.length+' hits marked by you between '+start.toFixed(1)+' s and '+end.toFixed(1)+' s.',true);
  renderDance(); renderMoves(); scheduleFit(); drawHitStrip();
});
$('#hitTap').addEventListener('pointerdown',e=>{
  e.preventDefault(); if(!mark)return; const vv=curVid();
  if(vv.paused){play();return}
  const t=Math.max(0,vv.currentTime-TAP_LAT*vv.playbackRate);
  if(mark.start==null)mark.start=Math.max(0,t-0.3);
  mark.taps.push(t); mark.end=t+0.3; hMsg(mark.taps.length+' marked… press Done marking when finished.');
  if(navigator.vibrate)try{navigator.vibrate(8)}catch(err){}
});
/* tap a tick on the strip under the video to remove that hit */
$('#hitStrip').addEventListener('click',e=>{
  const n=srcById(S.cur); if(mark||!n||!n.motion||routineOn())return;
  const r=e.currentTarget.getBoundingClientRect(), d=v.duration||0; if(!d)return;
  const t=(e.clientX-r.left)/r.width*d, tol=Math.max(0.12,14/r.width*d);
  const shown=hitsOf(n);let bi=-1,bd=1e9;shown.forEach((b,i)=>{const x=Math.abs(b.t-t);if(x<bd){bd=x;bi=i}});
  if(bi<0||bd>tol){hMsg('Tap right on a blue tick to remove that hit.');return}
  pushUndo(n); const gone=shown[bi], g=gone.mine?0.001:Math.max(0.12,mergeGap());
  /* a detected hit stands for the stops merged into it, so remove those too (otherwise the next one pops up) */
  n.motion.beats=n.motion.beats.filter(b=>b===gone?false:gone.mine?true:(b.mine||Math.abs(b.t-gone.t)>=g)); n.motion.edited=true;
  hMsg('Removed the hit at '+gone.t.toFixed(2)+' s.'); renderDance(); renderMoves(); scheduleFit(); drawHitStrip();
});
$('#hitUndo').addEventListener('click',()=>{const u=undoStack.pop();if(!u)return;const n=srcById(u.id);if(n){n.motion=u.motion;renderDance();renderMoves();scheduleFit();drawHitStrip();hMsg('Undone.')}$('#hitUndo').hidden=!undoStack.length});
const bMsg=(t,ok)=>{const m=$('#beatCheckMsg');m.textContent=t||'';m.classList.toggle('okmsg',!!ok)};
const hMsg=(t,ok)=>{const m=$('#hitCheckMsg');m.textContent=t||'';m.classList.toggle('okmsg',!!ok)};
function clearBeat(so,quiet){
  if(!so)return; so.cleared=true; so.confirmed=false; so.oneAt=null;
  if(so===S.mainSong&&S.beatSrc!=='tapped')clearSong();
  if(!quiet)bMsg('Beat tracking cleared: no beat grid, lights, click or fit for this song. Tap a tempo in the Tempo tab, or find the beat again.');
  renderSongCard(); updateMatch(); scheduleFit();
}
$('#beatClear').addEventListener('click',()=>clearBeat(S.mainSong));
$('#beatFind').addEventListener('click',()=>{const so=S.mainSong;if(!so)return;so.cleared=false;bMsg('');analyzeSongObj(so,true)});
function clearHits(n,quiet){
  if(!n)return; n.motion=null;
  if(n.id===S.cur&&S.danceSrc==='detected')clearDance();
  if(!quiet)hMsg('Hits cleared for this clip. Moves from it no longer count toward the fit or alignment.');
  renderDance(); renderMoves(); updateMatch(); scheduleFit();
}
$('#hitClear').addEventListener('click',()=>clearHits(srcById(S.cur)));
$('#tAll').addEventListener('click',()=>{
  [S.mainSong,S.rtSong].forEach(so=>{if(so)clearBeat(so,true)});
  S.sources.forEach(n=>{n.motion=null});
  S.seq.forEach(x=>{delete x.warp;delete x.warpR}); if(S.rt)S.rt.alignOn=false;
  clearDance(); clearSong(); S.beatSrc='detected'; S.danceSrc=null;
  bMsg('');hMsg('');renderSongCard();renderDance();renderMoves();updateTrim();updateMatch();scheduleFit();
  const m=$('#verdict'); if(m)m.textContent='Tracking cleared';
});
/* collect taps against a media element's clock; resets after a 2 s pause */
function tapLog(){let t=[];return {add(x){if(t.length&&(x<t[t.length-1]||x-t[t.length-1]>2))t=[];t.push(x);if(t.length>16)t.shift();return t.slice()},reset(){t=[]}}}
const songTaps=tapLog(), hitTaps=tapLog();
const circMean=fr=>{let c=0,s2=0;for(const f of fr){c+=Math.cos(2*Math.PI*f);s2+=Math.sin(2*Math.PI*f)}return Math.atan2(s2,c)/(2*Math.PI)};
function judgeSongTaps(so,T,round){
  const iv=[];for(let i=1;i<T.length;i++)iv.push(T[i]-T[i-1]); const per=RA.median(iv), tapBpm=60/per;
  const G=so.an&&!so.cleared?{beats:so.an.beats,bpm:so.an.bpm}:null;
  const useTaps=why=>{S.beatSrc='tapped';S.sBase=+tapBpm.toFixed(2);S.sAnchor=T[0];$('#sBpm').value=S.sBase.toFixed(1);so.confirmed=false;
    bMsg(why+' Your tapped tempo ('+tapBpm.toFixed(1)+' BPM) is used instead.',true);renderSongCard();updateMatch();scheduleFit()};
  if(!G){useTaps('There was no detected beat.');return}
  const r=tapBpm/G.bpm;
  if(Math.abs(r-1)<0.06){
    const p=60/G.bpm, fr=T.map(t=>{let b=G.beats[0];for(const x of G.beats)if(Math.abs(x-t)<Math.abs(b-t))b=x;return (t-b)/p});
    const ph=circMean(fr), miss=RA.median(fr.map(f=>Math.abs(f-ph)))*p*1000;
    if(Math.abs(ph)<=0.2){so.confirmed=true;bMsg('✓ Your taps match the beat (typical difference '+Math.round(Math.abs(ph)*p*1000)+' ms, your own spread '+Math.round(miss)+' ms).',true);renderSongCard();scheduleFit();return}
    if(Math.abs(ph)>=0.3&&round<2){so.beatShift=so.beatShift?0:0.5;so.confirmed=false;S.beatSrc='detected';so._after=()=>{so.confirmed=true;bMsg('Your taps were half a beat away from the detected beat, so the beat moved to where you tapped ✓',true);renderSongCard()};analyzeSongObj(so,true);return}
    bMsg('Your taps land between the beat and the "and". Try again, tapping on the kick drum.');return;
  }
  if(round<2){
    const near=[G.bpm*2,G.bpm/2].concat((so.an.candidates||[]).map(c=>c.bpm)).filter(b=>Math.abs(b/tapBpm-1)<0.06);
    if(near.length){so.forceBpm=+near[0].toFixed(2);so.beatShift=0;so.confirmed=false;S.beatSrc='detected';bMsg('Your taps say about '+tapBpm.toFixed(0)+' BPM, so the beat is being found again at that tempo…');
      so._after=()=>judgeSongTaps(so,T,round+1);analyzeSongObj(so,true);return}
  }
  useTaps('The detected tempo ('+G.bpm.toFixed(1)+') doesn\'t match your taps.');
}
$('#beatCheck').addEventListener('click',()=>{
  const so=S.mainSong; if(!so)return;
  if(!S.hasA||a.paused){songTaps.reset();bMsg('Press play, then tap this button on every beat (on the kick). 6 taps is enough.');return}
  const T=songTaps.add(a.currentTime);
  if(T.length<6){bMsg('Keep tapping… '+T.length+' of 6');return}
  songTaps.reset(); judgeSongTaps(so,T,0);
});
$('#beatOne').addEventListener('click',()=>{
  const so=S.mainSong; if(!so)return;
  if(!S.hasA||a.paused){bMsg('Press play, then press "This is the 1" right on a 1 (the start of a bar).');return}
  so.oneAt=a.currentTime;
  if(so.an&&!so.cleared){setOne(so,so.an);if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
  else if(S.beatSrc==='tapped')S.sAnchor=a.currentTime;
  bMsg('The 1 is set ✓',true); renderSongCard(); scheduleFit();
});
$('#hitCheck').addEventListener('click',()=>{
  const n=srcById(S.cur); if(!n||!n.motion)return;
  if(routineOn()||v.paused){hitTaps.reset();hMsg('Play this clip (Clip mode), then tap this button on each hit. 6 taps is enough.');return}
  const T=hitTaps.add(v.currentTime);
  if(T.length<6){hMsg('Keep tapping on the hits… '+T.length+' of 6');return}
  hitTaps.reset();
  const H=hitsOf(n).map(b=>b.t), near=T.filter(t=>H.some(h=>Math.abs(h-t)<0.12)).length, fr=near/T.length;
  if(fr>=0.7){n.motion.confirmed=true;hMsg('✓ '+near+' of '+T.length+' taps landed on a detected hit.',true)}
  else{n.motion.confirmed=false;hMsg('Only '+near+' of '+T.length+' taps landed near a detected hit, so the hits for this clip may be off. You can clear them, or tap the dance tempo in the Tempo tab instead.')}
  renderDance(); scheduleFit();
});

/* ---------- dance body ---------- */
function srcOfEl(el){return S.sources.find(x=>x.el===el||x.el2===el)}
function bodyOf(n){
  if(!n||!n.key)return null;
  if(n.body===undefined){n.body=null;mediaGet('body:'+n.key).then(b=>{if(b&&b.data&&b.n){n.body=b;
      /* the skeleton is kept but its hits aren't (the app was closed before the project saved them): find them again from it */
      if(!(n.motion&&n.motion.beats&&n.motion.beats.length)){try{if(hitsFromBody(n)){S.hitsRebuilt=(S.hitsRebuilt||0)+1;PR.hk='';try{renderMoves();scheduleFit();drawHitStrip()}catch(e){}autosave(true).catch(()=>{})}}catch(e){}}
      renderDance()}}).catch(()=>{});mediaGet('bodyalt:'+n.key).then(b=>{if(b&&b.data&&b.n){n.bodyAlt=b;cmpUI()}}).catch(()=>{})}
  return n.body;
}
try{const v0=localStorage.getItem('rs-body');if(v0==='0')$('#bodyShow').checked=false;const h0=localStorage.getItem('rs-hip');if(h0==='0')$('#hipShow').checked=false}catch(e){}
$('#bodyShow').addEventListener('change',e=>{try{localStorage.setItem('rs-body',e.target.checked?'1':'0')}catch(err){}});
$('#hipShow').addEventListener('change',e=>{try{localStorage.setItem('rs-hip',e.target.checked?'1':'0')}catch(err){}});
const bodyCv=$('#bodyCanvas'); let bodyDrawn=false, dockTick=0;
let bodyKey='';
/* the time of the frame actually on screen: while playing, the player's clock can run up to a frame ahead of the picture,
   so the skeleton would lead the dancer. requestVideoFrameCallback tells us the shown frame's own time. */
function shownT(el){if(!el)return 0;
  if(!el.__rvfc&&typeof el.requestVideoFrameCallback==='function'){el.__rvfc=true;const cb=(now,m)=>{el.__mt=m.mediaTime;el.__mtAt=performance.now();el.requestVideoFrameCallback(cb)};el.requestVideoFrameCallback(cb)}
  return S.playing&&!el.paused&&!el.seeking&&el.__mt!=null&&performance.now()-el.__mtAt<120&&Math.abs(el.__mt-el.currentTime)<0.25?el.__mt:el.currentTime}
function drawBody(){
  {const el0=curVid(),r0=bodyCv.getBoundingClientRect();const k=[el0&&el0.currentTime,S.playing,S.bodyPicking,S.cutOn,S.cutBg,S.cutPart,JSON.stringify(S.group),$('#bodyShow').checked,$('#hipShow').checked,Math.round(r0.width),Math.round(r0.height),S.cur,el0&&el0.videoWidth,(()=>{const q=el0&&srcOfEl(el0);return q&&q.body?q.body.n+':'+!!q.body.mask:0})(),S.liveBody?S.liveBody.B.n:0,S.bodyBusy,el0&&el0.seeking,S.beatView,S.hasA,S.mirror].join('|');
   if(!S.playing&&k===bodyKey)return; bodyKey=k}
  const el=curVid(), n=el&&srcOfEl(el), B0=n&&bodyOf(n), L=!B0&&n&&S.liveBody&&S.liveBody.src===n.id?S.liveBody:null, B=B0||(L&&L.B);
  /* while it tracks: the skeleton so far, only over the part that's tracked */
  const inLive=!L||(el&&shownT(el)>=L.from-0.05&&shownT(el)<=L.to+0.05);
  const on=($('#bodyShow').checked||S.cutOn||S.group.on)&&!!B&&inLive;
  if(S.bodyPicking&&!on){const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);bodyDrawn=true;return}
  /* while the video is seeking (a loop restarting, a jump) it still shows the old frame: drawing the new pose over it
     puts the skeleton on the wrong picture (e.g. the end screen), so draw nothing until the frame arrives */
  if(!on||el.seeking){if(bodyDrawn){const c=bodyCv.getContext('2d');c.clearRect(0,0,bodyCv.width,bodyCv.height);bodyDrawn=false;bodyKey=''}return}
  const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}
  const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);
  const rect=RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h);
  const ft=shownT(el);
  if(S.group.on){drawGroup(c,B,ft,w,h,dpr,el);bodyDrawn=true;return}
  /* Mirror: the video is flipped with CSS; the cut-out and skeleton are drawn flipped around the video's middle, the hip
     meter is drawn the right way round (its readings flipped to match what is seen) */
  const mir=!!S.mirror;if(mir){c.save();c.translate(w,0);c.scale(-1,1)}
  if(S.cutOn&&RB.hasCutout(B))RB.cutout(c,B,ft,el,rect,{bg:S.cutBg,colour:'#2B2F6B',part:S.cutPart});
  const cmpB=n.bodyAlt&&S.cmpShow!=='now'?n.bodyAlt:null;
  /* Show Upper / Legs (with the cut-out): only that half of the skeleton too */
  const part=S.cutOn&&RB.hasCutout(B)?S.cutPart:'all';
  if(cmpB&&S.cmpShow==='prev')RB.draw(c,cmpB,ft,RB.containRect(w,h,el.videoWidth||cmpB.w,el.videoHeight||cmpB.h),{dance:'#FFB347',hips:'#FFB347',hipPath:false,meter:false,tiltGuide:false,feet:false,part});
  const meterOn=$('#hipShow').checked&&!(S.beatView==='ball'&&S.hasA)&&!(PR.on&&PR.mode!=='split'),resB=(($('#dock')&&!$('#dock').hidden)?$('#dock').getBoundingClientRect().height+20:0)*dpr,bRect=RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h);
  if($('#bodyShow').checked&&S.cmpShow!=='prev')LOOK.drawBody(c,B,ft,bRect,{part,hipPath:$('#hipShow').checked,meter:meterOn&&!mir,tiltGuide:$('#hipShow').checked&&!(PR.on&&PR.mode!=='split'),reserveBottom:resB},dpr);
  /* Both: the previous skeleton thinner and on top, so the two can be seen where they differ */
  if(cmpB&&S.cmpShow==='both')RB.draw(c,cmpB,ft,RB.containRect(w,h,el.videoWidth||cmpB.w,el.videoHeight||cmpB.h),{dance:'#FFB347',hips:'#FFB347',hipPath:false,meter:false,tiltGuide:false,feet:false,lwScale:0.5,ends:false,part});
  if(mir){c.restore();if($('#bodyShow').checked&&S.cmpShow!=='prev'&&meterOn)RB.drawMeter(c,B,ft,bRect,{mirror:true,hips:LOOK.skel().hips,reserveBottom:resB})}
  if(S.bodyPicking){c.save();c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);c.restore()}
  bodyDrawn=true;
}
/* ---------- Group preview ----------
   Copies of the tracked dancer side by side, as a group would dance it, to see whether the moves work together and how
   much room each dancer needs. Copies can mirror every other one. Room is measured from the skeleton: at each frame,
   how far apart two copies must stand so no part of one comes near the other at the same height (in torso lengths,
   shown in metres taking a torso, shoulders to hips, as about half a metre). */
S.group={on:false,n:3,sp:null,mirror:false};
/* Mirror the clip: left and right swap, as if the dancer were your reflection (kept for every clip) */
S.mirror=false;try{S.mirror=localStorage.getItem('rs-mirror')==='1'}catch(e){}
function mirUI(){const b=$('#mirBtn');if(b){b.setAttribute('aria-pressed',String(S.mirror));b.setAttribute('aria-label',S.mirror?'Mirrored: tap to show the clip as filmed':'Mirror the clip')}$('#stage').classList.toggle('mirr',S.mirror)}
function setMirror(on){S.mirror=!!on;try{localStorage.setItem('rs-mirror',S.mirror?'1':'0')}catch(e){}mirUI();bodyKey='';try{drawBody()}catch(e){}}
$('#mirBtn').addEventListener('click',e=>{e.stopPropagation();setMirror(!S.mirror)});
mirUI();
try{const g=JSON.parse(localStorage.getItem('rs-group')||'null');if(g){S.group.n=Math.max(2,Math.min(8,g.n|0||3));S.group.sp=g.sp>0?+g.sp:null;S.group.mirror=!!g.mirror}}catch(e){}
const GR_M=0.5;   /* metres per torso length (rough, adult) */
/* Formations: where each dancer stands, as a floor plan (x across and z back from the front, in spacings), with changes
   at chosen beats of the clip. Each change keeps a shape (Line, V, Two rows, Wedge, Circle, or your own after dragging
   the dancers on the floor plan); dancers walk to the new spots over the 2 beats from the change. Kept per clip;
   shapes you save are kept for every clip. */
S.group.forms={};S.group.edit=false;let GR_SAVED=[],grLastFi=-1,GR_LAST=[];
try{const f=JSON.parse(localStorage.getItem('rs-group-forms')||'null');if(f&&typeof f==='object')S.group.forms=f}catch(e){}
try{const g=JSON.parse(localStorage.getItem('rs-group-shapes')||'null');if(Array.isArray(g))GR_SAVED=g.filter(x=>x&&Array.isArray(x.pos)).slice(0,12)}catch(e){}
const grFormSave=()=>{try{localStorage.setItem('rs-group-forms',JSON.stringify(S.group.forms))}catch(e){}};
const grShapesSave=()=>{try{localStorage.setItem('rs-group-shapes',JSON.stringify(GR_SAVED))}catch(e){}};
const GR_SHAPES={line:'Line',v:'V',rows:'Two rows',wedge:'Wedge',circle:'Circle'};
function grShape(kind,n){const P=[];
  if(kind==='v'){for(let k=0;k<n;k++){const x=k-(n-1)/2;P.push([x,Math.abs(x)*0.7])}}
  else if(kind==='rows'){const f=Math.ceil(n/2),b=n-f,sh=(f-b)%2===0?0.5:0;for(let k=0;k<f;k++)P.push([k-(f-1)/2,0]);for(let k=0;k<b;k++)P.push([k-(b-1)/2+sh,1])}   /* the back row in the gaps (staggered) */
  else if(kind==='wedge'){let i=0;while(P.length<n){for(let j=0;j<=i&&P.length<n;j++)P.push([j-i/2,i*0.9]);i++}}
  else if(kind==='circle'){if(n<3)return grShape('line',n);const r=Math.max(0.9,n/(2*Math.PI)*1.15);for(let k=0;k<n;k++){const a=2*Math.PI*k/n;P.push([+(r*Math.sin(a)).toFixed(3),+(r*(1-Math.cos(a))).toFixed(3)])}}
  else for(let k=0;k<n;k++)P.push([k-(n-1)/2,0]);
  return P}
const grKey=()=>{const n=srcById(S.cur);return n?String(n.key||n.id):''};
function grForms(){const k=grKey();let F=S.group.forms[k];if(!Array.isArray(F)||!F.length)F=[{t:0,shape:'line'}];return F}
function grSetForms(F){const k=grKey();if(!k)return;F.sort((a,b)=>a.t-b.t);F[0].t=Math.min(F[0].t,0);S.group.forms[k]=F;grFormSave()}
/* a change's spots for n dancers (a custom shape keeps its dancers; extra ones join the end of the front row) */
function grPosOf(f,n){if(f.shape!=='custom'||!Array.isArray(f.pos))return grShape(f.shape,n);const P=f.pos.slice(0,n).map(q=>[+q[0]||0,Math.max(0,+q[1]||0)]);
  while(P.length<n){const mx=P.reduce((m,q)=>q[1]<0.3?Math.max(m,q[0]):m,-1e9);P.push([mx>-1e8?mx+1:P.length,0])}return P}
function grFormAt(t){const F=grForms();let i=0;for(let j=0;j<F.length;j++)if(F[j].t<=t+1e-3)i=j;return i}
function grPositions(t){const F=grForms(),n=S.group.n,i=grFormAt(t),P=grPosOf(F[i],n);if(i===0)return P;
  const tr=2*beatPer(),p=Math.max(0,Math.min(1,(t-F[i].t)/tr));if(p>=1)return P;const e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2,Q=grPosOf(F[i-1],n);
  return P.map((q,k)=>[Q[k][0]+(q[0]-Q[k][0])*e,Q[k][1]+(q[1]-Q[k][1])*e])}
/* the closest two dancers in the same row (side by side), in spacings, over every change */
function grMinSep(){const F=grForms(),n=S.group.n;let m=1e9;for(const f of F){const P=grPosOf(f,n);for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)if(Math.abs(P[a][1]-P[b][1])<0.5)m=Math.min(m,Math.abs(P[a][0]-P[b][0]))}return m}
function grName(f){return f.shape==='custom'?(f.name||'Your shape'):GR_SHAPES[f.shape]||'Line'}
const grSave=()=>{try{localStorage.setItem('rs-group',JSON.stringify({n:S.group.n,sp:S.group.sp,mirror:S.group.mirror}))}catch(e){}};
const GR_J=[0,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32], GR_BONES=[[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28],[11,23],[12,24]];
function groupRoom(B){
  if(B._room&&B._room.n===B.n)return B._room;
  const W=B.w||1,H=B.h||1,S0=RB.STRIDE,ts=[],fr=[],Ts=[],hx=[],hy=[];
  for(let i=0;i<B.n;i++){const t=B.data[i*S0];const P=RB.poseAt(B,t);if(!P)continue;
    const v=j=>P[j][2]>=0.35,X=j=>[P[j][0]*W,P[j][1]*H];
    const sh=[(P[11][0]+P[12][0])/2*W,(P[11][1]+P[12][1])/2*H],hp=[(P[23][0]+P[24][0])/2*W,(P[23][1]+P[24][1])/2*H];
    const pts=[];for(const j of GR_J)if(v(j))pts.push(X(j));
    for(const [a,b] of GR_BONES)if(v(a)&&v(b)){const p=X(a),q=X(b);pts.push([(p[0]+q[0])/2,(p[1]+q[1])/2])}
    if(pts.length<6)continue;ts.push(t);fr.push(pts);Ts.push(Math.hypot(sh[0]-hp[0],sh[1]-hp[1]));hx.push(hp[0]);hy.push(hp[1])}
  if(!fr.length)return B._room={n:B.n,none:true};
  const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]};
  const T=med(Ts)||1,cx=med(hx),band=0.4*T,margin=0.2*T;
  /* how far right of L the copy R must stand (its own position counted) so they don't meet */
  const need=(L,R,mR)=>{let m=-1e9;for(const p of L)for(const q0 of R){if(Math.abs(p[1]-q0[1])>band)continue;const qx=mR?2*cx-q0[0]:q0[0];const d=p[0]-qx+margin;if(d>m)m=d}return m};
  const mir=P=>P.map(p=>[2*cx-p[0],p[1]]);
  const nU=[],nM=[];let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const P of fr){nU.push(need(P,P,false)/T);nM.push(Math.max(need(P,P,true),need(mir(P),mir(P),true))/T);
    for(const p of P){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}}
  /* a touch counts when it lasts 3 frames or more (a single odd frame of tracking isn't a real touch) */
  const steady=a=>a.map((v,i)=>Math.min(v,a[i-1]??v,a[i+1]??v));
  const sU=steady(nU),sM=steady(nM),rec=a=>Math.max(1,Math.ceil(Math.max(...a)*10)/10);
  return B._room={n:B.n,T,cx,hy:med(hy),ts,nU:sU,nM:sM,recU:rec(sU),recM:rec(sM),box:[x0,x1,y0,y1]};
}
function groupSpacing(R){return S.group.sp||(S.group.mirror?R.recM:R.recU)}
function groupCheck(R,d){const a=S.group.mirror?R.nM:R.nU;let k=0,worst=-1,wi=-1;for(let i=0;i<a.length;i++){if(a[i]>d){k++;if(a[i]>worst){worst=a[i];wi=i}}}return {frac:k/a.length,at:wi>=0?R.ts[wi]:null}}
function groupNeedAt(R,t){const a=S.group.mirror?R.nM:R.nU;let lo=0,hi=R.ts.length-1;while(lo<hi){const m=(lo+hi)>>1;if(R.ts[m]<t)lo=m+1;else hi=m}const i=lo;return Math.abs(R.ts[i]-t)<0.1?a[i]:null}
/* with Cut out on, the copies are the real dancer (that part of the body, on the chosen background) instead of only
   skeletons; the skeleton goes on top when Body is on */
let grBcv=null;
function groupCut(B){return !!(S.cutOn&&RB.hasCutout(B))}
function drawGroup(c,B,t,w,h,dpr,el){
  const cut=groupCut(B)&&el&&el.videoWidth;
  c.fillStyle=cut&&S.cutBg==='colour'?'#2B2F6B':'#0B0D11';c.fillRect(0,0,w,h);
  if(cut&&S.cutBg==='blur'){if(!grBcv)grBcv=document.createElement('canvas');const sw=Math.max(8,Math.round(w/24)),sh=Math.max(8,Math.round(h/24));if(grBcv.width!==sw||grBcv.height!==sh){grBcv.width=sw;grBcv.height=sh}
    const bx=grBcv.getContext('2d');bx.imageSmoothingEnabled=true;bx.drawImage(el,0,0,sw,sh);c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(grBcv,0,0,w,h);c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.restore()}
  const R=groupRoom(B);if(R.none)return;
  const n=S.group.n,d=groupSpacing(R)*R.T,W=B.w||1,H=B.h||1;
  /* the cut-out reaches past the joints (top of the head, hands, clothes): leave room for it */
  const ex=cut?0.3*R.T:0;let [bx0,bx1,by0,by1]=[R.box[0]-ex,R.box[1]+ex,R.box[2]-(cut?0.5*R.T:0),R.box[3]+(cut?0.1*R.T:0)];
  /* Legs / Upper only: frame that half, so it fills the space */
  if(cut&&S.cutPart==='legs'&&R.hy)by0=R.hy-0.35*R.T; if(cut&&S.cutPart==='upper'&&R.hy)by1=R.hy+0.35*R.T;
  const mirOf=k=>(S.group.mirror&&k%2===1)!==!!S.mirror;
  /* each dancer at their spot in the formation: further back is smaller and higher (simple perspective) */
  const Pos=grPositions(t),fy=R.box[3],L=0.8*(R.box[3]-R.box[2]),Fd=3.5*d;
  const D=Pos.map(([x,z],k)=>{const X=x*d,Z=Math.max(0,z)*d;return {k,x,z,X,Z,kk:Fd/(Fd+Z),m:mirOf(k)}});
  const G=(q,px,py)=>[(q.X+(q.m?R.cx-px:px-R.cx))*q.kk,fy-(fy-py)*q.kk-(1-q.kk)*L];
  let gx0=1e9,gx1=-1e9,gy0=1e9,gy1=-1e9;for(const q of D)for(const px of [bx0,bx1])for(const py of [by0,by1]){const g=G(q,px,py);gx0=Math.min(gx0,g[0]);gx1=Math.max(gx1,g[0]);gy0=Math.min(gy0,g[1]);gy1=Math.max(gy1,g[1])}
  const dock=$('#dock'),resB=(dock&&!dock.hidden?dock.getBoundingClientRect().height+16:0)*dpr,pad=14*dpr,top=26*dpr,side=52*dpr;   /* clear of the full-screen button */
  const s=Math.min((w-2*side)/(gx1-gx0),(h-top-resB-pad)/(gy1-gy0));
  const ox=(w-(gx1-gx0)*s)/2-gx0*s,oy=top-gy0*s+Math.max(0,(h-top-resB-pad-(gy1-gy0)*s)/2);
  /* floor: the front line, and the back when there are rows */
  const zmax=Math.max(...D.map(q=>q.Z));c.strokeStyle='rgba(243,241,236,.12)';c.lineWidth=Math.max(1,dpr);c.beginPath();
  if(by1>=R.box[3]){c.moveTo(pad,oy+fy*s+4*dpr);c.lineTo(w-pad,oy+fy*s+4*dpr);if(zmax>0){const kb=Fd/(Fd+zmax),yb=oy+(fy-(1-kb)*L)*s+4*dpr;c.moveTo(w*0.18,yb);c.lineTo(w*0.82,yb)}}c.stroke();
  /* touching: two dancers in the same row closer than the moves need right now */
  const nd=groupNeedAt(R,t);let touch=false;
  if(nd!=null){c.save();c.strokeStyle='rgba(242,125,116,.85)';c.setLineDash([6*dpr,6*dpr]);c.lineWidth=2*dpr;
    for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){const A=D[a],Bq=D[b];if(Math.abs(A.z-Bq.z)>=0.5)continue;if(Math.abs(A.x-Bq.x)*d/R.T>=nd)continue;
      /* only neighbours: nobody standing between them in that row */
      if(D.some(q=>q!==A&&q!==Bq&&Math.abs(q.z-A.z)<0.5&&q.x>Math.min(A.x,Bq.x)&&q.x<Math.max(A.x,Bq.x)))continue;
      touch=true;const kk=(A.kk+Bq.kk)/2,xm=ox+((A.X+Bq.X)/2*kk)*s,ya=oy+(fy-(fy-by0)*kk-(1-kk)*L)*s,yb=oy+(fy-(1-kk)*L)*s;c.beginPath();c.moveTo(xm,ya);c.lineTo(xm,yb);c.stroke()}
    c.restore()}
  const part=cut?S.cutPart:'all',skel=!cut||$('#bodyShow').checked;
  const img=cut?RB.cutDancer(B,t,el,W*s,H*s,part):null;
  GR_LAST=D.map(q=>({x:q.x,z:q.z,kk:q.kk}));
  for(const q of D.slice().sort((a,b)=>b.Z-a.Z)){const g=G(q,0,0),rect={x:ox+g[0]*s,y:oy+g[1]*s,w:(q.m?-1:1)*W*q.kk*s,h:H*q.kk*s};
    c.save();c.globalAlpha=Math.max(0.5,1-(1-q.kk)*1.8);   /* further back: a little fainter */
    if(img){c.save();c.translate(rect.x,0);if(q.m)c.scale(-1,1);c.drawImage(img,0,rect.y,W*q.kk*s,H*q.kk*s);c.restore()}
    if(skel)LOOK.drawBody(c,B,t,rect,{hipPath:false,meter:false,tiltGuide:false,feet:false,part},dpr);c.restore()}
  c.font=`700 ${Math.round(12*dpr)}px Figtree,sans-serif`;c.textAlign='left';c.textBaseline='top';
  c.fillStyle=touch?'#F27D74':'rgba(243,241,236,.7)';
  const F=grForms(),fi=grFormAt(t);if(fi!==grLastFi){grLastFi=fi;setTimeout(grFormUI,0)}
  c.fillText(`${n} dancers · ${grName(F[fi])}`+(F.length>1?` (${fi+1}/${F.length})`:'')+` · ${(d/R.T*GR_M).toFixed(1)} m apart`+(touch?' · touching here':''),pad,8*dpr);
}
function groupUpdate(){
  const n=srcById(S.cur),B=n&&bodyOf(n),on=!!(S.group.on&&B);
  $('#dkGroup').hidden=!B;$('#dkGroup').setAttribute('aria-pressed',String(on));
  $('#groupBar').hidden=!on;if(!on)return;
  const R=groupRoom(B);if(R.none){$('#grVerdict').textContent='No skeleton to copy yet.';return}
  const rec=S.group.mirror?R.recM:R.recU,d=groupSpacing(R),ms=grMinSep(),chk=ms<1e8?groupCheck(R,d*ms):{frac:0,at:null},m=x=>(x*GR_M).toFixed(1)+' m';
  $('#grN').textContent=S.group.n;$('#grLess').disabled=S.group.n<=2;$('#grMore').disabled=S.group.n>=8;
  const sp=$('#grSp');if(document.activeElement!==sp)sp.value=d;$('#grSpOut').textContent=m(d)+(S.group.sp?'':' (auto)');
  $('#grMirror').checked=S.group.mirror;
  let ex=[1e9,-1e9],zz=0;for(const f of grForms())for(const q of grPosOf(f,S.group.n)){ex[0]=Math.min(ex[0],q[0]);ex[1]=Math.max(ex[1],q[0]);zz=Math.max(zz,q[1])}
  const width=(ex[1]-ex[0])*d+(R.box[1]-R.box[0])/R.T,deep=zz>0?` · ~${m(zz*d+0.8)} deep`:'';
  /* short, so it fits on one or two lines under the video (the full sentence is in the title) */
  const tch=chk.frac>0?`touch ${Math.max(1,Math.round(chk.frac*100))}% of the time (most at ${fmt(chk.at)})`:`no touching`;
  $('#grVerdict').textContent=`Each needs ~${m(rec)} · ${S.group.n} need ~${m(width)} across${deep} · ${tch}`;
  $('#grVerdict').title=`Each dancer needs about ${m(rec)} side to side; ${S.group.n} dancers need about ${m(width)} across${deep?' and '+deep.slice(4):''}. At ${m(d)} apart: ${tch}.`;
  $('#grVerdict').classList.toggle('bad',chk.frac>0);
  $('#grFit').hidden=!(chk.frac>0);
  grFormUI();
}
/* the formation row: shapes, the changes through the clip, and the floor plan to drag dancers on */
function grNowT(){const el=curVid();return el?shownT(el):0}
function grFormUI(){
  const F=grForms(),t=grNowT(),i=grFormAt(t),f=F[i],box=$('#grShapes');box.textContent='';
  const add=(label,on,fn,x)=>{const b=document.createElement('button');b.type='button';b.className='pchip';b.textContent=label;b.setAttribute('aria-pressed',String(!!on));b.addEventListener('click',fn);
    if(x){const k=document.createElement('span');k.className='grx';k.textContent='×';k.setAttribute('role','button');k.setAttribute('aria-label','Delete '+label);k.addEventListener('click',e=>{e.stopPropagation();x()});b.appendChild(k)}box.appendChild(b)};
  for(const [k,name] of Object.entries(GR_SHAPES))add(name,f.shape===k,()=>grPick({shape:k}));
  GR_SAVED.forEach((g,j)=>add(g.name,f.shape==='custom'&&f.name===g.name,()=>grPick({shape:'custom',pos:g.pos.map(q=>q.slice()),name:g.name}),()=>{GR_SAVED.splice(j,1);grShapesSave();grFormUI()}));
  const ch=$('#grChanges');ch.textContent='';
  F.forEach((g,j)=>{const b=document.createElement('button');b.type='button';b.className='grch';b.setAttribute('aria-pressed',String(j===i));
    b.innerHTML=`<b>${fmtClock(Math.max(0,g.t))}</b><span></span>`;b.querySelector('span').textContent=grName(g);b.title='Go to this change';
    b.addEventListener('click',()=>grGo(Math.max(S.cIn||0,g.t)+0.001));
    if(j>0){const k=document.createElement('span');k.className='grx';k.textContent='×';k.setAttribute('role','button');k.setAttribute('aria-label','Remove the change at '+fmtClock(g.t));
      k.addEventListener('click',e=>{e.stopPropagation();const G=grForms().slice();G.splice(j,1);grSetForms(G);groupUpdate();bodyKey='';drawBody()});b.appendChild(k)}
    ch.appendChild(b)});
  $('#grEdit').setAttribute('aria-pressed',String(S.group.edit));$('#grPlan').toggleAttribute('hidden',!S.group.edit);   /* an SVG has no .hidden */
  grPlanDraw();
}
function grGo(t){pause();const el=curVid();try{el.currentTime=t}catch(e){}bodyKey='';setTimeout(()=>{groupUpdate();drawBody()},120)}
/* pick a shape for the change playing now */
function grPick(g){const F=grForms().map(x=>({...x})),i=grFormAt(grNowT());F[i]={...F[i],...g};if(g.shape!=='custom'){delete F[i].pos;delete F[i].name}grSetForms(F);groupUpdate();bodyKey='';drawBody()}
/* a new change at the beat nearest to now, starting from the current spots */
function grAddChange(){const t=grNowT(),bt=clipBeatTimes();let T=t;if(bt){let b=bt[0];for(const x of bt)if(Math.abs(x-t)<Math.abs(b-t))b=x;T=b}else{const p=beatPer(),c0=S.cIn||0;T=c0+Math.round((t-c0)/p)*p}
  T=+T.toFixed(3);const F=grForms().map(x=>({...x}));if(F.some(x=>Math.abs(x.t-T)<0.05)){recMsg('There\'s already a change on this beat. Move on a beat or more, then add one.');return}
  /* a new change starts as the next shape along, so it's visibly a change; pick another or drag to make it yours */
  const cur=F[grFormAt(T)],ks=Object.keys(GR_SHAPES),nx=ks[(Math.max(0,ks.indexOf(cur.shape))+1)%ks.length];F.push({t:T,shape:nx});
  grSetForms(F);grGo(T+0.001);recMsg(`Formation change added at ${fmtClock(T)} (on the beat): ${GR_SHAPES[nx]}. Pick a shape or drag the dancers on the floor plan.`)}
/* the floor plan: the stage from above, the audience at the bottom; drag a dancer to move them (snaps to quarter spacings) */
let grDrag=null;
function grPlanGeom(){const svg=$('#grPlan'),r=svg.getBoundingClientRect(),n=S.group.n,P=grPosOf(grForms()[grFormAt(grNowT())],n);
  const xs=Math.max(n/2+0.6,...P.map(q=>Math.abs(q[0])+0.8)),zs=Math.max(2.4,...P.map(q=>q[1]+0.8));const W=r.width||300,H=r.height||130;
  const u=Math.min((W-16)/(2*xs),(H-44)/zs);return {W,H,u,P,X:x=>W/2+x*u,Z:z=>H-32-z*u,ix:X=>(X-W/2)/u,iz:Y=>(H-32-Y)/u}}
function grPlanDraw(){const svg=$('#grPlan');if(svg.hasAttribute('hidden'))return;const g=grPlanGeom(),{W,H,u,P}=g;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  let out=`<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="rgba(255,255,255,.03)"/>`;
  for(let x=-10;x<=10;x++){const X=g.X(x);if(X<4||X>W-4)continue;out+=`<line x1="${X}" y1="6" x2="${X}" y2="${H-32}" stroke="rgba(255,255,255,.06)"/>`}
  for(let z=0;z<=10;z++){const Y=g.Z(z);if(Y<6)break;out+=`<line x1="6" y1="${Y}" x2="${W-6}" y2="${Y}" stroke="rgba(255,255,255,${z?0.06:0.25})"/>`}
  out+=`<text x="${W/2}" y="${H-4}" text-anchor="middle" font-size="10" font-weight="700" fill="rgba(243,241,236,.5)">FRONT · AUDIENCE</text>`;
  P.forEach((q,k)=>{const cx=g.X(q[0]),cy=g.Z(q[1]),r=Math.max(9,Math.min(14,u*0.32));out+=`<g class="grdot" data-k="${k}"><circle cx="${cx}" cy="${cy}" r="${r+8}" fill="transparent"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${S.group.mirror&&k%2?'#FF5FA2':'#8D9FE4'}" stroke="#0E1014" stroke-width="2"/><text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="11" font-weight="800" fill="#0E1014">${k+1}</text></g>`});
  svg.innerHTML=out}
{const svg=$('#grPlan');
  svg.addEventListener('pointerdown',e=>{const d=e.target.closest('.grdot');if(!d)return;e.preventDefault();svg.setPointerCapture(e.pointerId);grDrag={k:+d.dataset.k,id:e.pointerId}});
  svg.addEventListener('pointermove',e=>{if(!grDrag||e.pointerId!==grDrag.id)return;const g=grPlanGeom(),r=svg.getBoundingClientRect();
    const x=Math.round(g.ix(e.clientX-r.left)*4)/4,z=Math.max(0,Math.round(g.iz(e.clientY-r.top)*4)/4);
    const F=grForms().map(f=>({...f})),i=grFormAt(grNowT()),P=grPosOf(F[i],S.group.n);if(P[grDrag.k][0]===x&&P[grDrag.k][1]===z)return;P[grDrag.k]=[x,z];
    F[i]={t:F[i].t,shape:'custom',pos:P,name:F[i].shape==='custom'&&F[i].name&&GR_SAVED.some(s=>s.name===F[i].name)?undefined:F[i].name};grSetForms(F);bodyKey='';drawBody();grPlanDraw()});
  const up=e=>{if(grDrag&&e.pointerId===grDrag.id){grDrag=null;groupUpdate()}};svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);}
window.__rsGr={last:()=>GR_LAST,pos:t=>grPositions(t),forms:()=>grForms(),at:t=>grFormAt(t)};
$('#grEdit').addEventListener('click',()=>{S.group.edit=!S.group.edit;grFormUI()});
$('#grAdd').addEventListener('click',grAddChange);
$('#grSave').addEventListener('click',()=>{const f=grForms()[grFormAt(grNowT())],P=grPosOf(f,S.group.n);let k=GR_SAVED.length+1;while(GR_SAVED.some(g=>g.name==='Shape '+k))k++;
  const name='Shape '+k;GR_SAVED.push({name,pos:P});if(GR_SAVED.length>12)GR_SAVED.shift();grShapesSave();grPick({shape:'custom',pos:P.map(q=>q.slice()),name});recMsg(`Saved as "${name}": it's in the shapes for every clip.`)});
$('#dkGroup').addEventListener('click',()=>{S.group.on=!S.group.on;groupUpdate();dockUpdate();bodyKey='';drawBody()});
$('#grLess').addEventListener('click',()=>{S.group.n=Math.max(2,S.group.n-1);grSave();groupUpdate();bodyKey='';drawBody()});
$('#grMore').addEventListener('click',()=>{S.group.n=Math.min(8,S.group.n+1);grSave();groupUpdate();bodyKey='';drawBody()});
$('#grSp').addEventListener('input',e=>{S.group.sp=+e.target.value;grSave();groupUpdate();bodyKey='';drawBody()});
$('#grFit').addEventListener('click',()=>{S.group.sp=null;grSave();groupUpdate();bodyKey='';drawBody()});
$('#grMirror').addEventListener('change',e=>{S.group.mirror=e.target.checked;grSave();groupUpdate();bodyKey='';drawBody()});
/* hits from the body: stops and turns of the limbs and hips (RA.analyzePose); your own marked hits are kept */
function hitsFromBody(n){
  const B=bodyOf(n); if(!B)return false;
  const m=RA.analyzePose(RB.framesOf(B)); if(!m||m.beats.length<3)return false;
  const mine=n.motion&&n.motion.beats?n.motion.beats.filter(b=>b.mine):[];
  if(n.motion&&n.motion.source!=='pose')n.motionImg=n.motion;
  n.motion=Object.assign(m,{beats:m.beats.concat(mine).sort((a,b)=>a.t-b.t),edited:mine.length>0,source:'pose',confirmed:false});
  return true;
}
/* ---------- tracking that carries on ----------
   Progress is kept as it goes (bodypart:<key>, plus numbered pieces of finished frames). If tracking gets stuck it starts
   itself again from where it was (twice); if it still stops, or the app was closed, Carry on tracking picks up from there.
   The screen is kept on while it tracks, since a locked phone stops it. */
const cpKey=n=>'bodypart:'+n.key;
function cpTag(n){const pk=S.bodyPick&&S.bodyPick.src===n.id?S.bodyPick:null;return RB.modelName()+'|'+(pk?[pk.t,pk.x,pk.y].map(x=>(+x||0).toFixed(3)).join(','):'')}
function cpOf(n){if(!n||!n.key)return null;if(n.cp===undefined){n.cp=null;mediaGet(cpKey(n)).then(h=>{if(h&&h.chunks&&n.cp===null){n.cp=h;enable();dockUpdate()}}).catch(()=>{})}return n.cp}
async function cpClear(n){const h=n.cp||await mediaGet(cpKey(n));n.cp=null;await mediaDel(cpKey(n));if(h&&h.chunks)for(let i=0;i<h.chunks;i++)await mediaDel(cpKey(n)+'#'+i)}
async function cpLoad(n){const h=await mediaGet(cpKey(n));if(!h||!h.chunks)return null;n.cp=h;if(h.tag!==cpTag(n))return null;
  const recs=[];for(let i=0;i<h.chunks;i++){const c=await mediaGet(cpKey(n)+'#'+i);if(!c)return null;for(const q of c)recs.push(q)}
  return {fps:h.fps,n:h.n,start:h.start,cuts:h.cuts,recs}}
function cpSaver(n){const tag=cpTag(n);return async st=>{let h=n.cp&&n.cp.tag===tag?n.cp:null;if(!h){await cpClear(n);h={tag,chunks:0}}
  await mediaPut(cpKey(n)+'#'+h.chunks,st.recs);
  h={...h,fps:st.fps,n:st.n,start:st.start,cuts:st.cuts,chunks:h.chunks+1,done:st.done,pct:Math.min(99,Math.floor(st.done/st.n*100)),at:Date.now()};
  await mediaPut(cpKey(n),h);n.cp=h}}
const TRACK_STALL_MS=45000;   /* no progress for this long, with the app on screen: stop and start again from where it was */
async function runTrack(fresh){
  const n=srcById(S.cur); if(!n||n.missing||!n.url||S.bodyBusy)return;
  S.bodyBusy=true; S.bodyErr=''; S.bodyT0=null; S.bodyStartAt=performance.now(); S.bodyLeft=''; S.bodyPct=0; $('#bodyTrack').disabled=true; $('#bodyFresh').hidden=true; $('#bodyProg').hidden=false; const bar=$('#bodyProg i'); bar.style.width='0';
  $('#bodyInfo').textContent='Loading the body tracker (first time needs a connection)…';
  const dlIv=setInterval(()=>{if(!S.bodyBusy||S.bodyT0){clearInterval(dlIv);return}const st=RB.rtmStatus();if(st.state==='loading'&&st.got>0&&!S.rtmCached){$('#bodyInfo').textContent='Downloading the RTMPose model (first time only)… '+rtmMB(st.got)+(st.total?' of '+rtmMB(st.total)+' MB':' MB');if(st.total)bar.style.width=Math.min(100,Math.round(st.got/st.total*100))+'%'}},300);
  let wl=null;const lock=async()=>{try{if(navigator.wakeLock&&!document.hidden&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){}};
  const onVis=()=>{if(!document.hidden&&S.bodyBusy)lock()};document.addEventListener('visibilitychange',onVis);lock();
  const pick=S.bodyPick&&S.bodyPick.src===n.id?S.bodyPick:null;
  let resume=null, tries=0;
  waitStart(n);
  try{
    if(fresh)await cpClear(n).catch(()=>{});
    else{try{resume=await cpLoad(n)}catch(e){resume=null}}
    for(;;){
      const ac=new AbortController(); let lastP=performance.now(), from=null; const carry=!!resume;
      const wd=setInterval(()=>{if(document.hidden||!S.bodyT0){lastP=performance.now();return}if(performance.now()-lastP>TRACK_STALL_MS)ac.abort()},2000);
      S.trackRun={ac};
      try{
        const B=await RB.track(n.url,{pick,resume,signal:ac.signal,onSave:cpSaver(n),onPartial:B=>waitPartial(n,B),onProgress:p=>{lastP=performance.now();if(!S.bodyT0)S.bodyT0={t:performance.now(),p};S.bodyPct=Math.round(p*100);bar.style.width=S.bodyPct+'%';S.bodyLeft=etaText(S.bodyT0,p);
          if(carry&&from==null)from=S.bodyPct;$('#bodyInfo').textContent=(from!=null&&from<100?'Carrying on from '+from+'% · ':'')+'Tracking the body on every frame… '+S.bodyPct+'%'+(S.bodyLeft?' · '+S.bodyLeft:'');dockUpdate();waitUI()}});
        clearInterval(wd);
        try{const q=/rtmpose/.test(B.model)?'rtm':/heavy/.test(B.model)?'accurate':'fast',el2=(performance.now()-(S.bodyStartAt||performance.now()))/Math.max(1,B.n-(B.resumed||0));if(el2>5&&!B.resumed)localStorage.setItem('rs-trk-ms-'+q,String(Math.round(el2)))}catch(e){}
        if(n.body&&n.body.model!==B.model){n.bodyAlt=n.body;if(n.key)mediaPut('bodyalt:'+n.key,n.body).catch(()=>{})}   /* the trial: keep the other tracker's skeleton to compare */
        n.body=B; if(n.key)await mediaPut('body:'+n.key,B).catch(()=>{});
        await cpClear(n).catch(()=>{});
        RB.rtmCached().then(c=>{if(c)S.rtmCached=true}).catch(()=>{});
        const got=hitsFromBody(n);
        $('#bodyInfo').textContent=bodyInfoText(n,B)+(got?' Hits now come from the body.':'');
        if(got&&n.id===S.cur&&(!S.dBase||S.danceSrc!=='tapped')){S.dBase=+n.motion.bpm.toFixed(1);S.danceSrc='detected';$('#dBpm').value=S.dBase.toFixed(1)}
        waitDone(n,true);
        autosave(true).catch(()=>{});   /* keep the new hits with the project straight away */
        break;
      }catch(e){clearInterval(wd);
        const stuck=!!(e&&(e.stall||e.name==='AbortError'))&&!(S.trackRun&&S.trackRun.user);
        if(stuck&&++tries<=2){
          $('#bodyInfo').textContent='Tracking got stuck at '+(S.bodyPct||0)+'%. Starting it again from there…';
          S.bodyT0=null; waitUI(); await new Promise(r=>setTimeout(r,800)); resume=await cpLoad(n).catch(()=>null); continue}
        throw e}
    }
  }catch(e){
    const why=(e&&e.message)||String(e), cp=n.cp;
    S.bodyErr=S.trackRun&&S.trackRun.user?(cp?`Tracking paused at ${cp.pct}%. Carry on tracking picks up from there.`:'Tracking stopped.')
      :cp?`Tracking stopped at ${cp.pct}% (${why.replace(/\.$/,'')}). Tap Carry on tracking to pick up from there.`:'Body tracking didn’t run: '+why;
    $('#bodyInfo').textContent=S.bodyErr;waitDone(n,false)}
  finally{S.trackRun=null;S.liveBody=null;bodyKey='';clearInterval(dlIv);document.removeEventListener('visibilitychange',onVis);try{wl&&wl.release()}catch(e){}
    S.bodyBusy=false;$('#bodyProg').hidden=true;enable();renderDance();renderMoves();updateMatch();scheduleFit();drawHitStrip();dockUpdate()}
}
$('#bodyTrack').addEventListener('click',()=>runTrack(false));
$('#bodyFresh').addEventListener('click',()=>runTrack(true));
/* ---------- while the body tracks ----------
   A bar under the player while tracking runs: progress, Practise the tracked part (the clip plays and loops over the part
   already tracked, with the skeleton on it, growing as tracking goes), Tap the beat (a short game to the song) and a chime
   when it's ready. */
S.liveBody=null; S.waitPrac=false;
try{if(localStorage.getItem('rs-wait-chime')==='0')$('#waitChime').checked=false}catch(e){}
$('#waitChime').addEventListener('change',e=>{try{localStorage.setItem('rs-wait-chime',e.target.checked?'1':'0')}catch(err){}});
let waitHideT=0;
function waitStart(n){
  clearTimeout(waitHideT); const W=$('#waitBar'); W.hidden=false; W.classList.remove('ready');
  $('#waitHead').textContent='Tracking the body'; $('#waitClose').hidden=true; $('#waitBtns').hidden=false; $('#waitCarry').hidden=true; $('#waitChime').parentElement.hidden=false;
  /* the chime needs the sound engine started inside a tap (iPhone): this is that tap */
  if($('#waitChime').checked)try{const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{})}catch(e){}
  waitUI();
  /* Track is tapped further down the page: bring the bar into view so the games are seen */
  requestAnimationFrame(()=>{try{W.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}});
}
function waitPartial(n,B){
  if(!B||B.n<6)return; const st=RB.STRIDE;
  S.liveBody={src:n.id,B,from:B.data[0],to:B.data[(B.n-1)*st]}; bodyKey=''; waitUI();
}
function waitUI(){
  const W=$('#waitBar'); if(W.hidden||W.classList.contains('ready'))return;
  const p=S.bodyPct||0, L=S.liveBody;
  $('#waitPct').textContent=S.bodyT0?p+'%'+(S.bodyLeft?' · '+S.bodyLeft:''):'';
  $('#waitProg').style.width=(S.bodyT0?p:0)+'%';
  $('#waitPractise').setAttribute('aria-pressed',String(S.waitPrac)); $('#waitPractise').textContent=S.waitPrac?'Stop practising':'Practise the tracked part';
  $('#waitPractise').disabled=!L;
  if(TAP.on)return;
  $('#waitMsg').textContent=!S.bodyT0?'Getting the tracker ready…'
    :S.waitPrac&&L?`Practising the first ${fmt(Math.max(0,L.to-S.cIn))} (tracked so far), on repeat. It grows as tracking goes.`
    :L?`The skeleton is ready up to ${fmt(L.to)}. Practise that part now, or warm up with Tap the beat. Stay in the app: iPhone pauses tracking when you leave it.`
    :'Stay in the app while it tracks: iPhone pauses tracking when you leave it. The first seconds of skeleton show up shortly.';
}
function waitDone(n,ok){
  const W=$('#waitBar'); if(TAP.on)tapStop(false); waitPracOff();
  if(!ok){W.hidden=false;W.classList.remove('ready');$('#waitHead').textContent='Tracking stopped';$('#waitPct').textContent='';$('#waitMsg').textContent=S.bodyErr||'';$('#waitBtns').hidden=true;$('#waitCarry').hidden=!(n.cp);$('#waitClose').hidden=false;$('#waitChime').parentElement.hidden=true;return}
  W.classList.add('ready'); $('#waitHead').textContent='Ready'; $('#waitPct').textContent='100%'; $('#waitProg').style.width='100%';
  $('#waitMsg').textContent='The skeleton is on the whole clip. Press play to see it.'; $('#waitBtns').hidden=true; $('#waitClose').hidden=false; $('#waitCarry').hidden=true; $('#waitChime').parentElement.hidden=true;
  if($('#waitChime').checked)waitChime();
  S.waitChimed=(S.waitChimed||0)+1;
  waitHideT=setTimeout(()=>{W.hidden=true;W.classList.remove('ready')},12000);
}
/* a bright three-note chime on the sound engine */
function waitChime(){try{const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{});const t=c.currentTime+0.05;
  [[784,0],[1175,0.13],[1568,0.26]].forEach(([f,d])=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.35,t+d+0.01);g.gain.exponentialRampToValueAtTime(0.001,t+d+0.6);o.connect(g);g.connect(c.destination);o.start(t+d);o.stop(t+d+0.65)})}catch(e){}}
$('#waitClose').addEventListener('click',()=>{clearTimeout(waitHideT);$('#waitBar').hidden=true;$('#waitBar').classList.remove('ready')});
$('#waitCarry').addEventListener('click',()=>{$('#waitBar').hidden=true;runTrack(false)});
/* practise the tracked part: play from the clip's start and loop back before the end of what's tracked */
function waitPracOff(){if(!S.waitPrac)return;S.waitPrac=false;if(S.playing)pause();waitUI()}
$('#waitPractise').addEventListener('click',()=>{
  if(S.waitPrac){waitPracOff();return}
  const L=S.liveBody; if(!L)return; if(TAP.on)tapStop(false);
  if(L.to-Math.max(S.cIn||0,L.from)<1){$('#waitMsg').textContent='Only a moment is tracked so far. Try again in a few seconds.';return}
  if(routineOn())setMode(false);
  S.waitPrac=true; toStart(); syncSong(true); if(!S.playing)play(); waitUI();
});
/* tracking keeps the page busy, so these checks can come late: loop back early by the largest recent gap between them */
let pracLast=0,pracGaps=[];
setInterval(()=>{if(!S.waitPrac){pracGaps=[];pracLast=0;return}const L=S.liveBody;if(!L||!S.bodyBusy){if(!S.bodyBusy)S.waitPrac=false;return}
  const now=performance.now();if(pracLast){pracGaps.push((now-pracLast)/1000);if(pracGaps.length>40)pracGaps.shift()}pracLast=now;
  const early=Math.min(1.5,(L.to-Math.max(S.cIn||0,L.from))/2,Math.max(0.08,(Math.max(0,...pracGaps)+0.05)*(v.playbackRate||1)));
  if(S.playing&&v.currentTime>=L.to-early){toStart();syncSong(true)}},50);

/* ---------- Tap the beat: 32 beats of the song (or a click), tap along, get a score ----------
   Each tap is timed on the sound engine's clock. Your taps' usual lateness (the median) is how late you hear the sound
   plus your touch; on time = within 50 ms of that. If it's much more than the Sound delay setting, it's offered as a new
   Sound delay (Bluetooth headphones usually show up as 150-250 ms late). */
const TAP={on:false};
function tapStop(done){
  const T=TAP; if(!T.on)return; TAP.on=false; clearInterval(T.iv);
  try{T.src&&T.src.stop()}catch(e){} T.nodes.forEach(o=>{try{o.stop()}catch(e){}});
  $('#waitTap').setAttribute('aria-pressed','false'); $('#waitTap').textContent='Tap the beat';
  if(!done){$('#tapGame').hidden=true;waitUI();return}
  const r=tapResult(T); T.result=r; window.__tapLast=r;
  let best=0;try{best=+localStorage.getItem('rs-tap-best')||0;if(r.hits>best)localStorage.setItem('rs-tap-best',String(r.hits))}catch(e){}
  $('#tapBig').textContent=`${r.hits} / ${r.of}`; $('#tapSmall').textContent=r.hits>best&&best?'New best!':best?'Best: '+Math.max(best,r.hits)+' / '+r.of:'on the beat';
  $('#tapPad').className='tappad '+(r.hits>=r.of*0.8?'perfect':r.hits>=r.of*0.5?'good':'off');
  $('#tapScore').textContent=r.taps<4?'Too few taps to score. Tap the beat to play again.':`${r.hits} of ${r.of} beats on time · steady to ±${r.spread} ms · best run ${r.streak} in a row. Tap the beat to play again.`;
  const cur=Math.round(CUE.delay*1000);
  if(r.taps>=12&&r.sugg!=null&&Math.abs(r.sugg-cur)>=80){$('#tapUseRow').hidden=false;$('#tapUse').textContent=`Use ${r.sugg} ms`;
    $('#tapScore').textContent+=` Your taps land about ${r.late} ms after the beat. If you're on Bluetooth headphones, that's most likely their delay: set Sound delay to ${r.sugg} ms so the balls and video match what you hear?`;$('#tapUse').dataset.ms=r.sugg}
  else $('#tapUseRow').hidden=true;
  $('#waitMsg').textContent='';
}
function tapResult(T){
  const off=T.taps.map(t=>{let b=T.beats[0],d=1e9;for(const x of T.beats){const q=Math.abs(t-x);if(q<d){d=q;b=x}}return {t,b,o:t-b}});
  const med=off.length?off.map(q=>q.o).sort((a,b)=>a-b)[off.length>>1]:0;
  const per=T.per, onTime=new Set(); let streak=0,run=0,spread=0;
  off.forEach(q=>{const e=q.o-med;spread+=Math.abs(e);if(Math.abs(e)<=0.05)onTime.add(Math.round(q.b*1000))});
  T.beats.forEach(b=>{if(onTime.has(Math.round(b*1000))){run++;streak=Math.max(streak,run)}else run=0});
  const late=Math.round(med*1000);
  return {of:T.beats.length,taps:off.length,hits:onTime.size,streak,spread:off.length?Math.round(spread/off.length*1000):0,late,
    sugg:Math.max(0,Math.min(400,Math.round((late-30)/5)*5)),per};
}
$('#waitTap').addEventListener('click',()=>{
  if(TAP.on){tapStop(false);return}
  if(S.waitPrac)waitPracOff(); if(S.playing)pause();
  const c=getCtx(); if(c.state!=='running')c.resume().catch(()=>{});
  const so=S.mainSong, G=so&&so.buf&&so.an&&so.an.grid, sb=so&&so.buf;
  const t0=c.currentTime+1.2, T={on:true,taps:[],beats:[],nodes:[],src:null,per:0.6,c};
  if(G&&G.length>=40){
    let i=0;const off=(S.main&&S.main.offset)||0;while(i<G.length-1&&G[i]<off)i++;if(i+33>G.length)i=Math.max(0,G.length-33);
    const s0=Math.max(0,G[i]-0.6), lead=G[i]-s0;
    const src=c.createBufferSource();src.buffer=sb;const g=c.createGain();g.gain.value=0.9;src.connect(g);g.connect(c.destination);
    src.start(t0-lead,s0,(G[i+31]-s0)+0.8);T.src=src;
    T.beats=G.slice(i,i+32).map(b=>t0+(b-G[i]));T.per=(G[i+31]-G[i])/31;
  }else{
    /* no song yet: a click at 100 BPM */
    T.per=0.6;for(let k=0;k<32;k++){const when=t0+k*T.per,o=c.createOscillator(),g=c.createGain();o.frequency.value=k%4===0?1600:1000;
      g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(0.4,when+0.002);g.gain.exponentialRampToValueAtTime(0.001,when+0.06);o.connect(g);g.connect(c.destination);o.start(when);o.stop(when+0.08);T.nodes.push(o);T.beats.push(when)}
  }
  T.end=T.beats[T.beats.length-1]+T.per*0.6;
  /* the sound clock moves in steps of ~10 ms against the page clock: keep samples of the gap between them and use the median */
  T.offs=[];T.offAt=()=>{T.offs.push(c.currentTime-performance.now()/1000);if(T.offs.length>80)T.offs.shift()};T.offAt();
  Object.assign(TAP,T); TAP.on=true;
  $('#tapGame').hidden=false; $('#tapUseRow').hidden=true; $('#tapPad').className='tappad'; $('#tapBig').textContent='Get ready…'; $('#tapSmall').textContent=G?'tap along to the song':'tap along to the click';
  $('#tapScore').textContent='Tap the pad on every beat for 32 beats.'; $('#waitMsg').textContent='';
  $('#waitTap').setAttribute('aria-pressed','true'); $('#waitTap').textContent='Stop the game';
  TAP.iv=setInterval(()=>{if(!TAP.on)return;const now=c.currentTime;TAP.offAt();
    if(now>=TAP.end){tapStop(true);return}
    if(now<TAP.beats[0]-0.05){const k=Math.ceil((TAP.beats[0]-now)/TAP.per);$('#tapBig').textContent=k<=4?String(k):'Get ready…'}
    else if(!TAP.taps.length)$('#tapBig').textContent='Tap!';
    const left=TAP.beats.filter(b=>b>now).length;if(now>=TAP.beats[0]-0.05)$('#tapSmall').textContent=left+' beats to go'},60);
});
$('#tapPad').addEventListener('pointerdown',e=>{
  if(!TAP.on)return; e.preventDefault(); const c=TAP.c;
  /* when the finger landed (the event's own time, so a busy page doesn't make taps late), on the sound clock */
  TAP.offAt();const o=TAP.offs.slice().sort((x,y)=>x-y)[TAP.offs.length>>1];
  const t=Math.min(e.timeStamp,performance.now())/1000+o;
  if(t<TAP.beats[0]-TAP.per/2)return; TAP.taps.push(t);
  /* how this tap sits, judged against your own usual lateness once there are a few taps */
  const r=tapResult(TAP), base=TAP.taps.length>=4?r.late/1000:(CUE.delay+0.03);
  let b=TAP.beats[0],d=1e9;for(const x of TAP.beats){const q=Math.abs(t-x);if(q<d){d=q;b=x}}const err=t-b-base;
  const k=Math.abs(err)<=0.035?'perfect':Math.abs(err)<=0.07?'good':'off';
  $('#tapPad').className='tappad '+k; $('#tapBig').textContent=k==='perfect'?'Perfect':k==='good'?'Good':err<0?'Early':'Late';
});
$('#tapUse').addEventListener('click',()=>{const ms=+$('#tapUse').dataset.ms;if(isFinite(ms)){setDelay(ms,true);$('#tapUseRow').hidden=true;$('#tapScore').textContent+=` Sound delay set to ${ms} ms (change it under Tempo → More options).`}});

/* ---------- quick controls on the video ---------- */
S.cutOn=false; S.cutBg='dark'; try{S.everPlayed=localStorage.getItem('rs-played')==='1'}catch(e){}
try{S.cutBg=localStorage.getItem('rs-cutbg')||'dark'}catch(e){}
S.cutPart='all';try{const cp=localStorage.getItem('rs-cutpart');if(cp==='upper'||cp==='legs')S.cutPart=cp}catch(e){}
function dockUpdate(){
  const n=srcById(S.cur), B=n&&bodyOf(n), show=!!(S.hasV&&window.RS_HOSTED);
  $('#dock').hidden=!show; if(!show)return;
  const bb=$('#dkBody');
  if(S.bodyBusy){bb.querySelector('span').textContent='Tracking '+(S.bodyPct||0)+'%'+(S.bodyLeft?' · '+S.bodyLeft.replace('about ','').replace(' left',''):'');bb.setAttribute('aria-pressed','false');bb.disabled=true}
  else{bb.disabled=false;bb.querySelector('span').textContent=B&&!cpOf(n)?'Body':cpOf(n)?'Carry on':'Track body';bb.setAttribute('aria-pressed',String(!!B&&$('#bodyShow').checked))}
  $('#dkHips').hidden=!B; $('#dkHips').setAttribute('aria-pressed',String($('#hipShow').checked));
  const canCut=!!(B&&RB.hasCutout(B)), staleCut=!!(B&&B.mask&&B.mask.frames&&!canCut);
  $('#dkCut').hidden=!canCut&&!staleCut; $('#dkCut').setAttribute('aria-pressed',String(canCut&&S.cutOn)); $('#dkCut').dataset.stale=staleCut?'1':'';
  $('#dkBg').hidden=!(canCut&&S.cutOn); $$('#dkBg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bg===S.cutBg)));
  $('#dkPart').hidden=!(canCut&&S.cutOn); $$('#dkPart button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===S.cutPart)));
  $('#cutBar').hidden=!(canCut&&S.cutOn);   /* Cut out and Group work together: both sets of options show */
  groupUpdate();
}
$('#dkBody').addEventListener('click',()=>{const n=srcById(S.cur);if(!n)return;
  if(!bodyOf(n)||cpOf(n)){$('#bodyTrack').click();return}
  $('#bodyShow').checked=!$('#bodyShow').checked;$('#bodyShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkHips').addEventListener('click',()=>{$('#hipShow').checked=!$('#hipShow').checked;$('#hipShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkCut').addEventListener('click',()=>{
  /* tracked before the fix on a phone: the outline was saved empty; tracking again makes it */
  if($('#dkCut').dataset.stale){if(confirm('This clip was tracked before a fix: its outline came out empty on your phone, so Cut out can\'t show the dancer. Track it again now? (It plays through once, silently.)')){S.cutOn=true;$('#bodyTrack').click()}return}
  S.cutOn=!S.cutOn;dockUpdate()});
$$('#dkBg button').forEach(b=>b.addEventListener('click',()=>{S.cutBg=b.dataset.bg;try{localStorage.setItem('rs-cutbg',S.cutBg)}catch(e){}dockUpdate()}));
/* the cut-out's options sit just under the video, so they never cover the dancer */
{const bar=$('#cutBar');bar.append(el('span','label','Show'),$('#dkPart'),el('span','label','Behind'),$('#dkBg'))}
/* isolation: the whole dancer, just the upper body, or just the legs (the first time you isolate, the rest dims so you keep the context) */
$$('#dkPart button').forEach(b=>b.addEventListener('click',()=>{const was=S.cutPart;S.cutPart=b.dataset.part;
  let chose=false;try{chose=!!localStorage.getItem('rs-cutbg-set')}catch(e){}
  if(was==='all'&&S.cutPart!=='all'&&!chose){S.cutBg='dim';try{localStorage.setItem('rs-cutbg','dim')}catch(e){}}
  try{localStorage.setItem('rs-cutpart',S.cutPart)}catch(e){}dockUpdate()}));
$$('#dkBg button').forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem('rs-cutbg-set','1')}catch(e){}}));
/* get started: three steps for a new project */
function startUpdate(){
  const v=!!S.hasV, so=!!S.mainSong, played=!!S.everPlayed, card=$('#startCard');
  card.hidden=(v&&so&&played)||!!S.seq.length;
  $('#st1').className=v?'done':'next'; $('#st2').className=so?'done':(v?'next':''); $('#st3').className=played?'done':(v&&so?'next':'');
  $('#st1 .go').hidden=v; $('#st2 .go').hidden=so; $('#stPlay').hidden=!(v&&so)||played;
}
$('#stVid').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$('#vidFile').files=dt.files;$('#vidFile').dispatchEvent(new Event('change',{bubbles:true}));e.target.value=''});
$('#stSong').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$('#audFile').files=dt.files;$('#audFile').dispatchEvent(new Event('change',{bubbles:true}));e.target.value=''});
$('#stPlay').addEventListener('click',()=>{if(!S.playing)$('#play').click()});
/* keep the card and the dock right even when nothing is playing (the tick only runs with media) */
startUpdate();setInterval(()=>{try{startUpdate();dockUpdate()}catch(e){}},700);

/* ---------- Practice: your camera inside the player (what Body did, now with the same clip and every edit) ----------
   Side by side: the clip (as it plays here: trim, cuts, speed, song, cut-out, group) on the left, your camera on the
   right with your skeleton. Ghost: your camera fills the player with the dancer's skeleton laid over you (moved and
   sized to your body), the clip small in the corner. Worldline: the dancer's moves through time in 3D (past poses
   solid, next ones dashed, hands and feet as trails), built from the tracking already done, no camera needed; drag to
   turn it, pinch or scroll to zoom, double-tap to reset.
   Ghost targets (Just Dance style): by default only the key moves (the strongest hit in each 2 beats) are targets; each
   shows up as a card sliding along the bottom towards the "now" line, and as the dashed pose to be in, a warning of
   1 beat, 2 beats or a bar ahead, with rings shrinking onto the hand/foot that makes it; on the move your pose is scored
   (limb directions compared, 0-100) and the result flashes; each pass through the clip is tallied. The camera only
   starts from a tap and stops when you leave practice or the app. */
var PR={on:false,mode:'split',mirror:true,mine:true,targets:true,flip:false,all:false,lead:2,stream:null,rt:null,P:null,raf:0,detAt:0,xf:null,win:new Map(),why:new Map(),done:new Set(),res:new Map(),pass:{n:0,hit:0,close:0},flash:null,lastVt:0,hk:'',hits:[],wv:{yaw:-0.62,pitch:0.28,zoom:1},step:false,hold:null,holdOk:0,holdSc:null,run:null,last:null,replay:null,myRun:true,count:3,hands:true,voice:true,cd:null,hup:0,hupArm:true,hupCool:0};
try{const g=JSON.parse(localStorage.getItem('rs-prac')||'null');if(g){PR.mode=['split','ghost','world'].includes(g.mode)?g.mode:'split';PR.mirror=g.mirror!==false;PR.mine=g.mine!==false;PR.targets=g.targets!==false;PR.flip=!!g.flip;PR.all=!!g.all;PR.lead=[1,2,4].includes(g.lead)?g.lead:2;PR.step=!!g.step;PR.myRun=g.myRun!==false;PR.count=[0,3,5].includes(g.count)?g.count:3;PR.hands=g.hands!==false;PR.voice=g.voice!==false}}catch(e){}
const prSave=()=>{try{localStorage.setItem('rs-prac',JSON.stringify({mode:PR.mode,mirror:PR.mirror,mine:PR.mine,targets:PR.targets,flip:PR.flip,all:PR.all,lead:PR.lead,step:PR.step,myRun:PR.myRun,count:PR.count,hands:PR.hands,voice:PR.voice}))}catch(e){}};
const camV=$('#camVid'),camCv=$('#camCanvas'),recV=$('#camRec');
const PR_BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32],[15,19],[16,20]];
const PR_LIMBS=[[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28],[11,12],[23,24]];
const prNeedsCam=()=>PR.mode!=='world';
function prMsg(t){$('#pracMsg').textContent=t||''}
function pracUI(){
  $('#pracBar').hidden=!PR.on; camCv.hidden=!PR.on;
  const st=$('#stage');st.classList.toggle('practice',PR.on);st.classList.toggle('pr-split',PR.on&&PR.mode==='split');st.classList.toggle('pr-ghost',PR.on&&PR.mode!=='split');st.classList.toggle('pr-world',PR.on&&PR.mode==='world');
  $$('#pracMode button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pm===PR.mode)));
  $('#pracMirror').setAttribute('aria-pressed',String(PR.mirror));$('#pracMine').setAttribute('aria-pressed',String(PR.mine));
  $('#pracTargets').setAttribute('aria-pressed',String(PR.targets));$('#pracFlip').setAttribute('aria-pressed',String(PR.flip));
  $('#pracAll').setAttribute('aria-pressed',String(PR.all));$('#pracLead').textContent='Warning: '+(PR.lead===4?'1 bar':PR.lead+' beat'+(PR.lead>1?'s':''));
  const g=PR.mode==='ghost',wl=PR.mode==='world';
  $('#pracTargets').hidden=$('#pracFlip').hidden=!g;$('#pracAll').hidden=$('#pracLead').hidden=!g||!PR.targets;
  $('#pracMirror').hidden=wl;$('#pracReset').hidden=!wl;$('#pracCam').hidden=!wl||!!PR.stream;
  $('#pracMine').textContent=wl?'Me on now':'My skeleton';
  $('#pracStep').setAttribute('aria-pressed',String(PR.step));$('#pracStep').hidden=!g||!PR.targets||!!PR.replay;
  $('#pracMyRun').setAttribute('aria-pressed',String(PR.myRun));$('#pracMyRun').hidden=!wl||!(PR.last&&PR.last.samples.length);
  $('#pracLive').hidden=!PR.replay;
  $('#pracCount').textContent='Countdown: '+(PR.count?PR.count+' s':'off');$('#pracCount').hidden=wl;
  $('#pracHands').setAttribute('aria-pressed',String(PR.hands));$('#pracVoice').setAttribute('aria-pressed',String(PR.voice));
  const tb=$('#t-body');if(tb){tb.setAttribute('aria-pressed',String(PR.on));tb.classList.toggle('on',PR.on)}
  bodyKey='';
}
async function camStart(){
  if(PR.stream||PR.camBusy)return;PR.camBusy=true;primeSong();prMsg('Starting your camera…');
  try{PR.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:960}},audio:false})}
  catch(e){PR.camBusy=false;recMsg(e&&e.name==='NotAllowedError'?'Camera blocked: allow the camera for this app in your phone\'s settings, then try again.':'Couldn\'t start the camera ('+(e&&e.message||e)+').',true);if(prNeedsCam()){PR.on=false;pracUI()}return}
  PR.camBusy=false;
  if(!PR.on){PR.stream.getTracks().forEach(t=>t.stop());PR.stream=null;return}
  camV.srcObject=PR.stream;try{await camV.play()}catch(e){}
  prMsg('Loading the body tracker for your camera…');
  RB.live().then(rt=>{PR.rt=rt;pracStatus()}).catch(e=>prMsg('The body tracker didn\'t load ('+(e&&e.message||e)+'). Your camera still shows.'));
  pracUI();
}
function camStop(){PR.cd=null;PR.hup=0;if(PR.stream){PR.stream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});PR.stream=null}camV.srcObject=null;PR.Praw=null;PR.P=null}
async function pracOn(){
  if(PR.on)return; if(!S.hasV){recMsg('Add a dance video first, then practise it here with your camera.',true);return}
  PR.on=true;prReset();PR.flash=null;pracUI();
  window.scrollTo({top:0,behavior:'smooth'});
  cancelAnimationFrame(PR.raf);PR.raf=requestAnimationFrame(pracLoop);
  if(prNeedsCam())await camStart();else pracStatus();
}
function pracOff(){prReplayStop(true);prRunEnd();PR.hold=null;PR.on=false;cancelAnimationFrame(PR.raf);camStop();$('#pracRes').hidden=true;pracUI()}
function prReset(){PR.pass={n:0,hit:0,close:0};PR.done.clear();PR.win.clear();PR.res.clear();PR.why.clear()}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&PR.on)pracOff()});   /* never keep the camera on in the background */
function pracStatus(){
  if(!PR.on)return;const n=srcById(S.cur),B=n&&bodyOf(n);
  if(PR.mode!=='split'&&!B){prMsg('Track the body first (Body on the video) to see the '+(PR.mode==='world'?'Worldline':'ghost and targets')+'.');return}
  if(PR.mode==='world'){prMsg('The dancer through time: past poses solid, next ones dashed. Drag to turn, pinch to zoom, double-tap to reset.');return}
  if(PR.replay){prMsg('Replay of your last run: you on the right, the dancer as you saw it. Tap Back to live to practise again.');return}
  if(!PR.rt){return}
  if(PR.hold!=null){prMsg('Step mode: hold the amber pose to go on'+(PR.holdSc!=null?' · now '+PR.holdSc+'%':'')+' · tap play to skip it.');return}
  if(!PR.P){prMsg('Step back until your whole body is in the camera.');return}
  if(PR.mode==='ghost'&&PR.targets){const p=PR.pass;const hs=prHits(n).length;
    prMsg(hs?`This pass: ${p.hit} hit${p.hit===1?'':'s'}${p.close?`, ${p.close} close`:''} of ${p.n}`+(PR.flash?` · last: ${PR.flash.label} ${PR.flash.score}%`:'')+(p.n?'':` · ${hs} ${PR.all?'hits':'key moves'}: press play and match the shapes as they reach the line`):'No hits found in this clip yet: the ghost still shows the moves.');return}
  prMsg(PR.mode==='ghost'?'Match the ghost. Press play.':'You on the right, the dancer on the left. Press play.');
}
/* the targets: the clip's hits inside what plays (trim and cuts); Key moves keeps the strongest in each 2 beats */
function prHits(n){if(!n)return [];const bp=beatPer();/* the key has the parts' real extents (not just how many): worked out before the video's length was known, the
     targets came out empty and stayed empty for the whole session */
  const mb=n.motion?n.motion.beats:null;const k=(n.key||n.id)+':'+S.hitLevel+':'+(mb?mb.length+'/'+(mb.length?mb[0].t.toFixed(2)+'/'+mb[mb.length-1].t.toFixed(2):''):0)+':'+S.cIn+':'+S.cOut+':'+segs().map(g=>(+g.s||0).toFixed(2)+'-'+(+g.e||0).toFixed(2)).join(',')+':'+PR.all+':'+bp.toFixed(3);
  if(PR.hk!==k){PR.hk=k;const L=segs();const hs=hitsOf(n).filter(b=>L.some(g=>b.t>=g.s&&b.t<g.e));
    if(PR.all)PR.hits=hs.map(b=>b.t);
    else{const gap=Math.max(0.9,2*bp)*0.98,keep=[];hs.slice().sort((a,b)=>(b.w||0)-(a.w||0)).forEach(b=>{if(keep.every(t=>Math.abs(t-b.t)>=gap))keep.push(b.t)});PR.hits=keep.sort((a,b)=>a-b)}}
  return PR.hits}
const prLeadS=()=>PR.lead*beatPer();
/* pose helpers: points in pixels */
const prMid=(P,a,b)=>[(P[a][0]+P[b][0])/2,(P[a][1]+P[b][1])/2];
const prVis=(P,j)=>P[j]&&P[j][2]>=0.45;
function prTorso(P){const s=prMid(P,11,12),h=prMid(P,23,24);return Math.hypot(s[0]-h[0],s[1]-h[1])}
/* the dancer's pose at clip time t, in the clip's pixels (flipped for Flip ghost) */
function prRef(B,t,noFlip){const P=RB.poseAt(B,t);if(!P)return null;const W=B.w||1,H=B.h||1,f=PR.flip&&!noFlip;return P.map(q=>[f?(1-q[0])*W:q[0]*W,q[1]*H,q[2]])}
/* move and size a dancer pose onto you: their hips onto your hips, their torso as long as yours */
function prPlace(Q,w,h){
  const T=prTorso(Q)||1,hq=prMid(Q,23,24);let cx,cy,s;
  const P=PR.P;if(P&&prVis(P,11)&&prVis(P,12)&&prVis(P,23)&&prVis(P,24)){const hp=prMid(P,23,24);cx=hp[0];cy=hp[1];s=(prTorso(P)||T)/T}
  else{cx=w/2;cy=h*0.55;s=h*0.2/T}
  const X=PR.xf;if(X&&isFinite(X.s)){X.cx+=0.3*(cx-X.cx);X.cy+=0.3*(cy-X.cy);X.s+=0.3*(s-X.s)}else PR.xf={cx,cy,s};
  const f=PR.xf;return Q.map(q=>[f.cx+(q[0]-hq[0])*f.s,f.cy+(q[1]-hq[1])*f.s,q[2]]);
}
/* how close two poses are, 0-100: the direction of each limb compared (position and size don't matter) */
function prScore(A,Bp){let sum=0,k=0;
  for(const [i,j] of PR_LIMBS){if(!prVis(A,i)||!prVis(A,j)||!prVis(Bp,i)||!prVis(Bp,j))continue;
    const a=Math.atan2(A[j][1]-A[i][1],A[j][0]-A[i][0]),b=Math.atan2(Bp[j][1]-Bp[i][1],Bp[j][0]-Bp[i][0]);let d=Math.abs(a-b);if(d>Math.PI)d=2*Math.PI-d;
    sum+=Math.max(0,1-d/(Math.PI/2));k++}
  return k>=6?Math.round(sum/k*100):null}
/* what was off: the body parts whose limbs point more than 40° away from the move, worst first, each with a hint.
   Named from your side (your left arm), from your own pose's points. */
const PR_PARTS=[['left arm',[0,1]],['right arm',[2,3]],['left leg',[4,5]],['right leg',[6,7]],['shoulders',[8]],['hips',[9]]];
function prDiff(A,Bp){const out=[];
  for(const [name,ls] of PR_PARTS){let worst=0,hint='';
    for(const li of ls){const [i,j]=PR_LIMBS[li];if(!prVis(A,i)||!prVis(A,j)||!prVis(Bp,i)||!prVis(Bp,j))continue;
      const ax=A[j][0]-A[i][0],ay=A[j][1]-A[i][1],bx=Bp[j][0]-Bp[i][0],by=Bp[j][1]-Bp[i][1];
      /* the shoulder and hip lines are short when side-on, and their angle is then mostly noise: judge them only when both are long enough */
      if(li>=8&&(Math.hypot(ax,ay)<0.3*(prTorso(A)||1e9)||Math.hypot(bx,by)<0.3*(prTorso(Bp)||1e9)))continue;
      let d=Math.abs(Math.atan2(ay,ax)-Math.atan2(by,bx));if(d>Math.PI)d=2*Math.PI-d;
      if(d>worst){worst=d;const ua=ay/(Math.hypot(ax,ay)||1),ub=by/(Math.hypot(bx,by)||1);
        hint=li>=8?'level':ua<ub-0.35?'too high':ua>ub+0.35?'too low':'angle'}}
    if(worst>40*Math.PI/180)out.push({part:name,hint,deg:Math.round(worst*180/Math.PI)})}
  return out.sort((a,b)=>b.deg-a.deg)}
const prWhyText=w=>w&&w.length?w.slice(0,2).map(x=>x.hint==='level'?x.part+' not level like the dancer':x.hint==='angle'?x.part+' at the wrong angle':x.part+' '+x.hint).join(', '):'';
function prDraw(c,P,col,lw,alpha,dash){c.save();c.globalAlpha=alpha;c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';if(dash)c.setLineDash(dash);
  for(const [a,b] of PR_BONES){if(!prVis(P,a)||!prVis(P,b))continue;c.beginPath();c.moveTo(P[a][0],P[a][1]);c.lineTo(P[b][0],P[b][1]);c.stroke()}
  if(prVis(P,0)&&prVis(P,11)&&prVis(P,12)){const r=prTorso(P)*0.22;c.setLineDash([]);c.beginPath();c.arc(P[0][0],P[0][1],Math.max(3,r),0,7);c.stroke()}
  c.restore()}
/* the hands/feet that move most into the move at H (what the rings and cards point at) */
function prMovers(B,H,rate){const Q=prRef(B,H),Q0=prRef(B,H-0.3*rate);if(!Q)return [];return [15,16,27,28].filter(j=>prVis(Q,j)).map(j=>({j,d:Q0&&prVis(Q0,j)?Math.hypot(Q[j][0]-Q0[j][0],Q[j][1]-Q0[j][1]):0})).sort((a,b)=>b.d-a.d).slice(0,2).map(m=>m.j)}
function pracLoop(){
  if(!PR.on)return;PR.raf=requestAnimationFrame(pracLoop);
  const now=performance.now();
  let fresh=false;
  if(!PR.replay&&PR.rt&&PR.stream&&camV.readyState>=2&&now-PR.detAt>=30){PR.detAt=now;fresh=true;try{PR.Praw=PR.rt.detect(camV)}catch(e){PR.Praw=null}}
  const r=camCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(!w||!h)return;
  if(camCv.width!==w||camCv.height!==h){camCv.width=w;camCv.height=h}
  const c=camCv.getContext('2d');c.fillStyle=PR.mode==='world'?'#0B0D11':'#000';c.fillRect(0,0,w,h);
  const n=srcById(S.cur),B=n&&bodyOf(n),el=curVid(),vt=el?shownT(el):0,rate=(el&&el.playbackRate)||1;
  /* the run: your camera recorded and your pose kept against the clip time, for the results and the replay */
  if(!PR.replay&&PR.mode==='ghost'&&PR.targets&&PR.stream&&S.playing&&!PR.run&&B)prRunStart();
  if(PR.run&&fresh){const Rn=PR.run,ls=Rn.samples[Rn.samples.length-1];if(Rn.samples.length<9000&&!(ls&&vt<ls.vt-0.4))Rn.samples.push({w:(now-Rn.t0)/1000,vt,P:PR.Praw});
    if(Rn.rec&&Rn.rec.state==='recording'&&now-Rn.t0>240000)try{Rn.rec.stop()}catch(e){}}
  const src=PR.replay?recV:camV;
  if(PR.replay){const sm=prSampleAt(PR.replay.samples,vt,true);PR.Praw=sm?sm.P:null;
    if(PR.replay.url){if(S.playing&&recV.paused)recV.play().catch(()=>{});if(!S.playing&&!recV.paused)recV.pause();
      if(sm&&recV.readyState>=1&&Math.abs(recV.currentTime-sm.w)>0.3&&!recV.seeking)try{recV.currentTime=sm.w}catch(e){}}
    if(S.playing)PR.replay.played=true;
    if(vt<PR.lastVt-0.4&&PR.replay.played){PR.lastVt=vt;prReplayStop();return}}
  prHands(now,fresh);
  if(PR.cd){const left=Math.ceil((PR.cd.end-now)/1000);if(left>0&&left<PR.cd.n){PR.cd.n=left;say(String(left))}}
  if(PR.cd&&now>=PR.cd.end){PR.cd=null;say('Go');if(!S.playing)play()}
  if(PR.mode==='world'){if(B)prWorld(c,w,h,dpr,B,vt);if(PR.replay)PR.lastVt=vt;if(now-(PR.stAt||0)>400){PR.stAt=now;pracStatus()}return}
  const vw=PR.replay?(PR.replay.url?recV.videoWidth:0)||PR.replay.cw:camV.videoWidth,vh=PR.replay?(PR.replay.url?recV.videoHeight:0)||PR.replay.ch:camV.videoHeight;
  /* the camera fills its pane (cropped at the edges) */
  let R={x:0,y:0,w,h};if(vw&&vh){const s=Math.max(w/vw,h/vh);R={x:(w-vw*s)/2,y:(h-vh*s)/2,w:vw*s,h:vh*s};
    c.save();if(PR.mirror){c.translate(w,0);c.scale(-1,1)}if(src.readyState>=2)c.drawImage(src,PR.mirror?w-R.x-R.w:R.x,R.y,R.w,R.h);c.restore()}
  PR.P=PR.Praw?PR.Praw.map(q=>[PR.mirror?R.x+R.w*(1-q[0]):R.x+R.w*q[0],R.y+R.h*q[1],q[2]]):null;
  if(PR.mode==='ghost'&&B){
    const Q=prRef(B,vt);if(Q){const G=prPlace(Q,w,h);prDraw(c,G,'#9FB4FF',Math.max(6,7*dpr),0.5)}
    if(PR.targets)prTargets(c,n,B,vt,rate,w,h,dpr);
  }
  if(PR.mine&&PR.P)prDraw(c,PR.P,'#2FD47A',Math.max(3,3.5*dpr),0.95);
  if(PR.flash&&now-PR.flash.at<(PR.flash.why?1600:900)){const f=PR.flash,D=f.why?1600:900,a=1-(now-f.at)/D,fx=PR.mode==='ghost'?(w*0.3+w-44*dpr)/2:w/2,fy=PR.hold!=null?64*dpr:14*dpr;c.save();c.globalAlpha=Math.min(1,a*1.6);c.fillStyle=f.col;c.font=`900 ${Math.round(28*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.textBaseline='top';c.fillText(f.label.toUpperCase()+' '+f.score+'%',fx,fy);
    if(f.why){c.font=`800 ${Math.round(15*dpr)}px Figtree,sans-serif`;c.lineWidth=4*dpr;c.strokeStyle='rgba(8,9,12,.8)';const tx='Fix: '+f.why;c.strokeText(tx,fx,fy+34*dpr);c.fillStyle='#F3F1EC';c.fillText(tx,fx,fy+34*dpr)}c.restore()}
  prOverlay(c,w,h,dpr,now);
  if(now-(PR.stAt||0)>400){PR.stAt=now;pracStatus()}
}
/* Ghost targets */
const PR_PRE=0.12,PR_POST=0.25;
const prCol=l=>l==='Hit'?'#2FD47A':l==='Close'?'#FFB347':l==='Miss'?'#F27D74':'#9AA0AA';
function prTargets(c,n,B,vt,rate,w,h,dpr){
  const hits=prHits(n);if(!hits.length)return;
  /* a new pass (looped back or jumped): the run ends (results) and the tally starts again */
  if(vt<PR.lastVt-0.4&&!PR.replay){prRunEnd();prReset();PR.hold=null}PR.lastVt=vt;
  let playing=S.playing&&el0playing()&&!PR.replay;const lead=prLeadS();
  /* the cards: upcoming moves slide along the bottom towards the now line (see a few coming, like Just Dance) */
  prCards(c,B,hits,vt,rate,w,h,dpr,lead);
  /* only the next move is drawn on you */
  const nextH=hits.find(H=>(H-vt)/rate>-PR_PRE);
  /* Step mode: the clip waits on each key move until you hold it (Hit for 0.4 s); tap play to skip on */
  if(PR.step&&!PR.replay){
    if(PR.hold!=null){const H=PR.hold;
      if(S.playing){prFinal(H);PR.hold=null;PR.holdOk=0}
      else{const Q=prRef(B,H);if(Q){const G=prPlace(Q,w,h),sc=PR.P?prScore(PR.P,G):null;PR.holdSc=sc;if(sc!=null&&sc>=(PR.win.get(H)??-1)){PR.win.set(H,sc);PR.why.set(H,prDiff(PR.P,G))}
        if(sc!=null&&sc>=75){const t=performance.now();if(!PR.holdOk)PR.holdOk=t;else if(t-PR.holdOk>=400){prFinal(H);PR.hold=null;PR.holdOk=0;play()}}else PR.holdOk=0}}}
    else if(playing&&nextH!=null&&!PR.done.has(nextH)&&(nextH-vt)/rate<=0.03){pause();playing=false;const el=curVid();try{el.currentTime=nextH}catch(e){}PR.hold=nextH;PR.holdOk=0;PR.holdSc=null;PR.win.delete(nextH)}
  }
  for(const H of hits){
    const dt=(H-vt)/rate;
    if(dt>Math.max(lead,0.3)+0.05)break;   /* (in order) */
    if(dt<-1.5)continue;                    /* long gone (or jumped past): not this pass */
    const Q=prRef(B,H);if(!Q)continue;const G=prPlace(Q,w,h);
    if(H===nextH&&dt>-PR_PRE&&dt<=lead){
      const p=Math.max(0,Math.min(1,1-dt/lead));
      prDraw(c,G,'#FFB347',Math.max(3,3*dpr),0.35+0.5*p,[8*dpr,7*dpr]);
      c.save();c.strokeStyle='#FFB347';c.lineWidth=Math.max(2,3*dpr);
      for(const j of prMovers(B,H,rate)){const q=G[j],rr=(9+34*(1-p))*dpr;c.globalAlpha=0.4+0.6*p;c.beginPath();c.arc(q[0],q[1],rr,0,7);c.stroke();c.globalAlpha=0.9;c.beginPath();c.arc(q[0],q[1],7*dpr,0,7);c.stroke()}
      c.restore();
    }
    /* scoring window around the move: the best match counts */
    if(playing&&dt<=PR_PRE&&dt>=-PR_POST&&!PR.done.has(H)&&PR.P){const sc=prScore(PR.P,G);if(sc!=null&&sc>=(PR.win.get(H)??-1)){PR.win.set(H,sc);PR.why.set(H,prDiff(PR.P,G))}}
    if(playing&&dt<-PR_POST&&!PR.done.has(H))prFinal(H);
  }
  /* Step mode: the hold meter */
  if(PR.hold!=null){const sc=PR.holdSc,t=performance.now(),k=PR.holdOk?Math.min(1,(t-PR.holdOk)/400):0;c.save();
    /* between the clip in the corner and the full-screen button */
    const xa=w*0.3+18*dpr,xb=w-62*dpr,cx=(xa+xb)/2,aw=xb-xa,txt=sc!=null?'HOLD IT · '+sc+'%':'HOLD IT';
    c.fillStyle='rgba(8,9,12,.6)';if(c.roundRect){c.beginPath();c.roundRect(xa,10*dpr,aw,46*dpr,12*dpr);c.fill()}else c.fillRect(xa,10*dpr,aw,46*dpr);
    let fs=22*dpr;c.font=`900 ${Math.round(fs)}px Figtree,sans-serif`;const tw=c.measureText(txt).width;if(tw>aw-16*dpr){fs*=(aw-16*dpr)/tw;c.font=`900 ${Math.round(fs)}px Figtree,sans-serif`}
    c.fillStyle=sc!=null&&sc>=75?'#2FD47A':'#FFB347';c.textAlign='center';c.textBaseline='middle';c.fillText(txt,cx,29*dpr);
    c.fillStyle='rgba(255,255,255,.18)';c.fillRect(xa+10*dpr,46*dpr,aw-20*dpr,4*dpr);
    c.fillStyle=k>0?'#2FD47A':'#FFB347';c.fillRect(xa+10*dpr,46*dpr,(aw-20*dpr)*(k>0?k:sc!=null?Math.min(1,sc/75)*0.6:0),4*dpr);c.restore()}
}
/* Hands up to play / pause (camera on): both wrists above your head. Held 0.6 s it starts (with the countdown), held
   1.2 s while playing it pauses (longer, so a dance move with both arms up doesn't stop the clip). It has to see your
   hands come down before it works again. */
function prHands(now,fresh){
  if(!PR.hands||!PR.stream||PR.replay||!fresh)return;
  if(PR.hold!=null){PR.hup=0;return}   /* Step mode: the held pose decides, not the hands */
  const P=PR.Praw,ok=j=>P&&P[j]&&P[j][2]>=0.5;
  const up=!!(ok(0)&&ok(15)&&ok(16)&&ok(11)&&ok(12)&&P[15][1]<P[0][1]-0.03&&P[16][1]<P[0][1]-0.03);
  if(!up){PR.hup=0;PR.hupArm=true;return}
  if(!PR.hupArm||now<PR.hupCool)return;
  if(!PR.hup)PR.hup=now;
  const need=S.playing?1200:600;
  if(now-PR.hup>=need){PR.hup=0;PR.hupArm=false;PR.hupCool=now+1500;
    if(S.playing)pause();else if(PR.cd)prCdCancel();else if(prCdWanted())prCdStart();else play();
    PR.handsN=(PR.handsN||0)+1}}
function prOverlay(c,w,h,dpr,now){
  const cx=PR.mode==='ghost'?(w*0.3+w)/2:w/2;
  if(PR.cd){const left=Math.max(0,PR.cd.end-now)/1000,nTxt=String(Math.ceil(left)||1),fr=left%1;
    c.save();c.fillStyle='rgba(8,9,12,.45)';c.fillRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';
    c.font=`900 ${Math.round(Math.min(w,h)*0.32)}px Figtree,sans-serif`;c.globalAlpha=0.35+0.65*fr;c.fillStyle='#F3F1EC';c.fillText(nTxt,cx,h*0.46);
    c.globalAlpha=1;c.font=`800 ${Math.round(15*dpr)}px Figtree,sans-serif`;c.fillText('Get into place · tap to cancel',cx,h*0.46+Math.min(w,h)*0.22);c.restore()}
  if(PR.hup&&PR.hands){const need=S.playing?1200:600,k=Math.min(1,(now-PR.hup)/need),r=26*dpr,x=w-r-14*dpr,y=h-r-(PR.mode==='ghost'?120:14)*dpr;
    c.save();c.lineWidth=5*dpr;c.strokeStyle='rgba(243,241,236,.25)';c.beginPath();c.arc(x,y,r,0,7);c.stroke();
    c.strokeStyle='#2FD47A';c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+k*2*Math.PI);c.stroke();
    c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(11*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(S.playing?'Pause':'Play',x,y);c.restore()}}
/* a key move is over: its best score in the window becomes Hit / Close / Miss */
function prFinal(H){if(PR.done.has(H))return;PR.done.add(H);const sc=PR.win.get(H);PR.pass.n++;
  let lab='Not seen';if(sc!=null&&sc>=0){lab=sc>=75?'Hit':sc>=55?'Close':'Miss';if(lab==='Hit')PR.pass.hit++;else if(lab==='Close')PR.pass.close++}
  /* a whole arm or leg way off (60°+) isn't a Hit (shoulders and hips don't cap: too noisy), however good the rest is: it becomes Close and says which part */
  const w0=PR.why.get(H)||[];if(lab==='Hit'&&w0.some(x=>x.deg>=60&&/arm|leg/.test(x.part))){lab='Close';PR.pass.hit--;PR.pass.close++}
  const why=lab==='Hit'||lab==='Not seen'?[]:w0;
  PR.flash={label:lab,score:sc??0,col:prCol(lab),at:performance.now(),why:prWhyText(why.slice(0,1))};PR.res.set(H,lab);
  if(PR.flash.why&&!PR.replay&&!S.rec&&performance.now()-(PR.saidAt||0)>2500)say(PR.flash.why);
  PR.results=(PR.results||[]).concat([{t:H,score:sc}]).slice(-200);
  if(PR.run)PR.run.hits.push({t:H,score:sc!=null&&sc>=0?sc:null,label:lab,why})}
/* ---- the run: record your camera while you dance a pass, then show how it went and let you replay it ---- */
function prRunStart(){const Rn={hits:[],samples:[],t0:performance.now(),cw:camV.videoWidth||720,ch:camV.videoHeight||960,chunks:[],rec:null,mime:''};
  try{const types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const t=window.MediaRecorder&&types.find(x=>MediaRecorder.isTypeSupported(x));
    if(t&&PR.stream){Rn.mime=t;Rn.rec=new MediaRecorder(PR.stream,{mimeType:t,videoBitsPerSecond:1500000});Rn.rec.ondataavailable=e=>{if(e.data&&e.data.size)Rn.chunks.push(e.data)};Rn.rec.start(1000)}}
  catch(e){Rn.rec=null}
  PR.run=Rn;$('#pracRes').hidden=true}
function prRunEnd(){const Rn=PR.run;PR.run=null;if(!Rn)return;
  const keep=Rn.hits.some(x=>x.score!=null);   /* a pass where you were never seen doesn't replace the last one */if(keep&&S.playing)pause();   /* the pass is over: stop on the results (Go again starts the next) */
  const fin=()=>{if(!keep)return;const url=Rn.chunks.length?URL.createObjectURL(new Blob(Rn.chunks,{type:(Rn.mime||'video/webm').split(';')[0]})):null;
    const old=PR.last;if(old&&old.url&&!(PR.replay&&PR.replay.url===old.url))URL.revokeObjectURL(old.url);
    PR.last={hits:Rn.hits,samples:Rn.samples,url,cw:Rn.cw,ch:Rn.ch,mime:Rn.mime};prLog(Rn.hits);if(PR.on){prResShow();pracUI()}};
  if(Rn.rec&&Rn.rec.state!=='inactive'){Rn.rec.onstop=fin;try{Rn.rec.stop()}catch(e){fin()}}else fin()}
/* ---- progress: every kept run is logged for its clip (score, hits, when), and the days you practised (any clip) ---- */
const dayKey=d=>{d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function prLogKey(){const n=srcById(S.cur);return n?'rs-runs:'+(n.key||n.id):null}
function prRuns(){const k=prLogKey();if(!k)return [];try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return []}}
function prLog(hits){const k=prLogKey();if(!k||!hits.length)return;
  const seen=hits.filter(x=>x.score!=null),avg=seen.length?Math.round(hits.reduce((a,x)=>a+(x.score||0),0)/hits.length):0;
  const r={at:Date.now(),score:avg,hit:hits.filter(x=>x.label==='Hit').length,n:hits.length};
  try{const a=prRuns();a.push(r);localStorage.setItem(k,JSON.stringify(a.slice(-200)))}catch(e){}
  try{const d=JSON.parse(localStorage.getItem('rs-days')||'[]');const t=dayKey();if(d[d.length-1]!==t){d.push(t);localStorage.setItem('rs-days',JSON.stringify(d.slice(-400)))}}catch(e){}}
function prStreak(){let d=[];try{d=JSON.parse(localStorage.getItem('rs-days')||'[]')}catch(e){}if(!d.length)return 0;
  const set=new Set(d),day=new Date();if(!set.has(dayKey(day))){day.setDate(day.getDate()-1);if(!set.has(dayKey(day)))return 0}
  let n=0;while(set.has(dayKey(day))){n++;day.setDate(day.getDate()-1)}return n}
function prHistShow(){const box=$('#prResHist');if(!box)return;const runs=prRuns();if(!runs.length){box.hidden=true;return}
  const last=runs[runs.length-1],prev=runs.slice(0,-1),best=Math.max(...runs.map(r=>r.score)),pb=prev.length?Math.max(...prev.map(r=>r.score)):-1;
  const today=runs.filter(r=>dayKey(new Date(r.at))===dayKey()).length,st=prStreak();
  const first=runs[0],up=runs.length>=3?last.score-first.score:null;
  const bits=[];if(prev.length&&last.score>pb)bits.push('New best!');else bits.push('Best '+best+'%');
  bits.push(runs.length+' run'+(runs.length===1?'':'s')+(today>1?` (${today} today)`:''));
  if(up!=null&&up!==0)bits.push((up>0?'+':'')+up+'% since your first');
  if(st>=2)bits.push(st+'-day streak');
  $('#prHistTxt').textContent=bits.join(' · ');
  const g=$('#prHistBars');g.textContent='';for(const r of runs.slice(-12)){const i=document.createElement('i');i.style.height=Math.max(8,r.score)+'%';i.title=new Date(r.at).toLocaleString()+': '+r.score+'%';if(r===last)i.className='now';g.appendChild(i)}
  box.hidden=false}
/* your pose at clip time t in a run (the last one kept at or before t, so a Step-mode hold shows the matched pose) */
function prSampleAt(sm,t,last){if(!sm||!sm.length)return null;let best=null,bd=1e9;
  for(let i=0;i<sm.length;i++){const d=t-sm[i].vt;if(d>=-0.02&&d<0.5&&(last?d<=bd+0.001:d<bd)){bd=d;best=sm[i]}}return best}
function prResShow(){const L=PR.last;if(!L)return;const box=$('#pracRes');
  const hit=L.hits.filter(x=>x.label==='Hit').length,close=L.hits.filter(x=>x.label==='Close').length,miss=L.hits.length-hit-close;
  const avg=Math.round(L.hits.reduce((a,x)=>a+(x.score||0),0)/L.hits.length);
  $('#prResScore').textContent=avg+'%';
  $('#prResSum').textContent=`${hit} hit · ${close} close · ${miss} miss of ${L.hits.length} move${L.hits.length===1?'':'s'}`+(miss?' · tap a move to go to it':'');
  const mv=$('#prResMoves');mv.textContent='';
  L.hits.forEach((x,i)=>{const b=document.createElement('button');b.type='button';b.dataset.l=x.label;b.dataset.t=String(x.t);
    const wt=prWhyText(x.why);
    b.title=`Move ${i+1} at ${fmtClock(x.t)}: ${x.label}${x.score!=null?' '+x.score+'%':''}${wt?' · '+wt:''}`;
    b.innerHTML=`<span>${x.label==='Not seen'?'—':x.label}</span><i>${x.score!=null?x.score+'%':'not seen'}</i>`+(wt?`<em>${(x.why[0].part)}</em>`:'');
    b.addEventListener('click',()=>{prReplayStop(true);pause();const el=curVid();try{el.currentTime=Math.max(0,x.t-prLeadS()-0.6)}catch(e){}PR.lastVt=-1e9;prReset()});mv.appendChild(b)});
  /* the body part that was off most often over the pass */
  const cnt={};for(const x of L.hits)for(const w of (x.why||[]).slice(0,2))cnt[w.part]=(cnt[w.part]||0)+1;
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0],tip=$('#prResTip');
  if(tip){tip.textContent=top&&top[1]>=2?`Work on: your ${top[0]} (off in ${top[1]} move${top[1]===1?'':'s'})`:'';tip.hidden=!tip.textContent}
  prHistShow();
  $('#prReplay').disabled=!(L.samples.length||L.url);$('#prSave').disabled=!(L.samples.length||L.url);
  box.hidden=false}
const fmtClock=t=>{t=Math.max(0,t);return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')};
function prReplayStart(){const L=PR.last;if(!L)return;prRunEnd();PR.hold=null;
  PR.replay={...L,played:false};PR.res=new Map(L.hits.map(x=>[x.t,x.label]));PR.done=new Set(L.hits.map(x=>x.t));PR.flash=null;
  if(L.url){recV.src=L.url;recV.load()}else{recV.removeAttribute('src')}
  $('#pracRes').hidden=true;if(PR.mode==='split')PR.mode='ghost';PR.xf=null;pracUI();
  pause();toStart();PR.lastVt=-1e9;play();
  if(!L.url)recMsg('This phone didn\'t record the camera, so the replay shows your skeleton only.')}
/* ---- Save my run: the dancer and you side by side, each move's result on screen, the song underneath, as one video.
   It records like a take (the clip plays once from the start), with your camera recording from the run on the right,
   kept in time with the clip from the run's own timing (where the clip was at each moment of the recording). ---- */
function runCamTime(L,t){const sm=L&&L.samples;if(!sm||!sm.length)return null;
  let lo=0,hi=sm.length-1;if(t<=sm[0].vt)return sm[0].w-(sm[0].vt-t);if(t>=sm[hi].vt)return sm[hi].w+(t-sm[hi].vt);
  while(hi-lo>1){const m=(lo+hi)>>1;if(sm[m].vt<=t)lo=m;else hi=m}
  const a=sm[lo],b=sm[hi],k=(t-a.vt)/((b.vt-a.vt)||1);return a.w+(b.w-a.w)*k}
async function composeCfg(w,h){
  const codecs=[...(vCfg&&vCfg.codec?[vCfg.codec]:[]),'avc1.640028','avc1.4d0028','avc1.42002a','vp09.00.10.08'];
  for(const codec of codecs){const avc=codec.startsWith('avc');const cfg=avc?{codec,width:w,height:h,bitrate:6000000,framerate:30,avc:{format:'avc'}}:{codec,width:w,height:h,bitrate:6000000,framerate:30};
    const r=await VideoEncoder.isConfigSupported(cfg).catch(()=>null);if(r&&r.supported){cfg.mux=avc?'avc':'vp9';return cfg}}
  return null}
function composeLayout(L){const H=960,vw=v.videoWidth||720,vh=v.videoHeight||1280,cw=(L.url&&recV.videoWidth)||L.cw||720,ch=(L.url&&recV.videoHeight)||L.ch||960;
  let lw=Math.round(vw/vh*H/2)*2,rw=Math.round(cw/ch*H/2)*2;const k=Math.min(1,1920/(lw+rw));
  const h=Math.round(H*k/2)*2;lw=Math.round(lw*k/2)*2;rw=Math.round(rw*k/2)*2;return {W:lw+rw,H:h,lw,rw}}
function drawCompose(t){const C=S.recCompose,L=C.L,{W,H,lw,rw}=C.lay;
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  cx.fillStyle='#0E1014';cx.fillRect(0,0,W,H);
  /* the dancer, with the skeleton (flipped too when the clip is shown mirrored) */
  const vw=v.videoWidth||lw,vh=v.videoHeight||H,k=Math.min(lw/vw,H/vh),dw=vw*k,dh=vh*k,R={x:(lw-dw)/2,y:(H-dh)/2,w:dw,h:dh};
  cx.save();if(S.mirror){cx.translate(lw,0);cx.scale(-1,1)}
  try{cx.drawImage(v,R.x,R.y,R.w,R.h)}catch(e){}
  try{const n=srcOfEl(v),B=n&&bodyOf(n);if(B&&$('#bodyShow').checked)LOOK.drawBody(cx,B,t,R,{hipPath:false,meter:false,tiltGuide:false},1)}catch(e){}
  cx.restore();
  /* you: the camera recording kept in time with the clip, shown as you saw yourself */
  const ct=runCamTime(L,t);
  if(L.url&&recV.readyState>=2){
    if(ct!=null&&!recV.seeking){const d=ct-recV.currentTime;if(Math.abs(d)>0.25){try{recV.currentTime=Math.max(0,ct)}catch(e){}}else recV.playbackRate=Math.max(0.5,Math.min(4,(v.playbackRate||1)*(1+d*1.5)))}
    const cw=recV.videoWidth,ch=recV.videoHeight,k2=Math.min(rw/cw,H/ch),w2=cw*k2,h2=ch*k2;
    cx.save();if(PR.mirror){cx.translate(lw+rw,0);cx.scale(-1,1);cx.drawImage(recV,(rw-w2)/2,(H-h2)/2,w2,h2)}else cx.drawImage(recV,lw+(rw-w2)/2,(H-h2)/2,w2,h2);cx.restore()}
  else{const sm=prSampleAt(L.samples,t,true),P=sm&&sm.P;
    if(P){cx.save();cx.strokeStyle='#2FD47A';cx.lineWidth=6;cx.lineCap='round';const X=q=>lw+(PR.mirror?1-q[0]:q[0])*rw,Y=q=>q[1]*H;
      for(const [i,j] of PR_BONES){if(!P[i]||!P[j]||P[i][2]<0.4||P[j][2]<0.4)continue;cx.beginPath();cx.moveTo(X(P[i]),Y(P[i]));cx.lineTo(X(P[j]),Y(P[j]));cx.stroke()}cx.restore()}}
  /* labels, the dividing line, and each move's result as it happens */
  cx.fillStyle='rgba(243,241,236,.9)';cx.fillRect(lw-1,0,2,H);
  const fs=Math.round(H/34);cx.font=`800 ${fs}px Figtree,system-ui,sans-serif`;cx.textBaseline='top';cx.lineWidth=4;cx.strokeStyle='rgba(8,9,12,.8)';
  const tag=(s,x,al)=>{cx.textAlign=al;cx.strokeText(s,x,fs*0.8);cx.fillStyle='#F3F1EC';cx.fillText(s,x,fs*0.8)};
  tag('DANCER',fs,'left');tag('YOU',W-fs,'right');
  let cur=null;for(const x of L.hits)if(x.t<=t+0.05&&t-x.t<1.3)cur=x;
  if(cur){const big=Math.round(H/16);cx.textAlign='center';cx.textBaseline='bottom';cx.font=`900 ${big}px Figtree,system-ui,sans-serif`;cx.lineWidth=7;
    const s=(cur.label==='Not seen'?'NOT SEEN':cur.label.toUpperCase()+(cur.score!=null?' '+cur.score+'%':'')),y=H-fs*2.2;cx.strokeText(s,lw+rw/2,y);cx.fillStyle=prCol(cur.label);cx.fillText(s,lw+rw/2,y);
    const wt=prWhyText((cur.why||[]).slice(0,1));if(wt){cx.font=`800 ${fs}px Figtree,system-ui,sans-serif`;cx.lineWidth=4;cx.textBaseline='top';cx.strokeText('Fix: '+wt,lw+rw/2,y+fs*0.3);cx.fillStyle='#F3F1EC';cx.fillText('Fix: '+wt,lw+rw/2,y+fs*0.3)}}
  const hit=L.hits.filter(x=>x.label==='Hit').length;cx.textAlign='left';cx.textBaseline='bottom';cx.font=`800 ${fs}px Figtree,system-ui,sans-serif`;cx.lineWidth=4;
  const sc=`${hit}/${L.hits.length} hits · Riddim Swap`;cx.strokeText(sc,fs,H-fs*0.7);cx.fillStyle='rgba(243,241,236,.85)';cx.fillText(sc,fs,H-fs*0.7)}
async function prSaveRun(){const L=PR.last;if(!L||S.rec)return;const b=$('#prSave');
  const C={L,lay:null,cfg:null};
  if(L.url){recV.src=L.url;recV.load();await new Promise(r=>{if(recV.readyState>=1)r();else{recV.addEventListener('loadedmetadata',r,{once:true});setTimeout(r,3000)}})}
  C.lay=composeLayout(L);
  if(canCodecs()&&buf&&aCfg){C.cfg=await composeCfg(C.lay.W,C.lay.H)}
  /* the replay (your recording follows the clip), then record it like a take */
  prRunEnd();PR.hold=null;PR.replay={...L,played:false};PR.res=new Map(L.hits.map(x=>[x.t,x.label]));PR.done=new Set(L.hits.map(x=>x.t));PR.flash=null;
  $('#pracRes').hidden=true;PR.xf=null;pracUI();
  S.recCompose=C;S.recComposeN=(S.recComposeN||0)+1;
  startRecording();
  if(!S.rec){S.recCompose=null;prReplayStop(true);prResShow();return}
  recMsg('Making your video: you and the dancer side by side · '+fmt(segStart(segs().length,segs())))}
function prReplayStop(quiet){if(!PR.replay)return;PR.replay=null;try{recV.pause()}catch(e){}PR.Praw=null;PR.P=null;prReset();PR.xf=null;
  if(!quiet){pause();prResShow()}pracUI()}
function prCards(c,B,hits,vt,rate,w,h,dpr,lead){
  const dock=$('#dock'),resB=(dock&&!dock.hidden?dock.getBoundingClientRect().height+14:8)*dpr;
  const ch=Math.min(h*0.17,92*dpr),cw=ch*0.66,y1=h-resB,y0=y1-ch,x0=12*dpr+cw*0.5,span=Math.max(3,lead*2.5),X1=w-10*dpr-cw*0.5;
  c.save();
  /* the track and the now line */
  c.fillStyle='rgba(8,9,12,.35)';c.fillRect(0,y0-4*dpr,w,ch+8*dpr);
  c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=2*dpr;c.beginPath();c.moveTo(x0,y0-6*dpr);c.lineTo(x0,y1+6*dpr);c.stroke();
  /* the warning zone: from here the move is drawn on you */
  const xl=x0+Math.min(1,lead/span)*(X1-x0);c.fillStyle='rgba(255,179,71,.10)';c.fillRect(x0,y0-4*dpr,xl-x0,ch+8*dpr);
  for(const H of hits){const dt=(H-vt)/rate;if(dt>span||dt<-0.6)continue;
    const x=x0+Math.max(-0.2,dt)/span*(X1-x0);const res=PR.res.get(H),inLead=dt<=lead;
    const fade=dt<0?Math.max(0,1+dt/0.6):1;c.globalAlpha=fade;
    c.fillStyle='rgba(14,16,20,.82)';c.strokeStyle=res?prCol(res):inLead?'#FFB347':'rgba(255,255,255,.35)';c.lineWidth=(res||inLead?2.5:1.2)*dpr;
    const bx=x-cw/2;c.beginPath();if(c.roundRect)c.roundRect(bx,y0,cw,ch,8*dpr);else c.rect(bx,y0,cw,ch);c.fill();c.stroke();
    /* the move's shape, fitted into the card */
    const Q=prRef(B,H);if(Q){const vis=Q.filter(q=>q[2]>=0.45);if(vis.length>6){let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;for(const q of vis){a0=Math.min(a0,q[0]);a1=Math.max(a1,q[0]);b0=Math.min(b0,q[1]);b1=Math.max(b1,q[1])}
      const pad=5*dpr,s=Math.min((cw-2*pad)/Math.max(1,a1-a0),(ch-2*pad)/Math.max(1,b1-b0)),ox=bx+(cw-(a1-a0)*s)/2-a0*s,oy=y0+(ch-(b1-b0)*s)/2-b0*s;
      const M=Q.map(q=>[ox+q[0]*s,oy+q[1]*s,q[2]]);prDraw(c,M,res?prCol(res):'#F3F1EC',Math.max(1.5,2*dpr),0.95);
      c.fillStyle='#FFB347';for(const j of prMovers(B,H,rate)){if(!prVis(M,j))continue;c.beginPath();c.arc(M[j][0],M[j][1],3.2*dpr,0,7);c.fill()}}}
    if(res){c.fillStyle=prCol(res);c.font=`800 ${Math.round(10*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.textBaseline='bottom';c.fillText(res.toUpperCase(),x,y0-2*dpr)}
  }
  c.restore();
}
/* ---- Worldline: the dancer through time in 3D (x, y from the pose; depth = time) ---- */
const WL_PAST=1.6,WL_NEXT=0.8,WL_STEP=0.2;
function prWorld(c,w,h,dpr,B,vt){
  const W=B.w||1,H=B.h||1,asp=W/H,V=PR.wv,cy=Math.cos(V.yaw),sy=Math.sin(V.yaw),cp=Math.cos(V.pitch),sp=Math.sin(V.pitch);
  const f=Math.min(w,h)*1.55*V.zoom,D=3.1,tz=t=>(vt-t)/(WL_PAST)*1.7;   /* past goes back into the screen */
  const proj=(x,y,z)=>{const x1=x*cy-z*sy,z1=x*sy+z*cy,y2=y*cp-z1*sp,z2=y*sp+z1*cp,k=f/(D+z2);return [w/2+x1*k,h*0.5-y2*k,z2]};
  /* pose point (pixels) -> 3D: x right, y up, both in frame heights, centred on the frame */
  const P3=(q,t)=>proj((q[0]-W/2)/H,-(q[1]-H/2)/H,tz(t));
  const line=(a,b,col,lw,al,dash)=>{c.save();c.globalAlpha=al;c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';if(dash)c.setLineDash(dash);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();c.restore()};
  /* floor grid */
  for(let x=-1.4;x<=1.41;x+=0.35)line(proj(x,-0.56,tz(vt-WL_PAST-0.2)),proj(x,-0.56,tz(vt+WL_NEXT+0.2)),'#4a5372',1,0.35);
  for(let t=Math.ceil((vt-WL_PAST)/0.4)*0.4;t<=vt+WL_NEXT;t+=0.4)line(proj(-1.4,-0.56,tz(t)),proj(1.4,-0.56,tz(t)),'#4a5372',1,0.25);
  const n=srcById(S.cur),keys=n?prHits(n):[];
  /* slices: on a fixed grid (so they slide smoothly), plus now, plus key moves in the window */
  const ts=[];for(let t=Math.ceil((vt-WL_PAST)/WL_STEP)*WL_STEP;t<=vt+WL_NEXT+1e-6;t+=WL_STEP)if(Math.abs(t-vt)>0.04)ts.push({t,kind:'s'});
  ts.push({t:vt,kind:'now'});for(const k of keys)if(k>=vt-WL_PAST&&k<=vt+WL_NEXT)ts.push({t:k,kind:'key'});
  ts.forEach(s=>s.z=proj(0,0,tz(s.t))[2]);ts.sort((a,b)=>b.z-a.z);
  for(const s of ts){const Q=prRef(B,s.t,true);if(!Q)continue;const d=s.t-vt,age=Math.abs(d)/(d<0?WL_PAST:WL_NEXT);
    const now=s.kind==='now',key=s.kind==='key';
    /* the frame's outline (the video's shape) at this moment */
    const corn=[[-asp/2,0.5],[asp/2,0.5],[asp/2,-0.5],[-asp/2,-0.5]].map(([x,y])=>proj(x,y,tz(s.t)));
    c.save();c.globalAlpha=now?0.55:0.16*(1-age)+0.04;c.strokeStyle=now?'#8D9FE4':'#676F83';c.lineWidth=(now?1.4:0.8)*dpr;if(d>0.04)c.setLineDash([3*dpr,4*dpr]);c.beginPath();corn.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();c.stroke();c.restore();
    const col=now?'#E9EDFF':key?'#FFB347':d<0?'#7F95F5':'#C9B27A',al=now?1:key?0.9:Math.max(0.12,0.7*(1-age)),lw=(now?3.6:key?2.6:1.6)*dpr*(f/(D+s.z))/(f/D);
    for(const [a,b] of PR_BONES){if(!prVis(Q,a)||!prVis(Q,b))continue;line(P3(Q[a],s.t),P3(Q[b],s.t),col,Math.max(1,lw),al,d>0.04&&!key?[5*dpr,5*dpr]:null)}
    if(prVis(Q,0)){const p=P3(Q[0],s.t);c.save();c.globalAlpha=al;c.strokeStyle=col;c.lineWidth=Math.max(1,lw);c.beginPath();c.arc(p[0],p[1],Math.max(2,(now?7:4)*dpr),0,7);c.stroke();c.restore()}
    if(PR.myRun&&PR.last&&PR.last.samples.length&&(PR.replay||!now||!PR.Praw)){const sm=prSampleAt(PR.last.samples,s.t,true);const M=sm&&sm.P&&prOnRef(sm.P,Q,PR.last.cw,PR.last.ch);
      if(M)for(const [a,b] of PR_BONES){if(!prVis(M,a)||!prVis(M,b))continue;line(P3(M[a],s.t),P3(M[b],s.t),'#2FD47A',Math.max(1,lw*0.8),now?0.95:Math.max(0.15,al*0.8),d>0.04?[4*dpr,5*dpr]:null)}}
    if(now&&PR.mine&&PR.Praw&&!PR.replay){const M=prOnRef(PR.Praw,Q);if(M)for(const [a,b] of PR_BONES){if(!prVis(M,a)||!prVis(M,b))continue;line(P3(M[a],s.t),P3(M[b],s.t),'#2FD47A',2.6*dpr,0.95)}}
  }
  /* trails: hands and feet through the whole window */
  const TR=[[15,'#7FD3FF'],[16,'#7FD3FF'],[27,'#FF7FB2'],[28,'#FF7FB2']];
  for(const [j,col] of TR){let prev=null;for(let t=vt-WL_PAST;t<=vt+WL_NEXT;t+=1/30){const Q=RB.poseAt(B,t);if(!Q||Q[j][2]<0.5){prev=null;continue}const p=P3([Q[j][0]*W,Q[j][1]*H],t);if(prev)line(prev,p,col,1.8*dpr,t<vt?0.75:0.4,t>vt?[3*dpr,4*dpr]:null);prev=p}}
  c.save();c.fillStyle='rgba(243,241,236,.55)';c.font=`700 ${Math.round(10*dpr)}px Figtree,sans-serif`;c.textAlign='right';c.textBaseline='bottom';
  const dock=$('#dock'),resB=(dock&&!dock.hidden?dock.getBoundingClientRect().height+14:8)*dpr;
  c.fillText('PAST SOLID · NEXT DASHED · KEY MOVES AMBER'+(PR.myRun&&PR.last&&PR.last.samples.length?' · YOU GREEN':''),w-10*dpr,h-resB);c.restore();
}
/* your live pose (camera) put on the dancer's now pose: hips on hips, same torso length */
function prOnRef(Pn,Q,cw,ch){if(!(prVis(Q,23)&&prVis(Q,24)&&prVis(Q,11)&&prVis(Q,12)))return null;const n=srcById(S.cur),B=n&&bodyOf(n);if(!B)return null;
  const camW=cw||camV.videoWidth||1,camH=ch||camV.videoHeight||1,U=Pn.map(q=>[(PR.mirror?1-q[0]:q[0])*camW,q[1]*camH,q[2]]);
  if(!(prVis(U,23)&&prVis(U,24)&&prVis(U,11)&&prVis(U,12)))return null;
  const hu=prMid(U,23,24),hq=prMid(Q,23,24),s=(prTorso(Q)||1)/(prTorso(U)||1);return U.map(q=>[hq[0]+(q[0]-hu[0])*s,hq[1]+(q[1]-hu[1])*s,q[2]])}
/* turn / zoom the Worldline */
{const pts=new Map();let last=0,base=null;
  camCv.addEventListener('pointerdown',e=>{if(PR.mode!=='world')return;camCv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);
    const now=performance.now();if(pts.size===1&&now-last<300){PR.wv={yaw:-0.62,pitch:0.28,zoom:1}}last=now;
    if(pts.size===2){const [a,b]=[...pts.values()];base={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:PR.wv.zoom}}});
  camCv.addEventListener('pointermove',e=>{if(PR.mode!=='world'||!pts.has(e.pointerId))return;const p=pts.get(e.pointerId);
    if(pts.size===1){PR.wv.yaw+=(e.clientX-p[0])*0.008;PR.wv.pitch=Math.max(-0.2,Math.min(1.2,PR.wv.pitch+(e.clientY-p[1])*0.006))}
    pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===2&&base){const [a,b]=[...pts.values()];PR.wv.zoom=Math.max(0.5,Math.min(3,base.z*Math.hypot(a[0]-b[0],a[1]-b[1])/(base.d||1)))}});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)base=null};camCv.addEventListener('pointerup',up);camCv.addEventListener('pointercancel',up);
  camCv.addEventListener('wheel',e=>{if(PR.mode!=='world')return;e.preventDefault();PR.wv.zoom=Math.max(0.5,Math.min(3,PR.wv.zoom*Math.exp(-e.deltaY*0.0015)))},{passive:false});}
function el0playing(){const e=curVid();return !!e&&!e.paused}
$$('#pracMode button').forEach(b=>b.addEventListener('click',()=>{PR.mode=b.dataset.pm;PR.xf=null;prSave();pracUI();if(prNeedsCam()&&!PR.stream)camStart();pracStatus()}));
$('#prSave').addEventListener('click',()=>prSaveRun());
$('#pracCount').addEventListener('click',()=>{PR.count=PR.count===3?5:PR.count===5?0:3;prSave();pracUI()});
[['#pracVoice','voice'],['#pracHands','hands'],['#pracMirror','mirror'],['#pracMine','mine'],['#pracTargets','targets'],['#pracFlip','flip'],['#pracAll','all'],['#pracStep','step'],['#pracMyRun','myRun']].forEach(([id,k])=>$(id).addEventListener('click',()=>{PR[k]=!PR[k];PR.xf=null;if(k==='all')prReset();if(k==='step'&&!PR.step){PR.hold=null;PR.holdOk=0}prSave();pracUI();pracStatus()}));
$('#pracLead').addEventListener('click',()=>{PR.lead=PR.lead===1?2:PR.lead===2?4:1;prSave();pracUI()});
$('#pracReset').addEventListener('click',()=>{PR.wv={yaw:-0.62,pitch:0.28,zoom:1}});
$('#pracCam').addEventListener('click',camStart);
$('#pracStop').addEventListener('click',pracOff);
$('#pracLive').addEventListener('click',()=>{prReplayStop(true);pause()});
$('#prReplay').addEventListener('click',prReplayStart);
$('#prAgain').addEventListener('click',()=>{prReplayStop(true);$('#pracRes').hidden=true;PR.hold=null;pause();toStart();PR.lastVt=-1e9;prReset();if(prCdWanted())prCdStart();else play()});
$('#prResClose').addEventListener('click',()=>{$('#pracRes').hidden=true});
$('#pracMore').addEventListener('click',()=>{pracOff();sendClip()});
window.__rsPR=PR;window.__rsPrScore=prScore;window.__rsPrDiff=prDiff;window.__rsPrHits=()=>prHits(srcById(S.cur));

/* ---------- MirrorView hand-off ----------
   MirrorView lives at ./mirrorview/ in the same installed app (same origin and storage). A clip or take is left in
   IndexedDB 'riddim-bridge' and MirrorView opens it through its own Load video path, then deletes it. */
if(window.RS_HOSTED)document.documentElement.classList.add('rs-hosted');
function bridgeDb(){return new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function handOff(kind,blob,name,meta){
  const db=await bridgeDb(), id='h'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  await new Promise((res,rej)=>{const t=db.transaction('handoff','readwrite'),st=t.objectStore('handoff');st.clear();st.put({id,v:1,from:'riddim-swap',kind,name,blob,meta:meta||null,created:Date.now()});t.oncomplete=res;t.onerror=()=>rej(t.error)});
  db.close(); return id;
}
async function goMirror(id){
  pause(); try{await autosave(true)}catch(e){}
  location.href='mirrorview/'+(id?'?handoff='+encodeURIComponent(id):'')+(/debug/.test(location.hash)?'#debug':'');
}
$('#mvBtn').addEventListener('click',()=>goMirror(null));
/* the clip, its hits and its body tracking (so MirrorView shows the same dance body without tracking again) */
async function sendClip(){
  if(S.study)studyOff();   /* (and Learn) so the clip goes as it plays normally */
  const n=srcById(S.cur);
  if(!n||n.missing||!n.blob){hMsg('Add this video again first: its file isn’t loaded on this phone.');return false}
  const B=bodyOf(n);
  /* the song goes too, with what's needed to keep it in time with the clip: song = offset + (clip time - cIn) × ar / vr
     (offset includes the same corrections the player uses, and the sound delay) */
  let song=null;const so=S.liveSong;
  if(so&&so.ready&&!so.missing){let sb=so.blob||null;if(!sb)try{sb=await mediaGet(so.key)}catch(e){}
    if(sb&&sb.size)song={blob:sb,name:so.name||'Song',offset:S.offset+(S.variant&&S.variant.shift||0)+((S.avComp||0)+(S.sndDelay||0))*S.ar,ar:S.ar,vr:S.vr,cIn:S.cIn}}
  /* cuts and the speed graph: the kept parts, and a table from clip time to the time the song plays (output time), so
     Body keeps the song in time through the speed graph and skips the cut parts. (A routine sends just this clip.) */
  let pieces=null,map=null,trim=[S.cIn,clipEnd()];
  if(routineOn())song=null;
  else{const L=segs();if(L.length>1||L.some(g=>g.k)){pieces=L.map(g=>[g.s,g.e]);map=[];
    L.forEach((g,i)=>{const o0=segStart(i,L);for(let t=g.s;t<g.e-1e-6;t+=0.05)map.push([+t.toFixed(4),+(o0+toOut(g,t)).toFixed(4)]);map.push([+g.e.toFixed(4),+(o0+segLen(g)).toFixed(4)])});
    trim=[L[0].s,L[L.length-1].e]}}
  if(song&&map)song.offset=S.offset+(S.variant&&S.variant.shift||0)+((S.avComp||0)+(S.sndDelay||0))*S.ar;   /* song = offset + output time × ar */
  try{const id=await handOff('clip',n.blob,n.fname||n.name||'clip.mp4',{trim,pieces,map,project:PJ.name||'',hits:(n.motion&&hitsOf(n).map(b=>b.t))||null,song,
      body:B?{v:B.v,cleanV:B.cleanV,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:B.data,mask:B.mask||null,world:B.world||null,hips:B.hips||null,multi:B.multi||0,ext:B.ext||null,cuts:B.cuts||null}:null});goMirror(id);return true}
  catch(e){hMsg('Couldn’t open the clip in Body on this phone ('+(e&&e.message||e)+').');return false}
}
$('#mvClip').addEventListener('click',sendClip);
/* coming back from MirrorView's bottom bar: open the section that was tapped there */
function takeTabReq(){let r=null,pj=null;try{r=localStorage.getItem('rs-tab-req');localStorage.removeItem('rs-tab-req');pj=localStorage.getItem('rs-open-proj');localStorage.removeItem('rs-open-proj')}catch(e){}const t=r&&document.getElementById(r);if(t&&t.getAttribute('role')==='tab')t.click();
  if(pj)setTimeout(()=>$('#projBtn').click(),200)}   /* Projects tapped in Body */
window.addEventListener('pageshow',takeTabReq); setTimeout(takeTabReq,0);
/* Body: practise with your camera right here, on the same clip with every edit (Worldline still opens the separate Body page) */
$('#t-body').addEventListener('click',()=>{PR.on?pracOff():pracOn()});
$('#mvTake').addEventListener('click',async()=>{
  if(!take)return;
  const G=routineOn()?songGrid(routineSong()):liveGrid();
  try{const id=await handOff('take',take.blob,'Riddim Swap take '+new Date().toISOString().slice(0,16).replace('T',' ')+'.'+take.ext,{songBpm:G&&G.bpm||null});goMirror(id)}
  catch(e){saveMsg('Couldn’t open the take in Body ('+(e&&e.message||e)+').',true)}
});

/* ---------- dance hits (motion beats) ---------- */
let ANALYZE_RATE=1;   /* normal speed: at 2x, phones and browsers skip frames and hits get missed */
function analyzeVideo(n,onProg){
  return new Promise(resolve=>{
    if(!n||!n.url||n.missing){resolve(null);return}
    const ve=document.createElement('video'); ve.muted=true; ve.setAttribute('playsinline',''); ve.preload='auto';
    ve.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.append(ve); ve.src=n.url;
    const cvs=document.createElement('canvas'), c2=cvs.getContext('2d',{willReadFrequently:true});
    let W=80,H=80,prev=null,series=[],done=false,lastT=-1;
    const finish=()=>{if(done)return;done=true;try{ve.pause()}catch(e){}ve.remove();
      let res=null;try{res=series.length>10?RA.analyzeMotionVecs(series,W,H):null}catch(e){res=null}
      series=[];prev=null;try{ve.removeAttribute('src');ve.load()}catch(e){}   /* free the frames and the decoder before anything else plays */
      resolve(res)};
    const grab=t=>{
      if(t<=lastT+0.001)return; lastT=t;
      c2.drawImage(ve,0,0,W,H); const d=c2.getImageData(0,0,W,H).data, g=new Uint8Array(W*H);
      for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;
      if(prev){const fv=RA.flowVecs(prev,g,W,H,8),pk=new Float32Array(fv.length*4);fv.forEach((q,i)=>{pk[4*i]=q[0];pk[4*i+1]=q[1];pk[4*i+2]=q[2];pk[4*i+3]=q[3]});series.push({t,p:pk})}
      prev=g; if(onProg&&ve.duration)onProg(Math.min(1,t/ve.duration));
    };
    ve.addEventListener('loadedmetadata',()=>{
      const vw=ve.videoWidth||16,vh=ve.videoHeight||9; W=112; H=Math.max(56,Math.min(200,Math.round(112*vh/vw)));
      cvs.width=W; cvs.height=H; ve.playbackRate=window.__rsRate||ANALYZE_RATE;
      const p=ve.play(); if(p)p.catch(()=>finish());
      if(ve.requestVideoFrameCallback){const cb=(now,meta)=>{if(done)return;grab(meta.mediaTime);ve.requestVideoFrameCallback(cb)};ve.requestVideoFrameCallback(cb)}
      else{const poll=()=>{if(done)return;grab(ve.currentTime);requestAnimationFrame(poll)};requestAnimationFrame(poll)}
    });
    ve.addEventListener('ended',finish); ve.addEventListener('error',finish);
    setTimeout(finish,600000);
  });
}
async function findHits(n){
  if(!n||S.analyzing)return null;
  S.analyzing=true; enable(); $('#danceProg').hidden=false; const bar=$('#danceProg i'); bar.style.width='0';
  $('#danceInfo').textContent='Finding hits in '+n.name+'… (plays through it once, silently)';
  const res=await analyzeVideo(n,p=>{bar.style.width=Math.round(p*100)+'%'});
  S.analyzing=false; $('#danceProg').hidden=true;
  if(res){n.motion=res; if(n.id===S.cur&&(!S.dBase||S.danceSrc!=='tapped')){S.dBase=+res.bpm.toFixed(1);S.danceSrc='detected';$('#dBpm').value=S.dBase.toFixed(1)}}
  enable(); renderMoves(); updateMatch(); scheduleFit();
  if(!res)$('#danceInfo').textContent="Couldn't read frames from this video.";
  return res;
}
$('#danceAnalyze').addEventListener('click',()=>findHits(srcById(S.cur)));
function renderDance(){
  const n=srcById(S.cur), info=$('#danceInfo'), w=$('#danceWarn');
  if(S.analyzing)return; w.textContent='';
  {const B=n&&bodyOf(n),cp=n&&cpOf(n);if(!S.bodyBusy)$('#bodyInfo').textContent=S.bodyErr&&cp?S.bodyErr:cp?`Tracking stopped at ${cp.pct}% last time. Carry on tracking picks up from there (Start over tracks the whole clip again).`:!B&&S.bodyErr?S.bodyErr:B?bodyInfoText(n,B)+(n.motion&&n.motion.source==='pose'?' Hits come from the body.':''):'Track body follows the dancer on every frame (pelvis, hips, feet and hands) and draws it over the video. It plays the clip through once, silently.'}
  $('#hitRow').hidden=true; $('#hitLevelRow').hidden=true;
  if(!n){info.textContent='Add a dance video first.';return}
  $('#danceAnalyze').textContent=n.motion?'Find again':'Find hits';
  if(!n.motion){info.textContent='Finds the moments the dancer hits: sharp stops and changes of direction. They show as blue ticks under the video, next to the song’s beats in orange.';return}
  const m=n.motion; info.textContent=m.beats.length+' hits found in '+n.name+' · dance tempo about '+m.bpm.toFixed(0)+' BPM'+(m.confirmed?' · checked by your taps ✓':danceSure()?'':' · not sure')+'.';
  $('#hitRow').hidden=false; $('#hitLevelRow').hidden=false;
  const shown=hitsOf(n); info.textContent=shown.length+' hits in '+n.name+(m.confirmed?' · checked by your taps ✓':danceSure()?'':' · not sure')+'.'+(m.edited?' Includes your own edits.':'')+' Tap a blue tick under the video to remove it.';
  const warn=t=>w.append(el('li',null,t));
  if(m.source!=='pose'&&m.contrast<0.6)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');
  if((m.shake||0)>=0.6)warn('The camera shakes, which makes stops hard to tell from wobble. Hits from this clip are less reliable: prop the phone up if you can.');
  else if(m.cam>0.8)warn('The camera moves a lot. Camera motion is removed, but strong pans can hide hits.');
  if(m.beats.length<4)warn('Very few hits found. Try a clip where the dancer fills more of the frame.');
  if(m.source==='pose'){if((m.seen??1)<0.8)warn('The dancer was only found on '+Math.round((m.seen||0)*100)+'% of frames (out of shot, covered, or several people), so some hits may be missing.');
    warn('Hits come from body tracking (stops and turns of the hips, feet and hands). Fast spins or a second dancer in front can still confuse it, so check them or mark your own.')}
  else warn('Hits come from image motion, not body tracking: footwork hidden from the camera or below the frame can be missed. Track body for better hits.');
}
$('#dTap').addEventListener('click',()=>{S.danceSrc='tapped'});
$('#dBpm').addEventListener('input',()=>{S.danceSrc='tapped'});

/* ---------- fit scoring ---------- */
function motionIn(srcId,s,e){const n=srcById(srcId);return n&&n.motion?hitsOf(n).filter(b=>b.t>=s-0.001&&b.t<=e+0.001):null}
/* score a list of pieces against a song grid. Everything compared in playback seconds. */
function fitOf(list,G,offset,ar,shift){
  if(!G||!list.length)return null;
  /* targets: every beat and every "and" (half-beat), as alignment uses */
  const tg=[];for(let i=0;i<G.beats.length;i++){tg.push(G.beats[i]);if(i<G.beats.length-1)tg.push((G.beats[i]+G.beats[i+1])/2)}
  const beatsOut=tg.map(b=>(b-offset-(shift||0))/ar).sort((p,q)=>p-q);
  let T=0, all=[], per=[], missing=false;
  for(const g of list){
    const mb=motionIn(g.src,g.s,g.e);
    if(!mb){per.push(null);missing=true;T+=segLen(g);continue}
    const pts=mb.map(b=>({t:T+toOut(g,b.t),w:b.w}));
    per.push(pts.length?RA.score(pts,beatsOut,0.05):null); all=all.concat(pts); T+=segLen(g);
  }
  return {all:all.length?RA.score(all,beatsOut,0.05):null,per,missing};
}
const pct=x=>x==null?'—':Math.round(x*100)+'%';
const fitClass=x=>x==null?'idle':x>=0.6?'ok':x>=0.35?'warn':'bad';
let fitQueued=false;
function scheduleFit(){if(fitQueued)return;fitQueued=true;requestAnimationFrame(()=>{fitQueued=false;refreshFit()})}
function refreshFit(){
  /* routine card */
  const card=$('#fitCard'); card.hidden=!S.seq.length;
  if(S.seq.length){
    const rs=routineSong(), G=songGrid(rs), off=S.rt.offset, ar=S.rt.ar;
    const now=S.seq.map(x=>segOf(x)).filter(Boolean), cst=S.seq.map(x=>segOf(x,true)).filter(Boolean);
    const hasWarp=S.seq.some(x=>x.warp&&Math.abs((x.warpR||0)-rateOf(x))<1e-6&&Math.abs(x.warp[0][0]-x.s)<1e-3&&Math.abs(x.warp[x.warp.length-1][0]-x.e)<1e-3);
    const alignedList=hasWarp?S.seq.map(x=>{const g=segOf(x,true);if(g&&x.warp&&Math.abs((x.warpR||0)-rateOf(x))<1e-6)g.k=x.warp;return g}).filter(Boolean):null;
    const fNow=fitOf(now,G,off,ar,0), fC=fitOf(cst,G,off,ar,0), fA=alignedList?fitOf(alignedList,G,off,ar,0):null, fO=G?fitOf(alignedList||now,G,off,ar,15/G.bpm):null;
    const show=(id,f)=>{$('#'+id).textContent=f&&f.all?pct(f.all.bas):'—';const e=$('#'+id+'Err');if(e)e.textContent=f&&f.all?'±'+Math.round(f.all.errMs)+' ms':' '};
    show('fitNow',fNow); show('fitConst',fC); show('fitAligned',fA); $('#fitOff').textContent=fO&&fO.all?pct(fO.all.bas):'—';
    const on=S.rt.alignOn===true; $('#alignOn').setAttribute('aria-pressed',on); $('#alignOff').setAttribute('aria-pressed',!on); $('#alignOn').disabled=!hasWarp;
    $('#maxStretchOut').textContent='±'+Math.round((S.rt.maxStretch||0.2)*100)+'%'; if(document.activeElement!==$('#maxStretch'))$('#maxStretch').value=Math.round((S.rt.maxStretch||0.2)*100);
    S.fitPer=fNow?fNow.per:[];
    $$('[data-fit]').forEach(c=>{const p=S.fitPer[+c.dataset.fit];c.hidden=!p;if(p){c.className='chipfit '+fitClass(p.bas);c.textContent=pct(p.bas)}});
    const msg=$('#fitMsg');
    if(!G)msg.textContent='Add the routine song so the beat can be found (Song tab).';
    else if(fNow&&fNow.missing)msg.textContent='Some videos have no dance hits yet. Align finds them first.';
    else if(!msg.dataset.keep)msg.textContent='';
    drawSeqCanvas(now,G,off,ar);
  }
  /* clip: Tempo tab line */
  const cf=$('#clipFit');
  if(S.hasV&&!routineOn()){
    const g=segs()[0]||{src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}, f=fitOf([g],liveGrid(),S.offset,S.ar,0);
    cf.textContent=f&&f.all?'Beat fit for this clip: '+pct(f.all.bas)+' · hits miss by about '+Math.round(f.all.errMs)+' ms':(srcById(S.cur)&&srcById(S.cur).motion?'':'Find dance hits (Clip tab) to see how well this clip fits the beat.');
  } else cf.textContent='';
  drawHitStrip(); suggestSpeed();
}
/* Try clip speeds from 60% to 160% (and nudging the song start by under half a beat) and keep the ones where the
   dance hits land closest to beats and "ands". Slight preference for speeds near 100%. */
function bestSpeeds(n,G){
  const H=hitsOf(n).filter(b=>b.t>=S.cIn&&b.t<=clipEnd());
  if(!G||H.length<4)return null;
  const tg=[];for(let i=0;i<G.beats.length;i++){tg.push(G.beats[i]);if(i<G.beats.length-1)tg.push((G.beats[i]+G.beats[i+1])/2)}
  const per=60/G.bpm, half=per/2, res=[];
  for(let vr=0.6;vr<=1.6001;vr+=0.005){
    let best=-1,bs=0;
    for(let sh=0;sh<half;sh+=0.01){let sc=0,ws=0;for(const b of H){const st=S.offset+((b.t-S.cIn)/vr)*S.ar+sh,d=RA.nearest(tg,st);sc+=b.w*Math.exp(-d*d/(2*0.05*0.05));ws+=b.w}sc/=ws;if(sc>best){best=sc;bs=sh}}
    res.push({vr:+vr.toFixed(3),fit:best,sh:bs,score:best*Math.exp(-Math.pow(Math.log(vr),2)/(2*0.5*0.5))});
  }
  res.sort((a,b)=>b.score-a.score);
  const pick=[];for(const r of res){if(pick.every(p=>Math.abs(Math.log(r.vr/p.vr))>0.1))pick.push(r);if(pick.length>=2)break}
  const now=res.find(r=>Math.abs(r.vr-S.vr)<0.003);
  return {pick,now};
}
let speedMemo={};
function suggestSpeed(){
  const box=$('#speedSug');
  if(S.playing||S.rec)return;   /* the search takes a few ms: never during playback or recording */
  const n=srcById(S.cur), G=liveGrid();
  if(!S.hasV||routineOn()||!n||!n.motion||!G){box.hidden=true;box.dataset.sig='';return}
  const key=[n.id,hitsOf(n).length,S.hitLevel,S.cIn,clipEnd(),S.vr,S.offset,S.ar,G.bpm,G.beats.length].join('|');
  const r=speedMemo.key===key?speedMemo.r:(speedMemo={key,r:bestSpeeds(n,G)}).r;
  if(!r||!r.pick.length){box.hidden=true;box.dataset.sig='';return}
  /* only rebuild when the suggestion changes, so a tap never lands on a button that was just replaced */
  const sig=r.pick.map(p=>p.vr+':'+Math.round(p.fit*100)+':'+p.sh.toFixed(2)).join('|')+'@'+S.vr.toFixed(3)+':'+S.offset.toFixed(3);
  if(box.dataset.sig===sig&&!box.hidden)return; box.dataset.sig=sig; box.textContent='';
  box.hidden=false;
  for(const p of r.pick){
    if(Math.abs(p.vr-S.vr)<0.01&&p.sh<0.02){box.append(el('span','hint','✓ '+Math.round(p.vr*100)+'% speed is already the best fit ('+Math.round(p.fit*100)+'%).'));continue}
    const b=el('button','btn sm',Math.round(p.vr*100)+'% speed · fit '+Math.round(p.fit*100)+'%');
    b.title='Sets the clip speed'+(p.sh>=0.02?' and moves the song start by '+Math.round(p.sh*1000)+' ms':'');
    b.addEventListener('click',()=>{setP(S.main,'vr',p.vr);if(p.sh>=0.02)setP(S.main,'offset',+(S.offset+p.sh).toFixed(3));scheduleFit()});
    box.append(b);
  }
  box.append(el('span','hint','Best clip speeds for this song, from where the hits land.'));
}
function tok(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||'#888'}
function sizeCanvas(c){const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h}return {w,h,dpr}}
function drawSeqCanvas(list,G,off,ar){
  const c=$('#seqCanvas'); if($('#seqBar').hidden)return; const {w,h,dpr}=sizeCanvas(c), x=c.getContext('2d'); x.clearRect(0,0,w,h);
  const tot=list.reduce((t,g)=>t+segLen(g),0)||1;
  if(G){x.fillStyle='rgba(255,255,255,.85)';const dn=new Set(G.down.map(t=>t.toFixed(3)));
    for(const b of G.beats){const o=(b-off)/ar;if(o<0||o>tot)continue;const X=o/tot*w,isD=dn.has(b.toFixed(3));x.globalAlpha=isD?0.95:0.45;x.fillRect(X-dpr*0.5,0,dpr*(isD?2:1),isD?h:h*0.45)}}
  x.globalAlpha=1; x.fillStyle=tok('--song-hot'); let T=0;
  for(const g of list){const mb=motionIn(g.src,g.s,g.e)||[];for(const b of mb){const X=(T+toOut(g,b.t))/tot*w;x.beginPath();x.arc(X,h-4*dpr,(1.5+2*b.w)*dpr,0,7);x.fill()}T+=segLen(g)}
}
function drawHitStrip(){
  const c=$('#hitStrip'); const {w,h,dpr}=sizeCanvas(c), x=c.getContext('2d'); x.clearRect(0,0,w,h);
  if(!S.hasV)return;
  const ro=segMode(), list=segs(), G=liveGrid();
  if(ro){const tot=list.reduce((t,g)=>t+segLen(g),0)||1;
    if(G){x.fillStyle=tok('--song-hot');for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0||o>tot)continue;x.fillRect(o/tot*w,0,dpr,h*0.5)}}
    x.fillStyle=tok('--dance');let T=0;for(const g of list){for(const b of motionIn(g.src,g.s,g.e)||[])x.fillRect((T+toOut(g,b.t))/tot*w,h*0.5,dpr*1.5,h*0.5);T+=segLen(g)}
    return}
  const n=srcById(S.cur), d=v.duration||0; if(!d)return;
  if(G){x.fillStyle=tok('--song-hot');const g0=segs()[0];for(const b of G.beats){const o=(b-S.offset)/S.ar;const src=g0&&g0.k?(o<0||o>segLen(g0)?-1:toSrc(g0,o)):S.cIn+o*S.vr;if(src<0||src>d)continue;x.fillRect(src/d*w,0,dpr,h*0.5)}}
  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n))x.fillRect(b.t/d*w-dpr,b.mine?h*0.25:h*0.5,dpr*2,b.mine?h*0.75:h*0.5)}
  c.classList.toggle('edit',!mark&&!!(n&&n.motion));
}
window.addEventListener('resize',scheduleFit);

/* ---------- align: time-warp each move so its hits land on beats ---------- */
function fitMsg(t){const m=$('#fitMsg');m.textContent=t||'';if(t)m.dataset.keep='1';else delete m.dataset.keep}
async function alignRoutine(){
  if(S.rec||!S.seq.length)return; pause();
  const rs=routineSong(), G=songGrid(rs);
  if(!G){fitMsg('Add the routine song first so its beat can be found.');return}
  const need=[...new Set(S.seq.map(x=>moveById(x.id)&&moveById(x.id).src))].map(srcById).filter(n=>n&&!n.motion&&!n.missing);
  const prog=$('#alignProg'), bar=$('#alignProg i');
  for(let i=0;i<need.length;i++){prog.hidden=false;fitMsg('Finding dance hits in '+need[i].name+' ('+(i+1)+'/'+need.length+')…');
    const r=await analyzeVideo(need[i],p=>{bar.style.width=Math.round(((i+p)/need.length)*100)+'%'});if(r)need[i].motion=r}
  prog.hidden=true;
  const grid=RA.grid(G.beats,G.down); let T=0, pinned=0, strong=0, maxQ=0;
  for(const x of S.seq){
    const m=moveById(x.id); if(!m)continue; const r=rateOf(x), mb=motionIn(m.src,x.s,x.e)||[];
    const S0=S.rt.offset+T*S.rt.ar;
    x.warp=RA.warpMove(mb,x.s,x.e,r,S0,S.rt.ar,grid,{maxStretch:S.rt.maxStretch||0.2}); x.warpR=r;
    for(let i=1;i<x.warp.length;i++){const q=((x.warp[i][0]-x.warp[i-1][0])/((x.warp[i][1]-x.warp[i-1][1])||1))/r;maxQ=Math.max(maxQ,Math.abs(q-1))}
    pinned+=x.warp.length-2; strong+=mb.filter(b=>b.w>=0.25).length; T+=x.warp[x.warp.length-1][1];
  }
  S.rt.alignOn=true; S.rt.set=true;
  renderMoves(); updateTrim(); refreshFit();
  fitMsg(pinned+' of '+strong+' strong hits pinned to the beat · biggest speed change ±'+Math.round(maxQ*100)+'%.'+(S.seq.length>1?' Changing a move’s trim, speed or the song start undoes its alignment; align again after editing.':''));
}
$('#alignBtn').addEventListener('click',alignRoutine);
$('#alignClear').addEventListener('click',()=>{S.seq.forEach(x=>{delete x.warp;delete x.warpR});S.rt.alignOn=false;fitMsg('');renderMoves();updateTrim();refreshFit()});
$('#alignOn').addEventListener('click',()=>{if(S.rec)return;pause();S.rt.alignOn=true;renderMoves();updateTrim();refreshFit()});
$('#alignOff').addEventListener('click',()=>{if(S.rec)return;pause();S.rt.alignOn=false;renderMoves();updateTrim();refreshFit()});
$('#maxStretch').addEventListener('input',e=>{S.rt.maxStretch=(+e.target.value)/100;S.rt.set=true;$('#maxStretchOut').textContent='±'+e.target.value+'%'});

/* ---------- recording self-check: decode the file just made and line its sound up with the song ---------- */
function encKey(){return 'rs-enccomp2-'+(aCfg&&aCfg.codec||'x')}
function encComp(){try{return +(localStorage.getItem(encKey())||0)||0}catch(e){return 0}}
async function verifyTake(blob,R){
  try{
    if(!buf)return;
    const ab=await blob.arrayBuffer(); const dec=await decodeAudio(ab);
    const SR=8000, take=dec.getChannelData(0), tsr=dec.sampleRate, song=buf.getChannelData(0), ssr=buf.sampleRate;
    const t0=0.2, t1=Math.min(4.2,dec.duration-0.3); if(t1-t0<1.2)return;
    const n=Math.floor((t1-t0)*SR), x=new Float32Array(n);
    for(let i=0;i<n;i++)x[i]=take[Math.floor((t0+i/SR)*tsr)]||0;
    const ref=lag=>{const r=new Float32Array(n);const base=R.offset;  /* compare with where the song SHOULD be, not where we told the encoder */for(let i=0;i<n;i++){const st=base+(t0+i/SR)*R.ar+lag;r[i]=song[Math.floor(st*ssr)]||0}return r};
    let best={lag:0,c:-1}; const nx=Math.hypot(...x.subarray(0,Math.min(n,4000)))>0?1:0;
    for(let ms=-250;ms<=250;ms+=2){const r=ref(ms/1000);let dot=0,a2=0,b2=0;for(let i=0;i<n;i+=2){dot+=x[i]*r[i];a2+=x[i]*x[i];b2+=r[i]*r[i]}const c=dot/Math.sqrt(a2*b2+1e-12);if(c>best.c)best={lag:ms,c}}
    for(let ms=best.lag-2;ms<=best.lag+2;ms++){const r=ref(ms/1000);let dot=0,a2=0,b2=0;for(let i=0;i<n;i++){dot+=x[i]*r[i];a2+=x[i]*x[i];b2+=r[i]*r[i]}const c=dot/Math.sqrt(a2*b2+1e-12);if(c>best.c)best={lag:ms,c}}
    const info=$('#takeInfo'); if(!nx||best.c<0.5){return}
    if(window.__rs)window.__rs.lastVerify=best;
    if(Math.abs(best.lag)<=12){info.textContent+=' · sound checked: lines up (±'+Math.abs(best.lag)+' ms)';return}
    const comp=encComp()-best.lag/1000/R.ar; try{localStorage.setItem(encKey(),String(comp))}catch(e){}
    info.textContent+=' · sound was '+Math.abs(best.lag)+' ms '+(best.lag>0?'early':'late')+' in this file; fixed for your next takes on this phone. Record again for a tight take.';
  }catch(e){}
}

/* ---------- sync check (ITU-R BT.1359: sound >45 ms early or >125 ms late is detectable) ---------- */
let syncLog=null;
function syncCheck(){
  const out=$('#syncOut'); out.hidden=false;
  if(!S.hasV||!S.hasA){out.textContent='Add a dance video and a song first.';return}
  if(S.rec)return;
  pause(); S.segIdx=0; toStart();
  const samples=[]; let checking=true; const t0=performance.now();
  allEls().forEach(e=>{if(!e.requestVideoFrameCallback)return;const f=(now,meta)=>{if(!checking)return;
    if(e===v&&S.playing&&!S.switchPending&&!a.paused&&a.readyState>=2){const L=segs(),g=L[S.segIdx];
      if(g&&meta.mediaTime>=g.s-0.01&&meta.mediaTime<=g.e+0.01){const T=segStart(S.segIdx,L)+toOut(g,meta.mediaTime);const exp=S.offset+T*S.ar;
        const lead=Math.max(0,(meta.expectedDisplayTime||performance.now())-performance.now())/1000;
        const audioAtDisplay=a.currentTime+lead*a.playbackRate;
        samples.push({t:+T.toFixed(3),ms:+(((audioAtDisplay-exp)/S.ar)*1000).toFixed(1)})}}
    e.requestVideoFrameCallback(f)};e.requestVideoFrameCallback(f)});
  play(); out.textContent='Measuring… keep the app open for 8 seconds.';
  setTimeout(()=>{
    checking=false; pause();
    const use=samples.filter(x=>x.t>0.6).map(x=>x.ms).sort((p,q)=>p-q);
    if(use.length<20){out.textContent='Not enough frames measured. Try again with the video playing.'+(allEls()[0].requestVideoFrameCallback?'':' (This browser can’t time frames.)');return}
    const q=f=>use[Math.min(use.length-1,Math.max(0,Math.round(f*(use.length-1))))];
    const med=q(0.5),p5=q(0.05),p95=q(0.95), early=Math.max(0,p95), late=Math.max(0,-p5);
    const pass=early<=45&&late<=125;
    syncLog={device:navigator.userAgent,when:new Date().toISOString(),mode:routineOn()?'routine':'clip',correction_ms:Math.round((S.avComp||0)*1000),samples,summary:{median_ms:med,p5_ms:p5,p95_ms:p95,frames:use.length,pass}};
    out.innerHTML='';
    out.append(el('b',null,pass?'In sync on this phone.':'Out of sync on this phone.'));
    out.append(document.createTextNode(' Typical offset '+(med>0?'+':'')+Math.round(med)+' ms (sound '+(med>=0?'ahead':'behind')+'); 90% of frames between '+Math.round(p5)+' and '+(p95>0?'+':'')+Math.round(p95)+' ms, from '+use.length+' frames. Limits: sound up to 45 ms early or 125 ms late (ITU-R BT.1359). Doesn’t include Bluetooth or AirPlay delay, which can add 150–250 ms. Recordings are built from the same timeline, so they line up by design. '));
    if(Math.abs(med)>15){const fx=el('button','btn sm primary','Correct for this phone');
      fx.addEventListener('click',()=>{S.avComp=clamp((S.avComp||0)-med/1000,-0.3,0.3);try{localStorage.setItem('rs-avcomp',String(S.avComp))}catch(e){}
        fx.textContent='Corrected by '+Math.round(-med)+' ms · run the check again to confirm';fx.disabled=true});out.append(fx,document.createTextNode(' '))}
    if(S.avComp){const rs=el('button','btn sm ghost','Reset correction ('+Math.round(S.avComp*1000)+' ms)');rs.addEventListener('click',()=>{S.avComp=0;try{localStorage.removeItem('rs-avcomp')}catch(e){};rs.textContent='Correction cleared'});out.append(rs,document.createTextNode(' '))}
    const sv=el('button','btn sm','Save log'); sv.addEventListener('click',async()=>{const r=await saveFile('riddim-swap-sync-'+Date.now()+'.json',JSON.stringify(syncLog,null,1),'application/json');sv.textContent=saveWords[r]||'Saved'});
    out.append(sv);
  },8000);
}
$('#syncBtn').addEventListener('click',syncCheck);

/* ---------- blind test kit ---------- */
const blindTakes={};
function recordTake(){
  return new Promise(res=>{S.takeWaiter=res;startRecording();if(!S.rec){S.takeWaiter=null;res(null)}});
}
async function makeBlind(){
  const box=$('#blindBox'); box.hidden=false; box.textContent='';
  if(!S.seq.length||!S.hasA){box.append(el('p','hint','Build a routine with a song first.'));return}
  if(!S.seq.some(x=>x.warp)){box.append(el('p','hint','Aligning the routine first…'));await alignRoutine()}
  const G=songGrid(routineSong()); if(!G){box.textContent='';box.append(el('p','hint','The song’s beat is needed first.'));return}
  if(!routineOn())setMode(true);
  const kinds=['aligned','constant','off'], letters=['A','B','C'];
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]]}
  const key={}; letters.forEach((L,i)=>key[L]=kinds[i]);
  const wasOn=S.rt.alignOn;
  for(let i=0;i<3;i++){
    box.textContent=''; box.append(el('p','hint','Recording take '+(i+1)+' of 3… keep the app open.'));
    const k=key[letters[i]];
    S.rt.alignOn=true;
    S.variant=k==='aligned'?{noWarp:false,shift:0}:k==='constant'?{noWarp:true,shift:0}:{noWarp:true,shift:15/G.bpm};
    updateTrim();
    const blob=await recordTake(); S.variant=null;
    if(blindTakes[letters[i]])URL.revokeObjectURL(blindTakes[letters[i]].url);
    blindTakes[letters[i]]=blob?{blob,url:URL.createObjectURL(blob)}:null;
    await new Promise(r=>setTimeout(r,400));
  }
  S.rt.alignOn=wasOn; updateTrim();
  S.blind={key,ratings:[],at:new Date().toISOString(),revealed:false};
  renderBlind();
}
function renderBlind(){
  const box=$('#blindBox'), B=S.blind; box.textContent=''; if(!B){box.hidden=true;return} box.hidden=false;
  box.append(el('p','hint','Show each take to dancers without saying which is which. Ask: "Is the dance on the beat?" 1 = off, 5 = locked in.'));
  const player=el('video'); player.setAttribute('playsinline',''); player.controls=true; player.hidden=true;
  const takes=el('div','takes');
  ['A','B','C'].forEach(L=>{const t=blindTakes[L];const col=el('div','field');
    const pl=el('button','btn sm','▶ Take '+L); pl.disabled=!t; pl.addEventListener('click',()=>{player.hidden=false;player.src=t.url;player.play().catch(()=>{})});
    const sv=el('button','btn sm','Save '+L); sv.disabled=!t; sv.addEventListener('click',async()=>{const r=await saveFile('take-'+L+'.mp4',t.blob,t.blob.type||'video/mp4');sv.textContent=r==='declined'?'Save '+L:'Saved'});
    col.append(pl,sv); takes.append(col)});
  if(!blindTakes.A)box.append(el('p','hint','The take videos aren’t kept after closing the app; ratings and the answer key are.'));
  box.append(takes,player);
  /* ratings */
  const form=el('div','row'); const nm=el('input'); nm.type='text'; nm.placeholder='Dancer'; nm.setAttribute('aria-label','Dancer name');
  const sel={}; ['A','B','C'].forEach(L=>{const s2=el('select');s2.setAttribute('aria-label','Rating for take '+L);s2.append(el('option',null,L+' –'));for(let i=1;i<=5;i++){const o=el('option',null,L+' '+i);o.value=i;s2.append(o)}sel[L]=s2;form.append(s2)});
  const add=el('button','btn sm','Add rating'); add.addEventListener('click',()=>{const r={name:nm.value.trim()||('Dancer '+(B.ratings.length+1))};let ok=true;['A','B','C'].forEach(L=>{const v2=+sel[L].value;if(!v2)ok=false;r[L]=v2});if(!ok)return;B.ratings.push(r);renderBlind()});
  form.prepend(nm); form.append(add); box.append(form);
  if(B.ratings.length){
    const wrap=el('div','tblwrap'),tb=el('table'),hd=el('tr');['Dancer','A','B','C'].forEach((h,i)=>{const th=el('th',i?'num':null,h);hd.append(th)});tb.append(hd);
    B.ratings.forEach(r=>{const tr=el('tr');tr.append(el('td',null,r.name));['A','B','C'].forEach(L=>tr.append(el('td','num',String(r[L]))));tb.append(tr)});
    wrap.append(tb); box.append(wrap);
  }
  const rv=el('button','btn sm',B.revealed?'Hide answers':'Reveal answers'); rv.addEventListener('click',()=>{B.revealed=!B.revealed;renderBlind()});
  const ex=el('button','btn sm ghost','Save results'); ex.disabled=!B.ratings.length;
  ex.addEventListener('click',async()=>{const lines=['dancer,take,version,rating'];B.ratings.forEach(r=>['A','B','C'].forEach(L=>lines.push([JSON.stringify(r.name),L,B.key[L],r[L]].join(','))));const res=await saveFile('blind-test-results.csv',lines.join('\n'),'text/csv');ex.textContent=saveWords[res]||'Saved'});
  const again=el('button','btn sm ghost','New test'); again.addEventListener('click',makeBlind);
  const row=el('div','row'); row.append(rv,ex,again); box.append(row);
  if(B.revealed){
    const names={aligned:'Aligned',constant:'Constant speed',off:'Deliberately off'};
    const mean=k=>{const L=Object.keys(B.key).find(x=>B.key[x]===k);const v2=B.ratings.map(r=>r[L]);return v2.length?v2.reduce((p,q)=>p+q,0)/v2.length:null};
    const ul=el('ul',null); ['A','B','C'].forEach(L=>{const m=mean(B.key[L]);ul.append(el('li',null,'Take '+L+' = '+names[B.key[L]]+(m!=null?' · average '+m.toFixed(1)+' / 5':'')))});
    box.append(ul);
    if(B.ratings.length){const mo=mean('off'),ma=mean('aligned'),mc=mean('constant');
      box.append(el('p','hint',mo<Math.min(ma,mc)?'The deliberately-off take was rated lowest, so these dancers can hear timing and their ratings of the other two mean something.'+(ma>mc?' They rated the aligned version highest.':' They did not rate the aligned version highest.'):'The deliberately-off take was NOT rated lowest, so these ratings can’t tell the versions apart. Try more dancers, or a routine with clearer hits.'))}
  }
}
$('#blindBtn').addEventListener('click',makeBlind);


/* ---------- speed graph ----------
   A curve of speed (×, log scale, ¼× to 4×) over the clip's own time. Points have Bezier handles (in seconds and
   log2-speed). It multiplies the clip speed. It becomes the time map the player already follows. */
const SPD={min:-2,max:2,sel:-1,undo:[],cache:null,ver:0,drag:null,lastTap:null,zoom:1,vc:null,snap:true,guide:null};
try{const z=JSON.parse(localStorage.getItem('rs-spd')||'{}');if(z.snap===false)SPD.snap=false}catch(e){}
function curveOf(n){return n&&n.curve&&n.curve.on&&n.curve.pts&&n.curve.pts.length?n.curve:null}
function spdClampH(c){
  const P=c.pts; for(let i=0;i<P.length;i++){const p=P[i];
    const L=i>0?p.t-P[i-1].t:1e9, R=i<P.length-1?P[i+1].t-p.t:1e9;
    p.hi=p.hi||[-0.3,0]; p.ho=p.ho||[0.3,0];
    p.hi[0]=clamp(p.hi[0],-Math.min(L,30),0); p.ho[0]=clamp(p.ho[0],0,Math.min(R,30));}
}
/* auto handles: Catmull-Rom tangent, one third of each side */
function spdAuto(c,i){
  const P=c.pts,p=P[i],a=P[i-1],b=P[i+1];
  let m=0; if(a&&b)m=(b.y-a.y)/((b.t-a.t)||1);
  /* a peak or dip stays flat so it doesn't overshoot */
  if(a&&b&&((p.y>=a.y&&p.y>=b.y)||(p.y<=a.y&&p.y<=b.y)))m=0;
  const L=a?(p.t-a.t)/3:0.3, R=b?(b.t-p.t)/3:0.3;
  p.hi=[-L,-m*L]; p.ho=[R,m*R];
}
function spdAutoAll(c){c.pts.forEach((p,i)=>{if(p.auto!==false)spdAuto(c,i)});spdClampH(c)}
/* sample the curve: a polyline [[t,y]...] */
function spdPoly(c){
  const P=c.pts, out=[];
  P.forEach((q,i)=>{if(!Array.isArray(q.hi)||!Array.isArray(q.ho)||!isFinite(q.t)||!isFinite(q.y)){q.t=+q.t||0;q.y=clamp(+q.y||0,SPD.min,SPD.max);spdAuto(c,i)}});
  spdClampH(c);
  if(P.length===1)return [[P[0].t,P[0].y]];
  for(let i=0;i<P.length-1;i++){const p=P[i],q=P[i+1];
    const x0=p.t,y0=p.y,x1=p.t+p.ho[0],y1=p.y+p.ho[1],x2=q.t+q.hi[0],y2=q.y+q.hi[1],x3=q.t,y3=q.y;
    const N=40; for(let k=(i?1:0);k<=N;k++){const u=k/N,w=1-u;
      out.push([w*w*w*x0+3*w*w*u*x1+3*w*u*u*x2+u*u*u*x3, clamp(w*w*w*y0+3*w*w*u*y1+3*w*u*u*y2+u*u*u*y3,SPD.min,SPD.max)])}}
  return out;
}
function spdPolyOf(c){const key=SPD.ver+':'+JSON.stringify(c.pts);if(SPD.cache&&SPD.cache.key===key)return SPD.cache.poly;const poly=spdPoly(c);SPD.cache={key,poly};return poly}
/* log2 speed multiplier at clip time t */
function spdY(c,t){
  const L=spdPolyOf(c); if(!L.length)return 0;
  if(t<=L[0][0])return L[0][1]; if(t>=L[L.length-1][0])return L[L.length-1][1];
  let lo=0,hi=L.length-1; while(hi-lo>1){const m=(lo+hi)>>1;if(L[m][0]<=t)lo=m;else hi=m}
  const a=L[lo],b=L[hi]; return a[1]+(t-a[0])*(b[1]-a[1])/((b[0]-a[0])||1);
}
function spdRateAt(c,t,vr){return clamp((vr||1)*Math.pow(2,spdY(c,t)),0.2,4)}
/* the time map for playback: knots every 1/40 s of clip time, plus every point */
let knotMemo=null;
function curveKnots(n,g){
  const c=curveOf(n); if(!c||!(g.e>g.s))return null;
  const key=n.id+'|'+g.s+'|'+g.e+'|'+g.r+'|'+JSON.stringify(c.pts);
  if(!(knotMemo instanceof Map))knotMemo=new Map(); if(knotMemo.has(key))return knotMemo.get(key);
  const ts=new Set(); const step=1/40; for(let t=g.s;t<g.e;t+=step)ts.add(+t.toFixed(4)); ts.add(g.e);
  c.pts.forEach(p=>{if(p.t>g.s&&p.t<g.e)ts.add(+p.t.toFixed(4))});
  const T=[...ts].sort((a,b)=>a-b), k=[[T[0],0]]; let o=0;
  for(let i=1;i<T.length;i++){const a=T[i-1],b=T[i];o+=(b-a)/spdRateAt(c,(a+b)/2,g.r);k.push([b,o])}
  if(knotMemo.size>64)knotMemo.clear(); knotMemo.set(key,k); return k;
}
function spdCur(){return srcById(S.cur)}
function spdEnsure(n){if(!n.curve)n.curve={on:false,pts:[]};return n.curve}
function spdPush(){const n=spdCur();if(!n||!n.curve)return;SPD.undo.push(JSON.stringify(n.curve));if(SPD.undo.length>40)SPD.undo.shift();$('#spdUndo').disabled=false}
function spdChanged(){SPD.ver++;knotMemo=null;if(S.playing)syncSong(true);drawHitStrip();scheduleFit();spdDraw();spdUI()}
function spdSetPts(pts){const n=spdCur();if(!n)return;const c=spdEnsure(n);c.pts=pts.sort((a,b)=>a.t-b.t);spdAutoAll(c);spdChanged()}
/* geometry */
function spdGeo(){
  const cv=$('#spdCanvas'),{w,h,dpr}=sizeCanvas(cv);
  const pad={l:44*dpr,r:14*dpr,t:36*dpr,b:22*dpr};
  const s=S.cIn,e=clipEnd()||1;
  /* zoomed in: a window of the clip around SPD.vc (the selected point or the playhead) */
  const z=SPD.zoom||1,W=(e-s)/z,c=SPD.vc!=null?SPD.vc:(s+e)/2,vs=z>1?clamp(c-W/2,s,Math.max(s,e-W)):s,ve=z>1?vs+W:e;
  return {cv,w,h,dpr,pad,s,e,vs,ve,
    X:t=>pad.l+(t-vs)/((ve-vs)||1)*(w-pad.l-pad.r),
    T:x=>vs+(x-pad.l)/((w-pad.l-pad.r)||1)*(ve-vs),
    Y:y=>pad.t+(SPD.max-y)/(SPD.max-SPD.min)*(h-pad.t-pad.b),
    V:py=>SPD.max-(py-pad.t)/((h-pad.t-pad.b)||1)*(SPD.max-SPD.min)};
}
const spdLabel=y=>{const r=Math.pow(2,y);return (r>=0.995&&r<=1.005?'1':r.toFixed(2))+'×'};
/* where a point can snap: the dance hits, and the song's beats where they land with this curve; speeds: ½× ¾× 1× 1¼× 1½× 2× */
const SPD_SNAP_Y=[0.5,0.75,1,1.25,1.5,2].map(r=>Math.log2(r));
function spdSnapTimes(){const n=spdCur(),out=[];if(n&&n.motion)for(const b of hitsOf(n))out.push({t:b.t,kind:'hit'});
  const G=liveGrid(),g0=segs()[0];if(G&&g0&&!routineOn()){const tot=segLen(g0);for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0||o>tot)continue;out.push({t:toSrc(g0,o),kind:'beat'})}}
  return out}
function spdFollow(t){if((SPD.zoom||1)<=1)return;const G=spdGeo();if(t<G.vs+(G.ve-G.vs)*0.08||t>G.ve-(G.ve-G.vs)*0.08)SPD.vc=t}
window.__rsSPD=SPD;SPD.geo=()=>spdGeo();SPD.snapTimes=()=>spdSnapTimes();
function spdSave(){try{localStorage.setItem('rs-spd',JSON.stringify({snap:SPD.snap}))}catch(e){}}
function spdVisible(){const p=$('#p-clip');return S.hasV&&p&&!p.hidden&&$('#spdCard').offsetParent!==null}
function spdDraw(){
  if(!spdVisible())return;
  const G0=spdGeo(),{cv,w,h,dpr,pad,X,Y,vs,ve}=G0,s=vs,e=ve,x=cv.getContext('2d'); x.clearRect(0,0,w,h);
  const n=spdCur(), c=n&&n.curve&&n.curve.pts&&n.curve.pts.length?n.curve:null, on=!!curveOf(n);
  /* top strip: where you drag to move through the clip */
  x.fillStyle='#1C2028'; x.fillRect(0,0,w,pad.t-12*dpr);
  /* grid: ¼× ½× 1× 2× 4× */
  x.font=`700 ${12*dpr}px Figtree,sans-serif`; x.textBaseline='middle'; x.textAlign='right';
  [[-2,'¼×'],[-1,'½×'],[0,'1×'],[1,'2×'],[2,'4×']].forEach(([y,l])=>{const py=Y(y);x.strokeStyle=y===0?'#3A4152':'#262B35';x.lineWidth=(y===0?1.5:1)*dpr;x.beginPath();x.moveTo(pad.l,py);x.lineTo(w-pad.r,py);x.stroke();x.fillStyle=y===0?'#F3F1EC':'#7C8494';x.fillText(l,pad.l-8*dpr,py)});
  x.textAlign='right'; x.fillStyle='#7C8494'; x.font=`700 ${10*dpr}px Figtree,sans-serif`; x.fillText('FASTER ↑',w-pad.r-4*dpr,pad.t+10*dpr); x.fillText('SLOWER ↓',w-pad.r-4*dpr,h-pad.b-10*dpr);
  /* seconds along the bottom */
  x.fillStyle='#7C8494'; x.font=`500 ${10*dpr}px JetBrains Mono,monospace`; x.textAlign='center';
  const span=e-s, stepS=span>40?10:span>16?5:span>6?2:span>2.5?1:span>1.2?0.5:0.25;
  for(let t=Math.ceil(s/stepS-1e-6)*stepS;t<=e+1e-6;t+=stepS){const px=X(t);x.fillRect(px,h-pad.b,dpr,4*dpr);x.fillText((stepS<1?t.toFixed(stepS<0.5?2:1):t.toFixed(0))+'s',px,h-pad.b+12*dpr)}
  /* snap guides while dragging */
  if(SPD.guide){x.save();x.setLineDash([4*dpr,4*dpr]);x.lineWidth=1.5*dpr;
    if(SPD.guide.t!=null){x.strokeStyle=SPD.guide.kind==='beat'?tok('--song-hot'):tok('--dance');x.beginPath();x.moveTo(X(SPD.guide.t),pad.t);x.lineTo(X(SPD.guide.t),h-pad.b);x.stroke()}
    if(SPD.guide.y!=null){x.strokeStyle='#FFD43B';x.beginPath();x.moveTo(pad.l,Y(SPD.guide.y));x.lineTo(w-pad.r,Y(SPD.guide.y));x.stroke()}
    x.restore()}
  /* dance hits (blue, bottom) and song beats where they land with this curve (orange, top) */
  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n)){if(b.t<s||b.t>e)continue;x.fillRect(X(b.t)-dpr,h-pad.b-10*dpr,2*dpr,10*dpr)}}
  const G=liveGrid(), g0=segs()[0];
  if(G&&g0&&!routineOn()){x.fillStyle=tok('--song-hot');const tot=segLen(g0);for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0||o>tot)continue;const t=toSrc(g0,o);x.fillRect(X(t)-dpr*0.75,pad.t-24*dpr,1.5*dpr,10*dpr)}}
  /* the curve */
  x.lineJoin='round'; x.lineCap='round';
  if(c){x.strokeStyle=on?'#F3F1EC':'#7C8494';x.lineWidth=3*dpr;x.beginPath();
    for(let px=pad.l;px<=w-pad.r+0.5;px+=2*dpr){const py=Y(spdY(c,G0.T(px)));if(px===pad.l)x.moveTo(px,py);else x.lineTo(px,py)}x.stroke();
    /* handles of the selected point */
    const p=c.pts[SPD.sel];
    if(p){x.strokeStyle='#FFD43B';x.lineWidth=1.5*dpr;x.fillStyle='#FFD43B';
      for(const hd of [p.hi,p.ho]){const hx=X(p.t+hd[0]),hy=Y(clamp(p.y+hd[1],SPD.min-1,SPD.max+1));x.beginPath();x.moveTo(X(p.t),Y(p.y));x.lineTo(hx,hy);x.stroke();x.beginPath();x.arc(hx,hy,5*dpr,0,7);x.fill()}}
    /* points are little cogs, turned by their speed (one turn per doubling, as the big cog turns) */
    c.pts.forEach((q,i)=>{if(q.t<s-0.01||q.t>e+0.01)return;const px=X(q.t),py=Y(q.y),r=(i===SPD.sel?12:9)*dpr;
      x.fillStyle=i===SPD.sel?'#FFD43B':'#14171D';x.strokeStyle='#FFD43B';x.lineWidth=2*dpr;cogPath(x,px,py,r,q.y*2*Math.PI);x.fill();x.stroke();
      x.fillStyle=i===SPD.sel?'#14171D':'#FFD43B';x.beginPath();x.arc(px,py,r*0.28,0,7);x.fill()});
    /* while dragging: where the point is, in a label up and away from your finger */
    const sp=c.pts[SPD.sel];if(sp&&SPD.drag&&SPD.drag.type==='point'&&SPD.drag.moved){const txt=fmt2(sp.t)+' · '+spdLabel(sp.y)+(SPD.guide&&SPD.guide.kind?' · on '+SPD.guide.kind:'');
      x.font=`800 ${13*dpr}px Figtree,sans-serif`;const tw=x.measureText(txt).width+16*dpr,bx=clamp(X(sp.t)-tw/2,4*dpr,w-tw-4*dpr),by=Math.max(2*dpr,Y(sp.y)-56*dpr);
      x.fillStyle='rgba(8,9,12,.92)';x.strokeStyle='#FFD43B';x.lineWidth=1.5*dpr;x.beginPath();x.roundRect?x.roundRect(bx,by,tw,24*dpr,8*dpr):x.rect(bx,by,tw,24*dpr);x.fill();x.stroke();
      x.fillStyle='#F3F1EC';x.textAlign='left';x.textBaseline='middle';x.fillText(txt,bx+8*dpr,by+12*dpr)}
  } else {x.strokeStyle='#7C8494';x.lineWidth=3*dpr;x.setLineDash([2*dpr,7*dpr]);x.beginPath();x.moveTo(pad.l,Y(0));x.lineTo(w-pad.r,Y(0));x.stroke();x.setLineDash([])}
  /* playhead */
  const t=v.currentTime; if(t>=s-0.01&&t<=e+0.01){const px=X(clamp(t,s,e));x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;x.beginPath();x.moveTo(px,0);x.lineTo(px,h-pad.b);x.stroke();
    x.fillStyle=tok('--dance');x.beginPath();x.moveTo(px-6*dpr,0);x.lineTo(px+6*dpr,0);x.lineTo(px,8*dpr);x.fill()}
}
function spdUI(){
  const n=spdCur(), c=n&&n.curve, on=!!curveOf(n), ro=routineOn();
  $('#spdOn').checked=!!(c&&c.on); $('#spdOnTxt').textContent=c&&c.on?'On':'Off'; $('#spdOn').disabled=!S.hasV||ro;
  $('#spdCard').classList.toggle('off',!on);
  $$('[data-spd]').forEach(b=>b.disabled=!S.hasV||ro);
  $('#spdDel').disabled=!(c&&c.pts&&c.pts[SPD.sel])||ro; $('#spdSmooth').disabled=$('#spdDel').disabled||!(c.pts[SPD.sel]&&c.pts[SPD.sel].auto===false);
  $('#spdUndo').disabled=!SPD.undo.length||ro;
  $('#spdZoomTxt').textContent=(SPD.zoom||1)+'×';$('#spdZoomOut').disabled=(SPD.zoom||1)<=1||!S.hasV;$('#spdZoomIn').disabled=(SPD.zoom||1)>=16||!S.hasV;
  $('#spdSnap').setAttribute('aria-pressed',String(SPD.snap));
  const sp=c&&c.pts&&c.pts[SPD.sel];$('#spdPt').hidden=!sp||ro;
  if(sp)$('#spdPtTxt').textContent=`Point ${SPD.sel+1} of ${c.pts.length}: ${fmt2(sp.t)} · ${spdLabel(sp.y)}`;
  if(sp)cogDraw();
  const g=segs()[0], base=S.hasV&&!ro?(clipEnd()-S.cIn)/(S.vr||1):0;
  $('#spdLen').textContent=S.hasV&&!ro&&g?(on?fmt(base)+' → '+fmt(segLen(g)):fmt(base)):'—';
  $('#spdNote').textContent=ro?'The speed graph works on the whole clip. Switch to "Clip" under the video to use it.':'Tap the graph to add a point, drag a point to move it (it snaps to hits, beats and round speeds), and use the buttons below for small steps. Zoom with + or two fingers. Blue ticks: dance hits; orange: song beats.';
}
function spdNowText(){const n=spdCur(),c=curveOf(n);const r=c&&!routineOn()?spdRateAt(c,v.currentTime,S.vr):(routineOn()?curRate():S.vr);$('#spdNow').textContent=r.toFixed(2)+'×'}
/* presets */
function spdPreset(kind){
  const n=spdCur(); if(!n||!S.hasV)return; const c=spdEnsure(n); spdPush();
  const s=S.cIn,e=clipEnd(),d=e-s,t=clamp(v.currentTime,s,e);
  let pts;
  if(kind==='flat')pts=[{t:s,y:0},{t:e,y:0}];
  else if(kind==='up')pts=[{t:s,y:-1},{t:e,y:1}];
  else if(kind==='down')pts=[{t:s,y:1},{t:e,y:-1}];
  else {const w=Math.min(0.6,d/4);pts=[{t:s,y:0},{t:Math.max(s,t-w),y:0},{t,y:-1.6},{t:Math.min(e,t+w),y:0},{t:e,y:0}].filter((p,i,A)=>i===0||p.t-A[i-1].t>0.02)}
  c.on=true; SPD.sel=kind==='slowmo'?pts.findIndex(p=>p.y<-1):-1; spdSetPts(pts.map(p=>({...p,auto:true})));
}
$$('[data-spd]').forEach(b=>b.addEventListener('click',()=>spdPreset(b.dataset.spd)));
$('#spdOn').addEventListener('change',e=>{const n=spdCur();if(!n)return;const c=spdEnsure(n);spdPush();c.on=e.target.checked;
  if(c.on&&!c.pts.length){c.pts=[{t:S.cIn,y:0,auto:true},{t:clipEnd(),y:0,auto:true}];spdAutoAll(c)}spdChanged()});
$('#spdDel').addEventListener('click',()=>{const n=spdCur();const c=n&&n.curve;if(!c||!c.pts[SPD.sel])return;spdPush();c.pts.splice(SPD.sel,1);SPD.sel=-1;spdAutoAll(c);spdChanged()});
$('#spdSmooth').addEventListener('click',()=>{const n=spdCur();const c=n&&n.curve;const p=c&&c.pts[SPD.sel];if(!p)return;spdPush();p.auto=true;spdAutoAll(c);spdChanged()});
$('#spdUndo').addEventListener('click',()=>{const n=spdCur();if(!n||!SPD.undo.length)return;n.curve=JSON.parse(SPD.undo.pop());SPD.sel=-1;spdChanged()});
/* zoom: closer in around the selected point (or the playhead) to place points precisely */
function spdZoom(k){const n=spdCur(),c=n&&n.curve,p=c&&c.pts&&c.pts[SPD.sel];const z=clamp((SPD.zoom||1)*k,1,16);
  if(z>1)SPD.vc=p?p.t:v.currentTime;SPD.zoom=z;spdDraw();spdUI()}
$('#spdZoomIn').addEventListener('click',()=>spdZoom(2));$('#spdZoomOut').addEventListener('click',()=>spdZoom(0.5));
$('#spdSnap').addEventListener('click',()=>{SPD.snap=!SPD.snap;spdSave();spdUI()});
/* the selected point, a step at a time: a frame earlier / later, 5% slower / faster, onto the nearest beat or hit */
function spdNudge(kind){const n=spdCur(),c=n&&n.curve,P=c&&c.pts,i=SPD.sel,p=P&&P[i];if(!p)return;spdPush();
  const lo=i>0?P[i-1].t+0.05:S.cIn,hi=i<P.length-1?P[i+1].t-0.05:clipEnd();
  if(kind==='t-'||kind==='t+')p.t=+clamp(p.t+(kind==='t+'?1:-1)/30,lo,Math.max(lo,hi)).toFixed(4);
  else if(kind==='y-'||kind==='y+'){const r=Math.pow(2,p.y)*(kind==='y+'?1.05:1/1.05);p.y=clamp(Math.abs(r-1)<0.012?0:Math.log2(r),SPD.min,SPD.max)}
  else if(kind==='beat'){const T=spdSnapTimes().filter(x=>x.t>=lo&&x.t<=hi);if(!T.length){$('#spdNote').textContent='No beat or hit between this point\'s neighbours.';return}
    const b=T.reduce((a,x)=>Math.abs(x.t-p.t)<Math.abs(a.t-p.t)?x:a);p.t=+b.t.toFixed(4)}
  spdFollow(p.t);spdAutoAll(c);spdChanged()}
$$('[data-sp]').forEach(b=>b.addEventListener('click',()=>spdNudge(b.dataset.sp)));
/* touch and mouse on the graph */
(function(){
  const cv=$('#spdCanvas');
  function hit(ev){
    const G=spdGeo(),r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)*G.dpr,py=(ev.clientY-r.top)*G.dpr;
    const n=spdCur(),c=n&&n.curve&&n.curve.pts&&n.curve.pts.length?n.curve:null,R=30*G.dpr;
    let what=null;
    if(c){/* nearest target wins; points count as a little nearer than handles */
      let best=R;const p=c.pts[SPD.sel];
      c.pts.forEach((q,i)=>{if(q.t<G.vs-0.01||q.t>G.ve+0.01)return;const d=Math.hypot((G.X(q.t)-px)*0.8,G.Y(q.y)-py)*0.75;if(d<best){best=d;what={type:'point',i}}});
      if(p)for(const [k,hd] of [['hi',p.hi],['ho',p.ho]]){const hx=G.X(p.t+hd[0]),hy=G.Y(clamp(p.y+hd[1],SPD.min-1,SPD.max+1));const d=Math.hypot(hx-px,hy-py);if(d<best){best=d;what={type:'handle',k}}}}
    if(!what&&py<G.pad.t-10*G.dpr)what={type:'scrub'};
    if(!what&&px>=G.pad.l-6*G.dpr)what={type:'add'};
    return {G,px,py,c,n,what};
  }
  function seekTo(G,px){if(S.playing)pause();const t=clamp(G.T(px),S.cIn,clipEnd());S.segIdx=0;v.currentTime=t;spdDraw();spdNowText()}
  const CSS=G=>G.dpr;   /* px per CSS px */
  cv.addEventListener('pointerdown',ev=>{
    if(!S.hasV||routineOn()||tch.size>=2)return;
    const H=hit(ev); if(!H.what)return; ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
    const {G,n,what}=H;
    if(what.type==='scrub'){SPD.drag={type:'scrub'};seekTo(G,H.px);return}
    const c=spdEnsure(n);
    if(what.type==='add'){SPD.drag={type:'add',x0:H.px,y0:H.py};return}   /* a point is added when the finger lifts without moving */
    if(what.type==='point'){
      const p=c.pts[what.i];SPD.sel=what.i;
      SPD.drag={type:'point',x0:H.px,y0:H.py,dt:p.t-G.T(H.px),dy:p.y-G.V(H.py),moved:false,pushed:false};spdDraw();spdUI();return;
    }
    if(what.type==='handle'){spdPush();SPD.drag={type:'handle',k:what.k};c.pts[SPD.sel].auto=false;return}
  });
  cv.addEventListener('pointermove',ev=>{
    const D=SPD.drag; if(!D||tch.size>=2)return; const G=spdGeo(),r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)*G.dpr,py=(ev.clientY-r.top)*G.dpr;
    if(D.type==='scrub'){seekTo(G,px);return}
    const n=spdCur(),c=n&&n.curve,p=c&&c.pts[SPD.sel]; if(!p)return;
    if(D.type==='point'){
      /* a few pixels of slack first, so selecting a point doesn't nudge it; then it moves with the finger, keeping the
         gap it had when grabbed (it doesn't jump under the finger), and snaps to hits, beats and round speeds */
      if(!D.moved){if(Math.hypot(px-D.x0,py-D.y0)<6*G.dpr)return;D.moved=true;if(!D.pushed){spdPush();D.pushed=true}}
      const i=SPD.sel,P=c.pts,lo=i>0?P[i-1].t+0.05:S.cIn,hi=i<P.length-1?P[i+1].t-0.05:clipEnd();
      let t=clamp(G.T(px)+D.dt,lo,Math.max(lo,hi)),y=clamp(G.V(py)+D.dy,SPD.min,SPD.max);SPD.guide=null;
      if(SPD.snap){const tol=12*G.dpr*(G.ve-G.vs)/((G.w-G.pad.l-G.pad.r)||1);let best=null;
        for(const s of spdSnapTimes()){if(s.t<lo||s.t>hi)continue;const d=Math.abs(s.t-t);if(d<tol&&(!best||d<best.d))best={...s,d}}
        if(best){t=best.t;SPD.guide={t:best.t,kind:best.kind}}
        const ytol=8*G.dpr*(SPD.max-SPD.min)/((G.h-G.pad.t-G.pad.b)||1);const ny=SPD_SNAP_Y.reduce((a,sy)=>Math.abs(y-sy)<Math.abs(y-a)?sy:a);if(Math.abs(y-ny)<ytol){y=ny;SPD.guide={...(SPD.guide||{}),y:ny}}}
      else if(Math.abs(y)<0.06)y=0;
      p.t=+t.toFixed(4);p.y=y;spdFollow(p.t);
    } else if(D.type==='add'){return} else {
      const dx=G.T(px)-p.t, dy=G.V(py)-p.y;
      if(D.k==='ho'){p.ho=[Math.max(0,dx),dy];const L=Math.hypot(p.hi[0],p.hi[1])||0.3,M=Math.hypot(p.ho[0],p.ho[1])||1;p.hi=[-p.ho[0]/M*L,-p.ho[1]/M*L]}
      else {p.hi=[Math.min(0,dx),dy];const L=Math.hypot(p.ho[0],p.ho[1])||0.3,M=Math.hypot(p.hi[0],p.hi[1])||1;p.ho=[-p.hi[0]/M*L,-p.hi[1]/M*L]}
    }
    spdAutoAll(c); spdChanged();
  });
  const end=ev=>{const D=SPD.drag;SPD.drag=null;SPD.guide=null;
    if(D&&D.type==='add'&&ev&&ev.type==='pointerup'){const G=spdGeo(),r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)*G.dpr,py=(ev.clientY-r.top)*G.dpr;
      if(Math.hypot(px-D.x0,py-D.y0)<10*G.dpr){const n=spdCur(),c=spdEnsure(n);spdPush();if(!c.pts.length)c.pts=[{t:S.cIn,y:0,auto:true},{t:clipEnd(),y:0,auto:true}];
        let t=clamp(G.T(D.x0),S.cIn,clipEnd()),y=clamp(G.V(D.y0),SPD.min,SPD.max);if(Math.abs(y)<0.08)y=0;
        if(c.pts.some(q=>Math.abs(q.t-t)<0.05))return;
        c.pts.push({t,y,auto:true});c.pts.sort((a,b)=>a.t-b.t);c.on=true;SPD.sel=c.pts.findIndex(p=>p.t===t);spdAutoAll(c);spdChanged();return}}
    spdDraw();spdUI()};
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  /* pinch to zoom (two fingers) */
  const tch=new Map();let pinch=null;
  cv.addEventListener('pointerdown',ev=>{tch.set(ev.pointerId,ev.clientX);if(tch.size===2){const [a,b]=[...tch.values()];pinch={d:Math.abs(a-b)||1,z:SPD.zoom||1};SPD.drag=null}},true);
  cv.addEventListener('pointermove',ev=>{if(!tch.has(ev.pointerId))return;tch.set(ev.pointerId,ev.clientX);if(pinch&&tch.size===2){const [a,b]=[...tch.values()];const z=clamp(pinch.z*Math.abs(a-b)/pinch.d,1,16);if(Math.abs(z-(SPD.zoom||1))>0.05){if((SPD.zoom||1)<=1&&z>1)SPD.vc=spdGeo().T(((a+b)/2-cv.getBoundingClientRect().left)*spdGeo().dpr);SPD.zoom=+z.toFixed(2);spdDraw();spdUI()}}},true);
  const up=ev=>{tch.delete(ev.pointerId);if(tch.size<2)pinch=null};cv.addEventListener('pointerup',up,true);cv.addEventListener('pointercancel',up,true);
})();
/* keep the graph, the playhead and the readout live */
let spdKey='';
(function spdLoop(){try{if(spdVisible()){const n=spdCur(),c=$('#spdCanvas').getBoundingClientRect();
  if(S.playing&&!SPD.drag)spdFollow(v.currentTime);
  const k=[SPD.ver,SPD.sel,SPD.zoom,SPD.vc,JSON.stringify(SPD.guide),n&&n.curve?JSON.stringify(n.curve):'',Math.round(c.width),Math.round(c.height),Math.round(v.currentTime*15),S.cIn,clipEnd(),S.vr,S.offset,S.ar,n&&n.motion&&hitsOf(n).length,liveGrid()&&liveGrid().beats.length].join('|');
  if(k!==spdKey){spdKey=k;spdDraw();spdNowText()}}}catch(e){}requestAnimationFrame(spdLoop)})();
setInterval(()=>{try{spdUI()}catch(e){}},500);
$('#t-clip').addEventListener('click',()=>setTimeout(()=>{spdUI();spdDraw()},0));

/* ---------- the cog: turn the selected point ----------
   Speed: clockwise is faster, one turn doubles the speed (log2 +1), clicks at the round speeds when Snap is on.
   Curve: tilts the curve through the point (its handles), clockwise slopes it down. One undo step per turn. */
const COG={mode:'speed',rot:0,drag:null,key:''};
function cogPath(x,cx,cy,r,rot){const n=8,ri=r*0.74;x.beginPath();
  for(let i=0;i<n*4;i++){const a=rot+i*Math.PI/(n*2),rr=(i%4===1||i%4===2)?r:ri;const px=cx+rr*Math.cos(a),py=cy+rr*Math.sin(a);if(i)x.lineTo(px,py);else x.moveTo(px,py)}x.closePath()}
function cogPoint(){const n=spdCur(),c=n&&n.curve,p=c&&c.pts&&c.pts[SPD.sel];return p&&!routineOn()?{n,c,p}:null}
/* the curve's tilt at a point, as an angle on screen (radians, up is positive) */
function cogScale(){const G=spdGeo();return {kx:(G.w-G.pad.l-G.pad.r)/((G.ve-G.vs)||1),ky:(G.h-G.pad.t-G.pad.b)/(SPD.max-SPD.min)}}
function cogTilt(p){const {kx,ky}=cogScale(),h=p.ho&&p.ho[0]>1e-6?p.ho:(p.hi&&p.hi[0]<-1e-6?p.hi:[1,0]);return Math.atan((h[1]/h[0])*ky/kx)}
function cogSetTilt(c,i,th){const p=c.pts[i],P=c.pts,{kx,ky}=cogScale(),m=Math.tan(clamp(th,-1.4,1.4))*kx/ky;
  const L=i<P.length-1?(P[i+1].t-p.t)/3:0.3,Lb=i>0?(p.t-P[i-1].t)/3:0.3;const ho0=p.ho&&p.ho[0]>1e-6?p.ho[0]:L,hi0=p.hi&&p.hi[0]<-1e-6?p.hi[0]:-Lb;
  p.auto=false;p.ho=[ho0,m*ho0];p.hi=[hi0,m*hi0]}
function cogDraw(){
  const el_=$('#spdCog'),q=cogPoint();if(!el_||!q)return;const {p}=q,tilt=COG.mode==='curve'?cogTilt(p):null;
  const k=[COG.mode,COG.rot.toFixed(3),p.y.toFixed(4),tilt==null?'':tilt.toFixed(3)].join('|');if(k===COG.key)return;COG.key=k;
  const C=80,R=70,ri=56,n=12;let teeth='';
  for(let i=0;i<n*4;i++){const a=COG.rot+i*Math.PI/(n*2),rr=(i%4===1||i%4===2)?R:ri;teeth+=(i?'L':'M')+(C+rr*Math.cos(a)).toFixed(1)+' '+(C+rr*Math.sin(a)).toFixed(1)}
  let spokes='';for(let i=0;i<5;i++){const a=COG.rot+i*2*Math.PI/5;spokes+=`<line x1="${(C+20*Math.cos(a)).toFixed(1)}" y1="${(C+20*Math.sin(a)).toFixed(1)}" x2="${(C+48*Math.cos(a)).toFixed(1)}" y2="${(C+48*Math.sin(a)).toFixed(1)}" stroke="#3A4152" stroke-width="7" stroke-linecap="round"/>`}
  const mark=COG.rot-Math.PI/2,mx=C+63*Math.cos(mark),my=C+63*Math.sin(mark);
  let needle='';if(tilt!=null){const dx=46*Math.cos(tilt),dy=-46*Math.sin(tilt);needle=`<line x1="${(C-dx).toFixed(1)}" y1="${(C-dy).toFixed(1)}" x2="${(C+dx).toFixed(1)}" y2="${(C+dy).toFixed(1)}" stroke="#FFD43B" stroke-width="5" stroke-linecap="round"/>`}
  el_.innerHTML=`<path d="${teeth}Z" fill="#232833" stroke="#FFD43B" stroke-width="2" stroke-linejoin="round"/><circle cx="${C}" cy="${C}" r="50" fill="#1A1D24"/>${spokes}${needle}<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#FFD43B"/><circle cx="${C}" cy="${C}" r="13" fill="#FFD43B"/><circle cx="${C}" cy="${C}" r="5" fill="#14171D"/>`;
  const val=COG.mode==='speed'?spdLabel(p.y):(Math.abs(tilt)<0.02?'Flat':(tilt>0?'Rising ':'Falling ')+Math.round(Math.abs(tilt)*180/Math.PI)+'°');
  $('#spdCogVal').textContent=val;el_.setAttribute('aria-valuetext',val);
  $$('[data-cog]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cog===COG.mode)));
  $('#spdCogHint').textContent=COG.mode==='speed'?'Turn the cog: clockwise is faster, one turn doubles the speed. It clicks at ½× ¾× 1× 1¼× 1½× 2×.':'Turn the cog to tilt the curve through this point: clockwise slopes it down, anticlockwise up.';
}
/* turn by da radians (clockwise positive) */
function cogTurn(da,fine){
  const q=cogPoint();if(!q)return;const {c,p}=q,D=COG.drag;COG.rot+=da;
  if(COG.mode==='speed'){
    const raw=(D?D.raw:p.y)+da/(2*Math.PI);if(D)D.raw=raw;let y=clamp(raw,SPD.min,SPD.max);
    if(SPD.snap&&!fine){const ny=SPD_SNAP_Y.reduce((a,s)=>Math.abs(y-s)<Math.abs(y-a)?s:a);if(Math.abs(y-ny)<0.035){y=ny;if(D&&D.snapY!==ny){D.snapY=ny;try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}}}else if(D)D.snapY=null}
    p.y=y;
  } else {const th=(D&&D.th!=null?D.th:cogTilt(p))-da;if(D)D.th=clamp(th,-1.4,1.4);cogSetTilt(c,SPD.sel,th)}
  spdAutoAll(c);spdChanged();cogDraw();
}
$$('[data-cog]').forEach(b=>b.addEventListener('click',()=>{COG.mode=b.dataset.cog;COG.key='';cogDraw()}));
(function(){
  const el_=$('#spdCog');const ang=ev=>{const r=el_.getBoundingClientRect();return Math.atan2(ev.clientY-(r.top+r.height/2),ev.clientX-(r.left+r.width/2))};
  el_.addEventListener('pointerdown',ev=>{if(!cogPoint())return;ev.preventDefault();el_.setPointerCapture(ev.pointerId);COG.drag={a:ang(ev),pushed:false,raw:cogPoint().p.y,th:null,snapY:null}});
  el_.addEventListener('pointermove',ev=>{const D=COG.drag;if(!D)return;const a=ang(ev);let da=a-D.a;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;D.a=a;if(Math.abs(da)<1e-4)return;
    if(!D.pushed){spdPush();D.pushed=true}cogTurn(da)});
  const end=()=>{COG.drag=null;spdUI()};el_.addEventListener('pointerup',end);el_.addEventListener('pointercancel',end);
  /* keyboard: arrows turn it a step (5% of speed, or 5° of tilt) */
  el_.addEventListener('keydown',ev=>{const k=ev.key,s=k==='ArrowUp'||k==='ArrowRight'?1:k==='ArrowDown'||k==='ArrowLeft'?-1:0;if(!s||!cogPoint())return;ev.preventDefault();spdPush();
    cogTurn(COG.mode==='speed'?s*2*Math.PI*Math.log2(1.05):s*5*Math.PI/180,true)});
})();

/* ---------- beat clock (trial) ----------
   One 8-count of the song as a circle (the 1 at the top). The clip between where that 8-count starts and ends is split
   into parts at moments of the dance (cuts). Dragging a cut round the rim moves where that moment lands in the song;
   the parts either side change speed to match, and the 8-count's two ends stay exactly where they were, both in the clip
   and in the song, so nothing outside it moves. It writes into the speed graph: the curve is split exactly at the two
   ends (the curve outside is untouched), the points between are replaced by one per part, and their speeds are solved
   (through the same time map playback uses) so each part takes exactly its share of the 8-count. */
const BCLK={m:null,N:4,drag:null,msg:'',key:''};
const CLK_MIN=0.25;   /* the shortest part, in beats */
function clkBeats(){const G=S.hasA?liveGrid():null;if(!G||!G.beats||G.beats.length<10)return null;const so=S.liveSong;
  const bt=(G.tapped?G.beats:(so&&so.an&&so.an.grid)||G.beats).slice(),d0=(G.down||[])[0];let i0=0;
  if(d0!=null){let bd=1e9;bt.forEach((t,k)=>{if(Math.abs(t-d0)<bd){bd=Math.abs(t-d0);i0=k}})}return {bt,i0:((i0%8)+8)%8}}
/* the song's 8-counts that lie wholly inside the clip: {A,B (clip), beats: 9 song times} */
function clkWindows(){const B=clkBeats();if(!B)return [];const {bt,i0}=B,out=[];
  for(let k=i0;k+8<bt.length;k+=8){const A=songToClip(bt[k]),E=songToClip(bt[k+8]);if(A>=S.cIn-1e-3&&E<=clipEnd()+1e-3&&E>A)out.push({A,B:E,beats:bt.slice(k,k+9)})}return out}
const clkPos=(W,s)=>{const b=W.beats;if(s<=b[0])return (s-b[0])/(b[1]-b[0]);for(let i=1;i<9;i++)if(s<=b[i])return i-1+(s-b[i-1])/(b[i]-b[i-1]);return 8+(s-b[8])/(b[8]-b[7])};
const clkTime=(W,u)=>{const b=W.beats,i=clamp(Math.floor(u),0,7);return b[i]+(u-i)*(b[i+1]-b[i])};
function clkKey(W){return W.A.toFixed(2)+'|'+BCLK.N}
/* the cuts (clip moments between the parts): saved with the curve, or where the beats land now */
function clkCuts(n,W){const sv=n&&n.curve&&n.curve.clk&&n.curve.clk[clkKey(W)];
  if(sv&&sv.length===BCLK.N-1&&sv.every((t,i)=>t>W.A&&t<W.B&&(!i||t>sv[i-1])))return sv.slice();
  const out=[];for(let j=1;j<BCLK.N;j++)out.push(songToClip(clkTime(W,8*j/BCLK.N)));return out}
function clkWhy(){if(!S.hasV)return 'Add a clip first.';if(routineOn())return 'The beat clock works on the whole clip. Switch to "Clip" under the video to use it.';
  if(clipCut())return 'For now the beat clock works on clips with no parts cut out.';if(!clkBeats())return 'Add a song with a beat to use the beat clock.';
  if(!clkWindows().length)return 'This clip is shorter than one 8-count of the song.';return ''}
function clkCur(){const L=clkWindows();if(!L.length)return null;
  if(BCLK.m==null||BCLK.m>=L.length){const s=clipToSong(v.currentTime);const i=L.findIndex(W=>s<W.beats[8]);BCLK.m=i<0?L.length-1:i}return {W:L[BCLK.m],i:BCLK.m,n:L.length}}
/* split the curve exactly at clip time t (de Casteljau), so the curve on either side keeps its exact shape */
function clkSplit(c,t){spdClampH(c);const P=c.pts,ex=P.find(q=>Math.abs(q.t-t)<1e-3);if(ex){ex.auto=false;return ex}
  if(t<P[0].t||t>P[P.length-1].t){/* past an end the curve is flat at the end point's speed: keep it flat */
    const first=t<P[0].t,E=first?P[0]:P[P.length-1],q={t,y:E.y,auto:false,hi:[-0.3,0],ho:[0.3,0]};E.auto=false;
    if(first)E.hi=[-(E.t-t)/3,0];else E.ho=[(t-E.t)/3,0];P.push(q);P.sort((a,b)=>a.t-b.t);return q}
  let i=0;while(i<P.length-2&&P[i+1].t<t)i++;const p=P[i],q=P[i+1];
  const X=[p.t,p.t+p.ho[0],q.t+q.hi[0],q.t],Y=[p.y,p.y+p.ho[1],q.y+q.hi[1],q.y];
  const bz=(A,u)=>{const w=1-u;return w*w*w*A[0]+3*w*w*u*A[1]+3*w*u*u*A[2]+u*u*u*A[3]};
  let lo=0,hi=1;for(let k=0;k<50;k++){const m=(lo+hi)/2;if(bz(X,m)<t)lo=m;else hi=m}const u=(lo+hi)/2,L=(a,b)=>a+(b-a)*u;
  const x01=L(X[0],X[1]),x12=L(X[1],X[2]),x23=L(X[2],X[3]),x012=L(x01,x12),x123=L(x12,x23),x=L(x012,x123);
  const y01=L(Y[0],Y[1]),y12=L(Y[1],Y[2]),y23=L(Y[2],Y[3]),y012=L(y01,y12),y123=L(y12,y23),y=L(y012,y123);
  p.auto=false;q.auto=false;p.ho=[x01-p.t,y01-p.y];q.hi=[x23-q.t,y23-q.y];
  const nq={t,y,auto:false,hi:[x012-x,y012-y],ho:[x123-x,y123-y]};P.splice(i+1,0,nq);return nq}
/* the song positions P (in beats, P[0]=0 … P[N]=8) for the cut moments: write the curve. false if it can't */
function clkApply(n,W,cuts,P){
  const N=cuts.length+1,E=[W.A,...cuts,W.B],T=[];for(let i=0;i<N;i++)T.push((clkTime(W,P[i+1])-clkTime(W,P[i]))/S.ar);
  if(T.some(x=>!(x>0)))return false;
  const c=spdEnsure(n),before=JSON.stringify(c);
  /* a graph that's off plays at the plain clip speed: start from flat so nothing else moves */
  if(!c.on||!c.pts.length){c.pts=[{t:S.cIn,y:0,auto:true},{t:clipEnd(),y:0,auto:true}];spdAutoAll(c);c.on=true}
  const pa=clkSplit(c,W.A),pb=clkSplit(c,W.B);
  c.pts=c.pts.filter(q=>q===pa||q===pb||q.t<W.A-1e-4||q.t>W.B+1e-4);
  /* leave the ends along the curve's own slope (smooth), or flat at the clip's start and end */
  const mA=c.pts[0]!==pa&&pa.hi[0]<-1e-6?pa.hi[1]/pa.hi[0]:0,mB=c.pts[c.pts.length-1]!==pb&&pb.ho[0]>1e-6?pb.ho[1]/pb.ho[0]:0;
  /* each part: a flat stretch at its own speed (two points, flat handles), easing into the next across the cut */
  const mids=[],F=0.15;for(let i=0;i<N;i++){const len=E[i+1]-E[i],y=clamp(Math.log2(len/T[i]/S.vr),SPD.min,SPD.max);
    const q1={t:+(E[i]+F*len).toFixed(4),y,auto:false},q2={t:+(E[i+1]-F*len).toFixed(4),y,auto:false};mids.push([q1,q2]);c.pts.push(q1,q2)}
  c.pts.sort((a,b)=>a.t-b.t);
  const ia=c.pts.indexOf(pa),ib=c.pts.indexOf(pb);
  for(let k=ia+1;k<ib;k++){const q=c.pts[k];q.hi=[-(q.t-c.pts[k-1].t)/2,0];q.ho=[(c.pts[k+1].t-q.t)/2,0]}
  const La=(c.pts[ia+1].t-pa.t)/2,Lb=(pb.t-c.pts[ib-1].t)/2;pa.ho=[La,mA*La];pb.hi=[-Lb,-mB*Lb];spdAutoAll(c);
  /* solve each part's speed through playback's own time map */
  const g={src:n.id,s:S.cIn,e:clipEnd(),r:S.vr};let worst=1;
  for(let it=0;it<24;it++){g.k=curveKnots(n,g);worst=0;
    const D=mids.map((q,i)=>toOut(g,E[i+1])-toOut(g,E[i]));
    D.forEach((d,i)=>{worst=Math.max(worst,Math.abs(d-T[i]));const y=clamp(mids[i][0].y+Math.log2(d/T[i]),SPD.min,SPD.max);mids[i][0].y=mids[i][1].y=y});
    if(worst<4e-4)break;spdAutoAll(c)}
  g.k=curveKnots(n,g);worst=Math.max(...mids.map((q,i)=>Math.abs(toOut(g,E[i+1])-toOut(g,E[i])-T[i])));
  if(!(worst<0.003)){n.curve=JSON.parse(before);knotMemo=null;return false}
  c.clk=c.clk||{};c.clk[clkKey(W)]=cuts.map(t=>+t.toFixed(4));
  SPD.sel=-1;return true}
/* where each cut lands now, in beats */
function clkNow(W,cuts){return [0,...cuts.map(t=>clkPos(W,clipToSong(t))),8]}
function clkVisible(){return S.hasV&&$('#clkCard').offsetParent!==null}
function clkDraw(){
  if(!clkVisible())return;const why=clkWhy();$('#clkCard').classList.toggle('off',!!why);
  const svg=$('#clkSvg'),cur=why?null:clkCur();
  $$('[data-clkn]').forEach(b=>{b.setAttribute('aria-pressed',String(+b.dataset.clkn===BCLK.N));b.disabled=!!why});
  $('#clkPrev').disabled=!cur||cur.i<=0;$('#clkNext').disabled=!cur||cur.i>=cur.n-1;$('#clkEven').disabled=!cur;$('#clkUndo').disabled=!SPD.undo.length||!!why;
  $('#clkWhich').textContent=cur?`8-count ${cur.i+1} of ${cur.n}`:'—';
  $('#clkMsg').textContent=why||BCLK.msg;
  const C=150,RO=112,RI=50,pt=(u,r)=>{const a=u/8*2*Math.PI-Math.PI/2;return [C+r*Math.cos(a),C+r*Math.sin(a)]},f=z=>z.toFixed(1);
  let h='';
  if(!cur){h=`<circle cx="${C}" cy="${C}" r="${RO}" fill="none" stroke="#3A4152" stroke-width="2" stroke-dasharray="4 6"/>`;svg.innerHTML=h;$('#clkChips').innerHTML='';return}
  const n=spdCur(),{W}=cur,cuts=clkCuts(n,W),E=[W.A,...cuts,W.B],P=BCLK.drag&&BCLK.drag.P?BCLK.drag.P:clkNow(W,cuts);
  const sp=E.slice(0,-1).map((t,i)=>{const o=(clipToSong(E[i+1])-clipToSong(t))/S.ar;return (E[i+1]-t)/(o||1)/(S.vr||1)});
  const col=s=>s<0.97?['#4DABF7',Math.min(1,0.3+(1-s)*1.4)]:s>1.03?['#FF922B',Math.min(1,0.3+(s-1)*0.9)]:['#5C6474',0.55];
  const wedge=(u0,u1)=>{const [a,b]=pt(u0,RO),[c2,d]=pt(u1,RO),[e,g]=pt(u1,RI),[k,l]=pt(u0,RI),L=(u1-u0)>4?1:0;return `M${f(a)} ${f(b)}A${RO} ${RO} 0 ${L} 1 ${f(c2)} ${f(d)}L${f(e)} ${f(g)}A${RI} ${RI} 0 ${L} 0 ${f(k)} ${f(l)}Z`};
  for(let i=0;i<E.length-1;i++){const [cl,o]=col(sp[i]);h+=`<path data-s="${i}" d="${wedge(P[i],P[i+1])}" fill="${cl}" fill-opacity="${o.toFixed(2)}" stroke="#14171D" stroke-width="2"/>`;
    if(P[i+1]-P[i]>0.6){const [x,y]=pt((P[i]+P[i+1])/2,(RO+RI)/2);h+=`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" fill="#F3F1EC" style="font:700 12px var(--f-mono);pointer-events:none">${sp[i].toFixed(2)}×</text>`}}
  for(let k=0;k<16;k++){const u=k/2,[x1,y1]=pt(u,RO+3),[x2,y2]=pt(u,RO+(k%2?8:13));h+=`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${k%2?'#5C6474':'#9AA3B5'}" stroke-width="${k%2?1:2}"/>`;
    if(!(k%2)){const [x,y]=pt(u,RO+25);h+=`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" fill="${k?'#9AA3B5':'#F3F1EC'}" style="font:700 13px var(--f-body)">${k/2+1}</text>`}}
  /* the playhead */
  const ph=clkPos(W,clipToSong(v.currentTime));if(ph>=0&&ph<=8){const [x1,y1]=pt(ph,RI-6),[x2,y2]=pt(ph,RO+2);h+=`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${tok('--dance')}" stroke-width="3" stroke-linecap="round" style="pointer-events:none"/>`}
  const [zx,zy]=pt(0,RO);h+=`<circle cx="${f(zx)}" cy="${f(zy)}" r="6" fill="#F3F1EC"/>`;
  for(let j=1;j<E.length-1;j++){const [x,y]=pt(P[j],RO),on=BCLK.drag&&BCLK.drag.j===j;h+=`<circle data-h="${j}" cx="${f(x)}" cy="${f(y)}" r="22" fill="transparent"/><circle cx="${f(x)}" cy="${f(y)}" r="${on?14:12}" fill="#F3F1EC" stroke="#FFD43B" stroke-width="3" style="pointer-events:none"/>`}
  h+=`<text x="${C}" y="${C-9}" text-anchor="middle" dominant-baseline="central" fill="#F3F1EC" style="font:800 15px var(--f-body);pointer-events:none">8 counts</text><text x="${C}" y="${C+11}" text-anchor="middle" dominant-baseline="central" fill="#9AA3B5" style="font:600 11px var(--f-body);pointer-events:none">song locked</text>`;
  svg.innerHTML=h;
  $('#clkChips').innerHTML=sp.map((s,i)=>`<div class="clk-chip"><b>${s.toFixed(2)}×</b>Part ${i+1}<br>${(P[i+1]-P[i]).toFixed(P[i+1]-P[i]<1?2:1).replace(/\.0+$/,'')} ${Math.abs(P[i+1]-P[i]-1)<0.01?'count':'counts'}</div>`).join('');
}
function clkSet(P,j){const n=spdCur(),cur=clkCur();if(!n||!cur)return false;const ok=clkApply(n,cur.W,clkCuts(n,cur.W),P);
  if(ok){BCLK.msg='';spdChanged()}else BCLK.msg='That’s as far as it goes: the speed graph goes from ¼× to 4×.';BCLK.key='';return ok}
(function(){
  const svg=$('#clkSvg');const posAt=ev=>{const r=svg.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*300-150,y=(ev.clientY-r.top)/r.height*300-150;return ((Math.atan2(y,x)+Math.PI/2)/(2*Math.PI)*8+8)%8};
  svg.addEventListener('pointerdown',ev=>{if(clkWhy())return;const cur=clkCur();if(!cur)return;const t=ev.target,hj=t.getAttribute&&t.getAttribute('data-h'),si=t.getAttribute&&t.getAttribute('data-s');
    if(hj){ev.preventDefault();svg.setPointerCapture(ev.pointerId);if(S.playing)pause();const n=spdCur();spdEnsure(n);BCLK.drag={j:+hj,P:clkNow(cur.W,clkCuts(n,cur.W)),pushed:false};clkDraw();return}
    if(si!=null){const n=spdCur(),E=[cur.W.A,...clkCuts(n,cur.W),cur.W.B];if(S.playing)pause();S.segIdx=0;v.currentTime=E[+si]+0.001;BCLK.key=''}});
  svg.addEventListener('pointermove',ev=>{const D=BCLK.drag;if(!D)return;let u=posAt(ev);const lo=D.P[D.j-1]+CLK_MIN,hi=D.P[D.j+1]-CLK_MIN;
    u=[u-8,u,u+8].reduce((a,x)=>Math.abs(x-D.P[D.j])<Math.abs(a-D.P[D.j])?x:a);   /* past the 1 the angle wraps: take the reading nearest the handle */
    if(SPD.snap){const sn=Math.round(u*2)/2;if(Math.abs(sn-u)<0.18)u=sn}
    u=clamp(u,lo,hi);if(Math.abs(u-D.P[D.j])<1e-3)return;
    if(!D.pushed){spdPush();D.pushed=true}
    const P=D.P.slice();P[D.j]=u;if(clkSet(P,D.j))D.P=P;BCLK.key='';clkDraw()});
  const end=()=>{if(!BCLK.drag)return;BCLK.drag=null;BCLK.key='';clkDraw();spdUI()};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  $('#clkPrev').addEventListener('click',()=>{const c=clkCur();if(!c)return;BCLK.m=Math.max(0,c.i-1);const W=clkWindows()[BCLK.m];if(S.playing)pause();S.segIdx=0;v.currentTime=W.A+0.001;BCLK.msg='';BCLK.key='';clkDraw()});
  $('#clkNext').addEventListener('click',()=>{const c=clkCur();if(!c)return;BCLK.m=Math.min(c.n-1,c.i+1);const W=clkWindows()[BCLK.m];if(S.playing)pause();S.segIdx=0;v.currentTime=W.A+0.001;BCLK.msg='';BCLK.key='';clkDraw()});
  $$('[data-clkn]').forEach(b=>b.addEventListener('click',()=>{BCLK.N=+b.dataset.clkn;BCLK.msg='';BCLK.key='';clkDraw()}));
  /* every cut back onto its own beat (the parts' even share of the 8-count) */
  $('#clkEven').addEventListener('click',()=>{const c=clkCur();if(!c)return;spdEnsure(spdCur());spdPush();const P=[];for(let j=0;j<=BCLK.N;j++)P.push(8*j/BCLK.N);
    if(!clkSet(P))SPD.undo.pop();clkDraw();spdUI()});
  $('#clkUndo').addEventListener('click',()=>{$('#spdUndo').click();BCLK.msg='';BCLK.key='';clkDraw()});
})();
let clkLast=0;
(function clkLoop(){try{const now=performance.now();if(now-clkLast>60&&clkVisible()){clkLast=now;
  if(S.playing&&!BCLK.drag){const L=clkWindows(),s=clipToSong(v.currentTime),i=L.findIndex(W=>s>=W.beats[0]&&s<W.beats[8]);if(i>=0&&i!==BCLK.m)BCLK.m=i}
  const n=spdCur(),r=$('#clkSvg').getBoundingClientRect();
  const k=[SPD.ver,BCLK.m,BCLK.N,BCLK.msg,n&&n.curve?JSON.stringify(n.curve.pts):'',Math.round(v.currentTime*20),S.cIn,clipEnd(),S.vr,S.offset,S.ar,routineOn(),clipCut(),liveGrid()&&liveGrid().beats.length,Math.round(r.width),SPD.undo.length].join('|');
  if(k!==BCLK.key){BCLK.key=k;clkDraw()}}}catch(e){}requestAnimationFrame(clkLoop)})();

/* ---------- motion: panel slide, swipe between modes, stuck video bar, full screen ---------- */
const RM=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function panelIn(p,dir,from){
  if(!p||RM()||!p.animate)return;
  const x0=from!=null?from:dir*36;
  requestAnimationFrame(()=>p.animate([{transform:`translateX(${x0}%)`,opacity:from!=null?1:0.2},{transform:'translateX(0)',opacity:1}],{duration:from!=null?320:420,easing:'cubic-bezier(.32,.72,0,1)'}));
}
/* swipe left or right anywhere on the settings to move between Clip, Song, Tempo, Moves and Routine.
   Taps on buttons still work; only controls that need a sideways drag keep it: sliders, the speed graph, routine
   reorder handles, and rows that really scroll sideways (and only while they can still scroll that way).
   The next page slides in beside the current one and follows the finger. */
(function(){
  const col=$('.tabs').closest('.col'); if(!col)return; col.classList.add('swipe-col');
  const KEEP='input[type=range],textarea,select,.spd-graph,.handle,.sheet,[data-noswipe]';
  const GAP=16; let sw=null, eatClick=-1e9;
  const cur=()=>tabs.findIndex(x=>x.getAttribute('aria-selected')==='true');
  const panelOf=i=>$('#'+tabs[i].getAttribute('aria-controls'));
  /* would this sideways move scroll something inside the page? then the row gets it */
  function scrollsX(t,dx){
    for(let e=t;e&&e!==col;e=e.parentElement){
      const cs=getComputedStyle(e);
      if(/(auto|scroll)/.test(cs.overflowX)&&e.scrollWidth>e.clientWidth+2){
        if(dx<0&&e.scrollLeft+e.clientWidth<e.scrollWidth-2)return true;
        if(dx>0&&e.scrollLeft>2)return true;
      }
    }
    return false;
  }
  function clear(p){if(!p)return;p.style.transition='';p.style.transform='';p.style.position='';p.style.top='';p.style.left='';p.style.width='';p.style.zIndex='';p.style.pointerEvents=''}
  function placeNeighbour(dir){
    const j=sw.i+dir; if(sw.nb&&sw.nbDir===dir)return; if(sw.nb){sw.nb.hidden=true;clear(sw.nb);sw.nb=null}
    if(j<0||j>=tabs.length)return;
    const p=panelOf(sw.i), q=panelOf(j);
    q.hidden=false; q.style.position='absolute'; q.style.top=p.offsetTop+'px'; q.style.left=p.offsetLeft+'px'; q.style.width=p.offsetWidth+'px'; q.style.zIndex='1'; q.style.pointerEvents='none';
    sw.nb=q; sw.nbDir=dir;
  }
  function paint(){
    const p=panelOf(sw.i), W=sw.W;
    p.style.transform=`translateX(${sw.dx}px)`;
    if(sw.nb)sw.nb.style.transform=`translateX(${sw.dx+sw.nbDir*(W+GAP)}px)`;
  }
  col.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||S.rec||$('.pin').classList.contains('fs')||(sw&&sw.anim))return;
    const t=e.target; if(t.closest('.tabs')||t.closest(KEEP))return;
    if(t.matches('input,button')&&t===document.activeElement&&t.matches('input:not([type=file]):not([type=checkbox])'))return;
    const q=e.touches[0]; sw={x:q.clientX,y:q.clientY,t:performance.now(),mode:null,dx:0,i:cur(),target:t,W:col.clientWidth||360,hist:[]};
  },{passive:true});
  col.addEventListener('touchmove',e=>{
    if(!sw||sw.anim)return; const q=e.touches[0], dx=q.clientX-sw.x, dy=q.clientY-sw.y;
    if(!sw.mode){
      if(Math.hypot(dx,dy)<8)return;
      if(Math.abs(dx)>Math.abs(dy)&&!scrollsX(sw.target,dx)){sw.mode='h';sw.x=q.clientX-Math.sign(dx)*1;col.classList.add('swiping')}
      else{sw=null;return}
    }
    e.preventDefault();
    const raw=q.clientX-sw.x, dir=raw<0?1:-1, j=sw.i+dir, edge=j<0||j>=tabs.length;
    sw.dx=edge?raw/(1+Math.abs(raw)/90):raw;   /* rubber band past the first and last */
    if(!edge)placeNeighbour(dir); else if(sw.nb){sw.nb.hidden=true;clear(sw.nb);sw.nb=null}
    const p=panelOf(sw.i); p.style.transition='none'; if(sw.nb)sw.nb.style.transition='none';
    sw.hist.push([performance.now(),q.clientX]); if(sw.hist.length>20)sw.hist.shift();
    paint();
  },{passive:false});
  const end=()=>{
    if(!sw||sw.anim)return; if(sw.mode!=='h'){sw=null;return}
    eatClick=performance.now();
    const now=performance.now(), H=sw.hist.filter(h=>now-h[0]<120).concat(sw.hist.length?[]:[]), vel=H.length>1?(H[H.length-1][1]-H[0][1])/Math.max(1,H[H.length-1][0]-H[0][0]):0;   /* px per ms, + = right */
    const {i,dx,W}=sw, p=panelOf(i), nb=sw.nb, dir=sw.nbDir;
    const go=nb&&Math.sign(-dx)===dir&&(Math.abs(dx)>W*0.3||(Math.abs(vel)>0.35&&Math.sign(-vel)===dir));
    const ease='transform .38s cubic-bezier(.32,.72,0,1)';
    sw.anim=true; const S0=sw;
    p.style.transition=ease; if(nb)nb.style.transition=ease;
    if(go){p.style.transform=`translateX(${-dir*(W+GAP)}px)`;nb.style.transform='translateX(0)'}
    else{p.style.transform='translateX(0)';if(nb)nb.style.transform=`translateX(${dir*(W+GAP)}px)`}
    setTimeout(()=>{
      clear(p); if(nb)clear(nb);
      if(go){showTab(tabs[i+dir],false,{noAnim:true});if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}}
      else if(nb)nb.hidden=true;
      if(sw===S0)sw=null; col.classList.remove('swiping');
    },390);
  };
  col.addEventListener('touchend',end); col.addEventListener('touchcancel',end);
  /* a swipe that started on a button must not also press it */
  col.addEventListener('click',e=>{if(e.isTrusted&&performance.now()-eatClick<450){e.stopPropagation();e.preventDefault()}},true);
})();
/* the video bar gets a hairline and shadow once content scrolls under it */
(function(){const pin=$('.pin');/* stuck = the bar is actually pinned at the top (the header has scrolled away), not merely scrolled a little */
  const f=()=>pin.classList.toggle('stuck',(window.scrollY||document.documentElement.scrollTop)>4&&pin.getBoundingClientRect().top<=(parseFloat(getComputedStyle(pin).top)||0)+1);window.addEventListener('scroll',f,{passive:true});window.addEventListener('resize',f);f();
  /* things scrolled into view land below the pinned header and bar, not under them */
  const padEl=document.head.appendChild(document.createElement('style'));let padV='';   /* a style element, not an inline style: themes own the root's inline styles */
  const pad=()=>{const cs=getComputedStyle(pin),v=(cs.position==='sticky'?(parseFloat(cs.top)||0)+pin.offsetHeight+8:0)+'px';if(v!==padV){padV=v;padEl.textContent='html{scroll-padding-top:'+v+'}'}};
  try{new ResizeObserver(pad).observe(pin)}catch(e){}window.addEventListener('resize',pad);pad()})();
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
  setInterval(()=>{btn.hidden=!S.hasV;$('#mirBtn').hidden=!S.hasV;if(pin.classList.contains('fs')){if(!S.playing)pin.classList.remove('idle');else if(!pin.classList.contains('idle')&&!idleT)wake()}},400);
  $('#play').addEventListener('click',()=>{if(pin.classList.contains('fs'))setTimeout(wake,0)});
})();

/* ---------- hips you can read ---------- */
/* "about 1 min left": from the rate so far, once there is enough to go on */
function etaText(t0,p){if(!t0||p-t0.p<0.03)return '';const el=(performance.now()-t0.t)/1000,left=el*(1-p)/(p-t0.p);if(!isFinite(left)||left<0)return '';
  return left<45?'about '+Math.max(5,Math.round(left/5)*5)+' s left':'about '+Math.round(left/60)+' min left'}
function bodyInfoText(n,B){
  let t=`Body tracked on ${B.seen} of ${B.n} frames.`;
  /* tracked before the 25 Oct update (older smoothing, which rounded off fast moves) */
  if(B.v>=2&&!B.cleanV)t+=' Tracked before the fast-moves update: Track again so the skeleton keeps up with quick hands and feet.';
  else if(!/rtmpose/.test(B.model||'')&&RB.modelName()==='rtm')t+=' Track again with RTMPose for the best skeleton, with hands and feet.';
  /* how much of the clip the tracking covers: a run that stopped part-way used to look complete ("197 of 197") */
  const cov=RB.coverage?RB.coverage(B):null;
  if(cov&&cov.short)t=`Body tracked from ${fmt(cov.from)} to ${fmt(cov.to)} only (${cov.pct}% of the clip): the skeleton is missing outside that. Track again to cover the whole clip.`;
  if(B.v<2)t+=' Tracked with the older tracker: Track again for steadier tracking, hip turn and following one dancer.';
  else if(B.multi&&B.multi>0.1*B.n)t+=` More than one person in ${Math.round(B.multi/B.n*100)}% of frames: following ${B.pick?'the dancer you chose':'the biggest one'}. Use "Choose the dancer" to follow someone else.`;
  if(B.clean&&B.clean.flips)t+=` Fixed ${B.clean.flips} left/right mix-up${B.clean.flips>1?'s':''}.`;
  return t;
}
/* compare with the previous track (after tracking again with another tracker): this one, the previous one (orange) or both */
S.cmpShow='now';
function cmpName(B){return !B?'':/rtmpose/.test(B.model||'')?'RTMPose':/heavy/.test(B.model||'')?'Accurate':/full/.test(B.model||'')?'Faster':'earlier'}
function cmpUI(){const n=srcById(S.cur),row=$('#cmpRow');if(!row)return;const on=!!(n&&n.body&&n.bodyAlt);row.hidden=!on;if(!on)return;
  $('#cmpNow').textContent=cmpName(n.body);$('#cmpPrev').textContent=cmpName(n.bodyAlt)+' (orange)';
  $$('#cmpSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.c===S.cmpShow)))}
$$('#cmpSeg button').forEach(b=>b.addEventListener('click',()=>{S.cmpShow=b.dataset.c;cmpUI();bodyKey=''}));
setInterval(()=>{try{cmpUI()}catch(e){}},800);
/* tracking quality: Accurate (the bigger tracker, keeps up with fast hands and feet) or Faster; Body uses the same */
/* how long tracking will take on this phone: from the last tracks' measured time per frame (rough guesses before that) */
function trackMsPerFrame(q){let v=null;try{v=+localStorage.getItem('rs-trk-ms-'+q)}catch(e){}return v>0?{ms:v,measured:true}:{ms:q==='rtm'?650:q==='accurate'?90:45,measured:false}}
function trackEstimate(q){const n=srcById(S.cur),el=n&&n.el,d=el&&isFinite(el.duration)?el.duration:0;if(!d)return '';const e=trackMsPerFrame(q),secs=d*30*e.ms/1000;
  return (e.measured?'about ':'roughly ')+(secs<60?Math.max(5,Math.round(secs/5)*5)+' s':Math.round(secs/60)+' min')+' for this clip'+(e.measured?' on this phone':'')}
function trackQUI(){let q='rtm';try{const v=localStorage.getItem('rs-track-q');q=v==='fast'||v==='accurate'?v:'rtm'}catch(e){}
  $$('#trackQ button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.q===q)));
  const est=trackEstimate(q);
  const mb=RB.CFG.rtmMB||65, st=RB.rtmStatus?RB.rtmStatus():{state:'idle'}, have=st.state==='ready'||S.rtmCached;
  $('#trackQNote').textContent=(q==='rtm'?'The best skeleton, with hands and feet'+(have?' (ready on this phone).':' (about '+mb+' MB to download the first time).'):q==='accurate'?'MediaPipe\'s bigger tracker: quicker than RTMPose, no fingers.':'Quickest; less exact on fast hands and feet.')+(est?' Tracking takes '+est+'.':'')}
$$('#trackQ button').forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem('rs-track-q',b.dataset.q)}catch(e){}trackQUI()}));
/* RTMPose's model: shows whether it's on this phone, lets you download it ahead of time (with progress), and fetches it by
   itself on Wi-Fi once you have a video (never on mobile data or with Data Saver on) */
function rtmMB(n){return (n/1048576).toFixed(n>10485760?0:1)}
function rtmGetUI(){
  const q=(()=>{try{return localStorage.getItem('rs-track-q')||'rtm'}catch(e){return 'rtm'}})(), st=RB.rtmStatus(), row=$('#rtmGetRow');
  row.hidden=q!=='rtm'||(S.rtmCached&&st.state!=='loading')||(st.state==='ready'&&!S.rtmJustGot);
  $('#rtmGet').hidden=st.state==='loading'||st.state==='ready'; $('#rtmGet').textContent=st.state==='error'?'Try the download again':'Download it now';
  $('#rtmGetMsg').textContent=st.state==='loading'?'Downloading the RTMPose model… '+rtmMB(st.got)+(st.total?' of '+rtmMB(st.total)+' MB ('+Math.min(100,Math.round(st.got/st.total*100))+'%)':' MB'):st.state==='ready'?'Downloaded: ready on this phone.':st.state==='error'?'The download stopped ('+st.err+').':'';
}
function rtmPrefetchNow(){const p=RB.rtmPrefetch();S.rtmJustGot=true;const iv=setInterval(()=>{rtmGetUI();trackQUI()},400);p.then(ok=>{clearInterval(iv);if(ok)S.rtmCached=true;rtmGetUI();trackQUI()});rtmGetUI()}
$('#rtmGet').addEventListener('click',rtmPrefetchNow);
RB.rtmCached().then(c=>{S.rtmCached=c;rtmGetUI();trackQUI()});
function rtmAutoFetch(){
  try{const c=navigator.connection,q=localStorage.getItem('rs-track-q')||'rtm';
    if(q!=='rtm'||S.rtmCached||RB.rtmStatus().state!=='idle'||!c||c.saveData||!/^(wifi|ethernet)$/.test(c.type||''))return;
    rtmPrefetchNow()}catch(e){}
}
setInterval(()=>{try{rtmGetUI()}catch(e){}},2000);
setInterval(()=>{try{trackQUI()}catch(e){}},2000);
trackQUI();
/* choose the dancer: the next tap on the video picks who to follow, then tracking runs */
$('#bodyPick').addEventListener('click',()=>{
  if(S.bodyBusy)return; S.bodyPicking=!S.bodyPicking; $('#bodyPick').setAttribute('aria-pressed',S.bodyPicking);
  $('#pickMsg').textContent=S.bodyPicking?'Pause on a frame where you can see them, then tap them on the video.':'';
  if(S.bodyPicking&&S.playing)pause();
  if(S.bodyPicking)window.scrollTo({top:0,behavior:'smooth'});
});
$('#stage').addEventListener('pointerdown',e=>{
  if(!S.bodyPicking||e.target.closest('button,label,input'))return; e.preventDefault(); e.stopPropagation();
  const el=curVid(), n=el&&srcOfEl(el); if(!n)return;
  const r=bodyCv.getBoundingClientRect(), rect=RB.containRect(r.width,r.height,el.videoWidth,el.videoHeight);
  const x0=(e.clientX-r.left-rect.x)/rect.w, y=(e.clientY-r.top-rect.y)/rect.h; if(x0<0||x0>1||y<0||y>1)return;
  const x=S.mirror?1-x0:x0;   /* the clip is shown mirrored: the tap is on the flipped picture */
  S.bodyPick={src:n.id,t:el.currentTime,x,y}; S.bodyPicking=false; $('#bodyPick').setAttribute('aria-pressed','false');
  $('#pickMsg').textContent='Got it. Tracking that dancer…'; $('#bodyTrack').click();
},true);
/* the Hip moves graph: tilt and sway over the clip, the song's beats, the playhead */
function hipGraph(){
  const card=$('#hipCard'), n=srcById(S.cur), B=n&&bodyOf(n), show=!!(B&&S.hasV&&!routineOn()&&!$('#p-clip').hidden);
  card.hidden=!(B&&S.hasV); if(!show||card.offsetParent===null)return;
  const cv=$('#hipCanvas'),{w,h,dpr}=sizeCanvas(cv),x=cv.getContext('2d');x.clearRect(0,0,w,h);
  const d=v.duration||B.end||1, X=t=>t/d*w, pad=10*dpr, mid=h/2, amp=h/2-pad;
  const TILT=20, SWAY=0.35;
  x.strokeStyle='#2C313C';x.lineWidth=dpr;x.beginPath();x.moveTo(0,mid);x.lineTo(w,mid);x.stroke();
  x.fillStyle='#7C8494';x.font=`600 ${10*dpr}px JetBrains Mono,monospace`;x.textBaseline='top';x.fillText('+'+TILT+'°',4*dpr,4*dpr);x.textBaseline='bottom';x.fillText('−'+TILT+'°',4*dpr,h-4*dpr);
  const G=liveGrid();
  if(G){x.fillStyle=tok('--song');x.globalAlpha=.5;for(const b of G.beats){const t=S.cIn+((b-S.offset)/S.ar)*S.vr;if(t<0||t>d)continue;x.fillRect(X(t),0,dpr,6*dpr)}x.globalAlpha=1}
  if(n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n))x.fillRect(X(b.t)-dpr,h-6*dpr,2*dpr,6*dpr)}
  const line=(k,scale,col,width)=>{x.strokeStyle=col;x.lineWidth=width;x.beginPath();let on=false;
    RB.hipsAt(B,0);const off={tilt:0,sway:2}[k];
    for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE];const val=B.hips[i*RB.HS+off];if(!(val===val)){on=false;continue}
      const px=X(t),py=mid-Math.max(-1,Math.min(1,val/scale))*amp;if(!on){x.moveTo(px,py);on=true}else x.lineTo(px,py)}x.stroke()};
  try{for(const r of hipPatterns(B)){x.fillStyle=PAT[r.lab].col;x.globalAlpha=0.85;x.fillRect(X(r.t0),h-19*dpr,Math.max(dpr,X(r.t1)-X(r.t0)),6*dpr)}x.globalAlpha=1;
    const pl=$('#patLine'),tx=patSummary(n,B);if(pl.innerHTML!==tx)pl.innerHTML=tx}catch(e){}
  const C=S.cmp&&!S.cmp.err&&S.cmp.match>=0.3&&S.cmp.refId===S.cur?S.cmp:null;
  if(C){if(C.weakest&&C.weakest.alike<0.6){x.fillStyle='rgba(255,148,102,.13)';x.fillRect(X(C.weakest.t0),0,X(C.weakest.t1)-X(C.weakest.t0),h)}
    x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;x.setLineDash([5*dpr,4*dpr]);x.beginPath();let on=false;
    for(let k=0;k<C.tt.length;k++){const tRef=C.ra+(k-C.off)*C.step;const val=C.tt[k];if(!(val===val)||tRef<0||tRef>d){on=false;continue}const px=X(tRef),py=mid-Math.max(-1,Math.min(1,val/TILT))*amp;if(!on){x.moveTo(px,py);on=true}else x.lineTo(px,py)}
    x.stroke();x.setLineDash([])}
  else line('sway',SWAY,'rgba(243,241,236,.7)',1.5*dpr);
  line('tilt',TILT,tok('--hips'),2.5*dpr);
  {const hs=hipSync(n,B),grid=hs?hs.beats:null,hh=hipHits(B);
   for(const q of hh){if(q.t<0||q.t>d)continue;const H=RB.hipsAt(B,q.t),py=H&&H.tilt!=null?mid-Math.max(-1,Math.min(1,H.tilt/TILT))*amp:mid;
     let on=false;if(grid){const dv=hs.div||2;for(let i=0;i<grid.length-1;i++){const a=grid[i],b=grid[i+1];if(q.t<a-0.07||q.t>b+0.07)continue;for(let j=0;j<=dv;j++){const g=a+(b-a)*j/dv+hs.offsetMs/1000*0;if(Math.abs(q.t-g)<=0.06){on=true;break}}if(on)break}}
     x.fillStyle=on?tok('--ok'):tok('--hips');x.strokeStyle='#14171D';x.lineWidth=1.5*dpr;x.beginPath();x.arc(X(q.t),py,3.5*dpr,0,7);x.fill();x.stroke()}
   const hb=$('#hipBeat'),txt=hipBeatText(n,B);if(hb.innerHTML!==txt)hb.innerHTML=txt}
  const px=X(v.currentTime);x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();
  const H=RB.hipsAt(B,v.currentTime);
  $('#hipNow').textContent=H?('Tilt '+(H.tilt==null?'side-on':Math.abs(H.tilt)<3?'level':(H.tilt>0?'right ':'left ')+Math.round(Math.abs(H.tilt))+'° up')+(H.turn!=null?' · facing '+(Math.abs(H.turn)<15?'front':Math.abs(H.turn)>150?'away':(H.turn>0?'right':'left')):'')):'';
}
$('#hipCanvas').addEventListener('click',e=>{const n=srcById(S.cur),B=n&&bodyOf(n);if(!B||routineOn())return;const r=e.currentTarget.getBoundingClientRect();const t=(e.clientX-r.left)/r.width*(v.duration||1);if(S.playing)pause();S.segIdx=0;v.currentTime=Math.max(0,Math.min(v.duration||t,t));hipGraph()});
/* redraw only when what it shows changed; at most 15 times a second while playing */
let hipKey='';
(function hipLoop(){try{const n=srcById(S.cur),B=n&&bodyOf(n),c=$('#hipCanvas'),r=c.getBoundingClientRect();
  const k=[!!B,B&&B.n,B&&B.hips&&B.hips.length,S.cur,S.hasV,routineOn(),$('#p-clip').hidden,Math.round(r.width),Math.round(r.height),Math.round(v.currentTime*15),S.cIn,S.offset,S.ar,S.vr,n&&n.motion&&hitsOf(n).length,liveGrid()&&liveGrid().beats.length].join('|');
  if(k!==hipKey){hipKey=k;hipGraph()}}catch(e){}requestAnimationFrame(hipLoop)})();

/* ---------- sessions and updates ----------
   On iPhone a Home Screen app isn't restarted when you come back to it: iOS resumes the same page, sometimes for days,
   so fixes never arrived and a page with tired players kept going. Now: the app notices a new version when you come
   back (or every 10 minutes) and reloads itself when nothing is playing, after saving; otherwise it offers a bar.
   Start fresh restarts on an empty project; Erase everything wipes this phone's copy of the app. */
const UPD={boot:null,checkedAt:0,ready:false};
async function serverVersion(){
  try{const r=await fetch('sw.js?v='+Date.now(),{cache:'no-store'});if(!r.ok)return null;const m=(await r.text()).match(/VERSION='([^']+)'/);return m?m[1]:null}catch(e){return null}
}
function idleNow(){return !S.playing&&!S.rec&&!S.bodyBusy&&!(S.preview)}
async function reloadSaved(){try{await autosave(true)}catch(e){}try{const g=await navigator.serviceWorker?.getRegistration();await g?.update()}catch(e){}location.reload()}
function showUpdateBar(){
  if(document.getElementById('updBar'))return;
  const b=el('div','updbar');b.id='updBar';b.setAttribute('role','status');
  const t=el('span',null,'A new version of Riddim Swap is ready.');const go=el('button','btn sm','Update now');
  go.addEventListener('click',reloadSaved);b.append(t,go);document.body.append(b);
}
async function checkUpdate(onReturn){
  if(!window.RS_HOSTED)return;
  const now=Date.now();if(now-UPD.checkedAt<(onReturn?20000:9*60000))return;UPD.checkedAt=now;
  const v=await serverVersion();if(!v)return;
  if(!UPD.boot){UPD.boot=window.RS_BUILD||v;if(v===UPD.boot)return}
  if(v===UPD.boot)return;
  UPD.ready=true;
  if(onReturn&&idleNow())reloadSaved();else showUpdateBar();
}
if(window.RS_HOSTED){
  /* the version this page was built as (stamped by the build), not whatever the server says now */
  UPD.boot=window.RS_BUILD||null;$('#appVer').textContent=UPD.boot?'This version: '+UPD.boot.replace(/^rs-/,''):'';
  serverVersion().then(v=>{UPD.checkedAt=Date.now();if(!UPD.boot){UPD.boot=v;$('#appVer').textContent=v?'This version: '+v.replace(/^rs-/,''):''}
    else if(v&&v!==UPD.boot){UPD.ready=true;let tried=null;try{tried=sessionStorage.getItem('rs-upd-try')}catch(e){}
      /* one automatic reload per new version; if the old page comes back anyway, show the Update bar instead of looping */
      if(tried!==v&&idleNow()){try{sessionStorage.setItem('rs-upd-try',v)}catch(e){}reloadSaved()}else showUpdateBar()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(true)});
  setInterval(()=>checkUpdate(false),10*60000);
}
$('#freshBtn').addEventListener('click',async()=>{
  if(S.rec)return; pause(); $('#freshBtn').disabled=true;
  try{await autosave(true)}catch(e){}
  LS.set('rs-proj','');   /* open on an empty project; the saved one stays in Projects */
  try{sessionStorage.setItem('rs-fresh','1')}catch(e){}
  location.reload();
});
if((()=>{try{const f=sessionStorage.getItem('rs-fresh');sessionStorage.removeItem('rs-fresh');return f==='1'}catch(e){return false}})())
  setTimeout(()=>{saveState('Fresh start. Your last project is in Projects.')},300);
/* erase: a second tap within 4 s confirms (no pop-up dialogs, they freeze some phones' web apps) */
let wipeArmed=0;
$('#wipeBtn').addEventListener('click',async()=>{
  const b=$('#wipeBtn');
  if(Date.now()-wipeArmed>4000){wipeArmed=Date.now();b.classList.add('armed');b.textContent='Tap again to erase all projects, videos and songs';
    setTimeout(()=>{if(Date.now()-wipeArmed>=4000){b.classList.remove('armed');b.textContent='Erase everything…'}},4100);return}
  b.disabled=true;b.textContent='Erasing…';if(S.rec)stopRecording();pause();
  const del=n=>new Promise(r=>{try{const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
  S.wiping=true;   /* no more saving: leaving the page would otherwise write the project straight back */
  try{if(dbP){const d=await dbP;d.close();dbP=null}}catch(e){}
  await Promise.all(['riddim-swap','riddim-bridge'].map(del));
  try{localStorage.clear()}catch(e){}try{sessionStorage.clear()}catch(e){}
  try{for(const k of await caches.keys())await caches.delete(k)}catch(e){}
  try{for(const g of await navigator.serviceWorker.getRegistrations())await g.unregister()}catch(e){}
  location.replace(location.pathname);
});
/* sound report for the last play (Projects): helps tell what a phone actually did */
const ERRS=[];
const noteErr=(m)=>{try{m=String(m||'').slice(0,160);if(!m)return;ERRS.push(new Date().toISOString().slice(11,19)+' '+m);if(ERRS.length>6)ERRS.shift()}catch(e){}};
window.addEventListener('error',e=>noteErr((e.message||'error')+(e.filename?' @'+String(e.filename).split('/').pop()+':'+e.lineno:'')));
window.addEventListener('unhandledrejection',e=>noteErr('promise: '+((e.reason&&(e.reason.message||e.reason.name))||e.reason)));
function soundReport(){const s=(S.snd&&S.snd.frames>10)?S.snd:S.sndLast;if(!s||!s.frames)return '';
  const secs=(performance.now()-s.started)/1000,pct=Math.round(100*s.within/s.frames);
  const span=((s.endAt||performance.now())-s.started)/1000, fps=span>0.5?Math.round(s.frames/span):0;
  return `Last play: song and video within 40 ms ${pct}% of the time, largest gap ${Math.round(s.maxLate*1000)} ms, ${s.jumps} song jump${s.jumps===1?'':'s'}${s.vjumps?`, video caught up ${s.vjumps} time${s.vjumps>1?'s':''}`:''}${s.stalls?`, ${s.stalls} video stall${s.stalls>1?'s':''}`:''} (over ${Math.round(span)} s, screen ${fps} fps).${(()=>{const L=S.alignLog||[];if(!L.length)return '';const w=L.map(x=>x.wait).sort((a,b)=>a-b),k=L.map(x=>x.seek).sort((a,b)=>a-b);return ` Study/Learn starts: ${L.length}, song started after ${w[w.length>>1]} ms (most ${w[w.length-1]} ms), seeking took ${k[k.length>>1]} ms${L.some(x=>!x.moving)?`, song didn't start ${L.filter(x=>!x.moving).length}×`:''}.`})()}`}
$('#projBtn').addEventListener('click',()=>{$('#sndReport').textContent=soundReport()});
async function phoneCheck(){
  const L=[],add=(k,v)=>{if(v!=null&&v!=='')L.push(k+': '+v)};
  L.push('Riddim Swap phone check');
  add('Version',(UPD&&UPD.boot)||'unknown'); add('When',new Date().toISOString().slice(0,16).replace('T',' ')+' UTC');
  add('Browser',navigator.userAgent);
  const sa=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  add('Screen',`${screen.width}×${screen.height} @${(window.devicePixelRatio||1).toFixed(1)}x, ${sa?'Home Screen app':'in the browser'}, ${navigator.hardwareConcurrency||'?'} cores${navigator.deviceMemory?', '+navigator.deviceMemory+' GB':''}`);
  let mr='none';try{if(window.MediaRecorder){const t=['video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x));mr=t||'yes (no listed type)'}}catch(e){}
  add('Recording',`WebCodecs ${canCodecs()?'yes':'no'} · MediaRecorder ${mr}${S.recLast?' · last take used '+(S.recLast==='mr'?'MediaRecorder':'WebCodecs'):''}`);
  const ti=$('#takeInfo');if(S.recLast&&ti&&ti.textContent)add('Last take',ti.textContent.replace(/\s+/g,' ').trim());
  const bodies=S.sources.map(n=>n.body).filter(B=>B&&B.n);
  if(bodies.length){const B=bodies.find(x=>x.msPerFrame)||bodies[0];add('Outline',B.mask&&B.mask.frames?(RB.maskUsable(B)?'ok (cut-out works)':'empty: track again'):'none');add('Tracking',`${bodies.length} video${bodies.length>1?'s':''} tracked · ${B.msPerFrame?Math.round(B.msPerFrame)+' ms/frame':'speed not recorded'} · ${B.delegate||'?'} · ${B.n} frames${B.fps?' at '+Math.round(B.fps)+' fps':''}${B.model?' · '+(/rtmpose/.test(B.model)?'RTMPose':/heavy/.test(B.model)?'Accurate':/full/.test(B.model)?'Faster':B.model.split(' ')[0])+(B.cleanV?'':' (old smoothing)'):''}${(()=>{const c=RB.coverage&&RB.coverage(B);return c?' · covers '+c.pct+'% of the clip':''})()}${B.stale!=null?' · stuck frames '+B.stale+(B.kicks?' (woken '+B.kicks+'×)':''):''}${B.rtmMs?' · RTMPose '+Math.round(B.rtmMs)+' ms/frame'+(B.rtmEp?' ('+B.rtmEp+')':''):''}`)}
  else add('Tracking','no video tracked in this project');
  add('Sound',soundReport()||'no play measured yet');
  try{const so=S.liveSong,R=so&&so.an&&so.an.riddim;add('Cues',`${S.beatView==='ball'?'Ball':S.beatView==='calm'?'Count':'Off'} · sound delay ${Math.round((S.sndDelay||0)*1000)} ms · riddim ${R?(R.sure?R.events.length+' hits, '+R.perBar.toFixed(1)+' a bar':'no clear drums'):'not found yet'}${so&&so.an?' · beat sure '+(songSure()?'yes':'no')+' (phase '+(so.an.phaseConf??1).toFixed(2)+')':''}`)}catch(e){}
  try{const sb=(S.mainSong&&S.mainSong.buf)||buf;add('Audio',`song decoded at ${(sb&&sb.sampleRate)||'?'} Hz · live sound engine ${ctx?'open ('+ctx.state+', '+ctx.sampleRate+' Hz)':'closed'}`+(S.decodeSlow?` · slow song decode ${S.decodeSlow}×`:'')+(S.songHealN?` · song player restarted ${S.songHealN}×`:''))}catch(e){}
  try{const r=await storageScan();const t=r.total!=null?Math.max(r.total,r.media+r.body+r.unused+r.projects):null;
    add('Storage',`${fmtMB(t)} in use${r.quota?' of '+fmtMB(r.quota):''} · media ${fmtMB(r.media)} · tracking ${fmtMB(r.body)} · unused ${fmtMB(r.unused)} · ${r.projectsN} project${r.projectsN===1?'':'s'} · ${r.persisted?'kept safe':'may be cleared by the browser'}`)}catch(e){add('Storage','couldn’t read')}
  add('Errors',ERRS.length?'\n  '+ERRS.join('\n  '):'none this session');
  return L.join('\n');
}
$('#phoneCheck').addEventListener('click',async()=>{const b=$('#phoneCheck'),out=$('#phoneCheckOut');b.disabled=true;
  let txt='';try{txt=await phoneCheck()}catch(e){txt='Phone check failed: '+(e&&e.message)}
  out.value=txt;out.hidden=false;out.style.height='';out.style.height=Math.min(320,out.scrollHeight+4)+'px';
  let ok=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(txt);ok=true}}catch(e){}
  if(!ok){try{out.focus();out.select();ok=document.execCommand&&document.execCommand('copy')}catch(e){}}
  sheetMsg(ok?'Phone check copied. Paste it into a message.':'Select the text below and copy it.');b.disabled=false});

/* ---------- hips on the beat ----------
   Hip hits: the moments a hip tilt stops sharply (tilt speed falls to under half of its peak in the last 0.2 s, the
   peak being among the faster 40% of moments), at least 0.15 s apart. Checked on your clip with its own song: tilt
   hits cluster at the beat and the "and" well above chance; side-to-side sway didn't, so tilt is used.
   Score: where each hit falls within its half beat (the beat or the "and"), as a direction on a circle. If hits keep
   landing at the same point the directions agree (strength R near 1); random timing gives about 1/√n. The test is
   Rayleigh's: n·R² above 3 means a real lock (p < 0.05), above 6 strong. The average direction says how early or late. */
function hipHits(B){
  if(B._hh&&B._hhN===B.n&&B._hhH===B.hips)return B._hh;
  RB.hipsAt(B,0); const n=B.n,t=[],a=[];
  for(let i=0;i<n;i++){t.push(B.data[i*RB.STRIDE]);const v=B.hips[i*RB.HS];a.push(v===v?v:null)}
  const s=new Array(n).fill(0);
  for(let i=1;i<n-1;i++){if(a[i-1]==null||a[i+1]==null)continue;s[i]=Math.abs((a[i+1]-a[i-1])/((t[i+1]-t[i-1])||1))/20}
  const sorted=s.filter(x=>x>0).sort((x,y)=>x-y), thr=Math.max(0.6,sorted.length?sorted[Math.floor(sorted.length*0.6)]:0.6), out=[];
  for(let i=2;i<n-2;i++){if(!(s[i]<=s[i-1]&&s[i]<=s[i+1])||a[i]==null)continue;let pk=0;for(let j=Math.max(0,i-6);j<i;j++)pk=Math.max(pk,s[j]);
    if(pk>=thr&&s[i]<=0.5*pk){if(out.length&&t[i]-out[out.length-1].t<0.15)continue;out.push({t:t[i],pk})}}
  B._hh=out;B._hhN=B.n;B._hhH=B.hips;return out;
}
/* the song's beats in the clip's own time (clip speed, song start, song speed and the speed graph all applied) */
function clipBeatTimes(){
  const G=liveGrid(); if(!G||!G.beats.length)return null; const g0=segs()[0], out=[];
  for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0)continue;const src=g0&&g0.k?(o>segLen(g0)?null:toSrc(g0,o)):S.cIn+o*S.vr;if(src==null||src>clipEnd()+0.5)continue;out.push(src)}
  return out.length>3?out:null;
}
function hipSync(n,B){
  const hits=hipHits(B).filter(h=>h.t>=S.cIn&&h.t<=clipEnd()), beats=clipBeatTimes(); if(!beats||hits.length<6)return null;
  /* the grid: beats split into 1, 2 or 4, keeping splits 0.18–0.62 s long (how often hips actually hit); a song read at
     half or double tempo still works. More than one split is tried, so the bar is higher: n·R² over 4 (p < 0.05 after
     allowing for the tries), over 7 strong. */
  let best=null;
  for(const div of [1,2,4]){
    let cx=0,cy=0,m=0,len=0;
    for(const h of hits){let k=-1;for(let i=0;i<beats.length-1;i++)if(beats[i]<=h.t&&h.t<beats[i+1]){k=i;break}if(k<0)continue;
      const span=beats[k+1]-beats[k],ph=(((h.t-beats[k])/span)*div)%1;cx+=Math.cos(2*Math.PI*ph);cy+=Math.sin(2*Math.PI*ph);m++;len+=span/div}
    if(m<6)continue;const cyc=len/m;if(cyc<0.18||cyc>0.62)continue;
    const R=Math.hypot(cx,cy)/m,Z=m*R*R,ph=Math.atan2(cy,cx)/(2*Math.PI);
    if(!best||Z>best.Z)best={n:m,R,Z,div,cycleMs:Math.round(cyc*1000),offsetMs:Math.round(ph*cyc*1000)};
  }
  if(!best)return null;best.beats=beats;best.lock=best.Z>7?'strong':best.Z>4?'some':'none';return best;
}
function hipBeatText(n,B){
  const r=hipSync(n,B);if(!r)return '';
  const off=Math.abs(r.offsetMs)<15?'right on it':Math.abs(r.offsetMs)+' ms '+(r.offsetMs<0?'early':'late');
  if(r.lock==='none')return `Hips on the beat: <b>not clearly</b>. ${r.n} hip hits, their timing doesn't settle on this song's beats yet.`;
  return `Hips on the beat: <b>${r.lock==='strong'?'locked in':'some lock'}</b>. ${r.n} hip hits keep landing in time with the beat (every ${r.cycleMs} ms), on average ${off}.`;
}

/* ---------- study a move ----------
   Loops 2 s around the playhead (1 s either side, inside the clip) at half speed. The song follows at half speed with
   its pitch kept, so it sounds slow rather than deep. Everything else (body, hip meter, beat lights) works as usual.
   Nothing is saved: tap again and the clip, speed and repeat are as they were. */
function songRate(){return S.ar*(S.study?S.study.rate:1)}
function studyUI(){const on=!!S.study&&!S.learn;$('#studyBtn').setAttribute('aria-pressed',String(on));$('#studyTag').hidden=!on;$('#studyBtn').disabled=!S.hasV||routineOn()||!!S.rec}
function studyOn(){
  if(!S.hasV||routineOn()||S.rec)return;
  const t=clamp(v.currentTime,S.cIn,clipEnd()),a0=Math.max(S.cIn,t-1),b0=Math.min(clipEnd(),a0+2),a1=Math.max(S.cIn,b0-2);
  S.study={a:a1,b:b0,rate:0.5,loop:S.loop}; S.loop=true;
  a.preservesPitch=true; a.webkitPreservesPitch=true;
  const was=S.playing; if(was)pause(); S.segIdx=0; v.currentTime=a1; studyUI(); updateTrim();
  setTimeout(()=>{if(S.study&&!S.playing)$('#play').click()},120);
}
function studyOff(){
  if(!S.study)return; const st=S.study; S.study=null; S.loop=st.loop;
  if(S.learn){S.learn=null;try{learnUI()}catch(e){}}
  a.preservesPitch=false; a.webkitPreservesPitch=false;
  if(S.playing)pause(); S.segIdx=0; studyUI(); updateTrim(); syncSong(true);
}
$('#studyBtn').addEventListener('click',()=>{if(S.learn){learnOff();studyOn()}else S.study?studyOff():studyOn()});
setInterval(()=>{try{studyUI()}catch(e){}},500);

/* ---------- compare your try with the original ----------
   Pick another video in the project (you dancing the same part). Both are body-tracked. They are lined up by
   movement: the hip-tilt and sway speeds are compared at every offset (and as a mirror image, for when you danced it
   facing the screen), and the best match wins. Lining up by movement removes any overall lateness, so timing is
   reported as drift inside the routine: each 2 s stretch is matched again within ±0.3 s, and stretches where you get
   ahead or behind by 80 ms or more are named. Also: how alike the hips are (correlation of tilt), how big your tilts
   are next to the original's, and the least alike stretch. */
function hipSeriesOn(B,a,b,step){
  RB.hipsAt(B,0);const n=B.n,S2=RB.STRIDE,H=RB.HS,N=Math.max(0,Math.floor((b-a)/step)+1),tilt=new Float32Array(N).fill(NaN),sway=new Float32Array(N).fill(NaN);
  let j=0;for(let k=0;k<N;k++){const t=a+k*step;while(j<n-2&&B.data[(j+1)*S2]<t)j++;const t0=B.data[j*S2],t1=B.data[(j+1)*S2];if(!(t1>t0)||t<t0-0.05||t>t1+0.05)continue;
    const u=Math.max(0,Math.min(1,(t-t0)/(t1-t0)));for(const [arr,o] of [[tilt,0],[sway,2]]){const x=B.hips[j*H+o],y=B.hips[(j+1)*H+o];if(x===x&&y===y)arr[k]=x+(y-x)*u}}
  return {a,step,tilt,sway,N};
}
function vel(x){const v=new Float32Array(x.length).fill(NaN);for(let i=1;i<x.length-1;i++){const p=x[i-1],q=x[i+1];if(p===p&&q===q)v[i]=(q-p)/2}return v}
function ncc(x,y,off,i0,i1){let sx=0,sy=0,n=0;for(let i=i0;i<i1;i++){const j=i+off;if(j<0||j>=y.length)continue;const a=x[i],b=y[j];if(a===a&&b===b){sx+=a;sy+=b;n++}}
  if(n<20)return {r:-2,n};const mx=sx/n,my=sy/n;let xy=0,xx=0,yy=0;for(let i=i0;i<i1;i++){const j=i+off;if(j<0||j>=y.length)continue;const a=x[i],b=y[j];if(a===a&&b===b){xy+=(a-mx)*(b-my);xx+=(a-mx)**2;yy+=(b-my)**2}}
  return {r:xx>0&&yy>0?xy/Math.sqrt(xx*yy):-2,n};}
function compareTry(refN,tryN){
  const Br=bodyOf(refN),Bt=bodyOf(tryN);if(!Br||!Bt)return null;const step=1/30;
  const ra=S.cIn,rb=clipEnd(),R=hipSeriesOn(Br,ra,rb,step),tEnd=Bt.data[(Bt.n-1)*RB.STRIDE],T=hipSeriesOn(Bt,Bt.data[0],tEnd,step);
  if(R.N<60||T.N<60)return {err:'Both videos need at least 2 s of tracked dancing.'};
  const rv=[vel(R.tilt),vel(R.sway)],tv=[vel(T.tilt),vel(T.sway)],sc=[1/8,1/0.12];
  const minOv=Math.floor(Math.min(R.N,T.N)*0.6);let best={r:-2};
  const tvm={1:tv,[-1]:tv.map(arr=>arr.map(x=>-x))};
  for(const mir of [1,-1])for(let off=-R.N;off<T.N;off++){
    const lo=Math.max(0,-off),hi=Math.min(R.N,T.N-off);if(hi-lo<minOv)continue;
    const a=ncc(rv[0],tvm[mir][0],off,lo,hi),b=ncc(rv[1],tvm[mir][1],off,lo,hi);if(a.r<-1)continue;
    const r=0.65*a.r+0.35*(b.r<-1?a.r:b.r);if(r>best.r)best={r,off,mir,lo,hi};
  }
  if(best.r<-1)return {err:'Not enough overlap between the two videos.'};
  const {off,mir,lo,hi}=best,tt=T.tilt.map(x=>x*mir),lag=T.a+off*step-R.a;   /* try time = original time + lag */
  const sim=ncc(R.tilt,tt,off,lo,hi).r;
  const rng=(arr,i0,i1,o)=>{const v=[];for(let i=i0;i<i1;i++){const x=arr[i+o];if(x===x)v.push(x)}v.sort((p,q)=>p-q);return v.length>10?v[Math.floor(v.length*0.9)]-v[Math.floor(v.length*0.1)]:0};
  const size=rng(R.tilt,lo,hi,0)>0?rng(tt,lo,hi,off)/rng(R.tilt,lo,hi,0):null;
  /* stretches: 2 s, every 1 s */
  const W=60,stretches=[];
  for(let s0=lo;s0+W<=hi;s0+=30){let mv=0,c=0;for(let i=s0;i<s0+W;i++){const x=rv[0][i];if(x===x){mv+=Math.abs(x);c++}}if(!c||mv/c<0.25)continue;   /* ref barely moving */
    let bl={r:-2,d:0};for(let d=-9;d<=9;d++){const q=ncc(rv[0],tvm[mir][0],off+d,s0,s0+W);if(q.r>bl.r)bl={r:q.r,d}}
    stretches.push({t0:R.a+s0*step,t1:R.a+(s0+W)*step,shiftMs:Math.round(bl.d*step*1000),alike:ncc(R.tilt,tt,off,s0,s0+W).r})}
  const weakest=stretches.filter(s=>s.alike>-2).sort((p,q)=>p.alike-q.alike)[0]||null;
  const drift=stretches.filter(s=>Math.abs(s.shiftMs)>=80);
  return {match:best.r,lag,mirrored:mir<0,similarity:sim,size,stretches,weakest,drift,overlap:[R.a+lo*step,R.a+hi*step],tryId:tryN.id,refId:refN.id,tt,off,step,ra:R.a};
}
const mmss=t=>{const m=Math.floor(t/60),s=Math.floor(t-m*60);return m+':'+(s<10?'0':'')+s};
function compareText(c){
  if(!c)return '';if(c.err)return c.err;
  if(c.match<0.3)return `These don't look like the same moves (best match ${Math.round(Math.max(0,c.match)*100)}%). Check you picked the right video, and that it shows the same part.`;
  const parts=[`<b>${Math.round(Math.max(0,c.similarity)*100)}% alike</b> hip tilt`];
  if(c.size!=null)parts.push(c.size<0.8?`your tilts are <b>${Math.round(c.size*100)}%</b> as big: go bigger`:c.size>1.25?`your tilts are <b>${Math.round(c.size*100)}%</b> as big: bigger than the original`:`your tilts are about the same size (${Math.round(c.size*100)}%)`);
  if(c.drift.length){const d=c.drift.reduce((p,q)=>Math.abs(q.shiftMs)>Math.abs(p.shiftMs)?q:p);parts.push(`you get <b>${d.shiftMs>0?'behind':'ahead'} by ${Math.abs(d.shiftMs)} ms</b> around ${mmss(d.t0)}–${mmss(d.t1)}`)}
  else parts.push('timing steady through the part');
  if(c.weakest&&c.weakest.alike<0.6)parts.push(`work on <b>${mmss(c.weakest.t0)}–${mmss(c.weakest.t1)}</b> (least alike)`);
  return 'Your try vs the original: '+parts.join(' · ')+'.'+(c.mirrored?' You danced it mirrored, so it was compared as a mirror image.':'')+(Math.abs(c.lag)<0.05?' Both start at the same moment.':c.lag>0?` The part starts ${c.lag.toFixed(1)} s into your video.`:` Your video starts ${(-c.lag).toFixed(1)} s into the original\u2019s part.`);
}
function cmpOptions(){
  const sel=$('#cmpPick'),cur=sel.value,others=S.sources.filter(n=>n.id!==S.cur&&!n.missing);
  const sig=others.map(n=>n.id+n.name).join('|')+S.cur;if(sel.dataset.sig===sig)return;sel.dataset.sig=sig;sel.innerHTML='';
  if(!others.length){const o=el('option',null,'Add a video of your try (+ Add video)');o.value='';sel.append(o)}
  for(const n of others){const o=el('option',null,n.name);o.value=n.id;sel.append(o)}if(cur&&others.some(n=>n.id===cur))sel.value=cur;
  $('#cmpGo').disabled=!others.length;
}
setInterval(()=>{try{cmpOptions();if(S.cmp&&S.cmp.refId!==S.cur){S.cmp=null;$('#cmpOut').textContent=''}}catch(e){}},700);
async function trackSourceQuiet(n,label){
  const B=await RB.track(n.url,{onProgress:p=>{$('#cmpOut').textContent=label+' '+Math.round(p*100)+'%'}});
  n.body=B;if(n.key)mediaPut('body:'+n.key,B).catch(()=>{});return B;
}
$('#cmpGo').addEventListener('click',async()=>{
  const ref=srcById(S.cur),tr=srcById($('#cmpPick').value);if(!ref||!tr||S.bodyBusy)return;
  const b=$('#cmpGo');b.disabled=true;S.bodyBusy=true;
  try{
    if(!bodyOf(ref)){await trackSourceQuiet(ref,'Tracking the original…')}
    if(!bodyOf(tr)){if(!tr.url)throw new Error('That video isn’t loaded.');await trackSourceQuiet(tr,'Tracking your try…')}
    $('#cmpOut').textContent='Lining them up…';await new Promise(r=>setTimeout(r,30));
    S.cmp=compareTry(ref,tr);$('#cmpOut').innerHTML=compareText(S.cmp);hipKey='';
  }catch(e){$('#cmpOut').textContent='Couldn’t compare: '+((e&&e.message)||e)}
  finally{S.bodyBusy=false;b.disabled=false}
});

/* ---------- hip patterns ----------
   Every 0.25 s, the last 1.5 s of hip measures is described, only when it's clear:
   still: tilt moves under 2° and sway under 0.025 torso (spread);
   otherwise the movement must repeat (the tilt or sway swings back: its autocorrelation dips below −0.1, then peaks
   again above 0.35; the first repeat gives the period). Then:
   hip circles (whine-like): sway and tilt or forward/back follow each other a quarter cycle apart (|r| > 0.5, and
   clearly more than in step), like a circle seen from the front;
   quick pulses: repeats faster than about 2.7 a second;
   tilts: side-to-side tilts over 3°; sways: hips shifting sideways (over 0.04 torso) with little tilt.
   Anything else is left unnamed. Runs shorter than 0.75 s are dropped. On made-up movements of each kind with
   real-sized wobble, every one was named right; random drifting was left unnamed 87% of the time (10% "still").
   On real dancing most stretches stay unnamed, because real dancing changes faster than one clean pattern. */
const PAT={circle:{name:'Hip circles',short:'Circles',col:'#B98BFF'},tilt:{name:'Tilts',short:'Tilts',col:'#FF5FA2'},pulse:{name:'Quick pulses',short:'Pulses',col:'#4FD1A1'},sway:{name:'Sways',short:'Sways',col:'#6E8BFF'},still:{name:'Still',short:'Still',col:'#7C8494'}};
function patAc(x,lo,hi){let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}if(c<10)return [0,0];m/=c;const y=x.map(v=>v===v?v-m:0);let d=0;for(const v of y)d+=v*v;if(d<=0)return [0,0];
  const r=[1];for(let L=1;L<=hi+1;L++){let s=0;for(let i=0;i+L<y.length;i++)s+=y[i]*y[i+L];r.push(s/d*y.length/(y.length-L))}
  let dip=-1;for(let L=1;L<hi;L++)if(r[L]<-0.1){dip=L;break}if(dip<0)return [0,0];
  for(let L=Math.max(dip,lo);L<=hi;L++)if(r[L]>=r[L-1]&&r[L]>=r[L+1])return [r[L],L];return [0,0]}
function patCorr(a,b){const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let xy=0,xx=0,yy=0;for(let i=0;i<n;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):0}
function patStd(x){let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}if(c<3)return NaN;m/=c;let s=0;for(const v of x)if(v===v)s+=(v-m)**2;return Math.sqrt(s/c)}
function patWindow(tilt,sway,thrust,k){
  const at=patStd(tilt),as=patStd(sway);if(!(at===at)||!(as===as))return null;
  if(at<2&&as<0.025)return 'still';
  const lo=Math.max(2,Math.round(5*k)),hi=Math.round(30*k);
  const [rt,Lt]=patAc(tilt,lo,hi),[rs,Ls]=patAc(sway,lo,hi);const [r,L]=rt*at/3>=rs*as/0.04?[rt,Lt]:[rs,Ls];
  if(r<0.35)return null;
  const q=Math.max(1,Math.round(L/4)),fill=x=>{let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}m=c?m/c:0;return x.map(v=>v===v?v-m:0)};
  const s=fill(sway);let circ=0,zero=0;
  for(const X0 of [tilt,thrust]){if(!X0)continue;const X=fill(X0);if(X.every(v=>v===0))continue;
    const c=Math.max(Math.abs(patCorr(s.slice(0,-q),X.slice(q))),Math.abs(patCorr(s.slice(q),X.slice(0,-q)))),z=Math.abs(patCorr(s,X));if(c>circ){circ=c;zero=z}}
  if(as>0.03&&circ>0.5&&zero<0.5&&circ-zero>0.2)return 'circle';
  if(L<=Math.round(11*k))return 'pulse';
  if(at>=3&&at/3>=as/0.04)return 'tilt';
  if(as>=0.04)return 'sway';
  return at>=3?'tilt':null;
}
function hipPatterns(B){
  if(B._pat&&B._patN===B.n&&B._patH===B.hips)return B._pat;
  RB.hipsAt(B,0);const n=B.n,S2=RB.STRIDE,H=RB.HS,fps=B.fps||30,k=fps/30,win=Math.round(1.5*fps),hop=Math.max(1,Math.round(0.25*fps));
  const col=o=>{const a=new Array(n);for(let i=0;i<n;i++)a[i]=B.hips[i*H+o];return a},T=col(0),Sw=col(2),Th=col(5);
  const slots=[];for(let s0=0;s0+win<=n;s0+=hop){const lab=patWindow(T.slice(s0,s0+win),Sw.slice(s0,s0+win),Th.slice(s0,s0+win),k);const c=s0+Math.floor(win/2);
    slots.push({t0:B.data[Math.max(0,c-Math.floor(hop/2))*S2],t1:B.data[Math.min(n-1,c+Math.ceil(hop/2))*S2],lab})}
  const runs=[];for(const s of slots){const L=runs[runs.length-1];if(L&&L.lab===s.lab&&s.t0-L.t1<0.2)L.t1=s.t1;else runs.push({...s})}
  const out=runs.filter(r=>r.lab&&r.t1-r.t0>=0.75);B._pat=out;B._patN=B.n;B._patH=B.hips;return out;
}
/* the main pattern in a stretch: the one covering most of it, if it covers at least 40% */
function patternIn(B,a,b){const cov={};for(const r of hipPatterns(B)){const o=Math.min(b,r.t1)-Math.max(a,r.t0);if(o>0)cov[r.lab]=(cov[r.lab]||0)+o}
  let best=null,bv=0;for(const [k,v] of Object.entries(cov))if(v>bv){bv=v;best=k}return best&&bv>=0.4*(b-a)?best:null}
function patSummary(n,B){const a=S.cIn,b=clipEnd(),tot={};let named=0;for(const r of hipPatterns(B)){const o=Math.min(b,r.t1)-Math.max(a,r.t0);if(o>0){tot[r.lab]=(tot[r.lab]||0)+o;named+=o}}
  if(!named)return 'Hip patterns: none clear enough to name in this clip (that’s common in mixed, fast dancing).';
  return 'Hip patterns (band under the graph): '+Object.entries(tot).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`<span style="display:inline-block;width:10px;height:6px;border-radius:2px;background:${PAT[k].col};margin-right:4px"></span>${PAT[k].name.toLowerCase()} ${Math.round(v/(b-a)*100)}%`).join(' · ')+' of the clip (the rest is mixed).'}
/* moves: a tag each, and a filter */
S.patFilter=S.patFilter||'all';
function movePattern(m){const n=srcById(m.src),B=n&&bodyOf(n);return B?patternIn(B,m.s,m.e):null}
function patFilterUI(){
  const box=$('#patFilter');const tags=S.moves.map(movePattern);const have=[...new Set(tags.filter(Boolean))];
  box.hidden=!have.length;const sig=have.join(',')+'|'+S.patFilter;if(box.dataset.sig===sig)return;box.dataset.sig=sig;box.textContent='';
  for(const k of ['all',...Object.keys(PAT).filter(k=>have.includes(k))]){const bt=el('button',null,k==='all'?'All':PAT[k].short);bt.type='button';bt.setAttribute('aria-pressed',String(S.patFilter===k));
    bt.addEventListener('click',()=>{S.patFilter=k;renderMoves()});box.append(bt)}
  if(S.patFilter!=='all'&&!have.includes(S.patFilter)){S.patFilter='all'}
}
/* test hook: only with #debug in the address */
/* tests only (#debug in the address): "More options" start open so older tests can reach every control; #debug-closed keeps the real default */
if(/debug/.test(location.hash)&&!/closed/.test(location.hash))document.querySelectorAll('details.more').forEach(d=>{d.open=true});
/*@timeline*/
/*@cues*/
/*@look*/
/*@learn*/
/*@snip*/
if(/debug/.test(location.hash))window.__rs={BCLK,clkWindows,clkCuts,clkNow,clkSet,clkPos,clkTime,clkCur,COG,cogTurn,cogTilt,clipToSong,songToClip,rateAt,addToSeq,syncSlot,rateOf,shiftBoth,liveGrid,get learn(){return S.learn},learnChunks,learnLoopDone,learnOn,learnOff,learnOpts,get snip(){return S.snip},SNIP,snipOn,snipOff,cpLoad,cpOf,cpTag,get TAP(){return TAP},tapResult,get liveBody(){return S.liveBody},learnCount,LOOK,STORE,PACKS,hitsOf,CUT,RTL,clipCut,segMode,seqTotal,segsFor,expected,CUE,lane,riddimEvents,dancerEvents,heardNow,songNow,countAt,setDelay,patWindow,hipPatterns,movePattern,renderMoves,compareTry,compareText,studyOn,studyOff,hipHits,hipSync,UPD,checkUpdate,get audioCtx(){return ctx},get songBuf(){return buf},S,RA,segs,tPos,srcById,routineOn,segLen,toOut,toSrc,spdRateAt,curveOf,SPD,curRate,v:()=>v};
/* ---------- frame loop ---------- */
const dLights=$$('#dBeats i'), sLights=$$('#sBeats i'), stage=$('#stage'), dBeatsEl=$('#dBeats'), sBeatsEl=$('#sBeats');
let lastSeg=-1;
function beat(pos,anchor,bpm){const bp=(pos-(anchor??0))*bpm/60, fl=Math.floor(bp);return {idx:((fl%4)+4)%4,pulse:(bp-fl)<0.14}}
function tick(){
  if(S.hasV){
    const ro=routineOn(), sm=segMode();
    if(document.activeElement!==$('#scrub'))$('#scrub').value=sm?tPos():v.currentTime;
    $('#time').textContent=sm?fmt(tPos())+' / '+fmt(segStart(segs().length,segs())):fmt(v.currentTime);
    if(S.rec||S.playing){
      const g=segs()[S.segIdx];
      /* a cut has finished seeking: carry on (while recording, the frame grabber confirms it, with a safety timeout) */
      if(S.switchPending&&g&&!v.seeking){const codec=S.rec&&S.rec.mode==='codecs';if(!codec||v.currentTime>g.s+0.6)S.switchPending=false}
      /* pre-roll: start the next move (hidden) its measured start-up time before the cut */
      const P=S.primed;
      if(P&&!P.started&&g&&!S.switchPending&&P.el.readyState>=2&&!P.el.seeking){
        const left=(g.e-v.currentTime)/Math.max(0.2,v.playbackRate);
        if(left<=P.pre+0.01){P.started=true;P.t0=performance.now();const pp=P.el.play();
          const mark=()=>{if(P.t0){const lat=(performance.now()-P.t0)/1000;S.preroll=clamp(0.7*(S.preroll||0.12)+0.3*lat,0.04,0.4);P.t0=0}};
          if(P.el.requestVideoFrameCallback)P.el.requestVideoFrameCallback(mark);else if(pp)pp.then(mark).catch(()=>{})}
      }
      /* at the cut, wait (briefly) until the pre-rolled move reaches its first frame */
      const waitNext=P&&P.started&&P.el.currentTime<P.park+P.pre*0.6&&(performance.now()-(P.t0||0))<300&&P.i===S.segIdx+1;
      if(g&&!S.switchPending&&v.currentTime>=g.e-0.02&&!waitNext){
        if(S.stopAtT!=null&&routineOn()&&segStart(S.segIdx+1,segs())>=S.stopAtT-0.02)pause(); else atSegEnd();
      }
      else{
        if(g&&g.k&&!S.switchPending){const r=vNudged(rateAt(g,v.currentTime));if(Math.abs(v.playbackRate-r)>0.004)v.playbackRate=r}
        if(S.rec&&S.rec.mode==='mr')drawFrame(); else if(S.rec&&!v.requestVideoFrameCallback)captureFrame(v.currentTime);
        syncSong(false); recSync(false);
      }
    }
    if(ro&&S.stopAtT!=null&&S.playing&&!S.switchPending&&tPos()>=S.stopAtT-0.02)pause();
    if(ro){
      const tot=segStart(segs().length,segs())||1; $('#seqHead').style.left=(tPos()/tot*100)+'%';
      const k=S.playing?S.segIdx:-1;
      if(k!==lastSeg){lastSeg=k;$$('#seqList .item').forEach(li=>li.classList.toggle('now',+li.dataset.i===k))}
    }
  } else if(S.hasA)$('#time').textContent=fmt(a.currentTime);
  clickTick(); drawBody(); drawCues(); try{learnTick()}catch(err){} try{tlTick()}catch(err){} if(S.playing&&!S.everPlayed){S.everPlayed=true;try{localStorage.setItem('rs-played','1')}catch(e){}} if(++dockTick%15===0){dockUpdate();startUpdate()}
  let d={idx:-1,pulse:false}, s={idx:-1,pulse:false};
  if(S.dBase&&S.hasV&&!v.paused)d=beat(v.currentTime,S.dAnchor,S.dBase);
  if(S.hasA&&!a.paused)s=countAt(heardNow());
  const bv=S.beatView, sOk=songSure(), dOk=danceSure();
  dBeatsEl.classList.toggle('unsure',!dOk); sBeatsEl.classList.toggle('unsure',!sOk);
  dLights.forEach((l,i)=>l.classList.toggle('on',bv!=='off'&&i===d.idx));
  sLights.forEach((l,i)=>l.classList.toggle('on',bv!=='off'&&i===s.idx));
  stage.classList.toggle('pulse-d',bv==='flash'&&dOk&&d.pulse);
  stage.classList.toggle('pulse-s',bv==='flash'&&sOk&&s.pulse);
  requestAnimationFrame(tick);
}
renderSources(); updateTrim(); showSlots(); applyRates(); renderMoves(); updateCutter(); renderBlind(); requestAnimationFrame(tick);
})();
