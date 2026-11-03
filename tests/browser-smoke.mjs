/**
 * Real Chromium/WebGL regression for v0.3: desktop+mobile, season snapshots,
 * a rainy-guest intervention, a repair cycle and nonempty renderer diagnostics.
 */
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const URL='http://127.0.0.1:5188/';
const out='artifacts/browser-smoke';
await mkdir(out,{recursive:true});
const child=spawn('npm',['run','dev','--','--host','127.0.0.1'],{stdio:'pipe'});
let logs='';child.stderr.on('data',d=>logs+=d.toString());child.stdout.on('data',d=>logs+=d.toString());
let browser;
const errors=[],results=[];

/** Decode a real viewport screenshot in Chromium; sample only the visible valley
 * (outside interface panels) so hashes and changed NPC labels cannot pass art QA.
 */
async function snapshotValley(page,name){
 await page.waitForTimeout(360);
 const bytes=await page.screenshot({path:out+'/'+name+'.png'});
 if(bytes.length<12000)throw Error('Empty visual screenshot: '+name);
 const pixels=await page.evaluate(async b64=>{
  const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('No screenshot canvas 2D context');
  ctx.drawImage(img,0,0);
  const samples=[];
  for(let y=180;y<680;y+=16)for(let x=385;x<1020;x+=16){
   const a=ctx.getImageData(x,y,1,1).data;
   samples.push(a[0],a[1],a[2]);
  }
  return samples;
 },bytes.toString('base64'));
 return {pixels,bytes:bytes.length,digest:createHash('sha256').update(bytes).digest('hex')};
}
function pixelDifference(a,b){
 if(a.length!==b.length)throw Error('Screenshot sample dimensions mismatch');
 let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);
 return sum/a.length;
}

try{
 let ready=false;
 for(let i=0;i<40;i++){
  try{const r=await fetch(URL);if(r.ok){ready=true;break;}}catch{}
  await delay(500);
 }
 if(!ready)throw Error('Dev server did not start: '+logs.slice(-1200));
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push('page: '+err.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__HAVEN_DEBUG__?.getState);
 const stats=await page.evaluate(()=>{
  const canvas=document.querySelector('#world');
  return {width:canvas?.clientWidth,height:canvas?.clientHeight,
   gl:!!(canvas?.getContext('webgl2')||canvas?.getContext('webgl')),
   diagnostics:window.__HAVEN_DEBUG__.getRendererInfo()};
 });
 if(!stats.gl||!stats.width||!stats.height)throw Error('WebGL canvas absent or unavailable: '+JSON.stringify(stats));
 // World-only screenshots separate the actual town silhouette from long narrative cards.
 await page.addStyleTag({content:
  'html.qa-landscape .topbar,html.qa-landscape .hero-intro,html.qa-landscape .guardian-panel,'+
  'html.qa-landscape .journal-panel,html.qa-landscape .resident-card,html.qa-landscape .toolbar,'+
  'html.qa-landscape .corner-credit,html.qa-landscape .toast{visibility:hidden !important;}'});
 const captureLandscape=async(name)=>{
  await page.evaluate(()=>document.documentElement.classList.add('qa-landscape'));
  try{return await snapshotValley(page,name);}
  finally{await page.evaluate(()=>document.documentElement.classList.remove('qa-landscape'));}
 };
 const captures=[];
 for(const [i,season] of ['spring','summer','autumn','winter'].entries()){
  if(i>0)await page.evaluate(()=>window.__HAVEN_DEBUG__.flowSeason());
  let calendar=await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState());
  if(calendar.season!==season)throw Error('Calendar did not reach '+season+': '+calendar.season);
  for(let attempt=0;attempt<12&&calendar.weather!=='clear';attempt++){
   await page.evaluate(()=>window.__HAVEN_DEBUG__.advance(480));
   calendar=await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState());
  }
  if(calendar.season!==season||calendar.weather!=='clear')
   throw Error('No fair-weather day to compare '+season);
  const capture=await snapshotValley(page,season);
  captures.push(capture);
  results.push({season,minute:calendar.minute,bytes:capture.bytes,render:await page.evaluate(()=>window.__HAVEN_DEBUG__.getRendererInfo())});
 }
 const contrasts=[];
 for(let i=1;i<captures.length;i++)contrasts.push(pixelDifference(captures[i-1].pixels,captures[i].pixels));
 if(contrasts.some(x=>x<5.0))throw Error('Adjacent seasons still too visually similar: '+contrasts.join(', '));
 results.push({seasonPixelDifferences:contrasts});

 // Sprint5: prove three different futures under one seed, at the same world
 // minute, camera, time-of-day, weather and initial story autopilot.
 const futureImages={};
 for(const direction of ['bridge','ferry','grove']){
  await page.evaluate(()=>{
   const d=window.__HAVEN_DEBUG__;
   d.reset();d.advance((24*1440+600-500)/3);
  });
  const available=await page.evaluate(()=>window.__HAVEN_DEBUG__.getGrowthVisual().state.phase);
  if(available!=='invitation')throw Error('Valley invitation never appeared: '+available);
  await page.locator('#villageChoices .opportunity-choice[data-village="'+direction+'"]').click();
  const chosen=await page.evaluate(()=>window.__HAVEN_DEBUG__.getGrowthVisual().state.choice);
  if(chosen!==direction)throw Error('Guardian village direction click failed: '+direction);
  await page.evaluate(()=>window.__HAVEN_DEBUG__.advance((96-24)*1440/3));
  for(let attempt=0;attempt<11;attempt++){
   const wx=await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState().weather);
   if(wx==='clear')break;
   await page.evaluate(()=>window.__HAVEN_DEBUG__.advance(480));
  }
  await page.waitForTimeout(420);
  const visual=await page.evaluate(()=>window.__HAVEN_DEBUG__.getGrowthVisual());
  if(visual.state.choice!==direction||!['landmark','thriving'].includes(visual.state.phase)||
     visual.signature!==direction+'/'+visual.state.phase)
   throw Error('Village silhouette did not evolve: '+JSON.stringify(visual));
  futureImages[direction]=await captureLandscape('two-years-'+direction);
  results.push({branch:direction,phase:visual.state.phase,workDays:visual.state.workDays,prosperity:visual.state.prosperity,
   population:(await page.evaluate(()=>window.__HAVEN_DEBUG__.getState().population)),
   render:await page.evaluate(()=>window.__HAVEN_DEBUG__.getRendererInfo())});
 }
 const futures=['bridge','ferry','grove'],developmentContrast={};
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
  const key=futures[i]+'-vs-'+futures[j];
  developmentContrast[key]=pixelDifference(futureImages[futures[i]].pixels,futureImages[futures[j]].pixels);
  if(developmentContrast[key]<2.0)throw Error('Two-year futures too visually similar: '+key+' diff '+developmentContrast[key]);
 }
 results.push({developmentPixelDifferences:developmentContrast});
 // Independent fair-weather, visible-rain and valley-fog captures at identical spring clock times.
 const weatherImages={};
 for(const weather of ['clear','rain','fog']){
  await page.evaluate(()=>window.__HAVEN_DEBUG__.reset());
  let actual='';
  for(let day=0;day<12;day++){
   actual=await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState().weather);
   if(actual===weather)break;
   await page.evaluate(()=>window.__HAVEN_DEBUG__.advance(480));
  }
  if(actual!==weather)throw Error('No '+weather+' day in representative first spring');
  weatherImages[weather]=await snapshotValley(page,'weather-'+weather);
 }
 const wetDiff=pixelDifference(weatherImages.clear.pixels,weatherImages.rain.pixels);
 const fogDiff=pixelDifference(weatherImages.clear.pixels,weatherImages.fog.pixels);
 if(wetDiff<7.0||fogDiff<3.5)throw Error('Weather not visible enough (rain='+wetDiff+', fog='+fogDiff+')');
 results.push({weatherPixelDifferences:{rain:wetDiff,fog:fogDiff}});

 // Sprint4 H1/H2: inspect actual animated vertices, not a rain-angle screenshot.
 const river=await page.evaluate(()=>window.__HAVEN_DEBUG__.getRiverProbe());
 if(river.surfaceName!=='river-water'||river.surfaceY<=.075||
  river.samples.length<5||river.samples.filter(s=>s.surfaceHit).length<5)
  throw Error('River surface geometry/projection invalid: '+JSON.stringify(river));
 await page.evaluate(()=>{
  const d=window.__HAVEN_DEBUG__;d.reset();
  for(let i=0;i<12&&d.getVisualState().weather!=='rain';i++)d.advance(480);
 });
 if((await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState().weather))!=='rain')
  throw Error('Cannot find rain day to test downward motion');
 await page.waitForTimeout(180);
 // Browser screenshots can stall software WebGL for >1.5s, enough for full
 // rain-wrap cycles. Sample three short rAF intervals BEFORE taking captures.
 const [rain0,rain1,rain2]=await page.evaluate(async()=>{
  const frames=[];
  for(let i=0;i<3;i++){
   for(let step=0;step<3;step++)await new Promise(resolve=>requestAnimationFrame(resolve));
   frames.push(window.__HAVEN_DEBUG__.getRainSamples());
  }
  return frames;
 });
 await page.screenshot({path:out+'/rain-motion-0.png'});
 await page.waitForTimeout(120);
 await page.screenshot({path:out+'/rain-motion-1.png'});
 await page.waitForTimeout(120);
 await page.screenshot({path:out+'/rain-motion-2.png'});
 const down=(a,b)=>a.filter((p,i)=>b[i].headY<p.headY-.025).length;
 const falling=[down(rain0,rain1),down(rain1,rain2)];
 if(falling.some(n=>n<8)||[...rain0,...rain1,...rain2].some(d=>d.headY<=d.tailY))
  throw Error('Rain reverses or line endpoints flip: '+JSON.stringify({falling,rain0,rain1}));
 const point=river.samples[2].world;
 const terrain=await page.evaluate(([x,y,z])=>window.__HAVEN_DEBUG__.getTerrainProbe(x,z),point);
 if(!(terrain.groundY<terrain.waterY))throw Error('River not excavated below water: '+JSON.stringify(terrain));
 results.push({river,fallingRainFrames:falling,carvedGround:terrain});
 // Evaluate visible occupational separation at two hours of the same day.
 await page.evaluate(()=>{
  const d=window.__HAVEN_DEBUG__;d.reset();
  d.advance((2*1440+10*60-500)/3);
 });
 const crowdAt=async(label)=>{
  const positions=await page.evaluate(()=>window.__HAVEN_DEBUG__.getVisualState().npcs);
  const crowd=positions.filter(p=>p.id<=8&&p.visible&&Math.hypot(p.x+3.2,p.z-3.1)<1.3);
  if(crowd.length>2)throw Error('Residents still crowd tavern: '+label+JSON.stringify(crowd));
  await snapshotValley(page,'villagers-'+label);
  return positions.filter(p=>p.id<=8&&p.visible).map(p=>({id:p.id,activity:p.activityId,x:+p.x.toFixed(1),z:+p.z.toFixed(1)}));
 };
 const morning=await crowdAt('morning');
 const poseA=await page.evaluate(()=>window.__HAVEN_DEBUG__.getCharacterPose(8));
 if(!poseA||poseA.clipMode!=='sword-form')throw Error('Sword clip was not playing: '+JSON.stringify(poseA));
 await page.waitForFunction(previous=>{
  const pose=window.__HAVEN_DEBUG__.getCharacterPose(8);
  return pose&&pose.clipMode==='sword-form'&&pose.clipPhase!==previous.phase
   &&Math.abs(pose.rightArmX-previous.rightArmX)>.07;
 },{phase:poseA.clipPhase,rightArmX:poseA.rightArmX},{timeout:12000});
 const poseB=await page.evaluate(()=>window.__HAVEN_DEBUG__.getCharacterPose(8));
 if(!poseB||Math.abs(poseA.rightArmX-poseB.rightArmX)<.07)
  throw Error('Sword clip phase never changed: '+JSON.stringify({poseA,poseB}));
 await page.screenshot({path:out+'/sword-practice.png'});
 results.push({swordPoseDelta:Math.abs(poseA.rightArmX-poseB.rightArmX)});

 await page.evaluate(()=>window.__HAVEN_DEBUG__.advance((14-10)*60/3));
 const afternoon=await crowdAt('afternoon');
 results.push({residentRoutes:{morning,afternoon}});
 // Return to the first encounter for reproducible story regression.
 await page.evaluate(()=>window.__HAVEN_DEBUG__.reset());
 const visitor=await page.evaluate(()=>window.__HAVEN_DEBUG__.advance(30));
 if(!visitor.visitor)throw Error('Visitor encounter failed in browser');
 await page.locator('.choice[data-choice="host"]').click();
 if((await page.evaluate(()=>window.__HAVEN_DEBUG__.getState().choice))!=='host')throw Error('Story choice did not apply');
 await page.evaluate(()=>{
  const d=window.__HAVEN_DEBUG__;
  for(let i=0;i<30&&!d.getState().opportunities.some(o=>o.kind==='rain-guest'&&o.state==='available');i++)d.advance(480);
 });
 await page.screenshot({path:out+'/rain-guest.png'});
 const op=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState().opportunities.find(o=>o.kind==='rain-guest'&&o.state==='available'));
 if(!op)throw Error('Rain opportunity never appeared');
 await page.locator('#opportunityChoices .opportunity-choice[data-option="stay"]').click();
 const afterGuest=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState());
 if(!afterGuest.buildings.find(b=>b.id==='inn-001').props.includes('guest-umbrella'))throw Error('Rain intervention left no visible lasting state');
 await page.evaluate(()=>{
  const d=window.__HAVEN_DEBUG__;
  for(let i=0;i<90&&!d.getState().opportunities.some(o=>o.kind==='roof-repair'&&o.state==='available');i++)d.advance(480);
 });
 const roof=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState().opportunities.find(o=>o.kind==='roof-repair'&&o.state==='available'));
 if(!roof)throw Error('Repair opportunity never appeared');
 await page.screenshot({path:out+'/roof-before.png'});
 await page.evaluate(()=>{
  const d=window.__HAVEN_DEBUG__;
  for(const o of d.getState().opportunities.filter(o=>o.state==='available'&&o.kind==='rain-guest'))
   d.chooseOpportunity(o.id,'observe');
 });
 await page.locator('#opportunityChoices .opportunity-choice[data-option="drainage"]').click();
 await page.screenshot({path:out+'/roof-scaffold.png'});
 await page.evaluate(()=>window.__HAVEN_DEBUG__.advance(480*10));
 const state=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState());
 if(!state.buildings.find(b=>b.id==='inn-001').props.includes('drainage'))throw Error('Drainage upgrade not persisted');
 await page.screenshot({path:out+'/roof-repaired.png'});
 const finalRender=await page.evaluate(()=>window.__HAVEN_DEBUG__.getRendererInfo());
 if(finalRender.calls>760)throw Error('Static batch failed to cut draw calls: '+finalRender.calls);
 results.push({guestChoice:'stay',guestProp:true,repairChoice:'drainage',repairProp:true,render:finalRender});
 await page.mouse.move(720,455);await page.mouse.down();
 await page.mouse.move(900,479,{steps:12});await page.mouse.up();
 await page.waitForTimeout(430);
 await page.screenshot({path:out+'/river-orbit.png'});
 const rotated=await page.evaluate(()=>window.__HAVEN_DEBUG__.getRiverProbe());
 if(rotated.samples.filter(s=>s.surfaceHit).length<5)throw Error('Creek geometry hidden after camera rotation');
 results.push({rotatedRiver:rotated.samples.map(p=>({x:p.x,y:p.y}))});
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mpage=await mobile.newPage();mpage.on('pageerror',err=>errors.push('mobile: '+err.message));
 await mpage.goto(URL,{waitUntil:'domcontentloaded'});
 await mpage.waitForFunction(()=>window.__HAVEN_DEBUG__?.getState);
 const mobileMetrics=await mpage.evaluate(()=>{
  const canvas=document.querySelector('#world'),toolbar=document.querySelector('.toolbar');
  return {canvasWidth:canvas?.clientWidth,canvasHeight:canvas?.clientHeight,
   toolbarWidth:toolbar?.getBoundingClientRect().width,viewportWidth:innerWidth,
   gl:!!(canvas?.getContext('webgl2')||canvas?.getContext('webgl'))};
 });
 if(!mobileMetrics.gl||mobileMetrics.toolbarWidth>mobileMetrics.viewportWidth+1)
  throw Error('Mobile canvas/toolbar overflow: '+JSON.stringify(mobileMetrics));
 await mpage.evaluate(()=>window.__HAVEN_DEBUG__.flowSeason());
 await mpage.waitForTimeout(250);
 await mpage.screenshot({path:out+'/mobile.png'});
 results.push({mobile:mobileMetrics});
 await mobile.close();
 if(errors.length)throw Error('Browser errors: '+errors.join('\n').slice(0,1800));
 await writeFile(out+'/report.json',JSON.stringify({pass:true,results,errors},null,2));
 console.log('BROWSER_SMOKE_PASS',JSON.stringify(results));
}catch(e){
 await writeFile(out+'/report.json',JSON.stringify({pass:false,error:String(e),results,errors},null,2));
 console.error('BROWSER_SMOKE_FAILED',e);
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 child.kill('SIGTERM');
 // npm may leave a Vite grandchild holding stdout pipes open on CI.
 await delay(200);
 process.exit(process.exitCode||0);
}
