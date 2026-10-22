/* Riddim detector against known kick/snare times. Usage: node riddim_eval.js <dir with .wav + .json> */
const RA=require('../analysis.js');const fs=require('fs');const path=require('path');
function readWav(f){const b=fs.readFileSync(f);let o=12,fmt,data;while(o<b.length){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4);if(id==='fmt ')fmt={ch:b.readUInt16LE(o+10),sr:b.readUInt32LE(o+12),bits:b.readUInt16LE(o+22)};if(id==='data'){data=b.subarray(o+8,o+8+sz);break}o+=8+sz+(sz&1)}
  const n=data.length/2/fmt.ch,ch=[];for(let c=0;c<fmt.ch;c++)ch.push(new Float32Array(n));for(let i=0;i<n;i++)for(let c=0;c<fmt.ch;c++)ch[c][i]=data.readInt16LE((i*fmt.ch+c)*2)/32768;return {ch,sr:fmt.sr}}
const match=(pred,truth,tol)=>{const used=new Set();let tp=0;const errs=[];for(const t of truth){let bi=-1,bd=tol;pred.forEach((p,i)=>{if(!used.has(i)&&Math.abs(p-t)<=bd){bd=Math.abs(p-t);bi=i}});if(bi>=0){used.add(bi);tp++;errs.push(pred[bi]-t)}}
  return {p:pred.length?tp/pred.length:0,r:truth.length?tp/truth.length:1,errs}};
const dir=process.argv[2];const files=fs.readdirSync(dir).filter(f=>f.endsWith('.wav'));const rows=[];
for(const f of files){const T=JSON.parse(fs.readFileSync(path.join(dir,f.replace('.wav','.json'))));const {ch,sr}=readWav(path.join(dir,f));
  const an=RA.analyzeSong(ch,sr);const R=RA.riddim(ch,sr,an.beats,an.downbeats);const ev=R.events;
  const LOW=[...(T.kick||[]),...(T.bass||[])].sort((a,b)=>a-b);const K=ev.filter(e=>e.kind!=='snare').map(e=>e.t),Sn=ev.filter(e=>e.kind!=='kick').map(e=>e.t);
  const dedupe=a=>{const o=[];for(const t of a.slice().sort((x,y)=>x-y))if(!o.length||t-o[o.length-1]>0.03)o.push(t);return o};const all=dedupe([...LOW,...T.snare]);
  const allP=ev.map(e=>e.t);
  const mk=match(K,dedupe(LOW),0.05),ms=match(Sn,T.snare,0.05),ma=match(allP,all,0.05);
  const allSet=all;const inBreak=T.break&&T.break[1]?ev.filter(e=>e.t>T.break[0]+0.1&&e.t<T.break[1]-0.1&&!allSet.some(x=>Math.abs(x-e.t)<0.05)).length:null;
  const ae=ma.errs.map(Math.abs).sort((a,b)=>a-b);
  rows.push({song:f.replace('.wav',''),bpm:T.bpm,detBpm:+an.bpm.toFixed(1),lowP:+mk.p.toFixed(2),lowR:+mk.r.toFixed(2),snP:+ms.p.toFixed(2),snR:+ms.r.toFixed(2),allP:+ma.p.toFixed(2),allR:+ma.r.toFixed(2),
    medMs:Math.round((ae[ae.length>>1]||0)*1000),p95Ms:Math.round((ae[Math.floor(ae.length*.95)]||0)*1000),inBreak,perBar:+R.perBar.toFixed(1)})}
console.table(rows);
