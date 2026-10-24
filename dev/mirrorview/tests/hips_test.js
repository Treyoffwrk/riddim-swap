/* Steadier skeleton and readable hips, on your clips. Usage: node hips_test.js <host index.html> <two-dancer clip> <single-dancer clip> <song> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,DUO,SOLO,SONG,SHOT]=process.argv;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',DUO);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 const waitTrack=async()=>{for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body&&window.__rs.srcById(window.__rs.S.cur).body.v===2))break}};
 /* the followed dancer's hip position over time: any jumps? */
 const follow=()=>p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE,asp=B.h/B.w;let jumps=0,prev=null,pi=-1,xs=[];
   for(let i=0;i<B.n;i++){const o=i*S;if(isNaN(B.data[o+1])){continue}const hx=(B.data[o+1+23*3]+B.data[o+1+24*3])/2,hy=(B.data[o+2+23*3]+B.data[o+2+24*3])/2*asp,sx=(B.data[o+1+11*3]+B.data[o+1+12*3])/2,sy=(B.data[o+2+11*3]+B.data[o+2+12*3])/2*asp,T=Math.hypot(hx-sx,hy-sy);
     if(prev&&Math.hypot(hx-prev[0],hy-prev[1])>(0.5+0.1*(i-pi-1))*T)jumps++;prev=[hx,hy];pi=i;if(i%60===0)xs.push(+hx.toFixed(2))}
   return {v:B.v,n:B.n,seen:B.seen,multi:B.multi,jumps,clean:B.clean,xs,pick:B.pick,hips:!!B.hips,world:!!B.world}});
 await p.click('#bodyTrack');await waitTrack();
 let f=await follow();
 /* 14.6–15.2 s: the other dancer walks in front of the followed one (bigger, nearer the camera). Following must not jump onto them. */
 const occ=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE,asp=B.h/B.w;const out=[];for(let i=0;i<B.n;i++){const t=B.data[i*S];if(t<14.5||t>15.3)continue;const o=i*S;if(isNaN(B.data[o+1])){out.push(null);continue}
   const hx=(B.data[o+1+23*3]+B.data[o+1+24*3])/2,hy=(B.data[o+2+23*3]+B.data[o+2+24*3])/2*asp,sx=(B.data[o+1+11*3]+B.data[o+1+12*3])/2,sy=(B.data[o+2+11*3]+B.data[o+2+12*3])/2*asp;out.push(+Math.hypot(hx-sx,hy-sy).toFixed(3))}return out});
 const big=occ.filter(T=>T!=null&&T>0.28).length;
 rec('Someone walking in front doesn’t steal the track (14.6–15.2 s)',big===0?'passed':'failed',`frames on the nearer dancer: ${big} of ${occ.length}; torso sizes ${JSON.stringify(occ.filter((_,i)=>i%4===0))}`);
 rec('Two dancers: follows one dancer the whole clip',f.v===2&&f.jumps===0&&f.multi>0?'passed':'failed',JSON.stringify(f));
 const info=await p.textContent('#bodyInfo');
 rec('Says there is more than one person and who it follows',/More than one person/.test(info)?'passed':'failed',info);
 /* choose the other dancer: at 2.7 s they are at about x 0.41 */
 await p.evaluate(()=>{window.__rs.v().currentTime=2.7});await p.waitForTimeout(500);
 const other=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;const i=Math.round(2.7*B.fps);const o=i*RB.STRIDE;return +((B.data[o+1+23*3]+B.data[o+1+24*3])/2).toFixed(2)});
 await p.click('#bodyPick');await p.waitForTimeout(300);
 const box=await p.locator('#bodyCanvas').boundingBox();
 const geo=await p.evaluate(()=>{const v=window.__rs.v(),c=document.getElementById('bodyCanvas').getBoundingClientRect();return RB.containRect(c.width,c.height,v.videoWidth,v.videoHeight)});
 const tx=other>0.6?0.41:0.84;
 await p.screenshot({path:SHOT+'-pick.png'});
 await p.mouse.click(box.x+geo.x+tx*geo.w,box.y+geo.y+0.55*geo.h);
 await p.waitForTimeout(800);await waitTrack();
 const f2=await follow();
 const jumpsAt=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE,asp=B.h/B.w;const out=[];let prev=null,pt=0;for(let i=0;i<B.n;i++){const o=i*S;if(isNaN(B.data[o+1]))continue;const hx=(B.data[o+1+23*3]+B.data[o+1+24*3])/2,hy=(B.data[o+2+23*3]+B.data[o+2+24*3])/2*asp,sx=(B.data[o+1+11*3]+B.data[o+1+12*3])/2,sy=(B.data[o+2+11*3]+B.data[o+2+12*3])/2*asp,T=Math.hypot(hx-sx,hy-sy);if(prev&&Math.hypot(hx-prev[0],hy-prev[1])>0.5*T)out.push([+pt.toFixed(2),+B.data[o].toFixed(2),+prev[0].toFixed(2),+hx.toFixed(2)]);prev=[hx,hy];pt=B.data[o]}return out});console.log('JUMPS',JSON.stringify(jumpsAt));
 const at=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;const i=Math.round(2.7*B.fps);const o=i*RB.STRIDE;return +((B.data[o+1+23*3]+B.data[o+1+24*3])/2).toFixed(2)});
 rec('Choose the dancer: tap the other one and it follows them instead',Math.abs(at-tx)<0.12&&f2.jumps===0&&f2.n>=590&&f2.pick?'passed':'failed',`was following x≈${other} at 2.7 s, tapped x≈${tx}, now x≈${at}; ${JSON.stringify(f2)}`);
 /* single dancer: hips measures, meter, graph */
 await p.setInputFiles('#vidFile',SOLO);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');await waitTrack();
 const s=await follow();
 const hs=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;const v=k=>{const a=[];for(let i=0;i<B.n;i++){const h=RB.hipsAt(B,B.data[i*RB.STRIDE]);if(h&&h[k]!=null)a.push(h[k])}a.sort((x,y)=>x-y);return a.length?{n:a.length,p5:+a[Math.floor(a.length*.05)].toFixed(2),p95:+a[Math.floor(a.length*.95)].toFixed(2)}:null};
   return {tilt:v('tilt'),sway:v('sway'),turn:v('turn'),thrust:v('thrust')}});
 rec('Hip measures on every frame (tilt, sway, turn, forward/back)',s.v===2&&hs.tilt&&hs.tilt.n>0.8*s.n&&hs.turn&&hs.thrust?'passed':'failed',JSON.stringify(hs));
 /* find a tilted frame and look at the drawing */
 const tT=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;let best=0,bt=0;for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE],h=RB.hipsAt(B,t);if(h&&h.tilt!=null&&Math.abs(h.tilt)>Math.abs(best)){best=h.tilt;bt=t}}return {t:bt,tilt:best}});
 await p.evaluate(t=>{window.__rs.v().currentTime=t},tT.t);await p.waitForTimeout(700);
 const meterPx=()=>p.evaluate(()=>{const c=document.getElementById('bodyCanvas'),x=c.getContext('2d'),v=window.__rs.v(),r=RB.containRect(c.width,c.height,v.videoWidth,v.videoHeight);
   const d=x.getImageData(0,Math.round(r.y),Math.round(r.x+r.w*0.6),Math.round(r.h*0.6)).data;let pink=0,dark=0;for(let i=0;i<d.length;i+=4){if(d[i]>200&&d[i+1]<140&&d[i+2]>120)pink++;if(d[i+3]>150&&d[i]<40&&d[i+1]<40)dark++}return {pink,dark}});
 /* with the ball cues on, the balls use the side bars, so the gauges are hidden; with cues off they're drawn */
 const bv0=await p.evaluate(()=>window.__rs.S.beatView);const withBalls=bv0==='ball'?await meterPx():null;
 await p.evaluate(()=>document.querySelector('#bvSeg [data-bv="off"]').click());await p.waitForTimeout(500);const px=await meterPx();
 await p.evaluate(b=>{const e=document.querySelector(`#bvSeg [data-bv="${b}"]`);if(e)e.click()},bv0);await p.waitForTimeout(300);
 rec('Hip meter hidden while the ball cues are on (they share the side bars)',withBalls==null||withBalls.dark<200?'passed':'failed',JSON.stringify(withBalls)+' cues '+bv0);
 rec('Hip meter drawn with cues off (beside a tall video, or over its top corner)',px.pink>40&&px.dark>500?'passed':'failed',JSON.stringify(px)+` at ${tT.t.toFixed(2)} s, tilt ${tT.tilt.toFixed(1)}°`);
 await p.locator('#stage').screenshot({path:SHOT+'-tilt.png'});
 await p.click('#t-clip');await p.locator('#hipCard').scrollIntoViewIfNeeded();await p.waitForTimeout(500);
 rec('Hip moves graph shows under body tracking',await p.isVisible('#hipCanvas')?'passed':'failed','now: '+await p.textContent('#hipNow'));
 await p.locator('#hipCard').screenshot({path:SHOT+'-graph.png'});
 const box2=await p.locator('#hipCanvas').boundingBox();await p.mouse.click(box2.x+box2.width*0.5,box2.y+box2.height/2);await p.waitForTimeout(300);
 const tn=await p.evaluate(()=>window.__rs.v().currentTime),dur=await p.evaluate(()=>window.__rs.v().duration);
 rec('Tapping the graph jumps there',Math.abs(tn-dur/2)<0.4?'passed':'failed',`${tn.toFixed(2)} s of ${dur.toFixed(2)} s`);
 /* old tracks still draw, and say so */
 const old=await p.evaluate(async()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body;const o={v:1,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:new Float32Array(B.data),seen:B.seen,missed:0};n.body=o;await new Promise(r=>setTimeout(r,800));
   const c=document.getElementById('bodyCanvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let pink=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<140&&d[i+2]>120)pink++;const r={pink,up:!!o._up,hasHips:!!o.hips};n.body=B;return r});
 rec('A track from the older tracker still draws (cleaned on load)',old.pink>100&&old.up?'passed':'failed',JSON.stringify(old));
 /* MirrorView: same hips, meter at the top right */
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 for(let i=0;i<80;i++){const h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.evaluate(()=>{const d=document.getElementById('modal');if(d&&d.open)d.close()});
 await p.evaluate(t=>window.__mv.seek(t),tT.t);await p.waitForTimeout(800);
 const mv=await p.evaluate(()=>({hips:!!(window.__mv.preparedBody&&window.__mv.preparedBody.hips),world:!!(window.__mv.preparedBody&&window.__mv.preparedBody.world)}));
 rec('MirrorView gets the hip measures',mv.hips&&mv.world?'passed':'failed',JSON.stringify(mv));
 await p.screenshot({path:SHOT+'-mv.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,4)));
 await b.close();
})();
