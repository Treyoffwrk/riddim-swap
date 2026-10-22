/* Print a song's riddim, bar by bar: K = low hit (kick/bass), s = snare/clap/rim, X = both, . = nothing */
const RA=require('../analysis.js');const fs=require('fs');
const src=fs.readFileSync(__dirname+'/riddim_eval.js','utf8');const readWav=eval('('+src.match(/function readWav[\s\S]*?return \{ch,sr:fmt.sr\}\}/)[0]+')');
const {ch,sr}=readWav(process.argv[2]);const an=RA.analyzeSong(ch,sr);const R=RA.riddim(ch,sr,an.beats,an.downbeats);
console.log(process.argv[2].split('/').pop(),'bpm',an.bpm.toFixed(1),'phaseConf',an.phaseConf.toFixed(2),'events',R.events.length,'perBar',R.perBar.toFixed(1),'sure',R.sure);
const bars={};for(const e of R.events)(bars[e.bar]||(bars[e.bar]={}))[e.slot]=e.kind;
const ids=[...new Set(R.grid.map((t,i)=>i))];const first=Math.min(...Object.keys(bars).map(Number)),last=Math.max(...Object.keys(bars).map(Number));
for(let b=first;b<=last;b++){let s='';for(let k=0;k<16;k++){const v=(bars[b]||{})[k];s+=(k%4===0?' ':'')+(v==='kick'?'K':v==='snare'?'s':v==='both'?'X':'.')}
  const t=R.events.find(e=>e.bar===b);console.log(String(b).padStart(3),(t?t.t.toFixed(1):'   ').padStart(5)+'s',s)}
fs.writeFileSync(process.argv[3]||'/dev/null',JSON.stringify({events:R.events,beats:an.beats}));
