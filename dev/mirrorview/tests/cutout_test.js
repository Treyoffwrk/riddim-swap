/* Cut-out and quick controls: Riddim Swap stage, hand-off to MirrorView, MirrorView on its own. Real clip. */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const regionStats=(p,sel,box)=>p.evaluate(([sel,box])=>{const c=document.querySelector(sel);const x=c.getContext('2d');const W=c.width,H=c.height;const d=x.getImageData(Math.round(box[0]*W),Math.round(box[1]*H),Math.max(1,Math.round(box[2]*W)),Math.max(1,Math.round(box[3]*H))).data;let sum=0,n=0,op=0;for(let i=0;i<d.length;i+=4){sum+=d[i]+d[i+1]+d[i+2];n++;if(d[i+3]>200)op++}return {mean:+(sum/n/3).toFixed(1),opaque:+(op/n).toFixed(2)}},[sel,box]);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');localStorage.clear()});await p.reload();
 await p.waitForTimeout(900);rec('Get started card shows three steps on a new project',await p.isVisible('#startCard')&&await p.evaluate(()=>document.getElementById('st1').className==='next')?'passed':'failed',await p.evaluate(()=>[...document.querySelectorAll('#startCard li')].map(l=>l.className+':'+l.textContent.replace(/Choose|Play/,'').trim()).join(' | ')));
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 rec('Quick controls appear on the video',await p.isVisible('#dkBody')?'passed':'failed','Body button text: '+await p.textContent('#dkBody'));
 await p.click('#dkBody');   /* not tracked yet: starts tracking */
 for(let i=0;i<1400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const m=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;return {n:B.n,mask:B.mask&&{w:B.mask.w,h:B.mask.h,frames:B.mask.frames}}});
 rec('Tracking also makes a person mask for each frame',m.mask&&m.mask.frames>=0.9*m.n?'passed':'failed',JSON.stringify(m));
 await p.waitForTimeout(600);
 rec('Hips and Cut out buttons appear after tracking',await p.isVisible('#dkHips')&&await p.isVisible('#dkCut')?'passed':'failed','');
 await p.evaluate(()=>{const v=document.querySelector('#stage video');v.currentTime=6.77});await p.waitForTimeout(500);
 await p.click('#dkBody');await p.waitForTimeout(300);   /* body off, to look at the cut-out alone */
 await p.click('#dkCut');await p.waitForTimeout(600);
 const geo=await p.evaluate(()=>{const v=document.querySelector('#stage video'),c=document.getElementById('bodyCanvas');const r=RB.containRect(c.width,c.height,v.videoWidth,v.videoHeight);return {rx:r.x/c.width,rw:r.w/c.width}});
 const corner=await regionStats(p,'#bodyCanvas',[geo.rx+0.01,0.02,geo.rw*0.15,0.15]), centre=await regionStats(p,'#bodyCanvas',[geo.rx+geo.rw*0.4,0.35,geo.rw*0.2,0.3]);
 rec('Cut out replaces the background (dark) and keeps the dancer',corner.mean<20&&centre.mean>40&&corner.opaque>0.95?'passed':'failed',`background corner brightness ${corner.mean}/255, dancer area ${centre.mean}/255`);
 await p.locator('#stage').screenshot({path:SHOT+'-rs-cut-dark.png'});
 await p.click('#dkBg [data-bg="blur"]');await p.waitForTimeout(400);
 const cornerB=await regionStats(p,'#bodyCanvas',[geo.rx+0.01,0.02,geo.rw*0.15,0.15]);
 rec('Blurred background option',cornerB.mean>corner.mean+5?'passed':'failed',`corner brightness dark ${corner.mean} → blur ${cornerB.mean}`);
 await p.click('#dkBody');await p.waitForTimeout(400);await p.locator('#stage').screenshot({path:SHOT+'-rs-cut-body.png'});
 /* hand-off with masks */
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 let h=null;for(let i=0;i<80;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 rec('MirrorView receives poses and masks',h&&h.masks&&h.body>0&&await p.evaluate(()=>window.__mv.preparedReady())?'passed':'failed',JSON.stringify(h&&{status:h.status,body:h.body,masks:h.masks,error:h.error}));
 await p.evaluate(()=>{const d=document.getElementById('modal');if(d&&d.open)d.close();const b=[...document.querySelectorAll('button')].find(x=>/^\s*Overlay\s*$/.test(x.textContent));b&&b.click()});await p.waitForTimeout(600);
 rec('Overlay shows the See-through slider on the video',await p.isVisible('#dock-opacity')?'passed':'failed','value text: '+await p.textContent('#dock-op-val'));
 await p.locator('#dock-opacity').fill('0.6');await p.waitForTimeout(300);
 const op=await p.evaluate(()=>({overlay:window.__mv.state.overlayOpacity,label:document.getElementById('dock-op-val').textContent,settings:document.getElementById('overlay-opacity').value}));
 rec('See-through slider changes the overlay',Math.abs(op.overlay-0.4)<0.01&&op.label==='60%'&&op.settings==='0.4'?'passed':'failed',JSON.stringify(op));
 await p.evaluate(()=>window.__mv.seek(6.77));await p.waitForTimeout(400);
 await p.click('#dock-cut');await p.waitForTimeout(900);
 const cut=await p.evaluate(()=>{const s=window.__mv.state;return {maskRef:s.maskRef,cutout:!!s.refCutout,cutT:s.refCutoutTime&&+s.refCutoutTime.toFixed(2),t:+s.time.toFixed(2),pressed:document.getElementById('dock-cut').getAttribute('aria-pressed')}});
 rec('MirrorView cut-out works from the prepared masks',cut.maskRef&&cut.cutout&&Math.abs(cut.cutT-cut.t)<0.05&&cut.pressed==='true'?'passed':'failed',JSON.stringify(cut));
 await p.screenshot({path:SHOT+'-mv-overlay-cut.png'});
 await p.evaluate(()=>window.__mv.setPlaying(true));await p.waitForTimeout(1500);
 const cut2=await p.evaluate(()=>{const s=window.__mv.state;return {cutout:!!s.refCutout,lag:+Math.abs(s.refCutoutTime-s.time).toFixed(3)}});await p.evaluate(()=>window.__mv.setPlaying(false));
 rec('Cut-out follows playback frame by frame',cut2.cutout&&cut2.lag<0.06?'passed':'failed',JSON.stringify(cut2));
 rec('Mirror button',await p.evaluate(async()=>{const before=window.__mv.state.mirrorRef;document.getElementById('dock-mirror').click();await new Promise(r=>setTimeout(r,300));return window.__mv.state.mirrorRef!==before})?'passed':'failed','');
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,4)));
 await b.close();
 /* MirrorView on its own: Cut out tracks the clip first */
 {const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(HOST.replace('index.html','')+'mirrorview/#debug');await p.setInputFiles('#file-input',CLIP);await p.waitForTimeout(2500);
  await p.evaluate(()=>{const d=document.getElementById('modal');if(d&&d.open)d.close()});
  await p.click('#dock-cut');
  for(let i=0;i<1400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>window.__mv.preparedReady()&&window.__mv.state.maskRef))break}
  await p.evaluate(()=>window.__mv.seek(6.77));await p.waitForTimeout(700);
  const r=await p.evaluate(()=>({ready:window.__mv.preparedReady(),maskRef:window.__mv.state.maskRef,cutout:!!window.__mv.state.refCutout,poses:window.__mv.state.poseSamples.length,msg:(document.getElementById('pose-message')||{}).textContent}));
  rec('MirrorView alone: Cut out tracks the clip, then cuts out',r.ready&&r.maskRef&&r.cutout?'passed':'failed',JSON.stringify(r));
  await p.screenshot({path:SHOT+'-mv-alone-cut.png'});
  rec('No page errors (MirrorView alone)',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
  await b.close()}
})();
