/* UI test: beat lights setting (Off/Calm/Flash, reduced motion), confidence gate, tap to check, "This is the 1",
   clear beat / clear hits / clear all tracking, and that the dancer's decisions survive a reload. */
const {chromium}=require('playwright');
const [,,url,video,song,truthV]=process.argv; const TV=JSON.parse(require('fs').readFileSync(truthV));
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  /* reduced motion -> Off by default */
  {const ctx=await b.newContext({reducedMotion:'reduce'});const p=await ctx.newPage();await p.goto(url);await p.evaluate(()=>localStorage.clear());await p.reload();
   ok(await p.evaluate(()=>document.body.classList.contains('bv-off')),'reduced-motion phone starts with beat cues Off');await ctx.close()}
  const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage(); const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url+'#debug'); await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()}); await p.reload();
  ok(await p.evaluate(()=>document.body.classList.contains('bv-ball')),'default beat cues: Ball');
  await p.setInputFiles('#vidFile',video); await p.setInputFiles('#audFile',song);
  for(let i=0;i<40;i++){if(await p.evaluate(()=>!!(window.__rs.S.mainSong&&window.__rs.S.mainSong.an)))break;await p.waitForTimeout(250)}
  const watch=async ms=>p.evaluate(ms=>new Promise(r=>{const st=document.querySelector('#stage');let fl=0,lit=0;const iv=setInterval(()=>{if(st.classList.contains('pulse-s')||st.classList.contains('pulse-d'))fl++;if(document.querySelector('#sBeats i.on'))lit++},20);setTimeout(()=>{clearInterval(iv);r({fl,lit})},ms)}),ms);
  const painted=()=>p.evaluate(()=>{const c=document.getElementById('cueCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=16)if(d[i]>0)n++;return n});
  await p.click('#play'); await p.waitForTimeout(300);
  let w=await watch(2000); const px=await painted(); ok(w.fl===0&&w.lit>0&&px>50,`Ball: balls drawn (${px} px), count lights on (${w.lit} samples), frame never flashes (${w.fl})`);
  await p.click('#t-tempo'); await p.click('#bvSeg [data-bv="calm"]'); await p.waitForTimeout(200);
  w=await watch(1500); ok(w.lit>0&&await painted()===0,`Count: lights only, no balls (${w.lit} samples)`);
  await p.click('#bvSeg [data-bv="ball"]');
  /* confidence gate: make the song look unsure */
  await p.evaluate(()=>{const so=window.__rs.S.mainSong;so._pc=so.an.phaseConf;so.an.phaseConf=0.05});
  w=await watch(1500); ok(w.fl===0&&await p.evaluate(()=>document.querySelector('#sBeats').classList.contains('unsure')&&window.__rs.riddimEvents().sure===false),'unsure song beat: dim "?" lights and a hollow "?" ball');
  await p.evaluate(()=>{const so=window.__rs.S.mainSong;so.an.phaseConf=so._pc});
  await p.click('#bvSeg [data-bv="off"]'); ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#pulses')).display==='none'),'Off hides the lights');
  ok(await p.evaluate(()=>localStorage.getItem('rs-cues'))==='off','setting saved on this device');
  await p.click('#bvSeg [data-bv="ball"]');
  await p.click('#play'); await p.click('#t-song');
  /* tap to check: taps scheduled on the detected beats (+ offset in beats) at the song's clock */
  const restart=async()=>{if(!(await p.evaluate(()=>document.querySelector('#aud').paused)))await p.click('#play');
    await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=0;return new Promise(r=>v.addEventListener('seeked',r,{once:true}))});
    await p.click('#play'); await p.waitForTimeout(500)};
  const tapBeats=async(off,per)=>{await restart();return p.evaluate(([off,per])=>new Promise(res=>{const a=document.querySelector('#aud'),S=window.__rs.S,G=S.mainSong.an;const btn=document.querySelector('#beatCheck');
    const p0=60/G.bpm, P=per||p0; let t0=G.beats.find(x=>x>a.currentTime+0.3);const times=[];for(let k=0;k<6;k++)times.push(t0+off*p0+k*P);
    let k=0;const iv=setInterval(()=>{if(k<6&&a.currentTime>=times[k]){btn.click();k++}if(k>=6||a.paused){clearInterval(iv);setTimeout(res,900)}},4)}),[off,per])};
  await p.click('#beatCheck'); // starts playback hint (paused) -> message
  ok((await p.textContent('#beatCheckMsg')).includes('Press play'),'tap check asks to press play first');
  await tapBeats(0); let m=await p.textContent('#beatCheckMsg');
  ok(m.includes('✓')&&await p.evaluate(()=>window.__rs.S.mainSong.confirmed),'taps on the beat confirm it: '+m);
  const b0=await p.evaluate(()=>window.__rs.S.mainSong.an.beats.slice(0,3));
  await tapBeats(0.5); await p.waitForTimeout(800); m=await p.textContent('#beatCheckMsg');
  const b1=await p.evaluate(()=>window.__rs.S.mainSong.an.beats.slice(0,3));
  const per=60/await p.evaluate(()=>window.__rs.S.mainSong.an.bpm);
  const moved=b1.map(t=>Math.min(...b0.map(x=>Math.abs(x-t))));
  ok(m.includes('half a beat')&&moved.every(d=>Math.abs(d-per/2)<0.04),'taps half a beat off move the grid by half a beat: '+m);
  await tapBeats(0.5); await p.waitForTimeout(800); // move it back
  ok(await p.evaluate(()=>window.__rs.S.mainSong.beatShift===0),'tapping on the original beat moves it back');
  /* wrong tempo: tap at double time */
  await tapBeats(0,per/2); await p.waitForTimeout(1500); m=await p.textContent('#beatCheckMsg');
  const bpm2=await p.evaluate(()=>window.__rs.S.mainSong.an.bpm);
  ok(Math.abs(bpm2/(60/per)-2)<0.08,'double-time taps re-find the beat at double tempo ('+bpm2.toFixed(1)+'): '+m);
  await p.evaluate(()=>{const so=window.__rs.S.mainSong;so.forceBpm=null;so.confirmed=false});await p.click('#beatFind').catch(()=>{});
  await p.evaluate(()=>new Promise(r=>{const so=window.__rs.S.mainSong;so._after=r;document.querySelector('#beatUseDet').click();setTimeout(r,50)}));
  await p.evaluate(()=>{const so=window.__rs.S.mainSong;so.forceBpm=null;so.beatShift=0});
  await p.evaluate(()=>new Promise(r=>{const so=window.__rs.S.mainSong;so._after=r;document.querySelector('#beatHalf').click();}));
  await p.evaluate(()=>new Promise(r=>{const so=window.__rs.S.mainSong;so._after=r;document.querySelector('#beatHalf').click();}));
  /* This is the 1 */
  if(await p.evaluate(()=>document.querySelector('#aud').paused))await p.click('#play');
  await p.waitForTimeout(500);
  const oneAt=await p.evaluate(()=>{document.querySelector('#beatOne').click();return window.__rs.S.mainSong.oneAt});
  const dOk=await p.evaluate(o=>{const an=window.__rs.S.mainSong.an;const near=an.beats.reduce((b,t)=>Math.abs(t-o)<Math.abs(b-o)?t:b);return an.downbeats.some(d=>Math.abs(d-near)<1e-6)&&Math.abs(window.__rs.S.sAnchor-an.downbeats[0])<1e-6},oneAt);
  ok(dOk,'"This is the 1" makes the nearest beat a downbeat and the count starts there');
  /* clear beat */
  await p.click('#beatClear');
  ok(await p.evaluate(()=>window.__rs.S.mainSong.cleared&&!window.__rs.S.sBase&&document.querySelector('#songCard').classList.contains('cleared')&&document.querySelector('#sBpm').value===''),'Clear beat removes the grid, tempo and lights');
  ok(await p.evaluate(()=>document.querySelector('#beatFind').offsetParent!==null),'"Find the beat again" is offered');
  await p.click('#beatFind'); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>!window.__rs.S.mainSong.cleared&&window.__rs.S.sBase>0),'Find the beat again restores it');
  if(await p.evaluate(()=>document.querySelector('#aud').paused))await p.click('#play');
  await p.waitForTimeout(400); await p.click('#beatOne'); await p.click('#play');   /* set the 1 again (clearing forgets it) */
  /* dance: find hits, check with taps on the true hits, clear */
  await p.click('#play').catch(()=>{}); if(!(await p.evaluate(()=>document.querySelector('#aud').paused)))await p.click('#play');
  await p.click('#t-clip'); await p.click('#danceAnalyze');
  for(let i=0;i<80;i++){if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !!(n&&n.motion)}))break;await p.waitForTimeout(250)}
  ok(await p.isVisible('#hitCheck'),'Check / Clear hits buttons appear once hits are found');
  await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=0;});
  await p.waitForTimeout(300); await p.click('#play'); await p.waitForTimeout(200);
  await p.evaluate(H=>new Promise(res=>{const v=()=>[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));const btn=document.querySelector('#hitCheck');
    const T=H.filter(h=>h>v().currentTime+0.2).slice(0,6);let k=0;const iv=setInterval(()=>{if(k<T.length&&v().currentTime>=T[k]){btn.click();k++}if(k>=T.length){clearInterval(iv);setTimeout(res,300)}},4)}),TV.hits);
  m=await p.textContent('#hitCheckMsg'); ok(m.includes('✓')&&await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).motion.confirmed),'taps on the hits confirm them: '+m);
  await p.click('#play');
  await p.waitForTimeout(3500);   // autosave
  await p.reload(); await p.waitForTimeout(3000);
  const kept=await p.evaluate(()=>({one:window.__rs.S.mainSong&&window.__rs.S.mainSong.oneAt,hit:window.__rs.srcById(window.__rs.S.cur).motion&&window.__rs.srcById(window.__rs.S.cur).motion.confirmed,bv:document.body.className}));
  ok(kept.one!=null&&kept.hit===true,'after reload: the 1 and checked hits are kept '+JSON.stringify(kept));
  await p.click('#t-clip'); await p.click('#hitClear');
  ok(await p.evaluate(()=>!window.__rs.srcById(window.__rs.S.cur).motion),'Clear hits removes hits for the clip');
  await p.click('#t-tempo'); await p.click('#tAll');
  ok(await p.evaluate(()=>{const S=window.__rs.S;return S.mainSong.cleared&&!S.sBase&&!S.dBase&&S.sources.every(n=>!n.motion)}),'Clear all tracking clears song beat, tempos and hits');
  await p.waitForTimeout(3500); await p.reload(); await p.waitForTimeout(3000);
  ok(await p.evaluate(()=>window.__rs.S.mainSong&&window.__rs.S.mainSong.cleared&&!window.__rs.S.sBase),'a cleared beat stays cleared after reload');
  ok(errs.length===0,'no page errors '+JSON.stringify(errs));
  await p.screenshot({path:process.argv[6]||'/tmp/ui.png'});
  await b.close();
})();
