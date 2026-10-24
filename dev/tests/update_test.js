/* Updates reach an installed app. An "old" version is served and opened (offline support on), then a new version is
   published underneath it and the app comes back to the front. Usage: node update_test.js <new build dir> <scratch dir> */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs');const path=require('path');const {execSync,spawn}=require('child_process');
const [,,NEW,SCR]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const SRV=path.join(SCR,'upd-srv'),OLD='rs-old0000001';
const newVer=fs.readFileSync(path.join(NEW,'sw.js'),'utf8').match(/VERSION='([^']+)'/)[1];
const put=(which,{indexFrom}={})=>{execSync(`rm -rf ${SRV} && cp -r ${NEW} ${SRV}`);
  if(which==='old'){for(const f of ['sw.js','index.html','mirrorview/index.html']){const p=path.join(SRV,f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').split(newVer).join(OLD))}}
  if(indexFrom==='old'){const p=path.join(SRV,'index.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').split(newVer).join(OLD))}};
(async()=>{
  put('old');
  const srv=spawn('python3',['-m','http.server','8790'],{cwd:SCR,stdio:'ignore'});await new Promise(r=>setTimeout(r,800));
  const URL0='http://localhost:8790/upd-srv/index.html';
  const {b,ctx}=await launch({sw:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL0);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();await p.waitForTimeout(1500);
  const v0=await p.evaluate(()=>({build:window.RS_BUILD,shown:document.getElementById('appVer').textContent,ctl:!!navigator.serviceWorker.controller}));
  rec('The old version is running, offline support on',v0.build===OLD&&v0.ctl?'passed':'failed',JSON.stringify(v0));
  /* publish the new version underneath it, then come back to the app */
  put('new');
  const back=async()=>{await p.evaluate(()=>{for(const v of [true,false]){Object.defineProperty(document,'hidden',{value:v,configurable:true});Object.defineProperty(document,'visibilityState',{value:v?'hidden':'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))}}).catch(()=>{})};
  await p.waitForTimeout(21000);   /* away from the app for a while (checks are spaced at least 20 s apart) */
  await back();
  let v1=null;for(let i=0;i<40;i++){await p.waitForTimeout(500);v1=await p.evaluate(()=>window.RS_BUILD).catch(()=>null);if(v1===newVer)break}
  rec('Coming back to the app loads the new version by itself (nothing playing)',v1===newVer?'passed':'failed',`running ${v1}, published ${newVer}`);
  /* a page opened fresh while the phone still has the old copy saved also gets the new one */
  const {b:b2,ctx:c2}=await launch({sw:true});const q=await c2.newPage();
  put('old');await q.goto(URL0);await q.evaluate(()=>navigator.serviceWorker.ready);await q.reload();await q.waitForTimeout(1000);
  put('new');await q.goto(URL0);await q.waitForTimeout(3000);
  const v2=await q.evaluate(()=>window.RS_BUILD);
  rec('Opening the app fresh gets the new version even with the old one saved',v2===newVer?'passed':'failed',`running ${v2}`);
  await b2.close();
  /* the server says "new" but keeps handing back the old page: reload once, then the Update bar, no loop */
  const {b:b3,ctx:c3}=await launch({sw:true});const r3=await c3.newPage();let loads=0;r3.on('load',()=>loads++);
  put('new',{indexFrom:'old'});await r3.goto(URL0);await r3.waitForTimeout(6000);
  const v3=await r3.evaluate(()=>({build:window.RS_BUILD,bar:!!document.querySelector('#updBar:not([hidden]), .updbar:not([hidden])')}));
  rec('If the old page keeps coming back: one reload, then the Update bar (no endless reloading)',loads<=2&&v3.build===OLD&&v3.bar?'passed':'failed',`${loads} page loads · ${JSON.stringify(v3)}`);
  await b3.close();
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();srv.kill();
})();
