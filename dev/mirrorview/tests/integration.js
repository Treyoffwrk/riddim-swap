/* Riddim Swap (host) + MirrorView route: entry, return, clip hand-off, media retention, failed replacement,
   real pose preparation and Pulse on a real clip. Usage: node integration.js <host url> <clip.webm> <song.wav> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;
const R=[];const rec=(name,status,detail)=>{R.push({name,status,detail});console.log(status.toUpperCase().padEnd(8),name,'—',detail)};
(async()=>{
 const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');localStorage.clear()});await p.reload();
 /* host baseline: entry visible only in the installed app */
 rec('Host shows MirrorView entry (Body tab)',await p.isVisible('#t-body')?'passed':'failed','Body tab visible in the hosted build');
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);
 for(let i=0;i<40;i++){if(await p.evaluate(()=>!!(window.__rs.S.mainSong&&window.__rs.S.mainSong.an)))break;await p.waitForTimeout(250)}
 await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=4.2});await p.waitForTimeout(400);
 await p.click('#t-moves');await p.click('#markIn');await p.evaluate(()=>{const v=[...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'));v.currentTime=6.0});await p.waitForTimeout(300);await p.click('#markOut');await p.click('#saveMove');
 const before=await p.evaluate(()=>({moves:document.querySelectorAll('#tray .tcard').length,song:window.__rs.S.mainSong.name,bpm:window.__rs.S.sBase}));
 /* plain entry and return */
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});await p.waitForTimeout(1500);
 const mvOk=await p.evaluate(()=>({v:(document.querySelector('.brand small')||{}).textContent,back:!!document.getElementById('rs-back')}));
 rec('Entry opens MirrorView 0.13',mvOk.v==='0.13'&&mvOk.back?'passed':'failed',JSON.stringify(mvOk));
 await p.click('#rs-back');await p.waitForURL(u=>!/mirrorview/.test(u.toString()),{timeout:15000});await p.waitForTimeout(2500);
 const after=await p.evaluate(()=>({moves:document.querySelectorAll('#tray .tcard').length,song:window.__rs&&window.__rs.S.mainSong&&window.__rs.S.mainSong.name,bpm:window.__rs&&window.__rs.S.sBase,hasV:window.__rs&&window.__rs.S.hasV}));
 rec('Return keeps the Riddim Swap project',after.moves===before.moves&&after.song===before.song&&after.hasV?'passed':'failed','before '+JSON.stringify(before)+' after '+JSON.stringify(after));
 /* clip hand-off */
 await p.click('#t-clip');await p.click('#mvClip');await p.waitForURL(/mirrorview\//,{timeout:15000});

 let h=null;for(let i=0;i<60;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 const mvState=()=>p.evaluate(()=>{const s=window.__mv&&window.__mv.state,v=document.getElementById('reference-source');return s?{name:s.name,dur:+(s.duration||0).toFixed(2),demo:s.demo,src:v.src.slice(0,40),t:+v.currentTime.toFixed(2),rs:v.readyState,w:v.videoWidth,muted:v.muted}:null});
 let st=await mvState();
 const cleared=await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('riddim-bridge',1);q.onsuccess=()=>{const t=q.result.transaction('handoff','readonly').objectStore('handoff').getAllKeys();t.onsuccess=()=>r(t.result.filter(k=>!/^(song|you)-current$/.test(k)).length)};q.onerror=()=>r(-1)}));
 rec('Clip hand-off opens the real clip in MirrorView',h&&h.status==='opened'&&st&&!st.demo&&st.dur>14&&st.w>0?'passed':'failed','handoff '+JSON.stringify(h)+' state '+JSON.stringify(st)+' url '+p.url().replace(HOST,''));
 rec('Hand-off record removed and address cleaned (the song and My video kept for the clip are separate)',cleared===0&&!/handoff=/.test(p.url())?'passed':'failed','records left '+cleared+' · url '+p.url().replace(HOST,''));
 /* play with original audio, seek */
 await p.evaluate(()=>window.__mv.setPlaying(true));await p.waitForTimeout(1500);
 const pl=await mvState();
 await p.evaluate(()=>window.__mv.setPlaying(false));await p.evaluate(()=>window.__mv.seek(9.5));await p.waitForTimeout(500);
 const sk=await mvState();
 rec('Plays and seeks the reference',pl.t>0.8&&Math.abs(sk.t-9.5)<0.1?'passed':'failed','after 1.5 s play t='+pl.t+' (muted='+pl.muted+'), after seek t='+sk.t);
 /* output/view changes keep media identity and playhead */
 const id0=await p.evaluate(()=>{const v=document.getElementById('reference-source');window.__refEl=v;return v.src});
 for(const mode of ['split','practice','worldline','split']){await p.evaluate(m=>{try{const b=document.querySelector(`[data-action="${m==='split'?'studio':m}"]`);b&&b.click()}catch(e){}},mode);await p.waitForTimeout(250)}
 for(const d of ['skeleton','both','video'])await p.evaluate(d=>{const s=window.__mv.state;s.refDisplay=d},d);
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(400);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(400);
 const keep=await p.evaluate(src=>{const v=document.getElementById('reference-source');return {same:v===window.__refEl&&v.src===src,t:+v.currentTime.toFixed(2),name:window.__mv.state.name}},id0);
 rec('View/rotation changes keep the same video and playhead',keep.same&&Math.abs(keep.t-9.5)<0.15?'passed':'failed',JSON.stringify(keep));
 /* failed replacement keeps the current reference */
 const bad=await p.evaluate(async()=>{const f=new File([new Uint8Array(4096).map((_,i)=>i*7)],'broken.mp4',{type:'video/mp4'});let err=null;try{await window.__mv.importFile(f)}catch(e){err=e.message}
   await new Promise(r=>setTimeout(r,2500));const v=document.getElementById('reference-source');return {err,name:window.__mv.state.name,src:v.src.slice(0,40),w:v.videoWidth}});
 rec('Failed replacement keeps the current clip',bad.name===st.name&&bad.w>0?'passed':'failed',JSON.stringify(bad));
 /* real pose preparation (MediaPipe 0.10.18 lite; test copies of the same files) */
 const t0=Date.now();
 await p.evaluate(()=>{const s=window.__mv.state;s.a=2;s.b=6;});
 await p.evaluate(()=>document.querySelector('[data-action="analyse-reference"]').click());
 let ps=null;for(let i=0;i<1400;i++){await p.waitForTimeout(500);ps=await p.evaluate(()=>{const s=window.__mv.state;const f=s.poseSamples||[];return {busy:s.busy,n:f.length,withPose:f.filter(x=>x.points).length,t0:f[0]&&+f[0].t.toFixed(2),t1:f.length&&+f.at(-1).t.toFixed(2)}});if(!ps.busy&&ps.n>0)break;if(!ps.busy&&i>20)break}
 if(!ps.n)console.log('DIAG',JSON.stringify(await p.evaluate(()=>({msg:(document.getElementById('pose-message')||{}).textContent,analysis:window.__mv.state.referenceAnalysis,toast:(document.querySelector('.toast,#toast')||{}).textContent,refPose:window.__mv.state.refPose}))));
 const secs=(Date.now()-t0)/1000;
 rec('Real pose preparation on the real clip',ps.withPose>0.8*ps.n&&ps.n>10?'passed':'failed',`${ps.withPose}/${ps.n} frames with a skeleton, range ${ps.t0}–${ps.t1} s, ${secs.toFixed(0)} s in software rendering (not phone speed)`);
 const land=await p.evaluate(()=>{const f=window.__mv.state.poseSamples.find(x=>x.points);if(!f)return null;const P=f.points;const ok=P.filter(q=>q&&q.x>0&&q.x<1&&q.y>0&&q.y<1).length;return {t:f.t,points:P.length,inFrame:ok,nose:P[0]&&[+P[0].x.toFixed(2),+P[0].y.toFixed(2)],ankle:P[27]&&[+P[27].x.toFixed(2),+P[27].y.toFixed(2)]}});
 rec('Landmarks sit on the dancer (sanity)',land&&land.inFrame>=25&&land.nose[1]<land.ankle[1]?'passed':'failed',JSON.stringify(land));
 await p.screenshot({path:SHOT+'-pose.png'});
 /* Pulse on the clip's own audio */
 const t1=Date.now();
 const pulse=await p.evaluate(async()=>{const m=window.__mv.music;if(!m)return {err:'no music workspace'};
   const op=document.querySelector('[data-music="open"]');if(op)op.click();await new Promise(r=>setTimeout(r,600));
   const btn=document.getElementById('music-analyse')||document.querySelector('[data-music="prepare"]');if(btn){btn.click()}else return {err:'no prepare button'};
   for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,500));const a=m.analysis;if(a&&a.tempo)return {status:document.getElementById('music-analysis-status').textContent.slice(0,120),bpm:a.tempo.bpm,alts:a.tempo.alternatives.map(x=>x.bpm),confidence:+a.tempo.confidence.toFixed(2)}}
   return {status:'timeout: '+(document.getElementById('music-analysis-status')||{}).textContent}});
 rec('Pulse prepares from the clip audio',pulse.bpm>0?'passed':'failed',JSON.stringify(pulse)+` (${((Date.now()-t1)/1000).toFixed(0)} s) · librosa 129, Riddim Swap 126.2 on the same audio`);
 await p.screenshot({path:SHOT+'-pulse.png'});
 /* back to the host again */
 await p.click('#rs-back').catch(async()=>{await p.evaluate(()=>document.getElementById('rs-back').click())});await p.waitForURL(u=>!/mirrorview/.test(u.toString()),{timeout:15000});await p.waitForTimeout(2500);
 const after2=await p.evaluate(()=>({moves:document.querySelectorAll('#tray .tcard').length,hasV:!!(window.__rs&&window.__rs.S.hasV)}));
 rec('Second return keeps the project',after2.moves===before.moves&&after2.hasV?'passed':'failed',JSON.stringify(after2));
 rec('No page errors in either app',errs.length===0?'passed':'failed',JSON.stringify(errs.slice(0,5)));
 require('fs').writeFileSync(SHOT+'-results.json',JSON.stringify(R,null,1));
 await b.close()})();
