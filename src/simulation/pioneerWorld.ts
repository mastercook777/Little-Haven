import {DAY_MINUTES,getCalendarFromMinutes,nextSeasonBoundary} from './calendar.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';
import {createLivingFates,pioneerCultivationMultiplier,settleLivingFatesHour,validateLivingFates,
 type LivingFatesState} from './livingFates/peopleState.ts';
import {activeSeedTrial,considerSeedTrial,dueSeedTrial,performSeedTrialShift,
 pioneerFieldLegacyMultiplier} from './livingFates/seedTrial.ts';
import {getWeatherForMinutes} from './weather.ts';
import {nearestRoad,validateVillageParcel,
 type VillageParcel} from './villagePlanning.ts';
import {findPioneerWalk,pioneerBuildingPath,pioneerEntrance,pioneerWalkable,roadSegmentsSafe,type WalkPoint,type PioneerRoad} from './pioneerPaths.ts';
import {validatePioneerParcel} from './pioneerParcelRules.ts';
import {PIONEER_BASE_NATURAL_ANCHORS,pioneerNaturalParcels,
 resolvePioneerNaturalAnchors,validatePioneerNaturalAnchors,
 type PioneerNaturalAnchor} from './pioneerNaturalAnchors.ts';
import {agePioneerBuildings,completePioneerProject,considerPioneerMigration,
 pioneerHasFacility,pioneerHousingCapacity,pioneerBuildingLabel,
 registerPioneerTrip,schedulePioneerProject} from './pioneerGrowth.ts';
import {createPioneerCommons,schedulePioneerCommons,reservePioneerCommonsMaterials,
 performPioneerCommonsWork,servePioneerMeal,validatePioneerCommons,
 type PioneerCommons} from './pioneerCommons.ts';
import {availablePioneerFields,pioneerFieldRenewMultiplier,pioneerHarvestMultiplier,
 pioneerWoodWorkingMultiplier,validatePioneerFacilityConfiguration} from './pioneerFacilities.ts';
import {advancePioneerCommerce,createPioneerCommerce,validPioneerCommerce,
 performPioneerGuestShift,
 type PioneerCommerce} from './pioneerCommerce.ts';
import {createPioneerLivelihood,createPioneerFishTransport,considerPioneerCraft,performPioneerCraftShift,
 pioneerFoodCapacity,pioneerCraftMultiplier,stagePioneerFish,deliverPioneerFish,
 markPioneerFishing,validPioneerLivelihood,
 type PioneerLivelihood} from './pioneerLivelihood.ts';
import {createPioneerFrontier,recordPioneerFelling,schedulePioneerClearing,
 performPioneerClearing,pioneerClearingReachable,validatePioneerFrontier,
 type PioneerFrontier} from './pioneerFrontier.ts';

export const PIONEER_VERSION=6;
export const PIONEER_SLOT_KEYS=['little-haven-pioneer-v06-slot-1','little-haven-pioneer-v06-slot-2'] as const;
export const PIONEER_ACTIVE_SLOT='little-haven-pioneer-v06-active-slot';
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
export type PioneerWork='rest'|'collect-wood'|'forage'|'fetch-water'|'build'|'tend-fire'|'shelter'|'farm'|'seed-trial'|'repair'|'cook'|'eat'|'eat-home'|'socialize'|'commons-build'|'clear-land'|'fish'|'haul-fish'|'craft'|'host-guest';
export type PioneerBuildKind='shelter'|'cottage'|'garden'|'wood-yard'|'fish-hut'|'granary'|'tea-stop';
export type PioneerPolicy='balanced'|'shelter'|'food';
export interface PioneerFounder{
 id:number;name:string;role:string;color:string;
 activity:PioneerWork;target:[number,number];homeBuildingId:string|null;
 commute?:WalkPoint[];pathRoadId?:string;
}
export interface PioneerResourceSite{
 id:string;kind:'forest'|'forage'|'spring'|'field'|'fish';x:number;z:number;
 stock:number;capacity:number;renewPerDay:number;totalGathered:number;
}
export interface PioneerJournal{
 id:number;minute:number;title:string;text:string;causeId:string|null;
}
export interface PioneerIntent{
 id:string;reason:string;createdAt:number;requestedBy:number[];
 kind?:PioneerBuildKind|'repair'|'loft';targetBuildingId?:string;path?:WalkPoint[];
 parcel:VillageParcel|null;phase:'survey'|'materials'|'foundation'|'frame';
 woodRequired:number;woodCommitted:number;workDone:number;workRequired:number;
 pauseReason:string|null;
}
export interface PioneerBuilding{
 id:string;kind:PioneerBuildKind;parcel:VillageParcel;completedAt:number;
 causeId:string;occupants:number[];materialsSpent:{wood:number};workHours:number;
 condition?:number;lastRepairAt?:number;
  loftAddedAt?:number;loftWoodSpent?:number;loftWorkHours?:number;loftCauseId?:string;
 operating?:boolean;productionMode?:'harvest'|'seed'|'timber'|'repair';
}
export interface PioneerWorld{
 schemaVersion:6;mode:'pioneer';seed:number;minutes:number;lastSavedAt:number;
 /** Persist once on legacy import; planting must not jump beneath buildings. */
 naturalAnchors?:PioneerNaturalAnchor[];
 camp:{x:number;z:number};founders:PioneerFounder[];
 resources:{wood:number;food:number;water:number};
 sites:PioneerResourceSite[];intent:PioneerIntent|null;buildings:PioneerBuilding[];
 journal:PioneerJournal[];nextEventId:number;policy:PioneerPolicy;comfort:number;
 roads:PioneerRoad[];nextResidentId:number;nextSurveyAt:number;lastArrivalAt:number;
 commons:PioneerCommons;frontier:PioneerFrontier;livingFates:LivingFatesState;
 livelihood:PioneerLivelihood;commerce:PioneerCommerce;
 foodStats?:{day:number;collected:number;consumed:number;previousCollected:number;previousConsumed:number};
}
const landscape=(s?:PioneerWorld)=>pioneerNaturalParcels(s);
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
 appendPioneerJournal(s,title,text,causeId);
}
function resourceSites(seed:number,camp:{x:number;z:number}):PioneerResourceSite[]{
 const jitter=(n:number)=>(hash(seed+n)-.5)*1.05;
 const sites:PioneerResourceSite[]=[
  {id:'forest-west',kind:'forest',x:round(-11.2+jitter(1)),z:round(-5.7+jitter(2)),
   stock:20,capacity:24,renewPerDay:1.15,totalGathered:0},
  {id:'forage-north',kind:'forage',x:round(-8.5+jitter(3)),z:round(4.9+jitter(4)),
   stock:17,capacity:19,renewPerDay:4.4,totalGathered:0},
  {id:'spring-east',kind:'spring',x:round(4.1+jitter(5)),z:round(-3.0+jitter(6)),
   stock:30,capacity:30,renewPerDay:12,totalGathered:0}
 ];
 // A visible resource is only real when a resident can reach it. Older
 // prototypes accidentally put the forage node *inside* a protected grove.
 const obstacles=landscape(),start:WalkPoint=[camp.x,camp.z];
 for(const site of sites){
  const center={x:site.x,z:site.z};
  const options:{x:number;z:number;score:number}[]=[];
  for(let dx=-5;dx<=5;dx++)for(let dz=-5;dz<=5;dz++){
   const x=round(center.x+dx*.50),z=round(center.z+dz*.50);
   if(!pioneerWalkable([x,z],obstacles))continue;
   options.push({x,z,score:Math.hypot(dx,dz)+hash(seed+dx*13+dz*29)*.10});
  }
  options.sort((a,b)=>a.score-b.score);
  const legal=options.find(o=>findPioneerWalk(start,[o.x,o.z],obstacles));
  if(!legal)throw new Error('No reachable '+site.kind+' source in this valley');
  site.x=legal.x;site.z=legal.z;
 }
 return sites;
}
export function createPioneerWorld(seed=20261103,now=Date.now()):PioneerWorld{
 const camp=choosePioneerCamp(seed);
 const founders:PioneerFounder[]=[
   {id:1,name:'梁伯',role:'行山人 · 樵夫',color:'#53776c',activity:'rest',
    target:point(camp.x-.8,camp.z-.3),homeBuildingId:null},
   {id:2,name:'陆娘',role:'营地掌事者',color:'#bd8069',activity:'tend-fire',
    target:point(camp.x+.6,camp.z-.5),homeBuildingId:null},
   {id:3,name:'阿禾',role:'山野采集者',color:'#8a9b64',activity:'rest',
    target:point(camp.x,camp.z+.9),homeBuildingId:null}
  ];
 const s:PioneerWorld={
  schemaVersion:6,mode:'pioneer',seed,minutes:8*60+20,lastSavedAt:now,camp,
  founders,naturalAnchors:PIONEER_BASE_NATURAL_ANCHORS.map(a=>({...a})),
  resources:{wood:1,food:5,water:5},sites:resourceSites(seed,camp),
  intent:null,buildings:[],journal:[],nextEventId:1,policy:'balanced',comfort:32,
  roads:[],nextResidentId:4,nextSurveyAt:0,lastArrivalAt:0,commons:createPioneerCommons(),
  frontier:createPioneerFrontier(),livingFates:createLivingFates(seed,founders,8*60+20),
   livelihood:createPioneerLivelihood(),commerce:createPioneerCommerce(),
  foodStats:{day:0,collected:0,consumed:0,previousCollected:0,previousConsumed:0}
 };
 log(s,'荒谷点火','梁伯、陆娘和阿禾在安全的林缘安下临时营火。眼前尚无永久屋舍。');
 return s;
}
export function getPioneerCalendar(s:PioneerWorld){return getCalendarFromMinutes(s.minutes);}
export function getPioneerWeather(s:PioneerWorld){return getWeatherForMinutes(s.minutes,s.seed);}
function campParcel(s:PioneerWorld){return parcel('temporary-camp',s.camp.x,s.camp.z,1.25,1.25);}
export function validatePioneerSite(s:PioneerWorld,p:VillageParcel){
 return validatePioneerParcel(p,[...landscape(s),campParcel(s),...s.buildings.map(b=>b.parcel)],s.roads);
}
export function planPioneerShelter(s:PioneerWorld):VillageParcel|null{
 const occupied=[...landscape(s),campParcel(s),...s.buildings.map(b=>b.parcel)];
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
 const walk=location?pioneerBuildingPath(s.camp,location,[...landscape(s),...s.buildings.map(b=>b.parcel)]):null;
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
 const fieldBuilding=site?.kind==='field'?
  s.buildings.find(b=>site.id==='field-'+b.id):undefined;
 const shelter=activity==='shelter'||activity==='eat-home'?home:undefined;
 const atCommons=['eat','cook','socialize','commons-build'].includes(activity);
 const workClearing=activity==='clear-land'?
  s.frontier.clearings.find(c=>c.phase==='clearing'):undefined;
 const targetBuilding=activity==='craft'?s.buildings.find(b=>b.kind==='wood-yard'):
  activity==='haul-fish'?s.buildings.find(b=>b.kind==='granary'):
  activity==='host-guest'?s.buildings.find(b=>b.kind==='tea-stop'):
  activity==='build'||activity==='repair'?
  s.buildings.find(b=>b.id===task?.targetBuildingId):shelter;
 const jobRoute=(activity==='build'||activity==='repair')?
  task?.path&&task.path.length?task.path:
  s.roads.find(r=>r.buildingId===targetBuilding?.id)?.points:undefined;
 const builtRoad=s.roads.find(r=>r.buildingId===(targetBuilding??fieldBuilding)?.id);
 let goal:WalkPoint=workClearing?[workClearing.x,workClearing.z]:atCommons?
  [round(s.camp.x+(f.id%3-1)*.38),round(s.camp.z+(f.id%4-1.5)*.30)]:
  fieldBuilding?[
   round(pioneerEntrance(fieldBuilding.parcel)[0]+
    Math.cos(fieldBuilding.parcel.rotation)*(f.id%3-1)*.34),
   round(pioneerEntrance(fieldBuilding.parcel)[1]+
    Math.sin(fieldBuilding.parcel.rotation)*(f.id%3-1)*.34)
  ]:site?[site.x,site.z]:
  (activity==='build'||activity==='repair')&&task?.parcel?pioneerEntrance(task.parcel):
  (activity==='craft'||activity==='host-guest')&&targetBuilding?pioneerEntrance(targetBuilding.parcel):
  shelter?pioneerEntrance(shelter.parcel):
  [s.camp.x+(f.id%4-1.5)*.43,s.camp.z+(f.id%3-1)*.38];
 if(activity==='haul-fish')goal=targetBuilding?pioneerEntrance(targetBuilding.parcel):
  [s.camp.x,s.camp.z];
 const isSame=f.activity===activity&&f.target[0]===goal[0]&&f.target[1]===goal[1];
 if(isSame&&f.commute?.length)return;
 const from:WalkPoint=activity==='haul-fish'&&site?
  [site.x,site.z]:home?pioneerEntrance(home.parcel):[s.camp.x,s.camp.z];
 const obstacles=[...landscape(s),...s.buildings.map(b=>b.parcel)].filter(p=>
  p.id!==home?.parcel.id&&p.id!==task?.parcel?.id&&
  p.id!==shelter?.parcel.id&&p.id!==fieldBuilding?.parcel.id&&
  // Permit the exact workplace entrance, while retaining every unrelated
  // building, protected forest and river as a blocking obstacle.
  p.id!==((activity==='haul-fish'||activity==='host-guest'||activity==='craft')?
   targetBuilding?.parcel.id:undefined));
 let commute:WalkPoint[]|null;
 if(home&&shelter?.id===home.id)commute=[from,goal];
 else if(!home&&jobRoute?.length)commute=jobRoute.map(p=>[p[0],p[1]]);
 else commute=findPioneerWalk(from,goal,obstacles);
 // A house-to-workplace trip may use two *registered and still unobstructed*
 // radial roads through the commons, even where the coarse A* grid cannot
 // join their narrow lanes. Never teleport: every .22m is revalidated against
 // the current natural/building obstacles before awarding the work shift.
 if(!commute&&home&&builtRoad){
  const homeRoad=s.roads.find(r=>r.buildingId===home.id);
  if(homeRoad?.points.length&&builtRoad.points.length){
   const viaCommons:WalkPoint[]=[
    ...homeRoad.points.slice().reverse(),...builtRoad.points.slice(1)
   ];
   if(roadSegmentsSafe(viaCommons,obstacles))commute=viaCommons;
  }
 }
 if(!commute&&fieldBuilding){
  // Keep the original navigable entrance when a side work slot is blocked.
  goal=pioneerEntrance(fieldBuilding.parcel);
  commute=findPioneerWalk(from,goal,obstacles);
 }
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
function gather(s:PioneerWorld,f:PioneerFounder,
 kind:PioneerResourceSite['kind'],amount:number,activity:PioneerWork,
 preferred?:PioneerResourceSite){
 if(kind==='fish'&&s.livelihood.fishTransport.pending)return false;
 const choices=(preferred?[preferred]:kind==='field'?availablePioneerFields(s):
  s.sites.filter(site=>site.kind===kind&&site.stock>.001))
  .slice().sort((a,b)=>b.stock-a.stock||a.id.localeCompare(b.id));
 const cap=kind==='forest'?48:kind==='field'||kind==='fish'||kind==='forage'?
  pioneerFoodCapacity(s):36;
 const held=kind==='forest'?s.resources.wood:kind==='spring'?s.resources.water:s.resources.food;
 for(const site of choices){
  if(held>=cap)return false;
  allocate(s,f,activity,site);
  if(f.activity==='rest')continue;
  const efficiency=kind==='field'?pioneerHarvestMultiplier(s,site)*pioneerCultivationMultiplier(s,f.id)*
   pioneerFieldLegacyMultiplier(s,site.id):
   kind==='forest'?pioneerWoodWorkingMultiplier(s)*pioneerCraftMultiplier(s):1;
  const gathered=Math.max(0,Math.min(site.stock,amount*efficiency,cap-held));
  if(!gathered){allocate(s,f,'rest');continue;}
  registerPioneerTrip(s,f.pathRoadId);
  const oldCollected=site.totalGathered;
  site.stock=round(site.stock-gathered);site.totalGathered=round(site.totalGathered+gathered);
  if(kind==='forest'){
   s.resources.wood=round(s.resources.wood+gathered);
   recordPioneerFelling(s,site,f,oldCollected);
  }
  else if(kind==='spring')s.resources.water=round(s.resources.water+gathered);
  else if(kind==='fish'){
   stagePioneerFish(s,f,site.id,gathered);
   markPioneerFishing(s,f,gathered);
  }else{
   s.resources.food=round(s.resources.food+gathered);
   if(s.foodStats)s.foodStats.collected=round(s.foodStats.collected+gathered);
  }
  return true;
 }
 return false;
}
function work(s:PioneerWorld,f:PioneerFounder){
 if(!s.intent||!s.intent.parcel||s.intent.phase==='materials'||s.intent.phase==='survey')return false;
 allocate(s,f,s.intent.kind==='repair'?'repair':'build');
 if(f.activity==='rest')return false;
 registerPioneerTrip(s,f.pathRoadId);
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
 // Commit the previous season's fate before any new seasonal field renewal.
 dueSeedTrial(s);
 const weather=getPioneerWeather(s);
 agePioneerBuildings(s);
 if(s.minutes%DAY_MINUTES===0){
  const season=getPioneerCalendar(s).season;
  for(const site of s.sites){
   const factor=(site.kind==='forage'||site.kind==='field')&&season==='winter'?.38:1;
   const renewal=site.kind==='field'?pioneerFieldRenewMultiplier(s,site):
    site.kind==='fish'?(season==='winter'?.34:season==='spring'?1.18:1):1;
   site.stock=round(Math.min(site.capacity,site.stock+site.renewPerDay*factor*renewal));
  }
 }
 const day=Math.floor(s.minutes/DAY_MINUTES);
 s.foodStats??={day,collected:0,consumed:0,previousCollected:0,previousConsumed:0};
 if(day!==s.foodStats.day){
  s.foodStats.previousCollected=s.foodStats.collected;
  s.foodStats.previousConsumed=s.foodStats.consumed;
  s.foodStats.collected=0;s.foodStats.consumed=0;s.foodStats.day=day;
 }
 // The food previously disappeared in 24 invisible hourly instalments.
 // Now consumption happens at three observable meals (7h / 12h / 18h).
 // See servePioneerMeal below for the single inventory transaction.
 // Ration demand remains 1 food per resident per day.
 const hour=Math.floor(s.minutes%DAY_MINUTES/60);
 advancePioneerCommerce(s);
 s.resources.water=round(Math.max(0,s.resources.water-s.founders.length/24));
 if(s.minutes%DAY_MINUTES===0&&(s.resources.food<1||s.resources.water<1))
  log(s,'储备告急','乡邻缺少粮水，暂缓非必要劳动，改去水源或有余量的林地采集。');
 requestShelter(s);schedulePioneerProject(s);considerPioneerMigration(s);
 if(hour===8)considerPioneerCraft(s);
 schedulePioneerCommons(s);reservePioneerCommonsMaterials(s);
 schedulePioneerClearing(s);
 const intent=s.intent;
 if(intent&&intent.phase==='survey'){
  intent.parcel=planPioneerShelter(s);
  if(intent.parcel){
   intent.path=pioneerBuildingPath(s.camp,intent.parcel,
    [...landscape(s),...s.buildings.map(b=>b.parcel)])??undefined;
   intent.phase='materials';intent.pauseReason='木料尚未备齐';
   log(s,'找到安全屋址','梁伯重新勘地，找到了不挡河岸、林地与山路的合法屋址。',intent.id);
  }
 }
 // Night and meals are real scheduled activities, not repeated idle labels.
 // One resident can only occupy one destination in each hourly step.
 if(hour<7||hour>=20){
  for(const f of s.founders)allocate(s,f,f.homeBuildingId?'shelter':'rest');
  s.comfort=s.buildings.length?weather==='rain'?74:82:weather==='rain'?18:32;
  return;
 }
 if(hour===7||hour===12||hour===18){
  const served=servePioneerMeal(s);
  if(served>=s.founders.length/6){
   const seats=[3,4,6,8][s.commons.stage];
   for(let i=0;i<s.founders.length;i++){
    const f=s.founders[i];
    const activity:PioneerWork=s.commons.stage>=1&&i===1?'cook':
     i<seats?'eat':'eat-home';
    allocate(s,f,activity);
    if(activity==='cook'&&f.activity==='cook')
     s.commons.cookingHours=round(s.commons.cookingHours+1);
   }
   return;
  }
  // With almost empty cupboards there is no fake feast. A normal daylight
  // emergency gathering shift runs below instead.
 }
 if(hour===19&&s.commons.stage>=1&&
  s.resources.food>=s.founders.length*.45&&
  s.resources.water>=s.founders.length*.30){
  const seats=[0,3,5,7][s.commons.stage];
  const attending=s.founders.slice(0,seats);
  for(const f of attending){
   allocate(s,f,'socialize');
   if(f.activity==='socialize')s.commons.socialHours++;
  }
  for(const f of s.founders.slice(seats))
   allocate(s,f,f.homeBuildingId?'shelter':'rest');
  if(day%9===2&&attending.length>=2){
   log(s,'火塘边的闲话',
    attending.slice(0,3).map(f=>f.name).join('与')+
    '在'+['营火','火塘','灶棚','村心'][s.commons.stage]+'歇脚，聊起田里收成和屋舍修葺。',
    'pioneer-commons');
  }
  return;
 }
 const building=!!intent&&intent.phase!=='survey'&&intent.phase!=='materials';
 const needWood=!!intent&&intent.phase==='materials'&&s.resources.wood<intent.woodRequired;
 const [liang,lu,he]=s.founders;
 const crisis=s.resources.food<Math.max(1.35,s.founders.length*.48);
 // When several farmers live here, one daily SAME-FIELD shift lets them
 // actually tend crops together. Both consume this hour and each deposits only
 // the harvest gathered from an existing stocked, reachable field. It is not
 // a passive relationship bonus generated by standing in a crowd.
 const livelihoodWorkers=new Set<number>();
 // The river batch is physically carried on a second scheduled hour. If the
 // grain store is full or no A* path exists, the batch stays by the fish hut.
 const waiting=s.livelihood.fishTransport.pending;
 if(waiting&&(hour===9||hour===17)&&
  s.resources.food+waiting.amount<=pioneerFoodCapacity(s)+.0001){
  const porter=s.founders.find(f=>f.id===waiting.workerId);
  const reach=s.sites.find(x=>x.id===waiting.siteId);
  if(porter&&reach){
   allocate(s,porter,'haul-fish',reach);
   if(porter.activity==='haul-fish'&&deliverPioneerFish(s,porter))
    livelihoodWorkers.add(porter.id);
  }
 }
 const coFarmWorkers=new Set<number>();
 if(hour===9&&s.founders.length>=4){
  const field=availablePioneerFields(s).find(site=>site.stock>=1.8);
  const eligible=s.founders.filter(f=>!livelihoodWorkers.has(f.id)&&
   (f.id===3||/农|园|采集/.test(f.role)))
   .sort((a,b)=>a.id-b.id).slice(0,2);
  if(field&&eligible.length===2){
   for(const resident of eligible){
    if(gather(s,resident,'field',.74,'farm',field))
     coFarmWorkers.add(resident.id);
   }
  }
 }
 // Real fishing means a resident works at the reached bank, using one
 // exclusive hour. Fishing stock is seasonal and never minted by the model.
 if(hour===8||hour===11||hour===16){
  const reach=s.sites.find(x=>x.kind==='fish'&&x.stock>.08);
  const fisher=s.founders.find(f=>f.id===6)??s.founders.find(f=>f.id===3);
  // Fishers try a genuine morning shift before the usual farmers replenish
  // every basket; if the store is full they cannot mint surplus food.
  const freeSpace=pioneerFoodCapacity(s)-s.resources.food;
  if(reach&&fisher&&!livelihoodWorkers.has(fisher.id)&&
   !s.livelihood.fishTransport.pending&&freeSpace>=.55&&
   gather(s,fisher,'fish',weather==='rain'?.58:1.05,'fish',reach))
   livelihoodWorkers.add(fisher.id);
 }
 // The woodshop bench is a real paid job, not an instantaneous policy buff.
 if(hour===16&&s.livelihood.craft.phase==='building'){
  const artisan=s.founders.find(f=>f.id===5)??s.founders[0];
  if(!livelihoodWorkers.has(artisan.id)&&!crisis&&s.resources.food>s.founders.length*.72){
   allocate(s,artisan,'craft');
   if(artisan.activity==='craft'&&performPioneerCraftShift(s,artisan))
    livelihoodWorkers.add(artisan.id);
  }
 }
 // A guest trade is never a noon freebie: one real resident spends a
 // reachable, exclusive afternoon hour at the tea stop, forgoing other work.
 const guestWorkers=new Set<number>();
 const visitor=s.commerce.activeVisitor;
 // A resident may exchange stocked timber for food *during* a food crisis.
 // Skipping tea duty merely because grain is low traps the settlement: no
 // host shift, no lawful exchange, and the visitor leaves without helping.
 // Inventory limits inside transact() still prohibit free food or gifts.
 if(hour===13&&visitor?.outcome==='pending'&&
  s.commerce.guestPolicy!=='quiet'&&s.minutes>=visitor.arrivalAt+3*60){
  for(const resident of [...s.founders.slice(3),...s.founders.slice(0,3)]){
   allocate(s,resident,'host-guest');
   if(resident.activity!=='host-guest')continue;
   if(performPioneerGuestShift(s,resident.id))guestWorkers.add(resident.id);
   break;
  }
 }
 const seedWorkers=new Set<number>();
 if(hour===10&&!crisis){
  considerSeedTrial(s);
  const trial=activeSeedTrial(s);
  const site=trial?s.sites.find(site=>site.id==='field-'+trial.gardenId):undefined;
  if(site){
   for(const id of trial!.actorIds){
    const resident=s.founders.find(x=>x.id===id);
    if(!resident)continue;
    allocate(s,resident,'seed-trial',site);
    if(resident.activity==='seed-trial'&&performSeedTrialShift(s,resident,site))
     seedWorkers.add(id);
   }
  }
 }
 const foodTask=(f:PioneerFounder,amount:number)=>{
  const field=availablePioneerFields(s);
  if(field.length&&gather(s,f,'field',amount, 'farm'))return true;
  return gather(s,f,'forage',amount,'forage');
 };
 if(guestWorkers.has(liang.id)||seedWorkers.has(liang.id)||coFarmWorkers.has(liang.id)||livelihoodWorkers.has(liang.id)){
  // This resident spent the hour at the trial plot instead of collecting.
 }else if(crisis&&!needWood){
  if(!foodTask(liang,.86))allocate(s,liang,'rest');
 }else if(needWood||!building&&s.resources.wood<16){
  if(!gather(s,liang,'forest',.94,'collect-wood'))allocate(s,liang,'rest');
 }else if(building)work(s,liang);
 else allocate(s,liang,'tend-fire');
 const foodTarget=Math.max(s.founders.length*2.65,
  s.policy==='food'?18:s.policy==='shelter'?5.5:9.5);
 if(guestWorkers.has(he.id)||seedWorkers.has(he.id)||coFarmWorkers.has(he.id)||livelihoodWorkers.has(he.id)){
  // Trial work replaces the ordinary farm shift.
 }else if(s.resources.food<foodTarget||!building||crisis){
  if(!foodTask(he,weather==='rain'?.63:.94))allocate(s,he,'rest');
 }else if(building)work(s,he);
 else allocate(s,he,'shelter');
 const waterTarget=s.policy==='food'?8:s.policy==='shelter'?2.8:4.3;
 const clearing=s.frontier.clearings.find(c=>c.phase==='clearing');
 const clearingShift=!!clearing&&hour===14&&!crisis&&
  s.resources.food>=Math.max(3,s.founders.length*1.1)&&
  s.resources.water>=Math.max(waterTarget,s.founders.length*.65)&&
  !needWood;
 const commonsShift=hour===15&&s.commons.project?.phase==='building'&&
  !crisis&&s.resources.food>=s.founders.length*.72&&
  s.resources.water>=Math.max(waterTarget,s.founders.length*.55);
 if(guestWorkers.has(lu.id)||seedWorkers.has(lu.id)||coFarmWorkers.has(lu.id)||livelihoodWorkers.has(lu.id)){
  // Seed trial work is exclusive of fetching water or clearing land.
 }else if(clearingShift&&clearing){
  // Clearing consumes Lu's assigned hour instead of crediting two jobs.
  // The corresponding site must actually remain reachable that day.
  if(pioneerClearingReachable(s,clearing)){
   allocate(s,lu,'clear-land');
   if(lu.activity==='clear-land')performPioneerClearing(s,clearing,weather==='rain'?.65:1);
  }else allocate(s,lu,'rest');
 }else if(commonsShift){
  // Reserve this actual hour BEFORE Lu would fetch resources or build a
  // cottage. No person can receive two work credits in the same hour.
  allocate(s,lu,'commons-build');
  if(lu.activity==='commons-build')
   performPioneerCommonsWork(s,weather==='rain'?.7:1);
 }else if(s.resources.water<waterTarget||!building&&s.resources.water<6){
  if(!gather(s,lu,'spring',1.36,'fetch-water'))allocate(s,lu,'rest');
 }else if(crisis){
  if(!foodTask(lu,.72))allocate(s,lu,'rest');
 }else if(building)work(s,lu);
 else allocate(s,lu,'tend-fire');
 for(const f of s.founders.slice(3)){
  if(seedWorkers.has(f.id)||coFarmWorkers.has(f.id)||livelihoodWorkers.has(f.id)||
   guestWorkers.has(f.id))continue;
  if(s.resources.food<foodTarget||crisis){
   if(!foodTask(f,.86))allocate(s,f,'rest');
  }else if(s.resources.water<s.founders.length*1.2){
   if(!gather(s,f,'spring',1.25,'fetch-water'))allocate(s,f,'rest');
  }else if(building&&s.resources.food>3)work(s,f);
  else if(s.resources.wood<Math.max(11,intent?.woodRequired??11)){
   if(!gather(s,f,'forest',.85,'collect-wood'))
    allocate(s,f,'rest');
  }else allocate(s,f,'shelter');
 }
 if(intent?.phase==='materials'){
  if(s.resources.wood>=intent.woodRequired&&s.resources.food>=Math.min(2,s.founders.length*.5)&&s.resources.water>=.5){
   s.resources.wood=round(s.resources.wood-intent.woodRequired);
   intent.woodCommitted=intent.woodRequired;intent.phase='foundation';intent.pauseReason=null;
   log(s,'工材送达','乡邻从有限林地采集的 '+intent.woodRequired+
    ' 份木料已经扣库送至工地，开始真实施工。',intent.id);
  }else intent.pauseReason=s.resources.wood<intent.woodRequired?
   '还缺 '+round(intent.woodRequired-s.resources.wood)+' 份木料':'粮水告急，先保全居民口粮';
 }
 if(intent&&intent.workDone>=intent.workRequired)completePioneerProject(s);
 s.comfort=s.buildings.length?weather==='rain'?74:82:weather==='rain'?18:32;
}
export function advancePioneerWorld(s:PioneerWorld,realSeconds:number){
 if(!Number.isFinite(realSeconds)||realSeconds<0)throw new RangeError('Invalid advance');
 const from=Math.floor(s.minutes/HOUR),target=s.minutes+realSeconds*PIONEER_MINUTES_PER_SECOND;
 const to=Math.floor(target/HOUR);
 for(let i=from+1;i<=to;i++){s.minutes=i*HOUR;step(s);settleLivingFatesHour(s);}
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
  if(s?.schemaVersion!==6||s.mode!=='pioneer'||!Number.isFinite(s.seed)||
   !Number.isFinite(s.minutes)||s.minutes<0||!Number.isFinite(s.lastSavedAt)||
   !Number.isInteger(s.nextEventId)||s.nextEventId<1||
   !['balanced','shelter','food'].includes(s.policy)||
   !s.camp||!Number.isFinite(s.camp.x)||!Number.isFinite(s.camp.z)||
   !Array.isArray(s.founders)||s.founders.length<3||s.founders.length>12||
   !s.founders.every(f=>Number.isInteger(f.id)&&f.id>=1&&Number.isFinite(f.target?.[0])&&Number.isFinite(f.target?.[1]))||
   new Set(s.founders.map(f=>f.id)).size!==s.founders.length||
   !s.resources||!['wood','food','water'].every(k=>Number.isFinite(s.resources[k as keyof typeof s.resources])&&s.resources[k as keyof typeof s.resources]>=0)||
   !Array.isArray(s.sites)||s.sites.length<3||s.sites.length>20||
   !s.sites.every(site=>Number.isFinite(site.stock)&&site.stock>=0&&Number.isFinite(site.capacity)&&site.capacity>=site.stock&&Number.isFinite(site.totalGathered))||
   !Array.isArray(s.buildings)||s.buildings.length>20||
   !Array.isArray(s.journal)||s.journal.length>160)return null;
  if(s.foodStats){
   const fs=s.foodStats;
   if(!['day','collected','consumed','previousCollected','previousConsumed']
    .every(k=>Number.isFinite(fs[k as keyof typeof fs])&&fs[k as keyof typeof fs]>=0))return null;
  }
  s.foodStats??={day:Math.floor(s.minutes/DAY_MINUTES),collected:0,consumed:0,
   previousCollected:0,previousConsumed:0};
  // Import old v0.4.1 slots as a stage-0 commons: their original camp is
  // gradually upgraded through actual material/work, never auto-converted.
  s.commons??=createPioneerCommons();
  if(!validatePioneerCommons(s.commons))return null;
  // Legacy v0.4.1/v0.4.2 saves have none of these forestry fields.
  // Never retroactively grant clearing hours, timber or fallen trees.
  // Legacy v4: preserve every real building, road and construction intent;
  // choose alternate *tree* sites once and persist their legal positions.
  s.roads??=[];
  if(s.naturalAnchors===undefined)
   s.naturalAnchors=resolvePioneerNaturalAnchors(
    [...s.buildings.map(b=>b.parcel),...(s.intent?.parcel?[s.intent.parcel]:[])],
    s.roads);
  if(!validatePioneerNaturalAnchors(s.naturalAnchors,
   [...s.buildings.map(b=>b.parcel),...(s.intent?.parcel?[s.intent.parcel]:[])],
   s.roads))return null;
  s.frontier??=createPioneerFrontier();
  if(!validatePioneerFrontier(s.frontier,s))return null;
  s.roads??=[];s.nextResidentId??=Math.max(...s.founders.map(f=>f.id))+1;
  s.nextSurveyAt??=0;s.lastArrivalAt??=0;
  // Old slots get only present-day profiles; do not invent historical memories.
  if(s.livingFates===undefined)
   s.livingFates=createLivingFates(s.seed,s.founders,s.minutes,true);
  // A/B saves predate the first fate arc. Migrate all four new collections
  // together; partial corrupt data must not be mistaken for an old save.
  const life=s.livingFates as LivingFatesState;
  if(life&&life.farmCoWorkHours===undefined&&life.seedTrials===undefined&&
   life.fieldLegacies===undefined&&life.appliedEffectIds===undefined){
   life.farmCoWorkHours={};life.seedTrials=[];
   life.fieldLegacies=[];life.appliedEffectIds=[];
  }
  if(!validateLivingFates(s))return null;
   s.livelihood??=createPioneerLivelihood();
   // Earlier saves already granted caught fish instantly; do not recredit it.
   s.livelihood.fishTransport??=createPioneerFishTransport();
   if(!validPioneerLivelihood(s))return null;
   s.commerce??=createPioneerCommerce();
   // Old v0.5.1 slots lack any evidence of a specific receptionist. Migrate
   // to zero recorded hosting hours, never fabricate a historical tie.
   if(s.commerce.contacts===undefined&&s.commerce.receptionHours===undefined){
    s.commerce.contacts=[];s.commerce.receptionHours=0;
   }
   if(!validPioneerCommerce(s))return null;
  if(!Array.isArray(s.roads)||s.roads.length>20||
   !Number.isInteger(s.nextResidentId)||s.nextResidentId<4||
   !Number.isFinite(s.nextSurveyAt)||!Number.isFinite(s.lastArrivalAt))return null;
  const ids=new Set<string>();
  const occupied=[...landscape(s),campParcel(s)];
  for(const b of s.buildings){
   if(!b||!['shelter','garden','cottage','wood-yard','fish-hut','granary','tea-stop'].includes(b.kind)||!validatePioneerFacilityConfiguration(b)||
    (b.loftAddedAt!==undefined&&(b.kind!=='cottage'||!Number.isFinite(b.loftAddedAt)||
      b.loftAddedAt<b.completedAt||b.loftAddedAt>s.minutes||
      b.loftWoodSpent!==4||typeof b.loftCauseId!=='string'||
      !b.loftCauseId.startsWith('pioneer-loft-')||typeof b.loftWorkHours!=='number'||
      !Number.isFinite(b.loftWorkHours)||b.loftWorkHours<8||
      b.loftWorkHours>8.001))||
    (b.loftAddedAt===undefined&&(b.loftWoodSpent!==undefined||b.loftWorkHours!==undefined||b.loftCauseId!==undefined))||
    (b.kind==='cottage'&&b.occupants.length>(b.loftAddedAt!==undefined?3:2))||typeof b.id!=='string'||ids.has(b.id)||!b.parcel||!b.materialsSpent||
    !(b.materialsSpent.wood>=0)||b.materialsSpent.wood>20||
    !Number.isFinite(b.parcel.x)||!Number.isFinite(b.parcel.z)||
    !validatePioneerParcel(b.parcel,occupied,s.roads.filter(road=>road.buildingId!==b.id)).ok)return null;
   ids.add(b.id);occupied.push(b.parcel);
  }
  if(s.intent){
   if(s.intent.kind==='loft'&&(
    s.intent.woodRequired!==4||s.intent.workRequired!==8||
    ![0,4].includes(s.intent.woodCommitted)||
    (s.intent.phase==='materials'&&s.intent.woodCommitted!==0)||
    (['foundation','frame'].includes(s.intent.phase)&&s.intent.woodCommitted!==4)||
    !s.buildings.some(b=>b.kind==='cottage'&&
     b.id===s.intent?.targetBuildingId&&b.loftAddedAt===undefined&&
     b.parcel.id===s.intent?.parcel?.id)))return null;
   if(!['survey','materials','foundation','frame'].includes(s.intent.phase)||
    !Number.isFinite(s.intent.woodCommitted)||!Number.isFinite(s.intent.workDone)||
    s.intent.woodCommitted<0||s.intent.woodCommitted>20||
    s.intent.workDone<0||s.intent.workDone>30)return null;
   if(s.intent.parcel&&s.intent.kind!=='repair'&&s.intent.kind!=='loft'&&
    !validatePioneerParcel(s.intent.parcel,occupied,s.roads).ok)return null;
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
  const label=project.kind==='repair'?'修缮旧屋':project.kind==='loft'?'山居木阁改造':pioneerBuildingLabel(project.kind??'shelter');
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
