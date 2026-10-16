/* Score a beat detector version on the song benchmark. usage: node bench_eval_songs.js <analysis.js> */
const RA=require(require('path').resolve(process.argv[2]));const fs=require('fs');const {execFileSync}=require('child_process');
function F(est,ref,tol){const used=new Set();let hit=0;for(const r of ref){let bi=-1,bd=1e9;est.forEach((e,i)=>{if(used.has(i))return;const d=Math.abs(e-r);if(d<=tol&&d<bd){bd=d;bi=i}});if(bi>=0){used.add(bi);hit++}}const p=est.length?hit/est.length:0,r=ref.length?hit/ref.length:0;return p+r?2*p*r/(p+r):0}
const rows=[];let sumF=0,tOK=0,dOK=0;
const DIR=process.argv[3]||'media/bench';const files=fs.readdirSync(DIR).filter(f=>f.endsWith('.wav')).sort();
for(const f of files){
  const truth=JSON.parse(fs.readFileSync(DIR+'/'+f.replace('.wav','.json')));
  const raw=execFileSync('ffmpeg',['-v','error','-i',DIR+'/'+f,'-ac','1','-ar','44100','-f','f32le','-'],{maxBuffer:1<<28});
  const x=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
  const a=RA.analyzeSong([x],44100);
  const ref=truth.beats.slice(1,-1), Fv=F(a.beats,ref,0.07), tempoOK=Math.abs(a.bpm/truth.bpm-1)<0.04;
  const down=a.downbeats.length&&truth.downbeats.some(d=>Math.abs(d-a.downbeats[0])<0.07);
  sumF+=Fv; if(tempoOK)tOK++; if(down)dOK++;
  rows.push({song:f.replace('.wav',''),trueBPM:truth.bpm,detBPM:+a.bpm.toFixed(1),tempoOK,beatF:+Fv.toFixed(3),downbeatOK:!!down,conf:+a.conf.toFixed(2)});
}
console.table(rows);
console.log(`SUMMARY mean beat F=${(sumF/files.length).toFixed(3)} · tempo right ${tOK}/${files.length} · downbeat right ${dOK}/${files.length}`);
