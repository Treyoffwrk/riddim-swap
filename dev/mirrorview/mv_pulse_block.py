# ---- one beat engine: Pulse takes its tempo and beat position from Riddim Swap's analysis.js -----------------------
# MirrorView keeps its own audio extraction, timeline mapping, onsets and frequency events. After its analysis, the
# same audio is decoded and run through Riddim Swap's beat finder; the two decodes are lined up by cross-correlating
# low-frequency energy (so no assumption about decoder start offsets), and Pulse's tempo/phase come from Riddim Swap.
ANALYSIS = (pathlib.Path(__file__).resolve().parents[1] / 'analysis.js') if (pathlib.Path(__file__).resolve().parents[1] / 'analysis.js').exists() else pathlib.Path('/home/claude/analysis.js')
analysis_src = ANALYSIS.read_text()
_first_script = s.index('<script>')
s = s[:_first_script] + '<script>\n' + analysis_src + '\n</script>\n' + s[_first_script:]
rep("""      const valid=cleanMusicAnalysis(result,key);if(!valid)throw new Error('Audio analysis failed validation. Prior analysis is unchanged.');""",
    """      const valid=cleanMusicAnalysis(result,key);if(!valid)throw new Error('Audio analysis failed validation. Prior analysis is unchanged.');
      try{this.message='Finding the beat (Riddim Swap engine)…';this.update();await riddimBeat(valid,blob,abort.signal);}catch(e){valid.beatEngine='pulse-dsp';this.cb.log?.('riddim-beat',e);}
      if(seq!==this.sequence||key!==this.cb.state().key||abort.signal.aborted)return;""")
rep("""valid.tempo.bpm?`${valid.onsets.length} onsets · ${valid.frequencyEvents.length} frequency events · ${duration.toFixed(2)}s analysed`""",
    """valid.tempo.bpm?`${valid.onsets.length} onsets · ${valid.frequencyEvents.length} frequency events · ${duration.toFixed(2)}s analysed${valid.beatEngine==='riddim-swap'?' · beat from Riddim Swap':''}`""")
RIDDIM_BEAT_JS = r"""
/* Riddim Swap integration: one beat engine for the whole app. */
async function riddimBeat(valid,blob,signal){
  if(typeof RA==='undefined'||!blob||valid.silent)return;
  const buf=await blob.arrayBuffer();if(signal?.aborted)return;
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;const ctx=new OAC(1,44100,44100);
  const audio=await new Promise((res,rej)=>{const p=ctx.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej);});
  if(signal?.aborted)return;
  const ch=[];for(let c=0;c<Math.min(2,audio.numberOfChannels);c++)ch.push(audio.getChannelData(c));
  const an=RA.analyzeSong(ch,audio.sampleRate);if(!an||!an.bpm||an.beats.length<4)return;
  /* line up: low-frequency energy of this decode vs Pulse's low band, 10 ms steps, within ±0.4 s */
  const sr=audio.sampleRate,hop=Math.round(sr*.01),mono=ch[0],nE=Math.floor(mono.length/hop),E=new Float32Array(nE);let lp=0;const a=1-Math.exp(-2*Math.PI*200/sr);
  for(let i=0,k=0;k<nE;k++){let acc=0;for(let j=0;j<hop;j++,i++){lp+=a*((ch.length>1?(mono[i]+ch[1][i])/2:mono[i])-lp);acc+=lp*lp}E[k]=Math.log1p(1e4*acc/hop)}
  const ft=valid.featureTimes,lowP=valid.bands.low.power,R=new Float32Array(nE);
  for(let k=0,j=0;k<nE;k++){const t=k*.01;while(j<ft.length-2&&ft[j+1]<=t)j++;R[k]=Math.log1p(1e4*(lowP[j]||0))}
  const z=v=>{let m=0;for(const x of v)m+=x;m/=v.length||1;let sd=0;for(const x of v)sd+=(x-m)*(x-m);sd=Math.sqrt(sd/(v.length||1))||1;return Float32Array.from(v,x=>(x-m)/sd)};
  const e=z(E),r=z(R);let best=0,bc=-1e9;
  for(let L=-40;L<=40;L++){let c=0,n=0;for(let k=Math.max(0,-L);k<nE&&k+L<nE;k++){c+=e[k]*r[k+L];n++}c/=n||1;if(c>bc){bc=c;best=L}}
  const offset=best*.01;   /* video time = decode time + offset */
  const beats=an.beats.map(t=>t+offset).filter(t=>t>=0&&t<=valid.duration);if(beats.length<4)return;
  const bpm=+an.bpm.toFixed(2),alts=[{bpm,factor:1,kind:'detected'}];if(bpm/2>=40)alts.push({bpm:+(bpm/2).toFixed(2),factor:.5,kind:'half-time'});if(bpm*2<=240)alts.push({bpm:+(bpm*2).toFixed(2),factor:2,kind:'double-time'});
  valid.pulseDspTempo={...valid.tempo};
  valid.tempo={...valid.tempo,bpm,phase:beats[0],confidence:Math.max(0,Math.min(1,an.conf)),alternatives:alts,
    reason:'Riddim Swap beat engine (kick-based phase); aligned to Pulse by low-band correlation '+(offset*1000).toFixed(0)+' ms (r='+bc.toFixed(2)+')',
    timingWarning:(an.phaseConf??1)<.2?'Not sure whether the beat is here or half a beat later. Check it by ear.':an.conf<.5?'Low confidence: check the grid against the music.':''};
  valid.beatEngine='riddim-swap';valid.riddimBeats=beats;valid.riddimOffset=offset;valid.riddimCorr=bc;
}
"""
rep("function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){", RIDDIM_BEAT_JS + "function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){")
