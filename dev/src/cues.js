/* ---------- beat cues: a ball that lands on each hit of the riddim, and one that lands on each of the dancer's hits ----------
   Everything runs on one clock: the song position you HEAR (smoothed, minus the sound delay, plus one frame because what's
   drawn now is seen on the next frame). The riddim's hits are in song seconds; the dancer's hits are mapped into song
   seconds the same way the player lines the video up with the song, so the two balls and the video agree. */
const CUE={delay:0,clock:{mt:0,pt:0,last:-1},col:null,colAt:0,dKey:'',dEv:[],drawn:false,stillKey:'',test:null};
try{const d=localStorage.getItem('rs-snddelay');CUE.delay=d!=null?clamp((+d||0)/1000,-0.1,0.4):0}catch(e){}
const cueCv=$('#cueCanvas');
/* smoothed song position: a.currentTime can update in coarse steps on some phones; predict between updates */
function songNow(){
  const now=performance.now(), raw=a.currentTime, r=a.playbackRate||1, c=CUE.clock;
  if(a.paused||!S.hasA){c.last=-1;return raw}
  if(raw!==c.last){const est=c.last<0?raw:c.mt+(now-c.pt)/1000*r, err=raw-est;
    if(c.last<0||Math.abs(err)>0.08){c.mt=raw;c.pt=now}else{c.mt=est+err*0.2;c.pt=now} c.last=raw}
  return c.mt+(now-c.pt)/1000*r;
}
const heardNow=()=>{const r=a.playbackRate||1;return songNow()-CUE.delay*r+r/60};
function cueCols(){const now=performance.now();if(!CUE.col||now-CUE.colAt>3000){const b=LOOK.ball();CUE.col={song:b.riddim,dance:b.dancer,ink:'#F3F1EC',ring:b.ring,glow:b.glow};CUE.colAt=now}return CUE.col}
/* the riddim's hits (song seconds) — or the steady beat when the riddim can't be seen or the beat was tapped */
function riddimEvents(){
  const so=S.liveSong, an=so&&so.an, G=liveGrid(); if(!G)return {ev:[],label:'Beat',sure:false,beat:0.6};
  const beat=60/(G.bpm||100);
  if(!G.tapped&&an&&an.riddim&&an.riddim.sure&&an.riddim.events.length)return {ev:an.riddim.events,label:'Riddim',sure:songSure(),beat};
  const bt=G.tapped?G.beats:(an&&an.grid)||G.beats, down=new Set((G.down||[]).map(t=>Math.round(t*100)));
  if(!CUE.bEv||CUE.bEvSrc!==bt){CUE.bEvSrc=bt;CUE.bEv=bt.map(t=>({t,kind:down.has(Math.round(t*100))?'one':'beat',w:1}))}
  return {ev:CUE.bEv,label:'Beat',sure:songSure(),beat};
}
/* the dancer's hits in song seconds, the same mapping as expected(): song = offset + shift + (output time + avComp) × song speed */
function dancerEvents(){
  const ro=routineOn(), L=segs(), n=srcById(S.cur);
  const key=[ro,S.cur,S.study?S.study.a+':'+S.study.b+':'+S.study.rate:0,S.offset,S.ar,S.vr,S.cIn,clipEnd(),S.avComp||0,S.variant&&S.variant.shift||0,S.hitLevel,
    L.map(g=>g.src+':'+g.s+':'+g.e+':'+(g.k?g.k.length+':'+g.k[g.k.length-1][1]:g.r)).join(','),L.map(g=>{const m=srcById(g.src);return m&&m.motion?m.motion.beats.length+(m.motion.edited?'e':''):0}).join(',')].join('|');
  if(key===CUE.dKey)return CUE.dEv; CUE.dKey=key;
  const out=[], base=S.offset+(S.variant&&S.variant.shift||0), av=S.avComp||0;
  if(S.study&&n){for(const h of hitsOf(n))if(h.t>=S.study.a&&h.t<=S.study.b)out.push({t:S.offset+((h.t-S.cIn)/S.vr+av)*S.ar,kind:'dance',w:h.w||1})}
  else{let T=0;for(const g of L){const hs=motionIn(g.src,g.s,g.e)||[];for(const h of hs)out.push({t:base+(T+toOut(g,h.t)+av)*S.ar,kind:'dance',w:h.w||1});T+=segLen(g)}}
  out.sort((x,y)=>x.t-y.t); CUE.dEv=out; return out;
}
/* where a lane's ball is at heard time H: height 0..1 (lands exactly on each hit), the last landing, the next hit */
function lane(E,H,beat){
  let lo=0,hi=E.length;while(lo<hi){const m=(lo+hi)>>1;if(E[m].t<=H)lo=m+1;else hi=m}
  const nx=E[lo], pv=E[lo-1];
  let y=0, nearNext=0;
  if(nx){const gap=pv?nx.t-pv.t:beat, D=Math.max(0.06,Math.min(gap,beat)), u=(H-(nx.t-D))/D;
    if(u>0&&u<1)y=4*u*(1-u)*Math.sqrt(Math.min(1,D/beat)); nearNext=clamp(1-(nx.t-H)/beat,0,1)}
  const land=pv&&H-pv.t<0.22?{age:H-pv.t,kind:pv.kind,w:pv.w,t:pv.t}:null;
  return {y,land,nearNext,next:nx};
}
function cueBall(c,x,floor,R,hop,L,col,unsure,st){
  const lift=L.y*hop, ag=L.land?L.land.age:1, sq=ag<0.07?1-ag/0.07:0;
  /* shadow: sharpens as the ball comes down, so the landing can be read before it happens */
  c.fillStyle=`rgba(0,0,0,${0.18+0.32*(1-L.y)})`;c.beginPath();c.ellipse(x,floor+R*0.15,R*(1.25-0.5*L.y),R*0.32*(1-0.5*L.y),0,0,Math.PI*2);c.fill();
  /* landing ring: what kind of hit it was */
  if(L.land&&ag<0.22){const k=L.land.kind,p=ag/0.22, big=k==='kick'||k==='both'||k==='one';
    const rr=R*(1.1+p*(big?2.6:1.9))*(k==='dance'?0.7+0.3*clamp(L.land.w,0.3,1.5):1);
    c.lineWidth=R*(big?0.42:0.26)*(1-p);c.strokeStyle=k==='snare'?`rgba(243,241,236,${1-p})`:col;c.globalAlpha=k==='snare'?1:(1-p);
    c.beginPath();c.ellipse(x,floor,rr,rr*0.42,0,0,Math.PI*2);
    if(st&&st.ring==='filled'&&k!=='snare'){c.save();c.globalAlpha=0.28*(1-p);c.fillStyle=col;c.fill();c.restore()}
    c.stroke();
    if(st&&st.ring==='double'&&k!=='snare'){c.beginPath();c.ellipse(x,floor,rr*0.68,rr*0.68*0.42,0,0,Math.PI*2);c.lineWidth*=0.6;c.globalAlpha=0.7*(1-p);c.stroke()}
    if(k==='both'){c.strokeStyle=`rgba(243,241,236,${1-p})`;c.globalAlpha=1;c.lineWidth=R*0.2*(1-p);c.beginPath();c.ellipse(x,floor,rr*0.7,rr*0.3,0,0,Math.PI*2);c.stroke()}
    c.globalAlpha=1}
  /* the ball: squashes for a moment when it lands */
  const sx=1+0.28*sq, sy=1-0.3*sq, cy=floor-R*sy-lift;
  c.save();c.translate(x,cy);c.scale(sx,sy);c.beginPath();c.arc(0,0,R,0,Math.PI*2);
  if(st&&st.glow){c.shadowColor=col;c.shadowBlur=R*st.glow*1.6}
  if(unsure){c.lineWidth=R*0.22;c.strokeStyle=col;c.globalAlpha=0.55;c.stroke()}else{c.fillStyle=col;c.fill();c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.arc(-R*0.3,-R*0.32,R*0.32,0,Math.PI*2);c.fill()}
  c.restore();c.globalAlpha=1;
}
function cueLabel(c,x,floor,R,txt,col){c.font=`700 ${Math.round(R*0.78)}px Figtree,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='top';
  c.fillStyle='rgba(8,9,12,.55)';const w=c.measureText(txt).width+R*0.7;c.beginPath();if(c.roundRect)c.roundRect(x-w/2,floor+R*0.55,w,R*1.15,R*0.5);else c.rect(x-w/2,floor+R*0.55,w,R*1.15);c.fill();
  c.fillStyle=col;c.fillText(txt,x,floor+R*0.7)}
function drawCues(){
  const on=S.beatView==='ball';
  const playing=S.playing&&!a.paused;
  if(!on||!S.hasA||!liveGrid()){if(CUE.drawn){const c=cueCv.getContext('2d');c.clearRect(0,0,cueCv.width,cueCv.height);CUE.drawn=false;CUE.stillKey=''}return}
  const r=cueCv.getBoundingClientRect(); if(!r.width||!r.height)return;
  const H=playing?heardNow():a.currentTime;
  /* paused: draw once, not every frame */
  const still=[Math.round(H*50),Math.round(r.width),Math.round(r.height),S.cur,routineOn(),CUE.dKey,S.beatView].join('|');
  if(!playing&&still===CUE.stillKey)return; CUE.stillKey=playing?'':still;
  const dpr=window.devicePixelRatio||1, w=Math.round(r.width*dpr), h=Math.round(r.height*dpr);
  if(cueCv.width!==w||cueCv.height!==h){cueCv.width=w;cueCv.height=h}
  const c=cueCv.getContext('2d');c.clearRect(0,0,w,h);CUE.drawn=true;
  const el=curVid(), rect=S.hasV&&el.videoWidth?RB.containRect(w,h,el.videoWidth,el.videoHeight):{x:0,y:0,w,h};
  const col=cueCols(), side0=rect.x, R=clamp(Math.max(Math.min(rect.w,rect.h)*0.05,Math.min(side0*0.22,h*0.06)),11*dpr,28*dpr), pad=R*1.7;   /* big enough to read from across the room */
  const dock=$('#dock'), dockH=dock&&!dock.hidden?dock.getBoundingClientRect().height*dpr+10*dpr:0;
  const floor=Math.min(rect.y+rect.h,h-dockH)-R*2.2, hop=clamp(Math.min(rect.h,h)*0.42,60*dpr,260*dpr);
  const side=rect.x, inBars=side>=R*4.2;
  const xL=inBars?side/2:rect.x+pad, xR=inBars?w-side/2:rect.x+rect.w-pad;
  const rid=riddimEvents(), dEv=S.hasV?dancerEvents():[];
  const Lr=lane(rid.ev,H,rid.beat);
  cueBall(c,xL,floor,R,hop,Lr,col.song,!rid.sure,col); cueLabel(c,xL,floor,R,rid.label+(rid.sure?'':' ?'),col.song);
  if(dEv.length){const Ld=lane(dEv,H,rid.beat);
    cueBall(c,xR,floor,R,hop,Ld,col.dance,!danceSure(),col); cueLabel(c,xR,floor,R,'Dancer'+(danceSure()?'':' ?'),col.dance);
    /* both landed together (within 60 ms): join them */
    if(Lr.land&&Ld.land&&Math.abs(Lr.land.t-Ld.land.t)<0.06&&Ld.land.age<0.2){const p=Ld.land.age/0.2;c.strokeStyle=`rgba(243,241,236,${0.85*(1-p)})`;c.lineWidth=R*0.22*(1-p);
      c.beginPath();c.moveTo(xL+R*1.3,floor);c.lineTo(xR-R*1.3,floor);c.stroke()}}
}
/* the count lights follow the smoothed beat list (not a fixed tempo, which drifts a little every bar) */
function countAt(H){
  const G=liveGrid(); if(!G)return {idx:-1,pulse:false};
  const so=S.liveSong, bt=G.tapped?G.beats:(so&&so.an&&so.an.grid)||G.beats; if(!bt.length||H<bt[0]-0.05)return {idx:-1,pulse:false};
  if(CUE.cSrc!==bt||CUE.cDown!==(G.down||[])[0]){CUE.cSrc=bt;CUE.cDown=(G.down||[])[0];let i0=0,bd=1e9;if(CUE.cDown!=null)for(let k=0;k<bt.length;k++){const dd=Math.abs(bt[k]-CUE.cDown);if(dd<bd){bd=dd;i0=k}}CUE.cI0=i0}
  let lo=0,hi=bt.length;while(lo<hi){const m=(lo+hi)>>1;if(bt[m]<=H)lo=m+1;else hi=m}const i=Math.max(0,lo-1);
  const per=(bt[i+1]||bt[i]+0.6)-bt[i];
  return {idx:((i-CUE.cI0)%4+4)%4,pulse:H-bt[i]<per*0.14};
}
/* the click: scheduled a little ahead on the sound engine's own clock, so it lands on time (polling every frame could be
   a frame late, and jittery) */
const CLK={sched:new Set(),last:-1,nodes:[]};
/* stop clicks already queued for later (pause, seek, switching song) */
function clickCancel(){const c=ctx;for(const n of CLK.nodes){try{if(!c||n.at>c.currentTime)n.o.stop()}catch(e){}}CLK.nodes=[];CLK.sched.clear()}
function clickTick(){
  if(!S.clickOn||a.paused||!S.hasA){if(CLK.last>=0||CLK.nodes.length)clickCancel();CLK.last=-1;return}
  const c=ctx; if(!c||c.state!=='running'){if(S.clickOn){const cc=getCtx();if(cc.state!=='running')cc.resume().catch(()=>{})}return}
  const now=songNow(), r=a.playbackRate||1; if(CLK.last>=0&&(now<CLK.last-0.05||now-CLK.last>0.5))clickCancel(); CLK.last=now;
  const what=$('#clickWhat')?$('#clickWhat').value:'beat';
  let ev; if(what==='riddim'){const R=riddimEvents();ev=R.ev}else{const G=liveGrid();if(!G)return;const so=S.liveSong,bt=G.tapped?G.beats:(so&&so.an&&so.an.grid)||G.beats,dn=new Set((G.down||[]).map(t=>Math.round(t*100)));
    if(CLK.bSrc!==bt){CLK.bSrc=bt;CLK.bEv=bt.map(t=>({t,kind:dn.has(Math.round(t*100))?'one':'beat'}))}ev=CLK.bEv}
  const ahead=0.3;   /* far enough ahead that a slow frame can't make a click late */
  let lo=0,hi=ev.length;while(lo<hi){const m=(lo+hi)>>1;if(ev[m].t<now-0.005)lo=m+1;else hi=m}
  for(let i=lo;i<ev.length&&ev[i].t<now+ahead*r;i++){const e=ev[i],id=Math.round(e.t*1000);if(CLK.sched.has(id))continue;CLK.sched.add(id);
    const when=c.currentTime+Math.max(0,(e.t-now)/r);
    const K=LOOK.snd(),kd=e.kind==='kick'||e.kind==='snare'||e.kind==='both'||e.kind==='one'?e.kind:'beat';
    const o=c.createOscillator(),g=c.createGain();
    const f=K.freq[kd];
    o.type=K.wave; o.frequency.value=f; g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime((e.kind==='kick'?0.5:0.32)*K.gain,when+0.002);g.gain.exponentialRampToValueAtTime(0.001,when+(e.kind==='kick'?0.09:0.05)*K.decay);
    o.connect(g);g.connect(c.destination);o.start(when);o.stop(when+0.1*Math.max(1,K.decay));CLK.nodes.push({o,at:when})}
  if(CLK.nodes.length>64)CLK.nodes=CLK.nodes.filter(n=>n.at>c.currentTime-0.2);
  if(CLK.sched.size>400)CLK.sched=new Set([...CLK.sched].slice(-100));
}
/* sound delay: presets, fine slider, and a check (a click on the sound engine with a ball that should land on it) */
function setDelay(ms,save){
  CUE.delay=clamp(ms,-100,400)/1000; S.sndDelay=CUE.delay; $('#delay').value=String(Math.round(ms)); $('#delayOut').textContent=Math.round(ms)+' ms';
  const preset=ms===0?'0':ms===200?'200':'custom'; $$('#delaySeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.d===preset)));
  if(save)try{localStorage.setItem('rs-snddelay',String(Math.round(ms)))}catch(e){}
  if(S.playing)syncSong(true);
}
setDelay(Math.round(CUE.delay*1000),false);
$$('#delaySeg button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.d==='custom'){$('#delay').focus();return}setDelay(+b.dataset.d,true)}));
$('#delay').addEventListener('input',e=>setDelay(+e.target.value,true));
function delayTestStop(){const T=CUE.test;if(!T)return;CUE.test=null;cancelAnimationFrame(T.raf);$('#delayTest').setAttribute('aria-pressed','false');$('#delayTest').textContent='Check it';$('#delayCv').hidden=true}
$('#delayTest').addEventListener('click',()=>{
  if(CUE.test){delayTestStop();return}
  const c=getCtx(); if(c.state!=='running')c.resume().catch(()=>{});
  const cv=$('#delayCv'); cv.hidden=false; $('#delayTest').setAttribute('aria-pressed','true'); $('#delayTest').textContent='Stop';
  const per=0.6, t0=c.currentTime+0.3, T={t0,per,raf:0,until:t0+per*24}; CUE.test=T;
  for(let k=0;k<24;k++){const when=t0+k*per,o=c.createOscillator(),g=c.createGain();o.frequency.value=k%4===0?1600:1000;
    g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(0.4,when+0.002);g.gain.exponentialRampToValueAtTime(0.001,when+0.06);o.connect(g);g.connect(c.destination);o.start(when);o.stop(when+0.08)}
  const ev=[];for(let k=0;k<24;k++)ev.push({t:t0+k*per,kind:k%4===0?'one':'beat',w:1});
  const loop=()=>{if(CUE.test!==T)return;const dpr=window.devicePixelRatio||1,r=cv.getBoundingClientRect(),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    const x=cv.getContext('2d');x.clearRect(0,0,w,h);
    /* the same rule as the song: the playback clock, minus the sound delay, plus one frame */
    const Hh=c.currentTime-CUE.delay+1/60, R=8*dpr, L=lane(ev,Hh,per);
    cueBall(x,w/2,h-R*1.4,R,h-R*4,L,cueCols().song,false);
    if(ct>T.until+0.3){delayTestStop();return}T.raf=requestAnimationFrame(loop)};
  T.raf=requestAnimationFrame(loop);
});
