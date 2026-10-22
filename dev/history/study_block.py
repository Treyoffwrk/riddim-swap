# ---- study a move: loop two seconds around the playhead at half speed, song slowed with its pitch kept -------------------
rep("""            <button class="btn" id="repeat" aria-pressed="false" disabled>Repeat</button>""",
    """            <button class="btn" id="repeat" aria-pressed="false" disabled>Repeat</button>
            <button class="btn" id="studyBtn" aria-pressed="false" disabled title="Loop 2 seconds around here at half speed">Study ½×</button>""")
rep("""/* ===== Sound System: the look shared with MirrorView.""","""
#studyBtn[aria-pressed="true"]{background:var(--hips);border-color:var(--hips);color:#0E1014}
.studytag{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:6;background:rgba(255,95,162,.92);color:#0E1014;font:800 13px var(--f-body);padding:5px 12px;border-radius:999px;pointer-events:none;white-space:nowrap}
/* ===== Sound System: the look shared with MirrorView.""")
rep("""          <div class="recdot" id="recDot" hidden>Recording</div>""","""          <div class="recdot" id="recDot" hidden>Recording</div>
          <div class="studytag" id="studyTag" hidden>Study · ½ speed · looping</div>""")
# while studying, the clip is the 2-second loop at half speed
rep("""  if(routineOn())return S.seq.map(x=>segOf(x)).filter(Boolean);
  const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr};""","""  if(routineOn())return S.seq.map(x=>segOf(x)).filter(Boolean);
  if(S.study)return [{src:S.cur,s:S.study.a,e:S.study.b,r:S.vr*S.study.rate}];
  const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr};""")
# the song keeps its place in the clip and is slowed by the same amount
rep("""function expected(){return S.offset+""","""function expected(){if(S.study)return S.offset+((v.currentTime-S.cIn)/S.vr+(S.avComp||0))*S.ar;return S.offset+""")
rep("""  if(a.paused){seekSong(e);setRate(S.ar);a.play().catch(songFail);S.lastFix=now;S.driftEma=0;S.vI=0;setV(0);return}
  setRate(S.ar);""","""  if(a.paused){seekSong(e);setRate(songRate());a.play().catch(songFail);S.lastFix=now;S.driftEma=0;S.vI=0;setV(0);return}
  setRate(songRate());""")
ST_JS = r"""
/* ---------- study a move ----------
   Loops 2 s around the playhead (1 s either side, inside the clip) at half speed. The song follows at half speed with
   its pitch kept, so it sounds slow rather than deep. Everything else (body, hip meter, beat lights) works as usual.
   Nothing is saved: tap again and the clip, speed and repeat are as they were. */
function songRate(){return S.ar*(S.study?S.study.rate:1)}
function studyUI(){const on=!!S.study;$('#studyBtn').setAttribute('aria-pressed',String(on));$('#studyTag').hidden=!on;$('#studyBtn').disabled=!S.hasV||routineOn()||!!S.rec}
function studyOn(){
  if(!S.hasV||routineOn()||S.rec)return;
  const t=clamp(v.currentTime,S.cIn,clipEnd()),a0=Math.max(S.cIn,t-1),b0=Math.min(clipEnd(),a0+2),a1=Math.max(S.cIn,b0-2);
  S.study={a:a1,b:b0,rate:0.5,loop:S.loop}; S.loop=true;
  a.preservesPitch=true; a.webkitPreservesPitch=true;
  const was=S.playing; if(was)pause(); S.segIdx=0; v.currentTime=a1; studyUI(); updateTrim();
  setTimeout(()=>{if(S.study&&!S.playing)$('#play').click()},120);
}
function studyOff(){
  if(!S.study)return; const st=S.study; S.study=null; S.loop=st.loop;
  a.preservesPitch=false; a.webkitPreservesPitch=false;
  if(S.playing)pause(); S.segIdx=0; studyUI(); updateTrim(); syncSong(true);
}
$('#studyBtn').addEventListener('click',()=>{S.study?studyOff():studyOn()});
setInterval(()=>{try{studyUI()}catch(e){}},500);
"""
rep("""/* test hook: only with #debug in the address */""", ST_JS + """/* test hook: only with #debug in the address */""")
# leaving study before recording, switching to routine, or loading another video
rep("""function startRecording(){""","""function startRecording(){
  if(S.study)studyOff();""")
rep("""if(/debug/.test(location.hash))window.__rs={""","""if(/debug/.test(location.hash))window.__rs={studyOn,studyOff,""")
rep("""function setMode(seq){
  if(S.rec)return;""","""function setMode(seq){
  if(S.rec)return; if(S.study)studyOff();""")
rep("""function activate(id){
  const n=srcById(id); if(!n||n.id===S.cur)return;""","""function activate(id){
  const n=srcById(id); if(!n||n.id===S.cur)return;
  if(S.study)studyOff();""")
