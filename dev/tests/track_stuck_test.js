/* Tracking that can't stay stuck (the user left the app mid-tracking; back in it, it said "Getting the tracker ready…"
   at 49% for 5 minutes with no way to restart): a tracker call that never answers part-way, or at the very start, is
   given up on and tracking carries on from where it was with a fresh engine; coming back after a while away restarts
   straight away; Restart from here and Stop tracking work even while the tracker hangs; Carry on finishes it.
   Usage: node track_stuck_test.js <page> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30;window.RB_TRACK_STALL_MS=6000;window.RB_TRACK_READY_MS=6000;
   /* a tracker call that never answers, once, at a chosen point (done frames), or at the first frame */
   window.__hang=null;window.__hung=0;window.RB_TEST_HOOK=async({done})=>{if(window.__hang!=null&&done>=window.__hang){window.__hang=null;window.__hung++;await new Promise(()=>{})}};
   window.__H=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__H});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__H?'hidden':'visible'})});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 const st=()=>p.evaluate(()=>{const R=window.__rs,S=R.S,n=R.srcById(S.cur);return {busy:S.bodyBusy,pct:S.bodyPct,t0:!!S.bodyT0,restarts:S.trackRestarts||0,resets:RB.resetCount(),body:!!(n&&n.body),bn:n&&n.body&&n.body.n,info:document.getElementById('bodyInfo').textContent,msg:document.getElementById('waitMsg').textContent,carry:!document.getElementById('waitCarry').hidden,ctl:!document.getElementById('waitCtl').hidden,hung:window.__hung,previews:document.querySelectorAll('video.rb-trackvid').length}});
 const until=async(f,ms)=>{const t0=Date.now();let s;while(Date.now()-t0<ms){s=await st();if(f(s))return {s,secs:+((Date.now()-t0)/1000).toFixed(1)};await p.waitForTimeout(400)}return {s,secs:null}};
 const fresh=async()=>{await p.evaluate(async()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.body=null;n.cp=null;});await p.evaluate(()=>document.getElementById('bodyFresh').hidden=false)};
 /* A. a call that never answers at 40 frames: given up on, carried on from there with a fresh engine, finished */
 await p.waitForFunction(()=>!document.getElementById('bodyTrack').disabled,null,{timeout:30000});await p.evaluate(()=>{window.__hang=40;document.getElementById('bodyTrack').click()});
 const a1=await until(s=>s.hung===1&&s.t0,60000);const a2=await until(s=>s.restarts>=1,30000);const a3=await until(s=>!s.busy,300000);
 rec('A tracker call that never answers part-way: within the stuck time it starts again from where it was (fresh engine) and finishes',a2.s.restarts===1&&a3.s.body&&a3.s.resets>=1&&a2.secs!=null&&a2.secs<14&&a3.s.previews===0?'passed':'failed',JSON.stringify({stuckAfter:a2.secs,end:a3.s}));
 /* B. stuck right at the start ("Getting the tracker ready…" for ever, as on the phone) */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.body=null;window.__hang=0;window.__hung=0;R.S.trackRestarts=0});
 await p.evaluate(()=>document.getElementById('bodyFresh').click());
 const b1=await until(s=>s.hung===1,60000);const b2=await until(s=>s.restarts>=1,30000);const b3=await until(s=>!s.busy,300000);
 rec('Stuck while getting ready: it doesn\'t wait for ever, it tries again and finishes',b1.s&&!b1.s.t0&&b2.secs!=null&&b2.secs<14&&b3.s.body?'passed':'failed',JSON.stringify({b1:b1.s&&{t0:b1.s.t0,msg:b1.s.msg},retryAfter:b2.secs,end:b3.s}));
 /* C. leaving the app mid-tracking with the engine broken on return: back in the app it carries on at once */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.body=null;window.__hang=null;window.__hung=0;R.S.trackRestarts=0});
 await p.evaluate(()=>document.getElementById('bodyFresh').click());
 await until(s=>s.pct>=25,200000);
 await p.evaluate(()=>{window.__hang=0;window.__H=true;document.dispatchEvent(new Event('visibilitychange'))});await p.waitForTimeout(6000);
 const c0=await st();await p.evaluate(()=>{window.__H=false;document.dispatchEvent(new Event('visibilitychange'))});
 const c1=await until(s=>s.restarts>=1,10000);const c2=await until(s=>!s.busy,300000);
 rec('Left the app mid-tracking: back in it, tracking carries on straight away from where it was (no 45 s wait), and finishes, with no leftover preview',c1.secs!=null&&c1.secs<3&&c2.s.body&&c2.s.bn>0&&c2.s.previews===0?'passed':'failed',JSON.stringify({pctLeft:c0.pct,restartAfter:c1.secs,info:c1.s.info,end:c2.s}));
 /* D. your own controls, working even while the tracker hangs */
 await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur);n.body=null;window.__hang=null;window.__hung=0;R.S.trackRestarts=0});
 await p.evaluate(()=>document.getElementById('bodyFresh').click());
 await until(s=>s.pct>=20,200000);const d0=await st();
 await p.evaluate(()=>{window.__hang=0});await p.waitForTimeout(1500);
 await p.evaluate(()=>document.getElementById('waitRestart').click());const d1=await until(s=>s.pct>=d0.pct&&s.t0&&s.busy&&s.restarts>=1,30000);
 rec('Restart from here: starts tracking again from where it got to (while the tracker hangs)',d0.ctl&&d1.secs!=null&&d1.s.pct>=d0.pct-1?'passed':'failed',JSON.stringify({before:d0.pct,after:d1.s.pct,secs:d1.secs,ctl:d0.ctl}));
 await until(s=>s.pct>=d1.s.pct+5,200000);
 await p.evaluate(()=>{window.__hang=0});await p.waitForTimeout(1500);
 const t0=Date.now();await p.evaluate(()=>document.getElementById('waitStop').click());const d2=await until(s=>!s.busy,8000);
 rec('Stop tracking: stops at once even while the tracker hangs, keeps what\'s done and offers Carry on',d2.secs!=null&&d2.secs<3&&d2.s.carry&&/paused at \d+%/.test(d2.s.info)&&!d2.s.ctl?'passed':'failed',JSON.stringify({secs:d2.secs,info:d2.s.info,carry:d2.s.carry}));
 await p.evaluate(()=>document.getElementById('waitCarry').click());const d3=await until(s=>!s.busy,300000);
 rec('Carry on tracking finishes it',d3.s.body&&d3.s.bn>0?'passed':'failed',JSON.stringify(d3.s));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
