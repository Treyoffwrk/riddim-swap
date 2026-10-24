/* Look & sound: defaults match the app as it was, packs and picked colours take effect and persist, paid packs follow the store rules,
   previews revert, and the sheet shows. Usage: node look_test.js <page url ending in #debug> <shot prefix> */
const {chromium}=require('playwright');const [,,page,shot]=process.argv;
const rec=(n,ok,d)=>{console.log((ok?'PASSED':'FAILED').padEnd(8),n,'—',d);if(!ok)process.exitCode=1};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 const open=async(q='')=>{await p.goto(page.replace('#debug',q+'#debug'));await p.waitForFunction(()=>window.__rs&&window.__rs.LOOK)};
 await open();await p.evaluate(()=>{localStorage.clear()});await open();

 /* 1 — nothing visible changes by default */
 let r=await p.evaluate(()=>{const R=window.__rs,tok=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
   return {ball:R.LOOK.ball(),skel:R.LOOK.skel(),snd:R.LOOK.snd(),song:tok('--song-hot'),dance:tok('--dance'),hips:tok('--hips'),n:R.PACKS.length,types:['ball','skeleton','sound','theme'].map(t=>({t,free:R.PACKS.filter(p=>p.type===t&&p.free).length,paid:R.PACKS.filter(p=>p.type===t&&!p.free).length})),cue:R.CUE.col}});
 rec('Defaults: balls use the app\'s own colours',r.ball.riddim===r.song&&r.ball.dancer===r.dance&&r.ball.ring==='single'&&r.ball.glow===0,JSON.stringify(r.ball));
 rec('Defaults: skeleton uses the app\'s own colours, no glow',r.skel.dance===r.dance&&r.skel.hips===r.hips&&r.skel.glow===0,JSON.stringify(r.skel));
 rec('Defaults: click is the original sine with the original pitches',r.snd.wave==='sine'&&same(r.snd.freq,{kick:520,snare:2100,both:900,one:1600,beat:1000})&&r.snd.decay===1&&r.snd.gain===1,JSON.stringify(r.snd));
 rec('Packs file: 16 packs, a free Classic and three paid packs for each of the four types',r.n===16&&r.types.every(t=>t.free===1&&t.paid===3),JSON.stringify(r.types));

 /* 2 — colours you pick: used by the cues, kept after a reload, cleared on reset */
 r=await p.evaluate(()=>{const L=window.__rs.LOOK;L.setPick('ballRiddim','#112233');L.setPick('skelHips','#445566');const a=window.__rs.CUE.col;return {cue:a&&a.song,ball:L.ball().riddim,skel:L.skel().hips,bad:L.setPick('ballRiddim','red')}});
 rec('Picked colour reaches the ball and skeleton, and bad values are refused',r.ball==='#112233'&&r.skel==='#445566'&&r.bad===false,JSON.stringify(r));
 await open();
 r=await p.evaluate(()=>({ball:window.__rs.LOOK.ball().riddim,skel:window.__rs.LOOK.skel().hips}));
 rec('Picked colours are still there after a reload',r.ball==='#112233'&&r.skel==='#445566',JSON.stringify(r));
 r=await p.evaluate(()=>{const L=window.__rs.LOOK;L.resetPicks();return L.ball().riddim===getComputedStyle(document.documentElement).getPropertyValue('--song-hot').trim()});
 rec('Reset goes back to the app\'s colours',r===true,String(r));

 /* 3 — packs on the web: every pack can be used; choosing a pack clears the picks in its group */
 r=await p.evaluate(()=>{const L=window.__rs.LOOK;L.setPick('ballDancer','#abcdef');L.setPick('skelDance','#fedcba');const ok=L.use('ball-neon');
   return {ok,ball:L.ball(),skelPick:L.skel().dance,pickGone:L.pick.ballDancer===undefined,skelKept:L.pick.skelDance==='#fedcba'}});
 rec('Web: a paid pack can be used (nothing is gated), and shows as designed',r.ok&&r.ball.riddim==='#FF3DF2'&&r.ball.dancer==='#3DFFE0'&&r.ball.ring==='double'&&r.ball.glow===0.7&&r.pickGone,JSON.stringify(r.ball));
 rec('Choosing a ball pack leaves the skeleton colours alone',r.skelKept&&r.skelPick==='#fedcba',r.skelPick);
 await open();
 r=await p.evaluate(()=>({sel:window.__rs.LOOK.sel.ball,col:window.__rs.LOOK.ball().riddim}));
 rec('The pack in use is kept after a reload',r.sel==='ball-neon'&&r.col==='#FF3DF2',JSON.stringify(r));

 /* 4 — the ball really draws in the pack's colour */
 r=await p.evaluate(()=>{const R=window.__rs;R.CUE.col=null;R.LOOK.apply();return R.CUE.col===null});
 rec('Changing the look refreshes the cue colours at once',r===true,String(r));

 /* 5 — theme */
 r=await p.evaluate(()=>{const L=window.__rs.LOOK,root=document.documentElement;L.use('theme-dancehall');const a=getComputedStyle(root).getPropertyValue('--bg').trim();const c=getComputedStyle(document.body).backgroundColor;
   L.use('theme-classic');const z=getComputedStyle(root).getPropertyValue('--bg').trim();return {a,c,z,inline:root.style.length}});
 rec('Theme: Dancehall sets the page colours, Classic puts them back',r.a.toLowerCase()==='#0b100c'&&r.z.toLowerCase()==='#0e1014'&&r.inline===0,JSON.stringify(r));

 /* 6 — click sound pack reaches the click (pitch, wave and length) */
 r=await p.evaluate(()=>{const L=window.__rs.LOOK;L.use('snd-cowbell');const s=L.snd();L.use('snd-classic');return {wave:s.wave,beat:s.freq.beat,decay:s.decay}});
 rec('Sound pack: Cowbell changes wave, pitch and length',r.wave==='square'&&r.beat===587&&r.decay===1.6,JSON.stringify(r));

 /* 7 — the sheet */
 await open();await p.click('#lookBtn');await p.waitForSelector('#lookSheet:not([hidden])');
 let n=await p.evaluate(()=>({cards:document.querySelectorAll('#lookPacks .pack').length,inUse:[...document.querySelectorAll('#lookPacks .pack[aria-current=true]')].map(x=>x.dataset.pack),buy:document.querySelectorAll('[data-act=buy]').length,note:!document.getElementById('lookStoreNote').hidden}));
 rec('Sheet (web): 16 cards, one in use per type, no Buy buttons, no store note',n.cards===16&&n.inUse.length===4&&n.buy===0&&!n.note,JSON.stringify(n));
 await p.screenshot({path:shot+'-web.png'});
 await p.click('[data-pack=ball-carnival] [data-act=use]');
 n=await p.evaluate(()=>({sel:window.__rs.LOOK.sel.ball,cur:document.querySelector('[data-pack=ball-carnival]').getAttribute('aria-current')}));
 rec('Tapping Use on a card chooses it',n.sel==='ball-carnival'&&n.cur==='true',JSON.stringify(n));
 await p.evaluate(()=>{const i=document.getElementById('pickBallRiddim');i.value='#336699';i.dispatchEvent(new Event('input',{bubbles:true}))});
 n=await p.evaluate(()=>window.__rs.LOOK.ball().riddim);rec('The colour picker in the sheet changes the ball',n==='#336699',n);
 await p.click('#lookClose');

 /* 8 — the store on: paid packs need to be owned, previews revert, a test purchase unlocks */
 await open('?store=1');await p.evaluate(()=>{localStorage.removeItem('rs-look');localStorage.removeItem('rs-owned')});await open('?store=1');
 r=await p.evaluate(()=>{const L=window.__rs.LOOK,S=window.__rs.STORE;return {on:S.on,use:L.use('ball-neon'),sel:L.sel.ball,free:L.use('ball-classic')}});
 rec('Store on: a paid pack can\'t be used until owned, free ones always can',r.on&&r.use===false&&r.sel==='ball-classic'&&r.free===true,JSON.stringify(r));
 r=await p.evaluate(()=>{const L=window.__rs.LOOK;L.tryOn('ball-neon');const a=L.ball().riddim;L.stopTry();return {a,b:L.ball().riddim===getComputedStyle(document.documentElement).getPropertyValue('--song-hot').trim()}});
 rec('Trying a pack shows it, stopping puts the old look back',r.a==='#FF3DF2'&&r.b===true,JSON.stringify(r));
 await p.click('#lookBtn');await p.waitForSelector('#lookSheet:not([hidden])');
 n=await p.evaluate(()=>({buy:document.querySelectorAll('[data-act=buy]').length,note:!document.getElementById('lookStoreNote').hidden,price:document.querySelector('[data-pack=ball-neon]').textContent}));
 rec('Sheet (store on): paid cards show a price and Buy, with the "every feature stays free" note',n.buy===12&&n.note&&/£0\.99/.test(n.price),JSON.stringify(n));
 await p.screenshot({path:shot+'-store.png'});
 await p.click('[data-pack=ball-neon] [data-act=try]');
 n=await p.evaluate(()=>({sheetHidden:document.getElementById('lookSheet').hidden,bar:!document.getElementById('lookBar').hidden,name:document.getElementById('lookBarName').textContent,use:document.getElementById('lookBarUse').textContent,col:window.__rs.LOOK.ball().riddim}));
 rec('Try it closes the sheet and shows a bar to buy or stop, with the pack on screen',n.sheetHidden&&n.bar&&n.name==='Trying Neon'&&/Buy/.test(n.use)&&n.col==='#FF3DF2',JSON.stringify(n));
 await p.screenshot({path:shot+'-try.png'});
 await p.click('#lookBarStop');
 n=await p.evaluate(()=>({bar:!document.getElementById('lookBar').hidden,col:window.__rs.LOOK.ball().riddim}));
 rec('Stop removes the preview and the bar',!n.bar&&n.col!=='#FF3DF2',JSON.stringify(n));
 await p.click('#lookBtn');await p.click('[data-pack=ball-neon] [data-act=buy]');
 n=await p.evaluate(()=>({sel:window.__rs.LOOK.sel.ball,owned:[...window.__rs.STORE.owned],msg:document.getElementById('lookMsg').textContent}));
 rec('Test purchase unlocks and applies the pack, and says no money was taken',n.sel==='ball-neon'&&n.owned.includes('ball-neon')&&/no money/i.test(n.msg),JSON.stringify(n));
 await open('?store=1');
 n=await p.evaluate(()=>({sel:window.__rs.LOOK.sel.ball,owned:[...window.__rs.STORE.owned]}));
 rec('What you own and use is kept after a reload',n.sel==='ball-neon'&&n.owned.includes('ball-neon'),JSON.stringify(n));
 rec('No page errors',errs.length===0,errs.join(' | ')||'none');
 await b.close()})();
