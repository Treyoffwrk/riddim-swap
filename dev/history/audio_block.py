# ---- steady sound on iPhone: no live audio engine unless it's needed, decode at a fixed rate ------------------------------
AUDIO_JS = r"""
/* ---------- sound that stays clean on iPhone ----------
   Songs used to be decoded through the live audio engine (AudioContext) and re-saved at whatever rate the phone's
   audio was running at. That rate drops (16 or 24 kHz) during a call or with a Bluetooth headset's microphone, and it
   can change while the app is in the background, so the song file could come out muffled or scratchy. The engine
   also stayed open for the whole session, and iOS is known to garble page audio when an engine comes back from the
   background at a different rate. Now: songs are decoded offline at a fixed 44.1 kHz (no audio hardware involved);
   the live engine exists only for the beat click and the fallback recorder, and is closed whenever the app leaves
   the screen. */
const SONG_RATE=44100;
function decodeAudio(ab){
  const O=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!O)return new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej));
  let oc;try{oc=new O(2,SONG_RATE,SONG_RATE)}catch(e){return new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej))}
  return new Promise((res,rej)=>{const p=oc.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)});
}
function closeCtx(){
  if(!ctx)return; const c=ctx; ctx=null; recDest=null; try{c.close().catch(()=>{})}catch(e){}
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(!S.rec)closeCtx();S.awayAt=Date.now();return}
  /* back: the song player may have been interrupted while away; give it a fresh start when nothing is playing */
  const away=S.awayAt?Date.now()-S.awayAt:0; S.awayAt=0;
  if(away>3000&&!S.playing&&!S.rec&&S.liveSong&&S.liveSong.blob&&typeof refreshSong==='function')refreshSong();
});
window.addEventListener('pagehide',()=>{if(!S.rec)closeCtx()});
"""
rep("""function getCtx(){if(!ctx){const C=window.AudioContext||window.webkitAudioContext;ctx=new C()}return ctx}""",
    """function getCtx(){if(!ctx){const C=window.AudioContext||window.webkitAudioContext;ctx=new C({latencyHint:'interactive'});
  /* a call, Siri or another app took the sound: drop this engine; a fresh one is made the next time it's needed */
  ctx.onstatechange=()=>{if(ctx&&ctx.state==='interrupted'&&!S.rec)closeCtx()}}return ctx}""")
rep("""    .then(ab=>new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej)))""","""    .then(ab=>decodeAudio(ab))""")
rep("""const ab=await blob.arrayBuffer(); const dec=await new Promise((res,rej)=>getCtx().decodeAudioData(ab,res,rej));""",
    """const ab=await blob.arrayBuffer(); const dec=await decodeAudio(ab);""")
rep("""  if(ctx&&ctx.state!=='running')ctx.resume().catch(()=>{});
  S.primed=null; return n;""","""  S.primed=null; return n;""")
rep("""function play(){
  S.playAt=performance.now();""","""function play(){
  S.playAt=performance.now();
  /* the beat click needs the live engine, started inside the tap */
  if(S.clickOn){try{const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{})}catch(e){}}""")
rep("""/* fallback recorder */""", AUDIO_JS + """/* fallback recorder */""")
rep("""if(/debug/.test(location.hash))window.__rs={S,""","""if(/debug/.test(location.hash))window.__rs={get audioCtx(){return ctx},get songBuf(){return buf},S,""")
