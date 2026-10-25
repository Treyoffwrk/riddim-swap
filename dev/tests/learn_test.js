/* Learn mode: the clip in 8-counts, each looped slow → full speed, put together, then the next.
   Usage: node learn_test.js <host index.html> <clip> <song> <shot prefix> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug-closed');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 /* no song yet: still splits (by the dancer's hits or tempo) */
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const noSong=await p.evaluate(()=>{const r=window.__rs.learnChunks();return {n:r.chunks.length,how:r.how}});
 rec('Without a song it still splits the clip (dancer\'s hits or tempo)',noSong.n>=2&&noSong.how!=='song'?'passed':'failed',JSON.stringify(noSong));
 await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* 1. the split: 8 beats each, starting on the 1 */
 const sp=await p.evaluate(()=>{const R=window.__rs,S=R.S,r=R.learnChunks(),down=(R.liveGrid()||{}).down||[];
   const toSong=t=>S.offset+((t-S.cIn)/S.vr+(S.avComp||0))*S.ar;
   const inner=r.chunks.slice(1).map(c=>toSong(c.a));const offDown=inner.map(s=>Math.min(...down.map(d=>Math.abs(d-s)))*1000);
   return {how:r.how,n:r.chunks.length,beats:r.chunks.map(c=>c.beats.length),lens:r.chunks.map(c=>+(c.b-c.a).toFixed(2)),offDownMs:offDown.map(x=>Math.round(x)),dur:+R.v().duration.toFixed(2),first:r.chunks[0].a,last:r.chunks[r.chunks.length-1].b}});
 const innerOk=sp.beats.slice(0,-1).every(k=>k===8)&&sp.beats[sp.beats.length-1]>=8&&sp.beats[sp.beats.length-1]<12+1&&sp.offDownMs.length>0&&sp.offDownMs.every(x=>x<15);
 rec('The clip is split into 8-counts (8 beats each, each starting on a 1) that cover the clip',sp.how==='song'&&sp.n>=2&&innerOk&&sp.first<=0.01&&Math.abs(sp.last-sp.dur)<0.05?'passed':'failed',JSON.stringify(sp));
 /* 2. turn it on: bar, chips, 50% speed, pitch kept */
 await p.evaluate(()=>{const o={per:1};localStorage.setItem('rs-learn-opts',JSON.stringify(o))});
 await p.click('#learnBtn');await p.waitForTimeout(1500);
 const on=await p.evaluate(()=>{const R=window.__rs,L=R.learn,a=document.getElementById('aud');return {bar:!document.getElementById('learnBar').hidden,chips:document.querySelectorAll('#learnChips button').length,i:L&&L.i,rate:R.S.study&&R.S.study.rate,vRate:+R.v().playbackRate.toFixed(3),vr:R.S.vr,aRate:+a.playbackRate.toFixed(3),ar:R.S.ar,pitch:a.preservesPitch,playing:R.S.playing,what:document.getElementById('learnWhat').textContent,speed:document.getElementById('learnSpeed').textContent,tag:document.getElementById('learnTag').textContent}});
 rec('Learn starts on 8-count 1 at 50%: video and song both at half speed, song pitch kept',on.bar&&on.chips===sp.n&&on.i===0&&on.rate===0.5&&Math.abs(on.vRate-on.vr*0.5)<0.01&&Math.abs(on.aRate-on.ar*0.5)<0.01&&on.pitch&&on.playing?'passed':'failed',JSON.stringify(on));
 await p.screenshot({path:SHOT+'-phone.png',fullPage:false});
 /* 3. while it plays: stays inside the 8-count, song in time, the 1-8 count runs */
 const tr=await p.evaluate(()=>new Promise(res=>{const R=window.__rs,out=[];const iv=setInterval(()=>{const L=R.learn;out.push({t:R.v().currentTime,a:L&&L.chunks[L.i].a,b:L&&L.chunks[L.i].b,step:L&&L.step,i:L&&L.i,k:R.learnCount(),gap:document.getElementById('aud').currentTime-R.expected(),lit:[...document.querySelectorAll('#learnCount i')].findIndex(e=>e.classList.contains('on'))+1})},60);setTimeout(()=>{clearInterval(iv);res(out)},4500)}));
 const st0=tr.filter(x=>x.step===0), outside=st0.filter(x=>x.t<x.a-0.05||x.t>x.b+0.05).length, ks=[...new Set(st0.map(x=>x.k))], gaps=st0.slice(10).map(x=>Math.abs(x.gap)).sort((x,y)=>x-y), litOk=st0.filter(x=>x.lit===x.k).length/st0.length;
 rec('At 50% it stays inside the 8-count and the song stays in time',outside===0&&gaps[Math.floor(gaps.length*0.9)]<0.08?'passed':'failed',`${outside} samples outside · song gap p90 ${Math.round(gaps[Math.floor(gaps.length*0.9)]*1000)} ms`);
 rec('The 1-8 count lights up in order as it plays',ks.length>=4&&ks.every((k,j)=>j===0||k>ks[j-1])&&litOk>0.9?'passed':'failed',`counts seen ${ks.join(',')} · lit matches ${Math.round(litOk*100)}%`);
 /* 4. a real loop round: it moves up to 75% (1 loop per speed) */
 let up=null;for(let i=0;i<60;i++){await p.waitForTimeout(250);up=await p.evaluate(()=>{const R=window.__rs,L=R.learn;return {step:L.step,rate:R.S.study.rate,vRate:+R.v().playbackRate.toFixed(3),aRate:+document.getElementById('aud').playbackRate.toFixed(3),t:R.v().currentTime,a:L.chunks[L.i].a}});if(up.step===1)break}
 await p.waitForTimeout(600);const up2=await p.evaluate(()=>{const R=window.__rs;return {vRate:+R.v().playbackRate.toFixed(3),aRate:+document.getElementById('aud').playbackRate.toFixed(3),speed:document.getElementById('learnSpeed').textContent}});
 rec('When the loop comes round it goes up to 75% (video and song; the video may be nudged up to 6% to stay in sync)',up.step===1&&up.rate===0.75&&Math.abs(up2.vRate-on.vr*0.75)<on.vr*0.75*0.065&&Math.abs(up2.aRate-on.ar*0.75)<0.01&&up2.speed==='75%'?'passed':'failed',JSON.stringify({up,up2}));
 /* 5. the rest of the ladder (driven directly): 100%, then on to 8-count 2; after 2 at full speed, "put together" 1-2 */
 const lad=await p.evaluate(()=>{const R=window.__rs,L=()=>R.learn,seq=[];const snap=()=>({i:L().i,phase:L().phase,rate:R.S.study.rate,a:+R.S.study.a.toFixed(2),b:+R.S.study.b.toFixed(2),done:[...L().done]});
   for(let k=0;k<5;k++){R.learnLoopDone();seq.push(snap())}return seq});
 const L0=lad.map(x=>`${x.i+1}:${x.phase}@${x.rate}`).join(' → ');
 const ok5=lad[0].rate===1&&lad[0].i===0&&lad[1].i===1&&lad[1].rate===0.5&&lad[1].done.includes(0)&&lad[3].rate===1&&lad[4].phase==='together'&&lad[4].i===1&&Math.abs(lad[4].a-sp.first)<0.05;
 rec('Ladder: 100%, then 8-count 2 from 50%; after it, both put together from the top at full speed',ok5?'passed':'failed',L0+' · '+JSON.stringify(lad[4]));
 /* 6. buttons */
 const btn=async id=>{await p.click(id);await p.waitForTimeout(500);return p.evaluate(()=>{const R=window.__rs,L=R.learn;return L?{i:L.i,phase:L.phase,rate:R.S.study.rate,t:+R.v().currentTime.toFixed(2),a:+L.chunks[L.i].a.toFixed(2)}:null})};
 await p.locator('#learnBar').scrollIntoViewIfNeeded();
 const bBack=await btn('#lnPrev'), bNext=await btn('#lnNext'), bSlow=await btn('#lnSlow');
 await p.click('#learnChips button >> nth=0');await p.waitForTimeout(500);const bChip=await p.evaluate(()=>window.__rs.learn.i);
 rec('Back, Next, Slower and tapping a number work',bBack.i===0&&bNext.i===1&&bNext.rate===0.5&&Math.abs(bNext.t-bNext.a)<0.3&&bSlow.rate===0.5&&bChip===0?'passed':'failed',JSON.stringify({bBack,bNext,bSlow,bChip}));
 /* 7. progress is kept: done 8-counts show, and it comes back on the same 8-count */
 await p.click('#learnChips button >> nth=1');await p.waitForTimeout(400);
 const doneShown=await p.evaluate(()=>document.querySelector('#learnChips button').classList.contains('done'));
 await p.reload();await p.waitForTimeout(4500);await p.click('#learnBtn');await p.waitForTimeout(1200);
 const back=await p.evaluate(()=>{const L=window.__rs.learn;return L&&{i:L.i,done:[...L.done]}});
 rec('Progress is kept: learnt 8-counts are marked, and after a reload it carries on where you were',doneShown&&back&&back.i===1&&back.done.includes(0)?'passed':'failed',JSON.stringify({doneShown,back}));
 await p.locator('#learnBar').screenshot({path:SHOT+'-bar.png'});
 /* 7b. Repeat during Learn: shows your own setting, and tapping it doesn't stop Learn looping */
 const rp=await p.evaluate(async()=>{const r=document.getElementById('repeat'),R=window.__rs,b0=r.getAttribute('aria-pressed');r.click();await new Promise(x=>setTimeout(x,200));const b1=r.getAttribute('aria-pressed'),loop=R.S.loop;r.click();await new Promise(x=>setTimeout(x,200));return {b0,b1,loop,back:r.getAttribute('aria-pressed')}});
 rec('Repeat shows your own setting during Learn, and tapping it keeps Learn looping',rp.b0==='false'&&rp.b1==='true'&&rp.loop===true&&rp.back==='false'?'passed':'failed',JSON.stringify(rp));
 /* 8. Study ends Learn and starts Study; Learn button ends it */
 await p.click('#studyBtn');await p.waitForTimeout(600);
 const sw=await p.evaluate(()=>({learn:!!window.__rs.learn,study:!!window.__rs.S.study,bar:!document.getElementById('learnBar').hidden,pressed:document.getElementById('studyBtn').getAttribute('aria-pressed')}));
 await p.click('#studyBtn');await p.waitForTimeout(400);
 await p.click('#learnBtn');await p.waitForTimeout(800);await p.click('#learnBtn');await p.waitForTimeout(600);
 const off=await p.evaluate(()=>({learn:!!window.__rs.learn,study:!!window.__rs.S.study,bar:!document.getElementById('learnBar').hidden,loop:window.__rs.S.loop,pitch:document.getElementById('aud').preservesPitch}));
 rec('Study takes over from Learn; tapping Learn again turns it off and puts things back',!sw.learn&&sw.study&&!sw.bar&&sw.pressed==='true'&&!off.learn&&!off.study&&!off.bar&&off.loop===false&&!off.pitch?'passed':'failed',JSON.stringify({sw,off}));
 /* 9. Record ends Learn */
 await p.click('#learnBtn');await p.waitForTimeout(800);await p.click('#recBtn');await p.waitForTimeout(1500);
 const rc=await p.evaluate(()=>({learn:!!window.__rs.learn,rec:!!window.__rs.S.rec}));
 await p.click('#recBtn').catch(()=>{});await p.waitForTimeout(1500);await p.click('#discardBtn').catch(()=>{});
 rec('Recording turns Learn off (a take records the clip as normal)',!rc.learn?'passed':'failed',JSON.stringify(rc));
 /* 10. layout: the row of buttons fits a phone */
 const lay=await p.evaluate(()=>{const r=document.querySelector('.recrow'),bs=[...r.querySelectorAll('button:not([hidden])')].filter(b=>b.offsetParent);return {w:r.getBoundingClientRect().width,right:Math.max(...bs.map(b=>b.getBoundingClientRect().right)),pageW:document.documentElement.scrollWidth,vw:innerWidth}});
 rec('On a phone the Repeat / Study / Learn / Record row fits, no sideways scrolling',lay.right<=lay.vw-8&&lay.pageW<=lay.vw?'passed':'failed',JSON.stringify(lay));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
