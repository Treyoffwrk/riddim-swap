/* Body (MirrorView inside Riddim Swap): sound in every view, the song in time with the clip, layout on a phone.
   Usage: node body_sound_test.js <host index.html> <clip> <song> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 /* a song offset and a slower clip, so the mapping is really tested */
 await p.evaluate(()=>{const R=window.__rs;R.S.offset=1.5;R.S.vr=0.9;});
 const rs=await p.evaluate(()=>({offset:window.__rs.S.offset,ar:window.__rs.S.ar,vr:window.__rs.S.vr,cIn:window.__rs.S.cIn}));
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 let h=null;for(let i=0;i<80;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.waitForTimeout(1500);
 const s0=await p.evaluate(()=>{const M=window.__mv;return {song:!!M.rsSong.el,mode:M.rsSong.mode,meta:M.rsSong.meta,refMuted:document.getElementById('reference-source').muted,
   pressed:[...document.querySelectorAll('#rs-sound [data-snd]')].filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.dataset.snd),title:document.title,brand:document.querySelector('.topbar .brand').innerText.replace(/\s+/g,' ')}});
 rec('Body opens with the song from Riddim Swap, Sound set to Song, the clip muted',h&&h.song&&s0.song&&s0.mode==='song'&&s0.pressed.join()==='song'&&s0.refMuted?'passed':'failed',JSON.stringify({handoff:h&&h.status,...s0}));
 rec('The song keeps Riddim Swap’s timing (offset, speeds, clip start)',s0.meta&&Math.abs(s0.meta.offset-rs.offset)<0.001&&Math.abs(s0.meta.vr-rs.vr)<1e-6&&Math.abs(s0.meta.ar-rs.ar)<1e-6?'passed':'failed',JSON.stringify({rs,mv:s0.meta}));
 rec('It looks like Riddim Swap: its name and a Body label in the header, Projects and More buttons',/Riddim\s*Swap/.test(s0.brand)&&/body/i.test(s0.brand)&&await p.isVisible('#rs-projects')&&await p.isVisible('#rs-more-btn')&&!(await p.isVisible('.top-actions .upload'))?'passed':'failed',s0.brand+' · '+s0.title);
 /* play: song position vs where it should be for the clip frame */
 const measure=async ms=>p.evaluate(ms=>new Promise(r=>{const M=window.__mv,v=document.getElementById('reference-source'),el=M.rsSong.el,m=M.rsSong.meta,out=[];
   const iv=setInterval(()=>{if(!v.paused&&!el.paused)out.push(el.currentTime-(m.offset+(v.currentTime-m.cIn)*m.ar/m.vr));},50);setTimeout(()=>{clearInterval(iv);r({d:out,rate:el.playbackRate,vrate:v.playbackRate,songPaused:el.paused})},ms)}),ms);
 const ensurePlay=async()=>{if(!(await p.evaluate(()=>window.__mv.state.playing)))await p.evaluate(()=>window.__mv.setPlaying(true));};
 await p.evaluate(()=>window.__mv.seek(3));await ensurePlay();await p.waitForTimeout(800);
 let m1=await measure(3000);
 rec('Song plays at its own speed, in time with the clip (median gap under 40 ms)',Math.abs(m1.rate-rs.ar)<0.002&&m1.d.length>20&&Math.abs(q(m1.d,0.5))<0.04&&q(m1.d.map(Math.abs),0.9)<0.08?'passed':'failed',`${m1.d.length} samples · median ${Math.round(q(m1.d,0.5)*1000)} ms · p90 ${Math.round(q(m1.d.map(Math.abs),0.9)*1000)} ms · song rate ${m1.rate.toFixed(3)} for clip rate ${m1.vrate}`);
 await p.evaluate(()=>window.__mv.seek(11));await p.waitForTimeout(700);let m2=await measure(1500);
 rec('After a seek the song follows',m2.d.length>8&&Math.abs(q(m2.d,0.5))<0.05?'passed':'failed',`median ${Math.round(q(m2.d,0.5)*1000)} ms`);
 await p.evaluate(()=>{window.__mv.state.speed=0.5;document.getElementById('reference-source').playbackRate=0.5;});await p.waitForTimeout(900);let m3=await measure(2000);
 rec('At half speed the song slows with it (pitch kept)',Math.abs(m3.rate/(0.5*rs.ar)-1)<0.02&&Math.abs(q(m3.d,0.5))<0.05?'passed':'failed',`song rate ${m3.rate.toFixed(3)} (expected ${(0.5*rs.ar).toFixed(3)}; clip at ${m3.vrate.toFixed(3)} for ${(0.5*rs.vr).toFixed(3)}) · median ${Math.round(q(m3.d,0.5)*1000)} ms · pitch kept ${await p.evaluate(()=>window.__mv.rsSong.el.preservesPitch)}`);
 await p.evaluate(()=>{const v=document.getElementById('reference-source');window.__mv.state.speed=1;v.playbackRate=1;});
 /* Clip and Off */
 await p.click('#rs-sound [data-snd="clip"]');await p.waitForTimeout(500);
 const c=await p.evaluate(()=>({refMuted:document.getElementById('reference-source').muted,songPaused:window.__mv.rsSong.el.paused,playing:!document.getElementById('reference-source').paused}));
 rec('Clip: the video’s own sound plays, the song stops',!c.refMuted&&c.songPaused&&c.playing?'passed':'failed',JSON.stringify(c));
 const pulse=await p.evaluate(()=>{const M=window.__mv;return {analysis:!!(M.music&&M.music.analysis),status:(document.getElementById('music-status-mini')||{}).textContent||''}});
 rec('Sound works whether or not Pulse could read the audio',!c.refMuted&&c.playing?'passed':'failed',`Pulse analysis ${pulse.analysis?'ready':'not available'}: “${pulse.status.slice(0,80)}”`);
 await p.click('#rs-sound [data-snd="off"]');await p.waitForTimeout(400);
 const o=await p.evaluate(()=>({refMuted:document.getElementById('reference-source').muted,songPaused:window.__mv.rsSong.el.paused}));
 rec('Off: silent',o.refMuted&&o.songPaused?'passed':'failed',JSON.stringify(o));
 await p.click('#rs-sound [data-snd="song"]');await p.waitForTimeout(700);
 /* every view has the switch; layout checks on a phone */
 const box=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);if(!e||!e.offsetParent)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},sel);
 const hit=(a,b)=>a&&b&&a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
 for(const mode of ['split','overlay','worldline']){
   await p.click(`[data-mode="${mode}"]`);await p.waitForTimeout(900);
   const snd=await box('#rs-sound'),dock=await box('#mv-dock'),stage=await box('#stage'),cam=await box('#camera-stage-button'),speed=await box('#reference-transport select'),nav=await box('.rs-nav'),launch=await box('.launch-dock');
   const vw=390;
   const issues=[];if(!snd)issues.push('no sound switch');if(hit(dock,stage))issues.push('quick controls over the video');if(cam&&hit(dock,cam))issues.push('controls over Enable camera');
   if(speed&&speed.x+speed.w>vw+1)issues.push('speed menu off screen');
   rec(`${mode[0].toUpperCase()+mode.slice(1)}: Sound switch there, nothing covering the video or off screen`,issues.length?'failed':'passed',issues.join(', ')||'ok');
   await p.screenshot({path:`${SHOT}-${mode}.png`});
 }
 /* Practice: its sound button cycles the same setting */
 await p.click('[data-mode="split"]');await p.waitForTimeout(500);
 const pb=p.locator('.stage-entry-actions button',{hasText:'Practice'}).first();
 if(await pb.count()){await pb.click();await p.waitForTimeout(1500);
   const t1=await p.evaluate(()=>{const e=document.querySelector('#rs-pv-sound');return e&&e.offsetParent?e.textContent:null});
   if(t1){await p.click('#rs-pv-sound');await p.waitForTimeout(400);
     const t2=await p.evaluate(()=>({label:document.getElementById('rs-pv-sound').textContent,mode:window.__mv.rsSong.mode,refMuted:document.getElementById('reference-source').muted}));
     rec('Practice: a Sound button on its control bar cycles Song → Clip (no clip sound over the song)',/Song/.test(t1)&&t2.mode==='clip'&&/Clip/.test(t2.label)&&!t2.refMuted?'passed':'failed',JSON.stringify({before:t1,after:t2}));
     await p.screenshot({path:SHOT+'-practice.png'});
     await p.click('#rs-pv-sound');await p.click('#rs-pv-sound');}
   else rec('Practice: the sound button cycles Song → Clip','blocked','Practice view didn’t open here');
   await p.keyboard.press('Escape');await p.waitForTimeout(800);
   const ex=p.locator('[data-action="exit-focus"], [data-practice="exit"], #pv-exit').first();if(await ex.isVisible().catch(()=>false))await ex.click();await p.waitForTimeout(600)}
 /* More menu */
 await p.click('#rs-more-btn');const items=await p.evaluate(()=>[...document.querySelectorAll('#rs-more-menu button')].map(x=>x.textContent));
 rec('More holds Use another video, Start here and Diagnostics',items.length===3&&/another video/.test(items[0])?'passed':'failed',items.join(' | '));
 await p.screenshot({path:`${SHOT}-more.png`});await p.click('#rs-more-btn');
 /* reload: the song stays with this clip */
 await p.reload();await p.waitForTimeout(3000);
 const modal=await p.evaluate(()=>{const m=document.getElementById('modal');return m&&m.open?{title:document.getElementById('modal-title').textContent,buttons:[...m.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean)}:null});
 console.log('after reload, dialog:',JSON.stringify(modal));
 if(modal){const btn=p.locator('#modal button',{hasText:/restore|continue|resume|open/i}).first();if(await btn.count())await btn.click();else await p.keyboard.press('Escape');await p.waitForTimeout(3000)}
 const r2=await p.evaluate(()=>({song:!!window.__mv.rsSong.el,mode:window.__mv.rsSong.mode,name:window.__mv.state.name}));
 rec('After a reload the song is still there for this clip',r2.song&&r2.mode==='song'?'passed':'failed',JSON.stringify(r2));
 /* Projects goes back to Riddim Swap with Projects open */
 await p.click('#rs-projects');await p.waitForURL(u=>!/mirrorview/.test(u.toString()),{timeout:15000});await p.waitForTimeout(2500);
 const back=await p.evaluate(()=>({sheet:!document.getElementById('sheet').hidden}));
 rec('Projects in Body opens Riddim Swap’s Projects',back.sheet?'passed':'failed',JSON.stringify(back));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,4)));
 await b.close()})();
