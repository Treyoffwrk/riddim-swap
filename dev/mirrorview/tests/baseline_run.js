/* Run the unmodified MirrorView v0.13 with a real clip: import, play, seek, prepare poses, Pulse. Record what happens. */
const {launch}=require('./harness');
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();const errs=[],logs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')logs.push(m.text().slice(0,160))});
 await p.goto(process.argv[2]);await p.waitForTimeout(1500);
 const txt=id=>p.evaluate(id=>{const e=document.getElementById(id);return e?e.textContent.trim().slice(0,160):null},id);
 console.log('version shown:',await p.evaluate(()=>(document.body.innerText.match(/0\.1\d/)||[''])[0]));
 await p.setInputFiles('#file-input',process.argv[3]);
 for(let i=0;i<40;i++){if((await txt('total-time'))&&!/0:00(\.0)?$/.test(await txt('total-time')))break;await p.waitForTimeout(250)}
 console.log('clip:',await txt('clip-name'),'| total:',await txt('total-time'));
 const v=()=>p.evaluate(()=>{const v=document.getElementById('reference-source');return {t:+v.currentTime.toFixed(2),paused:v.paused,muted:v.muted,rs:v.readyState,w:v.videoWidth,src:v.src.slice(0,30)}});
 console.log('video after import:',JSON.stringify(await v()));
 await p.evaluate(()=>document.querySelector('[data-action="play"]').click());await p.waitForTimeout(1500);console.log('after play 1.5 s:',JSON.stringify(await v()));
 await p.evaluate(()=>document.querySelector('[data-action="play"]').click());
 await p.evaluate(()=>{const v=document.getElementById('reference-source');v.currentTime=6});await p.waitForTimeout(500);console.log('after seek to 6:',JSON.stringify(await v()));
 /* pose preparation through the app's own action */
 const t0=Date.now();await p.evaluate(()=>document.querySelector('[data-action="analyse-reference"]').click());
 for(let i=0;i<600;i++){await p.waitForTimeout(500);const busy=await p.evaluate(()=>!document.getElementById('prepare-banner')?.hidden);if(!busy&&i>4)break}
 console.log('pose prep took',((Date.now()-t0)/1000).toFixed(0),'s · pose message:',await txt('pose-message'),'| cache label:',await txt('cache-label'));
 console.log('health:',await txt('health-message'));
 /* Pulse */
 await p.evaluate(()=>document.querySelector('[data-action="pulse-setup"]').click());await p.waitForTimeout(800);
 const btns=await p.evaluate(()=>[...document.querySelectorAll('#modal [data-action]')].map(b=>b.dataset.action+':'+b.textContent.trim().slice(0,30)));console.log('pulse dialog actions:',btns.slice(0,25).join(' | '));
 await p.screenshot({path:process.argv[4]});
 console.log('page errors',errs.length,errs.slice(0,5));console.log('console errors/warnings',logs.slice(0,8));
 await b.close()})();
