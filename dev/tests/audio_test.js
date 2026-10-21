/* Clean sound over a long session: no live audio engine unless needed, fixed-rate song, engine closed when leaving the
   app, song refreshed on return, click track still works. Usage: node audio_test.js <page> <video> <song> */
const {chromium}=require('playwright');
const [,,page,video,song]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  /* count live audio engines made, and the WAV the song plays from */
  await p.addInitScript(()=>{const C=window.AudioContext;window.__ctxMade=0;window.AudioContext=function(o){window.__ctxMade++;return new C(o)};window.AudioContext.prototype=C.prototype});
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
  const s0=await p.evaluate(async()=>{const R=window.__rs,a=document.getElementById('aud');const ab=await (await fetch(a.src)).arrayBuffer();const dv=new DataView(ab);
    return {engines:window.__ctxMade,ctx:!!R.audioCtx,bufRate:R.songBuf&&R.songBuf.sampleRate,wavRate:dv.getUint32(24,true),bpm:R.S.mainSong&&R.S.mainSong.an&&+R.S.mainSong.an.bpm.toFixed(2)}});
  rec('Adding a song opens no live audio engine',s0.engines===0&&!s0.ctx?'passed':'failed',JSON.stringify(s0));
  rec('Song is decoded and played at a fixed 44.1 kHz',s0.bufRate===44100&&s0.wavRate===44100?'passed':'failed',`decoded ${s0.bufRate} Hz, playing file ${s0.wavRate} Hz`);
  rec('Beat analysis unchanged',Math.abs((s0.bpm||0)-99.51)<0.2?'passed':'failed',`${s0.bpm} BPM (was 99.51)`);
  /* click track: needs the engine, made inside the tap */
  await p.click('#t-song');await p.check('#clickOn');await p.click('#play');await p.waitForTimeout(2500);
  const c1=await p.evaluate(()=>({state:window.__rs.audioCtx&&window.__rs.audioCtx.state,engines:window.__ctxMade,playing:window.__rs.S.playing}));
  rec('Beat click opens the engine when you turn it on',c1.state==='running'&&c1.engines===1?'passed':'failed',JSON.stringify(c1));
  /* leave the app and come back */
  const hide=v=>p.evaluate(v=>{Object.defineProperty(document,'hidden',{value:v,configurable:true});Object.defineProperty(document,'visibilityState',{value:v?'hidden':'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
  const srcBefore=await p.evaluate(()=>document.getElementById('aud').src);
  await hide(true);await p.waitForTimeout(3500);
  const away=await p.evaluate(()=>({ctx:!!window.__rs.audioCtx,playing:window.__rs.S.playing}));
  rec('Leaving the app pauses and closes the engine',!away.ctx&&!away.playing?'passed':'failed',JSON.stringify(away));
  await hide(false);await p.waitForTimeout(1500);
  const back=await p.evaluate(()=>({src:document.getElementById('aud').src,ready:document.getElementById('aud').readyState}));
  rec('Coming back gives the song player a fresh start',back.src!==srcBefore&&back.ready>=1?'passed':'failed',JSON.stringify({changed:back.src!==srcBefore,ready:back.ready}));
  await p.click('#play');await p.waitForTimeout(2500);
  const c2=await p.evaluate(()=>({state:window.__rs.audioCtx&&window.__rs.audioCtx.state,engines:window.__ctxMade,playing:window.__rs.S.playing,songPlaying:!document.getElementById('aud').paused,drift:+(document.getElementById('aud').currentTime-(window.__rs.S.offset+window.__rs.tPos()*window.__rs.S.ar)).toFixed(3)}));
  rec('After coming back: song plays in time and the click comes back (new engine)',c2.playing&&c2.songPlaying&&Math.abs(c2.drift)<0.08&&c2.state==='running'&&c2.engines===2?'passed':'failed',JSON.stringify(c2));
  await p.click('#play');await p.uncheck('#clickOn');
  /* many trips away and back: still one song player, still in time */
  for(let i=0;i<8;i++){await hide(true);await p.waitForTimeout(3200);await hide(false);await p.waitForTimeout(400)}
  await p.click('#play');await p.waitForTimeout(2500);
  const c3=await p.evaluate(()=>({playing:!document.getElementById('aud').paused,drift:+(document.getElementById('aud').currentTime-(window.__rs.S.offset+window.__rs.tPos()*window.__rs.S.ar)).toFixed(3),engines:window.__ctxMade,ctx:!!window.__rs.audioCtx}));
  rec('After 8 trips away: in time, and no engine left open without the click',c3.playing&&Math.abs(c3.drift)<0.08&&!c3.ctx?'passed':'failed',JSON.stringify(c3));
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
