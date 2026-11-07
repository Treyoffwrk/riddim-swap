/* Learn keeps the song with the moves on a phone whose song player is slow to start: every play of the song only
   begins 350 ms after it is asked (as an iPhone does after a seek). Through 30 s of Learn (loops at 50%, 75%, full speed)
   the song must stay with the video, also right after each loop starts again, without jumps.
   Usage: node learn_sync_test.js <page> <clip> <song> [delay ms] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,DLY]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);const delay=+(DLY||350);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(d=>{const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){if(this.tagName!=='AUDIO'||this.muted)return play.call(this);const el=this;el.__want=true;
     return new Promise(r=>setTimeout(()=>{if(el.__want)play.call(el).then(r,r);else r()},d))};
   const pause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){this.__want=false;return pause.call(this)}},delay);
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug-closed');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 await p.click('#learnBtn');await p.waitForTimeout(200);
 const tr=await p.evaluate(()=>new Promise(res=>{const R=window.__rs,out=[];const a=document.getElementById('aud');const iv=setInterval(()=>{const L=R.learn;
   out.push({t:+R.v().currentTime.toFixed(2),vp:R.v().paused,ap:a.paused,rate:R.S.study&&R.S.study.rate,gap:+((a.currentTime-R.expected())*1000).toFixed(0)})},50);setTimeout(()=>{clearInterval(iv);res(out)},30000)}));
 const snd=await p.evaluate(()=>({jumps:window.__rs.S.snd&&window.__rs.S.snd.jumps,vjumps:window.__rs.S.snd&&window.__rs.S.snd.vjumps,aligned:window.__rs.S.snd&&window.__rs.S.snd.aligned,log:(window.__rs.S.alignLog||[]).slice(-4)}));
 /* while both move: how far apart; and in the 1.5 s after each loop starts again */
 const moving=tr.filter(x=>!x.vp&&!x.ap);const abs=moving.map(x=>Math.abs(x.gap)).sort((a,b)=>a-b);const q=f=>abs[Math.floor(abs.length*f)];
 /* "video plays while the song is silent" = the moves without their music */
 const silent=tr.filter(x=>!x.vp&&x.ap).length*50;
 let restarts=[];for(let k=1;k<tr.length;k++)if(tr[k].t<tr[k-1].t-0.3)restarts.push(k);
 const after=restarts.map(k=>{const w=tr.slice(k,k+30).filter(x=>!x.vp&&!x.ap).map(x=>Math.abs(x.gap));return w.length?Math.max(...w):null});
 rec(`Learn with a song player that starts ${delay} ms late: the song stays with the moves (median under 30 ms, 95% under 80 ms)`,abs.length>200&&q(0.5)<30&&q(0.95)<80?'passed':'failed',JSON.stringify({n:abs.length,median:q(0.5),p95:q(0.95),max:abs[abs.length-1]}));
 rec('…the moves never play without their music (under 0.3 s in 30 s)',silent<300?'passed':'failed',JSON.stringify({silentMs:silent}));
 rec('…right after each loop starts again they are together (worst under 80 ms), with no song jumps',restarts.length>=3&&after.every(x=>x!=null&&x<80)&&!snd.jumps?'passed':'failed',JSON.stringify({restarts:restarts.length,after,snd}));
 /* a clip with its first 2 s cut out: Learn's song must be where normal playback puts it (song = clip time − 2 s) */
 await p.evaluate(()=>{const R=window.__rs;if(R.learn)R.learnOff();if(R.S.playing)document.getElementById('play').click()});await p.waitForTimeout(500);
 await p.evaluate(()=>{const R=window.__rs;R.S.offset=0;R.S.main.offset=0;R.S.ar=R.S.main.ar=1;R.S.vr=R.S.main.vr=1;document.querySelector('#stage video:not(.off)').currentTime=2});await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('cutSplit').click());await p.waitForTimeout(300);
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.pieces[0].on=false});
 const cutOk=await p.evaluate(()=>window.__rs.clipCut());
 await p.click('#learnBtn');await p.waitForTimeout(200);
 const tc=await p.evaluate(()=>new Promise(res=>{const R=window.__rs,out=[],a=document.getElementById('aud');const iv=setInterval(()=>{const v=R.v();if(!v.paused&&!a.paused)out.push({t:v.currentTime,err:+((a.currentTime-(v.currentTime-2))*1000).toFixed(0),c:R.learn&&R.learn.chunks[R.learn.i]})},60);setTimeout(()=>{clearInterval(iv);res(out)},9000)}));
 const ce=tc.map(x=>Math.abs(x.err)).sort((a,b)=>a-b),cq=f=>ce[Math.floor(ce.length*f)];
 const firstA=tc.length&&tc[0].c&&tc[0].c.a;
 rec('A clip with a part cut out: in Learn the song is where normal playback has it (not off by the cut part)',cutOk&&ce.length>50&&cq(0.5)<30&&cq(0.95)<80&&firstA>=1.99?'passed':'failed',JSON.stringify({cutOk,n:ce.length,median:cq(0.5),p95:cq(0.95),firstChunkStart:firstA,sample:tc.slice(5,8).map(x=>[+x.t.toFixed(2),x.err])}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
