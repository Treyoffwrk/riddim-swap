/* Screenshots of the Get started card at phone size: empty project, then after the video is added. */
const {launch}=require('./harness');const [,,HOST,CLIP,OUT]=process.argv;
(async()=>{const {b,ctx}=await launch();const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
 await p.goto(HOST);await p.evaluate(()=>{indexedDB.deleteDatabase('riddim-swap');localStorage.clear()});await p.reload();await p.waitForTimeout(1500);
 await p.screenshot({path:OUT+'-start-empty.png'});
 await p.setInputFiles('#stVid',CLIP);await p.waitForTimeout(2500);await p.screenshot({path:OUT+'-start-video.png'});
 await b.close()})();
