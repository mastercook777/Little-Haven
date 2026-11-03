import * as THREE from 'three';
import type {Season} from '../simulation/calendar.ts';

/**
 * The four seasons are authored silhouettes, not merely turf recoloring:
 * spring blossom branches, summer shade + exuberant beds, autumn gold canopies
 * + gathered harvest, winter snow loads + bare trees and smoke.
 * Repeated leaves, blooms, reeds and petals use InstancedMesh rather than meshes.
 */
const material=(hex:string,roughness=1)=>new THREE.MeshStandardMaterial({color:hex,roughness,side:THREE.DoubleSide});
const bark=material('#705849'),pink=material('#eaa9b3'),petal=material('#f5ced1'),
 gold=material('#d9a352'),copper=material('#ae7043'),jade=material('#426f47'),
 vivid=material('#649855'),summerLight=material('#9bb75b'),straw=material('#ceb076'),
 snow=material('#e8f1e9'),snowBlue=material('#cfdfdf'),terracotta=material('#9c6548'),
 roofRed=material('#ac6e55'),warm=material('#ecd5a7');
const boxGeo=new THREE.BoxGeometry(1,1,1);
const canopyGeo=new THREE.IcosahedronGeometry(1,1);
const stemGeo=new THREE.CylinderGeometry(.65,1,1,6);
const barrelGeo=new THREE.CylinderGeometry(.33,.30,.60,10);
const awningGeo=new THREE.ConeGeometry(1,1,8);
function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){
 const mesh=new THREE.Mesh(boxGeo,m);
 mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(parent:THREE.Object3D,r:number,x:number,y:number,z:number,m:THREE.Material,sx=1,sy=1,sz=1){
 const mesh=new THREE.Mesh(canopyGeo,m);
 mesh.position.set(x,y,z);mesh.scale.set(r*sx,r*sy,r*sz);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function stem(parent:THREE.Object3D,x:number,z:number,height:number,width:number,m=bark){
 const mesh=new THREE.Mesh(stemGeo,m);
 mesh.scale.set(width,height,width);mesh.position.set(x,.20+height/2,z);mesh.castShadow=true;parent.add(mesh);
 return mesh;
}
function group(parent:THREE.Object3D){const g=new THREE.Group();parent.add(g);return g;}
const rnd=(seed:number)=>{let x=(seed+17)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return ((x^(x>>>16))>>>0)/4294967296;};
function petals(parent:THREE.Object3D,count:number,geometry:THREE.BufferGeometry,m:THREE.Material,
 select:(i:number)=>{x:number;y:number;z:number;scale:number;rotation:number},upright=false){
 const inst=new THREE.InstancedMesh(geometry,m,count),dummy=new THREE.Object3D();
 inst.castShadow=false;inst.receiveShadow=false;inst.frustumCulled=false;
 for(let i=0;i<count;i++){
  const p=select(i);dummy.position.set(p.x,p.y,p.z);
  dummy.rotation.set(upright?0:-Math.PI/2,p.rotation*.32,upright?p.rotation:0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();
  inst.setMatrixAt(i,dummy.matrix);
 }
 inst.instanceMatrix.needsUpdate=true;parent.add(inst);return inst;
}
const onGround=(i:number,spreadX:number,spreadZ:number,y=.31)=>{
 const x=(rnd(i*17)-.5)*spreadX,z=(rnd(i*19+3)-.5)*spreadZ;
 return {x,y,z,scale:.5+rnd(i*23+2)*.85,rotation:rnd(i*13)*Math.PI*2};
};
function blossomTree(parent:THREE.Object3D,x:number,z:number,season:'spring'|'autumn',size=1){
 const g=new THREE.Group();g.position.set(x,.19,z);g.scale.setScalar(size);parent.add(g);
 stem(g,0,0,2.25,.16,season==='spring'?bark:terracotta);
 for(let i=0;i<5;i++){
  const a=(i*2.4)+.35,sx=Math.cos(a)*.72,sz=Math.sin(a)*.58;
  const b=box(g,.105,.95,.105,sx*.45,2.13,sz*.45,bark);b.rotation.z=-sx*.55;
  sphere(g,.68,sx,2.55+(i%2)*.3,sz,season==='spring'?(i%3?pink:petal):(i%2?gold:copper),1.05,.65,.85);
 }
 sphere(g,.66,0,3.15,0,season==='spring'?pink:gold,1.0,.75,.95);
}
function barrel(parent:THREE.Object3D,x:number,y:number,z:number,s=1){
 const c=new THREE.Mesh(barrelGeo,straw);
 c.position.set(x,y+.3*s,z);c.scale.setScalar(s);parent.add(c);
 box(parent,.75*s,.09*s,.75*s,x,y+.63*s,z,bark);
}
function layHarvest(parent:THREE.Object3D){
 // Clearly readable "the harvest is in": stalk piles, baskets, drying frames.
 for(const [x,z] of [[-8.0,5.6],[-6.5,6.8],[2.4,-7.4],[3.9,-7.2]]){
  for(let i=0;i<4;i++){
   const g=sphere(parent,.42,x+(i%2)*.47,.42+(i>>1)*.28,z+(i>>1)*.19,straw,1.22,.62,.72);
   g.rotation.y=i*.42;
  }
  barrel(parent,x+1.05,.22,z-.25,.82);
 }
 for(let row=0;row<4;row++){
  box(parent,3.0,.10,.45,-10.75,.36+row*.13,7.0+row*.52,straw);
  for(let j=0;j<6;j++)sphere(parent,.12,-11.8+j*.39,.52+row*.13,7.0+row*.52,gold,1,.32,.8);
 }
}
function summerShade(parent:THREE.Object3D,x:number,z:number){
 const g=new THREE.Group();g.position.set(x,.25,z);parent.add(g);
 stem(g,0,0,2.1,.09,bark);
 const awning=new THREE.Mesh(awningGeo,roofRed);
 awning.scale.set(1.72,.45,1.72);awning.position.y=2.34;awning.rotation.y=Math.PI/8;g.add(awning);
 box(g,2.7,.12,.75,0,.49,0,bark);
 for(const dx of [-.93,.93])box(g,.10,.59,.10,dx,.28,0,bark);
 barrel(g,-1.0,.21,1.08,.77);
}
function newSnow(parent:THREE.Object3D,x:number,y:number,z:number,w:number,d:number){
 sphere(parent,.58,x,y,z,snow,w/.58,.09,d/.58);
}
export interface SeasonalArt {
 root:THREE.Group;setSeason(season:Season):void;
 animate(t:number):void;activeSeason():Season;
}
export function createSeasonalArt(parent:THREE.Object3D):SeasonalArt{
 const root=group(parent);
 const spring=group(root),summer=group(root),autumn=group(root),winter=group(root);
 const layers={spring,summer,autumn,winter};
 // Spring: 4 cherry blossom crowns, lush tender flower clusters at the rim and gardens.
 for(const [x,z,s] of [[-13,-3.0,.90],[-6.8,9.1,.87],[11.6,-6.3,.9],[13.0,6.2,.79]] as const)blossomTree(spring,x,z,'spring',s);
 const flowerGeo=new THREE.PlaneGeometry(.33,.26);
 petals(spring,110,flowerGeo,pink,i=>{
  const p=onGround(i,27,19);return {...p,scale:.65+rnd(i*9)*.45};
 });
 petals(spring,64,flowerGeo,petal,i=>{
  const p=onGround(i+117,27,19);return {...p,scale:.60+rnd(i*14)*.42};
 });
 // Spring branch blossoms near the tea garden remain identifiable even at default zoom.
 for(const [x,z] of [[-12.0,7.2],[-8.0,7.4],[-10.9,2.5]] as const){
  sphere(spring,.52,x,.69,z,pink,1.2,.4,.95);
  sphere(spring,.27,x+.39,.67,z+.14,petal,.9,.45,.9);
 }
 // Summer: deep-green trees and an actual shade canopy, reeds and flowering crop rows.
 for(const [x,z] of [[-13.0,-3],[-6.8,9.1],[11.6,-6.3],[13.0,6.2]] as const){
  stem(summer,x,z,2.30,.18);
  sphere(summer,.94,x,2.74,z,jade,1.35,.92,1.1);
  sphere(summer,.71,x+.60,2.5,z+.1,vivid,1.1,.85,1.0);
  sphere(summer,.67,x-.58,2.9,z-.1,summerLight,1.0,.76,.95);
 }
 summerShade(summer,-5.85,5.0);
 const lushGeo=new THREE.ConeGeometry(.16,.65,5);
 petals(summer,135,lushGeo,vivid,i=>{
  const p=onGround(i+431,30,20,.64);return {...p,scale:.7+rnd(i+71)*.55,rotation:rnd(i+9)*6.28};
 },true);
 for(let i=0;i<4;i++){
  box(summer,2.3,.20,.46,-10.7,.39,7.1+i*.44,jade);
  for(let k=0;k<7;k++)sphere(summer,.17,-11.8+k*.37,.67,7.1+i*.44,summerLight,1,.75,1.3);
 }
 // Summer's waterside reeds are a visibly different spatial silhouette.
 for(let i=0;i<30;i++){
  const x=7.02+(i%2)*.35,z=-7.5+(i/30)*15.0;
  stem(summer,x,z,.75+(i%4)*.19,.046,jade);
 }
 // Autumn: conspicuous orange-gold crowns and mats of fallen leaves and produce.
 for(const [x,z,s] of [[-13,-3,.95],[-6.8,9.1,.95],[11.6,-6.3,.98],[13.0,6.2,.83]] as const)
  blossomTree(autumn,x,z,'autumn',s);
 const leafGeo=new THREE.PlaneGeometry(.39,.31);
 petals(autumn,165,leafGeo,gold,i=>({...onGround(i+902,30,19,.319),scale:.65+rnd(i*17)*.6}));
 petals(autumn,100,leafGeo,copper,i=>({...onGround(i+1102,30,19,.321),scale:.55+rnd(i*23)*.55}));
 layHarvest(autumn);
 // Winter: thick snow carries volume, trees are visibly leafless, lanterns stand out.
 for(const [x,z] of [[-13,-3],[-6.8,9.1],[11.6,-6.3],[13,6.2]] as const){
  stem(winter,x,z,2.2,.14);
  for(let k=0;k<4;k++){
   const a=k*1.57;
   const branch=box(winter,.09,1.6,.09,x+Math.cos(a)*.37,1.97,z+Math.sin(a)*.37,bark);
   branch.rotation.z=Math.cos(a)*.6;branch.rotation.x=Math.sin(a)*.6;
   sphere(winter,.39,x+Math.cos(a)*.78,2.46,z+Math.sin(a)*.78,snow,.84,.32,.87);
  }
 }
 for(const [x,z,w,d] of [[-12,-6.9,2.5,1.3],[-13.5,4.2,1.0,2.9],
  [-5.7,7.1,1.5,1.0],[2.7,-8.2,2,1.0],[5,9.8,3.0,1.2],[12,-5.5,1.2,3.2]] as const)
  newSnow(winter,x,.35,z,w,d);
 for(const [x,y,z,w,d] of [[-3.4,5.77,-.7,2.2,.75],[-9,3.12,-5.5,1.4,.5],
  [-9.8,3.18,3.1,1.5,.52],[3.4,3.41,-5.6,1.5,.56]] as const)
  newSnow(winter,x,y,z,w,d);
 // Warm stove and gently ascending steam anchor winter beside the tavern.
 const steam=group(winter);
 const mist=new THREE.MeshBasicMaterial({color:'#e7dfce',transparent:true,opacity:.44,depthWrite:false});
 for(let i=0;i<5;i++)sphere(steam,.26,-3.0+i*.08,6.3+i*.25,-.7-i*.06,mist,.8,.6,.8);
 box(winter,.52,.26,.52,-3.0,5.69,-.7,terracotta);
 let current:Season='spring';
 const falling=petals(autumn,24,leafGeo,warm,i=>({x:-12+rnd(i*9)*24,y:2.9+rnd(i*17)*2.4,
  z:-8+rnd(i*19)*16,scale:.48+rnd(i*7)*.34,rotation:rnd(i)*6.28}));
 const dummy=new THREE.Object3D();
 return {root,activeSeason:()=>current,setSeason(season){
  current=season;
  for(const key of ['spring','summer','autumn','winter'] as const)layers[key].visible=season===key;
 },animate(t){
  if(current==='winter'){steam.position.y=Math.sin(t*.62)*.10;steam.position.x=Math.sin(t*.19)*.10;}
  if(current==='autumn'){
   for(let i=0;i<24;i++){
    dummy.position.set(-12+rnd(i*9)*24+Math.sin(t*.35+i)*.25,
     .25+((2.7+rnd(i*17)*3.0-t*(.35+rnd(i)*.1))%3+3)%3,
     -8+rnd(i*19)*16);
    dummy.rotation.set(-.55+Math.sin(t+i)*.16,0,t*.38+i);
    dummy.scale.setScalar(.55+rnd(i*7)*.27);dummy.updateMatrix();falling.setMatrixAt(i,dummy.matrix);
   }
   falling.instanceMatrix.needsUpdate=true;
  }
 }};
}
