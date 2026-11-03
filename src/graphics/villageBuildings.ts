import * as THREE from 'three';

/**
 * Art-directable miniature mountain-house forms. Replaces the previous
 * additive architectureKit (old box roof PLUS another decorative roof).
 * Roof, plinth, enclosing walls and post spacing are built as one coherent
 * volume, not as loose blocks mounted to an existing placeholder.
 */
export interface VillageBuildingsContext{
 windows:THREE.MeshStandardMaterial[];
 emissive:THREE.MeshStandardMaterial[];
 swings:THREE.Group[];
 createLantern(parent:THREE.Object3D,x:number,y:number,z:number):THREE.Group;
 createSign(parent:THREE.Object3D,x:number,y:number,z:number,word:string):THREE.Mesh;
}
const STANDARD={
 plaster:new THREE.MeshStandardMaterial({color:'#ded4bd',roughness:.94}),
 cream:new THREE.MeshStandardMaterial({color:'#e6d5b8',roughness:.95}),
 wheat:new THREE.MeshStandardMaterial({color:'#cdb99b',roughness:.97}),
 stone:new THREE.MeshStandardMaterial({color:'#aba995',roughness:1}),
 wood:new THREE.MeshStandardMaterial({color:'#745544',roughness:.91}),
 brightWood:new THREE.MeshStandardMaterial({color:'#a37b5b',roughness:.9}),
 oldWood:new THREE.MeshStandardMaterial({color:'#594b41',roughness:.96}),
 soot:new THREE.MeshStandardMaterial({color:'#47463f',roughness:1}),
 roof:new THREE.MeshStandardMaterial({color:'#485961',roughness:.97,side:THREE.DoubleSide}),
 roofWarm:new THREE.MeshStandardMaterial({color:'#606971',roughness:.98,side:THREE.DoubleSide}),
 roofBlue:new THREE.MeshStandardMaterial({color:'#51646b',roughness:.96,side:THREE.DoubleSide}),
 ridge:new THREE.MeshStandardMaterial({color:'#697578',roughness:1}),
 paper:new THREE.MeshStandardMaterial({color:'#e9cea1',emissive:'#c28a51',emissiveIntensity:.15,roughness:1}),
 redCloth:new THREE.MeshStandardMaterial({color:'#ad6250',roughness:1,side:THREE.DoubleSide}),
 jade:new THREE.MeshStandardMaterial({color:'#738b77',roughness:1,side:THREE.DoubleSide})
};
const boxGeometry=new THREE.BoxGeometry(1,1,1);
const circleGeometry=new THREE.CylinderGeometry(1,1,1,9);
function group(parent:THREE.Object3D,x=0,y=0,z=0){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;
}
function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=STANDARD.wood){
 const mesh=new THREE.Mesh(boxGeometry,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function pole(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,m:THREE.Material=STANDARD.wood){
 const mesh=new THREE.Mesh(circleGeometry,m);mesh.scale.set(r,h,r);mesh.position.set(x,y,z);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
type RoofStyle='tile'|'cottage'|'workshop';
interface RoofInfo{width:number;depth:number;eave:number;rise:number;style:RoofStyle;material:THREE.Material}
/** Unified double-curved ceramic silhouette with visible upturned corners.
 * Reuses the same roof surface calculation for the ridge and all roof edges.
 */
function roofHeight(u:number,v:number,eave:number,rise:number){
 const edgeCurl=.14*Math.pow(u,6)*(1+.32*Math.pow(Math.abs(v),7));
 const endCurl=.105*Math.pow(Math.abs(v),7);
 return eave+rise*Math.pow(1-u,1.15)+edgeCurl+endCurl;
}
export function buildMountainRoof(parent:THREE.Object3D,settings:RoofInfo){
 const {width:w,depth:d,eave,rise,material,style}=settings;
 const W=w*.5+.30,D=d*.5+.32,ix=11,iz=12;
 const vs:number[]=[],ids:number[]=[],uv:number[]=[];
 for(let signIndex=0;signIndex<2;signIndex++){
  const sign=signIndex===0?-1:1;
  const off=vs.length/3;
  for(let j=0;j<=iz;j++){
   const v=-1+2*j/iz,z=v*D;
   for(let i=0;i<=ix;i++){
    const u=i/ix,x=sign*u*W;
    vs.push(x,roofHeight(u,v,eave,rise),z);uv.push(u,j/iz);
   }
  }
  for(let j=0;j<iz;j++)for(let i=0;i<ix;i++){
   const a=off+j*(ix+1)+i,b=a+ix+1;
   ids.push(a,b,a+1,a+1,b,b+1);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(ids);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,material);mesh.name='one-piece-upturned-roof';
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 // The roof apron and curved edges are structural: one thin timber line,
 // not dozens of disconnected additional roof slats.
 const edgePoints=(sx:number)=>{
  const points:THREE.Vector3[]=[];
  for(let j=0;j<=12;j++){
   const v=-1+2*j/12;
   points.push(new THREE.Vector3(sx*W,roofHeight(1,v,eave,rise)-.07,v*D));
  }
  return points;
 };
 for(const sx of [-1,1]){
  const line=new THREE.Mesh(new THREE.TubeGeometry(
   new THREE.CatmullRomCurve3(edgePoints(sx)),12,.060,5,false),STANDARD.oldWood);
  line.name='continuous-eave-fascia';line.castShadow=true;parent.add(line);
 }
 // Continuous ridge silhouette, and actual enclosed, triangular gable ends.
 const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,2*D+.23,10),
  STANDARD.ridge);
 ridge.rotation.x=Math.PI/2;ridge.position.y=eave+rise+.105;
 ridge.name='ceramic-ridge';ridge.castShadow=true;parent.add(ridge);
 for(const z of [-D+.06,D-.06]){
  const gable=new THREE.BufferGeometry();
  gable.setAttribute('position',new THREE.Float32BufferAttribute([
   -W+.18,eave-.015,z, W-.18,eave-.015,z, 0,eave+rise-.065,z
  ],3));
  gable.setIndex([0,1,2]);gable.computeVertexNormals();
  const end=new THREE.Mesh(gable,style==='cottage'?STANDARD.wheat:STANDARD.plaster);
  end.material.side=THREE.DoubleSide;parent.add(end);
 }
 // Subtle tile seams: small repeated ceramic relief, not wooden bars.
 if(style==='tile'||style==='workshop'){
  const segments=style==='tile'?8:6;
  const geo=new THREE.CylinderGeometry(.027,.030,1,6);
  const small=STANDARD.ridge;
  const count=(segments-1)*2;
  const inst=new THREE.InstancedMesh(geo,small,count);
  const dummy=new THREE.Object3D();let n=0;
  for(const side of [-1,1])for(let k=1;k<segments;k++){
   const u=k/segments;
   const x=side*u*W,y=roofHeight(u,0,eave,rise)+.028;
   dummy.position.set(x,y,0);
   dummy.scale.set(.9,2*D-.16,.9);dummy.rotation.set(Math.PI/2,0,0);
   dummy.updateMatrix();inst.setMatrixAt(n++,dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate=true;inst.name='shared-roof-tile-channels';parent.add(inst);
 }
 return mesh;
}
function windowFrame(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,register:THREE.MeshStandardMaterial[]){
 // Frame and lattice are inset in the wall, not another plank on the facade.
 const paper=STANDARD.paper;
 if(!register.includes(paper))register.push(paper);
 box(parent,x,y,z,w+.12,h+.12,.055,STANDARD.oldWood);
 box(parent,x,y,z+.040,w,h,.017,paper);
 for(let i=1;i<3;i++)box(parent,x-w/2+(w*i/3),y,z+.067,.036,h,.037,STANDARD.brightWood);
 box(parent,x,y,z+.074,w,.030,.032,STANDARD.brightWood);
}
function baseHouse(parent:THREE.Object3D,w:number,d:number,h:number,
 roofMat:THREE.Material,wall:THREE.Material,profile:RoofStyle,
 windows:THREE.MeshStandardMaterial[],doorSide=0){
 const g=group(parent);g.name='integrated-house-volume';
 box(g,0,.18,0,w+.36,.27,d+.34,STANDARD.stone);
 box(g,0,.36+h/2,0,w,h,d,wall);
 // Load-bearing corner pillars are within the wall footprint.
 for(const sx of [-1,1])for(const sz of [-1,1])
  box(g,sx*w*.45,h*.51+.35,sz*d*.445,.17,h+.10,.17,STANDARD.wood);
 buildMountainRoof(g,{width:w,depth:d,eave:h+.38,rise:profile==='cottage'?.67:.84,style:profile,material:roofMat});
 const z=d/2+.064;
 const doorX=doorSide*w*.19;
 box(g,doorX,.88,z,.76,1.12,.09,STANDARD.oldWood);
 for(const offset of [-.13,.13])box(g,doorX+offset,.88,z+.045,.037,1.0,.039,STANDARD.brightWood);
 box(g,doorX,1.45,z+.03,.87,.11,.12,STANDARD.brightWood);
 const wx=(doorSide?-.31:.32)*w;
 windowFrame(g,wx,1.32,z,.44,.52,windows);
 box(g,0,.34,z+.28,w*.61,.16,.50,STANDARD.stone);
 return g;
}
function workAwning(parent:THREE.Object3D,w:number,d:number,material:THREE.Material){
 const g=group(parent,0,0,d/2+.49);
 // Functional front canopy lower than the main roof.
 for(const sx of [-1,1])box(g,sx*w*.37,1.01,.47,.11,1.32,.13,STANDARD.wood);
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w*.86,.93),material);
 mesh.rotation.x=-Math.PI/2+.24;mesh.position.set(0,1.73,.12);
 mesh.castShadow=true;g.add(mesh);
 return g;
}
export function createMountainHome(parent:THREE.Object3D,
 x:number,z:number,w:number,d:number,h:number,variant:number,
 windows:THREE.MeshStandardMaterial[],emissive:THREE.MeshStandardMaterial[]):THREE.Group{
 const g=group(parent,x,.16,z);g.name=['woodcutter-home','weaver-workshop','herbal-teahouse','courtyard-cottage'][variant%4];
 const v=variant%4;
 // Shape and proportions vary by household, without adding extra decorative
 // roofs on top of identical cuboids.
 const width=v===1?w*1.10:v===3?w*.86:w,depth=v===2?d*.90:d;
 const height=v===1?h*1.15:v===3?h*.90:h;
 baseHouse(g,width,depth,height,
  v===1?STANDARD.roofBlue:v===2?STANDARD.roofWarm:STANDARD.roof,
  v===3?STANDARD.wheat:v===1?STANDARD.cream:STANDARD.plaster,
  v===3?'cottage':v===1?'workshop':'tile',windows,v===1?-1:0);
 if(v===1){
  // Deep, functional crafts porch creates a different footprint.
  workAwning(g,width,depth,STANDARD.jade);
  box(g,width*.48,.62,depth*.52+.75,.68,.85,.75,STANDARD.brightWood);
 }else if(v===2){
  // Tea/herb drying platform is part of this home, not a pile on its roof.
  box(g,-width*.42,.32,depth*.50+.66,width*.60,.15,1.25,STANDARD.stone);
  for(let i=0;i<3;i++){
   const tray=box(g,-width*.55+i*.42,.66,depth*.50+.72,.34,.08,.50,STANDARD.brightWood);
   tray.rotation.y=.08*(i-1);
  }
 }else if(v===3){
  // Cottage sits slightly away from the street in a small planted yard.
  box(g,width*.57,.18,depth*.45,1.15,.11,1.14,STANDARD.stone);
  const plant=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,1),
   STANDARD.jade);plant.position.set(width*.63,.66,depth*.50);
  plant.scale.set(.8,.65,.90);g.add(plant);
 }else{
  // No duplicate decoration kit: the first household uses a clean stone step.
  box(g,0,.20,depth*.50+.67,1.55,.12,.52,STANDARD.stone);
 }
 return g;
}
export function createMountainTavern(parent:THREE.Object3D,context:VillageBuildingsContext,expanded=false):THREE.Group{
 const g=group(parent,-3.4,.16,-.2);g.name=expanded?'mountain-tavern-renovated':'mountain-tavern-original';
 const windows=context.windows;
 // Main horizontal hall + offset smaller rear loft, rather than 4 nested gray
 // gable roofs stacked on top of the same footprint.
 const hall=group(g,-.28,0,.06);
 baseHouse(hall,expanded?6.25:5.35,expanded?4.35:3.90,expanded?2.96:2.62,STANDARD.roof,
  expanded?STANDARD.cream:STANDARD.plaster,'tile',windows,0);
 const loft=group(g,expanded?-2.04:-1.75,0,expanded?-1.62:-1.44);
 baseHouse(loft,expanded?2.72:2.26,expanded?2.92:2.57,expanded?4.16:3.72,STANDARD.roofBlue,
  STANDARD.cream,'workshop',windows,0);
 const kitchen=group(g,expanded?2.50:2.16,0,expanded?-1.34:-1.19);
 baseHouse(kitchen,expanded?2.15:1.85,expanded?2.55:2.18,expanded?2.22:2.05,STANDARD.roofWarm,
  STANDARD.wheat,'cottage',windows,0);
 // Raised arcade ties the building footprint to the village center, with
 // see-through columns instead of a blocky solid front annex.
 box(g,-.3,.23,expanded?2.68:2.40,expanded?6.80:6.10,.22,expanded?2.30:2.12,STANDARD.stone);
 for(const sx of expanded?[-3.2,-1.60,.22,2.65]:[-2.90,-1.34,.48,2.23]){
  box(g,sx,expanded?1.50:1.39,expanded?3.51:3.25,.17,expanded?2.26:2.05,.17,STANDARD.wood);
  const lantern=context.createLantern(g,sx,expanded?2.73:2.53,expanded?3.54:3.27);
  if(sx===(expanded?-3.2:-2.9)||sx===(expanded?2.65:2.23))context.swings.push(lantern);
 }
 box(g,-.35,expanded?2.65:2.42,expanded?3.51:3.25,expanded?6.90:6.12,.22,.22,STANDARD.brightWood);
 // A side hall terrace gives the front a usable social space.
 for(const x of expanded?[-1.65,.1,1.70]:[-1.2,.95])box(g,x,.53,expanded?3.51:3.27,1.12,.13,.62,STANDARD.brightWood);
 const sign=context.createSign(g,expanded?-1.22:-.88,expanded?2.03:1.77,expanded?3.62:3.36,'酒');sign.rotation.y=-.07;
 const banner=group(g,expanded?3.35:2.92,expanded?2.78:2.5,expanded?2.58:2.35);
 box(banner,0,.42,0,.07,1.25,.07,STANDARD.wood);
 const flag=new THREE.Mesh(new THREE.PlaneGeometry(.72,1.10),STANDARD.redCloth);
 flag.position.set(0,-.44,.1);flag.rotation.y=.17;banner.add(flag);
 context.swings.push(banner);
 return g;
}
