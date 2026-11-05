import * as THREE from 'three';
import type {Season} from '../simulation/calendar.ts';

/** Classic seasonArt.ts's instanced petal/leaf visual language, placed only
 * beneath the two surviving protected broadleaf parcels in pioneer mode.
 * No additional trees, map obstacles, random village records or save keys. */
export interface PioneerSeasonalVfx {
 root:THREE.Group;setSeason(season:Season):void;animate(seconds:number):void;
 signatures():{season:Season;fallingLeaves:number;fallenLeaves:number;
  springPetals:number;winterSnowPatches:number};
}
const rnd=(n:number)=>{
 let x=(n+17)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);
 x=Math.imul(x^(x>>>13),0xc2b2ae35);return ((x^(x>>>16))>>>0)/4294967296;
};
type Grove=readonly [number,number,number];
const leafShape=new THREE.PlaneGeometry(.32,.27);
const snowShape=new THREE.IcosahedronGeometry(1,1);
const gold=new THREE.MeshStandardMaterial({color:'#d9a352',roughness:1,side:THREE.DoubleSide});
const copper=new THREE.MeshStandardMaterial({color:'#ae7043',roughness:1,side:THREE.DoubleSide});
const pink=new THREE.MeshStandardMaterial({color:'#eaa9b3',roughness:1,side:THREE.DoubleSide});
const pale=new THREE.MeshStandardMaterial({color:'#f5ced1',roughness:1,side:THREE.DoubleSide});
const snow=new THREE.MeshStandardMaterial({color:'#e8f1e9',roughness:1});
function newBatch(parent:THREE.Group,name:string,count:number,
 geometry:THREE.BufferGeometry,material:THREE.Material){
 const mesh=new THREE.InstancedMesh(geometry,material,count);
 mesh.name=name;mesh.frustumCulled=false;mesh.castShadow=false;
 mesh.receiveShadow=false;mesh.raycast=()=>{};parent.add(mesh);
 return mesh;
}
export function createPioneerSeasonalVfx(parent:THREE.Object3D,
 grovePositions:readonly Grove[],mobile=false,reducedMotion=false):PioneerSeasonalVfx {
 const root=new THREE.Group();root.name='classic-inspired-pioneer-seasonal-particles';
 parent.add(root);
 const spring=new THREE.Group(),autumn=new THREE.Group(),winter=new THREE.Group();
 spring.name='spring-blossom-petals';autumn.name='autumn-falling-and-settled-leaves';
 winter.name='winter-under-tree-snow';
 root.add(spring,autumn,winter);
 // Seasonal material is reusable, but positions come only from actual
 // non-buildable tree positions; not a duplicate painted classic garden.
 const groves=grovePositions.length?grovePositions:[[0,0,1] as const];
 const dummy=new THREE.Object3D();
 function scatter(parentGroup:THREE.Group,name:string,count:number,mat:THREE.Material,
  kind:'leaf'|'petal'|'snow'){
  const mesh=newBatch(parentGroup,name,count,
   kind==='snow'?snowShape:leafShape,mat);
  for(let i=0;i<count;i++){
   const [gx,gz,size]=groves[i%groves.length];
   const theta=rnd(i*37+15)*Math.PI*2;
   const distance=Math.sqrt(rnd(i*73+21))*(kind==='snow'?1.38:1.62)*size;
   dummy.position.set(gx+Math.cos(theta)*distance,
    kind==='snow'?.30:.315+(i%3)*.003,gz+Math.sin(theta)*distance);
   if(kind==='snow'){
    dummy.rotation.set(0,rnd(i*3)*6.28,0);
    const radius=.22+rnd(i*11)*.30;
    dummy.scale.set(radius,.045+radius*.10,radius*.75);
   }else{
    dummy.rotation.set(-Math.PI/2,rnd(i*13)*6.28,0);
    dummy.scale.setScalar(.58+rnd(i*17)*.57);
   }
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;return mesh;
 }
 const groundLeaves=mobile?46:110,groundPetals=mobile?36:76,snowPatches=mobile?12:24;
 scatter(autumn,'settled-real-grove-leaves-gold',Math.ceil(groundLeaves*.58),gold,'leaf');
 scatter(autumn,'settled-real-grove-leaves-copper',Math.floor(groundLeaves*.42),copper,'leaf');
 scatter(spring,'spring-blossoms-beneath-real-grove',Math.ceil(groundPetals*.58),pink,'petal');
 scatter(spring,'spring-petals-beneath-real-grove',Math.floor(groundPetals*.42),pale,'petal');
 scatter(winter,'winter-snow-at-existing-tree-roots',snowPatches,snow,'snow');
 const autumnFallCount=reducedMotion?0:mobile?10:20;
 const springFallCount=reducedMotion?0:mobile?8:16;
 const fallingLeaves=newBatch(autumn,'animated-falling-autumn-leaves',
  autumnFallCount,leafShape,copper);
 const fallingPetals=newBatch(spring,'animated-spring-blossom-fall',
  springFallCount,leafShape,pink);
 function moveFall(mesh:THREE.InstancedMesh,count:number,t:number,blossoms:boolean){
  for(let i=0;i<count;i++){
   const [gx,gz,size]=groves[i%groves.length];
   const period=3.7+rnd(i*43+4)*1.7;
   const elapsed=(t*(blossoms?.37:.53)+rnd(i*7+23)*period)%period;
   const height=2.5*size+rnd(i*13+2)*.8;
   const fraction=elapsed/period;
   const x=gx+(rnd(i*9+11)-.5)*2.20*size+
    Math.sin(t*.33+i*2.1)*(.19+.12*fraction);
   const z=gz+(rnd(i*19+13)-.5)*1.80*size+
    Math.cos(t*.27+i*2.4)*(.16+.11*fraction);
   dummy.position.set(x,.325+(1-fraction)*height,z);
   dummy.rotation.set(-.55+Math.sin(t+i)*.16,0,t*(blossoms?.26:.38)+i);
   dummy.scale.setScalar((blossoms?.47:.58)+rnd(i*7)*.30);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
 }
 let current:Season='spring',lastTick=-1;
 function setSeason(season:Season){
  current=season;spring.visible=season==='spring';
  autumn.visible=season==='autumn';winter.visible=season==='winter';
 }
 function animate(seconds:number){
  if(reducedMotion||!Number.isFinite(seconds))return;
  const tick=Math.floor(seconds*30);if(tick===lastTick)return;lastTick=tick;
  if(current==='autumn')moveFall(fallingLeaves,autumnFallCount,seconds,false);
  if(current==='spring')moveFall(fallingPetals,springFallCount,seconds,true);
 }
 setSeason('spring');animate(0);
 return {root,setSeason,animate,signatures:()=>({
  season:current,fallingLeaves:current==='autumn'?autumnFallCount:0,
  fallenLeaves:current==='autumn'?groundLeaves:0,
  springPetals:current==='spring'?groundPetals+springFallCount:0,
  winterSnowPatches:current==='winter'?snowPatches:0
 })};
}
