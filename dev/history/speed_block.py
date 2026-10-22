# ---- speed graph: draw how fast the clip plays over time ------------------------------------------------------------
# The clip's playback already runs through a time map (the "Aligned" routine uses it): knots [[source s, output s]...].
# The graph is a curve of speed over the clip's own time; it is turned into that map, so playback, the song sync,
# live speed changes and recording all follow it with no extra code paths.
rep("""  return [{src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}];
}""", """  const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}; const k=curveKnots(srcById(S.cur),g); if(k)g.k=k;
  return [g];
}""")
# saved with the project
rep("""cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut,motion:n.motion||null})),""",
    """cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut,motion:n.motion||null,curve:n.curve||null})),""")
rep("""    motion:meta.motion||null};""", """    motion:meta.motion||null, curve:meta.curve||null};""")
# beat fit and the song ticks under the video follow the graph
rep("""    const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}, f=fitOf([g],liveGrid(),S.offset,S.ar,0);""",
    """    const g=segs()[0]||{src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}, f=fitOf([g],liveGrid(),S.offset,S.ar,0);""")
rep("""  if(G){x.fillStyle=tok('--song-hot');for(const b of G.beats){const src=S.cIn+((b-S.offset)/S.ar)*S.vr;if(src<0||src>d)continue;x.fillRect(src/d*w,0,dpr,h*0.5)}}
  if(n&&n.motion)""", """  if(G){x.fillStyle=tok('--song-hot');const g0=segs()[0];for(const b of G.beats){const o=(b-S.offset)/S.ar;const src=g0&&g0.k?(o<0||o>segLen(g0)?-1:toSrc(g0,o)):S.cIn+o*S.vr;if(src<0||src>d)continue;x.fillRect(src/d*w,0,dpr,h*0.5)}}
  if(n&&n.motion)""")

SPEED_CSS = """
/* speed graph */
.spd{display:grid;gap:10px}
.spd-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.spd-top h3{margin-right:auto}
.switch{display:inline-flex;align-items:center;gap:8px;font:700 15px var(--f-body);cursor:pointer;min-height:44px}
.switch input{appearance:none;-webkit-appearance:none;width:50px;height:30px;border-radius:999px;background:var(--line);position:relative;cursor:pointer;margin:0;transition:background .15s}
.switch input::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:var(--ink);transition:transform .15s}
.switch input:checked{background:var(--dance)}
.switch input:checked::after{transform:translateX(20px);background:#0E1014}
.spd-graph{position:relative;background:#14171D;border:1px solid var(--line);border-radius:14px;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
.spd-graph canvas{display:block;width:100%;height:210px;cursor:crosshair}
.spd.off .spd-graph{opacity:.45}
.spd-read{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font:600 14px var(--f-body);color:var(--muted)}
.spd-read b{font:700 16px var(--f-mono);color:var(--ink)}
.spd-presets{display:flex;gap:6px;flex-wrap:wrap}
.spd-presets .btn{flex:1 1 auto}
.spd-acts{display:flex;gap:6px;flex-wrap:wrap}
"""
rep("""/* ===== Sound System: the look shared with MirrorView.""", SPEED_CSS + """/* ===== Sound System: the look shared with MirrorView.""")

rep("""        <label class="check"><input type="checkbox" id="origAudio"> Play the clip's own sound too</label>""",
"""        <section class="anal spd off" id="spdCard" aria-labelledby="h-spd">
          <div class="spd-top"><h3 id="h-spd">Speed graph</h3>
            <label class="switch"><input type="checkbox" id="spdOn" aria-describedby="spdHelp"> <span id="spdOnTxt">Off</span></label></div>
          <p class="hint" id="spdHelp">Draw how fast the dance plays. Up is faster, down is slower. Tap the graph to add a point, drag points to shape it. The song keeps its own speed.</p>
          <div class="spd-presets" role="group" aria-label="Quick shapes">
            <button class="btn sm" data-spd="slowmo">Slow-mo here</button>
            <button class="btn sm" data-spd="up">Speed up</button>
            <button class="btn sm" data-spd="down">Slow down</button>
            <button class="btn sm" data-spd="flat">Normal</button>
          </div>
          <div class="spd-graph" id="spdGraph"><canvas id="spdCanvas" role="img" aria-label="Speed graph: speed of the clip over time"></canvas></div>
          <div class="spd-read"><span>Speed now <b id="spdNow">1.00×</b></span><span>Length <b id="spdLen">—</b></span></div>
          <div class="spd-acts">
            <button class="btn sm" id="spdDel" disabled>Delete point</button>
            <button class="btn sm" id="spdSmooth" disabled>Smooth point</button>
            <button class="btn sm" id="spdUndo" disabled>Undo</button>
          </div>
          <p class="hint" id="spdNote">Blue ticks are the dance hits and orange ticks are the song's beats, where they land with this curve. Drag along the top strip to move through the clip.</p>
        </section>
        <label class="check"><input type="checkbox" id="origAudio"> Play the clip's own sound too</label>""")

SPEED_JS = r"""
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
  if(knotMemo&&knotMemo.key===key)return knotMemo.k;
  const ts=new Set(); const step=1/40; for(let t=g.s;t<g.e;t+=step)ts.add(+t.toFixed(4)); ts.add(g.e);
  c.pts.forEach(p=>{if(p.t>g.s&&p.t<g.e)ts.add(+p.t.toFixed(4))});
  const T=[...ts].sort((a,b)=>a-b), k=[[T[0],0]]; let o=0;
  for(let i=1;i<T.length;i++){const a=T[i-1],b=T[i];o+=(b-a)/spdRateAt(c,(a+b)/2,g.r);k.push([b,o])}
  knotMemo={key,k}; return k;
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
(function spdLoop(){try{if(spdVisible()){spdDraw();spdNowText()}}catch(e){}requestAnimationFrame(spdLoop)})();
setInterval(()=>{try{spdUI()}catch(e){}},500);
$('#t-clip').addEventListener('click',()=>setTimeout(()=>{spdUI();spdDraw()},0));
"""
rep("""/* test hook: only with #debug in the address */""", SPEED_JS + """/* test hook: only with #debug in the address */""")
# expose for tests
rep("""if(/debug/.test(location.hash))window.__rs={S,RA,segs,tPos,srcById,routineOn};""",
    """if(/debug/.test(location.hash))window.__rs={S,RA,segs,tPos,srcById,routineOn,segLen,toOut,toSrc,spdRateAt,curveOf,SPD,curRate,v:()=>v};""")
