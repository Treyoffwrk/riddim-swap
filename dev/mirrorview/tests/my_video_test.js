/* Body: "My video" (a video you filmed of yourself) next to the dancer, with your skeleton, lined up by movement.
   "You" here is the dancer's clip starting 0.6 s later, so the right line-up is known: you = dancer − 0.6 s.
   Usage: node my_video_test.js <host index.html> <dancer clip> <late copy> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,ME,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 /* the dancer's skeleton, from Riddim Swap (handed over with the clip) */
 await p.click('#bodyTrack');for(let i=0;i<2400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});await p.waitForTimeout(3500);
 await p.click('[data-mode="split"]');await p.waitForTimeout(600);
 const g=await p.evaluate(()=>[...document.querySelectorAll('.rs-grp')].map(x=>x.querySelector('b').textContent+': '+[...x.querySelectorAll('button')].filter(e=>!e.hidden&&e.offsetParent).map(e=>e.textContent.trim()).join(' / ')));
 rec('Under the video: Dancer and You groups; You offers Camera, My video and Skeleton',g.length===2&&/Camera/.test(g[1])&&/My video/.test(g[1])&&/Skeleton/.test(g[1])?'passed':'failed',g.join(' · '));
 await p.screenshot({path:SHOT+'-0start.png'});
 /* My video */
 await p.setInputFiles('#you-file',ME);
 for(let i=0;i<2400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const y=window.__mv.you;return !!y.samples&&!y.busy}))break}
 const s1=await p.evaluate(()=>{const M=window.__mv,y=M.you;return {youVideo:M.state.youVideo,youPose:M.state.youPose,frames:y.samples&&y.samples.length,withPose:y.samples&&y.samples.filter(f=>f.points).length,off:+y.off.toFixed(2),
   pressed:['you-cam','you-vid','you-skel'].map(id=>id+':'+document.getElementById(id).getAttribute('aria-pressed')).join(' '),note:document.getElementById('you-note').textContent,placeholder:!document.getElementById('camera-placeholder').hidden}});
 rec('My video loads, your body is tracked and the skeleton turns on',s1.youVideo&&s1.youPose&&s1.withPose>s1.frames*0.8&&/you-vid:true/.test(s1.pressed)&&/you-skel:true/.test(s1.pressed)&&!s1.placeholder?'passed':'failed',JSON.stringify(s1));
 rec('Line up finds the true offset by movement (−0.6 s, within 0.1 s)',Math.abs(s1.off+0.6)<=0.1?'passed':'failed',`found ${s1.off} s · ${s1.note}`);
 /* play: your video follows the dancer at the offset */
 await p.evaluate(()=>window.__mv.seek(3));if(!(await p.evaluate(()=>window.__mv.state.playing)))await p.evaluate(()=>window.__mv.setPlaying(true));await p.waitForTimeout(800);
 const d=await p.evaluate(()=>new Promise(r=>{const M=window.__mv,y=M.you,ref=document.getElementById('reference-source'),out=[];const iv=setInterval(()=>{if(!ref.paused&&!y.el.paused)out.push(y.el.currentTime-(ref.currentTime+y.off))},50);setTimeout(()=>{clearInterval(iv);r(out)},3000)}));
 rec('While playing, your video stays in time with the dancer (median under 40 ms)',d.length>20&&Math.abs(q(d,0.5))<0.04&&q(d.map(Math.abs),0.9)<0.1?'passed':'failed',`${d.length} samples · median ${Math.round(q(d,0.5)*1000)} ms · p90 ${Math.round(q(d.map(Math.abs),0.9)*1000)} ms`);
 /* your skeleton is drawn in the You half: count your colour (mint) in the lower half of the stage */
 await p.evaluate(()=>window.__mv.setPlaying(false));await p.evaluate(()=>window.__mv.seek(7));await p.waitForTimeout(900);
 const mint=async()=>p.evaluate(()=>{const c=document.getElementById('stage-canvas'),x=c.getContext('2d'),w=c.width,h=c.height,d=x.getImageData(0,Math.floor(h/2),w,Math.floor(h/2)).data;let n=0;for(let i=0;i<d.length;i+=8){const R=d[i],G=d[i+1],B=d[i+2];if(G>170&&R<120&&B>120&&B<200&&G-R>80)n++}return n});
 const withSk=await mint();
 await p.click('#you-skel');await p.waitForTimeout(700);const without=await mint();await p.click('#you-skel');await p.waitForTimeout(700);
 rec('Your skeleton is drawn on your video in the You half (and goes when you turn it off)',withSk>40&&without<withSk/5?'passed':'failed',`mint pixels with skeleton ${withSk}, without ${without}`);
 await p.locator('#stage').screenshot({path:SHOT+'-split.png'});await p.screenshot({path:SHOT+'-page.png'});
 /* Overlay: your video under the dancer */
 await p.click('[data-mode="overlay"]');await p.waitForTimeout(900);await p.locator('#stage').screenshot({path:SHOT+'-overlay.png'});
 const ov=await p.evaluate(()=>window.__mv.state.youVideo);
 rec('Overlay: your video sits under the dancer',ov?'passed':'failed','');
 await p.click('[data-mode="split"]');await p.waitForTimeout(400);
 /* nudges */
 const o0=await p.evaluate(()=>window.__mv.you.off);await p.click('#you-later');await p.click('#you-later');const o1=await p.evaluate(()=>window.__mv.you.off);
 rec('+0.1 s nudges move your video',Math.abs(o1-o0-0.2)<1e-6?'passed':'failed',`${o0.toFixed(2)} → ${o1.toFixed(2)}`);
 /* back to Camera */
 await p.click('#you-cam');await p.waitForTimeout(600);
 const c=await p.evaluate(()=>({youVideo:window.__mv.state.youVideo,placeholder:!document.getElementById('camera-placeholder').hidden,camStarted:!!document.getElementById('camera-source').srcObject}));
 rec('Camera switches the You side back to your live camera (it starts on your tap)',!c.youVideo&&c.camStarted?'passed':'failed',JSON.stringify(c));
 await p.click('#you-vid');await p.waitForTimeout(500);
 /* reload: My video and its skeleton come back for this dancer clip */
 await p.reload();await p.waitForTimeout(3000);
 const modal=p.locator('#modal button',{hasText:/Resume/}).first();if(await modal.count()){await modal.click();await p.waitForTimeout(3000)}
 for(let i=0;i<20;i++){if(await p.evaluate(()=>!!window.__mv.you.el))break;await p.waitForTimeout(500)}
 const r=await p.evaluate(()=>({youVideo:window.__mv.state.youVideo,samples:!!window.__mv.you.samples,off:+window.__mv.you.off.toFixed(2),name:window.__mv.you.name}));
 rec('After a reload, My video, its skeleton and line-up are still there',r.youVideo&&r.samples&&Math.abs(r.off-o1)<0.01?'passed':'failed',JSON.stringify(r));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,4)));
 await b.close()})();
