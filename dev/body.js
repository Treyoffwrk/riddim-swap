/*BODY-START*/
/* Riddim Swap dance body: pose tracking for fast dance (dancehall, Philly) and the dance-body drawing.
   Tracking: MediaPipe tasks-vision 0.10.18 (the same runtime MirrorView pins), pose_landmarker_full, IMAGE mode on every
   decoded frame of a clip ("prepared"), so there is no tracking lag and no frames thinned out. Each sample keeps the
   frame's own media time. Drawing looks up the pose for the exact frame on screen; nothing is filtered causally.
   Drawing: torso shape, a pelvis shape that tilts and turns, thick limbs, head, the hips' path relative to the chest
   (last second, scaled), and foot trails. */
(function(root){
  'use strict';
  const CFG={
    sdkURL:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs',
    wasmURL:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    modelURL:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    edge:640,         /* longest side of the image given to the tracker (the person crop is resized from this) */
    maskW:120         /* stored person-mask width (height follows the video's shape); ~25 KB a frame */
  };
  const N=33, STRIDE=1+N*3;   /* packed sample: t, then x,y,visibility for each landmark */
  let runtime=null, loading=null;

  async function load(){
    if(runtime)return runtime; if(loading)return loading;
    loading=(async()=>{
      const sdk=await import(CFG.sdkURL);
      const files=await sdk.FilesetResolver.forVisionTasks(CFG.wasmURL);
      const r=await fetch(CFG.modelURL); if(!r.ok)throw new Error('Body model download failed ('+r.status+')');
      const model=new Uint8Array(await r.arrayBuffer());
      /* person masks (segmentation) come from the same pass, for the cut-out */
      const opts=d=>({baseOptions:{modelAssetBuffer:model,delegate:d},canvas:document.createElement('canvas'),runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:true});
      let task,delegate=(root.RB_DELEGATE==='CPU')?'CPU':'GPU';   /* GPU on phones; RB_DELEGATE lets tests pick the CPU */
      try{task=await sdk.PoseLandmarker.createFromOptions(files,opts(delegate))}catch(e){delegate='CPU';task=await sdk.PoseLandmarker.createFromOptions(files,opts('CPU'))}
      runtime={task,delegate}; return runtime;
    })();
    try{return await loading}catch(e){loading=null;throw e}
  }

  /* Track every frame of a video. Steps through it frame by frame (seek, wait for that frame, track), so no frame is
     skipped however slow the phone is. Each sample keeps the frame's own media time. */
  async function track(url,opt){
    opt=opt||{}; const rt=await load();
    const v=document.createElement('video'); v.muted=true; v.playsInline=true; v.setAttribute('playsinline',''); v.preload='auto';
    v.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.append(v); v.src=url;
    const cleanup=()=>{try{v.pause()}catch(e){}v.removeAttribute('src');try{v.load()}catch(e){}v.remove()};
    try{
      await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error('This video could not be read for body tracking.'))});
      const W=v.videoWidth,H=v.videoHeight, sc=Math.min(1,CFG.edge/Math.max(W,H));
      const cv=document.createElement('canvas'); cv.width=Math.round(W*sc); cv.height=Math.round(H*sc); const cx=cv.getContext('2d',{willReadFrequently:false});
      const start=Math.max(0,opt.start||0), end=Math.min(v.duration||0,opt.end||v.duration||0);
      const hasRVFC=typeof v.requestVideoFrameCallback==='function';
      /* frame rate: play a moment and read the frame clock (falls back to 30) */
      let fps=opt.fps||0;
      if(!fps&&hasRVFC){const ts=[];await new Promise(res=>{let k=0;const cb=(now,m)=>{ts.push(m.mediaTime);if(++k<12)v.requestVideoFrameCallback(cb);else res()};v.requestVideoFrameCallback(cb);v.play().catch(res);setTimeout(res,1500)});v.pause();
        const d=[];for(let i=1;i<ts.length;i++)if(ts[i]>ts[i-1])d.push(ts[i]-ts[i-1]);d.sort((a,b)=>a-b);const md=d.length?d[d.length>>1]:1/30;fps=Math.min(60,Math.max(15,Math.round(1/md)))}
      fps=fps||30;
      const seekTo=t=>new Promise(res=>{let done=false;const fin=m=>{if(done)return;done=true;res(m)};
        if(hasRVFC)v.requestVideoFrameCallback((now,m)=>fin(m.mediaTime));
        v.addEventListener('seeked',()=>setTimeout(()=>fin(null),hasRVFC?120:30),{once:true});
        v.currentTime=t;});
      const rows=[], masks=[]; let ms=0, n=0, last=-1;
      const mw=CFG.maskW, mh=Math.max(8,Math.round(mw*H/W));
      const total=Math.max(1,Math.floor((end-start)*fps+1e-6)+1);
      for(let k=0;k<total;k++){
        if(opt.signal&&opt.signal.aborted)break;
        const want=start+(k+0.5)/fps; if(want>end)break;   /* aim at the middle of each frame's display interval */
        const mt=await seekTo(want); const t=mt!=null?mt:want-0.5/fps;
        if(t<=last+1e-4)continue; last=t;
        cx.drawImage(v,0,0,cv.width,cv.height);
        const s=performance.now(); let pts=null;
        let mk=null;
        rt.task.detect(cv,r=>{pts=r.landmarks&&r.landmarks[0]?r.landmarks[0]:null;
          /* the mask belongs to the callback: shrink it to mw×mh bytes (area average) before returning */
          const m=r.segmentationMasks&&r.segmentationMasks[0];
          if(m&&pts){try{const src=m.getAsFloat32Array(),sw=m.width,sh=m.height;mk=new Uint8Array(mw*mh);
            for(let y=0;y<mh;y++){const y0=Math.floor(y*sh/mh),y1=Math.max(y0+1,Math.floor((y+1)*sh/mh));
              for(let x=0;x<mw;x++){const x0=Math.floor(x*sw/mw),x1=Math.max(x0+1,Math.floor((x+1)*sw/mw));let a=0,c=0;
                for(let yy=y0;yy<y1;yy+=2)for(let xx=x0;xx<x1;xx+=2){a+=src[yy*sw+xx];c++}mk[y*mw+x]=Math.round(255*Math.min(1,a/(c||1)))}}}catch(e){mk=null}}
          if(m&&m.close)try{m.close()}catch(e){}
        });
        ms+=performance.now()-s; n++;
        const row=new Float32Array(STRIDE); row[0]=t;
        if(pts)for(let j=0;j<N;j++){row[1+j*3]=pts[j].x;row[2+j*3]=pts[j].y;row[3+j*3]=pts[j].visibility??0}
        else row.fill(NaN,1);
        rows.push(row); masks.push(mk);
        if(opt.onProgress)opt.onProgress(Math.min(1,(k+1)/total));
      }
      const data=new Float32Array(rows.length*STRIDE); rows.forEach((r,i)=>data.set(r,i*STRIDE));
      const seen=rows.filter(r=>!isNaN(r[1])).length;
      /* masks packed in frame order; frames without a person get an empty (all-zero) mask */
      let mask=null; const withMask=masks.filter(Boolean).length;
      if(withMask){const md=new Uint8Array(rows.length*mw*mh);masks.forEach((m,i)=>{if(m)md.set(m,i*mw*mh)});mask={w:mw,h:mh,n:rows.length,data:md,frames:withMask}}
      return {v:1,model:'pose_landmarker_full 0.10.18',w:W,h:H,fps,n:rows.length,data:smooth(data,rows.length),mask,seen,missed:Math.max(0,total-rows.length),msPerFrame:n?ms/n:0,delegate:rt.delegate,start,end};
    }finally{cleanup()}
  }

  /* Zero-phase light smoothing: each frame with its two neighbours (0.2 · 0.6 · 0.2). Centred, so it adds no lag;
     skipped across gaps, low-visibility points and large jumps so fast accents keep their peak. */
  function smooth(d,n){
    const o=new Float32Array(d);
    for(let i=1;i<n-1;i++){const a=(i-1)*STRIDE,b=i*STRIDE,c=(i+1)*STRIDE;
      if(d[c]-d[a]>0.12)continue;
      for(let j=0;j<N;j++){const x=1+j*3,y=x+1,vv=x+2;
        if(isNaN(d[a+x])||isNaN(d[b+x])||isNaN(d[c+x])||d[b+vv]<0.5)continue;
        const jump=Math.hypot(d[c+x]-d[a+x],d[c+y]-d[a+y]); if(jump>0.08)continue;
        o[b+x]=0.2*d[a+x]+0.6*d[b+x]+0.2*d[c+x]; o[b+y]=0.2*d[a+y]+0.6*d[b+y]+0.2*d[c+y];}}
    return o;
  }

  const tAt=(B,i)=>B.data[i*STRIDE];
  function index(B,t){let lo=0,hi=B.n-1;if(hi<0)return -1;while(lo<hi){const m=(lo+hi)>>1;if(tAt(B,m)<t)lo=m+1;else hi=m}return lo}
  /* pose at time t: the exact frame when one is within 20 ms, else interpolated between the two neighbours when they
     are close (≤70 ms apart); never across gaps */
  function poseAt(B,t){
    if(!B||!B.n)return null; const i=index(B,t); const cand=[i-1,i].filter(k=>k>=0&&k<B.n);
    let best=-1,bd=1e9;for(const k of cand){const dd=Math.abs(tAt(B,k)-t);if(dd<bd){bd=dd;best=k}}
    const get=k=>{const o=k*STRIDE;if(isNaN(B.data[o+1]))return null;const p=new Array(N);for(let j=0;j<N;j++)p[j]=[B.data[o+1+j*3],B.data[o+2+j*3],B.data[o+3+j*3]];return p};
    if(bd<=0.02)return get(best);
    const a=i-1,b=i; if(a<0||b>=B.n)return null; const ta=tAt(B,a),tb=tAt(B,b); if(tb-ta>0.07||t<ta||t>tb)return bd<=0.04?get(best):null;
    const A=get(a),Bp=get(b); if(!A||!Bp)return A||Bp; const u=(t-ta)/(tb-ta);
    return A.map((p,j)=>[p[0]+(Bp[j][0]-p[0])*u,p[1]+(Bp[j][1]-p[1])*u,Math.min(p[2],Bp[j][2])]);
  }
  /* frames for the hit detector in analysis.js (RA.analyzePose) */
  function framesOf(B){const out=[];for(let i=0;i<B.n;i++){const o=i*STRIDE;out.push({t:B.data[o],k:isNaN(B.data[o+1])?null:Array.from({length:N},(_,j)=>[B.data[o+1+j*3],B.data[o+2+j*3],B.data[o+3+j*3]])})}return out}

  /* ---------- drawing ---------- */
  const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const lerp2=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
  /* draw the dance body for video time t into ctx. rect = where the video frame sits on the canvas (object-fit: contain). */
  function draw(ctx,B,t,rect,o){
    o=o||{}; const P=poseAt(B,t); if(!P)return false;
    const X=p=>[rect.x+p[0]*rect.w,rect.y+p[1]*rect.h], vis=j=>P[j][2]>=0.35;
    const q=P.map(X), sh=mid(q[11],q[12]), hp=mid(q[23],q[24]), torso=Math.hypot(sh[0]-hp[0],sh[1]-hp[1])||40;
    const blue=o.dance||'#6E8BFF', pink=o.hips||'#FF5FA2', lw=Math.max(3,torso*0.11);
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    /* hips' path relative to the chest over the last second, drawn around the hips now (scaled so a whine reads) */
    if(o.hipPath!==false){
      const k=o.hipScale||2, pts=[];
      for(let s=-1;s<=0.0001;s+=1/30){const Q=poseAt(B,t+s);if(!Q){pts.push(null);continue}const qq=Q.map(X),s2=mid(qq[11],qq[12]),h2=mid(qq[23],qq[24]);
        pts.push([hp[0]+((h2[0]-s2[0])-(hp[0]-sh[0]))*k,hp[1]+((h2[1]-s2[1])-(hp[1]-sh[1]))*k])}
      for(let i=1;i<pts.length;i++){if(!pts[i]||!pts[i-1])continue;ctx.strokeStyle=pink;ctx.globalAlpha=0.15+0.7*i/pts.length;ctx.lineWidth=Math.max(2,lw*0.35);ctx.beginPath();ctx.moveTo(...pts[i-1]);ctx.lineTo(...pts[i]);ctx.stroke()}
      ctx.globalAlpha=1;
    }
    /* foot trails (last 0.6 s), dotted */
    if(o.feet!==false){
      ctx.setLineDash([2,lw*0.7]);ctx.strokeStyle=blue;ctx.lineWidth=Math.max(2,lw*0.3);
      for(const j of [27,28]){ctx.beginPath();let on=false;for(let s=-0.6;s<=0.0001;s+=1/30){const Q=poseAt(B,t+s);if(!Q||Q[j][2]<0.35){on=false;continue}const p=X(Q[j]);if(!on){ctx.moveTo(...p);on=true}else ctx.lineTo(...p)}ctx.globalAlpha=0.7;ctx.stroke()}
      ctx.setLineDash([]);ctx.globalAlpha=1;
    }
    /* torso */
    ctx.fillStyle=blue;ctx.strokeStyle=blue;ctx.lineWidth=Math.max(2,lw*0.3);
    ctx.globalAlpha=0.22;ctx.beginPath();[11,12,24,23].forEach((j,i)=>i?ctx.lineTo(...q[j]):ctx.moveTo(...q[j]));ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;ctx.stroke();
    /* pelvis: from the waist (28% up towards the shoulders) to the hip joints pushed outwards, closed below the hips;
       it narrows when the dancer turns side-on and tilts with the hip line */
    const hw=Math.hypot(q[23][0]-q[24][0],q[23][1]-q[24][1]), ax=[(q[23][0]-q[24][0])/(hw||1),(q[23][1]-q[24][1])/(hw||1)];
    const down=[sh[0]-hp[0],sh[1]-hp[1]].map(c=>-c/torso);
    const wl=lerp2(q[23],q[11],0.28), wr=lerp2(q[24],q[12],0.28), push=Math.max(hw*0.12,torso*0.05);
    const ol=[q[23][0]+ax[0]*push,q[23][1]+ax[1]*push], or_=[q[24][0]-ax[0]*push,q[24][1]-ax[1]*push];
    const cr=[hp[0]+down[0]*torso*0.2,hp[1]+down[1]*torso*0.2];
    ctx.fillStyle=pink;ctx.strokeStyle=pink;ctx.globalAlpha=0.55;ctx.beginPath();[wl,wr,or_,cr,ol].forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;ctx.lineWidth=Math.max(2,lw*0.3);ctx.stroke();
    /* limbs */
    ctx.strokeStyle=blue;
    const limb=(ids,w)=>{ctx.lineWidth=w;ctx.beginPath();let on=false;for(const j of ids){if(!vis(j)){on=false;continue}if(!on){ctx.moveTo(...q[j]);on=true}else ctx.lineTo(...q[j])}ctx.stroke()};
    limb([11,13,15],lw*0.9);limb([12,14,16],lw*0.9);limb([23,25,27,31],lw);limb([24,26,28,32],lw);
    /* head */
    const hr=Math.max(6,Math.hypot(q[7][0]-q[8][0],q[7][1]-q[8][1])*0.75);
    ctx.globalAlpha=0.3;ctx.fillStyle=blue;ctx.beginPath();ctx.arc(q[0][0],q[0][1],hr,0,7);ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=Math.max(2,lw*0.3);ctx.stroke();
    ctx.restore(); return true;
  }
  /* ---------- person cut-out ----------
     Draw the video frame for time t with everything but the dancer replaced by a background. The stored mask (nearest
     frame within 50 ms) is softened at the edge and scaled up with smoothing. bg: 'dark' | 'colour' | 'blur'. */
  let mcv=null, mcx=null, ccv=null, ccx=null;
  function maskIndex(B,t){if(!B||!B.mask||!B.n)return -1;const i=index(B,t);let best=-1,bd=1e9;for(const k of [i-1,i,i+1]){if(k<0||k>=B.n)continue;const d=Math.abs(tAt(B,k)-t);if(d<bd){bd=d;best=k}}return bd<=0.05?best:-1}
  function hasCutout(B){return !!(B&&B.mask&&B.mask.frames)}
  function maskCanvas(B,k){
    const M=B.mask,mw=M.w,mh=M.h;
    if(!mcv){mcv=document.createElement('canvas');mcx=mcv.getContext('2d')}
    if(mcv.width!==mw||mcv.height!==mh){mcv.width=mw;mcv.height=mh}
    const img=mcx.createImageData(mw,mh),o=k*mw*mh;
    for(let i=0;i<mw*mh;i++){const v=M.data[o+i]/255,a=Math.max(0,Math.min(1,(v-.35)/.3));img.data[i*4+3]=Math.round(a*a*(3-2*a)*255)}
    mcx.putImageData(img,0,0); return mcv;
  }
  function cutout(ctx,B,t,video,rect,o){
    o=o||{}; const k=maskIndex(B,t); if(k<0||!video||!video.videoWidth)return false;
    const W=ctx.canvas.width,H=ctx.canvas.height;
    if(!ccv){ccv=document.createElement('canvas');ccx=ccv.getContext('2d')}
    if(ccv.width!==W||ccv.height!==H){ccv.width=W;ccv.height=H}
    /* background */
    ctx.save();
    if(o.bg==='blur'){ctx.filter='blur('+Math.round(Math.max(W,H)/40)+'px) brightness(.55)';ctx.drawImage(video,rect.x,rect.y,rect.w,rect.h);ctx.filter='none';ctx.fillStyle='rgba(14,16,20,.35)';ctx.fillRect(0,0,W,H)}
    else{ctx.fillStyle=o.bg==='colour'?(o.colour||'#2B2F6B'):(o.dark||'#08090C');ctx.fillRect(0,0,W,H)}
    ctx.restore();
    /* the dancer: frame, then keep only where the mask is */
    ccx.clearRect(0,0,W,H);ccx.globalCompositeOperation='source-over';ccx.drawImage(video,rect.x,rect.y,rect.w,rect.h);
    ccx.globalCompositeOperation='destination-in';ccx.imageSmoothingEnabled=true;ccx.imageSmoothingQuality='high';ccx.drawImage(maskCanvas(B,k),rect.x,rect.y,rect.w,rect.h);
    ccx.globalCompositeOperation='source-over';
    ctx.drawImage(ccv,0,0);
    return true;
  }
  /* where a video frame sits inside a box with object-fit: contain */
  function containRect(bw,bh,vw,vh){if(!vw||!vh)return {x:0,y:0,w:bw,h:bh};const s=Math.min(bw/vw,bh/vh);return {x:(bw-vw*s)/2,y:(bh-vh*s)/2,w:vw*s,h:vh*s}}
  /* MirrorView's pose sample format: {t, points:[{x,y,z,visibility}]} */
  function toMirrorView(B){const out=[];for(let i=0;i<B.n;i++){const o=i*STRIDE;out.push({t:B.data[o],points:isNaN(B.data[o+1])?null:Array.from({length:N},(_,j)=>({x:B.data[o+1+j*3],y:B.data[o+2+j*3],z:0,visibility:B.data[o+3+j*3]}))})}return out}
  root.RB={CFG,load,track,poseAt,framesOf,draw,containRect,toMirrorView,cutout,hasCutout,maskIndex,maskCanvas,STRIDE,N};
})(typeof window!=='undefined'?window:globalThis);
/*BODY-END*/
