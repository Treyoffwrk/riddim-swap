# ---- hips on the beat: hip hits from the tracked tilt, and how consistently they land on the song's beats -----------------
rep("""            <div class="hipkey">""","""            <p class="hipbeat" id="hipBeat"></p>
            <div class="hipkey">""")
rep("""/* ===== Sound System: the look shared with MirrorView.""","""
.hipbeat{margin:0;font:600 15px var(--f-body);color:var(--ink)}
.hipbeat b{color:var(--hips)}
/* ===== Sound System: the look shared with MirrorView.""")
HB_JS = r"""
/* ---------- hips on the beat ----------
   Hip hits: the moments a hip tilt stops sharply (tilt speed falls to under half of its peak in the last 0.2 s, the
   peak being among the faster 40% of moments), at least 0.15 s apart. Checked on your clip with its own song: tilt
   hits cluster at the beat and the "and" well above chance; side-to-side sway didn't, so tilt is used.
   Score: where each hit falls within its half beat (the beat or the "and"), as a direction on a circle. If hits keep
   landing at the same point the directions agree (strength R near 1); random timing gives about 1/√n. The test is
   Rayleigh's: n·R² above 3 means a real lock (p < 0.05), above 6 strong. The average direction says how early or late. */
function hipHits(B){
  if(B._hh&&B._hhN===B.n&&B._hhH===B.hips)return B._hh;
  RB.hipsAt(B,0); const n=B.n,t=[],a=[];
  for(let i=0;i<n;i++){t.push(B.data[i*RB.STRIDE]);const v=B.hips[i*RB.HS];a.push(v===v?v:null)}
  const s=new Array(n).fill(0);
  for(let i=1;i<n-1;i++){if(a[i-1]==null||a[i+1]==null)continue;s[i]=Math.abs((a[i+1]-a[i-1])/((t[i+1]-t[i-1])||1))/20}
  const sorted=s.filter(x=>x>0).sort((x,y)=>x-y), thr=Math.max(0.6,sorted.length?sorted[Math.floor(sorted.length*0.6)]:0.6), out=[];
  for(let i=2;i<n-2;i++){if(!(s[i]<=s[i-1]&&s[i]<=s[i+1])||a[i]==null)continue;let pk=0;for(let j=Math.max(0,i-6);j<i;j++)pk=Math.max(pk,s[j]);
    if(pk>=thr&&s[i]<=0.5*pk){if(out.length&&t[i]-out[out.length-1].t<0.15)continue;out.push({t:t[i],pk})}}
  B._hh=out;B._hhN=B.n;B._hhH=B.hips;return out;
}
/* the song's beats in the clip's own time (clip speed, song start, song speed and the speed graph all applied) */
function clipBeatTimes(){
  const G=liveGrid(); if(!G||!G.beats.length)return null; const g0=segs()[0], out=[];
  for(const b of G.beats){const o=(b-S.offset)/S.ar;if(o<0)continue;const src=g0&&g0.k?(o>segLen(g0)?null:toSrc(g0,o)):S.cIn+o*S.vr;if(src==null||src>clipEnd()+0.5)continue;out.push(src)}
  return out.length>3?out:null;
}
function hipSync(n,B){
  const hits=hipHits(B).filter(h=>h.t>=S.cIn&&h.t<=clipEnd()), beats=clipBeatTimes(); if(!beats||hits.length<6)return null;
  /* the grid: beats split into 1, 2 or 4, keeping splits 0.18–0.62 s long (how often hips actually hit); a song read at
     half or double tempo still works. More than one split is tried, so the bar is higher: n·R² over 4 (p < 0.05 after
     allowing for the tries), over 7 strong. */
  let best=null;
  for(const div of [1,2,4]){
    let cx=0,cy=0,m=0,len=0;
    for(const h of hits){let k=-1;for(let i=0;i<beats.length-1;i++)if(beats[i]<=h.t&&h.t<beats[i+1]){k=i;break}if(k<0)continue;
      const span=beats[k+1]-beats[k],ph=(((h.t-beats[k])/span)*div)%1;cx+=Math.cos(2*Math.PI*ph);cy+=Math.sin(2*Math.PI*ph);m++;len+=span/div}
    if(m<6)continue;const cyc=len/m;if(cyc<0.18||cyc>0.62)continue;
    const R=Math.hypot(cx,cy)/m,Z=m*R*R,ph=Math.atan2(cy,cx)/(2*Math.PI);
    if(!best||Z>best.Z)best={n:m,R,Z,div,cycleMs:Math.round(cyc*1000),offsetMs:Math.round(ph*cyc*1000)};
  }
  if(!best)return null;best.beats=beats;best.lock=best.Z>7?'strong':best.Z>4?'some':'none';return best;
}
function hipBeatText(n,B){
  const r=hipSync(n,B);if(!r)return '';
  const off=Math.abs(r.offsetMs)<15?'right on it':Math.abs(r.offsetMs)+' ms '+(r.offsetMs<0?'early':'late');
  if(r.lock==='none')return `Hips on the beat: <b>not clearly</b>. ${r.n} hip hits, their timing doesn't settle on this song's beats yet.`;
  return `Hips on the beat: <b>${r.lock==='strong'?'locked in':'some lock'}</b>. ${r.n} hip hits keep landing in time with the beat (every ${r.cycleMs} ms), on average ${off}.`;
}
"""
rep("""/* test hook: only with #debug in the address */""", HB_JS + """/* test hook: only with #debug in the address */""")
# marks on the Hip moves graph + the line under it
rep("""  const px=X(v.currentTime);x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;""","""  {const hs=hipSync(n,B),grid=hs?hs.beats:null,hh=hipHits(B);
   for(const q of hh){if(q.t<0||q.t>d)continue;const H=RB.hipsAt(B,q.t),py=H&&H.tilt!=null?mid-Math.max(-1,Math.min(1,H.tilt/TILT))*amp:mid;
     let on=false;if(grid){const dv=hs.div||2;for(let i=0;i<grid.length-1;i++){const a=grid[i],b=grid[i+1];if(q.t<a-0.07||q.t>b+0.07)continue;for(let j=0;j<=dv;j++){const g=a+(b-a)*j/dv+hs.offsetMs/1000*0;if(Math.abs(q.t-g)<=0.06){on=true;break}}if(on)break}}
     x.fillStyle=on?tok('--ok'):tok('--hips');x.strokeStyle='#14171D';x.lineWidth=1.5*dpr;x.beginPath();x.arc(X(q.t),py,3.5*dpr,0,7);x.fill();x.stroke()}
   const hb=$('#hipBeat'),txt=hipBeatText(n,B);if(hb.innerHTML!==txt)hb.innerHTML=txt}
  const px=X(v.currentTime);x.strokeStyle=tok('--dance');x.lineWidth=2*dpr;""")
rep("""<span><i style="background:var(--song)"></i>Beats</span></div>""","""<span><i style="background:var(--song)"></i>Beats</span><span><i style="background:var(--ok);border-radius:50%;width:8px;height:8px"></i>Hip hit on the beat</span><span><i style="background:var(--hips);border-radius:50%;width:8px;height:8px"></i>Hip hit off it</span></div>""")
rep("""if(/debug/.test(location.hash))window.__rs={""","""if(/debug/.test(location.hash))window.__rs={hipHits,hipSync,""")
