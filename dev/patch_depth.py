"""Integrate beat analysis, motion beats, time-warp alignment, fit scoring and checks into riddim-swap.html."""
import pathlib
P = pathlib.Path('/home/claude/riddim-swap.html')
s = P.read_text()
analysis = pathlib.Path('/home/claude/analysis.js').read_text()

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
function motionIn(srcId,s,e){const n=srcById(srcId);return n&&n.motion?n.motion.beats.filter(b=>b.t>=s-0.001&&b.t<=e+0.001):null}
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
rep("""  if(!n){info.textContent='Add a dance video first.';return}""", """  $('#hitRow').hidden=true;
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
  const H=n.motion.beats.map(b=>b.t), near=T.filter(t=>H.some(h=>Math.abs(h-t)<0.12)).length, fr=near/T.length;
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

P.write_text(s)
print('patched', len(s))
