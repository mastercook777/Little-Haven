import * as THREE from 'three';
import type {Season} from '../simulation/calendar.ts';
import {buildMountainRoof,MOUNTAIN_MATERIALS as M} from './villageBuildings.ts';
import type {PioneerRoofProfile} from './pioneerRoof.ts';

/** Reuses the classic observation village's ONE-PIECE curved tiled-roof
 * geometry and palette. Width/depth are derived from the saved pioneer eave
 * envelope: do not move any parcel, entrance, tree, road or building ID. */
export function makePioneerMountainRoof(parent:THREE.Object3D,
 roof:PioneerRoofProfile,kind:'cottage'|'granary',variant=0,condition=100){
 const color=kind==='granary'?M.roofWarm:
  condition<78?M.roofWarm:variant%3===1?M.roofBlue:M.roof;
 return buildMountainRoof(parent,{
  width:2*(roof.halfWidth-.30),depth:2*(roof.halfDepth-.32),
  eave:roof.eaveY,rise:roof.ridgeY-roof.eaveY,
  style:kind==='cottage'?'tile':'workshop',material:color
 });
}
const boxGeometry=new THREE.BoxGeometry(1,1,1);
const stemGeometry=new THREE.CylinderGeometry(1,1,1,8);
const roundGeometry=new THREE.IcosahedronGeometry(1,1);
function part(parent:THREE.Object3D,x:number,y:number,z:number,
 w:number,h:number,d:number,mat:THREE.Material,name?:string){
 const mesh=new THREE.Mesh(boxGeometry,mat);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=true;mesh.receiveShadow=true;
 if(name)mesh.name=name;
 parent.add(mesh);return mesh;
}
function post(parent:THREE.Object3D,x:number,y:number,z:number,
 radius:number,height:number,mat:THREE.Material){
 const mesh=new THREE.Mesh(stemGeometry,mat);
 mesh.position.set(x,y,z);mesh.scale.set(radius,height,radius);
 mesh.castShadow=true;parent.add(mesh);return mesh;
}
function seedVariant(id:string){
 let hash=0;for(let i=0;i<id.length;i++)hash=Math.imul(hash,31)+id.charCodeAt(i)|0;
 return (hash>>>0)%4;
}
export function pioneerHouseVariant(id:string){return seedVariant(id);}
/** The facade replaces the old single-block door and square unframed
 * windows; all details stay under the existing protected roof outline. */
export function dressPioneerCottage(parent:THREE.Object3D,
 w:number,d:number,h:number,id:string){
 const v=seedVariant(id),front=d*.505;
 const facade=new THREE.Group();facade.name='classic-inspired-mountain-cottage-facade';
 parent.add(facade);
 // A carved double-leaf door sits inside the front wall opening.
 for(const side of [-1,1]){
  const x=side*.166;
  part(facade,x,.75,front,.326,1.08,.069,M.oldWood,'mountain-double-leaf-door');
  for(const dx of [-.105,.105])
   part(facade,x+dx,.75,front+.047,.024,.91,.034,M.brightWood);
  part(facade,x,.98,front+.050,.30,.042,.035,M.brightWood);
 }
 part(facade,0,1.34,front+.018,.81,.11,.16,M.oldWood,'doorway-timber-lintel');
 for(const side of [-1,1]){
  const x=side*(w*.35),windowFront=d*.535;
  // Opaque sill, paper panes, multiple visible timber lattice subdivisions.
  part(facade,x,1.05,windowFront,.46,.51,.080,M.oldWood,'mountain-lattice-frame');
  part(facade,x,1.05,windowFront+.052,.36,.40,.024,M.paper,'mountain-paper-window');
  for(const offset of [-.105,.105])
   part(facade,x+offset,1.05,windowFront+.076,.031,.42,.029,M.brightWood);
  part(facade,x,1.04,windowFront+.081,.39,.034,.035,M.brightWood);
  part(facade,x,.74,windowFront+.075,.58,.085,.17,M.stone);
  // Under-eave joinery follows the existing single roof, not a second awning.
  part(facade,x,h+.13,d*.41,.13,.29,.15,M.wood,'timber-bracket');
 }
 part(facade,0,.24,d*.50+.13,1.0,.13,.26,M.stone,'mountain-entrance-step');
 if(v===0||v===2){
  // Household pottery below the lintel, inside the roof/collision envelope.
  post(facade,-.51,.34,front-.16,.14,.37,M.wheat);
  part(facade,-.51,.57,front-.16,.13,.06,.13,M.jade);
 }else{
  part(facade,-.56,.52,front-.10,.31,.23,.23,M.brightWood,'household-basket');
 }
 if(v===1||v===3){
  const lamp=new THREE.Group();lamp.name='classic-mountain-lantern';
  lamp.position.set(.53,1.37,front-.12);facade.add(lamp);
  post(lamp,0,.12,0,.027,.30,M.oldWood);
  post(lamp,0,-.13,0,.20,.29,M.paper);
  part(lamp,0,-.31,0,.29,.045,.29,M.oldWood);
  part(lamp,0,.06,0,.28,.045,.28,M.redCloth);
 }
 return facade;
}
export function dressPioneerGranary(parent:THREE.Object3D){
 const facade=new THREE.Group();facade.name='classic-inspired-raised-granary';parent.add(facade);
 // The raised store has a real plank wall and slatted vents, not stacked roof bars.
 part(facade,0,1.98,-.92,1.95,.98,.12,M.wheat);
 for(const sx of [-.77,.77]){
  part(facade,sx,1.96,.94,.32,.54,.10,M.oldWood,'granary-vent-shutter');
  for(let k=0;k<3;k++)
   part(facade,sx,1.79+k*.16,1.0,.24,.036,.035,M.brightWood);
 }
 part(facade,0,2.36,.95,2.06,.11,.13,M.oldWood);
 return facade;
}
const treeBark=new THREE.MeshStandardMaterial({color:'#6b5949',roughness:1});
const leafA=new THREE.MeshStandardMaterial({color:'#6c9b75',roughness:1});
const leafB=new THREE.MeshStandardMaterial({color:'#87ab83',roughness:1});
const blossom=new THREE.MeshStandardMaterial({color:'#edb6b6',roughness:1});
const paleBloom=new THREE.MeshStandardMaterial({color:'#f5d4c8',roughness:1});
const winterWood=new THREE.MeshStandardMaterial({color:'#92765a',roughness:1});
/** Existing protected pine parcels remain the map anchors. Two are presented
 * as seasonal broadleaf trees in the classic art language; never on buildable
 * lots or across freshly-cleared pioneer terrain. */
export function makePioneerSeasonalGrove(parent:THREE.Object3D,
 locations:readonly (readonly [number,number,number])[]){
 const grove=new THREE.Group();grove.name='protected-classic-seasonal-canopies';parent.add(grove);
 const crowns:THREE.Group[]=[],blooms:THREE.Group[]=[];
 for(const [x,z,size] of locations){
  const g=new THREE.Group();g.position.set(x,.19,z);g.scale.setScalar(size);
  g.name='protected-seasonal-tree';grove.add(g);
  post(g,0,1.11,0,.14,2.1,treeBark);
  for(const side of [-1,1]){
   const branch=post(g,side*.32,1.66,.04,.068,.85,winterWood);
   branch.rotation.z=-side*.68;
  }
  const crown=new THREE.Group();g.add(crown);crowns.push(crown);
  const bloomer=new THREE.Group();g.add(bloomer);blooms.push(bloomer);
  for(const [i,xx,yy,zz,scale] of [
   [0,0,2.28,0,.72],[1,.55,2.07,.08,.57],
   [2,-.48,2.18,-.08,.58],[3,.13,2.69,-.10,.49]
  ] as const){
   const foliage=new THREE.Mesh(roundGeometry,i%2?leafA:leafB);
   foliage.position.set(xx,yy,zz);foliage.scale.set(scale,scale*.88,scale*.86);
   foliage.castShadow=true;crown.add(foliage);
   if(i!==1){
    const flower=new THREE.Mesh(roundGeometry,i%2?paleBloom:blossom);
    flower.position.set(xx-.12,yy+.17,zz+.12);
    flower.scale.set(scale*.38,scale*.33,scale*.34);
    bloomer.add(flower);
   }
  }
 }
 let last:Season|null=null;
 const update=(season:Season)=>{
  if(last===season)return;last=season;
  leafA.color.set(season==='autumn'?'#c99c66':season==='spring'?'#8aaf82':'#5c916c');
  leafB.color.set(season==='autumn'?'#dda96f':season==='spring'?'#a2ba88':'#83ab80');
  for(const crown of crowns)crown.visible=season!=='winter';
  for(const bloom of blooms)bloom.visible=season==='spring';
 };
 return {root:grove,update,count:locations.length};
}
