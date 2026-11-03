/**
 * Real Chromium/WebGL regression for v0.3: desktop+mobile, season snapshots,
 * a rainy-guest intervention, a repair cycle and nonempty renderer diagnostics.
 */
import {chromium} from 'playwright';
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
  const c=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState());
  await page.waitForTimeout(250);
  const img=await page.screenshot({path:out+'/'+season+'.png'});
  if(img.length<12_000)throw Error('Suspiciously empty canvas capture: '+season);
  captures.push(img.toString('base64').slice(0,200));
  results.push({season,minute:c.minutes,calendarYear:Math.floor(c.minutes/(1440*48))+1,bytes:img.length});
 }
 const uniq=new Set(captures);
 if(uniq.size<4)throw Error('Season captures did not differ');
 // Return to a clear first spring for reproducible simulation event checks.
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
 results.push({guestChoice:'stay',guestProp:true,repairChoice:'drainage',repairProp:true,render:stats.diagnostics});
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
