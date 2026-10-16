const RA=require('../analysis.js');const fs=require('fs');const {execFileSync}=require('child_process');
const T=JSON.parse(fs.readFileSync('media/dembow100.json')).beats;
const raw=execFileSync('ffmpeg',['-v','error','-i','media/dembow100.wav','-ac','1','-ar','44100','-f','f32le','-'],{maxBuffer:1<<28});
const x=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);const an=RA.analyzeSong([x],44100);
const sg=an.beats.map(b=>{let best=1e9;for(const t of T)if(Math.abs(b-t)<Math.abs(best))best=b-t;return best}).sort((a,b)=>a-b);
console.log('detector signed offset on the original song: median',(sg[sg.length>>1]*1000).toFixed(1),'ms; 10-90%',(sg[Math.floor(sg.length*0.1)]*1000).toFixed(0),'..',(sg[Math.floor(sg.length*0.9)]*1000).toFixed(0),'ms');
/* same check on the synthetic styles from the unit tests (truth = kick times) */
