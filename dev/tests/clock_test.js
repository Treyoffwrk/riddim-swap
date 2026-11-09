/* Beat clock (trial) and the speed graph's cog, with real pointer drags on a phone-sized page.
   Clock: shows the clip's 8-counts as slices; dragging a cut round the rim moves where that dance moment lands in the
   song (snapping to counts and "and"s), the parts either side change speed, and nothing outside the 8-count moves
   (its two ends and every moment before and after keep their place in the song, as playback itself works it out);
   the speed graph gets a flat stretch per part; Undo; the ¼×–4× limit; Back to the beat; the next 8-count; 8 parts;
   tapping a slice goes there; off in a routine.
   Cog: a quarter turn clockwise is a quarter of a doubling faster; it clicks onto round speeds with Snap; Curve tilts
   the curve through the point; arrow keys.
   Usage: node clock_test.js <page> <clip> <song>   (e.g. media/dance_hits.webm media/dembow100.wav) */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({viewport:{width:402,height:874}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(4000);
 await p.evaluate(()=>{document.getElementById('t-clip').click();document.querySelector('details[data-more="clip"]').open=true});await p.waitForTimeout(600);
 const show=async id=>{await p.evaluate(id=>{document.getElementById(id).scrollIntoView({block:'end'});window.scrollBy(0,90)},id);await p.waitForTimeout(400)};
 /* where the song is at clip moment t: normal playback's own sum, after a real seek */
 const E=async ts=>{const out=[];for(const t of ts){out.push(await p.evaluate(t=>new Promise(r=>{const R=window.__rs,v=R.v();R.S.segIdx=0;const done=()=>r(+R.expected().toFixed(4));if(Math.abs(v.currentTime-t)<1e-3)return done();v.addEventListener('seeked',done,{once:true});v.currentTime=t}),t))}return out};
 const st=()=>p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),c=R.clkCur();if(!c)return {none:true,msg:document.getElementById('clkMsg').textContent};const cuts=R.clkCuts(n,c.W);
   return {A:c.W.A,B:c.W.B,beats:c.W.beats,cuts,P:R.clkNow(c.W,cuts).map(x=>+x.toFixed(3)),which:document.getElementById('clkWhich').textContent,msg:document.getElementById('clkMsg').textContent,
     chips:[...document.querySelectorAll('#clkChips .clk-chip b')].map(x=>x.textContent),slices:document.querySelectorAll('#clkSvg [data-s]').length,curve:n.curve?JSON.stringify(n.curve.pts):'',on:!!(n.curve&&n.curve.on)}});
 const drag=async(from,to,steps=14)=>{await show('clkSvg');const box=await p.locator('#clkSvg').boundingBox();
   const at=u=>{const a=u/8*2*Math.PI-Math.PI/2,r=112/300*box.width;return [box.x+box.width/2+r*Math.cos(a),box.y+box.height/2+r*Math.sin(a)]};
   let [x,y]=at(from);await p.mouse.move(x,y);await p.mouse.down();for(let k=1;k<=steps;k++){[x,y]=at(from+(to-from)*k/steps);await p.mouse.move(x,y);await p.waitForTimeout(25)}await p.mouse.up();await p.waitForTimeout(400)};
 const near=(a,b,tol)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<tol);

 /* 1. the clock is there: 8-counts that fit in the clip, 4 parts on the beat, all at the clip's own speed */
 const s0=await st();
 rec('The clock shows the 8-count under the playhead, 4 parts, each 2 counts at 1.00×',!s0.none&&/8-count 1 of [2-9]/.test(s0.which)&&s0.slices===4&&near(s0.P,[0,2,4,6,8],0.01)&&s0.chips.every(c=>c==='1.00×')?'passed':'failed',JSON.stringify({which:s0.which,P:s0.P,chips:s0.chips,A:s0.A,B:s0.B}));
 const out0=[0.2,s0.B+0.4,s0.B+1.7,s0.B+3.1].filter(t=>t<11.8),ends0=[s0.A,s0.B];
 const before=await E([...out0,...ends0]);

 /* 2. drag the first cut from count 2 to count 3 */
 await drag(2,3.04);const s1=await st();
 rec('Dragging the first cut from 2 to 3: it lands on 3 (snapped), part 1 plays slower (0.67×), part 2 faster (2.00×)',near(s1.P,[0,3,4,6,8],0.01)&&s1.chips[0]==='0.67×'&&s1.chips[1]==='2.00×'&&s1.chips[2]==='1.00×'?'passed':'failed',JSON.stringify({P:s1.P,chips:s1.chips,msg:s1.msg}));
 const after=await E([...out0,...ends0]),atCut=(await E([s1.cuts[0]]))[0];
 rec('Song locked: the 8-count\'s two ends and every moment before and after it keep their place in the song (playback\'s own sum)',near(after,before,0.003)?'passed':'failed',JSON.stringify({before,after}));
 rec('…and the moved dance moment now plays on count 3 of the song',Math.abs(atCut-s1.beats[3])<0.006?'passed':'failed',JSON.stringify({atCut,beat3:s1.beats[3]}));
 const flat=await p.evaluate(([A,B])=>{const R=window.__rs,n=R.srcById(R.S.cur),P=n.curve.pts.filter(q=>q.t>A+1e-3&&q.t<B-1e-3);const pairs=[];for(let i=0;i+1<P.length;i+=2)pairs.push([+P[i].y.toFixed(4),+P[i+1].y.toFixed(4)]);return {on:n.curve.on,pairs}},[s1.A,s1.B]);
 rec('The speed graph is on, with one flat stretch per part (slow, fast, normal, normal)',flat.on&&flat.pairs.length===4&&flat.pairs.every(([a,b])=>a===b)&&flat.pairs[0][0]<-0.4&&flat.pairs[1][0]>0.8&&Math.abs(flat.pairs[2][0])<0.1?'passed':'failed',JSON.stringify(flat));

 /* 3. undo */
 await p.evaluate(()=>document.getElementById('clkUndo').click());await p.waitForTimeout(400);const s2=await st(),undone=await E([...out0,...ends0]);
 rec('Undo puts it back as it was (graph off again, cuts on 2 4 6)',!s2.on&&near(s2.P,[0,2,4,6,8],0.01)&&near(undone,before,0.002)?'passed':'failed',JSON.stringify({on:s2.on,P:s2.P}));

 /* 4. the limit: squeezing part 1 into under half a count would need more than 4× */
 await drag(2,0.3,20);const s3=await st(),lim=await E([...out0,...ends0]);
 const sp1=parseFloat(s3.chips[0]);
 rec('Squeezing a part past 4×: the cut stops where it can, says so, and nothing outside moves',s3.P[1]>=0.49&&s3.P[1]<2&&sp1<=4.01&&/as far as it goes/.test(s3.msg)&&near(lim,before,0.003)?'passed':'failed',JSON.stringify({P:s3.P,chips:s3.chips,msg:s3.msg}));

 /* 5. back to the beat */
 await p.evaluate(()=>document.getElementById('clkEven').click());await p.waitForTimeout(400);const s4=await st();
 rec('Back to the beat: every cut on its own count again, all parts 1.00×',near(s4.P,[0,2,4,6,8],0.01)&&s4.chips.every(c=>c==='1.00×')?'passed':'failed',JSON.stringify({P:s4.P,chips:s4.chips}));

 /* 6. the next 8-count: edit it, the first stays as it was */
 await drag(4,5);const firstEdited=await E([s0.A+0.3,(s0.A+s0.B)/2,s0.B]);
 await p.evaluate(()=>document.getElementById('clkNext').click());await p.waitForTimeout(400);const s5=await st();
 if(/of 1$/.test(s0.which)){rec('Next 8-count (the clip has only one)','passed','skipped')}
 else{await drag(6,5.5);const s6=await st(),firstAfter=await E([s0.A+0.3,(s0.A+s0.B)/2,s0.B]);
   rec('Next 8-count: it moves on, and editing it leaves the first 8-count exactly as it was',/8-count 2 of/.test(s5.which)&&Math.abs(s5.A-s0.B)<0.01&&near(s6.P,[0,2,4,5.5,8],0.01)&&near(firstAfter,firstEdited,0.003)?'passed':'failed',JSON.stringify({which:s5.which,A:s5.A,P:s6.P,firstEdited,firstAfter}))}

 /* 7. eight parts; tap a slice */
 await p.evaluate(()=>document.querySelector('[data-clkn="8"]').click());await p.waitForTimeout(400);const s7=await st();
 rec('8 parts: one slice per count',s7.slices===8&&s7.chips.length===8?'passed':'failed',JSON.stringify({slices:s7.slices,P:s7.P}));
 await p.evaluate(()=>document.querySelector('[data-clkn="4"]').click());await p.waitForTimeout(300);
 await show('clkSvg');const sl=await p.locator('#clkSvg [data-s="2"]').boundingBox();const s8=await st();
 await p.mouse.click(sl.x+sl.width/2,sl.y+sl.height/2);await p.waitForTimeout(500);const t8=await p.evaluate(()=>window.__rs.v().currentTime);
 rec('Tapping a slice goes to the start of that part',Math.abs(t8-s8.cuts[1])<0.05?'passed':'failed',JSON.stringify({t8,cut:s8.cuts[1]}));

 /* 8. the cog */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.curve={on:true,pts:[{t:0,y:0,auto:true},{t:3,y:0,auto:true},{t:6,y:-0.5,auto:true},{t:11,y:0,auto:true}]};R.SPD.sel=1;R.SPD.snap=false;R.SPD.ver++});await p.waitForTimeout(800);
 await show('spdCog');const turn=async(a0,a1)=>{const cb=await p.locator('#spdCog').boundingBox(),cx=cb.x+cb.width/2,cy=cb.y+cb.height/2,R=cb.width*0.4;
   await p.mouse.move(cx+R*Math.cos(a0),cy+R*Math.sin(a0));await p.mouse.down();for(let k=1;k<=14;k++){const a=a0+(a1-a0)*k/14;await p.mouse.move(cx+R*Math.cos(a),cy+R*Math.sin(a));await p.waitForTimeout(20)}await p.mouse.up();await p.waitForTimeout(400)};
 const pt=()=>p.evaluate(()=>{const R=window.__rs,q=R.srcById(R.S.cur).curve.pts[1];return {y:q.y,ho:q.ho,auto:q.auto,val:document.getElementById('spdCogVal').textContent,ud:R.SPD.undo.length}});
 const c0=await pt();await turn(-Math.PI/2,0);const c1=await pt();
 rec('Cog, a quarter turn clockwise: a quarter of a doubling faster (1× → 1.19×), one undo step',Math.abs(c1.y-0.25)<0.03&&c1.val==='1.19×'&&c1.ud===c0.ud+1?'passed':'failed',JSON.stringify({c0,c1}));
 await p.evaluate(()=>{window.__rs.SPD.snap=true});await turn(0,-Math.PI/2+0.12);const c2=await pt();
 rec('…turned back nearly to where it was, with Snap on it clicks onto 1×',c2.y===0&&c2.val==='1×'?'passed':'failed',JSON.stringify(c2));
 await p.evaluate(()=>document.getElementById('spdCog').focus());await p.keyboard.press('ArrowUp');await p.waitForTimeout(200);const c3=await pt();
 rec('…arrow up: 5% faster',Math.abs(Math.pow(2,c3.y)-1.05)<0.002?'passed':'failed',JSON.stringify(c3));
 await p.evaluate(()=>document.querySelector('[data-cog="curve"]').click());await p.waitForTimeout(200);await turn(-Math.PI/2,-Math.PI/2+0.6);const c4=await pt();
 rec('Cog in Curve mode, turned clockwise: the curve through the point slopes down, the point keeps its speed',c4.auto===false&&c4.ho[1]<-0.01&&Math.abs(c4.y-c3.y)<1e-9&&/Falling/.test(c4.val)?'passed':'failed',JSON.stringify(c4));
 const shot=await p.evaluate(()=>{const c=document.getElementById('spdCanvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let y=0;for(let i=0;i<d.length;i+=4)if(d[i]>240&&d[i+1]>200&&d[i+2]<90)y++;return y});
 rec('The graph draws its points as cogs (yellow drawn)',shot>200?'passed':'failed','yellow px '+shot);

 /* 9. in a routine the clock is off and says why */
 await p.evaluate(()=>{const R=window.__rs,S=R.S;S.markIn=1;S.markOut=4;S.markSrc=S.cur;S.markThumb='x';document.getElementById('saveMove').disabled=false;document.getElementById('saveMove').click()});await p.waitForTimeout(400);
 await p.evaluate(()=>{const R=window.__rs,S=R.S;S.moves.forEach(m=>R.addToSeq(m.id));S.useSeq=true;R.syncSlot&&R.syncSlot()});await p.waitForTimeout(600);const s9=await st();
 rec('In a routine the clock is off and says to switch to Clip',s9.which==='—'&&/Switch to "Clip"/.test(s9.msg)?'passed':'failed',JSON.stringify(s9));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
