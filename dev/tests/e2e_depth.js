/* End-to-end test of beat analysis, dance hits, alignment, fit, sync check and blind test in the real page. */
const {chromium}=require('playwright');const fs=require('fs');
const [,,page,video,song,truthV,truthS,shot]=process.argv;
const TV=JSON.parse(fs.readFileSync(truthV)), TS=JSON.parse(fs.readFileSync(truthS));
function F(est,ref,tol){const used=new Set();let hit=0;for(const r of ref){let bi=-1,bd=1e9;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}
  const p=est.length?hit/est.length:0,r=ref.length?hit/ref.length:0;return p+r?2*p*r/(p+r):0}
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true}); const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto((page.startsWith('http')?page:'file://'+page)+'#debug'); await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()}); await p.reload();
  await p.setInputFiles('#vidFile',video); await p.setInputFiles('#audFile',song);
  for(let i=0;i<40;i++){if(await p.evaluate(()=>!!(window.__rs.S.mainSong&&window.__rs.S.mainSong.an)))break;await p.waitForTimeout(250)}
  const an=await p.evaluate(()=>{const a=window.__rs.S.mainSong.an;return {bpm:a.bpm,beats:a.beats,down:a.downbeats}});
  const beatF=F(an.beats,TS.beats.slice(1),0.07);
  console.log('SONG  detected',an.bpm.toFixed(2),'BPM (true',TS.bpm+') · beat F(±70ms) vs truth',beatF.toFixed(3),'· song card:',await p.textContent('#songDet'));
  console.log('      Song BPM field auto-filled:',await p.inputValue('#sBpm'));
  /* dance hits */
  await p.click('#t-clip'); await p.click('#danceAnalyze');
  for(let i=0;i<80;i++){if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !!(n&&n.motion)}))break;await p.waitForTimeout(250)}
  const mo=await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).motion);
  const hitT=mo.beats.map(x=>x.t), errs2=TV.hits.map(h=>Math.min(...hitT.map(e=>Math.abs(e-h))));
  errs2.sort((a,b)=>a-b);
  console.log('DANCE found',hitT.length,'hits (true',TV.hits.length+') · F(±70ms)',F(hitT,TV.hits,0.07).toFixed(3),'· F(±100ms)',F(hitT,TV.hits,0.1).toFixed(3),'· median error',(errs2[errs2.length>>1]*1000).toFixed(0),'ms · dance BPM',mo.bpm.toFixed(1),'(true 140, hits every 2 beats → 70)');
  console.log('      info:',await p.textContent('#danceInfo'));
  console.log('      warnings:',(await p.locator('#danceWarn li').allTextContents()).join(' | '));
  /* moves + routine */
  const seek=t=>p.evaluate(t=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=t;return new Promise(r=>v.addEventListener('seeked',r,{once:true}))},t);
  await p.click('#t-moves');
  for(const [a,c] of [[0.3,3.0],[3.0,6.5],[6.5,10.5]]){await seek(a);await p.click('#markIn');await seek(c);await p.click('#markOut');await p.click('#saveMove')}
  await p.click('#t-routine'); for(const i of [0,1,2])await p.locator('#tray .tcard').nth(i).click();
  await p.locator('[data-ro="0.1"]').click(); await p.locator('[data-ro="0.1"]').click(); await p.locator('[data-ro="0.1"]').click(); // offset song start so it's not accidentally aligned
  await p.waitForTimeout(300);
  const nums=async()=>({now:await p.textContent('#fitNow'),constant:await p.textContent('#fitConst'),aligned:await p.textContent('#fitAligned'),off:await p.textContent('#fitOff'),err:await p.textContent('#fitNowErr')});
  console.log('FIT   before align:',JSON.stringify(await nums()));
  await p.click('#alignBtn'); await p.waitForTimeout(800);
  console.log('FIT   after align: ',JSON.stringify(await nums()));
  console.log('      message:',await p.textContent('#fitMsg'));
  console.log('      per-move chips:',(await p.locator('#seqList .chipfit:not([hidden])').allTextContents()).join(' '));
  /* play: speed changes inside a move, song steady */
  await p.click('#play'); const log=[];
  for(let k=0;k<20;k++){await p.waitForTimeout(200);log.push(await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));return {r:+v.playbackRate.toFixed(3),a:+document.querySelector('#aud').currentTime.toFixed(2)}}))}
  await p.click('#play');
  const rates=[...new Set(log.map(l=>l.r))]; let back=0;for(let k=1;k<log.length;k++)if(log[k].a<log[k-1].a-0.01)back++;
  console.log('PLAY  video speeds seen while playing:',rates.join(', '),'· song backward jumps:',back);
  await p.screenshot({path:shot});
  fs.writeFileSync(shot.replace('.png','-plan.json'),JSON.stringify(await p.evaluate(()=>{const S=window.__rs.S;return {offset:S.rt.offset,ar:S.rt.ar,alignOn:S.rt.alignOn,seq:S.seq.map(x=>({s:x.s,e:x.e,warp:x.warp,warpR:x.warpR,sp:x.sp})),vr:S.rt.vr,live:{offset:S.offset,vr:S.vr,ar:S.ar,routine:window.__rs.routineOn()},recMode:null}})));
  /* record aligned routine and keep the file */
  await p.evaluate(()=>window.__recLog=[]);
  await p.click('#recBtn');
  for(let i=0;i<120&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.click('#saveBtn')]);
  if(dl)await dl.saveAs(shot.replace('.png','-take.mp4'));
  fs.writeFileSync(shot.replace('.png','-reclog.json'),JSON.stringify(await p.evaluate(()=>({log:window.__recLog,segs:window.__rs.segs().map(g=>({s:g.s,e:g.e,k:g.k||null}))}))));
  console.log('REC   mode used:',await p.evaluate(()=>window.__lastRecMode||'?'));
  await p.waitForTimeout(1500); console.log('REC   self-check:',JSON.stringify(await p.evaluate(()=>window.__rs.lastVerify||null)));
  console.log('REC   take:',await p.textContent('#takeInfo'),dl?'saved':'not saved');
  /* sync check */
  await p.click('#syncBtn'); await p.waitForTimeout(9500); console.log('SYNC1',(await p.textContent('#syncOut')).slice(0,90)); const fx=p.locator('#syncOut button',{hasText:'Correct for this phone'}); if(await fx.count()){await fx.click(); await p.click('#syncBtn'); await p.waitForTimeout(9500);}
  console.log('SYNC ',(await p.textContent('#syncOut')).slice(0,240));
  /* blind test */
  await p.click('#blindBtn');
  for(let i=0;i<200;i++){if(await p.locator('#blindBox select').count())break;await p.waitForTimeout(300)}
  const sel=p.locator('#blindBox select');
  const key=await p.evaluate(()=>window.__rs.S.blind.key);
  const rate=v=>v==='aligned'?'5':v==='constant'?'4':'1';
  for(const name of ['Kez','Jo']){await p.fill('#blindBox input[type=text]',name);for(const [i,L] of ['A','B','C'].entries())await sel.nth(i).selectOption(rate(key[L]));await p.locator('#blindBox button',{hasText:'Add rating'}).click()}
  await p.locator('#blindBox button',{hasText:'Reveal answers'}).click();
  console.log('BLIND takes:',await p.locator('#blindBox .takes button:not([disabled])').count()/2,'· key',JSON.stringify(key));
  console.log('      verdict:',(await p.locator('#blindBox p.hint').last().textContent()));
  /* persistence of motion + alignment */
  await p.waitForTimeout(3200); await p.reload(); await p.waitForTimeout(2500); await p.click('#t-routine'); await p.waitForTimeout(300);
  console.log('SAVE  after reload:',JSON.stringify(await nums()),'· blind ratings kept:',await p.evaluate(()=>window.__rs.S.blind&&window.__rs.S.blind.ratings.length));
  console.log('errors',errs);
  await b.close();
})();
