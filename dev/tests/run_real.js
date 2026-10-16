const RA=require('../analysis.js');const fs=require('fs');
const b=fs.readFileSync(process.argv[2]);const f=new Float32Array(b.buffer,b.byteOffset,b.length/4);
const n=f.length/2,L=new Float32Array(n),R=new Float32Array(n);for(let i=0;i<n;i++){L[i]=f[2*i];R[i]=f[2*i+1]}
const t0=Date.now();const a=RA.analyzeSong([L,R],44100);const ms=Date.now()-t0;
fs.writeFileSync(process.argv[3],JSON.stringify({bpm:a.bpm,conf:a.conf,cands:a.candidates,beats:a.beats,down:a.downbeats,contrast:a.contrast,ms}));
console.log('JS: bpm',a.bpm.toFixed(2),'conf',a.conf.toFixed(2),'beats',a.beats.length,'candidates',JSON.stringify(a.candidates),'time',ms,'ms for',(n/44100).toFixed(1),'s');
