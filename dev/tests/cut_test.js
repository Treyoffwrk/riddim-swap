/* Clip tab: cut out parts of a single video. Usage: node cut_test.js <host index.html> <clip> <clip hits json> <song> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs');
const [,,HOST,CLIP,HITS,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug-closed');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 await p.click('#t-clip');await p.click('#danceAnalyze');for(let i=0;i<80;i++){if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !!(n&&n.motion)}))break;await p.waitForTimeout(250)}
 await p.locator('#cutCard').scrollIntoViewIfNeeded();await p.waitForTimeout(2500);
 const painted=await p.evaluate(()=>{const c=document.getElementById('cutCanvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=16){if(d[i]+d[i+1]+d[i+2]>200)n++}return n});
 rec('Cut the clip shows the video as a strip of pictures',painted>500?'passed':'failed',painted+' bright pixels');
 const R=()=>p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {pieces:(n.pieces||[]).map(q=>[+q.s.toFixed(2),+q.e.toFixed(2),q.on]),segs:window.__rs.segs().map(g=>[+g.s.toFixed(2),+g.e.toFixed(2)]),sum:document.getElementById('cutSum').textContent}});
 const seek=t=>p.evaluate(t=>{window.__rs.v().currentTime=t},t);
 await seek(3);await p.waitForTimeout(300);await p.click('#cutSplit');await seek(6);await p.waitForTimeout(300);await p.click('#cutSplit');
 /* tap the middle part on the strip (at 4.5 s) */
 const dur=await p.evaluate(()=>window.__rs.v().duration);let box;
 /* scroll the strip into the open part of the screen, below the pinned player and above the section bar */
 const place=async()=>{await p.evaluate(()=>{const c=document.getElementById('cutCanvas'),r=c.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-620)});await p.waitForTimeout(250);box=await p.locator('#cutCanvas').boundingBox();
   const top=await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.id},[box.x+box.width/2,box.y+box.height/2]);if(top!=='cutCanvas')console.log('note: strip covered by',top)};
 const xAt=t=>box.x+t/dur*box.width;await place();
 await place();await p.mouse.click(xAt(4.5),box.y+box.height/2);await p.waitForTimeout(200);await p.click('#cutToggle');await p.waitForTimeout(300);
 let r=await R();
 rec('Split twice and cut the middle: the clip plays as two pieces',r.segs.length===2&&Math.abs(r.segs[0][1]-3)<0.02&&Math.abs(r.segs[1][0]-6)<0.02?'passed':'failed',JSON.stringify(r));
 await p.locator('#cutCard').screenshot({path:SHOT+'-cut.png'});
 /* play from the start: the cut part never shows, the song runs on without a jump */
 await p.evaluate(()=>{window.__rs.v().currentTime=0});await p.click('#play');
 const tr=await p.evaluate(()=>new Promise(res=>{const out=[];const iv=setInterval(()=>{const R=window.__rs;out.push({v:R.v().currentTime,a:document.getElementById('aud').currentTime,src:R.S.cur,w:performance.now()/1000})},40);setTimeout(()=>{clearInterval(iv);res(out)},6500)}));
 await p.click('#play');
 const inCut=tr.filter(s=>s.v>3.08&&s.v<5.92).length, aj=[];for(let i=1;i<tr.length;i++)aj.push((tr[i].a-tr[i-1].a)-(tr[i].w-tr[i-1].w));   /* song step minus real time passed: 0 when it just keeps playing */
 const reached=tr.some(s=>s.v>6.3);
 rec('Playing skips the cut part (never shows 3–6 s) and goes on from 6 s',inCut<=1&&reached?'passed':'failed',`${inCut} samples inside the cut · reached past 6 s: ${reached}`);
 rec('The song keeps going through the cut (no jump back or forward)',Math.max(...aj.map(Math.abs))<0.1?'passed':'failed',`largest difference between song time and real time between samples ${(Math.max(...aj.map(Math.abs))*1000).toFixed(0)} ms`);
 const sc=await p.evaluate(()=>+document.getElementById('scrub').max);
 rec('The play bar covers the kept length (9 s, not 12)',Math.abs(sc-(dur-3))<0.1?'passed':'failed',`scrub length ${sc.toFixed(2)} s of a ${dur.toFixed(2)} s clip`);
 /* drag the edge at 6 s to about 7 s */
 await place();await p.mouse.move(xAt(6),box.y+box.height/2);await p.mouse.down();for(let k=1;k<=8;k++){await p.mouse.move(xAt(6+k/8),box.y+box.height/2);await p.waitForTimeout(20)}await p.mouse.up();await p.waitForTimeout(300);
 r=await R();
 rec('Dragging a white edge moves the cut',Math.abs(r.segs[1][0]-7)<0.15?'passed':'failed',JSON.stringify(r.segs));
 await p.click('#cutUndo');await p.waitForTimeout(300);r=await R();
 rec('Undo puts it back',Math.abs(r.segs[1][0]-6)<0.02?'passed':'failed',JSON.stringify(r.segs));
 /* the dancer's hits for the ball cues follow the cuts */
 const hits=JSON.parse(fs.readFileSync(HITS)).hits;
 const dc=await p.evaluate(()=>window.__rs.dancerEvents().length);const found=await p.evaluate(()=>window.__rs.hitsOf?window.__rs.hitsOf(window.__rs.srcById(window.__rs.S.cur)).filter(h=>h.t<3||h.t>=6).length:null);
 rec('Ball cues use only the hits in the kept parts',found>0&&dc===found?'passed':'failed',`dancer cues ${dc}, hits in kept parts ${found}`);
 /* record a take: it is the kept length */
 await p.evaluate(()=>{window.__rs.v().currentTime=0});await p.click('#recBtn');for(let i=0;i<300&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
 const td=await p.evaluate(async()=>{const tv=document.getElementById('takeVid');for(let i=0;i<40&&!(tv.duration>0&&isFinite(tv.duration));i++)await new Promise(r=>setTimeout(r,200));return tv.duration});
 rec('A recorded take is the kept length',Math.abs(td-(dur-3))<0.4?'passed':'failed',`take ${td.toFixed(2)} s, kept ${(dur-3).toFixed(2)} s`);
 await p.click('#discardBtn').catch(()=>{});
 /* works with the speed graph */
 await p.click('summary >> text=More options');await p.check('#spdOn');await p.click('[data-spd="up"]');await p.waitForTimeout(400);
 r=await R();const k=await p.evaluate(()=>window.__rs.segs().every(g=>!!g.k));
 rec('Cuts and the speed graph work together (each kept piece follows the curve)',r.segs.length===2&&k?'passed':'failed',JSON.stringify(r.segs)+' curve on each: '+k);
 await p.uncheck('#spdOn');
 /* saved with the project */
 await p.waitForTimeout(1500);await p.reload();await p.waitForTimeout(4000);r=await R();
 rec('Cuts are saved with the project',r.segs.length===2&&r.pieces.some(q=>!q[2])?'passed':'failed',JSON.stringify(r));
 await p.click('#t-clip');await p.locator('#cutCard').scrollIntoViewIfNeeded();await p.waitForTimeout(400);
 await p.click('#cutClear');await p.waitForTimeout(300);r=await R();
 rec('Clear all cuts gives the whole clip back',r.segs.length===1?'passed':'failed',JSON.stringify(r.segs));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
