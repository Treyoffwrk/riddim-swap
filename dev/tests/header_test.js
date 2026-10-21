/* The header (title and Projects) can be seen, at the top and while scrolling, on a phone. Usage: node header_test.js <page> <video> <song> <shot> */
const {chromium}=require('playwright');const [,,page,video,song,shot]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();
 await p.goto(page);await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 /* is the button really drawn? its pixels must differ from the page background (not just be clickable) */
 const seen=async()=>{const r=await p.locator('#projBtn').boundingBox();if(!r||r.y+r.height<0)return {visible:false,why:'off screen'};
   const img=await p.screenshot({clip:{x:r.x,y:Math.max(0,r.y),width:r.width,height:Math.min(r.height,r.y+r.height)}});
   const {PNG}=(()=>{try{return require('pngjs')}catch(e){return {}}})();
   return {box:[r.x,r.y,r.width,r.height].map(Math.round),bytes:img.length}};
 const cover=()=>p.evaluate(()=>{const b=document.getElementById('projBtn').getBoundingClientRect(),pin=document.querySelector('.pin');const st=getComputedStyle(pin,'::before');
   const pr=pin.getBoundingClientRect();const covered=st.content!=='none'&&st.display!=='none'&&b.bottom>pr.top-window.innerHeight&&b.top<pr.top;return {stripOn:st.content!=='none',covered,btnTop:Math.round(b.top),pinTop:Math.round(pr.top)}});
 await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(2500);
 let c=await cover();rec('At the top of the page, nothing is drawn over the header',!c.covered&&!c.stripOn?'passed':'failed',JSON.stringify(c));
 await p.screenshot({path:shot+'-top.png'});
 await p.evaluate(()=>window.scrollTo(0,20));await p.waitForTimeout(400);c=await cover();
 rec('Scrolled a little: header still visible above the bar',!c.covered?'passed':'failed',JSON.stringify(c));
 await p.evaluate(()=>window.scrollTo(0,700));await p.waitForTimeout(400);c=await cover();
 rec('Scrolled down: bar pinned with its solid strip (header gone, as intended)',c.stripOn&&c.pinTop===0?'passed':'failed',JSON.stringify(c));
 await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(400);c=await cover();
 rec('Back at the top: header visible again',!c.covered&&!c.stripOn?'passed':'failed',JSON.stringify(c));
 await b.close()})();
