/* Step mode, run results and replay (Body inside the player, Ghost with hit targets).
   Step mode: the clip waits on each key move until you hold it, then plays on; tap play to skip.
   Results: when a pass ends, the score and each key move (Hit/Close/Miss) show; tap a move to go to it.
   Replay: your recorded camera plays beside the clip with your skeleton; Worldline shows your last run in green.
   The fake camera plays a dance video; for "matching" the tracker is made to return the dancer's own pose.
   Usage: node step_run_test.js <page> <clip> <camera.y4m> [shot] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,CAM,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({camFile:CAM});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.click('#t-body');await p.evaluate(()=>{window.__rsPR.count=0;window.__rsPR.hands=false});
 for(let i=0;i<60;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>document.getElementById('camVid').videoWidth&&window.__rsPR.rt&&window.__rsPR.Praw))break}
 await p.click('#pracMode button[data-pm="ghost"]');await p.waitForTimeout(400);
 const stepShown=await p.evaluate(()=>!document.getElementById('pracStep').hidden);
 await p.click('#pracStep');await p.click('#pracMirror');
 /* the tracker returns the dancer's own pose: a perfect match */
 await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.rt._d=PR.rt.detect;PR.rt.detect=()=>{const n=R.srcById(R.S.cur),v=document.querySelector('#stage video:not(.off)');const P=RB.poseAt(n.body,v.currentTime);return P?P.map(q=>[q[0],q[1],q[2]]):null};
   R.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0.1});await p.waitForTimeout(500);
 const keys=await p.evaluate(()=>window.__rsPrHits().slice());
 await p.click('#play');
 /* watch: each hold, where the clip stopped, and that it plays on by itself */
 const holds=[];let shotDone=false;const t0=Date.now();
 while(Date.now()-t0<40000){await p.waitForTimeout(60);
   const st=await p.evaluate(()=>{const v=document.querySelector('#stage video:not(.off)'),PR=window.__rsPR;return {h:PR.hold,vt:v.currentTime,pl:window.__rs.S.playing,res:!document.getElementById('pracRes').hidden,n:PR.pass.n}});
   if(st.h!=null&&!holds.some(x=>x.h===st.h)){holds.push({h:st.h,vt:+st.vt.toFixed(3),playing:st.pl});if(SHOT&&!shotDone){shotDone=true;await p.screenshot({path:SHOT+'-step.png'})}}
   if(st.res)break}
 const after=await p.evaluate(()=>({pass:window.__rsPR.pass,last:window.__rsPR.last&&{hits:window.__rsPR.last.hits.length,samples:window.__rsPR.last.samples.length,url:!!window.__rsPR.last.url,labels:window.__rsPR.last.hits.map(x=>x.label+':'+x.score)}}));
 rec('Step mode shows in Ghost (with hit targets)',stepShown?'passed':'failed','');
 rec('Step mode: the clip stops on each key move, at the move',holds.length>=Math.min(3,keys.length)&&holds.every(x=>!x.playing&&Math.abs(x.vt-x.h)<0.06)?'passed':'failed',JSON.stringify({keys:keys.length,holds}));
 rec('…and plays on by itself once you hold the pose (Hits)',after.last&&after.last.hits>=holds.length&&after.last.labels.filter(l=>/^Hit/.test(l)).length>=holds.length-1?'passed':'failed',JSON.stringify(after));
 /* results */
 const res=await p.evaluate(()=>({shown:!document.getElementById('pracRes').hidden,score:document.getElementById('prResScore').textContent,sum:document.getElementById('prResSum').textContent,moves:[...document.querySelectorAll('#prResMoves button')].map(b=>b.dataset.l)}));
 if(SHOT){await p.waitForTimeout(600);await p.screenshot({path:SHOT+'-results.png'})}
 rec('When the pass ends, the results show: score and each key move',res.shown&&/^\d+%$/.test(res.score)&&res.moves.length===after.last.hits&&/hit .* close .* miss of/.test(res.sum)?'passed':'failed',JSON.stringify(res));
 /* tap a move: goes to just before it */
 const jump=await p.evaluate(()=>{const b=document.querySelector('#prResMoves button:nth-child(2)')||document.querySelector('#prResMoves button');const t=+b.dataset.t;b.click();const v=document.querySelector('#stage video:not(.off)');return {t,vt:v.currentTime,pl:window.__rs.S.playing}});
 rec('Tapping a move goes to just before it',!jump.pl&&jump.vt<jump.t&&jump.t-jump.vt<3?'passed':'failed',JSON.stringify(jump));
 /* replay */
 await p.evaluate(()=>{const PR=window.__rsPR;PR.rt.detect=()=>null});   /* replay must not use the live tracker */
 await p.click('#prReplay');let rp=null;
 for(let i=0;i<20;i++){await p.waitForTimeout(250);rp=await p.evaluate(()=>{const r=document.getElementById('camRec'),PR=window.__rsPR,c=document.getElementById('camCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let lit=0,g=0;for(let i=0;i<d.length;i+=16){if(d[i]+d[i+1]+d[i+2]>120)lit++;if(d[i+1]>170&&d[i]<110&&d[i+2]<160)g++}
   const sm=PR.replay&&PR.replay.samples;return {vt:+document.querySelector('#stage video:not(.off)').currentTime.toFixed(2),on:!!PR.replay,src:!!r.src,rs:r.readyState,rt:+r.currentTime.toFixed(2),pose:!!PR.Praw,lit,g,playing:window.__rs.S.playing,live:!document.getElementById('pracLive').hidden,step:document.getElementById('pracStep').hidden}});if(rp.rs>=2&&rp.pose&&rp.rt>0.3)break}
 if(SHOT)await p.screenshot({path:SHOT+'-replay.png'});
 rec('Replay me: your recorded camera plays with the clip, your skeleton on it',Math.abs(rp.rt-rp.vt)<2.5&&rp.on&&rp.src&&rp.rs>=2&&rp.pose&&rp.lit>500&&rp.g>20&&rp.playing&&rp.live?'passed':'failed',JSON.stringify(rp));
 const scoredBefore=await p.evaluate(()=>window.__rsPR.last.hits.length);await p.waitForTimeout(2500);
 const noHold=await p.evaluate(()=>({hold:window.__rsPR.hold,pl:window.__rs.S.playing,hits:window.__rsPR.last.hits.length}));
 rec('…without scoring again or stopping for Step mode',noHold.hold==null&&noHold.pl&&noHold.hits===scoredBefore?'passed':'failed',JSON.stringify(noHold));
 await p.click('#pracLive');await p.click('#play').catch(()=>{});await p.waitForTimeout(300);
 const back=await p.evaluate(()=>({replay:!!window.__rsPR.replay,live:document.getElementById('pracLive').hidden}));
 if(await p.evaluate(()=>window.__rs.S.playing))await p.click('#play');
 /* Step mode with a pose that doesn't match: it waits; play skips */
 await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.rt.detect=PR.rt._d;R.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0.1});await p.waitForTimeout(1200);   /* a pass in progress ends here (results) */
 if(!(await p.evaluate(()=>window.__rs.S.playing)))await p.click('#play');let w=null;const tr2=[];
 for(let i=0;i<200;i++){await p.waitForTimeout(80);const z=await p.evaluate(()=>[window.__rsPR.hold,+document.querySelector('#stage video:not(.off)').currentTime.toFixed(2),window.__rs.S.playing?'P':'-',!document.getElementById('pracRes').hidden?'R':''].join(','));if(i%8===0)tr2.push(z);if(await p.evaluate(()=>window.__rsPR.hold!=null))break}
 console.log('trace',tr2.join(' | '));
 await p.waitForTimeout(600);
 const h1=await p.evaluate(()=>({h:window.__rsPR.hold,vt:document.querySelector('#stage video:not(.off)').currentTime,msg:document.getElementById('pracMsg').textContent}));
 await p.waitForTimeout(1500);
 w=await p.evaluate(()=>({h:window.__rsPR.hold,vt:document.querySelector('#stage video:not(.off)').currentTime,pl:window.__rs.S.playing}));
 const waited=h1.h!=null&&(w.h===h1.h&&!w.pl&&Math.abs(w.vt-h1.vt)<0.05);
 if(w.h!=null)await p.click('#play');await p.waitForTimeout(500);
 const sk=await p.evaluate(h=>({hold:window.__rsPR.hold,done:window.__rsPR.done.has(h),pl:window.__rs.S.playing}),h1.h);
 await p.click('#play');
 rec('Back to live ends the replay',!back.replay&&back.live?'passed':'failed',JSON.stringify(back));
 rec('A pose that doesn\'t match: the clip waits (with a hold message), and play skips on',(waited||sk.done)&&/hold the amber pose/.test(h1.msg)&&sk.hold!==h1.h&&sk.done?'passed':'failed',JSON.stringify({h1,w,sk,waited}));
 /* Worldline: your last run in green */
 await p.click('#pracMode button[data-pm="world"]');if(await p.evaluate(()=>window.__rsPR.mine))await p.click('#pracMine');await p.waitForTimeout(800);
 const wl=await p.evaluate(()=>{const c=document.getElementById('camCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let g=0;for(let i=0;i<d.length;i+=8){if(d[i+1]>170&&d[i]<110&&d[i+2]<160)g++}return {g,chip:!document.getElementById('pracMyRun').hidden}});
 if(SHOT)await p.screenshot({path:SHOT+'-world.png'});
 await p.click('#pracMyRun');await p.waitForTimeout(400);
 const wl2=await p.evaluate(()=>{const c=document.getElementById('camCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let g=0;for(let i=0;i<d.length;i+=8){if(d[i+1]>170&&d[i]<110&&d[i+2]<160)g++}return g});
 rec('Worldline: your last run in green beside the dancer (My last run turns it off)',wl.chip&&wl.g>60&&wl2<wl.g/3?'passed':'failed',JSON.stringify({wl,wl2}));
 await p.click('#pracMyRun');
 await p.click('#pracStop');await p.waitForTimeout(300);
 const off=await p.evaluate(()=>({src:!!document.getElementById('camVid').srcObject,res:document.getElementById('pracRes').hidden}));
 rec('Stop turns the camera off and hides the results',!off.src&&off.res?'passed':'failed',JSON.stringify(off));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
