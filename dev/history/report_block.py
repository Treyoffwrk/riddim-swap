# ---- Phone check: one button that copies what's useful for chasing a phone-only problem ------------------------------------------
rep("""      <p class="hint" id="sndReport"></p>""","""      <p class="hint" id="sndReport"></p>
      <div class="row"><button class="btn" id="phoneCheck">Copy phone check</button></div>
      <textarea id="phoneCheckOut" class="phone-check" readonly hidden aria-label="Phone check"></textarea>
      <p class="hint">Copies the app version, this phone and browser, how takes are recorded, tracking speed, the last sound check, storage and recent errors. No video, names or personal details. Paste it into a message when something goes wrong.</p>""")

# remember the last few errors (message and where only)
rep("""function soundReport(){""","""const ERRS=[];
const noteErr=(m)=>{try{m=String(m||'').slice(0,160);if(!m)return;ERRS.push(new Date().toISOString().slice(11,19)+' '+m);if(ERRS.length>6)ERRS.shift()}catch(e){}};
window.addEventListener('error',e=>noteErr((e.message||'error')+(e.filename?' @'+String(e.filename).split('/').pop()+':'+e.lineno:'')));
window.addEventListener('unhandledrejection',e=>noteErr('promise: '+((e.reason&&(e.reason.message||e.reason.name))||e.reason)));
function soundReport(){""")

rep("""  try{S.rec=useCodecs?startCodecRec():startMrRec();if(""","""  try{S.rec=useCodecs?startCodecRec():startMrRec();S.recLast=S.rec&&S.rec.mode;if(""")

rep("""$('#projBtn').addEventListener('click',()=>{$('#sndReport').textContent=soundReport()});""","""$('#projBtn').addEventListener('click',()=>{$('#sndReport').textContent=soundReport()});
async function phoneCheck(){
  const L=[],add=(k,v)=>{if(v!=null&&v!=='')L.push(k+': '+v)};
  L.push('Riddim Swap phone check');
  add('Version',(UPD&&UPD.boot)||'unknown'); add('When',new Date().toISOString().slice(0,16).replace('T',' ')+' UTC');
  add('Browser',navigator.userAgent);
  const sa=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  add('Screen',`${screen.width}×${screen.height} @${(window.devicePixelRatio||1).toFixed(1)}x, ${sa?'Home Screen app':'in the browser'}, ${navigator.hardwareConcurrency||'?'} cores${navigator.deviceMemory?', '+navigator.deviceMemory+' GB':''}`);
  let mr='none';try{if(window.MediaRecorder){const t=['video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x));mr=t||'yes (no listed type)'}}catch(e){}
  add('Recording',`WebCodecs ${canCodecs()?'yes':'no'} · MediaRecorder ${mr}${S.recLast?' · last take used '+(S.recLast==='mr'?'MediaRecorder':'WebCodecs'):''}`);
  const ti=$('#takeInfo');if(S.recLast&&ti&&ti.textContent)add('Last take',ti.textContent.replace(/\\s+/g,' ').trim());
  const bodies=S.sources.map(n=>n.body).filter(B=>B&&B.n);
  if(bodies.length){const B=bodies.find(x=>x.msPerFrame)||bodies[0];add('Tracking',`${bodies.length} video${bodies.length>1?'s':''} tracked · ${B.msPerFrame?Math.round(B.msPerFrame)+' ms/frame':'speed not recorded'} · ${B.delegate||'?'} · ${B.n} frames${B.fps?' at '+Math.round(B.fps)+' fps':''}`)}
  else add('Tracking','no video tracked in this project');
  add('Sound',soundReport()||'no play measured yet');
  try{const sb=(S.mainSong&&S.mainSong.buf)||buf;add('Audio',`song decoded at ${(sb&&sb.sampleRate)||'?'} Hz · live sound engine ${ctx?'open ('+ctx.state+', '+ctx.sampleRate+' Hz)':'closed'}`)}catch(e){}
  try{const r=await storageScan();const t=r.total!=null?Math.max(r.total,r.media+r.body+r.unused+r.projects):null;
    add('Storage',`${fmtMB(t)} in use${r.quota?' of '+fmtMB(r.quota):''} · media ${fmtMB(r.media)} · tracking ${fmtMB(r.body)} · unused ${fmtMB(r.unused)} · ${r.projectsN} project${r.projectsN===1?'':'s'} · ${r.persisted?'kept safe':'may be cleared by the browser'}`)}catch(e){add('Storage','couldn’t read')}
  add('Errors',ERRS.length?'\\n  '+ERRS.join('\\n  '):'none this session');
  return L.join('\\n');
}
$('#phoneCheck').addEventListener('click',async()=>{const b=$('#phoneCheck'),out=$('#phoneCheckOut');b.disabled=true;
  let txt='';try{txt=await phoneCheck()}catch(e){txt='Phone check failed: '+(e&&e.message)}
  out.value=txt;out.hidden=false;out.style.height='';out.style.height=Math.min(320,out.scrollHeight+4)+'px';
  let ok=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(txt);ok=true}}catch(e){}
  if(!ok){try{out.focus();out.select();ok=document.execCommand&&document.execCommand('copy')}catch(e){}}
  sheetMsg(ok?'Phone check copied. Paste it into a message.':'Select the text below and copy it.');b.disabled=false});""")

rep("""#storeBox .store-bar{""",""".phone-check{width:100%;box-sizing:border-box;margin:8px 0 4px;padding:10px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.1));background:var(--sunk);color:inherit;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;min-height:120px}
#storeBox .store-bar{""")

# a take (or a play too short to measure) starts a fresh count; keep the last real one for the report
rep("""  S.playAt=performance.now(); S.snd={jumps:0""","""  S.playAt=performance.now(); if(S.snd&&S.snd.frames>10){S.snd.endAt=S.snd.endAt||performance.now();S.sndLast=S.snd} S.snd={jumps:0""")
rep("""function soundReport(){const s=S.snd;if(!s||!s.frames)return '';""","""function soundReport(){const s=(S.snd&&S.snd.frames>10)?S.snd:S.sndLast;if(!s||!s.frames)return '';""")
rep("""  return `Last play: song and video within 40 ms ${pct}% of the time, largest gap ${Math.round(s.maxLate*1000)} ms, ${s.jumps} song jump${s.jumps===1?'':'s'}${s.stalls?`, ${s.stalls} video stall${s.stalls>1?'s':''}`:''} (over ${Math.round(secs)} s).`}""","""  const span=((s.endAt||performance.now())-s.started)/1000, fps=span>0.5?Math.round(s.frames/span):0;
  return `Last play: song and video within 40 ms ${pct}% of the time, largest gap ${Math.round(s.maxLate*1000)} ms, ${s.jumps} song jump${s.jumps===1?'':'s'}${s.stalls?`, ${s.stalls} video stall${s.stalls>1?'s':''}`:''} (over ${Math.round(span)} s, screen ${fps} fps).`}""")
rep("""function pause(){S.stopAtT=null;setPlaying(false);""","""function pause(){S.stopAtT=null;if(S.snd&&!S.snd.endAt&&S.playing)S.snd.endAt=performance.now();setPlaying(false);""")
