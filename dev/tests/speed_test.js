/* Speed graph: shape, playback speed, song sync, recording, saving. Usage: node speed_test.js <page> <video> <song> <shot prefix> */
const {chromium}=require('playwright');
const [,,page,video,song,shot]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(page+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);await p.waitForTimeout(3000);
  await p.click('#t-clip');await p.locator('#spdCard').scrollIntoViewIfNeeded();await p.waitForTimeout(600);
  const st0=await p.evaluate(()=>({on:document.getElementById('spdOn').checked,len:document.getElementById('spdLen').textContent,k:!!window.__rs.segs()[0].k}));
  rec('Speed graph card shows, off by default',!st0.on&&!st0.k?'passed':'failed',JSON.stringify(st0));
  const base=await p.evaluate(()=>{const S=window.__rs.S;return (window.__rs.segs()[0].e-S.cIn)/S.vr});
  /* slow-mo at the playhead */
  await p.evaluate(()=>{window.__rs.v().currentTime=3});await p.waitForTimeout(300);
  await p.click('[data-spd="slowmo"]');await p.waitForTimeout(300);
  const sm=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),c=R.curveOf(n),g=R.segs()[0];
    /* the time map must equal the integral of 1/speed */
    let o=0;const N=4000;for(let i=0;i<N;i++){const a=g.s+(g.e-g.s)*i/N,b2=g.s+(g.e-g.s)*(i+1)/N;o+=(b2-a)/R.spdRateAt(c,(a+b2)/2,g.r)}
    return {pts:c.pts.length,len:R.segLen(g),integral:o,rateAt3:R.spdRateAt(c,3,g.r),rateAt0:R.spdRateAt(c,g.s,g.r),label:document.getElementById('spdLen').textContent}});
  rec('Slow-mo here makes a dip at the playhead and the clip longer',sm.pts>=4&&sm.rateAt3<0.4&&Math.abs(sm.rateAt0-1)<0.01&&sm.len>base+0.3?'passed':'failed',`${base.toFixed(2)} s → ${sm.len.toFixed(2)} s, speed at 3 s ${sm.rateAt3.toFixed(2)}×, label "${sm.label}"`);
  rec('Time map matches the curve',Math.abs(sm.len-sm.integral)<0.01?'passed':'failed',`map ${sm.len.toFixed(4)} s vs integral ${sm.integral.toFixed(4)} s`);
  await p.locator('#spdCard').screenshot({path:shot+'-slowmo.png'});
  /* tap to add a point, then drag it */
  const box=await p.locator('#spdCanvas').boundingBox();
  const geo=await p.evaluate(()=>{const c=document.getElementById('spdCanvas');return {l:44,r:14,t:36,b:22,w:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height}});
  const await_e=await p.evaluate(()=>window.__rs.segs()[0].e);const s0=await p.evaluate(()=>window.__rs.S.cIn);
  const X=t=>box.x+geo.l+(t-s0)/(await_e-s0)*(geo.w-geo.l-geo.r), Yv=y=>box.y+geo.t+(2-y)/4*(geo.h-geo.t-geo.b);
  const tAdd=s0+(await_e-s0)*0.8;
  const n0=sm.pts;await p.mouse.click(X(tAdd),Yv(1));await p.waitForTimeout(300);
  const add=await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur));return {n:c.pts.length,sel:R.SPD.sel,p:c.pts[R.SPD.sel]}});
  rec('Tapping the graph adds a point where you tap',add.n===n0+1&&Math.abs(add.p.t-tAdd)<0.1&&Math.abs(add.p.y-1)<0.1?'passed':'failed',JSON.stringify(add));
  await p.waitForTimeout(500);
  await p.mouse.move(X(tAdd),Yv(1));await p.mouse.down();await p.mouse.move(X(tAdd),Yv(1.6),{steps:6});await p.mouse.up();await p.waitForTimeout(200);
  const drag=await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur));return c.pts[R.SPD.sel]});
  rec('Dragging a point changes its speed',Math.abs(drag.y-1.6)<0.1?'passed':'failed',`speed ${Math.pow(2,drag.y).toFixed(2)}×`);
  /* a handle */
  const hd=await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur)),q=c.pts[R.SPD.sel];return {t:q.t+q.ho[0],y:q.y+q.ho[1]}});
  await p.mouse.move(X(hd.t),Yv(hd.y));await p.mouse.down();await p.mouse.move(X(hd.t),Yv(hd.y-0.8),{steps:6});await p.mouse.up();await p.waitForTimeout(200);
  const hd2=await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur)),q=c.pts[R.SPD.sel];return {auto:q.auto,ho:q.ho,hi:q.hi}});
  rec('Dragging a handle bends the curve, the other handle stays opposite',hd2.auto===false&&hd2.ho[1]<-0.5&&hd2.hi[1]>0?'passed':'failed',JSON.stringify(hd2));
  await p.click('#spdUndo');await p.waitForTimeout(200);
  rec('Undo',await p.evaluate(()=>{const R=window.__rs,c=R.curveOf(R.srcById(R.S.cur));return c.pts.some(q=>q.auto===false)})?'failed':'passed','');
  await p.locator('#spdCard').screenshot({path:shot+'-edit.png'});
  /* playback follows the curve; the song stays in time */
  const samples=await p.evaluate(async()=>{const R=window.__rs,S=R.S;document.getElementById('scrub');R.v().currentTime=S.cIn;S.segIdx=0;await new Promise(r=>setTimeout(r,400));
    document.getElementById('play').click();const out=[];const a=document.getElementById('aud');const t0=performance.now();
    while(performance.now()-t0<6000){await new Promise(r=>setTimeout(r,120));const v=R.v();if(v.paused)continue;const c=R.curveOf(R.srcById(S.cur));
      out.push({t:v.currentTime,rate:v.playbackRate,want:R.spdRateAt(c,v.currentTime,S.vr),song:a.currentTime,exp:S.offset+R.tPos()*S.ar})}
    document.getElementById('play').click();return out});
  const rateErr=samples.map(s=>Math.abs(s.rate-s.want)/s.want).sort((a,b)=>a-b), songErr=samples.slice(5).map(s=>Math.abs(s.song-s.exp)*1000).sort((a,b)=>a-b);
  const med=a=>a[Math.floor(a.length/2)], p90=a=>a[Math.floor(a.length*0.9)];
  const minR=Math.min(...samples.map(s=>s.rate)), maxR=Math.max(...samples.map(s=>s.rate));
  rec('Video speed follows the curve while playing',samples.length>20&&p90(rateErr)<0.06&&minR<0.5?'passed':'failed',`${samples.length} samples, speed ${minR.toFixed(2)}–${maxR.toFixed(2)}×, off by ${(med(rateErr)*100).toFixed(1)}% median, ${(p90(rateErr)*100).toFixed(1)}% at 90%`);
  rec('Song stays in time with the warped clip',songErr.length&&p90(songErr)<80?'passed':'failed',`song vs where it should be: ${med(songErr).toFixed(0)} ms median, ${p90(songErr).toFixed(0)} ms at 90%`);
  /* recording follows the curve */
  const want=await p.evaluate(()=>window.__rs.segLen(window.__rs.segs()[0]));
  await p.click('#recBtn');for(let i=0;i<200&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
  const take=await p.evaluate(async()=>{const tv=document.getElementById('takeVid');for(let i=0;i<40&&!(tv.duration>0&&isFinite(tv.duration));i++)await new Promise(r=>setTimeout(r,200));return {dur:tv.duration,info:document.getElementById('takeInfo').textContent}});
  rec('Recorded take has the curve’s length',Math.abs(take.dur-want)<0.25?'passed':'failed',`take ${take.dur&&take.dur.toFixed(2)} s, curve length ${want.toFixed(2)} s (${take.info})`);
  await p.click('#discardBtn').catch(()=>{});
  /* turning it off */
  await p.click('#spdOn',{force:true});await p.waitForTimeout(200);
  const off=await p.evaluate(()=>({k:!!window.__rs.segs()[0].k,len:window.__rs.segLen(window.__rs.segs()[0])}));
  rec('Switching the graph off plays at normal speed again',!off.k&&Math.abs(off.len-base)<0.01?'passed':'failed',JSON.stringify(off));
  await p.click('#spdOn',{force:true});await p.waitForTimeout(2500);
  await p.reload();await p.waitForTimeout(3500);
  const kept=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),c=n&&R.curveOf(n);return {on:!!c,pts:c&&c.pts.length,k:!!(R.segs()[0]||{}).k}});
  rec('Speed graph is kept after reload',kept.on&&kept.pts===add.n&&kept.k?'passed':'failed',JSON.stringify(kept));
  await p.click('#t-clip');await p.locator('#spdCard').scrollIntoViewIfNeeded();await p.waitForTimeout(500);
  await p.screenshot({path:shot+'-page.png'});
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close();
})();
