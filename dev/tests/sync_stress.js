/* A struggling phone: CPU slowed 4×, the video keeps falling behind, short buffering hiccups. Count what the song does.
   Usage: node sync_stress.js <page> <video> <song> [label] */
const {chromium}=require('playwright');
const [,,page,video,song,label]=process.argv;
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
  await p.click('#repeat');   /* loop the clip so the play lasts */
  const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.evaluate(()=>{const a=document.getElementById('aud');window.__snd={seeks:0,pauses:0,drift:[]};
    a.addEventListener('seeking',()=>{if(window.__rs.S.playing)window.__snd.seeks++});a.addEventListener('pause',()=>{if(window.__rs.S.playing)window.__snd.pauses++});});
  /* the video decoder can't keep up: every video runs 3% slower than asked, without the app being told */
  await p.evaluate(()=>{const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'playbackRate');
    Object.defineProperty(HTMLVideoElement.prototype,'playbackRate',{configurable:true,get(){return this.__want??d.get.call(this)},set(x){this.__want=x;d.set.call(this,x*0.97)}});
    document.querySelectorAll('video').forEach(v=>{v.playbackRate=v.playbackRate})});
  await p.click('#play');await p.waitForTimeout(1500);
  const r=await p.evaluate(async()=>{const S=window.__rs.S,a=document.getElementById('aud');const t0=performance.now();let k=0;window.__snd.seeks=0;window.__snd.pauses=0;
    while(performance.now()-t0<20000){await new Promise(r=>setTimeout(r,250));k++;const v=window.__rs.v();
      if(k%12===0){v.dispatchEvent(new Event('waiting'));setTimeout(()=>v.dispatchEvent(new Event('playing')),250)}   /* a short hiccup */
      if(!a.paused)window.__snd.drift.push(a.currentTime-(S.offset+window.__rs.tPos()*S.ar))}
    const d=window.__snd.drift.map(Math.abs).sort((x,y)=>x-y);
    return {songJumps:window.__snd.seeks,songPauses:window.__snd.pauses,medianGapMs:Math.round(d[d.length>>1]*1000),p90GapMs:Math.round(d[Math.floor(d.length*.9)]*1000),stillPlaying:S.playing,report:document.getElementById('sndReport')?null:'(no report in this version)'}});
  if(await p.$('#sndReport')){await p.click('#play');await p.click('#projBtn');await p.waitForTimeout(400);r.report=await p.textContent('#sndReport')}
  console.log((label||'').padEnd(10),JSON.stringify(r),errs.length?'ERRORS '+errs.slice(0,2):'');
  await b.close();
})();
