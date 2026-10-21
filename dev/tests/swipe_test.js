/* Swiping between modes from anywhere on the settings, on a phone-sized touch screen. Usage: node swipe_test.js <page> <video> <song> <shot prefix> */
const {chromium}=require('playwright');
const [,,page,video,song,shot]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const cdp=await ctx.newCDPSession(p);
  const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
  const swipe=async(x0,y0,x1,y1,ms=220,mid,N=12)=>{await touch('touchStart',[{x:x0,y:y0}]);
    for(let i=1;i<=N;i++){await touch('touchMove',[{x:x0+(x1-x0)*i/N,y:y0+(y1-y0)*i/N}]);await p.waitForTimeout(ms/N);if(mid&&i===Math.round(N/2))await mid()}
    await touch('touchEnd',[]);await p.waitForTimeout(550)};
  const tab=()=>p.evaluate(()=>document.querySelector('[role=tab][aria-selected=true]').id);
  const go=async id=>{await p.click('#'+id);await p.waitForTimeout(450)};
  const at=async sel=>{const r=await p.evaluate(sel=>{const e=document.querySelector(sel);e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}},sel);await p.waitForTimeout(250);return r};
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  for(let i=0;i<6;i++){await p.setInputFiles('#vidFile',video);await p.waitForTimeout(500)}
  await p.setInputFiles('#audFile',song);await p.waitForTimeout(2500);
  /* 1. on the Beat lights switch (your first screenshot) */
  await go('t-tempo');let r=await at('#bvSeg');
  await swipe(r.x+r.w*0.8,r.y+r.h/2,r.x+r.w*0.8-260,r.y+r.h/2);
  rec('Swipe on the Beat lights switch moves to the next mode',await tab()==='t-moves'?'passed':'failed','Tempo → '+await tab());
  const bv=await p.evaluate(()=>[...document.querySelectorAll('#bvSeg button')].find(x=>x.getAttribute('aria-pressed')==='true').dataset.bv);
  rec('…and doesn’t press the button it started on',bv==='calm'?'passed':'failed','beat lights still '+bv);
  /* 2. on the empty space beside the video chips (your second screenshot), and on a chip itself */
  r=await at('#p-moves .srcChips');
  await swipe(r.x+r.w-20,r.y+r.h/2,r.x+r.w-280,r.y+r.h/2);
  rec('Swipe on the empty space beside the video list',await tab()==='t-routine'?'passed':'failed','Moves → '+await tab());
  await go('t-moves');r=await at('#p-moves .srcChips .chip-src');const cur0=await p.evaluate(()=>window.__rs.S.cur);
  await swipe(r.x+r.w*0.4,r.y+r.h/2,r.x+r.w*0.4+250,r.y+r.h/2);
  const cur1=await p.evaluate(()=>window.__rs.S.cur);
  rec('Swipe right starting on a video chip goes back, without selecting that chip',await tab()==='t-tempo'&&cur0===cur1?'passed':'failed',`Moves → ${await tab()}, current video ${cur0} → ${cur1}`);
  /* 3. on a nudge button and a normal button */
  await go('t-clip');r=await at('[data-v="0.01"]');const vr0=await p.evaluate(()=>window.__rs.S.vr);
  await swipe(r.x+r.w/2+100,r.y+r.h/2,r.x+r.w/2-160,r.y+r.h/2);
  rec('Swipe starting on the speed nudges',await tab()==='t-song'&&await p.evaluate(()=>window.__rs.S.vr)===vr0?'passed':'failed','Clip → '+await tab()+', clip speed unchanged');
  /* 4. the next page is visible beside the current one mid-swipe */
  await go('t-clip');r=await at('#p-clip .hint');let mid=null;
  await swipe(340,r.y+r.h/2,120,r.y+r.h/2,400,async()=>{mid=await p.evaluate(()=>{const a=document.getElementById('p-clip').getBoundingClientRect(),s=document.getElementById('p-song');const bb=s.getBoundingClientRect();return {clipX:Math.round(a.x),songShown:!s.hidden,songX:Math.round(bb.x)}})});
  rec('The next page slides in beside the current one while dragging',mid&&mid.songShown&&mid.clipX<0&&mid.songX>0&&mid.songX<390?'passed':'failed',JSON.stringify(mid)+' → '+await tab());
  /* 5. a slow, short drag springs back; a quick flick of the same length changes page */
  await go('t-clip');r=await at('#p-clip .hint');
  await swipe(250,r.y+r.h/2,180,r.y+r.h/2,600);
  const after=await p.evaluate(()=>({t:document.querySelector('[role=tab][aria-selected=true]').id,tf:document.getElementById('p-clip').style.transform,songHidden:document.getElementById('p-song').hidden}));
  rec('A slow short drag springs back cleanly',after.t==='t-clip'&&!after.tf&&after.songHidden?'passed':'failed',JSON.stringify(after));
  await swipe(250,r.y+r.h/2,170,r.y+r.h/2,0,null,4);
  rec('A quick flick of about the same length changes page',await tab()==='t-song'?'passed':'failed','→ '+await tab());
  /* 6. things that need a sideways drag keep it */
  await go('t-clip');r=await at('#vRate');
  await swipe(r.x+r.w*0.8,r.y+r.h/2,r.x+r.w*0.2,r.y+r.h/2);
  rec('A slider keeps its drag',await tab()==='t-clip'?'passed':'failed','still '+await tab());
  await p.evaluate(()=>{const c=window.__rs.srcById(window.__rs.S.cur);document.getElementById('spdOn').click()});await p.waitForTimeout(300);
  r=await at('#spdCanvas');
  await swipe(r.x+r.w*0.8,r.y+r.h*0.6,r.x+r.w*0.3,r.y+r.h*0.6);
  rec('The speed graph keeps its drag',await tab()==='t-clip'?'passed':'failed','still '+await tab());
  await swipe(200,600,195,250);
  rec('Scrolling up and down doesn’t change mode',await tab()==='t-clip'?'passed':'failed','still '+await tab());
  /* 7. ends */
  r=await at('#p-clip .hint');await swipe(60,r.y+r.h/2,330,r.y+r.h/2);
  rec('Swiping right on the first mode rubber-bands and stays',await tab()==='t-clip'&&!(await p.evaluate(()=>document.getElementById('p-clip').style.transform))?'passed':'failed','still '+await tab());
  /* 8. swipe on the Get started card area works too (it sits above the pages) */
  await p.screenshot({path:shot+'-end.png'});
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
