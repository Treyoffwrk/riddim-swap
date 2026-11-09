/* Crop to a dancer: in a group clip (a big dancer in front on the left, a smaller one behind on the right who moves
   across), draw a box round the small one with a finger, set a second box later where they've moved to; the box is kept
   with the clip; tracking then follows the small dancer the whole way (the box moves smoothly between the two), where
   without a crop it follows the big one.
   Usage: node crop_test.js <page> <group clip> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
/* where the small dancer is (0-1 of the frame) at time t: x from 500 to 380 px over 12 s, 200×356 px, in 720×640 */
const truth=t=>({x:(500-120*t/12)/720,y:270/640,w:200/720,h:356/640});
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);
 const seek=async t=>{await p.evaluate(t=>{const v=document.querySelector('#stage video:not(.off)');window.__rs.S.segIdx=0;v.currentTime=t},t);await p.waitForTimeout(500)};
 /* the video's rectangle on screen, to place the finger */
 const vr=()=>p.evaluate(()=>{const c=document.getElementById('cropCv').getBoundingClientRect(),v=document.querySelector('#stage video:not(.off)'),R=RB.containRect(c.width,c.height,v.videoWidth,v.videoHeight);return {l:c.left+R.x,t:c.top+R.y,w:R.w,h:R.h}});
 const drag=async(x0,y0,x1,y1)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});for(let k=1;k<=12;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*k/12,y:y0+(y1-y0)*k/12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300)};
 const keys=()=>p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return n.crop?n.crop.keys:null});
 /* 1. draw a box round the small dancer at 0.5 s (a little margin round them) */
 await seek(0.5);await p.evaluate(()=>document.getElementById('cropBtn').click());await p.waitForTimeout(400);
 const on=await p.evaluate(()=>({on:window.__rsCrop.on,cv:!document.getElementById('cropCv').hidden,bar:!document.getElementById('cropBar').hidden}));
 let R=await vr();const T0=truth(0.5),m=0.02;
 await drag(R.l+(T0.x-m)*R.w,R.t+(T0.y-m)*R.h,R.l+(T0.x+T0.w+m)*R.w,R.t+Math.min(0.995,T0.y+T0.h+m)*R.h);
 const k1=await keys();
 const near=(k,T)=>Math.abs(k.x-(T.x-m))<0.02&&Math.abs(k.y-(T.y-m))<0.02&&Math.abs(k.w-(T.w+2*m))<0.03;
 rec('Crop mode: drag a box round the dancer with a finger; it becomes a box at that moment',on.on&&on.cv&&on.bar&&k1&&k1.length===1&&Math.abs(k1[0].t-0.5)<0.05&&near(k1[0],T0)?'passed':'failed',JSON.stringify({on,k1,want:T0}));
 if(SHOT)await p.screenshot({path:SHOT+'-draw.png'});
 /* 2. later, where they've moved: drag the box (from inside it) to them: a second box */
 await seek(11.5);R=await vr();const T1=truth(11.5);const b1=k1[0];
 const cx=R.l+(b1.x+b1.w/2)*R.w,cy=R.t+(b1.y+b1.h/2)*R.h;await drag(cx,cy,cx+(T1.x-T0.x)*R.w,cy);
 const k2=await keys();const lbl=await p.evaluate(()=>document.getElementById('cropBtn').textContent);
 rec('Moved there later, dragging the box sets a second box; the first is unchanged',k2&&k2.length===2&&Math.abs(k2[1].t-11.5)<0.05&&Math.abs(k2[1].x-(T1.x-m))<0.02&&Math.abs(k2[1].w-k2[0].w)<0.002&&k2[0].x===k1[0].x&&/Done cropping/.test(lbl)?'passed':'failed',JSON.stringify({k2,lbl}));
 /* in between, the box moves smoothly: at 6 s it's halfway */
 const mid=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return RB.cropBox(n.crop,6)});
 rec('In between, the box moves smoothly from one to the other',Math.abs(mid.x-((k2[0].x+(k2[1].x-k2[0].x)*(6-k2[0].t)/(k2[1].t-k2[0].t))))<0.002?'passed':'failed',JSON.stringify(mid));
 await p.evaluate(()=>document.getElementById('cropDone').click());await p.waitForTimeout(500);
 const lbl2=await p.evaluate(()=>document.getElementById('cropBtn').textContent);
 /* kept with the clip */
 await p.waitForTimeout(3000);await p.reload();await p.waitForTimeout(3500);const k3=await keys();
 rec('Done: "Crop: 2 boxes", and the boxes are kept with the clip (after reopening)',/Crop: 2 boxes/.test(lbl2)&&k3&&k3.length===2&&k3[1].x===k2[1].x?'passed':'failed',JSON.stringify({lbl2,k3}));
 /* 3. track with the crop: the skeleton is on the small dancer the whole way */
 const trackNow=async()=>{await p.waitForFunction(()=>!document.getElementById('bodyTrack').disabled,null,{timeout:30000});await p.evaluate(()=>document.getElementById('bodyTrack').click());
   for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}};
 const hips=()=>p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body;return [1,3,5,7,9,11].map(t=>{const P=RB.poseAt(B,t);if(!P)return null;const hx=(P[23][0]+P[24][0])/2,hy=(P[23][1]+P[24][1])/2,sy=(P[11][1]+P[12][1])/2;return {t,hx:+hx.toFixed(3),hy:+hy.toFixed(3),torso:+(hy-sy).toFixed(3)}})});
 await trackNow();const H1=await hips();
 const inBox=H1.filter(q=>q&&(()=>{const T=truth(q.t);return q.hx>T.x&&q.hx<T.x+T.w&&q.hy>T.y&&q.hy<T.y+T.h&&q.torso<0.2})()).length;
 rec('Tracking with the crop follows the small dancer at the back the whole way (as they move across)',inBox>=5?'passed':'failed',JSON.stringify({inBox,H1}));
 /* 4. without the crop it follows the big dancer in front (so the crop is what made the difference) */
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.crop=null;n.body=null});
 await trackNow();const H2=await hips();const left=H2.filter(q=>q&&q.hx<0.5).length;
 rec('Without a crop the tracker follows the big dancer in front instead',left>=5?'passed':'failed',JSON.stringify({left,H2}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
