const {launch}=require('./harness');const fs=require('fs');const [,,HOST,CLIP,OUT]=process.argv;
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();await p.goto(HOST);
 const url=await p.evaluate(async b64=>URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'video/webm'})),fs.readFileSync(CLIP).toString('base64'));
 const r=await p.evaluate(async url=>{window.RB_DEBUG_ALL=[];const B=await RB.track(url,{});return {W:B.w,H:B.h,fps:B.fps,frames:window.RB_DEBUG_ALL}},url);fs.writeFileSync(OUT,JSON.stringify(r));console.log('rows',r.length);await b.close()})();
