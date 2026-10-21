# ---- takes with the dance body (and cut-out) drawn on, for sharing ------------------------------------------------------
rep("""            <label class="check"><input type="checkbox" id="hipShow" checked> Hip path</label>""",
    """            <label class="check"><input type="checkbox" id="hipShow" checked> Hip path</label>
            <label class="check"><input type="checkbox" id="recBody"> Draw it on recorded takes</label>""")
RB_JS = r"""
/* ---------- the body on recorded takes ----------
   With "Draw it on recorded takes" on, each recorded frame gets what the stage shows: the cut-out (if on) and the dance
   body with its hips (if Body is on), drawn at the take's own resolution from the pose for that exact frame. */
try{if(localStorage.getItem('rs-recbody')==='1')$('#recBody').checked=true}catch(e){}
$('#recBody').addEventListener('change',e=>{try{localStorage.setItem('rs-recbody',e.target.checked?'1':'0')}catch(err){}});
function drawBodyOnTake(el,t){
  if(!$('#recBody').checked||!window.RB)return;
  const n=srcOfEl(el),B=n&&bodyOf(n);if(!B)return;
  const rect=RB.containRect(cv.width,cv.height,el.videoWidth||B.w,el.videoHeight||B.h);
  try{
    if(S.cutOn&&RB.hasCutout(B))RB.cutout(cx,B,t,el,rect,{bg:S.cutBg,colour:'#2B2F6B'});
    if($('#bodyShow').checked)RB.draw(cx,B,t,rect,{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked,meter:$('#hipShow').checked,tiltGuide:$('#hipShow').checked});
  }catch(e){}
}
"""
rep("""/* fallback recorder */""", RB_JS + """/* fallback recorder */""")
rep("""    drawFit(v);
    const f=new VideoFrame(cv,""","""    drawFit(v); drawBodyOnTake(v,mediaTime);
    const f=new VideoFrame(cv,""")
rep("""function drawFrame(){if(v.readyState>=2)drawFit(v)}""","""function drawFrame(){if(v.readyState>=2){drawFit(v);drawBodyOnTake(v,v.currentTime)}}""")
