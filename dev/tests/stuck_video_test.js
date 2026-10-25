/* iPhone fault: part-way through tracking, the tracking video keeps showing the same picture. The skeleton must never
   freeze (the same pose repeated while the dancer moves). WAKE=1: a short play revives the video (as on iPhone);
   otherwise nothing revives it and the tracker must leave a gap and say so.
   Usage: [WAKE=1] node stuck_video_test.js <host> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const WAKE=!!process.env.WAKE;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(wake=>{window.RB_DELEGATE='CPU';window.RB_MODEL='full';
   /* from the 60th frame drawn, the tracking video's picture stops changing (and the frame clock goes quiet) */
   const draw=CanvasRenderingContext2D.prototype.drawImage;let n=0,frozen=null,woke=false;window.__stuck={drawn:0,woke:0};
   const isTrack=s=>s instanceof HTMLVideoElement&&s.id!=='vid'&&!s.closest('.stage');
   CanvasRenderingContext2D.prototype.drawImage=function(src,...a){
     if(isTrack(src)&&this.canvas.width>100){n++;window.__stuck.drawn=n;
       if(n>=60&&!woke){if(!frozen){frozen=document.createElement('canvas');frozen.width=src.videoWidth;frozen.height=src.videoHeight;draw.call(frozen.getContext('2d'),src,0,0)}return draw.call(this,frozen,...a)}}
     return draw.call(this,src,...a)};
   const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(isTrack(this)&&frozen&&wake){woke=true;window.__stuck.woke++}return play.call(this)};
   const rv=HTMLVideoElement.prototype.requestVideoFrameCallback;if(rv)HTMLVideoElement.prototype.requestVideoFrameCallback=function(cb){if(isTrack(this)&&frozen&&!woke)return 0;return rv.call(this,cb)};
 },WAKE);
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 await p.click('#bodyTrack');
 let vis=null;for(let i=0;i<10&&!vis;i++){await p.waitForTimeout(400);vis=await p.evaluate(()=>{const v=document.querySelector('.rb-trackvid');if(!v)return null;const r=v.getBoundingClientRect(),cs=getComputedStyle(v);return {w:Math.round(r.width),h:Math.round(r.height),opacity:+cs.opacity,inView:r.right<=innerWidth&&r.bottom<=innerHeight&&r.left>=0&&r.top>=0}})}
 for(let i=0;i<3000;i++){await p.waitForTimeout(500);if(i%20==0)console.log("progress",await p.evaluate(()=>document.getElementById("bodyInfo").textContent.slice(0,90)+" drawn "+window.__stuck.drawn));if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const r=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE;let run=1,maxRun=1,maxAt=0;
   /* longest run of frames with the same pose (all landmarks within 0.001) */
   for(let i=1;i<B.n;i++){let same=!isNaN(B.data[i*S+1])&&!isNaN(B.data[(i-1)*S+1]);for(let j=0;same&&j<33;j++)if(Math.abs(B.data[i*S+1+j*3]-B.data[(i-1)*S+1+j*3])>0.001||Math.abs(B.data[i*S+2+j*3]-B.data[(i-1)*S+2+j*3])>0.001)same=false;
     if(same){run++;if(run>maxRun){maxRun=run;maxAt=B.data[i*S]}}else run=1}
   const c=RB.coverage(B);return {n:B.n,stale:B.stale,kicks:B.kicks,coverage:c&&c.pct,maxSamePose:maxRun,at:+maxAt.toFixed(2),info:document.getElementById('bodyInfo').textContent.slice(0,140),stuck:window.__stuck}});
 rec('While tracking, the video shows as a small preview in view (iPhone keeps feeding frames to a video it can see)',vis&&vis.h>=60&&vis.opacity===1&&vis.inView?'passed':'failed',JSON.stringify(vis));
 rec('The skeleton never freezes: no run of the same pose longer than 2 frames',r.maxSamePose<=2?'passed':'failed',JSON.stringify(r));
 if(WAKE)rec('A stuck video is woken with a short play and tracking covers the whole clip',r.kicks>0&&r.coverage>=95?'passed':'failed',`woken ${r.kicks}× · covers ${r.coverage}% · stuck frames ${r.stale}`);
 else rec('If the video can\'t be woken, the gap is left empty and the summary says how much is covered',r.stale>50&&r.coverage<90&&/only/.test(r.info)?'passed':'failed',`stuck frames ${r.stale} · covers ${r.coverage}% · "${r.info}"`);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
