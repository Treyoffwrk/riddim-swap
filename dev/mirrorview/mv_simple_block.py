# ---- clearer controls and a cut-out that works ----------------------------------------------------------------------
# 1. The shared body tracker (Riddim Swap's body.js) is loaded here too, so MirrorView can track a clip itself.
# 2. Person cut-out from prepared masks: Riddim Swap's tracking pass also outputs a person mask for every frame. MirrorView
#    used to get a cut-out only from live tracking, which stops once poses are prepared, so the cut-out fell back to the
#    full video. Now each drawn frame's cut-out is built from the prepared mask for that frame.
# 3. Quick controls on the video: See-through (overlay opacity), Body, Cut out, Mirror. Big, labelled, always visible.
BODY = (pathlib.Path(__file__).resolve().parents[1] / 'body.js') if (pathlib.Path(__file__).resolve().parents[1] / 'body.js').exists() else pathlib.Path('/home/claude/body.js')
body_src = BODY.read_text()
_first = s.index('<script>')
s = s[:_first] + '<script>\n' + body_src + '\n</script>\n' + s[_first:]

# per-frame cut-out from prepared masks, before the reference pose is chosen
rep("""  if(state.refCutout&&Math.abs(state.refCutoutTime-frameTime)>.35*Math.max(1,state.speed)){state.refCutout.close?.();state.refCutout=null;}
  state.referencePoseTime=frameTime;""",
    """  if(state.refCutout&&Math.abs(state.refCutoutTime-frameTime)>.35*Math.max(1,state.speed)){state.refCutout.close?.();state.refCutout=null;}
  preparedCutout(frameTime);
  state.referencePoseTime=frameTime;""")
# the Person cut-out switch uses the prepared masks when they exist (no live segmentation needed)
rep("""async function toggleMask(channel){""", """async function toggleMask(channel){
  if(channel==='reference'&&preparedReady()){state.maskRef=!state.maskRef;lastFrame.reference='';if(!state.maskRef){state.refCutout=null;}toast(state.maskRef?'Cut-out on: only the dancer shows.':'Cut-out off.');updateUI();return;}""")

PREP_JS = r"""
/* Riddim Swap integration: prepared body tracking (poses + person masks for every frame) */
let preparedBody=null, prepCut=null, prepCutCtx=null;
function preparedReady(){return !!(preparedBody&&preparedBody.key===state.key&&typeof RB!=='undefined'&&RB.hasCutout(preparedBody));}
function preparedCutout(t){
  if(!state.maskRef||!preparedReady()||refVideo.readyState<2)return;
  const k=RB.maskIndex(preparedBody,t);if(k<0){state.refCutout=null;return;}
  const vw=refVideo.videoWidth,vh=refVideo.videoHeight;if(!vw||!vh)return;
  const sc=Math.min(1,720/Math.max(vw,vh)),W=Math.round(vw*sc),H=Math.round(vh*sc);
  if(!prepCut){prepCut=document.createElement('canvas');prepCutCtx=prepCut.getContext('2d');}
  if(prepCut.width!==W||prepCut.height!==H){prepCut.width=W;prepCut.height=H;}
  prepCutCtx.globalCompositeOperation='source-over';prepCutCtx.clearRect(0,0,W,H);prepCutCtx.drawImage(refVideo,0,0,W,H);
  prepCutCtx.globalCompositeOperation='destination-in';prepCutCtx.imageSmoothingEnabled=true;prepCutCtx.imageSmoothingQuality='high';prepCutCtx.drawImage(RB.maskCanvas(preparedBody,k),0,0,W,H);
  prepCutCtx.globalCompositeOperation='source-over';
  state.refCutout=prepCut;state.refCutoutTime=t;
}
function usePreparedBody(B,label){
  const S=1+33*3,out=[];
  for(let i=0;i<B.n&&i<9000;i++){const o=i*S;const t=B.data[o];if(!Number.isFinite(t))continue;
    out.push({t,points:Number.isFinite(B.data[o+1])?Array.from({length:33},(_,j)=>({x:B.data[o+1+j*3],y:B.data[o+2+j*3],z:0,visibility:B.data[o+3+j*3]})):null});}
  if(out.length<3)return 0;
  preparedBody={...B,key:state.key};
  state.poseSamples=out;state.poseSamplesVisual=out;state.refPose=true;state.refDisplay='both';state.style='both';state.cacheVersion++;
  state.referenceAnalysis=`${out.filter(f=>f.points).length} / ${out.length} poses ${label} (every frame)`;
  try{persistReferencePoses();}catch(e){}
  const pm=$('pose-message');if(pm)pm.textContent=state.referenceAnalysis;updateUI();return out.length;
}
async function trackHere(onProgress){
  if(typeof RB==='undefined'||!state.source||state.demo)throw new Error('Load your own video first.');
  const B=await RB.track(state.source,{onProgress});
  return usePreparedBody(B,'tracked here');
}
"""
rep("function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){", PREP_JS + "function drawImageFit(ctx,img,area,alpha,mirror,fit='contain'){")

# quick controls on the video
DOCK_CSS = """
/* quick controls on the video: big, labelled, always visible */
.mv-dock{position:absolute;left:10px;right:10px;bottom:10px;z-index:30;display:flex;flex-wrap:wrap;gap:6px;align-items:center;pointer-events:none}
.mv-dock>*{pointer-events:auto}
.mv-dock button{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 13px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(14,16,20,.8);color:#F3F1EC;font:700 14px Figtree,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:none}
.mv-dock button[aria-pressed="true"]{background:#6E8BFF;border-color:#6E8BFF;color:#0E1014}
.mv-dock button.cut[aria-pressed="true"]{background:#F3F1EC;border-color:#F3F1EC;color:#0E1014}
.mv-dock button:disabled{opacity:.5}
.mv-dock svg{width:18px;height:18px}
.mv-see{display:flex;align-items:center;gap:8px;min-height:42px;padding:0 12px;border-radius:999px;background:rgba(14,16,20,.8);border:1px solid rgba(255,255,255,.14);color:#F3F1EC;font:700 14px Figtree,sans-serif;flex:1 1 180px;max-width:320px}
.mv-see input{flex:1;min-width:70px;accent-color:#6E8BFF}
.mv-see b{font:700 14px 'JetBrains Mono',monospace;min-width:42px;text-align:right}
body.practice-active .mv-dock{display:none!important}
/* the beat card moves to the top of the video so it never sits under the quick controls */
body:not(.distance-mode) #stage:has(#mv-dock:not([hidden])) .pulse-hud{top:54px;bottom:auto;left:10px;width:auto;padding:4px 12px;border-radius:999px}
body:not(.distance-mode) #stage:has(#mv-dock:not([hidden])) .pulse-hud .pulse-hud-title,body:not(.distance-mode) #stage:has(#mv-dock:not([hidden])) .pulse-hud .pulse-counts{display:none}
body:not(.distance-mode) #stage:has(#mv-dock:not([hidden])) .pulse-hud #pulse-current{font-size:22px}
/* a slider that reads at a glance: thick track, filled part in blue, big thumb */
.mv-see input[type=range]{-webkit-appearance:none;appearance:none;height:30px;min-height:30px;margin:0;background:transparent;border:0;padding:0}
.mv-see input[type=range]::-webkit-slider-runnable-track{height:8px;border-radius:8px;background:linear-gradient(90deg,#6E8BFF var(--fill,50%),#3A4050 var(--fill,50%))}
.mv-see input[type=range]::-moz-range-track{height:8px;border-radius:8px;background:#3A4050}
.mv-see input[type=range]::-moz-range-progress{height:8px;border-radius:8px;background:#6E8BFF}
.mv-see input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-8px;border-radius:50%;background:#F3F1EC;border:3px solid #6E8BFF;box-shadow:none}
.mv-see input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#F3F1EC;border:3px solid #6E8BFF}
"""
i = s.rfind('</style>')
s = s[:i] + DOCK_CSS + s[i:]
