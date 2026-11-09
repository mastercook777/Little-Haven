import * as THREE from 'three';
import type {Season} from '../simulation/calendar.ts';
import {creekPointAt,creekTangentAt,distanceToCreekSpline,
 CREEK_WATER_HALF_WIDTH,CREEK_BANK_HALF_WIDTH} from '../simulation/creekCorridor.ts';
export {VALLEY_RIVER as RIVER_WAYPOINTS} from '../simulation/valleyGeography.ts';

/**
 * A physical, contiguous micro-diorama creek. The previous nearly-invisible
 * center stripe was transparent, narrow and placed almost at road level.
 * This waterway has an opaque color field, authored banks, shore stones and
 * traveling highlights. All cross-sections use one and the same center spline.
 */
export interface RiverArt {
 root:THREE.Group;surface:THREE.Mesh;waterMeshCount:number;
 setSeason(season:Season):void;animate(time:number):void;
 pointAt(u:number):THREE.Vector3;getSurfaceHeight():number;
}
export const CREEK_WATER_Y=.105;
const CENTER_Y=CREEK_WATER_Y;
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
// Water, terrain and settlement planting now consume the same numerical spline.
const curve={
 getPoint(u:number){const [x,z]=creekPointAt(u);return new THREE.Vector3(x,0,z);},
 getTangent(u:number){const [x,z]=creekTangentAt(u);return new THREE.Vector3(x,0,z);}
};
const rand=(n:number)=>{let k=(n+17)>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);k=Math.imul(k^(k>>>13),0xc2b2ae35);return ((k^(k>>>16))>>>0)/4294967296;};
const safeU=(u:number)=>Math.max(0,Math.min(1,u));
/** The terrain channel and water geometry share exactly this spline. */
export const creekDistance=distanceToCreekSpline;
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
 const bed=strip(-2.38,2.38,.045,.045,bedMat);bed.name='river-bed';parent.add(bed);
 const banks=[
  strip(-CREEK_BANK_HALF_WIDTH,-1.56,.169,.078,bankMat),
  strip(1.56,CREEK_BANK_HALF_WIDTH,.078,.169,bankMat),
  strip(-1.72,-1.48,.083,.10,edgeMat),
  strip(1.48,1.72,.10,.083,edgeMat),
  strip(-1.48,-1.30,.102,.108,shallowMat),
  strip(1.30,1.48,.108,.102,shallowMat)
 ];
 for(const b of banks){b.name='river-shore';parent.add(b);}
 const surface=strip(-CREEK_WATER_HALF_WIDTH,CREEK_WATER_HALF_WIDTH,CENTER_Y,CENTER_Y,waterMat);
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
   const p=riverSample(u,offset,.158);
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
  dummy.position.set(p.x,.39,p.z);dummy.rotation.set(0,rand(i+8)*6.28,side*.15);
  dummy.scale.set(.7+rand(i*9)*.75,.75+rand(i*7)*.8,.70);
  dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
 }
 reeds.instanceMatrix.needsUpdate=true;parent.add(reeds);
}

/** A visible exit from the raised island: falling water replaces the former
 * abrupt turquoise rectangle over the edge. Its crest shares the creek spline.
 */
function waterfall(parent:THREE.Group){
 const u=.987,half=1.35,cols=12,rows=7;
 const t=curve.getTangent(u).normalize(),positions:number[]=[],indices:number[]=[];
 for(let j=0;j<=rows;j++){
  const v=j/rows,y=CENTER_Y-(v*1.74),outward=v*.26;
  for(let i=0;i<=cols;i++){
   const off=-half+(2*half*i/cols),base=riverSample(u,off,y);
   const ripple=Math.sin(i*1.71+j*.8)*.045*v;
   positions.push(base.x+t.x*outward+ripple,base.y,base.z+t.z*outward+ripple);
   if(i<cols&&j<rows){
    const a=j*(cols+1)+i,b=a+(cols+1);
    indices.push(a,a+1,b,b,a+1,b+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 const fallsMat=new THREE.MeshStandardMaterial({
  color:'#7ebcc1',roughness:.43,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide
 });
 const falls=new THREE.Mesh(geo,fallsMat);falls.name='cliff-waterfall';
 falls.castShadow=false;falls.receiveShadow=false;falls.frustumCulled=false;parent.add(falls);
 const foam=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
  new THREE.MeshBasicMaterial({color:'#e3f1e8',transparent:true,opacity:.74,depthWrite:false}),16);
 const dummy=new THREE.Object3D();
 for(let i=0;i<16;i++){
  const o=-half+i/15*half*2,p=riverSample(u,o,CENTER_Y+.02);
  dummy.position.copy(p);dummy.position.add(new THREE.Vector3(t.x*.15,0,t.z*.15));
  dummy.scale.set(.06+rand(i*13)*.12,.028+rand(i*7)*.028,.09+rand(i*9)*.09);
  dummy.rotation.y=rand(i)*Math.PI;dummy.updateMatrix();foam.setMatrixAt(i,dummy.matrix);
 }
 foam.instanceMatrix.needsUpdate=true;foam.name='river-cliff-foam';parent.add(foam);
 return fallsMat;
}

export function buildRiverArt(parent:THREE.Object3D):RiverArt{
 const root=new THREE.Group();root.name='living-creek';parent.add(root);
 const surface=addWater(root);
 stones(root);
 const waterfallMat=waterfall(root);
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
 return {root,surface,waterMeshCount:9,setSeason:(s)=>{
  waterMat.color.set(palette[s]);
  waterfallMat.color.copy(waterMat.color).lerp(new THREE.Color('#d2e9db'),.24);
  flowMat.opacity=s==='winter'?.24:s==='summer'?.40:.31;
 },animate,pointAt:(u)=>curve.getPoint(safeU(u)),getSurfaceHeight:()=>CENTER_Y};
}
