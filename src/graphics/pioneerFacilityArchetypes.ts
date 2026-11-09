import type {PioneerRoofProfile} from './pioneerRoof.ts';
import type {PioneerBuildKind} from '../simulation/pioneerWorld.ts';

/** v0.5.6C: physical facility silhouettes, not palette-only variation.
 * All measurements are LOCAL to the original paid build parcel.
 * A full facility's real parcel ID survives work, completion and old saves. */
export type PioneerFacilityKind=Exclude<PioneerBuildKind,'shelter'|'cottage'|'garden'>;
export type PioneerFacilityStyle='open-bay'|'slatted-bay'|'high-workshop'|
 'low-fishing-bay'|'raised-net-landing'|'raised-store'|'ventilated-store'|
 'roadside-stand'|'lantern-tea-pavilion';
export interface PioneerFacilityArchetype {
 readonly id:string;
 readonly kind:PioneerFacilityKind;
 readonly style:PioneerFacilityStyle;
 readonly roof:PioneerRoofProfile;
 /** The tea pavilion's entire authored assembly is scaled to fit 2.55x2.38. */
 readonly scale:number;
 readonly profile:'thatch'|'tile';
}
const shapes:Record<PioneerFacilityKind,readonly PioneerFacilityArchetype[]>={
 'wood-yard':[
  {id:'W1-open',kind:'wood-yard',style:'open-bay',scale:1,profile:'thatch',
   roof:{halfWidth:1.29,halfDepth:1.18,eaveY:1.86,ridgeY:2.29,thickness:.095}},
  {id:'W2-slat',kind:'wood-yard',style:'slatted-bay',scale:1,profile:'thatch',
   roof:{halfWidth:1.37,halfDepth:1.14,eaveY:1.69,ridgeY:2.00,thickness:.095}},
  {id:'W3-high',kind:'wood-yard',style:'high-workshop',scale:1,profile:'thatch',
   roof:{halfWidth:1.18,halfDepth:1.24,eaveY:2.09,ridgeY:2.67,thickness:.095}}
 ],
 'fish-hut':[
  {id:'F1-shore',kind:'fish-hut',style:'low-fishing-bay',scale:1,profile:'thatch',
   roof:{halfWidth:1.34,halfDepth:1.11,eaveY:1.85,ridgeY:2.30,thickness:.10}},
  {id:'F2-raised',kind:'fish-hut',style:'raised-net-landing',scale:1,profile:'thatch',
   roof:{halfWidth:1.27,halfDepth:1.20,eaveY:2.14,ridgeY:2.70,thickness:.10}}
 ],
 granary:[
  {id:'G1-single',kind:'granary',style:'raised-store',scale:1,profile:'tile',
   roof:{halfWidth:1.23,halfDepth:1.14,eaveY:2.64,ridgeY:3.12,thickness:.09}},
  {id:'G2-ventilated',kind:'granary',style:'ventilated-store',scale:1,profile:'tile',
   roof:{halfWidth:1.29,halfDepth:1.16,eaveY:2.63,ridgeY:3.00,thickness:.09}}
 ],
 'tea-stop':[
  {id:'T1-roadside',kind:'tea-stop',style:'roadside-stand',scale:.84,profile:'thatch',
   roof:{halfWidth:1.42,halfDepth:1.23,eaveY:1.81,ridgeY:2.29,thickness:.10}},
  {id:'T2-pavilion',kind:'tea-stop',style:'lantern-tea-pavilion',scale:.84,profile:'thatch',
   roof:{halfWidth:1.28,halfDepth:1.26,eaveY:2.11,ridgeY:2.72,thickness:.10}}
 ]
};
export const PIONEER_FACILITY_ARCHETYPES=shapes;
export function pioneerFacilityArchetype(kind:PioneerFacilityKind,parcelId:string){
 // Hash *paid parcel*, not transient intent ID or a changing render clock.
 // Reopening v4 storage and switching between 1x/12x yields the same shape.
 let hash=2166136261;
 for(const c of kind+':'+parcelId){
  hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);
 }
 const list=shapes[kind];
 return list[(hash>>>0)%list.length];
}
/** Exact world-space eaves including tea-pavilion scale; shared with rain. */
export function pioneerFacilityRoofDripProfile(kind:PioneerFacilityKind,parcelId:string){
 const a=pioneerFacilityArchetype(kind,parcelId);
 return [a.roof.halfWidth*a.scale,a.roof.halfDepth*a.scale,
  a.roof.eaveY*a.scale] as const;
}
/** Visual silhouette is a smaller proxy inside *existing* validated SAT
 * parcel. All special railings/side walls must stay within these eaves. */
export function pioneerFacilityEnvelopeSafe(
 a:PioneerFacilityArchetype,parcel:{width:number;depth:number;clearance:number}){
 const outerX=parcel.width/2+parcel.clearance;
 const outerZ=parcel.depth/2+parcel.clearance;
 return a.scale>0&&a.scale<=1&&
  a.roof.halfWidth*a.scale<=outerX &&
  a.roof.halfDepth*a.scale<=outerZ &&
  a.roof.ridgeY>a.roof.eaveY;
}

export type PioneerGardenStyle='P1-open-rows'|'P2-raised-terrace'|'P3-woven-boundary';
export const PIONEER_GARDEN_STYLES:readonly PioneerGardenStyle[]=[
 'P1-open-rows','P2-raised-terrace','P3-woven-boundary'
];
export function pioneerGardenStyle(parcelId:string):PioneerGardenStyle{
 let hash=0;for(let i=0;i<parcelId.length;i++)
  hash=(Math.imul(hash,31)+parcelId.charCodeAt(i))|0;
 return PIONEER_GARDEN_STYLES[(hash>>>0)%PIONEER_GARDEN_STYLES.length];
}
