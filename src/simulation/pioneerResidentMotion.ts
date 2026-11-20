import {DAY_MINUTES} from './calendar.ts';
import {pioneerV6CourtyardPoint,pioneerV6HomesteadPlan,pioneerV6YardWalkable} from './homesteadPlan.ts';
import {pioneerNaturalParcels} from './pioneerNaturalAnchors.ts';
import {findPioneerWalk,pioneerEntrance,pioneerWalkable,roadSegmentsSafe,samplePioneerWalk,type WalkPoint} from './pioneerPaths.ts';
import type {VillageParcel} from './villagePlanning.ts';
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
 workAnchor?:string;
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
 const layout=occupied.map(p=>p.id).join('/');
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

function clearNewWorksite(origin:WalkPoint,occupied:readonly VillageParcel[],pending:VillageParcel|undefined){
 if(pioneerWalkable(origin,occupied))return null;
 const parcel=occupied.find(p=>p.kind!=='protected'&&!pioneerWalkable(origin,[p]));
 if(!parcel)return null;
 const {x,z,rotation,clearance,width,depth}=parcel;
 const cs=Math.cos(rotation),sn=Math.sin(rotation);
 const localX=(origin[0]-x)*cs+(origin[1]-z)*sn;
 const localZ=-(origin[0]-x)*sn+(origin[1]-z)*cs;
 if(parcel!==pending&&Math.abs(localX)<width/2&&Math.abs(localZ)<depth/2)return null;
 const edgeX=width/2+clearance+.15,edgeZ=depth/2+clearance+.15;
 const options:WalkPoint[]=[
  [-edgeX,localZ],[edgeX,localZ],[localX,-edgeZ],[localX,edgeZ]
 ].map(([a,b])=>[Math.round((x+a*cs-b*sn)*1000)/1000,
  Math.round((z+a*sn+b*cs)*1000)/1000]);
 const others=occupied.filter(p=>p!==parcel);
 return options.sort((a,b)=>gap(a,origin)-gap(b,origin)).find(p=>
  pioneerWalkable(p,occupied)&&roadSegmentsSafe([origin,p],others))??null;
}

const nearbyWork:Readonly<Partial<Record<PioneerFounder['activity'],number>>>={
 'collect-wood':1.35,forage:1.20,'fetch-water':.9,farm:1.03,
 build:1.14,repair:1.05,'commons-build':1.10,eat:1.05,socialize:1.18,
 'tend-fire':.83,rest:.86
};
const standingDirections=Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6),Math.sin(i*Math.PI/6)] as const);

function workPosition(
 f:PioneerFounder, origin:WalkPoint, reserved:readonly WalkPoint[],
 occupied:Parameters<typeof roadSegmentsSafe>[1], anchor:string
):WalkPoint{
 const radius=nearbyWork[f.activity];
 if(!radius)return f.target;
 const clear=(p:WalkPoint)=>reserved.every(q=>gap(p,q)>=.67);
 if(f.motion?.workAnchor===anchor&&clear(origin)&&
  roadSegmentsSafe([f.target,origin],occupied))return origin;
 // Work and rest spots use the same land/river/structure checks as public roads.
 // Rotation is by resident, so a recurring task doesn't create hourly wandering.
 const offset=(f.id*5)%standingDirections.length;
 const construction=f.activity==='build'||f.activity==='repair'||f.activity==='commons-build';
 const radii=construction?[radius,radius+.72,radius+1.44]:[radius];
 for(const r of radii){
  for(let n=0;n<standingDirections.length;n++){
   const [dx,dz]=standingDirections[(n+offset)%standingDirections.length];
   const p:WalkPoint=[Math.round((f.target[0]+dx*r)*1000)/1000,
    Math.round((f.target[1]+dz*r)*1000)/1000];
   if(clear(p)&&roadSegmentsSafe([f.target,p],occupied))return p;
  }
 }
 return f.target;
}

function householdSchedule(s:PioneerWorld,f:PioneerFounder){
 const day=Math.floor(s.minutes/DAY_MINUTES);
 return ((s.seed+f.id+Math.floor(day/3))%3+3)%3;
}

/** Routes are decided at simulation boundaries and persisted with their times.
 * The renderer samples them without feeding movement back into work or stock. */
export function settlePioneerResidentMotion(s:PioneerWorld,previous:ReadonlyMap<number,PioneerFounder>){
 const hour=s.minutes%DAY_MINUTES/60;

 const homeById=new Map(s.buildings.map(b=>[b.id,b]));
 const pending=s.intent?.parcel??undefined;
 const occupied=[...pioneerNaturalParcels(s),...s.buildings.map(b=>b.parcel)];
 if(pending&&!occupied.some(p=>p.id===pending.id))occupied.push(pending);
 const reserved:WalkPoint[]=[];
 for(const f of s.founders){
  const old=previous.get(f.id);
  const home=f.homeBuildingId?homeById.get(f.homeBuildingId):undefined;
  const schedule=householdSchedule(s,f);
  const bedtime=s.founders.length<=4?20:19+schedule;
  const night=hour>=bedtime||hour<7;
  const earlyBreakfast=s.founders.length>4&&hour===7&&schedule===0;
  const indoors=(night&&f.activity==='shelter')||(hour===7&&f.activity==='eat-home'&&!earlyBreakfast);
  const sleeping=indoors?home:undefined;
  const toHomeId=sleeping?.id??null;
  const oldMotion=old?samplePioneerResident(old,s.minutes):undefined;
  const origin=oldMotion?.point??f.commute?.[0]??(home?pioneerEntrance(home.parcel):f.target);
  const fromHomeId=oldMotion?.indoors??null;
  const fromHome=fromHomeId?homeById.get(fromHomeId):undefined;
  const workAnchor=nearbyWork[f.activity]?f.activity+'/'+f.target.join(','):undefined;
  const destination=sleeping?homeHall(sleeping)[2]:f.activity==='eat-break'?origin:
   workAnchor?workPosition(f,origin,reserved,occupied,workAnchor):f.target;
  if(!toHomeId)reserved.push(destination);
  if(same(origin,destination)&&fromHomeId===toHomeId&&
   (toHomeId||pioneerWalkable(origin,occupied)||home&&pioneerV6YardWalkable(home.parcel,...origin))){
   if(!f.motion||f.motion.blocked||f.motion.workAnchor!==workAnchor)
    f.motion={path:[destination],starts:s.minutes,ends:s.minutes,fromHomeId,toHomeId,
     ...(workAnchor?{workAnchor}:{})};
   continue;
  }
  const previousHall=fromHome?homeHall(fromHome):null;
  const nextHall=sleeping?homeHall(sleeping):null;
  const atYard=home&&!fromHome&&pioneerV6YardWalkable(home.parcel,origin[0],origin[1])&&
   !same(origin,pioneerEntrance(home.parcel));
  const goingToYard=home&&!sleeping&&
   pioneerV6YardWalkable(home.parcel,destination[0],destination[1])&&
   !same(destination,pioneerEntrance(home.parcel));
  const sourceAnchor=atYard||previousHall?null:clearNewWorksite(origin,occupied,pending)??
   (old&&!same(old.target,origin)&&roadSegmentsSafe([origin,old.target],occupied)?old.target:null);
  const destinationAnchor=workAnchor&&!same(f.target,destination)?f.target:null;
  const exit=atYard?pioneerEntrance(home.parcel):previousHall?.[0]??sourceAnchor??origin;
  const entry=goingToYard?pioneerEntrance(home.parcel):nextHall?.[0]??destinationAnchor??destination;
  const yardCenter=home?pioneerV6CourtyardPoint(home.parcel):null;
  const localRoute=yardCenter&&atYard&&nextHall?[origin,yardCenter,nextHall[1],destination]:
   yardCenter&&goingToYard&&previousHall?[origin,previousHall[1],yardCenter,destination]:
   yardCenter&&atYard&&goingToYard?[origin,yardCenter,destination]:null;
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
  else if(!atYard&&!goingToYard&&!previousHall&&!nextHall&&
   roadSegmentsSafe([origin,destination],occupied))main=[origin,destination];
  else if(same(exit,entry))main=[exit];
  else main=publicRoute(s,exit,entry,occupied);
  if(!main&&prior&&cached&&same(prior.at(-1)!,exit)&&same(cached.at(-1)!,entry)&&
   same(prior[0],cached[0])){
   const via=[...prior.slice().reverse(),...cached.slice(1)];
   if(roadSegmentsSafe(via,occupied))main=via;
  }
  if(!main&&sourceAnchor&&pioneerWalkable(sourceAnchor,occupied))main=[sourceAnchor];
  if(!main){
   f.motion={path:[origin],starts:s.minutes,ends:s.minutes,
    fromHomeId,toHomeId:fromHomeId,blocked:true};
   continue;
  }
  const leave=previousHall?[origin,previousHall[1]]:
   atYard?[origin,...(yardCenter?[yardCenter]:[])]:sourceAnchor?[origin]:[];
  const arrive=nextHall?[nextHall[1],destination]:goingToYard?
   [...(yardCenter?[yardCenter]:[]),destination]:destinationAnchor?[destination]:[];
  const reached=same(main.at(-1)!,entry)||same(main.at(-1)!,destination);
  const route=localRoute??[
   ...(same(main[0],origin)?[]:leave),...main,
   ...(!reached||same(main.at(-1)!,destination)?[]:arrive)
  ];
  const path=route.filter((p,i,all)=>!i||!same(p,all[i-1]));
  const distance=path.reduce((n,p,i)=>i?n+gap(path[i-1],p):n,0);
  const pickupIndex=pickup?path.findIndex(p=>same(p,pickup)):-1;
  const fishPickup=pickupIndex<0||distance===0?undefined:path.slice(0,pickupIndex+1)
   .reduce((n,p,i)=>i?n+gap(path[i-1],p):n,0)/distance;
  const ordinaryDelay=((f.id*7+s.seed)%13+13)%13;
  const delay=fromHomeId&&!toHomeId&&hour===7?30+ordinaryDelay:
   fromHomeId&&!toHomeId&&hour===8?ordinaryDelay+(schedule===2?21:0):
   toHomeId&&!fromHomeId&&hour>=19?ordinaryDelay+(schedule===1?10:0):ordinaryDelay;
  const duration=Math.min(57-delay,Math.max(3,distance*(1.6+(f.id%5)*.12)));
  f.motion={path,starts:s.minutes+delay,ends:s.minutes+delay+duration,fromHomeId,
   toHomeId:reached?toHomeId:null,
   ...(!reached?{blocked:true}:{}),
   ...(fishPickup===undefined?{}:{fishPickup}),
   ...(workAnchor?{workAnchor}:{}),
   carryingWood:old?.activity==='collect-wood'&&f.activity!=='collect-wood'};
 }
}

export function validPioneerResidentMotion(m:PioneerResidentMotion,minute:number){
 return !!m&&Array.isArray(m.path)&&m.path.length>0&&m.path.length<=255&&
  m.path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&
  (m.workAnchor===undefined||typeof m.workAnchor==='string'&&m.workAnchor.length<=100)&&
  Number.isFinite(m.starts)&&Number.isFinite(m.ends)&&m.starts<=m.ends&&m.ends<=minute+60&&
  (m.fishPickup===undefined||Number.isFinite(m.fishPickup)&&m.fishPickup>=0&&m.fishPickup<=1)&&
  [m.fromHomeId,m.toHomeId].every(id=>id===null||typeof id==='string');
}
