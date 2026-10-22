/* Share a routine from one phone to another: everything arrives and plays. Usage: node share_test.js <host index.html> <clip> <song> */
const {launch}=require('./harness');const fs=require('fs');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const SP='/tmp/claude-0/-home-claude/c7d6fa6b-e9dd-5d62-903e-3e4d46a3b3b0/scratchpad';
(async()=>{
 /* phone A: a project with a body-tracked clip, a song, a cut move in a routine and a speed graph */
 let A=await launch();await A.ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});let p=await A.ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push('A: '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.evaluate(()=>{const R=window.__rs,S=R.S;S.moves.push({id:'m1',src:S.cur,s:2,e:5,name:'Test move'});S.seq.push({id:'m1',s:2,e:5,uid:'u1'});const n=R.srcById(S.cur);n.curve={on:true,pts:[{t:0,y:0,auto:true},{t:6,y:-1,auto:true},{t:15,y:0,auto:true}]}});
 const before=await p.evaluate(()=>{const R=window.__rs,S=R.S,n=R.srcById(S.cur);return {moves:S.moves.length,seq:S.seq.length,curve:!!(n.curve&&n.curve.on),body:n.body.n,song:S.mainSong.name,bpm:+S.mainSong.an.bpm.toFixed(2)}});
 await p.click('#projBtn');await p.waitForTimeout(1000);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:30000}),p.click('#projShare')]);
 const file=SP+'/shared-test.riddim';await dl.saveAs(file);await p.waitForTimeout(500);
 const msgA=await p.textContent('#projMsg');const size=fs.statSync(file).size;
 const vids=fs.statSync(CLIP).size+fs.statSync(SONG).size;
 rec('Share makes one file with the videos and songs in it',size>vids&&/Routine shared/.test(msgA)?'passed':'failed',`${(size/1048576).toFixed(2)} MB (video + song ${(vids/1048576).toFixed(2)} MB) · "${msgA}"`);
 await A.b.close();
 /* phone B: never seen these files */
 let B=await launch();p=await B.ctx.newPage();p.on('pageerror',e=>errs.push('B: '+e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();await p.waitForTimeout(800);
 await p.click('#projBtn');await p.waitForTimeout(400);await p.setInputFiles('#projImport',file);
 for(let i=0;i<60;i++){await p.waitForTimeout(500);if(/Opened/.test(await p.textContent('#projMsg')))break}
 await p.waitForTimeout(4000);
 const msgB=await p.textContent('#projMsg');
 const after=await p.evaluate(()=>{const R=window.__rs,S=R.S,n=R.srcById(S.cur);return {hasV:S.hasV,moves:S.moves.length,seq:S.seq.length,curve:!!(n&&n.curve&&n.curve.on),body:n&&n.body?n.body.n:(n?'loading':null),song:S.mainSong&&S.mainSong.name,ready:!!(S.mainSong&&S.mainSong.ready),bpm:S.mainSong&&S.mainSong.an&&+S.mainSong.an.bpm.toFixed(2),missing:document.getElementById('missBar').hidden?0:1}});
 rec('The other phone opens it: video, song, moves, routine and speed graph all there',after.hasV&&after.ready&&after.moves===before.moves&&after.seq===before.seq&&after.curve&&after.song===before.song&&!after.missing?'passed':'failed',JSON.stringify({before,after,msgB}));
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.body=undefined});await p.waitForTimeout(1500);
 const body=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);const B=n.body;return B?{n:B.n,hips:!!B.hips}:null});
 rec('Body tracking comes with it',body&&body.n===before.body&&body.hips?'passed':'failed',JSON.stringify(body));
 await p.click('#sheetClose');await p.click('#play');await p.waitForTimeout(2500);
 const play=await p.evaluate(()=>({playing:window.__rs.S.playing,song:!document.getElementById('aud').paused,t:+window.__rs.v().currentTime.toFixed(2)}));
 rec('…and it plays',play.playing&&play.song&&play.t>0.5?'passed':'failed',JSON.stringify(play));
 /* a cut-short file is refused cleanly */
 const cut=SP+'/shared-cut.riddim';fs.writeFileSync(cut,fs.readFileSync(file).subarray(0,Math.floor(size*0.6)));
 await p.click('#play');await p.click('#projBtn');await p.waitForTimeout(300);await p.setInputFiles('#projImport',cut);await p.waitForTimeout(2500);
 const msgC=await p.textContent('#projMsg');
 rec('A file cut short in sending is refused with a clear message',/cut short/.test(msgC)?'passed':'failed',msgC);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await B.b.close()})();
