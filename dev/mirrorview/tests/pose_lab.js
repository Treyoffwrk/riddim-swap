/* Pose lab: track a clip with several settings and save every pose found (image and world landmarks) for analysis.
   Usage: node pose_lab.js <host page> <clip.webm> <out.json> <mode IMAGE|VIDEO> <numPoses> [model full|heavy|lite] */
const {launch}=require('./harness');const fs=require('fs');
const [,,HOST,CLIP,OUT,MODE,NP,MODEL]=process.argv;
(async()=>{const {b,ctx}=await launch();
  if(MODEL==='heavy')await ctx.route(/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_heavy\//,r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','access-control-allow-origin':'*'},body:fs.readFileSync('/home/claude/mv/testassets/pose_landmarker_heavy.task')}));
  const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto(HOST);
  const url=await p.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bin],{type:'video/webm'}))},fs.readFileSync(CLIP).toString('base64'));
  const res=await p.evaluate(async([url,mode,np,model])=>{
    const sdk=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs');
    const files=await sdk.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
    const mu=`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${model}/float16/1/pose_landmarker_${model}.task`;
    const buf=new Uint8Array(await (await fetch(mu)).arrayBuffer());
    const task=await sdk.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer:buf,delegate:'CPU'},runningMode:mode,numPoses:np,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
    const v=document.createElement('video');v.muted=true;v.src=url;document.body.append(v);await new Promise(r=>v.onloadeddata=r);
    const W=v.videoWidth,H=v.videoHeight,sc=Math.min(1,640/Math.max(W,H)),cv=document.createElement('canvas');cv.width=Math.round(W*sc);cv.height=Math.round(H*sc);const cx=cv.getContext('2d');
    const fps=30,out=[];const dur=v.duration;
    const seek=t=>new Promise(r=>{let d=false;const f=m=>{if(!d){d=true;r(m)}};v.requestVideoFrameCallback((n,m)=>f(m.mediaTime));v.addEventListener('seeked',()=>setTimeout(()=>f(null),150),{once:true});v.currentTime=t});
    const t0=performance.now();
    for(let k=0;;k++){const want=(k+0.5)/fps;if(want>dur)break;const mt=await seek(want);const t=mt!=null?mt:want;
      cx.drawImage(v,0,0,cv.width,cv.height);
      const r=mode==='VIDEO'?task.detectForVideo(cv,Math.round(t*1000)+k*0.001):task.detect(cv);
      out.push({t,poses:(r.landmarks||[]).map((L,i)=>({k:L.map(q=>[+q.x.toFixed(5),+q.y.toFixed(5),+q.z.toFixed(5),+(q.visibility||0).toFixed(3)]),w:(r.worldLandmarks&&r.worldLandmarks[i]||[]).map(q=>[+q.x.toFixed(4),+q.y.toFixed(4),+q.z.toFixed(4)])}))})}
    return {W,H,fps,ms:(performance.now()-t0)/out.length,frames:out};
  },[url,MODE,+NP,MODEL||'full']);
  fs.writeFileSync(OUT,JSON.stringify(res));console.log('frames',res.frames.length,'ms/frame',res.ms.toFixed(0),'multi',res.frames.filter(f=>f.poses.length>1).length,'none',res.frames.filter(f=>!f.poses.length).length);
  await b.close()})();
