/* Phone check. Usage: node report_test.js <host index.html> <clip> <song> <shot> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.grantPermissions(['clipboard-read','clipboard-write']);await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 await p.click('#play');await p.waitForTimeout(3000);await p.click('#play');
 await p.click('#recBtn');for(let i=0;i<240&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
 await p.evaluate(()=>{setTimeout(()=>{throw new Error('test error from the page')},0)});await p.waitForTimeout(200);
 await p.click('#projBtn');await p.waitForTimeout(800);await p.click('#phoneCheck');await p.waitForTimeout(1500);
 const txt=await p.evaluate(()=>navigator.clipboard.readText()).catch(()=>'');const shown=await p.inputValue('#phoneCheckOut');const msg=await p.textContent('#projMsg');
 console.log(txt);
 const has=k=>new RegExp('^'+k+': ','m').test(txt);
 rec('Copied to the clipboard and shown in the sheet',txt.length>100&&txt===shown&&/copied/.test(msg)?'passed':'failed',msg);
 rec('Has version, browser, screen, recording, tracking, sound, audio, storage and errors',['Version','Browser','Screen','Recording','Tracking','Sound','Cues','Audio','Storage','Errors'].every(has)?'passed':'failed',['Version','Browser','Screen','Recording','Tracking','Sound','Cues','Audio','Storage','Errors'].filter(k=>!has(k)).join(',')||'all there');
 rec('Version is the real one',/^Version: rs-[0-9a-f]{10}$/m.test(txt)?'passed':'failed',(txt.match(/^Version: .*$/m)||[''])[0]);
 rec('Tracking speed and delegate are there',/^Tracking: 1 video tracked · \d+ ms\/frame · CPU/m.test(txt)?'passed':'failed',(txt.match(/^Tracking: .*$/m)||[''])[0]);
 rec('Says which recorder the last take used',/last take used (WebCodecs|MediaRecorder)/.test(txt)&&/^Last take: /m.test(txt)?'passed':'failed',(txt.match(/^Recording: .*$/m)||[''])[0]);
 rec('Sound line holds the last play check',/^Sound: Last play: song and video within 40 ms/m.test(txt)?'passed':'failed',(txt.match(/^Sound: .*$/m)||[''])[0]);
 rec('Recent page error is listed',/test error from the page/.test(txt)?'passed':'failed','');
 rec('No file names in it',!/c2-15s|u3|dembow|\.webm|\.wav/.test(txt)?'passed':'failed','');
 await p.locator('#freshBox').screenshot({path:SHOT+'-check.png'});
 rec('No other page errors',errs.filter(e=>!/test error from the page/.test(e)).length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
