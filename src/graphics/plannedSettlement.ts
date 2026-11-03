import * as THREE from 'three';
import type {VillageGrowthState} from '../simulation/villageGrowth.ts';
import type {VillageParcel} from '../simulation/villagePlanning.ts';
import {createMountainHome,buildMountainRoof} from './villageBuildings.ts';
import {batchStaticSubtree} from './batchStatic.ts';

/**
 * Rendering consumes the already saved simulation parcels. It may never pick
 * a new position or move a house to 'fix' clipping on its own.
 */
export interface SettlementRenderer{
 root:THREE.Group;update(g:VillageGrowthState):void;
 stages():{id:string;age:number;phase:'foundation'|'frame'|'complete';x:number;z:number}[];
}
const ground=new THREE.MeshStandardMaterial({color:'#a99a80',roughness:1});
const stone=new THREE.MeshStandardMaterial({color:'#b2afa3',roughness:1});
const timber=new THREE.MeshStandardMaterial({color:'#997c61',roughness:1});
const scaffold=new THREE.MeshStandardMaterial({color:'#b4a083',roughness:1});
const roof=new THREE.MeshStandardMaterial({color:'#536a70',roughness:.98});
const sharedBox=new THREE.BoxGeometry(1,1,1);
function beam(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m=timber){
 const mesh=new THREE.Mesh(sharedBox,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
interface LotVisual{group:THREE.Group;foundation:THREE.Group;frame:THREE.Group;
 finished:THREE.Group;age:number;phase:'foundation'|'frame'|'complete';}
function createLot(root:THREE.Group,lot:VillageParcel,windows:THREE.MeshStandardMaterial[],
 emissive:THREE.MeshStandardMaterial[]):LotVisual{
 const site=new THREE.Group();site.name='resident-built-'+lot.id;
 site.userData.buildingId=lot.id;
 site.position.set(lot.x,0,lot.z);site.rotation.y=lot.rotation;root.add(site);
 const foundation=new THREE.Group(),frame=new THREE.Group(),finished=new THREE.Group();
 site.add(foundation,frame,finished);
 // The parcel bounds reserve enough for completed eaves, steps and worker space.
 const w=Math.max(1.44,lot.width-.64),d=Math.max(1.42,lot.depth-1.02);
 beam(foundation,0,.245,0,w+.16,.13,d+.16,ground);
 for(const sx of [-1,1])for(const sz of [-1,1])
  beam(foundation,sx*w*.40,.36,sz*d*.40,.27,.20,.26,stone);
 beam(frame,0,.255,0,w+.20,.15,d+.16,stone);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  beam(frame,sx*w*.41,1.06,sz*d*.40,.12,1.45,.12,timber);
 }
 for(const sz of [-1,1])beam(frame,0,1.82,sz*d*.41,w+.15,.14,.12,scaffold);
 buildMountainRoof(frame,{width:w,depth:d,eave:1.89,rise:.55,style:'cottage',material:roof});
 // Reuse the same complete-shape factory as the rebuilt core rather than
 // adding box trim over the existing, already rendered roof.
 const variant=lot.kind==='workshop'?1:lot.kind==='store'?2:
  Math.abs(Math.round(lot.x*5+lot.z*7))%2===0?0:3;
 createMountainHome(finished,0,0,w,d,lot.kind==='workshop'?1.68:1.48,
  variant,windows,emissive);
 // This is the actual rendered model's full roof, veranda and step envelope,
 // NOT its nominal wall footprint. Center the whole building so the reserved
 // planner rectangle encloses both the front porch and the rear eaves.
 finished.updateWorldMatrix(true,true);
 const envelope=new THREE.Box3().setFromObject(finished);
 const offsetX=-(envelope.min.x+envelope.max.x)/2;
 const offsetZ=-(envelope.min.z+envelope.max.z)/2;
 const actualWidth=envelope.max.x-envelope.min.x;
 const actualDepth=envelope.max.z-envelope.min.z;
 if(actualWidth>lot.width+lot.clearance*2+.02||
    actualDepth>lot.depth+lot.clearance*2+.02)
  throw new Error('Model footprint larger than reserved parcel: '+lot.id+
   ' roof '+actualWidth.toFixed(2)+'×'+actualDepth.toFixed(2)+
   ' reserved '+lot.width.toFixed(2)+'×'+lot.depth.toFixed(2));
 for(const layer of [foundation,frame,finished]){
  layer.position.x=offsetX;layer.position.z=offsetZ;
  batchStaticSubtree(layer,{disposeOriginals:false});layer.visible=false;
 }
 return {group:site,foundation,frame,finished,age:0,phase:'foundation'};
}
export function makeSettlementRenderer(parent:THREE.Object3D,
 windows:THREE.MeshStandardMaterial[],emissive:THREE.MeshStandardMaterial[]):SettlementRenderer{
 const root=new THREE.Group();root.name='resident-built-settlement';parent.add(root);
 const sites=new Map<string,LotVisual>();
 function update(state:VillageGrowthState){
  const day=state.lastDayProcessed,known=new Set(state.settlementLots.map(l=>l.id));
  for(const [id,site] of sites)site.group.visible=known.has(id);
  for(const lot of state.settlementLots){
   let site=sites.get(lot.id);
   if(!site){site=createLot(root,lot,windows,emissive);sites.set(lot.id,site);}
   site.group.visible=true;
   site.age=Math.max(0,day-lot.builtAt);
   site.phase=site.age<4?'foundation':site.age<12?'frame':'complete';
   site.foundation.visible=site.phase==='foundation';
   site.frame.visible=site.phase==='frame';
   site.finished.visible=site.phase==='complete';
  }
 }
 return {root,update,stages:()=>[...sites.entries()].filter(([_,v])=>v.group.visible)
  .map(([id,v])=>({id,age:v.age,phase:v.phase,x:v.group.position.x,z:v.group.position.z}))};
}
