/* Speed graph editing on a phone (real touch): a tap adds one point, a drag on empty space adds none; a grabbed point
   moves by exactly how far the finger moves (it doesn't jump under the finger); a tap on a point doesn't move it; dragging
   snaps to a dance hit and to a round speed (and not with Snap off); the step buttons; zoom; the point readout.
   Usage: node spd_ui_test.js <page> <clip with hits> <hits.json> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,HITS,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:3,hasTouch:true,isMobile:true});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* the clip's hits, so there is something to snap to */
 const hits=JSON.parse(require('fs').readFileSync(HITS,'utf8'));const H=(hits.hits||hits.truth||hits).map(x=>typeof x==='number'?x:x.t).filter(x=>isFinite(x));
 await p.evaluate(H=>{const R=window.__rs,n=R.srcById(R.S.cur);n.motion={beats:H.map(t=>({t,w:1})),src:'test'}},H);
 await p.evaluate(()=>{document.getElementById('t-clip').click();const d=document.querySelector('details[data-more="clip"]');if(d)d.open=true;const s=document.getElementById('spdOn');if(!s.checked)s.click()});await p.waitForTimeout(500);
 await p.evaluate(()=>document.getElementById('spdCanvas').scrollIntoView({block:'center'}));await p.waitForTimeout(400);
 const box=await p.locator('#spdCanvas').boundingBox();
 const geo=()=>p.evaluate(()=>{const R=window.__rs,c=document.getElementById('spdCanvas').getBoundingClientRect(),z=window.__rsSPD;return {w:c.width,h:c.height,vs:z.geo().vs,ve:z.geo().ve}});
 const pts=()=>p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);return n.curve.pts.map(q=>({t:+q.t.toFixed(4),y:+q.y.toFixed(4)}))});
 const sel=()=>p.evaluate(()=>window.__rsSPD.sel);
 /* touch helpers in CSS px of the canvas */
 const cdp=await ctx.newCDPSession(p);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:box.x+x,y:box.y+y}]});
 const tapAt=async(x,y)=>{await touch('touchStart',x,y);await p.waitForTimeout(60);await touch('touchEnd');await p.waitForTimeout(250)};
 const dragAt=async(x,y,dx,dy)=>{await touch('touchStart',x,y);for(let k=1;k<=10;k++){await touch('touchMove',x+dx*k/10,y+dy*k/10);await p.waitForTimeout(16)}await touch('touchEnd');await p.waitForTimeout(250)};
 let g=await geo();const L=44,R=14,T=36,B=22;
 const X=t=>L+(t-g.vs)/(g.ve-g.vs)*(g.w-L-R),Tt=x=>g.vs+(x-L)/(g.w-L-R)*(g.ve-g.vs),Y=y=>T+(2-y)/4*(g.h-T-B),V=py=>2-(py-T)/(g.h-T-B)*4;
 const n0=(await pts()).length;
 /* 1. tap on empty space adds exactly one point; a drag across empty space adds none */
 const tAdd=g.vs+(g.ve-g.vs)*0.37;await tapAt(X(tAdd),Y(0.5));const a1=await pts();
 await dragAt(X(g.vs+(g.ve-g.vs)*0.7),Y(-1),40,10);const a2=await pts();
 rec('A tap on the graph adds one point there; a drag over empty space adds none',a1.length===n0+1&&Math.abs(a1.find(q=>Math.abs(q.t-tAdd)<0.2).y-0.5)<0.15&&a2.length===a1.length?'passed':'failed',JSON.stringify({n0,after:a1.length,afterDrag:a2.length}));
 /* 2. grab the new point 14 px off its centre and drag it: it moves by exactly the finger's movement */
 await p.evaluate(()=>{window.__rsSPD.snap=false});
 const i=a1.findIndex(q=>Math.abs(q.t-tAdd)<0.2),P0=a1[i];
 await dragAt(X(P0.t)+14,Y(P0.y)-10,-30,25);const b1=(await pts())[i];
 const wantT=P0.t+Tt(X(P0.t)-30)-Tt(X(P0.t)),wantY=P0.y+V(Y(P0.y)+25)-V(Y(P0.y));
 rec('A grabbed point moves by exactly how far the finger moves (no jump to the finger)',Math.abs(b1.t-wantT)<0.03&&Math.abs(b1.y-wantY)<0.03?'passed':'failed',JSON.stringify({from:P0,to:b1,want:{t:+wantT.toFixed(3),y:+wantY.toFixed(3)}}));
 /* 3. a tap on a point selects it without moving it, and the readout says where it is */
 await tapAt(X(b1.t)+5,Y(b1.y)+4);const b2=(await pts())[i],s2=await sel(),txt=await p.evaluate(()=>!document.getElementById('spdPt').hidden&&document.getElementById('spdPtTxt').textContent);
 rec('A tap on a point selects it without moving it; the readout shows its time and speed',b2.t===b1.t&&b2.y===b1.y&&s2===i&&/Point \d+ of \d+: 0:\d\d\.\d\d · [\d.]+×/.test(txt||'')?'passed':'failed',JSON.stringify({b1,b2,sel:s2,txt}));
 /* 4. with Snap on, dragging near a hit lands on it exactly, and near 1.5× lands on 1.5× */
 await p.evaluate(()=>{window.__rsSPD.snap=true});
 const P=await pts(),lo=i>0?P[i-1].t+0.05:g.vs,hi=i<P.length-1?P[i+1].t-0.05:g.ve;
 const ST=await p.evaluate(()=>window.__rsSPD.snapTimes());const pxs=(g.ve-g.vs)/(g.w-L-R);
 const hitT=H.filter(t=>t>lo+0.1&&t<hi-0.1&&!ST.some(x=>x.kind==='beat'&&Math.abs(x.t-t)<5*pxs)).sort((a,b)=>Math.abs(a-b1.t)-Math.abs(b-b1.t))[0];
 let snapRes=null;
 if(hitT!=null){const nb=ST.filter(x=>x.kind==='beat').reduce((a,x)=>Math.abs(x.t-hitT)<Math.abs(a-hitT)?x.t:a,1e9),tx=X(hitT)+(nb>hitT?-3:3),ty=Y(Math.log2(1.5))+4;await dragAt(X(b1.t),Y(b1.y),tx-X(b1.t),ty-Y(b1.y));snapRes=(await pts())[i]}
 rec('Snap: dragged near a dance hit it lands on the hit exactly, and near 1.5× on 1.5×',snapRes&&Math.abs(snapRes.t-hitT)<0.002&&Math.abs(snapRes.y-Math.log2(1.5))<0.002?'passed':'failed',JSON.stringify({hitT,snapRes,lo,hi}));
 await p.evaluate(()=>document.getElementById('spdSnap').click());const snapOff=await p.evaluate(()=>window.__rsSPD.snap);
 const c0=(await pts())[i];await dragAt(X(c0.t),Y(c0.y),9,-7);const c1=(await pts())[i];
 rec('With Snap off the same small drag moves it freely (not back onto the hit or speed)',snapOff===false&&Math.abs(c1.t-c0.t)>0.01&&Math.abs(c1.y-c0.y)>0.01?'passed':'failed',JSON.stringify({c0,c1}));
 /* 5. step buttons */
 const d0=(await pts())[i];
 await p.evaluate(()=>document.querySelector('[data-sp="t+"]').click());await p.waitForTimeout(150);const d1=(await pts())[i];
 await p.evaluate(()=>document.querySelector('[data-sp="y+"]').click());await p.waitForTimeout(150);const d2=(await pts())[i];
 await p.evaluate(()=>document.querySelector('[data-sp="beat"]').click());await p.waitForTimeout(150);const d3=(await pts())[i];
 const onBeat=await p.evaluate(t=>window.__rsSPD.snapTimes().some(x=>Math.abs(x.t-t)<0.002),d3.t);
 rec('Step buttons: ▶ one frame later, +5% faster, "To beat" onto the nearest beat or hit',Math.abs(d1.t-d0.t-1/30)<0.002&&Math.abs(Math.pow(2,d2.y)/Math.pow(2,d1.y)-1.05)<0.002&&onBeat?'passed':'failed',JSON.stringify({d0,d1,d2,d3,onBeat}));
 /* 6. zoom in: the view narrows around the selected point */
 const z0=await geo();await p.evaluate(()=>document.getElementById('spdZoomIn').click());await p.evaluate(()=>document.getElementById('spdZoomIn').click());await p.waitForTimeout(200);const z1=await geo();
 const zt=await p.evaluate(()=>document.getElementById('spdZoomTxt').textContent);
 rec('Zoom +: 4× shows a quarter of the clip around the selected point',Math.abs((z1.ve-z1.vs)-(z0.ve-z0.vs)/4)<0.05&&d3.t>=z1.vs&&d3.t<=z1.ve&&zt==='4×'?'passed':'failed',JSON.stringify({before:[z0.vs,z0.ve],after:[z1.vs,z1.ve],pt:d3.t,zt}));
 /* zoomed in, a 30 px drag moves the point by a quarter of what it did at 1× */
 g=z1;await p.evaluate(()=>{window.__rsSPD.snap=false});const e0=(await pts())[i];await dragAt(X(e0.t),Y(e0.y),30,0);const e1=(await pts())[i];
 const per=(z0.ve-z0.vs)/(z0.w-L-R)*30/4;
 rec('Zoomed in 4×, the same finger movement moves the point 4× less (finer placing)',Math.abs((e1.t-e0.t)-per)<0.02?'passed':'failed',JSON.stringify({moved:+(e1.t-e0.t).toFixed(3),want:+per.toFixed(3)}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
