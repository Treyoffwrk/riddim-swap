/* Body draws the dancer with the same skeleton as Riddim Swap's player: the same drawing code and track (RTMPose with
   fingers and toes), in your Look colours, mirrored correctly. Usage: node body_skel_test.js <host index.html> <clip> <shot> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.setViewportSize({width:402,height:874});
 await p.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 /* RTMPose track in Riddim Swap (the harness pins the regular tracker; lift that) */
 await p.evaluate(()=>{delete window.RB_MODEL});await p.click('#trackQ [data-q="rtm"]');
 await p.click('#bodyTrack');for(let i=0;i<4000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const rs=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;return {model:B.model,ext:!!B.ext}});
 await p.evaluate(()=>window.__rs.LOOK.use('skel-glow'));
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 let h=null;for(let i=0;i<80;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.waitForTimeout(2000);
 /* count the drawing calls and what they're drawn with */
 await p.evaluate(()=>{const o=RB.draw;window.__calls=[];RB.draw=function(...a){window.__calls.push({t:a[2],dance:a[4]&&a[4].dance,hips:a[4]&&a[4].hips,ext:!!(a[1]&&a[1].ext),w:a[3].w});return o.apply(this,a)}});
 await p.evaluate(()=>{const v=document.getElementById('reference-source');v.pause();v.currentTime=4});await p.waitForTimeout(1500);
 const c=await p.evaluate(()=>({n:window.__calls.length,last:window.__calls[window.__calls.length-1]||null,prepared:!!__mvSkel.B,refPose:__mvSkel.refPose,t:__mvSkel.t}));
 rec('Riddim Swap tracked the dancer with RTMPose (with hands and feet)',/rtmpose/.test(rs.model||'')&&rs.ext?'passed':'failed',JSON.stringify(rs));
 rec('Body draws the dancer with Riddim Swap\'s skeleton and track (fingers and toes included)',c.n>0&&c.last&&c.last.ext&&Math.abs(c.last.t-c.t)<1e-6?'passed':'failed',JSON.stringify(c));
 rec('…in your Look colours (Glow: cyan, pink hips)',c.last&&String(c.last.dance).toUpperCase()==='#7DF9FF'&&String(c.last.hips).toUpperCase()==='#FF7AD9'?'passed':'failed',JSON.stringify(c.last));
 /* mirrored: the drawing flips (lit pixels' centre moves to the other side), and fingers add pixels */
 const m=await p.evaluate(()=>{const cv=document.createElement('canvas');cv.width=360;cv.height=640;const x=cv.getContext('2d'),rect={x:0,y:0,w:360,h:640};
   const meas=()=>{const d=x.getImageData(0,0,360,640).data;let n=0,sx=0;for(let i=3;i<d.length;i+=4)if(d[i]>100){n++;sx+=(i>>2)%360}return {n,cx:n?sx/n:0}};
   x.clearRect(0,0,360,640);const K=window.__mvSkel;const ok1=K.draw(x,rect,false);const a=meas();x.clearRect(0,0,360,640);const ok2=K.draw(x,rect,true);const b=meas();
   x.clearRect(0,0,360,640);const B=K.B;RB.draw(x,{...B,ext:null},K.t,rect,{dance:K.colours.ref,hips:K.colours.hips,meter:false,tiltGuide:false});const noHands=meas();
   return {ok1,ok2,a,b,noHands}});
 rec('Mirrored, the skeleton flips to the other side',m.ok1&&m.ok2&&m.a.n>200&&Math.abs(m.a.cx+m.b.cx-360)<4&&Math.abs(m.a.n-m.b.n)<m.a.n*0.05?'passed':'failed',JSON.stringify(m));
 rec('Fingers and toes are drawn (more of the skeleton than without them)',m.a.n>m.noHands.n*1.005?'passed':'failed',`with ${m.a.n} px, without ${m.noHands.n} px`);
 await p.screenshot({path:SHOT+'-body.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
