/* Hips on the beat, on your clip: with its own song the hip hits should lock; with an unrelated song they shouldn't.
   Usage: node hipbeat_test.js <host index.html> <clip> <its own song> <other song> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,OWN,OTHER,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',OWN);await p.waitForTimeout(4000);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const sync=()=>p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body,r=R.hipSync(n,B);return r?{hits:R.hipHits(B).length,n:r.n,R:+r.R.toFixed(2),Z:+r.Z.toFixed(1),offsetMs:r.offsetMs,lock:r.lock,bpm:R.S.mainSong&&R.S.mainSong.an&&+R.S.mainSong.an.bpm.toFixed(1)}:null});
 const own=await sync();
 /* where the truth is known: hits put on this song's beat grid (40 ms late, ±25 ms wobble), and hits at random times */
 const synth=await p.evaluate(()=>{const R=window.__rs,n=R.srcById(R.S.cur),B=n.body;const keep=B._hh;const grid=R.hipSync(n,B).beats;
   const on=[];for(let i=0;i<grid.length-1;i++){const a=grid[i],b=grid[i+1];for(const f of [0,0.5]){const t=a+(b-a)*f+0.04+(Math.random()-0.5)*0.05;on.push({t,pk:1})}}
   B._hh=on.filter(h=>h.t<B.data[(B.n-1)*RB.STRIDE]);const r1=R.hipSync(n,B);
   const rnd=[];let t=0.3;while(t<B.data[(B.n-1)*RB.STRIDE]){rnd.push({t,pk:1});t+=0.15+Math.random()*0.5}B._hh=rnd;const r2=R.hipSync(n,B);
   B._hh=keep;return {onBeat:{Z:+r1.Z.toFixed(1),lock:r1.lock,offsetMs:r1.offsetMs},random:{Z:+r2.Z.toFixed(1),lock:r2.lock}}});
 rec('Hits on the beat read as locked, with the right offset (40 ms late)',synth.onBeat.lock==='strong'&&Math.abs(synth.onBeat.offsetMs-40)<=15?'passed':'failed',JSON.stringify(synth.onBeat));
 rec('Hits at random times read as not locked',synth.random.lock==='none'?'passed':'failed',JSON.stringify(synth.random));
 await p.click('#t-clip');await p.locator('#hipCard').scrollIntoViewIfNeeded();await p.waitForTimeout(600);
 rec('The Hip moves card says so',/Hips on the beat/.test(await p.textContent('#hipBeat'))?'passed':'failed',await p.textContent('#hipBeat'));
 await p.locator('#hipCard').screenshot({path:SHOT+'-hipbeat.png'});
 await p.setInputFiles('#audFile',OTHER);await p.waitForTimeout(5000);
 const other=await sync();
 rec('Your clip: its own song scores clearly higher than an unrelated song',own&&other&&own.Z>2*other.Z+1&&other.lock==='none'?'passed':'failed',`own song ${JSON.stringify(own)} · unrelated (dembow 100) ${JSON.stringify(other)}`);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
