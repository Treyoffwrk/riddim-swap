/* The Legs / Upper body values card in the real page: renders from a tracked clip, follows the Upper / Legs / Whole switch,
   shows the accuracy badge, and the compare text carries part scores. Usage: node parts_ui_test.js <repo folder> <video>
   (serves the folder itself; uses a synthetic body track so no tracker download is needed) */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const [,,root,video]=process.argv;let fails=0;const rec=(n,ok,d)=>{if(!ok)fails++;console.log((ok?'PASSED':'FAILED').padEnd(8),n,'—',d)};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'application/octet-stream'});r.end(b)})});
function synth(n,fps,legAmp,upAmp){const STRIDE=100,data=[];const W=1,H=640/360;   /* h/w of the video */
  for(let i=0;i<n;i++){const t=i/fps,row=new Array(STRIDE).fill(0.5);row[0]=t;const T=0.1,cy=0.3,cx=0.5;
    const P=[];for(let j=0;j<33;j++)P.push([cx,cy]);
    const lean=upAmp*Math.PI/180*Math.sin(2*Math.PI*1.2*t),sh=[cx+Math.sin(lean)*T,cy-Math.cos(lean)*T];
    P[23]=[cx+.02,cy];P[24]=[cx-.02,cy];P[11]=[sh[0]+.03,sh[1]];P[12]=[sh[0]-.03,sh[1]];
    P[13]=[P[11][0]+.015,P[11][1]+.05];P[14]=[P[12][0]-.015,P[12][1]+.05];P[15]=[P[13][0]+.01,P[13][1]+.05];P[16]=[P[14][0]-.01,P[14][1]+.05];
    for(const [h,k,a,ph] of [[23,25,27,0],[24,26,28,Math.PI]]){const th=legAmp*Math.PI/180*Math.sin(2*Math.PI*1.2*t+ph);P[k]=[P[h][0]+Math.sin(th)*.11,P[h][1]+Math.cos(th)*.11];P[a]=[P[k][0]+Math.sin(th*.5)*.11,P[k][1]+Math.cos(th*.5)*.11]}
    for(let j=0;j<33;j++){row[1+j*3]=P[j][0];row[2+j*3]=P[j][1]/H;row[3+j*3]=1}
    data.push(...row)}
  return {n,data,w:360,h:640,fps,v:2,start:0,end:n/fps}}
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const p=await (await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://localhost:${port}/index.html#debug`);await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
  await p.setInputFiles('#vidFile',video);await p.waitForTimeout(2500);await p.click('#t-clip');await p.waitForTimeout(400);
  const B=synth(150,30,28,10);
  await p.evaluate(B=>{const R=window.__rs,n=R.srcById(R.S.cur);n.key=n.key||'test-key';const o=Object.assign({},B);o.data=Float32Array.from(B.data);n.body=o;R.hipGraph()},B);
  await p.waitForTimeout(600);
  const html=await p.evaluate(()=>{__rs.hipGraph();return document.getElementById('partVals').innerText});
  rec('The values card shows both parts with an accuracy badge',/Legs/.test(html)&&/Upper body/.test(html)&&/Accuracy \d+/.test(html),JSON.stringify(html.replace(/\n+/g,' | ').slice(0,200)));
  /* the cards follow the playhead */
  const v1=await p.evaluate(()=>{__rs.v().currentTime=0.2;__rs.hipGraph();return document.querySelector('#partVals .pv dd').innerText});
  const v2=await p.evaluate(()=>{__rs.v().currentTime=0.45;__rs.hipGraph();return document.querySelector('#partVals .pv dd').innerText});
  rec('Values change as the playhead moves',v1!==v2,`thigh at 0.2 s "${v1}" · at 0.45 s "${v2}"`);
  /* isolation switch */
  const cards=async part=>p.evaluate(part=>{__rs.S.cutPart=part;__rs.hipGraph();return [...document.querySelectorAll('#partVals .pv h4')].map(h=>h.childNodes[0].textContent)},part);
  const legs=await cards('legs'),upper=await cards('upper'),all=await cards('all');
  rec('Legs mode shows legs only, Upper mode upper only, Whole shows both',legs.join()==='Legs'&&upper.join()==='Upper body'&&all.join()==='Legs,Upper body',`legs→${legs} · upper→${upper} · whole→${all}`);
  /* compare text carries part scores */
  const txt=await p.evaluate(B=>{const mk=()=>{const o=Object.assign({},B);o.data=Float32Array.from(B.data);return o};
    const c={match:.9,similarity:.9,size:1,lag:0,mirrored:false,drift:[],weakest:null,parts:window.RB.partMatch(mk(),mk(),{})};return __rs.compareText(c)},B);
  rec('Compare text names legs and upper-body scores with a reading quality',/Legs <b>\d+%<\/b>/.test(txt)&&/Upper body <b>\d+%<\/b>/.test(txt)&&/(solid|fair|shaky) reading/.test(txt),txt.replace(/<[^>]+>/g,'').slice(-170));
  rec('No page errors',errs.length===0,errs.join(' | ')||'none');
  await b.close();srv.close();console.log(fails?`\n${fails} FAILED`:'\nall passed');process.exit(fails?1:0)})();
