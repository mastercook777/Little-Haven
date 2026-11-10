import {DAY_MINUTES} from './calendar.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';
import {onPioneerTeaStopBuilt} from './pioneerCommerce.ts';
import {distanceToCreekSpline} from './creekCorridor.ts';
import {makePioneerCandidate,welcomePioneerCandidate} from './livingFates/peopleState.ts';
import {nearestRoad,type VillageParcel} from './villagePlanning.ts';
import {pioneerNaturalParcels} from './pioneerNaturalAnchors.ts';
import {validatePioneerParcel} from './pioneerParcelRules.ts';
import {pioneerBuildingPath,pioneerEntrance,findPioneerWalk,type WalkPoint,type PioneerRoad} from './pioneerPaths.ts';
import type {PioneerWorld,PioneerBuilding,PioneerIntent,PioneerFounder,
 PioneerResourceSite,PioneerBuildKind} from './pioneerWorld.ts';
import {pioneerRepairPriority} from './pioneerFacilities.ts';
import {pioneerV6LotFor,PIONEER_V6_LOTS} from './homesteadPlan.ts';
import {pioneerParcelOpened,requestPioneerExpansionClearing} from './pioneerFrontier.ts';

const round=(n:number)=>Math.round(n*1000)/1000;
const hash=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return ((k^(k>>>16))>>>0)/4294967296;
};
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const natural=(s:PioneerWorld)=>pioneerNaturalParcels(s);
const spec:Record<Exclude<PioneerBuildKind,'shelter'>,{wood:number;hours:number;width:number;depth:number;why:string;label:string}>={
 garden:{wood:3,hours:6,width:2.75,depth:2.65,
  why:'野果时有时无，乡邻想亲手开垦一处稳定的菜畦。',label:'菜圃'},
 cottage:{wood:9,hours:15,width:3.10,depth:2.95,
  why:'谷中有了口粮和遮蔽，乡邻希望留出下一户人家的住处。',label:'山居'},
 'wood-yard':{wood:6,hours:11,width:2.85,depth:2.80,
  why:'拾柴往返费时，大家希望有一个晒木、修工具和储柴的作业处。',label:'木作棚'},
 'fish-hut':{wood:7,hours:12,width:2.85,depth:2.65,
  why:'田里的收成有季节，乡邻想借河水多添一门生计。先探安全岸边，再真实捕鱼。',label:'河岸渔棚'},
 granary:{wood:8,hours:12,width:2.65,depth:2.45,
  why:'田里有余粮，露天存粮不方便。乡邻想建一处能多储十八份口粮的架高粮仓。',label:'架高粮仓'},
 'tea-stop':{wood:9,hours:12,width:2.55,depth:2.38,
  why:'村里有余粮、成形乡路和来往的需求，乡邻愿意用真木料与工时建一处临路茶棚。',label:'山路茶棚'}
};
const woodFor=(kind:PioneerBuildKind)=>kind==='shelter'?7:spec[kind].wood;
const hoursFor=(kind:PioneerBuildKind)=>kind==='shelter'?9:spec[kind].hours;
export const pioneerBuildingLabel=(kind:PioneerBuildKind)=>kind==='shelter'?'避雨棚':spec[kind].label;
export function pioneerHousingCapacity(s:PioneerWorld){
 return s.buildings.reduce((sum,b)=>sum+(b.kind==='shelter'?3:b.kind==='cottage'?(b.loftAddedAt!==undefined?3:2):0),0);
}
export function pioneerHasFacility(s:PioneerWorld,kind:PioneerBuildKind){
 return s.buildings.some(b=>b.kind===kind);
}
function record(s:PioneerWorld,title:string,text:string,causeId:string|null=null){
 appendPioneerJournal(s,title,text,causeId);
}
/** Enforce the existing real eave/SAT checks, plus every new walking trail. */
export interface PioneerSurveyMetrics{
 candidateParcels:number;legalGeometry:number;openedLand:number;
 routeReached:number;resourceRoutesKept:number;
}
export function surveyPioneerPlot(s:PioneerWorld,kind:Exclude<PioneerBuildKind,'shelter'>,
 metrics?:PioneerSurveyMetrics,allowUnopened=false):
 {parcel:VillageParcel;path:WalkPoint[]}|null{
 if(metrics)Object.assign(metrics,{candidateParcels:0,legalGeometry:0,openedLand:0,
  routeReached:0,resourceRoutesKept:0});
 const data=spec[kind];
 const preferred=kind==='cottage'?pioneerV6LotFor('cottage',s.buildings.filter(b=>b.kind==='cottage').length):
  kind==='wood-yard'?pioneerV6LotFor('wood-yard'):null;
 // H3's full wing and H2's yard are not compulsory forms. When real safe
 // ground is scarce, a household can explicitly settle for the smaller H1.
 const designs=kind==='cottage'&&preferred?.styleId!=='H1-thatch'?
  [preferred!,PIONEER_V6_LOTS['H1-thatch']]:[preferred];
 const taken=[...natural(s),...s.buildings.map(b=>b.parcel)];
 const camp={id:'temporary-camp',kind:'protected' as const,
  x:s.camp.x,z:s.camp.z,width:1.25,depth:1.25,rotation:0,
  clearance:.24,accessX:s.camp.x,accessZ:s.camp.z,builtAt:0};
 const occupied=[...taken,camp];
 const field=s.sites.find(site=>site.kind==='field');
 const riverDist=distanceToCreekSpline;
 const opened=s.frontier.clearings.find(c=>c.phase==='cleared'&&
  distance(c,s.camp)>7.2);
 const center=kind==='cottage'&&s.founders.length>=9&&opened?
  {x:opened.x,z:opened.z}:
  kind==='fish-hut'?{x:3.6,z:-2.1}:
  kind==='granary'?{x:s.camp.x+3.3,z:s.camp.z+1.6}:
  kind==='tea-stop'?(opened?{x:opened.x,z:opened.z}:
   {x:s.camp.x-3.8,z:s.camp.z+2.1}):
  kind==='garden'?(s.policy==='food'?
  {x:s.camp.x-2.1,z:s.camp.z+5.0}:s.policy==='shelter'?
  {x:s.camp.x-5.4,z:s.camp.z+2.0}:
  {x:s.camp.x+2.7,z:s.camp.z+3.0}):
  kind==='wood-yard'?{x:s.camp.x-4.6,z:s.camp.z-2.4}:
  s.policy==='food'?{x:s.camp.x-4.0,z:s.camp.z+3.3}:
  s.policy==='shelter'?{x:s.camp.x-3.5,z:s.camp.z-3.2}:
  field?{x:field.x,z:field.z-2.0}:{x:s.camp.x+1.6,z:s.camp.z-3.4};
 const choices:{parcel:VillageParcel;score:number}[]=[];
 const salt=s.buildings.length+1;
 const offsetX=(hash(s.seed+salt*193)-.5)*.47;
 const offsetZ=(hash(s.seed+salt*509)-.5)*.47;
 const projectId='pioneer-'+kind+'-'+s.nextEventId;
 for(let i=-17;i<=17;i++)for(let j=-14;j<=14;j++){
  const x=round(s.camp.x+i*.72+offsetX),z=round(s.camp.z+j*.72+offsetZ);
  if(distance({x,z},s.camp)<3.9||distance({x,z},s.camp)>13.3)continue;
  if(kind==='fish-hut'&&(riverDist(x,z)<2.9||riverDist(x,z)>5.7))continue;
  for(const v6 of designs)for(const rotation of [0,Math.PI/2]){
   const road=nearestRoad(x,z);
   const parcel:VillageParcel={id:projectId,
    kind:kind==='cottage'?'dwelling':'workshop',x,z,
    width:v6?.width??data.width,depth:v6?.depth??data.depth,rotation,clearance:.30,
    ...(v6?{homesteadStyle:v6.styleId}:{}),
    accessX:road.point[0],accessZ:road.point[1],builtAt:s.minutes};
   if(metrics)metrics.candidateParcels++;
   if(!validatePioneerParcel(parcel,occupied,s.roads).ok)continue;
   if(metrics)metrics.legalGeometry++;
   if(!pioneerParcelOpened(s,parcel)&&!allowUnopened)continue;
   if(metrics&&pioneerParcelOpened(s,parcel))metrics.openedLand++;
   const proximity=distance({x,z},center);
   const policy=s.policy==='shelter'&&kind==='cottage'?
    Math.hypot(x-(s.camp.x-1.6),z-(s.camp.z-4))*.15:
    s.policy==='food'?Math.hypot(x-(s.camp.x-4),z-(s.camp.z+4))*.12:0;
   const score=proximity*.57+distance({x,z},s.camp)*.11+
    (kind==='fish-hut'?Math.abs(riverDist(x,z)-3.35)*1.8:0)+
    road.distance*.12+policy+hash(s.seed+i*719+j*991+salt*533+rotation*80)*.81;
   choices.push({parcel,score});
  }
 }
 choices.sort((a,b)=>a.score-b.score||a.parcel.x-b.parcel.x||a.parcel.z-b.parcel.z);
 // Route is tested in the same transaction as the proposed building.
 // No successful path: the parcel is rejected; never emit an orphan cottage.
 // After the core ring fills, look farther along already-walkable land.
 // Rejecting only the first 65 scored plots trapped every 5-person village
 // behind existing dirt paths despite safe distant parcels still existing.
 // A cottage must never cut the ONLY route to a real resource. Stage 0
 // validates the site's camp->source route once. Now every proposed
 // parcel must maintain the same forest, spring and forage access when
 // added to the navigation obstacles, not just its own front-door path.
 const critical=s.sites.filter(site=>site.kind==='forest'||site.kind==='spring'||site.kind==='forage'||site.kind==='fish');
 // Mature villages have exhausted their central lanes. Inspect safe
 // cleared-ring candidates instead of rejecting growth after the first
 // 210 high-scoring *central* parcels have no walkable access.
 const candidates=(kind==='cottage'&&s.founders.length>=9)||kind==='tea-stop'?420:210;
 // Never let dozens of unwalkable H3 plots prevent checking smaller paid
 // footprints. Both groups still pass *identical* river, SAT, road and
 // critical-resource A* checks before a house is ever scheduled.
 const ranked=preferred&&designs.length>1?
  [...choices.filter(c=>c.parcel.homesteadStyle===preferred.styleId).slice(0,Math.min(120,candidates)),
   ...choices.filter(c=>c.parcel.homesteadStyle!==preferred.styleId).slice(0,Math.min(200,candidates))]:
  choices.slice(0,candidates);
 for(const candidate of ranked){
  const path=pioneerBuildingPath(s.camp,candidate.parcel,taken);
  if(!path)continue;
  if(allowUnopened&&!pioneerParcelOpened(s,candidate.parcel)&&
   !findPioneerWalk([s.camp.x,s.camp.z],
    [candidate.parcel.x,candidate.parcel.z],taken))continue;
  if(metrics)metrics.routeReached++;
  const blockers=[...taken,candidate.parcel];
  if(!critical.every(site=>findPioneerWalk(
   [s.camp.x,s.camp.z],[site.x,site.z],blockers)))continue;
  if(metrics)metrics.resourceRoutesKept++;
  return {parcel:candidate.parcel,path};
 }
 return null;
}
function nextProjectKind(s:PioneerWorld):Exclude<PioneerBuildKind,'shelter'>|'repair'|null{
 if(!s.buildings.length||s.intent)return null;
 const old=s.buildings.find(b=>(b.condition??100)<pioneerRepairPriority(s));
 if(old&&s.resources.wood>=2)return 'repair';
 const gardens=s.buildings.filter(b=>b.kind==='garden').length;
 if(!gardens&&(s.policy==='food'||s.resources.food<16||s.buildings.length>=2))return 'garden';
 // An actual household consumes food every day, including winter. The old
 // growth loop built one garden for nine people and silently starved.
 // The next free bedroom creates *future* demand: prebuild a field before
 // inviting the 5th/9th mouth. Otherwise migration requires extra fields,
 // while the construction planner waits forever for those migrants.
 const capacity=pioneerHousingCapacity(s);
 if(gardens>0&&gardens<Math.ceil(capacity/4))return 'garden';
 if(gardens>0&&gardens<Math.ceil(s.founders.length/4)&&
  s.resources.food<Math.max(18,s.founders.length*3.5))return 'garden';
 if(!pioneerHasFacility(s,'cottage')&&
  (s.policy==='shelter'||pioneerHasFacility(s,'garden')||s.resources.food>=12))return 'cottage';
 if(!pioneerHasFacility(s,'wood-yard')&&
  (s.buildings.length>=3||s.sites.find(site=>site.kind==='forest')!.stock<3))
  return 'wood-yard';
 const cottages=s.buildings.filter(b=>b.kind==='cottage').length;
 const housing=pioneerHousingCapacity(s);
 if(cottages<5&&s.founders.length<12&&housing<=s.founders.length&&
  pioneerHasFacility(s,'garden')&&s.resources.food>=3)return 'cottage';
 // Real professions, not more identical cottages, keep a mature hamlet
 // changing. Suggested direction changes priority, never permanently locks.
 const stable=s.commons.stage>=2&&s.founders.length>=5&&gardens>=2;
 const river=stable&&!pioneerHasFacility(s,'fish-hut');
 const stores=stable&&!pioneerHasFacility(s,'granary');
 const travelers=s.commons.stage>=3&&s.founders.length>=8&&s.roads.length>=7&&
  (pioneerHasFacility(s,'granary')||pioneerHasFacility(s,'fish-hut'))&&
  !pioneerHasFacility(s,'tea-stop');
 if(s.livelihood.direction==='road'&&travelers)return 'tea-stop';
 if(s.livelihood.direction==='river'&&river)return 'fish-hut';
 if(s.livelihood.direction==='fields'&&stores)return 'granary';
 if(s.livelihood.direction==='craft'&&pioneerHasFacility(s,'wood-yard')&&
  s.livelihood.craft.phase!=='complete'&&s.resources.food>=s.founders.length*1.5)
  return null; // Give residents actual spare wood and six shifts before other expansion.
 if(river)return 'fish-hut';
 if(stores)return 'granary';
 if(travelers)return 'tea-stop';
 return null;
}
export function schedulePioneerProject(s:PioneerWorld){
 if(s.intent||s.minutes<s.nextSurveyAt)return false;
 const kind=nextProjectKind(s);if(!kind)return false;
 const previous=s.buildings.at(-1);
 if(previous&&s.minutes-previous.completedAt<DAY_MINUTES*.70)return false;
 if(kind==='repair'){
  const target=s.buildings.find(b=>(b.condition??100)<pioneerRepairPriority(s));
  if(!target)return false;
  const id='repair-need-'+s.nextEventId;
  s.intent={id,kind:'repair',targetBuildingId:target.id,
   reason:pioneerBuildingLabel(target.kind)+'在风雨中损坏，乡邻需要修缮它。',
   createdAt:s.minutes,requestedBy:target.occupants.length?target.occupants.slice():
    s.founders.slice(0,2).map(x=>x.id),parcel:target.parcel,path:[],
   phase:'materials',woodRequired:2,woodCommitted:0,workDone:0,
   workRequired:5,pauseReason:'修屋需备两份木料'};
  record(s,'修屋工单',pioneerBuildingLabel(target.kind)+'屋面老化，乡邻主动讨论补梁和换顶。',id);
  return true;
 }
 const proposal=surveyPioneerPlot(s,kind);
 if(!proposal&&(kind==='tea-stop'||kind==='cottage')){
  // An honest larger courtyard needs newly opened land after the inner ring fills.
  // This is a legal future build site, not free new land. First reserve a
  // real clearing job for residents, whose eight hours must fully complete
  // before any future construction or visitor can appear.
  const future=surveyPioneerPlot(s,kind,undefined,true);
  if(future&&requestPioneerExpansionClearing(s,future.parcel)){
   s.nextSurveyAt=s.minutes+3*DAY_MINUTES;
   return false;
  }
 }
 if(!proposal){
  // A full old village centre has no legal fourth-cottage plot. In this
  // case existing families can invest real lumber and labour in loft
  // conversions *within an already inspected cottage footprint*. This is
  // preferable to generating overlapping cottages or phantom migrants.
  if(kind==='cottage'&&s.founders.length>=9){
   const home=s.buildings.find(b=>b.kind==='cottage'&&
    b.loftAddedAt===undefined&&(b.condition??100)>=60);
   if(home){
    const id='pioneer-loft-'+s.nextEventId;
    s.intent={id,kind:'loft',targetBuildingId:home.id,
     reason:'平地已满，新邻居仍需要能遮雨的住处。乡邻决定在原有山居内加一道稳固木阁。',
     createdAt:s.minutes,requestedBy:s.founders.filter(f=>f.homeBuildingId===home.id).map(f=>f.id),
     parcel:home.parcel,path:s.roads.find(r=>r.buildingId===home.id)?.points??[],
     phase:'materials',woodRequired:4,woodCommitted:0,workDone:0,
     workRequired:8,pauseReason:'改阁楼仍需四份木料和八小时真实施工'};
    record(s,'商议山居加阁','新屋址不够，村民决定在已有安全屋界内增加一处睡铺；仍需木料和施工。',id);
    return true;
   }
  }
  s.nextSurveyAt=s.minutes+3*DAY_MINUTES;
  // An unavailable riverside parcel remains actionable, but repeated
  // three-day survey failures must not erase decades of village memories.
  const message='屋檐、溪岸、树木与已走出的路径都要留净空，暂时没有安全可达的'+
   pioneerBuildingLabel(kind)+'用地。';
  const recently=s.journal.some(e=>e.title==='勘地暂缓'&&e.text===message&&
   s.minutes-e.minute<24*DAY_MINUTES);
  if(!recently)record(s,'勘地暂缓',message);
  return false;
 }
 const id='pioneer-need-'+s.nextEventId;
 const data=spec[kind];
 const v6=proposal.parcel.homesteadStyle?PIONEER_V6_LOTS[proposal.parcel.homesteadStyle]:null;
 const wood=v6?.wood??data.wood,hours=v6?.hours??data.hours;
 s.intent={id,kind,reason:data.why,createdAt:s.minutes,
  requestedBy:s.founders.filter(f=>f.homeBuildingId).map(f=>f.id),
  parcel:proposal.parcel,path:proposal.path,phase:'materials',
  woodRequired:wood,woodCommitted:0,workDone:0,
  workRequired:hours,pauseReason:'需要 '+wood+' 份木料和 '+hours+' 工时'};
 record(s,'乡邻谋划'+data.label,data.why+' 梁伯勘定了从营地到新工地的可走线路。',id);
 return true;
}
export function completePioneerProject(s:PioneerWorld){
 const intent=s.intent;if(!intent)return false;
 if(intent.kind==='loft'){
  if(intent.woodRequired!==4||intent.woodCommitted!==4||
   intent.workRequired!==8||intent.workDone<8||!['foundation','frame'].includes(intent.phase))
   return false;
  const home=s.buildings.find(b=>b.id===intent.targetBuildingId&&b.kind==='cottage');
  if(!home||home.loftAddedAt!==undefined){s.intent=null;return false;}
  home.loftAddedAt=s.minutes;
  home.loftWoodSpent=intent.woodCommitted;
  home.loftWorkHours=intent.workDone;home.loftCauseId=intent.id;
  const cause=intent.id;s.intent=null;
  record(s,'山居木阁落成','村民在'+home.id+'原有安全屋界内耗四份木料与八工时，加出一处能住人的木阁；并没有凭空另盖屋。',cause);
  return true;
 }
 if(intent.kind==='repair'){
  const old=s.buildings.find(b=>b.id===intent.targetBuildingId);
  if(!old){s.intent=null;return false;}
  old.condition=Math.min(100,(old.condition??70)+36);
  old.lastRepairAt=s.minutes;
  const cause=intent.id;s.intent=null;
  record(s,'旧屋焕新',pioneerBuildingLabel(old.kind)+'换上修补的梁和屋面，留下了一道新木纹。',cause);
  return true;
 }
 const kind=intent.kind??'shelter';
 if(!intent.parcel)return false;
 const id='pioneer-'+kind+'-built-'+s.nextEventId;
 const b:PioneerBuilding={id,kind,parcel:intent.parcel,completedAt:s.minutes,
  causeId:intent.id,occupants:[],materialsSpent:{wood:intent.woodCommitted},
  workHours:intent.workDone,condition:100,lastRepairAt:s.minutes};
 if(kind==='cottage')b.occupants=[];
 else if(kind==='shelter')b.occupants=s.founders.slice(0,3).map(f=>f.id);
 s.buildings.push(b);s.intent=null;
 if(intent.path&&intent.path.length>=2){
  const road:PioneerRoad={id:'road-'+b.id,buildingId:b.id,
   createdAt:s.minutes,grade:'track',points:intent.path,uses:0};
  s.roads.push(road);
 }
 if(kind==='garden'){
  const site:PioneerResourceSite={id:'field-'+b.id,kind:'field',
   x:b.parcel.x,z:b.parcel.z,stock:3,capacity:12,
   renewPerDay:5.1,totalGathered:0};
  s.sites.push(site);
 }
 if(kind==='fish-hut'){
  const dock=pioneerEntrance(b.parcel);
  s.sites.push({id:'fish-'+b.id,kind:'fish',x:dock[0],z:dock[1],
   stock:5.5,capacity:13,renewPerDay:3.5,totalGathered:0});
 }
 if(kind==='tea-stop')onPioneerTeaStopBuilt(s);
 if(kind==='wood-yard')s.resources.wood=round(Math.min(48,s.resources.wood));
 if(kind==='shelter'){
  for(const resident of s.founders.slice(0,3))resident.homeBuildingId=b.id;
 }
 record(s,pioneerBuildingLabel(kind)+'落成',
  (kind==='tea-stop'?'山路上出现有灶台、供客歇脚的真正茶棚。仍须村里有粮、行路实际可达，旅人才会来；来客不算常住人口。':
   kind==='fish-hut'?'乡邻造出靠近真正河岸且可走到的渔棚，渔点有季节库存，仍需居民每日出工。':
   kind==='granary'?'乡邻架高屋底和储谷桶，粮库可以多存十八份口粮，但并不凭空产粮。':
   kind==='garden'?'阿禾开出田畦，粮食今后要靠四季耕作、采收而来。':
   kind==='cottage'?'一户新的住处终于空出来，是否有人落脚仍取决于粮食与生计。':
   kind==='wood-yard'?'梁伯的柴木有了晾晒、保管和修工具的所在。':
   '三位开荒者终于有了避雨之处。')+' 工材与路线均已登记。',b.causeId);
 return true;
}
const newcomers=[
 ['小满','园丁','#ba9a65'],['阿岚','木匠','#748e87'],
 ['叶生','采集者','#9d8c6c'],['青雀','山野农人','#8f9874'],
 ['孟石','石匠','#847f72'],['阿荞','菜农','#ba8277'],
 ['胡舟','渔夫','#668f97'],['阿蓉','织网人','#b99478'],['庆山','修路匠','#97856b']
] as const;
export function considerPioneerMigration(s:PioneerWorld){
 if(s.founders.length>=12||s.minutes<s.lastArrivalAt+7*DAY_MINUTES)return false;
 const idx=s.founders.length-3;const data=newcomers[idx%newcomers.length];
 // A stable visitor exists before acceptance, even while a house or food is
 // missing. Returning later never changes this person's seed, history or ID.
 s.livingFates.pendingCandidate??=makePioneerCandidate(
  s.seed,s.nextResidentId,data,s.minutes);
 const candidate=s.livingFates.pendingCandidate;
 const cottage=s.buildings.find(b=>b.kind==='cottage'&&b.occupants.length<(b.loftAddedAt!==undefined?3:2));
 if(!cottage||!pioneerHasFacility(s,'garden')||
  s.resources.food<Math.max(6,(s.founders.length+1)*1.5)||
  s.resources.water<Math.max(2,s.founders.length*.6)||
  s.sites.filter(site=>site.kind==='field').length<Math.ceil((s.founders.length+1)/4))
  return false;
 const id=s.nextResidentId++;
 const next:PioneerFounder={id,name:candidate.name,role:candidate.role,color:candidate.color,
  activity:'shelter',target:[cottage.parcel.x,cottage.parcel.z],
  homeBuildingId:cottage.id};
 s.founders.push(next);cottage.occupants.push(id);s.lastArrivalAt=s.minutes;
 welcomePioneerCandidate(s,candidate);
 record(s,'又添一位乡邻',next.name+'听说此地有屋、有粮、有工作，循着新踏出的村路在山居安顿。',cottage.causeId);
 return true;
}
export function agePioneerBuildings(s:PioneerWorld){
 const weather=s.minutes%DAY_MINUTES===0;
 if(!weather)return;
 const rain=(s.minutes/DAY_MINUTES+s.seed)%5<2;
 const winter=Math.floor((s.minutes/DAY_MINUTES)%48/12)===3;
 for(const b of s.buildings){
  const wear=b.kind==='garden'?.20:b.kind==='cottage'?.52:.61;
  b.condition=round(Math.max(0,(b.condition??100)-wear-(winter?.22:0)-(rain?.16:0)));
 }
}
export function registerPioneerTrip(s:PioneerWorld,roadId:string|undefined){
 if(!roadId)return;
 const road=s.roads.find(x=>x.id===roadId);if(!road)return;
 road.uses++;
 if(road.grade==='track'&&road.uses>=55){
  road.grade='dirt';
  record(s,'脚印踏成了乡路','居民日复一日沿着真正的工地和住屋之间来回，薄土径自然显出轮廓。',road.buildingId);
 }
}
export const pioneerProjectCost=woodFor;
export const pioneerProjectHours=hoursFor;
