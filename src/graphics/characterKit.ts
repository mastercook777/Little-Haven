import * as THREE from 'three';
import type {Villager} from '../simulation/world.ts';

/**
 * Integrated cloth silhouettes for the default isometric camera.
 * The previous version used rectangles for chest armor, aprons, sashes and
 * backpacks — literally reading as wooden planks stuck onto the doll.
 * These surfaces are now tapered curved garments with a contiguous neckline,
 * waist, draped fronts and softly rounded carried bundles.
 *
 * Compatible with existing AnimationClip/Mixer named torso and knee pivots.
 */
const Y=.78;
const fabrics=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:string)=>{
 let m=fabrics.get(color);
 if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.96,metalness:0,side:THREE.DoubleSide});fabrics.set(color,m);}
 return m;
};
const SHARED={
 linen:mat('#d8cdb8'),cream:mat('#e7d7bd'),
 brown:mat('#816b58'),dark:mat('#5d5148'),
 red:mat('#a36a5a'),moss:mat('#799076'),
 indigo:mat('#617989'),straw:mat('#c9b58d'),paper:mat('#e7d7af'),
 skin:mat('#e2b59b'),wood:mat('#937557')
};
const ellipsoid=new THREE.SphereGeometry(1,10,8);
const littleTorus=new THREE.TorusGeometry(1,.12,5,14);
const cone=new THREE.ConeGeometry(1,1,12);
const cylinder=new THREE.CylinderGeometry(1,1,1,10);
export interface CharacterCostume{
 hems:THREE.Group[];cape:THREE.Group|null;hat:THREE.Group|null;
 workStrap:THREE.Group|null;
}
function rounded(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){
 const a=new THREE.Mesh(ellipsoid,m);a.position.set(x,y-Y,z);a.scale.set(w,h,d);a.castShadow=true;parent.add(a);return a;
}
function softRing(parent:THREE.Object3D,x:number,y:number,z:number,r:number,material:THREE.Material,
 thickness=.08){
 const a=new THREE.Mesh(littleTorus,material);a.position.set(x,y-Y,z);
 a.scale.set(r,r,Math.max(.25,thickness/.10));
 a.rotation.x=Math.PI/2;a.castShadow=false;parent.add(a);return a;
}
function hatPart(parent:THREE.Object3D,y:number,r:number,h:number,material:THREE.Material,pointy=false){
 const g=new THREE.Mesh(pointy?cone:cylinder,material);
 g.scale.set(r,h,r);g.position.y=y;g.castShadow=true;parent.add(g);return g;
}
function clothMesh(parent:THREE.Object3D,rows:number,cols:number,create:(u:number,v:number)=>[number,number,number],
 material:THREE.Material){
 const positions:number[]=[],indices:number[]=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  positions.push(...create(i/cols,j/rows));
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
  const a=j*(cols+1)+i,b=a+cols+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setIndex(indices);g.computeVertexNormals();
 const cloth=new THREE.Mesh(g,material);
 cloth.castShadow=true;cloth.receiveShadow=true;parent.add(cloth);
 return cloth;
}
/** Curved, tapered front cloth: no opaque rectangular chest attachment. */
function frontDrape(parent:THREE.Object3D,cx:number,topY:number,topZ:number,
 width:number,length:number,material:THREE.Material,fold=0){
 const g=new THREE.Group();g.position.set(cx,topY-Y,topZ);parent.add(g);
 clothMesh(g,8,6,(u,v)=>{
  const across=u*2-1;
  const flare=width*(.50+.32*v);
  const twist=Math.sin(v*Math.PI)*fold*.13;
  const x=across*flare+twist;
  const z=.018+v*.10+.05*Math.sin(u*Math.PI)+.035*Math.sin(v*Math.PI*2+u*3.14);
  return [x,-v*length,z];
 },material);
 return g;
}
/** A back cape is a continuous drape from shoulder to flowing hem. */
function capeDrape(upper:THREE.Group,material:THREE.Material,length:number){
 const g=new THREE.Group();g.position.set(0,1.24-Y,-.16);upper.add(g);
 clothMesh(g,10,9,(u,v)=>{
  const x=(u*2-1)*(.24+.22*v);
  const y=-v*length+.025*Math.sin(u*Math.PI*2);
  const z=-.015-.15*v-.070*Math.sin(u*Math.PI);
  return [x,y,z];
 },material);
 return g;
}
function wovenBundle(parent:THREE.Object3D,w:number,h:number,cloth:THREE.Material){
 rounded(parent,0,1.02,-.32,w,h,.28,cloth);
 const strap=SHARED.straw;
 for(const s of [-1,1]){
  // Curved shoulder cords follow the rounded bundle instead of vertical boxes.
  const path=new THREE.CatmullRomCurve3([
   new THREE.Vector3(s*.15,1.37-Y,.10),
   new THREE.Vector3(s*.23,1.12-Y,-.20),
   new THREE.Vector3(s*.22,.79-Y,-.34)]);
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,10,.022,5,false),strap);
  parent.add(mesh);
 }
}
function garmentCollar(parent:THREE.Object3D,material:THREE.Material){
 // Diagonal overlapping fabric lapel wraps the cylindrical chest.
 clothMesh(parent,5,4,(u,v)=>{
  const x=-.15+u*.31 +v*.085;
  const y=1.28-Y-v*.42;
  const z=.175+.075*Math.sin(u*Math.PI)+.038*v;
  return [x,y,z];
 },material);
}
function scarf(parent:THREE.Object3D,color:THREE.Material){
 rounded(parent,0,1.17,.09,.28,.115,.27,color);
 frontDrape(parent,.16,1.17,.27,.19,.45,color,.13);
}
function loinWrap(upper:THREE.Group,main:THREE.Material,accent:THREE.Material){
 const hems=[
  frontDrape(upper,-.17,.82,.11,.25,.52,main,-1),
  frontDrape(upper,.16,.83,.12,.26,.56,main,1)
 ];
 // Soft annular sash rather than a rigid belt plank.
 const belt=new THREE.Mesh(new THREE.TorusGeometry(.32,.075,5,13),accent);
 belt.rotation.x=Math.PI/2;belt.scale.y=.78;
 belt.position.set(0,.80-Y,0);upper.add(belt);
 return hems;
}
function identityHeadwear(upper:THREE.Group,style:'wide'|'herbal'|'work'){
 const g=new THREE.Group();g.name='profession-headwear';
 // Upper pivot sits at world height .78. Model head roughly 1.38–1.75.
 g.position.y=1.78-Y;upper.add(g);
 if(style==='wide'){
  hatPart(g,.05,.53,.07,SHARED.straw);
  hatPart(g,.20,.30,.37,SHARED.straw,true);
 }else if(style==='herbal'){
  hatPart(g,.01,.40,.055,SHARED.straw);
  hatPart(g,.14,.25,.24,SHARED.moss,true);
 }else{
  hatPart(g,.00,.35,.07,SHARED.straw);
  hatPart(g,.16,.22,.25,SHARED.dark,true);
 }
 return g;
}
export function dressCharacter(upper:THREE.Group,v:Villager):CharacterCostume{
 const base=mat(v.color),secondary=mat(new THREE.Color(v.color).multiplyScalar(.79).getStyle());
 const accent=v.id===8||v.id===9?SHARED.red:SHARED.straw;
 const hems=loinWrap(upper,secondary,accent);
 garmentCollar(upper,v.id===6?SHARED.cream:SHARED.linen);
 // Tapered, volumetric fabric shoulder shaping is shared across occupations.
 rounded(upper,0,1.12,0,.33,.28,.245,base);
 for(const sx of [-1,1])
  rounded(upper,sx*.235,1.1,0,.14,.19,.17,base);
 const capeIds=[1,7,8,9,10];
 const cape=capeIds.includes(v.id)?capeDrape(upper,secondary,v.id===9?.84:.61):null;
 let hat:THREE.Group|null=null,workStrap:THREE.Group|null=null;
 switch(v.id){
  case 1: // Woodcutter, short shoulder mantle and compact rolled tool bundle.
   wovenBundle(upper,.29,.28,SHARED.brown);
   scarf(upper,SHARED.brown);
   break;
  case 2: // Tavern keeper: soft gathered apron, not a rigid chest board.
   frontDrape(upper,0,1.03,.255,.36,.76,SHARED.linen,.05);
   garmentCollar(upper,SHARED.cream);
   rounded(upper,0,1.76,-.10,.16,.12,.15,SHARED.dark);
   break;
  case 3: // Tea farmer's broad straw hat and green woven basket.
   hat=identityHeadwear(upper,'wide');
   wovenBundle(upper,.34,.31,SHARED.straw);
   break;
  case 4: // Herbalist: simple shawl and one hip satchel.
   scarf(upper,SHARED.moss);
   rounded(upper,.32,.78,.13,.16,.23,.19,SHARED.straw);
   hat=identityHeadwear(upper,'herbal');
   break;
  case 5: // Merchant with a rounded shoulder-wrapped travelling load.
   wovenBundle(upper,.40,.35,SHARED.brown);
   frontDrape(upper,.22,1.14,.21,.16,.41,SHARED.red,.10);
   break;
  case 6: // Weaver: wider sleeves implied by upper soft geometry, tied hair.
   for(const sx of [-1,1])
    rounded(upper,sx*.30,1.00,.09,.14,.23,.16,SHARED.linen);
   rounded(upper,0,1.76,-.09,.18,.13,.12,SHARED.dark);
   break;
  case 7: // Fisherman's broad sunlight brim and small net bag.
   hat=identityHeadwear(upper,'wide');
   wovenBundle(upper,.27,.26,SHARED.moss);
   workStrap=new THREE.Group();workStrap.position.set(-.36,.99-Y,-.28);upper.add(workStrap);
   const loop=new THREE.Mesh(new THREE.TorusGeometry(.21,.024,5,12),SHARED.straw);
   loop.rotation.y=.3;workStrap.add(loop);
   break;
  case 8: // A-Qing: short training robe with asymmetric loose cloth lapel.
   frontDrape(upper,-.07,1.18,.27,.32,.49,secondary,.19);
   scarf(upper,SHARED.red);
   // The sword is rigged on the wrist in people.ts. Do not attach a fake
   // rectangular sword scabbard onto this robe.
   break;
  case 9: // Veteran swordsman: longer cape with fewer narrow hard elements.
   scarf(upper,SHARED.linen);
   frontDrape(upper,.16,.89,.15,.22,.52,SHARED.indigo,-.08);
   break;
  case 10: // Travelling trader: large cloth bundle, not an angular block.
   wovenBundle(upper,.43,.42,SHARED.straw);
   scarf(upper,SHARED.brown);
   break;
  default: // Youth: clear single-layer robe.
   frontDrape(upper,0,1.02,.25,.28,.53,SHARED.moss,0);
 }
 return {hems,cape,hat,workStrap};
}
