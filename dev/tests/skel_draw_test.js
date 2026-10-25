/* Skeleton drawing: hidden while the video is seeking (no skeleton on the wrong picture); hip gauges stay off the ball
   cues. Usage: node skel_draw_test.js <host> <clip> <song> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 await p.click('#bodyTrack');for(let i=0;i<3000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.evaluate(()=>{window.scrollTo(0,0);window.__rs.v().currentTime=3});await p.waitForTimeout(800);
 const lit=(side)=>p.evaluate(side=>{const c=document.getElementById('bodyCanvas'),x=c.getContext('2d'),v=window.__rs.v(),r=RB.containRect(c.width,c.height,v.videoWidth,v.videoHeight);
   const x0=side==='bars'?0:r.x, x1=side==='bars'?r.x:r.x+r.w;if(x1-x0<2)return -1;const d=x.getImageData(x0,0,x1-x0,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n},side);
 /* the hip gauges: with ball cues on they'd sit in the left bar over the Riddim ball */
 const st=await p.evaluate(()=>({bv:window.__rs.S.beatView,hips:document.getElementById('hipShow').checked,body:document.getElementById('bodyShow').checked}));
 if(!st.body)await p.click('#dkBody');if(!st.hips)await p.evaluate(()=>{const h=document.getElementById('hipShow');h.checked=true;h.dispatchEvent(new Event('change'))});
 await p.waitForTimeout(500);const withBalls=await lit('bars'), sk=await lit('video');await p.locator('#stage').screenshot({path:SHOT+'-balls.png'}).catch(()=>{});
 rec('With ball cues on, the hip gauges stay out of the side bars (the balls are there)',withBalls===0&&sk>200?'passed':'failed',`lit pixels in the side bars ${withBalls} · skeleton pixels on the video ${sk} · cues ${st.bv}`);
 /* while seeking, nothing is drawn */
 await p.evaluate(()=>{const v=window.__rs.v();Object.defineProperty(v,'seeking',{configurable:true,get:()=>true});v.currentTime=5});await p.waitForTimeout(400);
 const during=await lit('video');
 await p.evaluate(()=>{delete window.__rs.v().seeking});await p.waitForTimeout(500);const after=await lit('video');
 rec('While the video is seeking (a loop restarting), no skeleton is drawn on the old picture',during===0&&after>200?'passed':'failed',`while seeking ${during} · after ${after}`);
 /* a run that stopped part-way says so */
 const cov=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,st=B.data.length/B.n,k=Math.floor(B.n/5);return {full:RB.coverage(B),cut:RB.coverage({...B,n:k,data:B.data.slice(0,k*st)})}});
 rec('Coverage: a full run reads ~100%, a run that stopped at a fifth reads short',cov.full.pct>=95&&!cov.full.short&&cov.cut.short&&cov.cut.pct<30?'passed':'failed',JSON.stringify(cov));
 /* tracking quality: Accurate (heavy model) by default with the new smoothing; Faster switches the model */
 const tq=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,ui=[...document.querySelectorAll('#trackQ button')].map(b=>b.dataset.q+':'+b.getAttribute('aria-pressed'));
   document.querySelector('#trackQ [data-q="fast"]').click();const fast=RB.modelName();document.querySelector('#trackQ [data-q="accurate"]').click();
   return {model:B.model,cleanV:B.cleanV,ui,fast,back:RB.modelName(),info:document.getElementById('bodyInfo').textContent.slice(0,60)}});
 rec('Tracking: Accurate (the bigger tracker) by default with the new smoothing; Faster switches it',/heavy/.test(tq.model)&&tq.cleanV===2&&tq.ui.join()==='accurate:true,fast:false'&&tq.fast==='full'&&tq.back==='heavy'?'passed':'failed',JSON.stringify(tq));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
