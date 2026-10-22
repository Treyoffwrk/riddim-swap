/* Beat cues, measured in the running app.
   Song: a riddim with KNOWN kick/bass/snare times, a slow tempo drift and a drum break. Clip: a dancer with KNOWN hit times.
   Usage: node cue_test.js <host index.html> <clip> <clip truth json> <song wav> <song truth json> <shot prefix> */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs');
const [,,HOST,CLIP,CLIPT,SONG,SONGT,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
const T=JSON.parse(fs.readFileSync(SONGT)), D=JSON.parse(fs.readFileSync(CLIPT));
const dedupe=a=>{const o=[];for(const t of a.slice().sort((x,y)=>x-y))if(!o.length||t-o[o.length-1]>0.03)o.push(t);return o};
const TRUE=dedupe([...T.kick,...(T.bass||[]),...T.snare]);
const nearest=(arr,t)=>{let m=1e9;for(const x of arr)if(Math.abs(x-t)<Math.abs(m))m=x-t;return m};
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
(async()=>{const {b,ctx}=await launch();
 await ctx.addInitScript(()=>{window.__osc=[];const st=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(when){try{window.__osc.push({when,now:this.context.currentTime,song:window.__rs&&window.__rs.songNow(),f:this.frequency.value})}catch(e){}return st.apply(this,arguments)}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(1500);
 await p.click('#t-clip');await p.click('#danceAnalyze');
 for(let i=0;i<120;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>{const S=window.__rs.S,so=S.mainSong,n=window.__rs.srcById(S.cur);return so&&so.an&&so.an.riddim&&n&&n.motion&&n.motion.beats.length>3}))break}
 /* 1. the riddim the app found vs the true drum hits; early vs late in the song (drift) */
 const an=await p.evaluate(()=>{const so=window.__rs.S.mainSong;return {ev:so.an.riddim.events,sure:so.an.riddim.sure,bpm:so.an.bpm,beats:so.an.beats,grid:so.an.grid,sBase:window.__rs.S.sBase,sAnchor:window.__rs.S.sAnchor,text:document.getElementById('riddimMsg').textContent}});
 const ev=an.ev.map(e=>e.t), errs50=ev.map(t=>nearest(TRUE,t)), hit=errs50.filter(e=>Math.abs(e)<=0.05);
 const prec=hit.length/ev.length, recall=TRUE.filter(t=>Math.abs(nearest(ev,t))<=0.05).length/TRUE.length;
 const early=errs50.filter((e,i)=>ev[i]<12&&Math.abs(e)<=0.05).map(Math.abs), late=errs50.filter((e,i)=>ev[i]>28&&Math.abs(e)<=0.05).map(Math.abs);
 const inBreak=T.break&&T.break[1]?an.ev.filter(e=>e.t>T.break[0]+0.1&&e.t<T.break[1]-0.1&&Math.abs(nearest(TRUE,e.t))>0.05).length:0;
 rec('The riddim cues are the real drum hits (precision ≥ 0.9, recall ≥ 0.8)',prec>=0.9&&recall>=0.8?'passed':'failed',JSON.stringify({events:ev.length,truth:TRUE.length,precision:+prec.toFixed(2),recall:+recall.toFixed(2)}));
 rec('They stay on time to the end of the song (median error early vs late, under 20 ms both)',q(early,0.5)<0.02&&q(late,0.5)<0.02?'passed':'failed',`first 12 s ${Math.round(q(early,0.5)*1000)} ms (p90 ${Math.round(q(early,0.9)*1000)}) · after 28 s ${Math.round(q(late,0.5)*1000)} ms (p90 ${Math.round(q(late,0.9)*1000)})`);
 rec('No cues in the drum break',inBreak===0?'passed':'failed',`${inBreak} cue(s) in the break ${JSON.stringify(T.break)}`);
 /* the old lights: a fixed tempo from the first downbeat; the count now follows the beat list */
 const oldErr=T.beats.map(t=>{const bp=(t-an.sAnchor)*an.sBase/60;return Math.abs(bp-Math.round(bp))*60/an.sBase}), inGrid=T.beats.filter(t=>t>=an.grid[0]-0.1&&t<=an.grid[an.grid.length-1]+0.1), newErr=inGrid.map(t=>Math.abs(nearest(an.grid,t)));
 rec('The count follows the song (worst beat error under 40 ms; the old fixed-tempo lights for comparison)',Math.max(...newErr)<0.04?'passed':'failed',`${T.beats.length-inGrid.length} true beat(s) before the first detected beat, no count there · count now: median ${Math.round(q(newErr,0.5)*1000)} ms, worst ${Math.round(Math.max(...newErr)*1000)} ms · old lights: median ${Math.round(q(oldErr,0.5)*1000)} ms, worst ${Math.round(Math.max(...oldErr)*1000)} ms`);
 rec('The song card says what was found',/Riddim: \d+ low hits/.test(an.text)?'passed':'failed',an.text);
 /* 2. play: record each landing of both balls (heard time at that frame) and the video position when the dancer ball lands */
 await p.click('#t-song');await p.check('#clickOn');await p.selectOption('#clickWhat','riddim');await p.click('#t-clip');
 await p.evaluate(()=>{const R=window.__rs;window.__land=[];window.__clk=[];let lr=null,ld=null;
   const f=()=>{if(R.S.playing){const H=R.heardNow(),rid=R.riddimEvents(),d=R.dancerEvents(),beat=rid.beat;const a=R.lane(rid.ev,H,beat),b=R.lane(d,H,beat);
     if(a.land&&a.land.t!==lr){lr=a.land.t;window.__land.push({k:'r',ev:a.land.t,H,prevH:window.__lastH,ct:document.getElementById('aud').currentTime})}
     if(b.land&&b.land.t!==ld){ld=b.land.t;window.__land.push({k:'d',ev:b.land.t,H,prevH:window.__lastH,vt:R.v().currentTime,ct:document.getElementById('aud').currentTime})}
     window.__clk.push(H-document.getElementById('aud').currentTime)}window.__lastH=R.S.playing?R.heardNow():null;requestAnimationFrame(f)};requestAnimationFrame(f)});
 await p.click('#play');await p.waitForTimeout(5200);
 await p.locator('#stage').screenshot({path:SHOT+'-ball.png'});
 await p.waitForTimeout(4000);await p.click('#play');
 const L=await p.evaluate(()=>({land:window.__land,clk:window.__clk,osc:window.__osc,cIn:window.__rs.S.cIn,vr:window.__rs.S.vr,ar:window.__rs.S.ar}));
 const lr=L.land.filter(x=>x.k==='r'), ld=L.land.filter(x=>x.k==='d');
 const lateR=lr.map(x=>x.H-x.ev);
 /* the landing must show on the first frame drawn after the cue: the frame before was still ahead of it */
 const firstFrame=lr.filter(x=>x.prevH!=null&&x.prevH<x.ev+0.002&&x.H>=x.ev).length/Math.max(1,lr.filter(x=>x.prevH!=null).length);
 rec('The riddim ball lands on the first frame drawn after each cue',lr.length>8&&firstFrame>=0.95?'passed':'failed',`${Math.round(firstFrame*100)}% on the first frame; `+`${lr.length} landings · this test machine draws slowly, so lateness to the frame is median ${Math.round(q(lateR,0.5)*1000)} ms, p90 ${Math.round(q(lateR.map(Math.abs),0.9)*1000)} ms`);
 /* dancer ball vs the true hit times in the video: when it lands, the video should be showing that hit */
 /* where the video was at the landing instant: the frame that caught it came (H - cue) late, so step back by that much video */
 const dVid=ld.map(x=>{const at=x.vt-(x.H-x.ev)*L.vr/(L.ar||1);const h=D.hits.reduce((m,t)=>Math.abs(t-at)<Math.abs(m-at)?t:m,1e9);return at-h});
 rec('When the dancer ball lands, the video is at the dancer\'s hit (within 60 ms)',ld.length>=5&&q(dVid.map(Math.abs),0.5)<0.06?'passed':'failed',`${ld.length} landings · video minus true hit: median ${Math.round(q(dVid,0.5)*1000)} ms, worst ${Math.round(Math.max(...dVid.map(Math.abs))*1000)} ms`);
 const cj=L.clk.slice(10), jit=[];for(let i=1;i<cj.length;i++)jit.push(Math.abs(cj[i]-cj[i-1]));
 rec('The cue clock is smooth (frame-to-frame jitter under 5 ms) and one frame ahead of the song',q(jit,0.9)<0.005&&Math.abs(q(cj,0.5)-1/60)<0.012?'passed':'failed',`ahead of song by ${Math.round(q(cj,0.5)*1000)} ms (one frame = 17), jitter p90 ${(q(jit,0.9)*1000).toFixed(1)} ms`);
 /* riddim click: each click scheduled for its cue (song time the click sounds at, minus the cue's time) */
 const osc=L.osc.filter(o=>o.song!=null&&o.song>0.2), oe=osc.map(o=>{const at=o.song+(o.when-o.now);return nearest(ev,at)});
 rec('The riddim click is scheduled on each cue (within 5 ms)',osc.length>8&&q(oe.map(Math.abs),0.9)<0.005?'passed':'failed',`${osc.length} clicks · error p90 ${(q(oe.map(Math.abs),0.9)*1000).toFixed(1)} ms · low ${osc.filter(o=>o.f===520).length}, high ${osc.filter(o=>o.f===2100).length}, both ${osc.filter(o=>o.f===900).length}`);
 /* 3. sound delay 200 ms (Bluetooth): the song runs 200 ms ahead of the picture, and the ball lands 200 ms later on the song clock */
 await p.click('#t-tempo');await p.click('#delaySeg button[data-d="200"]');await p.click('#t-clip');
 await p.evaluate(()=>{window.__off=[];const R=window.__rs;const f=()=>{if(R.S.playing)window.__off.push(document.getElementById('aud').currentTime-R.expected());requestAnimationFrame(f)};requestAnimationFrame(f)});
 await p.evaluate(()=>{window.__land=[]});await p.click('#play');await p.waitForTimeout(5000);await p.click('#play');
 const B=await p.evaluate(()=>({off:window.__off.slice(-60),land:window.__land.filter(x=>x.k==='r')}));
 const off=q(B.off,0.5), late2=q(B.land.map(x=>x.ct-x.ev),0.5), late0=q(lr.map(x=>x.ct-x.ev),0.5);
 rec('Bluetooth: the song plays 200 ms ahead of the video so they meet at your ears',Math.abs(off-0.2)<0.03?'passed':'failed',`song ahead of video by ${Math.round(off*1000)} ms`);
 rec('Bluetooth: the ball lands 200 ms after the song passes each cue (when you hear it)',Math.abs(late2-late0-0.2)<0.03?'passed':'failed',`${Math.round((late2-late0)*1000)} ms later than with no delay (${Math.round(late2*1000)} vs ${Math.round(late0*1000)} ms after the song passes the cue)`);
 await p.click('#t-tempo');await p.click('#delaySeg button[data-d="0"]');
 /* 4. the setting: Off hides the balls; Count keeps the count only */
 await p.click('#bvSeg button[data-bv="off"]');await p.waitForTimeout(300);
 const blank=await p.evaluate(()=>{const c=document.getElementById('cueCanvas'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=16)if(d[i]>0)n++;return n});
 rec('Off: no balls drawn',blank===0?'passed':'failed',blank+' painted pixels');
 await p.click('#bvSeg button[data-bv="ball"]');
 await p.waitForTimeout(600);await p.locator('#cueBox').screenshot({path:SHOT+'-settings.png'});await p.locator('#delayBox').screenshot({path:SHOT+'-delay.png'});
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
