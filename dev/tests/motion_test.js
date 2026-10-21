/* Full screen, swipe between modes, video bar flush to the top. Usage: node motion_test.js <page> <video> <song> <shot prefix> */
const {chromium}=require('playwright');
const [,,page,video,song,shot]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const cdp=await ctx.newCDPSession(p);
  const swipe=async(x0,y0,x1,y1,ms=220)=>{const N=10;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});
    for(let i=1;i<=N;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/N,y:y0+(y1-y0)*i/N}]});await p.waitForTimeout(ms/N)}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(500)};
  const tab=()=>p.evaluate(()=>document.querySelector('[role=tab][aria-selected=true]').id);
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
  await p.click('#t-clip');await p.waitForTimeout(400);
  /* swipe */
  const pr=await p.evaluate(()=>{const h=[...document.querySelectorAll('#p-clip .hint')].find(e=>e.offsetParent);h.scrollIntoView({block:'center'});const r=h.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
  await p.waitForTimeout(300);
  await swipe(330,pr.y,60,pr.y+6);const t1=await tab();
  rec('Swipe left goes to the next mode',t1==='t-song'?'passed':'failed','Clip → '+t1);
  const safeY=async()=>{const y=await p.evaluate(()=>{const pn=document.querySelector('.panel:not([hidden])');const h=[...pn.querySelectorAll('p.hint')].find(e=>e.offsetParent&&!e.closest('input,.seg,.chips,.tray,.nudges,.tl'));h.scrollIntoView({block:'center'});const r=h.getBoundingClientRect();return r.y+r.height/2});await p.waitForTimeout(300);return y};
  await swipe(330,await safeY(),60,await safeY());await swipe(330,await safeY(),60,await safeY());
  rec('Two more swipes',await tab()==='t-moves'?'passed':'failed','→ '+await tab());
  let y=await safeY();await swipe(60,y,330,y);
  rec('Swipe right goes back',await tab()==='t-tempo'?'passed':'failed','→ '+await tab());
  y=await safeY();await swipe(200,y,170,y);
  rec('A short drag springs back and stays',await tab()==='t-tempo'?'passed':'failed','→ '+await tab()+', panel transform "'+await p.evaluate(()=>document.getElementById('p-tempo').style.transform)+'"');
  await p.click('#t-clip');await p.waitForTimeout(400);
  const rr=await p.evaluate(()=>{const r=document.getElementById('vRate');r.scrollIntoView({block:'center'});const b=r.getBoundingClientRect();return {x:b.x,w:b.width,y:b.y+b.height/2,v:r.value}});await p.waitForTimeout(300);
  await swipe(rr.x+rr.w*0.8,rr.y,rr.x+rr.w*0.2,rr.y);
  rec('Dragging a slider does not change mode',await tab()==='t-clip'?'passed':'failed','still '+await tab());
  await swipe(200,700,190,300);
  rec('Scrolling up and down does not change mode',await tab()==='t-clip'?'passed':'failed','still '+await tab());
  /* the routine tab is the last one: a swipe past it rubber-bands */
  await p.click('#t-routine');await p.waitForTimeout(400);const ry=await p.evaluate(()=>{const h=document.querySelector('#p-routine .subhead');h.scrollIntoView({block:'center'});return h.getBoundingClientRect().y+10});await p.waitForTimeout(300);
  await swipe(330,ry,40,ry);
  rec('Past the last mode nothing breaks',await tab()==='t-routine'?'passed':'failed','still '+await tab());
  /* video bar flush to the top while scrolling */
  await p.click('#t-routine');await p.evaluate(()=>window.scrollTo(0,600));await p.waitForTimeout(500);
  const top=await p.evaluate(()=>{const pin=document.querySelector('.pin'),r=pin.getBoundingClientRect();const hits=[2,20,40].map(y=>{const e=document.elementFromPoint(195,y);return e?(pin.contains(e)?'bar':(e.id||e.className||e.tagName)):'none'});return {top:Math.round(r.top),hits,stuck:pin.classList.contains('stuck')}});
  rec('Video bar sits flush at the top, nothing shows above it',top.top===0&&top.hits.every(h=>h==='bar')&&top.stuck?'passed':'failed',JSON.stringify(top));
  await p.screenshot({path:shot+'-scrolled.png'});
  await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(300);
  /* full screen */
  rec('Full screen button on the video',await p.isVisible('#fsBtn')?'passed':'failed','');
  await p.click('#fsBtn');await p.waitForTimeout(600);
  const fs=await p.evaluate(()=>{const pin=document.querySelector('.pin'),s=document.getElementById('stage').getBoundingClientRect(),r=pin.getBoundingClientRect();return {fs:pin.classList.contains('fs'),pin:[r.x,r.y,r.width,r.height].map(Math.round),stage:[s.width,s.height].map(Math.round),play:!!document.getElementById('play').offsetParent,scrub:!!document.getElementById('scrub').offsetParent,tabsHidden:document.elementFromPoint(195,830)&&pin.contains(document.elementFromPoint(195,830))}});
  rec('Full screen fills the screen with the video, play and scrub',fs.fs&&fs.pin[2]===390&&fs.pin[3]===844&&fs.stage[1]>780&&fs.play&&fs.scrub&&fs.tabsHidden?'passed':'failed',JSON.stringify(fs));
  await p.screenshot({path:shot+'-fs.png'});
  await p.tap('#stage',{position:{x:195,y:300}});await p.waitForTimeout(400);
  rec('Tap the video to play in full screen',await p.evaluate(()=>window.__rs.S.playing)?'passed':'failed','');
  await p.waitForTimeout(3300);
  rec('Controls fade away while playing',await p.evaluate(()=>document.querySelector('.pin').classList.contains('idle'))?'passed':'failed','');
  await p.screenshot({path:shot+'-fs-idle.png'});
  await p.tap('#stage',{position:{x:195,y:300}});await p.waitForTimeout(300);
  const back=await p.evaluate(()=>({idle:document.querySelector('.pin').classList.contains('idle'),playing:window.__rs.S.playing}));
  rec('A tap brings the controls back (and keeps playing)',!back.idle&&back.playing?'passed':'failed',JSON.stringify(back));
  await p.click('#play');await p.waitForTimeout(200);
  await p.click('#fsBtn');await p.waitForTimeout(400);
  const out=await p.evaluate(()=>({fs:document.querySelector('.pin').classList.contains('fs'),h:Math.round(document.getElementById('stage').getBoundingClientRect().height),body:document.body.classList.contains('rs-fs')}));
  rec('Exit full screen returns to the editor',!out.fs&&!out.body&&out.h<400?'passed':'failed',JSON.stringify(out));
  await p.click('#fsBtn');await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(300);
  rec('Escape also exits',await p.evaluate(()=>!document.querySelector('.pin').classList.contains('fs'))?'passed':'failed','');
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
