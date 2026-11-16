import {DAY_MINUTES} from './calendar.ts';
import {pioneerV6CourtyardPoint,pioneerV6HomesteadPlan,pioneerV6YardWalkable} from './homesteadPlan.ts';
import {pioneerNaturalParcels} from './pioneerNaturalAnchors.ts';
import {findPioneerWalk,pioneerEntrance,roadSegmentsSafe,samplePioneerWalk,type WalkPoint} from './pioneerPaths.ts';
import type {PioneerBuilding,PioneerFounder,PioneerWorld} from './pioneerWorld.ts';

export interface PioneerResidentMotion{
 path:WalkPoint[];
 starts:number;
 ends:number;
 fromHomeId:string|null;
 toHomeId:string|null;
 carryingWood?:boolean;
 fishPickup?:number;
 blocked?:boolean;
}

const gap=(a:WalkPoint,b:WalkPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const same=(a:WalkPoint,b:WalkPoint)=>gap(a,b)<.002;
const point=(b:PioneerBuilding,localZ:number):WalkPoint=>{
 const p=b.parcel;
 return [p.x-localZ*Math.sin(p.rotation),p.z+localZ*Math.cos(p.rotation)];
};

export function pioneerHomeDoor(b:PioneerBuilding):WalkPoint{
 const body=pioneerV6HomesteadPlan(b.parcel)?.building;
 return point(b,body?body.z+body.depth*.505:b.kind==='shelter'?.88:1);
}

function homeHall(b:PioneerBuilding){
 const doorway=pioneerHomeDoor(b);
 return [pioneerEntrance(b.parcel),doorway,point(b,0)] as const;
}

export function samplePioneerResident(f:PioneerFounder,minute:number){
 const m=f.motion;
 if(!m)return {point:f.target,ahead:f.target,moving:false,arrived:true,indoors:null,doorPass:null,carryingFish:false};
 const duration=m.ends-m.starts;
 const progress=duration>0?Math.max(0,Math.min(1,(minute-m.starts)/duration)):1;
 const position=progress===0?m.path[0]:progress===1?m.path.at(-1)!:samplePioneerWalk(m.path,progress);
 const ahead=progress===0||progress===1?position:samplePioneerWalk(m.path,Math.min(1,progress+.016));
 const moving=progress>0&&progress<1;
 const beforeDoor=m.fromHomeId&&m.path.length>1&&
  gap(position,m.path[0])+gap(position,m.path[1])<=gap(m.path[0],m.path[1])+.001;
 const afterDoor=m.toHomeId&&m.path.length>1&&
  gap(position,m.path.at(-2)!)+gap(position,m.path.at(-1)!)<=gap(m.path.at(-2)!,m.path.at(-1)!)+.001;
 return {point:position,ahead,moving,arrived:progress===1&&!m.blocked,
  indoors:progress===0||beforeDoor?m.fromHomeId:progress===1||afterDoor?m.toHomeId:null,
  doorPass:moving?m.toHomeId??m.fromHomeId:null,
  carryingFish:moving&&m.fishPickup!==undefined&&progress>=m.fishPickup};
}

const publicRoutes=new WeakMap<PioneerWorld,{layout:string;paths:Map<string,WalkPoint[]|null>}>();
function publicRoute(s:PioneerWorld,start:WalkPoint,end:WalkPoint,occupied:Parameters<typeof findPioneerWalk>[2]){
 const layout=s.buildings.map(b=>b.parcel.id).join('/');
 let cache=publicRoutes.get(s);
 if(!cache||cache.layout!==layout){
  cache={layout,paths:new Map()};
  publicRoutes.set(s,cache);
 }
 const key=start.join(',')+'/'+end.join(',');
 if(cache.paths.has(key))return cache.paths.get(key)!;
 const result=roadSegmentsSafe([start,end],occupied)?[start,end]:findPioneerWalk(start,end,occupied);
 if(cache.paths.size>=256)cache.paths.clear();
 cache.paths.set(key,result);
 return result;
}

/** Routes are decided at simulation boundaries and persisted with their times.
 * The renderer samples them without feeding movement back into work or stock. */
export function settlePioneerResidentMotion(s:PioneerWorld,previous:ReadonlyMap<number,PioneerFounder>){
 const hour=s.minutes%DAY_MINUTES/60;
 const night=hour>=20||hour<7;
 const homeById=new Map(s.buildings.map(b=>[b.id,b]));
 const occupied=[...pioneerNaturalParcels(s),...s.buildings.map(b=>b.parcel)];
 for(const f of s.founders){
  const old=previous.get(f.id);
  const home=f.homeBuildingId?homeById.get(f.homeBuildingId):undefined;
  const indoors=(night&&f.activity==='shelter')||(hour===7&&f.activity==='eat-home');
  const sleeping=indoors?home:undefined;
  const toHomeId=sleeping?.id??null;
  const oldMotion=old?samplePioneerResident(old,s.minutes):undefined;
  const origin=oldMotion?.point??f.commute?.[0]??(home?pioneerEntrance(home.parcel):f.target);
  const fromHomeId=oldMotion?.indoors??null;
  const fromHome=fromHomeId?homeById.get(fromHomeId):undefined;
  const destination=sleeping?homeHall(sleeping)[2]:f.target;
  if(same(origin,destination)&&fromHomeId===toHomeId){
   if(!f.motion||f.motion.blocked)
    f.motion={path:[destination],starts:s.minutes,ends:s.minutes,fromHomeId,toHomeId};
   continue;
  }
  const previousHall=fromHome?homeHall(fromHome):null;
  const nextHall=sleeping?homeHall(sleeping):null;
  const atYard=home&&!fromHome&&pioneerV6YardWalkable(home.parcel,origin[0],origin[1])&&
   !same(origin,pioneerEntrance(home.parcel));
  const goingToYard=home&&!sleeping&&
   (f.activity==='shelter'||f.activity==='eat-home')&&
   !same(destination,pioneerEntrance(home.parcel));
  const exit=atYard?pioneerEntrance(home.parcel):previousHall?.[0]??origin;
  const entry=goingToYard?pioneerEntrance(home.parcel):nextHall?.[0]??destination;
  const yardCenter=home?pioneerV6CourtyardPoint(home.parcel):null;
  const localRoute=yardCenter&&atYard&&nextHall?[origin,yardCenter,nextHall[1],destination]:
   yardCenter&&goingToYard&&previousHall?[origin,previousHall[1],yardCenter,destination]:null;
  // The approaches end at legal front gates. A gap at an occupied endpoint
  // (for example when builders just completed the site) may require its
  // previous registered approach out to the public network.
  const cached=f.commute;
  const prior=old?.commute;
  const pickup=f.activity==='haul-fish'?cached?.[0]:undefined;
  const approach=pickup?(same(exit,pickup)?[exit]:publicRoute(s,exit,pickup,occupied)):null;
  const delivery=pickup&&approach?publicRoute(s,pickup,entry,occupied):null;
  let main:WalkPoint[]|null;
  if(localRoute)main=localRoute;
  else if(approach&&delivery)main=[...approach,...delivery.slice(1)];
  else if(same(exit,entry))main=[exit];
  else main=publicRoute(s,exit,entry,occupied);
  if(!main&&prior&&cached&&same(prior.at(-1)!,exit)&&same(cached.at(-1)!,entry)&&
   same(prior[0],cached[0])){
   const via=[...prior.slice().reverse(),...cached.slice(1)];
   if(roadSegmentsSafe(via,occupied))main=via;
  }
  if(!main){
   f.motion={path:[origin],starts:s.minutes,ends:s.minutes,
    fromHomeId,toHomeId:fromHomeId,blocked:true};
   continue;
  }
  const leave=previousHall?[origin,previousHall[1]]:atYard?[origin]:[];
  const arrive=nextHall?[nextHall[1],destination]:goingToYard?
   (cached&&same(cached[0],entry)&&same(cached.at(-1)!,destination)?cached.slice(1):[destination]):[];
  const path=(localRoute??[...leave,...main,...arrive]).filter((p,i,all)=>!i||!same(p,all[i-1]));
  const distance=path.reduce((n,p,i)=>i?n+gap(path[i-1],p):n,0);
  const pickupIndex=pickup?path.findIndex(p=>same(p,pickup)):-1;
  const fishPickup=pickupIndex<0||distance===0?undefined:path.slice(0,pickupIndex+1)
   .reduce((n,p,i)=>i?n+gap(path[i-1],p):n,0)/distance;
  const delay=((f.id*7+s.seed)%11+11)%11;
  const duration=Math.min(53-delay,Math.max(3,distance*1.8));
  f.motion={path,starts:s.minutes+delay,ends:s.minutes+delay+duration,fromHomeId,toHomeId,fishPickup,
   carryingWood:old?.activity==='collect-wood'&&f.activity!=='collect-wood'};
 }
}

export function validPioneerResidentMotion(m:PioneerResidentMotion,minute:number){
 return !!m&&Array.isArray(m.path)&&m.path.length>0&&m.path.length<=255&&
  m.path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&
  Number.isFinite(m.starts)&&Number.isFinite(m.ends)&&m.starts<=m.ends&&m.ends<=minute+60&&
  (m.fishPickup===undefined||Number.isFinite(m.fishPickup)&&m.fishPickup>=0&&m.fishPickup<=1)&&
  [m.fromHomeId,m.toHomeId].every(id=>id===null||typeof id==='string');
}
