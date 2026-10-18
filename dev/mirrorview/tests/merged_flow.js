/* The merged app: track body in Riddim Swap, open Body tab → MirrorView shows the same dance body from the handed-off poses,
   shared bottom bar returns to the chosen section. Screenshots for the design comparison. */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.evaluate(()=>{const v=document.querySelector('#stage video');v.currentTime=6.77});await p.waitForTimeout(700);
 await p.screenshot({path:SHOT+'-rs-clip.png'});
 const nRS=await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).body.n);
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 let h=null;for(let i=0;i<80;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.waitForTimeout(800);
 const mv=await p.evaluate(()=>{const s=window.__mv.state;return {name:s.name,poses:s.poseSamples.length,withPose:s.poseSamples.filter(f=>f.points).length,refPose:s.refPose,msg:(document.getElementById('pose-message')||{}).textContent}});
 rec('Body tab opens MirrorView with the same body tracking',h&&h.status==='opened'&&mv.poses===nRS&&mv.refPose?'passed':'failed',JSON.stringify({handoff:h&&{status:h.status,body:h.body},mv,riddimFrames:nRS}));
 await p.evaluate(()=>{window.__mv.seek(6.77)});await p.waitForTimeout(900);
 const pts=await p.evaluate(()=>{const s=window.__mv.state;return {t:+s.time.toFixed(2),have:!!s.referencePoints}});
 rec('MirrorView shows the reference pose for the frame on screen without tracking again',pts.have?'passed':'failed',JSON.stringify(pts));
 await p.screenshot({path:SHOT+'-mv.png'});
 const nav=await p.evaluate(()=>[...document.querySelectorAll('.rs-nav button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')).join(' '));
 rec('Shared bottom bar in MirrorView',nav==='Clip Song Tempo Moves Routine Body*'?'passed':'failed',nav);
 await p.click('.rs-nav [data-rs-tab="t-routine"]');await p.waitForURL(u=>!/mirrorview/.test(u.toString()),{timeout:15000});await p.waitForTimeout(2500);
 const back=await p.evaluate(()=>({tab:document.querySelector('[role=tab][aria-selected="true"]').id,body:!!(window.__rs.srcById(window.__rs.S.cur).body)}));
 rec('Tapping Routine in MirrorView returns to Riddim Swap’s Routine tab',back.tab==='t-routine'&&back.body?'passed':'failed',JSON.stringify(back));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,4)));
 await b.close()})();
