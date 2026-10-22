# ---- share a routine: one file with the project, its videos, songs and body tracking ------------------------------------
rep("""      <label class="btn file">Open backup file<input type="file" id="projImport" accept=".json,application/json"></label>""",
    """      <button class="btn" id="projShare">Share routine with videos</button>
      <label class="btn file">Open backup or shared routine<input type="file" id="projImport"></label>""")
SH_JS = r"""
/* ---------- sharing a routine ----------
   A .riddim file: a short text header, then the project (moves, routine, trims, speeds, song points), body tracking
   (poses, 3D points, hips; not the cut-out masks) and the videos and songs themselves, one after another. Built from
   the stored files without copying them into memory first. Opening it stores the media under their own keys, so the
   project opens ready to play; files already on the phone are kept, not replaced. */
const BUNDLE_MAGIC='RIDDIMSWAP1\n';
async function buildBundle(){
  await autosave(true);
  const data=snapshot(),keys=[];
  for(const n of S.sources)if(n.key&&!keys.includes(n.key))keys.push(n.key);
  for(const so of [S.mainSong,S.rtSong])if(so&&so.key&&!keys.includes(so.key))keys.push(so.key);
  const media=[],parts=[];let off=0,missing=0;
  for(const k of keys){const f=await mediaGet(k);if(!f){missing++;continue}
    media.push({key:k,name:f.name||k.split('|')[0],type:f.type||'',size:f.size,lastModified:f.lastModified||0,offset:off,length:f.size});parts.push(f);off+=f.size}
  const header=JSON.stringify({app:'riddim-swap',kind:'routine',v:1,name:PJ.name||'Routine',saved:new Date().toISOString(),data,bodies:S.bkBodies||await bodiesForBackup(),media});
  const hb=new TextEncoder().encode(header),len=new Uint8Array(4);new DataView(len.buffer).setUint32(0,hb.length,true);
  return {blob:new Blob([BUNDLE_MAGIC,len,hb,...parts],{type:'application/octet-stream'}),media:media.length,missing,bytes:off};
}
async function readBundle(file){
  const head=await file.slice(0,16).arrayBuffer(),magic=new TextDecoder().decode(new Uint8Array(head,0,BUNDLE_MAGIC.length));
  if(magic!==BUNDLE_MAGIC)return null;
  const hl=new DataView(head,BUNDLE_MAGIC.length,4).getUint32(0,true),start=BUNDLE_MAGIC.length+4;
  const j=JSON.parse(await file.slice(start,start+hl).text());if(j.app!=='riddim-swap'||j.kind!=='routine'||!j.data)throw new Error('not ours');
  const base=start+hl;let added=0;
  const end=base+(j.media||[]).reduce((m,x)=>Math.max(m,x.offset+x.length),0);if(file.size<end)throw new Error('incomplete file');
  for(const m of j.media||[]){const have=await mediaGet(m.key);if(have)continue;
    const part=file.slice(base+m.offset,base+m.offset+m.length);if(part.size!==m.length)throw new Error('incomplete file');
    await mediaPut(m.key,new File([part],m.name,{type:m.type,lastModified:m.lastModified}));added++}
  const nb=await bodiesFromBackup(j.bodies);
  return {j,added,nb};
}
$('#projShare').addEventListener('click',async()=>{
  if(!hasContent()){sheetMsg('Add a video or some moves first.',true);return}
  const b=$('#projShare');b.disabled=true;sheetMsg('Packing the routine…');
  try{
    const r=await buildBundle();
    const safe=(PJ.name||'routine').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'routine';
    const res=await saveFile(safe+'.riddim',r.blob,'application/octet-stream');
    const mb=(r.blob.size/1048576).toFixed(r.blob.size>10485760?0:1);
    sheetMsg(res==='saved'||res==='shared'||res==='downloaded'?`Routine shared (${mb} MB, ${r.media} video and song file${r.media===1?'':'s'}${r.missing?`; ${r.missing} file${r.missing>1?'s':''} weren't on this phone`:''}). They open it with "Open backup or shared routine".`:saveWords[res],res==='failed'||res==='busy');
  }catch(e){sheetMsg("Couldn't pack the routine: "+((e&&e.message)||e),true)}
  finally{b.disabled=false}
});
"""
rep("""/* fallback recorder */""", SH_JS + """/* fallback recorder */""")
# opening: a shared routine or a backup, whichever the file is
rep("""  const f=e.target.files[0]; e.target.value=''; if(!f)return;
  try{
    const j=JSON.parse(await f.text()); if(j.app!=='riddim-swap'||!j.data)throw new Error('not ours');""",
"""  const f=e.target.files[0]; e.target.value=''; if(!f)return;
  try{
    sheetMsg('Opening…');
    const sh=await readBundle(f).catch(err=>{throw err});
    if(sh){await autosave(true);
      const rec={id:'p'+Date.now().toString(36),name:(sh.j.name||'Shared routine'),updated:Date.now(),data:JSON.stringify(sh.j.data)};
      await projPut(rec); await restore(rec); renderProjects();
      const n=missingItems().length;
      sheetMsg('Opened "'+rec.name+'"'+(sh.added?' with its '+sh.added+' video and song file'+(sh.added===1?'':'s'):'')+'.'+(sh.nb?' Body tracking for '+sh.nb+' video'+(sh.nb===1?'':'s')+' included.':'')+(n?' '+n+' file'+(n===1?' is':'s are')+' still missing.':' Ready to play.'));
      return}
    const j=JSON.parse(await f.text()); if(j.app!=='riddim-swap'||!j.data)throw new Error('not ours');""")
rep("""  }catch(err){sheetMsg("That file isn't a Riddim Swap backup.",true)}""","""  }catch(err){sheetMsg("That file isn't a Riddim Swap backup or shared routine"+(err&&/incomplete/.test(err.message)?' (it looks cut short: try sending it again)':'')+'.',true)}""")
