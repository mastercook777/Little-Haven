import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildVillage} from './graphics/village';
import {makePeople,updatePeople} from './graphics/people';
import {advanceToNextSeason,advanceWorld,buildingById,chapterProgress,chooseFate,chooseOpportunity,chooseVillageDevelopment,DEVELOPMENT_OPTIONS,villageGrowthLabel,createWorld,getCalendar,getClock,getDaylight,getWeather,importWorld,loadWorld,pendingOpportunities,residentMotion,saveWorld,SLOT_KEYS,VILLAGERS,type Decision,type WorldState} from './simulation/world';
import {conditionOf} from './simulation/buildings';
import {SEASON_NAMES} from './simulation/calendar';
import {WEATHER_NAMES} from './simulation/weather';
import './styles.css';

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{const el=document.getElementById(id);if(!el)throw Error(`Missing UI element #${id}`);return el as T;};
const canvas=$<HTMLCanvasElement>('world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.innerWidth<760?1.5:2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.23;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d5dfd5',.010);
const camera=new THREE.OrthographicCamera(-25,25,16,-16,.1,300);
const homeView=new THREE.Vector3(32,30,42);camera.position.copy(homeView);camera.lookAt(0,0,0);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.065;
controls.minPolarAngle=.42;controls.maxPolarAngle=1.28;controls.minZoom=.72;controls.maxZoom=2.22;controls.rotateSpeed=.64;controls.zoomSpeed=.86;
controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
const hemi=new THREE.HemisphereLight('#e5eff0','#a8a68a',2.4);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d9',3.35);sun.position.set(-26,39,20);sun.castShadow=true;sun.shadow.mapSize.set(window.innerWidth<760?1024:2048,window.innerWidth<760?1024:2048);
sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=.1;sun.shadow.camera.far=140;sun.shadow.bias=-.00016;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#b4c5cc',.60);fill.position.set(15,10,-17);scene.add(fill);
const village=buildVillage(scene);
const people=makePeople(scene,VILLAGERS);
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const ACTIVE_SLOT_KEY='little-haven-v03-active-slot';
let activeSlot=1;
try{activeSlot=localStorage.getItem(ACTIVE_SLOT_KEY)==='2'?2:1;}catch{}
let world:WorldState;try{world=loadWorld(window.localStorage,Date.now(),activeSlot);}catch{world=createWorld();}
let speed=1,paused=false,selected:number|null=null,selectedBuilding:string|null=null,elapsed=0,last=performance.now(),lastSave=performance.now();
let lastDaylight=-1,lastLightingKey='',lastDecisionKey='',lastChronicleId=0,lastTimeShown=-1;
let toastTimer:number|undefined;let audio:AudioContext|null=null,oscillator:OscillatorNode|null=null;
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
function resize(){
 const w=window.innerWidth,h=window.innerHeight,frustum=w<760?34:28.4,aspect=w/h;
 camera.left=-frustum*aspect/2;camera.right=frustum*aspect/2;camera.top=frustum/2;camera.bottom=-frustum/2;
 camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
window.addEventListener('resize',resize);resize();
function toast(message:string){const el=$('toast');el.textContent=message;el.classList.add('show');window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el.classList.remove('show'),4200);}
const formatDay=()=>{const c=getCalendar(world);return '第 '+c.year+' 年 · '+SEASON_NAMES[c.season]+' '+c.dayOfSeason+' 日';};
function renderJournal(){
 $('journalEntries').innerHTML=world.journal.slice(-2).reverse().map(e=>`<p><span class="journal-bullet">✦</span>${escapeHtml(e.text)}</p>`).join('');
 $('dayLabel').textContent=formatDay();
 $('journalAll').innerHTML=[...world.journal].reverse().map(e=>`<div class="event-row"><div class="event-day">DAY ${String(e.day).padStart(2,'0')} <span>· ${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')}</span></div><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.text)}</p></div>`).join('');
}
function renderDecision(){
 const stage=world.storyStage,opportunity=pendingOpportunities(world)[0],growthOpen=world.villageGrowth.phase==='invitation';
 const key=stage+'/'+world.choice+'/'+(opportunity?.id||'-')+'/'+world.villageGrowth.phase+'/'+world.villageGrowth.choice;
 if(lastDecisionKey===key)return;lastDecisionKey=key;
 const invite=stage==='stranger'&&world.choice===null&&!opportunity&&!growthOpen;
 $('choices').hidden=!invite;
 $('villageChoices').hidden=!growthOpen;
 $('opportunityChoices').hidden=!opportunity||growthOpen;
 $('decisionProgress').hidden=growthOpen||!!opportunity||world.choice===null||stage==='legacy';
 $('decisionResult').hidden=growthOpen||!!opportunity||stage!=='legacy';
 $('letterCount').textContent=growthOpen?'水脉机缘 · 三条道路':opportunity?'待回应 · '+pendingOpportunities(world).length:invite?'机缘初现':stage==='legacy'?'旧事仍有新声':'流年有信';
 if(growthOpen){
  $('decisionTag').textContent='乡邻新愿 · 山谷如何生长';
  $('decisionTitle').textContent='水脉与村路';
  const days=Math.max(0,Math.ceil((world.villageGrowth.deadlineAt-world.minutes)/1440));
  $('decisionBody').textContent='河水改变了山谷的路。村民有不同的打算，你愿意支持怎样的未来？尚有'+days+'日；无人干预，乡邻也会自行决定。';
  $('villageChoices').innerHTML=DEVELOPMENT_OPTIONS.map((option,i)=>
   '<button type="button" class="opportunity-choice" data-village="'+option.id+'">'+
   '<strong>'+escapeHtml(option.label)+'</strong><small>'+escapeHtml(option.preview)+'</small>'+
   '<span aria-hidden="true">'+(i===2?'◌':'↗')+'</span></button>').join('');
  return;
 }
 if(opportunity){
  $('decisionTag').textContent=opportunity.kind==='rain-guest'?'谷中结缘 · 雨夜':'谷中庇护 · 修葺';
  $('decisionTitle').textContent=opportunity.title;
  const days=Math.max(0,Math.ceil((opportunity.deadlineMinutes-world.minutes)/1440));
  $('decisionBody').textContent=opportunity.description+' · 尚有'+days+'日，可出手也可随缘。';
  $('opportunityChoices').innerHTML=opportunity.options.map((option,i)=>
   '<button type="button" class="opportunity-choice" data-op="'+escapeHtml(opportunity.id)+'" data-option="'+escapeHtml(option.id)+'">'+
   '<strong>'+escapeHtml(option.label)+'</strong><small>'+escapeHtml(option.preview)+'</small>'+
   '<span aria-hidden="true">'+(i===2?'◌':'↗')+'</span></button>').join('');
  return;
 }
 if(stage==='peace'){
   $('decisionTag').textContent='山中今日无事';$('decisionTitle').textContent='酒肆尚未有客';
   $('decisionBody').textContent='溪水照旧东流，阿青在练武坪挥动木剑。听闻近来有旅人要从山道经过，且看看会发生什么。';
 }else if(invite){
   $('decisionTag').textContent='一道新的江湖机缘';$('decisionTitle').textContent='佩剑客路过无名酒肆';
   $('decisionBody').textContent='沈问舟从山外而来。阿青在酒馆边练剑，眼神追随着他的剑鞘。你愿意为这次相遇留下一点机缘吗？';
 }else if(stage==='legacy'){
   $('decisionTag').textContent='一段江湖，终有归处';$('decisionTitle').textContent=world.choice==='host'?'竹隐剑庐已经落成':'行脚茶亭已经开张';
   $('decisionBody').textContent=world.choice==='host'?'当年少年已归乡传艺，山谷中开始有了习剑的人。':'阿青把江湖经历化作一壶热茶，山路上的旅人又多了一个归处。';
   $('decisionResult').innerHTML='<div class="completed-mark">✓</div><div><b>江湖有了回响</b><small>放大看看村庄的新建筑，并翻阅守望录。</small></div>';
 }else{
   const content:Record<string,[string,string,string]>={
    stranger:['一夜酒香','机缘已经种下',world.choice==='host'?'沈问舟在酒馆留宿。阿青正悄悄观察这位江湖客。':'旅人沿山道离开。少年望着远方，心里记住了那把剑。'],
    training:['练剑的清晨','少年的武学开始有了模样',world.choice==='host'?'练武坪上，沈问舟开始指点阿青的剑式。':'阿青得到一本残旧剑谱，独自练习每一个动作。'],
    departed:['遥远的江湖','阿青已经离村出游','山道上少了一位练剑少年，酒馆仍然每日开张。远方的消息或许会慢慢传来。'],
    rumor:['山外风闻','来自远方的消息',world.choice==='host'?'游商说南边渡口有位年轻剑客正在行侠仗义。':'行脚人捎回消息：阿青正在护送商旅，江湖路上见了许多人。'],
    returned:['故人归来','多年后，阿青回到了山谷','他站在少年时练剑的地方，似乎在想着这些年走过的路。']
   };
   const [tag,title,body]=content[stage]||content.stranger;
   $('decisionTag').textContent=tag;$('decisionTitle').textContent=title;$('decisionBody').textContent=body;
 }
}
function renderProgress(){
 if(world.choice===null||world.storyStage==='legacy')return;
 const p=Math.round(chapterProgress(world)*100);
 $('progressPercent').textContent=`${p}%`;$('progressFill').style.width=`${p}%`;
 const stage=world.storyStage;
 $('progressText').textContent=stage==='stranger'?'机缘正在萌芽':stage==='training'?'少年的剑路':stage==='departed'?'出游的日子':stage==='rumor'?'风闻传回故乡':'归乡后的打算';
}
function renderStats(){ $('population').textContent=String(world.population);$('houses').textContent=String(world.houses);$('renown').textContent=String(world.renown);$('valleyStatus').textContent=villageGrowthLabel(world.villageGrowth);}
function renderClock(){
 const c=getClock(world),h=c.hour;$('clock').textContent=c.text;$('dayLabel').textContent=formatDay();
 const cal=getCalendar(world);$('period').textContent=window.innerWidth<760?cal.year+'年'+SEASON_NAMES[cal.season]+cal.dayOfSeason+'·'+WEATHER_NAMES[getWeather(world)]:'第'+cal.year+'年 · '+SEASON_NAMES[cal.season]+cal.dayOfSeason+'日 · '+WEATHER_NAMES[getWeather(world)];
 $('dayIcon').textContent=h<6||h>=19?'☾':h<10?'☼':'☀';
}
function renderResident(){
 const card=$('residentCard'),v=VILLAGERS.find(v=>v.id===selected);
 if(!v){card.hidden=true;return;}
 card.hidden=false;$('residentName').textContent=v.name;
 const hero=v.id===8;
 $('residentRole').textContent=`${hero&&['returned','legacy'].includes(world.storyStage)?'归乡剑客':v.occupation}  ·  ${v.personality}`;
 $('residentActivity').textContent='◌ '+residentMotion(v,world).activity;
 const influences=world.buildings.filter(b=>b.ownerId===v.id||b.occupantIds.includes(v.id));
 const latestEventId=influences.flatMap(b=>b.causeEventIds).at(-1);
 const latest=world.journal.find(e=>'journal-'+e.id===latestEventId);
 const thought=hero&&['departed','rumor'].includes(world.storyStage)?'“江湖很远，但山谷一直在身后。”':v.thought;
 $('residentThought').textContent=thought+(latest?' · 留下的痕迹：'+latest.title:'');
}
function renderBuilding(){
 const card=$('buildingCard'),b=selectedBuilding?buildingById(world,selectedBuilding):null;
 if(!b){
  const direction=selectedBuilding?.startsWith('valley-')?selectedBuilding.slice(7):'';
  const growth=world.villageGrowth,option=DEVELOPMENT_OPTIONS.find(x=>x.id===direction);
  if(!option||growth.choice!==direction){card.hidden=true;return;}
  card.hidden=false;$('buildingName').textContent=option.landmark;
  const labels={quiet:'尚未规划',invitation:'乡邻商议',foundation:'整理地基',construction:'梁架施工',landmark:'主要设施落成',thriving:'村落渐成形'};
  $('buildingCondition').textContent=labels[growth.phase]+' · 乡邻已经劳作 '+growth.workDays+' 日';
  $('buildingActivity').textContent='◌ 木料 '+growth.wood+' · 粮食 '+growth.food+' · 交流 '+growth.trade+' · 兴盛 '+growth.prosperity;
  $('buildingHistory').textContent='缘由可查：守谷人与村民选择了「'+option.label+'」，发展将继续由乡邻自主完成。';
  return;
 }
 card.hidden=false;$('buildingName').textContent=b.name;
 const condition=conditionOf(b);
 const labels={new:'良好',livedIn:'有人住过的痕迹',worn:'屋瓦渐旧',dilapidated:'亟待修葺'};
 const phase={planned:'筹备中',foundation:'整理地基',construction:'施工中',occupied:'正在使用',repairing:'乡邻修葺中'};
 $('buildingCondition').textContent=phase[b.phase]+' · '+labels[condition]+' · 屋龄 '+b.yearsOld+' 年';
 $('buildingActivity').textContent=b.phase==='repairing'||b.phase==='construction'
  ?'◌ 工程进度 '+Math.round(b.workProgress*100)+'% · 由村民逐日完成'
  :'◌ 完好度 '+Math.round(b.conditionScore)+' / 100 · 使用痕迹 '+b.props.length+' 处';
 const causes=b.causeEventIds.slice(-3).reverse().map(id=>
  world.journal.find(entry=>'journal-'+entry.id===id)?.title||'旧日乡邻劳动');
 $('buildingHistory').textContent='缘由可查：'+(causes.length?causes.join('、'):'屋舍随日子而缓慢改变');
}
function selectBuilding(id:string|null){
 selectedBuilding=id;selected=null;renderResident();renderBuilding();
 const b=id?buildingById(world,id):null;if(b)toast('走近了'+b.name+' · 看见岁月的痕迹');
 else if(id?.startsWith('valley-'))toast('走近了正在改变的村庄 · '+villageGrowthLabel(world.villageGrowth));
}
function selectResident(id:number|null){
 selectedBuilding=null;renderBuilding();selected=id;renderResident();
 const v=VILLAGERS.find(v=>v.id===id);if(v)toast('认识了 '+v.name+' · '+v.occupation);
}
$('villageChoices').addEventListener('click',event=>{
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-village]');
 if(!button)return;
 const chosen=button.dataset.village as typeof DEVELOPMENT_OPTIONS[number]['id'];
 if(chooseVillageDevelopment(world,chosen)){
  lastDecisionKey='';renderDecision();renderJournal();renderStats();renderBuilding();village.updateStory(world);persist();
  toast('山谷有了新方向。接下来，乡邻会逐渐改变这里的道路与建筑。');
 }
});
$('opportunityChoices').addEventListener('click',event=>{
 const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-op]');
 if(!button)return;
 if(chooseOpportunity(world,button.dataset.op||'',button.dataset.option||'')){
  lastDecisionKey='';renderDecision();renderJournal();renderStats();renderBuilding();village.updateStory(world);persist();
  toast('机缘有了回响，居民会继续完成自己的事。');
 }
});
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.choice'))){
 button.addEventListener('click',()=>{
  const choice=button.dataset.choice as Decision;
  if(chooseFate(world,choice)){
   lastDecisionKey='';renderDecision();renderJournal();renderStats();
   toast(choice==='host'?'你为旅人留下一盏灯。':'你将这次相遇交给江湖。');
   try{saveWorld(world,localStorage);}catch{}
  }
 });
}
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'))){
 button.addEventListener('click',()=>{
  if(button.dataset.speed==='48'){
   const from=getCalendar(world),result=advanceToNextSeason(world),to=getCalendar(world);
   lastDecisionKey='';renderDecision();renderJournal();renderStats();renderClock();village.updateStory(world);
   toast('流年小记 · 第'+to.year+'年'+SEASON_NAMES[to.season]+'至 · '+result.crossedSeasons+'次换季'+(from.year!==to.year?'，新的一年开始了':''));
   try{saveWorld(world,localStorage,Date.now(),activeSlot);}catch{}
   return;
  }
  speed=Number(button.dataset.speed)||1;
  document.querySelectorAll('.speed-btn').forEach(el=>el.classList.toggle('active',el===button));
  toast(speed===1?'山谷回到了悠闲的节奏。':'时间正在以 '+speed+' 倍速度流动。');
 });
}
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';toast(paused?'时间暂停了。':'山谷又开始活动了。');});
$('resetCamera').addEventListener('click',()=>{controls.target.set(0,0,0);camera.position.copy(homeView);camera.zoom=1;camera.updateProjectionMatrix();controls.update();});
$('zoomIn').addEventListener('click',()=>{camera.zoom=Math.min(2.22,camera.zoom*1.18);camera.updateProjectionMatrix();});
$('zoomOut').addEventListener('click',()=>{camera.zoom=Math.max(.72,camera.zoom/1.18);camera.updateProjectionMatrix();});
$('closeResident').addEventListener('click',()=>selectResident(null));
$('closeBuilding').addEventListener('click',()=>selectBuilding(null));
$('journalExpand').addEventListener('click',()=>{$('journalModal').hidden=false;renderJournal();});
$('closeJournal').addEventListener('click',()=>{$('journalModal').hidden=true;});
$('journalModal').addEventListener('click',e=>{if(e.target===$('journalModal'))$('journalModal').hidden=true;});
function refreshWorld(){
 speed=1;paused=false;elapsed=0;last=performance.now();$('pause').textContent='Ⅱ';
 document.querySelectorAll<HTMLButtonElement>('.speed-btn').forEach(el=>el.classList.toggle('active',el.dataset.speed==='1'));
 selected=null;selectedBuilding=null;lastDecisionKey='';lastChronicleId=0;lastLightingKey='';lastDaylight=-1;
 renderBuilding();renderResident();renderDecision();renderJournal();renderStats();renderClock();village.updateStory(world);
 $('currentSlot').textContent=activeSlot===1?'一号谷':'二号谷';
 $('saveSlot1').classList.toggle('active',activeSlot===1);
 $('saveSlot2').classList.toggle('active',activeSlot===2);
}
function persist(){try{saveWorld(world,localStorage,Date.now(),activeSlot);}catch{}}
for(const slot of [1,2]){
 $('saveSlot'+slot).addEventListener('click',()=>{
  if(slot===activeSlot)return;
  persist();activeSlot=slot;try{localStorage.setItem(ACTIVE_SLOT_KEY,String(slot));}catch{}
  try{world=loadWorld(localStorage,Date.now(),activeSlot);}catch{world=createWorld();}
  refreshWorld();toast('走进了'+(slot===1?'一号谷':'二号谷')+'。');
 });
}
$('resetGame').addEventListener('click',()=>{
 if(!confirm('在'+(activeSlot===1?'一号谷':'二号谷')+'重新开档？当前槽的记录会被覆盖，另一个槽与 v0.2 旧档均保留。'))return;
 world=createWorld();persist();refreshWorld();$('journalModal').hidden=true;
 toast('新的山谷，从一个清晨重新开始。');
});
$('exportGame').addEventListener('click',()=>{
 persist();const content=JSON.stringify(world,null,2);
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='little-haven-v03-slot-'+activeSlot+'.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast('当前山谷的备份已导出。');
});
$('importTrigger').addEventListener('click',()=>$<HTMLInputElement>('importFile').click());
$<HTMLInputElement>('importFile').addEventListener('change',async e=>{
 const input=e.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';
 if(!file)return;
 if(file.size>2_000_000){toast('存档文件过大。');return;}
 const restored=importWorld(await file.text());
 if(!restored){toast('无法读取：需要有效的 v0.3 存档 JSON。');return;}
 if(!confirm('将导入的进度覆盖当前槽吗？请先导出现有存档备份。'))return;
 world=restored;persist();refreshWorld();$('journalModal').hidden=true;toast('山谷记录已恢复。');
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){$('journalModal').hidden=true;selectResident(null);selectBuilding(null);}if(e.key===' '&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();$('pause').click();}});
// Gentle sine-tone ambience is opt-in; no external audio files.
$('sound').addEventListener('click',()=>{
 try{
  if(audio){oscillator?.stop();void audio.close();audio=null;oscillator=null;$('soundLabel').textContent='OFF';toast('环境音已关闭。');return;}
  audio=new AudioContext();oscillator=audio.createOscillator();const gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=174.6;gain.gain.value=.006;
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();$('soundLabel').textContent='ON';toast('柔和的底音已经开启。');
 }catch{toast('当前浏览器暂不支持环境音。');}
});
let downX=0,downY=0;
canvas.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;});
canvas.addEventListener('pointerup',e=>{
 if(Math.hypot(e.clientX-downX,e.clientY-downY)>8)return;
 mouse.set(e.clientX/window.innerWidth*2-1,-(e.clientY/window.innerHeight)*2+1);raycaster.setFromCamera(mouse,camera);
 const candidates:THREE.Object3D[]=[];
 for(const p of people)if(p.group.visible)p.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry.type!=='CircleGeometry')candidates.push(o);});
 const hits=raycaster.intersectObjects([...candidates,...village.buildingTargets.filter(o=>o.visible)],true);
 if(hits.length){
  let target:THREE.Object3D|null=hits[0].object;
  while(target&&target.userData.villagerId===undefined&&target.userData.buildingId===undefined)target=target.parent;
  if(target?.userData.villagerId!==undefined)selectResident(target.userData.villagerId as number);
  else if(target?.userData.buildingId!==undefined)selectBuilding(target.userData.buildingId as string);
  else selectResident(null);
 }else selectResident(null);
});
function lighting(daylight:number){
 const weather=getWeather(world),season=getCalendar(world).season,key=season+'/'+weather;
 if(Math.abs(daylight-lastDaylight)<.01&&lastLightingKey===key)return;
 lastDaylight=daylight;lastLightingKey=key;
 const seasonal={
  spring:{key:'#fff1df',sky:'#d7e9dc',fill:'#e5f0e0',sunset:'#edc3a7'},
  summer:{key:'#ffedcb',sky:'#b8ddce',fill:'#d1e8d0',sunset:'#edbb87'},
  autumn:{key:'#ffd3a0',sky:'#ead8b9',fill:'#eaddbf',sunset:'#db9e73'},
  winter:{key:'#dbeafa',sky:'#d6e7ea',fill:'#dceaf3',sunset:'#dfb4a5'}
 }[season];
 const cloudy=weather==='rain',foggy=weather==='fog';
 const ambient=cloudy?.71:foggy?.86:1;
 hemi.color.set(seasonal.fill);hemi.intensity=(.78+daylight*1.13)*ambient;
 sun.intensity=(.20+daylight*2.68)*(cloudy?.33:foggy?.69:1);
 fill.intensity=.20+daylight*.31;
 sun.color.set(daylight<.40?seasonal.sunset:seasonal.key);
 renderer.toneMappingExposure=(.94+daylight*.28)*(cloudy?.83:foggy?.96:1);
 const night=new THREE.Color('#263449'),morning=new THREE.Color(seasonal.sunset),day=new THREE.Color(seasonal.sky);
 const sky=daylight<.35?night.clone().lerp(morning,daylight/.35):morning.clone().lerp(day,(daylight-.35)/.65);
 if(cloudy)sky.lerp(new THREE.Color(daylight<.36?'#586778':'#788b94'),.64);
 else if(foggy)sky.lerp(new THREE.Color('#c5d4ce'),.32);
 document.documentElement.style.setProperty('--sky-top','#'+sky.getHexString());
 document.documentElement.style.setProperty('--sky-bottom','#'+sky.clone().lerp(
  new THREE.Color(cloudy?'#d5d9d2':daylight<.4?'#8f8d97':'#f3e8d4'),.52).getHexString());
 scene.fog!.color.copy(sky);
}
function tick(now:number){
 const dt=Math.min(.09,Math.max(0,(now-last)/1000));last=now;
 if(!paused){
  const events=advanceWorld(world,dt*speed);elapsed+=dt*speed;
  if(events.visitor)toast('山道上来了位佩剑客。');
  if(events.milestones.length){const last=events.milestones.at(-1);toast(last==='legacy'?'山谷里有了新的归处。':last==='returned'?'阿青归来了。':'谷中又传来一段江湖消息。');}
  if(events.crossedSeasons)toast('新的一季到了，山谷的景色也变了。');
  if(events.visitor||events.milestones.length||events.crossedSeasons||events.newDay||events.visualChanges.length){lastDecisionKey='';renderDecision();renderJournal();renderStats();renderBuilding();}
 }
 const daylight=getDaylight(world);lighting(daylight);village.updateStory(world);village.animate(elapsed,daylight);updatePeople(people,world,elapsed,selected);
 controls.update();renderer.render(scene,camera);
 if(now-lastTimeShown>260){lastTimeShown=now;renderClock();renderProgress();if(selected!==null)renderResident();if(selectedBuilding!==null)renderBuilding();}
 if(world.journal.at(-1)?.id!==lastChronicleId){lastChronicleId=world.journal.at(-1)?.id||0;renderJournal();}
 if(now-lastSave>5000){lastSave=now;persist();}
 requestAnimationFrame(tick);
}
let hiddenSince:number|null=null;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenSince=Date.now();persist();}
 else if(hiddenSince!==null){const away=Math.min(4*1440/3,Math.max(0,(Date.now()-hiddenSince)/1000));hiddenSince=null;
  advanceWorld(world,away);lastDecisionKey='';renderDecision();renderStats();renderJournal();renderBuilding();village.updateStory(world);last=performance.now();
 }
});
window.addEventListener('pagehide',persist);
renderStats();renderDecision();renderJournal();renderClock();village.updateStory(world);
$('currentSlot').textContent=activeSlot===1?'一号谷':'二号谷';
$('saveSlot1').classList.toggle('active',activeSlot===1);
$('saveSlot2').classList.toggle('active',activeSlot===2);
// Browser-level tests can inspect deterministic state without controlling the render-loop clock.
(window as typeof window&{__HAVEN_DEBUG__?:unknown}).__HAVEN_DEBUG__={
 getState:()=>structuredClone(world),
 choose:(choice:Decision)=>{const ok=chooseFate(world,choice);lastDecisionKey='';renderDecision();renderJournal();return ok;},
 advance:(seconds:number)=>{const result=advanceWorld(world,seconds);lastDecisionKey='';renderDecision();renderStats();renderJournal();village.updateStory(world);return result;},
 reset:()=>{world=createWorld();lastDecisionKey='';renderDecision();renderJournal();renderStats();village.updateStory(world);return true;},
 flowSeason:()=>{const result=advanceToNextSeason(world);lastDecisionKey='';renderDecision();renderJournal();village.updateStory(world);return result;},
 chooseOpportunity:(id:string,option:string)=>{const result=chooseOpportunity(world,id,option);lastDecisionKey='';renderDecision();village.updateStory(world);return result;},
 chooseVillage:(direction:'bridge'|'ferry'|'grove')=>{const result=chooseVillageDevelopment(world,direction);lastDecisionKey='';renderDecision();renderJournal();renderStats();village.updateStory(world);return result;},
 getGrowthVisual:()=>({state:structuredClone(world.villageGrowth),signature:village.growthVisualSignature()}),
 getTerrainProbe:(x:number,z:number)=>village.groundProbe(x,z),
 getRendererInfo:()=>({
  calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
  geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
  dpr:renderer.getPixelRatio(),batch:village.batchStats
 }),
 getVisualState:()=>({season:getCalendar(world).season,weather:getWeather(world),minute:world.minutes,
  npcs:VILLAGERS.map(v=>({id:v.id,...residentMotion(v,world)}))}),
 getRainSamples:()=>village.rainSample(12),
 getRiverProbe:()=>{
  const samples=[.10,.24,.38,.55,.72,.88].map(u=>{
   const point=village.riverAt(u).clone();point.y=village.riverSurfaceY;
   const projected=point.clone().project(camera);
   const x=(projected.x+1)*window.innerWidth/2,y=(1-projected.y)*window.innerHeight/2;
   const ray=new THREE.Raycaster();
   ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);
   const waterHit=ray.intersectObject(village.riverSurface,false)[0];
   const isOpaque=(o:THREE.Object3D)=>{
    let p:THREE.Object3D|null=o;
    while(p){if(!p.visible)return false;p=p.parent;}
    if(!(o instanceof THREE.Mesh))return false;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    return materials.some(m=>!m.transparent||m.opacity>=.92);
   };
   const nearest=ray.intersectObjects(village.root.children,true)
    .find(hit=>isOpaque(hit.object));
   const unobstructed=!!waterHit&&(!nearest||waterHit.distance<=nearest.distance+.09);
   return {u,x,y,world:[point.x,point.y,point.z],surfaceHit:!!waterHit,
    unobstructed,closestMesh:nearest?.object.name||nearest?.object.type||'none',
    closestY:nearest?.point.y??null,nearestDistance:nearest?.distance??null,
    riverDistance:waterHit?.distance??null};
  });
  return {surfaceY:village.riverSurfaceY,surfaceName:village.riverSurface.name,samples};
 },
 getCharacterPose:(id:number)=>{
  const person=people.find(p=>p.villager.id===id);
  return person?{...person.pose,groupPosition:person.group.position.toArray(),upperPosition:person.upper.position.toArray(),
   clipMode:person.heroAnimator?.currentMode()||null,clipPhase:person.heroAnimator?.currentPhase()||null}:null;
 }
};
requestAnimationFrame(tick);
