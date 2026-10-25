/* Body as part of Riddim Swap: the Look (skeleton colours, glow, theme), the project's cuts and speed graph, its name,
   and the Whole / Upper / Legs setting carry over. Usage: node body_link_test.js <host index.html> <clip> <song> <shot> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(p.url().split('/').slice(-2).join('/')+': '+e.message));
 await p.setViewportSize({width:402,height:874});
 await p.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');indexedDB.deleteDatabase('riddim-bridge');indexedDB.deleteDatabase('mirrorview-session-v1');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* the dancer tracked in Riddim Swap (Body draws the same body without tracking again) */
 await p.click('#bodyTrack');for(let i=0;i<2400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 /* the look: Glow skeleton and the Dancehall theme */
 await p.evaluate(()=>{const R=window.__rs;R.LOOK.use('skel-glow');R.LOOK.use('theme-dancehall')});
 /* the project: a name, a cut (4-7 s out) and the speed graph */
 await p.click('#projBtn');await p.fill('#projName','Battle prep');await p.click('#sheetClose');
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),d=R.v().duration;n.pieces=[{s:0,e:4,on:true},{s:4,e:7,on:false},{s:7,e:d,on:true}]});
 await p.check('#spdOn');await p.click('[data-spd="up"]');await p.waitForTimeout(500);
 const want=await p.evaluate(()=>{const R=window.__rs,L=R.segs(),out=t=>{for(let i=0;i<L.length;i++){const g=L[i];if(t>=g.s&&t<=g.e){let o=0;for(let k=0;k<i;k++)o+=R.segLen(L[k]);return o+R.toOut(g,t)}}return null};
   return {segs:L.length,curve:L.every(g=>!!g.k),pts:[1,3,7.5,10,15].map(t=>[t,out(t)])}});
 try{localStorage.setItem('rs-cutpart','legs')}catch(e){}
 await p.evaluate(()=>localStorage.setItem('rs-cutpart','legs'));
 await p.click('#t-body');await p.waitForURL(/mirrorview\//,{timeout:15000});
 let h=null;for(let i=0;i<80;i++){h=await p.evaluate(()=>window.__mvHandoff||null);if(h&&h.status!=='importing')break;await p.waitForTimeout(250)}
 await p.waitForTimeout(1500);
 /* 1. the look */
 const lk=await p.evaluate(()=>{const cs=getComputedStyle(document.documentElement),sw=document.querySelector('.topbar .brand .rs-swap');return {look:window.__mvLook,bg:cs.getPropertyValue('--bg').trim(),panel:cs.getPropertyValue('--panel').trim(),swap:sw&&getComputedStyle(sw).color,body:getComputedStyle(document.body).backgroundColor}});
 rec('Body uses your Look: the Glow skeleton colours and glow',lk.look&&lk.look.ref.toUpperCase()==='#7DF9FF'&&lk.look.hips.toUpperCase()==='#FF7AD9'&&Math.abs(lk.look.glow-0.9)<1e-6?'passed':'failed',JSON.stringify(lk.look));
 rec('Body uses your app theme (Dancehall colours on the page and header)',lk.bg.toUpperCase()==='#0B100C'&&lk.panel.toUpperCase()==='#141C16'&&lk.swap==='rgb(255, 210, 63)'?'passed':'failed',JSON.stringify({bg:lk.bg,panel:lk.panel,swap:lk.swap,body:lk.body}));
 /* 2. the project */
 const pj=await p.evaluate(()=>{const M=window.__mv,e=document.getElementById('rs-proj'),r=e&&e.getBoundingClientRect(),hb=document.querySelector('.topbar .brand').getBoundingClientRect();return {shown:!!r&&r.width>30&&r.right<=innerWidth&&getComputedStyle(e).display!=='none',name:e&&e.textContent,pieces:M.rsClip.pieces,map:!!M.rsClip.map,part:M.state.cutPart,
   pts:[1,3,7.5,10,15].map(t=>[t,+M.rsOut(t).toFixed(3)])}});
 const ptsOk=want.pts.every(([t,o],k)=>o!=null&&Math.abs(o-pj.pts[k][1])<0.02);
 rec('The project\'s name shows in Body\'s header (visible on a phone)',pj.name==='Battle prep'&&pj.shown?'passed':'failed',JSON.stringify(pj.name));
 rec('The cuts and speed graph arrive: Body maps clip time to song time exactly as Riddim Swap does',want.segs===2&&want.curve&&pj.pieces&&pj.pieces.length===2&&pj.map&&ptsOk?'passed':'failed',JSON.stringify({rs:want.pts,body:pj.pts,pieces:pj.pieces}));
 rec('Whole / Upper / Legs is one setting for both pages',pj.part==='legs'?'passed':'failed',JSON.stringify(pj.part));
 /* 3. playing through the cut: the clip skips 4-7 s, the song keeps going without a jump and stays in time */
 const ensurePlay=async()=>{if(!(await p.evaluate(()=>window.__mv.state.playing)))await p.evaluate(()=>window.__mv.setPlaying(true));};
 await p.evaluate(()=>{const M=window.__mv;M.setSound&&M.setSound('song',false);M.seek(2.2)});await ensurePlay();await p.waitForTimeout(500);
 const tr=await p.evaluate(()=>new Promise(r=>{const M=window.__mv,v=document.getElementById('reference-source'),el=M.rsSong.el,out=[];
   const iv=setInterval(()=>{out.push({v:v.currentTime,a:el.currentTime,w:performance.now()/1000,gap:el.currentTime-M.songAt(v.currentTime),skip:performance.now()-M.rsClip.skipAt,vr:v.playbackRate,sl:M.rsSlope(v.currentTime),paused:el.paused})},40);setTimeout(()=>{clearInterval(iv);r(out)},4500)}));
 const inCut=tr.filter(x=>x.v>4.12&&x.v<6.9).length, reached=tr.some(x=>x.v>7.3), steps=[];for(let i=1;i<tr.length;i++)if(!tr[i].paused&&!tr[i-1].paused)steps.push(Math.abs((tr[i].a-tr[i-1].a)-(tr[i].w-tr[i-1].w)*(tr[i].a-tr[i-1].a>0?1:1)));
 const rate=tr.length>2?(tr[tr.length-1].a-tr[0].a)/(tr[tr.length-1].w-tr[0].w):0, jumps=[];for(let i=1;i<tr.length;i++){const d=(tr[i].a-tr[i-1].a)-(tr[i].w-tr[i-1].w)*rate;if(Math.abs(d)>0.1)jumps.push(Math.round(d*1000))}
 const gaps=tr.filter(x=>x.skip>500&&!x.paused).map(x=>Math.abs(x.gap));
 rec('Playing through a cut: the clip skips it (never shows 4-7 s) and goes on',inCut<=1&&reached?'passed':'failed',`${inCut} samples inside the cut · past 7 s: ${reached}`);
 rec('The song keeps going through the cut without a jump',jumps.length===0&&tr.filter(x=>x.paused).length===0?'passed':'failed',`song jumps ${JSON.stringify(jumps)} · paused samples ${tr.filter(x=>x.paused).length}`);
 rec('The song stays in time with the clip through the speed graph (gap p90 under 80 ms)',gaps.length>20&&q(gaps,0.9)<0.08?'passed':'failed',`median ${Math.round(q(gaps,0.5)*1000)} ms · p90 ${Math.round(q(gaps,0.9)*1000)} ms over ${gaps.length} samples`);
 /* 4. the skeleton is drawn in the Look's colour (with prepared poses) */
 await p.evaluate(()=>{window.__mv.setPlaying(false);window.__mv.seek(9)});await p.waitForTimeout(1500);
 const ready=await p.evaluate(()=>!!window.__mv.state.refPose);if(!ready&&await p.isVisible('#dock-body'))await p.click('#dock-body');await p.waitForTimeout(1200);
 const px=await p.evaluate(()=>{const c=document.getElementById('stage-canvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let look=0,old=0;
   const near=(i,r,g,b,t)=>Math.abs(d[i]-r)<t&&Math.abs(d[i+1]-g)<t&&Math.abs(d[i+2]-b)<t;
   for(let i=0;i<d.length;i+=8){if(near(i,0x7D,0xF9,0xFF,40))look++;if(near(i,0x6E,0x8B,0xFF,28))old++}return {look,old}});
 await p.screenshot({path:SHOT+'-body.png'});
 rec('The Body skeleton is drawn in your Look colour, not the old default blue',px.look>400&&px.old<px.look*0.2?'passed':'failed',JSON.stringify(px));
 /* 5. changing the look in Riddim Swap shows when you come back to Body */
 await p.evaluate(()=>{localStorage.setItem('rs-look-now',JSON.stringify({skel:{dance:'#FFB347',hips:'#FF6B9A',glow:0},theme:{}}));document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(300);
 const lk2=await p.evaluate(()=>({look:window.__mvLook,bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()}));
 rec('A new look is picked up when you come back to Body (Classic theme puts Body\'s own colours back)',lk2.look.ref.toUpperCase()==='#FFB347'&&lk2.look.glow===0&&lk2.bg.toUpperCase()==='#0E1014'?'passed':'failed',JSON.stringify(lk2));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
