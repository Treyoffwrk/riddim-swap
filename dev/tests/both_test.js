/* Move the start, song and dance together: the clip (or a routine's first move) starts earlier or later and the song's
   start moves with it, so every moment of the dance stays on the same part of the song: plain clip, with a speed graph,
   and a routine; the song can't start before its beginning.
   Usage: node both_test.js <page> <clip> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* where the song is at clip moment t of part k (normal playback's own sum) */
 const E=async(pts)=>{const out=[];for(const [k,t] of pts){out.push(await p.evaluate(([k,t])=>new Promise(r=>{const R=window.__rs,v=R.v();R.S.segIdx=k;const done=()=>r(+R.expected().toFixed(3));if(Math.abs(v.currentTime-t)<1e-3)return done();v.addEventListener('seeked',done,{once:true});v.currentTime=t}),[k,t]))}return out};
 const st=()=>p.evaluate(()=>{const R=window.__rs,S=R.S;return {cIn:S.cIn,off:S.offset,main:S.main.offset,rt:S.rt.offset,s0:S.seq[0]&&S.seq[0].s,msg:document.getElementById('bothMsg').textContent,rmsg:document.getElementById('rbothMsg').textContent}});
 const tap=async(sel)=>{await p.evaluate(s=>document.querySelector(s).click(),sel);await p.waitForTimeout(400)};
 const same=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<0.005);
 /* plain clip: starts at 4 s, song at 3 s */
 await p.evaluate(()=>{const R=window.__rs;R.S.main.offset=3;R.S.offset=3;const r=document.getElementById('inRange');r.value=4;r.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForTimeout(400);
 const T=[[0,5],[0,6.5],[0,9]];const e0=await E(T),s0=await st();
 await tap('[data-both="-2"]');const s1=await st(),e1=await E(T);
 rec('Plain clip, −2s: the clip starts 2 s earlier, the song too, and every moment keeps its place in the song',Math.abs(s1.cIn-2)<0.01&&Math.abs(s1.off-1)<0.01&&same(e0,e1)&&/2s earlier/.test(s1.msg)?'passed':'failed',JSON.stringify({s0:[s0.cIn,s0.off],s1:[s1.cIn,s1.off],e0,e1,msg:s1.msg}));
 await tap('[data-both="-2"]');const s2=await st(),e2=await E(T);
 rec('…−2s again: the song can only go back 1 s more (it starts at 0:00), so it moves as far as it can and says so',Math.abs(s2.cIn-1)<0.02&&Math.abs(s2.off)<0.01&&same(e0,e2)&&/as far as it goes/.test(s2.msg)?'passed':'failed',JSON.stringify({s2:[s2.cIn,s2.off],e2,msg:s2.msg}));
 await tap('[data-both="1"]');const s3=await st(),e3=await E(T);
 rec('…+1s: later again, still in place',Math.abs(s3.cIn-2)<0.02&&Math.abs(s3.off-1)<0.02&&same(e0,e3)?'passed':'failed',JSON.stringify({s3:[s3.cIn,s3.off],e3}));
 /* with a speed graph (slow at 3 s, fast at 7 s): the song moves by the music the extra stretch takes */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.curve={on:true,pts:[{t:3,y:-1},{t:7,y:0.5}]};R.S.main.offset=6;R.S.offset=6;const r=document.getElementById('inRange');r.value=4;r.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForTimeout(400);
 const T2=[[0,5],[0,7],[0,9.5]];const g0=await E(T2);
 await tap('[data-both="-2"]');const g1s=await st(),g1=await E(T2);
 rec('With a speed graph, −2s: the song moves by what that stretch takes at its speed (not just 2 s), every moment stays in place',Math.abs(g1s.cIn-2)<0.01&&Math.abs(6-g1s.off-2)>0.3&&g1s.off>0&&same(g0,g1)?'passed':'failed',JSON.stringify({cIn:g1s.cIn,off:g1s.off,g0,g1}));
 /* a graph fitted to the beat (sped up and slowed in places): moving both starts leaves it where it is */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.curve={on:true,pts:[{t:4,y:0,auto:true},{t:5.2,y:0.6},{t:6.1,y:-0.8},{t:7.4,y:0.3},{t:8.6,y:-0.4},{t:12,y:0,auto:true}]};
   R.S.main.offset=8;R.S.offset=8;const r=document.getElementById('inRange');r.value=4;r.dispatchEvent(new Event('input',{bubbles:true}))});await p.waitForTimeout(400);
 const sp=()=>p.evaluate(()=>{const R=window.__rs,g=R.segs()[0],n=R.srcById(R.S.cur);return {curve:JSON.stringify(n.curve.pts.map(q=>[q.t,q.y])),r:[4.5,5.2,5.8,6.1,7,7.4,8,8.6,10].map(t=>+R.rateAt(g,t).toFixed(4)),lead:+R.rateAt(g,Math.max(g.s,3.2)).toFixed(4),at4:+R.rateAt(g,4.01).toFixed(4)}});
 const T4=[[0,4.5],[0,5.5],[0,6.3],[0,7.4],[0,8.8],[0,11]];
 const f0=await E(T4),q0=await sp();
 await tap('[data-both="-1"]');const f1=await E(T4),q1=await sp(),f1s=await st();
 rec('Fitted speed graph, −1s: its points stay on the same moments, every later moment keeps its speed and its place in the song',q1.curve===q0.curve&&JSON.stringify(q1.r)===JSON.stringify(q0.r)&&same(f0,f1)&&Math.abs(f1s.cIn-3)<0.01?'passed':'failed',JSON.stringify({cIn:f1s.cIn,off:f1s.off,f0,f1,r0:q0.r,r1:q1.r}));
 rec('…the added lead-in carries on at the speed the graph had at the old start (no jump)',Math.abs(q1.lead-q1.at4)<0.02?'passed':'failed',JSON.stringify({lead:q1.lead,at4:q1.at4}));
 await tap('[data-both="2"]');const f2s=await st(),q2=await sp();
 await tap('[data-both="-1"]');const f3=await E(T4),q3=await sp(),f3s=await st();
 rec('…+2s (past two of its points) then −1s back: nothing is lost, it is exactly as before',Math.abs(f2s.cIn-5)<0.01&&q2.curve===q0.curve&&q3.curve===q0.curve&&Math.abs(f3s.cIn-4)<0.01&&Math.abs(f3s.off-8)<0.005&&same(f0,f3)?'passed':'failed',JSON.stringify({cIn2:f2s.cIn,cIn3:f3s.cIn,off3:f3s.off,f0,f3}));
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.curve.on=false});
 /* a routine: two moves, the song at 5 s */
 await p.evaluate(()=>{const R=window.__rs,S=R.S;for(const [s,e] of [[3,8],[8,11]]){S.markIn=s;S.markOut=e;S.markSrc=S.cur;S.markThumb='x';document.getElementById('saveMove').disabled=false;document.getElementById('saveMove').click()}});await p.waitForTimeout(500);
 await p.evaluate(()=>{const R=window.__rs,S=R.S;S.moves.forEach(m=>R.addToSeq(m.id));S.rt.offset=5;S.useSeq=true;R.syncSlot&&R.syncSlot()});await p.waitForTimeout(500);
 const ok0=await p.evaluate(()=>window.__rs.routineOn());
 const T3=[[0,4],[0,7],[1,9],[1,10.5]];const r0=await E(T3);const main0=(await st()).main;
 await tap('[data-rboth="-1"]');const r1s=await st(),r1=await E(T3);
 rec('Routine, −1s: its first move starts 1 s earlier, the routine\'s song too, and both moves stay in place',ok0&&Math.abs(r1s.s0-2)<0.01&&Math.abs(r1s.rt-4)<0.01&&Math.abs(r1s.main-main0)<0.001&&same(r0,r1)?'passed':'failed',JSON.stringify({ok0,s0:r1s.s0,rt:r1s.rt,r0,r1,msg:r1s.rmsg}));
 /* an aligned first move (with a warp) keeps its alignment */
 await p.evaluate(()=>{const R=window.__rs,S=R.S,x=S.seq[0];x.warp=[[x.s,0],[4,1.6],[6,3.2],[x.e,5.0]];x.warpR=R.rateOf?R.rateOf(x):S.rt.vr;S.rt.alignOn=true});
 const w0=await E(T3);await tap('[data-rboth="0.5"]');const w1s=await st(),w1=await E([[0,4],[0,7],[1,9],[1,10.5]]);
 rec('Routine with an aligned first move, +½s: it keeps its alignment and everything stays in place',Math.abs(w1s.s0-2.5)<0.01&&same(w0,w1)?'passed':'failed',JSON.stringify({s0:w1s.s0,rt:w1s.rt,w0,w1}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
