import * as THREE from 'three';
import {getCalendar,getWeather,type WorldState} from '../simulation/world';
import {makeBuildingRenderer} from './buildingRenderer';
import {createSeasonalArt} from './seasonArt';
import {buildVillageWorkplaces} from './lifeDetails';
import {buildRiverArt} from './riverArt';
import {detailTavern,detailHome} from './architectureKit';
import {createWeatherArt} from './weatherArt';
import {batchStaticSubtree,type BatchStats} from './batchStatic';

/** Wuxia valley: all meshes, silhouettes, materials and lights are locally procedural. */
const cache=new Map<string,THREE.MeshStandardMaterial>();
function mat(color:string,roughness=1){const k=`${color}:${roughness}`;let m=cache.get(k);if(!m){m=new THREE.MeshStandardMaterial({color,roughness});cache.set(k,m);}return m;}
const C={
 wood:mat('#735647'),timber:mat('#594b43'),lightWood:mat('#b89a75'),plaster:mat('#dfd7c2'),
 tile:mat('#59646a'),tileEdge:mat('#4c575c'),darkTile:mat('#444c52'),slate:mat('#9d9d90'),
 grass:mat('#87a477'),meadow:mat('#a4b58d'),bank:mat('#b6b29c'),soil:mat('#8e785e'),
 bamboo:mat('#577f61'),bambooLight:mat('#8aab75'),bambooDark:mat('#426852'),
 lantern:mat('#c8654a'),ceramic:mat('#544a46'),reed:mat('#c4b68e')
};
const random=(n:number)=>{let v=(Math.floor(n*104729)+239)*1664525+1013904223;v=(v^(v>>>16))>>>0;return v/4294967296;};
const add=(p:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{
 const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;
};
function box(p:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){return add(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);}
function cylinder(p:THREE.Object3D,rt:number,rb:number,h:number,x:number,y:number,z:number,m:THREE.Material,seg=8){return add(p,new THREE.CylinderGeometry(rt,rb,h,seg),m,x,y,z);}
function sphere(p:THREE.Object3D,r:number,x:number,y:number,z:number,m:THREE.Material,detail=0){return add(p,new THREE.IcosahedronGeometry(r,detail),m,x,y,z);}
function group(p:THREE.Object3D,x:number,y:number,z:number){const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;}
function rock(p:THREE.Object3D,x:number,z:number,r:number,h=.65){const g=sphere(p,r,x,r*h*.52+.16,z,mat(random(x+z)>.5?'#999f95':'#b2b0a4'));g.scale.set(1,h,.78);return g;}
function ribbon(p:THREE.Object3D,coords:[number,number][],width:number,m:THREE.Material,y=.20){
 const curve=new THREE.CatmullRomCurve3(coords.map(([x,z])=>new THREE.Vector3(x,y,z)));const verts:number[]=[],index:number[]=[];
 for(let i=0;i<=90;i++){const pt=curve.getPoint(i/90),t=curve.getTangent(i/90);const nx=-t.z,nz=t.x;
  verts.push(pt.x-nx*width/2,pt.y,pt.z-nz*width/2,pt.x+nx*width/2,pt.y,pt.z+nz*width/2);
  if(i<90){const b=i*2;index.push(b,b+1,b+2,b+1,b+3,b+2);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(index);geo.computeVertexNormals();
 const o=new THREE.Mesh(geo,m);o.receiveShadow=true;p.add(o);return o;
}
function tileRoof(p:THREE.Object3D,w:number,d:number,base:number,rise:number,color=C.tile){
 // Low-poly curved, upturned eaves: broad and legible at the default orthographic scale.
 const W=w/2+.38,D=d/2+.36,sections=8,depthSections=5;
 for(const sign of [-1,1]){
  const vs:number[]=[],ii:number[]=[];
  for(let iz=0;iz<=depthSections;iz++){const z=-D+2*D*iz/depthSections;
   for(let ix=0;ix<=sections;ix++){
    const x=sign*W*ix/sections,u=ix/sections,edge=Math.pow(u,5)*.21+Math.pow(Math.abs(z/D),5)*.16;
    vs.push(x,base+rise*(1-u)+edge,z);
   }
  }
  for(let iz=0;iz<depthSections;iz++)for(let ix=0;ix<sections;ix++){
   const a=iz*(sections+1)+ix,b=a+(sections+1);ii.push(a,a+1,b,a+1,b+1,b);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));geo.setIndex(ii);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:color.color,side:THREE.DoubleSide,roughness:1}));mesh.castShadow=true;mesh.receiveShadow=true;p.add(mesh);
  for(let i=1;i<8;i++){
   const u=i/8,x=sign*W*u,gy=base+rise*(1-u)+Math.pow(u,5)*.21;
   const rib=box(p,.055,.035,d+.45,x,gy+.07,0,C.tileEdge);rib.rotation.z=sign*.46;
  }
 }
 box(p,.18,.18,d+.82,0,base+rise+.08,0,C.darkTile);
 for(const z of [-D,D]){
  // dark fascia at the eave front/back
  for(const sign of [-1,1]){
   const bar=box(p,W*.99,.13,.12,sign*W*.51,base+rise*.5+.17,z,C.tileEdge);bar.rotation.z=-sign*Math.atan2(rise,W);
  }
 }
}
function lantern(p:THREE.Object3D,x:number,y:number,z:number,emissive:THREE.MeshStandardMaterial[],red=true){
 const g=group(p,x,y,z);const glass=new THREE.MeshStandardMaterial({color:red?'#bd634c':'#e8b67a',emissive:red?'#ea7046':'#ffd084',emissiveIntensity:.48,roughness:.8});emissive.push(glass);
 cylinder(g,.035,.035,.35,0,.20,0,C.timber,5);cylinder(g,.08,.08,.065,0,-.09,0,C.timber,8);
 cylinder(g,.205,.17,.46,0,-.31,0,glass,10);cylinder(g,.215,.215,.07,0,-.56,0,C.timber,10);
 cylinder(g,.017,.017,.22,0,-.69,0,C.lantern,5);return g;
}
function paintedSign(p:THREE.Object3D,x:number,y:number,z:number,word:string){
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=200;
 const ctx=canvas.getContext('2d');if(ctx){
  ctx.fillStyle='#e7d4a0';ctx.fillRect(0,0,160,200);ctx.fillStyle='#614a36';ctx.fillRect(6,6,148,188);
  ctx.fillStyle='#e8d9b6';ctx.font='bold 106px serif';ctx.textAlign='center';ctx.fillText(word,80,131);
 }
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(.86,1.16),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
 plane.position.set(x,y,z);p.add(plane);return plane;
}
function home(p:THREE.Object3D,x:number,z:number,w=2.9,d=2.5,h=1.9,variation=0,windows:THREE.MeshStandardMaterial[]=[],emissive:THREE.MeshStandardMaterial[]=[]){
 const g=group(p,x,.16,z);box(g,w+.35,.22,d+.35,0,.13,0,C.bank);
 box(g,w,h,d,0,h/2+.25,0,variation%2?mat('#d8c9b3'):C.plaster);
 for(const sx of [-1,1])for(const sz of [-1,1])box(g,.14,h+.2,.14,sx*w*.45,h*.5+.27,sz*d*.43,C.wood);
 tileRoof(g,w,d,h+.27,.72,variation===1?C.darkTile:C.tile);
 box(g,.67,1.12,.085,0,.83,d/2+.07,C.wood);
 box(g,.47,.66,.09,w*.31,1.34,d/2+.07,C.timber);
 const lit=new THREE.MeshStandardMaterial({color:'#e9c48b',emissive:'#f8ad68',emissiveIntensity:.25});windows.push(lit);
 box(g,.33,.43,.065,w*.31,1.35,d/2+.125,lit);
 box(g,.07,.46,.10,w*.31,1.36,d/2+.18,C.wood);
 for(let i=0;i<2;i++)box(g,.41,.04,.27,random(i+x)*.4-.2,.04,d/2+.52+i*.4,C.slate);
 if(variation===2){ // herb-drying rack
  for(const side of [-1,1])box(g,.09,1.17,.09,side*.9,.6,-d/2-.25,C.lightWood);
  box(g,2,.08,.10,0,1.18,-d/2-.25,C.lightWood);
  for(let i=0;i<5;i++){const herb=sphere(g,.18,(i-2)*.36,.85,-d/2-.25,C.bambooDark);herb.scale.y=.6;}
 }
 if(variation===3){lantern(g,-w*.38,h+.4,d*.40,emissive);}
 detailHome(g,w,d,h,variation);
 return g;
}
function tavern(p:THREE.Object3D,windows:THREE.MeshStandardMaterial[],emissive:THREE.MeshStandardMaterial[],swings:THREE.Group[]){
 const x=-3.4,z=-.2;const g=group(p,x,.16,z);const w=5.3,d=3.8;
 box(g,6.3,.28,4.9,0,.14,.30,C.bank);
 box(g,w,2.8,d,0,1.56,0,C.plaster);
 for(const sx of [-1,1])for(const sz of [-1,1])box(g,.23,3.0,.23,sx*2.45,1.6,sz*1.74,C.timber);
 for(const i of [-1,0,1])box(g,.15,2.5,.15,i*1.75,1.5,d*.51,C.wood);
 tileRoof(g,5.7,4.3,3.02,.9);
 // An upper loft gives the tavern an unmistakable two-storey silhouette.
 box(g,3.8,1.7,2.5,0,3.91,-.32,mat('#d6c9ae'));
 for(const sx of [-1,1])box(g,.16,1.7,.14,sx*1.68,3.91,.92,C.timber);
 tileRoof(g,4.15,2.9,4.78,1.02,C.darkTile);
 for(const tx of [-1.75,1.75]){
  box(g,.63,.78,.08,tx,1.82,d/2+.035,C.timber);
  const light=new THREE.MeshStandardMaterial({color:'#ebc795',emissive:'#e99e5a',emissiveIntensity:.45});windows.push(light);
  box(g,.44,.57,.10,tx,1.83,d/2+.10,light);box(g,.05,.63,.12,tx,1.83,d/2+.16,C.wood);
 }
 box(g,1.15,1.77,.10,0,1.22,d/2+.09,C.timber);
 for(const tx of [-1.4,1.4])box(g,.33,.66,.10,tx,3.92,.95,C.wood);
 for(const tx of [-2.7,2.7]){
  box(g,.13,2.4,.13,tx,1.22,2.45,C.wood);
  const gLantern=lantern(g,tx,2.83,2.47,emissive);swings.push(gLantern);
 }
 box(g,6.0,.17,1.2,0,2.58,2.45,C.wood);
 box(g,6.0,.13,.14,0,2.55,3.08,C.lightWood);
 const sign=paintedSign(g,-1.9,2.02,3.13,'酒');sign.rotation.y=-.10;
 // earthenware wine jars, benches and the covered porch.
 for(let i=0;i<4;i++){
  const x=2.17+(i%2)*.53,z=2.9+Math.floor(i/2)*.45;
  sphere(g,.31,x,.39,z,C.ceramic);cylinder(g,.16,.16,.13,x,.70,z,mat('#98846b'));
 }
 for(const x of [-1.08,1.02]){
  box(g,1.28,.14,.49,x,.55,3.25,C.lightWood);
  for(const v of [-.4,.4])box(g,.11,.49,.11,x+v,.3,3.25,C.wood);
 }
 const flag=group(g,3.08,2.85,2.2);box(flag,.075,2.85,.075,0,.32,0,C.wood);
 const banner=box(flag,.08,.96,.74,-.02,.15,.40,mat('#b87058'));banner.rotation.y=.12;swings.push(flag);
 detailTavern(g);
 return g;
}
function pine(p:THREE.Object3D,x:number,z:number,s:number){
 const g=group(p,x,.17,z);g.scale.setScalar(s);cylinder(g,.16,.23,1.65,0,.82,0,C.wood);
 for(let i=0;i<3;i++){const y=1.15+i*.55,r=1.07-i*.22;cylinder(g,.05,r,1.55,0,y,0,mat(i%2?'#637c67':'#56765f'),7);}
 return g;
}
function bamboo(p:THREE.Object3D,x:number,z:number,s:number,animated:THREE.Group[]){
 const g=group(p,x,.18,z);g.scale.setScalar(s);
 for(let i=0;i<3;i++){
  const a=i*2.4,xx=Math.cos(a)*.28,zz=Math.sin(a)*.28;const stalk=g;const tall=2.6+random(i+x)*1.4;
  for(let j=0;j<5;j++){
   cylinder(stalk,.062,.075,tall/5,xx,(j+.5)*tall/5,zz,i%2?C.bamboo:C.bambooLight,7);
   cylinder(stalk,.09,.09,.055,xx,(j+1)*tall/5,zz,C.bambooDark,7);
  }
  for(let j=0;j<4;j++){
   const ang=j*1.7+i;const leaf=sphere(stalk,.44,xx+Math.cos(ang)*.38,tall-.22+j*.10,zz+Math.sin(ang)*.38,j%2?C.bambooLight:C.bambooDark);
   leaf.scale.set(.92,.16,1.95);leaf.rotation.y=ang;leaf.rotation.z=(j%2?-.30:.28);
  }
 }
 animated.push(g);return g;
}
function stoneLantern(p:THREE.Object3D,x:number,z:number,emissive:THREE.MeshStandardMaterial[]){
 const g=group(p,x,.17,z);cylinder(g,.27,.38,.72,0,.35,0,C.slate,6);box(g,.86,.14,.82,0,.79,0,C.bank);
 const glow=new THREE.MeshStandardMaterial({color:'#e8d7aa',emissive:'#f6af72',emissiveIntensity:.65});emissive.push(glow);
 box(g,.48,.43,.48,0,1.07,0,glow);box(g,.92,.10,.88,0,1.34,0,C.slate);
 cylinder(g,0,.63,.43,0,1.57,0,C.tile,4).rotation.y=Math.PI/4;
}
function fence(p:THREE.Object3D,x1:number,z1:number,x2:number,z2:number,parts:number){
 const dx=(x2-x1)/parts,dz=(z2-z1)/parts;
 for(let i=0;i<=parts;i++){const x=x1+dx*i,z=z1+dz*i;box(p,.095,.66,.095,x,.43,z,C.wood);}
 for(let i=0;i<parts;i++){const x=x1+dx*(i+.5),z=z1+dz*(i+.5);
  const rail=box(p,Math.hypot(dx,dz),.08,.075,x,.61,z,C.lightWood);rail.rotation.y=-Math.atan2(dz,dx);
 }
}
function trainingGround(p:THREE.Object3D){
 const g=group(p,1.6,.19,6.1);
 cylinder(g,2.15,2.34,.10,0,.03,0,mat('#ab9e7e'),20);
 cylinder(g,1.91,2.03,.045,0,.10,0,mat('#b8ab8b'),20);
 const x=-1.52,z=-.8;
 cylinder(g,.17,.22,1.65,x,.95,z,C.wood,7);
 box(g,1.2,.18,.16,x,1.34,z,C.timber);box(g,.8,.15,.18,x,.92,z,C.timber);
 for(const side of [-1,1])sphere(g,.14,x+side*.55,1.32,z,mat('#c5ae8e'));
 // wooden sword stand and stone weights
 for(const j of [-1,1])box(g,.10,1.23,.10,1.20,.65,j*.42,C.wood);
 box(g,.11,.10,.98,1.20,1.12,0,C.wood);
 for(let i=0;i<3;i++){const sword=box(g,.06,1.12,.10,1.22+i*.13,.57,-.30+i*.28,C.lightWood);sword.rotation.z=-.10;}
 for(const i of [0,1]){const st=rock(g,-1.25+i*.55,1.0,.26);st.scale.y=.40;}
 return g;
}
function bridge(p:THREE.Object3D){
 const g=group(p,8.35,.17,2.2);
 for(let i=0;i<16;i++){
  const x=-2.12+i*.29,y=.37+.25*(1-Math.pow(x/2.42,2));
  box(g,.27,.14,1.62,x,y,0,i%2?C.wood:C.lightWood);
 }
 for(const s of [-1,1]){
  for(let i=0;i<5;i++)box(g,.10,.86,.10,-2+i*1.05,.89,s*.76,C.timber);
  box(g,4.65,.12,.12,0,1.36,s*.76,C.lightWood);
 }
 return g;
}
function gardenHerbs(p:THREE.Object3D){
 box(p,4.5,.07,3.0,-10.4,.20,5.7,C.soil);
 for(let i=0;i<6;i++)for(let j=0;j<5;j++){
  const x=-12.2+i*.63,z=4.6+j*.53;
  cylinder(p,.045,.06,.40,x,.39,z,C.bamboo,5);
  for(let k=0;k<3;k++){const leaf=sphere(p,.19,x+Math.cos(k*2.1)*.18,.50+random(k+x)*.12,z+Math.sin(k*2.1)*.18,i%2?C.bambooLight:C.bambooDark);leaf.scale.y=.3;}
 }
 fence(p,-12.8,7.37,-8.5,7.37,9);
}
function archedGate(p:THREE.Object3D){
 const g=group(p,13.3,.20,2.1);for(const s of [-1,1])box(g,.28,2.9,.28,0,1.5,s*1.5,C.wood);
 box(g,.28,.22,4.1,0,3.02,0,C.wood);box(g,.45,.21,4.55,0,3.35,0,C.tile);
 for(let i=0;i<3;i++)rock(g,.65,3.0+i*.28,.21,.6);
}
function endingBuilding(p:THREE.Object3D,kind:'host'|'observe',emissive:THREE.MeshStandardMaterial[]){
 const g=group(p,kind==='host'?4.25:12.3,.17,kind==='host'?8.6:-.9);
 if(kind==='host'){
  box(g,3.55,.22,2.65,0,.10,0,C.bank);
  box(g,2.9,1.65,2.2,0,.95,0,C.plaster);
  for(const x of [-1.2,1.2])box(g,.13,1.8,.13,x,.95,1.06,C.wood);
  tileRoof(g,3.2,2.45,1.79,.72,C.darkTile);
  box(g,.85,1.20,.14,0,.71,1.17,C.timber);
  for(let i=0;i<3;i++)box(g,.08,.88,.08,-.8+i*.7,.74,1.2,C.lightWood);
  lantern(g,-1.25,1.67,1.45,emissive);
  // A small pair of crossed training sticks tells the story without a text label.
  const a=box(g,.07,1.5,.07,1.6,.8,1.35,C.lightWood);a.rotation.z=.45;
  const b=box(g,.07,1.5,.07,1.6,.8,1.35,C.lightWood);b.rotation.z=-.45;
 }else{
  box(g,3.7,.15,3.0,0,.09,0,C.bank);
  for(const x of [-1.55,1.55])for(const z of [-1.15,1.15])box(g,.16,2.15,.16,x,1.15,z,C.wood);
  tileRoof(g,3.9,3.3,2.28,.8,C.tile);
  box(g,2.3,.12,.68,0,.94,0,C.wood);
  for(const s of [-1,1])box(g,.11,.65,.11,s*.82,.59,.1,C.lightWood);
  for(let i=0;i<3;i++){sphere(g,.26,(i-1)*.72,.58,.23,C.ceramic);}
  lantern(g,-1.62,1.68,1.42,emissive);
 }
 return g;
}
export interface VillageGraphics{root:THREE.Group;buildingTargets:THREE.Group[];batchStats:BatchStats;riverAt(u:number):THREE.Vector3;riverSurfaceY:number;updateStory(state:WorldState):void;animate(t:number,daylight:number):void;}
export function buildVillage(scene:THREE.Scene):VillageGraphics{
 const root=group(scene,0,0,0);const windows:THREE.MeshStandardMaterial[]=[],emissive:THREE.MeshStandardMaterial[]=[],bambooGroups:THREE.Group[]=[],swing:THREE.Group[]=[];
 const edge:[number,number][]=[];
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2,r=1+.032*Math.sin(i*2.9)+.020*Math.cos(i*5.8);edge.push([Math.cos(a)*16.8*r,Math.sin(a)*12.2*r]);}
 const shape=new THREE.Shape();shape.moveTo(...edge[0]);for(let i=1;i<edge.length;i++)shape.lineTo(...edge[i]);shape.closePath();
 const dirt=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1.75,bevelEnabled:true,bevelThickness:.28,bevelSize:.34,bevelSegments:2,steps:1}),[mat('#8b7663'),mat('#716150')]);
 dirt.rotation.x=Math.PI/2;dirt.position.y=.02;dirt.castShadow=true;dirt.receiveShadow=true;root.add(dirt);
 const turfMaterial=new THREE.MeshStandardMaterial({color:'#8baa79',side:THREE.DoubleSide});
 const turf=new THREE.Mesh(new THREE.ShapeGeometry(shape),turfMaterial);turf.rotation.x=Math.PI/2;turf.position.y=.17;turf.receiveShadow=true;root.add(turf);
 // Terraced mountain silhouettes along the rear rim, away from the camera-facing tavern.
 for(let i=0;i<13;i++){
  const x=-14.3+i*2.02,z=-9.7-random(i*7)*.42;
  if(x>5.8&&x<10.4)continue;
  const h=1.0+random(i+30)*2.6;const m=sphere(root,1.2+random(i)*.7,x,h*.50+.08,z,mat(i%3?'#84928a':'#a0a297'));
  m.scale.set(.8,h/1.9,1.4);
 }
 // A readable watercourse with bank slopes, stones, and real under-bridge continuity.
 const riverArt=buildRiverArt(root);
 const pathMat=new THREE.MeshStandardMaterial({color:'#c4b396',side:THREE.DoubleSide});
 const routes:[number,number][][]=[
  [[-12,-5],[-9,-3.9],[-6,-2.7],[-4,2.7],[-3,3.2],[-1,3.1],[3,2.2],[6.3,2.2],[8.3,2.2],[11.2,2.2],[15.9,2.2]],
  [[-2.6,3.0],[-.2,4.5],[1.6,6.1],[4.1,8.5]],
  [[-6.8,-3.0],[-9.2,1.1],[-10.7,5.8]],
  [[-4.1,3.0],[-5.9,5.1],[-9.3,4.0]],
  [[-2,2.8],[1,-2.0],[3.4,-5.5]],
  [[-4.4,-.3],[-5.3,-4],[-8.8,-5.3]]
 ];
 routes.forEach((points,i)=>ribbon(root,points,i===0?1.08:.72,pathMat,.26));
 bridge(root);archedGate(root);
 // Village structures orbit one social hub rather than a generic marketplace.
 const innModel=tavern(root,windows,emissive,swing);innModel.userData.buildingId='inn-001';
 const homeModel=home(root,-9,-5.5,2.85,2.4,1.86,0,windows,emissive);homeModel.userData.buildingId='home-001';
 home(root,-9.8,3.1,2.8,2.5,1.95,2,windows,emissive);
 home(root,3.4,-5.6,3.15,2.6,2.12,1,windows,emissive);
 home(root,-.7,-7.9,2.5,2.2,1.68,3,windows,emissive);
 home(root,-11.6,-.4,2.4,2.1,1.70,0,windows,emissive);
 gardenHerbs(root);const yardModel=trainingGround(root);yardModel.userData.buildingId='yard-001';
 // Old wine well, tea baskets and drying poles.
 cylinder(root,.62,.66,.69,-6.4,.53,3.6,C.slate,12);
 cylinder(root,.44,.45,.07,-6.4,.90,3.6,mat('#526d70'),12);
 for(let i=0;i<3;i++){
  const x=-6.35+i*.62,z=5.8;
  cylinder(root,.32,.31,.53,x,.43,z,C.reed,9);
  sphere(root,.34,x,.73,z,mat('#718a63'));
 }
 stoneLantern(root,-5.9,3.3,emissive);stoneLantern(root,5.7,2.0,emissive);
 fence(root,-11.8,-7.4,-7.2,-7.4,8);
 for(const [x,z,s] of [[-14,-6,1],[-13,8,1.2],[-6,8.7,1.12],[4.7,10.2,.8],[11.3,-7,1.0],[14.5,7,1.25],[5.3,-8.3,1.0]] as const)pine(root,x,z,s);
 for(const [x,z,s] of [[-13.8,3.1,1.12],[-13.2,5.4,.95],[-7,8.0,1.08],[-4.2,8.8,1.12],[-1.3,9.6,1.0],[5.3,10.1,.76],[12,8.4,1.1],[14.5,4.8,1.05],[13,-5.8,.85],[10.5,-8.8,.88]] as const)bamboo(root,x,z,s,bambooGroups);
 // Scattered tiny shrubs/rocks, avoiding the walkable central village and both riversides.
 for(let i=0;i<125;i++){
  const x=(random(i*13+2)-.5)*31,z=(random(i*37+7)-.5)*21;
  if(x*x/(16*16)+z*z/(11.6*11.6)>.86||x>7&&x<10||x>-7&&x<6&&z>-7&&z<9||x<-8&&z>3&&z<8)continue;
  if(i%3===0)rock(root,x,z,.13+random(i)*.28,.48);
  else{const leaf=sphere(root,.22,x,.30,z,i%3?C.bambooLight:C.bambooDark);leaf.scale.y=.35;}
 }
 // Seasonal props are physical scene geometry, not a full-screen color filter.
 const winterTrim=group(root,0,0,0);
 const frost=mat('#d7e6dc');
 box(winterTrim,3.45,.055,.18,-3.4,5.81,-.52,frost);
 box(winterTrim,2.3,.052,.17,-9,3.03,-5.5,frost);
 box(winterTrim,2.35,.052,.17,-9.8,3.09,3.1,frost);
 for(const [x,z] of [[-13.0,-4.2],[-12.7,1.9],[.4,-8.7],[3.3,9.3],[11.8,5.1]] as const){
  const patch=sphere(winterTrim,.52,x,.225,z,frost);patch.scale.set(1,.07,.76);
 }
 const puddles=group(root,0,0,0),wet=mat('#7b9a96',.32);
 for(const [x,z,size] of [[-5.2,4.1,.8],[-1.3,4.1,.5],[-7.2,-2.1,.7],[4.5,3.5,.6]] as const){
  const pool=cylinder(puddles,size,size*.85,.015,x,.283,z,wet,12);pool.scale.z=.48;
 }
 const palettes={
  spring:{grass:'#89b58e',bamboo:'#5e976c',light:'#a2c58a',dark:'#4c815b',water:'#79b8ac',path:'#c9b79a'},
  summer:{grass:'#629962',bamboo:'#3d7851',light:'#75ac68',dark:'#315e42',water:'#6da4a3',path:'#ceb895'},
  autumn:{grass:'#c1a66b',bamboo:'#bc944e',light:'#d5b46a',dark:'#977248',water:'#91a4a0',path:'#b99a77'},
  winter:{grass:'#a1b4ae',bamboo:'#738a83',light:'#9aafa5',dark:'#58736e',water:'#9ac0be',path:'#b5aea0'}
 } as const;
 buildVillageWorkplaces(root);
 // Bake static geometry within each existing scene/picking/animated group.
 const batchStats=batchStaticSubtree(root);
 const seasonalArt=createSeasonalArt(root);
 const weatherArt=createWeatherArt(root,typeof window!=='undefined'&&window.innerWidth<760,
  typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const buildingRenderer=makeBuildingRenderer(root);
 const legacyHost=endingBuilding(root,'host',emissive);
 const legacyObserve=endingBuilding(root,'observe',emissive);
 let lastStage='';
 return {root,batchStats,riverAt:u=>riverArt.pointAt(u),riverSurfaceY:riverArt.getSurfaceHeight(),buildingTargets:[innModel,homeModel,yardModel,...buildingRenderer.targets],
  updateStory(s:WorldState){
   buildingRenderer.update(s.buildings);
   const calendar=getCalendar(s),weather=getWeather(s);
   const id=`${s.storyStage}/${s.choice}/${calendar.season}/${weather}`;
   if(lastStage===id)return;lastStage=id;
   const palette=palettes[calendar.season];
   turfMaterial.color.set(palette.grass);C.bamboo.color.set(palette.bamboo);
   C.bambooLight.color.set(palette.light);C.bambooDark.color.set(palette.dark);
   riverArt.setSeason(calendar.season);pathMat.color.set(palette.path);
   seasonalArt.setSeason(calendar.season);weatherArt.setWeather(weather);
   winterTrim.visible=calendar.season==='winter';
   puddles.visible=weather==='rain';
   if(scene.fog instanceof THREE.FogExp2)scene.fog.density=weather==='fog'?.018:weather==='rain'?.0095:.0075;
   legacyHost.visible=s.storyStage==='legacy'&&s.choice==='host';
   legacyObserve.visible=s.storyStage==='legacy'&&s.choice==='observe';
  },
  animate(t:number,daylight:number){
   const night=daylight<.42?1.4:.18;
   for(const m of windows)m.emissiveIntensity=night*.65;
   for(const m of emissive)m.emissiveIntensity=night;
   riverArt.animate(t);
   seasonalArt.animate(t);weatherArt.animate(t);
   for(let i=0;i<bambooGroups.length;i++)bambooGroups[i].rotation.z=Math.sin(t*.6+i*2.2)*.012;
   for(let i=0;i<swing.length;i++)swing[i].rotation.z=Math.sin(t*.65+i)*.025;
  }
 };
}
