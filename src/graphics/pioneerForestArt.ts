import * as THREE from 'three';
import type {PioneerWorld,PioneerResourceSite} from '../simulation/pioneerWorld.ts';
import {pioneerIslandFraction} from '../simulation/pioneerGeography.ts';
import {isSafePioneerWildPlant} from '../simulation/pioneerNaturalAnchors.ts';

/** The resource site's inventory remains aggregated. These few instanced
 * silhouettes and an event-driven falling tree show its state without
 * making every painted pine an independent economy object. */
const bark=new THREE.MeshStandardMaterial({color:'#665e4b',roughness:1});
const pineA=new THREE.MeshStandardMaterial({color:'#527a65',roughness:1});
const pineB=new THREE.MeshStandardMaterial({color:'#729177',roughness:1});
const clearingMat=new THREE.MeshStandardMaterial({
 color:'#b49a70',roughness:1,transparent:true,opacity:.95,depthWrite:true,
 side:THREE.DoubleSide});
const brushMat=new THREE.MeshStandardMaterial({color:'#708f68',roughness:1});
const stumpMat=new THREE.MeshStandardMaterial({color:'#ab875f',roughness:1});
const soilMat=new THREE.MeshStandardMaterial({color:'#806c51',roughness:1});
const cap=new THREE.ConeGeometry(1,1.5,7);
const trunk=new THREE.CylinderGeometry(.11,.16,1,7);
const shrub=new THREE.IcosahedronGeometry(1,0);
const disk=new THREE.CircleGeometry(1,24);
const rootName='persistent-pioneer-forest-and-clearings';
function hash(n:number){
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return ((k^(k>>>16))>>>0)/4294967296;
}
function group(parent:THREE.Object3D,x=0,z=0){
 const g=new THREE.Group();g.position.set(x,.17,z);parent.add(g);return g;
}
function conifer(parent:THREE.Object3D,x:number,z:number,size=1){
 const g=group(parent,x,z);
 const t=new THREE.Mesh(trunk,bark);t.position.y=.53*size;
 t.scale.set(size,1.08*size,size);
 t.castShadow=true;g.add(t);
 for(let k=0;k<3;k++){
  const c=new THREE.Mesh(cap,k===1?pineB:pineA);
  c.scale.set((.69-k*.105)*size,(.94-k*.05)*size,(.69-k*.105)*size);
  c.position.y=(1.09+k*.44)*size;
  c.castShadow=true;g.add(c);
 }
 return g;
}
function felled(parent:THREE.Object3D,x:number,z:number){
 const g=group(parent,x,z);g.name='actual-felled-tree-event';
 const t=new THREE.Mesh(trunk,bark);t.position.y=.70;
 t.scale.set(.95,1.42,.95);t.castShadow=true;g.add(t);
 const c=new THREE.Mesh(cap,pineB);c.position.y=1.32;c.scale.set(.66,.87,.66);
 c.castShadow=true;g.add(c);
 return g;
}
function bush(parent:THREE.Object3D,x:number,z:number,scale:number){
 const g=group(parent,x,z);g.name='surveyed-frontier-undergrowth';
 const b=new THREE.Mesh(shrub,brushMat);b.position.y=.24*scale;
 b.scale.set(.37*scale,.30*scale,.34*scale);
 b.castShadow=true;g.add(b);return g;
}
function stump(parent:THREE.Object3D,x:number,z:number){
 const g=group(parent,x,z);g.name='forest-cut-stump';
 const trunkMesh=new THREE.Mesh(trunk,bark);
 trunkMesh.position.y=.11;trunkMesh.scale.set(1.48,.24,1.48);
 g.add(trunkMesh);
 const top=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.035,9),stumpMat);
 top.position.y=.24;g.add(top);
 return g;
}
function activeTreePosition(site:PioneerResourceSite,n:number):[number,number]{
 const theta=hash(n*107+site.id.length*31)*Math.PI*2;
 const radius=1.12+(n%4)*.38;
 return [site.x+Math.cos(theta)*radius,site.z+Math.sin(theta)*radius];
}
function nearBuilding(s:PioneerWorld,x:number,z:number){
 return s.buildings.some(b=>Math.hypot(x-b.parcel.x,z-b.parcel.z)<
  Math.max(b.parcel.width,b.parcel.depth)*.62+.95);
}
export interface PioneerForestGraphics{
 root:THREE.Group;update(s:PioneerWorld,seconds:number):void;
 signatures():{standing:number;stumps:number;clearings:number;cleared:number;falling:boolean};
}
export function buildPioneerForestArt(parent:THREE.Group,s:PioneerWorld):PioneerForestGraphics{
 const layer=new THREE.Group();layer.name=rootName;parent.add(layer);
 let lastSignature='',standing=0,stumps=0,clearings=0,cleared=0;
 let falling:THREE.Group|null=null;
 let signatureState:ReturnType<PioneerForestGraphics['signatures']>={
  standing:0,stumps:0,clearings:0,cleared:0,falling:false};
 function rebuild(w:PioneerWorld){
  while(layer.children.length)layer.remove(layer.children[0]);
  standing=0;stumps=0;
  for(const site of w.sites.filter(x=>x.kind==='forest')){
   const patch=group(layer,0,0);patch.name='real-harvest-grove-'+site.id;
   patch.userData.siteId=site.id;
   // Stock and regrowth control density, with a few surviving saplings.
   const visible=Math.max(1,Math.round(1+site.stock/site.capacity*9));
   const livingPositions:[number,number][]=[];
   for(let n=0;n<visible;n++){
    const [x,z]=activeTreePosition(site,n);
    if(!isSafePioneerWildPlant(w,x,z,.34)||nearBuilding(w,x,z))continue;
    conifer(patch,x,z,(.56+(n%3)*.13)*(site.stock/site.capacity<.35?.80:1));
    livingPositions.push([x,z]);standing++;
   }
   // Only genuinely gathered timber creates stumps. Don't erase the whole
   // grove's history when four fixed sockets are obstructed by later homes.
   // Deterministically search new *legal nearby* positions, avoiding trunks.
   const stumpCount=Math.min(4,Math.floor(site.totalGathered/7));
   const placed:[number,number][]=[];
   for(let n=0;n<stumpCount;n++){
    for(let attempt=0;attempt<96;attempt++){
     const [x,z]=activeTreePosition(site,11+n*113+attempt);
     if(!isSafePioneerWildPlant(w,x,z,.20)||nearBuilding(w,x,z))continue;
     if([...livingPositions,...placed].some(([tx,tz])=>Math.hypot(tx-x,tz-z)<.48))continue;
     stump(patch,x,z);placed.push([x,z]);stumps++;break;
    }
   }
  }
  // Western buffer is visibly undergrown before it is made usable.
  // The first trees are small and sparse; large inherited valley
  // silhouettes remain separate protected world-kit and never reskin.
  for(let n=0;n<92;n++){
   const x=-19.0+hash(w.seed*7+n*31)*9.5;
   const z=-9.1+hash(w.seed*11+n*47)*18.2;
   if(pioneerIslandFraction(x,z,2.15,2.1)>.93)continue;
   if(Math.hypot(x-w.camp.x,z-w.camp.z)<4.8)continue;
   if(!isSafePioneerWildPlant(w,x,z,.28)||nearBuilding(w,x,z))continue;
   const clearing=w.frontier.clearings.find(c=>
    Math.hypot(x-c.x,z-c.z)<c.radius+.36);
   if(clearing?.phase==='cleared')continue;
   const scale=(.38+hash(n*67)*.40)*(clearing?.phase==='clearing'?.62:1);
   bush(layer,x,z,scale);
  }
  clearings=w.frontier.clearings.length;
  cleared=w.frontier.clearings.filter(c=>c.phase==='cleared').length;
  for(const plot of w.frontier.clearings){
   const g=group(layer,plot.x,plot.z);g.name='real-pioneer-clearing-'+plot.id;
   g.userData.clearingId=plot.id;
   const ground=new THREE.Mesh(disk,plot.phase==='cleared'?clearingMat:soilMat);
   ground.rotation.x=-Math.PI/2;ground.position.y=.05;
   const fraction=plot.phase==='cleared'?1:.30+plot.workDone/plot.workRequired*.70;
   ground.scale.set(plot.radius*fraction,plot.radius*fraction,1);
   g.add(ground);
   const pieces=plot.phase==='cleared'?3:6-Math.floor(plot.workDone/2);
   // The general wild-plant mask rightly forbids growth on every cleared
   // parcel. But this plot's *own paid cut stumps* must be allowed inside
   // that very parcel; retain all house, road, creek and other plot checks.
   const plotSafety=plot.phase==='cleared'?{
    ...w,frontier:{...w.frontier,
     clearings:w.frontier.clearings.filter(other=>other.id!==plot.id)}
   }:w;
   for(let n=0;n<pieces;n++){
    const theta=hash(w.seed+n*87+plot.id.length*23)*Math.PI*2;
    const r=hash(n*19+plot.startedAt)*plot.radius*.65;
    const px=plot.x+Math.cos(theta)*r,pz=plot.z+Math.sin(theta)*r;
    if(!isSafePioneerWildPlant(plotSafety,px,pz,.19))continue;
    if(plot.phase==='cleared'){
     stump(g,Math.cos(theta)*r,Math.sin(theta)*r);
     stumps++; // a paid clearing is an actual persistent cut trace
    }else bush(g,Math.cos(theta)*r,Math.sin(theta)*r,.72);
   }
  }
  falling=null;
  const last=w.frontier.lastFelling;
  if(last){
   // Stump persists; a newly fallen tree is animated only during its saved
   // event window. Reloading a years-old save never replays old felling.
   const g=group(layer,last.x,last.z);g.userData.siteId=last.siteId;
   if(isSafePioneerWildPlant(w,last.x,last.z,.18)){
    stump(g,0,0);falling=felled(g,0,0);
    falling.userData.fallDirection=[last.dx,last.dz];
   }
  }
 }
 function update(w:PioneerWorld,_seconds:number){
  const signature=w.sites.filter(s=>s.kind==='forest').map(s=>
   s.id+':'+Math.round(s.stock/s.capacity*10)+':'+Math.floor(s.totalGathered/7)).join('|')+
   '/'+w.buildings.map(b=>b.id).join('|')+
   '/'+w.frontier.clearings.map(c=>c.id+':'+c.phase+':'+Math.floor(c.workDone/2)).join('|')+
   '/'+(w.frontier.lastFelling?.serial??-1);
  if(signature!==lastSignature){
   rebuild(w);lastSignature=signature;
  }
  const last=w.frontier.lastFelling,age=last?w.minutes-last.minute:Infinity;
  if(falling&&last&&age>=0&&age<150){
   falling.visible=true;
   const t=Math.min(1,age/45),e=t*t*(3-2*t);
   falling.rotation.z=-last.dx*Math.PI*.47*e;
   falling.rotation.x=last.dz*Math.PI*.47*e;
  }else if(falling)falling.visible=false;
  signatureState={standing,stumps,clearings,cleared,
   falling:!!(falling&&falling.visible)};
 }
 update(s,0);
 return {root:layer,update,signatures:()=>signatureState};
}
