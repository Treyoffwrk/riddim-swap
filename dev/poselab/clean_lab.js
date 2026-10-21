/* run body.js's choose + clean on a pose-lab file; write the result in the lab format (one pose per frame) */
require('/home/claude/body.js');const RB=globalThis.RB,fs=require('fs');
const [,,IN,OUT]=process.argv;const D=JSON.parse(fs.readFileSync(IN));const asp=D.H/D.W,n=D.frames.length,S=RB.STRIDE,WS=RB.WS;
const data=new Float32Array(n*S).fill(NaN),world=new Float32Array(n*WS).fill(NaN);let prev=null,lost=0;
D.frames.forEach((f,i)=>{data[i*S]=f.t;const c=f.poses.map((p,k)=>({pts:p.k.map(q=>[q[0],q[1],q[3]]),w:p.w,i:k}));const ch=RB.choose(c,prev,null,asp,lost);
  if(ch){prev=ch;lost=0;for(let j=0;j<33;j++){data[i*S+1+j*3]=ch.pts[j][0];data[i*S+2+j*3]=ch.pts[j][1];data[i*S+3+j*3]=ch.pts[j][2]}
    if(ch.w&&ch.w.length)RB.WJ.forEach((j,u)=>{for(let c2=0;c2<3;c2++)world[i*WS+u*3+c2]=ch.w[j][c2]})}else lost++});
const t0=Date.now();const C=RB.clean(data,world,n,asp);const ms=Date.now()-t0;const H=RB.hipSeries(C.data,C.world,n,asp);
const out={W:D.W,H:D.H,fps:D.fps,ms:D.ms,report:C.report,frames:[]};
for(let i=0;i<n;i++){const o=i*S;out.frames.push({t:data[o],poses:isNaN(C.data[o+1])?[]:[{k:Array.from({length:33},(_,j)=>[C.data[o+1+j*3],C.data[o+2+j*3],0,C.data[o+3+j*3]]),w:[]}],hips:Array.from(H.slice(i*6,i*6+6))})}
fs.writeFileSync(OUT,JSON.stringify(out));console.log(IN.split('/').pop(),'clean report',JSON.stringify(C.report),'in',ms,'ms');
