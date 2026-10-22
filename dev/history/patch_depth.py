"""Integrate beat analysis, motion beats, time-warp alignment, fit scoring and checks into riddim-swap.html."""
import pathlib
P = pathlib.Path('/home/claude/riddim-swap.html')
s = P.read_text()
analysis = pathlib.Path('/home/claude/analysis.js').read_text()
bodyjs = pathlib.Path('/home/claude/body.js').read_text()

def rep(a, b, count=1):
    global s
    assert a in s, 'MISSING: ' + a[:110]
    s = s.replace(a, b, count)

# ------------------------------------------------------------------ CSS
rep(""".note{font-size:13px;""", """.anal{display:grid;gap:8px;background:var(--sunk);border:1px solid var(--line);border-radius:10px;padding:10px}
.anal h3,.fitcard h3{font-family:var(--f-display);font-size:16px;font-weight:700;margin:0}
.prog{height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.prog i{display:block;height:100%;width:0;background:var(--dance);transition:width .2s}
.warnlist{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13px;color:var(--warn)}
.warnlist:empty{display:none}
.cand{font:500 12px var(--f-mono)}
.anal .btn.sm:not(.cand),.fitcard .btn.sm,.blind .btn.sm{font-family:var(--f-body);font-weight:600}
.cand.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hitstrip{display:block;width:100%;height:12px}
.tl-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.fitcard{display:grid;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px}
.fitnums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.fitnums div{display:grid;gap:2px;background:var(--sunk);border-radius:8px;padding:6px 8px;min-width:0}
.fitnums b{font:500 18px var(--f-mono);font-variant-numeric:tabular-nums}
.fitnums small{font-size:11px;color:var(--muted)}
.fitnums .label{font-size:10px;line-height:1.2}
@media (max-width:420px){.fitnums{grid-template-columns:repeat(2,minmax(0,1fr))}}
.chipfit{display:inline-block;font:600 11px var(--f-mono);padding:1px 6px;border-radius:999px;border:1px solid currentColor;margin-left:6px;vertical-align:1px}
.chipfit.ok{color:var(--ok)} .chipfit.warn{color:var(--warn)} .chipfit.bad{color:var(--bad)} .chipfit.idle{color:var(--muted)}
.fitmini{font-size:13px;margin:0}
.blind{display:grid;gap:8px}
.blind table{width:100%;border-collapse:collapse;font-size:13px}
.blind th,.blind td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left}
.blind td.num,.blind th.num{text-align:center;font-variant-numeric:tabular-nums}
.blind select,.blind input[type=text]{font:500 14px var(--f-body);padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--sunk);color:var(--ink);min-height:34px}
.blind .takes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.blind video{width:100%;max-height:40vh;background:var(--stage);border-radius:8px}
.tblwrap{overflow-x:auto}
.note{font-size:13px;""")

# ------------------------------------------------------------------ markup
rep("""              <div class="trimbar" aria-hidden="true"><i id="trimFill" style="left:0;right:0"></i></div>""",
"""              <div class="trimbar" aria-hidden="true"><i id="trimFill" style="left:0;right:0"></i></div>
              <canvas class="hitstrip" id="hitStrip" aria-hidden="true"></canvas>""")
rep("""          <p class="hint" id="vidName">Add one or more dance videos. Moves from any of them can go in one routine.</p>
        </div>""", """          <p class="hint" id="vidName">Add one or more dance videos. Moves from any of them can go in one routine.</p>
        </div>
        <div class="anal" id="danceCard">
          <div class="subhead"><h3>Dance hits</h3><button class="btn sm" id="danceAnalyze" disabled>Find hits</button></div>
          <div class="prog" id="danceProg" hidden><i></i></div>
          <p class="hint" id="danceInfo">Finds the moments the dancer hits: sharp stops and changes of direction. They show as blue ticks under the video, next to the song's beats in orange.</p>
          <ul class="warnlist" id="danceWarn"></ul>
        </div>""")
rep("""        <p class="hint" id="songMsg">""", """        <div class="anal" id="songCard" hidden>
          <div class="subhead"><h3>Beat</h3><span class="hint" id="songDet"></span></div>
          <div class="row" id="songCands"></div>
          <div class="row">
            <button class="btn sm" id="beatHalf">Shift beat ½</button>
            <button class="btn sm" id="beatUseDet">Use detected beat</button>
            <label class="check"><input type="checkbox" id="clickOn"> Click on each beat</label>
          </div>
          <ul class="warnlist" id="songWarn"></ul>
          <p class="hint">Turn on the click and play: if the clicks don't sit on the kick, try another tempo or shift by half a beat. Your ear decides.</p>
        </div>
        <p class="hint" id="songMsg">""")
rep("""          <div class="tl" id="seqBar" hidden><div class="tl-blocks" id="seqBlocks"></div><i class="tl-head" id="seqHead"></i></div>""",
"""          <div class="tl" id="seqBar" hidden><div class="tl-blocks" id="seqBlocks"></div><canvas class="tl-canvas" id="seqCanvas"></canvas><i class="tl-head" id="seqHead"></i></div>""")
rep("""          <p class="hint" id="seqHint" hidden>Drag ⠿ to reorder. Tap a move to trim it for this spot. Moves always play back to back with no gap.</p>
        </div>""", """          <p class="hint" id="seqHint" hidden>Drag ⠿ to reorder. Tap a move to trim it for this spot. Moves always play back to back with no gap.</p>
        </div>
        <section class="fitcard" id="fitCard" hidden aria-labelledby="h-fit">
          <div class="subhead"><h3 id="h-fit">Beat fit</h3>
            <div class="seg" role="group" aria-label="Timing" style="grid-template-columns:auto auto">
              <button id="alignOff" aria-pressed="true" style="padding:0 10px">Constant</button>
              <button id="alignOn" aria-pressed="false" style="padding:0 10px">Aligned</button>
            </div></div>
          <div class="fitnums">
            <div><span class="label">Now</span><b id="fitNow">—</b><small id="fitNowErr">&nbsp;</small></div>
            <div><span class="label">Constant speed</span><b id="fitConst">—</b><small id="fitConstErr">&nbsp;</small></div>
            <div><span class="label">Aligned</span><b id="fitAligned">—</b><small id="fitAlignedErr">&nbsp;</small></div>
            <div><span class="label">Off-beat check</span><b id="fitOff">—</b><small>should be low</small></div>
          </div>
          <div class="field clip">
            <div class="field-top"><label class="label" for="maxStretch">Most a move may speed up or slow down</label><span class="val" id="maxStretchOut">±20%</span></div>
            <input type="range" id="maxStretch" min="5" max="35" step="1" value="20">
          </div>
          <div class="row"><button class="btn primary" id="alignBtn">Align moves to the beat</button><button class="btn ghost sm" id="alignClear">Remove alignment</button></div>
          <div class="prog" id="alignProg" hidden><i></i></div>
          <p class="hint" id="fitMsg"></p>
          <p class="hint">Score = Beat Alignment Score: how close each dance hit lands to a beat or an "and" (100% means every hit is on one; the ms figure is the typical miss). Aligning nudges each move's speed between hits so they land there, favouring the 1 of the bar. The off-beat check takes the best version and moves the song a quarter beat, right between the targets; it should score clearly lower, otherwise the score isn't telling you much.</p>
        </section>""")
rep("""        <p class="hint">These only apply to the routine, so the sound stays the same however you tweak single clips.</p>""",
"""        <p class="hint">These only apply to the routine, so the sound stays the same however you tweak single clips.</p>
        <hr class="sep">
        <div class="field">
          <div class="subhead"><h3>Checks</h3></div>
          <div class="row"><button class="btn" id="syncBtn">Sync check</button><button class="btn" id="blindBtn">Make blind test</button></div>
          <p class="hint">Sync check plays a few seconds and measures how far sound and picture drift apart on this phone. The blind test records three versions (aligned, constant speed, deliberately off) under shuffled letters for dancers to rate without knowing which is which.</p>
          <div class="note" id="syncOut" hidden></div>
          <div class="blind" id="blindBox" hidden></div>
        </div>""")
rep("""        <div class="matchbtns">
          <button class="btn" data-m="0.5" disabled>""", """        <p class="fitmini" id="clipFit"></p>
        <div class="matchbtns">
          <button class="btn" data-m="0.5" disabled>""")

# ------------------------------------------------------------------ analysis library goes in before the app script
rep("""<script>
(function(){
const $=s=>document.querySelector(s)""", """<script>
""" + analysis + """
</script>
<script>
""" + bodyjs + """
</script>
<script>
(function(){
const $=s=>document.querySelector(s)""")

# ------------------------------------------------------------------ state
rep("""  mainSong:null, rtSong:null, liveSong:null, sel:null, stopAtT:null, primed:null, lastFix:0};""",
"""  mainSong:null, rtSong:null, liveSong:null, sel:null, stopAtT:null, primed:null, lastFix:0,
  beatSrc:'detected', variant:null, takeWaiter:null, clickOn:false, fitPer:[], blind:null, avComp:0};
try{S.avComp=+(localStorage.getItem('rs-avcomp')||0)||0}catch(e){}""")

# ------------------------------------------------------------------ segments: warped moves (piecewise speed)
rep("""function segs(){
  if(S.preview)return [S.preview];
  if(routineOn())return S.seq.map(x=>{const m=moveById(x.id);return m?{src:m.src,s:x.s,e:x.e,r:rateOf(x)}:null}).filter(Boolean);
  return [{src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}];
}""", """function segs(){
  if(S.preview)return [S.preview];
  if(routineOn())return S.seq.map(x=>segOf(x)).filter(Boolean);
  return [{src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}];
}
/* a routine move as a playable piece. k = time-warp knots [[source, output-from-start]...] when aligned */
function warpOk(x){
  return S.rt.alignOn===true&&!(S.variant&&S.variant.noWarp)&&x.warp&&x.warp.length>1&&Math.abs((x.warpR||0)-rateOf(x))<1e-6
    &&Math.abs(x.warp[0][0]-x.s)<1e-3&&Math.abs(x.warp[x.warp.length-1][0]-x.e)<1e-3;
}
function segOf(x,noWarp){const m=moveById(x.id);if(!m)return null;const g={src:m.src,s:x.s,e:x.e,r:rateOf(x)};if(!noWarp&&warpOk(x))g.k=x.warp;return g}
function segLen(g){return g.k?g.k[g.k.length-1][1]:(g.e-g.s)/segR(g)}
function toOut(g,t){
  if(!g.k)return clamp(t-g.s,0,g.e-g.s)/segR(g);
  const k=g.k; if(t<=k[0][0])return 0;
  for(let i=1;i<k.length;i++)if(t<=k[i][0]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return o1+(t-s1)*(o2-o1)/((s2-s1)||1)}
  return k[k.length-1][1];
}
function toSrc(g,o){
  if(!g.k)return g.s+clamp(o*segR(g),0,g.e-g.s);
  const k=g.k; if(o<=0)return k[0][0];
  for(let i=1;i<k.length;i++)if(o<=k[i][1]){const [s1,o1]=k[i-1],[s2,o2]=k[i];return s1+(o-o1)*(s2-s1)/((o2-o1)||1)}
  return k[k.length-1][0];
}
function rateAt(g,t){
  if(!g||!g.k)return segR(g);
  const k=g.k; for(let i=1;i<k.length;i++)if(t<k[i][0]-1e-4||i===k.length-1){const [s1,o1]=k[i-1],[s2,o2]=k[i];return clamp((s2-s1)/((o2-o1)||1),0.2,4)}
  return segR(g);
}""")
rep("""function curRate(){const g=segs()[S.segIdx];return segR(g)}""", """function curRate(){const g=segs()[S.segIdx];return g?rateAt(g,v.currentTime):S.vr}""")
rep("""  v=e; e.playbackRate=segR(segs()[S.segIdx]); e.muted=!$('#origAudio').checked;""",
"""  const cg=segs()[S.segIdx]; v=e; e.playbackRate=cg?rateAt(cg,cg.s):S.vr; e.muted=!$('#origAudio').checked;""")
rep("""  e.playbackRate=segR(g); e.muted=true;""", """  e.playbackRate=rateAt(g,g.s); e.muted=true;""")
rep("""function segStart(i,L){let t=0;for(let k=0;k<i;k++)t+=(L[k].e-L[k].s)/segR(L[k]);return t}
function tPos(){const L=segs(),i=Math.min(S.segIdx,L.length-1),g=L[i];if(!g)return 0;return segStart(i,L)+clamp(v.currentTime-g.s,0,g.e-g.s)/segR(g)}
function expected(){return S.offset+tPos()*S.ar}""", """function segStart(i,L){let t=0;for(let k=0;k<i;k++)t+=segLen(L[k]);return t}
function tPos(){const L=segs(),i=Math.min(S.segIdx,L.length-1),g=L[i];if(!g)return 0;return segStart(i,L)+toOut(g,v.currentTime)}
function expected(){return S.offset+(S.variant&&S.variant.shift||0)+(tPos()+(S.avComp||0))*S.ar}""")
rep("""    activate(g.src); v.playbackRate=segR(g); S.switchPending=true; v.currentTime=g.s;""",
"""    activate(g.src); v.playbackRate=rateAt(g,g.s); S.switchPending=true; v.currentTime=g.s;""")
rep("""  v.playbackRate=segR(g);
  if(Math.abs(v.currentTime-g.s)>0.04){S.switchPending=true;v.currentTime=g.s}else S.switchPending=false;""",
"""  v.playbackRate=rateAt(g,g.s);
  if(Math.abs(v.currentTime-g.s)>0.04){S.switchPending=true;v.currentTime=g.s}else S.switchPending=false;""")
rep("""  v.playbackRate=segR(L[i]);
  v.currentTime=L[i].s+clamp((T-segStart(i,L))*segR(L[i]),0,L[i].e-L[i].s);""",
"""  const src=toSrc(L[i],T-segStart(i,L)); v.playbackRate=rateAt(L[i],src); v.currentTime=src;""")
rep("""  const T=segStart(i,L)+Math.max(0,mediaTime-g.s)/segR(g);
  const ts=Math.round(T*1e6);""", """  const T=segStart(i,L)+toOut(g,mediaTime);
  const ts=Math.round(T*1e6);""")
rep("""segs:segs().map(g=>({src:g.src,s:g.s,e:g.e,r:segR(g)})),""", """segs:segs().map(g=>({src:g.src,s:g.s,e:g.e,r:segR(g),k:g.k})),""")
rep("""fade:routineOn()&&S.rt.fade,muxer,target,vr:S.vr,ar:S.ar,offset:S.offset,""",
"""fade:routineOn()&&S.rt.fade,muxer,target,vr:S.vr,ar:S.ar,offset:S.offset+(S.variant&&S.variant.shift||0),""")
rep("""function playLen(x){return (x.e-x.s)/rateOf(x)}""", """function playLen(x){const g=segOf(x);return g?segLen(g):(x.e-x.s)/rateOf(x)}""")
rep("""function segsFor(){return S.seq.map(x=>({s:x.s,e:x.e,r:rateOf(x)}))}""", """function segsFor(){return S.seq.map(x=>segOf(x)||{s:x.s,e:x.e,r:rateOf(x)})}""")
# tick: follow the warp's speed changes inside a move
rep("""      else{
        if(S.rec&&S.rec.mode==='mr')drawFrame(); else if(S.rec&&!v.requestVideoFrameCallback)captureFrame(v.currentTime);
        syncSong(false); recSync(false);
      }""", """      else{
        if(g&&g.k&&!S.switchPending){const r=rateAt(g,v.currentTime);if(Math.abs(v.playbackRate-r)>0.004)v.playbackRate=r}
        if(S.rec&&S.rec.mode==='mr')drawFrame(); else if(S.rec&&!v.requestVideoFrameCallback)captureFrame(v.currentTime);
        syncSong(false); recSync(false);
      }""")
rep("""  } else if(S.hasA)$('#time').textContent=fmt(a.currentTime);
  let d={idx:-1,pulse:false}, s={idx:-1,pulse:false};""", """  } else if(S.hasA)$('#time').textContent=fmt(a.currentTime);
  clickTick();
  let d={idx:-1,pulse:false}, s={idx:-1,pulse:false};""")

# ------------------------------------------------------------------ recording hooks for the blind test
rep("""function finishRecording(blob){
  if(!blob.size){""", """function finishRecording(blob){
  if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(blob&&blob.size?blob:null);return}
  if(!blob.size){""")
rep("""  }catch(e){recMsg("Couldn't finish the video ("+((e&&e.message)||e)+").",true)}
  finally{try{R.ve.close()}catch(e){}}""", """  }catch(e){recMsg("Couldn't finish the video ("+((e&&e.message)||e)+").",true);if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(null)}}
  finally{try{R.ve.close()}catch(e){}}""")
rep("""    else recMsg("Recording didn't finish on this device. Try again in Safari.",true)},5000);""",
"""    else{recMsg("Recording didn't finish on this device. Try again in Safari.",true);if(S.takeWaiter){const w=S.takeWaiter;S.takeWaiter=null;w(null)}}},5000);""")

# ------------------------------------------------------------------ song analysis when a song is decoded
rep("""function loadSong(f,which,restoring){""", """function loadSong(f,which,restoring,meta){""")
rep("""  const so={name:f.name.replace(/\\.[^.]+$/,'')||f.name,blob:null,buf:null,dur:0,ready:false,key:mediaKey(f),fname:f.name,size:f.size};""",
"""  const so={name:f.name.replace(/\\.[^.]+$/,'')||f.name,blob:null,buf:null,dur:0,ready:false,key:mediaKey(f),fname:f.name,size:f.size,
    forceBpm:meta&&meta.forceBpm||null,beatShift:meta&&meta.beatShift||0,an:null};""")
rep("""      so.buf=b; so.dur=b.duration; so.blob=encodeWav(b); so.ready=true; place();""",
"""      so.buf=b; so.dur=b.duration; so.blob=encodeWav(b); so.ready=true; place(); analyzeSongObj(so,!restoring);""")
rep("""      if(f)loadSong(f,slot,true);""", """      if(f)loadSong(f,slot,true,meta);""")
rep("""function songMeta(so){return so?{name:so.name,key:so.key,fname:so.fname,size:so.size}:null}""",
"""function songMeta(so){return so?{name:so.name,key:so.key,fname:so.fname,size:so.size,forceBpm:so.forceBpm||null,beatShift:so.beatShift||0}:null}""")
# save + restore dance analysis and beat source
rep("""      cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut})),""",
"""      cIn:n.id===S.cur?S.cIn:n.cIn,cOut:n.id===S.cur?S.cOut:n.cOut,motion:n.motion||null})),
    beatSrc:S.beatSrc, blind:S.blind?{key:S.blind.key,ratings:S.blind.ratings,at:S.blind.at,revealed:!!S.blind.revealed}:null,""")
rep("""    key:meta.key||(f?mediaKey(f):null), fname:meta.fname||(f&&f.name), size:meta.size||(f&&f.size), missing:!f, blob:f||null, errs:0};""",
"""    key:meta.key||(f?mediaKey(f):null), fname:meta.fname||(f&&f.name), size:meta.size||(f&&f.size), missing:!f, blob:f||null, errs:0,
    motion:meta.motion||null};""")
rep("""    S.dBase=d.dBase||null; S.sBase=d.sBase||null;""", """    S.dBase=d.dBase||null; S.sBase=d.sBase||null; S.beatSrc=d.beatSrc||'detected'; S.blind=d.blind||null;""")
# tapping / typing a song BPM means the dancer overrides detection
rep("""const sTap=tapper($('#sTap'),'Tap beat',bpm=>{""", """const sTap=tapper($('#sTap'),'Tap beat',bpm=>{S.beatSrc='tapped';""")
rep("""$('#sBpm').addEventListener('input',e=>{const x=+e.target.value;S.sBase=x>0?x:null;updateMatch()});""",
"""$('#sBpm').addEventListener('input',e=>{const x=+e.target.value;S.sBase=x>0?x:null;S.beatSrc='tapped';updateMatch()});""")
rep("""function updateMatch(){
  if($('#seqList').children.length)renderMoves();""", """function updateMatch(){
  if($('#seqList').children.length)renderMoves();
  scheduleFit();""")
rep("""function updateSeqStats(){""", """function updateSeqStats(){
  scheduleFit();""")
rep("""  syncSlot();
}
function setIn(t){""", """  syncSlot(); scheduleFit();
}
function setIn(t){""")
rep("""  $('#rSongReset').hidden=!S.rtSong;
}""", """  $('#rSongReset').hidden=!S.rtSong;
  scheduleFit();
}""")
# per-move fit chip in routine rows
rep("""    tap.append(nameEl(m),el('span','len',lenText(x,m)));""",
"""    const lenEl=el('span','len',lenText(x,m)); tap.append(nameEl(m),lenEl);
    const fc=el('span','chipfit idle','');fc.dataset.fit=i;fc.hidden=true;tap.querySelector('b').append(fc);""")
# enable the Find hits button with a video
rep("""  $('#recBtn').disabled=!(hv&&S.hasA&&buf);""", """  $('#recBtn').disabled=!(hv&&S.hasA&&buf);
  const cn=srcById(S.cur); $('#danceAnalyze').disabled=!(cn&&!cn.missing)||!!S.analyzing; renderDance();""")

# ------------------------------------------------------------------ the new features
rep("""/* ---------- frame loop ---------- */""", r"""/* ================== BEAT ANALYSIS, ALIGNMENT, FIT, CHECKS ================== */

/* ---------- song beat ---------- */
function songChans(b){const out=[];for(let c=0;c<Math.min(2,b.numberOfChannels);c++)out.push(b.getChannelData(c));return out}
function analyzeSongObj(so,apply){
  if(!so||!so.buf)return;
  setTimeout(()=>{
    try{
      const an=RA.analyzeSong(songChans(so.buf),so.buf.sampleRate,{forceBpm:so.forceBpm||undefined,noPhaseFix:false});
      if(so.beatShift){const h=30/an.bpm;an.beats=an.beats.map(t=>t+h).filter(t=>t<so.buf.duration);an.downbeats=an.beats.filter((t,i)=>i%4===((an.phase||0)%4))}
      so.an=an;
    }catch(e){so.an=null}
    if(so===S.mainSong){if(apply)S.beatSrc='detected';if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
    renderSongCard(); scheduleFit();
  },30);
}
function applyDetectedBeat(so){
  if(!so||!so.an)return;
  S.beatSrc='detected'; S.sBase=+so.an.bpm.toFixed(2); S.sAnchor=(so.an.downbeats[0]??so.an.beats[0])||0;
  $('#sBpm').value=S.sBase.toFixed(1); updateMatch();
}
/* beat grid of a song in song seconds. The Song tab's song uses taps instead when the dancer tapped. */
function songGrid(so){
  if(!so)return null;
  if(so===S.mainSong&&S.beatSrc==='tapped'&&S.sBase){
    const p=60/S.sBase, a0=S.sAnchor||0, dur=sDur(so)||600, b=[], d=[];
    let k0=Math.ceil(-a0/p); for(let k=k0;a0+k*p<dur;k++){const t=a0+k*p;b.push(t);if(((k%4)+4)%4===0)d.push(t)}
    return {beats:b,down:d,bpm:S.sBase,tapped:true};
  }
  if(so.an&&so.an.beats.length>4)return {beats:so.an.beats,down:so.an.downbeats,bpm:so.an.bpm};
  return null;
}
function liveGrid(){return songGrid(S.liveSong)}
function routineSong(){return S.rtSong||S.mainSong}
function renderSongCard(){
  const so=S.mainSong, card=$('#songCard');
  if(!so||!so.an){card.hidden=!(so&&so.ready&&!so.an&&so.buf);if(!card.hidden){$('#songDet').textContent='Finding the beat…'}return}
  card.hidden=false; const an=so.an;
  $('#songDet').textContent=an.bpm.toFixed(1)+' BPM · '+Math.round(an.conf*100)+'% sure'+(S.beatSrc==='tapped'?' · using your taps':'');
  const box=$('#songCands'); box.textContent='';
  const all=[{bpm:+an.bpm.toFixed(1)}].concat((an.candidates||[]).filter(c=>Math.abs(c.bpm-an.bpm)/an.bpm>0.05)).slice(0,4);
  all.forEach((c,i)=>{const b=el('button','btn sm cand'+(i===0?' on':''),c.bpm.toFixed(1));b.setAttribute('aria-label','Use '+c.bpm.toFixed(1)+' BPM');
    b.addEventListener('click',()=>{if(i===0)return;so.forceBpm=c.bpm;so.beatShift=0;so.confirmed=false;S.beatSrc='detected';$('#songDet').textContent='Re-finding the beat…';analyzeSongObj(so,true)});box.append(b)});
  const w=$('#songWarn'); w.textContent='';
  const warn=t=>w.append(el('li',null,t));
  if(an.conf<0.35)warn('The tempo is unclear here (weak or irregular kick). Check it with the click, or tap it in the Tempo tab.');
  if(an.contrast<0.6)warn('Beats barely stand out from the rest of the track, so beat positions may be off.');
  if(!so.confirmed&&an.candidates&&an.candidates.some(c=>c.score>=0.85&&(Math.abs(c.bpm/an.bpm-4/3)<0.03||Math.abs(c.bpm/an.bpm-3/4)<0.03)))warn('A 3-3-2 rhythm (like the dembow) can make a tempo 4/3 off look strong. If the clicks drift against the kick, try the other number, or Tap to check.');
  if(an.downConf<0.15)warn("Not sure which beat is the 1 of the bar.");
}
$('#beatHalf').addEventListener('click',()=>{const so=S.mainSong;if(!so)return;so.beatShift=so.beatShift?0:0.5;so.confirmed=false;S.beatSrc='detected';analyzeSongObj(so,true)});
$('#beatUseDet').addEventListener('click',()=>{const so=S.mainSong;if(so&&so.an)applyDetectedBeat(so);renderSongCard();scheduleFit()});
$('#clickOn').addEventListener('change',e=>{S.clickOn=e.target.checked;if(S.clickOn){const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{})}});
/* click track: a short tick each time the song passes a beat (downbeats higher) */
let lastClickT=-1;
function clickTick(){
  if(!S.clickOn||a.paused||!S.hasA){lastClickT=-1;return}
  const G=liveGrid(); if(!G)return; const t=a.currentTime;
  if(lastClickT<0||t<lastClickT||t-lastClickT>0.5){lastClickT=t;return}
  const hit=G.beats.find(b=>b>lastClickT&&b<=t+0.012); lastClickT=t;
  if(hit==null)return;
  const c=getCtx(); if(c.state!=='running')return;
  const down=G.down.some(d=>Math.abs(d-hit)<0.02);
  const o=c.createOscillator(),g=c.createGain(); o.frequency.value=down?1600:1000; g.gain.setValueAtTime(0.35,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.05);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+0.06);
}

/* ---------- dance hits (motion beats) ---------- */
let ANALYZE_RATE=1;   /* normal speed: at 2x, phones and browsers skip frames and hits get missed */
function analyzeVideo(n,onProg){
  return new Promise(resolve=>{
    if(!n||!n.url||n.missing){resolve(null);return}
    const ve=document.createElement('video'); ve.muted=true; ve.setAttribute('playsinline',''); ve.preload='auto';
    ve.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.append(ve); ve.src=n.url;
    const cvs=document.createElement('canvas'), c2=cvs.getContext('2d',{willReadFrequently:true});
    let W=80,H=80,prev=null,series=[],done=false,lastT=-1;
    const finish=()=>{if(done)return;done=true;try{ve.pause()}catch(e){}ve.remove();
      const res=series.length>10?RA.analyzeMotion(series):null; resolve(res)};
    const grab=t=>{
      if(t<=lastT+0.001)return; lastT=t;
      c2.drawImage(ve,0,0,W,H); const d=c2.getImageData(0,0,W,H).data, g=new Uint8Array(W*H);
      for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;
      if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,H,8));series.push({t,D:dg.D,cam:dg.cam,mag:dg.mag})}
      prev=g; if(onProg&&ve.duration)onProg(Math.min(1,t/ve.duration));
    };
    ve.addEventListener('loadedmetadata',()=>{
      const vw=ve.videoWidth||16,vh=ve.videoHeight||9; W=112; H=Math.max(56,Math.min(200,Math.round(112*vh/vw)));
      cvs.width=W; cvs.height=H; ve.playbackRate=window.__rsRate||ANALYZE_RATE;
      const p=ve.play(); if(p)p.catch(()=>finish());
      if(ve.requestVideoFrameCallback){const cb=(now,meta)=>{if(done)return;grab(meta.mediaTime);ve.requestVideoFrameCallback(cb)};ve.requestVideoFrameCallback(cb)}
      else{const poll=()=>{if(done)return;grab(ve.currentTime);requestAnimationFrame(poll)};requestAnimationFrame(poll)}
    });
    ve.addEventListener('ended',finish); ve.addEventListener('error',finish);
    setTimeout(finish,600000);
  });
}
async function findHits(n){
  if(!n||S.analyzing)return null;
  S.analyzing=true; enable(); $('#danceProg').hidden=false; const bar=$('#danceProg i'); bar.style.width='0';
  $('#danceInfo').textContent='Finding hits in '+n.name+'… (plays through it once, silently)';
  const res=await analyzeVideo(n,p=>{bar.style.width=Math.round(p*100)+'%'});
  S.analyzing=false; $('#danceProg').hidden=true;
  if(res){n.motion=res; if(n.id===S.cur&&(!S.dBase||S.danceSrc!=='tapped')){S.dBase=+res.bpm.toFixed(1);S.danceSrc='detected';$('#dBpm').value=S.dBase.toFixed(1)}}
  enable(); renderMoves(); updateMatch(); scheduleFit();
  if(!res)$('#danceInfo').textContent="Couldn't read frames from this video.";
  return res;
}
$('#danceAnalyze').addEventListener('click',()=>findHits(srcById(S.cur)));
function renderDance(){
  const n=srcById(S.cur), info=$('#danceInfo'), w=$('#danceWarn');
  if(S.analyzing)return; w.textContent='';
  if(!n){info.textContent='Add a dance video first.';return}
  $('#danceAnalyze').textContent=n.motion?'Find again':'Find hits';
  if(!n.motion){info.textContent='Finds the moments the dancer hits: sharp stops and changes of direction. They show as blue ticks under the video, next to the song’s beats in orange.';return}
  const m=n.motion; info.textContent=m.beats.length+' hits found in '+n.name+' · dance tempo about '+m.bpm.toFixed(0)+' BPM.';
  const warn=t=>w.append(el('li',null,t));
  if(m.contrast<0.55)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');
  if(m.cam>0.8)warn('The camera moves a lot. Camera motion is removed, but strong pans can hide hits.');
  if(m.beats.length<4)warn('Very few hits found. Try a clip where the dancer fills more of the frame.');
  warn('Hits come from image motion, not body tracking: footwork hidden from the camera or below the frame can be missed.');
}
$('#dTap').addEventListener('click',()=>{S.danceSrc='tapped'});
$('#dBpm').addEventListener('input',()=>{S.danceSrc='tapped'});

/* ---------- fit scoring ---------- */
function motionIn(srcId,s,e){const n=srcById(srcId);return n&&n.motion?hitsOf(n).filter(b=>b.t>=s-0.001&&b.t<=e+0.001):null}
/* score a list of pieces against a song grid. Everything compared in playback seconds. */
function fitOf(list,G,offset,ar,shift){
  if(!G||!list.length)return null;
  /* targets: every beat and every "and" (half-beat), as alignment uses */
  const tg=[];for(let i=0;i<G.beats.length;i++){tg.push(G.beats[i]);if(i<G.beats.length-1)tg.push((G.beats[i]+G.beats[i+1])/2)}
  const beatsOut=tg.map(b=>(b-offset-(shift||0))/ar).sort((p,q)=>p-q);
  let T=0, all=[], per=[], missing=false;
  for(const g of list){
    const mb=motionIn(g.src,g.s,g.e);
    if(!mb){per.push(null);missing=true;T+=segLen(g);continue}
    const pts=mb.map(b=>({t:T+toOut(g,b.t),w:b.w}));
    per.push(pts.length?RA.score(pts,beatsOut,0.05):null); all=all.concat(pts); T+=segLen(g);
  }
  return {all:all.length?RA.score(all,beatsOut,0.05):null,per,missing};
}
const pct=x=>x==null?'—':Math.round(x*100)+'%';
const fitClass=x=>x==null?'idle':x>=0.6?'ok':x>=0.35?'warn':'bad';
let fitQueued=false;
function scheduleFit(){if(fitQueued)return;fitQueued=true;requestAnimationFrame(()=>{fitQueued=false;refreshFit()})}
function refreshFit(){
  /* routine card */
  const card=$('#fitCard'); card.hidden=!S.seq.length;
  if(S.seq.length){
    const rs=routineSong(), G=songGrid(rs), off=S.rt.offset, ar=S.rt.ar;
    const now=S.seq.map(x=>segOf(x)).filter(Boolean), cst=S.seq.map(x=>segOf(x,true)).filter(Boolean);
    const hasWarp=S.seq.some(x=>x.warp&&Math.abs((x.warpR||0)-rateOf(x))<1e-6&&Math.abs(x.warp[0][0]-x.s)<1e-3&&Math.abs(x.warp[x.warp.length-1][0]-x.e)<1e-3);
    const alignedList=hasWarp?S.seq.map(x=>{const g=segOf(x,true);if(g&&x.warp&&Math.abs((x.warpR||0)-rateOf(x))<1e-6)g.k=x.warp;return g}).filter(Boolean):null;
    const fNow=fitOf(now,G,off,ar,0), fC=fitOf(cst,G,off,ar,0), fA=alignedList?fitOf(alignedList,G,off,ar,0):null, fO=G?fitOf(alignedList||now,G,off,ar,15/G.bpm):null;
    const show=(id,f)=>{$('#'+id).textContent=f&&f.all?pct(f.all.bas):'—';const e=$('#'+id+'Err');if(e)e.textContent=f&&f.all?'±'+Math.round(f.all.errMs)+' ms':' '};
    show('fitNow',fNow); show('fitConst',fC); show('fitAligned',fA); $('#fitOff').textContent=fO&&fO.all?pct(fO.all.bas):'—';
    const on=S.rt.alignOn===true; $('#alignOn').setAttribute('aria-pressed',on); $('#alignOff').setAttribute('aria-pressed',!on); $('#alignOn').disabled=!hasWarp;
    $('#maxStretchOut').textContent='±'+Math.round((S.rt.maxStretch||0.2)*100)+'%'; if(document.activeElement!==$('#maxStretch'))$('#maxStretch').value=Math.round((S.rt.maxStretch||0.2)*100);
    S.fitPer=fNow?fNow.per:[];
    $$('[data-fit]').forEach(c=>{const p=S.fitPer[+c.dataset.fit];c.hidden=!p;if(p){c.className='chipfit '+fitClass(p.bas);c.textContent=pct(p.bas)}});
    const msg=$('#fitMsg');
    if(!G)msg.textContent='Add the routine song so the beat can be found (Song tab).';
    else if(fNow&&fNow.missing)msg.textContent='Some videos have no dance hits yet. Align finds them first.';
    else if(!msg.dataset.keep)msg.textContent='';
    drawSeqCanvas(now,G,off,ar);
  }
  /* clip: Tempo tab line */
  const cf=$('#clipFit');
  if(S.hasV&&!routineOn()){
    const g={src:S.cur,s:S.cIn,e:clipEnd(),r:S.vr}, f=fitOf([g],liveGrid(),S.offset,S.ar,0);
    cf.textContent=f&&f.all?'Beat fit for this clip: '+pct(f.all.bas)+' · hits miss by about '+Math.round(f.all.errMs)+' ms':(srcById(S.cur)&&srcById(S.cur).motion?'':'Find dance hits (Clip tab) to see how well this clip fits the beat.');
  } else cf.textContent='';
  drawHitStrip();
}
function tok(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||'#888'}
function sizeCanvas(c){const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h}return {w,h,dpr}}
function drawSeqCanvas(list,G,off,ar){
  const c=$('#seqCanvas'); if($('#seqBar').hidden)return; const {w,h,dpr}=sizeCanvas(c), x=c.getContext('2d'); x.clearRect(0,0,w,h);
  const tot=list.reduce((t,g)=>t+segLen(g),0)||1;
  if(G){x.fillStyle='rgba(255,255,255,.85)';const dn=new Set(G.down.map(t=>t.toFixed(3)));
    for(const b of G.beats){const o=(b-off)/ar;if(o<0||o>tot)continue;const X=o/tot*w,isD=dn.has(b.toFixed(3));x.globalAlpha=isD?0.95:0.45;x.fillRect(X-dpr*0.5,0,dpr*(isD?2:1),isD?h:h*0.45)}}
  x.globalAlpha=1; x.fillStyle=tok('--song-hot'); let T=0;
  for(const g of list){const mb=motionIn(g.src,g.s,g.e)||[];for(const b of mb){const X=(T+toOut(g,b.t))/tot*w;x.beginPath();x.arc(X,h-4*dpr,(1.5+2*b.w)*dpr,0,7);x.fill()}T+=segLen(g)}
}
function drawHitStrip(){
  const c=$('#hitStrip'); const {w,h,dpr}=sizeCanvas(c), x=c.getContext('2d'); x.clearRect(0,0,w,h);
  if(!S.hasV)return;
  const ro=routineOn(), list=segs(), G=liveGrid();
  if(ro){const tot=list.reduce((t,g)=>t+segLen(g),0)||1;
    if(G){x.fillStyle=tok('--song-hot');for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0||o>tot)continue;x.fillRect(o/tot*w,0,dpr,h*0.5)}}
    x.fillStyle=tok('--dance');let T=0;for(const g of list){for(const b of motionIn(g.src,g.s,g.e)||[])x.fillRect((T+toOut(g,b.t))/tot*w,h*0.5,dpr*1.5,h*0.5);T+=segLen(g)}
    return}
  const n=srcById(S.cur), d=v.duration||0; if(!d)return;
  if(G){x.fillStyle=tok('--song-hot');for(const b of G.beats){const src=S.cIn+((b-S.offset)/S.ar)*S.vr;if(src<0||src>d)continue;x.fillRect(src/d*w,0,dpr,h*0.5)}}
  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of n.motion.beats)x.fillRect(b.t/d*w,h*0.5,dpr*1.5,h*0.5)}
}
window.addEventListener('resize',scheduleFit);

/* ---------- align: time-warp each move so its hits land on beats ---------- */
function fitMsg(t){const m=$('#fitMsg');m.textContent=t||'';if(t)m.dataset.keep='1';else delete m.dataset.keep}
async function alignRoutine(){
  if(S.rec||!S.seq.length)return; pause();
  const rs=routineSong(), G=songGrid(rs);
  if(!G){fitMsg('Add the routine song first so its beat can be found.');return}
  const need=[...new Set(S.seq.map(x=>moveById(x.id)&&moveById(x.id).src))].map(srcById).filter(n=>n&&!n.motion&&!n.missing);
  const prog=$('#alignProg'), bar=$('#alignProg i');
  for(let i=0;i<need.length;i++){prog.hidden=false;fitMsg('Finding dance hits in '+need[i].name+' ('+(i+1)+'/'+need.length+')…');
    const r=await analyzeVideo(need[i],p=>{bar.style.width=Math.round(((i+p)/need.length)*100)+'%'});if(r)need[i].motion=r}
  prog.hidden=true;
  const grid=RA.grid(G.beats,G.down); let T=0, pinned=0, strong=0, maxQ=0;
  for(const x of S.seq){
    const m=moveById(x.id); if(!m)continue; const r=rateOf(x), mb=motionIn(m.src,x.s,x.e)||[];
    const S0=S.rt.offset+T*S.rt.ar;
    x.warp=RA.warpMove(mb,x.s,x.e,r,S0,S.rt.ar,grid,{maxStretch:S.rt.maxStretch||0.2}); x.warpR=r;
    for(let i=1;i<x.warp.length;i++){const q=((x.warp[i][0]-x.warp[i-1][0])/((x.warp[i][1]-x.warp[i-1][1])||1))/r;maxQ=Math.max(maxQ,Math.abs(q-1))}
    pinned+=x.warp.length-2; strong+=mb.filter(b=>b.w>=0.25).length; T+=x.warp[x.warp.length-1][1];
  }
  S.rt.alignOn=true; S.rt.set=true;
  renderMoves(); updateTrim(); refreshFit();
  fitMsg(pinned+' of '+strong+' strong hits pinned to the beat · biggest speed change ±'+Math.round(maxQ*100)+'%.'+(S.seq.length>1?' Changing a move’s trim, speed or the song start undoes its alignment; align again after editing.':''));
}
$('#alignBtn').addEventListener('click',alignRoutine);
$('#alignClear').addEventListener('click',()=>{S.seq.forEach(x=>{delete x.warp;delete x.warpR});S.rt.alignOn=false;fitMsg('');renderMoves();updateTrim();refreshFit()});
$('#alignOn').addEventListener('click',()=>{if(S.rec)return;pause();S.rt.alignOn=true;renderMoves();updateTrim();refreshFit()});
$('#alignOff').addEventListener('click',()=>{if(S.rec)return;pause();S.rt.alignOn=false;renderMoves();updateTrim();refreshFit()});
$('#maxStretch').addEventListener('input',e=>{S.rt.maxStretch=(+e.target.value)/100;S.rt.set=true;$('#maxStretchOut').textContent='±'+e.target.value+'%'});

/* ---------- sync check (ITU-R BT.1359: sound >45 ms early or >125 ms late is detectable) ---------- */
let syncLog=null;
function syncCheck(){
  const out=$('#syncOut'); out.hidden=false;
  if(!S.hasV||!S.hasA){out.textContent='Add a dance video and a song first.';return}
  if(S.rec)return;
  pause(); S.segIdx=0; toStart();
  const samples=[]; let checking=true; const t0=performance.now();
  allEls().forEach(e=>{if(!e.requestVideoFrameCallback)return;const f=(now,meta)=>{if(!checking)return;
    if(e===v&&S.playing&&!S.switchPending&&!a.paused&&a.readyState>=2){const L=segs(),g=L[S.segIdx];
      if(g&&meta.mediaTime>=g.s-0.01&&meta.mediaTime<=g.e+0.01){const T=segStart(S.segIdx,L)+toOut(g,meta.mediaTime);const exp=S.offset+T*S.ar;
        const lead=Math.max(0,(meta.expectedDisplayTime||performance.now())-performance.now())/1000;
        const audioAtDisplay=a.currentTime+lead*a.playbackRate;
        samples.push({t:+T.toFixed(3),ms:+(((audioAtDisplay-exp)/S.ar)*1000).toFixed(1)})}}
    e.requestVideoFrameCallback(f)};e.requestVideoFrameCallback(f)});
  play(); out.textContent='Measuring… keep the app open for 8 seconds.';
  setTimeout(()=>{
    checking=false; pause();
    const use=samples.filter(x=>x.t>0.6).map(x=>x.ms).sort((p,q)=>p-q);
    if(use.length<20){out.textContent='Not enough frames measured. Try again with the video playing.'+(allEls()[0].requestVideoFrameCallback?'':' (This browser can’t time frames.)');return}
    const q=f=>use[Math.min(use.length-1,Math.max(0,Math.round(f*(use.length-1))))];
    const med=q(0.5),p5=q(0.05),p95=q(0.95), early=Math.max(0,p95), late=Math.max(0,-p5);
    const pass=early<=45&&late<=125;
    syncLog={device:navigator.userAgent,when:new Date().toISOString(),mode:routineOn()?'routine':'clip',correction_ms:Math.round((S.avComp||0)*1000),samples,summary:{median_ms:med,p5_ms:p5,p95_ms:p95,frames:use.length,pass}};
    out.innerHTML='';
    out.append(el('b',null,pass?'In sync on this phone.':'Out of sync on this phone.'));
    out.append(document.createTextNode(' Typical offset '+(med>0?'+':'')+Math.round(med)+' ms (sound '+(med>=0?'ahead':'behind')+'); 90% of frames between '+Math.round(p5)+' and '+(p95>0?'+':'')+Math.round(p95)+' ms, from '+use.length+' frames. Limits: sound up to 45 ms early or 125 ms late (ITU-R BT.1359). Doesn’t include Bluetooth or AirPlay delay, which can add 150–250 ms. Recordings are built from the same timeline, so they line up by design. '));
    if(Math.abs(med)>15){const fx=el('button','btn sm primary','Correct for this phone');
      fx.addEventListener('click',()=>{S.avComp=clamp((S.avComp||0)-med/1000,-0.3,0.3);try{localStorage.setItem('rs-avcomp',String(S.avComp))}catch(e){}
        fx.textContent='Corrected by '+Math.round(-med)+' ms · run the check again to confirm';fx.disabled=true});out.append(fx,document.createTextNode(' '))}
    if(S.avComp){const rs=el('button','btn sm ghost','Reset correction ('+Math.round(S.avComp*1000)+' ms)');rs.addEventListener('click',()=>{S.avComp=0;try{localStorage.removeItem('rs-avcomp')}catch(e){};rs.textContent='Correction cleared'});out.append(rs,document.createTextNode(' '))}
    const sv=el('button','btn sm','Save log'); sv.addEventListener('click',async()=>{const r=await saveFile('riddim-swap-sync-'+Date.now()+'.json',JSON.stringify(syncLog,null,1),'application/json');sv.textContent=saveWords[r]||'Saved'});
    out.append(sv);
  },8000);
}
$('#syncBtn').addEventListener('click',syncCheck);

/* ---------- blind test kit ---------- */
const blindTakes={};
function recordTake(){
  return new Promise(res=>{S.takeWaiter=res;startRecording();if(!S.rec){S.takeWaiter=null;res(null)}});
}
async function makeBlind(){
  const box=$('#blindBox'); box.hidden=false; box.textContent='';
  if(!S.seq.length||!S.hasA){box.append(el('p','hint','Build a routine with a song first.'));return}
  if(!S.seq.some(x=>x.warp)){box.append(el('p','hint','Aligning the routine first…'));await alignRoutine()}
  const G=songGrid(routineSong()); if(!G){box.textContent='';box.append(el('p','hint','The song’s beat is needed first.'));return}
  if(!routineOn())setMode(true);
  const kinds=['aligned','constant','off'], letters=['A','B','C'];
  for(let i=kinds.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]]}
  const key={}; letters.forEach((L,i)=>key[L]=kinds[i]);
  const wasOn=S.rt.alignOn;
  for(let i=0;i<3;i++){
    box.textContent=''; box.append(el('p','hint','Recording take '+(i+1)+' of 3… keep the app open.'));
    const k=key[letters[i]];
    S.rt.alignOn=true;
    S.variant=k==='aligned'?{noWarp:false,shift:0}:k==='constant'?{noWarp:true,shift:0}:{noWarp:true,shift:15/G.bpm};
    updateTrim();
    const blob=await recordTake(); S.variant=null;
    if(blindTakes[letters[i]])URL.revokeObjectURL(blindTakes[letters[i]].url);
    blindTakes[letters[i]]=blob?{blob,url:URL.createObjectURL(blob)}:null;
    await new Promise(r=>setTimeout(r,400));
  }
  S.rt.alignOn=wasOn; updateTrim();
  S.blind={key,ratings:[],at:new Date().toISOString(),revealed:false};
  renderBlind();
}
function renderBlind(){
  const box=$('#blindBox'), B=S.blind; box.textContent=''; if(!B){box.hidden=true;return} box.hidden=false;
  box.append(el('p','hint','Show each take to dancers without saying which is which. Ask: "Is the dance on the beat?" 1 = off, 5 = locked in.'));
  const player=el('video'); player.setAttribute('playsinline',''); player.controls=true; player.hidden=true;
  const takes=el('div','takes');
  ['A','B','C'].forEach(L=>{const t=blindTakes[L];const col=el('div','field');
    const pl=el('button','btn sm','▶ Take '+L); pl.disabled=!t; pl.addEventListener('click',()=>{player.hidden=false;player.src=t.url;player.play().catch(()=>{})});
    const sv=el('button','btn sm','Save '+L); sv.disabled=!t; sv.addEventListener('click',async()=>{const r=await saveFile('take-'+L+'.mp4',t.blob,t.blob.type||'video/mp4');sv.textContent=r==='declined'?'Save '+L:'Saved'});
    col.append(pl,sv); takes.append(col)});
  if(!blindTakes.A)box.append(el('p','hint','The take videos aren’t kept after closing the app; ratings and the answer key are.'));
  box.append(takes,player);
  /* ratings */
  const form=el('div','row'); const nm=el('input'); nm.type='text'; nm.placeholder='Dancer'; nm.setAttribute('aria-label','Dancer name');
  const sel={}; ['A','B','C'].forEach(L=>{const s2=el('select');s2.setAttribute('aria-label','Rating for take '+L);s2.append(el('option',null,L+' –'));for(let i=1;i<=5;i++){const o=el('option',null,L+' '+i);o.value=i;s2.append(o)}sel[L]=s2;form.append(s2)});
  const add=el('button','btn sm','Add rating'); add.addEventListener('click',()=>{const r={name:nm.value.trim()||('Dancer '+(B.ratings.length+1))};let ok=true;['A','B','C'].forEach(L=>{const v2=+sel[L].value;if(!v2)ok=false;r[L]=v2});if(!ok)return;B.ratings.push(r);renderBlind()});
  form.prepend(nm); form.append(add); box.append(form);
  if(B.ratings.length){
    const wrap=el('div','tblwrap'),tb=el('table'),hd=el('tr');['Dancer','A','B','C'].forEach((h,i)=>{const th=el('th',i?'num':null,h);hd.append(th)});tb.append(hd);
    B.ratings.forEach(r=>{const tr=el('tr');tr.append(el('td',null,r.name));['A','B','C'].forEach(L=>tr.append(el('td','num',String(r[L]))));tb.append(tr)});
    wrap.append(tb); box.append(wrap);
  }
  const rv=el('button','btn sm',B.revealed?'Hide answers':'Reveal answers'); rv.addEventListener('click',()=>{B.revealed=!B.revealed;renderBlind()});
  const ex=el('button','btn sm ghost','Save results'); ex.disabled=!B.ratings.length;
  ex.addEventListener('click',async()=>{const lines=['dancer,take,version,rating'];B.ratings.forEach(r=>['A','B','C'].forEach(L=>lines.push([JSON.stringify(r.name),L,B.key[L],r[L]].join(','))));const res=await saveFile('blind-test-results.csv',lines.join('\n'),'text/csv');ex.textContent=saveWords[res]||'Saved'});
  const again=el('button','btn sm ghost','New test'); again.addEventListener('click',makeBlind);
  const row=el('div','row'); row.append(rv,ex,again); box.append(row);
  if(B.revealed){
    const names={aligned:'Aligned',constant:'Constant speed',off:'Deliberately off'};
    const mean=k=>{const L=Object.keys(B.key).find(x=>B.key[x]===k);const v2=B.ratings.map(r=>r[L]);return v2.length?v2.reduce((p,q)=>p+q,0)/v2.length:null};
    const ul=el('ul',null); ['A','B','C'].forEach(L=>{const m=mean(B.key[L]);ul.append(el('li',null,'Take '+L+' = '+names[B.key[L]]+(m!=null?' · average '+m.toFixed(1)+' / 5':'')))});
    box.append(ul);
    if(B.ratings.length){const mo=mean('off'),ma=mean('aligned'),mc=mean('constant');
      box.append(el('p','hint',mo<Math.min(ma,mc)?'The deliberately-off take was rated lowest, so these dancers can hear timing and their ratings of the other two mean something.'+(ma>mc?' They rated the aligned version highest.':' They did not rate the aligned version highest.'):'The deliberately-off take was NOT rated lowest, so these ratings can’t tell the versions apart. Try more dancers, or a routine with clearer hits.'))}
  }
}
$('#blindBtn').addEventListener('click',makeBlind);

/* test hook: only with #debug in the address */
if(/debug/.test(location.hash))window.__rs={S,RA,segs,tPos,srcById,routineOn};
/* ---------- frame loop ---------- */""")

# initial render
rep("""renderSources(); updateTrim(); showSlots(); applyRates(); renderMoves(); updateCutter(); requestAnimationFrame(tick);""",
"""renderSources(); updateTrim(); showSlots(); applyRates(); renderMoves(); updateCutter(); renderBlind(); requestAnimationFrame(tick);""")
# restore: re-render the blind panel and dance card
rep("""    enable(); renderSources(); renderMoves(); updateTrim(); updateMatch(); updateMissing();
    PJ.last=JSON.stringify(snapshot()); saveState('Saved');""", """    enable(); renderSources(); renderMoves(); updateTrim(); updateMatch(); updateMissing(); renderBlind(); renderSongCard();
    PJ.last=JSON.stringify(snapshot()); saveState('Saved');""")
# reset clears new state
rep("""    main:{offset:0,ar:1,vr:1},rt:{offset:0,ar:1,vr:1,fade:true,set:false,spMode:'all'}});""",
"""    main:{offset:0,ar:1,vr:1},rt:{offset:0,ar:1,vr:1,fade:true,set:false,spMode:'all'},beatSrc:'detected',blind:null,fitPer:[]});""")
rep("  setRate(S.ar);\n  const drift=a.currentTime-e;\n  if(routineOn()&&!force){\n    /* routine: leave the music alone through cuts and brief stalls; only fix it when it's clearly out */\n    const now=performance.now();\n    if(Math.abs(drift)>0.35&&!S.switchPending&&!v.seeking&&!a.seeking&&now-S.lastFix>1500){S.lastFix=now;a.currentTime=e}\n    return;\n  }\n  if(force||Math.abs(drift)>0.25){S.lastFix=performance.now();a.currentTime=e}\n}","  setRate(S.ar);\n  const drift=a.currentTime-e, now=performance.now();\n  if(force){S.lastFix=now;S.driftEma=0;a.currentTime=e;return}\n  /* smooth the measured drift so one late frame or a cut doesn't trigger a jump */\n  if(!S.switchPending&&!v.seeking&&!a.seeking)S.driftEma=0.85*(S.driftEma||0)+0.15*drift;\n  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&now-S.lastFix>1500;\n  /* a big jump (user seek): fix at once; a steady offset above 80 ms (e.g. the sound starting late): fix once it's clear */\n  if((Math.abs(drift)>(routineOn()?0.4:0.25)&&settled)||(Math.abs(S.driftEma)>0.08&&settled)){S.lastFix=now;S.driftEma=0;a.currentTime=e}\n}")

# ------------------------------------------------------------------ exact recorder: open formats when H.264/AAC isn't available (Android, desktop Chrome)
rep("""      for(const codec of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f']){
        const cfg={codec,width:w,height:h,bitrate:5000000,framerate:30,avc:{format:'avc'}};
        const r=await VideoEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported){vCfg=cfg;break}
      }""", """      for(const codec of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f','vp09.00.10.08','vp8']){
        const avc=codec.startsWith('avc');
        const cfg=avc?{codec,width:w,height:h,bitrate:5000000,framerate:30,avc:{format:'avc'}}:{codec,width:w,height:h,bitrate:5000000,framerate:30};
        const r=await VideoEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported&&codec!=='vp8'){vCfg=cfg;vCfg.mux=avc?'avc':'vp9';break}
      }""")
rep("""      for(const sr of [buf.sampleRate,48000,44100]){
        const cfg={codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:160000};
        const r=await AudioEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported){aCfg=cfg;break}
      }""", """      for(const sr of [buf.sampleRate,48000,44100]){
        const cfg={codec:'mp4a.40.2',sampleRate:sr,numberOfChannels:ch,bitrate:160000};
        const r=await AudioEncoder.isConfigSupported(cfg).catch(()=>null);
        if(r&&r.supported){aCfg=cfg;aCfg.mux='aac';break}
      }
      if(!aCfg){const cfg={codec:'opus',sampleRate:48000,numberOfChannels:ch,bitrate:160000};
        const r=await AudioEncoder.isConfigSupported(cfg).catch(()=>null); if(r&&r.supported){aCfg=cfg;aCfg.mux='opus'}}""")
rep("""    video:{codec:'avc',width:vCfg.width,height:vCfg.height},""", """    video:{codec:vCfg.mux||'avc',width:vCfg.width,height:vCfg.height},""")
rep("""    audio:{codec:'aac',numberOfChannels:aCfg.numberOfChannels,sampleRate:aCfg.sampleRate}});""",
    """    audio:{codec:aCfg.mux||'aac',numberOfChannels:aCfg.numberOfChannels,sampleRate:aCfg.sampleRate}});""")
rep("""  const out=[], aDur=Math.round(1024/aCfg.sampleRate*1e6); let err=null;
  const ae=new AudioEncoder({output:c=>{out.push({data:stripAdts(rawChunk(c)),""", """  const out=[], aDur=aCfg.mux==='opus'?20000:Math.round(1024/aCfg.sampleRate*1e6); let err=null;
  const ae=new AudioEncoder({output:c=>{const raw=rawChunk(c);out.push({data:aCfg.mux==='opus'?raw:stripAdts(raw),""")

rep("""  try{S.rec=useCodecs?startCodecRec():startMrRec()}""","""  try{S.rec=useCodecs?startCodecRec():startMrRec();if(/debug/.test(location.hash))window.__lastRecMode=S.rec&&S.rec.mode}""")
rep("""    R.lastTs=ts; R.frames++;""","""    R.lastTs=ts; R.frames++; if(window.__recLog)window.__recLog.push([+mediaTime.toFixed(3),i,+T.toFixed(3),!!g.k]);""")
# ------------------------------------------------------------------ recording: real encoder lead-in + measured self-check
rep("""  const ae=new AudioEncoder({output:c=>{const raw=rawChunk(c);out.push({data:aCfg.mux==='opus'?raw:stripAdts(raw),""",
    """  const ae=new AudioEncoder({output:(c,m)=>{if(m&&m.decoderConfig&&!out.meta)out.meta=m;const raw=rawChunk(c);out.push({data:aCfg.mux==='opus'?raw:stripAdts(raw),""")
rep("""    const step=R.ar*buf.sampleRate/sr, p0=R.offset*buf.sampleRate, N=4096;""",
    """    /* encComp: measured per phone and codec by the recording self-check (encoder lead-in) */
    const step=R.ar*buf.sampleRate/sr, p0=(R.offset+encComp()*R.ar)*buf.sampleRate, N=4096;""")
rep("""    for(const c of chunks)R.muxer.addAudioChunkRaw(c.data,c.type,c.ts,c.dur);  /* muxer writes its own AAC header */""",
    """    /* Opus: hand over the encoder's real header so players skip the right lead-in (the default skip is 80 ms).
       AAC: the muxer writes its own header (iPhone's encoder metadata made silent files). */
    chunks.forEach((c,i)=>R.muxer.addAudioChunkRaw(c.data,c.type,c.ts,c.dur,(i===0&&aCfg.mux==='opus'&&chunks.meta)?chunks.meta:undefined));""")
rep("""    finishRecording(new Blob([R.target.buffer],{type:'video/mp4'}));
  }catch(e){""", """    const outBlob=new Blob([R.target.buffer],{type:'video/mp4'});
    finishRecording(outBlob); verifyTake(outBlob,R);
  }catch(e){""")
rep("""/* ---------- sync check""", """/* ---------- recording self-check: decode the file just made and line its sound up with the song ---------- */
function encKey(){return 'rs-enccomp-'+(aCfg&&aCfg.codec||'x')}
function encComp(){try{return +(localStorage.getItem(encKey())||0)||0}catch(e){return 0}}
async function verifyTake(blob,R){
  try{
    if(!buf)return;
    const ab=await blob.arrayBuffer(); const dec=await new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej));
    const SR=8000, take=dec.getChannelData(0), tsr=dec.sampleRate, song=buf.getChannelData(0), ssr=buf.sampleRate;
    const t0=0.2, t1=Math.min(4.2,dec.duration-0.3); if(t1-t0<1.2)return;
    const n=Math.floor((t1-t0)*SR), x=new Float32Array(n);
    for(let i=0;i<n;i++)x[i]=take[Math.floor((t0+i/SR)*tsr)]||0;
    const ref=lag=>{const r=new Float32Array(n);const base=R.offset;  /* compare with where the song SHOULD be, not where we told the encoder */for(let i=0;i<n;i++){const st=base+(t0+i/SR)*R.ar+lag;r[i]=song[Math.floor(st*ssr)]||0}return r};
    let best={lag:0,c:-1}; const nx=Math.hypot(...x.subarray(0,Math.min(n,4000)))>0?1:0;
    for(let ms=-250;ms<=250;ms+=2){const r=ref(ms/1000);let dot=0,a2=0,b2=0;for(let i=0;i<n;i+=2){dot+=x[i]*r[i];a2+=x[i]*x[i];b2+=r[i]*r[i]}const c=dot/Math.sqrt(a2*b2+1e-12);if(c>best.c)best={lag:ms,c}}
    for(let ms=best.lag-2;ms<=best.lag+2;ms++){const r=ref(ms/1000);let dot=0,a2=0,b2=0;for(let i=0;i<n;i++){dot+=x[i]*r[i];a2+=x[i]*x[i];b2+=r[i]*r[i]}const c=dot/Math.sqrt(a2*b2+1e-12);if(c>best.c)best={lag:ms,c}}
    const info=$('#takeInfo'); if(!nx||best.c<0.5){return}
    if(window.__rs)window.__rs.lastVerify=best;
    if(Math.abs(best.lag)<=12){info.textContent+=' · sound checked: lines up (±'+Math.abs(best.lag)+' ms)';return}
    const comp=encComp()-best.lag/1000/R.ar; try{localStorage.setItem(encKey(),String(comp))}catch(e){}
    info.textContent+=' · sound was '+Math.abs(best.lag)+' ms '+(best.lag>0?'early':'late')+' in this file; fixed for your next takes on this phone. Record again for a tight take.';
  }catch(e){}
}

/* ---------- sync check""")

# ------------------------------------------------------------------ pre-roll: start the next move invisibly just before the cut
rep("""  e.playbackRate=rateAt(g,g.s); e.muted=true;
  if(e.readyState<2){
    const p=e.play(); if(p)p.then(()=>{if(e!==v){e.pause();e.currentTime=g.s}}).catch(()=>{});
  } else {
    try{e.pause()}catch(_){}
    if(Math.abs(e.currentTime-g.s)>0.03)e.currentTime=g.s;
  }
  S.primed={i,el:e};""", """  /* park it a little before the move's first frame; it starts playing (hidden) that long before the cut */
  const pre=Math.min(S.preroll||0.12,Math.max(0,g.s)), park=g.s-pre*rateAt(g,g.s);
  e.playbackRate=rateAt(g,g.s); e.muted=true;
  if(e.readyState<2){
    const p=e.play(); if(p)p.then(()=>{if(e!==v){e.pause();e.currentTime=park}}).catch(()=>{});
  } else {
    try{e.pause()}catch(_){}
    if(Math.abs(e.currentTime-park)>0.03)e.currentTime=park;
  }
  S.primed={i,el:e,park,pre,started:false};""")
rep("""  if(P&&P.i===i&&P.el!==v&&(S.playing||S.rec)&&P.el.readyState>=2&&!P.el.seeking&&Math.abs(P.el.currentTime-g.s)<0.06){
    swapTo(P.el,g.src); S.switchPending=false; primeNext(); return;
  }""", """  if(P&&P.i===i&&P.el!==v&&(S.playing||S.rec)&&P.el.readyState>=2&&!P.el.seeking&&P.el.currentTime>=g.s-0.06&&P.el.currentTime<g.s+0.15){
    swapTo(P.el,g.src); S.switchPending=false; S.cutAt=performance.now(); primeNext(); return;
  }""")
rep("""      if(g&&!S.switchPending&&v.currentTime>=g.e-0.02){
        if(S.stopAtT!=null&&routineOn()&&segStart(S.segIdx+1,segs())>=S.stopAtT-0.02)pause(); else atSegEnd();
      }""", """      /* pre-roll: start the next move (hidden) its measured start-up time before the cut */
      const P=S.primed;
      if(P&&!P.started&&g&&!S.switchPending&&P.el.readyState>=2&&!P.el.seeking){
        const left=(g.e-v.currentTime)/Math.max(0.2,v.playbackRate);
        if(left<=P.pre+0.01){P.started=true;P.t0=performance.now();const pp=P.el.play();
          const mark=()=>{if(P.t0){const lat=(performance.now()-P.t0)/1000;S.preroll=clamp(0.7*(S.preroll||0.12)+0.3*lat,0.04,0.4);P.t0=0}};
          if(P.el.requestVideoFrameCallback)P.el.requestVideoFrameCallback(mark);else if(pp)pp.then(mark).catch(()=>{})}
      }
      /* at the cut, wait (briefly) until the pre-rolled move reaches its first frame */
      const waitNext=P&&P.started&&P.el.currentTime<P.park+P.pre*0.6&&(performance.now()-(P.t0||0))<300&&P.i===S.segIdx+1;
      if(g&&!S.switchPending&&v.currentTime>=g.e-0.02&&!waitNext){
        if(S.stopAtT!=null&&routineOn()&&segStart(S.segIdx+1,segs())>=S.stopAtT-0.02)pause(); else atSegEnd();
      }""")
rep("""  if(!S.switchPending&&!v.seeking&&!a.seeking)S.driftEma=0.85*(S.driftEma||0)+0.15*drift;
  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&now-S.lastFix>1500;""", """  /* ignore the half second after a cut: the new move is still settling */
  const afterCut=now-(S.cutAt||0)<600;
  if(!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut)S.driftEma=0.85*(S.driftEma||0)+0.15*drift;
  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut&&now-S.lastFix>1500;""")

# ------------------------------------------------------------------ the song's own start-up delay: fix it in the first moments of playback
rep("""  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut&&now-S.lastFix>1500;""",
    """  const settled=!S.switchPending&&!v.seeking&&!a.seeking&&!afterCut&&now-S.lastFix>1500;
  /* just after pressing play the song often starts late; nudging it now (while it is only just starting) can't be heard */
  if(now-(S.playAt||0)<900&&Math.abs(drift)>0.03&&!a.seeking&&a.readyState>=3&&!S.switchPending&&now-(S.earlyFix||0)>200){S.earlyFix=now;S.driftEma=0;a.currentTime=e;return}""")
rep("""function play(){
  if(S.hasV&&broken(v))""", """function play(){
  S.playAt=performance.now();
  if(S.hasV&&broken(v))""")

# ------------------------------------------------------------------ predictive song seeks: aim ahead by this phone's measured seek/start delay
rep("""function setRate(r){if(Math.abs(a.playbackRate-r)>0.002)a.playbackRate=r}""",
"""function setRate(r){if(Math.abs(a.playbackRate-r)>0.002)a.playbackRate=r}
/* Moving the song makes it pause briefly while it seeks, so it lands late. Aim ahead by this phone's delay,
   check ~0.4 s later where it actually is, and learn. */
try{const sl=localStorage.getItem('rs-seeklead');if(sl!=null)S.seekLead=+sl}catch(e){}
function songLead(){return S.seekLead==null?0.06:S.seekLead}
function seekSong(e){a.currentTime=Math.max(0,e+songLead()*S.ar);S.seekCheck={at:performance.now()}}""")
rep("""  if(a.paused){a.currentTime=e;setRate(S.ar);a.play().catch(songFail);return}
  setRate(S.ar);
  const drift=a.currentTime-e, now=performance.now();
  if(force){S.lastFix=now;S.driftEma=0;a.currentTime=e;return}""",
"""  if(a.paused){seekSong(e);setRate(S.ar);a.play().catch(songFail);return}
  setRate(S.ar);
  const drift=a.currentTime-e, now=performance.now();
  if(S.seekCheck&&now-S.seekCheck.at>400&&!a.seeking&&!S.switchPending&&!v.seeking&&a.readyState>=3){
    S.seekLead=clamp(songLead()-0.8*drift/S.ar,0,0.4); S.seekCheck=null;
    try{localStorage.setItem('rs-seeklead',String(S.seekLead))}catch(err){}
    if(Math.abs(drift)>0.03){S.lastFix=now;S.driftEma=0;seekSong(e);return}
  }
  if(force){S.lastFix=now;S.driftEma=0;seekSong(e);return}
  if(S.seekCheck)return;   /* wait until the last move has landed */""")
rep("""now-(S.earlyFix||0)>200){S.earlyFix=now;S.driftEma=0;a.currentTime=e;return}""",
    """now-(S.earlyFix||0)>200){S.earlyFix=now;S.driftEma=0;seekSong(e);return}""")
rep("""||(Math.abs(S.driftEma)>0.08&&settled)){S.lastFix=now;S.driftEma=0;a.currentTime=e}""",
    """||(Math.abs(S.driftEma)>0.08&&settled)){S.lastFix=now;S.driftEma=0;seekSong(e)}""")
rep("""    if(S.hasV)a.currentTime=e;""", """    if(S.hasV)seekSong(e);""")

# ------------------------------------------------------------------ calm beat display, clear tracking, tap to check
rep(""".note{font-size:13px;""", """/* beat lights: Off / Calm / Flash */
body.bv-off #pulses{display:none!important}
body.bv-calm .beats i{transition:background .35s ease,color .35s ease,border-color .35s ease}
body.bv-calm .beats.d i.on{background:color-mix(in srgb,var(--dance) 35%,var(--sunk));border-color:var(--dance);color:var(--ink)}
body.bv-calm .beats.s i.on{background:color-mix(in srgb,var(--song-hot) 35%,var(--sunk));border-color:var(--song-hot);color:var(--ink)}
.beats.unsure i{border-style:dashed;opacity:.5}
.beats.unsure b::after{content:" ?"}
#songCard.cleared .row>:not(#beatFind),#songCard.cleared .warnlist,#songCard.cleared .hint.ear{display:none}
#songCard:not(.cleared) #beatFind{display:none}
.okmsg{color:var(--ok)!important}
.note{font-size:13px;""")
rep("""      <section class="panel" id="p-tempo" role="tabpanel" aria-labelledby="t-tempo" hidden>
""", """      <section class="panel" id="p-tempo" role="tabpanel" aria-labelledby="t-tempo" hidden>
        <div class="field">
          <div class="subhead"><span class="label">Beat lights</span>
            <div class="seg" id="bvSeg" role="group" aria-label="Beat lights" style="grid-template-columns:repeat(3,auto)">
              <button data-bv="off" aria-pressed="false" style="padding:0 12px">Off</button>
              <button data-bv="calm" aria-pressed="true" style="padding:0 12px">Calm</button>
              <button data-bv="flash" aria-pressed="false" style="padding:0 12px">Flash</button>
            </div></div>
          <p class="hint">Calm shows the count under the video without flashing the frame. When the app isn't sure of a beat, its lights go dim with a "?", and they never flash.</p>
        </div>
""")
rep("""          <button class="btn ghost" id="tClear">Clear both</button>""",
    """          <div class="row" style="gap:6px"><button class="btn ghost" id="tClear">Clear both</button><button class="btn ghost" id="tAll">Clear all tracking</button></div>""")
rep("""            <label class="check"><input type="checkbox" id="clickOn"> Click on each beat</label>
          </div>""", """            <label class="check"><input type="checkbox" id="clickOn"> Click on each beat</label>
          </div>
          <div class="row">
            <button class="btn sm" id="beatCheck">Tap to check</button>
            <button class="btn sm" id="beatOne">This is the 1</button>
            <button class="btn ghost sm" id="beatClear">Clear beat</button>
            <button class="btn sm" id="beatFind">Find the beat again</button>
          </div>
          <p class="hint" id="beatCheckMsg"></p>""")
rep("""          <p class="hint">Turn on the click and play: if the clicks don't sit on the kick""", """          <p class="hint ear">Turn on the click and play: if the clicks don't sit on the kick""")
rep("""          <ul class="warnlist" id="danceWarn"></ul>
        </div>""", """          <ul class="warnlist" id="danceWarn"></ul>
          <div class="row" id="hitRow" hidden><button class="btn sm" id="hitCheck">Tap to check</button><button class="btn ghost sm" id="hitClear">Clear hits</button></div>
          <p class="hint" id="hitCheckMsg"></p>
        </div>""")

# song meta keeps the dancer's decisions
rep("""function songMeta(so){return so?{name:so.name,key:so.key,fname:so.fname,size:so.size,forceBpm:so.forceBpm||null,beatShift:so.beatShift||0}:null}""",
"""function songMeta(so){return so?{name:so.name,key:so.key,fname:so.fname,size:so.size,forceBpm:so.forceBpm||null,beatShift:so.beatShift||0,
  confirmed:!!so.confirmed,oneAt:so.oneAt??null,cleared:!!so.cleared}:null}""")
rep("""    forceBpm:meta&&meta.forceBpm||null,beatShift:meta&&meta.beatShift||0,an:null};""",
"""    forceBpm:meta&&meta.forceBpm||null,beatShift:meta&&meta.beatShift||0,an:null,
    confirmed:!!(meta&&meta.confirmed),oneAt:meta&&meta.oneAt!=null?meta.oneAt:null,cleared:!!(meta&&meta.cleared)};""")
# analysis: apply the dancer's "1", don't apply a cleared beat, run follow-ups
rep("""      so.an=an;
    }catch(e){so.an=null}
    if(so===S.mainSong){if(apply)S.beatSrc='detected';if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
    renderSongCard(); scheduleFit();""", """      setOne(so,an);
      so.an=an;
    }catch(e){so.an=null}
    if(so===S.mainSong&&!so.cleared){if(apply)S.beatSrc='detected';if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
    renderSongCard(); scheduleFit();
    if(so._after){const f=so._after;so._after=null;f()}""")
rep("""  if(so.an&&so.an.beats.length>4)return {beats:so.an.beats,down:so.an.downbeats,bpm:so.an.bpm};
  return null;""", """  if(so.cleared)return null;
  if(so.an&&so.an.beats.length>4)return {beats:so.an.beats,down:so.an.downbeats,bpm:so.an.bpm};
  return null;""")
rep("""  if(!so||!so.an){card.hidden=!(so&&so.ready&&!so.an&&so.buf);if(!card.hidden){$('#songDet').textContent='Finding the beat…'}return}
  card.hidden=false; const an=so.an;""", """  if(!so||!so.an){card.hidden=!(so&&so.ready&&!so.an&&so.buf);if(!card.hidden){$('#songDet').textContent='Finding the beat…'}return}
  card.hidden=false; const an=so.an;
  card.classList.toggle('cleared',!!so.cleared);
  if(so.cleared){$('#songDet').textContent='Beat tracking cleared';return}""")
rep("""  if(an.contrast<0.6)warn('Beats barely stand out from the rest of the track, so beat positions may be off.');""",
"""  if(!so.confirmed&&an.conf>=0.5&&(an.phaseConf??1)<0.2)warn("Not sure whether the beat is here or half a beat later (the kick doesn't settle it). Tap to check, or listen with the click.");""")
rep("""  $('#songDet').textContent=an.bpm.toFixed(1)+' BPM · '+Math.round(an.conf*100)+'% sure'+(S.beatSrc==='tapped'?' · using your taps':'');""",
"""  $('#songDet').textContent=an.bpm.toFixed(1)+' BPM · '+(so.confirmed?'checked by your taps ✓':songSure()?'sure':'not sure')+(S.beatSrc==='tapped'?' · using your taps':'');""")
rep("""  if(an.downConf<0.15)warn("Not sure which beat is the 1 of the bar.");""",
"""  if(an.downConf<0.15&&so.oneAt==null)warn('Not sure which beat is the 1 of the bar. Press "This is the 1" on a 1 while it plays.');""")
# dance card: show check/clear when there are hits
rep("""  const m=n.motion; info.textContent=m.beats.length+' hits found in '+n.name+' · dance tempo about '+m.bpm.toFixed(0)+' BPM.';""",
"""  const m=n.motion; info.textContent=m.beats.length+' hits found in '+n.name+' · dance tempo about '+m.bpm.toFixed(0)+' BPM'+(m.confirmed?' · checked by your taps ✓':danceSure()?'':' · not sure')+'.';
  $('#hitRow').hidden=false;""")
rep("""  if(!n){info.textContent='Add a dance video first.';return}""", """  $('#hitRow').hidden=true; $('#hitLevelRow').hidden=true;
  if(!n){info.textContent='Add a dance video first.';return}""")
rep("""  if(m.contrast<0.55)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');
  if(m.cam>0.8)warn('The camera moves a lot. Camera motion is removed, but strong pans can hide hits.');""",
"""  if(m.contrast<0.6)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');
  if((m.shake||0)>=0.6)warn('The camera shakes, which makes stops hard to tell from wobble. Hits from this clip are less reliable: prop the phone up if you can.');
  else if(m.cam>0.8)warn('The camera moves a lot. Camera motion is removed, but strong pans can hide hits.');""")
# lights: setting + confidence gate
rep("""  dLights.forEach((l,i)=>l.classList.toggle('on',i===d.idx));
  sLights.forEach((l,i)=>l.classList.toggle('on',i===s.idx));
  stage.classList.toggle('pulse-d',d.pulse);
  stage.classList.toggle('pulse-s',s.pulse);""", """  const bv=S.beatView, sOk=songSure(), dOk=danceSure();
  dBeatsEl.classList.toggle('unsure',!dOk); sBeatsEl.classList.toggle('unsure',!sOk);
  dLights.forEach((l,i)=>l.classList.toggle('on',bv!=='off'&&i===d.idx));
  sLights.forEach((l,i)=>l.classList.toggle('on',bv!=='off'&&i===s.idx));
  stage.classList.toggle('pulse-d',bv==='flash'&&dOk&&d.pulse);
  stage.classList.toggle('pulse-s',bv==='flash'&&sOk&&s.pulse);""")
rep("""const dLights=$$('#dBeats i'), sLights=$$('#sBeats i'), stage=$('#stage');""",
    """const dLights=$$('#dBeats i'), sLights=$$('#sBeats i'), stage=$('#stage'), dBeatsEl=$('#dBeats'), sBeatsEl=$('#sBeats');""")

rep("""/* ---------- dance hits (motion beats) ---------- */""", r"""/* ---------- trust, beat lights setting, clearing, tap to check ---------- */
function songSure(){
  if(S.beatSrc==='tapped')return true;
  const so=S.mainSong; if(!so||!so.an||so.cleared)return !!S.sBase;
  if(so.confirmed)return true;
  return so.an.conf>=0.5&&(so.an.phaseConf??1)>=0.2;
}
function danceSure(){
  if(S.danceSrc!=='detected')return true;
  const n=srcById(S.cur), m=n&&n.motion; if(!m)return true;
  if(m.confirmed)return true;
  return (m.contrast??1)>=0.6&&(m.shake||0)<0.6;
}
function setBeatView(v0,save){
  S.beatView=v0; document.body.classList.remove('bv-off','bv-calm','bv-flash'); document.body.classList.add('bv-'+v0);
  $$('#bvSeg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bv===v0)));
  if(save)try{localStorage.setItem('rs-beatview',v0)}catch(e){}
}
(()=>{let v0=null;try{v0=localStorage.getItem('rs-beatview')}catch(e){}
  if(!['off','calm','flash'].includes(v0)){let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}v0=rm?'off':'calm'}
  setBeatView(v0,false)})();
$$('#bvSeg button').forEach(b=>b.addEventListener('click',()=>setBeatView(b.dataset.bv,true)));
/* the dancer's "1": downbeats are every 4th beat counting from the beat nearest to where they pressed */
function setOne(so,an){
  if(!so||!an||so.oneAt==null||!an.beats.length)return;
  let bi=0;an.beats.forEach((t,i)=>{if(Math.abs(t-so.oneAt)<Math.abs(an.beats[bi]-so.oneAt))bi=i});
  an.downbeats=an.beats.filter((t,i)=>(i-bi)%4===0); an.downConf=1;
}
const bMsg=(t,ok)=>{const m=$('#beatCheckMsg');m.textContent=t||'';m.classList.toggle('okmsg',!!ok)};
const hMsg=(t,ok)=>{const m=$('#hitCheckMsg');m.textContent=t||'';m.classList.toggle('okmsg',!!ok)};
function clearBeat(so,quiet){
  if(!so)return; so.cleared=true; so.confirmed=false; so.oneAt=null;
  if(so===S.mainSong&&S.beatSrc!=='tapped')clearSong();
  if(!quiet)bMsg('Beat tracking cleared: no beat grid, lights, click or fit for this song. Tap a tempo in the Tempo tab, or find the beat again.');
  renderSongCard(); updateMatch(); scheduleFit();
}
$('#beatClear').addEventListener('click',()=>clearBeat(S.mainSong));
$('#beatFind').addEventListener('click',()=>{const so=S.mainSong;if(!so)return;so.cleared=false;bMsg('');analyzeSongObj(so,true)});
function clearHits(n,quiet){
  if(!n)return; n.motion=null;
  if(n.id===S.cur&&S.danceSrc==='detected')clearDance();
  if(!quiet)hMsg('Hits cleared for this clip. Moves from it no longer count toward the fit or alignment.');
  renderDance(); renderMoves(); updateMatch(); scheduleFit();
}
$('#hitClear').addEventListener('click',()=>clearHits(srcById(S.cur)));
$('#tAll').addEventListener('click',()=>{
  [S.mainSong,S.rtSong].forEach(so=>{if(so)clearBeat(so,true)});
  S.sources.forEach(n=>{n.motion=null});
  S.seq.forEach(x=>{delete x.warp;delete x.warpR}); if(S.rt)S.rt.alignOn=false;
  clearDance(); clearSong(); S.beatSrc='detected'; S.danceSrc=null;
  bMsg('');hMsg('');renderSongCard();renderDance();renderMoves();updateTrim();updateMatch();scheduleFit();
  const m=$('#verdict'); if(m)m.textContent='Tracking cleared';
});
/* collect taps against a media element's clock; resets after a 2 s pause */
function tapLog(){let t=[];return {add(x){if(t.length&&(x<t[t.length-1]||x-t[t.length-1]>2))t=[];t.push(x);if(t.length>16)t.shift();return t.slice()},reset(){t=[]}}}
const songTaps=tapLog(), hitTaps=tapLog();
const circMean=fr=>{let c=0,s2=0;for(const f of fr){c+=Math.cos(2*Math.PI*f);s2+=Math.sin(2*Math.PI*f)}return Math.atan2(s2,c)/(2*Math.PI)};
function judgeSongTaps(so,T,round){
  const iv=[];for(let i=1;i<T.length;i++)iv.push(T[i]-T[i-1]); const per=RA.median(iv), tapBpm=60/per;
  const G=so.an&&!so.cleared?{beats:so.an.beats,bpm:so.an.bpm}:null;
  const useTaps=why=>{S.beatSrc='tapped';S.sBase=+tapBpm.toFixed(2);S.sAnchor=T[0];$('#sBpm').value=S.sBase.toFixed(1);so.confirmed=false;
    bMsg(why+' Your tapped tempo ('+tapBpm.toFixed(1)+' BPM) is used instead.',true);renderSongCard();updateMatch();scheduleFit()};
  if(!G){useTaps('There was no detected beat.');return}
  const r=tapBpm/G.bpm;
  if(Math.abs(r-1)<0.06){
    const p=60/G.bpm, fr=T.map(t=>{let b=G.beats[0];for(const x of G.beats)if(Math.abs(x-t)<Math.abs(b-t))b=x;return (t-b)/p});
    const ph=circMean(fr), miss=RA.median(fr.map(f=>Math.abs(f-ph)))*p*1000;
    if(Math.abs(ph)<=0.2){so.confirmed=true;bMsg('✓ Your taps match the beat (typical difference '+Math.round(Math.abs(ph)*p*1000)+' ms, your own spread '+Math.round(miss)+' ms).',true);renderSongCard();scheduleFit();return}
    if(Math.abs(ph)>=0.3&&round<2){so.beatShift=so.beatShift?0:0.5;so.confirmed=false;S.beatSrc='detected';so._after=()=>{so.confirmed=true;bMsg('Your taps were half a beat away from the detected beat, so the beat moved to where you tapped ✓',true);renderSongCard()};analyzeSongObj(so,true);return}
    bMsg('Your taps land between the beat and the "and". Try again, tapping on the kick drum.');return;
  }
  if(round<2){
    const near=[G.bpm*2,G.bpm/2].concat((so.an.candidates||[]).map(c=>c.bpm)).filter(b=>Math.abs(b/tapBpm-1)<0.06);
    if(near.length){so.forceBpm=+near[0].toFixed(2);so.beatShift=0;so.confirmed=false;S.beatSrc='detected';bMsg('Your taps say about '+tapBpm.toFixed(0)+' BPM, so the beat is being found again at that tempo…');
      so._after=()=>judgeSongTaps(so,T,round+1);analyzeSongObj(so,true);return}
  }
  useTaps('The detected tempo ('+G.bpm.toFixed(1)+') doesn\'t match your taps.');
}
$('#beatCheck').addEventListener('click',()=>{
  const so=S.mainSong; if(!so)return;
  if(!S.hasA||a.paused){songTaps.reset();bMsg('Press play, then tap this button on every beat (on the kick). 6 taps is enough.');return}
  const T=songTaps.add(a.currentTime);
  if(T.length<6){bMsg('Keep tapping… '+T.length+' of 6');return}
  songTaps.reset(); judgeSongTaps(so,T,0);
});
$('#beatOne').addEventListener('click',()=>{
  const so=S.mainSong; if(!so)return;
  if(!S.hasA||a.paused){bMsg('Press play, then press "This is the 1" right on a 1 (the start of a bar).');return}
  so.oneAt=a.currentTime;
  if(so.an&&!so.cleared){setOne(so,so.an);if(S.beatSrc!=='tapped')applyDetectedBeat(so)}
  else if(S.beatSrc==='tapped')S.sAnchor=a.currentTime;
  bMsg('The 1 is set ✓',true); renderSongCard(); scheduleFit();
});
$('#hitCheck').addEventListener('click',()=>{
  const n=srcById(S.cur); if(!n||!n.motion)return;
  if(routineOn()||v.paused){hitTaps.reset();hMsg('Play this clip (Clip mode), then tap this button on each hit. 6 taps is enough.');return}
  const T=hitTaps.add(v.currentTime);
  if(T.length<6){hMsg('Keep tapping on the hits… '+T.length+' of 6');return}
  hitTaps.reset();
  const H=hitsOf(n).map(b=>b.t), near=T.filter(t=>H.some(h=>Math.abs(h-t)<0.12)).length, fr=near/T.length;
  if(fr>=0.7){n.motion.confirmed=true;hMsg('✓ '+near+' of '+T.length+' taps landed on a detected hit.',true)}
  else{n.motion.confirmed=false;hMsg('Only '+near+' of '+T.length+' taps landed near a detected hit, so the hits for this clip may be off. You can clear them, or tap the dance tempo in the Tempo tab instead.')}
  renderDance(); scheduleFit();
});

/* ---------- dance hits (motion beats) ---------- */""")

# app analysis now uses the dancer-region detector
rep("""    let W=80,H=80,prev=null,series=[],done=false,lastT=-1;
    const finish=()=>{if(done)return;done=true;try{ve.pause()}catch(e){}ve.remove();
      const res=series.length>10?RA.analyzeMotion(series):null; resolve(res)};""",
"""    let W=80,H=80,prev=null,series=[],done=false,lastT=-1;
    const finish=()=>{if(done)return;done=true;try{ve.pause()}catch(e){}ve.remove();
      let res=null;try{res=series.length>10?RA.analyzeMotionVecs(series,W,H):null}catch(e){res=null}
      series=[];prev=null;try{ve.removeAttribute('src');ve.load()}catch(e){}   /* free the frames and the decoder before anything else plays */
      resolve(res)};""")
rep("""      if(prev){const dg=RA.directogram(RA.flowPyr(prev,g,W,H,8));series.push({t,D:dg.D,cam:dg.cam,mag:dg.mag})}""",
"""      if(prev){const fv=RA.flowVecs(prev,g,W,H,8),pk=new Float32Array(fv.length*4);fv.forEach((q,i)=>{pk[4*i]=q[0];pk[4*i+1]=q[1];pk[4*i+2]=q[2];pk[4*i+3]=q[3]});series.push({t,p:pk})}""")

# ------------------------------------------------------------------ mark your own hits, delete single hits, one hit per move
rep(""".okmsg{color:var(--ok)!important}""", """.okmsg{color:var(--ok)!important}
.hitstrip.edit{height:22px;cursor:pointer;touch-action:manipulation}
#hitLevel{grid-template-columns:repeat(3,auto)}
#hitLevel button{padding:0 10px}
.bigtap{min-height:64px;font:700 20px var(--f-body);width:100%;background:var(--dance);color:#fff;border-color:var(--dance);border-radius:12px}
.bigtap:active{transform:scale(.98)}""")
rep("""          <div class="row" id="hitRow" hidden><button class="btn sm" id="hitCheck">Tap to check</button><button class="btn ghost sm" id="hitClear">Clear hits</button></div>""",
"""          <div class="row" id="hitRow" hidden><button class="btn sm" id="hitCheck">Tap to check</button><button class="btn ghost sm" id="hitClear">Clear hits</button></div>
          <div class="subhead" id="hitLevelRow" hidden><span class="label">Hits per move</span>
            <div class="seg" id="hitLevel" role="group" aria-label="How many hits to show">
              <button data-hl="fewer" aria-pressed="false">Fewer</button><button data-hl="normal" aria-pressed="true">Normal</button><button data-hl="more" aria-pressed="false">More</button></div></div>
          <div class="row"><button class="btn sm" id="hitMark">Mark hits myself</button><button class="btn ghost sm" id="hitUndo" hidden>Undo</button></div>
          <button class="btn bigtap" id="hitTap" hidden>Hit</button>""")
rep("""const bMsg=(t,ok)=>{""", r"""/* ---- hits shown: a move often has two stops close together (feet land, then the arms hit). Merge stops closer than
   part of a beat into the strongest. Hits you marked are always kept, and detected ones right next to them are dropped. ---- */
function beatPer(){const G=liveGrid();return G&&G.bpm?60/G.bpm:0.48}
function hitCfg(){return {fewer:[0.9,0.35],normal:[0.65,0.25],more:[0,0.18]}[S.hitLevel||'normal']||[0.65,0.25]}
function mergeGap(){const c=hitCfg();return c[0]?Math.max(0.2,c[0]*beatPer()):0}
function hitsOf(n){
  if(!n||!n.motion)return [];
  const all=n.motion.beats, mine=all.filter(b=>b.mine), p=beatPer();
  const cfg=hitCfg();
  let det=all.filter(b=>!b.mine&&b.w>=cfg[1]&&!mine.some(m=>Math.abs(m.t-b.t)<0.15));
  if(cfg[0])det=RA.mergeHits(det,Math.max(0.2,cfg[0]*p));
  return det.concat(mine).sort((x,y)=>x.t-y.t);
}
function setHitLevel(l,save){S.hitLevel=l;$$('#hitLevel button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hl===l)));if(save)try{localStorage.setItem('rs-hitlevel',l)}catch(e){}}
try{const l=localStorage.getItem('rs-hitlevel');setHitLevel(['fewer','normal','more'].includes(l)?l:'normal',false)}catch(e){setHitLevel('normal',false)}
$$('#hitLevel button').forEach(b=>b.addEventListener('click',()=>{setHitLevel(b.dataset.hl,true);renderDance();renderMoves();scheduleFit();drawHitStrip()}));
/* ---- mark hits yourself: play the clip and tap on each hit; your taps replace the hits in the part you played ---- */
const TAP_LAT=0.03;   /* touch-to-event delay on phones, roughly */
let mark=null, undoStack=[];
function curVid(){return [...document.querySelectorAll('#stage video')].find(x=>!x.classList.contains('off'))||v}
function pushUndo(n){undoStack.push({id:n.id,motion:n.motion?JSON.parse(JSON.stringify(n.motion)):null});if(undoStack.length>20)undoStack.shift();$('#hitUndo').hidden=false}
function setMarkUI(on){$('#hitTap').hidden=!on;$('#hitMark').textContent=on?'Done marking':'Mark hits myself';$('#hitStrip').classList.toggle('edit',!on&&!!(srcById(S.cur)||{}).motion)}
$('#hitMark').addEventListener('click',()=>{
  const n=srcById(S.cur); if(!n||routineOn()){hMsg('Marking works on a single clip: switch to Clip mode first.');return}
  if(!mark){mark={n,taps:[],start:null};setMarkUI(true);hMsg('Press Hit on every hit while the clip plays. Only the part you play gets replaced.');if(curVid().paused)play();return}
  /* done */
  const m=mark; mark=null; setMarkUI(false); if(!curVid().paused)pause();
  if(m.taps.length<1){hMsg('No hits marked.');return}
  const end=m.end??m.taps[m.taps.length-1]+0.3, start=m.start;
  pushUndo(m.n);
  const old=m.n.motion&&m.n.motion.beats?m.n.motion.beats.filter(b=>b.t<start||b.t>end):[];
  const beats=old.concat(m.taps.map(t=>({t:+t.toFixed(3),w:1,mine:true}))).sort((x,y)=>x.t-y.t);
  const iv=[];for(let i=1;i<m.taps.length;i++)iv.push(m.taps[i]-m.taps[i-1]);
  m.n.motion=Object.assign({bpm:iv.length?60/RA.median(iv):0,conf:1,contrast:1,shake:0,cam:0},m.n.motion||{},{beats,confirmed:true,edited:true});
  hMsg('✓ '+m.taps.length+' hits marked by you between '+start.toFixed(1)+' s and '+end.toFixed(1)+' s.',true);
  renderDance(); renderMoves(); scheduleFit(); drawHitStrip();
});
$('#hitTap').addEventListener('pointerdown',e=>{
  e.preventDefault(); if(!mark)return; const vv=curVid();
  if(vv.paused){play();return}
  const t=Math.max(0,vv.currentTime-TAP_LAT*vv.playbackRate);
  if(mark.start==null)mark.start=Math.max(0,t-0.3);
  mark.taps.push(t); mark.end=t+0.3; hMsg(mark.taps.length+' marked… press Done marking when finished.');
  if(navigator.vibrate)try{navigator.vibrate(8)}catch(err){}
});
/* tap a tick on the strip under the video to remove that hit */
$('#hitStrip').addEventListener('click',e=>{
  const n=srcById(S.cur); if(mark||!n||!n.motion||routineOn())return;
  const r=e.currentTarget.getBoundingClientRect(), d=v.duration||0; if(!d)return;
  const t=(e.clientX-r.left)/r.width*d, tol=Math.max(0.12,14/r.width*d);
  const shown=hitsOf(n);let bi=-1,bd=1e9;shown.forEach((b,i)=>{const x=Math.abs(b.t-t);if(x<bd){bd=x;bi=i}});
  if(bi<0||bd>tol){hMsg('Tap right on a blue tick to remove that hit.');return}
  pushUndo(n); const gone=shown[bi], g=gone.mine?0.001:Math.max(0.12,mergeGap());
  /* a detected hit stands for the stops merged into it, so remove those too (otherwise the next one pops up) */
  n.motion.beats=n.motion.beats.filter(b=>b===gone?false:gone.mine?true:(b.mine||Math.abs(b.t-gone.t)>=g)); n.motion.edited=true;
  hMsg('Removed the hit at '+gone.t.toFixed(2)+' s.'); renderDance(); renderMoves(); scheduleFit(); drawHitStrip();
});
$('#hitUndo').addEventListener('click',()=>{const u=undoStack.pop();if(!u)return;const n=srcById(u.id);if(n){n.motion=u.motion;renderDance();renderMoves();scheduleFit();drawHitStrip();hMsg('Undone.')}$('#hitUndo').hidden=!undoStack.length});
const bMsg=(t,ok)=>{""")
# marked hits draw a little taller so you can tell them apart; strip becomes editable when there are hits
rep("""  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of n.motion.beats)x.fillRect(b.t/d*w,h*0.5,dpr*1.5,h*0.5)}""",
"""  if(n&&n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n))x.fillRect(b.t/d*w-dpr,b.mine?h*0.25:h*0.5,dpr*2,b.mine?h*0.75:h*0.5)}
  c.classList.toggle('edit',!mark&&!!(n&&n.motion));""")
rep("""  $('#hitRow').hidden=false;""", """  $('#hitRow').hidden=false; $('#hitLevelRow').hidden=false;
  const shown=hitsOf(n); info.textContent=shown.length+' hits in '+n.name+(m.confirmed?' · checked by your taps ✓':danceSure()?'':' · not sure')+'.'+(m.edited?' Includes your own edits.':'')+' Tap a blue tick under the video to remove it.';""")

# ------------------------------------------------------------------ BPM you can use: best clip speed from the hits
rep("""        <p class="fitmini" id="clipFit"></p>""", """        <p class="fitmini" id="clipFit"></p>
        <div class="row" id="speedSug" hidden></div>""")
rep("""  drawHitStrip();
}
function tok(name)""", """  drawHitStrip(); suggestSpeed();
}
/* Try clip speeds from 60% to 160% (and nudging the song start by under half a beat) and keep the ones where the
   dance hits land closest to beats and "ands". Slight preference for speeds near 100%. */
function bestSpeeds(n,G){
  const H=hitsOf(n).filter(b=>b.t>=S.cIn&&b.t<=clipEnd());
  if(!G||H.length<4)return null;
  const tg=[];for(let i=0;i<G.beats.length;i++){tg.push(G.beats[i]);if(i<G.beats.length-1)tg.push((G.beats[i]+G.beats[i+1])/2)}
  const per=60/G.bpm, half=per/2, res=[];
  for(let vr=0.6;vr<=1.6001;vr+=0.005){
    let best=-1,bs=0;
    for(let sh=0;sh<half;sh+=0.01){let sc=0,ws=0;for(const b of H){const st=S.offset+((b.t-S.cIn)/vr)*S.ar+sh,d=RA.nearest(tg,st);sc+=b.w*Math.exp(-d*d/(2*0.05*0.05));ws+=b.w}sc/=ws;if(sc>best){best=sc;bs=sh}}
    res.push({vr:+vr.toFixed(3),fit:best,sh:bs,score:best*Math.exp(-Math.pow(Math.log(vr),2)/(2*0.5*0.5))});
  }
  res.sort((a,b)=>b.score-a.score);
  const pick=[];for(const r of res){if(pick.every(p=>Math.abs(Math.log(r.vr/p.vr))>0.1))pick.push(r);if(pick.length>=2)break}
  const now=res.find(r=>Math.abs(r.vr-S.vr)<0.003);
  return {pick,now};
}
let speedMemo={};
function suggestSpeed(){
  const box=$('#speedSug');
  if(S.playing||S.rec)return;   /* the search takes a few ms: never during playback or recording */
  const n=srcById(S.cur), G=liveGrid();
  if(!S.hasV||routineOn()||!n||!n.motion||!G){box.hidden=true;box.dataset.sig='';return}
  const key=[n.id,hitsOf(n).length,S.hitLevel,S.cIn,clipEnd(),S.vr,S.offset,S.ar,G.bpm,G.beats.length].join('|');
  const r=speedMemo.key===key?speedMemo.r:(speedMemo={key,r:bestSpeeds(n,G)}).r;
  if(!r||!r.pick.length){box.hidden=true;box.dataset.sig='';return}
  /* only rebuild when the suggestion changes, so a tap never lands on a button that was just replaced */
  const sig=r.pick.map(p=>p.vr+':'+Math.round(p.fit*100)+':'+p.sh.toFixed(2)).join('|')+'@'+S.vr.toFixed(3)+':'+S.offset.toFixed(3);
  if(box.dataset.sig===sig&&!box.hidden)return; box.dataset.sig=sig; box.textContent='';
  box.hidden=false;
  for(const p of r.pick){
    if(Math.abs(p.vr-S.vr)<0.01&&p.sh<0.02){box.append(el('span','hint','✓ '+Math.round(p.vr*100)+'% speed is already the best fit ('+Math.round(p.fit*100)+'%).'));continue}
    const b=el('button','btn sm',Math.round(p.vr*100)+'% speed · fit '+Math.round(p.fit*100)+'%');
    b.title='Sets the clip speed'+(p.sh>=0.02?' and moves the song start by '+Math.round(p.sh*1000)+' ms':'');
    b.addEventListener('click',()=>{setP(S.main,'vr',p.vr);if(p.sh>=0.02)setP(S.main,'offset',+(S.offset+p.sh).toFixed(3));scheduleFit()});
    box.append(b);
  }
  box.append(el('span','hint','Best clip speeds for this song, from where the hits land.'));
}
function tok(name)""")

# ------------------------------------------------------------------ MirrorView: entry points and media hand-off (installed app only)
rep(""".okmsg{color:var(--ok)!important}""", """.okmsg{color:var(--ok)!important}
.mv-only{display:none!important}
html.rs-hosted .mv-only{display:revert!important}""")
rep("""      <button class="btn sm ghost" id="projBtn" aria-haspopup="dialog">Projects</button>""",
"""      <button class="btn sm ghost mv-only" id="mvBtn" title="Pose tracking, Worldline, Pulse and practice">MirrorView</button>
      <button class="btn sm ghost" id="projBtn" aria-haspopup="dialog">Projects</button>""")
rep("""          <div class="row"><button class="btn sm" id="hitMark">Mark hits myself</button>""",
"""          <div class="row mv-only"><button class="btn sm" id="mvClip">Study this clip in MirrorView</button></div>
          <div class="row"><button class="btn sm" id="hitMark">Mark hits myself</button>""")
rep("""          <button class="btn" id="discardBtn">Discard</button>""",
"""          <button class="btn" id="discardBtn">Discard</button>
          <button class="btn mv-only" id="mvTake">Practise in MirrorView</button>""")
rep("""/* ---------- dance hits (motion beats) ---------- */
let ANALYZE_RATE""", r"""/* ---------- MirrorView hand-off ----------
   MirrorView lives at ./mirrorview/ in the same installed app (same origin and storage). A clip or take is left in
   IndexedDB 'riddim-bridge' and MirrorView opens it through its own Load video path, then deletes it. */
if(window.RS_HOSTED)document.documentElement.classList.add('rs-hosted');
function bridgeDb(){return new Promise((res,rej)=>{const r=indexedDB.open('riddim-bridge',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('handoff'))r.result.createObjectStore('handoff',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function handOff(kind,blob,name,meta){
  const db=await bridgeDb(), id='h'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  await new Promise((res,rej)=>{const t=db.transaction('handoff','readwrite'),st=t.objectStore('handoff');st.clear();st.put({id,v:1,from:'riddim-swap',kind,name,blob,meta:meta||null,created:Date.now()});t.oncomplete=res;t.onerror=()=>rej(t.error)});
  db.close(); return id;
}
async function goMirror(id){
  pause(); try{await autosave(true)}catch(e){}
  location.href='mirrorview/'+(id?'?handoff='+encodeURIComponent(id):'')+(/debug/.test(location.hash)?'#debug':'');
}
$('#mvBtn').addEventListener('click',()=>goMirror(null));
/* the clip, its hits and its body tracking (so MirrorView shows the same dance body without tracking again) */
async function sendClip(){
  const n=srcById(S.cur);
  if(!n||n.missing||!n.blob){hMsg('Add this video again first: its file isn’t loaded on this phone.');return false}
  const B=bodyOf(n);
  try{const id=await handOff('clip',n.blob,n.fname||n.name||'clip.mp4',{trim:[S.cIn,clipEnd()],hits:(n.motion&&hitsOf(n).map(b=>b.t))||null,
      body:B?{v:B.v,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:B.data}:null});goMirror(id);return true}
  catch(e){hMsg('Couldn’t pass the clip to MirrorView on this phone ('+(e&&e.message||e)+').');return false}
}
$('#mvClip').addEventListener('click',sendClip);
/* coming back from MirrorView's bottom bar: open the section that was tapped there */
function takeTabReq(){let r=null;try{r=localStorage.getItem('rs-tab-req');localStorage.removeItem('rs-tab-req')}catch(e){}const t=r&&document.getElementById(r);if(t&&t.getAttribute('role')==='tab')t.click()}
window.addEventListener('pageshow',takeTabReq); setTimeout(takeTabReq,0);
$('#t-body').addEventListener('click',()=>{const n=srcById(S.cur);if(n&&!n.missing&&n.blob&&!routineOn())sendClip();else goMirror(null)});
$('#mvTake').addEventListener('click',async()=>{
  if(!take)return;
  const G=routineOn()?songGrid(routineSong()):liveGrid();
  try{const id=await handOff('take',take.blob,'Riddim Swap take '+new Date().toISOString().slice(0,16).replace('T',' ')+'.'+take.ext,{songBpm:G&&G.bpm||null});goMirror(id)}
  catch(e){saveMsg('Couldn’t pass the take to MirrorView ('+(e&&e.message||e)+').',true)}
});

/* ---------- dance hits (motion beats) ---------- */
let ANALYZE_RATE""")

# ------------------------------------------------------------------ dance body: tracking on every frame, drawing, hits from the body
rep(""".hitstrip.edit{""", """.bodycv{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}
.bodyrow{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.hitstrip.edit{""")
rep("""          <div class="recdot" id="recDot" hidden>Recording</div>""", """          <canvas class="bodycv" id="bodyCanvas" aria-hidden="true"></canvas>
          <div class="recdot" id="recDot" hidden>Recording</div>""")
rep("""          <div class="row mv-only"><button class="btn sm" id="mvClip">Study this clip in MirrorView</button></div>""",
"""          <div class="bodyrow mv-only" id="bodyRow">
            <button class="btn sm" id="bodyTrack" disabled>Track body</button>
            <label class="check"><input type="checkbox" id="bodyShow" checked> Show body</label>
            <label class="check"><input type="checkbox" id="hipShow" checked> Hip path</label>
          </div>
          <div class="prog" id="bodyProg" hidden><i></i></div>
          <p class="hint mv-only" id="bodyInfo">Track body follows the dancer on every frame (pelvis, hips, feet and hands) and draws it over the video. It plays the clip through once, silently.</p>
          <div class="row mv-only"><button class="btn sm" id="mvClip">Study this clip in MirrorView</button></div>""")
rep("""    for(const k of keys||[])if(!keep.has(k))await mediaDel(k);""", """    for(const k of keys||[])if(!keep.has(k)&&!(String(k).startsWith('body:')&&keep.has(String(k).slice(5))))await mediaDel(k);""")
rep("""/* ---------- MirrorView hand-off ----------""", r"""/* ---------- dance body ---------- */
function srcOfEl(el){return S.sources.find(x=>x.el===el||x.el2===el)}
function bodyOf(n){
  if(!n||!n.key)return null;
  if(n.body===undefined){n.body=null;mediaGet('body:'+n.key).then(b=>{if(b&&b.data&&b.n){n.body=b;renderDance()}}).catch(()=>{})}
  return n.body;
}
try{const v0=localStorage.getItem('rs-body');if(v0==='0')$('#bodyShow').checked=false;const h0=localStorage.getItem('rs-hip');if(h0==='0')$('#hipShow').checked=false}catch(e){}
$('#bodyShow').addEventListener('change',e=>{try{localStorage.setItem('rs-body',e.target.checked?'1':'0')}catch(err){}});
$('#hipShow').addEventListener('change',e=>{try{localStorage.setItem('rs-hip',e.target.checked?'1':'0')}catch(err){}});
const bodyCv=$('#bodyCanvas'); let bodyDrawn=false;
function drawBody(){
  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=$('#bodyShow').checked&&!!B;
  if(!on){if(bodyDrawn){const c=bodyCv.getContext('2d');c.clearRect(0,0,bodyCv.width,bodyCv.height);bodyDrawn=false}return}
  const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}
  const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);
  RB.draw(c,B,el.currentTime,RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h),{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked});
  bodyDrawn=true;
}
/* hits from the body: stops and turns of the limbs and hips (RA.analyzePose); your own marked hits are kept */
function hitsFromBody(n){
  const B=bodyOf(n); if(!B)return false;
  const m=RA.analyzePose(RB.framesOf(B)); if(!m||m.beats.length<3)return false;
  const mine=n.motion&&n.motion.beats?n.motion.beats.filter(b=>b.mine):[];
  if(n.motion&&n.motion.source!=='pose')n.motionImg=n.motion;
  n.motion=Object.assign(m,{beats:m.beats.concat(mine).sort((a,b)=>a.t-b.t),edited:mine.length>0,source:'pose',confirmed:false});
  return true;
}
$('#bodyTrack').addEventListener('click',async()=>{
  const n=srcById(S.cur); if(!n||n.missing||!n.url||S.bodyBusy)return;
  S.bodyBusy=true; $('#bodyTrack').disabled=true; $('#bodyProg').hidden=false; const bar=$('#bodyProg i'); bar.style.width='0';
  $('#bodyInfo').textContent='Loading the body tracker (first time needs a connection)…';
  try{
    const B=await RB.track(n.url,{onProgress:p=>{bar.style.width=Math.round(p*100)+'%';$('#bodyInfo').textContent='Tracking the body on every frame… '+Math.round(p*100)+'%'}});
    n.body=B; if(n.key)mediaPut('body:'+n.key,B).catch(()=>{});
    const got=hitsFromBody(n);
    $('#bodyInfo').textContent=`Body tracked on ${B.seen} of ${B.n} frames`+(B.missed?` (${B.missed} skipped while playing)`:'')+(got?'. Hits now come from the body.':'.');
    if(got&&n.id===S.cur&&(!S.dBase||S.danceSrc!=='tapped')){S.dBase=+n.motion.bpm.toFixed(1);S.danceSrc='detected';$('#dBpm').value=S.dBase.toFixed(1)}
  }catch(e){$('#bodyInfo').textContent='Body tracking didn’t run: '+((e&&e.message)||e)}
  finally{S.bodyBusy=false;$('#bodyProg').hidden=true;enable();renderDance();renderMoves();updateMatch();scheduleFit();drawHitStrip()}
});

/* ---------- MirrorView hand-off ----------""")
rep("""  $('#recBtn').disabled=!(hv&&S.hasA&&buf);""", """  $('#recBtn').disabled=!(hv&&S.hasA&&buf);
  {const bn=srcById(S.cur);$('#bodyTrack').disabled=!(bn&&!bn.missing&&bn.url)||!!S.bodyBusy;$('#bodyTrack').textContent=bn&&bodyOf(bn)?'Track again':'Track body'}""")
rep("""  clickTick();
  let d={idx:-1,pulse:false}, s={idx:-1,pulse:false};""", """  clickTick(); drawBody();
  let d={idx:-1,pulse:false}, s={idx:-1,pulse:false};""")

rep("""  if(S.analyzing)return; w.textContent='';""", """  if(S.analyzing)return; w.textContent='';
  {const B=n&&bodyOf(n);if(!S.bodyBusy)$('#bodyInfo').textContent=B?`Body tracked on ${B.seen} of ${B.n} frames.`+(n.motion&&n.motion.source==='pose'?' Hits come from the body.':''):'Track body follows the dancer on every frame (pelvis, hips, feet and hands) and draws it over the video. It plays the clip through once, silently.'}""")

# ------------------------------------------------------------------ Sound System: the shared look with MirrorView
rep("""family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap""",
    """family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap""")
rep("""\n</style>""", """
/* ===== Sound System: the look shared with MirrorView. Dark stage; blue = the dancer, amber = the music, magenta = the hips. ===== */
:root{--bg:#0E1014!important;--surface:#171A21!important;--sunk:#20242D!important;--ink:#F3F1EC!important;--muted:#A3A9B6!important;--line:#2C313C!important;
  --dance:#6E8BFF!important;--song:#FFB547!important;--song-hot:#FFB547!important;--hips:#FF5FA2!important;
  --ok:#4FD1A1!important;--warn:#FF9466!important;--bad:#FF6B6B!important;--stage:#08090C!important;--on-stage:#F3F1EC!important;
  --f-body:"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif!important;--f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace!important;color-scheme:dark}
body{font-size:16px}
h1 span{color:var(--song)}
.panel{border-radius:18px;padding:16px}
.stage{border-radius:18px}
.btn{border-radius:12px;min-height:44px;padding:8px 14px;font:600 15px var(--f-body)}
.btn.sm{min-height:38px;padding:6px 12px;font:600 14px var(--f-body);border-radius:10px}
.btn.primary{background:var(--ink);color:var(--bg)}
.btn.rec{background:#E5484D;color:#fff}
.btn.on{background:var(--ink);color:var(--bg)}
.seg{border-radius:999px;background:var(--bg)}
.seg button{border-radius:999px}
.seg button[aria-pressed="true"]{background:var(--dance);color:#0E1014;box-shadow:none}
.anal,.fitcard{background:var(--surface);border-color:var(--line);border-radius:18px}
.subhead h3,.anal h3,.fitcard h3{font-size:19px;font-weight:800}
.chip-src.on button{color:#0E1014}
.cand.on{background:var(--song);color:#0E1014;border-color:var(--song)}
.tabs{--ntabs:5;grid-template-columns:repeat(var(--ntabs),minmax(0,1fr))}
html.rs-hosted .tabs{--ntabs:6}
html.rs-hosted .tab.mv-only,html.rs-hosted .bodyrow.mv-only{display:flex!important}
#t-clip,#t-moves,#t-routine{--tabc:var(--dance)} #t-song,#t-tempo{--tabc:var(--song)} #t-body{--tabc:var(--hips)}
/* phones: the section tabs become a bottom bar, the same bar MirrorView shows */
@media (max-width:860px){
  html.rs-hosted #mvBtn{display:none!important}   /* the Body tab opens MirrorView on phones */
  body{padding-bottom:calc(86px + env(safe-area-inset-bottom,0px))}
  .tabs{position:fixed;left:0;right:0;bottom:0;z-index:40;border-radius:0;border:0;border-top:1px solid var(--line);background:var(--bg);padding:6px 4px calc(10px + env(safe-area-inset-bottom,0px));gap:0}
  .tab{flex-direction:column;gap:5px;font:600 12px var(--f-body);min-height:52px;background:transparent!important;box-shadow:none!important;border-radius:0;padding:4px 2px}
  .tab .dot{display:none}
  .tab::before{content:"";width:24px;height:4px;border-radius:2px;background:transparent}
  .tab[aria-selected="true"]{color:var(--ink);font-weight:700}
  .tab[aria-selected="true"]::before{background:var(--tabc,var(--dance))}
}
</style>""")
rep("""        <button class="tab" role="tab" id="t-routine" aria-controls="p-routine" aria-selected="false" tabindex="-1">Routine</button>""",
"""        <button class="tab" role="tab" id="t-routine" aria-controls="p-routine" aria-selected="false" tabindex="-1">Routine</button>
        <button class="tab mv-only" id="t-body" type="button" title="Body tracking, Worldline and practice (MirrorView)">Body</button>""")

# body-tracked hits: their own trust rule and wording
rep("""  if(m.confirmed)return true;
  return (m.contrast??1)>=0.6&&(m.shake||0)<0.6;""", """  if(m.confirmed)return true;
  if(m.source==='pose')return (m.seen??1)>=0.8;   /* body tracking: sure when the dancer was found on most frames */
  return (m.contrast??1)>=0.6&&(m.shake||0)<0.6;""")
rep("""  warn('Hits come from image motion, not body tracking: footwork hidden from the camera or below the frame can be missed.');""",
"""  if(m.source==='pose'){if((m.seen??1)<0.8)warn('The dancer was only found on '+Math.round((m.seen||0)*100)+'% of frames (out of shot, covered, or several people), so some hits may be missing.');
    warn('Hits come from body tracking (stops and turns of the hips, feet and hands). Fast spins or a second dancer in front can still confuse it, so check them or mark your own.')}
  else warn('Hits come from image motion, not body tracking: footwork hidden from the camera or below the frame can be missed. Track body for better hits.');""")
rep("""  if(m.contrast<0.6)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');""",
    """  if(m.source!=='pose'&&m.contrast<0.6)warn('Hits are hard to see: the dancer may be small in frame, lit poorly, or moving smoothly.');""")

# ------------------------------------------------------------------ clearer, friendlier: quick controls on the video, person cut-out, get started
rep(""".bodycv{position:absolute;""", """.dock{position:absolute;left:8px;right:8px;bottom:8px;z-index:4;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-start;pointer-events:none}
.dock button{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);
  background:rgba(14,16,20,.78);color:#F3F1EC;font:700 14px var(--f-body);cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.dock button svg{width:18px;height:18px;flex:0 0 auto}
.dock button[aria-pressed="true"]{background:var(--dance);border-color:var(--dance);color:#0E1014}
.dock button.hips[aria-pressed="true"]{background:var(--hips);border-color:var(--hips)}
.dock button.cut[aria-pressed="true"]{background:#F3F1EC;border-color:#F3F1EC}
.dock button:disabled{opacity:.45}
.dock .bgpick{display:inline-flex;gap:4px;pointer-events:auto;align-items:center;background:rgba(14,16,20,.78);border-radius:999px;padding:4px;border:1px solid rgba(255,255,255,.14)}
.dock .bgpick button{min-height:32px;width:32px;padding:0;justify-content:center;border-radius:50%}
.dock .bgpick button[aria-pressed="true"]{outline:2px solid #F3F1EC;outline-offset:1px}
html.rs-hosted .dock.mv-only{display:flex!important}
html.rs-hosted .mv-only[hidden]{display:none!important}
.start{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 16px;display:grid;gap:10px}
.start h2{font-family:var(--f-display);font-size:20px;font-weight:800;margin:0}
.start ol{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.start li{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:600}
.start li .n{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:700 15px var(--f-mono);background:var(--sunk);border:1px solid var(--line);flex:0 0 auto}
.start li.done{color:var(--muted)} .start li.done .n{background:var(--ok);border-color:var(--ok);color:#0E1014}
.start li.done .n{font-size:0}.start li.done .n::after{content:'\\2713';font-size:17px}
.start li.next .n{background:var(--song);border-color:var(--song);color:#0E1014}
.start li .go{margin-left:auto}
.bodycv{position:absolute;""")
rep("""          <canvas class="bodycv" id="bodyCanvas" aria-hidden="true"></canvas>""",
"""          <canvas class="bodycv" id="bodyCanvas" aria-hidden="true"></canvas>
          <div class="dock mv-only" id="dock" hidden>
            <button type="button" id="dkBody" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4" r="2.4" fill="currentColor"/><path d="M10 7v6M10 13l-3 5M10 13l3 5M5 9.5l5-1.5 5 1.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>Body</span></button>
            <button type="button" class="hips" id="dkHips" aria-pressed="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11c2-5 5 4 7 0s5-5 7 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg><span>Hips</span></button>
            <button type="button" class="cut" id="dkCut" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="15" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="15" cy="15" r="2.6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6.8 13.2L15 3M13.2 13.2L5 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Cut out</span></button>
            <span class="bgpick" id="dkBg" hidden role="group" aria-label="Background behind the dancer">
              <button type="button" data-bg="dark" aria-label="Dark background" aria-pressed="true" style="background:#08090C"></button>
              <button type="button" data-bg="colour" aria-label="Colour background" aria-pressed="false" style="background:#2B2F6B"></button>
              <button type="button" data-bg="blur" aria-label="Blurred background" aria-pressed="false" style="background:linear-gradient(135deg,#6b6f78,#2a2d33)"></button>
            </span>
          </div>""")
rep("""      <div class="tabs" role="tablist" aria-label="Settings">""", """      <section class="start" id="startCard" hidden aria-labelledby="h-start">
        <h2 id="h-start">Let’s make a remix</h2>
        <ol>
          <li id="st1"><span class="n">1</span><span>Add a dance video</span><label class="btn sm go file">Choose<input type="file" id="stVid" accept="video/*" hidden></label></li>
          <li id="st2"><span class="n">2</span><span>Add a song</span><label class="btn sm go file">Choose<input type="file" id="stSong" accept="audio/*,video/*" hidden></label></li>
          <li id="st3"><span class="n">3</span><span>Press play and watch them together</span><button class="btn sm go" id="stPlay" type="button">Play</button></li>
        </ol>
      </section>
      <div class="tabs" role="tablist" aria-label="Settings">""")
rep("""/* ---------- MirrorView hand-off ----------""", r"""/* ---------- quick controls on the video ---------- */
S.cutOn=false; S.cutBg='dark'; try{S.everPlayed=localStorage.getItem('rs-played')==='1'}catch(e){}
try{S.cutBg=localStorage.getItem('rs-cutbg')||'dark'}catch(e){}
function dockUpdate(){
  const n=srcById(S.cur), B=n&&bodyOf(n), show=!!(S.hasV&&window.RS_HOSTED);
  $('#dock').hidden=!show; if(!show)return;
  const bb=$('#dkBody');
  if(S.bodyBusy){bb.querySelector('span').textContent='Tracking '+(S.bodyPct||0)+'%'+(S.bodyLeft?' · '+S.bodyLeft.replace('about ','').replace(' left',''):'');bb.setAttribute('aria-pressed','false');bb.disabled=true}
  else{bb.disabled=false;bb.querySelector('span').textContent=B?'Body':'Track body';bb.setAttribute('aria-pressed',String(!!B&&$('#bodyShow').checked))}
  $('#dkHips').hidden=!B; $('#dkHips').setAttribute('aria-pressed',String($('#hipShow').checked));
  const canCut=!!(B&&RB.hasCutout(B)); $('#dkCut').hidden=!canCut; $('#dkCut').setAttribute('aria-pressed',String(canCut&&S.cutOn));
  $('#dkBg').hidden=!(canCut&&S.cutOn); $$('#dkBg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.bg===S.cutBg)));
}
$('#dkBody').addEventListener('click',()=>{const n=srcById(S.cur);if(!n)return;
  if(!bodyOf(n)){$('#bodyTrack').click();return}
  $('#bodyShow').checked=!$('#bodyShow').checked;$('#bodyShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkHips').addEventListener('click',()=>{$('#hipShow').checked=!$('#hipShow').checked;$('#hipShow').dispatchEvent(new Event('change'));dockUpdate()});
$('#dkCut').addEventListener('click',()=>{S.cutOn=!S.cutOn;dockUpdate()});
$$('#dkBg button').forEach(b=>b.addEventListener('click',()=>{S.cutBg=b.dataset.bg;try{localStorage.setItem('rs-cutbg',S.cutBg)}catch(e){}dockUpdate()}));
/* get started: three steps for a new project */
function startUpdate(){
  const v=!!S.hasV, so=!!S.mainSong, played=!!S.everPlayed, card=$('#startCard');
  card.hidden=(v&&so&&played)||!!S.seq.length;
  $('#st1').className=v?'done':'next'; $('#st2').className=so?'done':(v?'next':''); $('#st3').className=played?'done':(v&&so?'next':'');
  $('#st1 .go').hidden=v; $('#st2 .go').hidden=so; $('#stPlay').hidden=!(v&&so)||played;
}
$('#stVid').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$('#vidFile').files=dt.files;$('#vidFile').dispatchEvent(new Event('change',{bubbles:true}));e.target.value=''});
$('#stSong').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);$('#audFile').files=dt.files;$('#audFile').dispatchEvent(new Event('change',{bubbles:true}));e.target.value=''});
$('#stPlay').addEventListener('click',()=>{if(!S.playing)$('#play').click()});
/* keep the card and the dock right even when nothing is playing (the tick only runs with media) */
startUpdate();setInterval(()=>{try{startUpdate();dockUpdate()}catch(e){}},700);

/* ---------- MirrorView hand-off ----------""")
# the cut-out goes under the dance body on the same canvas
rep("""  const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);
  RB.draw(c,B,el.currentTime,""", """  const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);
  const rect=RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h);
  if(S.cutOn&&RB.hasCutout(B))RB.cutout(c,B,el.currentTime,el,rect,{bg:S.cutBg,colour:'#2B2F6B'});
  if($('#bodyShow').checked)RB.draw(c,B,el.currentTime,""")
rep("""  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=$('#bodyShow').checked&&!!B;""",
    """  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;""")
rep("""    const B=await RB.track(n.url,{onProgress:p=>{bar.style.width=Math.round(p*100)+'%';$('#bodyInfo').textContent='Tracking the body on every frame… '+Math.round(p*100)+'%'}});""",
    """    const B=await RB.track(n.url,{onProgress:p=>{S.bodyPct=Math.round(p*100);bar.style.width=S.bodyPct+'%';$('#bodyInfo').textContent='Tracking the body on every frame… '+S.bodyPct+'%';dockUpdate()}});""")
rep("""      body:B?{v:B.v,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:B.data}:null});goMirror(id);return true}""",
    """      body:B?{v:B.v,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,data:B.data,mask:B.mask||null,world:B.world||null,hips:B.hips||null,multi:B.multi||0}:null});goMirror(id);return true}""")
rep("""  clickTick(); drawBody();""", """  clickTick(); drawBody(); if(S.playing&&!S.everPlayed){S.everPlayed=true;try{localStorage.setItem('rs-played','1')}catch(e){}} if(++dockTick%15===0){dockUpdate();startUpdate()}""")
rep("""const bodyCv=$('#bodyCanvas'); let bodyDrawn=false;""","""const bodyCv=$('#bodyCanvas'); let bodyDrawn=false, dockTick=0;""")

exec(compile(pathlib.Path(__file__).with_name('speed_block.py').read_text(),'speed_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('motion_block.py').read_text(),'motion_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('hips_block.py').read_text(),'hips_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('take_block.py').read_text(),'take_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('backup_block.py').read_text(),'backup_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('audio_block.py').read_text(),'audio_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('session_block.py').read_text(),'session_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('sync_block.py').read_text(),'sync_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('perf_block.py').read_text(),'perf_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('hipbeat_block.py').read_text(),'hipbeat_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('study_block.py').read_text(),'study_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('recbody_block.py').read_text(),'recbody_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('share_block.py').read_text(),'share_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('compare_block.py').read_text(),'compare_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('patterns_block.py').read_text(),'patterns_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('compat_block.py').read_text(),'compat_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('storage_block.py').read_text(),'storage_block.py','exec'))
exec(compile(pathlib.Path(__file__).with_name('report_block.py').read_text(),'report_block.py','exec'))
P.write_text(s)
print('patched', len(s))
