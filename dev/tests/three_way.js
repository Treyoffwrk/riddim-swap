/* Three trackers on the same clip, no ground truth: for each frame and joint, when they disagree, which one is the odd one
   out (far from the other two, which agree)? The regular and Accurate trackers are the same family, so this leans against
   RTMPose; it winning anyway means something. Also: how steady each is (bone-length change, wobble).
   Usage: node three_way.js <full dump> <heavy dump> <rtm dump> */
const fs=require('fs');const [,,A,B,C]=process.argv;const D=[A,B,C].map(f=>JSON.parse(fs.readFileSync(f)));const names=['Regular','Accurate','RTMPose'];
const S=D[0].S,asp=D[0].h/D[0].w;
const idx=D.map(d=>{const m=new Map();for(let i=0;i<d.n;i++)m.set(Math.round(d.raw[i*S]*1000),i);return m});
const find=(m,k)=>{if(m.has(k))return m.get(k);for(const e of [-1,1,-2,2,-3,3,-4,4,-5,5,-6,6,-7,7,-8,8])if(m.has(k+e))return m.get(k+e);return null};
const X=(d,i,j)=>d.raw[i*S+1+j*3],Y=(d,i,j)=>d.raw[i*S+2+j*3]*asp,V=(d,i,j)=>d.raw[i*S+3+j*3];
const T=(d,i)=>Math.hypot((X(d,i,11)+X(d,i,12))/2-(X(d,i,23)+X(d,i,24))/2,(Y(d,i,11)+Y(d,i,12))/2-(Y(d,i,23)+Y(d,i,24))/2);
const groups={wrists:[15,16],elbows:[13,14],knees:[25,26],ankles:[27,28],feet:[31,32]};
const out={};
for(const g in groups){const odd=[0,0,0];let disagree=0,total=0;
  for(let i=0;i<D[0].n;i++){const k=Math.round(D[0].raw[i*S]*1000),i1=find(idx[1],k),i2=find(idx[2],k);if(i1==null||i2==null)continue;const ii=[i,i1,i2];
    const t=T(D[1],i1);if(!(t>0))continue;
    for(const j of groups[g]){const P=ii.map((q,m)=>[X(D[m],q,j),Y(D[m],q,j)]);if(P.some(p=>isNaN(p[0])))continue;total++;
      const d01=Math.hypot(P[0][0]-P[1][0],P[0][1]-P[1][1])/t,d02=Math.hypot(P[0][0]-P[2][0],P[0][1]-P[2][1])/t,d12=Math.hypot(P[1][0]-P[2][0],P[1][1]-P[2][1])/t;
      const th=0.12;   /* torso lengths: a clear disagreement */
      if(Math.max(d01,d02,d12)<th)continue;disagree++;
      /* odd one out: the other two agree (closer than th) and it's far from both */
      if(d12<th&&d01>th&&d02>th)odd[0]++;else if(d02<th&&d01>th&&d12>th)odd[1]++;else if(d01<th&&d02>th&&d12>th)odd[2]++}}
  out[g]={frames:total,disagree:disagree,oddOneOut:Object.fromEntries(names.map((n,m)=>[n,odd[m]]))}}
/* steadiness: forearm/shin length change frame to frame (torso lengths, median/p90) */
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(p*(b.length-1))]};
const steady=D.map((d,m)=>{const r={};for(const [bn,pairs] of Object.entries({forearms:[[13,15],[14,16]],shins:[[25,27],[26,28]]})){const v=[];for(const [a,c] of pairs)for(let i=1;i<d.n;i++){const t=T(d,i);if(!(t>0))continue;const l1=Math.hypot(X(d,i,a)-X(d,i,c),Y(d,i,a)-Y(d,i,c)),l0=Math.hypot(X(d,i-1,a)-X(d,i-1,c),Y(d,i-1,a)-Y(d,i-1,c));if(!isNaN(l1+l0))v.push(Math.abs(l1-l0)/t)}r[bn]=`${q(v,0.5).toFixed(3)}/${q(v,0.9).toFixed(3)}`}return [names[m],r]});
console.log(JSON.stringify({oddOneOut:out,steadiness_median_p90:Object.fromEntries(steady)},null,1));
