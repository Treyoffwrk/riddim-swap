# ---- the song is the steady clock: the video follows it; the song only jumps for real seeks -----------------------------
SYNC_NOTE = """/* Playback sync (not while recording):
   The song used to follow the video by jumping: drift over 80 ms meant a jump (at most every 1.5 s), and after every
   jump a check 0.4 s later jumped again if it was still 30 ms off. When the video ran a little slow (a warm phone, a
   long session) that became a chain of jumps every 0.4 s: the song cut out and crackled. Now the song plays on
   untouched and the video's speed is nudged (up to ±6%, which you can't see) until they line up. The song only jumps
   for real seeks: pressing play, scrubbing, or drift past 0.35 s (0.5 s in a routine). Recording keeps its own,
   measured path. */"""
rep("""function syncSong(force){
  if(!S.hasA||!S.hasV)return;""", SYNC_NOTE + """
function vNudged(r){return S.rec?r:r*(1+(S.vNudge||0))}
function syncSong(force){
  if(!S.hasA||!S.hasV)return;
  if(!S.rec)return syncSteady(force);""")
rep("""        if(g&&g.k&&!S.switchPending){const r=rateAt(g,v.currentTime);if(Math.abs(v.playbackRate-r)>0.004)v.playbackRate=r}""",
    """        if(g&&g.k&&!S.switchPending){const r=vNudged(rateAt(g,v.currentTime));if(Math.abs(v.playbackRate-r)>0.004)v.playbackRate=r}""")
STEADY = r"""
function syncSteady(force){
  const e=expected(), d=songDur(), live=S.playing&&!v.paused&&!S.stalled, now=performance.now(), snd=S.snd||(S.snd={jumps:0,maxLate:0,frames:0,within:0,started:now});
  const setV=n=>{S.vNudge=n;const g=segs()[S.segIdx];if(!g||S.switchPending)return;const r=vNudged(rateAt(g,v.currentTime));if(Math.abs(v.playbackRate-r)>0.006)v.playbackRate=r};
  if(!live||e<0||e>=d){
    if(S.vNudge)setV(0);
    if(!a.paused)a.pause();
    if(!live&&e>=0&&e<d&&Math.abs(a.currentTime-e)>0.03)a.currentTime=e;
    return;
  }
  if(a.paused){seekSong(e);setRate(S.ar);a.play().catch(songFail);S.lastFix=now;S.driftEma=0;S.vI=0;setV(0);return}
  setRate(S.ar);
  const drift=a.currentTime-e;   /* + = song ahead of the video */
  const busy=S.switchPending||v.seeking||a.seeking||now-(S.cutAt||0)<400;
  /* right after a jump: learn how late the song lands (once), never jump again for small errors */
  if(S.seekCheck&&now-S.seekCheck.at>400&&!busy&&a.readyState>=3){
    if(Math.abs(drift)<0.25){S.seekLead=clamp(songLead()-0.8*drift/S.ar,0,0.4);try{localStorage.setItem('rs-seeklead',String(S.seekLead))}catch(err){}}
    S.seekCheck=null;
  }
  if(force){S.lastFix=now;S.driftEma=0;snd.jumps++;seekSong(e);setV(0);return}
  if(S.seekCheck||busy)return;
  S.driftEma=0.8*(S.driftEma||0)+0.2*drift;
  snd.frames++;if(Math.abs(drift)<0.04)snd.within++;snd.maxLate=Math.max(snd.maxLate,Math.abs(drift));
  const limit=routineOn()?0.5:0.35;
  if(Math.abs(S.driftEma)>limit&&now-S.lastFix>2000){S.lastFix=now;S.driftEma=0;snd.jumps++;seekSong(e);setV(0);return}
  /* steady: nudge the video, in 0.5% steps so its speed isn't changed every frame */
  /* proportional plus a slow learned part, so a video that runs steadily slow ends up exactly in time, not 40 ms off */
  S.vI=clamp((S.vI||0)+0.015*S.driftEma,-0.05,0.05);
  let n=clamp(0.8*S.driftEma+S.vI,-0.06,0.06);if(Math.abs(n)<0.004)n=0;n=Math.round(n*200)/200;
  setV(n);   /* also restores the nudge after a cut set the plain speed */
}
"""
rep("""/* The song's play() has to happen inside the tap, or the phone keeps it silent. */""", STEADY + """/* The song's play() has to happen inside the tap, or the phone keeps it silent. */""")
# a play starts a fresh sound report
rep("""function play(){
  S.playAt=performance.now();""","""function play(){
  S.playAt=performance.now(); S.snd={jumps:0,maxLate:0,frames:0,within:0,started:performance.now()}; S.vNudge=0; S.vI=0;""")
rep("""  el.addEventListener('waiting',()=>{if(!me()||S.switchPending||routineOn())return;S.stalled=true;a.pause();recStopSong()});  /* routine: the song keeps going */
  el.addEventListener('playing',()=>{if(me()){S.stalled=false;syncSong(false);recSync(true)}});""",
"""  /* a short video hiccup no longer stops the song (that was a cut-out); only a stall over 0.6 s pauses it */
  el.addEventListener('waiting',()=>{if(!me()||S.switchPending||routineOn())return;
    if(S.rec){S.stalled=true;a.pause();recStopSong();return}
    clearTimeout(S.stallTimer);S.stallTimer=setTimeout(()=>{if(me()&&el.readyState<3&&S.playing){S.stalled=true;a.pause();recStopSong();if(S.snd)S.snd.stalls=(S.snd.stalls||0)+1}},600)});  /* routine: the song keeps going */
  el.addEventListener('playing',()=>{if(me()){clearTimeout(S.stallTimer);S.stalled=false;syncSong(false);recSync(true)}});""")
rep("""      <p class="hint" id="appVer"></p>""","""      <p class="hint" id="appVer"></p>
      <p class="hint" id="sndReport"></p>""")
rep("""/* test hook: only with #debug in the address */""","""/* sound report for the last play (Projects): helps tell what a phone actually did */
function soundReport(){const s=S.snd;if(!s||!s.frames)return '';
  const secs=(performance.now()-s.started)/1000,pct=Math.round(100*s.within/s.frames);
  return `Last play: song and video within 40 ms ${pct}% of the time, largest gap ${Math.round(s.maxLate*1000)} ms, ${s.jumps} song jump${s.jumps===1?'':'s'}${s.stalls?`, ${s.stalls} video stall${s.stalls>1?'s':''}`:''} (over ${Math.round(secs)} s).`}
$('#projBtn').addEventListener('click',()=>{$('#sndReport').textContent=soundReport()});
/* test hook: only with #debug in the address */""")
