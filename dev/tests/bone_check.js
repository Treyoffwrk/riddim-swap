/* Accuracy without ground truth: a forearm or shin doesn't change length. Frame-to-frame change in drawn bone length (as a
   share of the torso) for each track. Usage: node bone_check.js <dump> [label=options...] */
const fs=require('fs'),vm=require('vm');const [,,...A]=process.argv;
const load=f=>{const g={};vm.runInNewContext(fs.readFileSync(f,'utf8'),{globalThis:g,window:undefined,console,Math,Float32Array,Uint8Array,Array,Set,Map,Object,JSON,Number,isNaN,isFinite});return g.RB};
const RB=load('/home/claude/body.js');
const bones={forearms:[[13,15],[14,16]],upperArms:[[11,13],[12,14]],shins:[[25,27],[26,28]]};
const q=(a,p)=>{const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(p*(b.length-1))]};
function check(D,n,S,asp){const X=(i,j)=>D[i*S+1+j*3],Y=(i,j)=>D[i*S+2+j*3]*asp;const T=i=>Math.hypot((X(i,11)+X(i,12))/2-(X(i,23)+X(i,24))/2,(Y(i,11)+Y(i,12))/2-(Y(i,23)+Y(i,24))/2);
  const o={};for(const b in bones){const d=[];for(const [a,c] of bones[b])for(let i=1;i<n;i++){const t=T(i);if(!(t>0))continue;const l1=Math.hypot(X(i,a)-X(i,c),Y(i,a)-Y(i,c)),l0=Math.hypot(X(i-1,a)-X(i-1,c),Y(i-1,a)-Y(i-1,c));if(isNaN(l1+l0))continue;d.push(Math.abs(l1-l0)/t)}
    o[b]=`${q(d,0.5).toFixed(3)}/${q(d,0.9).toFixed(3)}/${q(d,0.99).toFixed(3)}`}return o}
const files=A.filter(a=>!a.includes('=')),vars=A.filter(a=>a.includes('='));
for(const f of files){const F=JSON.parse(fs.readFileSync(f)),asp=F.h/F.w,name=f.split('/').pop();
  console.log(name,'raw    ',JSON.stringify(check(F.raw,F.n,F.S,asp)));console.log(name,'app    ',JSON.stringify(check(F.clean,F.n,F.S,asp)));
  for(const v of vars){const [l,js]=v.split('=');const d=Float32Array.from(F.raw),w=new Float32Array(F.n*RB.WS).fill(NaN);console.log(name,l.padEnd(7),JSON.stringify(check(RB.clean(d,w,F.n,asp,JSON.parse(js)).data,F.n,F.S,asp)))}}
console.log('(change in bone length from one frame to the next, torso lengths: median/p90/p99; smaller = steadier, more believable)');
