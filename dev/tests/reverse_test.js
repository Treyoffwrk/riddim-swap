/* Reverse (Clip → Cut the clip): pick a part, tap Reverse; a new copy of the clip plays the part, then the same part
   backwards right after it, then the rest. The skeleton is moved to match (no tracking again), so practice works on it.
   Usage: node reverse_test.js <host index.html> <one-dancer clip> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 const A=4,B=6;
 const dis0=await p.evaluate(()=>document.getElementById('cutRev').disabled);
 /* mark the part: split at its end, then at its start (the part after the second split is picked) */
 const split=async t=>{await p.evaluate(t=>{document.querySelector('#vid').currentTime=t},t);await p.waitForTimeout(400);await p.evaluate(()=>document.getElementById('cutSplit').click());await p.waitForTimeout(200)};
 await split(B);await split(A);
 const dis1=await p.evaluate(()=>document.getElementById('cutRev').disabled);
 rec('Reverse is off until a part is picked, then on',dis0&&!dis1?'passed':'failed',JSON.stringify({dis0,dis1}));
 const old=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {id:n.id,dur:n.el.duration,name:n.name,hits:(n.motion&&n.motion.beats.length)||0}});
 const t0=Date.now();await p.evaluate(()=>document.getElementById('cutRev').click());
 let prog=null;for(let i=0;i<10;i++){await p.waitForTimeout(300);prog=await p.evaluate(()=>({bar:!document.getElementById('cutProg').hidden,msg:document.getElementById('cutRevMsg').textContent}));if(prog.bar)break}
 let made=null;for(let i=0;i<400;i++){await p.waitForTimeout(500);made=await p.evaluate(()=>window.__rsRev||null);if(made)break;if(errs.length)break}
 const secs=((Date.now()-t0)/1000).toFixed(1);made&&(made.rate=await p.evaluate(()=>REV.rate).catch(()=>null));
 rec('While it works it shows progress',prog&&prog.bar&&/Making the reverse/.test(prog.msg)?'passed':'failed',JSON.stringify(prog));
 await p.waitForTimeout(1500);
 const nw=await p.evaluate(()=>{const S=window.__rs.S,n=window.__rs.srcById(S.cur);return {id:n.id,name:n.name,dur:n.el.duration,pieces:n.pieces,sources:S.sources.length,msg:document.getElementById('recMsg').textContent,w:n.el.videoWidth,h:n.el.videoHeight}});
 rec('A new copy of the clip, 2 s longer, is made and shown; the original is kept',made&&nw.id!==old.id&&nw.sources===2&&Math.abs(nw.dur-(old.dur+(B-A)))<0.2&&/reverse/.test(nw.name)&&/still in your videos/.test(nw.msg)?'passed':'failed',JSON.stringify({secs,made,old,nw:{...nw,pieces:undefined}}));
 rec('The strip marks the reversed part right after the picked one',(nw.pieces||[]).some(q=>q.rev&&Math.abs(q.s-B)<0.01&&Math.abs(q.e-(B+B-A))<0.01)&&(nw.pieces||[]).some(q=>!q.rev&&Math.abs(q.s-A)<0.01&&Math.abs(q.e-B)<0.01)?'passed':'failed',JSON.stringify(nw.pieces));
 if(SHOT){await p.evaluate(()=>{document.getElementById('cutCard').scrollIntoView({block:'center'})});await p.waitForTimeout(600);await p.locator('#cutCard').screenshot({path:SHOT+'-strip.png'});await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(300)}
 /* the pictures (read back with ffmpeg, frame-accurate): new at 7.5 is old at 4.5 (backwards), new at 10 is old at 8
    (moved along), new at 3 is old at 3 */
 const fs=require('fs'),cp=require('child_process'),os=require('os'),path=require('path');
 const tmp=path.join(os.tmpdir(),'rv-'+process.pid+'.mp4');
 const b64=await p.evaluate(async()=>{const n=window.__rs.srcById(window.__rs.S.cur);const ab=await (await fetch(n.url)).arrayBuffer();let s='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)});
 fs.writeFileSync(tmp,Buffer.from(b64,'base64'));
 const fr=(f,t)=>cp.execFileSync('ffmpeg',['-v','error','-i',f,'-ss',String(t),'-frames:v','1','-vf','scale=48:84','-f','rawvideo','-pix_fmt','rgb24','-']);
 const mse=(a,b)=>{let s=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];s+=d*d}return s/a.length};
 /* for each moment of the copy, the closest moment of the original within ±0.6 s of where it should come from (frames
    the hidden playback skipped repeat the one before, so up to ~0.15 s early is fine); "plain" is the same moment of the
    original without the reverse, which must match worse */
 const want={3:3,5:5,6.5:5.5,7:5,7.5:4.5,9:7,10:8,12:10},map={};let ok=true;
 for(const [t,e] of Object.entries(want)){const f=fr(tmp,t);let bt=-1,bd=1e9;for(let u=Math.max(0,e-0.6);u<=e+0.6;u+=0.04){const d=mse(f,fr(CLIP,u.toFixed(3)));if(d<bd){bd=d;bt=u}}
   const plain=+t!==e&&+t<15?Math.round(mse(f,fr(CLIP,t))):null;map[t]=[+bt.toFixed(2),Math.round(bd),plain];if(Math.abs(bt-e)>0.16||bd>80||(plain!=null&&plain<bd*2+20))ok=false}
 fs.unlinkSync(tmp);
 rec('The video: the part plays, then backwards right after it, then the rest moved along',ok?'passed':'failed',JSON.stringify(map));
 /* the skeleton moved to match */
 const sk=await p.evaluate(([oid,nid])=>{const S=window.__rs.S,O=S.sources.find(x=>x.id===oid).body,N=S.sources.find(x=>x.id===nid).body;if(!N)return null;
   const d=(t1,t2)=>{const a=RB.poseAt(N,t1),b=RB.poseAt(O,t2);if(!a||!b)return null;let s=0,k=0;for(let j=0;j<33;j++){if(a[j][2]<0.5||b[j][2]<0.5)continue;s+=Math.hypot(a[j][0]-b[j][0],a[j][1]-b[j][1]);k++}return k?+(s/k).toFixed(4):null};
   return {n:N.n,on:O.n,rev:d(7.5,4.5),revWrong:d(7.5,7.5),after:d(10,8),before:d(3,3),mask:!!N.mask===!!O.mask}},[old.id,nw.id]);
 rec('The skeleton comes with it (backwards in the reversed part), no tracking again',sk&&sk.rev!=null&&sk.rev<0.01&&sk.after<0.01&&sk.before<0.01&&sk.revWrong>sk.rev*3&&sk.n>sk.on&&sk.mask?'passed':'failed',JSON.stringify(sk));
 /* hits moved too, and practice targets work on the copy */
 const pr=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {hits:(n.motion&&n.motion.beats.length)||0,targets:window.__rsPrHits().length}});
 rec('Hits come across (the reversed part has its own), and practice has targets',pr.hits>old.hits&&pr.targets>0?'passed':'failed',JSON.stringify({old:old.hits,...pr}));
 /* it plays: through the reversed part with the skeleton drawn */
 await p.evaluate(()=>{document.querySelector('#stage video:not(.off)').currentTime=5.8});await p.waitForTimeout(400);
 await p.click('#play');await p.waitForTimeout(1500);
 const pl=await p.evaluate(()=>({t:document.querySelector('#stage video:not(.off)').currentTime,playing:window.__rs.S.playing}));
 if(SHOT)await p.screenshot({path:SHOT+'-play.png'});
 await p.click('#play');
 rec('The copy plays straight through the reverse',pl.playing&&pl.t>6.8&&pl.t<8.5?'passed':'failed',JSON.stringify(pl));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
