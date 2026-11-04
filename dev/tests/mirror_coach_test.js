/* Mirror the clip; what to fix after each move (which body part was off); countdown; hands up to play / pause.
   Usage: node mirror_coach_test.js <page> <one-dancer clip> <camera.y4m> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,CAM,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({camFile:CAM});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 const hidden0=await p.evaluate(()=>document.getElementById('mirBtn').hidden);
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.evaluate(()=>{const h=document.getElementById('hipShow');if(h.checked)h.click();const v=document.querySelector('#stage video:not(.off)');v.currentTime=3.2});await p.waitForTimeout(900);
 const snap=()=>p.evaluate(()=>{const c=document.getElementById('bodyCanvas'),W=c.width,H=c.height,d=c.getContext('2d').getImageData(0,0,W,H).data;
   /* where the skeleton is: mean x of drawn pixels, and a coarse picture (24×24 alpha) to compare flipped */
   let sx=0,n=0;const g=new Float32Array(24*24);for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const a=d[(y*W+x)*4+3];if(a>60){sx+=x;n++;g[Math.floor(y/H*24)*24+Math.floor(x/W*24)]+=1}}
   return {W,mx:n?sx/n:null,n,g:Array.from(g)}});
 const st0=await p.evaluate(()=>({hidden:document.getElementById('mirBtn').hidden,pressed:document.getElementById('mirBtn').getAttribute('aria-pressed'),tf:getComputedStyle(document.querySelector('#stage video:not(.off)')).transform}));
 const A=await snap();
 await p.click('#mirBtn');await p.waitForTimeout(500);
 const st1=await p.evaluate(()=>({pressed:document.getElementById('mirBtn').getAttribute('aria-pressed'),tf:getComputedStyle(document.querySelector('#stage video:not(.off)')).transform,saved:localStorage.getItem('rs-mirror')}));
 const B=await snap();
 const flipDiff=(()=>{let s=0,u=0,t=0;for(let y=0;y<24;y++)for(let x=0;x<24;x++){const a=A.g[y*24+x],bb=B.g[y*24+(23-x)],c=B.g[y*24+x];s+=Math.abs(a-bb);u+=Math.abs(a-c);t+=a}return {flipped:+(s/(t||1)).toFixed(2),same:+(u/(t||1)).toFixed(2)}})();
 if(SHOT)await p.screenshot({path:SHOT+'-mirror.png'});
 rec('Mirror button shows with a clip (not before), off at first',hidden0&&!st0.hidden&&st0.pressed==='false'&&st0.tf==='none'?'passed':'failed',JSON.stringify({hidden0,st0}));
 rec('Tap it: the clip is shown mirrored and the setting is kept',st1.pressed==='true'&&/matrix\(-1/.test(st1.tf)&&st1.saved==='1'?'passed':'failed',JSON.stringify(st1));
 rec('The skeleton is drawn mirrored too (it stays on the flipped dancer)',A.n>200&&B.n>200&&Math.abs((A.W-A.mx)-B.mx)<A.W*0.03&&flipDiff.flipped<0.35&&flipDiff.same>flipDiff.flipped*1.5?'passed':'failed',JSON.stringify({a:Math.round(A.mx),b:Math.round(B.mx),W:A.W,...flipDiff}));
 await p.reload();await p.waitForTimeout(1500);
 const st2=await p.evaluate(()=>({pressed:document.getElementById('mirBtn').getAttribute('aria-pressed'),cls:document.getElementById('stage').classList.contains('mirr')}));
 rec('Still mirrored after reopening the app',st2.pressed==='true'&&st2.cls?'passed':'failed',JSON.stringify(st2));
 await p.click('#mirBtn');
 /* what was off: synthetic poses */
 const df=await p.evaluate(()=>{const f=window.__rsPrDiff;const P=Array.from({length:33},()=>[200,300,1]);
   const set=(Q,j,x,y)=>{Q[j]=[x,y,1]};const base=()=>{const Q=P.map(q=>q.slice());set(Q,11,240,200);set(Q,12,160,200);set(Q,13,260,260);set(Q,14,140,260);set(Q,15,270,320);set(Q,16,130,320);set(Q,23,230,330);set(Q,24,170,330);set(Q,25,232,420);set(Q,26,168,420);set(Q,27,234,510);set(Q,28,166,510);set(Q,0,200,160);return Q};
   const R=base(),U=base();set(U,13,290,150);set(U,15,300,90);   /* the dancer's left arm raised */
   const L=base();set(L,26,100,380);set(L,28,40,420);   /* right leg kicked out */
   return {same:f(R,R),armUp:f(U,R),legOut:f(L,R)}});
 rec('What was off: the right body part and a hint (arm too high; leg at the wrong angle); nothing when the same',df.same.length===0&&df.armUp[0]&&df.armUp[0].part==='left arm'&&df.armUp[0].hint==='too high'&&df.legOut[0]&&df.legOut[0].part==='right leg'?'passed':'failed',JSON.stringify(df));
 /* practice: camera on, countdown */
 await p.click('#t-body');
 let live=null;for(let i=0;i<60;i++){await p.waitForTimeout(500);live=await p.evaluate(()=>({cam:document.getElementById('camVid').videoWidth,rt:!!window.__rsPR.rt}));if(live.cam&&live.rt)break}
 await p.click('#pracMode button[data-pm="ghost"]');await p.waitForTimeout(500);
 const cdLabel=await p.evaluate(()=>document.getElementById('pracCount').textContent);
 await p.evaluate(()=>{document.querySelector('#stage video:not(.off)').currentTime=0.1});await p.waitForTimeout(300);
 await p.click('#play');const t0=Date.now();
 const during=[];for(let i=0;i<5;i++){await p.waitForTimeout(400);during.push(await p.evaluate(()=>({pl:window.__rs.S.playing,cd:!!window.__rsPR.cd})))}
 let started=null;for(let i=0;i<20;i++){await p.waitForTimeout(150);if(await p.evaluate(()=>window.__rs.S.playing)){started=(Date.now()-t0)/1000;break}}
 rec('Countdown: Play waits 3 s (shown on screen) so you can get into place, then the clip starts',cdLabel==='Countdown: 3 s'&&during.every(x=>!x.pl&&x.cd)&&started!=null&&started>2.8&&started<4.2?'passed':'failed',JSON.stringify({cdLabel,during:during.map(x=>+x.pl+''+(+x.cd)).join(','),started}));
 await p.click('#play');await p.waitForTimeout(300);
 await p.click('#play');await p.waitForTimeout(800);await p.click('#play');await p.waitForTimeout(600);
 const cancel=await p.evaluate(()=>({pl:window.__rs.S.playing,cd:!!window.__rsPR.cd}));
 rec('A tap during the countdown cancels it',!cancel.pl&&!cancel.cd?'passed':'failed',JSON.stringify(cancel));
 /* what to fix: the camera gives the dancer's own pose with the right arm held down by the side */
 await p.click('#pracMirror');
 await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.count=0;PR.hands=false;PR.rt.detect=()=>{const n=R.srcById(R.S.cur),v=document.querySelector('#stage video:not(.off)');const P=RB.poseAt(n.body,v.currentTime);if(!P)return null;
   const Q=P.map(q=>[q[0],q[1],q[2]]);const sh=Q[12];Q[14]=[sh[0]-0.005,sh[1]+0.11,1];Q[16]=[sh[0]-0.01,sh[1]+0.22,1];return Q};
   R.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0.1});await p.waitForTimeout(500);
 await p.click('#play');
 let flash=null,res=null,dbg=[];for(let i=0;i<140;i++){await p.waitForTimeout(200);const s=await p.evaluate(()=>({f:window.__rsPR.flash&&window.__rsPR.flash.why,shown:!document.getElementById('pracRes').hidden,pl:window.__rs.S.playing,t:+document.querySelector('#stage video:not(.off)').currentTime.toFixed(1),n:window.__rsPR.pass.n,run:!!window.__rsPR.run,P:!!window.__rsPR.P}));if(i%10===0)dbg.push(s);if(s.f&&!(flash||'').includes(s.f))flash=(flash?flash+' | ':'')+s.f;if(s.shown)break}
 if(!flash)console.log("debug",JSON.stringify(dbg),JSON.stringify(await p.evaluate(()=>({mode:window.__rsPR.mode,targets:window.__rsPR.targets,hits:window.__rsPrHits().length,hold:window.__rsPR.hold,step:window.__rsPR.step,replay:!!window.__rsPR.replay,done:window.__rsPR.done.size,res:document.getElementById("pracRes").hidden,beats:(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return n&&n.motion?n.motion.beats.length:"none"})(),ws:(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return n&&n.motion?n.motion.beats.slice(0,6).map(b=>+(b.w||0).toFixed(2)):null})(),segs:window.__rs.segs?window.__rs.segs().map(g=>[g.s,g.e]):"?",lvl:window.__rs.S.hitLevel,name:(window.__rs.srcById(window.__rs.S.cur)||{}).name,srcs:window.__rs.S.sources.length}))));
 res=await p.evaluate(()=>({tip:document.getElementById('prResTip').textContent,tipShown:!document.getElementById('prResTip').hidden,moves:[...document.querySelectorAll('#prResMoves button')].map(b=>b.title),last:(window.__rsPR.last&&window.__rsPR.last.hits||[]).map(x=>x.label+':'+((x.why&&x.why[0]&&x.why[0].part)||''))}));
 if(SHOT)await p.screenshot({path:SHOT+'-results.png'});
 const offRight=res.last.filter(x=>/right arm/.test(x)).length,offOther=res.last.filter(x=>/:(left|shoulders|hips)/.test(x)).length;
 rec('After a move you got wrong it says what to fix, live ("Fix: right arm …")',!!flash&&/right arm/.test(flash)?'passed':'failed',JSON.stringify({flash}));
 rec('The results say which body part to work on, and each move says what was off',res.tipShown&&/Work on: your right arm/.test(res.tip)&&offRight>=2&&offRight>offOther*2?'passed':'failed',JSON.stringify(res));
 /* hands up to play / pause */
 await p.evaluate(()=>{document.getElementById('prResClose').click();const PR=window.__rsPR;PR.hands=true;PR.count=0;PR.handsN=0;window.__hands=false;
   PR.rt.detect=()=>{const Q=Array.from({length:33},()=>[0.5,0.6,1]);Q[0]=[0.5,0.3,1];Q[11]=[0.58,0.42,1];Q[12]=[0.42,0.42,1];
     if(window.__hands){Q[15]=[0.6,0.15,1];Q[16]=[0.4,0.15,1]}else{Q[15]=[0.6,0.65,1];Q[16]=[0.4,0.65,1]}Q[23]=[0.55,0.65,1];Q[24]=[0.45,0.65,1];return Q}});
 if(await p.evaluate(()=>window.__rs.S.playing))await p.click('#play');
 await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__hands=true});const h0=Date.now();let hp=null;
 for(let i=0;i<30;i++){await p.waitForTimeout(100);if(await p.evaluate(()=>window.__rs.S.playing)){hp=(Date.now()-h0)/1000;break}}
 await p.waitForTimeout(800);const stillPlaying=await p.evaluate(()=>window.__rs.S.playing);   /* hands still up: must not pause until they come down and go up again */
 await p.evaluate(()=>{window.__hands=false});await p.waitForTimeout(500);
 await p.evaluate(()=>{window.__hands=true});await p.waitForTimeout(700);const after07=await p.evaluate(()=>window.__rs.S.playing);
 let hz=null;const h1=Date.now()-700;for(let i=0;i<20;i++){await p.waitForTimeout(100);if(!(await p.evaluate(()=>window.__rs.S.playing))){hz=(Date.now()-h1)/1000;break}}
 await p.evaluate(()=>{window.__hands=false});
 rec('Hands up: both hands above your head start the clip (0.6 s), held up longer it pauses (1.2 s), not twice from one raise',hp!=null&&hp<1.4&&stillPlaying&&after07&&hz!=null&&hz>1.1&&hz<2.2?'passed':'failed',JSON.stringify({hp,stillPlaying,after07,hz}));
 await p.click('#pracHands');const hOff=await p.evaluate(()=>window.__rsPR.hands);
 rec('Hands up can be turned off',hOff===false?'passed':'failed','');
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
