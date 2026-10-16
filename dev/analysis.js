/*ANALYSIS-START*/
/* ===== Riddim Swap beat analysis (pure functions, no page access) =====
   Music:  spectral-flux onset envelope -> autocorrelation tempo -> dynamic-programming beat tracker
           (Ellis 2007, the method behind librosa's beat_track) -> downbeat phase from low-band (kick) accents.
   Dance:  coarse optical flow per frame -> directional motion histogram ("directogram") -> visual impulses
           where motion in a direction suddenly stops (after Davis & Agrawala, "Visual Rhythm and Beat") -> peaks.
   Fit:    constrained per-move time warp that lands motion beats on beats / half-beats, and a Beat Alignment Score. */
const RA=(function(){
  /* ---------- small helpers ---------- */
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  function movingAvg(x,w){const n=x.length,o=new Float32Array(n);let s=0;const h=Math.max(1,w|0);
    for(let i=0;i<n;i++){s+=x[i];if(i>=h)s-=x[i-h];o[i]=s/Math.min(i+1,h)}
    /* centre it */const c=new Float32Array(n),sh=(h/2)|0;for(let i=0;i<n;i++)c[i]=o[Math.min(n-1,i+sh)];return c}
  function gaussSmooth(x,sig){if(sig<=0.3)return Float32Array.from(x);const r=Math.ceil(sig*3),k=[];let ks=0;
    for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*sig*sig));k.push(v);ks+=v}
    const n=x.length,o=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let j=-r;j<=r;j++){const t=i+j;if(t>=0&&t<n)s+=x[t]*k[j+r]}o[i]=s/ks}return o}
  function stats(x){let m=0;for(const v of x)m+=v;m/=x.length||1;let q=0;for(const v of x)q+=(v-m)*(v-m);return {mean:m,std:Math.sqrt(q/(x.length||1))}}
  function median(a){if(!a.length)return 0;const b=Array.from(a).sort((p,q)=>p-q),h=b.length>>1;return b.length%2?b[h]:(b[h-1]+b[h])/2}

  /* ---------- FFT (radix 2, in place) ---------- */
  function makeFFT(N){
    const rev=new Uint32Array(N),bits=Math.log2(N);
    for(let i=0;i<N;i++){let r=0;for(let b=0;b<bits;b++)r|=((i>>b)&1)<<(bits-1-b);rev[i]=r}
    const cos=new Float64Array(N/2),sin=new Float64Array(N/2);
    for(let i=0;i<N/2;i++){cos[i]=Math.cos(2*Math.PI*i/N);sin[i]=-Math.sin(2*Math.PI*i/N)}
    return function(re,im){
      for(let i=0;i<N;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
      for(let size=2;size<=N;size<<=1){const half=size>>1,step=N/size;
        for(let i=0;i<N;i+=size)for(let j=0;j<half;j++){const k=j*step,a=i+j,b=a+half;
          const tr=re[b]*cos[k]-im[b]*sin[k],ti=re[b]*sin[k]+im[b]*cos[k];
          re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti}}
    };
  }

  /* ---------- music: onset envelope ---------- */
  /* chans: array of Float32Array, sr: sample rate. Returns env (all bands) and low (kick band), fps. */
  function onsetEnvelope(chans,sr){
    const d=Math.max(1,Math.round(sr/22050)), sr2=sr/d, n0=chans[0].length, N=1024,H=256, pad=N/2, n=Math.floor(n0/d)+pad;
    /* mono, downsampled, padded by half a window so frame f is centred on time f*H */
    const x=new Float32Array(n+pad);
    for(let i=pad;i<n;i++){const j=i-pad;let s=0;for(let c=0;c<chans.length;c++){const ch=chans[c];for(let k=0;k<d;k++)s+=ch[j*d+k]||0}x[i]=s/(d*chans.length)}
    const fft=makeFFT(N),win=new Float64Array(N);
    for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
    const frames=Math.max(0,Math.floor((n-N)/H)+1), fps=sr2/H;
    const env=new Float32Array(frames), low=new Float32Array(frames), loud=new Float32Array(frames), lowE=new Float32Array(frames);
    const re=new Float64Array(N),im=new Float64Array(N);
    let prev=new Float64Array(N/2+1),cur=new Float64Array(N/2+1);
    /* mel-spaced bands (30 Hz - 8 kHz), so the many high-frequency bins (hats, noise) don't outvote the kick */
    const NB=40, mel=f=>2595*Math.log10(1+f/700), imel=m=>700*(Math.pow(10,m/2595)-1);
    const m0=mel(30),m1=mel(8000), edges=[];for(let b=0;b<NB+2;b++)edges.push(imel(m0+(m1-m0)*b/(NB+1))*N/sr2);
    const bands=[];for(let b=0;b<NB;b++){const a=edges[b],c=edges[b+1],z=edges[b+2],ws=[];
      for(let k=Math.max(1,Math.floor(a));k<=Math.min(N/2,Math.ceil(z));k++){const w=k<c?(k-a)/(c-a||1):(z-k)/(z-c||1);if(w>0)ws.push([k,w])}
      bands.push({ws,low:imel(m0+(m1-m0)*(b+1)/(NB+1))<160})}
    prev=new Float64Array(NB);cur=new Float64Array(NB);
    for(let f=0;f<frames;f++){
      const o=f*H; let e=0;
      for(let i=0;i<N;i++){const v=x[o+i]*win[i];re[i]=v;im[i]=0;e+=v*v}
      fft(re,im);
      let fl=0,lo=0,le=0;
      for(let b=0;b<NB;b++){let p=0;for(const [k,w] of bands[b].ws)p+=w*(re[k]*re[k]+im[k]*im[k]);
        if(bands[b].low)le+=p;
        const m=Math.log1p(1000*p);cur[b]=m;const dd=m-prev[b];if(dd>0){fl+=dd;if(bands[b].low)lo+=dd}}
      env[f]=fl; low[f]=lo; loud[f]=Math.sqrt(e/N); lowE[f]=Math.sqrt(le);
      const t=prev;prev=cur;cur=t;
    }
    /* remove slow trend, keep rises, normalise */
    const norm=a=>{const ma=movingAvg(a,Math.round(fps*0.4)),o=new Float32Array(a.length);for(let i=0;i<a.length;i++)o[i]=Math.max(0,a[i]-ma[i]);
      const st=stats(o);const sd=st.std||1;for(let i=0;i<o.length;i++)o[i]/=sd;return o};
    const E=norm(env),Lw=norm(low),mix=new Float32Array(E.length);
    /* kick-heavy styles (dancehall, Jersey club): the low band says where the beat is */
    for(let i=0;i<E.length;i++)mix[i]=E[i]+1.5*Lw[i];
    return {env:mix,full:E,low:Lw,lowE,loud,fps};
  }

  /* ---------- music: tempo ---------- */
  function autocorr(env,lagMin,lagMax){const n=env.length,ac=new Float32Array(lagMax+2);
    for(let L=lagMin;L<=lagMax+1&&L<n;L++){let s=0;for(let t=0;t+L<n;t++)s+=env[t]*env[t+L];ac[L]=s/(n-L)}return ac}
  /* returns {bpm, conf (0..1), candidates:[{bpm,score}]} */
  function tempo(env,fps,opt,lowEnv){
    opt=opt||{}; const lo=opt.min||60, hi=opt.max||200, prior=opt.prior||120;
    const lagMin=Math.floor(60*fps/hi), lagMax=Math.ceil(60*fps/lo);
    const ac=autocorr(env,lagMin,lagMax*4+4);
    /* kick-band periodicity: the kick pattern repeats on the beat grid (every 2 / 4 beats) */
    const acL=lowEnv?autocorr(lowEnv,lagMin,lagMax*4+4):null;
    const nrm=a=>{if(!a)return a;let m=0;for(let i=lagMin;i<a.length;i++)m=Math.max(m,a[i]);if(m>0)for(let i=0;i<a.length;i++)a[i]/=m;return a};
    nrm(ac);nrm(acL);
    const sc=[]; let best=-1,bi=lagMin;
    for(let L=lagMin;L<=lagMax;L++){
      const bpm=60*fps/L, w=Math.exp(-0.5*Math.pow(Math.log2(bpm/prior)/1.0,2));
      /* reward lags whose double also lines up (the real beat period, not a sub-beat) */
      /* the real beat also repeats every 2 and 4 beats (half bar, bar); syncopations like the 3-3-2 dembow don't */
      let v=ac[L]+0.5*(ac[2*L]||0)+0.5*(ac[4*L]||0);
      if(acL)v+=0.5*((acL[2*L]||0)+(acL[4*L]||0));
      v*=w; sc.push({L,bpm,v}); if(v>best){best=v;bi=L}
    }
    /* parabolic refine */
    const a=sc.find(s=>s.L===bi-1),c=sc.find(s=>s.L===bi+1);let Lr=bi;
    if(a&&c){const den=a.v-2*best+c.v;if(den<0)Lr=bi+0.5*(a.v-c.v)/den}
    const vals=sc.map(s=>s.v).filter(v=>v>0),med=median(vals);
    const conf=best>0?clamp((best-med)/best,0,1):0;
    /* distinct candidates */
    const peaks=sc.filter((s,i)=>i>0&&i<sc.length-1&&s.v>=sc[i-1].v&&s.v>=sc[i+1].v).sort((p,q)=>q.v-p.v);
    const cands=[];for(const p of peaks){if(cands.every(q=>Math.abs(q.bpm-p.bpm)/q.bpm>0.06))cands.push({bpm:+p.bpm.toFixed(1),score:+(p.v/best).toFixed(3)});if(cands.length>=4)break}
    return {bpm:60*fps/Lr,conf,candidates:cands};
  }

  /* ---------- music: beat tracker (dynamic programming) ---------- */
  function beats(env,fps,bpm,tightness){
    tightness=tightness||100; const n=env.length, period=60*fps/bpm;
    const local=gaussSmooth(env,period/32);
    const cum=new Float32Array(n), back=new Int32Array(n).fill(-1);
    const wMin=Math.round(period/2), wMax=Math.round(2*period);
    for(let t=0;t<n;t++){
      let bestV=-Infinity,bestT=-1;
      for(let tau=t-wMax;tau<=t-wMin;tau++){if(tau<0)continue;const d=(t-tau)/period;const v=cum[tau]-tightness*Math.pow(Math.log(d),2);if(v>bestV){bestV=v;bestT=tau}}
      cum[t]=local[t]+(bestT>=0?Math.max(0,bestV):0); back[t]=bestV>0?bestT:-1;
    }
    /* last beat: best local max of cum within the final period */
    let end=n-1,bv=-Infinity;for(let t=Math.max(0,n-Math.round(period*1.5));t<n;t++){if(cum[t]>bv){bv=cum[t];end=t}}
    const out=[];let t=end;while(t>=0){out.push(t);t=back[t]}
    out.reverse();
    /* trim weak beats at the edges (silence / fade) */
    const th=0.5*median(Array.from(out,i=>local[i]));
    while(out.length&&local[out[0]]<th)out.shift();
    while(out.length&&local[out[out.length-1]]<th)out.pop();
    return out.map(i=>i/fps);
  }

  /* ---------- music: downbeats (which beat is "1") ---------- */
  function downbeats(bt,low,env,fps,meter){
    meter=meter||4; const at=(a,t)=>{const i=Math.round(t*fps);let m=0;for(let k=i-2;k<=i+2;k++)if(k>=0&&k<a.length)m=Math.max(m,a[k]);return m};
    const sc=new Array(meter).fill(0);
    const lm=Math.max(1e-9,...Array.from(low)), em=Math.max(1e-9,...Array.from(env));
    bt.forEach((t,i)=>{sc[i%meter]+=at(low,t)/lm+0.15*at(env,t)/em});
    let p=0;for(let k=1;k<meter;k++)if(sc[k]>sc[p])p=k;
    const sorted=sc.slice().sort((a,b)=>b-a);const conf=sorted[0]>0?clamp((sorted[0]-sorted[1])/sorted[0],0,1):0;
    return {phase:p,conf,times:bt.filter((t,i)=>i%meter===p)};
  }

  /* full song analysis */
  function analyzeSong(chans,sr,opt){
    const o=onsetEnvelope(chans,sr), tp=tempo(o.env,o.fps,opt,o.low);
    if(opt&&opt.forceBpm)tp.bpm=opt.forceBpm;   /* the dancer picked another tempo candidate */
    let bt=beats(o.env,o.fps,tp.bpm);
    /* phase check: the beat sits where the low end (kick + bass) is strongest. If half a beat later is clearly
       stronger, the tracker locked onto the off-beat, so move the grid. */
    const per=60/tp.bpm, eAt=t=>{const i=Math.round(t*o.fps);let m=0;for(let k=i-3;k<=i+3;k++)if(k>=0&&k<o.lowE.length)m=Math.max(m,o.lowE[k]);return m};
    const eOn=median(bt.map(eAt)), eHalf=median(bt.map(t=>eAt(t+per/2)));
    let shifted=false; if(!(opt&&opt.noPhaseFix)&&eHalf>eOn*1.1){bt=bt.map(t=>t+per/2).filter(t=>t<o.lowE.length/o.fps);shifted=true}
    const db=downbeats(bt,o.lowE,o.full,o.fps,4);
    /* contrast of the beat: how much stronger onsets are on beats than off them (weak kick -> low) */
    const on=bt.map(t=>o.env[Math.round(t*o.fps)]||0), off=bt.slice(0,-1).map((t,i)=>o.env[Math.round((t+bt[i+1])/2*o.fps)]||0);
    const contrast=median(on)/(median(off)+median(on)+1e-6);
    return {bpm:tp.bpm,conf:tp.conf,candidates:tp.candidates,beats:bt,downbeats:db.times,downConf:db.conf,phase:db.phase,contrast,fps:o.fps,phaseShifted:shifted,lowOn:eOn,lowHalf:eHalf};
  }

  /* ---------- dance: optical flow between two small greyscale frames ---------- */
  /* block matching on B x B blocks, search radius R. Returns per-block vectors. */
  function flow(prev,cur,w,h,B,R){
    B=B||8;R=R||3;const vecs=[];
    for(let by=R;by+B+R<=h;by+=B)for(let bx=R;bx+B+R<=w;bx+=B){
      /* skip flat blocks (no texture -> no reliable motion) */
      let mn=255,mx=0;for(let y=0;y<B;y+=2)for(let x=0;x<B;x+=2){const v=cur[(by+y)*w+bx+x];if(v<mn)mn=v;if(v>mx)mx=v}
      if(mx-mn<12)continue;
      let best=Infinity,bdx=0,bdy=0,zero=0;
      for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
        let s=0;for(let y=0;y<B;y++){const r1=(by+y)*w+bx,r0=(by+y+dy)*w+bx+dx;for(let x=0;x<B;x++){const d=cur[r1+x]-prev[r0+x];s+=d<0?-d:d}if(s>=best)break}
        if(dx===0&&dy===0)zero=s;
        if(s<best||(s===best&&dx*dx+dy*dy<bdx*bdx+bdy*bdy)){best=s;bdx=dx;bdy=dy}
      }
      if(zero-best<B*B*2){bdx=0;bdy=0}   /* not clearly better than "no motion" */
      /* block moved from (bx+bdx,by+bdy) in prev to (bx,by) in cur -> motion is -d */
      vecs.push([-bdx,-bdy]);
    }
    return vecs;
  }
  /* coarse-to-fine flow: match on a half-size image first (catches fast moves), then refine at full size */
  function halve(img,w,h){const w2=w>>1,h2=h>>1,o=new Uint8Array(w2*h2);
    for(let y=0;y<h2;y++)for(let x=0;x<w2;x++){const i=2*y*w+2*x;o[y*w2+x]=(img[i]+img[i+1]+img[i+w]+img[i+w+1])>>2}return {img:o,w:w2,h:h2}}
  function sad(prev,cur,w,h,bx,by,B,dx,dy,limit){
    if(bx+dx<0||by+dy<0||bx+dx+B>w||by+dy+B>h)return Infinity;
    let s=0;for(let y=0;y<B;y++){const r1=(by+y)*w+bx,r0=(by+y+dy)*w+bx+dx;for(let x=0;x<B;x++){const d=cur[r1+x]-prev[r0+x];s+=d<0?-d:d}if(s>=limit)return s}return s}
  function flowPyr(prev,cur,w,h,B){
    B=B||8; const P=halve(prev,w,h),C=halve(cur,w,h), cw=P.w,ch=P.h, R=4, cm=new Map();
    for(let by=0;by+B<=ch;by+=B)for(let bx=0;bx+B<=cw;bx+=B){
      let best=Infinity,bd=[0,0];
      for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const v=sad(P.img,C.img,cw,ch,bx,by,B,dx,dy,best);if(v<best||(v===best&&dx*dx+dy*dy<bd[0]*bd[0]+bd[1]*bd[1])){best=v;bd=[dx,dy]}}
      cm.set((by/B)+','+(bx/B),bd);
    }
    const vecs=[];
    for(let by=0;by+B<=h;by+=B)for(let bx=0;bx+B<=w;bx+=B){
      let mn=255,mx=0;for(let y=0;y<B;y+=2)for(let x=0;x<B;x+=2){const v=cur[(by+y)*w+bx+x];if(v<mn)mn=v;if(v>mx)mx=v}
      if(mx-mn<12)continue;
      const g=cm.get(Math.floor(by/2/B)+','+Math.floor(bx/2/B))||[0,0], gx=2*g[0], gy=2*g[1];
      const zero=sad(prev,cur,w,h,bx,by,B,0,0,Infinity); let best=zero,bdx=0,bdy=0;
      for(let dy=gy-2;dy<=gy+2;dy++)for(let dx=gx-2;dx<=gx+2;dx++){const v=sad(prev,cur,w,h,bx,by,B,dx,dy,best);if(v<best){best=v;bdx=dx;bdy=dy}}
      if(zero-best<B*B*2){bdx=0;bdy=0}
      vecs.push([-bdx,-bdy]);
    }
    return vecs;
  }
  /* directogram: motion summed into 8 direction bins, after removing camera motion (median vector) */
  function directogram(vecs){
    const D=new Float32Array(8); if(!vecs.length)return {D,cam:0,mag:0};
    const mx=median(vecs.map(v=>v[0])),my=median(vecs.map(v=>v[1]));
    let mag=0;
    for(const [x0,y0] of vecs){const x=x0-mx,y=y0-my,m=Math.hypot(x,y);if(m<0.5)continue;const b=((Math.round(Math.atan2(y,x)/(Math.PI/4))%8)+8)%8;D[b]+=m;mag+=m}
    for(let b=0;b<8;b++)D[b]/=vecs.length;
    return {D,cam:Math.hypot(mx,my),mag:mag/vecs.length};
  }
  /* visual impulses from a series of directograms with timestamps (seconds). Returns uniform 60 Hz envelope. */
  function visualImpulses(series){
    const n=series.length; if(n<3)return {env:new Float32Array(0),fps:60,t0:0,cam:0};
    const raw=[];
    /* the stop happened between frame i-1 and frame i, so date it half-way */
    for(let i=1;i<n;i++){const a=series[i-1].D,b=series[i].D,dt=Math.max(1/120,series[i].t-series[i-1].t);let s=0;for(let k=0;k<8;k++){const d=a[k]-b[k];if(d>0)s+=d}raw.push({t:series[i].t-dt/2,v:s/dt})}
    const fps=60,t0=raw[0].t,t1=raw[raw.length-1].t,len=Math.max(1,Math.round((t1-t0)*fps)+1),env=new Float32Array(len);
    let j=0;for(let i=0;i<len;i++){const t=t0+i/fps;while(j<raw.length-2&&raw[j+1].t<=t)j++;const A=raw[j],B=raw[Math.min(raw.length-1,j+1)];
      const u=B.t>A.t?clamp((t-A.t)/(B.t-A.t),0,1):0;env[i]=A.v+(B.v-A.v)*u}
    const sm=gaussSmooth(env,1.5),ma=movingAvg(sm,fps*0.6),o=new Float32Array(len);
    for(let i=0;i<len;i++)o[i]=Math.max(0,sm[i]-ma[i]);
    const st=stats(o);for(let i=0;i<len;i++)o[i]/=st.std||1;
    const cam=median(series.map(s=>s.cam)), mag=median(series.map(s=>s.mag));
    return {env:o,fps,t0,cam,mag};
  }
  /* peak picking: local max, above adaptive threshold, minimum spacing */
  function pickPeaks(env,fps,t0,opt){
    opt=opt||{}; const gap=Math.round((opt.gap||0.16)*fps), k=opt.k||0.6, n=env.length;
    const ma=movingAvg(env,Math.round(fps*1.0)); const st=stats(env); const out=[];
    for(let i=1;i<n-1;i++){
      const v=env[i]; if(v<ma[i]+k*st.std||v<env[i-1]||v<env[i+1])continue;
      let ok=true;for(let j=Math.max(0,i-gap);j<=Math.min(n-1,i+gap);j++)if(env[j]>v){ok=false;break}
      if(ok)out.push({t:t0+i/fps,w:v});
    }
    const mx=Math.max(1e-6,...out.map(p=>p.w));out.forEach(p=>p.w=+(p.w/mx).toFixed(3));
    return out;
  }
  function analyzeMotion(series){
    const vi=visualImpulses(series); if(!vi.env.length)return null;
    const peaks=pickPeaks(vi.env,vi.fps,vi.t0).filter(p=>p.w>=0.18);   /* drop faint blips */
    const tp=tempo(vi.env,vi.fps,{min:60,max:200,prior:120});
    /* contrast: how much hits stand out from the background motion */
    const on=peaks.map(p=>vi.env[Math.round((p.t-vi.t0)*vi.fps)]||0);
    const contrast=peaks.length?median(on)/(median(on)+median(Array.from(vi.env))+1e-6):0;
    return {beats:peaks.map(p=>({t:+p.t.toFixed(3),w:p.w})),bpm:tp.bpm,conf:tp.conf,contrast,cam:vi.cam,mag:vi.mag};
  }

  /* ---------- fit: score ---------- */
  /* Beat Alignment Score: mean over motion beats of exp(-d^2 / 2 sigma^2), d = distance to nearest music beat (seconds). */
  function nearest(sorted,t){let lo=0,hi=sorted.length-1;if(hi<0)return Infinity;while(hi-lo>1){const m=(lo+hi)>>1;if(sorted[m]<t)lo=m;else hi=m}return Math.min(Math.abs(sorted[lo]-t),Math.abs(sorted[hi]-t))}
  function score(motion,musicBeats,sigma){
    sigma=sigma||0.05; if(!motion.length||!musicBeats.length)return null;
    let s=0,ws=0;const err=[];
    for(const m of motion){const d=nearest(musicBeats,m.t);const w=m.w==null?1:m.w;s+=w*Math.exp(-d*d/(2*sigma*sigma));ws+=w;err.push(d)}
    return {bas:s/ws,errMs:median(err)*1000,n:motion.length};
  }

  /* ---------- fit: per-move time warp ----------
     Move = source [s,e] played at base rate r (source s per output s). Song time at the move's start = S0, song rate ar.
     grid = [{t: song time, w: weight}] (downbeat 1.2, beat 1, half-beat 0.6).
     Each strong motion beat may be pinned to a grid point; between pins the speed is constant and kept within +/- maxStretch
     of r. Dynamic programming picks the pins that land the most accent weight with the least speed change.
     Returns knots [[sourceTime, outputTime from move start], ...] from s to e. */
  function warpMove(mb,s,e,r,S0,ar,grid,opt){
    opt=opt||{}; const maxS=opt.maxStretch||0.25, win=opt.window||0.35, minGap=opt.minGap||0.12;
    const P=mb.filter(m=>m.t>s+0.04&&m.t<e-0.04&&m.w>=(opt.minW||0.25)).sort((a,b)=>a.t-b.t);
    const L0=(e-s)/r; const out=o=>o;
    if(!P.length)return [[s,0],[e,L0]];
    const G=grid.map(g=>({o:(g.t-S0)/ar,w:g.w})).filter(g=>g.o>-0.05&&g.o<L0*(1+maxS)+0.5);
    /* candidates per motion beat */
    const C=P.map(m=>{const p=(m.t-s)/r;return G.filter(g=>Math.abs(g.o-p)<=win&&g.o>0.02).map(g=>({o:g.o,w:g.w}))});
    const okRate=(ds,dout)=>{if(dout<=minGap*0.5)return false;const q=(ds/dout)/r;return q>=1-maxS&&q<=1+maxS};
    const rateCost=(ds,dout)=>{const q=Math.log((ds/dout)/r);return q*q};
    /* states: index k of motion beat, chosen candidate c (or -1 = not pinned). Track last pin (src, out). */
    const SKIP=0.9, LAND=1.0, SMOOTH=opt.smooth||8;
    let states=[{cost:0,ls:s,lo:0,path:[]}];
    for(let k=0;k<P.length;k++){
      const next=[];
      for(const st of states){
        /* leave this beat unpinned */
        next.push({cost:st.cost+SKIP*P[k].w,ls:st.ls,lo:st.lo,path:st.path});
        for(const c of C[k]){
          const ds=P[k].t-st.ls, dout=c.o-st.lo;
          if(!okRate(ds,dout))continue;
          const cst=st.cost+SMOOTH*rateCost(ds,dout)+LAND*P[k].w*(1.2-c.w);
          next.push({cost:cst,ls:P[k].t,lo:c.o,path:st.path.concat([[P[k].t,c.o]])});
        }
      }
      /* keep the best state per (last pin) to stay small */
      const byKey=new Map();for(const st of next){const key=st.ls.toFixed(3)+'|'+st.lo.toFixed(3);const b=byKey.get(key);if(!b||st.cost<b.cost)byKey.set(key,st)}
      states=[...byKey.values()].sort((a,b)=>a.cost-b.cost).slice(0,60);
    }
    /* finish: the tail after the last pin plays at base speed */
    let best=null;for(const st of states){const tail=(e-st.ls)/r;const c=st.cost;if(!best||c<best.cost)best={...st,tail}}
    const knots=[[s,0]].concat(best.path);const last=knots[knots.length-1];
    knots.push([e,last[1]+(e-last[0])/r]);
    return knots.map(k=>[+k[0].toFixed(4),+out(k[1]).toFixed(4)]);
  }

  /* beats + half-beats with weights, from beat times and downbeat times */
  function grid(bt,down){
    const g=[];const ds=new Set((down||[]).map(t=>t.toFixed(3)));
    for(let i=0;i<bt.length;i++){g.push({t:bt[i],w:ds.has(bt[i].toFixed(3))?1.2:1});if(i<bt.length-1)g.push({t:(bt[i]+bt[i+1])/2,w:0.6})}
    return g;
  }
  return {onsetEnvelope,tempo,beats,downbeats,analyzeSong,flow,flowPyr,directogram,visualImpulses,pickPeaks,analyzeMotion,score,warpMove,grid,nearest,median};
})();
if(typeof module!=='undefined')module.exports=RA;
/*ANALYSIS-END*/
