import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildPioneerVillage,pioneerHitSelection} from './graphics/pioneerVillage.ts';
import {inspectPioneerSelection,type PioneerSelection} from './ui/pioneerInspection.ts';
import {getPioneerSpotlight,type PioneerSpotlight} from './ui/pioneerSpotlight.ts';
import {pioneerBuildingLabel} from './simulation/pioneerGrowth.ts';
import {pioneerCommonsNames} from './simulation/pioneerCommons.ts';
import {setPioneerFacilityOperating,setPioneerFacilityPreference,
 type PioneerFacilityPreference} from './simulation/pioneerFacilities.ts';
import {SEASON_NAMES} from './simulation/calendar.ts';
import {WEATHER_NAMES} from './simulation/weather.ts';
import {advancePioneerWorld,advancePioneerToSeason,createPioneerWorld,
 getPioneerCalendar,getPioneerWeather,importPioneerWorld,loadPioneerWorld,
 pioneerSummary,savePioneerWorld,setPioneerPolicy,PIONEER_ACTIVE_SLOT,
 type PioneerPolicy,type PioneerWork,type PioneerWorld} from './simulation/pioneerWorld.ts';
import './pioneer.css';

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{
 const el=document.getElementById(id);if(!el)throw new Error('Missing pioneer UI: '+id);
 return el as T;
};
const canvas=$<HTMLCanvasElement>('pioneerWorld');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,
 powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(innerWidth<760?1.35:2,devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d5e0d6',.010);
const camera=new THREE.OrthographicCamera(-24,24,16,-16,.1,250);
const defaultEye=new THREE.Vector3(27.3,30,39);
camera.position.copy(defaultEye);camera.lookAt(-1.7,0,0);
const orbit=new OrbitControls(camera,canvas);
orbit.target.set(-1.7,0,0);orbit.enablePan=true;orbit.enableDamping=true;
 orbit.minTargetRadius=0;orbit.maxTargetRadius=19;orbit.cursor.set(-1.7,0,0);
orbit.dampingFactor=.065;orbit.minPolarAngle=.43;orbit.maxPolarAngle=1.26;
orbit.minZoom=.72;orbit.maxZoom=2.3;orbit.rotateSpeed=.64;
orbit.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
orbit.touches.ONE=THREE.TOUCH.ROTATE;orbit.touches.TWO=THREE.TOUCH.DOLLY_PAN;
const hemi=new THREE.HemisphereLight('#e4eeed','#a3a58b',2.15);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d7',2.70);
sun.position.set(-24,35,21);sun.castShadow=true;
sun.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);
sun.shadow.camera.left=-27;sun.shadow.camera.right=27;
sun.shadow.camera.top=22;sun.shadow.camera.bottom=-22;
sun.shadow.camera.near=.1;sun.shadow.camera.far=110;sun.shadow.bias=-.00017;
scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#c5d9cb',.55);
fill.position.set(15,12,-18);scene.add(fill);
function resize(){
 const w=innerWidth,h=innerHeight,span=w<760?33:28.5,aspect=w/h;
 camera.left=-span*aspect/2;camera.right=span*aspect/2;
 camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
}
addEventListener('resize',resize);resize();
let slot=1;
try{slot=localStorage.getItem(PIONEER_ACTIVE_SLOT)==='2'?2:1;}catch{}
let world:PioneerWorld;
try{world=loadPioneerWorld(localStorage,Date.now(),slot);}catch{
 world=createPioneerWorld(20261103+slot*193);
}
let valley=buildPioneerVillage(scene,world);
let speed=1,paused=false,last=performance.now(),lastSave=performance.now(),lastUI=0,lastLighting='',lastToast=0;
let selection:PioneerSelection|null=null;
let spotlight:PioneerSpotlight=getPioneerSpotlight(world);
let focusMotion:{from:THREE.Vector3;to:THREE.Vector3;started:number;
 fromZoom:number;toZoom:number}|null=null;
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
let clickStart:{x:number;y:number;at:number}|null=null,lastHover=0;
const labels:Record<PioneerWork,string>={
 rest:'照看营地', 'collect-wood':'林缘拾柴','forage':'入林采食',
 'fetch-water':'溪边取水','build':'搭棚施工','tend-fire':'照料营火',
 'shelter':'回家休息','farm':'耕作收菜','seed-trial':'试种留种','repair':'修屋补梁',
 'cook':'公共灶台做饭','eat':'火塘边用餐','eat-home':'家中吃饭',
 'socialize':'村心闲谈','commons-build':'修建公共村心',
 'clear-land':'林缘清障开荒'
};
const safe=(input:string)=>input.replace(/[&<>"']/g,c=>
 ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const amount=(n:number)=>n.toFixed(1).replace(/\.0$/,'');
function toast(message:string){
 const el=$('pioneerToast');el.textContent=message;el.classList.add('show');
 const key=++lastToast;
 window.setTimeout(()=>{if(lastToast===key)el.classList.remove('show');},3100);
}
function inspectRender(){
 const panel=$('pioneerInspector');
 const info=selection?inspectPioneerSelection(world,selection):null;
 if(!info){panel.hidden=true;if(selection){selection=null;valley.setSelected(null);}return;}
 panel.hidden=false;
 $('inspectKicker').textContent=info.kicker;
 $('inspectTitle').textContent=info.title;
 $('inspectDescription').textContent=info.description;
 $('inspectFacts').innerHTML=info.facts.map(x=>
  '<div class="inspect-fact"><span>'+safe(x.label)+'</span><b>'+
  safe(x.value)+'</b></div>').join('');
 $('inspectHistory').innerHTML=info.history.length?
  '<div class="inspect-history-title">'+(selection?.kind==='person'?'已留下的生活记忆':'这处地方的经历')+'</div>'+ 
  info.history.map(x=>'<div class="inspect-history-line">'+safe(x)+'</div>').join(''):'';
 const controls=info.operation?
  '<button type="button" data-inspect-toggle="'+safe(info.operation.id)+
  '" class="inspect-operate'+(info.operation.active?'':' paused')+'">'+
  (info.operation.active?'暂停此处生产':'恢复此处生产')+'</button>'+
  '<div class="inspect-mode-label">这里的工作倾向</div><div class="inspect-modes">'+
  info.operation.variants.map(v=>'<button type="button" data-inspect-pref="'+safe(v.value)+
   '" class="'+(info.operation?.preference===v.value?'active':'')+'">'+safe(v.label)+'</button>').join('')+
  '</div>':'';
 // This inspector refreshes every 340ms. Rebuilding the controls at that
 // cadence detaches buttons during pointerdown / pointerup, making real
 // user clicks and Playwright clicks fail intermittently.
 const actions=$('inspectActions');
 if(actions.innerHTML!==controls)actions.innerHTML=controls;
}
function chooseInspection(next:PioneerSelection|null){
 selection=next;valley.setSelected(selection);inspectRender();
}
function hitAt(clientX:number,clientY:number):PioneerSelection|null{
 const bounds=canvas.getBoundingClientRect();
 mouse.set(((clientX-bounds.left)/bounds.width)*2-1,
  -((clientY-bounds.top)/bounds.height)*2+1);
 raycaster.setFromCamera(mouse,camera);
 for(const hit of raycaster.intersectObject(valley.root,true)){
  let visible=true,ancestor:THREE.Object3D|null=hit.object;
  while(ancestor){if(!ancestor.visible){visible=false;break;}ancestor=ancestor.parent;}
  if(!visible)continue;
  const found=pioneerHitSelection(world,hit.object);
  if(found)return found;
 }
 return null;
}
function foodBalanceLabel(){
 const stats=world.foodStats;
 if(!stats)return '乡邻正在核算粮食收支';
 const net=stats.previousCollected-stats.previousConsumed;
 const prefix=net>=0?'+':'';
 const stock=world.resources.food;
 const warning=stock<world.founders.length*1.2?
  ' · 口粮紧张，村民会优先采食':stock<world.founders.length*2.7?
  ' · 储粮偏少':' · 储备尚可';
 return '上一日净口粮 '+prefix+amount(net)+
  '（收 '+amount(stats.previousCollected)+' / 用 '+amount(stats.previousConsumed)+')'+warning;
}
function renderUI(){
 const cal=getPioneerCalendar(world),weather=getPioneerWeather(world);
 spotlight=getPioneerSpotlight(world);
 $('pioneerIntroChapter').textContent=spotlight.chapter;
 $('pioneerIntroTitle').textContent=spotlight.headline;
 $('pioneerIntroDetail').textContent=spotlight.detail;
 const focus=$<HTMLButtonElement>('pioneerSpotlightFocus');
 focus.firstChild!.textContent=spotlight.action+' ';
 focus.setAttribute('aria-label',spotlight.action+'：'+spotlight.headline);
 const w=world.resources;
 $('pioneerWeather').textContent=SEASON_NAMES[cal.season]+' · '+WEATHER_NAMES[weather];
 $('pioneerDay').textContent='第 '+cal.year+' 年 · '+SEASON_NAMES[cal.season]+' '+cal.dayOfSeason+' 日';
 $('pioneerClock').textContent=String(cal.hour).padStart(2,'0')+':'+String(cal.minute).padStart(2,'0');
 $('pioneerSeason').textContent='第 '+cal.year+' 年 · '+SEASON_NAMES[cal.season];
 $('pioneerWood').textContent=amount(w.wood);$('pioneerFood').textContent=amount(w.food);
 $('pioneerWater').textContent=amount(w.water);
 const trend=$('pioneerFoodTrend');trend.textContent=foodBalanceLabel();
 trend.classList.toggle('shortage',w.food<world.founders.length*1.2);
 $('pioneerStatus').textContent=pioneerSummary(world);
 $('pioneerGrowth').textContent=world.founders.length+' 位居民 · '+
  world.buildings.length+' 处建成设施 · '+world.roads.length+' 条居民走出的路';
 const commons=world.commons,commonsJob=commons.project;
 $('pioneerCommonsStatus').textContent='村心 · '+pioneerCommonsNames[commons.stage]+
  (commonsJob?' ｜ 筹建'+pioneerCommonsNames[commonsJob.targetStage]+
   '：木料 '+amount(commonsJob.woodCommitted)+'/'+amount(commonsJob.woodRequired)+
   '，工时 '+amount(commonsJob.workDone)+'/'+amount(commonsJob.workRequired):' ｜ 点击营火/村心查看生活记录');
 const frontier=world.frontier;
 $('pioneerFrontierStatus').textContent='林缘 · 累计伐倒 '+frontier.totalFelled+
  ' 株 · 已开荒 '+frontier.clearings.filter(c=>c.phase==='cleared').length+
  ' 处 / '+frontier.clearings.length+' 处已勘地';
 const buildingChoices='<button type="button" data-pick-commons="camp">村心 · '+
  safe(pioneerCommonsNames[world.commons.stage])+'</button>'+
  world.frontier.clearings.map(c=>'<button type="button" data-pick-clearing="'+safe(c.id)+'">'+
   (c.phase==='cleared'?'林缘空地':'正在清林')+' · '+safe(c.id)+'</button>').join('')+
  (world.buildings.length?
   world.buildings.map((b,i)=>'<button type="button" data-pick-building="'+safe(b.id)+'">'+
    safe(pioneerBuildingLabel(b.kind))+' · '+(i+1)+'</button>').join(''):
   '<span>第一间屋尚未落成。</span>');
 const list=$('pioneerBuildingChoices');
 if(list.innerHTML!==buildingChoices)list.innerHTML=buildingChoices;
 const intent=world.intent;
 const cause=world.buildings.length&&!intent?
  '有 '+world.buildings.filter(b=>b.kind==='cottage').length+
  ' 座山居、'+world.buildings.filter(b=>b.kind==='garden').length+
  ' 片菜圃；房屋随着岁月磨损，乡邻也会自行修葺。':
  intent?.phase==='foundation'||intent?.phase==='frame'?
  '搭棚工时 '+amount(intent.workDone)+' / '+amount(intent.workRequired)+'；'+
   '已实际消耗木料 '+amount(intent.woodCommitted)+' 份。':
  intent?.pauseReason??'营火旁尚无住屋，乡邻正筹划安全的避雨处。';
 $('pioneerReason').textContent=cause;
 const taskChoices=world.founders.slice(0,6).map(f=>
  '<button type="button" class="founder-task" data-pick-person="'+f.id+'"><b>'+safe(f.name)+'</b><span>'+safe(labels[f.activity])+'</span></button>').join('');
 // Preserve the pointer target while the 340ms HUD refresh is running.
 const taskList=$('founderTasks');
 if(taskList.innerHTML!==taskChoices)taskList.innerHTML=taskChoices;
 for(const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-policy]')))
  btn.classList.toggle('active',btn.dataset.policy===world.policy);
 $('pioneerJournal').innerHTML=world.journal.slice(-5).reverse().map(e=>
  '<div class="chronicle-line"><b>'+safe(e.title)+'</b><p>'+safe(e.text)+'</p></div>').join('');
 for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-speed]')))
  button.classList.toggle('active',Number(button.dataset.speed)===speed);
 $('pioneerPause').textContent=paused?'▶':'Ⅱ';
 $('pioneerSlot1').classList.toggle('active',slot===1);
 $('pioneerSlot2').classList.toggle('active',slot===2);
 inspectRender();
}
function replaceWorld(next:PioneerWorld){
 scene.remove(valley.root);
 // The new mode has its own scene graph; never borrow a hidden v0.3 village.
 valley.root.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(mesh.isMesh||object instanceof THREE.LineSegments){
   const geometry=(object as THREE.Mesh).geometry;
   if(geometry&&geometry!==undefined)geometry.dispose();
   const mat=(object as THREE.Mesh).material;
   if(Array.isArray(mat))mat.forEach(m=>m.dispose());
   else mat?.dispose();
  }
 });
 world=next;valley=buildPioneerVillage(scene,world);
 selection=null;focusMotion=null;canvas.style.cursor='grab';
 lastLighting='';renderUI();
}
function persist(){try{savePioneerWorld(world,localStorage,Date.now(),slot);}catch{}}
function switchSlot(next:number){
 if(next===slot)return;
 persist();slot=next;
 try{localStorage.setItem(PIONEER_ACTIVE_SLOT,String(slot));}catch{}
 let loaded:PioneerWorld;
 try{loaded=loadPioneerWorld(localStorage,Date.now(),slot);}
 catch{loaded=createPioneerWorld(20261103+slot*193);}
 replaceWorld(loaded);
 toast('已进入'+(slot===1?'一号谷':'二号谷')+'，开荒存档独立保存。');
}
// Distinguish a click/tap from OrbitControls' rotation gesture. All
// selected entities are looked up through live world-state IDs, never meshes.
canvas.addEventListener('pointerdown',event=>{
 focusMotion=null;
 clickStart={x:event.clientX,y:event.clientY,at:performance.now()};
});
canvas.addEventListener('pointerup',event=>{
 const start=clickStart;clickStart=null;
 if(!start||Math.hypot(event.clientX-start.x,event.clientY-start.y)>9||
  performance.now()-start.at>900)return;
 chooseInspection(hitAt(event.clientX,event.clientY));
});
canvas.addEventListener('pointercancel',()=>{clickStart=null;});
canvas.addEventListener('pointermove',event=>{
 if(event.pointerType!=='mouse'||clickStart||performance.now()-lastHover<110)return;
 lastHover=performance.now();
 canvas.style.cursor=hitAt(event.clientX,event.clientY)?'pointer':'grab';
});
$('founderTasks').addEventListener('click',event=>{
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-pick-person]');
 if(button?.dataset.pickPerson&&world.founders.some(f=>String(f.id)===button.dataset.pickPerson))
  chooseInspection({kind:'person',id:button.dataset.pickPerson});
});
$('pioneerBuildingChoices').addEventListener('click',event=>{
 const target=event.target as HTMLElement;
 if(target.closest('button[data-pick-commons]')){
  chooseInspection({kind:'camp',id:'camp'});return;
 }
 const clearing=target.closest<HTMLButtonElement>('button[data-pick-clearing]');
 if(clearing?.dataset.pickClearing){
  chooseInspection({kind:'clearing',id:clearing.dataset.pickClearing});return;
 }
 const button=target.closest<HTMLButtonElement>('button[data-pick-building]');
 const id=button?.dataset.pickBuilding;
 if(id&&world.buildings.some(b=>b.id===id))chooseInspection({kind:'building',id});
});
$('pioneerSpotlightFocus').addEventListener('click',()=>{
 const now=getPioneerSpotlight(world);
 if(!inspectPioneerSelection(world,now.selection))return;
 const item=now.selection;
 const building=item.kind==='building'?world.buildings.find(b=>b.id===item.id):undefined;
 const parcel=building?.parcel??(item.kind==='intent'&&world.intent?.id===item.id?
  world.intent.parcel:null);
 const clearing=item.kind==='clearing'?world.frontier.clearings.find(c=>c.id===item.id):undefined;
 const resource=item.kind==='site'?world.sites.find(site=>site.id===item.id):undefined;
 const person=item.kind==='person'?world.founders.find(f=>String(f.id)===item.id):undefined;
 const [x,z]=parcel?[parcel.x,parcel.z]:clearing?[clearing.x,clearing.z]:
  resource?[resource.x,resource.z]:person?[person.target[0],person.target[1]]:
  [world.camp.x,world.camp.z];
 // Preserve the current orbit angle. Shift toward the actual object without
 // creating another camera, resource or phantom piece of world history.
 focusMotion={from:orbit.target.clone(),to:new THREE.Vector3(x,0,z),
  started:performance.now(),fromZoom:camera.zoom,
  toZoom:Math.max(camera.zoom,innerWidth<760?1.27:1.50)};
 chooseInspection(item);
});
function animateFocus(now:number){
 if(!focusMotion)return;
 const t=Math.min(1,Math.max(0,(now-focusMotion.started)/510));
 const eased=1-Math.pow(1-t,3);
 const next=focusMotion.from.clone().lerp(focusMotion.to,eased);
 const delta=next.sub(orbit.target);
 orbit.target.add(delta);camera.position.add(delta);
 camera.zoom=focusMotion.fromZoom+(focusMotion.toZoom-focusMotion.fromZoom)*eased;
 camera.updateProjectionMatrix();
 if(t>=1)focusMotion=null;
}
$('inspectClose').addEventListener('click',()=>chooseInspection(null));
$('inspectActions').addEventListener('click',event=>{
 const btn=(event.target as HTMLElement).closest<HTMLButtonElement>('button');
 if(!btn||selection?.kind!=='building')return;
 const b=world.buildings.find(x=>x.id===selection?.id);if(!b)return;
 let changed=false;
 if(btn.hasAttribute('data-inspect-toggle'))
  changed=setPioneerFacilityOperating(world,b.id,b.operating===false);
 const pref=btn.dataset.inspectPref as PioneerFacilityPreference|undefined;
 if(pref)changed=setPioneerFacilityPreference(world,b.id,pref);
 if(changed){renderUI();persist();toast('建筑的真实运营安排已更新，并记入守望录。');}
});
for(const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-speed]'))){
 btn.addEventListener('click',()=>{speed=Number(btn.dataset.speed)||1;renderUI();});
}
for(const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-policy]'))){
 btn.addEventListener('click',()=>{
  const changed=setPioneerPolicy(world,btn.dataset.policy as PioneerPolicy);
  if(changed){renderUI();persist();toast('建议已记入守望录，乡邻会自行安排劳动。');}
 });
}
$('pioneerSeasonSkip').addEventListener('click',()=>{
 const before=world.buildings.length;advancePioneerToSeason(world);
 renderUI();valley.update(world,world.minutes/3);persist();
 toast(world.buildings.length>before?'流年之间，乡邻造好了第一间棚子。':
  '时序流转，村民的每日劳动已逐时结算。');
});
$('pioneerPause').addEventListener('click',()=>{paused=!paused;renderUI();});
$('pioneerCamera').addEventListener('click',()=>{
 focusMotion=null;camera.position.copy(defaultEye);orbit.target.set(-1.7,0,0);
 camera.zoom=1;camera.updateProjectionMatrix();orbit.update();
});
$('pioneerZoomIn').addEventListener('click',()=>{camera.zoom=Math.min(2.3,camera.zoom*1.15);camera.updateProjectionMatrix();});
$('pioneerZoomOut').addEventListener('click',()=>{camera.zoom=Math.max(.72,camera.zoom/1.15);camera.updateProjectionMatrix();});
$('pioneerSlot1').addEventListener('click',()=>switchSlot(1));
$('pioneerSlot2').addEventListener('click',()=>switchSlot(2));
$('pioneerReset').addEventListener('click',()=>{
 if(!confirm('确认将当前开荒槽重新开档？旧谷存档和另一个开荒槽不会受影响。'))return;
 replaceWorld(createPioneerWorld(world.seed,Date.now()));persist();
 toast('营火重新点起，荒谷的故事从头开始。');
});
$('pioneerExport').addEventListener('click',()=>{
 persist();const data=JSON.stringify(world,null,2);
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;
 a.download='little-haven-pioneer-v04-slot-'+slot+'.json';a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast('开荒存档已导出。');
});
$('pioneerImport').addEventListener('click',()=>$<HTMLInputElement>('pioneerFile').click());
$<HTMLInputElement>('pioneerFile').addEventListener('change',async()=>{
 const file=$<HTMLInputElement>('pioneerFile').files?.[0];
 $<HTMLInputElement>('pioneerFile').value='';
 if(!file)return;if(file.size>2_000_000){toast('存档过大。');return;}
 const parsed=importPioneerWorld(await file.text());
 if(!parsed){toast('无效的开荒 v4 存档，旧谷存档不能导入新谷。');return;}
 if(!confirm('导入文件将覆盖当前开荒槽，是否继续？'))return;
 replaceWorld(parsed);persist();toast('开荒记录已恢复。');
});
addEventListener('keydown',event=>{
 if(event.key===' '&&!(event.target instanceof HTMLButtonElement)){
  event.preventDefault();$('pioneerPause').click();
 }
 if(event.key==='Escape'){
  chooseInspection(null);
  const details=document.querySelector<HTMLDetailsElement>('details.save-menu');if(details)details.open=false;
 }
});
function lighting(){
 const cal=getPioneerCalendar(world),weather=getPioneerWeather(world);
 const key=cal.season+'/'+weather+'/'+cal.hour;
 if(key===lastLighting)return;lastLighting=key;
 const day=Math.max(.14,Math.min(1,Math.sin((cal.hour-5)/15*Math.PI)*1.22));
 const sky:{[season:string]:string}={
  spring:'#d3e9da',summer:'#b9dcca',autumn:'#e8dfc1',winter:'#d2e5e7'
 };
 const tint=new THREE.Color(sky[cal.season]);
 if(weather==='rain')tint.lerp(new THREE.Color('#83969a'),.53);
 if(weather==='fog')tint.lerp(new THREE.Color('#bac6bb'),.30);
 if(day<.30)tint.lerp(new THREE.Color('#4e5b67'),.60);
 scene.fog!.color.copy(tint);renderer.toneMappingExposure=.89+day*.28;
 hemi.intensity=(.8+day*1.38)*(weather==='rain'?.82:1);
 sun.intensity=(.27+day*2.7)*(weather==='rain'?.38:1);
 sun.color.set(cal.season==='autumn'?'#f7cfaa':'#fff0db');
 document.documentElement.style.setProperty('--pioneer-sky','#'+tint.getHexString());
 $('pioneerApp').style.background='linear-gradient('+tint.getStyle()+',#f3e9d9)';
}
function tick(now:number){
 animateFocus(now);
 const dt=Math.max(0,Math.min(.09,(now-last)/1000));last=now;
 if(!paused){
  const previous=world.buildings.length,previousPopulation=world.founders.length,
   events=world.journal.length,oldCommonsStage=world.commons.stage,
   previousFelled=world.frontier.totalFelled,
   previousOpened=world.frontier.clearings.filter(c=>c.phase==='cleared').length;
  advancePioneerWorld(world,dt*speed);
  if(world.frontier.clearings.filter(c=>c.phase==='cleared').length>previousOpened)
   toast('林缘灌木已经清出一处可勘地的开阔地块。');
  else if(world.frontier.totalFelled>previousFelled)
   toast('林地里传来倒树声，留下树桩和新的木料。');
  else if(world.commons.stage>oldCommonsStage)toast('村民完成了公共村心升级：'+pioneerCommonsNames[world.commons.stage]);
  else if(world.buildings.length>previous)toast('村民亲手完成了新设施，山谷里又添了一处生活痕迹。');
  else if(world.founders.length>previousPopulation)toast('山谷添了新邻居，住进了真正空出的屋舍。');
  else if(world.journal.length>events&&world.intent?.phase==='frame')
   toast('木梁已经搭起，工地出现了新的变化。');
 }
 lighting();valley.update(world,world.minutes/3);orbit.update();renderer.render(scene,camera);
 if(now-lastUI>340){lastUI=now;renderUI();}
 if(now-lastSave>5000){lastSave=now;persist();}
 requestAnimationFrame(tick);
}
let hiddenSince:number|null=null;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenSince=Date.now();persist();}
 else if(hiddenSince!==null){
  advancePioneerWorld(world,Math.min(4*1440/3,Math.max(0,(Date.now()-hiddenSince)/1000)));
  hiddenSince=null;last=performance.now();renderUI();
 }
});
addEventListener('pagehide',persist);
renderUI();
const debugging={
 getState:()=>structuredClone(world),
 getSpotlight:()=>getPioneerSpotlight(world),
 getCameraTarget:()=>({x:orbit.target.x,z:orbit.target.z}),
 getSelection:()=>selection,
 projectBuilding:(id:string)=>{
  const b=world.buildings.find(item=>item.id===id);if(!b)return null;
  const v=new THREE.Vector3(b.parcel.x,b.kind==='garden'?.35:1.2,b.parcel.z).project(camera);
  const rect=canvas.getBoundingClientRect();
  return {x:rect.left+(v.x+1)*.5*rect.width,
   y:rect.top+(1-v.y)*.5*rect.height};
 },
 advance:(seconds:number)=>{const result=advancePioneerWorld(world,seconds);
  valley.update(world,world.minutes/3);renderUI();return result;},
 flowSeason:()=>{const result=advancePioneerToSeason(world);
  valley.update(world,world.minutes/3);renderUI();return result;},
 choosePolicy:(policy:PioneerPolicy)=>{const changed=setPioneerPolicy(world,policy);
  renderUI();return changed;},
 reset:(seed=world.seed)=>{replaceWorld(createPioneerWorld(seed));persist();return true;},
 getVisuals:()=>valley.signatures(),
 getRendererInfo:()=>({calls:renderer.info.render.calls,
  triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})
};
(window as typeof window&{__PIONEER_DEBUG__?:typeof debugging}).__PIONEER_DEBUG__=debugging;
requestAnimationFrame(tick);
