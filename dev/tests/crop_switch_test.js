/* Crop box moved to another dancer (12 Nov, user: "when I moved the crop box from one dancer to another, the tracker
   tracked nothing and waited for the previous dancer to enter my box"). Two dancers in frame the whole time (group clip:
   a big one on the left, A, and a small one on the right, B); a box on A at 0 s and a box on B at 6 s. The skeleton must be
   on A up to 6 s and on B from 6 s (within a fraction of a second), with no empty stretch either side; the same with a
   dancer chosen (A) beforehand; and with the second box on an empty part of the picture, nothing is tracked after it.
   Usage: node crop_switch_test.js <page> <group clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const BOX_A={t:0,x:0.02,y:0.05,w:0.46,h:0.93},BOX_B={t:6,x:0.59,y:0.4,w:0.31,h:0.6},EMPTY={t:6,x:0.55,y:0.0,w:0.43,h:0.3};
(async()=>{const {b}=await launch();const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const trackNow=async()=>{await p.waitForFunction(()=>!document.getElementById('bodyTrack').disabled,null,{timeout:30000});await p.evaluate(()=>document.getElementById('bodyTrack').click());
   for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}};
 /* per tracked frame: time and hip x (null = no skeleton) */
 const frames=()=>p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n.body,o=[];for(let i=0;i<B.n;i++){const r=i*RB.STRIDE,x=(B.data[r+1+23*3]+B.data[r+1+24*3])/2;o.push([B.data[r],isFinite(x)?x:null])}return {o,sw:n.crop&&n.crop.keys.map(k=>!!k.sw),cuts:B.cuts}});
 const setup=(keys,pick)=>p.evaluate(([keys,pick])=>{const R=window.__rs,n=R.srcById(R.S.cur);n.crop={keys:keys.map(k=>({...k}))};n.body=null;R.S.bodyPick=pick?{src:R.S.cur,...pick}:null},[keys,pick]);
 const score=F=>{const o=F.o,A=o.filter(q=>q[0]<6),Bq=o.filter(q=>q[0]>=6);const firstB=(Bq.find(q=>q[1]!=null&&q[1]>0.5)||[null])[0];
   return {onA:A.filter(q=>q[1]!=null&&q[1]<0.5).length,nA:A.length,emptyA:A.filter(q=>q[1]==null).length,
     onB:Bq.filter(q=>q[1]!=null&&q[1]>0.5).length,nB:Bq.length,emptyB:Bq.filter(q=>q[1]==null).length,wrongB:Bq.filter(q=>q[0]>=6.3&&q[1]!=null&&q[1]<0.5).length,
     firstB:firstB==null?null:+(firstB-6).toFixed(3),longestEmpty:(()=>{let m=0,c=0;for(const q of o){if(q[1]==null){c++;m=Math.max(m,c)}else c=0}return m})(),sw:F.sw}};
 const good=s=>s.onA>=0.97*s.nA&&s.onB>=0.95*s.nB&&s.firstB!=null&&s.firstB<0.3&&s.wrongB===0&&s.longestEmpty<=3;
 /* 1. no dancer chosen */
 await setup([BOX_A,BOX_B],null);await trackNow();const s1=score(await frames());
 rec('Box moved from dancer A to dancer B at 6 s: on A up to 6 s, on B from 6 s within a fraction of a second, no empty stretch',good(s1)?'passed':'failed',JSON.stringify(s1));
 rec('…the second box is marked as on another dancer (⇄) and kept with the clip; the crop bar shows it',
   JSON.stringify(s1.sw)==='[false,true]'&&await p.evaluate(()=>{document.getElementById('cropBtn').click();const t=document.getElementById('cropKeys').textContent;document.getElementById('cropDone').click();return /⇄/.test(t)})?'passed':'failed',JSON.stringify(s1.sw));
 /* 2. with dancer A chosen first (this is what waited for ever) */
 await setup([BOX_A,BOX_B],{t:1,x:0.28,y:0.6});await trackNow();const s2=score(await frames());
 rec('Same with dancer A chosen first (it used to wait for A for the rest of the clip)',good(s2)?'passed':'failed',JSON.stringify(s2));
 /* 3. the second box on an empty part of the picture */
 await setup([BOX_A,EMPTY],null);await trackNow();const F3=await frames();
 const after=F3.o.filter(q=>q[0]>=6.1),before=F3.o.filter(q=>q[0]<6);
 rec('A box with nobody in it: nothing is tracked there (and A is tracked before it)',after.every(q=>q[1]==null)&&before.filter(q=>q[1]!=null&&q[1]<0.5).length>=0.97*before.length?'passed':'failed',
   JSON.stringify({tracked:after.filter(q=>q[1]!=null).length,of:after.length,onA:before.filter(q=>q[1]!=null&&q[1]<0.5).length,nA:before.length,sw:F3.sw}));
 /* changing a box clears the ⇄ marks (found again when tracking next) */
 const cleared=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.crop.keys[1].sw=true;document.getElementById('cropBtn').click();
   const el=document.querySelector('#stage video:not(.off)');el.currentTime=6;return new Promise(r=>setTimeout(()=>{document.getElementById('cropDel').click();const s=n.crop?n.crop.keys.some(k=>k.sw):false;document.getElementById('cropDone').click();r(!s)},400))});
 rec('Changing the boxes clears the ⇄ marks (worked out again on the next tracking)',cleared?'passed':'failed',String(cleared));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
