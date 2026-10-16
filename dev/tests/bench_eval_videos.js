/* Score a dance-hit detector version on the video benchmark. usage: node bench_eval_videos.js <analysis.js> [dir] [opt-json]
   Frames are decoded by ffmpeg at the app's analysis size (112 px wide) and fed in the same way the app does. */
const RA=require(require('path').resolve(process.argv[2]));const fs=require('fs');const {execFileSync}=require('child_process');
if(process.env.CFG&&RA.CFG)Object.assign(RA.CFG,JSON.parse(process.env.CFG));
const DIR=process.argv[3]||'media/bench', OPT=JSON.parse(process.argv[4]||'{}');
function F(est,ref,tol){const used=new Set();let hit=0;for(const r of ref){let bi=-1,bd=1e9;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}const p=est.length?hit/est.length:0,r=ref.length?hit/ref.length:0;return p+r?2*p*r/(p+r):0}
const rows=[];let sF=0,sE=0;const files=fs.readdirSync(DIR).filter(f=>/^v_.*\.webm$/.test(f)).sort();
for(const f of files){
  const T=JSON.parse(fs.readFileSync(DIR+'/'+f.replace('.webm','.json'))).hits;
  const W=+(process.env.AW||112),H=Math.round(W*640/360),fps=30;
  const raw=execFileSync('ffmpeg',['-v','error','-i',DIR+'/'+f,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<28});
  const n=raw.length/(W*H);let m;
  if(RA.analyzeMotionVecs){const frames=[];let prev=null;for(let i=0;i<n;i++){const g=raw.subarray(i*W*H,(i+1)*W*H);if(prev)frames.push({t:i/fps,v:RA.flowVecs(prev,g,W,H)});prev=g}m=RA.analyzeMotionVecs(frames,W,H,OPT)}
  else{let prev=null;const series=[];for(let i=0;i<n;i++){const g=raw.subarray(i*W*H,(i+1)*W*H);if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,H,8));series.push({t:i/fps,D:dg.D,cam:dg.cam,mag:dg.mag})}prev=g}m=RA.analyzeMotion(series)}
  const est=m.beats.map(b=>b.t), Fv=F(est,T,0.07);
  const err=T.map(h=>Math.min(...est.map(e=>Math.abs(e-h)))).filter(x=>x<0.07).sort((a,b)=>a-b);
  const sg=T.map(h=>{let b=1e9;for(const x of est)if(Math.abs(x-h)<Math.abs(b))b=x-h;return b}).filter(x=>Math.abs(x)<0.07).sort((a,b)=>a-b);
  const med=err.length?err[err.length>>1]*1000:NaN; sF+=Fv; sE+=isNaN(med)?70:med;
  rows.push({video:f.replace('.webm',''),hits:T.length,found:est.length,F70:+Fv.toFixed(3),F100:+F(est,T,0.1).toFixed(3),medErrMs:+med.toFixed(1),biasMs:sg.length?+(sg[sg.length>>1]*1000).toFixed(0):null,roi:m.roi?m.roi.map(x=>x.toFixed(2)).join(','):''});
}
console.table(rows);
console.log(`SUMMARY mean hit F=${(sF/files.length).toFixed(3)} · mean median error ${(sE/files.length).toFixed(1)} ms`);
