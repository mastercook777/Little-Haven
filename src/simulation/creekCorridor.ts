import {VALLEY_RIVER,type GroundPoint} from './valleyGeography.ts';

/** One numerical Catmull–Rom creek center used by the classic water mesh,
 * pioneer bank exclusion, pathfinding, splash placement and carved terrain.
 * Centripetal curve exactly matches Three CatmullRomCurve3(...,'centripetal').
 * Keep the authored river coordinates and source width in one place. */
export const CREEK_WATER_HALF_WIDTH=1.38;
export const CREEK_BANK_HALF_WIDTH=2.42;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function point1D(p0:number,p1:number,p2:number,p3:number,
 dt0:number,dt1:number,dt2:number,t:number){
 const m1=((p1-p0)/dt0-(p2-p0)/(dt0+dt1)+(p2-p1)/dt1)*dt1;
 const m2=((p2-p1)/dt1-(p3-p1)/(dt1+dt2)+(p3-p2)/dt2)*dt1;
 const c2=-3*p1+3*p2-2*m1-m2,c3=2*p1-2*p2+m1+m2;
 return p1+m1*t+c2*t*t+c3*t*t*t;
}
const squared=(a:GroundPoint,b:GroundPoint)=>
 (a[0]-b[0])**2+(a[1]-b[1])**2;
export function creekPointAt(parameter:number):GroundPoint{
 const points=VALLEY_RIVER,len=points.length;
 const p=(len-1)*clamp(parameter,0,1),i=Math.min(len-2,Math.floor(p)),t=p-i;
 const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],
  p3=points[Math.min(len-1,i+2)];
 let d0=Math.pow(squared(p0,p1),.25),
  d1=Math.pow(squared(p1,p2),.25),
  d2=Math.pow(squared(p2,p3),.25);
 if(d1<1e-4)d1=1;
 if(d0<1e-4)d0=d1;
 if(d2<1e-4)d2=d1;
 return [point1D(p0[0],p1[0],p2[0],p3[0],d0,d1,d2,t),
  point1D(p0[1],p1[1],p2[1],p3[1],d0,d1,d2,t)];
}
export function creekTangentAt(parameter:number):GroundPoint{
 const lo=creekPointAt(Math.max(0,parameter-.0001)),
  hi=creekPointAt(Math.min(1,parameter+.0001));
 const dx=hi[0]-lo[0],dz=hi[1]-lo[1],length=Math.hypot(dx,dz)||1;
 return [dx/length,dz/length];
}
/** Closest distance to the *rendered curve*, not the old corner-to-corner
 * river waypoint polyline. 100 chord segments give sub-.01 m sampling error. */
const SAMPLES=100;
const creekSamples=Array.from({length:SAMPLES+1},(_,i)=>creekPointAt(i/SAMPLES));
// A* and building surveys repeat the same 0.001-unit coordinates thousands
// of times. Bound caching keeps precise shared-spline checks inexpensive.
const distanceCache=new Map<string,number>();
const MAX_CACHED_DISTANCES=30000;
export function distanceToCreekSpline(x:number,z:number):number{
 const key=Math.round(x*1000)+':'+Math.round(z*1000);
 const cached=distanceCache.get(key);if(cached!==undefined)return cached;
 let nearest=Infinity;
 for(let i=0;i<SAMPLES;i++){
  const [ax,az]=creekSamples[i],[bx,bz]=creekSamples[i+1];
  const vx=bx-ax,vz=bz-az,den=vx*vx+vz*vz;
  const t=den?clamp(((x-ax)*vx+(z-az)*vz)/den,0,1):0;
  nearest=Math.min(nearest,Math.hypot(x-ax-t*vx,z-az-t*vz));
 }
 if(distanceCache.size>=MAX_CACHED_DISTANCES)distanceCache.clear();
 distanceCache.set(key,nearest);
 return nearest;
}
export function creekSurfaceHalfWidthAt(_parameter:number){return CREEK_WATER_HALF_WIDTH;}
export function creekBankOuterWidthAt(_parameter:number){return CREEK_BANK_HALF_WIDTH;}
