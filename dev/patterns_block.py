# ---- hip patterns: name what the hips are doing (when it's clear), on the graph and on saved moves ------------------------
rep("""        <div class="field">
          <div class="subhead"><h3>Your moves</h3></div>""","""        <div class="field">
          <div class="subhead"><h3>Your moves</h3></div>
          <div class="chips" id="patFilter" role="group" aria-label="Show moves by hip pattern" hidden></div>""")
rep("""/* ===== Sound System: the look shared with MirrorView.""","""
.pattag{display:inline-block;font:700 11px var(--f-body);padding:1px 7px;border-radius:999px;margin-left:6px;color:#0E1014;vertical-align:1px}
#patFilter button{font:600 13px var(--f-body);border:1px solid var(--line);background:var(--sunk);color:var(--ink);border-radius:999px;min-height:34px;padding:0 12px;cursor:pointer}
#patFilter button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.patline{margin:0;font-size:13px;color:var(--muted)}
/* ===== Sound System: the look shared with MirrorView.""")
rep("""            <p class="hipbeat" id="hipBeat"></p>""","""            <p class="hipbeat" id="hipBeat"></p>
            <p class="patline" id="patLine"></p>""")
PAT_JS = r"""
/* ---------- hip patterns ----------
   Every 0.25 s, the last 1.5 s of hip measures is described, only when it's clear:
   still: tilt moves under 2° and sway under 0.025 torso (spread);
   otherwise the movement must repeat (the tilt or sway swings back: its autocorrelation dips below −0.1, then peaks
   again above 0.35; the first repeat gives the period). Then:
   hip circles (whine-like): sway and tilt or forward/back follow each other a quarter cycle apart (|r| > 0.5, and
   clearly more than in step), like a circle seen from the front;
   quick pulses: repeats faster than about 2.7 a second;
   tilts: side-to-side tilts over 3°; sways: hips shifting sideways (over 0.04 torso) with little tilt.
   Anything else is left unnamed. Runs shorter than 0.75 s are dropped. On made-up movements of each kind with
   real-sized wobble, every one was named right; random drifting was left unnamed 87% of the time (10% "still").
   On real dancing most stretches stay unnamed, because real dancing changes faster than one clean pattern. */
const PAT={circle:{name:'Hip circles',short:'Circles',col:'#B98BFF'},tilt:{name:'Tilts',short:'Tilts',col:'#FF5FA2'},pulse:{name:'Quick pulses',short:'Pulses',col:'#4FD1A1'},sway:{name:'Sways',short:'Sways',col:'#6E8BFF'},still:{name:'Still',short:'Still',col:'#7C8494'}};
function patAc(x,lo,hi){let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}if(c<10)return [0,0];m/=c;const y=x.map(v=>v===v?v-m:0);let d=0;for(const v of y)d+=v*v;if(d<=0)return [0,0];
  const r=[1];for(let L=1;L<=hi+1;L++){let s=0;for(let i=0;i+L<y.length;i++)s+=y[i]*y[i+L];r.push(s/d*y.length/(y.length-L))}
  let dip=-1;for(let L=1;L<hi;L++)if(r[L]<-0.1){dip=L;break}if(dip<0)return [0,0];
  for(let L=Math.max(dip,lo);L<=hi;L++)if(r[L]>=r[L-1]&&r[L]>=r[L+1])return [r[L],L];return [0,0]}
function patCorr(a,b){const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let xy=0,xx=0,yy=0;for(let i=0;i<n;i++){xy+=(a[i]-ma)*(b[i]-mb);xx+=(a[i]-ma)**2;yy+=(b[i]-mb)**2}return xx>0&&yy>0?xy/Math.sqrt(xx*yy):0}
function patStd(x){let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}if(c<3)return NaN;m/=c;let s=0;for(const v of x)if(v===v)s+=(v-m)**2;return Math.sqrt(s/c)}
function patWindow(tilt,sway,thrust,k){
  const at=patStd(tilt),as=patStd(sway);if(!(at===at)||!(as===as))return null;
  if(at<2&&as<0.025)return 'still';
  const lo=Math.max(2,Math.round(5*k)),hi=Math.round(30*k);
  const [rt,Lt]=patAc(tilt,lo,hi),[rs,Ls]=patAc(sway,lo,hi);const [r,L]=rt*at/3>=rs*as/0.04?[rt,Lt]:[rs,Ls];
  if(r<0.35)return null;
  const q=Math.max(1,Math.round(L/4)),fill=x=>{let m=0,c=0;for(const v of x)if(v===v){m+=v;c++}m=c?m/c:0;return x.map(v=>v===v?v-m:0)};
  const s=fill(sway);let circ=0,zero=0;
  for(const X0 of [tilt,thrust]){if(!X0)continue;const X=fill(X0);if(X.every(v=>v===0))continue;
    const c=Math.max(Math.abs(patCorr(s.slice(0,-q),X.slice(q))),Math.abs(patCorr(s.slice(q),X.slice(0,-q)))),z=Math.abs(patCorr(s,X));if(c>circ){circ=c;zero=z}}
  if(as>0.03&&circ>0.5&&zero<0.5&&circ-zero>0.2)return 'circle';
  if(L<=Math.round(11*k))return 'pulse';
  if(at>=3&&at/3>=as/0.04)return 'tilt';
  if(as>=0.04)return 'sway';
  return at>=3?'tilt':null;
}
function hipPatterns(B){
  if(B._pat&&B._patN===B.n&&B._patH===B.hips)return B._pat;
  RB.hipsAt(B,0);const n=B.n,S2=RB.STRIDE,H=RB.HS,fps=B.fps||30,k=fps/30,win=Math.round(1.5*fps),hop=Math.max(1,Math.round(0.25*fps));
  const col=o=>{const a=new Array(n);for(let i=0;i<n;i++)a[i]=B.hips[i*H+o];return a},T=col(0),Sw=col(2),Th=col(5);
  const slots=[];for(let s0=0;s0+win<=n;s0+=hop){const lab=patWindow(T.slice(s0,s0+win),Sw.slice(s0,s0+win),Th.slice(s0,s0+win),k);const c=s0+Math.floor(win/2);
    slots.push({t0:B.data[Math.max(0,c-Math.floor(hop/2))*S2],t1:B.data[Math.min(n-1,c+Math.ceil(hop/2))*S2],lab})}
  const runs=[];for(const s of slots){const L=runs[runs.length-1];if(L&&L.lab===s.lab&&s.t0-L.t1<0.2)L.t1=s.t1;else runs.push({...s})}
  const out=runs.filter(r=>r.lab&&r.t1-r.t0>=0.75);B._pat=out;B._patN=B.n;B._patH=B.hips;return out;
}
/* the main pattern in a stretch: the one covering most of it, if it covers at least 40% */
function patternIn(B,a,b){const cov={};for(const r of hipPatterns(B)){const o=Math.min(b,r.t1)-Math.max(a,r.t0);if(o>0)cov[r.lab]=(cov[r.lab]||0)+o}
  let best=null,bv=0;for(const [k,v] of Object.entries(cov))if(v>bv){bv=v;best=k}return best&&bv>=0.4*(b-a)?best:null}
function patSummary(n,B){const a=S.cIn,b=clipEnd(),tot={};let named=0;for(const r of hipPatterns(B)){const o=Math.min(b,r.t1)-Math.max(a,r.t0);if(o>0){tot[r.lab]=(tot[r.lab]||0)+o;named+=o}}
  if(!named)return 'Hip patterns: none clear enough to name in this clip (that’s common in mixed, fast dancing).';
  return 'Hip patterns (band under the graph): '+Object.entries(tot).sort((x,y)=>y[1]-x[1]).map(([k,v])=>`<span style="display:inline-block;width:10px;height:6px;border-radius:2px;background:${PAT[k].col};margin-right:4px"></span>${PAT[k].name.toLowerCase()} ${Math.round(v/(b-a)*100)}%`).join(' · ')+' of the clip (the rest is mixed).'}
/* moves: a tag each, and a filter */
S.patFilter=S.patFilter||'all';
function movePattern(m){const n=srcById(m.src),B=n&&bodyOf(n);return B?patternIn(B,m.s,m.e):null}
function patFilterUI(){
  const box=$('#patFilter');const tags=S.moves.map(movePattern);const have=[...new Set(tags.filter(Boolean))];
  box.hidden=!have.length;const sig=have.join(',')+'|'+S.patFilter;if(box.dataset.sig===sig)return;box.dataset.sig=sig;box.textContent='';
  for(const k of ['all',...Object.keys(PAT).filter(k=>have.includes(k))]){const bt=el('button',null,k==='all'?'All':PAT[k].short);bt.type='button';bt.setAttribute('aria-pressed',String(S.patFilter===k));
    bt.addEventListener('click',()=>{S.patFilter=k;renderMoves()});box.append(bt)}
  if(S.patFilter!=='all'&&!have.includes(S.patFilter)){S.patFilter='all'}
}
"""
rep("""/* test hook: only with #debug in the address */""", PAT_JS + """/* test hook: only with #debug in the address */""")
rep("""  S.moves.forEach(m=>{
    const li=el('li','item nonum'); if(S.preview&&S.preview.id===m.id)li.classList.add('now');
    const meta=el('div','meta'); meta.append(nameEl(m),el('span',null,fmt(m.s)+' – '+fmt(m.e)+' · '+(m.e-m.s).toFixed(1)+'s'));""",
"""  try{patFilterUI()}catch(e){}
  S.moves.forEach(m=>{
    let pk=null;try{pk=movePattern(m)}catch(e){}
    if(S.patFilter&&S.patFilter!=='all'&&pk!==S.patFilter)return;
    const li=el('li','item nonum'); if(S.preview&&S.preview.id===m.id)li.classList.add('now');
    const meta=el('div','meta'); const nm=nameEl(m);if(pk){const tg=el('span','pattag',PAT[pk].short);tg.style.background=PAT[pk].col;nm.append(tg)}
    meta.append(nm,el('span',null,fmt(m.s)+' – '+fmt(m.e)+' · '+(m.e-m.s).toFixed(1)+'s'));""")
# the band on the Hip moves graph and the summary line
rep("""  const C=S.cmp&&!S.cmp.err&&S.cmp.match>=0.3&&S.cmp.refId===S.cur?S.cmp:null;""",
"""  try{for(const r of hipPatterns(B)){x.fillStyle=PAT[r.lab].col;x.globalAlpha=0.85;x.fillRect(X(r.t0),h-19*dpr,Math.max(dpr,X(r.t1)-X(r.t0)),6*dpr)}x.globalAlpha=1;
    const pl=$('#patLine'),tx=patSummary(n,B);if(pl.innerHTML!==tx)pl.innerHTML=tx}catch(e){}
  const C=S.cmp&&!S.cmp.err&&S.cmp.match>=0.3&&S.cmp.refId===S.cur?S.cmp:null;""")
rep("""if(/debug/.test(location.hash))window.__rs={""","""if(/debug/.test(location.hash))window.__rs={patWindow,hipPatterns,movePattern,renderMoves,""")
