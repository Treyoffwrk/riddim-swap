/* Screenshots of the hips on a real clip: phone stage, full screen, Hip moves graph, MirrorView. */
const {launch}=require('./harness');const [,,HOST,CLIP,SONG,SHOT,T]=process.argv;
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const t=T?+T:await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;let best=0,bt=0;for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE],h=RB.hipsAt(B,t);if(h&&h.tilt!=null&&Math.abs(h.tilt)>Math.abs(best)){best=h.tilt;bt=t}}return bt});
 await p.evaluate(t=>{window.__rs.v().currentTime=t},t);await p.waitForTimeout(800);
 await p.locator('.pin').screenshot({path:SHOT+'-stage.png'});
 await p.click('#fsBtn');await p.waitForTimeout(800);await p.screenshot({path:SHOT+'-fs.png'});await p.click('#fsBtn');await p.waitForTimeout(400);
 await p.click('#t-clip');await p.locator('#hipCard').scrollIntoViewIfNeeded();await p.waitForTimeout(500);await p.locator('#hipCard').screenshot({path:SHOT+'-graph.png'});
 await p.click('#t-body');await p.waitForURL(/mirrorview\//);for(let i=0;i<80;i++){const h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.evaluate(()=>{const d=document.getElementById('modal');if(d&&d.open)d.close()});await p.evaluate(t=>window.__mv.seek(t),t);await p.waitForTimeout(900);await p.screenshot({path:SHOT+'-mv.png'});
 await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^\s*Overlay\s*$/.test(x.textContent));b&&b.click()});await p.waitForTimeout(900);await p.screenshot({path:SHOT+'-mv-overlay.png'});
 console.log('t',t);await b.close()})();
