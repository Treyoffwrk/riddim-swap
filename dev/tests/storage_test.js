/* Storage in Projects. Usage: node storage_test.js <host index.html> <clip A> <clip B> <song> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,A,B2,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',A);await p.setInputFiles('#vidFile',B2);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 const sizes=await p.evaluate(()=>({a:window.__rs.S.sources[0].file&&window.__rs.S.sources[0].file.size}));
 await p.click('#projBtn');await p.waitForTimeout(1500);
 const read=()=>p.evaluate(()=>({list:document.getElementById('storeList').innerText,btn:document.getElementById('storeClean').textContent,dis:document.getElementById('storeClean').disabled}));
 const s1=await read();
 rec('Lists videos and songs, tracking, projects and total',/Videos and songs/.test(s1.list)&&/Projects \(/.test(s1.list)&&/In use/.test(s1.list)?'passed':'failed',JSON.stringify(s1));
 rec('Nothing unused while everything belongs to the project',s1.dis&&/Nothing unused/.test(s1.btn)?'passed':'failed',s1.btn);
 /* put a stray video in storage that no project points at (as left behind by an old deleted project) */
 await p.evaluate(async()=>{const blob=new Blob([new Uint8Array(3*1048576)],{type:'video/webm'});await new Promise((res,rej)=>{const r=indexedDB.open('riddim-swap');r.onsuccess=()=>{const t=r.result.transaction('media','readwrite');t.objectStore('media').put(blob,'stray-1');t.objectStore('media').put({data:new Float32Array(1000),n:10},'body:stray-1');t.oncomplete=()=>{r.result.close();res()}}})});
 await p.click('#sheetClose');await p.click('#projBtn');await p.waitForTimeout(1500);
 const s2=await read();
 rec('The stray video and its tracking show as unused (about 3 MB, 2 items)',/Unused \(2 items\)/.test(s2.list)&&/Clear unused \(3\.0 MB\)/.test(s2.btn)&&!s2.dis?'passed':'failed',JSON.stringify(s2));
 await p.locator('#storeBox').screenshot({path:SHOT+'-storage.png'});
 const keysBefore=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('riddim-swap');r.onsuccess=()=>{const q=r.result.transaction('media').objectStore('media').getAllKeys();q.onsuccess=()=>res(q.result.map(String))}}));
 await p.click('#storeClean');await p.waitForTimeout(1500);
 const keysAfter=await p.evaluate(()=>new Promise(res=>{const r=indexedDB.open('riddim-swap');r.onsuccess=()=>{const q=r.result.transaction('media').objectStore('media').getAllKeys();q.onsuccess=()=>res(q.result.map(String))}}));
 const s3=await read();const msg=await p.textContent('#projMsg');
 rec('Clear unused removes only the stray items',keysAfter.length===keysBefore.length-2&&!keysAfter.some(k=>k.includes('stray'))?'passed':'failed',JSON.stringify({before:keysBefore.length,after:keysAfter}));
 rec('It says what it cleared, and the button goes back to nothing unused',/Cleared 2 unused items/.test(msg)&&s3.dis?'passed':'failed',msg+' · '+s3.btn);
 /* the project still plays: both videos still load after a restart */
 await p.click('#sheetClose');await p.reload();await p.waitForTimeout(3500);
 const after=await p.evaluate(()=>({n:window.__rs.S.sources.length,ok:window.__rs.S.sources.every(n=>!!n.url||!!n.file),song:!!window.__rs.S.mainSong}));
 rec('After a restart the project still has both videos and its song',after.n===2&&after.ok&&after.song?'passed':'failed',JSON.stringify(after));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
