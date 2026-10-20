const {chromium}=require('playwright');const [,,page,video,song,out]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
 await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
 await p.click('#danceAnalyze');for(let i=0;i<240;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const R=window.__rs;const n=R.srcById(R.S.cur);return !!(n&&n.motion)}))break}
 await p.evaluate(()=>{window.__rs.v().currentTime=6.8});await p.waitForTimeout(400);await p.click('[data-spd="slowmo"]');
 await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur));c.pts.push({t:12,y:0.8,auto:true});c.pts.sort((a,b)=>a.t-b.t);R.SPD.sel=c.pts.findIndex(q=>q.t===12)});

 await p.waitForTimeout(100);await p.evaluate(()=>{window.__rs.v().currentTime=6.4});await p.waitForTimeout(600);
 await p.locator('#spdCard').screenshot({path:out});await b.close()})();
