/* where tracking time goes, per frame. Usage: node prof_track.js <host> <clip> */
const {launch}=require('./harness');const fs=require('fs');const [,,HOST,CLIP]=process.argv;
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();await p.goto(HOST);
 const url=await p.evaluate(async b64=>URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'video/webm'})),fs.readFileSync(CLIP).toString('base64'));
 const r=await p.evaluate(async url=>{window.RB_PROF=[];await RB.load();const t0=performance.now();const B=await RB.track(url,{end:6});const T=performance.now()-t0;
   const P=window.RB_PROF,avg=k=>P.reduce((a,x)=>a+(x[k]||0),0)/P.length;return {frames:P.length,wall:T/P.length,seek:avg('seek'),draw:avg('draw'),detect:avg('det'),look:avg('look'),mask:avg('mask'),cb:avg('total')}},url);
 console.log(JSON.stringify(r,(k,v)=>typeof v==='number'?+v.toFixed(1):v));await b.close()})();
