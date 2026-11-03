import * as THREE from 'three';
import { type Decision, type WorldState, projectProgress } from '../simulation/world';

/** All art is made from Three.js geometry. No texture URLs, generators or asset keys. */
const M=(color:string,roughness=1,extra:Record<string,unknown>={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
const wood=M('#926a52'), darkWood=M('#624a3b'), woodLight=M('#c5a47d'), stucco=M('#efe4cc');
const stone=M('#aaa69a'), stonePale=M('#d8d0ba'), grass=M('#8fae72'), grassLight=M('#a4c389');
const flowerColors=['#e8a6a5','#f0d184','#d7b5d9','#fbf5dc','#c3d5f0'];
const dummy=new THREE.Object3D();
function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,opts?:{rotY?:number;rotZ?:number}) {
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); o.position.set(x,y,z);
  if(opts?.rotY)o.rotation.y=opts.rotY;if(opts?.rotZ)o.rotation.z=opts.rotZ;
  o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function cylinder(parent:THREE.Object3D,rt:number,rb:number,h:number,x:number,y:number,z:number,mat:THREE.Material,segments=8){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);
  o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function sphere(parent:THREE.Object3D,r:number,x:number,y:number,z:number,mat:THREE.Material,seg=9){
  const o=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
function seeded(n:number) {let x=(n+31)*1664525+1013904223; x=(x^(x>>>16))>>>0;return x/4294967296;}
function curveRibbon(parent:THREE.Object3D,coords:[number,number][],width:number,material:THREE.Material,y=.155){
  const curve=new THREE.CatmullRomCurve3(coords.map(([x,z])=>new THREE.Vector3(x,y,z)));
  const vertices:number[]=[],idx:number[]=[];
  const steps=80;
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=curve.getPoint(t),dir=curve.getTangent(t),n=new THREE.Vector3(-dir.z,0,dir.x).normalize();
    for(const side of [-1,1])vertices.push(p.x+n.x*width/2*side,p.y,p.z+n.z*width/2*side);
    if(i<steps){const b=i*2;idx.push(b,b+1,b+2,b+1,b+3,b+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function plant(parent:THREE.Object3D,x:number,z:number,scale=1,kind=0){
  const g=new THREE.Group();g.position.set(x,.15,z);g.scale.setScalar(scale);parent.add(g);
  const stem=M('#5c845e');
  if(kind===0){
    cylinder(g,.035,.045,.42,0,.23,0,stem,6);
    for(let i=0;i<3;i++){const a=i*2.1;sphere(g,.13,Math.cos(a)*.16,.43,Math.sin(a)*.16,M(flowerColors[Math.floor(seeded(i+x*3+z)*flowerColors.length)]),7);}
    sphere(g,.12,0,.49,0,M('#f7d778'),6);
  }else{
    for(let i=0;i<4;i++){
      const a=i*2.1;const leaf=sphere(g,.18,Math.cos(a)*.12,.14+seeded(x+i)*.13,Math.sin(a)*.12,M(i%2?'#67946b':'#779c6b'),6);
      leaf.scale.set(.9,.6,1.35);
    }
  }
  return g;
}
function rock(parent:THREE.Object3D,x:number,z:number,r:number){const m=sphere(parent,r,x,.12+r*.45,z,M(seeded(x+z)>.5?'#a0a99a':'#b3ad9e'),5);m.scale.y=.48;return m;}
function tree(parent:THREE.Object3D,x:number,z:number,s:number,type:'round'|'pine'|'pink'='round') {
  const g=new THREE.Group();g.position.set(x,.16,z);g.scale.setScalar(s);parent.add(g);
  cylinder(g,.15,.22,1.4,0,.7,0,wood,7);
  if(type==='pine'){
    for(let i=0;i<3;i++)cylinder(g,.03,1.0-i*.16,1.45,0,1.35+i*.48,0,M(i===1?'#507b63':'#638d6b'),7);
  } else {
    const mats=type==='pink'?[M('#dfaab5'),M('#efbfc6'),M('#c995ab')]:[M('#678f6b'),M('#729e71'),M('#88a879')];
    sphere(g,.82,0,1.83,0,mats[0]);sphere(g,.67,-.48,1.55,.18,mats[1]);sphere(g,.63,.42,1.63,-.12,mats[2]);
    sphere(g,.64,.1,2.22,-.08,mats[1]);
  }
  return g;
}
function lantern(parent:THREE.Object3D,x:number,z:number,h=1.5){
  const g=new THREE.Group();g.position.set(x,.15,z);parent.add(g);
  cylinder(g,.055,.085,h,0,h/2,0,darkWood,7);
  box(g,.36,.12,.36,0,h+.03,0,darkWood);
  const glass=M('#ffd993',.65,{emissive:'#f6a953',emissiveIntensity:.6});
  box(g,.27,.34,.27,0,h-.18,0,glass);
  box(g,.37,.1,.37,0,h-.38,0,darkWood);
  return glass;
}
function roof(parent:THREE.Object3D,w:number,d:number,base:number,roofMat:THREE.Material,pitch=.9){
  const len=Math.sqrt((w/2+.3)**2+pitch*pitch),theta=Math.atan2(pitch,w/2+.3);
  const left=box(parent,len,.16,d+.44,-w/4-.1,base+pitch/2,0,roofMat,{rotZ:theta});
  const right=box(parent,len,.16,d+.44,w/4+.1,base+pitch/2,0,roofMat,{rotZ:-theta});
  for(const side of [-1,1]) {
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,pitch);shape.closePath();
    const geom=new THREE.ShapeGeometry(shape);const triangle=new THREE.Mesh(geom,stucco);
    triangle.position.set(0,base,side*(d/2+.018));
    if(side<0) triangle.rotation.y=Math.PI;
    triangle.material=stucco;triangle.castShadow=true;parent.add(triangle);
  }
  return [left,right];
}
export type HouseStyle={x:number;z:number;w:number;d:number;h?:number;wall?:string;roof?:string;type?:'home'|'shop'|'hall'|'barn'|'inn';rotation?:number;};
function house(parent:THREE.Object3D,style:HouseStyle){
  const {x,z,w,d,h=2.0,wall='#e9d9ba',roof:roofColor='#a96f61',type='home',rotation=0}=style;
  const g=new THREE.Group();g.position.set(x,.15,z);g.rotation.y=rotation;parent.add(g);
  const wallMat=M(wall),roofMat=M(roofColor),frameMat=M('#a17f5f'),glass=M('#f7d8a1',.6,{emissive:'#ffbb69',emissiveIntensity:.55});
  g.userData.glassMat=glass;
  box(g,w+.38,.29,d+.38,0,.13,0,stonePale);
  box(g,w,h,d,0,h/2+.27,0,wallMat);
  roof(g,w,d,h+.27,roofMat,type==='hall'?1.20:.85);
  for(const side of [-1,1])for(const back of [-1,1]) box(g,.15,h,.15,side*(w/2-.05),h/2+.27,back*(d/2-.06),frameMat);
  box(g,w+.1,.13,.12,0,.38,d/2+.06,frameMat);
  box(g,w+.1,.13,.12,0,h+.12,d/2+.06,frameMat);
  // Doors facing viewer (positive z).
  box(g,.68,1.18,.14,0,.88,d/2+.13,darkWood);
  box(g,.54,.96,.15,0,.84,d/2+.22,M(type==='shop'?'#8c725f':'#987350'));
  sphere(g,.042,.19,.79,d/2+.32,M('#e7cb83'),5);
  for(const side of [-1,1]){
    const px=side*(w*.32);
    box(g,.52,.62,.11,px,h*.60,d/2+.12,stone);
    box(g,.41,.51,.13,px,h*.60,d/2+.18,glass);
    box(g,.07,.53,.16,px,h*.60,d/2+.25,frameMat);
    box(g,.44,.07,.16,px,h*.60,d/2+.25,frameMat);
    box(g,.68,.12,.27,px,h*.32,d/2+.18,woodLight);
    plant(g,px,h*.0+d/2+.45,.57,0)?.position.set(px,h*.32,d/2+.27);
  }
  // side shutters
  box(g,.13,.55,.53,-w/2-.10,.93,0,frameMat);
  box(g,.10,.39,.34,-w/2-.20,.93,0,glass);
  if(type==='shop'||type==='inn') {
    box(g,w*.81,.14,.86,0,1.84,d/2+.64,M(type==='inn'?'#bd866f':'#e3c184'));
    box(g,w*.81,.07,.10,0,1.75,d/2+1.06,woodLight);
    for(const k of [-1,1])box(g,.07,1.1,.07,k*w*.39,1.26,d/2+1.05,frameMat);
    if(type==='shop')for(let k=0;k<3;k++)cylinder(g,.2,.2,.1,(k-1)*.5,1.49,d/2+.8,M(['#b98273','#c6ab6e','#92b479'][k]),7);
  }
  cylinder(g,.22,.25,.9,w*.27,h+1.07,-d*.14,M('#cfc0ac'),7);
  cylinder(g,.25,.25,.09,w*.27,h+1.5,-d*.14,stonePale,7);
  if(type==='hall'){
    const tower=new THREE.Group();tower.position.set(-w*.25,h+.27,-d*.12);g.add(tower);
    box(tower,.95,2.25,.95,0,1.15,0,wallMat);
    cylinder(tower,0,.81,1.1,0,2.83,0,roofMat,4).rotation.y=Math.PI/4;
    for(const side of [-1,1]) box(tower,.28,.48,.08,side*.29,1.78,.52,glass);
    sphere(tower,.12,0,3.45,0,M('#f5d285'));
  }
  if(type==='barn'){
    for(const side of [-1,1])box(g,.29,1.3,.1,side*.44,.92,d/2+.25,frameMat,{rotZ:side*.2});
  }
  // Little stepping stones
  for(let i=0;i<3;i++) box(g,.52,.05,.3,(seeded(i+x)*.3-.15),.05,d/2+.5+i*.38,stonePale,{rotY:.08});
  return g;
}
function windmill(parent:THREE.Object3D,x:number,z:number){
  const g=new THREE.Group();g.position.set(x,.15,z);parent.add(g);
  cylinder(g,1.05,1.48,3.7,0,1.85,0,M('#e1cfaf'),10);
  for(let i=0;i<9;i++)cylinder(g,1.1+i*.03,1.11+i*.03,.035,0,.45+i*.37,0,M(i%2?'#b6a88f':'#c5b9a1'),10);
  cylinder(g,.1,1.38,1.45,0,4.4,0,M('#a16c55'),8);
  box(g,.62,1.23,.17,0,.98,1.21,darkWood);
  box(g,.24,.28,.17,.42,2.55,1.04,M('#f4d5a1',1,{emissive:'#ecbb6f',emissiveIntensity:.5}));
  const blades=new THREE.Group();blades.position.set(0,3.22,1.4);g.add(blades);
  for(let i=0;i<4;i++){
    const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2;blades.add(arm);
    box(arm,.14,2.7,.13,0,1.23,0,wood);
    for(let j=0;j<6;j++)box(arm,.92,.18,.10,.15,.57+j*.36,.04,woodLight);
  }
  cylinder(blades,.28,.28,.28,0,0,.12,darkWood,10).rotation.x=Math.PI/2;
  return blades;
}
function market(parent:THREE.Object3D,x:number,z:number){
  const g=new THREE.Group();g.position.set(x,.15,z);parent.add(g);
  const colors=[M('#bb786d'),M('#e9cf9b'),M('#b4c69c')];
  for(let k=0;k<2;k++){
    const stall=new THREE.Group();stall.position.set((k-.5)*2.1,0,0);g.add(stall);
    for(const a of [-1,1])for(const b of [-1,1])box(stall,.10,1.5,.10,a*.72,.76,b*.53,wood);
    box(stall,1.75,.17,1.30,0,1.55,0,colors[k]);
    for(let j=0;j<5;j++)box(stall,.32,.06,1.3,(j-2)*.35,1.47,0,colors[j%3]);
    box(stall,1.5,.14,.62,0,.82,.2,woodLight);
    for(let j=0;j<5;j++)sphere(stall,.15,(j-2)*.24,.98,.3,M(j%2?'#cb946b':'#b7b56a'),6);
    box(stall,.18,.53,.3,.55,.29,-.3,wood);
  }
  return g;
}
function flowerGarden(parent:THREE.Object3D){
  const g=new THREE.Group();g.position.set(.8,.16,4.8);parent.add(g);
  // concentric circular beds and a delicate gazebo
  cylinder(g,2.75,2.9,.18,0,.08,0,M('#e3d7b9'),24);
  cylinder(g,2.30,2.34,.07,0,.20,0,M('#8fa970'),24);
  for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=1.45+seeded(i)*.7;plant(g,Math.cos(a)*r,Math.sin(a)*r,.6+seeded(i+30)*.4,0);}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const px=Math.cos(a)*.8,pz=Math.sin(a)*.8;cylinder(g,.06,.07,2.2,px,1.14,pz,woodLight);}
  cylinder(g,0,1.34,.7,0,2.57,0,M('#c9a18e'),8);
  cylinder(g,.23,.23,.35,0,.39,0,stone,10);sphere(g,.2,0,.65,0,M('#f4dca8'));
  for(let i=0;i<3;i++){let a=i*2.09;const bench=new THREE.Group();bench.position.set(Math.cos(a)*2.8,.03,Math.sin(a)*2.8);bench.rotation.y=-a;g.add(bench);box(bench,.88,.12,.33,0,.42,0,wood);box(bench,.88,.52,.1,0,.61,-.17,wood);for(let k of [-1,1])box(bench,.09,.45,.10,k*.34,.22,0,darkWood);}
  return g;
}
function makeBridge(parent:THREE.Object3D){
  const g=new THREE.Group();g.position.set(8.1,.18,0);parent.add(g);
  // bridge across river running parallel with X; slight arch effect.
  for(let i=0;i<13;i++){
    const x=-2.3+i*.39;const y=.32+.33*(1-Math.pow(x/2.45,2));
    box(g,.36,.2,2.05,x,y,0,M(i%3===0?'#a17b57':'#b58d66'));
  }
  for(let side of [-1,1]){
    for(let i=0;i<5;i++){const x=-2.2+i*1.1;const y=.38+.33*(1-Math.pow(x/2.45,2));box(g,.14,.93,.13,x,y+.36,side*.89,darkWood);}
    box(g,4.85,.13,.13,0,1.18,side*.89,woodLight);
  }
  for(let i=0;i<5;i++) rock(g,(i-2)*1.1,1.5,.25);
  return g;
}
function patch(parent:THREE.Object3D,x:number,z:number,w:number,d:number,mat:THREE.Material,rotation=0){
  return box(parent,w,.025,d,x,.175,z,mat,{rotY:rotation});
}
export interface VillageGraphics{
  root:THREE.Group;
  windmill:THREE.Group;
  windowMaterials:THREE.MeshStandardMaterial[];
  waterMaterials:THREE.MeshStandardMaterial[];
  updateConstruction(state:WorldState):void;
  animate(t:number,daylight:number):void;
}
export function buildVillage(scene:THREE.Scene):VillageGraphics{
  const root=new THREE.Group();scene.add(root);
  const palette:{[key:string]:THREE.Material}={};
  const islandPts:[number,number][]=[];
  for(let i=0;i<40;i++){
    const a=i/40*Math.PI*2;
    const r=1+.052*Math.sin(i*3.2)+.032*Math.cos(i*2.4)+.02*Math.sin(i*7.1);
    islandPts.push([Math.cos(a)*16.3*r,Math.sin(a)*11.9*r]);
  }
  const shape=new THREE.Shape();shape.moveTo(...islandPts[0]);for(let i=1;i<islandPts.length;i++)shape.lineTo(...islandPts[i]);shape.closePath();
  const dirt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:true,bevelThickness:.32,bevelSize:.46,bevelSegments:2,steps:1}),[M('#977662'),M('#8b6d5c')]);
  dirt.rotation.x=Math.PI/2;dirt.position.y=.03;dirt.receiveShadow=true;dirt.castShadow=true;root.add(dirt);
  const turf=new THREE.Mesh(new THREE.ShapeGeometry(shape),grass);turf.rotation.x=Math.PI/2;turf.position.y=.16;turf.material.side=THREE.DoubleSide;turf.receiveShadow=true;root.add(turf);
  // Low rock layers along the visible lower edge.
  for(let i=0;i<30;i++){const a=i/30*Math.PI*2;const x=Math.cos(a)*15.8,z=Math.sin(a)*11.2;if(seeded(i*8)<.42)rock(root,x,z,.24+seeded(i+80)*.37);}
  // Organic river with tapered banks and foam highlights.
  const riverCoords:[number,number][]=[ [8.5,-11.45],[8.85,-7],[8.5,-3],[8.1,0],[8.8,4],[8.5,8],[8.1,11.5] ];
  curveRibbon(root,riverCoords,2.25,M('#c8d4b4'),.175);
  const waterMat=M('#7db6bc',.24,{metalness:.07,transparent:true,opacity:.9,side:THREE.DoubleSide});
  curveRibbon(root,riverCoords,1.77,waterMat,.20);
  curveRibbon(root,[[8.55,-11.2],[8.9,-6],[8.5,-2],[8.15,2],[8.62,6],[8.17,11.1]],.25,M('#b3d9d2',.32,{transparent:true,opacity:.48,side:THREE.DoubleSide}),.212);
  // Meadow terraces, village commons, paths, and cultivated fields.
  cylinder(root,4.5,4.8,.12,-1.1,.20,.1,M('#a6bb85'),30);
  cylinder(root,2.6,2.68,.08,-1.1,.29,.25,M('#d6c7a1'),25);
  cylinder(root,2.14,2.2,.04,-1.1,.34,.25,M('#c4b08c'),26);
  const pathMat=M('#d4c8a4',1,{side:THREE.DoubleSide});
  const paths:[number,number][][]=[
    [[-7.5,-4.2],[-5.5,-2.8],[-3,-1],[-1.1,.3],[1.5,1.3],[4.0,2.0],[6.8,1.1]],
    [[-1.1,.3],[-1.7,2.9],[-3.8,4.9],[-9.4,5.1]],
    [[-1.0,.1],[.5,-2],[3.2,-4.2],[5,-5.5]],
    [[-1.0,.3],[1.9,3.3],[4.5,5.0],[5.8,6]],
    [[-8,-2],[-10,0],[-10.5,3],[-10.5,5.3]],
  ];
  paths.forEach((pts,i)=>curveRibbon(root,pts,i===0?1.26:.75,pathMat,.225));
  // East bank initially stays a natural open meadow.
  patch(root,11.8,-5.7,5.1,4.9,M('#a1b77b'),-.08);
  for(let i=0;i<9;i++){
    const z=-7.7+i*.55;
    box(root,3.6,.09,.13,12.0,.2,z,M(i%2?'#b3c27c':'#9fae6d'),{rotY:-.08});
    for(let j=0;j<6;j++)plant(root,10.6+j*.5,z,.25,1);
  }
  // A vegetable plot on the western hill.
  patch(root,-10.9,5.0,4.8,3.2,M('#8f7b5f'),.12);
  for(let i=0;i<5;i++)for(let j=0;j<6;j++){
    plant(root,-12.7+j*.62,3.75+i*.55,.5,1);
  }
  // House composition — different silhouettes and materials, facing camera.
  const houseData:HouseStyle[]=[
    {x:-6.6,z:-5.1,w:3.2,d:2.7,h:2.15,wall:'#eadcc5',roof:'#a86c59'},
    {x:-2.0,z:-6.8,w:2.95,d:2.55,h:2.0,wall:'#f1e2c9',roof:'#8d9f85'},
    {x:4.1,z:-5.4,w:3.4,d:2.6,h:2.3,wall:'#ead3b0',roof:'#b47d63',type:'shop'},
    {x:4.7,z:5.6,w:3.1,d:2.55,h:2.15,wall:'#e4ddcb',roof:'#849d8d'},
    {x:-4.4,z:3.9,w:3.9,d:3.0,h:2.95,wall:'#e8d8bb',roof:'#9d6e60',type:'hall'},
    {x:3.3,z:1.7,w:2.9,d:2.35,h:1.8,wall:'#e5cfae',roof:'#c38a68',type:'inn'}
  ];
  const windowMats:THREE.MeshStandardMaterial[]=[];
  houseData.forEach(h=>{const g=house(root,h);windowMats.push(g.userData.glassMat as THREE.MeshStandardMaterial);});
  const sails=windmill(root,-10.5,-.2);
  market(root,1.9,6.2);
  // Wishing well and plaza decorations.
  const well=new THREE.Group();well.position.set(-1.1,.35,.25);root.add(well);
  cylinder(well,.55,.58,.55,0,.22,0,stonePale,12);cylinder(well,.38,.39,.02,0,.51,0,M('#657e7a'),12);
  for(const x of [-.44,.44])box(well,.10,1.2,.11,x,1.06,0,wood);
  roof(well,1.25,1.2,1.58,M('#ab7763'),.38);
  // Trees placed with care around silhouettes, not on walking paths.
  const trees:Array<[number,number,number,('round'|'pine'|'pink')?]>=[
    [-13.2,-7.0,1.18,'round'],[-10.5,-7.7,.9,'pine'],[-12.8,-2.2,1.3,'round'],[-14,-.1,.88,'pine'],
    [-13.8,8.0,1.0,'pine'],[-7.4,8.8,1.25,'round'],[-5.0,9.2,.85,'pink'],[-1.2,8.8,1.06,'round'],
    [2.5,9.5,.97,'pink'],[6.7,9.3,1.05,'pine'],[12.7,8.0,1.2,'round'],[14.0,3.0,.96,'pine'],
    [13.5,-2.4,1.0,'round'],[11.6,-9.0,.91,'round'],[5.1,-8.9,1.2,'round'],[.5,-9.6,1.05,'pine'],
    [-10.5,-9.6,.88,'pine'],[-6.9,1.9,.85,'pink'],[6.1,-1.5,.65,'round']
  ];
  trees.forEach(([x,z,s,k])=>tree(root,x,z,s,k||'round'));
  for(let i=0;i<155;i++){
    const x=(seeded(i*49+2)-.5)*29,z=(seeded(i*81+7)-.5)*21;
    const r=x*x/16**2+z*z/11.7**2;
    if(r>.88 || (x>7.15&&x<9.7) || (x>-6&&x<6&&z>-7&&z<7) || (x< -8&&z>3&&z<7))continue;
    if(i%4===0)rock(root,x,z,.15+seeded(i*7)*.19);
    else plant(root,x,z,.18+seeded(i*11)*.22,i%3===0?0:1);
  }
  // Fences around field and cottage garden, with little hanging lanterns.
  for(let i=0;i<9;i++){
    const x=-12.8+i*.58;
    box(root,.10,.65,.10,x,.45,6.9,woodLight);
    if(i<8)box(root,.61,.085,.09,x+.3,.55,6.9,woodLight);
  }
  const lamps=[[-6.9,-1.4],[-1.6,-3.0],[3.8,3.4],[6.3,.9],[-5.4,5.2]];
  const glassMats=lamps.map(([x,z])=>lantern(root,x,z,1.8));
  // Butterflies are lightweight, independent decorative animations.
  const butterflies:THREE.Group[]=[];
  for(let i=0;i<8;i++){
    const butterfly=new THREE.Group();butterfly.position.set(-4+i*1.2,2.0,-1.0+i*.67);
    const mat=M(i%2?'#efd69b':'#e8b3b2',1,{side:THREE.DoubleSide});
    const a=box(butterfly,.32,.035,.20,-.18,0,0,mat,{rotZ:-.4});
    const b=box(butterfly,.32,.035,.20,.18,0,0,mat,{rotZ:.4});
    a.castShadow=false;b.castShadow=false;root.add(butterfly);butterflies.push(butterfly);
  }
  // Scattered sheep on the grassy far bank.
  for(let i=0;i<3;i++){
    const x=11.1+i*1.05,z=-3.5+(i%2)*1.2;
    const g=new THREE.Group();g.position.set(x,.18,z);root.add(g);
    sphere(g,.44,0,.57,0,M('#f1e9d7'));sphere(g,.22,.34,.63,0,M('#998a7c'));
    for(const zz of [-.23,.23])for(const xx of [-.2,.2])cylinder(g,.07,.09,.35,xx,.21,zz,M('#7b7869'),6);
    for(let j=0;j<5;j++)sphere(g,.22,(seeded(i+j)*.8-.4),.76,(seeded(j+i*31)*.6-.3),M('#f4ead7'));
  }
  const constructionGroup=new THREE.Group();root.add(constructionGroup);
  let lastStage=-1,lastChoice:Decision|null=null;
  const setConstruction=(state:WorldState)=>{
    const progress=projectProgress(state);const stage=state.projectState==='waiting'?-1:state.projectState==='complete'?10:Math.floor(progress*10);
    if(stage===lastStage && state.decision===lastChoice)return;
    lastStage=stage;lastChoice=state.decision;
    while(constructionGroup.children.length)constructionGroup.remove(constructionGroup.children[0]);
    if(state.decision===null)return;
    if(state.decision==='bridge'){
      if(progress<1){
        const cx=8.1;
        for(let i=0;i<Math.max(1,Math.round(progress*12));i++){
          const x=-2.2+i*.39;
          box(constructionGroup,.36,.13,1.95,cx+x,.55,0,woodLight);
        }
        if(progress<.95){for(let i=0;i<3;i++)box(constructionGroup,.23,.12,.12,6.3+i*.35,.26,2.0,darkWood);}
      } else {
        const g=makeBridge(constructionGroup);g.position.x=8.1;
        curveRibbon(constructionGroup,[[10.2,.0],[11.8,1.0],[13.8,2.3]],.84,pathMat,.22);
        tree(constructionGroup,13.7,-5.8,.8,'pink');
      }
    }else{
      if(progress<1){
        cylinder(constructionGroup,2.3,2.42,.08,.8,.21,4.8,M('#987d61'),24);
        for(let i=0;i<Math.floor(progress*24);i++){
          const a=i/24*Math.PI*2;plant(constructionGroup,.8+Math.cos(a)*1.65,4.8+Math.sin(a)*1.65,.52,0);
        }
      }else flowerGarden(constructionGroup);
    }
  };
  return {
    root,windmill:sails,windowMaterials:[...windowMats,...glassMats],waterMaterials:[waterMat],updateConstruction:setConstruction,
    animate(t:number,daylight:number){
      sails.rotation.z=-t*.24;
      for(let i=0;i<butterflies.length;i++){
        const b=butterflies[i];b.position.y=1.6+Math.sin(t*2.2+i)*.28;
        b.position.x=(-3.7+i*1.12)+Math.sin(t*.4+i)*.7;
        b.position.z=(i%4)*1.85+Math.cos(t*.6+i)*.44;
        b.rotation.y=t*.9+i;
      }
      const intensity=daylight<.48?1.25:.28;
      glassMats.forEach(m=>m.emissiveIntensity=intensity);
      windowMats.forEach(m=>m.emissiveIntensity=daylight<.4?.95:.26);
      waterMat.opacity=.76+.15*Math.sin(t*.8);
    }
  };
}
