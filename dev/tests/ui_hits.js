/* UI test: hits per move setting, mark hits yourself, remove a hit, undo, best speed suggestion */
const {chromium}=require('playwright');const fs=require('fs');
const [,,url,video,song,truthV,shot]=process.argv;const TV=JSON.parse(fs.readFileSync(truthV)).hits;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
const num=t=>+t.trim().split(' ')[0];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
 const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(url+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',video);await p.setInputFiles('#audFile',song);
 for(let i=0;i<40;i++){if(await p.evaluate(()=>!!(window.__rs.S.mainSong&&window.__rs.S.mainSong.an)))break;await p.waitForTimeout(250)}
 await p.click('#danceAnalyze');for(let i=0;i<80;i++){if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !!(n&&n.motion)}))break;await p.waitForTimeout(250)}
 const info=()=>p.textContent('#danceInfo');
 /* plant a double: a weaker stop 0.2 s after each real hit (feet land, arms hit) */
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.motion.beats=n.motion.beats.concat(n.motion.beats.map(b=>({t:+(b.t+0.2).toFixed(3),w:b.w*0.6}))).sort((a,b)=>a.t-b.t)});
 await p.click('#hitLevel [data-hl="more"]'); const nMore=num(await info());
 await p.click('#hitLevel [data-hl="normal"]'); const nNorm=num(await info());
 ok(nMore>=2*nNorm-2&&nNorm<=TV.length+1,`doubles 0.2 s apart merge into one per move: More shows ${nMore}, Normal shows ${nNorm} (true ${TV.length})`);
 /* speed suggestion (Tempo tab) */
 await p.click('#t-tempo');
 const sug=await p.locator('#speedSug button').allTextContents(); ok(sug.length>0,'best speed suggestions shown: '+sug.join(' | '));
 const fitBefore=await p.textContent('#clipFit');
 if(sug.length){await p.locator('#speedSug button').first().click();await p.waitForTimeout(600)}
 const fitAfter=await p.textContent('#clipFit'), vr=await p.evaluate(()=>window.__rs.S.vr);
 const pct=t=>+((t.match(/(\d+)%/)||[0,0])[1]);
 ok(pct(fitAfter)>pct(fitBefore),`using it raises the clip's beat fit: "${fitBefore}" -> "${fitAfter}" (speed ${vr})`);
 /* remove a hit by tapping its tick */
 await p.click('#t-clip');
 const before=num(await info());
 const tHit=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return n.motion.beats.find(b=>b.t>3&&b.w>0.5).t});
 const box=await p.locator('#hitStrip').boundingBox(); const dur=await p.evaluate(()=>document.querySelector('#stage video').duration);
 await p.mouse.click(box.x+tHit/dur*box.width,box.y+box.height/2); await p.waitForTimeout(200);
 const after=num(await info());
 ok(after===before-1,`tapping a tick removes that hit (${before} -> ${after}): ${await p.textContent('#hitCheckMsg')}`);
 await p.click('#hitUndo'); ok(num(await info())===before,'Undo brings it back');
 /* mark hits yourself over the first ~6 s, tapping at the true hit times */
 await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=0});await p.waitForTimeout(300);
 await p.click('#hitMark'); await p.waitForTimeout(200);
 ok(await p.isVisible('#hitTap'),'Mark mode shows a big Hit button and starts playing');
 const T=TV.filter(t=>t>0.4&&t<6.2), rate=await p.evaluate(()=>window.__rs.S.vr);
 await p.evaluate(T=>new Promise(res=>{const v=()=>[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));const btn=document.querySelector('#hitTap');let k=0;
   const iv=setInterval(()=>{if(k<T.length&&v().currentTime>=T[k]+0.03*v().playbackRate){btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));k++}if(k>=T.length||v().paused&&k>0&&v().currentTime>T[T.length-1]){clearInterval(iv);setTimeout(res,300)}},4)}),T);
 await p.click('#hitMark');
 const res=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return n.motion.beats.filter(b=>b.mine).map(b=>b.t)});
 const errMs=res.map((t,i)=>Math.abs(t-T[i])*1000);
 ok(res.length===T.length&&Math.max(...errMs)<40,`your ${res.length} taps become the hits (largest timing error ${Math.round(Math.max(...errMs))} ms, clip speed ${rate}): ${await p.textContent('#hitCheckMsg')}`);
 const inRange=await p.evaluate(([a,z])=>window.__rs.srcById(window.__rs.S.cur).motion.beats.filter(b=>!b.mine&&b.t>a&&b.t<z).length,[T[0],T[T.length-1]]);
 ok(inRange===0,'detected hits in the part you marked are replaced');
 await p.waitForTimeout(3500);await p.reload();await p.waitForTimeout(3000);
 ok(await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).motion.beats.filter(b=>b.mine).length)===T.length,'marked hits survive a reload');
 ok(errs.length===0,'no page errors '+JSON.stringify(errs));
 await p.click('#t-clip'); await p.waitForTimeout(300); await p.locator('#danceCard').screenshot({path:shot});
 await b.close()})();
