/* Compare a try with the original. The original is your clip; the "tries" are the same clip started 0.6 s later, the
   same clip mirrored, a different dance, and (in the page) a copy with half-size tilts that falls 150 ms behind after 10 s.
   Usage: node compare_test.js <host index.html> <original> <late copy> <mirrored copy> <other dance> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,ORIG,LATE,MIRROR,OTHER,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 for(const f of [ORIG,LATE,MIRROR,OTHER]){await p.setInputFiles('#vidFile',f);await p.waitForTimeout(1500)}
 const ids=await p.evaluate(()=>window.__rs.S.sources.map(n=>[n.id,n.name]));
 await p.click(`#srcChips .chip-src:first-child button`).catch(()=>{});await p.waitForTimeout(600);
 await p.evaluate(id=>{const S=window.__rs.S;if(S.cur!==id){const btn=[...document.querySelectorAll('#srcChips .chip-src button')].find(x=>x.textContent.includes('u3')&&!x.textContent.includes('late')&&!x.textContent.includes('mirror'));btn&&btn.click()}},ids[0][0]);await p.waitForTimeout(800);
 const cur=await p.evaluate(()=>window.__rs.srcById(window.__rs.S.cur).name);
 await p.click('#t-clip');
 const compare=async name=>{const id=ids.find(x=>x[1]===name)[0];await p.selectOption('#cmpPick',id);await p.click('#cmpGo');
   for(let i=0;i<2400;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.S.cmp))break}
   return p.evaluate(()=>{const c=window.__rs.S.cmp;return {match:+c.match.toFixed(2),lag:c.lag!=null?+c.lag.toFixed(2):null,mirrored:c.mirrored,similarity:c.similarity!=null?+c.similarity.toFixed(2):null,size:c.size!=null?+c.size.toFixed(2):null,drift:(c.drift||[]).map(d=>[+d.t0.toFixed(1),d.shiftMs]),text:document.getElementById('cmpOut').textContent}})};
 const late=await compare('u3-late');
 rec('Same dance started 0.6 s later: lined up at −0.6 s, very alike, same size, steady',Math.abs(late.lag+0.6)<=0.05&&!late.mirrored&&late.similarity>0.85&&Math.abs(late.size-1)<0.15&&!late.drift.length?'passed':'failed',JSON.stringify(late));
 await p.locator('#hipCard').scrollIntoViewIfNeeded();await p.waitForTimeout(500);await p.locator('#hipCard').screenshot({path:SHOT+'-late.png'});
 const mir=await compare('u3-mirror');
 rec('Same dance mirrored: found as a mirror image and still alike',mir.mirrored&&mir.similarity>0.75&&Math.abs(mir.lag)<=0.05?'passed':'failed',JSON.stringify(mir));
 const oth=await compare('u1');
 rec('A different dance: says they don’t look like the same moves',oth.match<0.3&&/don't look like the same moves/.test(oth.text)?'passed':'failed',JSON.stringify(oth));
 /* in the page: a copy of the original with half-size tilts that falls 150 ms behind after 10 s */
 const syn=await p.evaluate(()=>{const R=window.__rs,ref=R.srcById(R.S.cur),B=ref.body;RB.hipsAt(B,0);const S2=RB.STRIDE,H=RB.HS;
   const data=new Float32Array(B.data),hips=new Float32Array(B.hips);for(let i=0;i<B.n;i++){if(data[i*S2]>10)data[i*S2]+=0.15;hips[i*H]*=0.5}
   const fake={id:'fake',key:'fake',name:'fake',body:{...B,data,hips,_hh:null}};const c=R.compareTry(ref,fake);
   return {size:+c.size.toFixed(2),similarity:+c.similarity.toFixed(2),drift:c.drift.map(d=>[+d.t0.toFixed(1),d.shiftMs]),text:R.compareText(c).replace(/<[^>]+>/g,'')}});
 rec('Half-size tilts are reported as about half as big',Math.abs(syn.size-0.5)<0.08?'passed':'failed',JSON.stringify({size:syn.size,text:syn.text}));
 rec('Falling 150 ms behind after 10 s is reported there',syn.drift.length&&syn.drift.every(d=>d[0]>=8&&Math.abs(d[1]-150)<=40)?'passed':'failed',JSON.stringify(syn.drift));
 rec('Original was the current video',/^u3$/.test(cur)?'passed':'failed',cur);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
