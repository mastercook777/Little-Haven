import {VALLEY_BOUNDS} from './valleyGeography.ts';
import {parcelCorners,parcelLineDistance,parcelOverlaps,riverDistance,
 type VillageParcel} from './villagePlanning.ts';
import type {PioneerRoad} from './pioneerPaths.ts';

export interface PioneerParcelResult{
 ok:boolean;reason:'ok'|'outside-island'|'river-bank'|'existing-building'|'pioneer-road-blocked';
}
/** The pioneer world has no v0.3 static VALLEY_ROUTES. Its path access is
 * established separately by A* over actual registered roads and terrain.
 * Reusing validateVillageParcel here erroneously reserved *invisible* old
 * routes and exhausted all available homestead plots at five residents. */
export function validatePioneerParcel(parcel:VillageParcel,
 occupied:readonly VillageParcel[],roads:readonly PioneerRoad[]=[]):PioneerParcelResult{
 const corners=parcelCorners(parcel,.90);
 if(corners.some(([x,z])=>(x/(VALLEY_BOUNDS.radiusX-1.05))**2+
  (z/(VALLEY_BOUNDS.radiusZ-1.05))**2>=1))
  return {ok:false,reason:'outside-island'};
 if(riverDistance(parcel)<.72)return {ok:false,reason:'river-bank'};
 if(occupied.some(other=>other.id!==parcel.id&&parcelOverlaps(parcel,other)))
  return {ok:false,reason:'existing-building'};
 if(roads.some(road=>parcelLineDistance(parcel,road.points)<.18))
  return {ok:false,reason:'pioneer-road-blocked'};
 return {ok:true,reason:'ok'};
}
