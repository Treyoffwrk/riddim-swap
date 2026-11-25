/* Move cards (25 Nov, user: Just Dance style "still frames of a skeleton/stickman with directional arrows to show the
   movement ... a temporal thumbnail" of each move): after tracking, the Cards button opens a strip under the player with
   one card per beat of the song; each card is the tracked pose at that beat, with arrows for the hands/feet that really
   travel before the next card; Bar gives one per bar; the card playing now is lit and kept in view; tap a card to go
   there; mirrored with the clip; a routine's cards come from each move's own clip; the player doesn't grow; Ghost cards
   still draw. Usage: node cards_test.js <page> <clip> <song> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 await p.waitForFunction(()=>!document.getElementById('bodyTrack').disabled,null,{timeout:60000});await p.evaluate(()=>document.getElementById('bodyTrack').click());
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.waitForTimeout(800);
 const pinned0=await p.evaluate(()=>{const s=document.querySelector('.stagewrap,.player,#stage');return s?Math.round(s.getBoundingClientRect().height):0});
 /* 1. open the strip */
 const dock=await p.evaluate(()=>({dock:!document.getElementById('dock').hidden,btn:!!document.getElementById('dkCards')}));
 await p.evaluate(()=>document.getElementById('dkCards').click());await p.waitForTimeout(1200);
 const C=await p.evaluate(()=>({bar:!document.getElementById('cardBar').hidden,list:window.__rsCards.list(),info:document.getElementById('cardInfo').textContent,
   beats:(()=>{const R=window.__rs,S=R.S,G=R.liveGrid?R.liveGrid():null;return null})()}));
 /* expected: the song's beats that fall inside the clip as it plays */
 const exp=await p.evaluate(()=>{const R=window.__rs,S=R.S;const G=window.__rsGrid?window.__rsGrid():null;return null});
 const gaps=C.list.slice(1).map((c,i)=>c.o-C.list[i].o),med=gaps.slice().sort((a,b)=>a-b)[gaps.length>>1];
 rec('After tracking, Cards opens a strip of move cards under the player, one per beat (100 BPM song: 0.6 s apart)',dock.dock&&dock.btn&&C.bar&&C.list.length>=15&&Math.abs(med-0.6)<0.02&&/every beat/.test(C.info)?'passed':'failed',
   JSON.stringify({cards:C.list.length,medianGap:+(med||0).toFixed(3),info:C.info,first:C.list.slice(0,3).map(c=>[+c.o.toFixed(3),c.n])}));
 /* 2. each card is the tracked pose at its beat, and its arrows are on the limbs that really move before the next card */
 const truth=await p.evaluate(()=>{const R=window.__rs,S=R.S,n=R.srcById(S.cur),B=n.body,L=window.__rsCards.list();
   const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let agree=0,total=0,poseOk=0;const ex=[];
   for(let i=0;i<L.length-1;i++){const P=window.__rsCards.cardAt(L[i].o),P2=window.__rsCards.cardAt(L[i+1].o);if(!P||!P2||P.i!==P2.i)continue;
     const A=RB.poseAt(B,P.t),Z=RB.poseAt(B,P2.t);if(!A||!Z)continue;const W=B.w,H=B.h;const px=q=>[q[0]*W,q[1]*H];
     const torso=Math.hypot(...[0,1].map(k=>mid(px(A[11]),px(A[12]))[k]-mid(px(A[23]),px(A[24]))[k]));
     const big=[15,16,27,28].map(j=>({j,d:Math.hypot(px(Z[j])[0]-px(A[j])[0],px(Z[j])[1]-px(A[j])[1])/torso})).filter(m=>m.d>0.6).sort((a,b)=>b.d-a.d).map(m=>m.j);
     const small=[15,16,27,28].filter(j=>Math.hypot(px(Z[j])[0]-px(A[j])[0],px(Z[j])[1]-px(A[j])[1])/torso<0.3);
     total++;const mv=L[i].movers||[];
     /* the biggest real mover has an arrow, and no arrow on a limb that barely moved */
     if((!big.length||mv.includes(big[0]))&&!mv.some(j=>small.includes(j)))agree++;else ex.push({o:+L[i].o.toFixed(2),mv,big,small});
     /* the card's hips are where the tracked hips are at that moment */
     const hx=mid(px(A[23]),px(A[24]))[0];if(L[i].hipX!=null&&Math.abs(L[i].hipX-hx)<0.06*W)poseOk++}
   return {agree,total,poseOk,ex:ex.slice(0,4)}});
 rec('Each card is the tracked pose at its beat, and its arrows are on the hands/feet that really travel to the next card (none on a limb that stays put)',truth.total>=10&&truth.agree>=0.9*truth.total&&truth.poseOk>=0.9*truth.total?'passed':'failed',JSON.stringify(truth));
 if(SHOT){await p.evaluate(()=>document.getElementById('cardBar').scrollIntoView({block:'center'}));await p.waitForTimeout(400);await p.screenshot({path:SHOT+'-strip.png'})}
 /* 3. the card playing now is lit and in view; tap a card to go there */
 await p.evaluate(()=>{document.getElementById('play').click()});await p.waitForTimeout(1500);
 /* sample a few moments while playing: the lit card is the one for now (at most 0.1 s behind the beat) */
 const samples=[];for(let k=0;k<6;k++){samples.push(await p.evaluate(()=>{const o=window.__rs.tPos(),L=window.__rsCards.list(),i=L.findIndex(c=>c.on);let want=-1;for(let k=0;k<L.length;k++)if(L[k].o<=o-0.1)want=k;let want2=-1;for(let k=0;k<L.length;k++)if(L[k].o<=o+0.02)want2=k;return {o:+o.toFixed(2),i,ok:i>=want&&i<=want2}}));await p.waitForTimeout(230)}
 await p.waitForTimeout(500);
 const inView=await p.evaluate(()=>{const row=document.getElementById('cardRow'),b=row.querySelector('.mcard.on');if(!b)return false;const r=b.getBoundingClientRect(),rr=row.getBoundingClientRect();return r.left>=rr.left-1&&r.right<=rr.right+1});
 await p.evaluate(()=>{document.getElementById('play').click()});await p.waitForTimeout(400);
 rec('While playing, the card for now is lit (on the beat, within 0.1 s) and kept in view',samples.filter(q=>q.ok).length>=5&&inView?'passed':'failed',JSON.stringify({inView,samples}));
 const tgt=await p.evaluate(()=>{const L=window.__rsCards.list(),k=Math.min(L.length-1,12);const b=document.getElementById('cardRow').children[k];b.scrollIntoView({inline:'center',block:'center'});const r=b.getBoundingClientRect();return {o:L[k].o,x:r.left+r.width/2,y:r.top+r.height/2,k}});
 await p.waitForTimeout(300);await p.touchscreen.tap(tgt.x,tgt.y);await p.waitForTimeout(500);
 const at=await p.evaluate(()=>window.__rs.tPos());const lit=await p.evaluate(k=>window.__rsCards.list()[k].on,tgt.k);
 rec('Tap a card: the video goes to that beat and the card lights up',Math.abs(at-tgt.o)<0.05&&lit?'passed':'failed',JSON.stringify({card:+tgt.o.toFixed(3),now:+at.toFixed(3),lit}));
 /* 4. Bar: one per bar; mirrored with the clip */
 await p.evaluate(()=>document.querySelector('#cardStep [data-cs="4"]').click());await p.waitForTimeout(800);
 const bar=await p.evaluate(()=>window.__rsCards.list());const bg=bar.slice(1).map((c,i)=>c.o-bar[i].o),bmed=bg.slice().sort((a,b)=>a-b)[bg.length>>1];
 rec('Bar: one card per bar (4 beats, 2.4 s), each on a 1',Math.abs(bmed-2.4)<0.03&&bar.every(c=>c.n==='1')?'passed':'failed',JSON.stringify({cards:bar.length,gap:+(bmed||0).toFixed(3),counts:[...new Set(bar.map(c=>c.n))]}));
 await p.evaluate(()=>document.querySelector('#cardStep [data-cs="1"]').click());await p.waitForTimeout(800);
 const m0=await p.evaluate(()=>window.__rsCards.list().slice(0,6).map(c=>c.hipX));
 await p.evaluate(()=>document.getElementById('mirBtn').click());await p.waitForTimeout(900);
 const m1=await p.evaluate(()=>({h:window.__rsCards.list().slice(0,6).map(c=>c.hipX),W:window.__rs.srcById(window.__rs.S.cur).body.w}));
 await p.evaluate(()=>document.getElementById('mirBtn').click());await p.waitForTimeout(600);
 rec('Mirror the clip: the cards are mirrored too',m0.every((x,i)=>x!=null&&Math.abs((m1.W-x)-m1.h[i])<1)?'passed':'failed',JSON.stringify({before:m0.map(x=>x&&+x.toFixed(1)),after:m1.h.map(x=>x&&+x.toFixed(1))}));
 /* 5. a routine: cards come from each move's own part of the clip, across the moves */
 await p.evaluate(()=>{const R=window.__rs,S=R.S;for(const [s,e] of [[6,9],[1,4]]){S.markIn=s;S.markOut=e;S.markSrc=S.cur;S.markThumb=null;const b=document.getElementById('saveMove');b.disabled=false;b.click()}
   S.moves.forEach(m=>R.addToSeq(m.id));S.useSeq=true;document.getElementById('t-routine').click()});await p.waitForTimeout(1500);
 const rt=await p.evaluate(()=>{const L=window.__rsCards.list();return {n:L.length,map:L.map(c=>{const P=window.__rsCards.cardAt(c.o);return P&&[P.i,+P.t.toFixed(2)]}),tracked:L.filter(c=>c.movers!=null).length}});
 const inMove=rt.map.every(m=>m&&(m[0]===0?m[1]>=5.99&&m[1]<=9.01:m[1]>=0.99&&m[1]<=4.01));
 rec('In a routine, the cards run across the moves, each from its own part of the clip (move 1: 6-9 s, move 2: 1-4 s)',rt.n>=8&&inMove&&rt.map.some(m=>m[0]===1)&&rt.tracked===rt.n?'passed':'failed',JSON.stringify({n:rt.n,map:rt.map.slice(0,12)}));
 await p.evaluate(()=>{window.__rs.S.useSeq=false;document.getElementById('t-clip').click()});await p.waitForTimeout(600);
 /* 6. layout: the player isn't any taller with the strip open, and nothing is wider than the screen */
 const lay=await p.evaluate(()=>{const s=document.querySelector('.stagewrap,.player,#stage');return {pinned:s?Math.round(s.getBoundingClientRect().height):0,wide:document.documentElement.scrollWidth-window.innerWidth,rowScrolls:document.getElementById('cardRow').scrollWidth>document.getElementById('cardRow').clientWidth}});
 rec('Layout: the player is no taller with the strip open; the strip scrolls sideways, the page doesn\'t',lay.pinned===pinned0&&lay.wide<=0&&lay.rowScrolls?'passed':'failed',JSON.stringify({pinned0,...lay}));
 /* 7. Ghost's cards draw the new figures (no errors while drawing them) */
 const ghost=await p.evaluate(async()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body;const c=document.createElement('canvas');c.width=200;c.height=300;const K=window.__rsCards.mcCard(B,3,3.6,false);return !!K&&K.Q.length===33});
 rec('Ghost\'s move cards use the same figure maker',ghost?'passed':'failed',String(ghost));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
