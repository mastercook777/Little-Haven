import type {PioneerWorld,PioneerFounder,PioneerResourceSite} from './pioneerWorld.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';
import {findPioneerWalk,pioneerWalkable,type WalkPoint} from './pioneerPaths.ts';
import {validatePioneerParcel} from './pioneerParcelRules.ts';
import {reservedParcels,type VillageParcel} from './villagePlanning.ts';
import {DAY_MINUTES} from './calendar.ts';

export interface PioneerFelling {
 siteId:string;minute:number;serial:number;residentId:number;
 x:number;z:number;dx:number;dz:number;
}
export interface PioneerClearing {
 id:string;x:number;z:number;radius:number;
 phase:'clearing'|'cleared';workDone:number;workRequired:number;
 startedAt:number;clearedAt:number|null;
}
export interface PioneerFrontier {
 clearings:PioneerClearing[];
 totalFelled:number;lastFelling:PioneerFelling|null;lastSurveyAt:number;
 clearingHours:number;
}
const round=(n:number)=>Math.round(n*1000)/1000;
const hash=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return ((k^(k>>>16))>>>0)/4294967296;
};
const landscape=()=>reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const record=(s:PioneerWorld,title:string,text:string,causeId:string)=>{
 appendPioneerJournal(s,title,text,causeId);
};
export function createPioneerFrontier():PioneerFrontier{
 return {clearings:[],totalFelled:0,lastFelling:null,lastSurveyAt:0,clearingHours:0};
}
/** A grove site is an aggregated stock. Crossings of a fixed cumulative
 * harvest quantum produce at most one persisted fall event per wood-cutting
 * assignment. No one-tree-one-wood assumption, no visual RNG inventory. */
export function recordPioneerFelling(s:PioneerWorld,site:PioneerResourceSite,
 resident:PioneerFounder,before:number){
 if(site.kind!=='forest')return;
 const oldSerial=Math.floor((before+1e-6)/2.8);
 const newSerial=Math.floor((site.totalGathered+1e-6)/2.8);
 if(newSerial<=oldSerial)return;
 const serial=newSerial;
 const theta=hash(s.seed*17+serial*499+resident.id*31)*Math.PI*2;
 const x=round(site.x+Math.cos(theta)*1.28),z=round(site.z+Math.sin(theta)*1.28);
 // Select a fall direction that is maximally distant from built structures,
 // village walkers and water. It stays inside the bounded grove footprint.
 const options:[[number,number],[number,number],[number,number],[number,number]]=[
  [1,0],[-1,0],[0,1],[0,-1]];
 const obstacles=s.buildings.map(b=>({x:b.parcel.x,z:b.parcel.z}));
 const score=([dx,dz]:number[])=>{
  const tip={x:x+dx*1.15,z:z+dz*1.15};
  const housing=Math.min(10,...obstacles.map(o=>dist(tip,o)));
  const people=Math.min(10,...s.founders.map(f=>dist(tip,{x:f.target[0],z:f.target[1]})));
  return housing*.8+people*.3+hash(serial*79+dx*13+dz*19)*.06;
 };
 options.sort((a,b)=>score(b)-score(a));
 s.frontier.totalFelled++;
 s.frontier.lastFelling={siteId:site.id,minute:s.minutes,serial,
  residentId:resident.id,x,z,dx:options[0][0],dz:options[0][1]};
 if(serial%4===1)record(s,'林间落木',
  resident.name+'伐倒了林缘的一株老木，树倒声过后留下树桩，木料由实际采集入库。',
  site.id);
}
function frontierPatch(s:PioneerWorld,index:number):PioneerClearing|null{
 const blockers=[...landscape(),...s.buildings.map(b=>b.parcel)];
 const origin:WalkPoint=[s.camp.x,s.camp.z];
 const candidates:{x:number;z:number;score:number}[]=[];
 // Search the whole safe buffer ring rather than nine speculative
 // directions. Otherwise a seeded hamlet with trees on those headings
 // could never open any land despite walkable clearings elsewhere.
 for(let a=0;a<36;a++){
  const theta=(a+hash(s.seed+index*149)*.24)/36*Math.PI*2;
  for(let j=0;j<5;j++){
   const distance=8.5+j*1.0;
   const x=round(s.camp.x+Math.cos(theta)*distance);
   const z=round(s.camp.z+Math.sin(theta)*distance);
   const patch:VillageParcel={id:'frontier-survey',kind:'protected',x,z,
    width:2.4,depth:2.4,rotation:0,clearance:.18,
    accessX:x,accessZ:z,builtAt:s.minutes};
   if(!validatePioneerParcel(patch,blockers,s.roads).ok)continue;
   if(s.sites.some(site=>site.kind!=='field'&&dist({x,z},site)<3.0))continue;
   if(s.frontier.clearings.some(c=>dist({x,z},c)<4.1))continue;
   if(!pioneerWalkable([x,z],blockers))continue;
   candidates.push({x,z,score:distance*.055+
    Math.max(0,x-s.camp.x)*.18+
    Math.abs(distance-10.4)*.12+
    hash(s.seed+index*57+j*197+a*677)*.33});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 for(const chosen of candidates){
  // Search geometry cheaply first, then solve A* on demand. Computing
  // 180 complete navigation graphs per 3-day survey stalls low-end phones.
  if(!findPioneerWalk(origin,[chosen.x,chosen.z],blockers))continue;
  return {id:'clearing-'+(index+1),x:chosen.x,z:chosen.z,radius:2.20,
   phase:'clearing',workDone:0,workRequired:8,startedAt:s.minutes,clearedAt:null};
 }
 return null;
}
export function schedulePioneerClearing(s:PioneerWorld){
 const f=s.frontier;
 if(f.clearings.some(c=>c.phase==='clearing')||f.clearings.length>=8||
  s.buildings.length<3||s.founders.length<4||
  s.minutes<f.lastSurveyAt)return false;
 // Clear the next corridor when houses begin to occupy the first ring.
 // No forced date-based opening of the terrain.
 const desired=Math.min(4,Math.floor((s.buildings.length-1)/2));
 if(f.clearings.length>=desired)return false;
 const next=frontierPatch(s,f.clearings.length);
 f.lastSurveyAt=s.minutes+3*DAY_MINUTES;
 if(!next)return false;
 f.clearings.push(next);
 record(s,'林缘勘荒','乡邻沿现有安全小径探路，选择了不挡河道、住房和水源的缓冲林地。',next.id);
 return true;
}
/** A later real livelihood may need land after the first housing ring fills.
 * Do not waive island, tree, river or road checks. Find an actually walkable
 * legal plot, then schedule the SAME eight resident clearing shifts as the
 * initial frontier. If an old unworked plot has become unreachable through
 * later construction, resurvey it (the old zero hours cannot move with it). */
export function requestPioneerExpansionClearing(s:PioneerWorld,p:VillageParcel){
 if(pioneerParcelOpened(s,p))return false;
 const f=s.frontier;
 const occupied=[...landscape(),...s.buildings.map(b=>b.parcel)];
 if(!validatePioneerParcel(p,occupied,s.roads).ok||
  !findPioneerWalk([s.camp.x,s.camp.z],[p.x,p.z],occupied))return false;
 const active=f.clearings.find(c=>c.phase==='clearing');
 if(active){
  if(dist(active,p)<=1.5)return true;
  // A house built after the original survey can strand the plot. No
  // phantom workers should receive credit for standing behind blocked lanes.
  if(pioneerClearingReachable(s,active)||s.minutes-active.startedAt<3*DAY_MINUTES)
   return false;
  // Preserve actual historical total work; reset current plot work. A
  // displaced clearing is not a completed clearing, nor a free new parcel.
  const lost=active.workDone;
  active.x=p.x;active.z=p.z;active.workDone=0;active.startedAt=s.minutes;
  active.clearedAt=null;active.radius=2.2;
  f.lastSurveyAt=s.minutes+3*DAY_MINUTES;
  record(s,'林缘改勘','原清障地因新屋与乡路而无法安全抵达。村民另选合规可达的工地；'+
   (lost>0?'原来投入的 '+round(lost)+' 小时不能移作新地功劳。':
    '旧址尚未开工，没有虚构开垦成果。'),active.id);
  return true;
 }
 if(f.clearings.length>=8)return false;
 const next:PioneerClearing={id:'clearing-'+(f.clearings.length+1),
  x:p.x,z:p.z,radius:2.2,phase:'clearing',workDone:0,workRequired:8,
  startedAt:s.minutes,clearedAt:null};
 f.clearings.push(next);
 f.lastSurveyAt=s.minutes+3*DAY_MINUTES;
 record(s,'为茶棚新开林缘地','乡邻勘出合规又可达的山路空隙。须实际清灌移石八小时，方可在此考虑茶棚。',next.id);
 return true;
}
export function pioneerClearingReachable(s:PioneerWorld,p:PioneerClearing):boolean{
 const occupied=[...landscape(),...s.buildings.map(b=>b.parcel)];
 return !!findPioneerWalk([s.camp.x,s.camp.z],[p.x,p.z],occupied);
}
export function performPioneerClearing(s:PioneerWorld,p:PioneerClearing,effort:number){
 if(p.phase!=='clearing'||effort<=0)return false;
 p.workDone=round(Math.min(p.workRequired,p.workDone+effort));
 s.frontier.clearingHours=round(s.frontier.clearingHours+effort);
 if(p.workDone>=p.workRequired){
  p.phase='cleared';p.clearedAt=s.minutes;
  record(s,'林地开出空场','居民逐次清去灌木、移走碎石，留下一片真正可以继续勘地的开阔地面。',p.id);
 }
 return true;
}
/** Only outer-band plots need clearing; already occupied and first-ring
 * legacy plots remain legal for importing v0.4.1/v0.4.2 saves. */
export function pioneerParcelOpened(s:PioneerWorld,p:VillageParcel){
 const campDistance=dist(s.camp,p);
 if(campDistance<=9.7)return true;
 // A cleared patch removes surface vegetation; the outer band is
 // unbuildable until somebody actually spends the clearing labor.
 return s.frontier.clearings.some(c=>c.phase==='cleared'&&
  dist(c,p)<=c.radius+1.1);
}
export function validatePioneerFrontier(f:PioneerFrontier,s:PioneerWorld){
 if(!f||!Array.isArray(f.clearings)||f.clearings.length>8||
  ![f.totalFelled,f.lastSurveyAt,f.clearingHours].every(x=>Number.isFinite(x)&&x>=0)||
  !Number.isInteger(f.totalFelled)||f.totalFelled>100000)return false;
 const ids=new Set<string>();
 for(const c of f.clearings){
  if(!c||typeof c.id!=='string'||ids.has(c.id)||
   !['clearing','cleared'].includes(c.phase)||
   ![c.x,c.z,c.radius,c.workDone,c.workRequired,c.startedAt].every(Number.isFinite)||
   c.radius<1||c.radius>5||c.workRequired!==8||
   c.workDone<0||c.workDone>c.workRequired||
   (c.phase==='cleared'&&(c.clearedAt===null||c.workDone!==c.workRequired))||
   (c.phase==='clearing'&&c.clearedAt!==null))return false;
  ids.add(c.id);
 }
 const fall=f.lastFelling;
 if(fall&&(!s.sites.some(site=>site.id===fall.siteId&&site.kind==='forest')||
  ![fall.minute,fall.serial,fall.residentId,fall.x,fall.z,fall.dx,fall.dz].every(Number.isFinite)||
  fall.minute>s.minutes||fall.minute<0||![-1,0,1].includes(fall.dx)||
  ![-1,0,1].includes(fall.dz)||Math.abs(fall.dx)+Math.abs(fall.dz)!==1))return false;
 return true;
}
