/* Riddim Swap dance body on a real clip: tracking coverage, frame timing, drawing, hits from the body, persistence. */
const {launch}=require('./harness');const fs=require('fs');const {execFileSync}=require('child_process');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 const t0=Date.now();await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const B=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body;const ts=[];for(let i=0;i<B.n;i++)ts.push(B.data[i*100]);const d=[];for(let i=1;i<ts.length;i++)d.push(ts[i]-ts[i-1]);d.sort((a,b)=>a-b);
   return {n:B.n,seen:B.seen,missed:B.missed,ms:+B.msPerFrame.toFixed(0),delegate:B.delegate,dur:+document.querySelector('#stage video').duration.toFixed(2),medGap:+(d[d.length>>1]*1000).toFixed(1),maxGap:+(d[d.length-1]*1000).toFixed(1),info:document.querySelector('#bodyInfo').textContent,hitsSrc:n.motion&&n.motion.source,hits:n.motion&&n.motion.beats.length}});
 const secs=((Date.now()-t0)/1000).toFixed(0);
 const real=+execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v','-show_entries','stream=nb_read_frames','-of','csv=p=0',CLIP]).toString().trim();
 rec('Tracks the body on every frame',B.seen>=0.95*B.n&&B.n>=0.97*real?'passed':'failed',`${B.seen}/${B.n} tracked frames have a body; the clip has ${real} real frames, median gap ${B.medGap} ms, largest ${B.maxGap} ms, ${B.missed} skipped; ${B.ms} ms/frame on ${B.delegate} here (software); took ${secs} s`);
 rec('Hits come from the body',B.hitsSrc==='pose'&&B.hits>5?'passed':'failed',`${B.hits} raw hits · card: "${B.info}"`);
 /* draw at a fast hip moment and check pixels on the canvas */
 await p.evaluate(()=>{const v=document.querySelector('#stage video');v.currentTime=6.77});await p.waitForTimeout(600);
 const px=await p.evaluate(()=>{const c=document.getElementById('bodyCanvas');const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let blue=0,pink=0;for(let i=0;i<x.length;i+=4){if(x[i+3]<40)continue;if(x[i+2]>180&&x[i]<160)blue++;else if(x[i]>200&&x[i+2]>110&&x[i+1]<140)pink++}return {w:c.width,h:c.height,blue,pink}});
 rec('Dance body is drawn over the video',px.blue>500&&px.pink>100?'passed':'failed',JSON.stringify(px));
 await p.locator('#stage').screenshot({path:SHOT+'-stage.png'});
 /* timing: the drawn pose matches the frame — compare the pose used at t with the stored sample nearest to t */
 const sync=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body,v=document.querySelector('#stage video');const t=v.currentTime;const P=RB.poseAt(B,t);let best=1e9;for(let i=0;i<B.n;i++)best=Math.min(best,Math.abs(B.data[i*100]-t));return {t:+t.toFixed(3),nearestSampleMs:+(best*1000).toFixed(1),havePose:!!P}});
 rec('Pose shown is the frame on screen',sync.havePose&&sync.nearestSampleMs<=20?'passed':'failed',JSON.stringify(sync));
 /* toggles */
 await p.click('#t-clip');await p.uncheck('#bodyShow');await p.waitForTimeout(200);
 const off=await p.evaluate(()=>{const c=document.getElementById('bodyCanvas');const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<x.length;i+=4)if(x[i])n++;return n});
 rec('Show body off clears the overlay',off===0?'passed':'failed','painted pixels '+off);await p.check('#bodyShow');
 /* persistence */
 await p.waitForTimeout(3500);await p.reload();await p.waitForTimeout(3500);
 const again=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {body:!!(n.body&&n.body.n),src:n.motion&&n.motion.source,info:document.querySelector('#bodyInfo').textContent}});
 rec('Body tracking is kept after reload',again.body&&again.src==='pose'?'passed':'failed',JSON.stringify(again));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
