const {chromium}=require('playwright');const [,,page]=process.argv;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
 let serverV=null;await ctx.route(/\/sw\.js\?v=/,async r=>{const res=await r.fetch();let t=await res.text();if(serverV)t=t.replace(/VERSION='[^']+'/,`VERSION='${serverV}'`);r.fulfill({response:res,body:t})});
 const hide=v=>p.evaluate(v=>{Object.defineProperty(document,'hidden',{value:v,configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
 await p.goto(page);await p.waitForTimeout(25000);await p.evaluate(()=>{window.__marker=1});serverV='rs-new';
 await hide(true);const nav=p.waitForEvent('framenavigated',{timeout:10000}).catch(()=>null);await hide(false);const n=await nav;await p.waitForTimeout(1000);
 const m=await p.evaluate(()=>!!window.__marker);console.log((n&&!m?'PASSED':'FAILED').padEnd(8),'MirrorView reloads on return when a new version is out —',JSON.stringify({reloaded:!!n}));await b.close()})();
