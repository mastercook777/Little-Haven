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
