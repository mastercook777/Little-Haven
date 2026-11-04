/** v0.4 real desktop/mobile WebGL and progression evidence; kept separate from v0.3 smoke. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';

const base='http://127.0.0.1:5190/';
const output='artifacts/pioneer-browser-smoke';
await mkdir(output,{recursive:true});
const processVite=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','5190','--strictPort'],{stdio:'pipe'});
let logs='';processVite.stdout.on('data',d=>logs+=d.toString());
processVite.stderr.on('data',d=>logs+=d.toString());
let browser;
const errors=[],results=[];
const screenshot=async(page,name)=>{
 await page.waitForTimeout(220);
 const bytes=await page.screenshot({path:output+'/'+name+'.png'});
 if(bytes.length<10000)throw Error('Blank pioneer screenshot: '+name);
 return createHash('sha256').update(bytes).digest('hex');
};
try{
 let ready=false;
 for(let i=0;i<40;i++){
  try{const r=await fetch(base+'pioneer.html');if(r.ok){ready=true;break;}}catch{}
  await delay(500);
 }
 if(!ready)throw Error('Pioneer page did not start: '+logs.slice(-1000));
 browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--no-sandbox'
 ]});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('desktop: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('desktop console: '+m.text());});
 await page.goto(base+'pioneer.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
 const initial=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,state=d.getState();
  const canvas=document.querySelector('#pioneerWorld');
  return {founders:state.founders.length,buildings:state.buildings.length,
   mode:state.mode,scene:d.getVisuals(),
   gl:!!(canvas.getContext('webgl2')||canvas.getContext('webgl')),
   width:canvas.clientWidth,height:canvas.clientHeight};
 });
 if(initial.mode!=='pioneer'||initial.founders!==3||initial.buildings!==0||
  initial.scene.renderedStructures!==0||!initial.gl)throw Error('Not a genuine empty WebGL start: '+JSON.stringify(initial));
 const startDigest=await screenshot(page,'01-three-founders-and-camp');
 await page.locator('[data-policy="shelter"]').click();
 let sawConstruction=false,constructed=null;
 for(let i=0;i<35;i++){
  const result=await page.evaluate(()=>{
   window.__PIONEER_DEBUG__.advance(80);
   const d=window.__PIONEER_DEBUG__;
   return {state:d.getState(),visual:d.getVisuals()};
  });
  if(!sawConstruction&&['foundation','frame'].includes(result.state.intent?.phase)){
   sawConstruction=true;
   if(result.visual.renderedStructures!==1)
    throw Error('Construction has no real scene mesh: '+JSON.stringify(result.visual));
   await screenshot(page,'02-real-construction');
  }
  if(result.state.buildings.length){
   constructed=result;break;
  }
 }
 if(!sawConstruction||!constructed)
  throw Error('No construction stages or completed shelter within early progression');
 const b=constructed.state.buildings[0];
 if(b.materialsSpent.wood!==7||constructed.visual.renderedStructures!==1||
  b.occupants.length!==3||constructed.state.founders.some(f=>f.homeBuildingId!==b.id))
  throw Error('Shelter was not caused by the real resource/work/occupancy system');
 const finishDigest=await screenshot(page,'03-occupied-shelter');
 if(finishDigest===startDigest)throw Error('Pioneer island did not visibly change');
 const diagnostics=await page.evaluate(()=>window.__PIONEER_DEBUG__.getRendererInfo());
 if(diagnostics.calls<=0||diagnostics.triangles<=0)throw Error('No real WebGL drawing: '+JSON.stringify(diagnostics));
 results.push({desktop:initial,construction:true,completed:true,renderer:diagnostics});
 // Persist via the visible export action (same save path as autosave).
 await page.locator('.save-menu summary').click();
 const download=page.waitForEvent('download');
 await page.locator('#pioneerExport').click();
 await download;
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
 const restored=await page.evaluate(()=>window.__PIONEER_DEBUG__.getState());
 if(restored.buildings.length!==1||restored.buildings[0].id!==b.id)
  throw Error('Pioneer local save not restored after browser reload');
 // Verify the mesh, not a debug-only button, opens the actual registry card.
 const firstPoint=await page.evaluate(id=>window.__PIONEER_DEBUG__.projectBuilding(id),b.id);
 if(!firstPoint)throw Error('No projected first shelter model');
 await page.mouse.click(firstPoint.x,firstPoint.y);
 const firstCard=await page.evaluate(()=>({
  selected:window.__PIONEER_DEBUG__.getSelection(),
  title:document.querySelector('#inspectTitle')?.textContent,
  visible:!document.querySelector('#pioneerInspector').hidden,
  facts:document.querySelector('#inspectFacts')?.textContent
 }));
 if(!firstCard.visible||firstCard.selected?.id!==b.id||firstCard.title!=='避雨棚'||
  !firstCard.facts?.includes('7 份'))
  throw Error('Clicking a built 3D shelter did not reveal its actual status: '+JSON.stringify({firstPoint,firstCard}));
 await page.locator('#inspectClose').click();
 results.push({restored:true,shelterInspected:true});
 // Phase B is visible in real WebGL, not only an expanded JSON registry.
 await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,now=d.getState().minutes;
  d.advance(Math.max(0,(48*3*1440-now)/3));
 });
 await page.waitForTimeout(280);
 const grown=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,state=d.getState();
  return {people:state.founders.length,
   buildings:state.buildings.map(b=>b.kind),roadCount:state.roads.length,
   roadGrades:state.roads.map(r=>r.grade),visuals:d.getVisuals(),
   renderer:d.getRendererInfo()};
 });
 if(grown.people<=3||grown.roadCount<3||!grown.buildings.includes('garden')||
  !grown.buildings.includes('cottage')||!grown.buildings.includes('wood-yard')||
  grown.visuals.renderedStructures<4||grown.visuals.people!==grown.people)
  throw Error('Phase B did not produce a visible populated village: '+JSON.stringify(grown));
 const grownDigest=await screenshot(page,'05-third-year-living-village');
 if(grownDigest===startDigest)throw Error('Third-year village looks identical to the initial empty valley');
 const gardenId=await page.evaluate(()=>window.__PIONEER_DEBUG__.getState()
  .buildings.find(b=>b.kind==='garden')?.id);
 const gardenPoint=await page.evaluate(id=>window.__PIONEER_DEBUG__.projectBuilding(id),gardenId);
 if(!gardenPoint)throw Error('Garden missing projected 3D click target');
 await page.mouse.click(gardenPoint.x,gardenPoint.y);
 const gardenCard=await page.evaluate(()=>({
  selected:window.__PIONEER_DEBUG__.getSelection(),
  title:document.querySelector('#inspectTitle')?.textContent,
  visible:!document.querySelector('#pioneerInspector').hidden
 }));
 if(!gardenCard.visible||gardenCard.selected?.id!==gardenId||gardenCard.title!=='菜圃')
  throw Error('Garden Mesh cannot be inspected: '+JSON.stringify({gardenPoint,gardenCard}));
 await page.locator('[data-inspect-pref="seed"]').click();
 await page.locator('[data-inspect-toggle]').click();
 const settings=await page.evaluate(id=>{
  const state=window.__PIONEER_DEBUG__.getState();
  return state.buildings.find(b=>b.id===id);
 },gardenId);
 if(settings?.productionMode!=='seed'||settings.operating!==false)
  throw Error('Real facility controls did not update simulation/save: '+JSON.stringify(settings));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
 const savedConfig=await page.evaluate(id=>window.__PIONEER_DEBUG__.getState()
  .buildings.find(b=>b.id===id),gardenId);
 if(savedConfig?.productionMode!=='seed'||savedConfig.operating!==false)
  throw Error('Garden production settings lost after reload');
 results.push({phaseB:grown,gardenInspected:true,gardenControlsPersist:true});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__HAVEN_DEBUG__?.getState);
 const classic=await page.evaluate(()=>window.__HAVEN_DEBUG__.getState());
 if(!classic.buildings.some(b=>b.id==='inn-001'))
  throw Error('Classic village was replaced by the pioneer scene');
 results.push({classicInnIntact:true});
 await context.close();

 const mobile=await browser.newContext({viewport:{width:390,height:844},
  deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mpage=await mobile.newPage();
 mpage.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mpage.goto(base+'pioneer.html',{waitUntil:'domcontentloaded'});
 await mpage.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
 const sizing=await mpage.evaluate(()=>{
  const canvas=document.querySelector('#pioneerWorld');
  const toolbar=document.querySelector('.pioneer-toolbar').getBoundingClientRect();
  const panel=document.querySelector('.pioneer-panel').getBoundingClientRect();
  return {gl:!!(canvas.getContext('webgl2')||canvas.getContext('webgl')),
   toolbarWidth:toolbar.width,panelRight:panel.right,viewport:innerWidth};
 });
 if(!sizing.gl||sizing.toolbarWidth>sizing.viewport+1||sizing.panelRight>sizing.viewport+1)
  throw Error('Pioneer mobile overflow or blank WebGL: '+JSON.stringify(sizing));
 await mpage.evaluate(()=>window.__PIONEER_DEBUG__.advance(1200));
 await screenshot(mpage,'04-mobile-shelter');
 // A touch gesture must still allow inspection without mouse hover.
 const mobileShelter=await mpage.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,b=d.getState().buildings[0];
  return b?d.projectBuilding(b.id):null;
 });
 if(mobileShelter){
  await mpage.touchscreen.tap(mobileShelter.x,mobileShelter.y);
  const opened=await mpage.evaluate(()=>!document.querySelector('#pioneerInspector').hidden);
  if(!opened)throw Error('Touch cannot inspect a built 3D shelter');
 }
 results.push({mobile:sizing,touchInspection:!!mobileShelter});
 await mobile.close();
 if(errors.length)throw Error('Pioneer browser errors: '+errors.join('\n').slice(0,1500));
 await writeFile(output+'/report.json',JSON.stringify({pass:true,results,errors},null,2));
 console.log('PIONEER_BROWSER_PASS',JSON.stringify(results));
}catch(error){
 await writeFile(output+'/report.json',JSON.stringify({pass:false,error:String(error),results,errors},null,2));
 console.error('PIONEER_BROWSER_FAILED',error);process.exitCode=1;
}finally{
 if(browser)await browser.close();
 processVite.kill('SIGTERM');await delay(200);
 process.exit(process.exitCode||0);
}
