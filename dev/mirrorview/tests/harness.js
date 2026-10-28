/* Shared test harness: headless Chromium with MediaPipe CDN requests served from local test copies
   (same tasks-vision 0.10.18 package from npm; pose_landmarker_lite.task from an npm package; labelled as test copies). */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const TA='/home/claude/mv/testassets';
async function launch(opts={}){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  const ctx=await b.newContext({viewport:opts.viewport||{width:390,height:844},acceptDownloads:true,permissions:['camera'],serviceWorkers:opts.sw?'allow':'block'});
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.18\/(.*)/,async r=>{const rel=r.request().url().split('tasks-vision@0.10.18/')[1].split('?')[0];
    const f=path.join(TA,'tasks-vision',rel);if(!fs.existsSync(f))return r.fulfill({status:404});
    const ct=rel.endsWith('.wasm')?'application/wasm':rel.endsWith('.mjs')||rel.endsWith('.js')?'text/javascript':'application/octet-stream';
    r.fulfill({status:200,headers:{'content-type':ct,'access-control-allow-origin':'*'},body:fs.readFileSync(f)})});
  await ctx.route(/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_full\//,r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(TA,'pose_landmarker_full.task'))}));
  await ctx.route(/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_lite\//,r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(TA,'pose_landmarker_lite.task'))}));
  await ctx.route(/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_heavy\//,r=>r.fulfill({status:200,headers:{'content-type':'application/octet-stream','access-control-allow-origin':'*'},body:fs.readFileSync(path.join(TA,'pose_landmarker_heavy.task'))}));
  /* tests track with the regular model for speed, unless RB_HEAVY=1 (the app's default, Accurate, is the heavy one) */
  if(!process.env.RB_HEAVY)await ctx.addInitScript(()=>{if(!window.RB_MODEL)window.RB_MODEL='full'});
  /* ONNX Runtime Web (RTMPose trial) from the local npm copy */
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@[^/]+\/dist\/(.*)/,async r=>{const rel=r.request().url().split('/dist/')[1].split('?')[0];
    const f=path.join('/tmp/claude-0/-home-claude/c7d6fa6b-e9dd-5d62-903e-3e4d46a3b3b0/scratchpad/node_modules/onnxruntime-web/dist',rel);if(!fs.existsSync(f))return r.fulfill({status:404});
    const ct=rel.endsWith('.wasm')?'application/wasm':rel.endsWith('.mjs')||rel.endsWith('.js')?'text/javascript':'application/octet-stream';
    r.fulfill({status:200,headers:{'content-type':ct,'access-control-allow-origin':'*'},body:fs.readFileSync(f)})});
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({status:200,body:''}));
  return {b,ctx};
}
module.exports={launch};
