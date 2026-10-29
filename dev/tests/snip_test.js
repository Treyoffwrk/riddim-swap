/* Snip: build a routine while watching. Start from / Finish here, again and again, across two clips; each snippet snaps to
   the beat and to whole 8-counts, so each one starts on a 1 with no gaps, and the routine plays on repeat.
   Usage: node snip_test.js <host index.html> <clip A> <clip B> <song> <shot prefix> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CA,CB,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug-closed');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CA);await p.waitForTimeout(2000);await p.setInputFiles('#vidFile',CB);await p.waitForTimeout(2000);
 await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3500);
 const chip=async k=>{await p.evaluate(k=>{document.querySelectorAll('.srcChips')[0].querySelectorAll('.chip-src button[aria-label^="Show"]')[k].click()},k);await p.waitForTimeout(500)};
 const seek=async t=>{await p.evaluate(t=>{const v=window.__rs.v();v.pause();v.currentTime=t},t);await p.waitForTimeout(350)};
 await chip(0);
 await p.click('#snipBtn');await p.waitForTimeout(400);
 const on=await p.evaluate(()=>({strip:!document.getElementById('snipStrip').hidden,bar:!document.getElementById('snipBar').hidden,unit:window.__rs.SNIP.unit,inPin:!!document.querySelector('.pin #snipStrip'),msg:document.getElementById('snipMsg').textContent}));
 rec('Snip opens Start from / Finish here in the player, snapping to 8-counts by default',on.strip&&on.bar&&on.inPin&&on.unit===8&&/snapped to the counts/.test(on.msg)?'passed':'failed',JSON.stringify(on));
 /* clip A: a move from about 1.1 s, about 4 s long */
 await seek(1.13);await p.click('#snipIn');
 const st=await p.evaluate(()=>{const R=window.__rs,S=R.S,G=R.liveGrid(),bt=G.beats.map(b=>S.cIn+((b-S.offset)/S.ar)*S.vr);const a=S.snip.a;return {a,near:Math.min(...bt.map(x=>Math.abs(x-a)))}});
 rec('Start from lands on the nearest beat',st.near<0.005&&Math.abs(st.a-1.13)<0.35?'passed':'failed',JSON.stringify(st));
 await seek(st.a+4.1);await p.click('#snipOut');console.log('DBG',await p.evaluate(()=>JSON.stringify({msg:document.getElementById('snipMsg').textContent,t:window.__rs.v().currentTime,cur:window.__rs.S.cur,snip:window.__rs.S.snip&&{a:window.__rs.S.snip.a,src:window.__rs.S.snip.src},n:window.__rs.S.seq.length})));
 /* Finish here again, with no new Start from: carries on from where the first ended */
 await p.evaluate(()=>{});const e1=await p.evaluate(()=>window.__rs.S.seq[0].e);await seek(Math.min(11.5,e1+5.2));await p.click('#snipOut');console.log('DBG2',await p.evaluate(()=>JSON.stringify({msg:document.getElementById('snipMsg').textContent,cur:window.__rs.S.cur,seq:window.__rs.S.seq.map(x=>x.id+':'+x.s+'-'+x.e),moves:window.__rs.S.moves.map(m=>m.id+m.src)})));
 /* clip B */
 await chip(1);console.log('DBG2',await p.evaluate(()=>JSON.stringify({msg:document.getElementById('snipMsg').textContent,cur:window.__rs.S.cur,seq:window.__rs.S.seq.map(x=>x.id+':'+x.s+'-'+x.e),moves:window.__rs.S.moves.map(m=>m.id+m.src)})));await seek(2.02);await p.click('#snipIn');await seek(2.02+5.4);await p.click('#snipOut');
 const r=await p.evaluate(()=>{const R=window.__rs,S=R.S,G=R.liveGrid(),down=(R.liveGrid()||{}).down||[];
   const bl=x=>60*(x.sp||S.rt.vr)/(S.sBase*S.rt.ar);let T=0;const rows=S.seq.map(x=>{const m=S.moves.find(q=>q.id===x.id),counts=(x.e-x.s)/bl(x);
     const song=S.rt.offset+T*S.rt.ar,off=Math.min(...down.map(d=>Math.abs(d-song)));const row={src:m.src,s:x.s,e:x.e,counts:+counts.toFixed(3),startSongOffDownMs:Math.round(off*1000)};T+=(x.e-x.s)/S.rt.vr;return row});
   return {rows,srcs:[...new Set(rows.map(q=>q.src))].length,useSeq:S.useSeq,cur:S.cur,total:document.getElementById('snipCount').textContent}});
 const whole=r.rows.every(q=>Math.abs(q.counts-Math.round(q.counts))<0.05&&Math.round(q.counts)%8===0);
 const chained=r.rows.length>=2&&Math.abs(r.rows[1].s-r.rows[0].e)<0.002&&r.rows[1].src===r.rows[0].src;
 rec('Three snippets from two clips are added to the routine in order',r.rows.length===3&&r.srcs===2?'passed':'failed',JSON.stringify(r.rows.map(q=>q.src+' '+q.s+'–'+q.e)));
 rec('Each snippet is whole 8-counts, so the next one starts on a 1 (no gaps)',whole&&r.rows.every(q=>q.startSongOffDownMs<15)?'passed':'failed',JSON.stringify(r.rows.map(q=>q.counts+'c@'+q.startSongOffDownMs+'ms')));
 rec('Finish here again carries on from where the last snippet ended',chained?'passed':'failed',JSON.stringify(r.rows.slice(0,2)));
 rec('Marking never leaves the clip you are watching (no tab or mode switch)',!r.useSeq&&/3 in the routine · 24 counts/.test(r.total)?'passed':'failed',JSON.stringify({useSeq:r.useSeq,total:r.total}));
 /* 4s and Undo */
 await p.click('#snipUnit [data-u="4"]');await seek(8.0);await p.click('#snipIn');await seek(10.5);await p.click('#snipOut');
 const u4=await p.evaluate(()=>{const S=window.__rs.S,x=S.seq[S.seq.length-1];return {n:S.seq.length,counts:+((x.e-x.s)/(60*S.rt.vr/(S.sBase*S.rt.ar))).toFixed(3)}});
 await p.click('#snipUndo');await p.waitForTimeout(200);
 const un=await p.evaluate(()=>({n:window.__rs.S.seq.length,moves:window.__rs.S.moves.length}));
 rec('4s snaps to 4 counts; Undo takes the last snippet back off',u4.n===4&&Math.round(u4.counts)===4&&un.n===3&&un.moves===3?'passed':'failed',JSON.stringify({u4,un}));
 /* full screen: the strip is still there */
 await p.screenshot({path:SHOT+'-phone.png'});
 /* Play routine on repeat: plays the three in order and comes back round to the first */
 await p.click('#snipPlay');await p.waitForTimeout(500);
 const seen=await p.evaluate(()=>new Promise(res=>{const R=window.__rs,o=[];const iv=setInterval(()=>{o.push({i:R.S.segIdx,ro:R.routineOn(),pl:R.S.playing,loop:R.S.loop})},200);setTimeout(()=>{clearInterval(iv);res(o)},17500)}));
 const order=[];seen.forEach(q=>{if(order[order.length-1]!==q.i)order.push(q.i)});
 rec('Play routine plays the snippets back to back and loops',seen[0].ro&&seen[0].loop&&order.slice(0,4).join(',')==='0,1,2,0'&&seen.filter(q=>q.pl).length>seen.length*0.9?'passed':'failed',order.join(','));
 rec('Snip closes when the routine plays',(await p.evaluate(()=>document.getElementById('snipBar').hidden&&!window.__rs.snip))?'passed':'failed','');
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
