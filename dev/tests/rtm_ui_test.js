/* The RTMPose trial in the app: Tracking → RTMPose (trial), Track again, then Compare: this track / previous / both, and the
   phone check reports RTMPose's speed. Usage: node rtm_ui_test.js <host> <clip> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({viewport:{width:402,height:874}});await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 const track=async()=>{await p.click('#bodyTrack');await p.waitForTimeout(800);for(let i=0;i<6000;i++){await p.waitForTimeout(500);const st=await p.evaluate(()=>({busy:window.__rs.S.bodyBusy,err:window.__rs.S.bodyErr||''}));if(st.err)return st.err;if(!st.busy)return ''}};
 const e1=await track();const m1=await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).body.model);
 /* choose the trial and track again (the test harness pins the regular tracker; lift that for this run) */
 await p.evaluate(()=>{delete window.RB_MODEL});await p.click('#trackQ [data-q="rtm"]');
 const note=await p.textContent('#trackQNote');
 const e2=await track();
 const r=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {model:n.body&&n.body.model,alt:n.bodyAlt&&n.bodyAlt.model,row:!document.getElementById('cmpRow').hidden,labels:[...document.querySelectorAll('#cmpSeg button')].map(b=>b.textContent),rtmMs:n.body&&Math.round(n.body.rtmMs),errors:n.body&&n.body.rtmErrors}});
 rec('Tracking offers RTMPose (trial) and explains it',/RTMPose/.test(note)?'passed':'failed',note);
 rec('Tracking again with RTMPose works and keeps the previous track to compare',!e1&&!e2&&/rtmpose/.test(r.model||'')&&/full|heavy/.test(r.alt||'')&&r.errors===0?'passed':'failed',JSON.stringify({e1,e2,first:m1,...r}));
 rec('A Compare switch appears: this track, previous (orange), both',r.row&&r.labels.join('|')==='RTMPose|Faster (orange)|Both'?'passed':'failed',JSON.stringify(r.labels));
 /* the drawing: orange pixels only when the previous track is shown */
 await p.evaluate(()=>{window.scrollTo(0,0);const v=window.__rs.v();v.currentTime=4});await p.waitForTimeout(800);
 const orange=()=>p.evaluate(()=>{const c=document.getElementById('bodyCanvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let o=0,lit=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>150){lit++;if(d[i]>220&&d[i+1]>150&&d[i+1]<200&&d[i+2]<110)o++}}return {o,lit}});
 const set=async c=>{await p.click(`#cmpSeg [data-c="${c}"]`);await p.waitForTimeout(400);return orange()};
 const now=await set('now'),prev=await set('prev'),both=await set('both');await p.locator('#stage').screenshot({path:SHOT+'-both.png'});
 rec('This track / Previous / Both draw the right skeletons',now.o<50&&prev.o>300&&both.o>0.4*prev.o&&both.lit>prev.lit?'passed':'failed',JSON.stringify({now,prev,both}));
 await p.click('#projBtn');await p.waitForTimeout(500);
 await p.click('#phoneCheck').catch(()=>{});await p.waitForTimeout(1200);const rep=await p.evaluate(()=>{const o=document.getElementById('phoneCheckOut');return (o&&(o.value||o.textContent))||''});
 rec('The phone check says the RTMPose trial was used and how fast it was',/RTMPose trial/.test(rep)&&/RTMPose \d+ ms\/frame/.test(rep)?'passed':'failed',(rep.match(/Tracking:[^\n]*/)||[rep.slice(0,200)])[0]);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
