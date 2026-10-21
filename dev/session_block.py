# ---- sessions you can reset, and updates that actually arrive ------------------------------------------------------------
rep("""    <p class="hint" id="projMsg" hidden></p>""",
"""    <p class="hint" id="projMsg" hidden></p>
    <div class="field" id="freshBox">
      <span class="label">Start again</span>
      <div class="row">
        <button class="btn" id="freshBtn">Start fresh</button>
        <button class="btn danger" id="wipeBtn">Erase everything…</button>
      </div>
      <p class="hint" id="freshHint">Start fresh saves this project, then restarts the app with new players and sound, on an empty project. Use it if sound or video starts acting up.</p>
      <p class="hint" id="appVer"></p>
    </div>""")
rep("""/* ===== Sound System: the look shared with MirrorView.""","""
.updbar{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:120;display:flex;align-items:center;gap:10px;justify-content:space-between;
  background:var(--dance);color:#0E1014;border-radius:14px;padding:10px 12px;font:700 15px var(--f-body);box-shadow:0 10px 30px rgba(0,0,0,.45);animation:rs-up .4s cubic-bezier(.32,.72,0,1)}
.updbar .btn{background:#0E1014;color:#F3F1EC;border-color:#0E1014;min-height:40px}
#wipeBtn.armed{background:var(--bad);color:#fff;border-color:var(--bad)}
/* ===== Sound System: the look shared with MirrorView.""")
rep("""async function autosave(force){
  if(PJ.busy)return;""","""async function autosave(force){
  if(PJ.busy||S.wiping)return;""")
SESSION_JS = r"""
/* ---------- sessions and updates ----------
   On iPhone a Home Screen app isn't restarted when you come back to it: iOS resumes the same page, sometimes for days,
   so fixes never arrived and a page with tired players kept going. Now: the app notices a new version when you come
   back (or every 10 minutes) and reloads itself when nothing is playing, after saving; otherwise it offers a bar.
   Start fresh restarts on an empty project; Erase everything wipes this phone's copy of the app. */
const UPD={boot:null,checkedAt:0,ready:false};
async function serverVersion(){
  try{const r=await fetch('sw.js?v='+Date.now(),{cache:'no-store'});if(!r.ok)return null;const m=(await r.text()).match(/VERSION='([^']+)'/);return m?m[1]:null}catch(e){return null}
}
function idleNow(){return !S.playing&&!S.rec&&!S.bodyBusy&&!(S.preview)}
async function reloadSaved(){try{await autosave(true)}catch(e){}try{const g=await navigator.serviceWorker?.getRegistration();await g?.update()}catch(e){}location.reload()}
function showUpdateBar(){
  if(document.getElementById('updBar'))return;
  const b=el('div','updbar');b.id='updBar';b.setAttribute('role','status');
  const t=el('span',null,'A new version of Riddim Swap is ready.');const go=el('button','btn sm','Update now');
  go.addEventListener('click',reloadSaved);b.append(t,go);document.body.append(b);
}
async function checkUpdate(onReturn){
  if(!window.RS_HOSTED)return;
  const now=Date.now();if(now-UPD.checkedAt<(onReturn?20000:9*60000))return;UPD.checkedAt=now;
  const v=await serverVersion();if(!v)return;
  if(!UPD.boot){UPD.boot=v;return}
  if(v===UPD.boot)return;
  UPD.ready=true;
  if(onReturn&&idleNow())reloadSaved();else showUpdateBar();
}
if(window.RS_HOSTED){
  serverVersion().then(v=>{UPD.boot=v;UPD.checkedAt=Date.now();$('#appVer').textContent=v?'This version: '+v.replace(/^rs-/,''):''});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(true)});
  setInterval(()=>checkUpdate(false),10*60000);
}
$('#freshBtn').addEventListener('click',async()=>{
  if(S.rec)return; pause(); $('#freshBtn').disabled=true;
  try{await autosave(true)}catch(e){}
  LS.set('rs-proj','');   /* open on an empty project; the saved one stays in Projects */
  try{sessionStorage.setItem('rs-fresh','1')}catch(e){}
  location.reload();
});
if((()=>{try{const f=sessionStorage.getItem('rs-fresh');sessionStorage.removeItem('rs-fresh');return f==='1'}catch(e){return false}})())
  setTimeout(()=>{saveState('Fresh start. Your last project is in Projects.')},300);
/* erase: a second tap within 4 s confirms (no pop-up dialogs, they freeze some phones' web apps) */
let wipeArmed=0;
$('#wipeBtn').addEventListener('click',async()=>{
  const b=$('#wipeBtn');
  if(Date.now()-wipeArmed>4000){wipeArmed=Date.now();b.classList.add('armed');b.textContent='Tap again to erase all projects, videos and songs';
    setTimeout(()=>{if(Date.now()-wipeArmed>=4000){b.classList.remove('armed');b.textContent='Erase everything…'}},4100);return}
  b.disabled=true;b.textContent='Erasing…';if(S.rec)stopRecording();pause();
  const del=n=>new Promise(r=>{try{const q=indexedDB.deleteDatabase(n);q.onsuccess=q.onerror=q.onblocked=()=>r()}catch(e){r()}});
  S.wiping=true;   /* no more saving: leaving the page would otherwise write the project straight back */
  try{if(dbP){const d=await dbP;d.close();dbP=null}}catch(e){}
  await Promise.all(['riddim-swap','riddim-bridge'].map(del));
  try{localStorage.clear()}catch(e){}try{sessionStorage.clear()}catch(e){}
  try{for(const k of await caches.keys())await caches.delete(k)}catch(e){}
  try{for(const g of await navigator.serviceWorker.getRegistrations())await g.unregister()}catch(e){}
  location.replace(location.pathname);
});
"""
rep("""/* test hook: only with #debug in the address */""", SESSION_JS + """/* test hook: only with #debug in the address */""")
rep("""if(/debug/.test(location.hash))window.__rs={""","""if(/debug/.test(location.hash))window.__rs={UPD,checkUpdate,""")
