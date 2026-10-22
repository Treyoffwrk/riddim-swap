/* Hip patterns: right on made-up movements of each kind, sensible on your clip, moves tagged and filterable.
   Usage: node patterns_test.js <host index.html> <clip> <song> <shot prefix> */
const {launch}=require('./harness');
const [,,HOST,CLIP,SONG,SHOT]=process.argv;const rec=(n,s,d)=>console.log(s.toUpperCase().padEnd(8),n,'—',d);
(async()=>{const {b,ctx}=await launch();await ctx.addInitScript(()=>{window.RB_DELEGATE='CPU'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(HOST+'#debug');await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();
 /* made-up hip movements, 1.5 s windows, wobble as in real tracking */
 const conf=await p.evaluate(()=>{const R=window.__rs,g=()=>{let u=0,v=0;while(!u)u=Math.random();v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
   const mk=(kind)=>{const N=45,t=[...Array(N)].map((_,i)=>i/30),f={circle:1.6,tilt:1.7,pulse:3.3,sway:1.2}[kind]||1.5,ph=Math.random()*6.28,T=[],S=[],H=[];
     let rx=0,ry=0;for(const x of t){const w=2*Math.PI*f*x+ph;rx+=1.2*g();ry+=0.01*g();
       if(kind==='still'){T.push(0.4*Math.sin(2*Math.PI*0.3*x)+0.5*g());S.push(0.01*Math.sin(1.2*x)+0.006*g());H.push(0.03*g())}
       if(kind==='circle'){T.push(6*Math.sin(w+1.6)+0.6*g());S.push(0.08*Math.sin(w)+0.008*g());H.push(0.08*Math.cos(w)+0.05*g())}
       if(kind==='tilt'){T.push(9*Math.sin(w)+0.6*g());S.push(0.02*Math.sin(w)+0.008*g());H.push(0.05*g())}
       if(kind==='pulse'){T.push(5*Math.sin(w)+0.6*g());S.push(0.02*Math.sin(w)+0.008*g());H.push(0.05*g())}
       if(kind==='sway'){T.push(1.5*Math.sin(w)+0.6*g());S.push(0.09*Math.sin(w)+0.008*g());H.push(0.05*g())}
       if(kind==='free'){T.push(rx);S.push(ry);H.push(0.05*g())}}
     return R.patWindow(T,S,H,1)};
   const out={};for(const k of ['still','circle','tilt','pulse','sway','free']){const c={};for(let i=0;i<120;i++){const l=mk(k)||'unnamed';c[l]=(c[l]||0)+1}out[k]=c}return out});
 const right=k=>(conf[k][k==='free'?'unnamed':k]||0)/120;
 rec('Each kind of made-up hip movement is named right',['still','circle','tilt','pulse','sway'].every(k=>right(k)>=0.95)?'passed':'failed',JSON.stringify(conf));
 rec('Random drifting is mostly left unnamed (not called a pattern)',right('free')>=0.8&&!(conf.free.circle>6)?'passed':'failed',JSON.stringify(conf.free));
 /* your clip */
 await p.setInputFiles('#vidFile',CLIP);await p.setInputFiles('#audFile',SONG);await p.waitForTimeout(3000);
 await p.click('#bodyTrack');for(let i=0;i<2000;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!window.__rs.S.bodyBusy&&!!window.__rs.srcById(window.__rs.S.cur).body))break}
 const pats=await p.evaluate(()=>{const R=window.__rs,B=R.srcById(R.S.cur).body;return R.hipPatterns(B).map(r=>[r.lab,+r.t0.toFixed(1),+r.t1.toFixed(1)])});
 rec('Your clip: some stretches named, the rest left mixed',pats.length>0?'passed':'failed',JSON.stringify(pats));
 await p.click('#t-clip');await p.locator('#hipCard').scrollIntoViewIfNeeded();await p.waitForTimeout(600);
 rec('Hip moves card lists the patterns',/Hip patterns/.test(await p.textContent('#patLine'))?'passed':'failed',await p.textContent('#patLine'));
 await p.locator('#hipCard').screenshot({path:SHOT+'-patterns.png'});
 /* moves: one cut on a named stretch, one elsewhere */
 const tag=await p.evaluate(pats=>{const R=window.__rs,S=R.S;const r=pats.slice().sort((x,y)=>(y[2]-y[1])-(x[2]-x[1]))[0];
   S.moves.push({id:'mA',src:S.cur,s:r[1],e:r[2],name:'Named move'});S.moves.push({id:'mB',src:S.cur,s:0,e:0.4,name:'Short start'});
   R.renderMoves();return {expect:r[0],a:R.movePattern(S.moves[0]),b:R.movePattern(S.moves[1])}},pats);
 await p.click('#t-moves');await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('#t-moves').click());
 await p.evaluate(()=>{window.__rs.S.patFilter='all'});await p.click('#t-clip');await p.click('#t-moves');await p.waitForTimeout(400);
 const ui=await p.evaluate(()=>({filter:!document.getElementById('patFilter').hidden,buttons:[...document.querySelectorAll('#patFilter button')].map(b=>b.textContent),tags:[...document.querySelectorAll('#moveList .pattag')].map(t=>t.textContent),items:document.querySelectorAll('#moveList li').length}));
 rec('A move cut on a named stretch gets that tag',tag.a===tag.expect&&ui.tags.length>=1?'passed':'failed',JSON.stringify({tag,ui}));
 const btn=await p.$$('#patFilter button');if(btn[1])await btn[1].click();await p.waitForTimeout(300);
 const filtered=await p.evaluate(()=>document.querySelectorAll('#moveList li').length);
 rec('Filtering by pattern shows only those moves',ui.items===2&&filtered===1?'passed':'failed',`all: ${ui.items}, filtered: ${filtered}`);
 rec('No page errors',errs.length?'failed':'passed',JSON.stringify(errs.slice(0,3)));
 await b.close()})();
