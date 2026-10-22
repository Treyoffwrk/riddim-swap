# ---- hips you can read: hip meter on the video, Hip moves graph, choose which dancer to follow -------------------------
rep("""  if($('#bodyShow').checked)RB.draw(c,B,el.currentTime,RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h),{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked});""",
    """  if($('#bodyShow').checked)RB.draw(c,B,el.currentTime,RB.containRect(w,h,el.videoWidth||B.w,el.videoHeight||B.h),{dance:tok('--dance'),hips:tok('--hips'),hipPath:$('#hipShow').checked,meter:$('#hipShow').checked,tiltGuide:$('#hipShow').checked,reserveBottom:(($('#dock')&&!$('#dock').hidden)?$('#dock').getBoundingClientRect().height+20:0)*dpr});
  if(S.bodyPicking){c.save();c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);c.restore()}""")
# drawBody must also run while choosing, even before a body exists
rep("""  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;""",
    """  const el=curVid(), n=el&&srcOfEl(el), B=n&&bodyOf(n), on=($('#bodyShow').checked||S.cutOn)&&!!B;
  if(S.bodyPicking&&!on){const r=bodyCv.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(bodyCv.width!==w||bodyCv.height!==h){bodyCv.width=w;bodyCv.height=h}const c=bodyCv.getContext('2d');c.clearRect(0,0,w,h);c.fillStyle='rgba(8,9,12,.55)';c.fillRect(0,0,w,h);c.fillStyle='#F3F1EC';c.font=`800 ${Math.round(16*dpr)}px Figtree,sans-serif`;c.textAlign='center';c.fillText('Tap the dancer to follow',w/2,h/2);bodyDrawn=true;return}""")
# tracking takes the chosen dancer
rep("""    const B=await RB.track(n.url,{onProgress:p=>{""","""    const B=await RB.track(n.url,{pick:S.bodyPick&&S.bodyPick.src===n.id?S.bodyPick:null,onProgress:p=>{""")
rep("""    $('#bodyInfo').textContent=`Body tracked on ${B.seen} of ${B.n} frames`+(B.missed?` (${B.missed} skipped while playing)`:'')+(got?'. Hits now come from the body.':'.');""",
    """    $('#bodyInfo').textContent=bodyInfoText(n,B)+(got?' Hits now come from the body.':'');""")
rep("""  {const B=n&&bodyOf(n);if(!S.bodyBusy)$('#bodyInfo').textContent=B?`Body tracked on ${B.seen} of ${B.n} frames.`+(n.motion&&n.motion.source==='pose'?' Hits come from the body.':''):""",
    """  {const B=n&&bodyOf(n);if(!S.bodyBusy)$('#bodyInfo').textContent=B?bodyInfoText(n,B)+(n.motion&&n.motion.source==='pose'?' Hits come from the body.':''):""")

rep("""          <div class="prog" id="bodyProg" hidden><i></i></div>""",
"""          <div class="prog" id="bodyProg" hidden><i></i></div>
          <div class="row mv-only" id="pickRow"><button class="btn sm" id="bodyPick">Choose the dancer</button><span class="hint" id="pickMsg"></span></div>
          <section class="hipcard mv-only" id="hipCard" hidden aria-labelledby="h-hip">
            <div class="subhead"><h3 id="h-hip">Hip moves</h3><span class="hint" id="hipNow"></span></div>
            <div class="hipgraph"><canvas id="hipCanvas" role="img" aria-label="Hip tilt and sway over the clip"></canvas></div>
            <div class="hipkey"><span><i style="background:var(--hips)"></i>Tilt (up = right side higher)</span><span><i style="background:#F3F1EC"></i>Sway (up = hips to the right)</span><span><i style="background:var(--song)"></i>Beats</span></div>
            <p class="hint">Tap the graph to jump there. On the video, the pink bar is the hips, the dashed line is level, and the meter shows tilt, the hips' path under the chest (a whine draws a loop) and which way they face.</p>
          </section>""")

HIP_CSS = """
.hipcard{display:grid;gap:8px;border-top:1px solid var(--line);padding-top:10px}
.hipgraph{background:#14171D;border:1px solid var(--line);border-radius:12px;overflow:hidden;touch-action:pan-y}
.hipgraph canvas{display:block;width:100%;height:150px;cursor:pointer}
.hipkey{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--muted)}
.hipkey i{display:inline-block;width:14px;height:4px;border-radius:2px;margin-right:6px;vertical-align:middle}
html.rs-hosted #pickRow.mv-only{display:flex!important}
#bodyPick[aria-pressed="true"]{background:var(--hips);border-color:var(--hips);color:#0E1014}
"""
rep("""/* ===== Sound System: the look shared with MirrorView.""", HIP_CSS + """/* ===== Sound System: the look shared with MirrorView.""")

HIP_JS = r"""
/* ---------- hips you can read ---------- */
function bodyInfoText(n,B){
  let t=`Body tracked on ${B.seen} of ${B.n} frames.`;
  if(B.v<2)t+=' Tracked with the older tracker: Track again for steadier tracking, hip turn and following one dancer.';
  else if(B.multi&&B.multi>0.1*B.n)t+=` More than one person in ${Math.round(B.multi/B.n*100)}% of frames: following ${B.pick?'the dancer you chose':'the biggest one'}. Use "Choose the dancer" to follow someone else.`;
  if(B.clean&&B.clean.flips)t+=` Fixed ${B.clean.flips} left/right mix-up${B.clean.flips>1?'s':''}.`;
  return t;
}
/* choose the dancer: the next tap on the video picks who to follow, then tracking runs */
$('#bodyPick').addEventListener('click',()=>{
  if(S.bodyBusy)return; S.bodyPicking=!S.bodyPicking; $('#bodyPick').setAttribute('aria-pressed',S.bodyPicking);
  $('#pickMsg').textContent=S.bodyPicking?'Pause on a frame where you can see them, then tap them on the video.':'';
  if(S.bodyPicking&&S.playing)pause();
  if(S.bodyPicking)window.scrollTo({top:0,behavior:'smooth'});
});
$('#stage').addEventListener('pointerdown',e=>{
  if(!S.bodyPicking||e.target.closest('button,label,input'))return; e.preventDefault(); e.stopPropagation();
  const el=curVid(), n=el&&srcOfEl(el); if(!n)return;
  const r=bodyCv.getBoundingClientRect(), rect=RB.containRect(r.width,r.height,el.videoWidth,el.videoHeight);
  const x=(e.clientX-r.left-rect.x)/rect.w, y=(e.clientY-r.top-rect.y)/rect.h; if(x<0||x>1||y<0||y>1)return;
  S.bodyPick={src:n.id,t:el.currentTime,x,y}; S.bodyPicking=false; $('#bodyPick').setAttribute('aria-pressed','false');
  $('#pickMsg').textContent='Got it. Tracking that dancer…'; $('#bodyTrack').click();
},true);
/* the Hip moves graph: tilt and sway over the clip, the song's beats, the playhead */
function hipGraph(){
  const card=$('#hipCard'), n=srcById(S.cur), B=n&&bodyOf(n), show=!!(B&&S.hasV&&!routineOn()&&!$('#p-clip').hidden);
  card.hidden=!(B&&S.hasV); if(!show||card.offsetParent===null)return;
  const cv=$('#hipCanvas'),{w,h,dpr}=sizeCanvas(cv),x=cv.getContext('2d');x.clearRect(0,0,w,h);
  const d=v.duration||B.end||1, X=t=>t/d*w, pad=10*dpr, mid=h/2, amp=h/2-pad;
  const TILT=20, SWAY=0.35;
  x.strokeStyle='#2C313C';x.lineWidth=dpr;x.beginPath();x.moveTo(0,mid);x.lineTo(w,mid);x.stroke();
  x.fillStyle='#7C8494';x.font=`600 ${10*dpr}px JetBrains Mono,monospace`;x.textBaseline='top';x.fillText('+'+TILT+'°',4*dpr,4*dpr);x.textBaseline='bottom';x.fillText('−'+TILT+'°',4*dpr,h-4*dpr);
  const G=liveGrid();
  if(G){x.fillStyle=tok('--song');x.globalAlpha=.5;for(const b of G.beats){const t=S.cIn+((b-S.offset)/S.ar)*S.vr;if(t<0||t>d)continue;x.fillRect(X(t),0,dpr,6*dpr)}x.globalAlpha=1}
  if(n.motion){x.fillStyle=tok('--dance');for(const b of hitsOf(n))x.fillRect(X(b.t)-dpr,h-6*dpr,2*dpr,6*dpr)}
  const line=(k,scale,col,width)=>{x.strokeStyle=col;x.lineWidth=width;x.beginPath();let on=false;
    for(let i=0;i<B.n;i++){const t=B.data[i*RB.STRIDE];const H=RB.hipsAt(B,t);const val=H&&H[k];if(val==null){on=false;continue}
      const px=X(t),py=mid-Math.max(-1,Math.min(1,val/scale))*amp;if(!on){x.moveTo(px,py);on=true}else x.lineTo(px,py)}x.stroke()};
  line('sway',SWAY,'rgba(243,241,236,.7)',1.5*dpr); line('tilt',TILT,tok('--hips'),2.5*dpr);
  const px=X(v.currentTime);x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;x.beginPath();x.moveTo(px,0);x.lineTo(px,h);x.stroke();
  const H=RB.hipsAt(B,v.currentTime);
  $('#hipNow').textContent=H?('Tilt '+(H.tilt==null?'side-on':Math.abs(H.tilt)<3?'level':(H.tilt>0?'right ':'left ')+Math.round(Math.abs(H.tilt))+'° up')+(H.turn!=null?' · facing '+(Math.abs(H.turn)<15?'front':Math.abs(H.turn)>150?'away':(H.turn>0?'right':'left')):'')):'';
}
$('#hipCanvas').addEventListener('click',e=>{const n=srcById(S.cur),B=n&&bodyOf(n);if(!B||routineOn())return;const r=e.currentTarget.getBoundingClientRect();const t=(e.clientX-r.left)/r.width*(v.duration||1);if(S.playing)pause();S.segIdx=0;v.currentTime=Math.max(0,Math.min(v.duration||t,t));hipGraph()});
(function hipLoop(){try{hipGraph()}catch(e){}requestAnimationFrame(hipLoop)})();
"""
rep("""/* test hook: only with #debug in the address */""", HIP_JS + """/* test hook: only with #debug in the address */""")

# time left while tracking
rep("""onProgress:p=>{S.bodyPct=Math.round(p*100);bar.style.width=S.bodyPct+'%';$('#bodyInfo').textContent='Tracking the body on every frame… '+S.bodyPct+'%';dockUpdate()}""",
    """onProgress:p=>{if(!S.bodyT0)S.bodyT0={t:performance.now(),p};S.bodyPct=Math.round(p*100);bar.style.width=S.bodyPct+'%';S.bodyLeft=etaText(S.bodyT0,p);$('#bodyInfo').textContent='Tracking the body on every frame… '+S.bodyPct+'%'+(S.bodyLeft?' · '+S.bodyLeft:'');dockUpdate()}""")
rep("""  S.bodyBusy=true; $('#bodyTrack').disabled=true;""","""  S.bodyBusy=true; S.bodyT0=null; S.bodyLeft=''; $('#bodyTrack').disabled=true;""")
rep("""function bodyInfoText(n,B){""","""/* "about 1 min left": from the rate so far, once there is enough to go on */
function etaText(t0,p){if(!t0||p-t0.p<0.03)return '';const el=(performance.now()-t0.t)/1000,left=el*(1-p)/(p-t0.p);if(!isFinite(left)||left<0)return '';
  return left<45?'about '+Math.max(5,Math.round(left/5)*5)+' s left':'about '+Math.round(left/60)+' min left'}
function bodyInfoText(n,B){""")
