import {pioneerIslandFraction} from './pioneerGeography.ts';
import {distanceToCreekSpline,CREEK_WATER_HALF_WIDTH} from './creekCorridor.ts';
import {parcelCorners,parcelLineDistance,parcelOverlaps,
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
 if(corners.some(([x,z])=>pioneerIslandFraction(x,z,1.05,1.05)>=1))
  return {ok:false,reason:'outside-island'};
 // Rendered water is a curved ribbon, not a raw waypoint line.
 // Center, corners and edge midpoints prevent roofs dipping into water.
 const roofCorners=parcelCorners(parcel);
 const edgeSamples=[...roofCorners,[parcel.x,parcel.z] as const,
  ...roofCorners.map(([x,z],i)=>{
   const [nx,nz]=roofCorners[(i+1)%roofCorners.length];
   return [(x+nx)*.5,(z+nz)*.5] as const;
  })];
 if(edgeSamples.some(([x,z])=>distanceToCreekSpline(x,z)<CREEK_WATER_HALF_WIDTH+.07))
  return {ok:false,reason:'river-bank'};
 if(occupied.some(other=>other.id!==parcel.id&&parcelOverlaps(parcel,other)))
  return {ok:false,reason:'existing-building'};
 // Pathfinding already reserves .13 units beyond each building's SAT
 // clearance. Rejecting roads at .18 after construction used to invalidate
 // an otherwise safe previously built home when a future route was added.
 if(roads.some(road=>parcelLineDistance(parcel,road.points)<.12))
  return {ok:false,reason:'pioneer-road-blocked'};
 return {ok:true,reason:'ok'};
}
