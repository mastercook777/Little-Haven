import {DAY_MINUTES} from './calendar.ts';
import {nearestRoad,parcelLineDistance,reservedParcels,validateVillageParcel,
 type VillageParcel} from './villagePlanning.ts';
import {pioneerBuildingPath,type WalkPoint,type PioneerRoad} from './pioneerPaths.ts';
import type {PioneerWorld,PioneerBuilding,PioneerIntent,PioneerFounder,
 PioneerResourceSite,PioneerBuildKind} from './pioneerWorld.ts';

const round=(n:number)=>Math.round(n*1000)/1000;
const hash=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return ((k^(k>>>16))>>>0)/4294967296;
};
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const natural=()=>reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
const spec:Record<Exclude<PioneerBuildKind,'shelter'>,{wood:number;hours:number;width:number;depth:number;why:string;label:string}>={
 garden:{wood:3,hours:6,width:2.75,depth:2.65,
  why:'野果时有时无，乡邻想亲手开垦一处稳定的菜畦。',label:'菜圃'},
 cottage:{wood:9,hours:15,width:3.10,depth:2.95,
  why:'谷中有了口粮和遮蔽，乡邻希望留出下一户人家的住处。',label:'山居'},
 'wood-yard':{wood:6,hours:11,width:2.85,depth:2.80,
  why:'拾柴往返费时，大家希望有一个晒木、修工具和储柴的作业处。',label:'木作棚'}
};
const woodFor=(kind:PioneerBuildKind)=>kind==='shelter'?7:spec[kind].wood;
const hoursFor=(kind:PioneerBuildKind)=>kind==='shelter'?9:spec[kind].hours;
export const pioneerBuildingLabel=(kind:PioneerBuildKind)=>kind==='shelter'?'避雨棚':spec[kind].label;
export function pioneerHousingCapacity(s:PioneerWorld){
 return s.buildings.reduce((sum,b)=>sum+(b.kind==='shelter'?3:b.kind==='cottage'?2:0),0);
}
export function pioneerHasFacility(s:PioneerWorld,kind:PioneerBuildKind){
 return s.buildings.some(b=>b.kind===kind);
}
function record(s:PioneerWorld,title:string,text:string,causeId:string|null=null){
 if(s.journal.length>=160)s.journal.shift();
 s.journal.push({id:s.nextEventId++,minute:s.minutes,title,text,causeId});
}
/** Enforce the existing real eave/SAT checks, plus every new walking trail. */
export function surveyPioneerPlot(s:PioneerWorld,kind:Exclude<PioneerBuildKind,'shelter'>):
 {parcel:VillageParcel;path:WalkPoint[]}|null{
 const data=spec[kind];
 const taken=[...natural(),...s.buildings.map(b=>b.parcel)];
 const camp={id:'temporary-camp',kind:'protected' as const,
  x:s.camp.x,z:s.camp.z,width:1.25,depth:1.25,rotation:0,
  clearance:.24,accessX:s.camp.x,accessZ:s.camp.z,builtAt:0};
 const occupied=[...taken,camp];
 const field=s.sites.find(site=>site.kind==='field');
 const center=kind==='garden'?{x:s.camp.x-3.8,z:s.camp.z+3.5}:
  kind==='wood-yard'?{x:s.camp.x-4.6,z:s.camp.z-2.4}:
  s.policy==='food'?{x:s.camp.x-4.0,z:s.camp.z+3.3}:
  s.policy==='shelter'?{x:s.camp.x-3.5,z:s.camp.z-3.2}:
  field?{x:field.x,z:field.z-2.0}:{x:s.camp.x+1.6,z:s.camp.z-3.4};
 const choices:{parcel:VillageParcel;score:number}[]=[];
 const salt=s.buildings.length+1;
 const offsetX=(hash(s.seed+salt*193)-.5)*.47;
 const offsetZ=(hash(s.seed+salt*509)-.5)*.47;
 const projectId='pioneer-'+kind+'-'+s.nextEventId;
 for(let i=-12;i<=12;i++)for(let j=-10;j<=10;j++){
  const x=round(s.camp.x+i*.72+offsetX),z=round(s.camp.z+j*.72+offsetZ);
  if(distance({x,z},s.camp)<3.9||distance({x,z},s.camp)>10.3)continue;
  for(const rotation of [0,Math.PI/2]){
   const road=nearestRoad(x,z);
   const parcel:VillageParcel={id:projectId,
    kind:kind==='cottage'?'dwelling':'workshop',x,z,
    width:data.width,depth:data.depth,rotation,clearance:.30,
    accessX:road.point[0],accessZ:road.point[1],builtAt:s.minutes};
   if(!validateVillageParcel(parcel,occupied,4.25).ok)continue;
   if(s.roads.some(existing=>parcelLineDistance(parcel,existing.points)<.18))
    continue;
   const proximity=distance({x,z},center);
   const policy=s.policy==='shelter'&&kind==='cottage'?
    Math.hypot(x-(s.camp.x-1.6),z-(s.camp.z-4))*.15:
    s.policy==='food'?Math.hypot(x-(s.camp.x-4),z-(s.camp.z+4))*.12:0;
   const score=proximity*.24+distance({x,z},s.camp)*.11+
    road.distance*.12+policy+hash(s.seed+i*719+j*991+salt*533+rotation*80)*.81;
   choices.push({parcel,score});
  }
 }
 choices.sort((a,b)=>a.score-b.score||a.parcel.x-b.parcel.x||a.parcel.z-b.parcel.z);
 // Route is tested in the same transaction as the proposed building.
 // No successful path: the parcel is rejected; never emit an orphan cottage.
 for(const candidate of choices.slice(0,65)){
  const path=pioneerBuildingPath(s.camp,candidate.parcel,taken);
  if(!path)continue;
  return {parcel:candidate.parcel,path};
 }
 return null;
}
function nextProjectKind(s:PioneerWorld):Exclude<PioneerBuildKind,'shelter'>|'repair'|null{
 if(!s.buildings.length||s.intent)return null;
 const old=s.buildings.find(b=>(b.condition??100)<68);
 if(old&&s.resources.wood>=2)return 'repair';
 if(!pioneerHasFacility(s,'garden')&&
  (s.policy==='food'||s.resources.food<16||s.buildings.length>=2))return 'garden';
 if(!pioneerHasFacility(s,'cottage')&&
  (s.policy==='shelter'||pioneerHasFacility(s,'garden')||s.resources.food>=12))return 'cottage';
 if(!pioneerHasFacility(s,'wood-yard')&&
  (s.buildings.length>=3||s.sites.find(site=>site.kind==='forest')!.stock<3))
  return 'wood-yard';
 const cottages=s.buildings.filter(b=>b.kind==='cottage').length;
 const housing=pioneerHousingCapacity(s);
 if(cottages<3&&housing<=s.founders.length&&
  pioneerHasFacility(s,'garden')&&s.resources.food>=3)return 'cottage';
 return null;
}
export function schedulePioneerProject(s:PioneerWorld){
 if(s.intent||s.minutes<s.nextSurveyAt)return false;
 const kind=nextProjectKind(s);if(!kind)return false;
 const previous=s.buildings.at(-1);
 if(previous&&s.minutes-previous.completedAt<DAY_MINUTES*.70)return false;
 if(kind==='repair'){
  const target=s.buildings.find(b=>(b.condition??100)<68);
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
 if(!proposal){
  s.nextSurveyAt=s.minutes+3*DAY_MINUTES;
  record(s,'勘地暂缓','屋檐、溪岸、树木与已走出的路径都要留净空，暂时没有安全可达的'+pioneerBuildingLabel(kind)+'用地。');
  return false;
 }
 const id='pioneer-need-'+s.nextEventId;
 const data=spec[kind];
 s.intent={id,kind,reason:data.why,createdAt:s.minutes,
  requestedBy:s.founders.filter(f=>f.homeBuildingId).map(f=>f.id),
  parcel:proposal.parcel,path:proposal.path,phase:'materials',
  woodRequired:data.wood,woodCommitted:0,workDone:0,
  workRequired:data.hours,pauseReason:'需要 '+data.wood+' 份木料和 '+data.hours+' 工时'};
 record(s,'乡邻谋划'+data.label,data.why+' 梁伯勘定了从营地到新工地的可走线路。',id);
 return true;
}
export function completePioneerProject(s:PioneerWorld){
 const intent=s.intent;if(!intent)return false;
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
 if(kind==='wood-yard')s.resources.wood=round(Math.min(48,s.resources.wood));
 if(kind==='shelter'){
  for(const resident of s.founders.slice(0,3))resident.homeBuildingId=b.id;
 }
 record(s,pioneerBuildingLabel(kind)+'落成',
  (kind==='garden'?'阿禾开出田畦，粮食今后要靠四季耕作、采收而来。':
   kind==='cottage'?'一户新的住处终于空出来，是否有人落脚仍取决于粮食与生计。':
   kind==='wood-yard'?'梁伯的柴木有了晾晒、保管和修工具的所在。':
   '三位开荒者终于有了避雨之处。')+' 工材与路线均已登记。',b.causeId);
 return true;
}
const newcomers=[
 ['小满','园丁','#ba9a65'],['阿岚','木匠','#748e87'],
 ['叶生','采集者','#9d8c6c'],['青雀','山野农人','#8f9874'],
 ['孟石','石匠','#847f72'],['阿荞','菜农','#ba8277']
] as const;
export function considerPioneerMigration(s:PioneerWorld){
 if(s.founders.length>=9||s.minutes<s.lastArrivalAt+7*DAY_MINUTES)return false;
 const cottage=s.buildings.find(b=>b.kind==='cottage'&&b.occupants.length<2);
 if(!cottage||!pioneerHasFacility(s,'garden')||s.resources.food<4||
  s.resources.water<2)return false;
 const idx=s.founders.length-3;const data=newcomers[idx%newcomers.length];
 const id=s.nextResidentId++;
 const next:PioneerFounder={id,name:data[0],role:data[1],color:data[2],
  activity:'shelter',target:[cottage.parcel.x,cottage.parcel.z],
  homeBuildingId:cottage.id};
 s.founders.push(next);cottage.occupants.push(id);s.lastArrivalAt=s.minutes;
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
