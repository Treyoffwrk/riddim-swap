/* How well the skeleton keeps up with fast moves: the tracker's own output (raw) against the cleaned track the app draws.
   For confident points (raw visibility >= 0.6): how often cleaning moves them, overall and in fast moments, and how much
   of the hands' and feet's movement survives. Usage: node track_quality.js <host> <clip> [model: full|heavy|lite] */
const {launch}=require('/home/claude/mv/tests/harness');
const [,,HOST,CLIP,MODEL]=process.argv;
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(m=>{window.RB_DELEGATE='CPU';window.RB_RAW=[];if(m)window.RB_MODEL=m},MODEL||'');
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 await p.setInputFiles('#vidFile',CLIP);await p.waitForTimeout(2000);const t0=Date.now();
 await p.click('#bodyTrack');for(let i=0;i<4000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const r=await p.evaluate(()=>{const R=window.__rs,B=R.srcById(R.S.cur).body,raw=window.RB_RAW[window.RB_RAW.length-1],S=RB.STRIDE,n=B.n,asp=B.h/B.w;
   const X=(D,i,j)=>D[i*S+1+j*3],Y=(D,i,j)=>D[i*S+2+j*3]*asp,V=(D,i,j)=>D[i*S+3+j*3];
   const T=i=>{const D=raw.data;const sx=(X(D,i,11)+X(D,i,12))/2,sy=(Y(D,i,11)+Y(D,i,12))/2,hx=(X(D,i,23)+X(D,i,24))/2,hy=(Y(D,i,23)+Y(D,i,24))/2;return Math.hypot(sx-hx,sy-hy)||NaN};
   const groups={wrists:[15,16],elbows:[13,14],ankles:[27,28],knees:[25,26],core:[11,12,23,24]};const out={n,ms:+B.msPerFrame.toFixed(0)};
   for(const g in groups){let conf=0,moved=0,fast=0,fastMoved=0,pathRaw=0,pathClean=0,errSum=0;
     for(const j of groups[g])for(let i=1;i<n;i++){const t=T(i);if(!(t>0))continue;const vr=V(raw.data,i,j);if(isNaN(X(raw.data,i,j))||isNaN(X(B.data,i,j)))continue;
       const d=Math.hypot(X(raw.data,i,j)-X(B.data,i,j),Y(raw.data,i,j)-Y(B.data,i,j))/t;
       const sp=Math.hypot(X(raw.data,i,j)-X(raw.data,i-1,j),Y(raw.data,i,j)-Y(raw.data,i-1,j))/t;
       if(vr>=0.6){conf++;errSum+=d;if(d>0.08)moved++;if(sp>0.12){fast++;if(d>0.08)fastMoved++;pathRaw+=sp;pathClean+=Math.hypot(X(B.data,i,j)-X(B.data,i-1,j),Y(B.data,i,j)-Y(B.data,i-1,j))/t}}}
     out[g]={confident:conf,moved:+(moved/conf*100).toFixed(1)+'%',fastFrames:fast,fastMoved:fast?+(fastMoved/fast*100).toFixed(1)+'%':'-',fastMotionKept:pathRaw?+(pathClean/pathRaw*100).toFixed(0)+'%':'-',meanShift:+(errSum/conf).toFixed(3)}}
   out.clean=B.clean;return out});
 if(process.env.DUMP){const d=await p.evaluate(()=>{const R=window.__rs,B=R.srcById(R.S.cur).body,raw=window.RB_RAW[window.RB_RAW.length-1];return {S:RB.STRIDE,n:B.n,w:B.w,h:B.h,raw:Array.from(raw.data),clean:Array.from(B.data)}});require('fs').writeFileSync(process.env.DUMP,JSON.stringify(d))}
 console.log(JSON.stringify({clip:CLIP.split('/').pop(),model:MODEL||'full',secs:(Date.now()-t0)/1000|0,...r},null,0));
 if(errs.length)console.log('errors',errs.slice(0,3));await b.close()})();
