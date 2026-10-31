/* The RTMPose model: smaller download, shown with progress, can be fetched ahead of time and is then kept on the phone.
   Usage: node rtm_dl_test.js <host index.html> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({sw:true});await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(async()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear();for(const k of await caches.keys())await caches.delete(k)});
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForTimeout(1200);
 await p.evaluate(()=>{delete window.RB_MODEL});
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const size=await p.evaluate(async()=>{const r=await fetch(RB.CFG.rtmURL,{cache:'no-store'});const b=await r.arrayBuffer();return {bytes:b.byteLength,cfg:RB.CFG.rtmBytes,mb:RB.CFG.rtmMB}});
 rec('The model download is about a third smaller than the old 65 MB (44 MB), and the app knows its size',size.bytes<45e6&&size.bytes===size.cfg&&size.mb===Math.round(size.bytes/1048576)?'passed':'failed',JSON.stringify(size));
 /* the fetch above went through the service worker, so start clean again for the download */
 await p.evaluate(async()=>{const c=await caches.open('rs-runtime-1');for(const k of await c.keys())if(/\.onnx$/.test(k.url))await c.delete(k)});await p.reload();await p.waitForTimeout(1500);
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const before=await p.evaluate(()=>({row:!document.getElementById('rtmGetRow').hidden,note:document.getElementById('trackQNote').textContent}));
 rec('Before downloading: "Download it now" and the size are shown',before.row&&/about \d+ MB to download/.test(before.note)?'passed':'failed',JSON.stringify(before));
 await p.click('#rtmGet');const seen=[];
 for(let i=0;i<240;i++){await p.waitForTimeout(250);const m=await p.evaluate(()=>({msg:document.getElementById('rtmGetMsg').textContent,st:RB.rtmStatus()}));seen.push(m);if(m.st.state==='ready'||m.st.state==='error')break}
 await p.waitForTimeout(600);seen.push(await p.evaluate(()=>({msg:document.getElementById('rtmGetMsg').textContent,st:RB.rtmStatus()})));
 const prog=seen.filter(x=>/Downloading the RTMPose model… [\d.]+ of \d+ MB \(\d+%\)/.test(x.msg)).length, last=seen[seen.length-1];
 rec('Download it now shows progress (MB and %) and finishes',(prog>=1||seen.length<=2)&&last.st.state==='ready'&&last.st.got===size.bytes&&/ready on this phone/.test(last.msg)?'passed':'failed',`${prog} progress readings · ${JSON.stringify(last)}`);
 await p.waitForTimeout(500);
 const after=await p.evaluate(async()=>({cached:await RB.rtmCached(),note:document.getElementById('trackQNote').textContent}));
 rec('Then it is kept on the phone and the note says so',after.cached&&/ready on this phone/.test(after.note)?'passed':'failed',JSON.stringify(after));
 /* a fresh visit: still on the phone; tracking uses it without downloading again */
 await p.reload();await p.waitForTimeout(1500);await p.evaluate(()=>{delete window.RB_MODEL});await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const net=[];p.on('request',r=>{if(/\.onnx/.test(r.url()))net.push(r.url())});
 const fresh=await p.evaluate(()=>({row:document.getElementById('rtmGetRow').hidden,note:document.getElementById('trackQNote').textContent}));
 const infos=[];await p.click('#bodyTrack');for(let i=0;i<6000;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({busy:window.__rs.S.bodyBusy,err:window.__rs.S.bodyErr||'',info:document.getElementById('bodyInfo').textContent}));infos.push(st.info);if(st.err||!st.busy)break}
 const B=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;return B&&{model:B.model,errors:B.rtmErrors,ext:!!B.ext}});
 const fromNet=await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.onnx/.test(e.name)).map(e=>({n:e.name.split('/').pop(),size:e.transferSize,sw:e.workerStart>0})));
 rec('Next visit: it is still ready, and tracking with RTMPose works without downloading again',fresh.row&&/ready on this phone/.test(fresh.note)&&B&&/rtmpose/.test(B.model)&&B.errors===0&&B.ext&&!infos.some(t=>/Downloading/.test(t))?'passed':'failed',JSON.stringify({fresh,B,fromNet}));
 /* on Wi-Fi it fetches by itself once a video is added; on mobile data it waits for you */
 const auto={};for(const type of ['wifi','cellular']){const L=await launch();const c2=L.ctx;await c2.addInitScript(t=>{Object.defineProperty(navigator,'connection',{get:()=>({type:t,saveData:false})});window.RB_DELEGATE='CPU'},type);
   const q=await c2.newPage();q.on('pageerror',e=>errs.push(type+': '+e.message));await q.goto(HOST+'#debug');await q.evaluate(()=>{localStorage.clear()});await q.reload();await q.waitForTimeout(800);
   await q.setInputFiles('#vidFile',CLIP);await q.waitForTimeout(4000);auto[type]=await q.evaluate(()=>RB.rtmStatus().state);await L.b.close()}
 rec('On Wi-Fi the model downloads by itself after you add a video; on mobile data it does not',auto.wifi!=='idle'&&auto.cellular==='idle'?'passed':'failed',JSON.stringify(auto));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
