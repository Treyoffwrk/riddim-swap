/* Record a take in Riddim Swap, open it in MirrorView, and check the offline cache keeps both pages apart. */
const {launch}=require('./harness');const fs=require('fs');
const [,,HOST,CLIP,SONG]=process.argv;const R=[];const rec=(n,s,d)=>{R.push({name:n,status:s,detail:d});console.log(s.toUpperCase().padEnd(8),n,'—',d)};
(async()=>{
 {const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
  await p.click('#recBtn');for(let i=0;i<160&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
  const tk=await p.evaluate(()=>({info:document.querySelector('#takeInfo').textContent,visible:!document.querySelector('#take').hidden}));
  rec('Riddim Swap records a take',tk.visible?'passed':'failed',tk.info);
  rec('Take panel offers MirrorView',await p.isVisible('#mvTake')?'passed':'failed','');
  const songPos=await p.evaluate(()=>({offset:window.__rs.S.offset,ar:window.__rs.S.ar}));
  await p.click('#mvTake');await p.waitForURL(/mirrorview\//,{timeout:15000});
  let h=null;for(let i=0;i<60;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
  const st=await p.evaluate(()=>{const s=window.__mv.state,v=document.getElementById('reference-source');return {name:s.name,dur:+s.duration.toFixed(2),w:v.videoWidth,h:v.videoHeight}});
  rec('Take opens in MirrorView with its song',h&&h.status==='opened'&&h.kind==='take'&&st.dur>10&&st.w>0?'passed':'failed',JSON.stringify(h)+' '+JSON.stringify(st));
  const pulse=await p.evaluate(async()=>{const op=document.querySelector('[data-music="open"]');op&&op.click();await new Promise(r=>setTimeout(r,800));
   await new Promise(r=>setTimeout(r,1500));if(!window.__mv.music.busy&&!window.__mv.music.analysis)document.getElementById('music-analyse').click();for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(window.__mv.music.analysis&&!window.__mv.music.busy)break}window.__pulseStatus=(document.getElementById('music-analysis-status')||{}).textContent;
   const a=window.__mv.music.analysis;return a?{bpm:a.tempo.bpm,phase:a.tempo.phase,dur:a.duration,alts:a.tempo.alternatives.map(x=>x.bpm),conf:+a.tempo.confidence.toFixed(2)}:{status:window.__pulseStatus}});
  if(pulse&&pulse.bpm){const T=JSON.parse(require('fs').readFileSync('/home/claude/tests/media/dembow100.json'));const per=60/pulse.bpm,grid=[];for(let t=pulse.phase;t<=pulse.dur;t+=per)grid.push(t);for(let t=pulse.phase-per;t>=0;t-=per)grid.unshift(t);
    const truth=T.beats.map(b=>(b-songPos.offset)/songPos.ar).filter(t=>t>=0.3&&t<=pulse.dur-0.3);const off=truth.map(t=>Math.min(...grid.map(g=>Math.abs(g-t))));const hit=off.filter(d=>d<=0.07).length;off.sort((a,b)=>a-b);
    rec('Pulse’s beats on the take sit on the song’s real beats',hit/truth.length>0.9?'passed':'failed',`${hit}/${truth.length} beats within 70 ms, median ${(off[off.length>>1]*1000).toFixed(0)} ms`)}
  rec('Pulse reads the take’s song (dembow 100 BPM test track)',pulse&&pulse.alts&&pulse.alts.some(x=>Math.abs(x-100)<3)?'passed':'failed',JSON.stringify(pulse));
  rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close()}
 /* offline cache with the service worker on */
 {const {b,ctx}=await launch({sw:true});const p=await ctx.newPage();
  await p.goto(HOST);await p.waitForTimeout(2500);await p.reload();await p.waitForTimeout(1500);
  await p.goto(HOST.replace('index.html','')+'mirrorview/');await p.waitForTimeout(2500);
  await p.goto(HOST);await p.waitForTimeout(1500);
  const c=await p.evaluate(async()=>{const ks=await caches.keys();const out={};for(const k of ks){const c=await caches.open(k);for(const r of await c.keys()){if(/\.html$|\/$/.test(r.url)){const t=await (await c.match(r)).text();out[r.url.replace(location.origin,'')]=/<title>[^<]*/.exec(t)[0]}}}return out});
  rec('Offline cache keeps Riddim Swap and MirrorView pages apart',c['/index.html']&&/Riddim/.test(c['/index.html'])&&c['/mirrorview/index.html']&&/MirrorView/.test(c['/mirrorview/index.html'])?'passed':'failed',JSON.stringify(c));
  await ctx.setOffline(true);
  await p.goto(HOST.replace('index.html','')+'mirrorview/').catch(()=>{});await p.waitForTimeout(800);const t1=await p.title();
  await p.goto(HOST).catch(()=>{});await p.waitForTimeout(800);const t2=await p.title();
  rec('Both pages open offline from the cache',/MirrorView/.test(t1)&&/Riddim/.test(t2)?'passed':'failed',`offline: mirrorview → "${t1}", host → "${t2}"`);
  await b.close()}
 fs.writeFileSync('/tmp/claude-0/-home-claude/c7d6fa6b-e9dd-5d62-903e-3e4d46a3b3b0/scratchpad/take-results.json',JSON.stringify(R,null,1));
})();
