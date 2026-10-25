/* Offline: which cleaning keeps the skeleton closest to a better reference? Loads body.js (or a variant) in node, runs its
   clean() on the full model's raw track, and compares raw, the current cleaning and the variant with the heavy model's raw
   track (bigger model, used as the reference). Usage: node clean_compare.js <full dump> <heavy dump> ['label={options json}'...] */
const fs=require('fs'),vm=require('vm');
const [,,FULL,HEAVY,...VARS]=process.argv;
const F=JSON.parse(fs.readFileSync(FULL)),H=JSON.parse(fs.readFileSync(HEAVY));
const load=f=>{const g={};vm.runInNewContext(fs.readFileSync(f,'utf8'),{globalThis:g,window:undefined,console,Math,Float32Array,Uint8Array,Array,Set,Map,Object,JSON,Number,isNaN,isFinite});return g.RB};
const S=F.S,asp=F.h/F.w;
/* frames matched by time */
const tH=new Map();for(let i=0;i<H.n;i++)tH.set(Math.round(H.raw[i*S]*1000),i);
const pairs=[];for(let i=0;i<F.n;i++){const k=Math.round(F.raw[i*S]*1000);let h=tH.get(k);if(h==null)for(const d of [-1,1,-2,2,-3,3,-4,4,-5,5,-6,6,-7,7,-8,8]){if(tH.has(k+d)){h=tH.get(k+d);break}}if(h!=null)pairs.push([i,h])}
const X=(D,i,j)=>D[i*S+1+j*3],Y=(D,i,j)=>D[i*S+2+j*3]*asp,V=(D,i,j)=>D[i*S+3+j*3];
const T=(D,i)=>{const sx=(X(D,i,11)+X(D,i,12))/2,sy=(Y(D,i,11)+Y(D,i,12))/2,hx=(X(D,i,23)+X(D,i,24))/2,hy=(Y(D,i,23)+Y(D,i,24))/2;return Math.hypot(sx-hx,sy-hy)};
const groups={wrists:[15,16],elbows:[13,14],ankles:[27,28],knees:[25,26]};
const q=(a,p)=>{if(!a.length)return NaN;const b=a.slice().sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(p*b.length))]};
function score(D,label){const out={label};
  for(const g in groups){const fast=[],all=[],jit=[];
    for(let k=1;k+1<pairs.length;k++){const [i,h]=pairs[k],[i0,h0]=pairs[k-1],[i1]=pairs[k+1];const t=T(H.raw,h);if(!(t>0))continue;
      for(const j of groups[g]){if(V(H.raw,h,j)<0.7||isNaN(X(D,i,j)))continue;
        const e=Math.hypot(X(D,i,j)-X(H.raw,h,j),Y(D,i,j)-Y(H.raw,h,j))/t, sp=Math.hypot(X(H.raw,h,j)-X(H.raw,h0,j),Y(H.raw,h,j)-Y(H.raw,h0,j))/t;
        all.push(e);if(sp>0.12)fast.push(e);
        /* jitter where the reference is still: wobble of the drawn point (second difference) */
        if(sp<0.02&&!isNaN(X(D,i0,j))&&!isNaN(X(D,i1,j)))jit.push(Math.hypot(X(D,i1,j)-2*X(D,i,j)+X(D,i0,j),Y(D,i1,j)-2*Y(D,i,j)+Y(D,i0,j))/t)}}
    out[g]=`fast ${q(fast,0.5).toFixed(3)}/${q(fast,0.9).toFixed(3)} (n${fast.length}) · all ${q(all,0.5).toFixed(3)}/${q(all,0.9).toFixed(3)} · still-wobble ${(jit.reduce((a,b)=>a+b,0)/Math.max(1,jit.length)).toFixed(4)}`}
  return out}
const runClean=(RB,D,o)=>{const d=Float32Array.from(D),w=new Float32Array(F.n*RB.WS).fill(NaN);return RB.clean(d,w,F.n,asp,o).data};
console.log('frames matched',pairs.length,'of',F.n,'· errors in torso lengths, median/p90, against the heavy model');
const show=o=>console.log(o.label.padEnd(18),Object.keys(groups).map(g=>g+': '+o[g]).join('\n'+' '.repeat(19)));
show(score(F.raw,'full raw'));show(score(F.clean,'full cleaned (app)'));
const RB=load('/home/claude/body.js');show(score(runClean(RB,F.raw,{}),'defaults (node)'));
for(const v of VARS){const [lab,js]=v.split('=');show(score(runClean(RB,F.raw,JSON.parse(js)),lab))}
