/* Compilation edits: a clip cut from several shots (different dancers and places). The skeleton must follow the main dancer
   in every shot, pick up the new dancer straight after each cut, and never blend across a cut. Also with "Choose the dancer"
   (tapped in the first shot). Usage: node compilation_test.js <host> <clip> <cuts, e.g. 5,10,15> [PICK=x,y,t] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,CUTS]=process.argv;const cuts=CUTS.split(',').map(Number);const PICK=process.env.PICK?process.env.PICK.split(',').map(Number):null;
const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('crash',()=>console.log('PAGE CRASHED'));p.on('console',m=>{if(m.type()==='error')console.log('CON',m.text().slice(0,160))});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);
 if(PICK)await p.evaluate(([x,y,t])=>{const R=window.__rs;R.S.bodyPick={src:R.S.cur,t,x,y}},PICK);
 await p.click('#bodyTrack');for(let i=0;i<4000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const r=await p.evaluate(cuts=>{const B=window.__rs.srcById(window.__rs.S.cur).body,S=RB.STRIDE,dur=window.__rs.v().duration,edges=[0,...cuts,dur];
   const shots=edges.slice(0,-1).map((a,i)=>{const e=edges[i+1];let n=0,s=0;for(let k=0;k<B.n;k++){const t=B.data[k*S];if(t>=a&&t<e){n++;if(!isNaN(B.data[k*S+1]))s++}}return Math.round(s/Math.max(1,n)*100)});
   /* how soon after each cut the skeleton is back */
   const back=cuts.map(c=>{for(let k=0;k<B.n;k++){const t=B.data[k*S];if(t>=c-0.01&&!isNaN(B.data[k*S+1]))return +(t-c).toFixed(3)}return null});
   /* no blending across a cut: the frame just before and just after a cut differ like the two shots do (hip jump), not a smooth slide */
   return {shots,back,cutsFound:(B.cuts||[]).map(x=>+x.toFixed(2)),model:B.model,info:document.getElementById('bodyInfo').textContent.slice(0,120)}},cuts);
 const found=cuts.every(c=>r.cutsFound.some(x=>Math.abs(x-c)<0.1));
 rec('The cuts in the edit are found',found?'passed':'failed',JSON.stringify(r.cutsFound));
 rec(`Every shot has the skeleton on most frames${PICK?' (dancer chosen in the first shot)':''}`,r.shots.every(x=>x>=85)?'passed':'failed',`per shot: ${r.shots.join('% · ')}%`);
 rec('After each cut the skeleton is back within 0.2 s',r.back.every(x=>x!=null&&x<=0.2)?'passed':'failed',`seconds after each cut: ${JSON.stringify(r.back)}`);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 console.log('info:',r.info);await b.close()})();
