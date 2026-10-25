/* ---------- Learn mode ----------
   Like a teacher drilling a routine: the clip is split into 8-counts (8 beats of the song, starting on the 1), and each
   one loops slow first, then faster, then at full speed. After an 8-count is learnt it's put together with the ones
   before it ("from the top"), then the next one starts.
   It runs on the Study loop engine (S.study = one looped stretch at a rate, song pitch kept), so sync, body, cues and
   the hip meter all work as usual. Progress (which 8-count you're on, which are done) is kept per clip on this phone.
   Without a song beat, the clip's own tempo (Tempo → Dance) is used; failing that, about 4 s pieces cut at the dancer's
   hits. */
function learnSay(t){const m=$('#recMsg');m.textContent=t;m.hidden=false;setTimeout(()=>{if(m.textContent===t)m.hidden=true},4000)}
const LEARN={ladder:[0.5,0.75,1], perStep:2};
function learnKey(n){return 'rs-learn-'+(n&&n.id||'')}
function learnSaved(n){try{return JSON.parse(localStorage.getItem(learnKey(n))||'null')}catch(e){return null}}
function learnSave(){const L=S.learn;if(!L)return;try{localStorage.setItem(learnKey(srcById(S.cur)),JSON.stringify({i:L.i,done:[...L.done],n:L.chunks.length}))}catch(e){}}
function learnOpts(){let o={};try{o=JSON.parse(localStorage.getItem('rs-learn-opts')||'{}')}catch(e){}return {build:o.build!==false,together:o.together!==false,auto:o.auto!==false,per:[1,2,3].includes(o.per)?o.per:2}}
function learnSetOpt(k,v){const o=learnOpts();o[k]=v;try{localStorage.setItem('rs-learn-opts',JSON.stringify(o))}catch(e){}}
/* song time <-> clip time, the way the Study engine plays them */
function learnClipT(s){return S.cIn+((s-S.offset)/S.ar-(S.avComp||0))*S.vr}
function learnSongT(t){return S.offset+((t-S.cIn)/S.vr+(S.avComp||0))*S.ar}
/* the 8-counts, in clip time: [{a,b,beats:[song times]|null}] */
function learnChunks(){
  const n=srcById(S.cur), A=S.cIn, B=clipEnd(); if(!n||!(B-A>1))return {chunks:[],how:'none'};
  let bt=null, d0=null, how='song';
  const G=S.hasA?liveGrid():null;
  if(G&&G.beats&&G.beats.length>8){const so=S.liveSong;bt=G.tapped?G.beats:(so&&so.an&&so.an.grid)||G.beats;d0=(G.down||[])[0];
    /* extend the grid past its ends at the local beat length, so the whole clip is covered */
    bt=bt.slice();const p0=bt[1]-bt[0],p1=bt[bt.length-1]-bt[bt.length-2];while(bt[0]>learnSongT(A)-p0)bt.unshift(bt[0]-p0);while(bt[bt.length-1]<learnSongT(B)+p1)bt.push(bt[bt.length-1]+p1);
    bt=bt.map(learnClipT)}
  else if(S.dBase>0){how='dance';const p=60/(S.dBase*S.vr),a0=S.dAnchor!=null?S.dAnchor:A;bt=[];for(let t=a0-Math.ceil((a0-A)/p+1)*p;t<B+p;t+=p)bt.push(t);d0=null}
  let cuts=[];
  if(bt){
    /* start counting on the 1 (the first downbeat), in steps of 8 */
    let i0=0;if(d0!=null){const dc=learnClipT(d0);let bd=1e9;bt.forEach((t,k)=>{if(Math.abs(t-dc)<bd){bd=Math.abs(t-dc);i0=k}})}
    i0=((i0%8)+8)%8; for(let k=i0;k<bt.length;k+=8)cuts.push(bt[k]);
  } else {
    /* no beat at all: about every 4 s, at the nearest dancer hit */
    how='hits';const H=hitsOf(n).map(h=>h.t);for(let t=A+4;t<B-1;t+=4){let c=t,bd=1.2;for(const h of H)if(Math.abs(h-t)<bd){bd=Math.abs(h-t);c=h}cuts.push(c)}
  }
  cuts=[A,...cuts.filter(t=>t>A+0.05&&t<B-0.05),B];
  let ch=[];for(let k=0;k+1<cuts.length;k++)ch.push({a:cuts[k],b:cuts[k+1]});
  /* a short piece at either end joins its neighbour (under half an 8-count, or under 1.5 s) */
  const typ=ch.length>2?ch.map(c=>c.b-c.a).sort((x,y)=>x-y)[ch.length>>1]:4;
  if(ch.length>1&&ch[0].b-ch[0].a<Math.max(1.5,typ*0.5)){ch[1].a=ch[0].a;ch.shift()}
  if(ch.length>1&&ch[ch.length-1].b-ch[ch.length-1].a<Math.max(1.5,typ*0.5)){ch[ch.length-2].b=ch[ch.length-1].b;ch.pop()}
  /* parts cut out in Clip → Cut the clip are skipped */
  if(n.pieces&&n.pieces.some(p=>!p.on)){const K=keptRanges(n);ch=ch.filter(c=>K.some(([s,e])=>Math.min(e,c.b)-Math.max(s,c.a)>0.5*(c.b-c.a)))}
  if(bt)ch.forEach(c=>{c.beats=bt.filter(t=>t>=c.a-0.02&&t<c.b-0.02)});
  return {chunks:ch,how};
}
function learnOn(){
  if(!S.hasV||routineOn()||S.rec)return;
  const {chunks,how}=learnChunks(); if(!chunks.length){learnSay('This clip is too short to split into 8-counts.');return}
  const n=srcById(S.cur), sv=learnSaved(n), ok=sv&&sv.n===chunks.length;
  /* start where you left off, or at the 8-count under the playhead */
  let i=ok?clamp(sv.i,0,chunks.length-1):Math.max(0,chunks.findIndex(c=>v.currentTime<c.b));
  if(S.study)studyOff();
  S.learn={chunks,how,i,step:0,loopN:0,phase:'learn',done:new Set(ok?sv.done:[]),loop0:S.loop};
  learnStart(i,true);
}
function learnOff(){
  const L=S.learn; if(!L)return; S.learn=null;
  if(S.study){S.study.loop=L.loop0;studyOff()}
  learnUI();
}
/* play 8-count i (or the stretch from the top to it, when putting together), from its start */
function learnStart(i,first){
  const L=S.learn,o=learnOpts(); L.i=clamp(i,0,L.chunks.length-1); L.loopN=0; if(first||L.phase!=='together'){L.phase='learn';L.step=o.build?0:LEARN.ladder.length-1}
  learnApply(true); learnSave();
}
function learnApply(restart){
  const L=S.learn, c=L.chunks[L.i], rate=L.phase==='together'?1:LEARN.ladder[L.step], a0=L.phase==='together'?L.chunks[learnTopOf(L.i)].a:c.a;
  const loop=S.study?S.study.loop:L.loop0;
  S.study={a:a0,b:c.b,rate,loop}; S.loop=true; a.preservesPitch=true; a.webkitPreservesPitch=true;
  if(restart){const was=S.playing;if(was)pause();S.segIdx=0;v.currentTime=a0;studyUI();updateTrim();learnUI();setTimeout(()=>{if(S.learn&&!S.playing)$('#play').click()},120)}
  else learnUI();
}
/* "from the top": up to 4 8-counts back (a whole routine of 30 would be too long to drill) */
function learnTopOf(i){return Math.max(0,i-3)}
/* called each time the loop comes round: count it, and move up the speed ladder / on to the next 8-count */
function learnLoopDone(){
  const L=S.learn; if(!L)return; const o=learnOpts(); L.loopN++;
  if(L.loopN<o.per)return learnUI();
  L.loopN=0;
  if(L.phase==='learn'&&L.step<LEARN.ladder.length-1){L.step++;learnApply(false);return}
  if(L.phase==='learn'){L.done.add(L.i);learnSave();
    if(o.together&&L.i>0){L.phase='together';learnApply(false);return}}
  if(!o.auto){L.hold=true;return learnUI()}   /* stay on it at full speed until you tap Next */
  if(L.i<L.chunks.length-1){L.phase='learn';L.i++;L.step=o.build?0:LEARN.ladder.length-1;learnApply(false);learnSave()}
  else{L.finished=true;learnUI()}
}
/* which of the 8 counts is playing now (1-8), from the song's beats */
function learnCount(){
  const L=S.learn; if(!L)return 0; const c=L.chunks[L.i]; if(!c.beats||!c.beats.length)return 0;
  const t=v.currentTime; if(L.phase==='together'){/* count within whichever 8-count is playing */const k=L.chunks.findIndex(q=>t>=q.a-0.02&&t<q.b);const q=L.chunks[k];if(!q||!q.beats)return 0;let m=0;for(const b of q.beats)if(b<=t+0.03)m++;return Math.max(1,m)}
  let m=0;for(const b of c.beats)if(b<=t+0.03)m++;return Math.max(1,Math.min(8,m));
}
function learnUI(){
  const L=S.learn, bar=$('#learnBar'), btn=$('#learnBtn'); btn.setAttribute('aria-pressed',String(!!L)); bar.hidden=!L; $('#learnTag').hidden=!L;
  btn.disabled=!S.hasV||routineOn()||!!S.rec;
  if(!L)return;
  const o=learnOpts(), c=L.chunks[L.i], N=L.chunks.length, rate=S.study?S.study.rate:1;
  const chips=$('#learnChips');
  if(chips.childElementCount!==N){chips.innerHTML='';L.chunks.forEach((_,k)=>{const b=document.createElement('button');b.type='button';b.textContent=String(k+1);b.addEventListener('click',()=>{L.hold=false;L.finished=false;learnStart(k,true)});chips.append(b)})}
  [...chips.children].forEach((b,k)=>{b.setAttribute('aria-current',String(k===L.i));b.classList.toggle('done',L.done.has(k));b.classList.toggle('in',L.phase==='together'&&k>=learnTopOf(L.i)&&k<L.i)});
  const cur=chips.children[L.i]; if(cur&&L.lastScroll!==L.i){L.lastScroll=L.i;cur.scrollIntoView({block:'nearest',inline:'center'})}
  const what=L.phase==='together'?`Put together: ${learnTopOf(L.i)+1}–${L.i+1}`:`8-count ${L.i+1} of ${N}`;
  const unit=L.how==='hits'?'Part':'8-count';
  $('#learnWhat').textContent=L.how==='hits'?what.replace('8-count',unit):what;
  $('#learnChipLbl').textContent=L.how==='hits'?'Parts':'8-counts';
  $('#learnSpeed').textContent=Math.round(rate*100)+'%';
  $('#learnLoop').textContent=L.finished?'All done: tap a number to practise it again':L.hold?'Full speed. Tap Next when you have it':`loop ${L.loopN+1} of ${o.per}`;
  $('#learnTag').textContent=`Learn · ${unit} ${L.i+1} · ${Math.round(rate*100)}%`;
  $('#learnHow').hidden=L.how==='song'; $('#learnHow').textContent=L.how==='dance'?'Counting from the clip\'s own tempo (no song beat).':L.how==='hits'?'No beat found: split about every 4 s at the dancer\'s hits. Add a song or tap the tempo for real 8-counts.':'';
  $('#lnBuild').checked=o.build; $('#lnTogether').checked=o.together; $('#lnAuto').checked=o.auto;
  $$('#lnPer button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.per===o.per)));
  $('#lnPrev').disabled=L.i===0; $('#lnNext').disabled=L.i>=N-1;
}
/* the 1-8 count: lit as it plays */
function learnTick(){
  const L=S.learn; if(!L)return; const k=learnCount(); if(k===L.shown)return; L.shown=k;
  $$('#learnCount i').forEach((e,j)=>{e.classList.toggle('on',j+1===k);e.classList.toggle('past',j+1<k)});
}
$('#learnBtn').addEventListener('click',()=>{S.learn?learnOff():learnOn()});
$('#lnPrev').addEventListener('click',()=>{const L=S.learn;if(!L)return;L.hold=false;L.finished=false;learnStart(L.i-1,true)});
$('#lnNext').addEventListener('click',()=>{const L=S.learn;if(!L)return;L.hold=false;L.finished=false;L.done.add(L.i);learnStart(L.i+1,true)});
$('#lnAgain').addEventListener('click',()=>{const L=S.learn;if(!L)return;L.hold=false;L.finished=false;learnStart(L.i,true)});
$('#lnSlow').addEventListener('click',()=>{const L=S.learn;if(!L)return;L.phase='learn';L.step=Math.max(0,L.step-1);L.loopN=0;learnApply(true)});
$('#lnBuild').addEventListener('change',e=>{learnSetOpt('build',e.target.checked);learnUI()});
$('#lnTogether').addEventListener('change',e=>{learnSetOpt('together',e.target.checked);learnUI()});
$('#lnAuto').addEventListener('change',e=>{learnSetOpt('auto',e.target.checked);learnUI()});
$$('#lnPer button').forEach(b=>b.addEventListener('click',()=>{learnSetOpt('per',+b.dataset.per);learnUI()}));
setInterval(()=>{try{if(!S.learn)learnUI()}catch(e){}},700);
