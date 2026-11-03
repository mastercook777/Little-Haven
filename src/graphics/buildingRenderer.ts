import * as THREE from 'three';
import {conditionOf,type BuildingState} from '../simulation/buildings.ts';
import {plotFor} from '../simulation/plots.ts';
import {batchStaticSubtree} from './batchStatic';

/**
 * A small authored building-kit overlay. The actual base houses remain in village.ts,
 * while these independently managed geometry pieces show age, work and daily life.
 * This module reads only simulated data; no meshes are part of the saved game.
 */
const wood=new THREE.MeshStandardMaterial({color:'#775a46',roughness:1});
const freshWood=new THREE.MeshStandardMaterial({color:'#bfa37a',roughness:1});
const fadedWood=new THREE.MeshStandardMaterial({color:'#766b5b',roughness:1});
const tilePatch=new THREE.MeshStandardMaterial({color:'#827e72',roughness:1});
const freshTile=new THREE.MeshStandardMaterial({color:'#69777a',roughness:1});
const cloth=new THREE.MeshStandardMaterial({color:'#c9a98d',side:THREE.DoubleSide,roughness:1});
const redCloth=new THREE.MeshStandardMaterial({color:'#ad6e59',side:THREE.DoubleSide,roughness:1});
const stone=new THREE.MeshStandardMaterial({color:'#aaa28c',roughness:1});
function box(g:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
 return mesh;
}
function cylinder(g:THREE.Object3D,r:number,h:number,x:number,y:number,z:number,m:THREE.Material){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8),m);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
 return mesh;
}
function group(parent:THREE.Object3D,x:number,y:number,z:number){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;
}
function brace(g:THREE.Group,w:number,h:number,d:number){
 for(const x of [-w/2,w/2]){
  box(g,.085,h,.085,x,h/2,0,freshWood);
  for(const z of [-d/2,d/2])box(g,.075,h*.85,.075,x,h*.45,z,wood);
 }
 box(g,w+.2,.10,.10,0,h*.76,d/2,wood);
 box(g,w+.2,.10,.10,0,h*.76,-d/2,wood);
 box(g,w+.2,.10,.08,0,h*.42,d/2,fadedWood);
}
interface Model {worn:THREE.Group;severe:THREE.Group;repair:THREE.Group;newTiles:THREE.Group;props:Record<string,THREE.Group>;}
function houseKit(root:THREE.Object3D,id:string,height:number,front:number,scale:number):Model{
 const plot=plotFor(id);if(!plot)throw Error('Unmapped building '+id);
 const [x,z]=plot.position;const g=group(root,x,.18,z);g.userData.buildingId=id;
 const worn=group(g,0,0,0),severe=group(g,0,0,0),repair=group(g,0,0,0),newTiles=group(g,0,0,0);
 for(const sign of [-1,1]){
  for(let i=0;i<3;i++){
   const p=box(worn,.45*scale,.044,.36*scale,sign*(.45+i*.29)*scale,height+.18-i*.06,(-.64+i*.34)*scale,tilePatch);
   p.rotation.z=-sign*.16;
  }
  for(let i=0;i<3;i++){
   const p=box(severe,.56*scale,.055,.41*scale,sign*(.63+i*.25)*scale,height+.05-i*.08,(.22+i*.29)*scale,fadedWood);
   p.rotation.z=-sign*.19;
  }
  for(let i=0;i<4;i++){
   const p=box(newTiles,.47*scale,.055,.36*scale,sign*(.35+i*.27)*scale,height+.18-i*.063,(-.5+i*.28)*scale,freshTile);
   p.rotation.z=-sign*.16;
  }
 }
 // Side scaffold rather than a magical instant color swap.
 const scaffolding=group(repair,0,0,front+.48);
 brace(scaffolding,3.1*scale,3.35*scale,.66*scale);
 for(let i=0;i<3;i++)box(repair,.50,.27,.38,-1.6*scale+i*.50*scale,.35,front+.8,stone);
 for(let i=0;i<3;i++)box(repair,.42,.11,.32,1.55*scale+i*.24,.22,front+.63,freshWood);
 const props:Record<string,THREE.Group>={};
 const makeProp=(name:string)=>props[name]=group(g,0,0,0);
 if(id==='inn-001'){
  const umbrellas=makeProp('guest-umbrella');
  cylinder(umbrellas,.30,.48,3.55,.38,3.15,wood);
  for(let i=0;i<3;i++){
   const shaft=box(umbrellas,.045,.85,.045,3.33+i*.19,.84,3.08,wood);shaft.rotation.z=(i-1)*.17;
   const hood=box(umbrellas,.54,.05,.32,3.33+i*.19,1.28,3.08,i===1?redCloth:cloth);hood.rotation.z=.2;
  }
  const sign=makeProp('road-sign');
  box(sign,.12,2.0,.12,5.15,1.0,3.65,wood);
  const board=box(sign,1.08,.43,.12,5.15,1.65,3.65,freshWood);board.rotation.y=.16;
  const tea=makeProp('warm-tea');
  for(let i=0;i<3;i++)cylinder(tea,.18,.25,2.8+i*.46,.34,3.5,stone);
  const drain=makeProp('drainage');
  box(drain,5.0,.12,.16,0,3.75,2.35,freshTile);
  cylinder(drain,.16,.8,2.48,2.65,2.45,freshTile);
 }else{
  const firewood=makeProp('firewood');
  for(let i=0;i<6;i++){const o=cylinder(firewood,.17,.68,-1.4+i%3*.37,.42+Math.floor(i/3)*.33,1.78,wood);o.rotation.z=Math.PI/2;}
  const laundry=makeProp('laundry');
  box(laundry,.06,1.65,.06,1.25,.87,1.82,wood);
  box(laundry,.06,1.65,.06,2.75,.87,1.82,wood);
  box(laundry,1.55,.045,.045,2.0,1.52,1.82,wood);
  for(let i=0;i<3;i++){
   const sheet=box(laundry,.40,.59,.035,1.53+i*.49,1.23,1.83,i===1?redCloth:cloth);
   sheet.rotation.z=(i-1)*.11;
  }
 }
 return {worn,severe,repair,newTiles,props};
}
function benchKit(root:THREE.Object3D){
 const plot=plotFor('bench-001');if(!plot)throw Error('bench plot missing');
 const [x,z]=plot.position,g=group(root,x,.2,z);g.userData.buildingId='bench-001';
 const plan=group(g,0,0,0),foundation=group(g,0,0,0),construction=group(g,0,0,0),complete=group(g,0,0,0);
 for(const s of [-1,1]){
  box(plan,.08,.65,.08,s*.82,.33,0,fadedWood);
  box(foundation,.24,.24,.23,s*.85,.12,-.18,stone);
 }
 box(plan,1.8,.06,.07,0,.18,.5,fadedWood);
 box(foundation,2.0,.15,.68,0,.12,0,stone);
 brace(construction,1.82,.81,.45);
 for(const sx of [-.68,.68]){
  box(complete,.16,.65,.16,sx,.39,-.14,wood);
  box(complete,.14,.70,.15,sx,.51,.22,wood);
 }
 box(complete,1.88,.15,.68,0,.71,0,freshWood);
 box(complete,1.85,.12,.22,0,1.04,.22,freshWood);
 // A small foot-worn patch and a kettle make this a *used* bench, not a trophy.
 box(complete,2.1,.025,.78,0,.02,0,stone);
 cylinder(complete,.16,.20,.59,.86,-.01,stone);
 return {g,plan,foundation,construction,complete};
}
export interface BuildingRenderer {
 root:THREE.Group;targets:THREE.Group[];update(buildings:readonly BuildingState[]):void;
}
export function makeBuildingRenderer(parent:THREE.Object3D):BuildingRenderer{
 const root=group(parent,0,0,0);
 const inn=houseKit(root,'inn-001',3.34,2.52,1.62);
 const home=houseKit(root,'home-001',2.58,1.54,.94);
 const bench=benchKit(root);
 batchStaticSubtree(root,{disposeOriginals:false});
 let last='';
 return {root,targets:[bench.g],update(buildings){
  const signature=buildings.map(b=>[b.id,b.phase,Math.floor(b.conditionScore/5),Math.floor(b.workProgress*10),b.props.join('|')].join(':')).join(';');
  if(signature===last)return;last=signature;
  for(const [id,kit] of [['inn-001',inn],['home-001',home]] as const){
   const b=buildings.find(item=>item.id===id);if(!b)continue;
   const state=conditionOf(b);
   kit.worn.visible=state==='worn'||state==='dilapidated';
   kit.severe.visible=state==='dilapidated';
   kit.repair.visible=b.phase==='repairing';
   kit.newTiles.visible=b.props.includes('repaired-tiles');
   for(const [prop,group] of Object.entries(kit.props))group.visible=b.props.includes(prop);
  }
  const facility=buildings.find(b=>b.id==='bench-001');
  bench.plan.visible=facility?.phase==='planned';
  bench.foundation.visible=facility?.phase==='foundation';
  bench.construction.visible=facility?.phase==='construction';
  bench.complete.visible=facility?.phase==='occupied';
 }};
}
