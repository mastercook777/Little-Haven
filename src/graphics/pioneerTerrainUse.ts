import * as THREE from 'three';
import type {PioneerWorld,PioneerBuildKind} from '../simulation/pioneerWorld.ts';
import {CREEK_BANK_HALF_WIDTH,distanceToCreekSpline} from '../simulation/creekCorridor.ts';
import {getPioneerNaturalAnchors,pioneerNaturalRootRadius} from '../simulation/pioneerNaturalAnchors.ts';
import type {VillageParcel} from '../simulation/villagePlanning.ts';
import type {PioneerRoad} from '../simulation/pioneerPaths.ts';

/** Color is terrain use, not a free building or a second terrain surface.
 * The existing carved riverbed, walkable y and island mesh stay unchanged.
 * Only LAND that real villagers have built, farmed, cleared or walked shifts
 * toward packed earth, farm soil, or a civic foot-worn common. */
const groundColors:Readonly<Record<PioneerBuildKind,THREE.Color>>={
 shelter:new THREE.Color('#ad9771'),
 cottage:new THREE.Color('#c6ad88'),
 garden:new THREE.Color('#a38b60'),
 'wood-yard':new THREE.Color('#ad9674'),
 'fish-hut':new THREE.Color('#a6a18b'),
 granary:new THREE.Color('#aaa08c'),
 'tea-stop':new THREE.Color('#c0aa83')
};
const civicColor=new THREE.Color('#bca68a');
const trackColor=new THREE.Color('#ad9370');
const clearedColor=new THREE.Color('#ab9978');
const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
const dist=(x:number,z:number,a:number,b:number)=>Math.hypot(x-a,z-b);
const limit=(v:number)=>Math.max(0,Math.min(1,v));
function parcelExteriorDistance(x:number,z:number,p:VillageParcel){
 const dx=x-p.x,dz=z-p.z,cs=Math.cos(p.rotation),sn=Math.sin(p.rotation);
 const localX=Math.abs(dx*cs+dz*sn),localZ=Math.abs(-dx*sn+dz*cs);
 return Math.hypot(Math.max(0,localX-p.width/2),Math.max(0,localZ-p.depth/2));
}
function pathDistance(x:number,z:number,road:PioneerRoad):number{
 let nearest=Infinity;
 // An early AABB exit avoids dozens of sqrt operations on remote road nodes.
 for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i];
  if(x<Math.min(a[0],b[0])-1.55||x>Math.max(a[0],b[0])+1.55||
   z<Math.min(a[1],b[1])-1.55||z>Math.max(a[1],b[1])+1.55)continue;
  const dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
  const t=d?limit(((x-a[0])*dx+(z-a[1])*dz)/d):0;
  nearest=Math.min(nearest,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
 }
 return nearest;
}
/** A pure probe for testing the land-use source, independent of Three.
 * All influences come from saved development, never wall-clock years. */
export function pioneerTerrainUseAt(s:PioneerWorld,x:number,z:number){
 if(distanceToCreekSpline(x,z)<=CREEK_BANK_HALF_WIDTH+.27)
  return {weight:0,kind:'river-shore-preserved' as const,land:new THREE.Color('#ffffff')};
 const root=getPioneerNaturalAnchors(s).some(a=>
  dist(x,z,a.x,a.z)<pioneerNaturalRootRadius(a)+.72);
 let weight=0;
 const land=new THREE.Color('#ffffff');
 // Assign each paid parcel a broad but softly feathered human-working edge:
 // interior compacted ground and outer 2.5m foot traffic, never a rigid square.
 const apply=(target:THREE.Color,amount:number)=>{
  if(amount<=.02)return;
  const a=limit(amount);
  land.lerp(target,a);
  weight=1-(1-weight)*(1-a);
 };
 for(const b of s.buildings){
  const p=b.parcel;
  if(Math.abs(x-p.x)>p.width/2+3||Math.abs(z-p.z)>p.depth/2+3)continue;
  const d=parcelExteriorDistance(x,z,p);
  const halo=b.kind==='garden'?2.15:2.65;
  const occupancy=.79*(1-smooth(d/halo));
  apply(groundColors[b.kind],occupancy);
 }
 // The compacted public square only exists after real communal investment.
 if(s.commons.stage>=2){
  const d=dist(x,z,s.camp.x,s.camp.z);
  const radius=s.commons.stage>=3?5.3:3.3;
  if(d<radius)apply(civicColor,.62*(1-smooth(Math.max(0,d-1.3)/(radius-1.3))));
 }
 // Only registered routes to completed buildings may change terrain.
 // Repeated routes naturally build a distinguishable central village spine.
 const validBuildings=new Set(s.buildings.map(b=>b.id));
 for(const road of s.roads){
  if(!validBuildings.has(road.buildingId))continue;
  const d=pathDistance(x,z,road);
  if(d<1.50)apply(trackColor,(road.grade==='dirt'?.52:.44)*
   (1-smooth(Math.max(0,d-.16)/1.34)));
 }
 // Real eight-hour clearing work turns a small thicket into scarred earth.
 for(const clearing of s.frontier.clearings){
  if(clearing.phase!=='cleared')continue;
  const d=dist(x,z,clearing.x,clearing.z);
  if(d<clearing.radius+.90)
   apply(clearedColor,.40*(1-smooth(d/(clearing.radius+.90))));
 }
 // Vegetation anchored as protected natural root remains green, even
 // when cottages are built alongside: no disappearing original trees.
 if(root)weight*=.12;
 // Break broad soil into hand-worked low-frequency gradations. Never random
 // per-frame; season/color changes remain driven by the original material.
 const variation=.91+.09*Math.sin(x*1.81+z*.67)*Math.cos(z*1.42-x*.29);
 return {weight:Math.min(.89,weight*variation),kind:'village-use' as const,land};
}
export interface PioneerTerrainVisualStats{
 alteredVertices:number;totalVertices:number;meanUse:number;
}
/** Keep base terrain vertex colors as an immutable reference, so repeated
 * game imports/restarts/season jumps never accumulate brown paint. */
export function applyPioneerTerrainUse(
 terrain:THREE.Mesh,s:PioneerWorld):PioneerTerrainVisualStats{
 const positions=terrain.geometry.getAttribute('position');
 const colors=terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
 if(!positions||!colors||positions.count!==colors.count)
  throw Error('Pioneer land use needs the real carved-terrain mesh with vertex colors');
 let baseline=terrain.geometry.userData.originalGrassVertexColors as Float32Array|undefined;
 if(!baseline){
  baseline=new Float32Array(colors.array as Float32Array);
  terrain.geometry.userData.originalGrassVertexColors=baseline;
 }
 const original=new THREE.Color(),mixed=new THREE.Color();
 let alteredVertices=0,meanUse=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=positions.getZ(i);
  const use=pioneerTerrainUseAt(s,x,z);
  const offset=i*3;
  original.setRGB(baseline[offset],baseline[offset+1],baseline[offset+2]);
  if(use.weight>.03){
   mixed.copy(original).lerp(use.land,use.weight);
   colors.setXYZ(i,mixed.r,mixed.g,mixed.b);
   alteredVertices++;
   meanUse+=use.weight;
  }else colors.setXYZ(i,original.r,original.g,original.b);
 }
 colors.needsUpdate=true;
 terrain.geometry.computeVertexNormals();
 return {alteredVertices,totalVertices:positions.count,
  meanUse:Math.round(meanUse/Math.max(1,positions.count)*1000)/1000};
}
