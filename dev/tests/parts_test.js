/* Isolated leg / upper-body values and their accuracy score, on synthetic dancers with known motion.
   Usage: node parts_test.js            (no browser needed) */
require('../body.js');const RB=globalThis.RB;
const ASP=1080/1920,FPS=30;   /* height ÷ width of the video, as the tracker stores it */
let fails=0;const rec=(name,ok,detail)=>{if(!ok)fails++;console.log((ok?'PASSED':'FAILED').padEnd(8),name,'—',detail)};
/* small seeded random generator so runs repeat */
let seed=1;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
const rad=d=>d*Math.PI/180;

/* a dancer built from a skeleton in square (isotropic) space. o: legAmp° upperAmp° f Hz travel noise legVis upVis mirror phase fps dur mask */
function dancer(o){
  o=Object.assign({legAmp:20,upperAmp:12,f:1.2,travel:0,noise:0,legVis:1,upVis:1,mirror:false,phase:0,dur:6,fps:FPS,legF:null,upF:null,armAmp:0.15,t0:0},o);
  const n=Math.round(o.dur*o.fps),data=new Float32Array(n*RB.STRIDE).fill(NaN);
  const T=0.1,hw=0.02,sw=0.03,thigh=0.11,shin=0.11,ua=0.06,fa=0.06;   /* sized to fit a 16:9 frame (units: video widths) */
  for(let i=0;i<n;i++){
    const t=o.t0+i/o.fps,tt=t-o.phase,lf=o.legF||o.f,uf=o.upF||o.f;
    const cx=0.5+o.travel*0.5*Math.sin(2*Math.PI*0.4*t),cy=0.3;
    const P=new Array(33).fill(null).map(()=>[cx,cy]);
    const lean=o.upperAmp*Math.sin(2*Math.PI*uf*tt),lr=rad(lean);
    const hip=[cx,cy],sh=[cx+Math.sin(lr)*T,cy-Math.cos(lr)*T];
    P[23]=[hip[0]+hw,hip[1]];P[24]=[hip[0]-hw,hip[1]];            /* 23 = person's left = screen right */
    const tilt=rad(o.upperAmp*0.5*Math.sin(2*Math.PI*uf*tt+1));
    P[11]=[sh[0]+sw*Math.cos(tilt),sh[1]+sw*Math.sin(tilt)];P[12]=[sh[0]-sw*Math.cos(tilt),sh[1]-sw*Math.sin(tilt)];
    const raise=o.armAmp*0.5*Math.sin(2*Math.PI*uf*tt);                 /* wrists go up and down */
    for(const [s,e,w,side] of [[11,13,15,1],[12,14,16,-1]]){
      P[e]=[P[s][0]+side*0.015,P[s][1]+ua*0.9];P[w]=[P[e][0]+side*0.01,P[s][1]-raise*(side>0?1:0.6)+ (fa*0.2)]}
    for(const [h,k,a,side,ph] of [[23,25,27,1,0],[24,26,28,-1,Math.PI]]){
      const th=rad(o.legAmp*Math.sin(2*Math.PI*lf*tt+ph)),flex=rad(Math.abs(o.legAmp)*1.2*Math.max(0,Math.sin(2*Math.PI*lf*tt+ph)));
      P[k]=[P[h][0]+Math.sin(th)*thigh,P[h][1]+Math.cos(th)*thigh];
      const shinAng=th-flex;P[a]=[P[k][0]+Math.sin(shinAng)*shin,P[k][1]+Math.cos(shinAng)*shin];
      P[29+(side>0?0:1)]=[P[a][0],P[a][1]+0.01];P[31+(side>0?0:1)]=[P[a][0]+0.015*side,P[a][1]+0.01]}
    for(const j of [0,1,2,3,4,5,6,7,8,9,10]){P[j]=[sh[0],sh[1]-0.04]}
    const o2=i*RB.STRIDE;data[o2]=t;
    for(let j=0;j<33;j++){const leg=j>=25,vis=leg?o.legVis:o.upVis;
      const nx=o.noise?gauss()*o.noise*T:0,ny=o.noise?gauss()*o.noise*T:0;
      let x=P[j][0]+nx,y=P[j][1]+ny;if(o.mirror)x=1-x;
      data[o2+1+j*3]=x;data[o2+2+j*3]=y/ASP;data[o2+3+j*3]=vis<1?Math.max(0,Math.min(1,vis+gauss()*0.05)):1}
  }
  if(o.mirror){   /* a flipped video: the tracker relabels left and right, so swap each pair */
    for(let i=0;i<n;i++){const o2=i*RB.STRIDE;for(const [a,b] of [[11,12],[13,14],[15,16],[23,24],[25,26],[27,28],[29,30],[31,32]])for(let c=1;c<=3;c++){const x=data[o2+c+a*3-1+0];/* placeholder */}}
  }
  return {n,data,w:1920,h:1080};
}
/* mirroring done properly: flip x of the geometry and relabel pairs */
function mirrorOf(B){const out={n:B.n,w:B.w,h:B.h,data:new Float32Array(B.data)};
  for(let i=0;i<B.n;i++){const o=i*RB.STRIDE;for(let j=0;j<33;j++)out.data[o+1+j*3]=1-B.data[o+1+j*3];
    for(const [a,b] of [[11,12],[13,14],[15,16],[23,24],[25,26],[27,28],[29,30],[31,32]])for(let c=0;c<3;c++){const p=o+1+a*3+c,q=o+1+b*3+c,tmp=out.data[p];out.data[p]=out.data[q];out.data[q]=tmp}}
  return out}
const rng=(B,part,name)=>{const s=RB.partSummary(B,null,null);return s[part].metrics[name]};

/* 1. isolation: legs-only dancer */
{const B=dancer({legAmp:30,upperAmp:0,armAmp:0});const s=RB.partSummary(B,null,null);
 const thighR=s.legs.metrics.thighL.range,leanR=s.upper.metrics.lean.range,armR=s.upper.metrics.armRaiseL.range;
 rec('Legs-only dancer: leg values move, upper values stay still',thighR>50&&leanR<1&&armR<0.05,`thighL range ${thighR.toFixed(1)}°, lean range ${leanR.toFixed(2)}°, arm raise range ${armR.toFixed(3)} T, leg speed ${s.legs.meanSpeed.toFixed(2)} T/s, upper speed ${s.upper.meanSpeed.toFixed(3)} T/s`)}
/* 2. upper-only dancer */
{const B=dancer({legAmp:0,upperAmp:14,armAmp:0.2});const s=RB.partSummary(B,null,null);
 rec('Upper-only dancer: upper values move, leg values stay still',s.upper.metrics.lean.range>20&&s.legs.metrics.thighL.range<1&&s.legs.metrics.kneeL.range<1&&s.legs.meanSpeed<0.05,`lean range ${s.upper.metrics.lean.range.toFixed(1)}° (expected ${(2*14).toFixed(0)}), thighL range ${s.legs.metrics.thighL.range.toFixed(2)}°, leg speed ${s.legs.meanSpeed.toFixed(3)} T/s`)}
/* 3. travelling across the frame does not leak into either part */
{const a=dancer({legAmp:25,upperAmp:10,travel:0}),b=dancer({legAmp:25,upperAmp:10,travel:0.2});
 const sa=RB.partSummary(a,null,null),sb=RB.partSummary(b,null,null);
 const dl=Math.abs(sa.legs.meanSpeed-sb.legs.meanSpeed),du=Math.abs(sa.upper.meanSpeed-sb.upper.meanSpeed);
 rec('Travelling across the frame changes nothing (values are pelvis-relative)',dl<0.05&&du<0.05,`leg speed ${sa.legs.meanSpeed.toFixed(3)} vs ${sb.legs.meanSpeed.toFixed(3)}, upper speed ${sa.upper.meanSpeed.toFixed(3)} vs ${sb.upper.meanSpeed.toFixed(3)}`)}
/* 4. known angle recovered */
{const B=dancer({legAmp:30,upperAmp:10,armAmp:0});const s=RB.partSummary(B,null,null);
 const mx=s.legs.metrics.thighL.max,mn=s.legs.metrics.thighL.min,lean=s.upper.metrics.lean;
 rec('Known swing recovered: thigh ±30°, lean ±10°',Math.abs(mx-30)<1.5&&Math.abs(mn+30)<1.5&&Math.abs(lean.max-10)<1&&Math.abs(lean.min+10)<1,`thighL ${mn.toFixed(1)} … ${mx.toFixed(1)}°, lean ${lean.min.toFixed(1)} … ${lean.max.toFixed(1)}°`)}
/* 5. accuracy score responds to noise, per part, in order */
{const sc=σ=>{seed=7;const B=dancer({noise:σ});return [RB.partScore(B,'legs').score,RB.partScore(B,'upper').score]};
 const r=[0,0.01,0.03,0.06,0.12].map(sc);
 const mono=r.every((v,i)=>i===0||(v[0]<=r[i-1][0]+0.5&&v[1]<=r[i-1][1]+0.5));
 rec('Accuracy falls as tracker noise rises (0, 1%, 3%, 6%, 12% of a torso)',mono&&r[0][0]>=90&&r[4][0]<r[0][0]-15,r.map((v,i)=>`${[0,1,3,6,12][i]}%: legs ${v[0]}, upper ${v[1]}`).join(' | '))}
/* 6. low visibility on one part lowers only that part */
{seed=3;const B=dancer({legVis:0.35,upVis:1});const l=RB.partScore(B,'legs'),u=RB.partScore(B,'upper');
 rec('Hidden legs lower only the legs score',l.score<20&&u.score>90,`legs ${l.score} (coverage ${l.coverage.toFixed(2)}, vis ${l.vis.toFixed(2)}), upper ${u.score}`)}
/* 7. partial occlusion: legs hidden for half the clip */
{const B=dancer({});for(let i=0;i<B.n/2;i++)for(let j=23;j<=32;j++)B.data[i*RB.STRIDE+3+j*3]=0.1;
 const l=RB.partScore(B,'legs');rec('Legs hidden for half the clip: coverage and score about halve',Math.abs(l.coverage-0.5)<0.05&&l.score>35&&l.score<55,`coverage ${l.coverage.toFixed(2)}, score ${l.score}`)}
/* 8. impossible jumps are caught by steadiness */
{seed=5;const B=dancer({});for(let i=10;i<B.n;i+=7){const o=i*RB.STRIDE;B.data[o+1+27*3]+=0.12;B.data[o+2+27*3]+=0.05}
 const l=RB.partScore(B,'legs'),c=RB.partScore(dancer({}),'legs');
 rec('Landmark jumps (ankle teleports) lower steadiness and rigidity',l.steady<c.steady-0.3&&l.score<c.score-10,`steady ${c.steady.toFixed(2)} → ${l.steady.toFixed(2)}, rigid ${c.rigid.toFixed(2)} → ${l.rigid.toFixed(2)}, score ${c.score} → ${l.score}`)}
/* 9. mask agreement */
{const B=dancer({});const mw=64,mh=36;const frames=B.n,md=new Uint8Array(frames*mw*mh);
 for(let i=0;i<frames;i++){const o=i*RB.STRIDE;for(let j=0;j<33;j++){const px=Math.round(B.data[o+1+j*3]*(mw-1)),py=Math.round(B.data[o+2+j*3]*(mh-1));for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const X=px+dx,Y=py+dy;if(X>=0&&X<mw&&Y>=0&&Y<mh)md[i*mw*mh+Y*mw+X]=255}}}
 B.mask={w:mw,h:mh,frames,data:md};const good=RB.partScore(B,'legs');
 const B2=dancer({});B2.mask={w:mw,h:mh,frames,data:new Uint8Array(frames*mw*mh)};const none=RB.partScore(B2,'legs');
 rec('Mask check: joints on the person → high, mask elsewhere → low',good.mask>0.95&&none.mask<0.05&&good.score>none.score+8,`on person ${good.mask.toFixed(2)} (score ${good.score}), off person ${none.mask.toFixed(2)} (score ${none.score})`)}
/* 10. matching: same dance */
{seed=11;const A=dancer({noise:0.01}),B=dancer({noise:0.01});const m=RB.partMatch(A,B);
 rec('Same dance twice scores high in both parts',m.legs.score>85&&m.upper.score>85&&Math.abs(m.lag)<0.04,`legs ${m.legs.score} (shape ${m.legs.shape}, timing ${m.legs.timing}), upper ${m.upper.score}, lag ${m.lag}s, reliability ${m.legs.reliability}/${m.upper.reliability}`)}
/* 11. lag recovered */
{seed=12;const A=dancer({noise:0.01,dur:8,legF:1.5,upF:0.9}),B=dancer({noise:0.01,dur:8,phase:0.3,legF:1.5,upF:0.9});const m=RB.partMatch(A,B,{t0:1,t1:6});
 rec('A try that starts 0.3 s late is lined up',Math.abs(Math.abs(m.lag)-0.3)<0.07&&m.legs.score>80,`lag ${m.lag}s (true ±0.3), legs ${m.legs.score}, upper ${m.upper.score}`)}
/* 12. legs differ, upper same */
{seed=13;const A=dancer({noise:0.01,legAmp:30,legF:1.5,upF:1}),B=dancer({noise:0.01,legAmp:8,legF:2.7,upF:1});const m=RB.partMatch(A,B,{maxLag:0.2});
 rec('Different footwork, same upper body: legs score low, upper stays high',m.upper.score>m.legs.score+25,`legs ${m.legs.score}, upper ${m.upper.score}`)}
/* 13. upper differs, legs same */
{seed=14;const A=dancer({noise:0.01,upperAmp:14,upF:1,legF:1.5}),B=dancer({noise:0.01,upperAmp:3,upF:2.3,armAmp:0.02,legF:1.5});const m=RB.partMatch(A,B,{maxLag:0.2});
 rec('Same footwork, different upper body: upper score low, legs stay high',m.legs.score>m.upper.score+25,`legs ${m.legs.score}, upper ${m.upper.score}`)}
/* 14. mirrored */
{seed=15;const A=dancer({noise:0.01,legAmp:30,legF:1.5,upF:1}),B=mirrorOf(dancer({noise:0.01,legAmp:30,legF:1.5,upF:1}));
 const plain=RB.partMatch(A,B,{mirror:false}),flip=RB.partMatch(A,B,{mirror:true}),auto=RB.partMatch(A,B,{mirror:'auto'});
 rec('A mirror-image try is recognised and scored as the same dance',flip.overall>85&&flip.overall>plain.overall+10&&auto.mirrored===true,`as is ${plain.overall}, mirrored ${flip.overall}, auto → mirrored=${auto.mirrored}`)}
/* 15. reliability follows tracking quality */
{seed=16;const A=dancer({noise:0.01}),good=dancer({noise:0.01}),bad=dancer({noise:0.09});
 const g=RB.partMatch(A,good),b=RB.partMatch(A,bad);
 rec('Match reliability is lower when the try was tracked badly',b.legs.reliability<g.legs.reliability-15,`good try: reliability ${g.legs.reliability}/${g.upper.reliability} (score ${g.overall}) · noisy try: ${b.legs.reliability}/${b.upper.reliability} (score ${b.overall})`)}
/* 16. empty / short input */
{const e=RB.partSeries({n:0,data:new Float32Array(0)});const s=RB.partScore({n:3,data:new Float32Array(3*RB.STRIDE).fill(NaN),w:1,h:1},'legs');
 rec('Empty and untracked input does not throw',e===null&&s&&s.score===0,`score ${s&&s.score}, grade ${s&&s.grade}`)}
console.log(fails?`\n${fails} FAILED`:'\nall passed');process.exit(fails?1:0);
