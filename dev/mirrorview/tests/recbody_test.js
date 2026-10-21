/* Takes with the dance body drawn on. Usage: node recbody_test.js <host index.html> <clip> <song> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 /* count the dance body's blue and pink in frames of the take */
 const recordAndCount=async()=>{await p.evaluate(()=>{window.__rs.v().currentTime=0});await p.waitForTimeout(300);
   await p.click('#recBtn');for(let i=0;i<240&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
   const r=await p.evaluate(async()=>{const tv=document.getElementById('takeVid');for(let i=0;i<40&&!(tv.duration>0&&isFinite(tv.duration));i++)await new Promise(r=>setTimeout(r,200));
     const c=document.createElement('canvas');c.width=tv.videoWidth;c.height=tv.videoHeight;const x=c.getContext('2d');let blue=0,pink=0,frames=0;
     for(const t of [3,6,9]){await new Promise(r=>{tv.onseeked=r;tv.currentTime=t});x.drawImage(tv,0,0);const d=x.getImageData(0,0,c.width,c.height).data;frames++;
       for(let i=0;i<d.length;i+=16){const R=d[i],G=d[i+1],B=d[i+2];if(R<140&&G<170&&B>215&&B-R>70)blue++;if(R>215&&G<130&&B>120&&B<210)pink++}}
     return {w:c.width,h:c.height,blue,pink,dur:+tv.duration.toFixed(2),info:document.getElementById('takeInfo').textContent}});
   await p.click('#discardBtn').catch(()=>{});await p.waitForTimeout(400);return r};
 const plain=await recordAndCount();
 await p.check('#recBody');
 const drawn=await recordAndCount();
 rec('A plain take has no dance body in it',plain.blue<50&&plain.pink<30?'passed':'failed',JSON.stringify(plain));
 rec('With "Draw it on recorded takes", the body and hips are in the video',drawn.blue>10*Math.max(5,plain.blue)&&drawn.pink>5*Math.max(5,plain.pink)?'passed':'failed',JSON.stringify(drawn));
 rec('Sound still checks out',/lines up|sound checked/.test(drawn.info)||!/early|late/.test(drawn.info)?'passed':'failed',drawn.info);
 /* a frame for the eye */
 await p.evaluate(()=>{window.__rs.v().currentTime=0});await p.click('#recBtn');for(let i=0;i<240&&await p.isHidden('#take');i++)await p.waitForTimeout(250);
 await p.evaluate(async()=>{const tv=document.getElementById('takeVid');await new Promise(r=>{tv.onseeked=r;tv.currentTime=6.7})});await p.locator('#takeVid').screenshot({path:SHOT+'-take.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
