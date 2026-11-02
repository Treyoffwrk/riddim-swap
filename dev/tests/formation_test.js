/* Group formations: shapes (Line, V, Two rows, Wedge, Circle), dragging dancers on a floor plan, formation changes on
   the beat with the dancers walking to their new spots, saving a shape for every clip, removing a change.
   Usage: node formation_test.js <host index.html> <one-dancer clip> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.evaluate(()=>{document.querySelector('#vid').currentTime=2});await p.waitForTimeout(600);
 await p.click('#dkGroup');await p.waitForTimeout(600);await p.click('#grMore');await p.waitForTimeout(400);   /* 4 dancers */
 const ui=()=>p.evaluate(()=>({shapes:[...document.querySelectorAll('#grShapes .pchip')].map(b=>b.textContent.replace('×','')+(b.getAttribute('aria-pressed')==='true'?'*':'')),
   changes:[...document.querySelectorAll('#grChanges .grch')].map(b=>b.textContent.replace('×','')+(b.getAttribute('aria-pressed')==='true'?'*':'')),verdict:document.getElementById('grVerdict').textContent}));
 const u0=await ui();
 rec('Formation shapes show, starting as a Line, with one formation from 0:00',['Line*','V','Two rows','Wedge','Circle'].every(x=>u0.shapes.includes(x))&&u0.changes.length===1&&/^0:00Line/.test(u0.changes[0])?'passed':'failed',JSON.stringify(u0));
 const shot=()=>p.evaluate(()=>document.getElementById('bodyCanvas').toDataURL().length);
 /* the dancers' heights on screen: back-row dancers are drawn smaller */
 const rows=()=>p.evaluate(()=>{const cv=document.getElementById('bodyCanvas'),x=cv.getContext('2d'),W=cv.width,H=cv.height,d=x.getImageData(0,0,W,H).data;
   const top=new Array(W).fill(-1),bot=new Array(W).fill(-1);for(let y=Math.round(H*0.06);y<H;y++)for(let i=0;i<W;i++){const o=(y*W+i)*4;if(d[o+2]>140&&d[o]+d[o+1]+d[o+2]>250){if(top[i]<0)top[i]=y;bot[i]=y}}
   const groups=[];let cur=null,gap=1e9;for(let i=0;i<W;i++){if(top[i]>=0){if(gap>W*0.015){cur={t:1e9,b:-1};groups.push(cur)}cur.t=Math.min(cur.t,top[i]);cur.b=Math.max(cur.b,bot[i]);gap=0}else gap++}
   return groups.map(g=>g.b-g.t)});
 const lineH=await rows();
 await p.click('#grShapes .pchip:has-text("Two rows")');await p.waitForTimeout(500);const u1=await ui(),rowH=await rows(),lay=await p.evaluate(()=>window.__rsGr.last()),pos1=await p.evaluate(()=>window.__rsGr.pos(document.querySelector('#vid').currentTime));
 if(SHOT)await p.screenshot({path:SHOT+'-rows.png'});
 rec('Two rows: two in front, two behind, the back row drawn smaller',u1.shapes.includes('Two rows*')&&pos1.filter(q=>q[1]===0).length===2&&pos1.filter(q=>q[1]===1).length===2&&lay.filter(q=>q.z===1).every(q=>q.kk<0.85)&&lay.filter(q=>q.z===0).every(q=>q.kk===1)&&rowH.length>=2?'passed':'failed',JSON.stringify({rowH,pos1,lay}));
 /* floor plan: drag dancer 1 */
 await p.click('#grEdit');await p.waitForTimeout(300);
 const dot=await p.evaluate(()=>{const g=document.querySelector('#grPlan .grdot[data-k="0"] circle:nth-child(2)'),r=g.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,n:document.querySelectorAll('#grPlan .grdot').length}});
 const c0=await shot();
 await p.mouse.move(dot.x,dot.y);await p.mouse.down();await p.mouse.move(dot.x-40,dot.y-45,{steps:8});await p.mouse.up();await p.waitForTimeout(400);
 const after=await p.evaluate(()=>{const t=document.querySelector('#vid').currentTime,F=window.__rsGr.forms();return {f:F[window.__rsGr.at(t)],pos:window.__rsGr.pos(t)}});const c1=await shot();
 if(SHOT)await p.screenshot({path:SHOT+'-plan.png'});
 rec('Floor plan: drag a dancer to a new spot, and the group moves',dot.n===4&&after.f.shape==='custom'&&(after.pos[0][0]!==pos1[0][0]||after.pos[0][1]!==pos1[0][1])&&c0!==c1?'passed':'failed',JSON.stringify({dot,after,changed:c0!==c1}));
 /* a change on the beat at about 6 s */
 await p.evaluate(()=>{document.querySelector('#vid').currentTime=6.1});await p.waitForTimeout(500);
 await p.click('#grAdd');await p.waitForTimeout(500);
 const ch=await p.evaluate(()=>{const F=window.__rsGr.forms(),R=window.__rs,bp=60/((R.liveGrid&&R.liveGrid()&&R.liveGrid().bpm)||125);return {F:JSON.parse(JSON.stringify(F)),bp,cIn:R.S.cIn||0,msg:document.getElementById('recMsg').textContent}});
 const T=ch.F.length===2?ch.F[1].t:null,k=T!=null?(T-ch.cIn)/ch.bp:null;
 rec('Change here: a new formation from the beat nearest to now (the next shape along)',T!=null&&Math.abs(T-6.1)<ch.bp&&Math.abs(k-Math.round(k))<0.02&&ch.F[1].shape!=='custom'&&/on the beat/.test(ch.msg)?'passed':'failed',JSON.stringify(ch));
 /* the dancers walk to their new spots over 2 beats */
 const tr=await p.evaluate(T=>{const bp=60/((window.__rs.liveGrid&&window.__rs.liveGrid()&&window.__rs.liveGrid().bpm)||125),P=window.__rsGr.pos;return {before:P(T-0.05),mid:P(T+bp),end:P(T+2*bp+0.05)}},T);
 const between=tr.before.some((q,i)=>Math.abs(tr.mid[i][0]-q[0])>0.01||Math.abs(tr.mid[i][1]-q[1])>0.01)&&tr.mid.some((q,i)=>Math.abs(tr.end[i][0]-q[0])>0.01||Math.abs(tr.end[i][1]-q[1])>0.01);
 rec('…the dancers walk to the new spots over 2 beats',between?'passed':'failed',JSON.stringify(tr));
 const u2=await ui();
 rec('The changes show as a list, the one playing now marked',u2.changes.length===2&&/\*$/.test(u2.changes[1])&&!/\*$/.test(u2.changes[0])?'passed':'failed',JSON.stringify(u2.changes));
 /* tap the first change: goes there */
 await p.click('#grChanges .grch >> nth=0');await p.waitForTimeout(500);const back=await p.evaluate(()=>({t:document.querySelector('#vid').currentTime,ch:[...document.querySelectorAll('#grChanges .grch')].map(b=>b.getAttribute('aria-pressed'))}));
 rec('Tapping a change goes to it',back.t<1&&back.ch[0]==='true'?'passed':'failed',JSON.stringify(back));
 /* save the dragged shape */
 await p.click('#grSave');await p.waitForTimeout(300);const sv=await p.evaluate(()=>({ls:JSON.parse(localStorage.getItem('rs-group-shapes')||'[]'),chips:[...document.querySelectorAll('#grShapes .pchip')].map(b=>b.textContent.replace('×',''))}));
 rec('Save this shape: kept for every clip, and shows with the shapes',sv.ls.length===1&&sv.chips.includes(sv.ls[0].name)&&sv.ls[0].pos.length===4?'passed':'failed',JSON.stringify(sv));
 /* kept after reload */
 const before=await p.evaluate(()=>localStorage.getItem('rs-group-forms'));
 rec('Formations are kept (for this clip)',before&&/"t":0/.test(before)&&JSON.parse(before)&&Object.values(JSON.parse(before))[0].length===2?'passed':'failed',before&&before.slice(0,200));
 /* remove the second change */
 await p.click('#grChanges .grch >> nth=1 >> .grx');await p.waitForTimeout(300);const rm=await p.evaluate(()=>window.__rsGr.forms().length);
 rec('× removes a change',rm===1?'passed':'failed',String(rm));
 /* the circle and wedge draw without errors */
 for(const n of ['V','Wedge','Circle']){await p.click(`#grShapes .pchip:has-text("${n}")`);await p.waitForTimeout(250)}
 if(SHOT)await p.screenshot({path:SHOT+'-circle.png'});
 const cv=await p.evaluate(()=>window.__rsGr.pos(document.querySelector('#vid').currentTime));
 rec('Circle: dancers around a ring',cv.length===4&&new Set(cv.map(q=>q[1].toFixed(2))).size>=2?'passed':'failed',JSON.stringify(cv));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
