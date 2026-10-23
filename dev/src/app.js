
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

const fmt=t=>{if(!isFinite(t))t=0;const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1)};
const fmt2=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(2)};
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
  if(S.study)return [{src:S.cur,s:S.study.a,e:S.study.b,r:S.vr*S.study.rate}];
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
function expected(){if(S.study)return S.offset+((v.currentTime-S.cIn)/S.vr+(S.avComp||0))*S.ar;return S.offset+(S.variant&&S.variant.shift||0)+(tPos()+(S.avComp||0))*S.ar}
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
  if(S.loop){toStart();if(v.paused)v.play().catch(()=>{});syncSong(true)}
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
  $('#rOffset').max=Math.max(1,rd); set('#rOffset',r.offset); $('#rOffOut').textContent=fmt2(r.offset);
  set('#rARate',r.ar); $('#rARateOut').textContent='×'+r.ar.toFixed(2);
  set('#rVRate',r.vr); $('#rVRateOut').textContent='×'+r.vr.toFixed(2);
  $('#rFade').checked=!!r.fade;
  const miss=so=>so&&so.missing?' · needs re-adding':'';
  $('#audName').textContent=S.mainSong?S.mainSong.name+(md?' · '+fmt(md):'')+miss(S.mainSong):'No song yet';
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
function seekSong(e){a.currentTime=Math.max(0,e+songLead()*S.ar);S.seekCheck={at:performance.now()}}
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

function syncSteady(force){
  const e=expected()+(S.rec?0:(S.sndDelay||0)*S.ar), d=songDur(), live=S.playing&&!v.paused&&!S.stalled, now=performance.now(), snd=S.snd||(S.snd={jumps:0,maxLate:0,frames:0,within:0,started:now});
  const setV=n=>{S.vNudge=n;const g=segs()[S.segIdx];if(!g||S.switchPending)return;const r=vNudged(rateAt(g,v.currentTime));if(Math.abs(v.playbackRate-r)>0.006)v.playbackRate=r};
  if(!live||e<0||e>=d){
    if(S.vNudge)setV(0);
    if(!a.paused)a.pause();
    if(!live&&e>=0&&e<d&&Math.abs(a.currentTime-e)>0.03)a.currentTime=e;
    return;
  }
  if(a.paused){seekSong(e);setRate(songRate());a.play().catch(songFail);S.lastFix=now;S.driftEma=0;S.vI=0;setV(0);return}
  setRate(songRate());
  const drift=a.currentTime-e;   /* + = song ahead of the video */
  const busy=S.switchPending||v.seeking||a.seeking||now-(S.cutAt||0)<400;
  /* right after a jump: learn how late the song lands (once), never jump again for small errors */
  if(S.seekCheck&&now-S.seekCheck.at>400&&!busy&&a.readyState>=3){
    if(Math.abs(drift)<0.25){S.seekLead=clamp(songLead()-0.8*drift/S.ar,0,0.4);try{localStorage.setItem('rs-seeklead',String(S.seekLead))}catch(err){}}
    S.seekCheck=null;
  }
  if(force){S.lastFix=now;S.driftEma=0;snd.jumps++;seekSong(e);setV(0);return}
  if(S.seekCheck||busy)return;
  S.driftEma=0.8*(S.driftEma||0)+0.2*drift;
  snd.frames++;if(Math.abs(drift)<0.04)snd.within++;snd.maxLate=Math.max(snd.maxLate,Math.abs(drift));
  const limit=segMode()?0.5:0.35;
  if(Math.abs(S.driftEma)>limit&&now-S.lastFix>2000){S.lastFix=now;S.driftEma=0;snd.jumps++;seekSong(e);setV(0);return}
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
  $('#icoPlay').hidden=p; $('#icoPause').hidden=!p;
  $('#play').setAttribute('aria-label',p?'Pause':'Play');
}
function play(){
  S.playAt=performance.now(); if(S.snd&&S.snd.frames>10){S.snd.endAt=S.snd.endAt||performance.now();S.sndLast=S.snd} S.snd={jumps:0,maxLate:0,frames:0,within:0,started:performance.now()}; S.vNudge=0; S.vI=0;
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
  if(S.hasV)v.play().then(()=>{S.stalled=false;syncSong(true);recSync(true);primeNext()}).catch(err=>{setPlaying(false);a.pause();
    if(!err||err.name!=='AbortError'){if(healMedia(false))recMsg('Reloaded the video. Tap play again.')}});
}
function pause(){S.stopAtT=null;if(S.snd&&!S.snd.endAt&&S.playing)S.snd.endAt=performance.now();setPlaying(false);v.pause();a.pause();recStopSong()}
function toggle(){if(S.rec){stopRecording();return}S.playing?pause():play()}

function enable(){
  const hv=S.hasV;
  $('#play').disabled=!(hv||S.hasA);
  ['#scrub','#inRange','#setOut','#clearOut','#repeat','#markIn','#markOut'].forEach(id=>$(id).disabled=!hv);
  $$('[data-in]').forEach(b=>b.disabled=!hv);
  $('#recBtn').disabled=!(hv&&S.hasA&&buf);
  {const bn=srcById(S.cur);$('#bodyTrack').disabled=!(bn&&!bn.missing&&bn.url)||!!S.bodyBusy;$('#bodyTrack').textContent=bn&&bodyOf(bn)?'Track again':'Track body'}
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
    const n=S.sources.find(x=>x.el===el||x.el2===el); if(n)n.dur=el.duration;
    if(n&&n.el2===el)return;
    try{el.currentTime=Math.max(0.001,n&&n.cIn||0)}catch(e){}   /* makes iPhone draw the first frame */
    if(!me())return;
    v.playbackRate=curRate(); prepRec();
    if(n)$('#vidName').textContent=n.name+' · '+fmt(n.dur);
    renderSources(); updateTrim(); applyRates();
  });
  el.addEventListener('error',()=>{
    const n=S.sources.find(x=>x.el===el||x.el2===el);
    if(n&&n.blob&&n.errs<2){n.errs++;refreshSource(n);return}
    if(me())$('#vidName').textContent="This video can't play here";
  });
  el.addEventListener('seeked',()=>{if(me()){syncSong(!segMode());recSync(true)}});
  /* a short video hiccup no longer stops the song (that was a cut-out); only a stall over 0.6 s pauses it */
  el.addEventListener('waiting',()=>{if(!me()||S.switchPending||segMode())return;
    if(S.rec){S.stalled=true;a.pause();recStopSong();return}
    clearTimeout(S.stallTimer);S.stallTimer=setTimeout(()=>{if(me()&&el.readyState<3&&S.playing){S.stalled=true;a.pause();recStopSong();if(S.snd)S.snd.stalls=(S.snd.stalls||0)+1}},600)});  /* routine: the song keeps going */
  el.addEventListener('playing',()=>{if(me()){clearTimeout(S.stallTimer);S.stalled=false;syncSong(false);recSync(true)}});
  el.addEventListener('pause',()=>{if(me()&&S.playing&&!el.ended&&!S.rec&&!S.switchPending)pause()});
  el.addEventListener('ended',()=>{if(!me()||!(S.playing||S.rec))return;atSegEnd();if((S.playing||S.rec)&&v.paused)v.play().catch(()=>{})});
}
wire(v);
function mediaKey(f){return f.name+'|'+f.size+'|'+(f.lastModified||0)}
/* make a video slot; f can be null when restoring a project whose file isn't on this phone */
function createSource(f,meta){
  meta=meta||{};
  const vid=$('#vid'); let ve;
  if(!S.sources.some(x=>x.el===vid))ve=vid;
  else{ve=document.createElement('video');ve.setAttribute('playsinline','');ve.muted=true;ve.preload='auto';ve.classList.add('off');$('#stage').insertBefore(ve,$('#empty'));wire(ve)}
  const num=meta.num||++srcCount; if(num>srcCount)srcCount=num;
  const n={id:meta.id||('v'+num),num,el:ve,url:null,cIn:meta.cIn||0,cOut:meta.cOut??null,dur:0,pieces:Array.isArray(meta.pieces)?meta.pieces.map(p=>({s:+p.s,e:+p.e,on:!!p.on})):null,
    name:meta.name||(f?f.name.replace(/\.[^.]+$/,''):'')||('Video '+num),
    key:meta.key||(f?mediaKey(f):null), fname:meta.fname||(f&&f.name), size:meta.size||(f&&f.size), missing:!f, blob:f||null, errs:0,
    motion:meta.motion||null, curve:meta.curve||null};
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
  const place=()=>{if(rt)S.rtSong=so;else S.mainSong=so;S.liveSong=undefined;syncSlot();syncSong(true);updateMissing()};
  f.arrayBuffer()
    .then(ab=>decodeAudio(ab))
    .then(b=>{
      if(id!==loadIds[slotKey])return;
      so.buf=b; so.dur=b.duration; so.blob=encodeWav(b); so.ready=true; place(); analyzeSongObj(so,!restoring);
      msg(isVideo?'Using the sound from this video. Its picture is ignored.':(rt?'':'Song ready.'));
    })
    .catch(()=>{
      if(id!==loadIds[slotKey])return;
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
$('#scrub').addEventListener('input',e=>{const x=+e.target.value; if(segMode())seekT(x); else v.currentTime=x});
$('#origAudio').addEventListener('change',e=>{v.muted=!e.target.checked});

/* speeds */
$('#vRate').addEventListener('input',e=>setP(S.main,'vr',+e.target.value));
$('#aRate').addEventListener('input',e=>setP(S.main,'ar',+e.target.value));
$$('[data-v]').forEach(b=>b.addEventListener('click',()=>{
  const d=+b.dataset.v; setP(S.main,'vr',d===0?1:clamp(+(S.main.vr*(1+d)).toFixed(3),0.25,2.5));
}));
$('#rVRate').addEventListener('input',e=>setP(S.rt,'vr',+e.target.value));
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
  const ir=$('#inRange'); ir.max=d||1; if(document.activeElement!==ir)ir.value=S.cIn;
  $('#outVal').textContent=S.cOut!=null?fmt(S.cOut):(d?'End · '+fmt(d):'End');
  $('#clipNote').hidden=!ro;
  const f=$('#trimFill');
  if(sm||!d){f.style.left='0';f.style.right='0'} else {f.style.left=(S.cIn/d*100)+'%';f.style.right=(100-e/d*100)+'%'}
  $('#scrub').max=sm?Math.max(0.01,segStart(segs().length,segs())):(d||1);
  try{cutUI()}catch(err){}
  const r=$('#repeat'); r.classList.toggle('on',S.loop); r.setAttribute('aria-pressed',S.loop);
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
$('#repeat').addEventListener('click',()=>{S.loop=!S.loop;updateTrim()});

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
    drawFit(v); drawBodyOnTake(v,mediaTime);
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
  cv.width=vCfg.width; cv.height=vCfg.height;
  const target=new Mp4Muxer.ArrayBufferTarget();
  const muxer=new Mp4Muxer.Muxer({target,fastStart:'in-memory',firstTimestampBehavior:'offset',
    video:{codec:vCfg.mux||'avc',width:vCfg.width,height:vCfg.height},
    audio:{codec:aCfg.mux||'aac',numberOfChannels:aCfg.numberOfChannels,sampleRate:aCfg.sampleRate}});
  const R={mode:'codecs',segs:segs().map(g=>({src:g.src,s:g.s,e:g.e,r:segR(g),k:g.k})),fade:routineOn()&&S.rt.fade,muxer,target,vr:S.vr,ar:S.ar,offset:S.offset+(S.variant&&S.variant.shift||0),lastTs:-1,lastKey:0,frames:0,failed:null};
  R.ve=new VideoEncoder({output:(c,m)=>{try{muxer.addVideoChunkRaw(rawChunk(c),c.type,c.timestamp,okDur(c.duration)?c.duration:33333,m)}catch(e){R.failed=e}},error:e=>{R.failed=e}});
  R.ve.configure(vCfg);
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
    out[n.key]={v:B.v||1,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,seen:B.seen,multi:B.multi||0,clean:B.clean||null,pick:B.pick||null,start:B.start,end:B.end,
      data:f32ToB64(B.data),world:f32ToB64(B.world),hips:f32ToB64(B.hips)}}
  return out;
}
async function bodiesFromBackup(bodies){
  let k=0;if(!bodies||typeof bodies!=='object')return 0;
  for(const [key,o] of Object.entries(bodies)){try{
    if(!o||!o.n||typeof o.data!=='string')continue;const data=b64ToF32(o.data);if(!data||data.length!==o.n*RB.STRIDE)continue;
    const have=await mediaGet('body:'+key);if(have&&have.data&&have.n)continue;   /* never replace tracking already on this phone */
    const B={...o,data,world:b64ToF32(o.world),hips:b64ToF32(o.hips),mask:null};await mediaPut('body:'+key,B);k++}catch(e){}}
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
    if(S.cutOn&&RB.hasCutout(B))RB.cutout(cx,B,t,el,rect,{bg:S.cutBg,colour:'#2B2F6B'});
    if($('#bodyShow').checked)RB.draw(cx,B,t,rect,{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked,meter:$('#hipShow').checked,tiltGuide:$('#hipShow').checked});
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
function drawFrame(){if(v.readyState>=2){drawFit(v);drawBodyOnTake(v,v.currentTime)}}
function startMrRec(){
  const c=getCtx(); c.resume().catch(()=>{});
  if(!recDest)recDest=c.createMediaStreamDestination();
  const [w,h]=recSize(); cv.width=w; cv.height=h; drawFrame();
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
  const useCodecs=!!(vCfg&&aCfg&&buf&&canCodecs());
  if(!useCodecs&&!(window.MediaRecorder&&cv.captureStream)){recMsg("This browser can't record video.",true);return}
  pause(); S.preview=null; S.segIdx=0; recMsg(''); updateTrim();
  const L=segs(), len=segStart(L.length,L);
  try{S.rec=useCodecs?startCodecRec():startMrRec();S.recLast=S.rec&&S.rec.mode;if(/debug/.test(location.hash))window.__lastRecMode=S.rec&&S.rec.mode}
  catch(e){S.rec=null;recMsg("Couldn't start recording on this device.",true);return}
  toStart(); if(useCodecs)S.switchPending=true;
  play();
  if(useCodecs)watchFrames(v);
  $('#recBtn').textContent='Stop'; $('#recDot').hidden=false;
  recMsg('Recording '+(routineOn()?'the routine':'the clip')+' · '+fmt(len));
}
function stopRecording(){
  const R=S.rec; if(!R)return; S.rec=null;
  pause();
  $('#recBtn').textContent='Record'; $('#recDot').hidden=true;
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
      cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut,motion:n.motion||null,curve:n.curve||null,pieces:n.pieces&&n.pieces.some(p=>!p.on)||n.pieces&&n.pieces.length>1?n.pieces:null})),
    beatSrc:S.beatSrc, blind:S.blind?{key:S.blind.key,ratings:S.blind.ratings,at:S.blind.at,revealed:!!S.blind.revealed}:null,
    cur:S.cur, moves:S.moves, seq:S.seq, main:S.main, rt:S.rt, loop:S.loop, useSeq:S.useSeq,
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
const isKept=(keep,k)=>keep.has(k)||(String(k).startsWith('body:')&&keep.has(String(k).slice(5)));
function sizeOf(v){
  if(!v)return 0; if(typeof Blob!=='undefined'&&v instanceof Blob)return v.size;
  if(v.data&&v.data.byteLength!=null){let s=2048;for(const f of ['data','world','hips'])if(v[f]&&v[f].byteLength)s+=v[f].byteLength;return s}
  if(v.byteLength!=null)return v.byteLength;
  try{return JSON.stringify(v).length}catch(e){return 0}
}
/* walk the media store with a cursor so nothing is read twice; blobs stay on disk, only their size is asked */
async function storageScan(){
  const keep=await mediaKeep(), out={media:0,body:0,unused:0,unusedN:0,projects:0,projectsN:0,total:null,quota:null,persisted:null};
  await idb().then(d=>new Promise((res,rej)=>{const t=d.transaction('media','readonly'),r=t.objectStore('media').openCursor();
    r.onsuccess=()=>{const c=r.result;if(!c)return;const k=String(c.key),sz=sizeOf(c.value);
      if(!isKept(keep,k)){out.unused+=sz;out.unusedN++}else if(k.startsWith('body:'))out.body+=sz;else out.media+=sz;c.continue()};
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
  if(n.body===undefined){n.body=null;mediaGet('body:'+n.key).then(b=>{if(b&&b.data&&b.n){n.body=b;renderDance()}}).catch(()=>{})}
  return n.body;
}
try{const v0=localStorage.getItem('rs-body');if(v0==='0')$('#bodyShow').checked=false;const h0=localStorage.getItem('rs-hip');if(h0==='0')$('#hipShow').checked=false}catch(e){}
$('#bodyShow').addEventListener('change',e=>{try{localStorage.setItem('rs-body',e.target.checked?'1':'0')}catch(err){}});
$('#hipShow').addEventListener('change',e=>{try{localStorage.setItem('rs-hip',e.target.checked?'1':'0')}catch(err){}});
const bodyCv=$('#bodyCanvas'); let bodyDrawn=false, dockTick=0;
let bodyKey='';
function drawBody(){
  {const el0=curVid(),r0=bodyCv.getBoundingClientRect();const k=[el0&&el0.currentTime,S.playing,S.bodyPicking,S.cutOn,S.cutBg,$('#bodyShow').checked,$('#hipShow').checked,Math.round(r0.width),Math.round(r0.height),S.cur,el0&&el0.videoWidth,(()=>{const q=el0&&srcOfEl(el0);return q&&q.body?q.body.n+':'+!!q.body.mask:0})(),S.bodyBusy].join('|');
   if(!S.playing&&k===bodyKey)return; bodyKey=k}
  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;
  if(S.bodyPicking&&!on){const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);bodyDrawn=true;return}
  if(!on){if(bodyDrawn){const c=bodyCv.getContext('2d');c.clearRect(0,0,bodyCv.width,bodyCv.height);bodyDrawn=false}return}
  const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}
  const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);
  const rect=RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h);
  if(S.cutOn&&RB.hasCutout(B))RB.cutout(c,B,el.currentTime,el,rect,{bg:S.cutBg,colour:'#2B2F6B'});
  if($('#bodyShow').checked)RB.draw(c,B,el.currentTime,RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h),{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked,meter:$('#hipShow').checked,tiltGuide:$('#hipShow').checked,reserveBottom:(($('#dock')&&!$('#dock').hidden)?$('#dock').getBoundingClientRect().height+20:0)*dpr});
  if(S.bodyPicking){c.save();c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);c.restore()}
  bodyDrawn=true;
}
/* hits from the body: stops and turns of the limbs and hips (RA.analyzePose); your own marked hits are kept */
function hitsFromBody(n){
  const B=bodyOf(n); if(!B)return false;
  const m=RA.analyzePose(RB.framesOf(B)); if(!m||m.beats.length<3)return false;
  const mine=n.motion&&n.motion.beats?n.motion.beats.filter(b=>b.mine):[];
  if(n.motion&&n.motion.source!=='pose')n.motionImg=n.motion;
  n.motion=Object.assign(m,{beats:m.beats.concat(mine).sort((a,b)=>a.t-b.t),edited:mine.length>0,source:'pose',confirmed:false});
  return true;
}
$('#bodyTrack').addEventListener('click',async()=>{
  const n=srcById(S.cur); if(!n||n.missing||!n.url||S.bodyBusy)return;
  S.bodyBusy=true; S.bodyT0=null; S.bodyLeft=''; $('#bodyTrack').disabled=true; $('#bodyProg').hidden=false; const bar=$('#bodyProg i'); bar.style.width='0';
  $('#bodyInfo').textContent='Loading the body tracker (first time needs a connection)…';
  try{
    const B=await RB.track(n.url,{pick:S.bodyPick&&S.bodyPick.src===n.id?S.bodyPick:null,onProgress:p=>{if(!S.bodyT0)S.bodyT0={t:performance.now(),p};S.bodyPct=Math.round(p*100);bar.style.width=S.bodyPct+'%';S.bodyLeft=etaText(S.bodyT0,p);$('#bodyInfo').textContent='Tracking the body on every frame… '+S.bodyPct+'%'+(S.bodyLeft?' · '+S.bodyLeft:'');dockUpdate()}});
    n.body=B; if(n.key)mediaPut('body:'+n.key,B).catch(()=>{});
    const got=hitsFromBody(n);
    $('#bodyInfo').textContent=bodyInfoText(n,B)+(got?' Hits now come from the body.':'');
    if(got&&n.id===S.cur&&(!S.dBase||S.danceSrc!=='tapped')){S.dBase=+n.motion.bpm.toFixed(1);S.danceSrc='detected';$('#dBpm').value=S.dBase.toFixed(1)}
  }catch(e){$('#bodyInfo').textContent='Body tracking didn’t run: '+((e&&e.message)||e)}
  finally{S.bodyBusy=false;$('#bodyProg').hidden=true;enable();renderDance();renderMoves();updateMatch();scheduleFit();drawHitStrip()}
});

/* ---------- quick controls on the video ---------- */
S.cutOn=false; S.cutBg='dark'; try{S.everPlayed=localStorage.getItem('rs-played')==='1'}catch(e){}
try{S.cutBg=localStorage.getItem('rs-cutbg')||'dark'}catch(e){}
function dockUpdate(){
  const n=srcById(S.cur), B=n&&bodyOf(n), show=!!(S.hasV&&window.RS_HOSTED);
  $('#dock').hidden=!show; if(!show)return;
  const bb=$('#dkBody');
  if(S.bodyBusy){bb.querySelector('span').textContent='Tracking '+(S.bodyPct||0)+'%'+(S.bodyLeft?' · '+S.bodyLeft.replace('about ','').replace(' left',''):'');bb.setAttribute('aria-pressed','false');bb.disabled=true}
  else{bb.disabled=false;bb.querySelector('span').textContent=B?'Body':'Track body';bb.setAttribute('aria-pressed',String(!!B&&$('#bodyShow').checked))}
  $('#dkHips').hidden=!B; $('#dkHips').setAttribute('aria-pressed',String($('#hipShow').checked));
  const canCut=!!(B&&RB.hasCutout(B)); $('#dkCut').hidden=!canCut; $('#dkCut').setAttribute('aria-pressed',String(canCut&&S.cutOn));
  $('#dkBg').hidden=!(canCut&&S.cutOn); $$('#dkBg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bg===S.cutBg)));
}
$('#dkBody').addEventListener('click',()=>{const n=srcById(S.cur);if(!n)return;
  if(!bodyOf(n)){$('#bodyTrack').click();return}
  $('#bodyShow').checked=!$('#bodyShow').checked;$('#bodyShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkHips').addEventListener('click',()=>{$('#hipShow').checked=!$('#hipShow').checked;$('#hipShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkCut').addEventListener('click',()=>{S.cutOn=!S.cutOn;dockUpdate()});
$$('#dkBg button').forEach(b=>b.addEventListener('click',()=>{S.cutBg=b.dataset.bg;try{localStorage.setItem('rs-cutbg',S.cutBg)}catch(e){}dockUpdate()}));
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
  const n=srcById(S.cur);
  if(!n||n.missing||!n.blob){hMsg('Add this video again first: its file isn’t loaded on this phone.');return false}
  const B=bodyOf(n);
  /* the song goes too, with what's needed to keep it in time with the clip: song = offset + (clip time - cIn) × ar / vr
     (offset includes the same corrections the player uses, and the sound delay) */
  let song=null;const so=S.liveSong;
  if(so&&so.ready&&!so.missing){let sb=so.blob||null;if(!sb)try{sb=await mediaGet(so.key)}catch(e){}
    if(sb&&sb.size)song={blob:sb,name:so.name||'Song',offset:S.offset+(S.variant&&S.variant.shift||0)+((S.avComp||0)+(S.sndDelay||0))*S.ar,ar:S.ar,vr:S.vr,cIn:S.cIn}}
  try{const id=await handOff('clip',n.blob,n.fname||n.name||'clip.mp4',{trim:[S.cIn,clipEnd()],hits:(n.motion&&hitsOf(n).map(b=>b.t))||null,song,
      body:B?{v:B.v,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:B.data,mask:B.mask||null,world:B.world||null,hips:B.hips||null,multi:B.multi||0}:null});goMirror(id);return true}
  catch(e){hMsg('Couldn’t open the clip in Body on this phone ('+(e&&e.message||e)+').');return false}
}
$('#mvClip').addEventListener('click',sendClip);
/* coming back from MirrorView's bottom bar: open the section that was tapped there */
function takeTabReq(){let r=null,pj=null;try{r=localStorage.getItem('rs-tab-req');localStorage.removeItem('rs-tab-req');pj=localStorage.getItem('rs-open-proj');localStorage.removeItem('rs-open-proj')}catch(e){}const t=r&&document.getElementById(r);if(t&&t.getAttribute('role')==='tab')t.click();
  if(pj)setTimeout(()=>$('#projBtn').click(),200)}   /* Projects tapped in Body */
window.addEventListener('pageshow',takeTabReq); setTimeout(takeTabReq,0);
$('#t-body').addEventListener('click',()=>{const n=srcById(S.cur);if(n&&!n.missing&&n.blob&&!routineOn())sendClip();else goMirror(null)});
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
  {const B=n&&bodyOf(n);if(!S.bodyBusy)$('#bodyInfo').textContent=B?bodyInfoText(n,B)+(n.motion&&n.motion.source==='pose'?' Hits come from the body.':''):'Track body follows the dancer on every frame (pelvis, hips, feet and hands) and draws it over the video. It plays the clip through once, silently.'}
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
const SPD={min:-2,max:2,sel:-1,undo:[],cache:null,ver:0,drag:null,lastTap:null};
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
  return {cv,w,h,dpr,pad,s,e,
    X:t=>pad.l+(t-s)/((e-s)||1)*(w-pad.l-pad.r),
    T:x=>s+(x-pad.l)/((w-pad.l-pad.r)||1)*(e-s),
    Y:y=>pad.t+(SPD.max-y)/(SPD.max-SPD.min)*(h-pad.t-pad.b),
    V:py=>SPD.max-(py-pad.t)/((h-pad.t-pad.b)||1)*(SPD.max-SPD.min)};
}
function spdVisible(){const p=$('#p-clip');return S.hasV&&p&&!p.hidden&&$('#spdCard').offsetParent!==null}
function spdDraw(){
  if(!spdVisible())return;
  const G0=spdGeo(),{cv,w,h,dpr,pad,X,Y,s,e}=G0,x=cv.getContext('2d'); x.clearRect(0,0,w,h);
  const n=spdCur(), c=n&&n.curve&&n.curve.pts&&n.curve.pts.length?n.curve:null, on=!!curveOf(n);
  /* top strip: where you drag to move through the clip */
  x.fillStyle='#1C2028'; x.fillRect(0,0,w,pad.t-12*dpr);
  /* grid: ¼× ½× 1× 2× 4× */
  x.font=`700 ${12*dpr}px Figtree,sans-serif`; x.textBaseline='middle'; x.textAlign='right';
  [[-2,'¼×'],[-1,'½×'],[0,'1×'],[1,'2×'],[2,'4×']].forEach(([y,l])=>{const py=Y(y);x.strokeStyle=y===0?'#3A4152':'#262B35';x.lineWidth=(y===0?1.5:1)*dpr;x.beginPath();x.moveTo(pad.l,py);x.lineTo(w-pad.r,py);x.stroke();x.fillStyle=y===0?'#F3F1EC':'#7C8494';x.fillText(l,pad.l-8*dpr,py)});
  x.textAlign='right'; x.fillStyle='#7C8494'; x.font=`700 ${10*dpr}px Figtree,sans-serif`; x.fillText('FASTER ↑',w-pad.r-4*dpr,pad.t+10*dpr); x.fillText('SLOWER ↓',w-pad.r-4*dpr,h-pad.b-10*dpr);
  /* seconds along the bottom */
  x.fillStyle='#7C8494'; x.font=`500 ${10*dpr}px JetBrains Mono,monospace`; x.textAlign='center';
  const span=e-s, stepS=span>40?10:span>16?5:span>6?2:1;
  for(let t=Math.ceil(s/stepS)*stepS;t<=e;t+=stepS){const px=X(t);x.fillRect(px,h-pad.b,dpr,4*dpr);x.fillText(t.toFixed(0)+'s',px,h-pad.b+12*dpr)}
  /* dance hits (blue, bottom) and song beats where they land with this curve (orange, top) */
  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n)){if(b.t<s||b.t>e)continue;x.fillRect(X(b.t)-dpr,h-pad.b-10*dpr,2*dpr,10*dpr)}}
  const G=liveGrid(), g0=segs()[0];
  if(G&&g0&&!routineOn()){x.fillStyle=tok('--song-hot');const tot=segLen(g0);for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0||o>tot)continue;const t=toSrc(g0,o);x.fillRect(X(t)-dpr*0.75,pad.t-24*dpr,1.5*dpr,10*dpr)}}
  /* the curve */
  x.lineJoin='round'; x.lineCap='round';
  if(c){const L=spdPolyOf(c);x.strokeStyle=on?'#F3F1EC':'#7C8494';x.lineWidth=3*dpr;x.beginPath();
    x.moveTo(pad.l,Y(L[0][1]));L.forEach(([t,y])=>x.lineTo(X(clamp(t,s,e)),Y(y)));x.lineTo(w-pad.r,Y(L[L.length-1][1]));x.stroke();
    /* handles of the selected point */
    const p=c.pts[SPD.sel];
    if(p){x.strokeStyle='#FFD43B';x.lineWidth=1.5*dpr;x.fillStyle='#FFD43B';
      for(const hd of [p.hi,p.ho]){const hx=X(p.t+hd[0]),hy=Y(clamp(p.y+hd[1],SPD.min-1,SPD.max+1));x.beginPath();x.moveTo(X(p.t),Y(p.y));x.lineTo(hx,hy);x.stroke();x.beginPath();x.arc(hx,hy,5*dpr,0,7);x.fill()}}
    c.pts.forEach((q,i)=>{const px=X(q.t),py=Y(q.y),r=(i===SPD.sel?9:7)*dpr;x.fillStyle=i===SPD.sel?'#FFD43B':'#14171D';x.strokeStyle='#FFD43B';x.lineWidth=2.5*dpr;x.beginPath();x.rect(px-r,py-r,2*r,2*r);x.fill();x.stroke()});
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
  const g=segs()[0], base=S.hasV&&!ro?(clipEnd()-S.cIn)/(S.vr||1):0;
  $('#spdLen').textContent=S.hasV&&!ro&&g?(on?fmt(base)+' → '+fmt(segLen(g)):fmt(base)):'—';
  $('#spdNote').textContent=ro?'The speed graph works on the whole clip. Switch to "Clip" under the video to use it.':'Blue ticks are the dance hits and orange ticks are the song’s beats, where they land with this curve. Drag along the top strip to move through the clip.';
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
/* touch and mouse on the graph */
(function(){
  const cv=$('#spdCanvas');
  function hit(ev){
    const G=spdGeo(),r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)*G.dpr,py=(ev.clientY-r.top)*G.dpr;
    const n=spdCur(),c=n&&n.curve&&n.curve.pts&&n.curve.pts.length?n.curve:null,R=22*G.dpr;
    let what=null;
    if(c){/* nearest target wins; points count as a little nearer than handles */
      let best=R;const p=c.pts[SPD.sel];
      c.pts.forEach((q,i)=>{const d=Math.hypot(G.X(q.t)-px,G.Y(q.y)-py)*0.75;if(d<best){best=d;what={type:'point',i}}});
      if(p)for(const [k,hd] of [['hi',p.hi],['ho',p.ho]]){const hx=G.X(p.t+hd[0]),hy=G.Y(clamp(p.y+hd[1],SPD.min-1,SPD.max+1));const d=Math.hypot(hx-px,hy-py);if(d<best){best=d;what={type:'handle',k}}}}
    if(!what&&py<G.pad.t-10*G.dpr)what={type:'scrub'};
    if(!what&&px>=G.pad.l-6*G.dpr)what={type:'add'};
    return {G,px,py,c,n,what};
  }
  function seekTo(G,px){if(S.playing)pause();const t=clamp(G.T(px),S.cIn,clipEnd());S.segIdx=0;v.currentTime=t;spdDraw();spdNowText()}
  cv.addEventListener('pointerdown',ev=>{
    if(!S.hasV||routineOn())return;
    const H=hit(ev); if(!H.what)return; ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
    const {G,n,what}=H;
    if(what.type==='scrub'){SPD.drag={type:'scrub'};seekTo(G,H.px);return}
    const c=spdEnsure(n);
    if(what.type==='add'){
      spdPush(); if(!c.pts.length)c.pts=[{t:S.cIn,y:0,auto:true},{t:clipEnd(),y:0,auto:true}];
      const t=clamp(G.T(H.px),S.cIn,clipEnd()), y=clamp(G.V(H.py),SPD.min,SPD.max);
      c.pts.push({t,y,auto:true}); c.pts.sort((a,b)=>a.t-b.t); c.on=true; SPD.sel=c.pts.findIndex(p=>p.t===t);
      spdAutoAll(c); SPD.drag={type:'point'}; spdChanged(); return;
    }
    if(what.type==='point'){
      const now=performance.now();
      if(SPD.lastTap&&SPD.lastTap.i===what.i&&now-SPD.lastTap.at<350&&c.pts.length>1){spdPush();c.pts.splice(what.i,1);SPD.sel=-1;SPD.lastTap=null;spdAutoAll(c);spdChanged();return}
      SPD.lastTap={i:what.i,at:now}; spdPush(); SPD.sel=what.i; SPD.drag={type:'point'}; spdDraw(); spdUI(); return;
    }
    if(what.type==='handle'){spdPush();SPD.drag={type:'handle',k:what.k};c.pts[SPD.sel].auto=false;return}
  });
  cv.addEventListener('pointermove',ev=>{
    const D=SPD.drag; if(!D)return; const G=spdGeo(),r=cv.getBoundingClientRect(),px=(ev.clientX-r.left)*G.dpr,py=(ev.clientY-r.top)*G.dpr;
    if(D.type==='scrub'){seekTo(G,px);return}
    const n=spdCur(),c=n&&n.curve,p=c&&c.pts[SPD.sel]; if(!p)return;
    if(D.type==='point'){
      const i=SPD.sel,P=c.pts,lo=i>0?P[i-1].t+0.05:S.cIn,hi=i<P.length-1?P[i+1].t-0.05:clipEnd();
      p.t=clamp(G.T(px),lo,Math.max(lo,hi)); p.y=clamp(G.V(py),SPD.min,SPD.max);
      if(Math.abs(p.y)<0.06)p.y=0;   /* snaps to normal speed */
    } else {
      const dx=G.T(px)-p.t, dy=G.V(py)-p.y;
      if(D.k==='ho'){p.ho=[Math.max(0,dx),dy];const L=Math.hypot(p.hi[0],p.hi[1])||0.3,M=Math.hypot(p.ho[0],p.ho[1])||1;p.hi=[-p.ho[0]/M*L,-p.ho[1]/M*L]}
      else {p.hi=[Math.min(0,dx),dy];const L=Math.hypot(p.ho[0],p.ho[1])||0.3,M=Math.hypot(p.hi[0],p.hi[1])||1;p.ho=[-p.hi[0]/M*L,-p.hi[1]/M*L]}
    }
    spdAutoAll(c); spdChanged();
  });
  const end=()=>{SPD.drag=null};
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
})();
/* keep the graph, the playhead and the readout live */
let spdKey='';
(function spdLoop(){try{if(spdVisible()){const n=spdCur(),c=$('#spdCanvas').getBoundingClientRect();
  const k=[SPD.ver,SPD.sel,n&&n.curve?JSON.stringify(n.curve):'',Math.round(c.width),Math.round(c.height),Math.round(v.currentTime*15),S.cIn,clipEnd(),S.vr,S.offset,S.ar,n&&n.motion&&hitsOf(n).length,liveGrid()&&liveGrid().beats.length].join('|');
  if(k!==spdKey){spdKey=k;spdDraw();spdNowText()}}}catch(e){}requestAnimationFrame(spdLoop)})();
setInterval(()=>{try{spdUI()}catch(e){}},500);
$('#t-clip').addEventListener('click',()=>setTimeout(()=>{spdUI();spdDraw()},0));

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
  const f=()=>pin.classList.toggle('stuck',(window.scrollY||document.documentElement.scrollTop)>4&&pin.getBoundingClientRect().top<=1);window.addEventListener('scroll',f,{passive:true});window.addEventListener('resize',f);f()})();
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

/* ---------- hips you can read ---------- */
/* "about 1 min left": from the rate so far, once there is enough to go on */
function etaText(t0,p){if(!t0||p-t0.p<0.03)return '';const el=(performance.now()-t0.t)/1000,left=el*(1-p)/(p-t0.p);if(!isFinite(left)||left<0)return '';
  return left<45?'about '+Math.max(5,Math.round(left/5)*5)+' s left':'about '+Math.round(left/60)+' min left'}
function bodyInfoText(n,B){
  let t=`Body tracked on ${B.seen} of ${B.n} frames.`;
  if(B.v<2)t+=' Tracked with the older tracker: Track again for steadier tracking, hip turn and following one dancer.';
  else if(B.multi&&B.multi>0.1*B.n)t+=` More than one person in ${Math.round(B.multi/B.n*100)}% of frames: following ${B.pick?'the dancer you chose':'the biggest one'}. Use "Choose the dancer" to follow someone else.`;
  if(B.clean&&B.clean.flips)t+=` Fixed ${B.clean.flips} left/right mix-up${B.clean.flips>1?'s':''}.`;
  return t;
}
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
  const x=(e.clientX-r.left-rect.x)/rect.w, y=(e.clientY-r.top-rect.y)/rect.h; if(x<0||x>1||y<0||y>1)return;
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
  if(!UPD.boot){UPD.boot=v;return}
  if(v===UPD.boot)return;
  UPD.ready=true;
  if(onReturn&&idleNow())reloadSaved();else showUpdateBar();
}
if(window.RS_HOSTED){
  serverVersion().then(v=>{UPD.boot=v;UPD.checkedAt=Date.now();$('#appVer').textContent=v?'This version: '+v.replace(/^rs-/,''):''});
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
  return `Last play: song and video within 40 ms ${pct}% of the time, largest gap ${Math.round(s.maxLate*1000)} ms, ${s.jumps} song jump${s.jumps===1?'':'s'}${s.stalls?`, ${s.stalls} video stall${s.stalls>1?'s':''}`:''} (over ${Math.round(span)} s, screen ${fps} fps).`}
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
  if(bodies.length){const B=bodies.find(x=>x.msPerFrame)||bodies[0];add('Tracking',`${bodies.length} video${bodies.length>1?'s':''} tracked · ${B.msPerFrame?Math.round(B.msPerFrame)+' ms/frame':'speed not recorded'} · ${B.delegate||'?'} · ${B.n} frames${B.fps?' at '+Math.round(B.fps)+' fps':''}`)}
  else add('Tracking','no video tracked in this project');
  add('Sound',soundReport()||'no play measured yet');
  try{const so=S.liveSong,R=so&&so.an&&so.an.riddim;add('Cues',`${S.beatView==='ball'?'Ball':S.beatView==='calm'?'Count':'Off'} · sound delay ${Math.round((S.sndDelay||0)*1000)} ms · riddim ${R?(R.sure?R.events.length+' hits, '+R.perBar.toFixed(1)+' a bar':'no clear drums'):'not found yet'}${so&&so.an?' · beat sure '+(songSure()?'yes':'no')+' (phase '+(so.an.phaseConf??1).toFixed(2)+')':''}`)}catch(e){}
  try{const sb=(S.mainSong&&S.mainSong.buf)||buf;add('Audio',`song decoded at ${(sb&&sb.sampleRate)||'?'} Hz · live sound engine ${ctx?'open ('+ctx.state+', '+ctx.sampleRate+' Hz)':'closed'}`)}catch(e){}
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
function studyUI(){const on=!!S.study;$('#studyBtn').setAttribute('aria-pressed',String(on));$('#studyTag').hidden=!on;$('#studyBtn').disabled=!S.hasV||routineOn()||!!S.rec}
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
  a.preservesPitch=false; a.webkitPreservesPitch=false;
  if(S.playing)pause(); S.segIdx=0; studyUI(); updateTrim(); syncSong(true);
}
$('#studyBtn').addEventListener('click',()=>{S.study?studyOff():studyOn()});
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
if(/debug/.test(location.hash))window.__rs={hitsOf,CUT,RTL,clipCut,segMode,seqTotal,segsFor,expected,CUE,lane,riddimEvents,dancerEvents,heardNow,songNow,countAt,setDelay,patWindow,hipPatterns,movePattern,renderMoves,compareTry,compareText,studyOn,studyOff,hipHits,hipSync,UPD,checkUpdate,get audioCtx(){return ctx},get songBuf(){return buf},S,RA,segs,tPos,srcById,routineOn,segLen,toOut,toSrc,spdRateAt,curveOf,SPD,curRate,v:()=>v};
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
  clickTick(); drawBody(); drawCues(); try{tlTick()}catch(err){} if(S.playing&&!S.everPlayed){S.everPlayed=true;try{localStorage.setItem('rs-played','1')}catch(e){}} if(++dockTick%15===0){dockUpdate();startUpdate()}
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
