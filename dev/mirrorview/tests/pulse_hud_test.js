/* Body: the Pulse box can be moved and shrunk, so it never has to cover the dancer. Usage: node pulse_hud_test.js <host index.html> <clip> <shot> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({viewport:{width:402,height:874}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});await p.waitForTimeout(3000);
 for(const mode of ['worldline','split']){
   await p.click(`[data-mode="${mode}"]`);await p.waitForTimeout(500);
   /* show the box as Pulse does when it's set up */
   await p.evaluate(()=>{const h=document.getElementById('pulse-hud');if(!h.__held){h.__held=true;h.removeAttribute('hidden');Object.defineProperty(h,'hidden',{configurable:true,get:()=>false,set(){}})}window.__mvPulseHud.place()});await p.waitForTimeout(200);
   const box=()=>p.evaluate(()=>{const h=document.getElementById('pulse-hud'),r=h.getBoundingClientRect(),pr=h.offsetParent.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.left-pr.left),y:Math.round(r.top-pr.top),pw:Math.round(pr.width),ph:Math.round(pr.height),mini:h.classList.contains('rs-mini')}});
   const b0=await box();
   rec(`${mode}: the Pulse box starts small (just the count)`,b0.mini&&b0.w<110&&b0.h<70?'passed':'failed',JSON.stringify(b0));
   const r0=await p.locator('#pulse-hud').boundingBox();
   await p.mouse.click(r0.x+r0.width/2,r0.y+r0.height/2);await p.waitForTimeout(250);const b1=await box();
   await p.screenshot({path:`${SHOT}-${mode}-full.png`});
   const r1=await p.locator('#pulse-hud').boundingBox();await p.mouse.click(r1.x+r1.width/2,r1.y+r1.height/2);await p.waitForTimeout(250);const b2=await box();
   rec(`${mode}: tapping it opens the full box, tapping again shrinks it`,!b1.mini&&b1.w>180&&b2.mini?'passed':'failed',JSON.stringify({open:b1,back:b2}));
   /* drag it to the top right; touches on it don't reach the view underneath (no orbit) */
   await p.evaluate(()=>{window.__under=0;const par=document.getElementById('pulse-hud').offsetParent;par.addEventListener('pointerdown',e=>{if(e.target.closest&&!e.target.closest('#pulse-hud'))return;window.__under++},false);document.getElementById('stage-canvas')?.addEventListener('pointerdown',()=>window.__under++)});
   const r2=await p.locator('#pulse-hud').boundingBox();
   await p.mouse.move(r2.x+r2.width/2,r2.y+r2.height/2);await p.mouse.down();const toward=(await box()).x>150?-1:1;for(let k=1;k<=10;k++){await p.mouse.move(r2.x+r2.width/2+toward*k*25,r2.y+r2.height/2+(toward>0?-1:1)*k*20);await p.waitForTimeout(16)}await p.mouse.up();await p.waitForTimeout(250);
   const b3=await box(),under=await p.evaluate(()=>window.__under);
   rec(`${mode}: dragging moves it, it stays inside the video, and the view underneath doesn't move`,(Math.abs(b3.x-b0.x)>60||Math.abs(b3.y-b0.y)>60)&&b3.x>=0&&b3.y>=0&&b3.x+b3.w<=b3.pw&&b3.y+b3.h<=b3.ph&&b3.mini&&under===0?'passed':'failed',JSON.stringify({before:b0,after:b3,touchesUnder:under}));
   /* far past the edge: kept inside */
   const r3=await p.locator('#pulse-hud').boundingBox();await p.mouse.move(r3.x+5,r3.y+5);await p.mouse.down();await p.mouse.move(r3.x+900,r3.y-900,{steps:6});await p.mouse.up();await p.waitForTimeout(200);const b4=await box();
   rec(`${mode}: dragged past the edge it stays fully on the video`,b4.x>=0&&b4.y>=0&&b4.x+b4.w<=b4.pw&&b4.y+b4.h<=b4.ph?'passed':'failed',JSON.stringify(b4));
 }
 const kept=await p.evaluate(()=>window.__mvPulseHud.st);await p.reload();await p.waitForTimeout(3000);
 await p.evaluate(()=>{const h=document.getElementById('pulse-hud');h.removeAttribute('hidden');Object.defineProperty(h,'hidden',{configurable:true,get:()=>false,set(){}});window.__mvPulseHud.place()});await p.waitForTimeout(200);
 const after=await p.evaluate(()=>({st:window.__mvPulseHud.st,placed:document.getElementById('pulse-hud').classList.contains('rs-placed')}));
 rec('Where you put it is remembered after a reload',after.placed&&Math.abs(after.st.x-kept.x)<0.02&&after.st.x>=0&&after.st.x<=1&&after.st.mini===kept.mini?'passed':'failed',JSON.stringify({kept,after}));
 await p.screenshot({path:SHOT+'-moved.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
