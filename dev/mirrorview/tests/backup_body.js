/* Body tracking survives a backup: save the backup, wipe the app, open the backup, add the same video again.
   Usage: node backup_body.js <host index.html> <clip> <song> */
const {chromium}=require('playwright');const {launch}=require('./harness');const fs=require('fs');
const [,,HOST,CLIP,SONG]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const before=await p.evaluate(()=>{const B=window.__rs.srcById(window.__rs.S.cur).body;let s=0;for(let i=0;i<B.data.length;i+=97)if(!isNaN(B.data[i]))s+=B.data[i];return {n:B.n,v:B.v,sum:+s.toFixed(4),world:!!B.world,hips:!!B.hips}});
 /* save the backup (no share sheet here, so it downloads) */
 await p.click('#projBtn');await p.waitForTimeout(800);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('#projExport')]);
 const file='/tmp/claude-0/-home-claude/c7d6fa6b-e9dd-5d62-903e-3e4d46a3b3b0/scratchpad/backup-test.riddim.json';await dl.saveAs(file);
 const J=JSON.parse(fs.readFileSync(file,'utf8'));const keys=Object.keys(J.bodies||{});
 rec('Backup file includes body tracking',keys.length===1?'passed':'failed',`${(fs.statSync(file).size/1024).toFixed(0)} KB, body tracking for ${keys.length} video(s)`);
 /* wipe everything and open the backup */
 await p.evaluate(()=>new Promise(r=>{localStorage.clear();const q=indexedDB.deleteDatabase('riddim-swap');q.onsuccess=q.onerror=q.onblocked=()=>r()}));
 await p.reload();await p.waitForTimeout(1500);
 await p.click('#projBtn');await p.waitForTimeout(500);await p.setInputFiles('#projImport',file);await p.waitForTimeout(2500);
 const msg=await p.textContent('#projMsg');
 rec('Opening the backup restores the tracking',/Body tracking for 1 video restored/.test(msg)?'passed':'failed',msg);
 /* add the same video again: tracking reconnects without tracking again */
 await p.click('#sheetClose').catch(()=>{});await p.waitForTimeout(300);
 const missBtn=await p.$('#missList input[type=file], #missFix');
 await p.evaluate(()=>{const s=document.getElementById('sheet');if(s&&!s.hidden)document.getElementById('sheetClose').click()});
 const inp=await p.$('#missList input[type=file]');if(inp)await inp.setInputFiles(CLIP);else await p.setInputFiles('#vidFile',CLIP);
 await p.waitForTimeout(3000);
 const after=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);const B=n&&(n.body||null);if(!B)return null;let s=0;for(let i=0;i<B.data.length;i+=97)if(!isNaN(B.data[i]))s+=B.data[i];return {n:B.n,v:B.v,sum:+s.toFixed(4),world:!!B.world,hips:!!B.hips,cut:!!B.mask}});
 rec('Same video added again: the same poses, 3D points and hip measures are back',after&&after.n===before.n&&Math.abs(after.sum-before.sum)<1e-3&&after.world&&after.hips?'passed':'failed',JSON.stringify({before,after}));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
