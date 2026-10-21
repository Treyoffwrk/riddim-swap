/* Body tracking works offline after the first use. Usage: node offline_tracker.js <host index.html> <clip> */
const {launch}=require('./harness');const fs=require('fs');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({sw:true});await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const viaSW=[];ctx.on('request',r=>{if(/mediapipe|tasks-vision/.test(r.url())&&r.serviceWorker&&r.serviceWorker())viaSW.push(r.url())});
 await p.goto(HOST);await p.evaluate(async()=>{for(const k of await caches.keys())await caches.delete(k)});
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForTimeout(800);
 const ctl=await p.evaluate(()=>!!navigator.serviceWorker.controller);
 const clipUrl=async()=>p.evaluate(async b64=>URL.createObjectURL(new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'video/webm'})),fs.readFileSync(CLIP).toString('base64'));
 /* first use, online */
 const on=await p.evaluate(async url=>{try{const B=await RB.track(url,{end:1.5});return {n:B.n,seen:B.seen}}catch(e){return {err:e.message}}},await clipUrl());
 const cached=await p.evaluate(async()=>{const c=await caches.open('rs-runtime-1');return (await c.keys()).map(r=>r.url.split('/').slice(-1)[0])});
 rec('First use online saves the tracker',ctl&&on.seen>0&&cached.some(u=>/\.task$/.test(u))&&cached.some(u=>/\.wasm$/.test(u))?'passed':'failed',JSON.stringify({controlled:ctl,tracked:on,saved:cached}));
 /* offline: no network at all, test copies switched off too */
 await ctx.unrouteAll({behavior:'ignoreErrors'});await ctx.setOffline(true);
 await p.reload();await p.waitForTimeout(1200);
 const off=await p.evaluate(async url=>{try{const B=await RB.track(url,{end:1.5});return {n:B.n,seen:B.seen}}catch(e){return {err:String(e&&e.message||e)}}},await clipUrl());
 rec('Body tracking works with no connection',off.seen>0?'passed':'failed',JSON.stringify(off));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
