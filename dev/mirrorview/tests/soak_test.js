/* A long session, sped up: many plays, loops, trips away from the app, tab swipes, study, the Projects sheet,
   video switches and project re-opens. Watch what piles up. Usage: node soak_test.js <host index.html> <clip> <clip2> <song> <cycles> */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [,,HOST,CLIP,CLIP2,SONG,CYC]=process.argv;const TA='/home/claude/mv/testassets';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info','--js-flags=--expose-gc']});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.18\/(.*)/,async r=>{const rel=r.request().url().split('tasks-vision@0.10.18/')[1].split('?')[0];const f=path.join(TA,'tasks-vision',rel);if(!fs.existsSync(f))return r.fulfill({status:404});r.fulfill({status:200,headers:{'content-type':rel.endsWith('.wasm')?'application/wasm':'text/javascript','access-control-allow-origin':'*'},body:fs.readFileSync(f)})});
  await ctx.route(/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_full\//,r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(TA,'pose_landmarker_full.task'))}));
  await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';
    /* count what a session creates and gives back */
    window.__soak={urls:0,revoked:0,intervals:new Set(),timeouts:0,ctx:0};
    const cu=URL.createObjectURL,ru=URL.revokeObjectURL;URL.createObjectURL=function(x){window.__soak.urls++;return cu.call(URL,x)};URL.revokeObjectURL=function(u){window.__soak.revoked++;return ru.call(URL,u)};
    const si=window.setInterval,ci=window.clearInterval;window.setInterval=function(...a){const id=si.apply(window,a);window.__soak.intervals.add(id);return id};window.clearInterval=function(id){window.__soak.intervals.delete(id);return ci.call(window,id)};
    const AC=window.AudioContext;if(AC){window.AudioContext=function(o){window.__soak.ctx++;return new AC(o)};window.AudioContext.prototype=AC.prototype}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
  await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
  await p.setInputFiles('#vidFile',CLIP2);await p.waitForTimeout(1500);
  await p.evaluate(()=>{const S=window.__rs.S;S.moves.push({id:'m1',src:S.sources[0].id,s:1,e:4,name:'A'});S.seq.push({id:'m1',s:1,e:4,uid:'u1'})});
  const hide=v=>p.evaluate(v=>{Object.defineProperty(document,'hidden',{value:v,configurable:true});Object.defineProperty(document,'visibilityState',{value:v?'hidden':'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))},v);
  const sample=()=>p.evaluate(()=>{try{window.gc&&window.gc()}catch(e){}const s=window.__soak;return {heapMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1),nodes:document.getElementsByTagName('*').length,videos:document.querySelectorAll('video').length,
    canvases:document.querySelectorAll('canvas').length,liveUrls:s.urls-s.revoked,intervals:s.intervals.size,engines:s.ctx,openEngine:!!window.__rs.audioCtx}});
  const N=+CYC||20,rows=[];rows.push({cycle:0,...await sample()});
  for(let c=1;c<=N;c++){
    await p.click('#t-clip').catch(()=>{});
    await p.click('#play');await p.waitForTimeout(2500);await p.click('#play');
    await hide(true);await p.waitForTimeout(3300);await hide(false);await p.waitForTimeout(300);
    await p.click('#studyBtn').catch(()=>{});await p.waitForTimeout(1200);await p.click('#studyBtn').catch(()=>{});
    for(const t of ['t-song','t-tempo','t-moves','t-routine','t-clip'])await p.click('#'+t).catch(()=>{});
    await p.click('#projBtn');await p.waitForTimeout(200);await p.click('#sheetClose');
    await p.evaluate(()=>{const chips=[...document.querySelectorAll('#srcChips .chip-src button:first-child')];chips[chips.length>1?1:0]&&chips[chips.length>1?1:0].click()});await p.waitForTimeout(300);
    await p.evaluate(()=>{const chips=[...document.querySelectorAll('#srcChips .chip-src button:first-child')];chips[0]&&chips[0].click()});await p.waitForTimeout(300);
    if(c%5===0){await p.click('#modeSeq').catch(()=>{});await p.click('#play');await p.waitForTimeout(2000);await p.click('#play');await p.click('#modeClip').catch(()=>{});
      /* re-open the project, as after a restart */
      await p.evaluate(async()=>{const id=localStorage.getItem('rs-proj');});await p.reload();await p.waitForTimeout(3500)}
    rows.push({cycle:c,...await sample()});
  }
  const first=rows[1],last=rows[rows.length-1];
  console.log(JSON.stringify(rows.filter((r,i)=>i%5===0||i===rows.length-1)));
  console.log('GROWTH (cycle 1 → '+N+'):',JSON.stringify(Object.fromEntries(Object.keys(first).filter(k=>typeof first[k]==='number').map(k=>[k,+(last[k]-first[k]).toFixed(1)]))));
  console.log('errors',JSON.stringify(errs.slice(0,3)));
  await b.close()})();
