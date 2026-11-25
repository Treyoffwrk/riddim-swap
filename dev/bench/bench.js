/* Move-card benchmark: hand marks (step, feet, arms per beat) vs what the cards show; and how still the dancer is at
   each card's moment. Usage: node bench.js <page> <out.json> <clip name>... (clips in /home/claude/work/media) */
const {launch}=require('/home/claude/mv/tests/harness');const fs=require('fs');
const [,,HOST,OUT,...NAMES]=process.argv;const L=JSON.parse(fs.readFileSync(__dirname+'/labels.json','utf8'));
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU';window.RB_TEST_FPS=30});
 const p=await ctx.newPage();await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 const res={};
 for(const name of NAMES){const M='/home/claude/work/media/';const beats=JSON.parse(fs.readFileSync(M+name+'.beats.json','utf8')).beats;
  await p.setInputFiles('#vidFile',M+name+'.webm');await p.waitForTimeout(2500);
  const r=await p.evaluate(async([beats,lab])=>{const R=window.__rs,n=R.srcById(R.S.cur);const B=window.__bodyCache=await RB.track(n.url,{});
    const W=B.w,H=B.h,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const pose=t=>{const P=RB.poseAt(B,t);return P&&P.map(q=>[q[0]*W,q[1]*H,q[2]])};
    const speed=t=>{const A=pose(t-1/30),Z=pose(t+1/30),C=pose(t);if(!A||!Z||!C)return null;const T=Math.hypot(...[0,1].map(k=>mid(C[11],C[12])[k]-mid(C[23],C[24])[k]));let s=0;for(const j of [13,14,15,16,25,26,27,28])s+=Math.hypot(Z[j][0]-A[j][0],Z[j][1]-A[j][1])/T;return s/8};
    const C=window.__rsCards,ks=new Set([...Object.keys(lab.step),...Object.keys(lab.feet),...Object.keys(lab.arms)].map(Number));const out=[];
    for(const k of [...ks].sort((a,b)=>a-b)){const t=beats[k],t2=beats[k+1]||t+0.6;
      const K=C.cardFor?C.cardFor(B,t,t2,{beat:t2-t}):C.mcCard(B,t,t2,false);if(!K){out.push({k,none:true});continue}
      const T=K.torso,tc=K.t!=null?K.t:t;
      /* what the card says */
      const step=(C.cardFor?K.travel!==0:Math.abs(K.travel)>0.35*T)?(K.travel>0?'R':'L'):0;
      const hands=K.movers.filter(m=>m.j===15||m.j===16),feet=K.movers.filter(m=>m.j===27||m.j===28);
      const vec=m=>{const a=m.pts[0],z=m.pts[m.pts.length-1];return [z[0]-a[0],z[1]-a[1],a,z]};
      const mx=mid(K.Q[11],K.Q[12])[0];
      let arms='hold';if(hands.length){const m=hands[0],[dx,dy,a,z]=m.rel?[m.rel[0],m.rel[1],m.pts[0],m.pts[m.pts.length-1]]:vec(m);const dOut=Math.abs(z[0]-mx)-Math.abs(a[0]-mx);
        arms=Math.abs(dOut)>0.25*T&&Math.abs(dOut)>=Math.abs(dy)*0.6?(dOut>0?'out':'in'):(dy<0?'up':'down')}
      let ft=0;if(K.stance)ft=K.stance.open?'open':'close';else if(K.movers.some(m=>m.lift))ft='lift';else if(!C.cardFor&&feet.length){const m=feet[0],[dx,dy,a,z]=vec(m);const other=K.Q[m.j===27?28:27];const g0=Math.abs(a[0]-other[0]),g1=Math.abs(z[0]-other[0]);
        ft=dy<-0.3*T?'lift':g1-g0>0.25*T?'open':g0-g1>0.25*T?'close':(dy<0?'lift':0)}
      out.push({k,t:+t.toFixed(3),tc:+tc.toFixed(3),step,feet:ft,arms,still0:speed(t),still1:speed(tc),movers:K.movers.map(m=>[m.j,m.type||''])})}
    return out},[beats,L[name]]);
  const sc={step:[0,0],feet:[0,0],arms:[0,0]};const bad=[];
  for(const c of r){if(c.none)continue;for(const f of ['step','feet','arms']){const want=L[name][f][String(c.k)];if(want===undefined)continue;sc[f][1]++;const got=c[f];
     if(String(got)===String(want))sc[f][0]++;else bad.push({k:c.k,f,want,got})}}
  const st0=r.filter(c=>c.still0!=null).map(c=>c.still0),st1=r.filter(c=>c.still1!=null).map(c=>c.still1),avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  res[name]={score:sc,stillOnBeat:+avg(st0).toFixed(4),stillAtCard:+avg(st1).toFixed(4),bad,cards:r};
  console.log(name,'step',sc.step.join('/'),'feet',sc.feet.join('/'),'arms',sc.arms.join('/'),'| limb speed on beat',avg(st0).toFixed(3),'at card',avg(st1).toFixed(3))}
 fs.writeFileSync(OUT,JSON.stringify(res,null,1));await b.close()})();
