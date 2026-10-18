/* MirrorView Pulse with the shared beat engine, on a clip whose music has known beats (dembow 100 BPM test track). */
const {launch}=require('./harness');const fs=require('fs');
const [,,URL_,CLIP,TRUTH]=process.argv;const T=JSON.parse(fs.readFileSync(TRUTH));
function F(est,ref,tol){const used=new Set();let hit=0;for(const r of ref){let bi=-1,bd=1e9;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}const p=est.length?hit/est.length:0,r=ref.length?hit/ref.length:0;return p+r?2*p*r/(p+r):0}
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(URL_+'#debug');await p.setInputFiles('#file-input',CLIP);await p.waitForTimeout(3000);
 const r=await p.evaluate(async()=>{document.querySelector('[data-music="open"]').click();await new Promise(r=>setTimeout(r,800));document.getElementById('music-analyse').click();
   for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,500));if(window.__mv.music.analysis&&!window.__mv.music.busy)break}
   const a=window.__mv.music.analysis;return a?{engine:a.beatEngine,tempo:a.tempo,dsp:a.pulseDspTempo,offset:a.riddimOffset,corr:a.riddimCorr,dur:a.duration,status:document.getElementById('music-analysis-status').textContent}:null});
 if(!r){console.log('FAILED no analysis',errs);await b.close();return}
 const per=60/r.tempo.bpm, grid=[];for(let t=r.tempo.phase;t<=r.dur;t+=per)grid.push(t);for(let t=r.tempo.phase-per;t>=0;t-=per)grid.unshift(t);
 const truth=T.beats.filter(t=>t<=r.dur);const f=F(grid,truth,0.07);
 const dspGrid=[];if(r.dsp&&r.dsp.bpm){const pp=60/r.dsp.bpm;for(let t=r.dsp.phase;t<=r.dur;t+=pp)dspGrid.push(t);for(let t=r.dsp.phase-pp;t>=0;t-=pp)dspGrid.unshift(t)}
 const off=grid.map(g=>{let b=1e9;for(const t of truth)if(Math.abs(t-g)<Math.abs(b))b=g-t;return b}).filter(x=>Math.abs(x)<.1).sort((a,b)=>a-b);
 console.log((f>0.9?'PASSED':'FAILED').padEnd(8),'Pulse beat grid vs known beats — engine',r.engine,'· tempo',r.tempo.bpm,'(true',T.bpm+') · F(±70 ms)',f.toFixed(3),'· median offset',(off[off.length>>1]*1000).toFixed(0),'ms · alignment',(r.offset*1000).toFixed(0),'ms r='+r.corr.toFixed(2));
 console.log('        MirrorView’s own estimate on the same audio: tempo',r.dsp&&r.dsp.bpm,'· F(±70 ms)',F(dspGrid,truth,0.07).toFixed(3));
 console.log('        status:',r.status,'· warning:',r.tempo.timingWarning||'none','· errors',errs.length);
 await b.close()})();
