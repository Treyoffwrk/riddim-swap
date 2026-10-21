# ---- backups keep body tracking (poses, 3D points, hip measures; not the large cut-out masks) ------------------------
rep("""  const body=JSON.stringify({app:'riddim-swap',name:PJ.name||'Routine',saved:new Date().toISOString(),data:snapshot()});""",
    """  const body=JSON.stringify({app:'riddim-swap',name:PJ.name||'Routine',saved:new Date().toISOString(),data:snapshot(),bodies:S.bkBodies||await bodiesForBackup()});""")
rep("""    await projPut(rec); await restore(rec); renderProjects();""",
    """    const nb=await bodiesFromBackup(j.bodies);
    await projPut(rec); await restore(rec); renderProjects();""")
rep("""    sheetMsg('Opened "'+rec.name+'".'+(n?' Re-add the '+n+' file'+(n===1?'':'s')+' listed above.':''));""",
    """    sheetMsg('Opened "'+rec.name+'".'+(nb?' Body tracking for '+nb+' video'+(nb===1?'':'s')+' restored.':'')+(n?' Re-add the '+n+' file'+(n===1?'':'s')+' listed above.':''));""")
rep("""The backup file keeps moves, trims and settings, but not the videos or songs themselves.""",
    """The backup file keeps moves, trims, settings and body tracking, but not the videos, songs or cut-outs (track again for a cut-out).""")
BK_JS = r"""
/* gather body tracking when the Projects sheet opens, so saving the backup can open the share sheet straight from the
   tap (iPhone only allows that right after a tap) */
$('#projBtn').addEventListener('click',()=>{S.bkBodies=null;bodiesForBackup().then(b=>{S.bkBodies=b}).catch(()=>{})});
/* ---------- body tracking in backups ----------
   Poses, 3D points and hip measures go into the backup as base64 (about 0.4 MB for 20 s of video); the per-frame
   cut-out masks don't (about 15 MB). On opening a backup they are stored under the video's key, so they reconnect
   as soon as the same video is added again. */
const f32ToB64=a=>{if(!a)return null;const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const b64ToF32=s=>{if(!s)return null;const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Float32Array(u.buffer)};
async function bodiesForBackup(){
  const out={};
  for(const n of S.sources){if(!n.key)continue;const B=n.body||await mediaGet('body:'+n.key);if(!B||!B.data||!B.n)continue;
    out[n.key]={v:B.v||1,model:B.model,w:B.w,h:B.h,fps:B.fps,n:B.n,seen:B.seen,multi:B.multi||0,clean:B.clean||null,pick:B.pick||null,start:B.start,end:B.end,
      data:f32ToB64(B.data),world:f32ToB64(B.world),hips:f32ToB64(B.hips)}}
  return out;
}
async function bodiesFromBackup(bodies){
  let k=0;if(!bodies||typeof bodies!=='object')return 0;
  for(const [key,o] of Object.entries(bodies)){try{
    if(!o||!o.n||typeof o.data!=='string')continue;const data=b64ToF32(o.data);if(!data||data.length!==o.n*RB.STRIDE)continue;
    const have=await mediaGet('body:'+key);if(have&&have.data&&have.n)continue;   /* never replace tracking already on this phone */
    const B={...o,data,world:b64ToF32(o.world),hips:b64ToF32(o.hips),mask:null};await mediaPut('body:'+key,B);k++}catch(e){}}
  return k;
}
"""
rep("""/* fallback recorder */""", BK_JS + """/* fallback recorder */""")
