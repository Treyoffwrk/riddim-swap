/* Dragging the play bar while it plays: the clip carries on from where you let go and the song follows it, on a plain
   clip and on a clip with a part cut out (the user's case: dragging back jumped forward to where the song still was).
   Usage: node scrub_test.js <page> <clip> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(4000);
 const st=()=>p.evaluate(()=>{const R=window.__rs,v=document.querySelector('#stage video:not(.off)'),a=document.querySelector('audio');return {vt:+v.currentTime.toFixed(2),pos:+document.getElementById('scrub').value,drift:+(a.currentTime-R.expected()).toFixed(3),playing:R.S.playing,seg:R.segMode()}});
 /* a finger drag on the bar: down, a run of positions to the target, up */
 const drag=async(from,to)=>{await p.evaluate(()=>document.getElementById('scrub').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));
   for(let k=1;k<=8;k++){const x=from+(to-from)*k/8;await p.evaluate(x=>{const s=document.getElementById('scrub');s.value=x;s.dispatchEvent(new Event('input',{bubbles:true}))},x);await p.waitForTimeout(60)}
   await p.waitForTimeout(150);await p.evaluate(()=>{const s=document.getElementById('scrub');s.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}))})};
 const run=async(label,start,back,fwd)=>{
   await p.evaluate(t=>{const R=window.__rs;R.S.segIdx=0;document.getElementById('scrub').value=t;document.getElementById('scrub').dispatchEvent(new Event('input',{bubbles:true}))},start);await p.waitForTimeout(500);
   await p.click('#play');await p.waitForTimeout(2600);
   const before=await st();
   await drag(before.pos,back);const t0=Date.now();
   const after=[];for(let i=0;i<8;i++){await p.waitForTimeout(250);after.push(await st())}
   const el=(Date.now()-t0)/1000,last=after[after.length-1],want=back+el;
   const okBack=after.every(x=>x.pos<back+el+0.6&&x.pos>back-0.2)&&Math.abs(last.pos-want)<0.6&&Math.abs(last.drift)<0.15&&last.playing;
   rec(label+': dragged back while playing, it plays on from there and the song follows',okBack?'passed':'failed',JSON.stringify({before:before.pos,back,want:+want.toFixed(2),after:after.map(x=>x.pos),drift:after.map(x=>x.drift),seg:last.seg}));
   /* and forward */
   await drag(last.pos,fwd);const t1=Date.now();const af=[];for(let i=0;i<6;i++){await p.waitForTimeout(250);af.push(await st())}
   const e2=(Date.now()-t1)/1000,l2=af[af.length-1];
   rec(label+': dragged forward, same',Math.abs(l2.pos-(fwd+e2))<0.6&&Math.abs(l2.drift)<0.15&&af.every(x=>x.pos>fwd-0.2)?'passed':'failed',JSON.stringify({fwd,want:+(fwd+e2).toFixed(2),after:af.map(x=>x.pos),drift:af.map(x=>x.drift)}));
   await p.click('#play');await p.waitForTimeout(400)};
 await run('Plain clip',1,2,6);
 /* cut a part out (split at 0.8 s, turn the first part off) */
 await p.evaluate(()=>{document.querySelector('#stage video:not(.off)').currentTime=0.8});await p.waitForTimeout(400);
 await p.evaluate(()=>{document.getElementById('cutSplit').click()});await p.waitForTimeout(300);
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.pieces[0].on=false;window.__rs.CUT&&0});
 await p.evaluate(()=>{const CUT=window.__rs.CUT;CUT.sel=0;document.getElementById('cutToggle').click()});await p.waitForTimeout(400);
 const seg=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {seg:window.__rs.segMode(),pieces:n.pieces.map(q=>[q.s,q.e,q.on])}});
 if(!seg.seg)await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.pieces[0].on=false});
 const seg2=await p.evaluate(()=>window.__rs.segMode());
 rec('Set-up: the clip now has a part cut out',seg2?'passed':'failed',JSON.stringify(seg));
 await run('Clip with a part cut out',0.5,2,6);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
