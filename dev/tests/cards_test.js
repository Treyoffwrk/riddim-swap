/* Move cards (25 Nov, user: Just Dance style "still frames of a skeleton/stickman with directional arrows to show the
   movement ... a temporal thumbnail" of each move): after tracking, the Cards button opens a strip under the player with
   one card per beat of the song; each card is the tracked pose at that beat, with arrows for the hands/feet that really
   travel before the next card; Bar gives one per bar; the card playing now is lit and kept in view; tap a card to go
   there; mirrored with the clip; a routine's cards come from each move's own clip; the player doesn't grow; Ghost cards
   still draw. Usage: node cards_test.js <page> <clip> <song> <the clip with its own sound> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,CLIPA,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
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
 /* 2. each card is the tracked pose at (or just by) its beat, and its arrows match what the hands do against the body
    until the next card: the hand that moves most has an arrow, a hand that stays put has none; a big change in stance
    shows as feet arrows, a step as a floor arrow */
 const truth=await p.evaluate(()=>{const R=window.__rs,S=R.S,n=R.srcById(S.cur),B=n.body,L=window.__rsCards.list(),F=window.__rsCards.full();
   const W=B.w,H=B.h,px=q=>[q[0]*W,q[1]*H],mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let agree=0,total=0,poseOk=0,feetOk=0,feetN=0;const ex=[];
   for(let i=0;i<L.length-1;i++){const K=F[i];if(!K)continue;const P=window.__rsCards.cardAt(L[i].o),P2=window.__rsCards.cardAt(L[i+1].o);if(!P||!P2||P.i!==P2.i)continue;
     const A=RB.poseAt(B,K.t),Z=RB.poseAt(B,K.te);if(!A||!Z)continue;const sA=mid(px(A[11]),px(A[12])),sZ=mid(px(Z[11]),px(Z[12])),hA=mid(px(A[23]),px(A[24])),hZ=mid(px(Z[23]),px(Z[24]));
     const torso=Math.hypot(sA[0]-hA[0],sA[1]-hA[1]);
     const rel=j=>Math.hypot((px(Z[j])[0]-sZ[0])-(px(A[j])[0]-sA[0]),(px(Z[j])[1]-sZ[1])-(px(A[j])[1]-sA[1]))/torso;
     const hands=[15,16].map(j=>({j,d:rel(j)})).sort((a,b)=>b.d-a.d),mv=K.movers.map(m=>m[0]).filter(j=>j<17);
     total++;const big=hands[0].d>0.6?hands[0].j:null,still=hands.filter(h=>h.d<0.25).map(h=>h.j);
     /* (a back-and-forth or a circle can end where it began, so a hand with such an arrow isn't "still") */
     const ok=(big==null||mv.includes(big))&&!K.movers.some(m=>m[0]<17&&m[1]==='line'&&still.includes(m[0]));
     if(ok)agree++;else ex.push({o:+L[i].o.toFixed(2),movers:K.movers,hands:hands.map(h=>[h.j,+h.d.toFixed(2)])});
     const g0=Math.abs(px(A[27])[0]-px(A[28])[0])/torso,g1=Math.abs(px(Z[27])[0]-px(Z[28])[0])/torso;if(Math.abs(g1-g0)>0.45){feetN++;if(K.stance===(g1>g0?'open':'close'))feetOk++}
     if(L[i].hipX!=null&&Math.abs(L[i].hipX-hA[0])<0.06*W)poseOk++}
   return {agree,total,poseOk,feet:feetOk+'/'+feetN,ex:ex.slice(0,4)}});
 const [fo,fn]=truth.feet.split('/').map(Number);
 rec('Each card is the tracked pose by its beat; the hand that moves most against the body has an arrow, none on a hand that stays put; a big change in stance shows as feet arrows',truth.total>=10&&truth.agree>=0.9*truth.total&&truth.poseOk>=0.9*truth.total&&fo>=0.8*fn?'passed':'failed',JSON.stringify(truth));
 if(SHOT){await p.evaluate(()=>document.getElementById('cardBar').scrollIntoView({block:'center'}));await p.waitForTimeout(400);await p.screenshot({path:SHOT+'-strip.png'})}
 /* 3. the card playing now is lit and in view; tap a card to go there */
 await p.evaluate(()=>{document.getElementById('play').click()});await p.waitForTimeout(1500);
 /* sample a few moments while playing: the lit card is the one for now (at most 0.1 s behind the beat) */
 const samples=[];for(let k=0;k<6;k++){samples.push(await p.evaluate(()=>{const o=window.__rs.tPos(),L=window.__rsCards.list(),i=L.findIndex(c=>c.on);let want=-1;for(let k=0;k<L.length;k++)if(L[k].o<=o-0.1)want=k;let want2=-1;for(let k=0;k<L.length;k++)if(L[k].o<=o+0.02)want2=k;return {o:+o.toFixed(2),i,ok:i>=want&&i<=want2}}));await p.waitForTimeout(230)}
 /* pause, and the lit card is in view once the strip has glided to it */
 await p.evaluate(()=>{document.getElementById('play').click()});await p.waitForTimeout(900);
 const inView=await p.evaluate(()=>{const row=document.getElementById('cardRow'),b=row.querySelector('.mcard.on');if(!b)return false;const r=b.getBoundingClientRect(),rr=row.getBoundingClientRect();return r.left>=rr.left-1&&r.right<=rr.right+1});
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
 /* 8. the clip's own sound (no song loaded, as the user had it): cards on its beats */
 await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();await p.setInputFiles('#vidFile',CLIPA);await p.waitForTimeout(2500);
 await p.waitForFunction(()=>!document.getElementById('bodyTrack').disabled,null,{timeout:60000});await p.evaluate(()=>document.getElementById('bodyTrack').click());
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 await p.evaluate(()=>document.getElementById('dkCards').click());let A=null;for(let i=0;i<30;i++){await p.waitForTimeout(500);A=await p.evaluate(()=>({info:document.getElementById('cardInfo').textContent,L:window.__rsCards.list().map(c=>c.o)}));if(/clip's sound/.test(A.info))break}
 const ag=A.L.slice(1).map((o,i)=>o-A.L[i]),amed=ag.slice().sort((a,b)=>a-b)[ag.length>>1];
 rec('No song, the clip\'s own sound: a card on every beat of it (100 BPM: 0.6 s apart), and it says so',/clip's sound/.test(A.info)&&Math.abs(amed-0.6)<0.03&&A.L.length>=20?'passed':'failed',JSON.stringify({info:A.info,cards:A.L.length,gap:+(amed||0).toFixed(3)}));
 /* 9. each card is a held pose near its beat: the arms and legs move less at the card's moment than on the beat itself */
 const held=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body,F=window.__rsCards.full(),L=window.__rsCards.list();const sp=t=>{const a=RB.poseAt(B,t-1/30),z=RB.poseAt(B,t+1/30);let s=0;for(const j of [13,14,15,16,25,26,27,28])s+=Math.hypot((z[j][0]-a[j][0])*B.w,(z[j][1]-a[j][1])*B.h);return s};
   let s0=0,s1=0,nn=0,maxOff=0;F.forEach((K,i)=>{if(!K)return;const P=window.__rsCards.cardAt(L[i].o);s0+=sp(P.t);s1+=sp(K.t);nn++;maxOff=Math.max(maxOff,Math.abs(K.t-P.t))});return {onBeat:+(s0/nn).toFixed(2),atCard:+(s1/nn).toFixed(2),maxOff:+maxOff.toFixed(3),rolls:window.__rsCards.rolls()}});
 rec('Each card is the held pose near its beat (limbs slower there than on the beat; never more than a quarter beat away)',held.atCard<0.75*held.onBeat&&held.maxOff<=0.6*0.23?'passed':'failed',JSON.stringify(held));
 /* 10. on the video: the card track (beside the picture when there's room), and the arrows on the dancer */
 const px=()=>p.evaluate(()=>{const c=document.getElementById('cardCv');if(!c||!c.width)return {w:0};const x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data,st=document.getElementById('stage').getBoundingClientRect(),vr=window.__rs.v().getBoundingClientRect(),R=RB.containRect(vr.width,vr.height,window.__rs.v().videoWidth,window.__rs.v().videoHeight),k=c.width/st.width;
   const vx0=(vr.left-st.left+R.x)*k,vx1=vx0+R.w*k;let inV=0,right=0,yellow=0;for(let y=0;y<c.height;y+=2)for(let xx=0;xx<c.width;xx+=2){const i=(y*c.width+xx)*4;if(d[i+3]<40)continue;if(xx>vx1+4)right++;else if(xx>vx0&&xx<vx1){inV++;if(d[i]>200&&d[i+1]>170&&d[i+2]<120)yellow++}}return {w:c.width,inV,right,yellow}});
 await p.evaluate(()=>{window.__rs.seekT(5.6)});await p.waitForTimeout(700);const tr=await px();
 await p.evaluate(()=>document.getElementById('cardDancer').click());await p.waitForTimeout(150);
 let on=null;for(const t of [2.0,3.4,5.6,8.4,10.6]){await p.evaluate(t=>window.__rs.seekT(t),t);await p.waitForTimeout(600);const q=await px();if(!on||q.yellow>on.yellow)on=q}
 rec('Cards on the video: the track runs beside the picture (portrait clip), not over the dancer',tr.w>0&&tr.right>200&&tr.inV<50?'passed':'failed',JSON.stringify(tr));
 rec('Arrows on the dancer: the next move\'s arrows are drawn on the dancer in the video',on.yellow>40&&on.inV>tr.inV+40?'passed':'failed',JSON.stringify({off:tr.inV,on}));
 if(SHOT){await p.evaluate(()=>document.getElementById('stage').scrollIntoView({block:'start'}));await p.screenshot({path:SHOT+'-video.png'})}
 /* the same switch is in the Body options */
 const chip=await p.evaluate(()=>{const c=document.getElementById('pracArrows');const a=c.getAttribute('aria-pressed');c.click();const b2=c.getAttribute('aria-pressed');const d=document.getElementById('cardDancer').getAttribute('aria-pressed');c.click();return {a,b:b2,d}});
 rec('"Arrows on dancer" is also in the Body options (the same setting)',chip.a==='true'&&chip.b==='false'&&chip.d==='false'?'passed':'failed',JSON.stringify(chip));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
