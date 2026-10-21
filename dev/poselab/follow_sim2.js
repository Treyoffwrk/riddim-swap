/* replay person-following with colours (candidates recorded from the app: poselab/u1-cands.json) */
require('/home/claude/body.js');const RB=globalThis.RB,fs=require('fs');
const [,,IN,PT,PX,PY]=process.argv;const D=JSON.parse(fs.readFileSync(IN));const asp=D.H/D.W;
const F=[];D.frames.forEach(f=>{F[f.k]=f});const n=F.length;
const geom=P=>{const sh=[(P[11][0]+P[12][0])/2,(P[11][1]+P[12][1])/2*asp],hp=[(P[23][0]+P[24][0])/2,(P[23][1]+P[24][1])/2*asp];return {sh,hp,T:Math.hypot(sh[0]-hp[0],sh[1]-hp[1])}};
const tOf=k=>(k+0.5)/D.fps;
const pick=PT?{t:+PT,x:+PX,y:+PY}:null;let anchor=pick?Math.round(pick.t*D.fps-0.5):0;
const order=[];for(let k=anchor;k<n;k++)order.push(k);for(let k=anchor-1;k>=0;k--)order.push(k);
const out=new Array(n).fill(null);let prev=null,lost=0,pickPose=null;
for(const k of order){if(k===anchor-1){prev=pickPose?{...pickPose,vel:pickPose.vel?[-pickPose.vel[0],-pickPose.vel[1]]:null}:null;lost=0}
  const cands=(F[k]?F[k].cands:[]).map((c,i)=>({pts:c.pts,app:c.app,i}));
  const ch=RB.choose(cands,prev,pick&&!pickPose?pick:null,asp,lost,!!pick);
  if(ch){if(prev&&!ch.vel){const a=geom(prev.pts),b=geom(ch.pts),k2=1+lost,nv=[(b.hp[0]-a.hp[0])/k2,(b.hp[1]-a.hp[1])/k2],ov=prev.vel||nv;ch.vel=[0.6*ov[0]+0.4*nv[0],0.6*ov[1]+0.4*nv[1]]}
    RB.learnLooks(prev,ch);
    prev=ch;lost=0;if(pick&&!pickPose)pickPose=ch;const g=geom(ch.pts);out[k]=[+g.hp[0].toFixed(2),+g.T.toFixed(2)]}else lost++}
const J=[];let pk=-1;for(let k=0;k<n;k++){if(!out[k])continue;if(pk>=0&&Math.abs(out[k][0]-out[pk][0])>0.06+0.02*(k-pk-1))J.push(tOf(pk).toFixed(2)+'→'+tOf(k).toFixed(2)+' '+out[pk][0]+'→'+out[k][0]);pk=k}
const occ=out.slice(Math.round(14.5*D.fps),Math.round(15.3*D.fps)).filter(o=>o&&o[1]>0.28).length;
console.log('SEEN',out.filter(Boolean).length,'of',n,'| on the nearer dancer 14.5–15.3 s:',occ,'| JUMPS',J.join(', '));
