import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Group-local static geometry baking. Keep group boundaries, materials and
 * picking roots; animated bamboo, swing, building and weather roots still move.
 * This reduces per-mesh draw calls without freezing dynamic world state.
 */
export interface BatchStats{before:number;after:number;merged:number;groups:number;}
export function batchStaticSubtree(root:THREE.Group,options:{disposeOriginals?:boolean;preserveNamedMeshes?:boolean}={}):BatchStats{
 const result:BatchStats={before:0,after:0,merged:0,groups:0};
 const removedGeometries=new Set<THREE.BufferGeometry>();
 const visit=(parent:THREE.Group)=>{
  const nested=[...parent.children].filter((o):o is THREE.Group=>o instanceof THREE.Group);
  for(const child of nested)visit(child);
  const bins=new Map<string,THREE.Mesh[]>();
  for(const child of parent.children){
   if(!(child instanceof THREE.Mesh)||child instanceof THREE.InstancedMesh||child.userData.keepDynamicMesh||
    (options.preserveNamedMeshes&&child.name.length>0))continue;
   result.before++;
   if(Array.isArray(child.material)||child.material.transparent||child.material.opacity<1)continue;
   const geo=child.geometry as THREE.BufferGeometry;
   if(!geo||!geo.getAttribute('position'))continue;
   const attrs=Object.keys(geo.attributes).sort().join(',');
   const material=child.material as THREE.Material;
   const key=[material.uuid,geo.index?'indexed':'nonindexed',attrs,child.castShadow?'shadow':'noShadow',child.receiveShadow?'receive':'noReceive'].join(':');
   const bin=bins.get(key)||[];bin.push(child);bins.set(key,bin);
  }
  for(const bin of bins.values()){
   if(bin.length<2)continue;
   const copies:THREE.BufferGeometry[]=[];
   for(const m of bin){m.updateMatrix();copies.push(m.geometry.clone().applyMatrix4(m.matrix));}
   const merged=mergeGeometries(copies,false);
   if(!merged){for(const g of copies)g.dispose();continue;}
   for(const g of copies)g.dispose();
   const m=new THREE.Mesh(merged,bin[0].material);
   m.name='batched-'+parent.name;
   m.castShadow=bin[0].castShadow;m.receiveShadow=bin[0].receiveShadow;
   parent.add(m);
   for(const old of bin){parent.remove(old);removedGeometries.add(old.geometry);}
   result.merged+=bin.length;result.groups++;
  }
 };
 visit(root);
 const activeGeometries=new Set<THREE.BufferGeometry>();
 root.traverse(o=>{if(o instanceof THREE.Mesh){result.after++;activeGeometries.add(o.geometry);}});
 if(options.disposeOriginals!==false)for(const geo of removedGeometries)if(!activeGeometries.has(geo))geo.dispose();
 return result;
}
