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
function allocate(s:PioneerWorld,f:PioneerFounder,activity:PioneerWork,site?:PioneerResourceSite){
 f.activity=activity;
 f.target=site?point(site.x,site.z):activity==='build'&&s.intent?.parcel?
  point(s.intent.parcel.x,s.intent.parcel.z+.9):
  activity==='shelter'&&s.buildings.length?
  point(s.buildings[0].parcel.x,s.buildings[0].parcel.z+.7):
  point(s.camp.x+(f.id-2)*.65,s.camp.z+(f.id%2?.65:-.5));
}
function gather(s:PioneerWorld,f:PioneerFounder,kind:PioneerResourceSite['kind'],amount:number,activity:PioneerWork){
 const site=s.sites.find(x=>x.kind===kind)!;
 allocate(s,f,activity,site);
 const gathered=Math.min(site.stock,amount);
 site.stock=round(site.stock-gathered);site.totalGathered=round(site.totalGathered+gathered);
 if(kind==='forest')s.resources.wood=round(Math.min(32,s.resources.wood+gathered));
 else if(kind==='forage')s.resources.food=round(Math.min(30,s.resources.food+gathered));
 else s.resources.water=round(Math.min(30,s.resources.water+gathered));
 return gathered>0;
}
function work(s:PioneerWorld,f:PioneerFounder){
 if(!s.intent||!s.intent.parcel||s.intent.phase==='materials'||s.intent.phase==='survey')return false;
 allocate(s,f,'build');
 const weather=getPioneerWeather(s);const effort=weather==='rain'?.7:1;
 s.intent.workDone=round(Math.min(s.intent.workRequired,s.intent.workDone+effort));
 if(s.intent.workDone>=2&&s.intent.phase==='foundation'){
  s.intent.phase='frame';log(s,'梁架起身','地基稳住，木梁被真正搭起，遮雨棚渐渐有了轮廓。',s.intent.id);
 }
 return true;
}
function completeShelter(s:PioneerWorld){
 const intent=s.intent;if(!intent||!intent.parcel)return;
 const b:PioneerBuilding={id:'shelter-'+s.nextEventId,kind:'shelter',
  parcel:intent.parcel,completedAt:s.minutes,causeId:intent.id,
  occupants:s.founders.map(f=>f.id),materialsSpent:{wood:intent.woodCommitted},workHours:intent.workDone};
 s.buildings.push(b);s.intent=null;s.comfort=80;
 for(const f of s.founders){f.homeBuildingId=b.id;allocate(s,f,'shelter');}
 log(s,'第一间棚子落成','梁伯与陆娘搭起木梁，阿禾把吃食搬进新棚。三人终于有了避雨归处。',b.causeId);
}
/** One authoritative hourly settlement step. Work assignments are exclusive and
 * consume one person's hour; day/month fast-forward uses these same steps. */
function step(s:PioneerWorld){
 const weather=getPioneerWeather(s);
 if(s.minutes%DAY_MINUTES===0){
  const season=getPioneerCalendar(s).season;
  for(const site of s.sites){
   const factor=site.kind==='forage'&&season==='winter'?.38:1;
   site.stock=round(Math.min(site.capacity,site.stock+site.renewPerDay*factor));
  }
 }
 s.resources.food=round(Math.max(0,s.resources.food-s.founders.length/24));
 s.resources.water=round(Math.max(0,s.resources.water-s.founders.length/24));
 if(s.minutes%DAY_MINUTES===0&&(s.resources.food<1||s.resources.water<1))
  log(s,'营地储备告急','乡邻暂缺食物或饮水，先安排采集与取水，不会凭空获得补给。');
 requestShelter(s);
 const intent=s.intent;
 if(intent&&intent.phase==='survey'){
  intent.parcel=planPioneerShelter(s);
  if(intent.parcel){intent.phase='materials';intent.pauseReason='木料尚未备齐';
   log(s,'找到安全屋址','梁伯重新勘地，找到了不挡山路且远离溪岸的屋址。',intent.id);}
 }
 const building=intent&&intent.phase!=='survey'&&intent.phase!=='materials';
 const needWood=!!intent&&intent.phase==='materials'&&s.resources.wood<SHELTER_WOOD;
 const [liang,lu,he]=s.founders;
 if(needWood||(!building&&s.resources.wood<2))
  gather(s,liang,'forest',.94,'collect-wood');
 else if(building)work(s,liang);
 else allocate(s,liang,'tend-fire');
 const foodTarget=s.policy==='food'?18:s.policy==='shelter'?3.8:7.5;
 if(s.resources.food<foodTarget||!building){
  if(!gather(s,he,'forage',weather==='rain'?.62:.86,'forage'))allocate(s,he,'rest');
 }else if(building)work(s,he);
 else allocate(s,he,'rest');
 const waterTarget=s.policy==='food'?8:s.policy==='shelter'?1.8:3.3;
 if(s.resources.water<waterTarget||!building&&s.resources.water<6){
  gather(s,lu,'spring',1.3,'fetch-water');
 }else if(building)work(s,lu);
 else allocate(s,lu,'tend-fire');
 if(intent?.phase==='materials'){
  if(s.resources.wood>=SHELTER_WOOD&&s.resources.food>=.5&&s.resources.water>=.5){
   // Exactly one material debit, before any construction hours can be spent.
   s.resources.wood=round(s.resources.wood-SHELTER_WOOD);
   intent.woodCommitted=SHELTER_WOOD;intent.phase='foundation';intent.pauseReason=null;
   log(s,'备齐搭棚木料','林地采集的木料已运到工地，乡邻开始平整地基。',intent.id);
  }else intent.pauseReason=s.resources.wood<SHELTER_WOOD?'还缺 '+round(SHELTER_WOOD-s.resources.wood)+' 份木料':
   '食物或饮水不足，暂缓搭棚';
 }
 if(intent&&intent.workDone>=intent.workRequired)completeShelter(s);
 if(s.buildings.length) s.comfort=weather==='rain'?74:82;
 else s.comfort=weather==='rain'?18:32;
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
   !Array.isArray(s.founders)||s.founders.length!==3||
   !s.founders.every(f=>[1,2,3].includes(f.id)&&Number.isFinite(f.target?.[0])&&Number.isFinite(f.target?.[1]))||
   !s.resources||!['wood','food','water'].every(k=>Number.isFinite(s.resources[k as keyof typeof s.resources])&&s.resources[k as keyof typeof s.resources]>=0)||
   !Array.isArray(s.sites)||s.sites.length!==3||
   !s.sites.every(site=>Number.isFinite(site.stock)&&site.stock>=0&&Number.isFinite(site.capacity)&&site.capacity>=site.stock&&Number.isFinite(site.totalGathered))||
   !Array.isArray(s.buildings)||s.buildings.length>10||
   !Array.isArray(s.journal)||s.journal.length>160)return null;
  const ids=new Set<string>();
  const occupied=[...landscape(),campParcel(s)];
  for(const b of s.buildings){
   if(!b||b.kind!=='shelter'||typeof b.id!=='string'||ids.has(b.id)||!b.parcel||!b.materialsSpent||b.materialsSpent.wood!==SHELTER_WOOD||
    !Number.isFinite(b.parcel.x)||!Number.isFinite(b.parcel.z)||
    !validateVillageParcel(b.parcel,occupied,3.75).ok)return null;
   ids.add(b.id);occupied.push(b.parcel);
  }
  if(s.intent){
   if(!['survey','materials','foundation','frame'].includes(s.intent.phase)||
    !Number.isFinite(s.intent.woodCommitted)||!Number.isFinite(s.intent.workDone)||
    s.intent.woodCommitted<0||s.intent.woodCommitted>SHELTER_WOOD||
    s.intent.workDone<0||s.intent.workDone>SHELTER_WORK)return null;
   if(s.intent.parcel&&!validateVillageParcel(s.intent.parcel,occupied,3.75).ok)return null;
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
 if(s.buildings.length)return '棚屋已落成 · 乡邻有了遮雨归处';
 if(!s.intent)return '营火初起 · 乡邻正在商量如何落脚';
 if(s.intent.phase==='survey')return s.intent.pauseReason||'梁伯正在寻找安全屋址';
 if(s.intent.phase==='materials')return s.intent.pauseReason||'正在备木料';
 return s.intent.phase==='foundation'?'工地正在整地':'木梁搭起 · 正在封顶';
}
