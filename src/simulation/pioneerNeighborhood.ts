import type {PioneerWorld,PioneerBuildKind} from './pioneerWorld.ts';
import type {VillageParcel} from './villagePlanning.ts';
import {pioneerEntrance,type PioneerRoad,type WalkPoint} from './pioneerPaths.ts';

/** v0.5.6D: road truth is the persisted pioneer track network,
 * NEVER the prebuilt classic village VALLEY_ROUTES. */
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const dist=(x:number,z:number,p:{x:number;z:number})=>Math.hypot(x-p.x,z-p.z);
function footOnSegment(x:number,z:number,a:WalkPoint,b:WalkPoint){
 const dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
 const t=len2?clamp(((x-a[0])*dx+(z-a[1])*dz)/len2,0,1):0;
 const px=a[0]+dx*t,pz=a[1]+dz*t;
 return {point:[px,pz] as WalkPoint,distance:Math.hypot(x-px,z-pz)};
}
export function nearestPioneerRoad(
 x:number,z:number,roads:readonly PioneerRoad[]):
 {point:WalkPoint;distance:number;roadId:string}|null{
 let best:{point:WalkPoint;distance:number;roadId:string}|null=null;
 for(const road of roads)for(let i=1;i<road.points.length;i++){
  const hit=footOnSegment(x,z,road.points[i-1],road.points[i]);
  if(!best||hit.distance<best.distance)
   best={...hit,roadId:road.id};
 }
 return best;
}
export interface PioneerNeighborhoodScore {
 readonly roadDistance:number|null;
 readonly doorRoadPreference:number;
 readonly neighborPreference:number;
 readonly livelihoodPreference:number;
 readonly total:number;
}
const nearestBuilt=(s:PioneerWorld,kind:PioneerBuildKind,x:number,z:number)=>{
 const found=s.buildings.filter(b=>b.kind===kind);
 return found.length?Math.min(...found.map(b=>dist(x,z,b.parcel))):null;
};
const nearestSource=(s:PioneerWorld,kind:string,x:number,z:number)=>{
 const found=s.sites.filter(site=>site.kind===kind);
 return found.length?Math.min(...found.map(site=>dist(x,z,site))):null;
};
/** Soft score of a geometrically LEGAL candidate. SAT, reachable doorway and
 * all actual resource routes remain mandatory checks in pioneerGrowth.
 * All bonuses/penalties are bounded to prevent scoring from defeating survival.
 * No scene creation, save mutation, LLM, frame time or fake roads. */
export function pioneerNeighborhoodScore(
 s:PioneerWorld,kind:Exclude<PioneerBuildKind,'shelter'>,
 parcel:VillageParcel):PioneerNeighborhoodScore{
 const [ex,ez]=pioneerEntrance(parcel);
 const road=nearestPioneerRoad(ex,ez,s.roads);
 // Orient the REAL front entrance toward an actual used road; with no
 // completed roads all orientations are scored neutrally.
 const doorRoadPreference=road?clamp(road.distance,0,5)*.18:0;
 const x=parcel.x,z=parcel.z;
 let neighborPreference=0,livelihoodPreference=0;
 const home=nearestBuilt(s,'cottage',x,z);
 if(kind==='cottage'){
  if(home!==null)neighborPreference=clamp(Math.abs(home-4.65)*.18,0,1.0);
 }else if(kind==='garden'){
  if(home!==null)neighborPreference=clamp(Math.abs(home-5.4)*.09,0,.70);
  const garden=nearestBuilt(s,'garden',x,z);
  if(garden!==null)neighborPreference+=clamp(Math.abs(garden-5.0)*.07,0,.45);
 }else if(kind==='wood-yard'){
  if(home!==null)neighborPreference=clamp(Math.max(0,6.1-home)*.19,0,.70);
  const forest=nearestSource(s,'forest',x,z);
  if(forest!==null)livelihoodPreference=clamp(Math.abs(forest-4.8)*.15,0,.95);
 }else if(kind==='granary'){
  const garden=nearestBuilt(s,'garden',x,z);
  if(garden!==null)livelihoodPreference=clamp(Math.abs(garden-4.2)*.16,0,.90);
  if(home!==null)neighborPreference=clamp(Math.max(0,4.1-home)*.18,0,.45);
 }else if(kind==='fish-hut'){
  const fish=nearestSource(s,'fish',x,z);
  if(fish!==null)livelihoodPreference=clamp(Math.abs(fish-4.0)*.12,0,.65);
 }else if(kind==='tea-stop'){
  if(home!==null)neighborPreference=clamp(Math.abs(home-6.0)*.085,0,.65);
  // Tea stands benefit from traffic, not from old prebuilt v0.3 paths.
  if(road)livelihoodPreference=clamp(road.distance*.20,0,.90);
 }
 return {roadDistance:road?.distance??null,doorRoadPreference,
  neighborPreference,livelihoodPreference,
  total:doorRoadPreference+neighborPreference+livelihoodPreference};
}
