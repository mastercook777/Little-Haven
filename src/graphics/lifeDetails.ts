import * as THREE from 'three';

/** Shared workshop vignette kit: legible occupations rather than identical houses.
 * Built once and baked into the static village. Not tied to saved plot construction.
 */
const mats={
 wood:new THREE.MeshStandardMaterial({color:'#725b49',roughness:1}),
 fresh:new THREE.MeshStandardMaterial({color:'#b99c73',roughness:1}),
 reed:new THREE.MeshStandardMaterial({color:'#b9a578',roughness:1}),
 stone:new THREE.MeshStandardMaterial({color:'#a4a79a',roughness:1}),
 pottery:new THREE.MeshStandardMaterial({color:'#876e61',roughness:1}),
 canvas:new THREE.MeshStandardMaterial({color:'#cdb893',roughness:1}),
 herb:new THREE.MeshStandardMaterial({color:'#71865a',roughness:1})
};
const block=new THREE.BoxGeometry(1,1,1);
const cylinder=new THREE.CylinderGeometry(.5,.5,1,8);
function box(g:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=mats.wood){
 const m=new THREE.Mesh(block,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function round(g:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,mat:THREE.Material=mats.reed){
 const m=new THREE.Mesh(cylinder,mat);m.position.set(x,y,z);m.scale.set(r*2,h,r*2);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function cluster(g:THREE.Object3D,x:number,z:number,type:'tea'|'logs'|'jars'){
 if(type==='logs')for(let i=0;i<9;i++){
  const a=box(g,x+(i%3)*.32,.37+Math.floor(i/3)*.2,z+(i%2)*.10,.27,.16,.82,mats.fresh);
  a.rotation.y=.10*(i%3-1);
 }else if(type==='tea')for(let i=0;i<6;i++){
  round(g,x+(i%3)*.44,.42+Math.floor(i/3)*.18,z+(i%2)*.14,.23,.12,mats.reed);
  box(g,x+(i%3)*.44,.56+Math.floor(i/3)*.18,z+(i%2)*.14,.27,.06,.23,mats.herb);
 }else for(let i=0;i<5;i++){
  round(g,x+(i%3)*.33,.47,z+(i>>1)*.37,.15,.45,mats.pottery);
  round(g,x+(i%3)*.33,.72,z+(i>>1)*.37,.09,.07,mats.wood);
 }
}
export function buildVillageWorkplaces(parent:THREE.Object3D){
 const root=new THREE.Group();root.name='village-workshops';parent.add(root);
 // Woodcutter's forest-edge saw horse and stacked fuel, away from the tavern entrance.
 const forest=new THREE.Group();forest.position.set(-12.6,.17,-1.45);root.add(forest);
 cluster(forest,.10,-.4,'logs');
 for(const x of [-.55,.55]){
  const leg=box(forest,x,.64,.77,.10,.94,.10,mats.wood);leg.rotation.z=x*.21;
 }
 box(forest,0,1.08,.77,1.43,.13,.18,mats.fresh);
 // Tea-drying terrace and woven storage bins create a distinct farming rhythm.
 const tea=new THREE.Group();tea.position.set(-10.35,.17,7.12);root.add(tea);
 for(const x of [-1.0,1.0])for(const z of [-.43,.43]){
  box(tea,x,.72,z,.11,1.0,.11,mats.wood);
 }
 box(tea,0,1.12,0,2.55,.12,1.13,mats.fresh);
 for(let i=0;i<5;i++){const leaf=box(tea,-1.0+i*.5,1.20,0,.34,.055,.38,mats.herb);leaf.rotation.y=.19*i;}
 cluster(tea,1.2,.9,'tea');
 // Fishing bench and nets on the west bank (the river flows east).
 const fish=new THREE.Group();fish.position.set(6.35,.21,-3.75);root.add(fish);
 for(const x of [-.72,.72])box(fish,x,.62,.02,.12,.77,.12);
 box(fish,0,.99,.02,1.75,.14,.48,mats.fresh);
 for(let i=0;i<4;i++){
  const pole=box(fish,-.70+i*.32,.75,-.67,.055,1.3,.055,mats.reed);
  pole.rotation.x=-.25;
 }
 round(fish,.79,.33,.73,.27,.32,mats.reed);
 // Clothesline and loom frame beside the weaver's east-side dwelling.
 const loom=new THREE.Group();loom.position.set(3.55,.17,-7.18);root.add(loom);
 for(const x of [-.71,.71])for(const z of [-.32,.32])box(loom,x,.60,z,.10,.95,.10);
 box(loom,0,1.05,-.3,1.58,.08,.10,mats.wood);
 box(loom,0,.74,.03,1.48,.07,.80,mats.fresh);
 for(let i=0;i<7;i++)box(loom,-.65+i*.22,.92,.03,.035,.24,.41,i%3?mats.canvas:mats.reed);
 round(loom,.98,.30,.2,.29,.17,mats.reed);
 // Tavern's side wine racks distinguish the hero building from household doors.
 const wine=new THREE.Group();wine.position.set(-7.15,.18,1.58);root.add(wine);
 for(const x of [-.78,.78])box(wine,x,.88,.0,.11,1.36,.11);
 for(let i=0;i<3;i++)box(wine,0,.32+i*.48,0,1.77,.10,.7,mats.wood);
 cluster(wine,-.44,.02,'jars');cluster(wine,.57,.02,'jars');
 // Small stepping stones connect side courtyards to the main paths.
 for(const [x,z,dx,dz] of [[-10.8,-3.9,.38,.19],[-11.6,-2.4,.25,.1],
  [3.9,-5.9,.39,.26],[4.8,1.45,.28,.24],[-9.9,4.75,.28,.23]] as const){
  for(let i=0;i<3;i++){
   const s=box(root,x+i*dx,.288,z+i*dz,.34,.055,.29,mats.stone);
   s.rotation.y=(i-1)*.11;
  }
 }
 return root;
}
