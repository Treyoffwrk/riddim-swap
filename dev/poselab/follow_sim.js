/* replay the tracker's person-following on a lab file (all poses per frame), with a tapped dancer */
require('/home/claude/body.js');const RB=globalThis.RB,fs=require('fs');
const [,,IN,PT,PX,PY]=process.argv;const D=JSON.parse(fs.readFileSync(IN));const asp=D.H/D.W,n=D.frames.length;
const geom=(P)=>{const sh=[(P[11][0]+P[12][0])/2,(P[11][1]+P[12][1])/2*asp],hp=[(P[23][0]+P[24][0])/2,(P[23][1]+P[24][1])/2*asp];return {sh,hp,T:Math.hypot(sh[0]-hp[0],sh[1]-hp[1])}};
const pick=PT?{t:+PT,x:+PX,y:+PY}:null;let anchor=0;if(pick){let bd=1e9;D.frames.forEach((f,k)=>{const d=Math.abs(f.t-pick.t);if(d<bd){bd=d;anchor=k}})}
const order=[];for(let k=anchor;k<n;k++)order.push(k);for(let k=anchor-1;k>=0;k--)order.push(k);
const out=new Array(n).fill(null);let prev=null,lost=0,pickPose=null;
for(const k of order){if(k===anchor-1){prev=pickPose?{...pickPose,vel:pickPose.vel?[-pickPose.vel[0],-pickPose.vel[1]]:null}:null;lost=0}
  const cands=D.frames[k].poses.map((p,i)=>({pts:p.k.map(q=>[q[0],q[1],q[3]]),i}));
  const ch=RB.choose(cands,prev,pick&&!pickPose?pick:null,asp,lost,!!pick);
  if(ch){if(prev&&!ch.vel){const a=geom(prev.pts),b=geom(ch.pts),k2=1+lost,nv=[(b.hp[0]-a.hp[0])/k2,(b.hp[1]-a.hp[1])/k2],ov=prev.vel||nv;ch.vel=[0.6*ov[0]+0.4*nv[0],0.6*ov[1]+0.4*nv[1]]}prev=ch;lost=0;if(pick&&!pickPose)pickPose=ch;out[k]=+geom(ch.pts).hp[0].toFixed(2)}else lost++}
const J=[];let pk=-1;for(let k=0;k<n;k++){if(out[k]==null)continue;if(pk>=0&&Math.abs(out[k]-out[pk])>0.06)J.push(D.frames[pk].t.toFixed(2)+"→"+D.frames[k].t.toFixed(2)+" "+out[pk]+"→"+out[k]);pk=k}console.log("SEEN",out.filter(x=>x!=null).length,"of",n,"JUMPS",J.join(", "));const s=[];for(let k=0;k<n;k+=10)s.push((D.frames[k].t).toFixed(1)+':'+(out[k]??'-')+'['+D.frames[k].poses.map(p=>((p.k[23][0]+p.k[24][0])/2).toFixed(2)).join('/')+']');console.log(s.join(' '));
