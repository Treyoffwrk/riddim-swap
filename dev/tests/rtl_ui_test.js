/* Routine timeline on a phone (real touch): a move drags to a new place straight away (no press-and-hold); grabbing a
   picked move near its end moves it rather than trimming it; a very short move can still be picked; the white tabs trim
   but never below 0.25 s, and a tap on a tab doesn't trim; ◀ Earlier / Later ▶; Undo takes each change back; zoomed in,
   dragging another move scrolls and dragging the picked one moves it.
   Usage: node rtl_ui_test.js <page> <clip> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 /* four moves, the last very short (0.3 s) */
 await p.evaluate(()=>{const R=window.__rs,S=R.S;for(const [s,e] of [[0.5,3.5],[3.5,6],[6,9.5],[9.5,9.8]]){S.markIn=s;S.markOut=e;S.markSrc=S.cur;S.markThumb='x';const b=document.getElementById('saveMove');b.disabled=false;b.click()}
   S.moves.forEach(m=>R.addToSeq(m.id));S.useSeq=true;document.getElementById('t-routine').click()});await p.waitForTimeout(800);
 await p.evaluate(()=>{const c=document.getElementById('rtlCanvas'),r=c.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-640)});await p.waitForTimeout(500);
 let box=await p.locator('#rtlCanvas').boundingBox();const cdp=await ctx.newCDPSession(p);
 const keep=async()=>{await p.evaluate(()=>{const c=document.getElementById('rtlCanvas'),r=c.getBoundingClientRect();if(r.top<450||r.bottom>780)window.scrollBy(0,r.top+r.height/2-640)});await p.waitForTimeout(150);box=await p.locator('#rtlCanvas').boundingBox()};
 const T=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:box.x+x,y:box.y+y}]});
 const drag=async(x0,y,x1,steps=14)=>{await keep();await T('touchStart',x0,y);for(let k=1;k<=steps;k++){await T('touchMove',x0+(x1-x0)*k/steps,y);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(300)};
 const tap=async(x,y)=>{await keep();await T('touchStart',x,y);await p.waitForTimeout(60);await T('touchEnd');await p.waitForTimeout(300)};
 const st=()=>p.evaluate(()=>{const R=window.__rs,S=R.S,tl=window.__rsRTL.tl;const Bs=window.__rsRTL.blocks();return {order:S.seq.map(x=>R.moveById(x.id).name),len:S.seq.map(x=>+(x.e-x.s).toFixed(3)),sel:S.seq.findIndex(x=>x.uid===S.sel),blocks:Bs.map(b=>{const r=window.__rsRTL.rect(tl,b);return [+r.x0.toFixed(1),+r.x1.toFixed(1)]}),zoomed:tl.zoomed(),t0:+tl.t0.toFixed(3),undo:!document.getElementById('rtlUndo').disabled}});
 const midY=()=>box.height/2+4, upY=30;
 let s0=await st();const cx=i=>(s0.blocks[i][0]+s0.blocks[i][1])/2;
 /* 1. drag move 1 (not picked) past move 3: it moves there, straight away */
 await drag(cx(0),midY(),s0.blocks[2][1]-6);let s1=await st();
 rec('A move drags to a new place straight away (no press-and-hold needed)',s1.order.join(',')==='Move 2,Move 3,Move 1,Move 4'&&s1.undo?'passed':'failed',JSON.stringify({before:s0.order,after:s1.order}));
 /* 2. Undo puts it back */
 await p.evaluate(()=>document.getElementById('rtlUndo').click());await p.waitForTimeout(300);let s2=await st();
 rec('Undo takes the change back',s2.order.join(',')===s0.order.join(',')?'passed':'failed',JSON.stringify(s2.order));
 /* 3. the very short move (0.3 s) can be seen and picked */
 s0=await st();await tap(cx(3)+6,midY());let s3=await st();
 rec('A very short move is still drawn at least 10 px wide and can be picked with a tap',s3.sel===3&&s0.blocks[3][1]-s0.blocks[3][0]>=10?'passed':'failed',JSON.stringify({sel:s3.sel,width:+(s0.blocks[3][1]-s0.blocks[3][0]).toFixed(1)}));
 /* 4. pick move 2; grab it near its end (above the tab) and drag: it moves, nothing is trimmed */
 await tap(cx(1),midY());s0=await st();const L0=s0.len.slice();
 await drag(s0.blocks[1][1]-8,upY,s0.blocks[0][0]+4);let s4=await st();
 rec('Grabbing a picked move near its end (not on the tab) moves it; nothing is trimmed',s4.order[0]==='Move 2'&&JSON.stringify([...s4.len].sort())===JSON.stringify([...L0].sort())?'passed':'failed',JSON.stringify({order:s4.order,len:s4.len,L0}));
 /* 5. the tab trims: drag Move 2's end tab far left: it stops at 0.25 s */
 s0=await st();const i2=s0.order.indexOf('Move 2');await tap((s0.blocks[i2][0]+s0.blocks[i2][1])/2,midY());s0=await st();
 const lenB=s0.len[i2];await tap(s0.blocks[i2][1]-1.5,midY());let s5a=await st();
 rec('A tap on a white tab doesn\'t trim',s5a.len[i2]===lenB?'passed':'failed',JSON.stringify({before:lenB,after:s5a.len[i2]}));
 await drag(s0.blocks[i2][1]-1.5,midY(),s0.blocks[i2][0]-40);let s5=await st();
 rec('Dragging a white tab trims the move, but never below 0.25 s',Math.abs(s5.len[i2]-0.25)<0.02?'passed':'failed',JSON.stringify({before:lenB,after:s5.len[i2]}));
 await p.evaluate(()=>document.getElementById('rtlUndo').click());await p.waitForTimeout(300);const s5u=await st();
 rec('…and Undo gives the length back',Math.abs(s5u.len[i2]-lenB)<0.002?'passed':'failed',JSON.stringify(s5u.len));
 /* 6. ◀ Earlier / Later ▶ on the picked move */
 s0=await st();const pick=s0.sel;const btn=async t=>{await p.evaluate(t=>{const b=[...document.querySelectorAll('#rtlInspect button')].find(b=>b.textContent.includes(t));b&&b.click()},t);await p.waitForTimeout(300)};
 await btn('Later ▶');const s6=await st();await btn('◀ Earlier');const s7=await st();
 rec('◀ Earlier / Later ▶ move the picked move one place',s6.order[pick+1]===s0.order[pick]&&s7.order.join(',')===s0.order.join(',')?'passed':'failed',JSON.stringify({s0:s0.order,later:s6.order,back:s7.order}));
 /* 7. zoomed in: dragging a move that isn't picked scrolls; dragging the picked one moves it */
 await p.evaluate(()=>{document.getElementById('rtlZoomIn').click();document.getElementById('rtlZoomIn').click();document.getElementById('rtlZoomIn').click()});await p.waitForTimeout(300);
 s0=await st();const other=s0.blocks.findIndex((b2,i)=>i!==s0.sel&&b2[1]>20&&b2[0]<box.width-20);
 const ox=Math.max(20,Math.min(box.width-20,(s0.blocks[other][0]+s0.blocks[other][1])/2));await drag(ox,midY(),ox-80);let s8=await st();
 rec('Zoomed in: dragging a move that isn\'t picked scrolls the timeline (doesn\'t move the move)',s8.zoomed&&s8.order.join(',')===s0.order.join(',')&&s8.t0!==s0.t0?'passed':'failed',JSON.stringify({t0:[s0.t0,s8.t0],order:s8.order}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
