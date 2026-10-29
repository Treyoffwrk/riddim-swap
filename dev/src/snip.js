/* ---------- Snip: build a choreography while you watch ----------
   Play any clip and tap Start from where a move begins and Finish here where it ends, again and again (switching clips
   whenever you like). Each pair becomes a move, added to the end of the routine in order.
   Snapping (with a song beat): Start from moves to the nearest beat you hear; each snippet is then made a whole number of
   8-counts (or 4s, or single counts), so the next one starts on a 1 and there are no gaps. The first snippet of an empty
   routine sets where the routine's song starts: the music you heard at Start from, moved to the nearest 1.
   Play routine plays them back to back, on repeat. Finish here with no new Start from carries on from where the last
   snippet ended (same clip), so you can chop a long phrase into pieces. Undo takes the last snippet back off. */
const SNIP={unit:8};
try{const u=localStorage.getItem('rs-snip-unit');if(u!=null&&[0,1,4,8].includes(+u))SNIP.unit=+u}catch(e){}
function snipSay(t){const m=$('#snipMsg');if(m)m.textContent=t}
/* one count of the routine song, in output seconds */
function snipOutBeat(){return S.sBase?60/(S.sBase*S.rt.ar):null}
function snipCounts(x){const b=beatLen(rateOf(x));return b?(x.e-x.s)/b:null}
/* Start from: the nearest beat of the song as heard with this clip (within half a beat) */
function snipBeat(t){
  let B=null;try{B=clipBeatTimes()}catch(e){}
  if(!B)return {t,snapped:false};
  let best=t,bd=1e9;for(const b of B){const d=Math.abs(b-t);if(d<bd){bd=d;best=b}}
  const p=(B[B.length-1]-B[0])/(B.length-1);return bd<p*0.5?{t:Math.max(0,best),snapped:true}:{t,snapped:false};
}
function snipOn(){
  if(!S.hasV||S.rec)return;
  if(S.learn)learnOff(); if(S.study)studyOff(); needWhole();
  S.snip={a:null,src:null,thumb:'',chain:null,made:[]};
  snipSay(S.sBase?'Play any clip. Tap Start from where a move begins and Finish here where it ends. Each one is added to the routine, in order, snapped to the counts.'
    :'Play any clip. Tap Start from where a move begins and Finish here where it ends. Each one is added to the routine, in order. (No song beat yet, so snippets are kept exactly as marked. Add a song to snap them to counts.)');
  snipUI();
}
function snipOff(){S.snip=null;snipUI()}
function snipStart(){
  const P=S.snip;if(!P||!S.hasV)return; if(routineOn())needWhole();
  const r=snipBeat(v.currentTime); P.a=+r.t.toFixed(3); P.src=S.cur; P.thumb=grabThumb();
  const n=srcById(S.cur);
  snipSay(`Start from ${fmt2(P.a)}${S.sources.length>1&&n?' on V'+n.num:''}${r.snapped?' (on the beat)':''}. Tap Finish here where the move ends.`);
  snipUI();
}
function snipFinish(){
  const P=S.snip;if(!P||!S.hasV)return; if(routineOn())needWhole();
  const t=v.currentTime; let a=P.a, src=P.src, thumb=P.thumb;
  if(a==null||src!==S.cur){
    if(P.chain&&P.chain.src===S.cur&&t>P.chain.t+0.25){a=P.chain.t;src=S.cur;thumb=''}
    else{snipSay(a!=null?'Start from was marked on another video. Tap Start from here first.':'Tap Start from first, where the move begins.');return}}
  if(t<a+0.25){snipSay('Finish here has to come after Start from. Play on a little, then tap it.');return}
  const n=srcById(src), dur=(n&&n.dur)||v.duration||t+10;
  /* the first snippet of an empty routine: the routine's song starts with the music you heard at Start from, on a 1 */
  const first=!S.seq.length, rt0={offset:S.rt.offset,ar:S.rt.ar,vr:S.rt.vr,set:S.rt.set};
  if(first){
    if(!S.rtSong){S.rt.ar=S.main.ar;S.rt.vr=S.main.vr;S.rt.offset=S.main.offset+((a-S.cIn)/S.main.vr)*S.main.ar}
    else if(!S.rt.set){S.rt.offset=S.main.offset;S.rt.ar=S.main.ar;S.rt.vr=S.main.vr}
    S.rt.set=true;
    if(SNIP.unit>=4){const G=songGrid(routineSong()),D=G&&(G.down&&G.down.length?G.down:null);
      if(D){let best=S.rt.offset,bd=1e9;for(const d of D){const q=Math.abs(d-S.rt.offset);if(q<bd){bd=q;best=d}}S.rt.offset=+best.toFixed(3)}}
    S.rt.offset=+S.rt.offset.toFixed(3);
  }
  const m={id:'m'+(++moveCount),name:'Snippet '+moveCount,src,s:+a.toFixed(3),e:+t.toFixed(3),thumb:thumb||grabThumb()};
  S.moves.push(m);
  const x=newEntry(m.id);
  /* a whole number of 8-counts (or 4s, or counts), so the next snippet starts on a 1 */
  const b=beatLen(rateOf(x)), G=songGrid(routineSong()), r=rateOf(x);
  if(SNIP.unit&&G&&G.beats&&G.beats.length>8){
    /* on the routine song's own beats: the snippet ends exactly where the song is U, 2U… counts on from where it starts */
    const B=G.beats.slice(), p1=B[B.length-1]-B[B.length-2], s0=S.rt.offset+seqTotal()*S.rt.ar, U=SNIP.unit;
    let i0=0,bd=1e9;B.forEach((q,i)=>{const d=Math.abs(q-s0);if(d<bd){bd=d;i0=i}});
    const endAt=k=>{while(B.length<=i0+k*U)B.push(B[B.length-1]+p1);return a+(B[i0+k*U]-s0)/S.rt.ar*r};
    const want=t-a;let k=1,best=1e9;for(let q=1;q<200;q++){const e=endAt(q);if(e>dur+0.02)break;const d=Math.abs(e-t);if(d<best){best=d;k=q}if(e>t+want)break}
    let e=endAt(k);if(e>dur+0.02){let j=1;while(i0+j+1<B.length&&a+(B[i0+j+1]-s0)/S.rt.ar*r<=dur)j++;e=Math.min(dur,a+(B[i0+j]-s0)/S.rt.ar*r)}
    x.e=m.e=+e.toFixed(3);
  }
  else if(b&&SNIP.unit){
    const U=SNIP.unit*b;let k=Math.max(1,Math.round((t-a)/U));while(k>1&&a+k*U>dur+0.02)k--;let e=a+k*U;
    if(e>dur+0.02){const kb=Math.floor((dur-a)/b);e=kb>=1?a+kb*b:dur}
    x.e=m.e=+e.toFixed(3);
  }
  S.seq.push(x); S.useSeq=false;
  P.made.push({mid:m.id,uid:x.uid,rt0:first?rt0:null}); P.chain={src,t:x.e}; P.a=null; P.thumb='';
  seqChanged(false);
  const c=snipCounts(x);
  snipSay(`Snippet ${S.seq.length} added${c?': '+Math.round(c)+(Math.round(c)===1?' count':' counts'):''} (${fmt2(x.s)}–${fmt2(x.e)}${S.sources.length>1&&n?' on V'+n.num:''}). Next: Start from again, or Finish here to carry on from ${fmt2(x.e)}.`);
  snipUI();
}
function snipUndo(){
  const P=S.snip;if(!P||!P.made.length)return; const u=P.made.pop();
  S.seq=S.seq.filter(x=>x.uid!==u.uid); S.moves=S.moves.filter(m=>m.id!==u.mid);
  if(u.rt0)Object.assign(S.rt,u.rt0);
  const last=S.seq[S.seq.length-1], lm=last&&moveById(last.id); P.chain=lm?{src:lm.src,t:last.e}:null; P.a=null;
  seqChanged(false); snipSay('Took the last snippet back off.'); snipUI();
}
function snipPlay(){
  if(!S.seq.length)return; snipOff(); S.loop=true; setMode(true); updateTrim(); play();
}
function snipTotal(){
  const ob=snipOutBeat(), T=seqTotal(); return {n:S.seq.length,counts:ob?T/ob:null,secs:T};
}
function snipUI(){
  const P=S.snip, btn=$('#snipBtn'); btn.setAttribute('aria-pressed',String(!!P)); btn.disabled=!S.hasV||!!S.rec;
  $('#snipStrip').hidden=!P; $('#snipBar').hidden=!P; document.querySelector('.pin').classList.toggle('snipping',!!P);
  if(!P)return;
  if(S.rec){snipOff();return}
  const tot=snipTotal(), cnt=tot.counts!=null?Math.round(tot.counts)+' counts':fmt(tot.secs);
  $('#snipCount').textContent=tot.n?`${tot.n} in the routine · ${cnt}`:'Routine is empty';
  $('#snipWhat').textContent=P.a!=null?'from '+fmt(P.a):tot.n?tot.n+' · '+cnt:'';
  $('#snipIn').classList.toggle('on',P.a!=null);
  $('#snipUndo').disabled=!P.made.length; $('#snipPlay').disabled=!S.seq.length;
  $$('#snipUnit button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.u===SNIP.unit)));
}
$('#snipBtn').addEventListener('click',()=>{S.snip?snipOff():snipOn()});
$('#snipIn').addEventListener('click',snipStart);
$('#snipOut').addEventListener('click',snipFinish);
$('#snipUndo').addEventListener('click',snipUndo);
$('#snipDone').addEventListener('click',snipOff);
$('#snipPlay').addEventListener('click',snipPlay);
$$('#snipUnit button').forEach(b=>b.addEventListener('click',()=>{SNIP.unit=+b.dataset.u;try{localStorage.setItem('rs-snip-unit',String(SNIP.unit))}catch(e){}snipUI()}));
/* Learn and Study take over the player: leave Snip first */
['#learnBtn','#studyBtn','#recBtn'].forEach(id=>$(id).addEventListener('click',()=>{if(S.snip)snipOff()},true));
setInterval(()=>{try{snipUI()}catch(e){}},700);
