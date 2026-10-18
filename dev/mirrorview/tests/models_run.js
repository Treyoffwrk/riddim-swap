const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage();p.on('console',m=>{if(m.text().startsWith('done'))console.log(m.text())});p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://localhost:8801/run/models.html');await p.waitForFunction(()=>window.ready);
 const runs=JSON.parse(process.argv[2]);
 const r=await p.evaluate(c=>window.runModels(c),{dir:'/run/fr2',count:300,runs});
 fs.writeFileSync(process.argv[3],JSON.stringify(r));await b.close()})();
