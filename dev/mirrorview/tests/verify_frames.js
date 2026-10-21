/* Same poses as before the speed-up? Track the clip and compare each frame's hips with the earlier lab run at the same time. */
const {launch}=require('./harness');const fs=require('fs');const [,,HOST,CLIP,LAB]=process.argv;
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();await p.goto(HOST);
 const url=await p.evaluate(async b64=>URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'video/webm'})),fs.readFileSync(CLIP).toString('base64'));
 const r=await p.evaluate(async url=>{window.RB_DEBUG_ALL=[];const t0=performance.now();const B=await RB.track(url,{});const out=[];for(let i=0;i<B.n;i++){const o=i*RB.STRIDE;out.push([B.data[o],B.data[o+1+23*3],B.data[o+2+23*3]])}
   return {n:B.n,fps:B.fps,secs:(performance.now()-t0)/1000,raw:window.RB_DEBUG_ALL.map(f=>({k:f.k,x:f.cands[0]?f.cands[0].pts[23][0]:null})),out}},url);
 const L=JSON.parse(fs.readFileSync(LAB));
 /* raw (before cleaning) frame k vs the lab's frame k */
 let d=[],miss=0;for(const f of r.raw){const lf=L.frames[f.k];if(!lf||!lf.poses.length||f.x==null){miss++;continue}d.push(Math.abs(f.x-lf.poses[0].k[23][0]))}d.sort((a,b)=>a-b);
 console.log(JSON.stringify({frames:r.n,fps:r.fps,seconds:+r.secs.toFixed(1),compared:d.length,median_diff:+d[d.length>>1].toFixed(5),p99_diff:+d[Math.floor(d.length*.99)].toFixed(5),max_diff:+d[d.length-1].toFixed(4)}));await b.close()})();
