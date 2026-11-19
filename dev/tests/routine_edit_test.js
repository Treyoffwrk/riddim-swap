/* Routine editing (19 Nov, user: "Routine ... lacks most of the editing features I'd added to normal clip mode. Speed
   curve isn't present and I'd also like to make cuts to delete a moment in a video that's been compiled with others.
   Refine the editing features. It looks janky"):
   - a move's own speed graph: the speed graph card opens in the picked move's panel, edits only that move, playback
     follows it (the video really plays at the graph's speed), it's saved, Duplicate keeps it, Clip mode keeps its own;
   - cut a moment: inside one move, and across two moves; what's either side plays exactly as before and comes in that
     much earlier; an aligned move keeps its alignment either side; Undo brings it all back; real touch on the red edge;
   - ✂ Split at the playhead; the toolbar on one line; nothing wider than the screen.
   Usage: node routine_edit_test.js <page> <clip> <song> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 await p.evaluate(()=>{const R=window.__rs,S=R.S;for(const [s,e] of [[0.5,3.5],[3.5,6],[6,9.5],[9.5,12]]){S.markIn=s;S.markOut=e;S.markSrc=S.cur;S.markThumb=null;const b=document.getElementById('saveMove');b.disabled=false;b.click()}
   S.moves.forEach(m=>R.addToSeq(m.id));S.useSeq=true;document.getElementById('t-routine').click()});await p.waitForTimeout(1200);
 /* the routine as played: each move's routine start/end and its source range; a routine moment -> [uid, clip time] */
 const st=()=>p.evaluate(()=>{const R=window.__rs,S=R.S;const Bs=window.__rsRTL.blocks();return {n:S.seq.length,tot:+Bs.reduce((t,b)=>Math.max(t,b.b),0).toFixed(4),
   B:Bs.map(b=>({uid:b.x.uid,a:+b.a.toFixed(4),b:+b.b.toFixed(4),s:b.x.s,e:b.x.e,k:!!b.g.k,curve:!!(b.x.curve&&b.x.curve.on),warpOk:R.warpOk?R.warpOk(b.x):null}))}});
 const srcAt=(T)=>p.evaluate(T=>T.map(t=>{const Bs=window.__rsRTL.blocks();const b=Bs.find(q=>t>=q.a-1e-6&&t<q.b)||Bs[Bs.length-1];return [b.x.uid,+window.__rsToSrc(b.g,t-b.a).toFixed(4)]}),T);
 await p.evaluate(()=>{window.__rsToSrc=(g,o)=>{/* same as playback's toSrc */const k=g.k;if(!k)return g.s+Math.max(0,Math.min(o*g.r,g.e-g.s));if(o<=0)return k[0][0];for(let i=1;i<k.length;i++)if(o<=k[i][1]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return s1+(o-o1)*(s2-s1)/((o2-o1)||1)}return k[k.length-1][0]}});
 const box=async()=>p.locator('#rtlCanvas').boundingBox();
 const tapMove=async i=>{await p.evaluate(()=>document.getElementById('rtlCanvas').scrollIntoView({block:'center'}));await p.waitForTimeout(250);const B=await box();
   const cx=await p.evaluate(i=>{const tl=window.__rsRTL.tl,b=window.__rsRTL.blocks()[i],r=window.__rsRTL.rect(tl,b);return (r.x0+r.x1)/2},i);await p.touchscreen.tap(B.x+cx,B.y+B.height/2);await p.waitForTimeout(500)};
 const s0=await st();
 /* ---------- 1. a move's own speed graph ---------- */
 await tapMove(1);await p.evaluate(()=>document.querySelector('#rtlInspect [data-pane="speed"]').click());await p.waitForTimeout(500);
 const host=await p.evaluate(()=>({inPanel:!!document.querySelector('#rtlInspect #spdCard'),visible:document.getElementById('spdCard').offsetParent!==null,title:document.getElementById('h-spd').textContent,mv:window.__rsRTL.spdT()&&window.__rsRTL.spdT().mv}));
 rec('Pick a move → Speed graph: the speed graph opens in the move\'s panel, titled with the move',host.inPanel&&host.visible&&host.mv&&/Move 2/.test(host.title)?'passed':'failed',JSON.stringify(host));
 const pre1=await srcAt([1.0,2.0,9.0]);   /* moments in move 1 and move 4 */
 await p.evaluate(()=>{window.__rs.v().currentTime=4.75;document.querySelector('[data-spd="slowmo"]').click()});await p.waitForTimeout(500);
 const s1=await st();const post1=await srcAt([1.0,2.0]);
 const clipCurve=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !!(n.curve&&n.curve.on)});
 const d1=+(s1.B[1].b-s1.B[1].a-(s0.B[1].b-s0.B[1].a)).toFixed(3),d4=+(s1.B[3].a-s0.B[3].a).toFixed(3);
 rec('"Slow-mo here" on that move: only it gets longer (its graph drives its time map); moves before it are untouched, later ones come in later by exactly that much',
   s1.B[1].curve&&s1.B[1].k&&!s1.B[0].k&&!s1.B[2].k&&!s1.B[3].k&&d1>0.3&&Math.abs(d4-d1)<0.002&&JSON.stringify(post1)===JSON.stringify(pre1.slice(0,2))&&!clipCurve?'passed':'failed',
   JSON.stringify({longerBy:d1,move4Later:d4,clipGraphOn:clipCurve}));
 /* playback really follows it: play from the start of move 2 and compare the video with the time map */
 const play=await p.evaluate(async()=>{const R=window.__rs,S=R.S,Bs=window.__rsRTL.blocks(),b=Bs[1];document.getElementById('rtlCanvas').scrollIntoView({block:'center'});
   R.seekT(b.a+0.05);await new Promise(r=>setTimeout(r,500));document.getElementById('play').click();const out=[];
   for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,300));const t=R.tPos();if(S.segIdx!==1)continue;out.push([+(R.v().currentTime).toFixed(3),+window.__rsToSrc(b.g,t-b.a).toFixed(3),+R.v().playbackRate.toFixed(3)])}
   document.getElementById('play').click();return out});
 const worst=play.length?Math.max(...play.map(q=>Math.abs(q[0]-q[1]))):9,slow=play.some(q=>q[2]<0.6);
 rec('Playing the routine: the video follows that move\'s graph (where the video is matches the time map; it slows down at the slow-mo)',play.length>=3&&worst<0.2&&slow?'passed':'failed',JSON.stringify({worst:+worst.toFixed(3),samples:play}));
 /* duplicate keeps it; saved after reloading; Clip mode has its own graph */
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#rtlInspect .rtl-tools button')].find(b=>b.textContent==='Duplicate');b.click()});await p.waitForTimeout(500);
 const s2=await st();
 rec('Duplicate keeps the move\'s speed graph',s2.n===5&&s2.B[2].curve&&Math.abs((s2.B[2].b-s2.B[2].a)-(s1.B[1].b-s1.B[1].a))<0.002?'passed':'failed',JSON.stringify(s2.B.map(q=>q.curve)));
 await p.evaluate(()=>{const b=document.getElementById('rtlUndo');b.click()});await p.waitForTimeout(400);
 await p.waitForTimeout(2500);await p.reload();await p.waitForTimeout(4000);await p.evaluate(()=>{window.__rsToSrc=window.__rsToSrc||null});
 await p.evaluate(()=>{window.__rsToSrc=(g,o)=>{const k=g.k;if(!k)return g.s+Math.max(0,Math.min(o*g.r,g.e-g.s));if(o<=0)return k[0][0];for(let i=1;i<k.length;i++)if(o<=k[i][1]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return s1+(o-o1)*(s2-s1)/((o2-o1)||1)}return k[k.length-1][0]};document.getElementById('t-routine').click()});await p.waitForTimeout(800);
 const s3=await st();
 rec('Saved: after reopening, the move still has its graph and the routine is the same length',s3.n===4&&s3.B[1].curve&&Math.abs(s3.tot-s1.tot)<0.002?'passed':'failed',JSON.stringify({tot:[s1.tot,s3.tot],n:s3.n}));
 await p.evaluate(()=>{document.getElementById('t-clip').click()});await p.waitForTimeout(500);
 const home=await p.evaluate(()=>({inClip:!!document.querySelector('#p-clip #spdCard'),mv:window.__rs.S.useSeq?null:(window.__rsRTL.spdT()||{}).mv}));
 await p.evaluate(()=>{window.__rs.S.useSeq=true;document.getElementById('t-routine').click()});await p.waitForTimeout(500);
 rec('Back in Clip, the speed graph card is home again (and edits the clip, not a move)',home.inClip?'passed':'failed',JSON.stringify(home));
 /* ---------- 2. cut a moment ---------- */
 const c0=await st();
 /* inside move 3 (routine 6.2 .. 6.9 is inside it after the slow-mo move) */
 const m3=c0.B[2],A=+(m3.a+0.6).toFixed(3),Bc=+(m3.a+1.4).toFixed(3);
 const before=await srcAt([0.5,A-0.2,Bc+0.3,c0.tot-0.2]);
 await p.evaluate(([a,b])=>{window.__rs.S.sel=null;const RT=window.__rsRTL;document.getElementById('rtlCutMode').click();RT.cut.a=a;RT.cut.b=b;document.getElementById('rtlCutGo').click()},[A,Bc]);await p.waitForTimeout(500);
 const c1=await st();const L=Bc-A;const after=await srcAt([0.5,A-0.2,Bc+0.3-L,c0.tot-0.2-L]);
 rec('Cut a moment inside one move: it becomes two pieces, the routine is exactly that much shorter, and what\'s either side plays the same frames (just earlier after the cut)',
   c1.n===c0.n+1&&Math.abs(c0.tot-c1.tot-L)<0.003&&before.every((q,i)=>Math.abs(q[1]-after[i][1])<0.003)?'passed':'failed',JSON.stringify({moves:[c0.n,c1.n],shorter:+(c0.tot-c1.tot).toFixed(4),want:L,before,after}));
 /* across two moves: from the end of move 1 into the slow-mo move */
 const m1=c1.B[0],m2=c1.B[1],A2=+(m1.b-0.5).toFixed(3),B2=+(m2.a+0.4).toFixed(3);
 const bef2=await srcAt([0.3,A2-0.1,B2+0.2,m2.b-0.1,c1.tot-0.1]);
 await p.evaluate(([a,b])=>{const RT=window.__rsRTL;document.getElementById('rtlCutMode').click();RT.cut.a=a;RT.cut.b=b;document.getElementById('rtlCutGo').click()},[A2,B2]);await p.waitForTimeout(500);
 const c2=await st();const L2=B2-A2;const aft2=await srcAt([0.3,A2-0.1,B2+0.2-L2,m2.b-0.1-L2,c1.tot-0.1-L2]);
 rec('Cut across two moves (into the one with a speed graph): both keep their outer parts, the graph move keeps its speed graph and its timing',
   c2.n===c1.n&&Math.abs(c1.tot-c2.tot-L2)<0.003&&c2.B[1].curve&&bef2.every((q,i)=>Math.abs(q[1]-aft2[i][1])<0.003)?'passed':'failed',JSON.stringify({moves:[c1.n,c2.n],shorter:+(c1.tot-c2.tot).toFixed(4),want:+L2.toFixed(4),bef2,aft2}));
 await p.evaluate(()=>{document.getElementById('rtlUndo').click();document.getElementById('rtlUndo').click()});await p.waitForTimeout(500);
 const c3=await st();
 rec('Undo twice: the routine is exactly as before both cuts',c3.n===c0.n&&Math.abs(c3.tot-c0.tot)<1e-4&&JSON.stringify(c3.B.map(q=>[q.s,q.e]))===JSON.stringify(c0.B.map(q=>[q.s,q.e]))?'passed':'failed',JSON.stringify({tot:[c0.tot,c3.tot]}));
 /* an aligned move keeps its alignment either side of a cut */
 const w0=await p.evaluate(()=>{const R=window.__rs,S=R.S,x=S.seq[3];x.warp=[[x.s,0],[x.s+0.8,0.9],[x.s+1.6,1.6],[x.e,(x.e-x.s)*1.05]];x.warpR=R.rateOf(x);S.rt.alignOn=true;R.renderMoves&&R.renderMoves();return true});
 const a0=await st();const m4=a0.B[3],A3=+(m4.a+0.5).toFixed(3),B3=+(m4.a+1.2).toFixed(3);const bef3=await srcAt([A3-0.2,B3+0.3]);
 await p.evaluate(([a,b])=>{const RT=window.__rsRTL;document.getElementById('rtlCutMode').click();RT.cut.a=a;RT.cut.b=b;document.getElementById('rtlCutGo').click()},[A3,B3]);await p.waitForTimeout(500);
 const a1=await st();const aft3=await srcAt([A3-0.2,B3+0.3-(B3-A3)]);
 rec('An aligned move cut in the middle: both pieces stay aligned and play the same frames',a1.B[3].warpOk&&a1.B[4].warpOk&&Math.abs(a0.tot-a1.tot-(B3-A3))<0.003&&bef3.every((q,i)=>Math.abs(q[1]-aft3[i][1])<0.003)?'passed':'failed',JSON.stringify({warpOk:[a1.B[3].warpOk,a1.B[4].warpOk],bef3,aft3}));
 await p.evaluate(()=>{document.getElementById('rtlUndo').click();const S=window.__rs.S;S.rt.alignOn=false;delete S.seq[3].warp});await p.waitForTimeout(400);
 /* real touch: start cutting, drag the red right edge further right; Cancel leaves the routine alone */
 await p.evaluate(()=>{window.__rs.seekT(1.0);document.getElementById('rtlCutMode').click();document.getElementById('rtlCanvas').scrollIntoView({block:'center'})});await p.waitForTimeout(400);
 const B=await box();const cut0=await p.evaluate(()=>({...window.__rsRTL.cut,xb:window.__rsRTL.tl.X(window.__rsRTL.cut.b)}));
 const cdp=await ctx.newCDPSession(p);const T=(type,x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:B.x+x,y:B.y+B.height/2}]});
 await T('touchStart',cut0.xb);for(let k=1;k<=12;k++){await T('touchMove',cut0.xb+60*k/12);await p.waitForTimeout(16)}await T('touchEnd');await p.waitForTimeout(300);
 const cut1=await p.evaluate(()=>({...window.__rsRTL.cut,txt:document.getElementById('rtlCutTxt').textContent,bar:!document.getElementById('rtlCutBar').hidden}));
 await p.evaluate(()=>document.getElementById('rtlCutCancel').click());await p.waitForTimeout(300);const cc=await st();
 rec('Cut a moment with a finger: dragging the red right edge widens the stretch (the bar says how long); Cancel leaves the routine alone',cut1.bar&&cut1.b>cut0.b+0.3&&Math.abs(cut1.a-cut0.a)<1e-6&&/Cut \d/.test(cut1.txt)&&cc.n===c0.n&&Math.abs(cc.tot-c0.tot)<1e-4?'passed':'failed',JSON.stringify({before:[cut0.a,cut0.b],after:[cut1.a,cut1.b],txt:cut1.txt}));
 /* ✂ Split at the playhead */
 await p.evaluate(()=>{const R=window.__rs;R.seekT(1.5)});await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('rtlSplit').click());await p.waitForTimeout(400);const sp=await st();
 rec('✂ Split (toolbar) splits the move under the playhead in two, the routine plays the same',sp.n===c0.n+1&&Math.abs(sp.tot-c0.tot)<0.003?'passed':'failed',JSON.stringify({n:sp.n,tot:[c0.tot,sp.tot]}));
 /* layout: the toolbar on one line, nothing wider than the screen */
 const lay=await p.evaluate(()=>{const bar=document.querySelector('#rtlWrap .tle-bar'),kids=[...bar.children].map(e=>e.getBoundingClientRect());return {oneLine:Math.max(...kids.map(r=>r.top))-Math.min(...kids.map(r=>r.top))<4,
   wide:document.documentElement.scrollWidth-window.innerWidth,inspect:(()=>{const r=document.getElementById('rtlInspect').getBoundingClientRect();return r.right<=window.innerWidth+0.5})()}});
 rec('Layout: the timeline toolbar is on one line and nothing is wider than the phone screen',lay.oneLine&&lay.wide<=0&&lay.inspect?'passed':'failed',JSON.stringify(lay));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
