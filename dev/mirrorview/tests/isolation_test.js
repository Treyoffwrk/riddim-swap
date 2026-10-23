/* Leg and upper-body isolation. Usage: node isolation_test.js <host index.html> <clip> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 await p.click('#bodyTrack');for(let i=0;i<2400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.evaluate(()=>{window.__rs.v().currentTime=6.8});await p.waitForTimeout(700);
 await p.evaluate(()=>window.scrollTo(0,0));
 /* measure the cut-out alone: skeleton and hip drawing off */
 await p.click('#dkBody');await p.evaluate(()=>{const h=document.getElementById('hipShow');if(h.checked){h.checked=false;h.dispatchEvent(new Event('change'))}});
 await p.click('#dkCut');await p.waitForTimeout(300);
 const ui=await p.evaluate(()=>({bar:!document.getElementById('cutBar').hidden&&document.getElementById('cutBar').contains(document.getElementById('dkPart')),part:!document.getElementById('dkPart').hidden,buttons:[...document.querySelectorAll('#dkPart button')].map(b=>b.textContent),bg:[...document.querySelectorAll('#dkBg button')].map(b=>b.dataset.bg)}));
 rec('Cut out offers Whole, Upper and Legs, and a Dim background, under the video (not over the dancer)',ui.part&&ui.bar&&ui.buttons.join()==='Whole,Upper,Legs'&&ui.bg.includes('dim')?'passed':'failed',JSON.stringify(ui));
 /* where the dancer shows: lit pixels above and below the hip joints, inside the dancer's box */
 const measure=()=>p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body,v=R.v(),c=document.getElementById('bodyCanvas'),x=c.getContext('2d'),W=c.width,H=c.height;
   const rect=RB.containRect(W,H,v.videoWidth,v.videoHeight),P=RB.poseAt(B,v.currentTime);
   const Y=j=>rect.y+P[j][1]*rect.h,Xp=j=>rect.x+P[j][0]*rect.w, hipY=(Y(23)+Y(24))/2, top=Math.min(Y(0),Y(11),Y(12))-0.05*rect.h, foot=Math.max(Y(31),Y(32),Y(29),Y(30))+0.03*rect.h;
   const xs=[0,11,12,15,16,23,24,27,28,31,32].map(Xp), x0=Math.max(0,Math.min(...xs)-0.08*rect.w), x1=Math.min(W,Math.max(...xs)+0.08*rect.w);
   const d=x.getImageData(0,0,W,H).data;let up=0,lo=0,bgLit=0,bgN=0;
   for(let yy=0;yy<H;yy+=2)for(let xx=0;xx<W;xx+=2){const i=(yy*W+xx)*4,l=d[i]+d[i+1]+d[i+2];const inBox=xx>=x0&&xx<=x1&&yy>=top&&yy<=foot;
     if(inBox){if(l>90){if(yy<hipY-0.03*rect.h)up++;else if(yy>hipY+0.03*rect.h)lo++}}else if(xx>rect.x&&xx<rect.x+rect.w&&yy>rect.y&&yy<rect.y+rect.h){bgN++;bgLit+=l}}
   return {up,lo,bgMean:+(bgLit/Math.max(1,bgN)/3).toFixed(1)}});
 const setPart=async part=>{await p.click(`#dkPart [data-part="${part}"]`);await p.waitForTimeout(500)};
 const setBg=async bg=>{await p.click(`#dkBg [data-bg="${bg}"]`);await p.waitForTimeout(500)};
 await setBg('dark');await setPart('all');const all=await measure();await p.screenshot({path:SHOT+'-all.png'});
 await setPart('legs');const legs=await measure();await p.screenshot({path:SHOT+'-legs.png'});
 await setPart('upper');const up=await measure();await p.locator('#stage').screenshot({path:SHOT+'-upper.png'});
 rec('Whole: the dancer shows above and below the hips',all.up>200&&all.lo>200?'passed':'failed',JSON.stringify(all));
 rec('Legs: only the legs show (little above the hips)',legs.lo>0.6*all.lo&&legs.up<0.15*all.up?'passed':'failed',`above hips ${legs.up} (whole ${all.up}) · below ${legs.lo} (whole ${all.lo})`);
 rec('Upper: only the upper body shows (little below the hips)',up.up>0.6*all.up&&up.lo<0.15*all.lo?'passed':'failed',`above hips ${up.up} (whole ${all.up}) · below ${up.lo} (whole ${all.lo})`);
 await setBg('dim');const dim=await measure();await p.locator('#stage').screenshot({path:SHOT+'-upper-dim.png'});
 rec('Dim: the rest of the frame stays visible but dark',dim.bgMean>4&&dim.bgMean<60&&dim.up>0.6*all.up?'passed':'failed',`background brightness ${dim.bgMean} (dark background ${up.bgMean})`);
 /* the choice is remembered */
 await p.reload();await p.waitForTimeout(3000);const kept=await p.evaluate(()=>({part:window.__rs.S.cutPart,bg:window.__rs.S.cutBg}));
 rec('Your choice is remembered',kept.part==='upper'&&kept.bg==='dim'?'passed':'failed',JSON.stringify(kept));
 /* Body: the Dancer's Cut out has the same choice */
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});await p.waitForTimeout(4000);
 await p.click('[data-mode="overlay"]');await p.waitForTimeout(500);
 if(await p.evaluate(()=>window.__mv.state.refPose))await p.click('#dock-body');
 await p.click('#dock-cut');await p.waitForTimeout(1200);
 const mvUi=await p.evaluate(()=>({shown:!document.getElementById('dancer-part').hidden,mask:window.__mv.state.maskRef}));
 const lit=()=>p.evaluate(()=>{const M=window.__mv,c=document.getElementById('stage-canvas'),x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;let top=0,bot=0;for(let y=0;y<H;y+=3)for(let xx=0;xx<W;xx+=3){const i=(y*W+xx)*4;if(d[i]+d[i+1]+d[i+2]>150){if(y<H*0.5)top++;else bot++}}return {top,bot}});
 await p.click('#dancer-part [data-part="all"]');await p.waitForTimeout(800);const m0=await lit();
 await p.click('#dancer-part [data-part="legs"]');await p.waitForTimeout(800);const m1=await lit();await p.locator('#stage').screenshot({path:SHOT+'-body-legs.png'});
 rec('Body: Cut out shows Whole / Upper body / Legs, and Legs hides the upper body',mvUi.shown&&mvUi.mask&&m1.top<0.5*m0.top?'passed':'failed',JSON.stringify({ui:mvUi,whole:m0,legs:m1}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
