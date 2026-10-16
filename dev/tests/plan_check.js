/* Map the TRUE source hits through the app's plan and check (a) they land on the TRUE song beats, (b) the take's frames follow the plan. */
const RA=require('../analysis.js');const fs=require('fs');const {execFileSync}=require('child_process');
const [,,planF,hitsF,beatsF,take]=process.argv;const plan=JSON.parse(fs.readFileSync(planF)),H=JSON.parse(fs.readFileSync(hitsF)).hits,B=JSON.parse(fs.readFileSync(beatsF)).beats;
const toOut=(x,t)=>{const r=x.warpR||x.sp||plan.vr;const k=(plan.alignOn&&x.warp)?x.warp:[[x.s,0],[x.e,(x.e-x.s)/r]];for(let i=1;i<k.length;i++)if(t<=k[i][0]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return o1+(t-s1)*(o2-o1)/(s2-s1)}return k[k.length-1][1]};
let T=0;const mapped=[];
for(const x of plan.seq){for(const h of H)if(h>=x.s&&h<=x.e)mapped.push({t:T+toOut(x,h),w:1});const k=(plan.alignOn&&x.warp)?x.warp:null;T+=k?k[k.length-1][1]:(x.e-x.s)/(x.warpR||plan.vr)}
const tb=B.map(b=>(b-plan.offset)/plan.ar);const tg=[];for(let i=0;i<tb.length;i++){tg.push(tb[i]);if(i<tb.length-1)tg.push((tb[i]+tb[i+1])/2)}
const sc=RA.score(mapped,tg,0.05), ctl=RA.score(mapped.map(m=>({t:m.t+0.15,w:1})),tg,0.05);
console.log('plan vs TRUE beats: BAS',sc.bas.toFixed(3),'median miss',sc.errMs.toFixed(0),'ms · quarter-beat control',ctl.bas.toFixed(3),'· total length',T.toFixed(2),'s');
if(take){const W=112;const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',take]));const vw=info.streams[0].width,vh=info.streams[0].height,Hh=Math.round(W*vh/vw/2)*2;
  const fr=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','frame=pts_time','-of','csv=p=0',take]).toString().trim().split('\n').map(Number);
  const raw=execFileSync('ffmpeg',['-v','error','-i',take,'-vf',`scale=${W}:${Hh}`,'-vsync','0','-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<28});
  const n=raw.length/(W*Hh);let prev=null;const series=[];for(let i=0;i<n;i++){const g=raw.subarray(i*W*Hh,(i+1)*W*Hh);if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,Hh,8));series.push({t:fr[i],D:dg.D,cam:dg.cam,mag:dg.mag})}prev=g}
  const det=RA.analyzeMotion(series).beats.map(b=>b.t);
  const d=mapped.map(m=>Math.min(...det.map(x=>Math.abs(x-m.t)))).sort((a,b)=>a-b);
  console.log('take frames vs plan: hits detected in take',det.length,'· median distance to planned hit',(d[d.length>>1]*1000).toFixed(0),'ms · within 70 ms:',d.filter(x=>x<=0.07).length+'/'+d.length,'· take duration',fr[fr.length-1].toFixed(2),'s');
  const rawA=execFileSync('ffmpeg',['-v','error','-i',take,'-ac','1','-ar','44100','-f','f32le','-'],{maxBuffer:1<<28});const xa=new Float32Array(rawA.buffer,rawA.byteOffset,rawA.length/4);
  const an=RA.analyzeSong([xa],44100,{forceBpm:100});const ref=tb.filter(t=>t>0.3&&t<T-0.3);const dd=ref.map(r=>Math.min(...an.beats.map(b=>Math.abs(b-r)))).sort((a,b)=>a-b);
  console.log('take sound vs plan: song beats in the take sit',(dd[dd.length>>1]*1000).toFixed(0),'ms (median) from where the plan puts them');
}
