/* Run the motion detector on frames decoded by ffmpeg (no browser), at several analysis widths. */
const RA=require('../analysis.js');const {execFileSync}=require('child_process');const fs=require('fs');
const [,,video,truth]=process.argv; const T=JSON.parse(fs.readFileSync(truth)).hits;
function F(est,ref,tol){const used=new Set();let hit=0;for(const r of ref){let bi=-1,bd=1e9;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}const p=est.length?hit/est.length:0,r=ref.length?hit/ref.length:0;return p+r?2*p*r/(p+r):0}
for(const W of [96,112,128,160]){
  const H=Math.round(W*640/360);
  const raw=execFileSync('ffmpeg',['-v','error','-i',video,'-vf',`scale=${W}:${H}`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<28});
  const n=raw.length/(W*H), fps=30; let prev=null; const series=[];
  for(let i=0;i<n;i++){const g=raw.subarray(i*W*H,(i+1)*W*H);if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,H,8));series.push({t:i/fps,D:dg.D,cam:dg.cam,mag:dg.mag})}prev=g}
  const m=RA.analyzeMotion(series), est=m.beats.map(b=>b.t);
  const signed=T.map(h=>{let best=1e9;for(const e of est)if(Math.abs(e-h)<Math.abs(best))best=e-h;return best}).filter(x=>Math.abs(x)<0.2).sort((a,b)=>a-b);
  console.log(`W=${W}: found ${est.length}/${T.length}  F70=${F(est,T,0.07).toFixed(3)}  F100=${F(est,T,0.1).toFixed(3)}  median signed error ${(signed[signed.length>>1]*1000).toFixed(0)} ms`);
}
