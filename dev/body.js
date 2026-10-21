/*BODY-START*/
/* Riddim Swap dance body: pose tracking for fast dance (dancehall, Philly) and the dance-body drawing.
   Tracking: MediaPipe tasks-vision 0.10.18 (the same runtime MirrorView pins), pose_landmarker_full, IMAGE mode on every
   decoded frame of a clip ("prepared"), so there is no tracking lag and no frames thinned out. Each sample keeps the
   frame's own media time. Up to three people are found per frame and the same dancer is followed from frame to frame
   (the biggest one, or the one you tapped). The whole clip is then cleaned without delay (left/right flips, outliers,
   short gaps, zero-phase smoothing) and hip measures are worked out for every frame: tilt, sway, turn and an estimated
   forward/back. Drawing looks up the pose for the exact frame on screen; nothing is filtered causally.
   Drawing: torso shape, a pelvis shape that tilts and turns, thick limbs, head, the hips' path relative to the chest
   (last second, scaled), and foot trails. */
(function(root){
  'use strict';
  const CFG={
    sdkURL:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs',
    wasmURL:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
    modelURL:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    edge:640,         /* longest side of the image given to the tracker (the person crop is resized from this) */
    maskW:120,        /* stored person-mask width (height follows the video's shape); ~25 KB a frame */
    numPoses:3        /* people looked for per frame; the followed dancer is chosen by continuity */
  };
  const N=33, STRIDE=1+N*3;   /* packed sample: t, then x,y,visibility for each landmark */
  const WJ=[11,12,23,24,25,26,27,28], WS=WJ.length*3;   /* world (metric, hip-centred) x,y,z for shoulders, hips, knees, ankles */
  const HS=6;   /* hip measures per frame: tilt°, tiltVsShoulders°, sway, turn°, twist°, thrust (NaN when unknown) */
  const PAIRS=[[1,4],[2,5],[3,6],[7,8],[9,10],[11,12],[13,14],[15,16],[17,18],[19,20],[21,22],[23,24],[25,26],[27,28],[29,30],[31,32]];
  const SWAP=Array.from({length:N},(_,i)=>i); PAIRS.forEach(([a,b])=>{SWAP[a]=b;SWAP[b]=a});
  let runtime=null, loading=null;

  async function load(){
    if(runtime)return runtime; if(loading)return loading;
    loading=(async()=>{
      const sdk=await import(CFG.sdkURL);
      const files=await sdk.FilesetResolver.forVisionTasks(CFG.wasmURL);
      const r=await fetch(CFG.modelURL); if(!r.ok)throw new Error('Body model download failed ('+r.status+')');
      const model=new Uint8Array(await r.arrayBuffer());
      /* person masks (segmentation) come from the same pass, for the cut-out */
      const opts=d=>({baseOptions:{modelAssetBuffer:model,delegate:d},canvas:document.createElement('canvas'),runningMode:'IMAGE',numPoses:CFG.numPoses,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:true});
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
        /* a busy phone skips frame callbacks, which makes gaps of 2 or 3 frames: the smallest gap is the real frame time */
        const d=[];for(let i=1;i<ts.length;i++)if(ts[i]-ts[i-1]>0.008)d.push(ts[i]-ts[i-1]);d.sort((a,b)=>a-b);const md=d.length?d[0]:1/30;
        let f0=1/md;for(const c of [24,25,30,48,50,60])if(Math.abs(f0-c)/c<0.08)f0=c;fps=Math.min(60,Math.max(15,Math.round(f0)))}
      const seekTo=t=>new Promise(res=>{let done=false;const fin=m=>{if(done)return;done=true;res(m)};
        if(hasRVFC)v.requestVideoFrameCallback((now,m)=>fin(m.mediaTime));
        v.addEventListener('seeked',()=>setTimeout(()=>fin(null),hasRVFC?120:30),{once:true});
        v.currentTime=t;});
      /* check the frame time by stepping: from a frame, nudge forward until the next frame shows; that gap is one frame.
         (the frame clock above can read 2 frames as one when the phone is busy) */
      if(!opt.fps){let best=0;for(const base of [start+0.3,start+(end-start)/2]){const m0=await seekTo(base);if(m0==null)continue;
        for(let st=1;st<=10;st++){const m=await seekTo(m0+st/120+1e-4);if(m!=null&&m>m0+1e-4){best=Math.max(best,1/(m-m0));break}}}
        if(best>0){let f1=best;for(const c of [24,25,30,48,50,60])if(Math.abs(f1-c)/c<0.08)f1=c;fps=Math.max(fps||0,Math.min(60,Math.round(f1)))}}
      fps=fps||30;
      const mw=CFG.maskW, mh=Math.max(8,Math.round(mw*H/W)), asp=H/W;
      const total=Math.max(1,Math.floor((end-start)*fps+1e-6)+1);
      const want=[];for(let k=0;k<total;k++){const w=start+(k+0.5)/fps;if(w>end)break;want.push(w)}   /* the middle of each frame's display interval */
      /* order: from the start; with a tapped dancer, from the tap outwards (forwards, then backwards) so the choice holds */
      let order=want.map((_,k)=>k), anchor=0;
      if(opt.pick&&isFinite(opt.pick.t)){anchor=0;let bd=1e9;want.forEach((w,k)=>{const d=Math.abs(w-opt.pick.t);if(d<bd){bd=d;anchor=k}});
        order=[];for(let k=anchor;k<want.length;k++)order.push(k);for(let k=anchor-1;k>=0;k--)order.push(k)}
      const slot=new Array(want.length).fill(null); let ms=0, n=0, done=0, multi=0;
      let prev=null, lost=0, pickPose=null;
      let pending=null;   /* the next frame's seek, started while the tracker works on this one */
      for(let oi=0;oi<order.length;oi++){const k=order[oi];
        if(opt.signal&&opt.signal.aborted)break;
        if(k===anchor-1){prev=pickPose?{...pickPose,vel:pickPose.vel?[-pickPose.vel[0],-pickPose.vel[1]]:null}:null;lost=0}   /* going backwards: start again from the tap */
        /* the frame clock must agree with where we asked to go; after a long jump (going backwards) it can report a
           stale frame, so ask once more, then fall back to the requested time */
        const P0=performance.now();
        const tol=Math.max(1.5/fps,0.06);
        let mt=pending&&pending.k===k?await pending.p:await seekTo(want[k]); pending=null; if(mt!=null&&Math.abs(mt-want[k])>tol){mt=await seekTo(want[k]+1e-3);if(mt!=null&&Math.abs(mt-want[k])>tol)mt=null}
        /* no new frame showed (a variable-rate clip has fewer frames than the steps): nothing new to track here */
        if(mt==null&&hasRVFC){if(opt.onProgress)opt.onProgress(Math.min(1,(++done)/want.length));continue}
        const t=mt!=null?mt:want[k]-0.5/fps;
        const P1=performance.now();cx.drawImage(v,0,0,cv.width,cv.height);
        /* the frame is copied: start decoding the next one now; the decoder works while the tracker runs */
        if(oi+1<order.length&&!(opt.signal&&opt.signal.aborted)){const nk=order[oi+1];pending={k:nk,p:seekTo(want[nk])}}
        const s=performance.now(); let cands=[], mk=null;
        const PR={};const D0=performance.now();rt.task.detect(cv,r=>{const D1=performance.now();PR.det=D1-D0;
          const L=r.landmarks||[], Wl=r.worldLandmarks||[];
          cands=L.map((pts,i)=>({pts:pts.map(q=>[q.x,q.y,q.visibility??0]),w:Wl[i]?Wl[i].map(q=>[q.x,q.y,q.z]):null,i}));
          if(cands.length>1||(prev&&prev.app)||root.RB_DEBUG_ALL)cands.forEach(c=>{c.app=looks(cx,cv.width,cv.height,c.pts)});
          PR.look=performance.now()-D1;
          if(root.RB_DEBUG_ALL)root.RB_DEBUG_ALL.push({k,cands:cands.map(c=>({pts:c.pts,app:c.app}))});
          const ch=choose(cands,prev,opt.pick&&!pickPose?opt.pick:null,asp,lost,!!opt.pick);
          const M0=performance.now();if(ch){const m=r.segmentationMasks&&r.segmentationMasks[ch.i];
            /* the mask belongs to the callback: shrink it to mw×mh bytes (area average) before returning */
            if(m){try{const src=m.getAsFloat32Array(),sw=m.width,sh=m.height;mk=new Uint8Array(mw*mh);
              for(let y=0;y<mh;y++){const y0=Math.floor(y*sh/mh),y1=Math.max(y0+1,Math.floor((y+1)*sh/mh));
                for(let x=0;x<mw;x++){const x0=Math.floor(x*sw/mw),x1=Math.max(x0+1,Math.floor((x+1)*sw/mw));let a=0,c=0;
                  for(let yy=y0;yy<y1;yy+=2)for(let xx=x0;xx<x1;xx+=2){a+=src[yy*sw+xx];c++}mk[y*mw+x]=Math.round(255*Math.min(1,a/(c||1)))}}}catch(e){mk=null}}}
          (r.segmentationMasks||[]).forEach(m=>{if(m&&m.close)try{m.close()}catch(e){}});PR.mask=performance.now()-M0;
          cands.chosen=ch;
        });
        ms+=performance.now()-s; n++; if(cands.length>1)multi++;
        if(root.RB_PROF)root.RB_PROF.push({seek:P1-P0,draw:s-P1,total:performance.now()-s,n:cands.length,...PR});
        const ch=cands.chosen;
        if(ch){if(prev&&!ch.vel){const a=geom(prev.pts,asp),b2=geom(ch.pts,asp),k2=1+lost,nv=[(b2.hp[0]-a.hp[0])/k2,(b2.hp[1]-a.hp[1])/k2],ov=prev.vel||nv;ch.vel=[0.6*ov[0]+0.4*nv[0],0.6*ov[1]+0.4*nv[1]]}
          learnLooks(prev,ch);
          prev=ch;lost=0;if(opt.pick&&!pickPose)pickPose=ch}else lost++;
        const row=new Float32Array(STRIDE); row[0]=t; const wr=new Float32Array(WS).fill(NaN);
        if(ch){for(let j=0;j<N;j++){row[1+j*3]=ch.pts[j][0];row[2+j*3]=ch.pts[j][1];row[3+j*3]=ch.pts[j][2]}
          if(ch.w)WJ.forEach((j,u)=>{wr[u*3]=ch.w[j][0];wr[u*3+1]=ch.w[j][1];wr[u*3+2]=ch.w[j][2]})}
        else row.fill(NaN,1);
        slot[k]={row,wr,mk,pick:ch};
        if(opt.onProgress)opt.onProgress(Math.min(1,(++done)/want.length));
      }
      /* frames in time order; drop repeats (a seek that landed on the same frame) */
      const rows=[], worlds=[], masks=[]; let last=-1;
      for(const sl of slot.filter(Boolean).sort((x,y)=>x.row[0]-y.row[0])){const t=sl.row[0];if(t<=last+1e-4)continue;last=t;rows.push(sl.row);worlds.push(sl.wr);masks.push(sl.mk)}
      const data=new Float32Array(rows.length*STRIDE); rows.forEach((r,i)=>data.set(r,i*STRIDE));
      const world=new Float32Array(rows.length*WS); worlds.forEach((r,i)=>world.set(r,i*WS));
      const seen=rows.filter(r=>!isNaN(r[1])).length;
      const C=clean(data,world,rows.length,asp);
      /* masks packed in frame order; frames without a person get an empty (all-zero) mask */
      let mask=null; const withMask=masks.filter(Boolean).length;
      if(withMask){const md=new Uint8Array(rows.length*mw*mh);masks.forEach((m,i)=>{if(m)md.set(m,i*mw*mh)});mask={w:mw,h:mh,n:rows.length,data:md,frames:withMask}}
      return {v:2,model:'pose_landmarker_full 0.10.18',w:W,h:H,fps,n:rows.length,data:C.data,world:C.world,hips:hipSeries(C.data,C.world,rows.length,asp),
        clean:C.report,multi,mask,seen,missed:Math.max(0,want.length-rows.length),msPerFrame:n?ms/n:0,delegate:rt.delegate,start,end,pick:opt.pick||null};
    }finally{cleanup()}
  }

  /* ---------- following one dancer ----------
     cands: [{pts:[[x,y,vis]...33], w}] for one frame. First frame: the person you tapped, else the biggest, most visible,
     most central one. After that: whoever is nearest to where the followed dancer should be (hips and shoulders, in
     torso lengths) and about the same size. Nobody like that: the frame has no pose (they are hidden behind someone);
     after 1.5 s lost (a cut, or they left) start again with the biggest. A dancer you chose is never swapped. */
  function geom(P,asp){const sh=[(P[11][0]+P[12][0])/2,(P[11][1]+P[12][1])/2*asp],hp=[(P[23][0]+P[24][0])/2,(P[23][1]+P[24][1])/2*asp];
    return {sh,hp,T:Math.hypot(sh[0]-hp[0],sh[1]-hp[1])||1e-3}}
  /* what someone looks like: average colour of their top and of each thigh (small patches), 0..1 */
  function looks(cx,W,H,P){
    const patch=(x,y)=>{x=Math.round(x*W);y=Math.round(y*H);const r=Math.max(2,Math.round(W/160));
      if(x<r||y<r||x>=W-r||y>=H-r)return null;try{const d=cx.getImageData(x-r,y-r,2*r+1,2*r+1).data;let R=0,G=0,B=0,n=0;for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++}return [R/n/255,G/n/255,B/n/255]}catch(e){return null}};
    const m=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
    const sh=m(P[11],P[12],.5),hp=m(P[23],P[24],.5);
    return [patch(...m(sh,hp,.45)),patch(...m(P[23],P[25],.35)),patch(...m(P[24],P[26],.35))];
  }
  function looksDiff(a,b){if(!a||!b)return 0;let s=0,n=0;for(let i=0;i<3;i++){if(!a[i]||!b[i])continue;s+=Math.abs(a[i][0]-b[i][0])+Math.abs(a[i][1]-b[i][1])+Math.abs(a[i][2]-b[i][2]);n+=3}return n?s/n:0}
  /* remember what the followed dancer looks like; only learn from confident matches, so it can't drift onto someone else */
  function learnLooks(prev,ch){
    const r0=prev&&prev.appRef; ch.appN=(prev&&prev.appN)||0;
    if(!ch.app){ch.appRef=r0||null;return}
    if(!r0){ch.appRef=ch.app;ch.appN=1;return}
    if(looksDiff(r0,ch.app)<0.15){ch.appRef=ch.app.map((q,i)=>q&&r0[i]?q.map((v,j)=>0.9*r0[i][j]+0.1*v):(q||r0[i]));ch.appN++}else ch.appRef=r0;
  }
  function choose(cands,prev,pick,asp,lost,sticky){
    if(!cands.length)return null;
    if(pick){let b=null,bd=1e9;for(const c of cands){const g=geom(c.pts,asp),d=Math.hypot(g.hp[0]-pick.x,g.hp[1]-pick.y*asp)+0.5*Math.hypot(g.sh[0]-pick.x,g.sh[1]-pick.y*asp);if(d<bd){bd=d;b=c}}return b}
    /* sticky (you chose the dancer): never swap to someone far from where they were last seen; they may have left */
    /* where they should be now (last position plus their recent drift) and how big they are: someone crossing in front
       is nearer the camera, so bigger, and moving the other way */
    if(prev&&(lost<45||sticky)){const g0=geom(prev.pts,asp),vel=prev.vel||[0,0],k=Math.min(3,1+lost),px=g0.hp[0]+vel[0]*k,py=g0.hp[1]+vel[1]*k;let b=null,bd=1e9;
      for(const c of cands){const g=geom(c.pts,asp),d=(Math.hypot(g.hp[0]-px,g.hp[1]-py)+Math.hypot(g.sh[0]-g0.sh[0]-vel[0]*k,g.sh[1]-g0.sh[1]-vel[1]*k))/g0.T+2*Math.max(0,Math.abs(Math.log(g.T/g0.T))-0.2)+8*Math.max(0,looksDiff(prev.appRef,c.app)-0.12);c._ld=looksDiff(prev.appRef,c.app);c._pos=d-8*Math.max(0,c._ld-0.12);
        if((prev.appN||0)>=10&&c._ld>0.28)continue;   /* clearly different clothes: not them, however close */
        if(d<bd){bd=d;b=c}}
      if(root.RB_DEBUG)root.RB_DEBUG.push(cands.map(c=>[+(c._pos||0).toFixed(2),+(c._ld||0).toFixed(3),+geom(c.pts,asp).hp[0].toFixed(2)]));
      return bd<(sticky?Math.min(1.6,1.2+0.05*lost):Math.min(2.2,1.2+0.1*lost))?b:null}
    let b=null,bs=-1;for(const c of cands){const g=geom(c.pts,asp),vis=(c.pts[11][2]+c.pts[12][2]+c.pts[23][2]+c.pts[24][2])/4,centre=1-Math.min(1,Math.abs(g.hp[0]-0.5)*1.2);
      const sc=g.T*vis*(0.6+0.4*centre);if(sc>bs){bs=sc;b=c}}
    return b;
  }

  /* ---------- cleaning the whole clip (no delay: every step looks both ways in time) ----------
     1 split into runs where the body is continuous; 2 undo left/right flips (best labelling over the run, Viterbi);
     3 replace single-frame outliers (Hampel: median of ±3 frames when a point is > 3 MADs away);
     4 fill short gaps (≤ 6 frames) and low-confidence points from their neighbours;
     5 zero-phase Savitzky-Golay smoothing: limbs window 5 (keeps ~90% at 5 Hz, so hits stay sharp), torso and hips
       window 7 (−3 dB at 4.8 Hz at 30 fps), depth (world z) window 11 because it is the noisiest. */
  const EXT=new Set([13,14,15,16,17,18,19,20,21,22,27,28,29,30,31,32]);   /* hands and feet move fastest: outliers must be bigger to count */
  function sgW(m){const w=[],den=(2*m+1)*(4*m*m+4*m-3);for(let i=-m;i<=m;i++)w.push((3*(3*m*m+3*m-1)-15*i*i)/den);return w}
  const SG2=sgW(2),SG3=sgW(3),SG5=sgW(5);
  function clean(D,Wd,n,asp){
    const rep={flips:0,outliers:0,filled:0,runs:0};
    const has=i=>!isNaN(D[i*STRIDE+1]);
    const X=(i,j)=>D[i*STRIDE+1+j*3], Y=(i,j)=>D[i*STRIDE+2+j*3]*asp, V=(i,j)=>D[i*STRIDE+3+j*3];
    const torsoAt=i=>{const sx=(X(i,11)+X(i,12))/2,sy=(Y(i,11)+Y(i,12))/2,hx=(X(i,23)+X(i,24))/2,hy=(Y(i,23)+Y(i,24))/2;return Math.hypot(sx-hx,sy-hy)||1e-3};
    const hipAt=i=>[(X(i,23)+X(i,24))/2,(Y(i,23)+Y(i,24))/2];
    /* 1 runs */
    const runs=[];let a=-1;
    for(let i=0;i<=n;i++){const ok=i<n&&has(i);
      if(ok&&a>=0){const h0=hipAt(i-1),h1=hipAt(i);if(Math.hypot(h1[0]-h0[0],h1[1]-h0[1])>1.0*torsoAt(i-1)){runs.push([a,i-1]);a=i;continue}}
      if(ok&&a<0)a=i; if(!ok&&a>=0){runs.push([a,i-1]);a=-1}}
    /* 4a join runs across short gaps when the body is where it was */
    const joined=[];for(const r of runs){const L=joined[joined.length-1];
      if(L&&r[0]-L[1]-1<=6){const h0=hipAt(L[1]),h1=hipAt(r[0]);if(Math.hypot(h1[0]-h0[0],h1[1]-h0[1])<0.6*torsoAt(L[1])*(r[0]-L[1])){
        for(let i=L[1]+1;i<r[0];i++){const u=(i-L[1])/(r[0]-L[1]);for(let c=1;c<STRIDE;c++){const p=D[L[1]*STRIDE+c],q=D[r[0]*STRIDE+c];D[i*STRIDE+c]=(c%3===0)?Math.min(p,q)*0.8:p+(q-p)*u}
          for(let c=0;c<WS;c++){const p=Wd[L[1]*WS+c],q=Wd[r[0]*WS+c];Wd[i*WS+c]=p+(q-p)*u}rep.filled++}
        L[1]=r[1];continue}}joined.push([r[0],r[1]])}
    rep.runs=joined.length;
    const wIdx=j=>WJ.indexOf(j);
    for(const [r0,r1] of joined){
      /* 2 left/right flips: state 0 = as found, 1 = swapped; moving cost from the frame before, small cost for swapping */
      if(r1>r0){const dist=(i,s,pi,ps)=>{let c=0;for(const j of [11,12,13,14,15,16,23,24,25,26,27,28]){const a1=s?SWAP[j]:j,b1=ps?SWAP[j]:j;c+=Math.hypot(X(i,a1)-X(pi,b1),Y(i,a1)-Y(pi,b1))}return c/torsoAt(pi)};
        const L=r1-r0+1,acc=[[0,0.4]],from=[[0,0]];
        for(let k=1;k<L;k++){const i=r0+k,pi=i-1;acc.push([0,0]);from.push([0,0]);
          for(const s of [0,1]){let best=1e9,bf=0;for(const ps of [0,1]){const c=acc[k-1][ps]+dist(i,s,pi,ps);if(c<best){best=c;bf=ps}}acc[k][s]=best+(s?0.4:0);from[k][s]=bf}}
        let s=acc[L-1][1]<acc[L-1][0]?1:0;const st=new Array(L);for(let k=L-1;k>=0;k--){st[k]=s;s=from[k][s]}
        for(let k=0;k<L;k++)if(st[k]){const i=r0+k,o=i*STRIDE,cp=D.slice(o,o+STRIDE);for(let j=0;j<N;j++)for(let c=1;c<=3;c++)D[o+j*3+c]=cp[SWAP[j]*3+c];
          const wo=i*WS,wc=Wd.slice(wo,wo+WS);WJ.forEach((j,u)=>{const v=wIdx(SWAP[j]);for(let c=0;c<3;c++)Wd[wo+u*3+c]=wc[v*3+c]});
          if(!k||!st[k-1])rep.flips++}}
      const T=(()=>{const a=[];for(let i=r0;i<=r1;i++)a.push(torsoAt(i));a.sort((x,y)=>x-y);return a[a.length>>1]})();
      /* 3 outliers and 4b low-confidence points, per landmark */
      for(let j=0;j<N;j++)for(const c of [1,2]){const sc=c===2?asp:1;
        const get=i=>D[i*STRIDE+c+j*3]*sc, orig=[];for(let i=r0;i<=r1;i++)orig.push(get(i));
        for(let i=r0;i<=r1;i++){const w=[];for(let k=Math.max(r0,i-3);k<=Math.min(r1,i+3);k++)w.push(orig[k-r0]);if(w.length<5)continue;
          const s2=[...w].sort((x,y)=>x-y),med=s2[s2.length>>1],mad=[...w].map(x=>Math.abs(x-med)).sort((x,y)=>x-y)[w.length>>1]*1.4826;
          if(Math.abs(orig[i-r0]-med)>Math.max(3*mad,(EXT.has(j)?0.16:0.08)*T)){D[i*STRIDE+c+j*3]=med/sc;if(c===1)rep.outliers++}}}
      for(let j=0;j<N;j++){const vi=i=>D[i*STRIDE+3+j*3];
        for(let i=r0;i<=r1;i++){if(vi(i)>=0.3)continue;let p=-1,q=-1;for(let k=i-1;k>=Math.max(r0,i-6);k--)if(vi(k)>=0.5){p=k;break}for(let k=i+1;k<=Math.min(r1,i+6);k++)if(vi(k)>=0.5){q=k;break}
          if(p>=0&&q>=0){const u=(i-p)/(q-p);for(const c of [1,2])D[i*STRIDE+c+j*3]=D[p*STRIDE+c+j*3]+(D[q*STRIDE+c+j*3]-D[p*STRIDE+c+j*3])*u}}}
      /* 5 smoothing */
      const smooth1=(arr,stride,off,w)=>{const m=(w.length-1)/2;if(r1-r0<2*m)return;const src=[];for(let i=r0;i<=r1;i++)src.push(arr[i*stride+off]);
        for(let i=r0+m;i<=r1-m;i++){let acc=0,bad=false;for(let k=-m;k<=m;k++){const v=src[i-r0+k];if(isNaN(v)){bad=true;break}acc+=w[k+m]*v}if(!bad)arr[i*stride+off]=acc}};
      const core=new Set([11,12,23,24]);
      for(let j=0;j<N;j++)for(const c of [1,2])smooth1(D,STRIDE,c+j*3,core.has(j)?SG3:SG2);
      for(let u=0;u<WJ.length;u++){smooth1(Wd,WS,u*3,SG3);smooth1(Wd,WS,u*3+1,SG3);smooth1(Wd,WS,u*3+2,SG5)}
    }
    return {data:D,world:Wd,report:rep};
  }

  /* ---------- hip measures, every frame ----------
     tilt: the line between the hips against level, in degrees; + = the right-hand side of the screen is higher.
       Unknown when the dancer is side-on (the hips overlap, so the line means little).
     tiltRel: hip tilt minus shoulder tilt (hips moving on their own: the isolation in a whine or a wine-and-bend).
     sway: hips' sideways offset from the chest, in torso lengths; + = to the right of the screen.
     turn: which way the hips face, from the tracker's 3D estimate; 0 = facing the camera, + = turned to their left.
     twist: hip turn minus shoulder turn. thrust: hips forward (+) or back (−) of the chest, torso lengths; an estimate
     from depth, the least certain of these. */
  function hipSeries(D,Wd,n,asp){
    const H=new Float32Array(n*HS).fill(NaN);
    const ang=(ax,ay,bx,by)=>{let L=[ax,ay],R=[bx,by];if(L[0]>R[0])[L,R]=[R,L];return Math.atan2(-(R[1]-L[1]),R[0]-L[0])*180/Math.PI};
    for(let i=0;i<n;i++){const o=i*STRIDE;if(isNaN(D[o+1]))continue;
      const x=j=>D[o+1+j*3],y=j=>D[o+2+j*3]*asp;
      const sh=[(x(11)+x(12))/2,(y(11)+y(12))/2],hp=[(x(23)+x(24))/2,(y(23)+y(24))/2],T=Math.hypot(sh[0]-hp[0],sh[1]-hp[1])||1e-3;
      const hw=Math.hypot(x(23)-x(24),y(23)-y(24)), sw=Math.hypot(x(11)-x(12),y(11)-y(12));
      const h=i*HS;
      if(hw>0.22*T){H[h]=ang(x(23),y(23),x(24),y(24));if(sw>0.35*T)H[h+1]=H[h]-ang(x(11),y(11),x(12),y(12))}
      H[h+2]=(hp[0]-sh[0])/T;
      const w=Wd?(u=>[Wd[i*WS+u*3],Wd[i*WS+u*3+1],Wd[i*WS+u*3+2]]):null;
      if(w&&!isNaN(Wd[i*WS])){const s1=w(0),s2=w(1),h1=w(2),h2=w(3);
        const yaw=(a,b)=>Math.atan2(a[2]-b[2],a[0]-b[0])*180/Math.PI;
        const hy=yaw(h1,h2),sy=yaw(s1,s2);H[h+3]=hy;let tw=hy-sy;if(tw>180)tw-=360;if(tw<-180)tw+=360;H[h+4]=tw;
        const sm=[(s1[0]+s2[0])/2,(s1[1]+s2[1])/2,(s1[2]+s2[2])/2],hm=[(h1[0]+h2[0])/2,(h1[1]+h2[1])/2,(h1[2]+h2[2])/2],TW=Math.hypot(sm[0]-hm[0],sm[1]-hm[1],sm[2]-hm[2])||1e-3;
        H[h+5]=(sm[2]-hm[2])/TW}
    }
    return H;
  }
  /* hip measures at time t (nearest frame within 50 ms); recomputed for tracks saved by the older tracker */
  function hipsAt(B,t){
    if(!B||!B.n)return null;
    if(!B.hips||B.hips.length!==B.n*HS)B.hips=hipSeries(B.data,B.world||null,B.n,(B.h&&B.w)?B.h/B.w:16/9);
    const i=index(B,t);let best=-1,bd=1e9;for(const k of [i-1,i,i+1]){if(k<0||k>=B.n)continue;const d=Math.abs(tAt(B,k)-t);if(d<bd){bd=d;best=k}}
    if(best<0||bd>0.05)return null;const h=best*HS,H=B.hips;
    const nz=v=>isNaN(v)?null:v;
    return {tilt:nz(H[h]),tiltRel:nz(H[h+1]),sway:nz(H[h+2]),turn:nz(H[h+3]),twist:nz(H[h+4]),thrust:nz(H[h+5]),k:best};
  }
  /* run the cleaning on an old (v1) track so it draws steadier without tracking again */
  function upgrade(B){
    if(!B||B.v>=2||B._up)return B;
    const asp=(B.h&&B.w)?B.h/B.w:16/9;const C=clean(new Float32Array(B.data),new Float32Array(B.n*WS).fill(NaN),B.n,asp);
    B.data=C.data;B.hips=hipSeries(B.data,null,B.n,asp);B._up=true;return B;
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
    o=o||{}; if(B&&B.v<2&&!B._up)upgrade(B); const P=poseAt(B,t); if(!P)return false;
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
    /* pelvis: a hip bowl that tilts with the hips and opens up as they turn, plus a level guide when tilted */
    drawPelvis(ctx,q,hipsAt(B,t),{pink,lw,torso,tiltGuide:o.tiltGuide!==false});
    /* limbs */
    ctx.strokeStyle=blue;
    const limb=(ids,w)=>{ctx.lineWidth=w;ctx.beginPath();let on=false;for(const j of ids){if(!vis(j)){on=false;continue}if(!on){ctx.moveTo(...q[j]);on=true}else ctx.lineTo(...q[j])}ctx.stroke()};
    limb([11,13,15],lw*0.9);limb([12,14,16],lw*0.9);limb([23,25,27,31],lw);limb([24,26,28,32],lw);
    /* head */
    const hr=Math.max(6,Math.hypot(q[7][0]-q[8][0],q[7][1]-q[8][1])*0.75);
    ctx.globalAlpha=0.3;ctx.fillStyle=blue;ctx.beginPath();ctx.arc(q[0][0],q[0][1],hr,0,7);ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=Math.max(2,lw*0.3);ctx.stroke();
    ctx.restore();
    if(o.meter)drawMeter(ctx,B,t,rect,o);
    return true;
  }
  /* The hips. q: screen points by landmark index ([x,y]); info: hipsAt() or null.
     Bowl: an ellipse along the line between the hip joints. Its depth shows the turn (flat facing the camera, round
     side-on). Belt: a thick bar through the hip joints, the higher joint ringed in white. Tilt guide: when the hips are
     tilted 3° or more, a dashed level line, the angle filled in, and the number of degrees on the raised side. */
  function drawPelvis(ctx,q,info,o){
    let a=q[23],b=q[24]; if(a[0]>b[0])[a,b]=[b,a];
    const hp=[(a[0]+b[0])/2,(a[1]+b[1])/2], hw=Math.hypot(b[0]-a[0],b[1]-a[1]), ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
    const half=Math.max(hw/2*1.35,o.torso*0.2), turn=info&&info.turn!=null?info.turn:null;
    const depth=turn!=null?half*(0.22+0.55*Math.abs(Math.sin(turn*Math.PI/180))):half*0.32;
    ctx.save();ctx.translate(hp[0],hp[1]);ctx.rotate(ang);
    ctx.fillStyle=o.pink;ctx.strokeStyle=o.pink;ctx.globalAlpha=0.3;ctx.beginPath();ctx.ellipse(0,depth*0.25,half,depth,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=0.9;ctx.lineWidth=Math.max(2,o.lw*0.28);ctx.stroke();
    ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineWidth=Math.max(4,o.lw*0.85);ctx.beginPath();ctx.moveTo(-half,0);ctx.lineTo(half,0);ctx.stroke();
    const r=Math.max(4,o.lw*0.6), hiSide=b[1]<a[1]-1?1:(a[1]<b[1]-1?-1:0);
    for(const sx of [-1,1]){ctx.beginPath();ctx.arc(sx*hw/2,0,r,0,Math.PI*2);ctx.fillStyle=o.pink;ctx.fill();if(sx===hiSide){ctx.lineWidth=Math.max(2,r*0.45);ctx.strokeStyle='#F3F1EC';ctx.stroke();ctx.strokeStyle=o.pink}}
    ctx.restore();
    const tilt=info&&info.tilt!=null?info.tilt:null;
    if(o.tiltGuide&&tilt!=null&&Math.abs(tilt)>=3){
      const R=half*1.15, up=tilt>0?1:-1;   /* + = right side up */
      ctx.save();ctx.translate(hp[0],hp[1]);
      ctx.setLineDash([4,5]);ctx.strokeStyle='rgba(243,241,236,.6)';ctx.lineWidth=Math.max(1.5,o.lw*0.18);ctx.beginPath();ctx.moveTo(-R,0);ctx.lineTo(R,0);ctx.stroke();ctx.setLineDash([]);
      const a0=up>0?0:Math.PI, a1=up>0?-tilt*Math.PI/180:Math.PI-tilt*Math.PI/180;
      ctx.fillStyle=o.pink;ctx.globalAlpha=0.25;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,Math.min(a0,a1),Math.max(a0,a1));ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      const fs=Math.max(11,Math.round(o.torso*0.16)), lx=up*(R+fs*0.3), ly=-Math.abs(Math.sin(tilt*Math.PI/180))*R-fs*0.35;
      ctx.font=`800 ${fs}px Figtree,system-ui,sans-serif`;ctx.textAlign=up>0?'left':'right';ctx.textBaseline='middle';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(8,9,12,.85)';ctx.strokeText(Math.round(Math.abs(tilt))+'°',lx,ly);ctx.fillStyle='#F3F1EC';ctx.fillText(Math.round(Math.abs(tilt))+'°',lx,ly);
      ctx.restore();
    }
  }
  /* Hip meter: three small gauges in the top-left of the video.
     TILT: the hip line against level. SWAY: the hips' path under the chest over the last 1.5 s, seen from above
     (sideways from the video; forward/back from the tracker's depth estimate, so a whine shows as a loop).
     TURN: which way the hips face, seen from above (needs the newer tracker). */
  function drawMeter(ctx,B,t,rect,o){
    let info=hipsAt(B,t); if(!info)return;
    const flip=h=>h&&o.mirror?{...h,tilt:h.tilt!=null?-h.tilt:null,sway:h.sway!=null?-h.sway:null,turn:h.turn!=null?-h.turn:null}:h;
    info=flip(info);
    const hasW=info.turn!=null, n=hasW?3:2, pink=o.hips||'#FF5FA2', pad=Math.max(6,Math.round(rect.w*0.015));
    const CW=ctx.canvas.width;
    const top=rect.y+(o.reserveTop||0), availH=rect.h-(o.reserveTop||0)-(o.reserveBottom||0);
    let R=Math.max(16,Math.min(44,Math.min(rect.w,rect.h)*0.075)), fs=Math.max(10,Math.round(R*0.36));
    /* where it goes: in the black bars beside a tall video when it fits there (stacked, shrunk to fit between anything
       drawn at the top and bottom of the video), else over the top corner */
    const side=Math.max(rect.x,CW-rect.x-rect.w); let vertical=false, x0, y0=top+pad, W, Hh, cellH, cellW=2*R;
    const fitR=()=>{for(let k=0;k<6;k++){const need=n*(2*R+fs*1.6+pad*0.5)+pad;if(need<=availH)return true;R=Math.max(12,R*0.88);fs=Math.max(9,Math.round(R*0.36))}return n*(2*R+fs*1.6+pad*0.5)+pad<=availH};
    const VW0=Math.max(2*R+2*pad,fs*6.2);
    if(side>=Math.min(VW0,90)+2*pad&&fitR()){vertical=true;cellH=2*R+fs*1.6+pad*0.5;W=Math.min(side-pad,Math.max(2*R+2*pad,fs*6.2));Hh=n*cellH+pad;x0=rect.x>=W+pad?(rect.x-W)/2:rect.x+rect.w+(CW-rect.x-rect.w-W)/2;y0=top+Math.max(pad,(availH-Hh)*0.1)}
    else{R=Math.max(16,Math.min(44,Math.min(rect.w,rect.h)*0.075));fs=Math.max(10,Math.round(R*0.36));cellW=Math.max(2*R,fs*5.6);W=n*cellW+(n+1)*pad;Hh=2*R+fs*1.6+pad*2;x0=o.corner==='tr'?rect.x+rect.w-W-pad:rect.x+pad}
    ctx.save();
    ctx.fillStyle='rgba(14,16,20,.74)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0,y0,W,Hh,R*0.45);else ctx.rect(x0,y0,W,Hh);ctx.fill();
    let slotI=0; const nextCell=()=>{const i=slotI++;return vertical?[x0+W/2,y0+pad+R+i*cellH]:[x0+pad+cellW/2+i*(cellW+pad),y0+pad+R]};
    const label=(cx,cy,txt)=>{ctx.font=`700 ${fs}px Figtree,system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#F3F1EC';ctx.fillText(txt,cx,cy+R+fs*1.25)};
    const ring=(cx,cy)=>{ctx.strokeStyle='#5A6273';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke()};
    let [cx,cy]=nextCell();
    /* tilt */
    ring(cx,cy);ctx.strokeStyle='rgba(243,241,236,.35)';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(cx-R*0.9,cy);ctx.lineTo(cx+R*0.9,cy);ctx.stroke();ctx.setLineDash([]);
    if(info.tilt!=null){const a=-info.tilt*Math.PI/180;ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=pink;ctx.lineCap='round';ctx.lineWidth=R*0.22;ctx.beginPath();ctx.moveTo(-R*0.72,0);ctx.lineTo(R*0.72,0);ctx.stroke();
      ctx.fillStyle=pink;for(const sx of [-1,1]){ctx.beginPath();ctx.arc(sx*R*0.72,0,R*0.16,0,Math.PI*2);ctx.fill()}ctx.restore()}
    const tt=info.tilt==null?'side-on':Math.abs(info.tilt)<3?'level':(info.tilt>0?'R ':'L ')+Math.round(Math.abs(info.tilt))+'°';
    label(cx,cy,'Tilt '+tt);
    /* sway (and forward/back): path of the hips under the chest */
    [cx,cy]=nextCell(); ring(cx,cy);
    ctx.fillStyle='rgba(243,241,236,.6)';ctx.beginPath();ctx.arc(cx,cy,2.5,0,Math.PI*2);ctx.fill();
    const K=R*2.1, pts=[];
    for(let s=-1.5;s<=0.0001;s+=1/30){const h=flip(hipsAt(B,t+s));if(!h||h.sway==null){pts.push(null);continue}
      pts.push([cx+Math.max(-1,Math.min(1,h.sway*K/R))*R*0.9,cy+(h.thrust!=null?Math.max(-1,Math.min(1,h.thrust*K/R))*R*0.9:0)])}
    ctx.strokeStyle=pink;ctx.lineWidth=Math.max(1.5,R*0.08);ctx.lineCap='round';
    for(let i=1;i<pts.length;i++){if(!pts[i]||!pts[i-1])continue;ctx.globalAlpha=0.1+0.8*i/pts.length;ctx.beginPath();ctx.moveTo(...pts[i-1]);ctx.lineTo(...pts[i]);ctx.stroke()}
    ctx.globalAlpha=1;const last=pts[pts.length-1];if(last){ctx.fillStyle=pink;ctx.beginPath();ctx.arc(last[0],last[1],R*0.17,0,Math.PI*2);ctx.fill()}
    label(cx,cy,'Sway');
    /* turn, seen from above: hips bar with a notch on the front; facing the camera = notch at the bottom */
    if(hasW){[cx,cy]=nextCell();ring(cx,cy);const a=(info.turn||0)*Math.PI/180;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(-a);ctx.strokeStyle=pink;ctx.lineCap='round';ctx.lineWidth=R*0.22;ctx.beginPath();ctx.moveTo(-R*0.7,0);ctx.lineTo(R*0.7,0);ctx.stroke();
        ctx.fillStyle='#F3F1EC';ctx.beginPath();ctx.moveTo(-R*0.2,R*0.18);ctx.lineTo(R*0.2,R*0.18);ctx.lineTo(0,R*0.55);ctx.closePath();ctx.fill();ctx.restore();
      const tu=info.turn, at=Math.abs(tu);
      label(cx,cy,at<15?'Turn front':at>150?'Turn back':'Turn '+(tu>0?'R ':'L ')+Math.round(at)+'°')}
    ctx.restore();
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
  root.RB={CFG,load,track,poseAt,framesOf,draw,drawPelvis,drawMeter,learnLooks,containRect,toMirrorView,cutout,hasCutout,maskIndex,maskCanvas,STRIDE,N,WJ,WS,HS,choose,clean,hipSeries,hipsAt,upgrade};
})(typeof window!=='undefined'?window:globalThis);
/*BODY-END*/
