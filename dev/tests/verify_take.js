/* Independent check of a recorded take: hits from its pictures, beats from its sound, scored against each other. */
const RA=require('../analysis.js');const {execFileSync}=require('child_process');
const f=process.argv[2], truthBeats=process.argv[3]?JSON.parse(require('fs').readFileSync(process.argv[3])).beats:null, songStart=+(process.argv[4]||0);
const W=112;const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',f]));
const vw=info.streams[0].width,vh=info.streams[0].height,H=Math.round(W*vh/vw/2)*2;
const fr=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','frame=pts_time','-of','csv=p=0',f]).toString().trim().split('\n').map(Number);
const raw=execFileSync('ffmpeg',['-v','error','-i',f,'-vf',`scale=${W}:${H}`,'-vsync','0','-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1<<28});
const n=raw.length/(W*H);let prev=null;const series=[];
for(let i=0;i<n;i++){const g=raw.subarray(i*W*H,(i+1)*W*H);if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,H,8));series.push({t:fr[i]||i/30,D:dg.D,cam:dg.cam,mag:dg.mag})}prev=g}
const m=RA.analyzeMotion(series);
const pcm=execFileSync('ffmpeg',['-v','error','-i',f,'-ac','1','-ar','44100','-f','f32le','-'],{maxBuffer:1<<28});
const x=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);const an=RA.analyzeSong([x],44100,{forceBpm:+(process.argv[5]||0)||undefined});
const tg=[];for(let i=0;i<an.beats.length;i++){tg.push(an.beats[i]);if(i<an.beats.length-1)tg.push((an.beats[i]+an.beats[i+1])/2)}
const sc=RA.score(m.beats,tg.sort((a,b)=>a-b),0.05), scShift=RA.score(m.beats.map(b=>({t:b.t+15/an.bpm,w:b.w})),tg,0.05);
let truth=null;if(truthBeats){const tb=truthBeats.map(b=>b-songStart).filter(t=>t>-1);const t2=[];for(let i=0;i<tb.length;i++){t2.push(tb[i]);if(i<tb.length-1)t2.push((tb[i]+tb[i+1])/2)}
  const a=RA.score(m.beats,t2,0.05), b=RA.score(m.beats.map(q=>({t:q.t+0.15,w:q.w})),t2,0.05);truth={BAS:+a.bas.toFixed(3),medianMissMs:+a.errMs.toFixed(1),BAS_quarterBeatShiftControl:+b.bas.toFixed(3)}}
const vcodec=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name','-of','csv=p=0',f]).toString().trim();
console.log(JSON.stringify({vcodec,truthGrid:truth,file:f.split('/').pop(),frames:n,hitsInVideo:m.beats.length,audioBpm:+an.bpm.toFixed(2),BAS:+sc.bas.toFixed(3),medianMissMs:+sc.errMs.toFixed(1),BAS_quarterBeatShiftControl:+scShift.bas.toFixed(3)}));
