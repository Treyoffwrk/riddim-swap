/* Tracking that doesn't give up: a video that stops giving frames is revived; a run that stays stuck starts itself again
   from where it was, then stops with "Carry on tracking"; closing the app part-way (reload) carries on from there; going
   to the background pauses and carries on. The finished skeleton matches an uninterrupted run.
   Usage: node track_resume_test.js <host index.html> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=281/12;   /* the clip's frame rate (measuring it is noisy on a busy test machine) */
   /* wake lock: count requests and releases */
   window.__wl={req:0,rel:0};const live=new Set();document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const l of [...live])l.release()});try{Object.defineProperty(navigator,'wakeLock',{configurable:true,get:()=>({request:async()=>{window.__wl.req++;const l=new EventTarget();live.add(l);l.release=async()=>{if(!live.has(l))return;live.delete(l);window.__wl.rel++;l.dispatchEvent(new Event('release'))};return l}})})}catch(e){}
   /* the page can be "sent to the background" */
   window.__H=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__H});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__H?'hidden':'visible'});
   /* freezing: a frozen video ignores seeks (no frame, no 'seeked'), like the stuck iPhone video */
   window.__freeze=v=>{Object.defineProperty(v,'currentTime',{configurable:true,get(){return 0},set(){}})};
   window.RB_TEST_HOOK=async({k,done,v})=>{const T=window.__T;if(!T)return;
     if(T.freezeOnceAt!=null&&done>=T.freezeOnceAt&&!T.froze){T.froze=true;window.__freeze(v)}
     if(T.freezeAllAt!=null&&done>=T.freezeAllAt&&T.all)window.__freeze(v)};
 });
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const cur=()=>p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur),B=n&&n.body;return {busy:window.__rs.S.bodyBusy,pct:window.__rs.S.bodyPct,info:document.getElementById('bodyInfo').textContent,btn:document.getElementById('bodyTrack').textContent,fresh:!document.getElementById('bodyFresh').hidden,cp:n&&n.cp?{pct:n.cp.pct,done:n.cp.done,chunks:n.cp.chunks}:null,B:B?{n:B.n,seen:B.seen,resumed:B.resumed||0,revived:B.revived||0,model:B.model}:null}});
 const waitIdle=async(max=900,seen)=>{for(let i=0;i<max;i++){await p.waitForTimeout(500);const c=await cur();if(seen)seen.push(c.info);if(!c.busy)return c}return cur()};
 const data=()=>p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;return {n:B.n,S:RB.STRIDE,d:Array.from(B.data)}});
 /* the same frames (matched by time; a run can keep or drop a repeated frame or two either way) should hold the same skeleton */
 const diff=(a,c)=>{const S=a.S,ta=new Map();for(let i=0;i<a.n;i++)ta.set(Math.round(a.d[i*S]*1000),i);let s=0,m=0,f=0;
   for(let j=0;j<c.n;j++){const i=ta.get(Math.round(c.d[j*S]*1000));if(i==null)continue;f++;for(let q=1;q<S;q++){const x=a.d[i*S+q],y=c.d[j*S+q];if(isNaN(x)||isNaN(y))continue;s+=Math.abs(x-y);m++}}
   return {sameN:f>=Math.min(a.n,c.n)*0.97,frames:[a.n,c.n,f],mean:m?+(s/m).toFixed(5):null}};
 const fast=()=>p.evaluate(()=>{RB.CFG.seekWait=1200;RB.CFG.maxRevives=4;RB.CFG.saveEvery=1500});
 await fast();
 /* 0: an uninterrupted run, to compare with */
 const t0=Date.now();await p.click('#bodyTrack');const c0=await waitIdle();const base=await data();const T0=(Date.now()-t0)/1000;
 rec('An uninterrupted run tracks the clip and keeps no leftover progress',c0.B&&!c0.cp&&c0.B.resumed===0?'passed':'failed',JSON.stringify({...c0,secs:T0}));
 /* 1: the video freezes part-way: it's revived in a fresh player and tracking finishes in the same run */
 await p.evaluate(()=>{window.__T={freezeOnceAt:120}});
 await p.click('#bodyTrack');const seen1=[];const c1=await waitIdle(900,seen1);const d1=diff(base,await data());
 rec('A video that stops giving frames is revived and tracking finishes (no restart needed)',c1.B&&c1.B.revived>=1&&!seen1.some(t=>/stuck/.test(t))&&d1.sameN&&d1.mean<0.01&&!c1.cp?'passed':'failed',JSON.stringify({B:c1.B,d1}));
 /* 2: it stays stuck: starts itself again from where it was (twice), then stops with Carry on tracking */
 await p.evaluate(()=>{RB.CFG.maxRevives=1;window.__T={freezeAllAt:150,all:true}});
 await p.click('#bodyTrack');const seen2=[];const c2=await waitIdle(900,seen2);
 const restarts=[...new Set(seen2.filter(t=>/got stuck at \d+%\. Starting it again from there/.test(t)))].length;
 rec('Stuck for good: it starts itself again from where it was, then says where it stopped',restarts>=1&&/stopped at \d+% .*Carry on tracking/.test(c2.info)&&c2.cp&&c2.cp.pct>=25&&c2.btn==='Carry on tracking'&&c2.fresh?'passed':'failed',JSON.stringify({restarts,c2:{info:c2.info,btn:c2.btn,fresh:c2.fresh,cp:c2.cp}}));
 /* …and Carry on tracking (the video working again) finishes from there, matching the uninterrupted run */
 await p.evaluate(()=>{window.__T=null;RB.CFG.maxRevives=4});const t3=Date.now();
 await p.click('#bodyTrack');const seen3=[];const c3=await waitIdle(900,seen3);const d3=diff(base,await data());const T3=(Date.now()-t3)/1000;
 rec('Carry on tracking picks up from there and the skeleton matches an uninterrupted run',c3.B&&c3.B.resumed>=c2.cp.done*0.9&&seen3.some(t=>/Carrying on from \d+%/.test(t))&&d3.sameN&&d3.mean<0.01&&!c3.cp&&c3.btn==='Track again'&&!c3.fresh?'passed':'failed',JSON.stringify({B:c3.B,d3,secs:T3,vsFull:T0,btn:c3.btn,fresh:c3.fresh,cp:c3.cp,carrying:seen3.some(t=>/Carrying on from \d+%/.test(t)),seen:[...new Set(seen3)].slice(0,4)}));
 /* 3: the app is closed part-way (reload): after opening it again, Carry on tracking is offered and carries on */
 await p.click('#bodyTrack');for(let i=0;i<600;i++){await p.waitForTimeout(250);const c=await cur();if(c.pct>=45&&c.cp&&c.cp.pct>=30)break}
 const before=await cur();await p.reload();await p.waitForTimeout(3000);await fast();
 let c4=null;for(let i=0;i<40;i++){c4=await cur();if(c4.btn==='Carry on tracking')break;await p.waitForTimeout(250)}
 rec('After closing the app part-way, opening it again offers Carry on tracking from where it was',c4.btn==='Carry on tracking'&&/stopped at \d+% last time/.test(c4.info)&&c4.cp&&c4.cp.pct>=30?'passed':'failed',JSON.stringify({before:before.cp,after:{btn:c4.btn,info:c4.info,cp:c4.cp}}));
 await p.click('#bodyTrack');const c5=await waitIdle();const d5=diff(base,await data());
 rec('…and it finishes from there',c5.B&&c5.B.resumed>=c4.cp.done*0.9&&d5.sameN&&d5.mean<0.01&&!c5.cp?'passed':'failed',JSON.stringify({B:c5.B,d5}));
 /* 4: going to the background pauses (progress kept) and it carries on when you come back */
 await p.evaluate(()=>{window.__wl={req:0,rel:0}});
 await p.click('#bodyTrack');for(let i=0;i<600;i++){await p.waitForTimeout(250);if((await cur()).pct>=30)break}
 const wlMid=await p.evaluate(()=>({...window.__wl}));
 await p.evaluate(()=>{window.__H=true;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(1500);const h1=await cur();await p.waitForTimeout(4000);const h2=await cur();
 await p.evaluate(()=>{window.__H=false;document.dispatchEvent(new Event('visibilitychange'))});const c6=await waitIdle();const d6=diff(base,await data());
 rec('In the background it pauses with progress kept, then carries on and finishes',h1.busy&&h2.busy&&h2.pct===h1.pct&&h2.cp&&h2.cp.pct>=25&&c6.B&&d6.sameN&&d6.mean<0.01&&!c6.cp?'passed':'failed',JSON.stringify({h1:{pct:h1.pct,cp:h1.cp},h2:{pct:h2.pct,cp:h2.cp},B:c6.B,d6}));
 const wl=await p.evaluate(()=>({...window.__wl}));
 rec('The screen is kept on while tracking (and let go after)',wlMid.req>=1&&wl.rel>=1&&wl.req>=2?'passed':'failed',JSON.stringify({mid:wlMid,end:wl}));
 /* Start over: drops kept progress */
 await p.evaluate(()=>{RB.CFG.maxRevives=0;window.__T={freezeAllAt:60,all:true}});await p.click('#bodyTrack');await waitIdle();
 const s0=await cur();await p.evaluate(()=>{window.__T=null;RB.CFG.maxRevives=4});await p.click('#bodyFresh');const seen7=[];const s1=await waitIdle(900,seen7);
 rec('Start over tracks the whole clip again',s0.cp&&s1.B&&s1.B.resumed===0&&!seen7.some(t=>/Carrying on/.test(t))&&!s1.cp?'passed':'failed',JSON.stringify({s0:s0.cp,B:s1.B}));
 const st=await p.evaluate(async()=>{const r=await window.__rs.storageScan?.();return r||null});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
