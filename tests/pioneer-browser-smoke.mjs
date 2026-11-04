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
 if(initial.scene.forestTrees<2||initial.scene.clearings!==0||initial.scene.clearedPlots!==0)
  throw Error('New forest lacks genuine initial vegetation or starts pre-cleared: '+JSON.stringify(initial.scene));
 if(initial.mode!=='pioneer'||initial.founders!==3||initial.buildings!==0||
  initial.scene.renderedStructures!==0||!initial.gl)throw Error('Not a genuine empty WebGL start: '+JSON.stringify(initial));
 // v0.4.5: the first chapter opens the REAL timber resource and moves
 // the camera; it must not pretend a house already exists.
 const earlyIntro=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__;
  return {title:document.querySelector('#pioneerIntroTitle')?.textContent,
   focus:d.getSpotlight(),camera:d.getCameraTarget(),
   wood:d.getVisuals().campWoodLogs};
 });
 if(!earlyIntro.title?.includes('第一间屋')||earlyIntro.focus.selection.kind!=='site'||
  earlyIntro.wood!==1)
  throw Error('The first day lacks a visible actual woodcutting target: '+JSON.stringify(earlyIntro));
 await page.locator('#pioneerSpotlightFocus').click();
 await page.waitForTimeout(650);
 const looked=await page.evaluate(()=>({
  selection:window.__PIONEER_DEBUG__.getSelection(),
  camera:window.__PIONEER_DEBUG__.getCameraTarget(),
  visible:!document.querySelector('#pioneerInspector').hidden
 }));
 if(!looked.visible||looked.selection?.kind!=='site'||
  Math.hypot(looked.camera.x-earlyIntro.camera.x,
   looked.camera.z-earlyIntro.camera.z)<1.5)
  throw Error('Chapter click cannot inspect and focus an actual place: '+
   JSON.stringify({earlyIntro,looked}));
 await screenshot(page,'01b-look-at-first-woodcutting');
 await page.locator('#inspectClose').click();
 // v0.4.4: public person inspection must be accessible without leaks.
 await page.locator('#founderTasks button[data-pick-person="1"]').click();
 const personCard=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,p=d.getState().livingFates.people[1];
  return {title:document.querySelector('#inspectTitle')?.textContent,
   facts:document.querySelector('#inspectFacts')?.textContent,
   description:document.querySelector('#inspectDescription')?.textContent,
   privateTags:p.privateFacts.tags,highlighted:d.getVisuals().focusedResident};
 });
 if(personCard.title!=='梁伯'||!personCard.highlighted||!personCard.facts?.includes('眼前的营生')||
  personCard.privateTags.some(tag=>
   (personCard.facts+personCard.description).includes(tag)))
  throw Error('Public identity inspector leaks or fails: '+JSON.stringify(personCard));
 await page.locator('#inspectClose').click();
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
 const grewChapter=await page.evaluate(()=>({
  title:document.querySelector('#pioneerIntroTitle')?.textContent,
  chapter:window.__PIONEER_DEBUG__.getSpotlight(),
  wood:window.__PIONEER_DEBUG__.getVisuals().campWoodLogs
 }));
 if(grewChapter.title===earlyIntro.title||
  !grewChapter.chapter?.selection||
  !['building','intent','site','camp','person'].includes(grewChapter.chapter.selection.kind))
  throw Error('The dynamic chapter did not react to a completed shelter: '+
   JSON.stringify({earlyIntro,grewChapter}));
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
 if(grown.visuals.clearings<1||grown.visuals.clearedPlots<1||
  grown.visuals.forestStumps<1)
  throw Error('3-year world did not visually clear real land or retain felling traces: '+
   JSON.stringify(grown.visuals));
 if(grown.visuals.commonsStage!==3||grown.visuals.commonsBeds!==0)
  throw Error('Old first-night bedrolls survived a real mature settlement: '+JSON.stringify(grown));
 if(grown.people<6||grown.roadCount<3||!grown.buildings.includes('garden')||
  !grown.buildings.includes('cottage')||!grown.buildings.includes('wood-yard')||
  grown.visuals.renderedStructures<4||grown.visuals.people!==grown.people)
  throw Error('Phase B did not produce a visible populated village: '+JSON.stringify(grown));
 const fieldVisualization=await page.evaluate(async()=>{
  const d=window.__PIONEER_DEBUG__,s=d.getState();
  const {pioneerCropAppearance,pioneerVisibleWoodLogs}=
   await import('/src/simulation/pioneerVisibility.ts');
  return {actual:d.getVisuals(),expectedGardens:s.buildings
   .filter(b=>b.kind==='garden').reduce((n,b)=>
    n+(pioneerCropAppearance(s,b.id)?.visibleSprouts??0),0),
   expectedWood:pioneerVisibleWoodLogs(s),
   story:d.getSpotlight(),text:document.querySelector('#pioneerIntroTitle')?.textContent};
 });
 if(fieldVisualization.expectedGardens!==fieldVisualization.actual.gardenSprouts||
  fieldVisualization.expectedWood!==fieldVisualization.actual.campWoodLogs||
  fieldVisualization.text?.includes('第一间屋，要从一捆柴开始'))
  throw Error('Actual 3D crops/wood/chapters diverge from saved state: '+
   JSON.stringify(fieldVisualization));
 results.push({livingChapter:true,woodpileCount:fieldVisualization.actual.campWoodLogs,
  realCropMeshes:fieldVisualization.actual.gardenSprouts});
 const commonsInfo=await page.evaluate(()=>{
  const w=window.__PIONEER_DEBUG__.getState();
  return {stage:w.commons.stage,work:w.commons.workHours,
   wood:w.commons.woodSpent,meals:w.commons.mealsServed,
   cooking:w.commons.cookingHours,social:w.commons.socialHours,
   description:document.querySelector('#pioneerCommonsStatus')?.textContent};
 });
 if(commonsInfo.stage!==3||commonsInfo.wood!==8.5||
  commonsInfo.meals<=0||commonsInfo.cooking<=0||commonsInfo.social<=0||
  !commonsInfo.description?.includes('村心空地'))
  throw Error('Commons stage was not caused by recorded work, food and social activities: '+
   JSON.stringify(commonsInfo));
 // Click the real central plaza from its existing 3D camp locator, if not
 // occluded by the HUD; otherwise validate its actual registry through a
 // model-projected debug ray intersection.
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

 // Fate-C: build a separate truthful fixture by running the REAL model until
 // two people worked the SAME existing garden. The controlled food reserve is
 // supplied before trial start; the runtime must still deduct the seeds and
 // give up normal shifts. Preserve the previous save for subsequent old tests.
 const seedFate=await page.evaluate(async()=>{
  const {createPioneerWorld,advancePioneerWorld,PIONEER_SLOT_KEYS}=
   await import('/src/simulation/pioneerWorld.ts');
  const {considerSeedTrial}=await import('/src/simulation/livingFates/seedTrial.ts');
  const {nextSeasonBoundary,DAY_MINUTES}=await import('/src/simulation/calendar.ts');
  const original=localStorage.getItem(PIONEER_SLOT_KEYS[0]);
  const s=createPioneerWorld(42,Date.now());
  let entry=null;
  for(let day=0;day<48*4&&!entry;day++){
   advancePioneerWorld(s,DAY_MINUTES/3);
   if(nextSeasonBoundary(s.minutes)-s.minutes<10*DAY_MINUTES||
    s.livingFates.seedTrials.some(t=>t.phase==='working'))continue;
   for(const [key,h] of Object.entries(s.livingFates.farmCoWorkHours)
    .sort((a,b)=>b[1]-a[1])){
    const gardenId=key.slice(0,key.lastIndexOf(':'));
    const field=s.sites.find(x=>x.id==='field-'+gardenId&&x.stock>=.4);
    const garden=s.buildings.find(b=>b.id===gardenId&&b.kind==='garden');
    const [a,b]=key.slice(key.lastIndexOf(':')+1).split('-').map(Number);
    if(h<8||!field||!garden||garden.operating===false||
     s.livingFates.seedTrials.some(t=>t.gardenId===gardenId)||
     (s.livingFates.people[a]?.skills.cultivation.xp??0)<12||
     (s.livingFates.people[b]?.skills.cultivation.xp??0)<6)continue;
    entry={gardenId,ids:[a,b],hours:h};break;
   }
  }
  if(!entry)return {error:'No qualified real gardening partnership found'};
  const garden=s.buildings.find(b=>b.id===entry.gardenId);
  garden.productionMode='seed';s.resources.food=36;
  s.resources.water=Math.max(s.resources.water,s.founders.length*3);
  if(!considerSeedTrial(s))return {error:'Real prerequisites did not admit trial',
   entry,food:s.resources.food,site:s.sites.find(x=>x.id==='field-'+entry.gardenId)?.stock};
  const first=structuredClone(s.livingFates.seedTrials.at(-1));
  advancePioneerWorld(s,(nextSeasonBoundary(s.minutes)-s.minutes)/3);
  const final=s.livingFates.seedTrials.at(-1);
  if(final.phase!=='resolved')return {error:'Genuine trial did not complete in a season',
   first,final,food:s.resources.food};
  s.lastSavedAt=Date.now();
  const {importPioneerWorld}=await import('/src/simulation/pioneerWorld.ts');
  const checked=importPioneerWorld(JSON.stringify(s));
  if(!checked)return {error:'Completed fate cannot survive save validation',gardenId:entry.gardenId,
   trial:final,seedFates:s.livingFates,buildings:s.buildings.map(x=>x.id)};
  // Do not write into localStorage under a still-running old world: its
  // pagehide/autosave would overwrite the fixture just before reload.
  return {savedWorld:JSON.stringify(s),gardenId:entry.gardenId,first,final,
   legacy:s.livingFates.fieldLegacies.find(l=>l.gardenId===entry.gardenId),
   original};
 });
 if(seedFate.error||seedFate.first.seedsSpent!==1.2||seedFate.final.phase!=='resolved'||
  seedFate.legacy?.harvestBonus!==.06)
  throw Error('Seasonal seed fate not based on real work: '+JSON.stringify(seedFate));
 // Import through the REAL user-facing file input: replaceWorld updates the
 // authoritative runtime before its pagehide/autosave writes the save slot.
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#pioneerFile').setInputFiles({
  name:'pioneer-seed-fate.json',mimeType:'application/json',
  buffer:Buffer.from(seedFate.savedWorld,'utf8')
 });
 await page.waitForFunction(gardenId=>
  window.__PIONEER_DEBUG__?.getState()?.livingFates?.fieldLegacies
   ?.some(e=>e.gardenId===gardenId),seedFate.gardenId);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState);
 await page.locator('.pioneer-building-list').evaluate(el=>el.open=true);
 const listed=await page.evaluate(gardenId=>{
  const w=window.__PIONEER_DEBUG__.getState();
  return {name:gardenId,found:w.buildings.some(b=>b.id===gardenId),
   buildings:w.buildings.map(b=>b.id),people:w.founders.length,
   saveKeys:Object.keys(w.livingFates)};
 },seedFate.gardenId);
 if(!listed.found)throw Error('Completed trial save did not restore field: '+JSON.stringify(listed));
 await page.locator('button[data-pick-building="'+seedFate.gardenId+'"]').click();
 const seedFateCard=await page.evaluate(()=>({
  visible:!document.querySelector('#pioneerInspector').hidden,
  facts:document.querySelector('#inspectFacts')?.textContent,
  history:document.querySelector('#inspectHistory')?.textContent,
  markers:window.__PIONEER_DEBUG__.getVisuals().seedMarkers,
  persisted:window.__PIONEER_DEBUG__.getState().livingFates.fieldLegacies
 }));
 if(!seedFateCard.visible||!seedFateCard.facts?.includes('田间传承')||
  !seedFateCard.history?.includes('试田有成')||seedFateCard.markers<1)
  throw Error('Fate outcome lacks real geometry or inspectable history: '+JSON.stringify(seedFateCard));
 await screenshot(page,'05b-field-seed-trial-living-fate');
 results.push({seedFate:true,realShifts:seedFate.final.workBy,persistentSeedPlot:true,
  actualFieldBonus:seedFate.legacy.harvestBonus});
 // Restore the old developed village used by the remaining felling and
 // classics/mobile smoke tests; the test fixture must not contaminate them.
 // Restore through the same real import path; a raw storage write would be
 // undone by the current world's pagehide save on the following reload.
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#pioneerFile').setInputFiles({
  name:'pioneer-before-fate.json',mimeType:'application/json',
  buffer:Buffer.from(seedFate.original,'utf8')
 });
 await page.waitForFunction(()=>window.__PIONEER_DEBUG__?.getState()?.buildings
  ?.some(b=>b.kind==='garden'&&b.operating===false));
 // Newly opened land and trees must appear as distinct, inspectable 3D
 // scenes, not just an expanding building count.
 const pioneerFelling=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,w=d.getState();
  return {count:w.frontier.totalFelled,
   cleared:w.frontier.clearings.filter(c=>c.phase==='cleared').length,
   woodGathered:w.sites.find(site=>site.kind==='forest')?.totalGathered,
   view:d.getVisuals()};
 });
 if(pioneerFelling.count<3||pioneerFelling.cleared<1||
  pioneerFelling.woodGathered<pioneerFelling.count*2.6)
  throw Error('Felling/clearing not backed by collected timber: '+JSON.stringify(pioneerFelling));
 await page.locator('#pioneerBuildingChoices').evaluate(el=>el.closest('details').open=true);
 await page.locator('button[data-pick-clearing]').first().click();
 const clearingCard=await page.evaluate(()=>({
  selection:window.__PIONEER_DEBUG__.getSelection(),
  title:document.querySelector('#inspectTitle')?.textContent,
  details:document.querySelector('#inspectFacts')?.textContent
 }));
 if(clearingCard.selection?.kind!=='clearing'||
  !clearingCard.details?.includes('实际开垦工时'))
  throw Error('Actual opened plot cannot be inspected: '+JSON.stringify(clearingCard));
 await page.locator('#inspectClose').click();
 results.push({phaseB:grown,gardenInspected:true,gardenControlsPersist:true,
  commons:commonsInfo,frontier:pioneerFelling,clearingCard:true});
 // A quick fresh-world playback checks an actual felling animation window.
 // The real simulation is advanced in hour-sized chunks and the GPU model
 // is refreshed by the same public debug helper used for other snapshots.
 const fallingRun=await page.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__;d.reset(42);
  for(let i=0;i<110;i++){
   d.advance(20);
   if(d.getVisuals().fallingTree){
    const world=d.getState(),render=d.getVisuals();
    return {realFell:world.frontier.totalFelled,render,minute:world.minutes};
   }
  }
  return null;
 });
 if(!fallingRun||fallingRun.realFell<1)
  throw Error('No visible falling-tree window during actual cutting: '+JSON.stringify(fallingRun));
 await screenshot(page,'06-harvest-driven-tree-fall');
 results.push({fallingTree:true,render:fallingRun.render});
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
   toolbarWidth:toolbar.width,panelRight:panel.right,viewport:innerWidth,
   spotlightButtonHeight:document.querySelector('#pioneerSpotlightFocus').getBoundingClientRect().height};
 });
 if(!sizing.gl||sizing.toolbarWidth>sizing.viewport+1||sizing.panelRight>sizing.viewport+1||
  sizing.spotlightButtonHeight<43)
  throw Error('Pioneer mobile overflow or blank WebGL: '+JSON.stringify(sizing));
 await mpage.locator('#pioneerSpotlightFocus').tap();
 const mobileMoment=await mpage.evaluate(()=>({
  selection:window.__PIONEER_DEBUG__.getSelection(),
  inspector:!document.querySelector('#pioneerInspector').hidden
 }));
 if(!mobileMoment.inspector||mobileMoment.selection?.kind!=='site')
  throw Error('Mobile chapter button does not inspect real forest: '+JSON.stringify(mobileMoment));
 await mpage.locator('#inspectClose').tap();
 await mpage.evaluate(()=>window.__PIONEER_DEBUG__.advance(1200));
 await screenshot(mpage,'04-mobile-shelter');
 // A touch gesture must still allow inspection without mouse hover.
 const mobileShelter=await mpage.evaluate(()=>{
  const d=window.__PIONEER_DEBUG__,b=d.getState().buildings[0];
  return b?d.projectBuilding(b.id):null;
 });
 if(!mobileShelter)throw Error('Mobile world did not build an inspectable shelter');
 const frontmost=await mpage.evaluate(({x,y})=>{
  const element=document.elementFromPoint(x,y);
  return element?.id||element?.className||element?.nodeName||'none';
 },mobileShelter);
 const canvasVisible=frontmost==='pioneerWorld';
 if(canvasVisible){
  await mpage.touchscreen.tap(mobileShelter.x,mobileShelter.y);
  const opened=await mpage.evaluate(()=>!document.querySelector('#pioneerInspector').hidden);
  if(!opened)throw Error('Touch on unobscured 3D shelter did not open its inspector: '+
   JSON.stringify({mobileShelter,frontmost}));
 }else{
  // A building behind the deliberately present mobile HUD cannot receive a
  // canvas touch. In that case the visible, touch-accessible facility list
  // must serve as a real saved-registry entrypoint.
  await mpage.locator('.pioneer-building-list summary').tap();
  await mpage.locator('#pioneerBuildingChoices button').first().tap();
  const opened=await mpage.evaluate(()=>!document.querySelector('#pioneerInspector').hidden);
  if(!opened)throw Error('An obscured building cannot be inspected via mobile facility list: '+
   JSON.stringify({mobileShelter,frontmost}));
 }
 // The inspector is a touch drawer over the normal HUD. Close it before
 // selecting another building; a real tap must not pass through its content.
 await mpage.locator('#inspectClose').tap();
 // The village commons remains inspectable on narrow screens even if its
 // central 3D marker falls behind the HUD and cannot receive pointer input.
 await mpage.locator('.pioneer-building-list').evaluate(el=>el.open=true);
 await mpage.locator('#pioneerBuildingChoices button[data-pick-commons]').tap();
 const commonsCard=await mpage.evaluate(()=>({
  open:!document.querySelector('#pioneerInspector').hidden,
  title:document.querySelector('#inspectTitle')?.textContent,
  contents:document.querySelector('#inspectFacts')?.textContent
 }));
 if(!commonsCard.open||!['临时营火','安家火塘','公共灶台','村心空地'].includes(commonsCard.title)||
  !commonsCard.contents?.includes('已耗木料'))
  throw Error('Mobile commons detail does not expose its real growth history: '+JSON.stringify(commonsCard));
 results.push({mobile:sizing,touchInspection:true,touchMethod:canvasVisible?'3d-canvas':'accessible-facility-list',
  commonsCard:true,frontmost});
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
