# ---- Storage: what the app keeps on the phone, and clearing what no project uses -----------------------------------------------
rep("""    <div class="field" id="freshBox">""","""    <div class="field" id="storeBox">
      <span class="label">Storage on this phone</span>
      <div class="store-bar" id="storeBar" aria-hidden="true"><i class="u-media"></i><i class="u-body"></i><i class="u-unused"></i><i class="u-other"></i></div>
      <ul class="store-list" id="storeList"><li>Checking…</li></ul>
      <div class="row">
        <button class="btn" id="storeClean" disabled>Clear unused</button>
      </div>
      <p class="hint" id="storeHint">Unused means videos, songs and dance tracking that no saved project uses any more. Your projects are not touched.</p>
    </div>
    <div class="field" id="freshBox">""")

rep("""function sheetMsg(t,err){""","""/* what to keep: everything the open project or any saved project points at */
async function mediaKeep(){
  const keep=new Set(); S.sources.forEach(n=>n.key&&keep.add(n.key)); [S.mainSong,S.rtSong].forEach(so=>so&&so.key&&keep.add(so.key));
  (await projAll()).forEach(p=>{try{const d=JSON.parse(p.data);(d.sources||[]).forEach(m=>m&&m.key&&keep.add(m.key));[d.mainSong,d.rtSong].forEach(m=>m&&m.key&&keep.add(m.key))}catch(e){}});
  return keep;
}
const isKept=(keep,k)=>keep.has(k)||(String(k).startsWith('body:')&&keep.has(String(k).slice(5)));
function sizeOf(v){
  if(!v)return 0; if(typeof Blob!=='undefined'&&v instanceof Blob)return v.size;
  if(v.data&&v.data.byteLength!=null){let s=2048;for(const f of ['data','world','hips'])if(v[f]&&v[f].byteLength)s+=v[f].byteLength;return s}
  if(v.byteLength!=null)return v.byteLength;
  try{return JSON.stringify(v).length}catch(e){return 0}
}
/* walk the media store with a cursor so nothing is read twice; blobs stay on disk, only their size is asked */
async function storageScan(){
  const keep=await mediaKeep(), out={media:0,body:0,unused:0,unusedN:0,projects:0,projectsN:0,total:null,quota:null,persisted:null};
  await idb().then(d=>new Promise((res,rej)=>{const t=d.transaction('media','readonly'),r=t.objectStore('media').openCursor();
    r.onsuccess=()=>{const c=r.result;if(!c)return;const k=String(c.key),sz=sizeOf(c.value);
      if(!isKept(keep,k)){out.unused+=sz;out.unusedN++}else if(k.startsWith('body:'))out.body+=sz;else out.media+=sz;c.continue()};
    t.oncomplete=res;t.onerror=()=>rej(t.error)})).catch(()=>{});
  (await projAll()).forEach(p=>{out.projectsN++;out.projects+=(p.data||'').length*2});
  try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();out.total=e.usage;out.quota=e.quota}}catch(e){}
  try{if(navigator.storage&&navigator.storage.persisted)out.persisted=await navigator.storage.persisted()}catch(e){}
  return out;
}
const fmtMB=b=>b==null?'?':b<1048576*0.1?(b/1024).toFixed(0)+' KB':b<1073741824?(b/1048576).toFixed(b<10485760?1:0)+' MB':(b/1073741824).toFixed(2)+' GB';
let storeLast=null;
async function renderStorage(){
  const list=$('#storeList');if(!list)return;
  let r;try{r=await storageScan()}catch(e){list.innerHTML='<li>Couldn’t read storage on this browser.</li>';return}
  storeLast=r;
  if(r.total!=null)r.total=Math.max(r.total,r.media+r.body+r.unused+r.projects);   /* the browser's figure can lag behind fresh writes */
  const ours=r.media+r.body+r.unused+r.projects, other=r.total!=null?Math.max(0,r.total-ours):0, all=Math.max(1,ours+other);
  const bar=$('#storeBar').children; [r.media,r.body,r.unused,other].forEach((v,i)=>{bar[i].style.width=(100*v/all).toFixed(2)+'%'});
  const li=(c,t,v)=>`<li><i class="dot ${c}"></i><span>${t}</span><b>${v}</b></li>`;
  list.innerHTML=li('u-media','Videos and songs',fmtMB(r.media))+li('u-body','Dance tracking',fmtMB(r.body))
    +li('u-unused','Unused'+(r.unusedN?' ('+r.unusedN+' item'+(r.unusedN>1?'s':'')+')':''),fmtMB(r.unused))
    +li('u-proj','Projects ('+r.projectsN+')',fmtMB(r.projects))
    +(r.total!=null?li('u-other','App and tracker files, about',fmtMB(other)):'')
    +(r.total!=null?`<li class="tot"><span>In use${r.quota?' of about '+fmtMB(r.quota)+' allowed':''}</span><b>${fmtMB(r.total)}</b></li>`:'')
    +(r.persisted===false?'<li class="warn"><span>The browser may clear these files if the phone runs low on space. Adding the app to your Home Screen makes that less likely.</span></li>':'')
    +(r.persisted===true?'<li class="ok"><span>Kept safe: the browser won’t clear these on its own.</span></li>':'');
  const b=$('#storeClean');b.disabled=!r.unusedN;b.textContent=r.unusedN?'Clear unused ('+fmtMB(r.unused)+')':'Nothing unused';
}
function sheetMsg(t,err){""")

rep("""function openSheet(){sheetFrom=document.activeElement;$('#sheet').hidden=false;""","""function openSheet(){sheetFrom=document.activeElement;renderStorage();$('#sheet').hidden=false;""")

# cleanMedia now shares the keep rule, and the button uses it
rep("""async function cleanMedia(){
  try{
    const keep=new Set(); S.sources.forEach(n=>n.key&&keep.add(n.key)); [S.mainSong,S.rtSong].forEach(so=>so&&so.key&&keep.add(so.key));
    (await projAll()).forEach(p=>{try{const d=JSON.parse(p.data);(d.sources||[]).forEach(m=>keep.add(m.key));[d.mainSong,d.rtSong].forEach(m=>m&&keep.add(m.key))}catch(e){}});
    const keys=await idbDo('media','readonly',st=>st.getAllKeys());
    for(const k of keys||[])if(!keep.has(k)&&!(String(k).startsWith('body:')&&keep.has(String(k).slice(5))))await mediaDel(k);
  }catch(e){}
}""","""async function cleanMedia(){
  let n=0;
  try{
    if(S.wiping)return 0; try{await autosave(true)}catch(e){}       /* the open project counts as saved before anything goes */
    const keep=await mediaKeep();
    const keys=await idbDo('media','readonly',st=>st.getAllKeys());
    for(const k of keys||[])if(!isKept(keep,k)){await mediaDel(k);n++}
  }catch(e){}
  return n;
}
$('#storeClean').addEventListener('click',async()=>{const b=$('#storeClean');b.disabled=true;const before=storeLast&&storeLast.unused;
  const n=await cleanMedia();sheetMsg(n?'Cleared '+n+' unused item'+(n>1?'s':'')+(before?' ('+fmtMB(before)+')':'')+'.':'Nothing to clear.');renderStorage()});""")

rep("""</style>""","""#storeBox .store-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--sunk);margin:2px 0 8px}
#storeBox .store-bar i{display:block;height:100%;transition:width .4s cubic-bezier(.2,.8,.2,1)}
#storeBox .u-media{background:var(--song-hot,#E8A33D)}#storeBox .u-body{background:var(--dance,#5B7CFA)}#storeBox .u-unused{background:#E0567A}#storeBox .u-other{background:#5d6170}#storeBox .u-proj{background:#9AA0B4}
#storeBox .store-list{list-style:none;margin:0 0 8px;padding:0;font-size:13px}
#storeBox .store-list li{display:flex;align-items:center;gap:8px;padding:3px 0}
#storeBox .store-list li span{flex:1}#storeBox .store-list li b{font-weight:600;font-variant-numeric:tabular-nums}
#storeBox .store-list .dot{width:8px;height:8px;border-radius:50%;flex:none}
#storeBox .store-list .tot{border-top:1px solid var(--line,rgba(255,255,255,.1));margin-top:4px;padding-top:6px}
#storeBox .store-list .warn span,#storeBox .store-list .ok span{opacity:.75;font-size:12px}
</style>""",)
