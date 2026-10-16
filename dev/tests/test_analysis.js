/* Ground-truth tests for analysis.js: synthetic songs and motion with known beat times. */
const RA=require('../analysis.js');
const SR=44100;
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
function synth(beatTimes,dur,pattern){
  const n=Math.floor(dur*SR),x=new Float32Array(n);
  const kick=(t,a)=>{const i0=Math.floor(t*SR);for(let i=0;i<0.25*SR&&i0+i<n;i++){const tt=i/SR;x[i0+i]+=a*Math.sin(2*Math.PI*(50+80*Math.exp(-tt*30))*tt)*Math.exp(-tt*9)}};
  const snare=(t,a)=>{const i0=Math.floor(t*SR);for(let i=0;i<0.15*SR&&i0+i<n;i++){const tt=i/SR;x[i0+i]+=a*(rnd()*2-1)*Math.exp(-tt*25)}};
  const hat=(t,a)=>{const i0=Math.floor(t*SR);for(let i=0;i<0.03*SR&&i0+i<n;i++){x[i0+i]+=a*(rnd()*2-1)*Math.exp(-i/SR*120)}};
  beatTimes.forEach((t,i)=>{
    const nx=beatTimes[i+1]||t+(t-(beatTimes[i-1]||t-0.5)); const p=nx-t;
    if(pattern==='four'){kick(t,i%4===0?0.9:0.7);hat(t+p/2,0.15)}
    if(pattern==='dembow'){ /* dancehall-ish: kick on 1 and 3, snare on the "and of 2" style syncopation */
      if(i%2===0)kick(t,i%4===0?0.95:0.75); snare(t+p*0.75,0.25); if(i%2===1)snare(t,0.35); hat(t+p/2,0.1)}
    if(pattern==='tresillo'){ /* real dembow: kick on 1 and 3, rim/snare 3-3-2 (0, 0.75, 1.5 of each two beats) */
      if(i%2===0){kick(t,0.8);snare(t,0.3);snare(t+p*0.75,0.45);} else {snare(t+p*0.5,0.45)} hat(t+p*0.5,0.08)}
    if(pattern==='jersey'){ /* jersey-club-ish: kick rolls (triplet-like) */
      kick(t,i%4===0?0.95:0.7); if(i%4===3){kick(t+p/3,0.5);kick(t+2*p/3,0.5)} snare(t+p*0.5,i%2?0.3:0.1)}
  });
  for(let i=0;i<n;i++)x[i]+=0.02*(rnd()*2-1);
  return x;
}
function fmeasure(est,ref,tol){tol=tol||0.07;const used=new Set();let hit=0;
  for(const r of ref){let bi=-1,bd=Infinity;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}
  const p=est.length?hit/est.length:0,rc=ref.length?hit/ref.length:0;return p+rc?2*p*rc/(p+rc):0}
const results=[];
function songCase(name,bpm,pattern,dur,opts){
  opts=opts||{};const period=60/bpm;const t0=opts.t0||0.5;const ref=[];for(let t=t0;t<dur-0.3;t+=period)ref.push(+t.toFixed(4));
  const x=synth(ref,dur,pattern);const a=RA.analyzeSong([x],SR);
  const f=fmeasure(a.beats,ref.slice(2),0.07);
  const shifted=a.beats.map(t=>t+period/2);const fOff=fmeasure(shifted,ref.slice(2),0.07);
  const downOk=a.downbeats.length?Math.abs(((a.downbeats[0]-t0)/period)%4)<0.15||Math.abs(((a.downbeats[0]-t0)/period)%4-4)<0.15:false;
  results.push({case:name,trueBPM:bpm,detBPM:+a.bpm.toFixed(2),conf:+a.conf.toFixed(2),F:+f.toFixed(3),F_halfBeatShift:+fOff.toFixed(3),downbeatOk:downOk,contrast:+a.contrast.toFixed(2)});
}
songCase('four-on-floor 128',128,'four',30);
songCase('dancehall dembow 96',96,'dembow',30);
songCase('dancehall dembow 104',104,'dembow',30);
songCase('dembow 3-3-2 92',92,'tresillo',30);
songCase('dembow 3-3-2 100',100,'tresillo',30);
songCase('jersey club 140',140,'jersey',30);
songCase('jersey club 144',144,'jersey',30);
songCase('slow 75',75,'four',30);
console.table(results);

/* ---------- motion: synthetic directograms with known stops ---------- */
function motionCase(name,hitTimes,dur,fps,noise,cam){
  const series=[];let dir=0;
  for(let i=0;i<=dur*fps;i++){
    /* like real video: the sample stamped at frame i is the motion between frames i-1 and i, so describe the
       state in the middle of that interval */
    const ts=i/fps,t=ts-0.5/fps;const D=new Float32Array(8);
    /* moving in a direction, which stops abruptly at each hit then a new direction starts */
    const lastHit=Math.max(-1,...hitTimes.filter(h=>h<=t));const since=t-lastHit;
    const nextHit=hitTimes.find(h=>h>t);const dir=hitTimes.filter(h=>h<=t).length%8;
    const moving=nextHit!==undefined&&(nextHit-t)<0.35&&since>0.05;
    if(moving)D[dir]=3+(1-(nextHit-t)/0.35)*4;
    for(let k=0;k<8;k++)D[k]+=noise*rnd();
    series.push({t:ts+(rnd()-0.5)*0.004,D,cam:cam||0,mag:D.reduce((a,b)=>a+b,0)});
  }
  const m=RA.analyzeMotion(series);const est=m.beats.map(b=>b.t);
  const f=fmeasure(est,hitTimes,0.07);
  const errs=hitTimes.map(h=>Math.min(...est.map(e=>Math.abs(e-h))));
  return {case:name,hits:hitTimes.length,found:est.length,F:+f.toFixed(3),medianErrMs:+(RA.median(errs)*1000).toFixed(1),bpm:+m.bpm.toFixed(1)};
}
const mres=[];
const hits140=[];for(let t=0.5;t<10;t+=60/140*2)hits140.push(+t.toFixed(3)); /* a hit every 2 beats */
mres.push(motionCase('clean hits, 30 fps',hits140,10.5,30,0.2));
mres.push(motionCase('noisy, 30 fps',hits140,10.5,30,1.2));
mres.push(motionCase('clean, 60 fps',hits140,10.5,60,0.2));
const irregular=[0.6,1.1,1.5,2.4,2.8,3.9,4.3,4.6,5.8,6.9,7.2,8.5,9.1];
mres.push(motionCase('irregular hits',irregular,10,30,0.4));
console.table(mres);

/* ---------- warp: a 140-bpm dance move onto a 96-bpm song (ratio ~1.46, not 1:1 or 2:1) ---------- */
const songBpm=96, sp=60/songBpm; const sb=[];for(let t=0;t<40;t+=sp)sb.push(+t.toFixed(4));
const g=RA.grid(sb,sb.filter((t,i)=>i%4===0));
/* move: hits every 60/140 s (dance tempo 140) for 3 s; play at rate r so 140 -> ~96*1.5=144? choose r giving hits near half-beats */
const mhits=[];for(let t=10.1;t<13;t+=60/140)mhits.push({t:+t.toFixed(4),w:1});
const s=10,e=13.05;
const evalRate=(r,S0)=>{
  const cst=[[s,0],[e,(e-s)/r]];
  const map=(k,t)=>{for(let i=1;i<k.length;i++)if(t<=k[i][0]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return o1+(t-s1)*(o2-o1)/(s2-s1)}return k[k.length-1][1]};
  const sc=k=>{const mt=mhits.map(m=>({t:S0+map(k,m.t),w:1}));return RA.score(mt,sb)};
  const halfGrid=g.map(x=>x.t);
  const scHalf=k=>{const mt=mhits.map(m=>({t:S0+map(k,m.t),w:1}));return RA.score(mt,halfGrid)};
  const w=RA.warpMove(mhits,s,e,r,S0,1,g,{});
  const wq=[];for(let i=1;i<w.length;i++)wq.push(((w[i][0]-w[i-1][0])/(w[i][1]-w[i-1][1]))/r);
  return {rate:r,S0,constant_BAS_beats:+sc(cst).bas.toFixed(3),aligned_BAS_beats:+sc(w).bas.toFixed(3),constant_BAS_halfbeats:+scHalf(cst).bas.toFixed(3),aligned_BAS_halfbeats:+scHalf(w).bas.toFixed(3),
    aligned_err_ms:+scHalf(w).errMs.toFixed(1),pins:w.length-2,speedChange:'±'+(Math.max(...wq.map(q=>Math.abs(q-1)))*100).toFixed(1)+'%'};
};
console.table([evalRate(1,20.13),evalRate(1.46,20.13),evalRate(0.98,20.33),evalRate(1.2,20.07)]);
module.exports={results,mres};
