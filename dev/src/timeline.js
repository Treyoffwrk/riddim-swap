/* ---------- timeline editor: one visual surface for cutting a clip (Clip tab) and arranging the routine ----------
   Thumbnails of the video along the strip, the song's beats on top (bars numbered), the dancer's hits underneath, a
   playhead. Gestures: tap to go there and select; drag to scroll; pinch or − / + to zoom; grab a white edge to move it;
   in the routine, press and hold a move, then drag it to a new place. */

/* thumbnails, made in the background from a hidden copy of each video (never the one on screen) */
const THUMB={jobs:new Map(),step:0.5,h:144};window.__rsThumb=THUMB;   /* tall enough to stay sharp on a phone screen */
function thumbsFor(n){
  if(!n||!n.url||!(n.dur>0))return null;
  let J=THUMB.jobs.get(n.id);
  if(J&&J.url===n.url&&n.dur<=J.dur+0.3)return J;
  /* new video, or its length grew while it loaded (iPhone): keep the pictures already made and make the rest */
  const old=J&&J.url===n.url?J:null;
  J={url:n.url,map:old?old.map:new Map(),busy:false,done:false,w:old?old.w:0,dur:n.dur}; THUMB.jobs.set(n.id,J);
  const el=document.createElement('video');el.muted=true;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto';el.src=n.url;
  const times=[];for(let t=0;t<n.dur;t+=THUMB.step){const q=+t.toFixed(2);if(!J.map.has(q))times.push(q)}
  /* coarse first (every 2 s), then fill in, so a long clip shows something quickly */
  const order=times.filter((t,i)=>i%4===0).concat(times.filter((t,i)=>i%4!==0));
  let k=0;
  const next=()=>{
    if(THUMB.jobs.get(n.id)!==J){el.removeAttribute('src');return}
    if(k>=order.length){J.done=true;el.removeAttribute('src');try{el.load()}catch(e){}return}
    const t=order[k++];el.currentTime=Math.min(t+0.05,Math.max(0,n.dur-0.05));
  };
  el.addEventListener('seeked',()=>{
    try{const vw=el.videoWidth||16,vh=el.videoHeight||9,h=THUMB.h,w=Math.max(8,Math.round(h*vw/vh));J.w=w;
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(el,0,0,w,h);
      J.map.set(order[k-1],c);TL.redrawAll();}catch(e){}
    setTimeout(next,0);
  });
  el.addEventListener('loadeddata',()=>{J.busy=true;next()},{once:true});
  el.addEventListener('error',()=>{J.done=true},{once:true});
  return J;
}
function thumbAt(J,t){if(!J)return null;const s=THUMB.step,base=Math.round(t/s)*s;
  for(const d of [0,s,-s,2*s,-2*s,3*s,-3*s,4*s,-4*s]){const c=J.map.get(+(base+d).toFixed(2));if(c)return c}return null}

/* the surface */
class TL{
  constructor(canvas,o){
    this.c=canvas;this.o=o;this.t0=0;this.pps=0;this.fitted=false;this.ptrs=new Map();this.drag=null;this.follow=true;
    TL.all.push(this);
    const c=canvas;c.style.touchAction='none';
    c.addEventListener('pointerdown',e=>this.down(e));c.addEventListener('pointermove',e=>this.move(e));
    c.addEventListener('pointerup',e=>this.up(e));c.addEventListener('pointercancel',e=>this.up(e,true));
    c.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||Math.abs(e.deltaY)>Math.abs(e.deltaX))this.zoom(e.deltaY<0?1.25:0.8,this.lx(e));else{this.t0+=e.deltaX/this.pps;this.clampView();this.redraw()}},{passive:false});
    new ResizeObserver(()=>this.redraw()).observe(c);
  }
  len(){return Math.max(0.1,this.o.len())}
  W(){return this.c.clientWidth||300}
  lx(e){const r=this.c.getBoundingClientRect();return e.clientX-r.left}
  ly(e){const r=this.c.getBoundingClientRect();return e.clientY-r.top}
  X(t){return (t-this.t0)*this.pps}
  T(x){return this.t0+x/this.pps}
  fit(){this.pps=this.W()/this.len();this.t0=0;this.fitted=true;this.userZoom=false;this.redraw()}
  minPps(){return this.W()/this.len()}
  clampView(){const L=this.len(),W=this.W();if(this.pps<this.minPps())this.pps=this.minPps();this.pps=Math.min(this.pps,W/0.6);this.t0=Math.max(0,Math.min(this.t0,L-W/this.pps))}
  zoom(f,ax){if(!this.fitted)this.fit();this.userZoom=f>1||this.pps*f>this.minPps()*1.02;const ta=this.T(ax==null?this.W()/2:ax);this.pps*=f;this.clampView();this.t0=ta-(ax==null?this.W()/2:ax)/this.pps;this.clampView();this.follow=false;this.redraw();this.o.onZoom&&this.o.onZoom()}
  zoomed(){return this.pps>this.minPps()*1.05}
  show(t){if(!this.fitted)return;const W=this.W(),x=this.X(t);if(x<W*0.08||x>W*0.92){this.t0=t-W*0.3/this.pps;this.clampView();}}
  down(e){
    if(!this.fitted)this.fit();
    this.c.setPointerCapture(e.pointerId);this.ptrs.set(e.pointerId,{x:this.lx(e),y:this.ly(e)});
    if(this.ptrs.size===2){const [a,b]=[...this.ptrs.values()];this.drag={kind:'pinch',d0:Math.abs(a.x-b.x)||1,pps0:this.pps,tm:this.T((a.x+b.x)/2)};clearTimeout(this.hold);return}
    const x=this.lx(e),y=this.ly(e),h=this.o.hit?this.o.hit(this,x,y):null;
    this.drag={kind:h&&h.kind==='handle'?'handle':'press',h,x0:x,y0:y,t00:this.t0,moved:false,start:performance.now()};
    if(h&&h.kind==='handle'){this.o.handleStart&&this.o.handleStart(h);e.preventDefault();}
    else if(h&&h.kind==='block'&&this.o.blockDrag){clearTimeout(this.hold);this.hold=setTimeout(()=>{if(this.drag&&this.drag.kind==='press'&&!this.drag.moved){this.drag.kind='block';this.drag.lift=true;try{navigator.vibrate&&navigator.vibrate(12)}catch(err){}this.o.blockDrag.start(h);this.drag.gx=x;this.redraw()}},320)}
  }
  move(e){
    if(!this.ptrs.has(e.pointerId))return;this.ptrs.set(e.pointerId,{x:this.lx(e),y:this.ly(e)});
    const D=this.drag;if(!D)return;
    if(D.kind==='pinch'){const [a,b]=[...this.ptrs.values()];if(!b)return;const d=Math.abs(a.x-b.x)||1;this.pps=D.pps0*d/D.d0;this.userZoom=this.pps>this.minPps()*1.02;this.clampView();this.t0=D.tm-((a.x+b.x)/2)/this.pps;this.clampView();this.follow=false;this.redraw();return}
    const x=this.lx(e),dx=x-D.x0;
    if(Math.abs(dx)>6||Math.abs(this.ly(e)-D.y0)>10)D.moved=true;
    if(D.kind==='handle'){this.edge(x);this.o.handleMove(D.h,this.T(x));this.redraw();return}
    if(D.kind==='block'){D.gx=x;this.edge(x);this.o.blockDrag.move(D.h,this.T(x));this.redraw();return}
    if(D.moved){clearTimeout(this.hold);this.t0=D.t00-dx/this.pps;this.clampView();this.follow=false;this.redraw()}
  }
  /* near the ends while dragging: scroll along */
  edge(x){const W=this.W();if(!this.zoomed())return;if(x<24){this.t0-=6/this.pps;this.clampView()}else if(x>W-24){this.t0+=6/this.pps;this.clampView()}}
  up(e,cancel){
    this.ptrs.delete(e.pointerId);clearTimeout(this.hold);
    const D=this.drag;if(!D)return;
    if(D.kind==='pinch'){if(this.ptrs.size===0)this.drag=null;return}
    this.drag=null;
    if(D.kind==='handle'){this.o.handleEnd&&this.o.handleEnd(D.h);this.redraw();return}
    if(D.kind==='block'){this.o.blockDrag.end(D.h,this.T(D.gx),cancel);this.redraw();return}
    if(!D.moved&&!cancel&&this.o.tap){this.o.tap(this.T(D.x0),D.h,D.y0);this.redraw()}
  }
  redraw(){if(this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.paint()})}
  paint(){
    const c=this.c,dpr=window.devicePixelRatio||1,W=this.W(),H=c.clientHeight||120;
    if(!W)return;
    if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
    /* until you zoom, the whole length always fits (it grows as moves are added) */
    if(!this.fitted||(!this.userZoom&&!this.drag)||this.pps<this.minPps()*0.999){this.pps=this.minPps();this.t0=0;this.fitted=true}   /* holds still while you drag */
    const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
    this.o.draw(x,this,W,H);
  }
}
TL.all=[];
TL.redrawAll=()=>{for(const t of TL.all)t.redraw()};
const TLC={ink:'#F3F1EC',mute:'#8A90A2',line:'rgba(255,255,255,.12)',song:'#E8A33D',dance:'#6E8BFF',sel:'#E8A33D',cut:'rgba(10,11,14,.78)'};
function tlRound(x,X,Y,w,h,r){x.beginPath();if(x.roundRect)x.roundRect(X,Y,w,h,r);else x.rect(X,Y,w,h)}
/* draw a strip of thumbnails for source time a..b of video n into x..x+w */
function tlThumbs(ctx,n,a,b,X,Y,w,h,map){
  const J=thumbsFor(n);if(!J||w<2)return;const tw=Math.max(8,J.w?J.w*h/THUMB.h:h*0.56);
  ctx.save();ctx.beginPath();ctx.rect(X,Y,w,h);ctx.clip();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(let px=X;px<X+w;px+=tw){const t=map?map(px+tw/2):a+(px+tw/2-X)/w*(b-a);const im=thumbAt(J,t);if(im)ctx.drawImage(im,px,Y,tw,h);else{ctx.fillStyle='#1B1F27';ctx.fillRect(px,Y,tw-1,h)}}
  ctx.restore();
}
function tlTimeLabels(ctx,tl,W,y){
  const span=W/tl.pps, step=[0.5,1,2,5,10,15,30,60].find(s=>span/s<=7)||60;
  ctx.fillStyle=TLC.mute;ctx.font='600 10px Figtree,system-ui,sans-serif';ctx.textBaseline='top';ctx.textAlign='left';
  for(let t=Math.ceil(tl.t0/step)*step;t<tl.t0+span;t+=step){const X=tl.X(t);ctx.fillRect(X,y,1,4);ctx.fillText(t>=60?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):(step<1?t.toFixed(1):Math.round(t))+'s',X+3,y)}
}
function tlPlayhead(ctx,X,H){ctx.fillStyle='#FF4D5E';ctx.fillRect(X-1,0,2,H);ctx.beginPath();ctx.moveTo(X-6,0);ctx.lineTo(X+6,0);ctx.lineTo(X,7);ctx.closePath();ctx.fill()}

/* ======================= Clip: cut out the parts you don't want ======================= */
/* n.pieces: [{s,e,on}] covering the whole video. Parts with on:false are skipped; the song keeps going. */
const CUT={sel:null,undo:[],tl:null};
function piecesOf(n){if(!n)return [];const d=n.dur||0;
  if(!n.pieces||!n.pieces.length)n.pieces=[{s:0,e:d,on:true}];
  else if(d&&Math.abs(n.pieces[n.pieces.length-1].e-d)>0.05)n.pieces[n.pieces.length-1].e=d;
  return n.pieces}
function cutPush(n){CUT.undo.push({id:n.id,p:JSON.stringify(n.pieces||null)});if(CUT.undo.length>40)CUT.undo.shift();$('#cutUndo').disabled=false}
function pieceAt(n,t){const P=piecesOf(n);for(let i=0;i<P.length;i++)if(t>=P[i].s-1e-6&&t<P[i].e)return i;return P.length-1}
function cutChanged(){
  const n=srcById(S.cur);
  if(n&&n.pieces){const P=n.pieces;for(let i=P.length-1;i>0;i--)if(P[i].e-P[i].s<0.04){P[i-1].e=P[i].e;P.splice(i,1)}}
  S.segIdx=0;knotMemo=null;
  /* keep playing from the same moment of the dance if it's still kept */
  if(S.hasV&&!routineOn()){const L=segs();const t=v.currentTime;let i=L.findIndex(g=>t>=g.s-0.01&&t<g.e);if(i<0)i=L.findIndex(g=>g.s>t);if(i<0)i=0;S.segIdx=i;if(t<L[i].s||t>=L[i].e){if(S.playing)gotoSeg(i);else v.currentTime=L[i].s}primeNext()}
  updateTrim();scheduleFit();drawHitStrip();cutUI();CUT.tl&&CUT.tl.redraw();try{autosave()}catch(e){}
}
function cutUI(){
  const n=srcById(S.cur),card=$('#cutCard');if(!card)return;
  const ok=!!(n&&S.hasV&&!routineOn()&&n.dur);card.classList.toggle('off',!ok);
  ['cutSplit','cutZoomIn','cutZoomOut'].forEach(id=>$('#'+id).disabled=!ok);
  const P=ok?piecesOf(n):[], sel=CUT.sel!=null&&P[CUT.sel]?P[CUT.sel]:null;
  const tg=$('#cutToggle');tg.disabled=!sel||(sel.on&&P.filter(p=>p.on).length<=1);tg.textContent=sel&&!sel.on?'Bring this part back':'Cut this part';
  tg.classList.toggle('danger',!!sel&&sel.on);
  $('#cutClear').disabled=!P.some(p=>!p.on)&&P.length<=1;
  const rv=$('#cutRev');if(rv){const L=sel?sel.e-sel.s:0;rv.disabled=REV.busy||!sel||!sel.on||L<0.2||L>12;rv.title=!sel?'Split at the start and end of a move, tap that part, then reverse it':L>12?'Pick a part of 12 s or less':'Play this part, then the same part backwards right after it'}
  const kept=ok?segs().reduce((t,g)=>t+(g.e-g.s),0):0, cuts=P.filter(p=>!p.on).length;
  $('#cutSum').textContent=ok?(cuts?`${cuts} part${cuts>1?'s':''} cut · keeps ${kept.toFixed(1)} s of ${(clipEnd()-S.cIn).toFixed(1)} s`:P.length>1?`${P.length} parts · nothing cut yet`:''):routineOn()?'Switch to Clip under the video to cut this clip.':'';
}
function initCut(){
  const cv=$('#cutCanvas');if(!cv)return;
  CUT.tl=new TL(cv,{
    len:()=>{const n=srcById(S.cur);return n&&n.dur||v.duration||1},
    hit:(tl,x,y)=>{const n=srcById(S.cur);if(!n)return null;const P=piecesOf(n);
      for(let i=1;i<P.length;i++){if(Math.abs(tl.X(P[i].s)-x)<16)return {kind:'handle',i}}
      return {kind:'piece',i:pieceAt(n,tl.T(x))}},
    tap:(t,h)=>{const n=srcById(S.cur);if(!n||!S.hasV)return;if(S.playing)pause();CUT.sel=h&&h.kind==='piece'?h.i:null;v.currentTime=clamp(t,0,(n.dur||t)-0.03);cutUI()},
    handleStart:h=>{const n=srcById(S.cur);cutPush(n);if(S.playing)pause()},
    handleMove:(h,t)=>{const n=srcById(S.cur),P=piecesOf(n),a=P[h.i-1],b=P[h.i];t=clamp(t,a.s+0.1,b.e-0.1);a.e=b.s=+t.toFixed(3);v.currentTime=t;cutUI()},
    handleEnd:()=>cutChanged(),
    draw:(x,tl,W,H)=>{
      const n=srcById(S.cur);x.fillStyle='#12151B';x.fillRect(0,0,W,H);if(!n||!n.dur)return;
      const top=16,bot=H-12,th=bot-top,P=piecesOf(n),t1=tl.T(W);
      tlThumbs(x,n,tl.t0,t1,0,top,W,th,px=>tl.T(px));
      /* outside the clip's start / end */
      x.fillStyle='rgba(10,11,14,.6)';const a=tl.X(S.cIn),b=tl.X(clipEnd());if(a>0)x.fillRect(0,top,a,th);if(b<W)x.fillRect(b,top,W-b,th);
      /* cut parts */
      P.forEach((p,i)=>{const X0=tl.X(p.s),X1=tl.X(p.e);if(X1<0||X0>W)return;
        if(!p.on){x.fillStyle=TLC.cut;x.fillRect(X0,top,X1-X0,th);x.save();x.beginPath();x.rect(X0,top,X1-X0,th);x.clip();x.strokeStyle='rgba(255,77,94,.55)';x.lineWidth=2;for(let k=X0-th;k<X1;k+=12){x.beginPath();x.moveTo(k,bot);x.lineTo(k+th,top);x.stroke()}x.restore();
          if(X1-X0>40){x.fillStyle='#FF8A95';x.font='800 12px Figtree,system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('CUT',(X0+X1)/2,top+th/2)}}
        if(p.rev&&p.on){x.fillStyle='rgba(255,95,162,.18)';x.fillRect(X0,top,X1-X0,th);x.fillStyle='#FF5FA2';x.fillRect(X0,top,X1-X0,3);
          if(X1-X0>34){x.font='800 11px Figtree,system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='rgba(10,11,14,.7)';const tw=x.measureText('⇆ REVERSE').width+10;tlRound(x,(X0+X1)/2-tw/2,top+th/2-9,tw,18,9);x.fill();x.fillStyle='#FF8BC0';x.fillText(X1-X0>80?'⇆ REVERSE':'⇆',(X0+X1)/2,top+th/2)}}
        if(i===CUT.sel){x.strokeStyle=TLC.sel;x.lineWidth=3;tlRound(x,X0+1.5,top+1.5,X1-X0-3,th-3,6);x.stroke()}});
      /* edges you can drag */
      for(let i=1;i<P.length;i++){const X=tl.X(P[i].s);if(X<-10||X>W+10)continue;x.fillStyle='#F3F1EC';x.fillRect(X-1.5,top-2,3,th+4);tlRound(x,X-6,top+th/2-14,12,28,6);x.fill();x.fillStyle='#12151B';x.fillRect(X-2,top+th/2-7,1.5,14);x.fillRect(X+0.5,top+th/2-7,1.5,14)}
      /* song beats (top) and the dancer's hits (bottom), where they land with these cuts */
      const G=liveGrid(), L=segs();
      if(G){x.fillStyle=TLC.song;let T=0;for(const g of L){const len=segLen(g);for(const bt of G.beats){const o=(bt-S.offset)/S.ar-T;if(o<0||o>len)continue;const X=tl.X(toSrc(g,o));if(X>=0&&X<=W)x.fillRect(X,top-6,1.5,5)}T+=len}}
      x.fillStyle=TLC.dance;for(const h of hitsOf(n)){const X=tl.X(h.t);if(X>=0&&X<=W)x.fillRect(X-1,bot+2,2,7)}
      tlTimeLabels(x,tl,W,1);
      if(S.cur===n.id)tlPlayhead(x,tl.X(v.currentTime),H);
    }});
  $('#cutSplit').addEventListener('click',()=>{const n=srcById(S.cur);if(!n||!n.dur)return;const t=v.currentTime,P=piecesOf(n),i=pieceAt(n,t),p=P[i];
    if(t-p.s<0.1||p.e-t<0.1){recMsg('Move a little away from the last cut first.');return}
    cutPush(n);P.splice(i+1,0,p.rev?{s:+t.toFixed(3),e:p.e,on:p.on,rev:true}:{s:+t.toFixed(3),e:p.e,on:p.on});p.e=+t.toFixed(3);CUT.sel=i+1;cutChanged()});
  $('#cutToggle').addEventListener('click',()=>{const n=srcById(S.cur),P=piecesOf(n),p=P[CUT.sel];if(!p)return;if(p.on&&P.filter(q=>q.on).length<=1)return;cutPush(n);p.on=!p.on;cutChanged()});
  $('#cutUndo').addEventListener('click',()=>{const u=CUT.undo.pop();if(!u)return;const n=srcById(u.id);if(n)n.pieces=JSON.parse(u.p);CUT.sel=null;$('#cutUndo').disabled=!CUT.undo.length;cutChanged()});
  $('#cutClear').addEventListener('click',()=>{const n=srcById(S.cur);if(!n)return;cutPush(n);n.pieces=null;CUT.sel=null;cutChanged()});
  $('#cutRev').addEventListener('click',reversePart);
  $('#cutZoomIn').addEventListener('click',()=>CUT.tl.zoom(1.6));$('#cutZoomOut').addEventListener('click',()=>CUT.tl.zoom(1/1.6));
  cutUI();
}

/* ======================= Clip: Reverse a part ======================= */
/* The reverse: a move, then the same move backwards straight after it. Pick a part on the strip (split at its start and
   end, tap it) and tap Reverse: a new copy of the clip is made on the phone with that part played backwards right where
   it ends, and everything after it moves along. The skeleton comes across too (reordered, no tracking again), so Ghost,
   Step mode, Worldline and the rest work on the reverse straight away. The original clip stays in your videos.
   How: the clip is played once, hidden; each frame is encoded to MP4 (WebCodecs); the frames of the part are also kept
   as JPEGs, then encoded in reverse order when the playback reaches the part's end. The copy has no sound of its own
   (the song plays over it as usual). */
var REV={busy:false,stop:false,rate:1,max:4};window.__rsREV=REV;
const revEven=x=>Math.max(2,Math.round(x/2)*2);
async function revConfig(W,H){
  for(const codec of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f','vp09.00.10.08']){
    const avc=codec.startsWith('avc'),cfg=avc?{codec,width:W,height:H,bitrate:6000000,framerate:30,avc:{format:'avc'}}:{codec,width:W,height:H,bitrate:6000000,framerate:30};
    const r=await VideoEncoder.isConfigSupported(cfg).catch(()=>null);if(r&&r.supported){cfg.mux=avc?'avc':'vp9';return cfg}}
  return null}
function revProg(f,txt){const b=$('#cutProg');if(!b)return;b.hidden=f==null;if(f!=null)b.firstElementChild.style.width=Math.round(f*100)+'%';const m=$('#cutRevMsg');if(m){m.textContent=txt||'';m.hidden=!txt}}
/* play el from a to b (hidden), calling onFrame(mediaTime) for each frame shown; pauses itself while the encoder catches up */
function revPass(el,a,b,onFrame,busy){return new Promise((res,rej)=>{let done=false;
  const fin=()=>{if(done)return;done=true;try{el.pause()}catch(e){}el.removeEventListener('ended',fin);res()};
  /* the hidden playback runs as fast as the phone keeps up (up to 4×): the copy needs a picture every 1/30 s (or every
     frame of a slower clip); when pictures come further apart than that, it slows down, and when they don't, it speeds up */
  let lt=null,fi=1,win=[0,0],sl=null;
  const cb=async(now,m)=>{if(done)return;if(REV.stop){fin();return}const t=m&&m.mediaTime!=null?m.mediaTime:el.currentTime;
    if(t>b+1e-4){fin();return}
    try{onFrame(t)}catch(e){done=true;rej(e);return}
    if(lt!=null&&t>lt){const g=t-lt;if(g>0.004)fi=Math.min(fi,g);win[0]+=g>Math.max(1.6/30,fi*1.6)?1:0;win[1]++;
      if(win[1]>=15){const r=el.playbackRate,f=win[0]/win[1];let nr=r;
        if(f<=0.07){if(r<REV.max)nr=Math.min(REV.max,r*1.25)}
        else if(f>0.15){
          /* slowing down didn't help (the gaps are in the clip, or the phone is busy anyway): go back and stay there */
          if(sl&&sl.r>r&&sl.r<=1&&f>sl.f*0.7){nr=sl.r;REV.floor=sl.r;sl=null}
          else if(r*0.7>=REV.floor){sl={r,f};nr=r*0.7}}
        if(nr!==r){el.playbackRate=nr;REV.rate=nr}win=[0,0]}}
    lt=t;
    if(busy()){el.pause();while(busy()&&!REV.stop)await new Promise(r=>setTimeout(r,15));if(!done)el.play().catch(()=>{})}
    el.requestVideoFrameCallback(cb)};
  el.addEventListener('ended',fin);
  const go=()=>{el.playbackRate=REV.rate||1;el.requestVideoFrameCallback(cb);el.play().catch(e=>{done=true;rej(e)})};
  if(Math.abs(el.currentTime-a)>0.001){el.addEventListener('seeked',go,{once:true});el.currentTime=a}else go()})}
async function reversePart(){
  const n=srcById(S.cur);if(!n||REV.busy||routineOn())return;const P=piecesOf(n),p=CUT.sel!=null?P[CUT.sel]:null;if(!p||!p.on)return;
  const A=p.s,Bt=p.e,L=Bt-A;if(L<0.2||L>12)return;
  if(!(window.VideoEncoder&&window.VideoFrame&&window.Mp4Muxer)||!HTMLVideoElement.prototype.requestVideoFrameCallback){recMsg('This phone\'s browser can\'t make video here yet (it needs iOS 16.4 or newer, or a recent Chrome).',true);return}
  if(S.rec)return;pause();REV.busy=true;REV.stop=false;REV.rate=2;REV.floor=0.25;cutUI();revProg(0,'Making the reverse… the clip plays through once, hidden.');
  const el=document.createElement('video');el.muted=true;el.setAttribute('playsinline','');el.playsInline=true;el.preload='auto';el.className='camsrc';el.src=n.url;document.body.append(el);
  let ve=null;
  try{
    await new Promise((res,rej)=>{if(el.readyState>=2)return res();el.addEventListener('loadeddata',res,{once:true});el.addEventListener('error',()=>rej(new Error('the clip didn\'t load')),{once:true})});
    const dur=el.duration||n.dur||0,vw=el.videoWidth,vh=el.videoHeight,sc=Math.min(1,1280/Math.max(vw,vh)),W=revEven(vw*sc),H=revEven(vh*sc);
    const cfg=await revConfig(W,H);if(!cfg)throw new Error('no video encoder on this phone');
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d');
    const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,fastStart:'in-memory',firstTimestampBehavior:'offset',video:{codec:cfg.mux,width:W,height:H}});
    let err=null,lastTs=-1,lastKey=-1e9,frames=0;
    ve=new VideoEncoder({output:(c,m)=>{try{muxer.addVideoChunkRaw(rawChunk(c),c.type,c.timestamp,okDur(c.duration)?c.duration:33333,m)}catch(e){err=e}},error:e=>{err=e}});
    ve.configure(cfg);
    /* the copy is written at a steady 30 frames a second: each tick shows the latest frame at or before it (a frame the
       phone skipped repeats the one before, instead of leaving a gap in the file) */
    let tick=0,lastT=-1;
    const put=()=>{const ts=Math.round(tick*1e6/30);const f=new VideoFrame(cv,{timestamp:ts,duration:33333});const key=frames===0||ts-lastKey>=1000000;if(key)lastKey=ts;ve.encode(f,{keyFrame:key});f.close();lastTs=ts;frames++;tick++};
    const enc=(src,t)=>{if(t<=lastT+1e-4)return false;if(frames)while((tick+0.5)/30<t)put();cx.drawImage(src,0,0,W,H);lastT=t;if(tick/30<=t+0.5/30)put();return true};
    const busy=()=>!!err||ve.encodeQueueSize>6,total=dur+L;
    /* up to the part's end, keeping the part's frames */
    const keep=[];
    await revPass(el,0,Bt,t=>{if(err)throw err;if(enc(el,t)&&t>=A-1e-3)keep.push({t,b:new Promise(r=>cv.toBlob(r,'image/jpeg',0.9))});revProg(Math.min(t,Bt)/total,'Making the reverse… '+Math.round(Math.min(t,Bt)/total*100)+'%')},busy);
    if(REV.stop)throw new Error('stopped');
    /* the fast playback may have skipped frames of the part: fetch those one by one, so the reverse (what you learn
       from) has every frame */
    {const fi=1/30,need=[];let prev=A-fi;const ts=keep.map(x=>x.t).sort((x,y)=>x-y).concat([Bt+fi]);
     for(const t of ts){for(let u=prev+fi;u<t-fi*0.6&&u<=Bt;u+=fi)need.push(u);prev=t}
     for(let k=0;k<need.length;k++){if(REV.stop)throw new Error('stopped');const t=Math.max(0,need[k]);
       await new Promise(r=>{let ok=false;const done=()=>{if(!ok){ok=true;r()}};el.addEventListener('seeked',()=>{if(el.requestVideoFrameCallback)el.requestVideoFrameCallback(()=>done());setTimeout(done,250)},{once:true});el.currentTime=t;setTimeout(done,2500)});
       cx.drawImage(el,0,0,W,H);keep.push({t,b:new Promise(r=>cv.toBlob(r,'image/jpeg',0.9))});
       revProg(Bt/total,'Making the reverse… '+Math.round(Bt/total*100)+'%')}
     keep.sort((x,y)=>x.t-y.t);REV.filled=need.length}
    /* the part backwards, straight after it */
    for(let k=keep.length-1;k>=0;k--){if(err)throw err;if(REV.stop)throw new Error('stopped');const bl=await keep[k].b;if(!bl)continue;const bm=await createImageBitmap(bl);enc(bm,Bt+(Bt-keep[k].t)+1e-4);bm.close();
      while(busy()&&!err)await new Promise(r=>setTimeout(r,10));revProg((Bt+(Bt-keep[k].t))/total,'Making the reverse… '+Math.round((Bt+(Bt-keep[k].t))/total*100)+'%')}
    if(!keep.length)throw new Error('no frames in that part');
    /* the rest, moved along */
    if(dur-Bt>0.05)await revPass(el,Bt,dur+1,t=>{if(err)throw err;if(t<=Bt+1e-3)return;enc(el,t+L);revProg((t+L)/total,'Making the reverse… '+Math.round((t+L)/total*100)+'%')},busy);
    if(REV.stop)throw new Error('stopped');
    while(tick/30<total-0.5/30)put();   /* to the end */
    const kd=tick/30;
    await ve.flush();if(err)throw err;muxer.finalize();ve.close();ve=null;
    const base=(n.name||'clip').replace(/ · reverse.*$/,''),file=new File([target.buffer],base.replace(/[^\w\- ]+/g,'').slice(0,40)+' reverse.mp4',{type:'video/mp4',lastModified:Date.now()});
    revMakeSource(n,file,A,Bt,frames,kd);
  }catch(e){if(!REV.stop)recMsg('Couldn\'t make the reverse ('+(e&&e.message||e)+').',true);revProg(null)}
  finally{try{ve&&ve.close()}catch(e){}el.pause();el.removeAttribute('src');el.load();el.remove();REV.busy=false;cutUI()}
}
/* the new clip: same edits, the part backwards after it, and the skeleton and hits moved to match */
function revMakeSource(n,file,A,Bt,frames,kd){
  const L=Bt-A,mapT=t=>t<Bt-1e-4?t:t+L;
  const P=piecesOf(n).map(p=>({...p})),i=P.findIndex(p=>Math.abs(p.s-A)<1e-3&&Math.abs(p.e-Bt)<1e-3);
  const pieces=[];P.forEach((p,k)=>{if(p.e<=Bt+1e-4)pieces.push(p);else if(p.s>=Bt-1e-4)pieces.push({...p,s:+(p.s+L).toFixed(3),e:+(p.e+L).toFixed(3)});else pieces.push({...p,e:Bt},{...p,s:+(Bt+L).toFixed(3),e:+(p.e+L).toFixed(3)});
    if(k===i)pieces.push({s:Bt,e:+(Bt+L).toFixed(3),on:true,rev:true})});
  const cIn=n.id===S.cur?S.cIn:n.cIn,cOut=n.id===S.cur?S.cOut:n.cOut;
  let motion=null;if(n.motion){const bs=[];for(const b of n.motion.beats||[]){bs.push({...b,t:mapT(b.t)});if(b.t>=A&&b.t<=Bt)bs.push({...b,t:Bt+(Bt-b.t)})}motion={...n.motion,beats:bs.sort((x,y)=>x.t-y.t)}}
  let curve=null;if(n.curve)curve={...JSON.parse(JSON.stringify(n.curve))},curve.pts=(curve.pts||[]).map(q=>({...q,t:mapT(q.t)}));
  const name=(n.name||'Clip').replace(/ · reverse.*$/,'')+' · reverse '+fmtClock(A)+'–'+fmtClock(Bt);
  const m=createSource(file,{name,pieces,motion,curve,cIn:cIn>=Bt?cIn+L:cIn,cOut:cOut!=null?(cOut>=Bt-1e-3?cOut+L:cOut):null,kd});m.dur=kd||m.dur;
  m.revOf={id:n.id,a:A,b:Bt};saveMedia(m.key,file);
  const B=bodyOf(n);
  if(B&&B.n){const rows=[],tA=k=>B.data[k*RB.STRIDE];for(let k=0;k<B.n;k++){const t=tA(k);if(t<Bt-1e-4)rows.push({i:k,t})}
    for(let k=B.n-1;k>=0;k--){const t=tA(k);if(t>=A-1e-4&&t<=Bt+1e-4)rows.push({i:k,t:Bt+(Bt-t)+1e-4})}
    for(let k=0;k<B.n;k++){const t=tA(k);if(t>Bt+1e-4)rows.push({i:k,t:t+L})}
    const ok=rows.filter((r,k)=>k===0||r.t>rows[k-1].t);
    const cuts=[];for(const c of B.cuts||[]){cuts.push(mapT(c));if(c>A&&c<Bt)cuts.push(Bt+(Bt-c))}
    const NB=RB.remapTrack(B,ok,cuts.sort((x,y)=>x-y));NB.start=0;NB.end=(B.end!=null?mapT(B.end):undefined);m.body=NB;mediaPut('body:'+m.key,NB).catch(()=>{})}
  else m.body=undefined;
  S.preview=null;S.useSeq=false;activate(m.id);S.segIdx=0;CUT.sel=pieces.findIndex(p=>p.rev&&Math.abs(p.s-Bt)<1e-3);if(CUT.tl)CUT.tl.fitted=false;
  enable();renderSources();renderMoves();updateTrim();revProg(null);
  const go=()=>{try{v.currentTime=Math.max(0,A-0.05)}catch(e){}cutChanged();renderDance&&renderDance()};if(v.readyState>=1)go();else v.addEventListener('loadedmetadata',go,{once:true});
  recMsg(`Made "${name}": the part plays, then backwards right after it${B&&B.n?', with the skeleton':''}. Your original clip is still in your videos.`+($('#origAudio').checked?' The copy has no sound of its own; the song plays over it.':''));
  try{autosave()}catch(e){}
  window.__rsRev={id:m.id,frames,A,B:Bt,rate:REV.rate,kd,filled:REV.filled};
}

/* ======================= Routine: the timeline editor ======================= */
const RTL={tl:null,drag:null,snap:true};
function rtlBlocks(){const L=segsFor();let T=0;return S.seq.map((x,i)=>{const g=L[i],len=segLen(g),b={i,x,g,a:T,b:T+len};T+=len;return b})}
function rtlBeatsOut(){const rs=routineSong(),G=songGrid(rs);if(!G)return null;const out=[];G.beats.forEach(bt=>{const o=(bt-S.rt.offset)/S.rt.ar;out.push({o,down:(G.down||[]).some(d=>Math.abs(d-bt)<0.02)})});return out}
function rtlSnap(o){
  if(!RTL.snap)return o;const B=rtlBeatsOut();if(!B||B.length<2)return o;
  let best=o,bd=1e9;for(let k=0;k<B.length;k++){const c=[B[k].o];if(B[k+1])c.push((B[k].o+B[k+1].o)/2);for(const t of c){const d=Math.abs(t-o);if(d<bd){bd=d;best=t}}}
  const beat=B.length>1?(B[B.length-1].o-B[0].o)/(B.length-1):0.6;return bd<beat*0.5?best:o;   /* Snap to beat on: always the nearest beat or "and" */
}
function rtlInspector(){
  const box=$('#rtlInspect');if(!box)return;box.textContent='';
  const i=S.seq.findIndex(x=>x.uid===S.sel);if(i<0){box.hidden=true;return}
  const x=S.seq[i],m=moveById(x.id);if(!m){box.hidden=true;return}
  box.hidden=false;
  const head=el('div','rtl-head');head.append(el('b',null,(i+1)+' · '+m.name),el('span','hlen',lenText(x,m)));
  const row=el('div','row rtl-acts');
  const mk=(t,f,cls,dis)=>{const b=el('button','btn sm'+(cls?' '+cls:''),t);b.type='button';b.disabled=!!dis;b.addEventListener('click',f);row.append(b);return b};
  const L=()=>segsFor();
  mk('▶ Play',()=>playRange(segStart(i,L()),segStart(i+1,L())));
  mk('▶ From the one before',()=>playRange(Math.max(0,segStart(i,L())-1.5),segStart(i+1,L())),null,i===0);
  mk('✂ Split here',()=>rtlSplit(i),null,!(routineOn()&&S.segIdx===i));
  mk('Fit to beat',()=>{if(fitEntry(x)){renderMoves();updateTrim()}},null,!beatLen());
  mk('Duplicate',()=>dupSeq(i));
  mk('Remove',()=>{removeSeq(i);S.sel=null;renderMoves()},'danger');
  const wrap=el('div');wrap.append(el('span','len'));
  const ed=editor(x,m,i,wrap);
  /* the trim box brings its own buttons; the inspector already has them, except Reset */
  const ea=ed.querySelector('.ed-acts');if(ea){const rs=[...ea.querySelectorAll('button')].find(b=>/Reset/.test(b.textContent));if(rs){rs.textContent='Undo trims';row.append(rs)}ea.remove()}
  box.append(head,row,ed);
}
function rtlSplit(i){
  const x=S.seq[i];if(!x||!routineOn()||S.segIdx!==i)return;const t=v.currentTime;if(t-x.s<0.15||x.e-t<0.15){recMsg('Move a little further into the move first.');return}
  const y=JSON.parse(JSON.stringify(x));y.uid=++uidCount;x.e=+t.toFixed(3);y.s=+t.toFixed(3);delete x.warp;delete y.warp;S.seq.splice(i+1,0,y);S.sel=y.uid;renderMoves();updateTrim();try{autosave()}catch(e){}
}
function initRoutineTL(){
  const cv=$('#rtlCanvas');if(!cv)return;
  RTL.tl=new TL(cv,{
    len:()=>Math.max(1,seqTotal()+(RTL.drag?0:0.5)),
    hit:(tl,x,y)=>{const Bs=rtlBlocks();const sel=Bs.find(b=>b.x.uid===S.sel);
      if(sel){if(Math.abs(tl.X(sel.a)-x)<16&&y>16)return {kind:'handle',side:'s',i:sel.i};if(Math.abs(tl.X(sel.b)-x)<16&&y>16)return {kind:'handle',side:'e',i:sel.i}}
      const t=tl.T(x),b=Bs.find(b=>t>=b.a&&t<b.b);return b?{kind:'block',i:b.i}:{kind:'bg'}},
    tap:(t,h)=>{if(h&&h.kind==='block'){const x=S.seq[h.i];S.sel=x.uid;if(S.playing)pause();S.useSeq=true;S.preview=null;updateTrim();seekT(Math.min(t,segStart(h.i+1,segsFor())-0.02));renderMoves()}
      else{S.sel=null;renderMoves()}},
    handleStart:h=>{const x=S.seq[h.i];RTL.h={s:x.s,e:x.e,start:segStart(h.i,segsFor())};if(S.playing)pause();delete x.warp},
    handleMove:(h,t)=>{const x=S.seq[h.i],m=moveById(x.id),n=m&&srcById(m.src),r=rateOf(x),dur=n&&n.dur||x.e+5;
      if(h.side==='e'){const end=rtlSnap(t);x.e=+clamp(x.s+(end-RTL.h.start)*r,x.s+0.1,dur).toFixed(3);showFrame(m.src,x.e-0.03)}
      else{/* the move's start: the block's end follows; it snaps so the move still ends on the beat when it can */
        const keepEnd=RTL.h.start+(RTL.h.e-RTL.h.s)/r, dt=t-RTL.h.start;x.s=+clamp(RTL.h.s+dt*r,0,x.e-0.1).toFixed(3);
        const end=RTL.h.start+(x.e-x.s)/r, se=rtlSnap(end);if(se!==end){x.s=+clamp(x.e-(se-RTL.h.start)*r,0,x.e-0.1).toFixed(3)}showFrame(m.src,x.s)}
      updateSeqStats();rtlInspectorLen()},
    handleEnd:()=>{renderMoves();updateTrim();try{autosave()}catch(e){}},
    blockDrag:{
      start:h=>{RTL.drag={from:h.i,to:h.i};S.sel=S.seq[h.i].uid},
      move:(h,t)=>{const Bs=rtlBlocks();let to=Bs.length-1;for(const b of Bs){if(t<(b.a+b.b)/2){to=b.i;break}}RTL.drag.to=to},
      end:(h,t,cancel)=>{const D=RTL.drag;RTL.drag=null;if(!D||cancel||D.to===D.from){renderMoves();return}const [x]=S.seq.splice(D.from,1);S.seq.splice(D.to,0,x);renderMoves();updateTrim();try{autosave()}catch(e){}}},
    draw:(c,tl,W,H)=>{
      c.fillStyle='#12151B';c.fillRect(0,0,W,H);
      const top=20,bot=H-12,th=bot-top,Bs=rtlBlocks();
      /* the song's beats and bars */
      const B=rtlBeatsOut();let bar=0;
      if(B)B.forEach(bt=>{const X=tl.X(bt.o);if(bt.down)bar++;if(X<0||X>W)return;c.fillStyle=bt.down?TLC.song:'rgba(232,163,61,.45)';c.fillRect(X,bt.down?2:9,bt.down?2:1,bt.down?14:7);
        if(bt.down&&tl.pps>24){c.font='700 10px Figtree,system-ui,sans-serif';c.textBaseline='top';c.textAlign='left';c.fillText(String(bar),X+3,2)}});
      else tlTimeLabels(c,tl,W,2);
      /* moves */
      const D=RTL.drag;
      Bs.forEach(b=>{const m=moveById(b.x.id),n=m&&srcById(m.src);let X0=tl.X(b.a),X1=tl.X(b.b);if(X1<0||X0>W)return;
        const lifted=D&&D.from===b.i;c.globalAlpha=lifted?0.35:1;
        tlRound(c,X0+1,top,X1-X0-2,th,8);c.save();c.clip();if(n)tlThumbs(c,n,b.x.s,b.x.e,X0,top,X1-X0,th,px=>toSrc(b.g,tl.T(px)-b.a));
        const grd=c.createLinearGradient(0,top,0,bot);grd.addColorStop(0,'rgba(10,11,14,.65)');grd.addColorStop(0.45,'rgba(10,11,14,0)');c.fillStyle=grd;c.fillRect(X0,top,X1-X0,th);
        c.fillStyle='#F3F1EC';c.font='800 12px Figtree,system-ui,sans-serif';c.textBaseline='top';c.textAlign='left';c.fillText((b.i+1)+(X1-X0>70&&m?' '+m.name:''),X0+7,top+5);
        c.fillStyle=TLC.dance;for(const h of motionIn(b.g.src,b.g.s,b.g.e)||[]){const X=X0+(toOut(b.g,h.t))*tl.pps;c.fillRect(X-1,bot-8,2,7)}
        c.restore();c.globalAlpha=1;
        c.strokeStyle=b.x.uid===S.sel?TLC.sel:'rgba(255,255,255,.18)';c.lineWidth=b.x.uid===S.sel?3:1;tlRound(c,X0+1.5,top+0.5,X1-X0-3,th-1,8);c.stroke();
        if(b.x.uid===S.sel&&!D){for(const X of [X0+1.5,X1-1.5]){c.fillStyle='#F3F1EC';tlRound(c,X-6,top+th/2-15,12,30,6);c.fill();c.fillStyle='#12151B';c.fillRect(X-2,top+th/2-8,1.5,16);c.fillRect(X+0.5,top+th/2-8,1.5,16)}}});
      /* dragging a move: it follows your finger; a bar shows where it will land */
      if(D){const b=Bs[D.from],w=Math.max(30,tl.X(b.b)-tl.X(b.a));const gx=(tl.drag&&tl.drag.gx||0)-w/2;
        const to=Bs[D.to];const ix=tl.X(D.to>D.from?to.b:to.a);c.fillStyle=TLC.sel;c.fillRect(ix-2,top-4,4,th+8);
        c.globalAlpha=0.9;tlRound(c,gx,top-6,w,th,8);c.fillStyle='#2A2F3B';c.fill();c.strokeStyle=TLC.sel;c.lineWidth=2;c.stroke();c.globalAlpha=1;
        const m=moveById(b.x.id);c.fillStyle='#F3F1EC';c.font='800 12px Figtree,system-ui,sans-serif';c.textBaseline='top';c.textAlign='left';c.fillText(String(D.from+1)+(m?' '+m.name:''),gx+7,top);}
      if(routineOn())tlPlayhead(c,tl.X(tPos()),H);
    }});
  $('#rtlZoomIn').addEventListener('click',()=>RTL.tl.zoom(1.6));$('#rtlZoomOut').addEventListener('click',()=>RTL.tl.zoom(1/1.6));
  const sn=$('#rtlSnap');try{RTL.snap=localStorage.getItem('rs-snap')!=='0'}catch(e){}sn.checked=RTL.snap;sn.addEventListener('change',()=>{RTL.snap=sn.checked;try{localStorage.setItem('rs-snap',RTL.snap?'1':'0')}catch(e){}});
}
function rtlInspectorLen(){const i=S.seq.findIndex(x=>x.uid===S.sel),x=S.seq[i],m=x&&moveById(x.id);const l=document.querySelector('#rtlInspect .rtl-head .hlen');if(l&&m)l.textContent=lenText(x,m)}
/* keep both timelines moving with the playhead */
let tlLast=0;
function tlTick(){const now=performance.now();if(now-tlLast<66)return;tlLast=now;
  if(CUT.tl&&!$('#p-clip').hidden){if(S.playing&&CUT.tl.follow)CUT.tl.show(v.currentTime);CUT.tl.redraw()}
  if(RTL.tl&&!$('#p-routine').hidden){if(S.playing&&routineOn()&&RTL.tl.follow)RTL.tl.show(tPos());RTL.tl.redraw()}}
initCut();initRoutineTL();
