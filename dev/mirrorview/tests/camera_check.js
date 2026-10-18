/* Camera: explicit start only, same stream through view/rotation/display changes, reference kept. Fake camera device. */
const {launch}=require('./harness');
const [,,URL_,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL_+'#debug');await p.setInputFiles('#file-input',CLIP);await p.waitForTimeout(2500);
 const cam=()=>p.evaluate(()=>{const v=document.getElementById('camera-source');const s=v&&v.srcObject;return {has:!!s,id:s&&s.id,live:s&&s.getVideoTracks().some(t=>t.readyState==='live')}});
 const c0=await cam();rec('No camera until asked',!c0.has?'passed':'failed',JSON.stringify(c0));
 await p.evaluate(()=>window.__mv.seek(7.25));
 await p.evaluate(()=>document.getElementById('camera-stage-button').click());await p.waitForTimeout(2500);
 const c1=await cam();rec('Camera starts on an explicit tap',c1.has&&c1.live?'passed':'failed',JSON.stringify(c1));
 const ref0=await p.evaluate(()=>{window.__ref=document.getElementById('reference-source');return window.__ref.src});
 for(const a of ['studio','practice','worldline','studio'])await p.evaluate(a=>{const b=document.querySelector(`[data-action="${a}"]`);b&&b.click()},a).then(()=>p.waitForTimeout(300));
 for(const d of ['skeleton','both','video'])await p.evaluate(d=>{window.__mv.state.refDisplay=d},d);
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(500);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(500);
 const c2=await cam();const ref=await p.evaluate(src=>{const v=document.getElementById('reference-source');return {same:v===window.__ref&&v.src===src,t:+v.currentTime.toFixed(2)}},ref0);
 rec('Same camera stream after view, display and rotation changes',c2.id===c1.id&&c2.live?'passed':'failed',JSON.stringify(c2));
 rec('Reference and playhead kept alongside the camera',ref.same&&Math.abs(ref.t-7.25)<0.15?'passed':'failed',JSON.stringify(ref));
 /* leaving through the Riddim Swap button stops the camera */
 const stopped=await p.evaluate(()=>{const s=document.getElementById('camera-source').srcObject;window.__tracks=s?s.getTracks():[];document.getElementById('rs-back').click();return new Promise(r=>setTimeout(()=>r(window.__tracks.map(t=>t.readyState)),300))}).catch(()=>['navigated']);
 rec('Leaving MirrorView releases the camera',stopped.every(x=>x==='ended'||x==='navigated')?'passed':'failed',JSON.stringify(stopped));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
