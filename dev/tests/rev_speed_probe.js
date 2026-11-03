/* Probe: with a fast encoder (encode stubbed to a no-op), does the hidden playback speed up to 4×? Prints the rate and time. */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.evaluate(()=>{const E=VideoEncoder.prototype;E.encode=function(f){};});
 const split=async t=>{await p.evaluate(t=>{document.querySelector('#vid').currentTime=t},t);await p.waitForTimeout(400);await p.evaluate(()=>document.getElementById('cutSplit').click());await p.waitForTimeout(200)};
 await split(6);await split(4);const t0=Date.now();await p.evaluate(()=>document.getElementById('cutRev').click());
 const rates=[];for(let i=0;i<120;i++){await p.waitForTimeout(500);const r=await p.evaluate(()=>[document.getElementById('cutRevMsg').textContent,window.__rsRev||null,window.__rsREV.rate]);rates.push(r[0].replace('Making the reverse… ','')+'@'+(+r[2]).toFixed(2));if(r[1]||!/Making/.test(r[0])&&i>4)break}
 console.log('secs',(Date.now()-t0)/1000,rates.join(' '),JSON.stringify(await p.evaluate(()=>[window.__rsRev,document.getElementById('recMsg').textContent])));await b.close()})();
