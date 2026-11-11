/**
 * v0.6 art gate: real WebGL (never fake meshes or a canned mature village).
 * Capture matching seed/year/camera/viewport evidence for an installed repo
 * checkout. Run once against baseline main, then once against this branch.
 *
 * node tests/v060-visual-evidence.mjs --project=. --label=phase-a
 * node tests/v060-visual-evidence.mjs --project=baseline --label=baseline
 */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';

const option=(key,fallback)=>{
 const prefix='--'+key+'=';
 return process.argv.find(arg=>arg.startsWith(prefix))?.slice(prefix.length)??fallback;
};
const project=resolve(option('project','.'));
const label=option('label','phase-a');
const output=resolve(option('out',join('artifacts','evidence','v060',label)));
const port=Number(option('port','5194'));
const base='http://127.0.0.1:'+port+'/';
const DAY=1440,YEAR=48*DAY;
await mkdir(output,{recursive:true});
let serverOutput='';
// Launch Vite itself, not `npm run dev`. npm leaves a grandchild
// holding stdout/stderr open after SIGTERM; the first baseline capture then
// hangs for six hours and GitHub cancels before v0.6 ever gets captured.
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',
 '--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:project,stdio:['ignore','pipe','pipe']
});
server.stdout.on('data',b=>serverOutput+=b.toString());
server.stderr.on('data',b=>serverOutput+=b.toString());
let browser;
const failures=[],captures=[];
const fpsNote='No hardware FPS measurement: SwiftShader Chromium only';
const variants=[
 {seed:42,viewport:{width:1440,height:900},tag:'desktop',
  days:[{day:0,name:'00-new-camp'},{day:12,name:'01-summer'},
   {day:108,name:'03-summer'},{day:204,name:'05-summer'},
   {day:216,name:'05-autumn'},{day:228,name:'05-winter'}]},
 {seed:20261103,viewport:{width:1440,height:900},tag:'second-seed',
  days:[{day:108,name:'03-summer'},{day:204,name:'05-summer'}]},
 {seed:42,viewport:{width:390,height:844},tag:'mobile',
  days:[{day:0,name:'00-new-camp'},{day:204,name:'05-summer'},
   {day:228,name:'05-winter'}]}
];
try{
 let available=false;
 for(let i=0;i<60;i++){
  try{if((await fetch(base+'pioneer.html')).ok){available=true;break;}}catch{}
  await delay(500);
 }
 if(!available)throw Error('Vite did not start: '+serverOutput.slice(-1500));
 browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
 ]});
 for(const variant of variants){
  const context=await browser.newContext({viewport:variant.viewport,deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',error=>failures.push(variant.tag+': '+error.message));
  page.on('console',message=>{
   if(message.type()==='error')failures.push(variant.tag+': '+message.text());
  });
  await page.goto(base+'pioneer.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
  await page.evaluate(seed=>{
   window.__PIONEER_DEBUG__.reset(seed);
  },variant.seed);
  await page.locator('#pioneerCamera').click();
  // Stop real-time clock movement so screenshots are reproducible.
  await page.locator('#pioneerPause').click();
  const start=await page.evaluate(()=>window.__PIONEER_DEBUG__.getState());
  if(start.founders.length!==3||start.buildings.length!==0)
   throw Error('Not a truly empty three-founder start: '+JSON.stringify(start.buildings));
  for(const frame of variant.days){
   const minute=frame.day*DAY+12*60;
   const world=await page.evaluate(target=>{
    const d=window.__PIONEER_DEBUG__,s=d.getState();
    if(target>s.minutes)d.advance((target-s.minutes)/3);
    return d.getState();
   },minute);
   const name='seed-'+variant.seed+'-'+variant.tag+'-'+frame.name;
   await page.waitForTimeout(280);
   const snapshot=await page.evaluate(()=>{
    const d=window.__PIONEER_DEBUG__,s=d.getState(),canvas=document.querySelector('#pioneerWorld');
    return {
     schemaVersion:s.schemaVersion,seed:s.seed,minutes:s.minutes,
     buildings:s.buildings.map(b=>({
      id:b.id,kind:b.kind,style:b.parcel.homesteadStyle??null,
      at:[b.parcel.x,b.parcel.z],size:[b.parcel.width,b.parcel.depth],
      condition:b.condition,wood:b.materialsSpent.wood,work:b.workHours,
      loftAddedAt:b.loftAddedAt??null
     })),
     founders:s.founders.length,roads:s.roads.length,clearings:s.frontier.clearings.length,
     visual:d.getVisuals(),renderer:d.getRendererInfo(),
     cameraPreset:'Reset camera: exact same default ortho pose and zoom',
     camera:d.getCameraSnapshot?.()??null,
     viewport:{width:window.innerWidth,height:window.innerHeight,
      canvasWidth:canvas.clientWidth,canvasHeight:canvas.clientHeight}
    };
   });
   if(snapshot.buildings.length!==world.buildings.length)
    throw Error('Renderer and world registry disagree at '+name);
   const png=await page.screenshot({path:join(output,name+'.png')});
   if(png.length<13000)throw Error('Possible blank WebGL screenshot: '+name);
   // Color-blind silhouette review. It is an actual rendered canvas filter,
   // not a drawing generated from geometry metadata.
   const canvas=page.locator('#pioneerWorld');
   await canvas.evaluate(el=>el.style.filter='grayscale(100%) contrast(118%)');
   await page.waitForTimeout(90);
   const gray=await canvas.screenshot({path:join(output,name+'-gray.png')});
   await canvas.evaluate(el=>el.style.filter='');
   captures.push({
    ...snapshot,label,frame:frame.name,name,yearDay:frame.day,format:'PNG',
    viewportName:variant.tag,
    sha256:createHash('sha256').update(png).digest('hex'),
    graySha256:createHash('sha256').update(gray).digest('hex')
   });
   // Keep readable partial evidence if a late WebGL frame or later seed fails.
   await writeFile(join(output,'manifest.json'),JSON.stringify({
    label,project,baselineCamera:'Reset camera, same default pose',
    hardware:'CI software WebGL / SwiftShader',fpsNote,failures,captures
   },null,2));
   process.stdout.write(name+': '+snapshot.buildings.length+' built / '+
    snapshot.founders+' people / '+snapshot.renderer.calls+' calls\n');
  }
  await context.close();
 }
 if(failures.length)throw Error('Browser errors: '+failures.slice(0,12).join('; '));
 await writeFile(join(output,'manifest.json'),JSON.stringify({
  label,project,screenshotWidth:1440,screenshotHeight:900,
  baselineCamera:'Reset camera, zoom 1, same app default',
  hardware:'CI software WebGL / SwiftShader',
  fpsNote,failures,captures
 },null,2));
}finally{
 await browser?.close();
 server.kill('SIGTERM');
 server.stdout.destroy();
 server.stderr.destroy();
 await new Promise(resolve=>{
  if(server.exitCode!==null||server.signalCode!==null){resolve();return;}
  server.once('exit',resolve);
 });
}
