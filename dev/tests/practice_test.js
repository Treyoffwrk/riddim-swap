/* Practice (Body inside the player): the Body tab turns your camera on here instead of opening a separate page; the clip
   keeps its edits; Side by side and Ghost; your live skeleton; hit targets scored on each hit; the camera stops on Stop
   and when the app is left. The fake camera plays a dance video.
   Usage: node practice_test.js <page> <clip> <camera.y4m> [shot] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,CAM,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({camFile:CAM});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));let navMV=false;p.on('framenavigated',f=>{if(/mirrorview/.test(f.url()))navMV=true});
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 /* camera stays off until asked */
 const camBefore=await p.evaluate(()=>!!document.getElementById('camVid').srcObject);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 /* an edit: slower clip speed */
 await p.click('#spdBtn');await p.click('.spdpre button[data-v="0.75"]');await p.click('#spdBtn');
 await p.click('#t-body');
 let live=null;for(let i=0;i<60;i++){await p.waitForTimeout(500);live=await p.evaluate(()=>({cam:document.getElementById('camVid').videoWidth,pose:!!(window.__rsPR.Praw),on:window.__rsPR.on}));if(live.cam&&live.pose)break}
 const lay=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),v=document.querySelector('#stage video:not(.off)').getBoundingClientRect(),c=document.getElementById('camCanvas').getBoundingClientRect();
   return {stage:[Math.round(st.width),Math.round(st.height)],vid:[Math.round(v.left-st.left),Math.round(v.width)],cam:[Math.round(c.left-st.left),Math.round(c.width)],bar:!document.getElementById('pracBar').hidden,rate:document.querySelector('#stage video:not(.off)').playbackRate}});
 rec('Body turns your camera on inside the player (no separate page), camera off until then',!camBefore&&live.on&&live.cam>0&&!navMV&&lay.bar?'passed':'failed',JSON.stringify({camBefore,live,navMV}));
 rec('Side by side: the clip on the left half, your camera on the right half',Math.abs(lay.vid[1]-lay.stage[0]/2)<4&&Math.abs(lay.cam[0]-lay.stage[0]/2)<4&&lay.stage[1]>lay.stage[0]*0.9?'passed':'failed',JSON.stringify(lay));
 rec('Your skeleton is tracked live from the camera',live.pose?'passed':'failed',JSON.stringify(live));
 rec('The clip keeps its edits (speed ×0.75 here)',Math.abs(lay.rate-0.75)<0.01||await p.evaluate(()=>Math.abs(window.__rs.S.main.vr-0.75)<0.01)?'passed':'failed','rate '+lay.rate);
 const green=()=>p.evaluate(()=>{const c=document.getElementById('camCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let g=0,bl=0,am=0;for(let i=0;i<d.length;i+=8){const r=d[i],G=d[i+1],B=d[i+2];if(G>170&&r<110&&B<160)g++;if(B>200&&r>130&&r<190&&G>160)bl++;if(r>230&&G>150&&G<200&&B<110)am++}return {g,bl,am}});
 if(SHOT)await p.screenshot({path:SHOT+'-split.png'});
 const gs=await green();rec('…drawn on your camera',gs.g>40?'passed':'failed',JSON.stringify(gs));
 /* Ghost */
 await p.click('#pracMode button[data-pm="ghost"]');await p.waitForTimeout(800);
 const gl=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect(),v=document.querySelector('#stage video:not(.off)').getBoundingClientRect(),c=document.getElementById('camCanvas').getBoundingClientRect();return {cam:Math.round(c.width)===Math.round(st.width),pip:v.width<st.width*0.4}});
 await p.click('#play');await p.waitForTimeout(500);
 /* catch the target on screen before a hit */
 let tg=null;for(let i=0;i<40;i++){await p.waitForTimeout(150);const g=await green();if(g.am>30){tg=g;break}}
 if(SHOT)await p.screenshot({path:SHOT+'-ghost.png'});
 const g2=await green();
 rec('Ghost: your camera fills the player with the dancer laid over you, the clip small in the corner',gl.cam&&gl.pip&&g2.bl>40?'passed':'failed',JSON.stringify({gl,g2}));
 rec('Hit targets show up ahead of each hit',!!tg?'passed':'failed',JSON.stringify(tg));
 await p.waitForTimeout(7000);
 const res=await p.evaluate(()=>({pass:window.__rsPR.pass,results:(window.__rsPR.results||[]).slice(0,8),msg:document.getElementById('pracMsg').textContent}));
 rec('Each hit is scored as it passes, and the pass is tallied',res.pass.n>=2&&res.results.some(r=>r.score!=null)&&/This pass/.test(res.msg)?'passed':'failed',JSON.stringify(res));
 await p.click('#play');
 const sc=await p.evaluate(()=>{const f=window.__rsPrScore;const P=Array.from({length:33},(_,j)=>[100+(j%7)*20,100+Math.floor(j/7)*40,1]);
   const Q=P.map(q=>[q[0]*2+50,q[1]*2+30,1]);   /* same pose, moved and bigger */
   const R=P.map((q,j)=>j===15?[q[0]+160,q[1]-160,1]:j===16?[q[0]-160,q[1]-160,1]:j===13?[q[0]+60,q[1]-80,1]:j===14?[q[0]-60,q[1]-80,1]:q);   /* arms raised another way */
   return {same:f(P,P),moved:f(P,Q),arms:f(P,R)}});
 rec('Scoring: same shape scores 100 wherever and however big; other arms score lower',sc.same===100&&sc.moved===100&&sc.arms<85?'passed':'failed',JSON.stringify(sc));
 /* someone doing exactly the dancer's moves (the camera gives the dancer's own pose) gets Hits */
 await p.click('#pracMirror');await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.rt.detect=()=>{const n=R.srcById(R.S.cur),v=document.querySelector('#stage video:not(.off)');const P=RB.poseAt(n.body,v.currentTime);return P?P.map(q=>[q[0],q[1],q[2]]):null};
   R.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0.1});await p.waitForTimeout(600);
 await p.click('#play');const trace=[];for(let i=0;i<18;i++){await p.waitForTimeout(500);trace.push(await p.evaluate(()=>{const v=document.querySelector('#stage video:not(.off)');return [+v.currentTime.toFixed(2),window.__rs.S.playing?'P':'-',window.__rsPR.pass.n,window.__rsPR.done.size,+window.__rsPR.lastVt.toFixed(2),window.__rsPR.win.size,!!window.__rsPR.P].join(',')}))}console.log(trace.join(' | '));await p.click('#play');
 const good=await p.evaluate(()=>({pass:window.__rsPR.pass,res:(window.__rsPR.results||[]).slice(-6)}));
 rec('Matching the dancer scores Hits',good.pass.n>=2&&good.pass.hit>=good.pass.n-1?'passed':'failed',JSON.stringify(good));
 /* Stop, and leaving the app, turn the camera off */
 await p.click('#pracStop');await p.waitForTimeout(300);
 const off=await p.evaluate(()=>({src:!!document.getElementById('camVid').srcObject,on:window.__rsPR.on,bar:document.getElementById('pracBar').hidden,stage:document.getElementById('stage').classList.contains('practice')}));
 await p.click('#t-body');for(let i=0;i<20;i++){await p.waitForTimeout(300);if(await p.evaluate(()=>!!document.getElementById('camVid').videoWidth))break}
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(300);
 const away=await p.evaluate(()=>({src:!!document.getElementById('camVid').srcObject,on:window.__rsPR.on}));
 rec('Stop, and leaving the app, turn the camera off',!off.src&&!off.on&&off.bar&&!off.stage&&!away.src&&!away.on?'passed':'failed',JSON.stringify({off,away}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
