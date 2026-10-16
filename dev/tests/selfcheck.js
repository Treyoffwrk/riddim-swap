/* Plant a wrong encoder correction (+50 ms), record, and check the self-check finds it and repairs it. */
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage({viewport:{width:390,height:844}});
await p.goto('http://127.0.0.1:8765/index.html#debug'); await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()}); await p.reload();
await p.setInputFiles('#vidFile',process.argv[2]); await p.setInputFiles('#audFile',process.argv[3]); await p.waitForTimeout(2500);
const key=await p.evaluate(()=>{for(let i=0;i<20;i++){} return 'rs-enccomp-opus'});
await p.evaluate(k=>localStorage.setItem(k,'0.05'),key);
const rec=async()=>{await p.evaluate(()=>window.__rs.lastVerify=null);await p.click('#recBtn');for(let i=0;i<200&&await p.isHidden('#take');i++)await p.waitForTimeout(200);
  for(let i=0;i<40&&!(await p.evaluate(()=>window.__rs.lastVerify));i++)await p.waitForTimeout(200);
  const r={verify:await p.evaluate(()=>window.__rs.lastVerify),stored:await p.evaluate(k=>localStorage.getItem(k),key),info:await p.textContent('#takeInfo')};await p.click('#discardBtn');return r};
console.log('take 1 (planted +50 ms):',JSON.stringify(await rec()));
console.log('take 2 (after repair):  ',JSON.stringify(await rec()));
await b.close()})();
