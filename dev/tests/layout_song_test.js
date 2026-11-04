/* The player stays together on a phone: the play bar right under the video, and the option panels (Group, Cut out,
   Practice) below it, scrolling normally, never pushing the play bar off screen. A new song shows straight away and
   replaces the old one; a 2-minute song reads 2:00.0.
   Usage: node layout_song_test.js <page> <one-dancer clip> <song A> <song B> [shot prefix] */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const [,,HOST,CLIP,SA,SB,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch({camFile:'/home/claude/tests/media/cam.y4m'});
 await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.setViewportSize({width:402,height:874});
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 await p.click('#bodyTrack');
 for(let i=0;i<1200;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return !window.__rs.S.bodyBusy&&!!(n&&n.body)}))break}
 const geo=()=>p.evaluate(()=>{const R=id=>{const e=document.getElementById(id)||document.querySelector(id);if(!e)return null;const r=e.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),h:Math.round(r.height),vis:!e.hidden&&r.height>0}};
   const tabs=document.querySelector('.tabs').getBoundingClientRect();return {stage:R('stage'),play:R('play'),scrub:R('scrub'),pin:R('.pin'),group:R('groupBar'),cut:R('cutBar'),prac:R('pracBar'),tabsTop:Math.round(tabs.top),sy:Math.round(scrollY)}});
 const ok=(g,label)=>{const r={label,playUnderVideo:g.play.t-g.stage.b,playAboveTabs:g.tabsTop-g.play.b,pinH:g.pin.h};return r};
 /* Group on, with formations and the floor plan open (the case in the user's recording) */
 await p.evaluate(()=>{window.scrollTo(0,0)});await p.click('#dkGroup');await p.waitForTimeout(800);
 await p.evaluate(()=>{const e=document.getElementById('grEdit');if(e&&e.getAttribute('aria-pressed')!=='true')e.click()});await p.waitForTimeout(600);
 const g1=await geo();if(SHOT)await p.screenshot({path:SHOT+'-group.png'});
 /* scroll down to the floor plan: the play bar stays pinned on screen, under the video */
 await p.evaluate(()=>document.getElementById('grPlan').scrollIntoView({block:'center'}));await p.waitForTimeout(600);const g2=await geo();
 const planVis=await p.evaluate(()=>{const r=document.getElementById('grPlan').getBoundingClientRect(),pin=document.querySelector('.pin').getBoundingClientRect(),tabs=document.querySelector('.tabs').getBoundingClientRect();return r.top>=pin.bottom-2&&r.bottom<=tabs.top+2&&r.height>40});
 if(SHOT)await p.screenshot({path:SHOT+'-group-scrolled.png'});
 rec('Group on: the play bar sits right under the video and above the tabs; Group options are below it, not in the pinned player',g1.play.t-g1.stage.b>=0&&g1.play.t-g1.stage.b<20&&g1.tabsTop-g1.play.b>0&&g1.group.vis&&g1.group.t>g1.pin.b-2&&g1.pin.h<874-73-120?'passed':'failed',JSON.stringify({...ok(g1),group:g1.group}));
 rec('Scrolling down to the floor plan: it shows in full between the player and the tabs, and the play bar stays on screen',planVis&&g2.tabsTop-g2.play.b>0&&g2.play.t>0&&g2.sy>0?'passed':'failed',JSON.stringify({planVis,...ok(g2),sy:g2.sy}));
 await p.click('#dkGroup');
 /* Cut out + Practice (Ghost): same rule */
 await p.evaluate(()=>window.scrollTo(0,0));await p.click('#dkCut');await p.waitForTimeout(500);await p.click('#t-body');await p.waitForTimeout(3000);
 await p.evaluate(()=>{window.__rsPR.count=0});await p.click('#pracMode button[data-pm="ghost"]');await p.waitForTimeout(800);await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(300);
 const g3=await geo();if(SHOT)await p.screenshot({path:SHOT+'-ghost.png'});
 rec('Practice (Ghost) with Cut out: play bar under the video and above the tabs; the options below it',g3.play.t-g3.stage.b>=0&&g3.play.t-g3.stage.b<20&&g3.tabsTop-g3.play.b>0&&g3.prac.vis&&g3.prac.t>g3.pin.b-2?'passed':'failed',JSON.stringify({...ok(g3),prac:g3.prac,cut:g3.cut}));
 await p.click('#pracStop').catch(()=>{});await p.evaluate(()=>{const t=document.getElementById('t-body');if(window.__rsPR.on)t.click()});await p.waitForTimeout(500);
 /* closed before the hits were saved: the project has the skeleton but no hits; opening it finds them again */
 await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);n.motion=null});await p.waitForTimeout(3500);
 await p.reload();let hb=null;for(let i=0;i<30;i++){await p.waitForTimeout(500);hb=await p.evaluate(()=>{const n=window.__rs.srcById(window.__rs.S.cur);return {beats:n&&n.motion?n.motion.beats.length:0,body:!!(n&&n.body),rebuilt:window.__rs.S.hitsRebuilt||0,targets:window.__rsPrHits().length}});if(hb.beats)break}
 rec('A clip whose hits weren\'t saved gets them back from its skeleton when opened (Practice has targets)',hb.beats>=3&&hb.rebuilt===1&&hb.targets>0?'passed':'failed',JSON.stringify(hb));
 /* songs: A then B; B shows at once and replaces A */
 const tmp=path.join(os.tmpdir(),'rs-2min-'+process.pid+'.wav');cp.execFileSync('ffmpeg',['-v','error','-y','-i',SB,'-af','apad','-t','119.97','-ar','44100',tmp]);
 await p.setInputFiles('#audFile',SA);for(let i=0;i<40;i++){await p.waitForTimeout(250);if(await p.evaluate(()=>!!(window.__rs.S.mainSong&&window.__rs.S.mainSong.ready)))break}
 const nameA=await p.evaluate(()=>document.getElementById('audName').textContent);
 await p.setInputFiles('#audFile',tmp);const soon=await p.evaluate(()=>document.getElementById('audName').textContent);
 let nameB='';for(let i=0;i<60;i++){await p.waitForTimeout(250);nameB=await p.evaluate(()=>document.getElementById('audName').textContent);if(!/Loading/.test(nameB))break}
 const cur=await p.evaluate(()=>window.__rs.S.mainSong&&window.__rs.S.mainSong.name);
 fs.unlinkSync(tmp);
 rec('A new song shows as soon as it is picked ("Loading …"), then replaces the old one',/^Loading rs-2min/.test(soon)&&/^rs-2min/.test(nameB)&&/^rs-2min/.test(cur)&&!/rs-2min/.test(nameA)?'passed':'failed',JSON.stringify({nameA,soon,nameB}));
 rec('A song just under 2 minutes reads 2:00.0 (it read 1:60.0)',/2:00\.0/.test(nameB)?'passed':'failed',nameB);
 const dup=await p.evaluate(()=>{const c={};document.querySelectorAll('[id]').forEach(e=>c[e.id]=(c[e.id]||0)+1);return Object.keys(c).filter(k=>c[k]>1)});
 rec('No element appears twice on the page (each id once)',dup.length===0?'passed':'failed',JSON.stringify(dup.slice(0,8)));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
