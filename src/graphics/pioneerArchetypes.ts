import type {PioneerRoofProfile} from './pioneerRoof.ts';

/** v0.5.6B: four genuinely different house silhouettes inside the already
 * paid 3.10×2.95 cottage parcel (clearance .30). No new bed / resource count.
 * Zero-based ordinal is determined by a building's immutable position in the
 * chronological completed-building registry and survives v4 reloads. */
export interface PioneerCottageArchetype{
 id:'C1-gabled'|'C2-broad'|'C3-porch'|'C4-side-bay';
 bodyWidth:number;bodyDepth:number;wallHeight:number;
 roof:PioneerRoofProfile;
 recessedFront:number;
 porch:boolean;sideBay:boolean;
}
const cottages:readonly PioneerCottageArchetype[]=[
 // Tall, slender and deep: the original little family homestead.
 {id:'C1-gabled',bodyWidth:2.19,bodyDepth:2.54,wallHeight:1.86,
  roof:{halfWidth:1.20,halfDepth:1.33,eaveY:2.15,ridgeY:2.79,thickness:.095},
  recessedFront:0,porch:false,sideBay:false},
 // Wide and low, with a long eave and shallow ridge, unmistakable from C1.
 {id:'C2-broad',bodyWidth:2.72,bodyDepth:2.29,wallHeight:1.45,
  roof:{halfWidth:1.45,halfDepth:1.20,eaveY:1.74,ridgeY:2.11,thickness:.095},
  recessedFront:0,porch:false,sideBay:false},
 // The timber-railed front porch is INSET under the main roof; no phantom
 // second tiled roof or unreserved side walkway.
 {id:'C3-porch',bodyWidth:2.47,bodyDepth:2.42,wallHeight:1.65,
  roof:{halfWidth:1.35,halfDepth:1.29,eaveY:1.94,ridgeY:2.44,thickness:.095},
  recessedFront:.22,porch:true,sideBay:false},
 // Asymmetric side workbay under an extended main eave, not a second home.
 {id:'C4-side-bay',bodyWidth:2.43,bodyDepth:2.40,wallHeight:1.63,
  roof:{halfWidth:1.39,halfDepth:1.28,eaveY:1.92,ridgeY:2.48,thickness:.095},
  recessedFront:0,porch:false,sideBay:true}
];
export const PIONEER_COTTAGE_ARCHETYPES=cottages;
export function pioneerCottageArchetype(ordinal:number){
 return cottages[Math.abs(Math.trunc(ordinal))%cottages.length];
}
/** No mutation or RNG based on frame time / weather / future population.
 * The historical ordering of completed building IDs is already in the save. */
export function pioneerCottageOrdinal(
 buildings:readonly {kind:string;id:string;completedAt:number}[],id:string){
 const cottages=buildings.filter(b=>b.kind==='cottage').sort((a,b)=>
  a.completedAt-b.completedAt||a.id.localeCompare(b.id));
 return Math.max(0,cottages.findIndex(b=>b.id===id));
}
/** Curved roof geometry may overhang walls, but stays inside the paid parcel. */
export function cottageEnvelopeSafe(
 profile:PioneerCottageArchetype,parcel:{width:number;depth:number;clearance:number}){
 const w=parcel.width/2+parcel.clearance,d=parcel.depth/2+parcel.clearance;
 return profile.roof.halfWidth<=w&&profile.roof.halfDepth<=d&&
  profile.bodyWidth/2<=profile.roof.halfWidth&&
  profile.bodyDepth/2<=profile.roof.halfDepth&&
  profile.wallHeight<profile.roof.eaveY&&profile.roof.ridgeY>profile.roof.eaveY;
}
