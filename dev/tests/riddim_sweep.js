const RA=require('../analysis.js');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(__dirname+'/riddim_eval.js','utf8');const readWav=eval('('+src.match(/function readWav[\s\S]*?return \{ch,sr:fmt.sr\}\}/)[0]+')');
const match=(pred,truth,tol)=>{const used=new Set();let tp=0;for(const t of truth){let bi=-1,bd=tol;pred.forEach((p,i)=>{if(!used.has(i)&&Math.abs(p-t)<=bd){bd=Math.abs(p-t);bi=i}});if(bi>=0){used.add(bi);tp++}}return {tp,np:pred.length,nt:truth.length}};
const dedupe=a=>{const o=[];for(const t of a.slice().sort((x,y)=>x-y))if(!o.length||t-o[o.length-1]>0.03)o.push(t);return o};
const dir=process.argv[2];const songs=fs.readdirSync(dir).filter(f=>f.endsWith('.wav')).map(f=>{const T=JSON.parse(fs.readFileSync(path.join(dir,f.replace('.wav','.json'))));const {ch,sr}=readWav(path.join(dir,f));const an=RA.analyzeSong(ch,sr);return {f,T,ch,sr,an,all:dedupe([...T.kick,...(T.bass||[]),...T.snare])}});
const res=[];
for(const p0 of [0.3,0.4,0.5])for(const p1 of [0.3,0.4,0.5])for(const p2 of [0.2,0.3]){let tp=0,np=0,nt=0,worstP=1,worstR=1;
  for(const s of songs){const R=RA.riddim(s.ch,s.sr,s.an.beats,s.an.downbeats,{th:[p0,p1,p2,1.5]});const m=match(R.events.map(e=>e.t),s.all,0.05);tp+=m.tp;np+=m.np;nt+=m.nt;worstP=Math.min(worstP,m.tp/(m.np||1));worstR=Math.min(worstR,m.tp/m.nt)}
  res.push({th:[p0,p1,p2].join('/'),P:+(tp/np).toFixed(3),R:+(tp/nt).toFixed(3),worstP:+worstP.toFixed(2),worstR:+worstR.toFixed(2)})}
console.table(res.sort((a,b)=>b.R-a.R).filter(r=>r.worstP>=0.85));
