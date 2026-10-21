/* Updates arrive in a resumed app; Start fresh; Erase everything. Usage: node session_test.js <page> <video> <song> */
const {chromium}=require('playwright');
const [,,page,video,song]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let serverV=null;   /* when set, the server pretends a new version is out */
  await ctx.route(/\/sw\.js\?v=/,async r=>{const res=await r.fetch();let t=await res.text();if(serverV)t=t.replace(/VERSION='[^']+'/,`VERSION='${serverV}'`);r.fulfill({response:res,body:t})});
  const hide=v=>p.evaluate(v=>{Object.defineProperty(document,'hidden',{value:v,configurable:true});Object.defineProperty(document,'visibilityState',{value:v?'hidden':'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
  await p.evaluate(()=>window.__rs.S.vr=0.97);await p.evaluate(()=>{window.__marker=1});
  await p.click('#projBtn');await p.waitForTimeout(800);
  const ver=await p.textContent('#appVer');rec('Projects shows which version is running',/This version: \w+/.test(ver)?'passed':'failed',ver);
  await p.click('#sheetClose');
  /* a new version comes out while the app sits in the background; coming back with nothing playing reloads it */
  serverV='rs-newversion';await p.evaluate(()=>{window.__rs.UPD.checkedAt=0});
  await hide(true);await p.waitForTimeout(500);
  const nav=p.waitForEvent('framenavigated',{timeout:15000}).catch(()=>null);await hide(false);const navd=await nav;await p.waitForTimeout(3500);
  const after=await p.evaluate(()=>({marker:!!window.__marker,hasV:window.__rs.S.hasV,hasA:window.__rs.S.hasA}));
  rec('Coming back to a new version reloads it, project kept',navd&&!after.marker&&after.hasV&&after.hasA?'passed':'failed',JSON.stringify({reloaded:!!navd,...after}));
  /* the reloaded page now runs the new version; another update while playing: a bar, no reload */
  serverV='rs-newer-still';await p.evaluate(()=>{window.__marker=2;window.__rs.UPD.checkedAt=0;window.__rs.UPD.boot='rs-newversion'});
  await p.click('#play');await p.waitForTimeout(800);
  await p.evaluate(()=>window.__rs.checkUpdate(false));await p.waitForTimeout(1500);   /* the 10-minute check, while playing */
  const bar=await p.evaluate(()=>({bar:!!document.getElementById('updBar'),marker:window.__marker,playing:window.__rs.S.playing}));
  rec('While something plays it offers an Update now bar instead',bar.bar&&bar.marker===2&&bar.playing?'passed':'failed',JSON.stringify(bar));
  await p.evaluate(()=>{if(window.__rs.S.playing)document.getElementById('play').click()});
  const nav2=p.waitForEvent('framenavigated',{timeout:15000}).catch(()=>null);await p.click('#updBar .btn');const n2=await nav2;await p.waitForTimeout(3000);
  rec('Update now reloads with the project',!!n2&&await p.evaluate(()=>window.__rs.S.hasV&&!window.__marker)?'passed':'failed','');
  serverV=null;
  /* Start fresh: saved, then an empty project */
  await p.click('#projBtn');await p.waitForTimeout(500);
  const nav3=p.waitForEvent('framenavigated',{timeout:15000}).catch(()=>null);await p.click('#freshBtn');await nav3;await p.waitForTimeout(3000);
  const fresh=await p.evaluate(async()=>({hasV:window.__rs.S.hasV,state:document.getElementById('saveState').textContent,projects:await new Promise(r=>{const q=indexedDB.open('riddim-swap');q.onsuccess=()=>{const t=q.result.transaction('projects').objectStore('projects').count();t.onsuccess=()=>{r(t.result);q.result.close()}}})}));
  rec('Start fresh opens an empty project; the last one is kept in Projects',!fresh.hasV&&fresh.projects>=1&&/Fresh start/.test(fresh.state)?'passed':'failed',JSON.stringify(fresh));
  /* Erase everything: first tap arms, second erases */
  await p.click('#projBtn');await p.waitForTimeout(500);await p.click('#wipeBtn');await p.waitForTimeout(300);
  const armed=await p.textContent('#wipeBtn');
  const nav4=p.waitForEvent('framenavigated',{timeout:15000}).catch(()=>null);await p.click('#wipeBtn');await nav4;await p.waitForTimeout(3000);
  const wiped=await p.evaluate(async()=>({dbs:(await indexedDB.databases()).map(d=>d.name),ls:localStorage.length,hasV:window.__rs?window.__rs.S.hasV:null,caches:await caches.keys()}));
  rec('Erase everything needs a second tap, then wipes projects, media and saved app files',/Tap again/.test(armed)&&!wiped.dbs.includes('riddim-bridge')&&!wiped.hasV&&!wiped.caches.includes('rs-runtime-1')?'passed':'failed',JSON.stringify({armed,...wiped}));
  const projAfter=await p.evaluate(async()=>new Promise(r=>{const q=indexedDB.open('riddim-swap');q.onsuccess=()=>{const d=q.result;if(!d.objectStoreNames.contains('projects')){r(0);d.close();return}const t=d.transaction('projects').objectStore('projects').count();t.onsuccess=()=>{r(t.result);d.close()}};q.onerror=()=>r(-1)}));
  rec('…and no projects are left',projAfter===0?'passed':'failed','projects: '+projAfter);
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
