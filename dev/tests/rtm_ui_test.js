/* The RTMPose trial in the app: Tracking → RTMPose (trial), Track again, then Compare: this track / previous / both, and the
   phone check reports RTMPose's speed. Usage: node rtm_ui_test.js <host> <clip> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({viewport:{width:402,height:874}});await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 const track=async()=>{await p.click('#bodyTrack');await p.waitForTimeout(800);for(let i=0;i<6000;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({busy:window.__rs.S.bodyBusy,err:window.__rs.S.bodyErr||''}));if(st.err)return st.err;if(!st.busy)return ''}};
 const e1=await track();const m1=await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).body.model);
 /* choose the trial and track again (the test harness pins the regular tracker; lift that for this run) */
 await p.evaluate(()=>{delete window.RB_MODEL});await p.click('#trackQ [data-q="rtm"]');
 const note=await p.textContent('#trackQNote');
 const e2=await track();
 const r=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {model:n.body&&n.body.model,alt:n.bodyAlt&&n.bodyAlt.model,row:!document.getElementById('cmpRow').hidden,labels:[...document.querySelectorAll('#cmpSeg button')].map(b=>b.textContent),rtmMs:n.body&&Math.round(n.body.rtmMs),errors:n.body&&n.body.rtmErrors}});
 rec('Tracking offers RTMPose and explains it, with a time estimate',/hands and feet/.test(note)&&/Tracking takes (about|roughly) \d+/.test(note)?'passed':'failed',note);
 rec('Tracking again with RTMPose works and keeps the previous track to compare',!e1&&!e2&&/rtmpose/.test(r.model||'')&&/full|heavy/.test(r.alt||'')&&r.errors===0?'passed':'failed',JSON.stringify({e1,e2,first:m1,...r}));
 rec('A Compare switch appears: this track, previous (orange), both',r.row&&r.labels.join('|')==='RTMPose|Faster (orange)|Both'?'passed':'failed',JSON.stringify(r.labels));
 /* the drawing: orange pixels only when the previous track is shown */
 await p.evaluate(()=>{window.scrollTo(0,0);const v=window.__rs.v();v.currentTime=4});await p.waitForTimeout(800);
 const orange=()=>p.evaluate(()=>{const c=document.getElementById('bodyCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let o=0,lit=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>150){lit++;if(d[i]>220&&d[i+1]>150&&d[i+1]<200&&d[i+2]<110)o++}}return {o,lit}});
 const set=async c=>{await p.click(`#cmpSeg [data-c="${c}"]`);await p.waitForTimeout(400);return orange()};
 const now=await set('now'),prev=await set('prev'),both=await set('both');await p.locator('#stage').screenshot({path:SHOT+'-both.png'});
 rec('This track / Previous / Both draw the right skeletons',now.o<50&&prev.o>300&&both.o>0.4*prev.o&&both.lit>prev.lit?'passed':'failed',JSON.stringify({now,prev,both}));
 /* fingers and toes: RTMPose's hand and foot points are kept per frame and drawn */
 const hf=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE;if(!B.ext)return {ext:false};
   let frames=0,hands=0;for(let i=0;i<B.n;i++){let h=0;for(let u=6;u<48;u++)if(!isNaN(B.ext[(i*48+u)*3]))h++;frames++;if(h>=15)hands++}
   /* drawing with and without hands on a spare canvas, at a frame where the hands were found */
   let ti=-1;for(let i=0;i<B.n&&ti<0;i++){let h=0;for(let u=6;u<48;u++)if(!isNaN(B.ext[(i*48+u)*3]))h++;if(h>=30)ti=i}
   const t=B.data[Math.max(0,ti)*S],cv=document.createElement('canvas');cv.width=360;cv.height=640;const x=cv.getContext('2d'),rect={x:0,y:0,w:360,h:640};
   const lit=()=>{const d=x.getImageData(0,0,360,640).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>100)n++;return n};
   x.clearRect(0,0,360,640);RB.draw(x,B,t,rect,{hipPath:false,meter:false,feet:false,hands:false});const without=lit();
   x.clearRect(0,0,360,640);RB.draw(x,B,t,rect,{hipPath:false,meter:false,feet:false});const withH=lit();
   return {ext:true,frames,framesWithHands:hands,at:+t.toFixed(2),without,withHands:withH}});
 rec('RTMPose tracks keep hand and foot points, and the skeleton draws fingers and toes',hf.ext&&hf.framesWithHands>0.5*hf.frames&&hf.withHands>hf.without*1.05?'passed':'failed',JSON.stringify(hf));
 await p.click('#projBtn');await p.waitForTimeout(500);
 await p.click('#phoneCheck').catch(()=>{});await p.waitForTimeout(1200);const rep=await p.evaluate(()=>{const o=document.getElementById('phoneCheckOut');return (o&&(o.value||o.textContent))||''});
 rec('The phone check says the RTMPose trial was used and how fast it was',/· RTMPose ·/.test(rep)&&/RTMPose \d+ ms\/frame/.test(rep)?'passed':'failed',(rep.match(/Tracking:[^\n]*/)||[rep.slice(0,200)])[0]);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
