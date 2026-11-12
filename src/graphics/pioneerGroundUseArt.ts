import * as THREE from 'three';
import type {PioneerWorld,PioneerBuildKind} from '../simulation/pioneerWorld.ts';
import {pioneerNaturalParcels} from '../simulation/pioneerNaturalAnchors.ts';
import {pioneerWalkable,type WalkPoint} from '../simulation/pioneerPaths.ts';
import {distanceToCreekSpline} from '../simulation/creekCorridor.ts';
import type {VillageParcel} from '../simulation/villagePlanning.ts';

/** The village ground is an outcome of PAID buildings and SAVED A* roads.
 * No house, street, field, traffic or paved commons exists here at day zero.
 * This is a visual material layer; it does not grant new walkable terrain. */
type GroundClass='homes'|'fields'|'work'|'stores'|'shore'|'tea';
const groundClass=(kind:PioneerBuildKind):GroundClass=>
 kind==='garden'?'fields':kind==='wood-yard'?'work':
 kind==='fish-hut'?'shore':kind==='granary'?'stores':
 kind==='tea-stop'?'tea':'homes';

const palette:Record<GroundClass,{edge:string,center:string}>={
 homes:{edge:'#93846e',center:'#c1ac8a'},
 fields:{edge:'#746348',center:'#92744c'},
 work:{edge:'#8d7660',center:'#b59a70'},
 stores:{edge:'#8a857a',center:'#b6aa91'},
 shore:{edge:'#8c927f',center:'#b2b09a'},
 tea:{edge:'#9f907a',center:'#c1ae8c'}
};
export interface PioneerGroundUsePlan{
 plots:readonly {id:string;kind:PioneerBuildKind;parcel:VillageParcel;className:GroundClass}[];
 paths:readonly {id:string;points:readonly WalkPoint[];grade:'track'|'dirt'}[];
 sharedNodes:readonly WalkPoint[];
 totalRoadLength:number;
}
/** Unique road cells must be traversed by different registered roads before
 * they gain worn, shared-path stonework. No randomly invented joining road. */
export function pioneerGroundUsePlan(s:PioneerWorld):PioneerGroundUsePlan{
 const plots=s.buildings.map(b=>({id:b.id,kind:b.kind,parcel:b.parcel,
  className:groundClass(b.kind)}));
 const owned=new Set(s.buildings.map(b=>b.id));
 const paths=s.roads.filter(r=>owned.has(r.buildingId)&&r.points.length>=2)
  .map(r=>({id:r.id,points:r.points,grade:r.grade}));
 let totalRoadLength=0;
 const cells=new Map<string,{point:WalkPoint;routes:Set<string>}>();
 for(const road of paths){
  const routeCells=new Set<string>();
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
   totalRoadLength+=distance;
   const steps=Math.max(1,Math.ceil(distance/.36));
   for(let j=0;j<=steps;j++){
    const t=j/steps,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    const key=Math.round(x/.62)+':'+Math.round(z/.62);
    if(routeCells.has(key))continue;
    routeCells.add(key);
    const previous=cells.get(key);
    if(previous)previous.routes.add(road.id);
    else cells.set(key,{point:[x,z],routes:new Set([road.id])});
   }
  }
 }
 const occupied=[...pioneerNaturalParcels(s),...s.buildings.map(b=>b.parcel)];
 const sharedNodes=[...cells.values()]
  .filter(c=>c.routes.size>=2)
  .map(c=>c.point)
  .filter(p=>Math.hypot(p[0]-s.camp.x,p[1]-s.camp.z)>1.85&&
   distanceToCreekSpline(p[0],p[1])>2.70&&pioneerWalkable(p,occupied))
  .filter((p,i)=>i%2===0)
  .slice(0,120);
 return {plots,paths,sharedNodes,totalRoadLength};
}
const groundMaterial=(color:string)=>new THREE.MeshStandardMaterial({
 color,roughness:1,side:THREE.DoubleSide
});
/** Build one geometry per material, not a separate renderer call for every
 * little paid plot. All corners remain INSIDE the surveyed parcel footprint. */
function useGeometry(plots:PioneerGroundUsePlan['plots'],scale:number,y:number){
 const vertices:number[]=[],indices:number[]=[];
 for(const {parcel:p} of plots){
  const w=p.width*scale/2,d=p.depth*scale/2;
  const cut=Math.min(.27,w*.20,d*.20);
  const ring:WalkPoint[]=[
   [-w+cut,-d],[w-cut,-d],[w,-d+cut],[w,d-cut],
   [w-cut,d],[-w+cut,d],[-w,d-cut],[-w,-d+cut]
  ];
  const cs=Math.cos(p.rotation),sn=Math.sin(p.rotation);
  const base=vertices.length/3;
  vertices.push(p.x,y,p.z);
  for(const [x,z] of ring)
   vertices.push(p.x+x*cs-z*sn,y,p.z+x*sn+z*cs);
  for(let i=0;i<8;i++)indices.push(base,base+1+i,base+1+(i+1)%8);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}
function roadGeometry(paths:PioneerGroundUsePlan['paths']){
 const vertices:number[]=[],triangles:number[]=[];
 for(const road of paths){
  const points=road.points;
  const width=road.grade==='dirt'?.93:.74;
  const base=vertices.length/3;
  for(let i=0;i<points.length;i++){
   const p=points[i],before=points[Math.max(0,i-1)],
    after=points[Math.min(points.length-1,i+1)];
   const dx=after[0]-before[0],dz=after[1]-before[1],l=Math.hypot(dx,dz)||1;
   const nx=-dz/l*width/2,nz=dx/l*width/2;
   vertices.push(p[0]+nx,.196,p[1]+nz,p[0]-nx,.196,p[1]-nz);
   if(i>0){
    const k=base+i*2;
    triangles.push(k-2,k-1,k,k,k-1,k+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(triangles);geo.computeVertexNormals();
 return geo;
}
export function makePioneerGroundUseArt(s:PioneerWorld){
 const plan=pioneerGroundUsePlan(s);
 const root=new THREE.Group();root.name='paid-neighborhood-ground-and-real-road-wear';
 for(const key of Object.keys(palette) as GroundClass[]){
  const plots=plan.plots.filter(p=>p.className===key);
  if(!plots.length)continue;
  const edge=new THREE.Mesh(useGeometry(plots,.99,.189),groundMaterial(palette[key].edge));
  edge.name='paid-'+key+'-soil-edges';
  edge.receiveShadow=true;root.add(edge);
  const center=new THREE.Mesh(useGeometry(plots,.86,.194),groundMaterial(palette[key].center));
  center.name='paid-'+key+'-soil-courts';
  center.receiveShadow=true;root.add(center);
 }
 if(plan.paths.length){
  const worn=new THREE.Mesh(roadGeometry(plan.paths),
   new THREE.MeshStandardMaterial({color:'#b49a75',roughness:1,
    transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));
  worn.name='registered-road-shoulder-not-an-extra-path';
  worn.receiveShadow=true;root.add(worn);
 }
 if(plan.sharedNodes.length){
  const stones=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
   groundMaterial('#d4c2a0'),plan.sharedNodes.length);
  stones.name='real-crossed-road-paving-one-instanced-draw-call';
  const dummy=new THREE.Object3D();
  for(let i=0;i<plan.sharedNodes.length;i++){
   const [x,z]=plan.sharedNodes[i];
   dummy.position.set(x,.213,z);
   dummy.rotation.y=(i%5-2)*.17;
   dummy.scale.set(.21+(i%3)*.07,.027,.27+(i%4)*.045);
   dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
  }
  stones.instanceMatrix.needsUpdate=true;
  stones.receiveShadow=true;root.add(stones);
 }
 // Picking must go to the registered house, field or resident behind this
 // land-use shading rather than treating public pavement as a new building.
 root.traverse(o=>{if(o instanceof THREE.Mesh)o.raycast=()=>{};});
 return {root,signatures:()=>({
  paidGroundPlots:plan.plots.length,
  paintedRealRoads:plan.paths.length,
  sharedRoadPavers:plan.sharedNodes.length,
  roadLength:Math.round(plan.totalRoadLength*100)/100
 })};
}
