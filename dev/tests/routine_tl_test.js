/* Routine timeline editor. Usage: node routine_tl_test.js <host index.html> <clip> <song> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug-closed');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* three moves, added to the routine */
 await p.click('#t-moves');
 for(const [a,c] of [[0.5,2.6],[3,5.2],[6,8.4]]){await p.evaluate(t=>{window.__rs.v().currentTime=t},a);await p.waitForTimeout(250);await p.click('#markIn');await p.evaluate(t=>{window.__rs.v().currentTime=t},c);await p.waitForTimeout(250);await p.click('#markOut');await p.click('#saveMove');await p.waitForTimeout(200)}
 await p.click('#t-routine');for(let i=0;i<3;i++){await p.locator('#tray .tcard').nth(i).click();await p.waitForTimeout(150)}
 await p.waitForTimeout(1500);
 let box,Y=0;const place=async()=>{await p.evaluate(()=>{const c=document.getElementById('rtlCanvas'),r=c.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-620)});await p.waitForTimeout(250);box=await p.locator('#rtlCanvas').boundingBox();Y=box.y+box.height*0.6;await p.evaluate(()=>window.__rs.RTL.tl.paint())};
 await place();
 const st=()=>p.evaluate(()=>{const R=window.__rs,S=R.S,L=R.segsFor();let T=0;return {ids:S.seq.map(x=>x.id),uids:S.seq.map(x=>x.uid),sel:S.sel,bounds:S.seq.map((x,i)=>{const a=T;T+=R.segLen(L[i]);return [+a.toFixed(3),+T.toFixed(3)]}),tot:R.seqTotal(),pps:R.RTL.tl.pps,t0:R.RTL.tl.t0,inspect:!document.getElementById('rtlInspect').hidden}});
 let s=await st();
 rec('The routine shows as a timeline of 3 moves over the song',await p.isVisible('#rtlCanvas')&&s.ids.length===3?'passed':'failed',JSON.stringify(s.bounds));
 const X=t=>box.x+(t-s.t0)*s.pps;
 /* tap move 2 */
 await p.mouse.click(X((s.bounds[1][0]+s.bounds[1][1])/2),Y);await p.waitForTimeout(400);s=await st();
 const btns=await p.evaluate(()=>[...document.querySelectorAll('#rtlInspect button')].map(b=>b.textContent).join(' | '));
 rec('Tapping a move picks it and shows its tools',s.sel===s.uids[1]&&s.inspect&&/Fit to beat/.test(btns)&&/Duplicate/.test(btns)?'passed':'failed',btns.slice(0,160));
 await place();await p.screenshot({path:SHOT+'-sel.png'});
 /* drag its right edge later: with Snap to beat, the move ends on a beat or an "and" */
 const beats=await p.evaluate(()=>{const R=window.__rs,S=R.S,so=S.rtSong||S.mainSong;return so.an.beats.map(b=>(b-S.rt.offset)/S.rt.ar)});
 await place();s=await st();const e0=s.bounds[1][1];await p.mouse.move(X(e0),Y);await p.mouse.down();for(let k=1;k<=10;k++){await p.mouse.move(X(e0)+k*5,Y);await p.waitForTimeout(25)}await p.mouse.up();await p.waitForTimeout(400);
 s=await st();const e1=s.bounds[1][1];const grid=[];for(let i=0;i<beats.length;i++){grid.push(beats[i]);if(beats[i+1])grid.push((beats[i]+beats[i+1])/2)}
 const off=Math.min(...grid.map(g=>Math.abs(g-e1)));
 rec('Dragging the right edge trims the move, and it snaps to the beat',e1>e0+0.05&&off<0.006?'passed':'failed',`end ${e0.toFixed(3)} → ${e1.toFixed(3)} s, ${Math.round(off*1000)} ms from the nearest beat or "and"`);
 /* press and hold move 1, drag it past move 3 */
 await place();s=await st();const firstId=s.ids[0];
 const c0=X((s.bounds[0][0]+s.bounds[0][1])/2),c3=X(s.bounds[2][1]-0.1);
 await p.mouse.move(c0,Y);await p.mouse.down();await p.waitForTimeout(450);for(let k=1;k<=12;k++){await p.mouse.move(c0+(c3-c0)*k/12,Y);await p.waitForTimeout(30)}
 await p.screenshot({path:SHOT+'-drag.png'});await p.mouse.up();await p.waitForTimeout(400);
 s=await st();
 rec('Press, hold and drag moves a move to a new place',s.ids[2]===firstId&&s.ids[0]!==firstId?'passed':'failed',`${JSON.stringify(s.ids)} (first was ${firstId})`);
 /* a quick drag scrolls instead (after zooming in) */
 await p.click('#rtlZoomIn');await p.click('#rtlZoomIn');await p.waitForTimeout(200);s=await st();const pz=s.pps,t0a=s.t0;
 await place();await p.mouse.move(box.x+box.width*0.7,Y);await p.mouse.down();for(let k=1;k<=8;k++){await p.mouse.move(box.x+box.width*0.7-k*15,Y);await p.waitForTimeout(15)}await p.mouse.up();await p.waitForTimeout(300);
 s=await st();
 rec('Zoom in, and a quick drag scrolls the timeline (doesn\'t move anything)',pz>s.tot&&s.t0>t0a+0.2&&s.ids[2]===firstId?'passed':'failed',`zoom ${(pz).toFixed(0)} px/s, scrolled ${t0a.toFixed(2)} → ${s.t0.toFixed(2)} s`);
 /* split a move at the playhead */
 await p.click('#rtlZoomOut');await p.click('#rtlZoomOut');await p.waitForTimeout(200);s=await st();
 await p.evaluate(()=>{const R=window.__rs,S=R.S;S.useSeq=true;});
 const mid=(s.bounds[1][0]+s.bounds[1][1])/2;await place();await p.mouse.click(X(mid),Y);await p.waitForTimeout(400);
 const n0=(await st()).ids.length;await p.locator('#rtlInspect button',{hasText:'Split here'}).click();await p.waitForTimeout(300);s=await st();
 rec('Split here cuts a move in two at the playhead',s.ids.length===n0+1?'passed':'failed',`${n0} → ${s.ids.length} moves`);
 rec('The list view still has them',(await p.evaluate(()=>document.querySelectorAll('#seqList li').length))===s.ids.length?'passed':'failed','');
 await place();await p.screenshot({path:SHOT+'-after.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
