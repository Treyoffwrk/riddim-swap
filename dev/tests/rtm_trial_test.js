/* RTMPose trial: track a clip with the trial tracker (the regular tracker finds and follows the dancer, RTMPose whole-body
   reads the crop). Reports speed and saves the track for comparison. Usage: RTM=<model url> [DUMP=file] node rtm_trial_test.js <host> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(u=>{window.RB_DELEGATE='CPU';window.RB_MODEL='rtm';window.RB_RTM_URL=u;window.RB_RAW=[]},process.env.RTM);
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,150))});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);const t0=Date.now();
 await p.click('#bodyTrack');for(let i=0;i<6000;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({busy:window.__rs.S.bodyBusy,body:!!window.__rs.srcById(window.__rs.S.cur).body,err:window.__rs.S.bodyErr||''}));if(st.err){console.log('tracking error:',st.err);break}if(!st.busy&&st.body)break}
 const r=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;return B?{n:B.n,seen:B.seen,model:B.model,ms:Math.round(B.msPerFrame),rtmMs:B.rtmMs&&Math.round(B.rtmMs),rtmErrors:B.rtmErrors,cover:RB.coverage(B).pct}:null});
 rec('The RTMPose trial tracks the clip end to end',r&&/rtmpose/.test(r.model)&&r.rtmErrors===0&&r.seen>0.8*r.n?'passed':'failed',JSON.stringify({...r,secs:(Date.now()-t0)/1000|0}));
 if(process.env.DUMP&&r){const d=await p.evaluate(()=>{const R=window.__rs,B=R.srcById(R.S.cur).body,raw=window.RB_RAW[window.RB_RAW.length-1];return {S:RB.STRIDE,n:B.n,w:B.w,h:B.h,raw:Array.from(raw.data),clean:Array.from(B.data)}});require('fs').writeFileSync(process.env.DUMP,JSON.stringify(d))}
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
