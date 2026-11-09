import {VALLEY_PINES,VALLEY_BAMBOO} from './valleyGeography.ts';
import {CREEK_BANK_HALF_WIDTH,distanceToCreekSpline} from './creekCorridor.ts';
import {pioneerIslandFraction} from './pioneerGeography.ts';
import {parcelLineDistance,parcelOverlaps,type VillageParcel} from './villagePlanning.ts';
import type {PioneerRoad} from './pioneerPaths.ts';

export interface PioneerNaturalAnchor {
 id:string;kind:'pine'|'bamboo';index:number;x:number;z:number;size:number;
}
type Obstacle=Pick<VillageParcel,'id'|'kind'|'x'|'z'|'width'|'depth'|'rotation'|'clearance'|'accessX'|'accessZ'|'builtAt'>;
const round=(n:number)=>Math.round(n*1000)/1000;
/** Only pioneer mode moves scenery. Classic VALLEY_* stays pixel-identical. */
const relocatedPines:Record<number,readonly [number,number]>={
 3:[1.8,9.2],5:[11.7,5.7],6:[.2,-8.8]
};
const relocatedBamboo:Record<number,readonly [number,number]>={
 5:[3.5,7.7],9:[9.8,-7.6]
};
const base:PioneerNaturalAnchor[]=[
 ...VALLEY_PINES.map(([x,z,size],index)=>({
  id:'pine-'+index,kind:'pine' as const,index,
  x:relocatedPines[index]?.[0]??x,z:relocatedPines[index]?.[1]??z,size
 })),
 ...VALLEY_BAMBOO.map(([x,z,size],index)=>({
  id:'bamboo-'+index,kind:'bamboo' as const,index,
  x:relocatedBamboo[index]?.[0]??x,z:relocatedBamboo[index]?.[1]??z,size
 }))
];
export function pioneerNaturalAnchorParcel(a:PioneerNaturalAnchor):VillageParcel{
 const unit=a.kind==='pine'?1.85:1.75;
 return {id:a.id,kind:'protected',x:a.x,z:a.z,width:unit*a.size,depth:unit*a.size,
  rotation:0,clearance:a.kind==='pine'?.12:.10,accessX:a.x,accessZ:a.z,builtAt:0};
}
export function pioneerNaturalRootRadius(a:PioneerNaturalAnchor):number{
 return (a.kind==='pine'?.24:.37)*a.size;
}
function plainSpot(x:number,z:number,radius:number):boolean{
 return pioneerIslandFraction(x,z,radius+.42,radius+.42)<.97&&
  distanceToCreekSpline(x,z)>CREEK_BANK_HALF_WIDTH+radius+.10;
}
function anchorLegal(a:PioneerNaturalAnchor,occupied:readonly Obstacle[],
 roads:readonly PioneerRoad[],claimed:readonly PioneerNaturalAnchor[]):boolean{
 if(!plainSpot(a.x,a.z,pioneerNaturalRootRadius(a)))return false;
 const proxy=pioneerNaturalAnchorParcel(a);
 if(occupied.some(p=>parcelOverlaps(proxy,p as VillageParcel)))return false;
 if(claimed.some(other=>parcelOverlaps(proxy,pioneerNaturalAnchorParcel(other))))return false;
 if(roads.some(r=>parcelLineDistance(proxy,r.points)<.15))return false;
 return true;
}
/** Run exactly once when opening a legacy v4 save; persisted positions keep
 * real old buildings/roads unmoved. Never resample when seasons advance. */
export function resolvePioneerNaturalAnchors(
 occupied:readonly Obstacle[]=[],roads:readonly PioneerRoad[]=[]):PioneerNaturalAnchor[]{
 const claimed:PioneerNaturalAnchor[]=[];
 for(const source of base){
  const candidates:PioneerNaturalAnchor[]=[source];
  // deterministic ring fallback for old saves that have already built across
  // a new legal tree home; never return the original illegal wet coordinates.
  for(let ring=1;ring<=9;ring++)for(let i=0;i<16;i++){
   const theta=(i/16*2*Math.PI)+source.index*.23;
   const radius=ring*.54;
   candidates.push({...source,x:round(source.x+radius*Math.cos(theta)),
    z:round(source.z+radius*Math.sin(theta))});
  }
  const chosen=candidates.find(a=>anchorLegal(a,occupied,roads,claimed));
  if(chosen)claimed.push({...chosen});
 }
 return claimed;
}
export const PIONEER_BASE_NATURAL_ANCHORS:readonly PioneerNaturalAnchor[]=
 resolvePioneerNaturalAnchors();
export function getPioneerNaturalAnchors(world?:{naturalAnchors?:PioneerNaturalAnchor[]}){
 return world?.naturalAnchors??PIONEER_BASE_NATURAL_ANCHORS;
}
export function pioneerNaturalParcels(world?:{naturalAnchors?:PioneerNaturalAnchor[]}):VillageParcel[]{
 return getPioneerNaturalAnchors(world).map(pioneerNaturalAnchorParcel);
}
export function pioneerDeciduousLocations(world?:{naturalAnchors?:PioneerNaturalAnchor[]}):
 readonly (readonly [number,number,number])[]{
 return getPioneerNaturalAnchors(world).filter(a=>a.kind==='pine'&&a.index%4===2)
  .map(a=>[a.x,a.z,a.size] as const);
}
export function validatePioneerNaturalAnchors(
 anchors:unknown,occupied:readonly Obstacle[]=[],roads:readonly PioneerRoad[]=[]):boolean{
 if(!Array.isArray(anchors)||anchors.length>base.length)return false;
 const seen=new Set<string>(),claimed:PioneerNaturalAnchor[]=[];
 for(const a of anchors as PioneerNaturalAnchor[]){
  if(!a||typeof a!=='object'||typeof a.id!=='string'||seen.has(a.id)||
   !Number.isFinite(a.x)||!Number.isFinite(a.z)||!Number.isFinite(a.size))return false;
  const model=base.find(b=>b.id===a.id);
  if(!model||model.kind!==a.kind||model.index!==a.index||model.size!==a.size||
   !anchorLegal(a,occupied,roads,claimed))return false;
  seen.add(a.id);claimed.push(a);
 }
 return true;
}
export interface PioneerNaturalIssue {
 id:string;kind:string;x:number;z:number;reason:'river-or-island'|'building-or-road';
}
export function auditPioneerNaturalScene(world:{
 naturalAnchors?:PioneerNaturalAnchor[];buildings?:readonly {parcel:VillageParcel}[];
 roads?:readonly PioneerRoad[];camp?:{x:number;z:number};
}):PioneerNaturalIssue[]{
 const taken=world.buildings?.map(b=>b.parcel)??[];
 const roads=world.roads??[];
 const issues:PioneerNaturalIssue[]=[];
 for(const a of getPioneerNaturalAnchors(world)){
  const radius=pioneerNaturalRootRadius(a),parcel=pioneerNaturalAnchorParcel(a);
  if(!plainSpot(a.x,a.z,radius))issues.push({
   id:a.id,kind:a.kind,x:a.x,z:a.z,reason:'river-or-island'});
  if(taken.some(p=>parcelOverlaps(parcel,p))||
   roads.some(r=>parcelLineDistance(parcel,r.points)<.15))
   issues.push({id:a.id,kind:a.kind,x:a.x,z:a.z,reason:'building-or-road'});
 }
 return issues;
}
/** Visual foliage, stumps, brush and felling roots pass the same water/island,
 * real road, completed building, under-construction and protected tree masks. */
export function isSafePioneerWildPlant(world:{
 naturalAnchors?:PioneerNaturalAnchor[];
 buildings?:readonly {parcel:VillageParcel}[];roads?:readonly PioneerRoad[];
 intent?:{parcel?:VillageParcel}|null;camp?:{x:number;z:number};
 frontier?:{clearings:readonly {x:number;z:number;radius:number;phase:string}[]};
},x:number,z:number,radius:number,nearCamp=0):boolean{
 if(!plainSpot(x,z,radius))return false;
 if(world.camp&&nearCamp>0&&Math.hypot(x-world.camp.x,z-world.camp.z)<nearCamp+radius)
  return false;
 const proxy:VillageParcel={id:'wild-planted-root',kind:'protected',x,z,
  width:radius*2,depth:radius*2,rotation:0,clearance:.12,accessX:x,accessZ:z,builtAt:0};
 if(world.buildings?.some(b=>parcelOverlaps(proxy,b.parcel)))return false;
 if(world.intent?.parcel&&parcelOverlaps(proxy,world.intent.parcel))return false;
 if(world.roads?.some(r=>parcelLineDistance(proxy,r.points)<.18))return false;
 if(getPioneerNaturalAnchors(world).some(a=>
  parcelOverlaps(proxy,pioneerNaturalAnchorParcel(a))))return false;
 if(world.frontier?.clearings.some(c=>c.phase==='cleared'&&
  Math.hypot(x-c.x,z-c.z)<c.radius+radius+.10))return false;
 return true;
}
