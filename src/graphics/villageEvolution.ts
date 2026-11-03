import * as THREE from 'three';
import type {VillageDirection,VillageGrowthState} from '../simulation/villageGrowth.ts';
import {batchStaticSubtree} from './batchStatic';
import {buildMountainRoof} from './villageBuildings';

/**
 * Whole-space growth. Each route changes land use and skyline by new roofs,
 * bridges, boats or farming terraces; none is a minor addon to an old house.
 */
const material=(color:string,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
const M={
 earth:material('#aa9477'),stone:material('#a3aa9e'),stoneDark:material('#747f7b'),
 timber:material('#805f4b'),newTimber:material('#b99a70'),roof:material('#5e7374'),
 darkRoof:material('#4b5e65'),plaster:material('#ddd6c2'),paper:material('#ecd2a3'),
 ochre:material('#b49a63'),crop:material('#6d9458'),cropLight:material('#8bac64'),
 canvas:material('#b87057'),blue:material('#6c9290'),flower:material('#d8c28c'),
 orchard:material('#6d8c60'),gold:material('#c5a15a'),cream:material('#d6cbb6'),
 water:material('#75a9a9',.5),cloth:material('#8eaa95')
};
const boxGeo=new THREE.BoxGeometry(1,1,1),coneGeo=new THREE.ConeGeometry(1,1,8),
 dodec=new THREE.IcosahedronGeometry(1,1);
function block(p:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=M.timber){
 const v=new THREE.Mesh(boxGeo,m);v.position.set(x,y,z);v.scale.set(w,h,d);
 v.castShadow=true;v.receiveShadow=true;p.add(v);return v;
}
function sphere(p:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){
 const mesh=new THREE.Mesh(dodec,m);mesh.position.set(x,y,z);
 mesh.scale.set(w,h,d);mesh.castShadow=true;p.add(mesh);return mesh;
}
function group(p:THREE.Object3D,x=0,y=0,z=0){
 const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;
}
function slopedRoof(p:THREE.Object3D,w:number,d:number,eaveY:number,rise:number,m:THREE.Material=M.roof){
 // A coherent gable silhouette. Roof faces share a ridge; trim is not modeled
 // as additional disconnected slabs on top of the house.
 const positions=[
  -w/2-.22,eaveY,-d/2-.24, 0,eaveY+rise,-d/2-.24, w/2+.22,eaveY,-d/2-.24,
  -w/2-.22,eaveY,d/2+.24,0,eaveY+rise,d/2+.24,w/2+.22,eaveY,d/2+.24
 ];
 const ix=[0,3,1,1,3,4,1,4,2,2,4,5,0,1,2,3,5,4];
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setIndex(ix);geo.computeVertexNormals();
 const roof=new THREE.Mesh(geo,m);roof.castShadow=true;roof.receiveShadow=true;p.add(roof);
 // Only structural ridge and eave cross-beam — no decorative clutter.
 block(p,0,eaveY+rise+.055,0,.14,.11,d+.52,M.stoneDark);
 for(const sx of [-1,1]){
  const edge=block(p,sx*(w/4+.11),eaveY-.035,0,w/2+.19,.09,d+.52,M.timber);
  edge.rotation.z=-sx*Math.atan2(rise,w/2+.22);
 }
 return roof;
}
function house(p:THREE.Object3D,x:number,z:number,w:number,d:number,h:number,variant:'merchant'|'guest'|'riverside'|'cottage'){
 const g=group(p,x,.16,z);
 block(g,0,.15,0,w+.36,.27,d+.33,M.stone);
 const wall=variant==='riverside'?M.cream:variant==='merchant'?M.plaster:M.paper;
 block(g,0,h/2+.28,0,w,h,d,wall);
 for(const xx of [-w*.44,w*.44])for(const zz of [-d*.44,d*.44])
  block(g,xx,h*.50+.31,zz,.14,h+.18,.14,M.timber);
 buildMountainRoof(g,{width:w,depth:d,eave:h+.32,
  rise:variant==='guest'?1.12:variant==='cottage'?.67:.88,
  style:variant==='cottage'?'cottage':'tile',
  material:variant==='guest'?M.darkRoof:M.roof});
 const front=d/2+.09;
 block(g,0,.91,front,.76,1.3,.10,M.timber);
 for(const sx of [-1,1]){
  block(g,sx*w*.30,1.27,front,.42,.48,.09,M.paper);
  for(let i=0;i<3;i++)block(g,sx*w*.30-.16+i*.16,1.27,front+.06,.035,.55,.07,M.timber);
 }
 block(g,0,.28,front+.38,1.22,.15,.62,M.stone);
 if(variant==='guest'){
  // The merchant guesthouse is genuinely two storeys, not an attic decoration.
  for(const sx of [-1,1])block(g,sx*.8,h-.12,front+.04,.48,.50,.07,M.paper);
  block(g,0,h-.48,front+.06,2.0,.11,.11,M.timber);
 }
 return g;
}
function groundPad(p:THREE.Object3D,x:number,z:number,w:number,d:number,m:THREE.Material=M.earth){
 block(p,x,.26,z,w,.12,d,m);
}
function foundation(p:THREE.Object3D,x:number,z:number,w:number,d:number){
 groundPad(p,x,z,w,d,M.earth);
 for(const sx of [-1,1])for(const sz of [-1,1])
  block(p,x+sx*(w*.40),.39,z+sz*(d*.4),.43,.21,.43,M.stone);
}
function timberFrame(p:THREE.Object3D,x:number,z:number,w:number,d:number,height:number){
 groundPad(p,x,z,w+.18,d+.18);
 for(const xx of [-w*.45,w*.45])for(const zz of [-d*.43,d*.43]){
  block(p,x+xx,height*.5+.20,z+zz,.17,height,.17,M.timber);
 }
 for(const zz of [-d*.43,d*.43])block(p,x,height+.2,z+zz,w+.17,.14,.15,M.newTimber);
 for(const xx of [-w*.45,w*.45])block(p,x+xx,height+.2,z,.15,.14,d+.16,M.newTimber);
 for(let i=0;i<3;i++)block(p,x+w*.61+i*.34,.37,z+.75,.28,.24,.87,M.newTimber);
}
function silkTent(p:THREE.Object3D,x:number,z:number,color:THREE.Material,scale=1){
 const g=group(p,x,.22,z);g.scale.setScalar(scale);
 for(const dx of [-1,1])for(const dz of [-1,1])
  block(g,dx*.94,1.05,dz*.75,.12,1.76,.12,M.timber);
 const peak=new THREE.Mesh(coneGeo,color);peak.position.y=2.07;
 peak.scale.set(1.52,.70,1.17);peak.rotation.y=Math.PI/4;peak.castShadow=true;g.add(peak);
 block(g,0,.53,0,1.70,.17,.95,M.newTimber);
 for(let i=0;i<4;i++)sphere(g,-.62+i*.39,.71,-.23,.16,.14,.17,i%2?M.flower:M.cropLight);
 return g;
}
function stoneBridge(p:THREE.Object3D,x:number,z:number){
 const g=group(p,x,.12,z);
 // A different crossing from the existing wooden bridge. Distinct broad stone
 // parapets and arches make it unmistakable at a 25m isometric vista.
 const deck=block(g,0,.70,0,5.9,.28,2.25,M.stone);
 deck.castShadow=true;
 for(let sx=-2.55;sx<=2.55;sx+=.85){
  const rise=.08*(1-Math.abs(sx)/2.75);
  for(const sz of [-.99,.99]){
   block(g,sx,.98+rise,sz,.60,.20,.26,M.stoneDark);
   block(g,sx,1.36+rise,sz,.19,.70,.19,M.stone);
  }
 }
 for(const zside of [-1,1]){
  block(g,0,1.68,zside*1.08,5.75,.16,.23,M.stoneDark);
 }
 for(const xx of [-2.1,0,2.1]){
  // Raised arch shoulders leave open views beneath the crossing.
  for(const zz of [-.78,.78])block(g,xx,.39,zz,.56,.56,.30,M.stone);
 }
 return g;
}
function steps(p:THREE.Object3D,x:number,z:number){
 for(let i=0;i<4;i++)block(p,x+i*.52,.30+i*.055,z, .46,.15,2.4,M.stone);
}
function timberDock(p:THREE.Object3D,x:number,z:number,length=3.7){
 const g=group(p,x,.18,z);
 for(let i=0;i<8;i++){
  block(g,-length/2+i*length/7,.46,0,length/7-.02,.13,1.42,i%2?M.newTimber:M.timber);
 }
 for(const xx of [-length*.43,0,length*.43])for(const zz of [-.6,.6]){
  block(g,xx,.15,zz,.18,.85,.18,M.timber);
 }
 for(let i=0;i<5;i++)block(g,-length*.4+i*.68,.85,-.67,.09,.53,.09,M.timber);
 return g;
}
function fishingBoat(p:THREE.Object3D,x:number,z:number,scale=1){
 const g=group(p,x,.25,z);g.scale.setScalar(scale);
 // A single shared low-poly hull shell and rails. Distinct from rectangular
 // houses so ferry district reads from a distance.
 const shape=new THREE.Shape();
 shape.moveTo(-1.25,-.31);shape.lineTo(1.1,-.31);
 shape.quadraticCurveTo(1.40,0,1.1,.31);
 shape.lineTo(-1.25,.31);shape.quadraticCurveTo(-1.58,0,-1.25,-.31);
 const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.42,bevelEnabled:true,
  bevelSegments:1,bevelSize:.08,bevelThickness:.08,steps:1}),M.timber);
 hull.rotation.x=Math.PI/2;hull.position.y=.20;hull.castShadow=true;g.add(hull);
 block(g,-.15,.33,0,1.55,.12,.72,M.newTimber);
 block(g,0,1.02,-.12,.10,1.35,.12,M.timber);
 const sail=new THREE.Mesh(new THREE.PlaneGeometry(.92,1.10),M.canvas);
 sail.position.set(.50,1.0,-.1);sail.rotation.y=.18;g.add(sail);
 return g;
}
function orchardTree(p:THREE.Object3D,x:number,z:number,size=1){
 const g=group(p,x,.20,z);g.scale.setScalar(size);
 block(g,0,.81,0,.23,1.34,.24,M.timber);
 sphere(g,0,1.85,0,1.12,.83,.96,M.orchard);
 sphere(g,-.56,1.58,.12,.72,.55,.64,M.crop);
 sphere(g,.55,1.70,-.14,.65,.50,.64,M.cropLight);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3; sphere(g,Math.sin(a)*.65,1.6+(i%2)*.25,Math.cos(a)*.56,.11,.12,.10,M.gold);
 }
 return g;
}
function farmland(p:THREE.Object3D,x:number,z:number,w:number,d:number){
 const g=group(p,x,.18,z);
 for(let i=0;i<5;i++){
  const zz=-d*.42+i*(d*.84/4);
  block(g,0,.20+i*.035,zz,w,.20,d/6.7,M.earth);
  for(let j=0;j<9;j++)sphere(g,-w*.43+j*w*.105,.37+i*.035,zz,.18,.17,.18,j%2?M.crop:M.cropLight);
 }
 for(const xx of [-w/2,w/2])block(g,xx,.50,0,.12,.82,d+.20,M.timber);
 return g;
}
function tradeCourt(p:THREE.Object3D,x:number,z:number){
 const g=group(p,x,.20,z);
 g.name='connected-east-bank-market';
 // A compact *single* covered market, not two tent roofs hidden beneath yet
 // another oversized house roof. It sits fully east of the creek's bank.
 for(let row=0;row<4;row++)for(let col=0;col<6;col++){
  block(g,-1.60+col*.64,.105,-1.08+row*.67,.55,.075,.55,
   (row+col)%3===0?M.stoneDark:M.stone);
 }
 for(const xx of [-1.42,1.42])for(const zz of [-.95,.95])
  block(g,xx,1.14,zz,.14,1.84,.14,M.timber);
 buildMountainRoof(g,{width:3.55,depth:2.42,eave:2.11,
  rise:.75,style:'workshop',material:M.darkRoof});
 // Two inhabited counters beneath one shared canopy.
 for(const xx of [-.77,.82]){
  block(g,xx,.56,.07,1.23,.15,.65,M.newTimber);
  for(let i=0;i<3;i++)
   sphere(g,xx-.35+i*.34,.73,.08,.17,.14,.17,i%2?M.flower:M.cropLight);
 }
 return g;
}
function fisherYard(p:THREE.Object3D,x:number,z:number){
 const g=group(p,x,.16,z);
 groundPad(g,0,0,4.1,3.5,M.stone);
 // A long communal net-drying gantry, ropes and fishing baskets, rather than
 // unrelated wooden blocks stuck onto a tavern roof.
 for(const xx of [-1.6,1.6]){
  block(g,xx,1.08,-.98,.15,1.85,.15,M.timber);
  block(g,xx,1.08,.98,.15,1.85,.15,M.timber);
 }
 block(g,0,1.94,-.98,3.45,.13,.15,M.newTimber);
 block(g,0,1.94,.98,3.45,.13,.15,M.newTimber);
 for(let i=0;i<9;i++){
  const y=1.22+i*.074;
  block(g,0,y,-.96,3.15,.027,.035,M.cream);
 }
 for(let i=0;i<5;i++)block(g,-1.40+i*.70,1.58,-.96,.027,.75,.045,M.cream);
 silkTent(g,.60,.35,M.blue,.75);
 return g;
}
function orchardCourt(p:THREE.Object3D,x:number,z:number){
 const g=group(p,x,.18,z);
 // One landscaped, visible green district: three seasonal terrace levels
 // and an L-shaped village garden distinct from a square stone market.
 for(let i=0;i<4;i++){
  block(g,0,.25+i*.10,-1.7+i*.64,5.8,.32,.52,M.earth);
  for(let k=0;k<11;k++)sphere(g,-2.45+k*.49,.49+i*.10,-1.7+i*.64,
   .19,.15,.22,k%2?M.cropLight:M.crop);
 }
 orchardTree(g,-2.6,1.25,.95);
 orchardTree(g,2.5,-1.25,.84);
 orchardTree(g,2.1,1.25,1.12);
 return g;
}
/** Authored safe parcels on the east bank; footprints fit the island and
 * keep at least ~2.4 world units clear of the centerline river surface.
 */
export const BRIDGE_DISTRICT_PARCELS={
 market:{x:12.35,z:-1.15,w:3.85,d:2.85},
 merchant:{x:12.58,z:3.38,w:3.10,d:2.68},
 guest:{x:12.0,z:-5.25,w:2.65,d:2.20}
} as const;
function routeObjects(parent:THREE.Group,direction:VillageDirection){
 const foundationStage=group(parent),constructionStage=group(parent),
  landmarkStage=group(parent),thrivingStage=group(parent);
 const origin=direction==='bridge'?[BRIDGE_DISTRICT_PARCELS.market.x,BRIDGE_DISTRICT_PARCELS.market.z]:direction==='ferry'?[10.55,-6.1]:[-5.5,-8.1];
 const [x,z]=origin;
 foundation(foundationStage,x,z,4.0,3.3);
 timberFrame(constructionStage,x,z,4.0,3.3,2.1);
 if(direction==='bridge'){
  foundation(foundationStage,8.0,-2.3,5.8,2.2);
  steps(constructionStage,7.4,-2.30);timberFrame(constructionStage,BRIDGE_DISTRICT_PARCELS.market.x,BRIDGE_DISTRICT_PARCELS.market.z,3.5,2.5,2.0);
  stoneBridge(landmarkStage,7.85,-2.38);
  tradeCourt(landmarkStage,BRIDGE_DISTRICT_PARCELS.market.x,BRIDGE_DISTRICT_PARCELS.market.z);
  house(landmarkStage,BRIDGE_DISTRICT_PARCELS.merchant.x,BRIDGE_DISTRICT_PARCELS.merchant.z,BRIDGE_DISTRICT_PARCELS.merchant.w,BRIDGE_DISTRICT_PARCELS.merchant.d,2.55,'merchant');
  // Later growth expands the upper bank without covering the foreground
  // bridge, creek or the area reserved for public footpaths.
  house(thrivingStage,BRIDGE_DISTRICT_PARCELS.guest.x,BRIDGE_DISTRICT_PARCELS.guest.z,BRIDGE_DISTRICT_PARCELS.guest.w,BRIDGE_DISTRICT_PARCELS.guest.d,3.02,'guest');
 }else if(direction==='ferry'){
  foundation(foundationStage,6.5,-5.55,3.9,2.0);
  timberDock(constructionStage,6.9,-5.75,3.7);
  timberDock(landmarkStage,6.75,-5.72,3.9);
  timberDock(landmarkStage,6.7,-1.55,2.7);
  fishingBoat(landmarkStage,7.0,-5.20,1.0);
  fishingBoat(landmarkStage,7.5,-1.05,.80);
  fisherYard(landmarkStage,10.8,-2.55);
  house(landmarkStage,10.4,-6.1,3.40,2.72,2.12,'riverside');
  // The communal riverside drying yard replaces the generic sale tent.
  house(thrivingStage,11.45,-8.2,3.1,2.40,1.92,'riverside');
  fishingBoat(thrivingStage,8.2,-3.85,.76);
  silkTent(thrivingStage,9.8,-1.6,M.cloth,.72);
 }else{
  foundation(foundationStage,-10.7,-7.9,3.8,2.6);
  farmland(constructionStage,-11.0,-7.45,3.25,2.25);
  house(landmarkStage,-5.6,-8.1,3.50,2.96,2.18,'cottage');
  orchardCourt(landmarkStage,-3.4,8.25);
  farmland(landmarkStage,-10.75,-7.45,3.4,2.20);
  for(const [tx,tz,size] of [[-12.2,-3.15,.77],[-14.0,-1.4,.82],
    [-13.0,-5.25,.9],[-8.3,-8.40,.80]] as const)orchardTree(landmarkStage,tx,tz,size);
  house(thrivingStage,-1.75,-9.35,2.75,2.32,1.84,'cottage');
  farmland(thrivingStage,-13.55,1.3,2.6,2.4);
  for(const [tx,tz,size] of [[-13.3,3.2,.78],[-5.1,-10.4,.79],
    [-9.05,-9.3,.68]] as const)orchardTree(thrivingStage,tx,tz,size);
 }
 // Preserve stage-level visible masses; don't batch mutually exclusive phases.
 for(const stage of [foundationStage,constructionStage,landmarkStage,thrivingStage]){
  stage.visible=false;batchStaticSubtree(stage,{disposeOriginals:false});
 }
 return {foundationStage,constructionStage,landmarkStage,thrivingStage};
}
export interface VillageGrowthGraphics{
 root:THREE.Group;targets:THREE.Group[];update(state:VillageGrowthState):void;
 visualSignature():string;landmarkCount():number;
}
export function buildVillageEvolution(parent:THREE.Object3D):VillageGrowthGraphics{
 const root=group(parent);root.name='village-evolution';
 const roots=new Map<VillageDirection,ReturnType<typeof routeObjects>>();
 const targets:THREE.Group[]=[];
 for(const option of ['bridge','ferry','grove'] as const){
  const site=group(root);site.name='development-'+option;
  site.userData.buildingId='valley-'+option;
  targets.push(site);
  roots.set(option,routeObjects(site,option));
 }
 let signature='';
 function update(s:VillageGrowthState){
  const desired=s.choice+'/'+s.phase;
  if(signature===desired)return;signature=desired;
  for(const [key,layers] of roots){
   const show=s.choice===key;
   const site=layers.foundationStage.parent;
   if(site)site.visible=show&&s.phase!=='quiet'&&s.phase!=='invitation';
   layers.foundationStage.visible=show&&s.phase==='foundation';
   layers.constructionStage.visible=show&&s.phase==='construction';
   layers.landmarkStage.visible=show&&(s.phase==='landmark'||s.phase==='thriving');
   layers.thrivingStage.visible=show&&s.phase==='thriving';
  }
 }
 return {root,targets,update,visualSignature:()=>signature,
  landmarkCount:()=>root.children.filter(x=>x.visible&&x.children.some(o=>o.visible)).length};
}
