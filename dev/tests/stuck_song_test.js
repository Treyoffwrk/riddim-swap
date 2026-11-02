/* The play button shows pause while playing (and stops both); if the phone's song clock stops moving, the video plays on
   instead of being dragged back to the same spot over and over (the loop seen on an iPhone, 2 Nov); once the song's
   clock moves again they line up. Usage: node stuck_song_test.js <page> <video> <song> */
const {chromium}=require('playwright');const [,,page,video,song]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
 await p.evaluate(()=>{if(!window.__rs.S.loop)document.getElementById('repeat').click()});
 const icon=()=>p.evaluate(()=>({play:getComputedStyle(document.getElementById('icoPlay')).display!=='none',pause:getComputedStyle(document.getElementById('icoPause')).display!=='none',label:document.getElementById('play').getAttribute('aria-label')}));
 const st=()=>p.evaluate(()=>{const v=document.querySelector('#stage video:not(.off)'),a=document.querySelector('audio');return {t:v.currentTime,vp:v.paused,ap:a.paused,at:a.currentTime}});
 const i0=await icon();await p.tap('#play');await p.waitForTimeout(1200);const i1=await icon(),s1=await st();
 await p.tap('#play');await p.waitForTimeout(800);const i2=await icon(),s2=await st();await p.waitForTimeout(800);const s3=await st();
 rec('The button shows pause while playing, and pressing it stops the video and the song',i0.play&&!i0.pause&&i1.pause&&!i1.play&&i1.label==='Pause'&&i2.play&&!i2.pause&&!s1.vp&&!s1.ap&&s2.vp&&s2.ap&&Math.abs(s3.t-s2.t)<0.01?'passed':'failed',JSON.stringify({i0,i1,i2,s1,s2}));
 /* the song's clock stops (the sound may carry on): the video must keep going, not loop */
 await p.evaluate(()=>{window.__rs.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0});await p.waitForTimeout(400);
 await p.tap('#play');await p.waitForTimeout(800);
 await p.evaluate(()=>{const a=document.querySelector('audio'),d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');window.__freeze={a,d,at:a.currentTime};
   Object.defineProperty(a,'currentTime',{get(){return window.__freeze.at},set(x){window.__freeze.at=x},configurable:true})});
 const ts=[];for(let i=0;i<12;i++){ts.push((await st()).t);await p.waitForTimeout(400)}
 const back=ts.slice(1).filter((t,i)=>t<ts[i]-0.05).length, gain=ts[ts.length-1]-ts[0];
 const msg=await p.evaluate(()=>document.getElementById('recMsg')?.textContent||'');
 rec('Song clock stuck: the video plays on instead of jumping back (no loop)',back===0&&gain>3.5?'passed':'failed',JSON.stringify({ts:ts.map(t=>+t.toFixed(2)),back,gain:+gain.toFixed(2)}));
 rec('…and it says what happened',/stopped keeping time/.test(msg)?'passed':'failed',msg);
 /* the clock moves again: they line up */
 await p.evaluate(()=>{const F=window.__freeze;delete F.a.currentTime;});await p.tap('#play');await p.waitForTimeout(500);await p.tap('#play');await p.waitForTimeout(2500);
 const sy=await p.evaluate(()=>{const S=window.__rs.S,a=document.querySelector('audio'),v=document.querySelector('#stage video:not(.off)');return {drift:+(a.currentTime-(S.offset+(v.currentTime-(S.cIn||0))*S.ar)).toFixed(3),playing:S.playing,ap:a.paused}});
 rec('When the song keeps time again, pause and play lines them up',Math.abs(sy.drift)<0.15&&sy.playing&&!sy.ap?'passed':'failed',JSON.stringify(sy));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
