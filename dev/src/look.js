/* ---------- look: how the balls, the skeleton, the click and the app colours look and sound ----------
   Nothing here changes what the app can do. A "pack" is a small record (src/packs.json) that says how one thing looks or sounds;
   the app reads the current look from LOOK instead of fixed colours, shapes and sounds. A pack field of null means "use the
   app's own colour", so the Classic packs reproduce the app exactly as it was.
   Order of strength, from strongest to weakest: a colour you picked yourself > the pack in use > the theme > the app's own colour.
   On the web version every pack can be used. Only with the store on (inside the App Store app, or ?store=1 to test) do paid packs
   need to be owned. */
const PACKS=/*@packs*/[];
const PACK_BY=new Map(PACKS.map(p=>[p.id,p]));
const LOOK_TYPES={ball:'ball-classic',skeleton:'skel-classic',sound:'snd-classic',theme:'theme-classic'};
const LOOK_PICKS={ballRiddim:'ball',ballDancer:'ball',skelDance:'skeleton',skelHips:'skeleton'};   /* colour you picked → the pack group it belongs to */
const STORE={on:false,owned:new Set(),test:false};
try{STORE.on=/[?&]store=1/.test(location.search)||!!window.Capacitor||localStorage.getItem('rs-store')==='1';STORE.test=!window.Capacitor}catch(e){}
try{(JSON.parse(localStorage.getItem('rs-owned')||'[]')||[]).forEach(id=>STORE.owned.add(String(id)))}catch(e){}
const LOOK={sel:{...LOOK_TYPES},pick:{},preview:{}};
const packOwned=p=>!!p&&(!!p.free||!STORE.on||STORE.owned.has(p.id));
function lookSave(){try{localStorage.setItem('rs-look',JSON.stringify({sel:LOOK.sel,pick:LOOK.pick}))}catch(e){}}
try{const o=JSON.parse(localStorage.getItem('rs-look')||'null');if(o&&typeof o==='object'){
  for(const t in LOOK_TYPES){const p=PACK_BY.get(o.sel&&o.sel[t]);if(p&&p.type===t&&packOwned(p))LOOK.sel[t]=p.id}
  for(const k in LOOK_PICKS)if(o.pick&&/^#[0-9a-f]{6}$/i.test(o.pick[k]))LOOK.pick[k]=o.pick[k]}}catch(e){}
/* the pack in use for one type (a preview wins while one is running) */
LOOK.pack=t=>PACK_BY.get(LOOK.preview[t]||LOOK.sel[t])||PACK_BY.get(LOOK_TYPES[t]);
const lookPicks=t=>LOOK.preview[t]?{}:LOOK.pick;   /* a preview shows the pack as designed, without your own colours */
LOOK.ball=()=>{const p=LOOK.pack('ball'),k=lookPicks('ball');return {riddim:k.ballRiddim||p.riddim||tok('--song-hot'),dancer:k.ballDancer||p.dancer||tok('--dance'),ring:p.ring||'single',glow:p.glow||0}};
LOOK.skel=()=>{const p=LOOK.pack('skeleton'),k=lookPicks('skeleton');return {dance:k.skelDance||p.dance||tok('--dance'),hips:k.skelHips||p.hips||tok('--hips'),glow:p.glow||0}};
LOOK.snd=()=>{const p=LOOK.pack('sound');return {wave:p.wave||'sine',freq:p.freq,decay:p.decay||1,gain:p.gain||1}};
/* the skeleton, drawn in the current look (glow is added around the same drawing; the drawing itself is unchanged) */
LOOK.drawBody=(c,B,t,rect,o,dpr)=>{const s=LOOK.skel();c.save();try{if(s.glow){c.shadowColor=s.dance;c.shadowBlur=s.glow*14*(dpr||1)}RB.draw(c,B,t,rect,{...o,dance:s.dance,hips:s.hips})}finally{c.restore()}};
/* theme colours go on the page as !important inline values (the page's own palette is !important too) */
const LOOK_VARS=new Set();
LOOK.apply=()=>{const root=document.documentElement;for(const v of LOOK_VARS)root.style.removeProperty(v);LOOK_VARS.clear();
  const vars=LOOK.pack('theme').vars||{};for(const k in vars){root.style.setProperty(k,vars[k],'important');LOOK_VARS.add(k)}
  CUE.col=null;CUE.stillKey='';try{drawBody()}catch(e){}};
/* hear a click pack: a 1 and three beats */
LOOK.hear=pk=>{const c=getCtx();if(c.state!=='running')c.resume().catch(()=>{});const t0=c.currentTime+0.05,d=pk.decay||1,pg=pk.gain||1;
  ['one','beat','beat','beat'].forEach((kd,i)=>{const when=t0+i*0.4,o=c.createOscillator(),g=c.createGain();o.type=pk.wave||'sine';o.frequency.value=pk.freq[kd];
    g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(0.32*pg,when+0.002);g.gain.exponentialRampToValueAtTime(0.001,when+0.05*d);o.connect(g);g.connect(c.destination);o.start(when);o.stop(when+0.1*Math.max(1,d))})};
/* choosing, previewing and buying */
LOOK.use=id=>{const p=PACK_BY.get(id);if(!p||!packOwned(p))return false;LOOK.sel[p.type]=id;LOOK.preview={};
  for(const k in LOOK_PICKS)if(LOOK_PICKS[k]===p.type)delete LOOK.pick[k];   /* a pack looks as designed until you pick a colour again */
  lookSave();LOOK.apply();return true};
LOOK.tryOn=id=>{const p=PACK_BY.get(id);if(!p)return false;LOOK.preview={[p.type]:id};LOOK.apply();return true};
LOOK.stopTry=()=>{LOOK.preview={};LOOK.apply()};
LOOK.setPick=(k,v)=>{if(!(k in LOOK_PICKS)||!/^#[0-9a-f]{6}$/i.test(v))return false;LOOK.pick[k]=v;lookSave();LOOK.apply();return true};
LOOK.resetPicks=()=>{LOOK.pick={};lookSave();LOOK.apply()};
/* buying: the App Store app connects real purchases here later. Until then only a clearly labelled test purchase works (no money moves) */
STORE.buy=async id=>{const p=PACK_BY.get(id);if(!p||p.free)return {ok:false,why:'Nothing to buy'};
  if(!STORE.test)return {ok:false,why:'Purchases are not connected yet.'};
  STORE.owned.add(id);try{localStorage.setItem('rs-owned',JSON.stringify([...STORE.owned]))}catch(e){}return {ok:true,test:true}};

/* ---------- the Look sheet ---------- */
const LOOK_GROUPS=[['ball','Balls and cues'],['skeleton','Skeleton'],['sound','Click sounds'],['theme','App theme']];
const hex6=s=>/^#[0-9a-f]{6}$/i.test(s)?s:(/^#[0-9a-f]{3}$/i.test(s)?'#'+s.slice(1).split('').map(x=>x+x).join(''):'#888888');
let lookFrom=null;
function lookMsg(t,err){const m=$('#lookMsg');m.hidden=!t;m.textContent=t||'';m.classList.toggle('err',!!err)}
function packDots(p){const w=el('span','dots');w.setAttribute('aria-hidden','true');
  let cols=[];if(p.type==='ball')cols=[p.riddim||tok('--song-hot'),p.dancer||tok('--dance')];else if(p.type==='skeleton')cols=[p.dance||tok('--dance'),p.hips||tok('--hips')];
  else if(p.type==='theme'){const v=p.vars||{};cols=[v['--bg']||tok('--bg'),v['--song-hot']||tok('--song-hot'),v['--dance']||tok('--dance')]}
  else cols=[tok('--ink')];
  cols.forEach(c=>{const i=document.createElement('i');i.style.background=c;w.append(i)});if(p.type==='sound'){const s=el('small',null,p.wave);w.append(s)}return w}
function renderLook(){
  const k=LOOK.ball(),s=LOOK.skel();
  [['#pickBallRiddim',LOOK.pick.ballRiddim||k.riddim],['#pickBallDancer',LOOK.pick.ballDancer||k.dancer],['#pickSkelDance',LOOK.pick.skelDance||s.dance],['#pickSkelHips',LOOK.pick.skelHips||s.hips]].forEach(([id,v])=>{$(id).value=hex6(v)});
  const box=$('#lookPacks');box.textContent='';
  for(const [type,title] of LOOK_GROUPS){
    const h=el('h4',null,title),grid=el('div','look-grid');grid.dataset.type=type;
    for(const p of PACKS.filter(x=>x.type===type)){
      const inUse=LOOK.sel[type]===p.id, own=packOwned(p), card=el('div','pack');card.dataset.pack=p.id;card.setAttribute('aria-current',String(inUse));
      const top=el('div','pack-top');top.append(el('b',null,p.name),packDots(p));card.append(top);
      if(STORE.on&&!p.free)card.append(el('span','hint',own?'Owned':p.price||''));
      const row=el('div','row');row.style.gap='6px';
      if(inUse){const b=el('button','btn sm','In use');b.disabled=true;row.append(b)}
      else if(own){const b=el('button','btn sm','Use');b.dataset.act='use';b.addEventListener('click',()=>{LOOK.use(p.id);lookPreviewBar();renderLook()});row.append(b)}
      else{const b=el('button','btn sm','Buy '+(p.price||''));b.dataset.act='buy';b.addEventListener('click',async()=>{const r=await STORE.buy(p.id);
          if(r.ok){LOOK.use(p.id);lookMsg((r.test?'Test purchase (no money taken). ':'')+p.name+' is yours.')}else lookMsg(r.why,true);renderLook()});row.append(b)}
      if(type==='sound'){const b=el('button','btn sm ghost','Hear it');b.dataset.act='hear';b.addEventListener('click',()=>LOOK.hear(p));row.append(b)}
      else if(!inUse){const b=el('button','btn sm ghost','Try it');b.dataset.act='try';b.addEventListener('click',()=>{LOOK.tryOn(p.id);lookPreviewBar();closeLook()});row.append(b)}
      card.append(row);grid.append(card)}
    box.append(h,grid)}
  $('#lookStoreNote').hidden=!STORE.on}
function lookPreviewBar(){const t=Object.keys(LOOK.preview)[0],bar=$('#lookBar');
  if(!t){bar.hidden=true;return}
  const p=PACK_BY.get(LOOK.preview[t]),own=packOwned(p);bar.hidden=false;$('#lookBarName').textContent='Trying '+p.name;
  const act=$('#lookBarUse');act.textContent=own?'Use it':'Buy '+(p.price||'');act.dataset.id=p.id}
function openLook(){lookFrom=document.activeElement;LOOK.stopTry();lookPreviewBar();lookMsg('');renderLook();$('#lookSheet').hidden=false;$('#lookBack').hidden=false;$('#lookClose').focus()}
function closeLook(){$('#lookSheet').hidden=true;$('#lookBack').hidden=true;if(lookFrom&&lookFrom.focus)lookFrom.focus()}
$('#lookBtn').addEventListener('click',openLook);
$('#lookClose').addEventListener('click',closeLook);
$('#lookBack').addEventListener('click',closeLook);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lookSheet').hidden)closeLook()});
for(const [id,key] of [['#pickBallRiddim','ballRiddim'],['#pickBallDancer','ballDancer'],['#pickSkelDance','skelDance'],['#pickSkelHips','skelHips']])
  $(id).addEventListener('input',e=>{LOOK.setPick(key,e.target.value);renderLookCards()});
function renderLookCards(){$$('#lookPacks .pack').forEach(c=>c.setAttribute('aria-current',String(LOOK.sel[PACK_BY.get(c.dataset.pack).type]===c.dataset.pack)))}
$('#pickReset').addEventListener('click',()=>{LOOK.resetPicks();renderLook()});
$('#lookBarStop').addEventListener('click',()=>{LOOK.stopTry();lookPreviewBar()});
$('#lookBarUse').addEventListener('click',async e=>{const id=e.currentTarget.dataset.id,p=PACK_BY.get(id);if(!p)return;
  if(!packOwned(p)){const r=await STORE.buy(id);if(!r.ok){$('#lookBarName').textContent=r.why;return}}
  LOOK.use(id);lookPreviewBar()});
LOOK.apply();
