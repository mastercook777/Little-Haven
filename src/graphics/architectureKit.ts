import * as THREE from 'three';

/**
 * Visual-only Chinese village building kit. Detail sockets sit *on* the original
 * walls and roof; they do not overwrite footprint, plot ID or building phase.
 * Shared geometry and materials are batchable into static parent groups.
 */
const M={
 oldWood:new THREE.MeshStandardMaterial({color:'#70574b',roughness:.94}),
 carvedWood:new THREE.MeshStandardMaterial({color:'#97785f',roughness:.85}),
 goldWood:new THREE.MeshStandardMaterial({color:'#c1a17a',roughness:.83}),
 beamShade:new THREE.MeshStandardMaterial({color:'#4f4743',roughness:1}),
 pale:new THREE.MeshStandardMaterial({color:'#d5c7ae',roughness:.95}),
 roof:new THREE.MeshStandardMaterial({color:'#4a565b',roughness:.98}),
 ridge:new THREE.MeshStandardMaterial({color:'#667275',roughness:.9}),
 stone:new THREE.MeshStandardMaterial({color:'#a6a99d',roughness:1}),
 tile:new THREE.MeshStandardMaterial({color:'#c3b6a0',roughness:.88}),
 bronze:new THREE.MeshStandardMaterial({color:'#a1845c',metalness:.25,roughness:.65}),
 paper:new THREE.MeshStandardMaterial({color:'#f4d7a8',emissive:'#a96939',emissiveIntensity:.13,roughness:1}),
 fabric:new THREE.MeshStandardMaterial({color:'#a66854',roughness:1,side:THREE.DoubleSide}),
 leaf:new THREE.MeshStandardMaterial({color:'#738e6d',roughness:1})
};
const boxGeo=new THREE.BoxGeometry(1,1,1);
const roundGeo=new THREE.CylinderGeometry(1,1,1,8);
const orbGeo=new THREE.IcosahedronGeometry(1,0);
function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=M.oldWood){
 const a=new THREE.Mesh(boxGeo,m);a.scale.set(w,h,d);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;
}
function cyl(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,m:THREE.Material=M.oldWood){
 const a=new THREE.Mesh(roundGeo,m);a.scale.set(r,h,r);a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;
}
function orb(parent:THREE.Object3D,x:number,y:number,z:number,r:number,m:THREE.Material=M.bronze){
 const a=new THREE.Mesh(orbGeo,m);a.position.set(x,y,z);a.scale.setScalar(r);a.castShadow=true;parent.add(a);return a;
}
function lattice(parent:THREE.Object3D,cx:number,cy:number,z:number,w:number,h:number,variant:'cross'|'vertical'|'paper'='cross'){
 // One assembled window reads as paper-filled timber, not an emissive blank rectangle.
 box(parent,cx,cy,z-.014,w+.20,h+.16,.11,M.beamShade);
 box(parent,cx,cy,z+.039,w,h,.053,variant==='paper'?M.paper:M.pale);
 for(const side of [-1,1])box(parent,cx+side*(w/2+.045),cy,z+.09,.076,h+.22,.10,M.oldWood);
 for(const side of [-1,1])box(parent,cx,cy+side*(h/2+.065),z+.09,w+.15,.075,.10,M.oldWood);
 for(let i=1;i<3;i++){
  box(parent,cx-w/2+(w*i/3),cy,z+.096,.046,h,.067,M.carvedWood);
 }
 if(variant!=='vertical'){
  for(const j of [-.25,.25])box(parent,cx,cy+j*h,z+.095,w,.034,.064,M.carvedWood);
 }else box(parent,cx,cy,z+.098,w,.035,.065,M.carvedWood);
 if(variant==='cross'){
  for(const x of [-w*.22,w*.22]){
   const diagonal=box(parent,cx+x,cy,z+.11,.035,h*.72,.035,M.oldWood);
   diagonal.rotation.z=x<0?-.49:.49;
  }
 }
}
function roofCrest(parent:THREE.Object3D,y:number,depth:number,width:number,kind:'main'|'home',accent=0){
 // Horizontal crest aligned with roof ridge (Z axis), with upturned end finials.
 const ridge=cyl(parent,0,y,0,.105,depth+.66,M.ridge);ridge.rotation.x=Math.PI/2;
 for(const sign of [-1,1]){
  cyl(parent,0,y+.02,sign*(depth/2+.30),.16,.15,M.roof).rotation.x=Math.PI/2;
  const finial=box(parent,0,y+.16,sign*(depth/2+.21),.25,.34,.24,M.ridge);
  finial.rotation.x=sign*.30;
  orb(parent,0,y+.36,sign*(depth/2+.23),kind==='main'?.16:.105,M.roof);
 }
 // Small line of expressed ceramic ridge tiles; use rhythmic, sparing ornaments.
 const count=kind==='main'?7:5;
 for(let i=0;i<count;i++){
  const z=-depth*.43+depth*.86*i/(count-1);
  box(parent,0,y+.087+accent*.02,z,width*.025,.10,.22,i%2?M.roof:M.ridge);
 }
}
function eaveBrackets(parent:THREE.Object3D,w:number,d:number,y:number,kind:'main'|'home'){
 const xCount=kind==='main'?5:3,front=d*.5+.17;
 for(const side of [-1,1])for(let i=0;i<xCount;i++){
  const x=-w*.42+(i/(xCount-1))*w*.84;
  const z=side*front;
  box(parent,x,y-.24,z,.15,.46,.17,M.carvedWood);
  const brace=box(parent,x,y-.09,z-side*.16,.15,.48,.15,M.oldWood);
  brace.rotation.x=side*.48;
 }
}
function threshold(parent:THREE.Object3D,w:number,z:number){
 box(parent,0,.30,z,w,.16,.48,M.stone);
 box(parent,0,.13,z+.37,w+.20,.10,.47,M.tile);
}
function door(parent:THREE.Object3D,z:number,width:number,height:number,kind:'main'|'home'){
 const half=width/2;
 for(const s of [-1,1]){
  box(parent,s*half*.5,.31+height/2,z,.48*width,height,.10,kind==='main'?M.oldWood:M.carvedWood);
  for(const dx of [-.30,.30]){
   box(parent,s*half*.5+dx*half,.65,z+.07,.042,height*.63,.04,M.beamShade);
  }
  box(parent,s*half*.5,1.02,z+.07,.33*width,.08,.06,M.beamShade);
  orb(parent,s*half*.5-s*.13,.75,z+.12,.053,M.bronze);
 }
 box(parent,0,.30+height,z+.06,width+.22,.11,.15,M.beamShade);
}
function flowerPot(parent:THREE.Object3D,x:number,z:number){
 cyl(parent,x,.46,z,.20,.27,M.tile);
 const stalk=cyl(parent,x,.76,z,.039,.32,M.leaf);
 for(let a=0;a<3;a++){
  const leaf=box(parent,x+Math.cos(a*2.09)*.20,.77,z+Math.sin(a*2.09)*.18,.33,.085,.15,M.leaf);
  leaf.rotation.y=a*2.09;leaf.rotation.z=.13;
 }
 stalk.castShadow=false;
}
export function detailTavern(group:THREE.Group){
 group.name='tavern-refined-v4';
 // Signature two-storey geometry and a readable front.
 roofCrest(group,5.99,2.9,.38,'main');
 roofCrest(group,4.05,4.3,.34,'main',.05);
 eaveBrackets(group,5.6,4.25,3.09,'main');
 eaveBrackets(group,4.1,2.9,4.89,'home');
 // The two front paper windows now have actual lattice and outer timber shutters.
 for(const x of [-1.75,1.75]){
  lattice(group,x,1.83,2.095,.43,.54,'cross');
  box(group,x,1.31,2.13,.84,.09,.19,M.goldWood);
 }
 for(const x of [-1.4,1.4]){
  lattice(group,x,3.91,1.07,.43,.66,'vertical');
  box(group,x,3.48,1.11,.73,.08,.19,M.carvedWood);
 }
 door(group,2.02,1.07,1.62,'main');
 threshold(group,1.85,2.53);
 // Widened portico and load-bearing beam joints, never just an isolated roof plane.
 for(const x of [-2.73,2.73]){
  box(group,x,2.60,2.46,.29,.19,.46,M.carvedWood);
  box(group,x,2.35,2.50,.37,.12,.15,M.beamShade);
 }
 for(const x of [-1.90,1.90])box(group,x,2.60,2.48,.15,.18,.65,M.goldWood);
 // Wall plinth to physically seat walls on stone footings.
 for(const side of [-1,1])box(group,side*2.65,.43,0,.23,.46,3.80,M.stone);
 box(group,0,.39,-1.94,5.55,.37,.26,M.stone);
 // Painted sign's wooden hanger, with a carved horizontal support.
 box(group,-1.93,2.94,3.12,.18,.15,.36,M.oldWood);
 box(group,-1.93,2.82,3.12,.08,.43,.10,M.carvedWood);
}
export function detailHome(group:THREE.Group,w:number,d:number,h:number,variant:number){
 group.name='mountain-home-refined-'+variant;
 const front=d/2+.11,profile=variant%4;
 roofCrest(group,h+1.07,d,.25,'home',profile*.03);
 eaveBrackets(group,w+.20,d+.36,h+.31,'home');
 // A functional carved timber threshold and two-leaf wooden door.
 door(group,front+.008,.65,1.09,'home');
 threshold(group,.91,front+.35);
 lattice(group,w*.31,1.35,front+.17,.34,.44,profile===1?'paper':profile===2?'vertical':'cross');
 box(group,w*.31,1.02,front+.18,.63,.11,.24,M.goldWood);
 for(const sx of [-1,1]){
  box(group,sx*w*.46,.39,0,.17,.47,d+.12,M.stone);
 }
 // Roof front edges and lantern brackets distinguish the model from a flat toy box.
 for(const side of [-1,1]){
  const brace=box(group,side*(w*.34),h+.34,front+.15,.14,.43,.14,M.oldWood);
  brace.rotation.z=-side*.45;
 }
 if(profile===0){
  // Household store shed, small porch cover, and planter.
  box(group,-w*.28,1.71,front+.43,.94,.09,.77,M.roof);
  for(const x of [-w*.45,-w*.11])box(group,x,1.02,front+.65,.08,1.34,.08,M.oldWood);
  flowerPot(group,w*.05,front+.68);
 }else if(profile===1){
  // Weaver / trader: deep paneled side and striped shade cloth.
  const awning=box(group,w*.27,1.91,front+.42,1.12,.06,.77,M.fabric);
  awning.rotation.x=.19;
  box(group,w*.27,1.67,front+.78,1.15,.14,.11,M.carvedWood);
  for(let i=0;i<3;i++)box(group,w*.03+i*.25,2.0,front+.68,.045,.15,.10,M.pale);
 }else if(profile===2){
  // Herb grower's attic vents, daylight drying shelf and earthen planters.
  for(const x of [-w*.35,-w*.12]){
   lattice(group,x,h*.77,front+.03,.25,.31,'vertical');
  }
  box(group,-w*.35,1.05,front+.63,1.05,.09,.40,M.goldWood);
  for(let i=0;i<3;i++)flowerPot(group,-w*.4+i*.31,front+.85);
 }else{
  // Tea-hut / stoveshed's low chimney, side lantern and lattice rhythm.
  box(group,-w*.27,h+1.04,-d*.27,.37,.74,.35,M.stone);
  box(group,-w*.27,h+1.43,-d*.27,.53,.11,.48,M.roof);
  lattice(group,-w*.30,1.35,front+.16,.33,.44,'paper');
 }
}
