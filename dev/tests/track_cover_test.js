/* Tracking covers the whole clip (every frame, start to end). Usage: [GPU=1] [QUIET=1] node track_cover_test.js <host> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();if(!process.env.GPU)await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 /* QUIET=1: like iPhone, the hidden tracking video stops reporting frames after 100 (requestVideoFrameCallback goes silent) */
 if(process.env.QUIET)await ctx.addInitScript(()=>{const o=HTMLVideoElement.prototype.requestVideoFrameCallback;let k=0;HTMLVideoElement.prototype.requestVideoFrameCallback=function(cb){if(this.style.opacity==='0'&&++k>100)return 0;return o.call(this,cb)}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);const t0=Date.now();
 await p.click('#bodyTrack');for(let i=0;i<4000;i++){await p.waitForTimeout(500);if(i%60==0)console.log("progress",await p.evaluate(()=>document.getElementById("bodyInfo").textContent));if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const r=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body,v=R.v(),S=31;const ts=[];for(let k=0;k<B.n;k++)ts.push(B.data[k*(B.data.length/B.n)]);let gap=0;for(let k=1;k<ts.length;k++)gap=Math.max(gap,ts[k]-ts[k-1]);
   return {dur:v.duration,fps:B.fps,n:B.n,seen:B.seen,missed:B.missed,first:ts[0],last:ts[ts.length-1],gap,delegate:B.delegate,ms:B.msPerFrame,info:document.getElementById('bodyInfo').textContent}});
 rec('Tracking covers the clip from start to end',r.first<0.2&&r.last>r.dur-0.2&&r.gap<0.2&&r.n>=r.dur*r.fps*0.95?'passed':'failed',JSON.stringify(r)+' · '+((Date.now()-t0)/1000|0)+' s');
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
