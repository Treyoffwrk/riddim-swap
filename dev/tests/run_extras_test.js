/* Practice extras: progress over time (each run logged per clip, best, streak), Voice (countdown and fixes spoken),
   Save video (you and the dancer side by side with the song, each move's result on screen).
   Usage: node run_extras_test.js <page> <one-dancer clip> <camera.y4m> <song> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const [,,HOST,CLIP,CAM,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({camFile:CAM});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30;window.__said=[];
   const hook=()=>{if(window.speechSynthesis){speechSynthesis.speak=u=>window.__said.push(u.text);speechSynthesis.cancel=()=>{}}};hook();document.addEventListener('DOMContentLoaded',hook)});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(4000);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 /* yesterday was practised too: a streak of 2 after today's run */
 await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');localStorage.setItem('rs-days',JSON.stringify([k]))});
 await p.click('#t-body');
 for(let i=0;i<60;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!!window.__rsPR.rt&&document.getElementById('camVid').videoWidth>0))break}
 await p.click('#pracMode button[data-pm="ghost"]');await p.waitForTimeout(400);
 if(await p.evaluate(()=>window.__rsPR.mirror))await p.click('#pracMirror');
 /* the camera sees the dancer's own pose with the right arm held down */
 await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.hands=false;PR.count=3;PR.rt.detect=()=>{const n=R.srcById(R.S.cur),v=document.querySelector('#stage video:not(.off)');const P=RB.poseAt(n.body,v.currentTime);if(!P)return null;
   const Q=P.map(q=>[q[0],q[1],q[2]]);const sh=Q[12];Q[14]=[sh[0]-0.005,sh[1]+0.11,1];Q[16]=[sh[0]-0.01,sh[1]+0.22,1];return Q};
   R.S.segIdx=0;document.querySelector('#stage video:not(.off)').currentTime=0.05});await p.waitForTimeout(400);
 const pass=async start=>{await start();let shown=false;for(let i=0;i<160;i++){await p.waitForTimeout(250);if(await p.evaluate(()=>!document.getElementById('pracRes').hidden)){shown=true;break}}return shown};
 const ok1=await pass(()=>p.click('#play'));
 const h1=await p.evaluate(()=>({txt:document.getElementById('prHistTxt').textContent,bars:document.querySelectorAll('#prHistBars i').length,said:window.__said.slice()}));
 rec('Voice: the countdown is spoken (3, 2, 1, Go)',ok1&&h1.said.slice(0,4).join(',')==='3,2,1,Go'?'passed':'failed',JSON.stringify(h1.said.slice(0,6)));
 rec('Voice: after a move you got wrong it says the fix',h1.said.some(s=>/right arm/.test(s))?'passed':'failed',JSON.stringify(h1.said));
 rec('Progress: the first run is logged (1 run, best, a 2-day streak with yesterday)',/Best \d+%/.test(h1.txt)&&/1 run\b/.test(h1.txt)&&/2-day streak/.test(h1.txt)&&h1.bars===1?'passed':'failed',JSON.stringify(h1));
 /* run 2, better: the camera now copies the dancer exactly */
 await p.evaluate(()=>{const PR=window.__rsPR,R=window.__rs;PR.count=0;PR.rt.detect=()=>{const n=R.srcById(R.S.cur),v=document.querySelector('#stage video:not(.off)');const P=RB.poseAt(n.body,v.currentTime);return P?P.map(q=>[q[0],q[1],q[2]]):null}});
 const ok2=await pass(()=>p.click('#prAgain'));
 const h2=await p.evaluate(()=>({txt:document.getElementById('prHistTxt').textContent,bars:document.querySelectorAll('#prHistBars i').length,runs:JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('rs-runs:')))||'[]')}));
 rec('Progress: a better second run says "New best!", 2 runs, 2 bars, kept for this clip',ok2&&/New best!/.test(h2.txt)&&/2 runs/.test(h2.txt)&&h2.bars===2&&h2.runs.length===2&&h2.runs[1].score>h2.runs[0].score?'passed':'failed',JSON.stringify({txt:h2.txt,bars:h2.bars,scores:h2.runs.map(r=>r.score)}));
 if(SHOT)await p.screenshot({path:SHOT+'-results.png'});
 /* Save video */
 const t0=Date.now();await p.click('#prSave');
 let take=null;for(let i=0;i<200;i++){await p.waitForTimeout(500);take=await p.evaluate(()=>!document.getElementById('take').hidden);if(take)break}
 const secs=((Date.now()-t0)/1000).toFixed(1);
 const info=await p.evaluate(()=>({info:document.getElementById('takeInfo').textContent,msg:document.getElementById('recMsg').textContent,n:window.__rs.S.recComposeN||0,compose:!!window.__rs.S.recCompose,replay:!!window.__rsPR.replay,vw:document.querySelector('#stage video:not(.off)').videoWidth,vh:document.querySelector('#stage video:not(.off)').videoHeight,mode:window.__lastRecMode}));
 const tmp=path.join(os.tmpdir(),'run-'+process.pid+'.mp4');let probe=null,frames=null;
 if(take){const b64=await p.evaluate(async()=>{const u=document.getElementById('takeVid').src;const ab=await (await fetch(u)).arrayBuffer();let s='';const a=new Uint8Array(ab);for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)});
   fs.writeFileSync(tmp,Buffer.from(b64,'base64'));
   probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height:format=duration','-of','json',tmp]).toString());
   /* left half against the clip at the same moment; right half has a picture (the camera recording), not black */
   const W=probe.streams.find(s=>s.codec_type==='video').width,H=probe.streams.find(s=>s.codec_type==='video').height;
   const fr=(f,t,vf)=>cp.execFileSync('ffmpeg',['-v','error','-ss',String(t),'-i',f,'-frames:v','1','-vf',vf,'-f','rawvideo','-pix_fmt','gray','-']);
   const lw=Math.round(info.vw/info.vh*H/2)*2;
   const L=fr(tmp,6,`crop=${lw}:${H}:0:0,scale=36:64`),C=fr(CLIP,6,'scale=36:64'),Rr=fr(tmp,6,`crop=${W-lw}:${H}:${lw}:0,scale=48:64`);
   let mse=0;for(let i=0;i<L.length;i++){const d=L[i]-C[i];mse+=d*d}mse/=L.length;let mean=0,vr=0;for(const x of Rr)mean+=x;mean/=Rr.length;for(const x of Rr)vr+=(x-mean)**2;vr/=Rr.length;
   frames={W,H,lw,mse:Math.round(mse),rightVar:Math.round(vr)};
   if(SHOT)cp.execFileSync('ffmpeg',['-v','error','-y','-ss','6','-i',tmp,'-frames:v','1',SHOT+'-video.png']);
   fs.unlinkSync(tmp)}
 const dur=probe&&+probe.format.duration,hasA=probe&&probe.streams.some(s=>s.codec_type==='audio');
 rec('Save video: makes a take with the dancer on the left and you on the right, the clip\'s length, with the song',take&&info.n===1&&!info.compose&&!info.replay&&dur>13.5&&dur<16.5&&hasA&&frames.W>frames.H&&frames.mse<900&&frames.rightVar>150?'passed':'failed',JSON.stringify({secs,info,dur,hasA,frames}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
