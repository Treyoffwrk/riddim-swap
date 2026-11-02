/* Upper / Legs draw only that half of the skeleton; Group preview (copies side by side, room check); header icons stay
   in reach; clip speed shows next to the time with quick changes.
   Usage: node group_test.js <host index.html> <one-dancer clip> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 /* speed: shown without tapping */
 const pill0=await p.evaluate(()=>{const b=document.getElementById('spdBtn'),r=b.getBoundingClientRect();return {txt:b.textContent,vis:r.width>0&&r.top>=0&&r.bottom<=innerHeight,strip:document.getElementById('spdStrip').hidden}});
 await p.click('#spdBtn');await p.click('#spdMore');await p.waitForTimeout(200);
 const sp1=await p.evaluate(()=>({pill:document.getElementById('spdBtn').textContent,deep:document.getElementById('vRateOut').textContent,rate:window.__rs.S.main.vr}));
 await p.click('.spdpre button[data-v="0.5"]');await p.waitForTimeout(200);
 const sp2=await p.evaluate(()=>({pill:document.getElementById('spdBtn').textContent,deep:document.getElementById('vRateOut').textContent,vid:document.querySelector('#vid')?.playbackRate}));
 rec('Clip speed shows next to the time without tapping, and changes from there',pill0.txt==='×1.00'&&pill0.vis&&pill0.strip&&sp1.pill==='×1.05'&&sp1.deep==='×1.05'&&sp2.pill==='×0.50'&&sp2.deep==='×0.50'?'passed':'failed',JSON.stringify({pill0,sp1,sp2}));
 await p.click('.spdpre button[data-v="1"]');await p.click('#spdBtn');
 /* track */
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);document.querySelector('#vid').currentTime=Math.min(5,n.body.dur||5)});await p.waitForTimeout(800);
 /* Upper / Legs: only that half is drawn (head area empty for Legs, feet area empty for Upper) */
 const parts=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body,t=document.querySelector('#vid').currentTime;const P=RB.poseAt(B,t);if(!P)return null;
   const W=400,H=Math.round(400*B.h/B.w),out={};
   for(const part of ['all','upper','legs']){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');RB.draw(x,B,t,{x:0,y:0,w:W,h:H},{hipPath:false,meter:false,tiltGuide:false,part});
     const d=x.getImageData(0,0,W,H).data,cnt=(y0,y1)=>{let k=0;for(let y=Math.max(0,Math.round(y0));y<Math.min(H,Math.round(y1));y++)for(let xx=0;xx<W;xx++)if(d[(y*W+xx)*4+3]>40)k++;return k};
     const sh=(P[11][1]+P[12][1])/2*H,hp=(P[23][1]+P[24][1])/2*H,kn=(P[25][1]+P[26][1])/2*H;
     out[part]={head:cnt(0,sh-4),knees:cnt((hp+kn)/2,H)}}
   return out});
 rec('Show Legs draws only the legs, Show Upper only the upper body',parts&&parts.all.head>50&&parts.all.knees>50&&parts.legs.head<parts.all.head*0.05&&parts.legs.knees>parts.all.knees*0.8&&parts.upper.knees<parts.all.knees*0.1&&parts.upper.head>parts.all.head*0.8?'passed':'failed',JSON.stringify(parts));
 /* …and in the player, with the cut-out on (when this clip has one) */
 const appPart=await p.evaluate(async()=>{const n=window.__rs.srcById(window.__rs.S.cur);if(!RB.hasCutout(n.body))return 'no cut-out';
   const S=window.__rs.S,got=[],o=RB.draw;RB.draw=(c,B,t,r,opt)=>{got.push(opt&&opt.part);return o(c,B,t,r,opt)};
   document.getElementById('dkCut').click();await new Promise(r=>setTimeout(r,300));document.querySelector('#dkPart button[data-part="legs"]').click();
   document.querySelector('#vid').currentTime+=0.1;await new Promise(r=>setTimeout(r,600));RB.draw=o;const res={parts:[...new Set(got)],cutPart:S.cutPart};
   document.querySelector('#dkPart button[data-part="all"]').click();document.getElementById('dkCut').click();return res});
 rec('The player passes Upper / Legs to the skeleton',typeof appPart==='string'?'not run':appPart.parts.includes('legs')?'passed':'failed',JSON.stringify(appPart));
 /* Group */
 const gv=await p.evaluate(()=>!document.getElementById('dkGroup').hidden);
 await p.click('#dkGroup');await p.waitForTimeout(600);
 const cols=()=>p.evaluate(()=>{const cv=document.getElementById('bodyCanvas'),x=cv.getContext('2d'),W=cv.width,H=cv.height,d=x.getImageData(0,0,W,H).data;
   const col=new Array(W).fill(0);for(let y=Math.round(H*0.12);y<H*0.7;y++)for(let i=0;i<W;i++){const o=(y*W+i)*4;if(d[o+2]>140&&d[o]+d[o+1]+d[o+2]>250)col[i]++}
   /* groups of columns with skeleton (gaps wider than 2% of the width split them) */
   let k=0,gap=1e9;for(let i=0;i<W;i++){if(col[i]>0){if(gap>W*0.02)k++;gap=0}else gap++}return k});
 const verdict=()=>p.evaluate(()=>({v:document.getElementById('grVerdict').textContent,n:document.getElementById('grN').textContent,fit:!document.getElementById('grFit').hidden,bar:!document.getElementById('groupBar').hidden,sp:document.getElementById('grSpOut').textContent}));
 const g3=await cols(),v3=await verdict();
 if(SHOT)await p.screenshot({path:SHOT+'-group3.png'});
 await p.click('#grMore');await p.waitForTimeout(500);const g4=await cols(),v4=await verdict();
 rec('Group shows copies of the dancer side by side (3, then 4)',gv&&v3.bar&&g3===3&&g4===4&&v4.n==='4'?'passed':'failed',JSON.stringify({gv,g3,g4,v3,v4}));
 rec('It says how much room each dancer needs',/Each needs ~[\d.]+ m · 3 need ~[\d.]+ m across/.test(v3.v)&&/no touching/.test(v3.v)&&/auto/.test(v3.sp)?'passed':'failed',v3.v+' | '+v3.sp);
 /* too close: it says they'd touch, and Space them fixes it */
 await p.evaluate(()=>{const r=document.getElementById('grSp');r.value=1;r.dispatchEvent(new Event('input'))});await p.waitForTimeout(300);const vc=await verdict();
 if(SHOT)await p.screenshot({path:SHOT+'-close.png'});
 await p.click('#grFit');await p.waitForTimeout(300);const vf=await verdict();
 rec('Too close: it says how often they touch, and "Space them" puts them back',/touch \d+% of the time/.test(vc.v)&&vc.fit&&/no touching/.test(vf.v)&&!vf.fit?'passed':'failed',JSON.stringify({vc,vf}));
 await p.click('#grMirror');await p.waitForTimeout(400);const vm=await verdict(),gm=await cols();
 if(SHOT)await p.screenshot({path:SHOT+'-mirror.png'});
 rec('Mirror every other one',gm===4&&/needs ~/.test(vm.v)?'passed':'failed',JSON.stringify({gm,vm:vm.v}));
 /* Cut out and Group together: both sets of options show, and the copies are the real dancer (just the legs here) */
 const both=await p.evaluate(async()=>{const n=window.__rs.srcById(window.__rs.S.cur);if(!RB.hasCutout(n.body))return 'no cut-out';
   const got=[],o=RB.cutDancer;RB.cutDancer=(...a)=>{got.push(a[5]);return o(...a)};
   document.getElementById('dkCut').click();await new Promise(r=>setTimeout(r,300));document.querySelector('#dkPart button[data-part="legs"]').click();
   document.querySelector('#vid').currentTime+=0.1;await new Promise(r=>setTimeout(r,700));RB.cutDancer=o;
   const vis=id=>{const e=document.getElementById(id);return !e.hidden&&e.getBoundingClientRect().height>0};
   /* real picture: pixels that aren't the dark background or the blue skeleton */
   const cv=document.getElementById('bodyCanvas'),x=cv.getContext('2d'),d=x.getImageData(0,0,cv.width,cv.height).data;let px=0;for(let i=0;i<d.length;i+=16){const r=d[i],g=d[i+1],b=d[i+2];if(r+g+b>120&&!(b>140&&b>r+30))px++}
   return {cutBar:vis('cutBar'),groupBar:vis('groupBar'),parts:[...new Set(got)],calls:got.length,px}});
 if(SHOT)await p.screenshot({path:SHOT+'-cutgroup.png'});
 rec('Cut out and Group at the same time: both option rows show, copies are the cut-out dancer (Legs only)',typeof both==='string'?'not run':both.cutBar&&both.groupBar&&both.parts.includes('legs')&&both.px>200?'passed':'failed',JSON.stringify(both));
 await p.evaluate(async()=>{document.querySelector('#dkPart button[data-part="all"]').click();if(window.__rs.S.cutOn)document.getElementById('dkCut').click()});await p.waitForTimeout(300);
 /* up to 8 dancers */
 for(let i=0;i<8&&!(await p.evaluate(()=>document.getElementById('grMore').disabled));i++)await p.click('#grMore');const v8=await verdict();
 rec('Up to 8 dancers',v8.n==='8'&&await p.evaluate(()=>document.getElementById('grMore').disabled)?'passed':'failed',v8.n);
 for(let i=0;i<4;i++)await p.click('#grLess');await p.waitForTimeout(300);   /* back to 4 */
 /* playing: the copies move */
 const h0=await p.evaluate(()=>{const c=document.getElementById('bodyCanvas');return c.toDataURL().length});
 await p.click('#play');await p.waitForTimeout(1500);const h1=await p.evaluate(()=>document.getElementById('bodyCanvas').toDataURL().length);await p.click('#play');
 rec('The copies dance while it plays',h0!==h1?'passed':'failed',JSON.stringify({h0,h1}));
 await p.click('#dkGroup');await p.waitForTimeout(300);
 const off=await p.evaluate(()=>document.getElementById('groupBar').hidden);
 rec('Group off: back to the video',off?'passed':'failed','');
 /* header: Projects and Look in reach from anywhere on the page */
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(400);
 const hdr=await p.evaluate(()=>{const r=id=>{const e=document.getElementById(id),b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {top:Math.round(b.top),w:Math.round(b.width),hit:!!hit&&e.contains(hit)}};
   const pin=document.querySelector('.pin').getBoundingClientRect(),h=document.querySelector('header').getBoundingClientRect();return {scrolled:scrollY,proj:r('projBtn'),look:r('lookBtn'),pinTop:Math.round(pin.top),hdrBottom:Math.round(h.bottom)}});
 if(SHOT)await p.screenshot({path:SHOT+'-scrolled.png'});
 await p.click('#projBtn');await p.waitForTimeout(400);const sheet=await p.evaluate(()=>!document.getElementById('sheet').hidden);
 rec('Projects and Look stay at the top as icons, reachable after scrolling',hdr.scrolled>500&&hdr.proj.hit&&hdr.look.hit&&hdr.proj.top>=0&&hdr.proj.top<60&&hdr.proj.w<=44&&hdr.pinTop>=hdr.hdrBottom-1&&sheet?'passed':'failed',JSON.stringify({hdr,sheet}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
