/* Who the skeleton follows when there are several people (1 Nov). tests/media/front.webm (made from the test clips
   c2-15s and u2, the command below): a small dancer (right) the whole 12 s; a big dancer (left,
   nearer the camera) fading in at 4 s and out at 9 s.
   ffmpeg -f lavfi -i color=c=0x404040:s=640x640:r=30:d=12 -i c2-15s.webm -i u2.webm -filter_complex "[1:v]scale=-2:384,setpts=PTS-STARTPTS[k];
     [2:v]setpts=PTS-STARTPTS,format=yuva420p,fade=t=in:st=4:d=0.7:alpha=1,fade=t=out:st=9:d=0.5:alpha=1[d];[0:v][k]overlay=410:240:shortest=1[a];
     [a][d]overlay=20:0:enable='between(t,4,9.5)'[o]" -map "[o]" -t 12 -r 30 -c:v libvpx -b:v 1500k front.webm Without a chosen dancer the skeleton should move to
   the big one soon after they appear, and back to the small one soon after they go. With the small one chosen, it stays on them.
   Usage: node follow_test.js <host index.html> <clip> */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30;window.RB_MODEL='full'});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2500);
 /* each frame: where the people found are (hip x) and which one is followed */
 const run=pick=>p.evaluate(async pick=>{window.RB_DEBUG_ALL=[];const n=window.__rs.srcById(window.__rs.S.cur);const B=await RB.track(n.url,pick?{pick}:{});
   const hx=P=>(P[23][0]+P[24][0])/2;const o=window.RB_DEBUG_ALL.map(d=>({t:+d.t.toFixed(3),xs:d.cands.map(c=>+hx(c.pts).toFixed(3)),ch:d.ch>=0?+hx(d.cands[d.ch].pts).toFixed(3):null}));
   return {o,switches:B.switches,cuts:B.cuts.map(c=>+c.toFixed(2))}},pick);
 const small=x=>x>0.6, big=x=>x<0.5;
 /* share of the frames in [a,z) where `who` was found in which `who` is the one followed */
 const share=(o,a,z,who)=>{const s=o.filter(f=>f.t>=a&&f.t<z&&f.xs.some(who));return s.length?+(s.filter(f=>f.ch!=null&&who(f.ch)).length/s.length).toFixed(2):null};
 const A=await run(null);
 const firstBig=(A.o.find(f=>f.t>=4&&f.ch!=null&&big(f.ch))||{t:99}).t, backSmall=(A.o.find(f=>f.t>=9&&f.ch!=null&&small(f.ch))||{t:99}).t;
 const r={before:share(A.o,0,3.95,small),during:share(A.o,5,8.95,big),after:share(A.o,10,12,small),firstBig,backSmall,switches:A.switches,cuts:A.cuts};
 rec('Only the small dancer there: they are followed',r.before>=0.9?'passed':'failed',JSON.stringify(r));
 rec('A dancer nearer the camera comes in: the skeleton moves to them within 1 s and stays on them',firstBig<=5&&r.during>=0.85?'passed':'failed',JSON.stringify(r));
 rec('They leave: back on the small dancer within 0.5 s of fading out',backSmall<=10&&r.after>=0.9?'passed':'failed',JSON.stringify(r));
 /* the small one chosen (Choose the dancer, tapped at 3 s): it stays on them */
 const C=await run({x:0.83,y:0.7,t:3});
  const c={whole:share(C.o,0,12,small),during:share(C.o,4,9,small),switches:C.switches,missed:C.o.filter(f=>f.xs.some(small)&&!(f.ch!=null&&small(f.ch))).map(f=>f.t).filter((t,i,a)=>i%5===0)};
 rec('With the small dancer chosen, the skeleton stays on them while the big one is there',c.during>=0.9&&c.whole>=0.9?'passed':'failed',JSON.stringify(c));
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));await b.close()})();
