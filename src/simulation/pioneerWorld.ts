import {DAY_MINUTES,getCalendarFromMinutes,nextSeasonBoundary} from './calendar.ts';
import {getWeatherForMinutes} from './weather.ts';
import {nearestRoad,reservedParcels,validateVillageParcel,
 type VillageParcel} from './villagePlanning.ts';
import {findPioneerWalk,pioneerBuildingPath,pioneerEntrance,type WalkPoint,type PioneerRoad} from './pioneerPaths.ts';
import {agePioneerBuildings,completePioneerProject,considerPioneerMigration,
 pioneerHasFacility,pioneerHousingCapacity,pioneerBuildingLabel,
 registerPioneerTrip,schedulePioneerProject} from './pioneerGrowth.ts';

export const PIONEER_VERSION=4;
export const PIONEER_SLOT_KEYS=['little-haven-pioneer-v04-slot-1','little-haven-pioneer-v04-slot-2'] as const;
export const PIONEER_ACTIVE_SLOT='little-haven-pioneer-v04-active-slot';
export const PIONEER_MINUTES_PER_SECOND=3;
const HOUR=60;
const SHELTER_WOOD=7;
const SHELTER_WORK=9;
const round=(n:number)=>Math.round(n*1000)/1000;
const point=(x:number,z:number):[number,number]=>[round(x),round(z)];
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);return ((k^(k>>>16))>>>0)/4294967296;
};
export type PioneerWork='rest'|'collect-wood'|'forage'|'fetch-water'|'build'|'tend-fire'|'shelter'|'farm'|'repair';
export type PioneerBuildKind='shelter'|'cottage'|'garden'|'wood-yard';
export type PioneerPolicy='balanced'|'shelter'|'food';
export interface PioneerFounder{
 id:number;name:string;role:string;color:string;
 activity:PioneerWork;target:[number,number];homeBuildingId:string|null;
 commute?:WalkPoint[];pathRoadId?:string;
}
export interface PioneerResourceSite{
 id:string;kind:'forest'|'forage'|'spring'|'field';x:number;z:number;
 stock:number;capacity:number;renewPerDay:number;totalGathered:number;
}
export interface PioneerJournal{
 id:number;minute:number;title:string;text:string;causeId:string|null;
}
export interface PioneerIntent{
 id:string;reason:string;createdAt:number;requestedBy:number[];
 kind?:PioneerBuildKind|'repair';targetBuildingId?:string;path?:WalkPoint[];
 parcel:VillageParcel|null;phase:'survey'|'materials'|'foundation'|'frame';
 woodRequired:number;woodCommitted:number;workDone:number;workRequired:number;
 pauseReason:string|null;
}
export interface PioneerBuilding{
 id:string;kind:PioneerBuildKind;parcel:VillageParcel;completedAt:number;
 causeId:string;occupants:number[];materialsSpent:{wood:number};workHours:number;
 condition?:number;lastRepairAt?:number;
}
export interface PioneerWorld{
 schemaVersion:4;mode:'pioneer';seed:number;minutes:number;lastSavedAt:number;
 camp:{x:number;z:number};founders:PioneerFounder[];
 resources:{wood:number;food:number;water:number};
 sites:PioneerResourceSite[];intent:PioneerIntent|null;buildings:PioneerBuilding[];
 journal:PioneerJournal[];nextEventId:number;policy:PioneerPolicy;comfort:number;
 roads:PioneerRoad[];nextResidentId:number;nextSurveyAt:number;lastArrivalAt:number;
}
const landscape=()=>reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
const parcel=(id:string,x:number,z:number,width:number,depth:number,rotation=0):VillageParcel=>{
 const road=nearestRoad(x,z);
 return {id,kind:'protected',x:round(x),z:round(z),width,depth,rotation,
  clearance:.24,accessX:road.point[0],accessZ:road.point[1],builtAt:0};
};
/** The camp and shelters use the existing SAT/river/island/vegetation rules,
 * but NEVER inherit BASE_PARCELS or the v0.3 prebuilt village. */
export function choosePioneerCamp(seed:number):{x:number;z:number}{
 const occupied=landscape();const options:{x:number;z:number;score:number}[]=[];
 for(let i=-7;i<=7;i++)for(let j=-6;j<=6;j++){
  const x=-5.1+i*.61+hash(seed+31)*.27,z=-.8+j*.61+hash(seed+79)*.27;
  const p=parcel('pioneer-camp',x,z,1.25,1.25);
  if(!validateVillageParcel(p,occupied,3.25).ok)continue;
  options.push({x:p.x,z:p.z,score:Math.hypot(i*.61,j*.61)*.26+
   hash(seed+i*997+j*733)*.65});
 }
 options.sort((a,b)=>a.score-b.score||a.x-b.x||a.z-b.z);
 if(!options.length)throw new Error('No collision-safe campsite');
 return {x:options[0].x,z:options[0].z};
}
function log(s:PioneerWorld,title:string,text:string,causeId:string|null=null){
 if(s.journal.length>=160)s.journal.shift();
 s.journal.push({id:s.nextEventId++,minute:s.minutes,title,text,causeId});
}
function resourceSites(seed:number):PioneerResourceSite[]{
 const jitter=(n:number)=>(hash(seed+n)-.5)*1.05;
 return [
  {id:'forest-west',kind:'forest',x:round(-11.2+jitter(1)),z:round(-5.7+jitter(2)),
   stock:20,capacity:24,renewPerDay:1.15,totalGathered:0},
  {id:'forage-north',kind:'forage',x:round(-8.5+jitter(3)),z:round(6.8+jitter(4)),
   stock:17,capacity:19,renewPerDay:4.4,totalGathered:0},
  {id:'spring-east',kind:'spring',x:round(4.1+jitter(5)),z:round(-3.0+jitter(6)),
   stock:30,capacity:30,renewPerDay:12,totalGathered:0}
 ];
}
export function createPioneerWorld(seed=20261103,now=Date.now()):PioneerWorld{
 const camp=choosePioneerCamp(seed);
 const s:PioneerWorld={
  schemaVersion:4,mode:'pioneer',seed,minutes:8*60+20,lastSavedAt:now,camp,
  founders:[
   {id:1,name:'梁伯',role:'行山人 · 樵夫',color:'#53776c',activity:'rest',
    target:point(camp.x-.8,camp.z-.3),homeBuildingId:null},
   {id:2,name:'陆娘',role:'营地掌事者',color:'#bd8069',activity:'tend-fire',
    target:point(camp.x+.6,camp.z-.5),homeBuildingId:null},
   {id:3,name:'阿禾',role:'山野采集者',color:'#8a9b64',activity:'rest',
    target:point(camp.x,camp.z+.9),homeBuildingId:null}
  ],
  resources:{wood:1,food:5,water:5},sites:resourceSites(seed),
  intent:null,buildings:[],journal:[],nextEventId:1,policy:'balanced',comfort:32,
  roads:[],nextResidentId:4,nextSurveyAt:0,lastArrivalAt:0
 };
 log(s,'荒谷点火','梁伯、陆娘和阿禾在安全的林缘安下临时营火。眼前尚无永久屋舍。');
 return s;
}
export function getPioneerCalendar(s:PioneerWorld){return getCalendarFromMinutes(s.minutes);}
export function getPioneerWeather(s:PioneerWorld){return getWeatherForMinutes(s.minutes,s.seed);}
function campParcel(s:PioneerWorld){return parcel('temporary-camp',s.camp.x,s.camp.z,1.25,1.25);}
export function validatePioneerSite(s:PioneerWorld,p:VillageParcel){
 return validateVillageParcel(p,[...landscape(),campParcel(s),...s.buildings.map(b=>b.parcel)],3.75);
}
export function planPioneerShelter(s:PioneerWorld):VillageParcel|null{
 const occupied=[...landscape(),campParcel(s),...s.buildings.map(b=>b.parcel)];
 const campRoad=nearestRoad(s.camp.x,s.camp.z);
 const alternatives:{parcel:VillageParcel;score:number}[]=[];
 // A survey considers the eaves/porch and keeps the same natural approach path
 // as the camp. Its geometry is reserved, never moved inside Three.js.
 for(let i=-12;i<=12;i++)for(let j=-12;j<=12;j++){
  const x=s.camp.x+i*.62+hash(s.seed+13)*.20;
  const z=s.camp.z+j*.62+hash(s.seed+67)*.20;
  for(const angle of [0,Math.PI/2]){
   const road=nearestRoad(x,z);if(road.route!==campRoad.route)continue;
   const p=parcel('pioneer-shelter-001',x,z,2.65,2.45,angle);
   p.kind='dwelling';p.clearance=.30;p.builtAt=s.minutes;
   if(!validateVillageParcel(p,occupied,3.75).ok)continue;
   // A very long commute would create an untraversable early settlement.
   if(distance(p,s.camp)>7.5||distance(p,s.camp)<3.5)continue;
   const campDistance=distance(p,s.camp);
   const preference=s.policy==='food'?Math.hypot(x+8.5,z-6.8)*.06:
    s.policy==='shelter'?Math.hypot(x+11.2,z+5.7)*.06:0;
   alternatives.push({parcel:p,score:campDistance*.17+road.distance*.14+
    preference+hash(s.seed+i*701+j*991+Math.round(angle*10))*.85});
  }
 }
 alternatives.sort((a,b)=>a.score-b.score||a.parcel.x-b.parcel.x||a.parcel.z-b.parcel.z);
 for(const item of alternatives){
  if(pioneerBuildingPath(s.camp,item.parcel,occupied.filter(b=>b.id!=='temporary-camp')))return item.parcel;
 }
 return null;
}
function requestShelter(s:PioneerWorld){
 if(s.buildings.some(b=>b.kind==='shelter')||s.intent)return;
 const id='need-'+s.nextEventId;
 const location=planPioneerShelter(s);
 const walk=location?pioneerBuildingPath(s.camp,location,[...landscape(),...s.buildings.map(b=>b.parcel)]):null;
 s.intent={id,kind:'shelter',path:walk??undefined,reason:'三人露宿山野，夜雨与寒风需要遮蔽。',createdAt:s.minutes,
  requestedBy:s.founders.map(f=>f.id),parcel:location,
  phase:location?'materials':'survey',woodRequired:SHELTER_WOOD,woodCommitted:0,
  workDone:0,workRequired:SHELTER_WORK,
  pauseReason:location?'木料尚未备齐':'山路附近找不到安全且可达的屋址'};
 log(s,'商量搭棚',location?'梁伯勘察河岸、山径和林缘，选定安全地块，乡邻开始备木。':
  '梁伯反复勘地，尚无不碰河岸、树根与山径的合法屋址。',id);
}
/** Each assignment resolves one safe resident commute, which the renderer
 * samples at any frame rate. Cached until the job or worksite changes. */
function allocate(s:PioneerWorld,f:PioneerFounder,activity:PioneerWork,site?:PioneerResourceSite){
 const task=s.intent;
 const home=s.buildings.find(b=>b.id===f.homeBuildingId);
 const shelter=activity==='shelter'?home:undefined;
 const targetBuilding=activity==='build'||activity==='repair'?
  s.buildings.find(b=>b.id===task?.targetBuildingId):shelter;
 const jobRoute=(activity==='build'||activity==='repair')?
  task?.path&&task.path.length?task.path:
  s.roads.find(r=>r.buildingId===targetBuilding?.id)?.points:undefined;
 const builtRoad=s.roads.find(r=>r.buildingId===targetBuilding?.id);
 const goal:WalkPoint=site?[site.x,site.z]:
  (activity==='build'||activity==='repair')&&task?.parcel?pioneerEntrance(task.parcel):
  shelter?pioneerEntrance(shelter.parcel):
  [s.camp.x+(f.id%4-1.5)*.43,s.camp.z+(f.id%3-1)*.38];
 const isSame=f.activity===activity&&f.target[0]===goal[0]&&f.target[1]===goal[1];
 if(isSame&&f.commute?.length)return;
 const from:WalkPoint=home?pioneerEntrance(home.parcel):[s.camp.x,s.camp.z];
 const obstacles=[...landscape(),...s.buildings.map(b=>b.parcel)].filter(p=>
  p.id!==home?.parcel.id&&p.id!==task?.parcel?.id&&p.id!==shelter?.parcel.id);
 let commute:WalkPoint[]|null;
 if(home&&shelter?.id===home.id)commute=[from,goal];
 else if(!home&&jobRoute?.length)commute=jobRoute.map(p=>[p[0],p[1]]);
 else commute=findPioneerWalk(from,goal,obstacles);
 if(!commute){
  // Never award work or gathered stock to somebody who cannot reach the place.
  f.activity='rest';f.target=point(from[0],from[1]);f.commute=[from,from];f.pathRoadId=undefined;
  return;
 }
 f.activity=activity;f.target=point(goal[0],goal[1]);f.commute=commute;
 f.pathRoadId=builtRoad?.id??
  (activity==='build'?s.roads.find(r=>r.buildingId===task?.parcel?.id)?.id:undefined);
 registerPioneerTrip(s,f.pathRoadId);
}
function gather(s:PioneerWorld,f:PioneerFounder,kind:PioneerResourceSite['kind'],amount:number,activity:PioneerWork){
 const site=s.sites.find(x=>x.kind===kind);if(!site)return false;
 allocate(s,f,activity,site);
 if(f.activity==='rest')return false;
 const cap=kind==='forest'?48:36;
 const held=kind==='forest'?s.resources.wood:kind==='spring'?s.resources.water:s.resources.food;
 const gathered=Math.max(0,Math.min(site.stock,amount,cap-held));
 site.stock=round(site.stock-gathered);site.totalGathered=round(site.totalGathered+gathered);
 if(kind==='forest')s.resources.wood=round(s.resources.wood+gathered);
 else if(kind==='spring')s.resources.water=round(s.resources.water+gathered);
 else s.resources.food=round(s.resources.food+gathered);
 return gathered>0;
}
function work(s:PioneerWorld,f:PioneerFounder){
 if(!s.intent||!s.intent.parcel||s.intent.phase==='materials'||s.intent.phase==='survey')return false;
 allocate(s,f,s.intent.kind==='repair'?'repair':'build');
 if(f.activity==='rest')return false;
 const weather=getPioneerWeather(s);const effort=weather==='rain'?.7:1;
 s.intent.workDone=round(Math.min(s.intent.workRequired,s.intent.workDone+effort));
 if(s.intent.workDone>=2&&s.intent.phase==='foundation'){
  s.intent.phase='frame';log(s,s.intent.kind==='repair'?'修缮起梁':'梁架起身',
    '地基已稳住，木梁和施工细节逐渐有了轮廓。',s.intent.id);
 }
 return true;
}
/** One authoritative hourly settlement step. Work assignments are exclusive and
 * consume one person's hour; day/month fast-forward uses these same steps. */
function step(s:PioneerWorld){
 const weather=getPioneerWeather(s);
 agePioneerBuildings(s);
 if(s.minutes%DAY_MINUTES===0){
  const season=getPioneerCalendar(s).season;
  for(const site of s.sites){
   const factor=(site.kind==='forage'||site.kind==='field')&&season==='winter'?.38:1;
   site.stock=round(Math.min(site.capacity,site.stock+site.renewPerDay*factor));
  }
 }
 s.resources.food=round(Math.max(0,s.resources.food-s.founders.length/24));
 s.resources.water=round(Math.max(0,s.resources.water-s.founders.length/24));
 if(s.minutes%DAY_MINUTES===0&&(s.resources.food<1||s.resources.water<1))
  log(s,'储备告急','乡邻缺少粮水，暂缓非必要劳动，改去水源或有余量的林地采集。');
 requestShelter(s);schedulePioneerProject(s);considerPioneerMigration(s);
 const intent=s.intent;
 if(intent&&intent.phase==='survey'){
  intent.parcel=planPioneerShelter(s);
  if(intent.parcel){
   intent.path=pioneerBuildingPath(s.camp,intent.parcel,
    [...landscape(),...s.buildings.map(b=>b.parcel)])??undefined;
   intent.phase='materials';intent.pauseReason='木料尚未备齐';
   log(s,'找到安全屋址','梁伯重新勘地，找到了不挡河岸、林地与山路的合法屋址。',intent.id);
  }
 }
 const hour=Math.floor(s.minutes%DAY_MINUTES/60);
 if(hour<7||hour>=20){
  for(const f of s.founders)allocate(s,f,f.homeBuildingId?'shelter':'rest');
  s.comfort=s.buildings.length?weather==='rain'?74:82:weather==='rain'?18:32;
  return;
 }
 const building=!!intent&&intent.phase!=='survey'&&intent.phase!=='materials';
 const needWood=!!intent&&intent.phase==='materials'&&s.resources.wood<intent.woodRequired;
 const [liang,lu,he]=s.founders;
 if(needWood||!building&&s.resources.wood<16){
  if(!gather(s,liang,'forest',.94,'collect-wood'))allocate(s,liang,'rest');
 }else if(building)work(s,liang);
 else allocate(s,liang,'tend-fire');
 const foodTarget=s.policy==='food'?18:s.policy==='shelter'?5.5:9.5;
 const field=s.sites.find(site=>site.kind==='field'&&site.stock>.01);
 if(s.resources.food<foodTarget||!building){
  const harvested=field?gather(s,he,'field',weather==='rain'?.58:.94,'farm'):false;
  if(!harvested&&!gather(s,he,'forage',weather==='rain'?.62:.86,'forage'))
   allocate(s,he,'rest');
 }else if(building)work(s,he);
 else allocate(s,he,'shelter');
 const waterTarget=s.policy==='food'?8:s.policy==='shelter'?2.8:4.3;
 if(s.resources.water<waterTarget||!building&&s.resources.water<6){
  if(!gather(s,lu,'spring',1.36,'fetch-water'))allocate(s,lu,'rest');
 }else if(building)work(s,lu);
 else allocate(s,lu,'tend-fire');
 for(const f of s.founders.slice(3)){
  if(s.resources.food<s.founders.length*1.7){
   const source=s.sites.some(site=>site.kind==='field'&&site.stock>.05)?'field':'forage';
   if(!gather(s,f,source,.86,source==='field'?'farm':'forage'))allocate(s,f,'rest');
  }else if(s.resources.water<s.founders.length*1.2){
   if(!gather(s,f,'spring',1.25,'fetch-water'))allocate(s,f,'rest');
  }else if(building&&s.resources.food>3)work(s,f);
  else if(s.resources.wood<Math.max(11,intent?.woodRequired??11)){
   if(!gather(s,f,'forest',pioneerHasFacility(s,'wood-yard')?1.15:.72,'collect-wood'))
    allocate(s,f,'rest');
  }else allocate(s,f,'shelter');
 }
 if(intent?.phase==='materials'){
  if(s.resources.wood>=intent.woodRequired&&s.resources.food>=.5&&s.resources.water>=.5){
   s.resources.wood=round(s.resources.wood-intent.woodRequired);
   intent.woodCommitted=intent.woodRequired;intent.phase='foundation';intent.pauseReason=null;
   log(s,'工材送达','乡邻从有限林地采集的 '+intent.woodRequired+
    ' 份木料已经扣库送至工地，开始真实施工。',intent.id);
  }else intent.pauseReason=s.resources.wood<intent.woodRequired?
   '还缺 '+round(intent.woodRequired-s.resources.wood)+' 份木料':'粮水告急，暂缓施工';
 }
 if(intent&&intent.workDone>=intent.workRequired)completePioneerProject(s);
 s.comfort=s.buildings.length?weather==='rain'?74:82:weather==='rain'?18:32;
}
export function advancePioneerWorld(s:PioneerWorld,realSeconds:number){
 if(!Number.isFinite(realSeconds)||realSeconds<0)throw new RangeError('Invalid advance');
 const from=Math.floor(s.minutes/HOUR),target=s.minutes+realSeconds*PIONEER_MINUTES_PER_SECOND;
 const to=Math.floor(target/HOUR);
 for(let i=from+1;i<=to;i++){s.minutes=i*HOUR;step(s);}
 s.minutes=target;
 return {hours:to-from,buildings:s.buildings.length,
  stage:s.intent?.phase??(s.buildings.length?'in-use':'unplanned')};
}
export function advancePioneerToSeason(s:PioneerWorld){
 return advancePioneerWorld(s,(nextSeasonBoundary(s.minutes)-s.minutes)/PIONEER_MINUTES_PER_SECOND);
}
export function setPioneerPolicy(s:PioneerWorld,policy:PioneerPolicy){
 if(!['balanced','shelter','food'].includes(policy)||s.policy===policy)return false;
 s.policy=policy;
 log(s,'守谷人的建议',policy==='shelter'?'先顾避雨，赶在山雨前把木料送到工地。':
  policy==='food'?'多存野果与谷粮，暂缓可以等待的施工。':'让乡邻自行权衡粮食和屋舍。');
 return true;
}
export function savePioneerWorld(s:PioneerWorld,storage:Pick<Storage,'setItem'>,
 now=Date.now(),slot=1){
 s.lastSavedAt=now;storage.setItem(PIONEER_SLOT_KEYS[slot===2?1:0],JSON.stringify(s));
}
export function importPioneerWorld(raw:string):PioneerWorld|null{
 try{
  const s=JSON.parse(raw) as PioneerWorld;
  if(s?.schemaVersion!==4||s.mode!=='pioneer'||!Number.isFinite(s.seed)||
   !Number.isFinite(s.minutes)||s.minutes<0||!Number.isFinite(s.lastSavedAt)||
   !Number.isInteger(s.nextEventId)||s.nextEventId<1||
   !['balanced','shelter','food'].includes(s.policy)||
   !s.camp||!Number.isFinite(s.camp.x)||!Number.isFinite(s.camp.z)||
   !Array.isArray(s.founders)||s.founders.length<3||s.founders.length>9||
   !s.founders.every(f=>Number.isInteger(f.id)&&f.id>=1&&Number.isFinite(f.target?.[0])&&Number.isFinite(f.target?.[1]))||
   new Set(s.founders.map(f=>f.id)).size!==s.founders.length||
   !s.resources||!['wood','food','water'].every(k=>Number.isFinite(s.resources[k as keyof typeof s.resources])&&s.resources[k as keyof typeof s.resources]>=0)||
   !Array.isArray(s.sites)||s.sites.length<3||s.sites.length>12||
   !s.sites.every(site=>Number.isFinite(site.stock)&&site.stock>=0&&Number.isFinite(site.capacity)&&site.capacity>=site.stock&&Number.isFinite(site.totalGathered))||
   !Array.isArray(s.buildings)||s.buildings.length>12||
   !Array.isArray(s.journal)||s.journal.length>160)return null;
  s.roads??=[];s.nextResidentId??=Math.max(...s.founders.map(f=>f.id))+1;
  s.nextSurveyAt??=0;s.lastArrivalAt??=0;
  if(!Array.isArray(s.roads)||s.roads.length>12||
   !Number.isInteger(s.nextResidentId)||s.nextResidentId<4||
   !Number.isFinite(s.nextSurveyAt)||!Number.isFinite(s.lastArrivalAt))return null;
  const ids=new Set<string>();
  const occupied=[...landscape(),campParcel(s)];
  for(const b of s.buildings){
   if(!b||!['shelter','garden','cottage','wood-yard'].includes(b.kind)||typeof b.id!=='string'||ids.has(b.id)||!b.parcel||!b.materialsSpent||
    !(b.materialsSpent.wood>=0)||b.materialsSpent.wood>20||
    !Number.isFinite(b.parcel.x)||!Number.isFinite(b.parcel.z)||
    !validateVillageParcel(b.parcel,occupied,3.75).ok)return null;
   ids.add(b.id);occupied.push(b.parcel);
  }
  if(s.intent){
   if(!['survey','materials','foundation','frame'].includes(s.intent.phase)||
    !Number.isFinite(s.intent.woodCommitted)||!Number.isFinite(s.intent.workDone)||
    s.intent.woodCommitted<0||s.intent.woodCommitted>20||
    s.intent.workDone<0||s.intent.workDone>30)return null;
   if(s.intent.parcel&&s.intent.kind!=='repair'&&
    !validateVillageParcel(s.intent.parcel,occupied,4.25).ok)return null;
  }
  return s;
 }catch{return null;}
}
export function loadPioneerWorld(storage:Pick<Storage,'getItem'>,now=Date.now(),slot=1){
 const raw=storage.getItem(PIONEER_SLOT_KEYS[slot===2?1:0]);
 const restored=raw?importPioneerWorld(raw):null;
 const s=restored??createPioneerWorld(20261103+slot*193,now);
 if(restored){
  const offline=Math.min(4*DAY_MINUTES/PIONEER_MINUTES_PER_SECOND,
   Math.max(0,(now-s.lastSavedAt)/1000));
  advancePioneerWorld(s,offline);
 }
 return s;
}
export function pioneerSummary(s:PioneerWorld){
 const project=s.intent;
 if(project){
  const label=project.kind==='repair'?'修缮旧屋':pioneerBuildingLabel(project.kind??'shelter');
  if(project.phase==='survey')return project.pauseReason||'正在寻找安全可达的屋址';
  if(project.phase==='materials')return '筹建'+label+' · '+(project.pauseReason||'正在备料');
  if(project.phase==='foundation')return label+' · 地基施工中';
  return label+' · 木梁施工中';
 }
 if(!s.buildings.length)return '营火初起 · 乡邻正在商量如何落脚';
 return '山谷生长中 · '+s.buildings.length+' 处建筑 · '+s.founders.length+' 位常住乡邻';
}
export function pioneerPopulation(s:PioneerWorld){return s.founders.length;}
export function pioneerHousing(s:PioneerWorld){return pioneerHousingCapacity(s);}
