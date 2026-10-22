# ---- compare your try with the original: hips side by side, lined up by movement --------------------------------------------
rep("""<div class="row mv-only" id="pickRow"><button class="btn sm" id="bodyPick">Choose the dancer</button><span class="hint" id="pickMsg"></span></div>""",
    """<div class="row mv-only" id="pickRow"><button class="btn sm" id="bodyPick">Choose the dancer</button><span class="hint" id="pickMsg"></span></div>
          <div class="cmprow mv-only" id="cmpRow"><span class="label">Compare a try</span><select id="cmpPick" class="txt" aria-label="Video of your try"></select><button class="btn sm" id="cmpGo">Compare</button></div>
          <p class="hint mv-only" id="cmpOut"></p>""")
rep("""/* ===== Sound System: the look shared with MirrorView.""","""
.cmprow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
html.rs-hosted .cmprow.mv-only{display:flex!important}
html.rs-hosted p.mv-only#cmpOut{display:block!important}
.cmprow select{flex:1 1 140px;min-height:40px;font:600 15px var(--f-body);padding:6px 10px}
#cmpOut b{color:var(--ink)}
/* ===== Sound System: the look shared with MirrorView.""")
CMP_JS = r"""
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
"""
rep("""/* test hook: only with #debug in the address */""", CMP_JS + """/* test hook: only with #debug in the address */""")
# overlay on the graph: your tilt in blue, the weakest stretch shaded
rep("""  line('sway',SWAY,'rgba(243,241,236,.7)',1.5*dpr); line('tilt',TILT,tok('--hips'),2.5*dpr);""",
"""  const C=S.cmp&&!S.cmp.err&&S.cmp.match>=0.3&&S.cmp.refId===S.cur?S.cmp:null;
  if(C){if(C.weakest&&C.weakest.alike<0.6){x.fillStyle='rgba(255,148,102,.13)';x.fillRect(X(C.weakest.t0),0,X(C.weakest.t1)-X(C.weakest.t0),h)}
    x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;x.setLineDash([5*dpr,4*dpr]);x.beginPath();let on=false;
    for(let k=0;k<C.tt.length;k++){const tRef=C.ra+(k-C.off)*C.step;const val=C.tt[k];if(!(val===val)||tRef<0||tRef>d){on=false;continue}const px=X(tRef),py=mid-Math.max(-1,Math.min(1,val/TILT))*amp;if(!on){x.moveTo(px,py);on=true}else x.lineTo(px,py)}
    x.stroke();x.setLineDash([])}
  else line('sway',SWAY,'rgba(243,241,236,.7)',1.5*dpr);
  line('tilt',TILT,tok('--hips'),2.5*dpr);""")
rep("""if(/debug/.test(location.hash))window.__rs={""","""if(/debug/.test(location.hash))window.__rs={compareTry,compareText,""")
