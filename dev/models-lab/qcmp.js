const fs=require('fs');const files=process.argv.slice(2);const [A,...Bs]=files.map(f=>JSON.parse(fs.readFileSync(f)));const S=A.S,asp=A.h/A.w;
const X=(d,i,j,k)=>d[k][i*S+1+j*3],Y=(d,i,j,k)=>d[k][i*S+2+j*3]*asp,TT=(d,i,k)=>d[k][i*S];
const T=(d,i,k)=>Math.hypot((X(d,i,11,k)+X(d,i,12,k))/2-(X(d,i,23,k)+X(d,i,24,k))/2,(Y(d,i,11,k)+Y(d,i,12,k))/2-(Y(d,i,23,k)+Y(d,i,24,k))/2);
const G={wrists:[15,16],elbows:[13,14],knees:[25,26],ankles:[27,28],feet:[31,32]};
Bs.forEach((B,bi)=>{for(const k of ['raw','clean']){const idx=new Map();for(let i=0;i<B.n;i++)idx.set(Math.round(TT(B,i,k)*100),i);const o={};let matched=0;
 for(const g in G){let n=0,f5=0,f12=0,s=0;for(let i=0;i<A.n;i++){const key=Math.round(TT(A,i,k)*100);let ib=idx.get(key);if(ib==null)ib=idx.get(key+1)??idx.get(key-1);if(ib==null)continue;if(g==='wrists')matched++;const t=T(A,i,k);if(!(t>0))continue;for(const j of G[g]){const d=Math.hypot(X(A,i,j,k)-X(B,ib,j,k),Y(A,i,j,k)-Y(B,ib,j,k))/t;if(isNaN(d))continue;n++;s+=d;if(d>0.05)f5++;if(d>0.12)f12++}}o[g]=`${(s/n).toFixed(3)} | >5% ${(f5/n*100).toFixed(1)} | >12% ${(f12/n*100).toFixed(1)}`}
 console.log(files[1+bi].split('/').pop(),k,'matched',matched,JSON.stringify(o))}});
