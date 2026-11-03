import {VALLEY_BOUNDS,VALLEY_RIVER,VALLEY_ROUTES,VALLEY_PINES,VALLEY_BAMBOO,type GroundPoint} from './valleyGeography.ts';
import type {VillageDirection} from './villageGrowth.ts';

/** Local XZ footprint covers the roof eave, porch and its reserved walkway. */
export interface VillageParcel{
 id:string;kind:'dwelling'|'workshop'|'store'|'protected';
 x:number;z:number;width:number;depth:number;rotation:number;
 clearance:number;accessX:number;accessZ:number;builtAt:number;
}
export type PlotValidation='ok'|'outside-island'|'river-bank'|'road-closure'|'existing-building'|'no-road-access';
export interface PlotResult{ok:boolean;reason:PlotValidation;nearRoad:number;}
const s=(n:number)=>Math.sin(n),c=(n:number)=>Math.cos(n);
const dist=(x:number,z:number,y:number,w:number)=>Math.hypot(x-y,z-w);
const P=(x:number,z:number):GroundPoint=>[x,z];
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const hash=(n:number)=>{
 let k=(n>>>0)^0x9e3779b9;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return ((k^(k>>>16))>>>0)/4294967296;
};
/** World-space 4 corners including the requested separation margin. */
export function parcelCorners(p:Pick<VillageParcel,'x'|'z'|'width'|'depth'|'rotation'|'clearance'>,
 extra=0):GroundPoint[]{
 const w=p.width/2+p.clearance+extra,d=p.depth/2+p.clearance+extra;
 const cs=c(p.rotation),sn=s(p.rotation);
 return [[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>P(p.x+x*cs-z*sn,p.z+x*sn+z*cs));
}
function projection(corners:GroundPoint[],ax:number,az:number):readonly [number,number]{
 let lo=Infinity,hi=-Infinity;
 for(const [x,z] of corners){const value=x*ax+z*az;lo=Math.min(lo,value);hi=Math.max(hi,value);}
 return [lo,hi];
}
/** SAT rectangle collision; touching at the requested gap counts as safe. */
export function parcelOverlaps(a:VillageParcel,b:VillageParcel):boolean{
 const ac=parcelCorners(a),bc=parcelCorners(b);
 for(const poly of [ac,bc])for(let i=0;i<4;i++){
  const edge=poly[(i+1)%4],current=poly[i];
  const ax=-(edge[1]-current[1]),az=edge[0]-current[0];
  const [a0,a1]=projection(ac,ax,az),[b0,b1]=projection(bc,ax,az);
  if(a1<=b0+1e-7||b1<=a0+1e-7)return false;
 }
 return true;
}
function nearestOnSegment(p:GroundPoint,a:GroundPoint,b:GroundPoint):{point:GroundPoint;distance:number}{
 const dx=b[0]-a[0],dz=b[1]-a[1],sq=dx*dx+dz*dz;
 const t=sq?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/sq,0,1):0;
 const point=P(a[0]+dx*t,a[1]+dz*t);
 return {point,distance:dist(p[0],p[1],point[0],point[1])};
}
function orient(a:GroundPoint,b:GroundPoint,p:GroundPoint){
 return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
}
function segmentsCross(a:GroundPoint,b:GroundPoint,c0:GroundPoint,d:GroundPoint){
 const a0=orient(a,b,c0),a1=orient(a,b,d),b0=orient(c0,d,a),b1=orient(c0,d,b);
 return a0*a1<0&&b0*b1<0;
}
function edgeDistance(a:GroundPoint,b:GroundPoint,c0:GroundPoint,d:GroundPoint):number{
 if(segmentsCross(a,b,c0,d))return 0;
 return Math.min(nearestOnSegment(a,c0,d).distance,nearestOnSegment(b,c0,d).distance,
  nearestOnSegment(c0,a,b).distance,nearestOnSegment(d,a,b).distance);
}
function pointInConvex(point:GroundPoint,poly:GroundPoint[]){
 let sign=0;
 for(let i=0;i<poly.length;i++){
  const v=orient(poly[i],poly[(i+1)%poly.length],point);
  if(Math.abs(v)<1e-9)continue;
  if(!sign)sign=Math.sign(v);
  else if(Math.sign(v)!==sign)return false;
 }
 return true;
}
export function parcelLineDistance(parcel:VillageParcel,polyline:readonly GroundPoint[]):number{
 const corners=parcelCorners(parcel);
 let nearest=Infinity;
 for(let i=0;i<polyline.length-1;i++){
  const p=polyline[i],q=polyline[i+1];
  if(pointInConvex(p,corners)||pointInConvex(q,corners))return 0;
  for(let j=0;j<4;j++)
   nearest=Math.min(nearest,edgeDistance(corners[j],corners[(j+1)%4],p,q));
 }
 return nearest;
}
export function nearestRoad(x:number,z:number):{point:GroundPoint;distance:number;route:number}{
 const p=P(x,z);let best={point:P(0,0),distance:Infinity,route:-1};
 for(let i=0;i<VALLEY_ROUTES.length;i++){
  const line=VALLEY_ROUTES[i];
  for(let j=0;j<line.length-1;j++){
   const found=nearestOnSegment(p,line[j],line[j+1]);
   if(found.distance<best.distance)best={...found,route:i};
  }
 }
 return best;
}
/** Polyline protection deliberately includes full shore slope, not only water. */
export function riverDistance(parcel:VillageParcel):number{
 // Shared source river center line. Do not use just the nearest polygon vertex.
 return parcelLineDistance(parcel,VALLEY_RIVER);
}
export const BASE_PARCELS:readonly VillageParcel[]=[
 // Full roof/eave + porch projection, not the dimensions of a wall box.
 {id:'inn-001',kind:'protected',x:-3.4,z:.80,width:7.25,depth:7.20,rotation:0,clearance:.25,accessX:-3.3,accessZ:4.75,builtAt:0},
 {id:'home-0',kind:'protected',x:-9,z:-5.25,width:4.1,depth:3.70,rotation:0,clearance:.20,accessX:-8.9,accessZ:-2.80,builtAt:0},
 {id:'home-1',kind:'protected',x:-9.8,z:3.35,width:3.9,depth:4.15,rotation:0,clearance:.20,accessX:-9.2,accessZ:5.8,builtAt:0},
 {id:'home-2',kind:'protected',x:3.4,z:-5.35,width:4.3,depth:4.20,rotation:0,clearance:.20,accessX:3.4,accessZ:-2.9,builtAt:0},
 {id:'home-3',kind:'protected',x:-.7,z:-7.60,width:3.65,depth:3.60,rotation:0,clearance:.20,accessX:0,accessZ:-5.2,builtAt:0},
 {id:'home-4',kind:'protected',x:-11.6,z:-.1,width:3.60,depth:3.50,rotation:0,clearance:.20,accessX:-10.6,accessZ:2.0,builtAt:0},
 {id:'training-ground',kind:'protected',x:1.6,z:6.1,width:4.5,depth:4.45,rotation:0,clearance:.30,accessX:1.6,accessZ:3.8,builtAt:0},
 {id:'bridge-crossing',kind:'protected',x:8.3,z:2.2,width:6.6,depth:3.05,rotation:0,clearance:.35,accessX:6.1,accessZ:2.2,builtAt:0}
];
const branches:Record<VillageDirection,readonly VillageParcel[]>={
 bridge:[
  {id:'bridge-market',kind:'protected',x:12.35,z:-1.15,width:4.4,depth:3.55,rotation:0,clearance:.25,accessX:11.0,accessZ:2.0,builtAt:0},
  {id:'bridge-merchant',kind:'protected',x:12.58,z:3.38,width:3.85,depth:3.60,rotation:0,clearance:.15,accessX:12.6,accessZ:2.1,builtAt:0},
  {id:'bridge-guest',kind:'protected',x:12,z:-5.25,width:3.40,depth:3.25,rotation:0,clearance:.15,accessX:12,accessZ:0,builtAt:0}
 ],
 ferry:[
  {id:'ferry-yard',kind:'protected',x:10.8,z:-2.55,width:4.5,depth:4.0,rotation:0,clearance:.25,accessX:11.4,accessZ:1.0,builtAt:0},
  {id:'ferry-house-1',kind:'protected',x:10.4,z:-6.1,width:4.0,depth:3.50,rotation:0,clearance:.15,accessX:11.0,accessZ:-4,builtAt:0},
  {id:'ferry-house-2',kind:'protected',x:11.45,z:-8.2,width:3.75,depth:3.25,rotation:0,clearance:.15,accessX:11.1,accessZ:-6.0,builtAt:0}
 ],
 grove:[
  {id:'grove-orchard',kind:'protected',x:-3.4,z:8.25,width:6.2,depth:5.0,rotation:0,clearance:.18,accessX:-4.0,accessZ:5.1,builtAt:0},
  {id:'grove-house-1',kind:'protected',x:-5.6,z:-8.1,width:4.1,depth:3.75,rotation:0,clearance:.15,accessX:-5,accessZ:-5.9,builtAt:0},
  {id:'grove-house-2',kind:'protected',x:-1.75,z:-9.35,width:3.35,depth:3.15,rotation:0,clearance:.15,accessX:-1.7,accessZ:-6.8,builtAt:0}
 ]
};
export function reservedParcels(choice:VillageDirection|null):VillageParcel[]{
 const vegetation=[...VALLEY_PINES.map(([x,z,size],i)=>({
  id:'pine-'+i,kind:'protected' as const,x,z,width:1.85*size,depth:1.85*size,
  rotation:0,clearance:.12,accessX:x,accessZ:z,builtAt:0
 })),...VALLEY_BAMBOO.map(([x,z,size],i)=>({
  id:'bamboo-'+i,kind:'protected' as const,x,z,width:1.75*size,depth:1.75*size,
  rotation:0,clearance:.10,accessX:x,accessZ:z,builtAt:0
 }))];
 return [...BASE_PARCELS,...(choice?branches[choice]:[]),...vegetation].map(x=>({...x}));
}
export function validateVillageParcel(parcel:VillageParcel,occupied:readonly VillageParcel[],
 accessLimit=4.15):PlotResult{
 const corners=parcelCorners(parcel,.90);
 if(corners.some(([x,z])=>(x/(VALLEY_BOUNDS.radiusX-1.05))**2+
  (z/(VALLEY_BOUNDS.radiusZ-1.05))**2>=1))return {ok:false,reason:'outside-island',nearRoad:Infinity};
 // Slope protection includes a full ~1.6-unit shoulder beyond the water.
 if(riverDistance(parcel)<.72)return {ok:false,reason:'river-bank',nearRoad:Infinity};
 if(VALLEY_ROUTES.some((line,i)=>parcelLineDistance(parcel,line)<(i===0?.43:.20)))
  return {ok:false,reason:'road-closure',nearRoad:0};
 if(occupied.some(other=>other.id!==parcel.id&&parcelOverlaps(parcel,other)))
  return {ok:false,reason:'existing-building',nearRoad:Infinity};
 const road=nearestRoad(parcel.x,parcel.z);
 if(road.distance>accessLimit)return {ok:false,reason:'no-road-access',nearRoad:road.distance};
 return {ok:true,reason:'ok',nearRoad:road.distance};
}
export interface ParcelRequest{
 direction:VillageDirection;seed:number;sequence:number;builtAt:number;
 kind:'dwelling'|'workshop'|'store';
 occupied:readonly VillageParcel[];
}
export function proposeVillageParcel(request:ParcelRequest):VillageParcel|null{
 const spec=request.kind==='dwelling'?{width:2.28,depth:2.85}:request.kind==='workshop'?
  {width:2.74,depth:3.04}:{width:2.65,depth:2.62};
 const occupied=[...reservedParcels(request.direction),...request.occupied];
 const options:{parcel:VillageParcel;score:number}[]=[];
 const center=request.direction==='bridge'?P(2.9,1.7):request.direction==='ferry'?
  P(3.0,-4.0):P(-7.0,3.5);
 const offsetX=hash(request.seed+request.sequence*1103)*.42;
 const offsetZ=hash(request.seed+request.sequence*2249)*.42;
 for(let i=-22;i<=22;i++)for(let j=-17;j<=17;j++){
  const x=i*.68+offsetX,z=j*.63+offsetZ;
  for(const angle of [0,Math.PI/2]){
   const nearest=nearestRoad(x,z);
   const entry=nearest.point;
   const parcel:VillageParcel={
    id:'living-'+request.seed+'-'+request.sequence,
    kind:request.kind,x:+x.toFixed(3),z:+z.toFixed(3),
    width:spec.width,depth:spec.depth,rotation:angle,clearance:.36,
    accessX:entry[0],accessZ:entry[1],builtAt:request.builtAt
   };
   const valid=validateVillageParcel(parcel,occupied);
   if(!valid.ok)continue;
   // Neighborhood use, access, current spatial demands and seed variety all
   // matter. There are no fixed sockets or hard-coded cottage coordinates.
   const placeBias=dist(x,z,center[0],center[1])*.09;
   const accessBias=Math.abs(nearest.distance-2.28)*.24;
   const seedBias=hash(request.seed+i*731+j*971+request.sequence*997+Math.round(angle*100))*.72;
   const sunlight=Math.abs(x)/20*.04;
   options.push({parcel,score:placeBias+accessBias+seedBias+sunlight});
  }
 }
 options.sort((a,b)=>a.score-b.score||a.parcel.x-b.parcel.x||a.parcel.z-b.parcel.z);
 return options[0]?.parcel??null;
}
