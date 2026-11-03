import * as THREE from 'three';
import type {Season} from '../simulation/calendar.ts';

/**
 * A physical, contiguous micro-diorama creek. The previous nearly-invisible
 * center stripe was transparent, narrow and placed almost at road level.
 * This waterway has an opaque color field, authored banks, shore stones and
 * traveling highlights. All cross-sections use one and the same center spline.
 */
export const RIVER_WAYPOINTS:readonly (readonly [number,number])[]=[
 [3.8,-12.2],[4.8,-10.5],[6.85,-6.1],[7.5,-2.2],
 [8.35,2.2],[8.72,7.2],[8.05,9.2],[4.35,12.1]
];
export interface RiverArt {
 root:THREE.Group;surface:THREE.Mesh;waterMeshCount:number;
 setSeason(season:Season):void;animate(time:number):void;
 pointAt(u:number):THREE.Vector3;getSurfaceHeight():number;
}
const CENTER_Y=.337;
const waterMat=new THREE.MeshStandardMaterial({
 color:'#5f9eac',roughness:.28,metalness:.04,transparent:false,side:THREE.DoubleSide,
 emissive:'#163b43',emissiveIntensity:.12
});
const bedMat=new THREE.MeshStandardMaterial({color:'#536d67',roughness:.96,side:THREE.DoubleSide});
const bankMat=new THREE.MeshStandardMaterial({color:'#a79a7e',roughness:1,side:THREE.DoubleSide});
const edgeMat=new THREE.MeshStandardMaterial({color:'#d2c8a6',roughness:1,side:THREE.DoubleSide});
const shallowMat=new THREE.MeshStandardMaterial({color:'#81b4b5',roughness:.6,side:THREE.DoubleSide});
const flowMat=new THREE.MeshBasicMaterial({color:'#d0e9dc',transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});
const stoneMat=new THREE.MeshStandardMaterial({color:'#a1aa9e',roughness:1});
const stoneDarkMat=new THREE.MeshStandardMaterial({color:'#747d73',roughness:1});
const stemMat=new THREE.MeshStandardMaterial({color:'#5b8070',roughness:1});
const curve=new THREE.CatmullRomCurve3(RIVER_WAYPOINTS.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal',.45);
const rand=(n:number)=>{let k=(n+17)>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);k=Math.imul(k^(k>>>13),0xc2b2ae35);return ((k^(k>>>16))>>>0)/4294967296;};
const safeU=(u:number)=>Math.max(0,Math.min(1,u));
function riverSample(u:number,offset:number,y:number){
 const p=curve.getPoint(safeU(u)),t=curve.getTangent(safeU(u)).normalize();
 // normal lies perpendicular to the bank-to-bank section in XZ.
 const nx=-t.z,nz=t.x;
 return new THREE.Vector3(p.x+nx*offset,y,p.z+nz*offset);
}
function strip(left:number,right:number,leftY:number,rightY:number,material:THREE.Material,steps=92){
 const positions:number[]=[],indices:number[]=[];
 for(let i=0;i<=steps;i++){
  const u=i/steps,a=riverSample(u,left,leftY),b=riverSample(u,right,rightY);
  positions.push(a.x,a.y,a.z,b.x,b.y,b.z);
  if(i<steps){const j=2*i;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const m=new THREE.Mesh(geometry,material);
 m.receiveShadow=true;m.castShadow=false;m.frustumCulled=false;
 return m;
}
function addWater(parent:THREE.Group){
 // Dark stony stream-bed is wide enough that the creek looks *cut into* grass.
 const bed=strip(-2.38,2.38,.255,.255,bedMat);bed.name='river-bed';parent.add(bed);
 const banks=[
  strip(-2.42,-1.56,.388,.293,bankMat),
  strip(1.56,2.42,.293,.388,bankMat),
  strip(-1.72,-1.48,.325,.34,edgeMat),
  strip(1.48,1.72,.34,.325,edgeMat),
  strip(-1.48,-1.30,.337,.34,shallowMat),
  strip(1.30,1.48,.34,.337,shallowMat)
 ];
 for(const b of banks){b.name='river-shore';parent.add(b);}
 const surface=strip(-1.38,1.38,CENTER_Y,CENTER_Y,waterMat);
 surface.name='river-water';surface.userData.waterway='creek';
 parent.add(surface);
 return surface;
}
function stones(parent:THREE.Group){
 const geo=new THREE.DodecahedronGeometry(1,0);
 const dummy=new THREE.Object3D(),count=68;
 for(const [j,mat] of [[0,stoneMat],[1,stoneDarkMat]] as const){
  const instance=new THREE.InstancedMesh(geo,mat,count/2);
  instance.name='river-bank-stones';
  instance.castShadow=true;instance.receiveShadow=true;
  for(let i=0;i<count/2;i++){
   const n=i*2+j,u=.035+rand(n*43+1)*.93;
   const side=n%4<2?-1:1,offset=side*(1.83+rand(n*41+8)*.42);
   const p=riverSample(u,offset,.355);
   dummy.position.copy(p);dummy.rotation.set(rand(n+11)*.22,rand(n*3+17)*Math.PI,rand(n+7)*.18);
   const size=.17+rand(n*31+17)*.24;dummy.scale.set(size, size*.48, size*.81);
   dummy.updateMatrix();instance.setMatrixAt(i,dummy.matrix);
  }
  instance.instanceMatrix.needsUpdate=true;parent.add(instance);
 }
 // Sparse reeds follow bank, not random spots across the village.
 const reedGeo=new THREE.ConeGeometry(.08,.72,5),reedCount=24;
 const reeds=new THREE.InstancedMesh(reedGeo,stemMat,reedCount);
 for(let i=0;i<reedCount;i++){
  const u=.06+rand(i*13+2)*.88,side=i%2?-1:1;
  const p=riverSample(u,side*(1.77+rand(i*17+4)*.20),.39);
  dummy.position.set(p.x,.64,p.z);dummy.rotation.set(0,rand(i+8)*6.28,side*.15);
  dummy.scale.set(.7+rand(i*9)*.75,.75+rand(i*7)*.8,.70);
  dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
 }
 reeds.instanceMatrix.needsUpdate=true;parent.add(reeds);
}
export function buildRiverArt(parent:THREE.Object3D):RiverArt{
 const root=new THREE.Group();root.name='living-creek';parent.add(root);
 const surface=addWater(root);
 stones(root);
 // Thin mobile-friendly sunlight ripples moving along the actual current.
 const flowGeo=new THREE.PlaneGeometry(1,1),count=40;
 const flow=new THREE.InstancedMesh(flowGeo,flowMat,count);flow.name='creek-flow-highlights';
 const baseRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
 const headingRotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D();
 flow.frustumCulled=false;root.add(flow);
 const palette:Record<Season,string>={spring:'#6aa9a8',summer:'#548f9b',autumn:'#739d9c',winter:'#83aeb5'};
 const animate=(time:number)=>{
  for(let i=0;i<count;i++){
   const u=(i/count+time*.009+rand(i*17)*.11)%1;
   const p=curve.getPoint(u),t=curve.getTangent(u).normalize();
   const offset=-1.02+rand(i*39)*2.04,normalX=-t.z,normalZ=t.x;
   dummy.position.set(p.x+offset*normalX,CENTER_Y+.018,p.z+offset*normalZ);
   headingRotation.setFromAxisAngle(axis,Math.atan2(-t.z,t.x));
   dummy.quaternion.copy(headingRotation).multiply(baseRotation);
   dummy.scale.set(.28+rand(i+3)*.60,.033+rand(i+6)*.05,1);dummy.updateMatrix();
   flow.setMatrixAt(i,dummy.matrix);
  }
  flow.instanceMatrix.needsUpdate=true;
 };
 animate(0);
 return {root,surface,waterMeshCount:8,setSeason:(s)=>{
  waterMat.color.set(palette[s]);
  flowMat.opacity=s==='winter'?.24:s==='summer'?.40:.31;
 },animate,pointAt:(u)=>curve.getPoint(safeU(u)),getSurfaceHeight:()=>CENTER_Y};
}
