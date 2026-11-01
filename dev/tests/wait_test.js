/* While the body tracks: the bar under the player shows progress; the skeleton appears on the part already tracked (and
   not past it); Practise the tracked part loops within it; Tap the beat scores taps against the song and offers a Sound
   delay when taps are consistently late; a chime and "Ready" when it's done; "Tracking stopped" with Carry on if it stops.
   Usage: node wait_test.js <host index.html> <clip> <song> <shot prefix> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=281/12;
   /* slow the tracker a little so the games fit inside one run */
   window.RB_TEST_HOOK=async({v,done})=>{const T=window.__T||{};if(T.slow)await new Promise(r=>setTimeout(r,T.slow));while(window.__T&&window.__T.hold)await new Promise(r=>setTimeout(r,50));if(T.freezeAt!=null&&done>=T.freezeAt)Object.defineProperty(v,'currentTime',{configurable:true,get(){return 0},set(){}})}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(5000);
 await p.evaluate(()=>{RB.CFG.partialEvery=1200;window.__T={slow:120}});
 const st=()=>p.evaluate(()=>{const L=window.__rs.liveBody;return {bar:!document.getElementById('waitBar').hidden,head:document.getElementById('waitHead').textContent,pct:document.getElementById('waitPct').textContent,msg:document.getElementById('waitMsg').textContent,
   live:L?{n:L.B.n,from:+L.from.toFixed(2),to:+L.to.toFixed(2)}:null,busy:window.__rs.S.bodyBusy,prac:window.__rs.S.waitPrac,playing:window.__rs.S.playing,ready:document.getElementById('waitBar').classList.contains('ready'),chimed:window.__rs.S.waitChimed||0}});
 /* lit pixels on the skeleton layer */
 const lit=()=>p.evaluate(()=>{const cv=document.getElementById('bodyCanvas');const x=cv.getContext('2d');const d=x.getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=16)if(d[i]>100)n++;return n});
 await p.click('#bodyTrack');await p.waitForTimeout(1500);
 const inView=await p.evaluate(()=>{const r=document.getElementById('waitBar').getBoundingClientRect();return r.top>=0&&r.top<innerHeight-80});
 rec('Tapping Track brings the bar into view',inView?'passed':'failed',String(inView));
 let s=null;for(let i=0;i<240;i++){await p.waitForTimeout(500);s=await st();if(s.live&&s.live.to>4)break}
 rec('While tracking, a bar under the player shows progress and the skeleton so far',s.bar&&/Tracking the body/.test(s.head)&&/\d+%/.test(s.pct)&&s.live&&s.live.to>4&&/ready up to/.test(s.msg)?'passed':'failed',JSON.stringify(s));
 /* drawn on the tracked part, not past it */
 const seek=async t=>{await p.evaluate(t=>{const v=window.__rs.v();v.pause();v.currentTime=t},t);await p.waitForTimeout(700)};
 await seek(Math.min(2,s.live.to/2));const inside=await lit();await seek(14);const s14=await st();const outside=await lit();
 rec('The skeleton shows on the tracked part only',inside>50&&(s14.live.to<13.5?outside===0:true)?'passed':'failed',JSON.stringify({inside,outside,to:s14.live.to}));
 await p.screenshot({path:SHOT+'-tracking.png'});
 /* Practise: plays and loops before the end of what's tracked */
 await p.click('#waitPractise');const ts=[];for(let i=0;i<40;i++){await p.waitForTimeout(150);ts.push(await p.evaluate(()=>({t:window.__rs.v().currentTime,to:window.__rs.liveBody&&window.__rs.liveBody.to,pl:window.__rs.S.playing})))}
 const wraps=ts.filter((q,i)=>i&&q.t<ts[i-1].t-0.5).length, over=ts.filter(q=>q.to&&q.t>q.to+0.2).length;
 rec('Practise the tracked part plays and loops back before the untracked part',ts.every(q=>q.pl)&&over===0&&(wraps>=1||ts[ts.length-1].to>ts[ts.length-1].t+1)?'passed':'failed',JSON.stringify({wraps,over,first:ts[0],last:ts[ts.length-1]}));
 /* Tap the beat: tapping 40 ms after each beat scores well; the game stops practising */
 const play=async lateMs=>{await p.click('#waitTap');
   return p.evaluate(late=>new Promise(res=>{const T=window.__rs.TAP,c=T.c,pad=document.getElementById('tapPad');let i=0;
     const offs=[];const iv=setInterval(()=>{offs.push(c.currentTime-performance.now()/1000);if(offs.length>200)offs.shift();const now=performance.now()/1000+offs.slice().sort((x,y)=>x-y)[offs.length>>1];while(i<T.beats.length&&now>=T.beats[i]+late/1000){if(i!==5&&i!==11)pad.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));i++}
       if(!window.__rs.TAP.on){clearInterval(iv);res({r:window.__tapLast,big:document.getElementById('tapBig').textContent,score:document.getElementById('tapScore').textContent,use:!document.getElementById('tapUseRow').hidden,useTxt:document.getElementById('tapUse').textContent,beats:T.beats.length,per:+T.per.toFixed(3)})}},4)}),lateMs)};
 await p.evaluate(()=>{window.__T={slow:120,hold:true}});await p.waitForTimeout(1500);
 const g1=await play(40);const s1=await st();
 rec('Tap the beat plays the song for 32 beats and scores the taps (30 on time, 2 missed)',g1.r&&g1.r.of===32&&g1.r.hits>=28&&g1.r.hits<=30&&Math.abs(g1.r.late-40)<=25&&/\d+ \/ 32/.test(g1.big)&&!g1.use&&!s1.prac?'passed':'failed',JSON.stringify({...g1,prac:s1.prac}));
 await p.evaluate(()=>{window.__T={slow:120}});await p.waitForTimeout(3000);await p.evaluate(()=>{window.__T={slow:120,hold:true}});await p.waitForTimeout(1500);
 const g2=await play(210);
 rec('Taps consistently ~200 ms late offer a Bluetooth sound delay',g2.use&&/Use 1[6-9]\d ms/.test(g2.useTxt)&&/Bluetooth/.test(g2.score)?'passed':'failed',JSON.stringify({use:g2.use,useTxt:g2.useTxt,late:g2.r&&g2.r.late}));
 await p.click('#tapUse');const dl=await p.evaluate(()=>Math.round(window.__rs.CUE.delay*1000));
 rec('Use it sets the Sound delay',dl>=160&&dl<=200?'passed':'failed',String(dl));
 await p.evaluate(()=>{window.__rs.CUE&&0});
 /* finish: Ready and a chime */
 await p.evaluate(()=>{window.__T={}});const busyAfterGames=await st();let f=null;for(let i=0;i<600;i++){await p.waitForTimeout(500);f=await st();if(!f.busy)break}
 rec('When it finishes: "Ready", a chime, and the live preview gives way to the full track',busyAfterGames.busy&&f.ready&&f.head==='Ready'&&f.chimed===1&&!f.live?'passed':'failed',JSON.stringify({...f,busyAfterGames:busyAfterGames.busy}));
 await p.screenshot({path:SHOT+'-ready.png'});
 /* stopped: says so, with Carry on tracking */
 await p.evaluate(()=>{RB.CFG.maxRevives=0;window.__T={freezeAt:40}});await p.click('#bodyTrack');
 let g=null;for(let i=0;i<600;i++){await p.waitForTimeout(500);g=await st();if(!g.busy)break}
 const carry=await p.evaluate(()=>!document.getElementById('waitCarry').hidden);
 rec('If it stops, the bar says so and offers Carry on tracking',g.bar&&g.head==='Tracking stopped'&&carry?'passed':'failed',JSON.stringify({g,carry}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
