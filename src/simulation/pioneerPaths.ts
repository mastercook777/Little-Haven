import {distanceToCreekSpline} from './creekCorridor.ts';
import {PIONEER_VALLEY,pioneerIslandFraction} from './pioneerGeography.ts';
import {parcelCorners,type VillageParcel} from './villagePlanning.ts';
import {pioneerV6YardWalkable} from './homesteadPlan.ts';

/** The dirt trails in pioneer mode are actual saved walkable connections. No
 * decorative legacy village roads are required for traversal or rendering. */
export type WalkPoint=readonly [number,number];
export interface PioneerRoad{
 id:string;buildingId:string;points:WalkPoint[];uses:number;
 grade:'track'|'dirt';createdAt:number;
}
const GRID=.68,MIN_X=-19.2,MIN_Z=-10.65,NX=54,NZ=33;
const round=(n:number)=>Math.round(n*1000)/1000;
const ix=(x:number)=>Math.max(0,Math.min(NX-1,Math.round((x-MIN_X)/GRID)));
const iz=(z:number)=>Math.max(0,Math.min(NZ-1,Math.round((z-MIN_Z)/GRID)));
const index=(x:number,z:number)=>z*NX+x;
const coords=(node:number):WalkPoint=>[round(MIN_X+(node%NX)*GRID),round(MIN_Z+Math.floor(node/NX)*GRID)];
const span=(a:WalkPoint,b:WalkPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const riverClear=(p:WalkPoint)=>distanceToCreekSpline(p[0],p[1]);
const insideParcel=(point:WalkPoint,p:VillageParcel,extra=0)=>{
 const dx=point[0]-p.x,dz=point[1]-p.z,cs=Math.cos(p.rotation),sn=Math.sin(p.rotation);
 const x=dx*cs+dz*sn,z=-dx*sn+dz*cs;
 return Math.abs(x)<p.width/2+p.clearance+extra&&Math.abs(z)<p.depth/2+p.clearance+extra;
};
export function pioneerWalkable(p:WalkPoint,occupied:readonly VillageParcel[],allowRiver=false):boolean{
 const [x,z]=p;
 if(pioneerIslandFraction(x,z,PIONEER_VALLEY.walkMarginX,PIONEER_VALLEY.walkMarginZ)>.96)return false;
 if(!allowRiver&&riverClear(p)<2.47)return false;
 // New paid yards are not solid 5x5 blocks to people: keep the timber
 // building and low walls as obstacles, but open the actual front gate and
 // courtyard corridor. Building-to-building SAT still reserves the whole lot.
 return !occupied.some(parcel=>insideParcel(p,parcel,.13)&&
  !pioneerV6YardWalkable(parcel,x,z));
}
export function roadSegmentsSafe(points:readonly WalkPoint[],occupied:readonly VillageParcel[]){
 if(points.length<2)return false;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],length=span(a,b);
  for(let t=0;t<=Math.ceil(length/.22);t++){
   const f=t/Math.max(1,Math.ceil(length/.22));
   const p:WalkPoint=[a[0]*(1-f)+b[0]*f,a[1]*(1-f)+b[1]*f];
   if(!pioneerWalkable(p,occupied))return false;
  }
 }
 return true;
}
/** A* over terrain and the *actual* registered building footprints.
 * The resulting route is immutable in the save and used by both figures and roads. */
export function findPioneerWalk(start:WalkPoint,end:WalkPoint,occupied:readonly VillageParcel[]):WalkPoint[]|null{
 if(!pioneerWalkable(start,occupied)||!pioneerWalkable(end,occupied))return null;
 const count=NX*NZ;
 const passable=new Uint8Array(count);
 for(let k=0;k<count;k++)if(pioneerWalkable(coords(k),occupied))passable[k]=1;
 const nearest=(p:WalkPoint):number=>{
  const x=ix(p[0]),z=iz(p[1]);
  let best=-1,bestDistance=Infinity;
  for(let radius=0;radius<=3;radius++){
   for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
    const gx=x+dx,gz=z+dz;if(gx<0||gx>=NX||gz<0||gz>=NZ)continue;
    const k=index(gx,gz);if(!passable[k])continue;
    const d=span(p,coords(k));
    if(d<bestDistance){best=k;bestDistance=d;}
   }
   if(best>=0&&bestDistance<=GRID*1.30)break;
  }
  return best;
 };
 const first=nearest(start),last=nearest(end);
 if(first<0||last<0)return null;
 const cost=new Float64Array(count);cost.fill(Infinity);
 const back=new Int32Array(count);back.fill(-1);
 const closed=new Uint8Array(count),open:number[]=[first];cost[first]=0;
 const h=(k:number)=>span(coords(k),coords(last));
 while(open.length){
  let best=0;
  for(let i=1;i<open.length;i++)
   if(cost[open[i]]+h(open[i])<cost[open[best]]+h(open[best]))best=i;
  const current=open.splice(best,1)[0];
  if(current===last)break;
  if(closed[current])continue;closed[current]=1;
  const x=current%NX,z=Math.floor(current/NX);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const nx=x+dx,nz=z+dz;if(nx<0||nx>=NX||nz<0||nz>=NZ)continue;
   const neighbor=index(nx,nz);if(!passable[neighbor]||closed[neighbor])continue;
   if(dx&&dz&&(!passable[index(nx,z)]||!passable[index(x,nz)]))continue;
   const candidate=cost[current]+Math.hypot(dx,dz);
   if(candidate>=cost[neighbor])continue;
   cost[neighbor]=candidate;back[neighbor]=current;
   if(!open.includes(neighbor))open.push(neighbor);
  }
 }
 if(!Number.isFinite(cost[last]))return null;
 const reverse:number[]=[];
 for(let k=last;k!==-1;k=back[k]){
  reverse.push(k);
  if(reverse.length>count)return null;
 }
 reverse.reverse();
 const raw:WalkPoint[]=[start,...reverse.map(coords),end];
 // Keep corner nodes. Simplify only collinear strides after verifying the
 // original points; never cut diagonally through the edge of a house.
 const result:WalkPoint[]=[raw[0]];
 for(let i=1;i<raw.length-1;i++){
  const prev=result[result.length-1],curr=raw[i],next=raw[i+1];
  const ax=curr[0]-prev[0],az=curr[1]-prev[1],bx=next[0]-curr[0],bz=next[1]-curr[1];
  if(Math.abs(ax*bz-az*bx)>.0001||ax*bx+az*bz<0)result.push(curr);
 }
 result.push(end);
 if(!roadSegmentsSafe(result,occupied))return null;
 return result.map(p=>[round(p[0]),round(p[1])]);
}
export function pioneerEntrance(p:VillageParcel):WalkPoint{
 // Both cottage and pioneer shelter have a +Z local doorway.
 const reach=p.depth/2+p.clearance+.52;
 return [round(p.x-Math.sin(p.rotation)*reach),
  round(p.z+Math.cos(p.rotation)*reach)];
}
export function pioneerBuildingPath(camp:{x:number;z:number},p:VillageParcel,
 occupied:readonly VillageParcel[]):WalkPoint[]|null{
 const blockers=occupied.filter(other=>other.id!==p.id);
 // The start must not clip the campfire/its pads. The entry avoids this
 // building's eaves, while other buildings remain fully collidable.
 const route=findPioneerWalk([camp.x,camp.z],pioneerEntrance(p),blockers);
 if(!route||!roadSegmentsSafe(route,blockers))return null;
 return route;
}
export function samplePioneerWalk(points:readonly WalkPoint[],fraction:number):WalkPoint{
 if(!points.length)return [0,0];if(points.length===1)return points[0];
 const lengths=points.slice(1).map((p,i)=>span(p,points[i]));
 const total=lengths.reduce((sum,x)=>sum+x,0);
 let remaining=Math.max(0,Math.min(1,fraction))*total;
 for(let i=0;i<lengths.length;i++){
  const d=lengths[i];
  if(remaining>d){remaining-=d;continue;}
  const t=d?remaining/d:1;
  return [points[i][0]+(points[i+1][0]-points[i][0])*t,
   points[i][1]+(points[i+1][1]-points[i][1])*t];
 }
 return points.at(-1)!;
}
export function roadGeometrySignature(roads:readonly PioneerRoad[]):string{
 return roads.map(road=>road.id+':'+road.grade+':'+road.points.length).join('|');
}
