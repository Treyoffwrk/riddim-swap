/* A phone that can't keep the video at full speed (it plays 15% slower than asked): the song must keep playing without
   jumps (on iPhone each jump is a short silence); the video catches up instead.
   Usage: node slow_video_test.js <host index.html> <clip> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{
   /* the video plays at 85% of whatever speed it's given */
   const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'playbackRate');
   Object.defineProperty(HTMLMediaElement.prototype,'playbackRate',{configurable:true,get(){const r=d.get.call(this);return this.tagName==='VIDEO'?r/0.85:r},set(v){d.set.call(this,this.tagName==='VIDEO'?v*0.85:v)}});
   window.__seeks=0;document.addEventListener('seeking',e=>{if(e.target&&e.target.tagName==='AUDIO')window.__seeks++},true);
 });
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 await p.click('#play');await p.waitForTimeout(1500);
 const s0=await p.evaluate(()=>window.__seeks);
 const tr=await p.evaluate(()=>new Promise(res=>{const out=[];const iv=setInterval(()=>{out.push({a:document.getElementById('aud').currentTime,w:performance.now()/1000,paused:document.getElementById('aud').paused,drift:document.getElementById('aud').currentTime-window.__rs.expected()})},50);setTimeout(()=>{clearInterval(iv);res(out)},10000)}));
 const s1=await p.evaluate(()=>window.__seeks);await p.click('#play');
 const steps=[];for(let i=1;i<tr.length;i++)steps.push((tr[i].a-tr[i-1].a)-(tr[i].w-tr[i-1].w));
 const worst=Math.max(...steps.map(Math.abs)), paused=tr.filter(x=>x.paused).length;
 rec('The song never jumps while playing (only the press of play moves it)',s1-s0===0&&worst<0.1&&paused===0?'passed':'failed',`${s1-s0} song jumps in 10 s · largest song step vs real time ${Math.round(worst*1000)} ms · paused samples ${paused}`);
 const dr=tr.slice(-60).map(x=>Math.abs(x.drift)).sort((x,y)=>x-y);
 rec('The video keeps up with the song (catches up when it falls behind)',dr[Math.floor(dr.length*0.9)]<0.45?'passed':'failed',`drift p90 over the last 3 s ${Math.round(dr[Math.floor(dr.length*0.9)]*1000)} ms`);
 const rep=await p.evaluate(()=>document.getElementById('projBtn')&&(document.getElementById('projBtn').click(),new Promise(r=>setTimeout(()=>r(document.getElementById('sndReport').textContent),400))));
 rec('The sound report says the video caught up',/video caught up \d+ time/.test(rep)?'passed':'failed',rep);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
