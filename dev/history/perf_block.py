# ---- draw only when something changed (a phone that works less stays cool and keeps the video and song smooth) -----------
rep("""(function hipLoop(){try{hipGraph()}catch(e){}requestAnimationFrame(hipLoop)})();""",
"""/* redraw only when what it shows changed; at most 15 times a second while playing */
let hipKey='';
(function hipLoop(){try{const n=srcById(S.cur),B=n&&bodyOf(n),c=$('#hipCanvas'),r=c.getBoundingClientRect();
  const k=[!!B,B&&B.n,B&&B.hips&&B.hips.length,S.cur,S.hasV,routineOn(),$('#p-clip').hidden,Math.round(r.width),Math.round(r.height),Math.round(v.currentTime*15),S.cIn,S.offset,S.ar,S.vr,n&&n.motion&&hitsOf(n).length,liveGrid()&&liveGrid().beats.length].join('|');
  if(k!==hipKey){hipKey=k;hipGraph()}}catch(e){}requestAnimationFrame(hipLoop)})();""")
rep("""(function spdLoop(){try{if(spdVisible()){spdDraw();spdNowText()}}catch(e){}requestAnimationFrame(spdLoop)})();""",
"""let spdKey='';
(function spdLoop(){try{if(spdVisible()){const n=spdCur(),c=$('#spdCanvas').getBoundingClientRect();
  const k=[SPD.ver,SPD.sel,n&&n.curve?JSON.stringify(n.curve):'',Math.round(c.width),Math.round(c.height),Math.round(v.currentTime*15),S.cIn,clipEnd(),S.vr,S.offset,S.ar,n&&n.motion&&hitsOf(n).length,liveGrid()&&liveGrid().beats.length].join('|');
  if(k!==spdKey){spdKey=k;spdDraw();spdNowText()}}}catch(e){}requestAnimationFrame(spdLoop)})();""")
# the body overlay: when paused and nothing changed, don't redraw every frame
rep("""function drawBody(){
  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;""",
"""let bodyKey='';
function drawBody(){
  {const el0=curVid(),r0=bodyCv.getBoundingClientRect();const k=[el0&&el0.currentTime,S.playing,S.bodyPicking,S.cutOn,S.cutBg,$('#bodyShow').checked,$('#hipShow').checked,Math.round(r0.width),Math.round(r0.height),S.cur,el0&&el0.videoWidth,(()=>{const q=el0&&srcOfEl(el0);return q&&q.body?q.body.n+':'+!!q.body.mask:0})(),S.bodyBusy].join('|');
   if(!S.playing&&k===bodyKey)return; bodyKey=k}
  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;""")

# the Hip moves lines read the stored measures directly (no lookup per point)
rep("""    for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE];const H=RB.hipsAt(B,t);const val=H&&H[k];if(val==null){on=false;continue}""",
    """    RB.hipsAt(B,0);const off={tilt:0,sway:2}[k];
    for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE];const val=B.hips[i*RB.HS+off];if(!(val===val)){on=false;continue}""")
