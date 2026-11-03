import * as THREE from 'three';
import {buildCarvedTerrain} from './carvedTerrain.ts';
import {buildRiverArt} from './riverArt.ts';
import {fallingRainY,rainSegmentY} from './weatherMotion.ts';
import {VALLEY_PINES,VALLEY_BAMBOO} from '../simulation/valleyGeography.ts';
import {getPioneerCalendar,getPioneerWeather,type PioneerWorld,type PioneerFounder,
 type PioneerBuildKind} from '../simulation/pioneerWorld.ts';
import {samplePioneerWalk,roadGeometrySignature,type PioneerRoad} from '../simulation/pioneerPaths.ts';
import {buildMountainRoof} from './villageBuildings.ts';
import type {VillageParcel} from '../simulation/villagePlanning.ts';

const material=(color:string,emissive?:string)=>new THREE.MeshStandardMaterial({
 color,roughness:.92,...(emissive?{emissive,emissiveIntensity:.35}:{})
});
const wood=material('#86674b'),lightWood=material('#b38b64');
const stone=material('#92998d'),bark=material('#6e6451');
const thatch=material('#b7a26c'),thatchBright=material('#d3c28a');
const cloth=material('#b3a68b'),grass=material('#8eae7d');
const boxGeo=new THREE.BoxGeometry(1,1,1);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,7);
const headGeo=new THREE.IcosahedronGeometry(1,1);
function group(parent:THREE.Object3D,x=0,y=0,z=0){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;
}
function box(parent:THREE.Object3D,x:number,y:number,z:number,
 w:number,h:number,d:number,m:THREE.Material){
 const mesh=new THREE.Mesh(boxGeo,m);mesh.position.set(x,y,z);
 mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 return mesh;
}
function pole(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,m=wood){
 const mesh=new THREE.Mesh(cylinderGeo,m);mesh.position.set(x,y,z);
 mesh.scale.set(r,h,r);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function orb(parent:THREE.Object3D,x:number,y:number,z:number,
 r:number,m:THREE.Material,sx=1,sy=1,sz=1){
 const mesh=new THREE.Mesh(headGeo,m);mesh.position.set(x,y,z);
 mesh.scale.set(r*sx,r*sy,r*sz);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function vegetation(root:THREE.Group){
 const trunk=material('#6d735c'),pine=material('#5b8771'),pineLight=material('#83a283');
 for(const [x,z,s] of VALLEY_PINES){
  const g=group(root,x,.18,z);
  pole(g,0,.98*s,0,.12*s,2.0*s,trunk);
  for(let i=0;i<3;i++){
   const cone=new THREE.Mesh(new THREE.ConeGeometry((1.1-i*.17)*s,1.55*s,7),
    i===1?pineLight:pine);
   cone.position.y=(1.30+i*.69)*s;cone.castShadow=true;g.add(cone);
  }
 }
 for(const [x,z,s] of VALLEY_BAMBOO){
  const g=group(root,x,.17,z);
  for(let i=0;i<5;i++){
   const a=i*2.399,ox=Math.cos(a)*.26*s,oz=Math.sin(a)*.26*s;
   pole(g,ox,1.32*s,oz,.044*s,2.6*s,material('#759b77'));
   for(let k=0;k<3;k++){
    const leaf=orb(g,ox+.22*Math.cos(k*2.2),(.8+k*.66)*s,
      oz+.22*Math.sin(k*2.2),.26*s,material('#7ea585'),1.6,.28,.55);
    leaf.rotation.y=k*2.2;
   }
  }
 }
}
function resourceLandmarks(root:THREE.Group,s:PioneerWorld){
 for(const site of s.sites){
  const g=group(root,site.x,.18,site.z);g.name='resource-'+site.id;
  if(site.kind==='forest'){
   for(let i=0;i<5;i++){
    const log=box(g,(i%3-1)*.28,.13+(i>2?.23:0),Math.floor(i/3)*.3,
      .22,.20,.9,wood);log.rotation.y=.16;
   }
   orb(g,-.7,.3,-.4,.50,material('#627f58'),1.5,.72,1.0);
  }else if(site.kind==='forage'){
   for(let i=0;i<4;i++){
    orb(g,(i%2-.5)*.8,.30,Math.floor(i/2)*.6,.38,material('#6f9463'),1.2,.75,1.0);
    for(let n=0;n<3;n++)orb(g,(i%2-.5)*.8+(n-1)*.19,.51,
     Math.floor(i/2)*.6,.075,material('#c37d56'));
   }
  }else{
   for(let i=0;i<5;i++)orb(g,(i-2)*.30,.15,.3+(i%2)*.20,.25,stone,1.1,.43,.9);
   const vessel=pole(g,-.30,.42,-.4,.19,.48,material('#b08f76'));
   vessel.name='water-jar';
  }
 }
}
function campVisual(root:THREE.Group,s:PioneerWorld){
 const g=group(root,s.camp.x,.19,s.camp.z);g.name='pioneer-temporary-camp';
 const pad=new THREE.Mesh(new THREE.CircleGeometry(1.05,22),
  new THREE.MeshStandardMaterial({color:'#b8aa82',side:THREE.DoubleSide}));
 pad.rotation.x=-Math.PI/2;pad.position.y=.018;pad.scale.set(1.2,.85,1);g.add(pad);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;orb(g,Math.cos(a)*.4,.08,Math.sin(a)*.4,.16,stone,1.2,.60,.80);
 }
 for(const sign of [-1,1]){
  const log=box(g,sign*.23,.16,0,.13,.14,.78,wood);log.rotation.y=sign*.65;
 }
 const fire=orb(g,0,.35,0,.25,material('#ffc265','#ed6b32'),.75,1.6,.74);
 fire.name='campfire-flame';
 const ember=orb(g,0,.16,0,.20,material('#d76335','#ff994d'),1,.35,1);
 ember.name='campfire-ember';
 for(const [x,z,angle] of [[-.95,.35,-.3],[.90,.30,.4],[0,1.03,0]]){
  const bed=box(g,x,.07,z,.83,.11,.43,cloth);bed.rotation.y=angle;
  box(g,x,.12,z-.22,.24,.16,.16,lightWood).rotation.y=angle;
 }
 const supplies=group(g,-1.28,.05,-1.12);supplies.name='camp-supplies';
 const basket=pole(supplies,0,.22,0,.29,.42,material('#9c815f'));
 basket.name='rations-basket';
 for(let i=0;i<4;i++)orb(supplies,(i%2-.5)*.25,.49,
  Math.floor(i/2)*.19-.15,.12,material('#d2af68'));
 return {root:g,fire,supplies};
}
function shelterVisual(root:THREE.Group,parcel:VillageParcel,phase:'foundation'|'frame'|'complete',
 progress:number){
 const g=group(root,parcel.x,.18,parcel.z);g.rotation.y=parcel.rotation;
 g.name=phase==='complete'?'pioneer-occupied-shelter':'pioneer-construction';
 g.userData.buildingId=parcel.id;
 // Maximal roof and porch projection remains inside the reserved SAT footprint.
 const plinth=box(g,0,.12,0,2.30,.20,2.02,material('#a59a80'));
 if(phase==='foundation'){
  for(const [x,z] of [[-1,-.84],[1,-.84],[-1,.84],[1,.84]]){
   box(g,x,.19,z,.21,.24,.22,stone);
  }
  for(let i=0;i<Math.max(1,Math.floor(progress*4));i++)
   box(g,-.75+i*.50,.29,-.1,.11,.09,1.85,lightWood);
  return g;
 }
 for(const x of [-.99,.99])for(const z of [-.84,.84])
  pole(g,x,1.15,z,.10,1.93,wood);
 for(const z of [-.84,.84])box(g,0,2.12,z,2.25,.16,.15,lightWood);
 for(const x of [-.99,.99])box(g,x,2.1,0,.13,.15,1.85,lightWood);
 const beam=box(g,0,2.43,0,.16,.15,2.38,lightWood);beam.name='roof-ridge';
 const roofCount=phase==='complete'?2:Math.min(2,Math.floor(Math.max(0,progress-.32)*3));
 for(let i=0;i<roofCount;i++){
  const sign=i===0?-1:1;
  const roof=box(g,sign*.61,2.13,0,1.46,.16,2.28,thatch);
  roof.rotation.z=sign*.43;
  for(let j=0;j<5;j++){
   const reed=box(g,sign*(.27+j*.21),2.38-(j*.09),0,.024,.025,2.30,thatchBright);
   reed.rotation.z=sign*.43;
  }
 }
 if(phase==='complete'){
  for(const x of [-.99,.99])box(g,x,.90,-.84,.10,1.25,.08,wood);
  box(g,0,.67,-.84,1.86,1.10,.08,
   new THREE.MeshStandardMaterial({color:'#bcb08d',transparent:true,opacity:.88,side:THREE.DoubleSide}));
  const entrance=box(g,0,.58,.88,.93,.83,.07,material('#9b7956'));
  entrance.name='shelter-entrance';
  box(g,0,.27,1.24,1.15,.16,.45,stone);
  for(const x of [-.72,.72])
   orb(g,x,.24,1.45,.22,material('#88a36c'),1,.55,1);
  const lamp=orb(g,-.73,1.62,1.02,.16,
   material('#f1d59a','#d49b5d'),.8,1.15,.8);lamp.name='shelter-lantern';
 }
 plinth.name='shelter-plinth';
 return g;
}
interface Figure{root:THREE.Group;arms:THREE.Mesh[];legs:THREE.Mesh[];head:THREE.Mesh;tool:THREE.Group;}
function makeFigure(parent:THREE.Group,founder:PioneerFounder):Figure{
 const g=group(parent,0,.19,0);g.name='pioneer-'+founder.id;
 g.userData.founderId=founder.id;
 const outfit=material(founder.color),skin=material('#dbb898');
 const dark=material('#463f36');
 pole(g,0,.76,0,.26,.87,outfit);
 const head=orb(g,0,1.48,0,.26,skin);
 orb(g,0,1.65,-.04,.27,dark,1,.42,1);
 const arms:THREE.Mesh[]=[],legs:THREE.Mesh[]=[];
 for(const sign of [-1,1]){
  const arm=box(g,sign*.34,.96,0,.17,.65,.18,outfit);
  arms.push(arm);
  const leg=box(g,sign*.14,.29,0,.18,.56,.20,dark);legs.push(leg);
 }
 if(founder.id===1){
  const brim=orb(g,0,1.71,0,.36,material('#7e795a'),1,.18,1);
  brim.name='woodcutter-hat';
 }else if(founder.id===2){
  box(g,0,.77,.19,.44,.55,.08,cloth);
  const band=box(g,0,1.65,.20,.28,.10,.12,material('#cfb392'));band.name='head-band';
 }else{
  orb(g,0,1.60,-.22,.23,material('#564d3b'),.9,.70,.90);
 }
 const tool=group(g,0,0,0);tool.name='occupational-gear';
 return {root:g,arms,legs,head,tool};
}
/** The facility models share eave limits with the space planner while
 * changing the actual silhouette, not merely swapping a material. */
function facilityVisual(parent:THREE.Group,p:VillageParcel,kind:PioneerBuildKind,
 phase:'foundation'|'frame'|'complete',progress:number,condition=100){
 if(kind==='shelter')return shelterVisual(parent,p,phase,progress);
 const g=group(parent,p.x,.18,p.z);g.rotation.y=p.rotation;
 g.name='pioneer-'+kind+'-'+phase;g.userData.buildingId=p.id;
 if(kind==='garden'){
  box(g,0,.025,0,2.22,.065,2.15,material('#947c55'));
  if(phase==='foundation')return g;
  for(let row=0;row<4;row++){
   const z=-.73+row*.49;
   box(g,0,.11,z,2.08,.14,.32,material('#785e45'));
   for(let n=0;n<7;n++){
    const x=-.91+n*.30;
    const sprout=orb(g,x,.27+(phase==='complete'?.10:0),z,.10,
     material(row%2?'#75a46d':'#91af6b'),.78,
     phase==='complete'?1.65:.8,.68);
    sprout.rotation.y=n;
   }
  }
  if(phase==='complete'){
   for(const x of [-1.14,1.14])for(const z of [-1.11,1.11])
    pole(g,x,.36,z,.045,.50,wood);
   for(const z of [-1.11,1.11])box(g,0,.52,z,2.40,.07,.08,lightWood);
   box(g,1.15,.37,0,.07,.06,2.3,lightWood);
  }
  return g;
 }
 const cottage=kind==='cottage';
 const w=cottage?2.64:2.38,d=cottage?2.50:2.31,h=cottage?1.68:1.57;
 box(g,0,.12,0,w+.06,.19,d+.03,material('#aba18c'));
 if(phase==='foundation')return g;
 for(const x of [-w/2+.14,w/2-.14])for(const z of [-d/2+.14,d/2-.14])
  pole(g,x,h/2+.21,z,.09,h,wood);
 if(cottage){
  box(g,0,h*.49+.22,-d*.43,w-.34,h*.77,.12,material('#dfcbb0'));
  for(const x of [-w*.45,w*.45])box(g,x,h*.52+.21,0,.10,h*.74,d-.22,wood);
  if(phase==='complete'){
   const door=box(g,0,.84,d*.50,.66,1.29,.12,material('#956b52'));
   door.name='cottage-door';
   for(const x of [-.95,.95]){
    box(g,x,1.05,d*.505,.37,.45,.06,material('#dfcfab'));
    box(g,x,1.06,d*.56,.04,.50,.07,wood);
    box(g,x,1.06,d*.56,.40,.05,.07,wood);
   }
   box(g,0,.25,d/2+.25,1.08,.15,.45,stone);
  }
 }else{
  // An open-air woodworking shelter: stacked lumber, workbench, red-brown
  // awning and sparse frame, unlike a second copy of the dwelling.
  box(g,0,.77,-.48,1.70,.12,.73,lightWood);
  for(let n=0;n<5;n++)box(g,-.58+n*.26,.35,0,.18,.18,1.72,
   n%2?wood:lightWood);
  if(phase==='complete'){
   box(g,.62,.89,.31,.55,.18,.53,material('#a47d5a'));
   const saw=box(g,.68,1.07,.30,.08,.06,.42,stone);saw.rotation.z=.55;
  }
 }
 if(phase==='frame'){
  for(const z of [-d*.42,d*.42])box(g,0,h+.21,z,w,.12,.13,wood);
  return g;
 }
 const roof=material(cottage?'#6e7774':'#8f8271');
 buildMountainRoof(g,{width:w-.10,depth:d-.16,eave:h+.29,rise:cottage?.59:.39,
  style:cottage?'cottage':'workshop',material:roof});
 if(condition<78){
  // Worn roofs reveal genuine repair history; repaired structures regain
  // a clean silhouette after the simulation transaction finishes.
  const patch=box(g,.30,h+.50,.33,.65,.035,.50,material('#c8b58a'));
  patch.rotation.z=.31;
 }
 return g;
}
function drawFootpaths(parent:THREE.Group,roads:readonly PioneerRoad[]){
 const root=group(parent);root.name='resident-made-paths';
 const pathMat=material('#bdad87'),dirtMat=material('#ae9475');
 for(const road of roads){
  const g=group(root);g.name='path-'+road.buildingId;
  const points=road.points;
  if(points.length<2)continue;
  const verts:number[]=[],tri:number[]=[];
  const width=road.grade==='dirt'?.56:.31;
  for(let i=0;i<points.length;i++){
   const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
   const dx=after[0]-before[0],dz=after[1]-before[1],len=Math.hypot(dx,dz)||1;
   const nx=-dz/len*width/2,nz=dx/len*width/2;
   verts.push(p[0]+nx,.205,p[1]+nz,p[0]-nx,.205,p[1]-nz);
   if(i>0){const k=i*2;tri.push(k-2,k-1,k,k,k-1,k+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(tri);geo.computeVertexNormals();
  const path=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
   color:road.grade==='dirt'?dirtMat.color:pathMat.color,
   roughness:1,side:THREE.DoubleSide,transparent:true,
   opacity:road.grade==='dirt'?.95:.68,depthWrite:true}));
  path.name='resident-walkable-road';path.receiveShadow=true;g.add(path);
 }
 return root;
}
export interface PioneerGraphics{
 root:THREE.Group;update(s:PioneerWorld,seconds:number):void;
 signatures():{buildings:number;renderedStructures:number;phase:string;people:number};
}
export function buildPioneerVillage(scene:THREE.Scene,world:PioneerWorld):PioneerGraphics{
 const root=group(scene);root.name='pioneer-valley-no-prebuilt-village';
 const edge:[number,number][]=[];
 for(let i=0;i<48;i++){
  const a=i/48*Math.PI*2,r=1+.032*Math.sin(i*2.9)+.020*Math.cos(i*5.8);
  edge.push([Math.cos(a)*16.8*r,Math.sin(a)*12.2*r]);
 }
 const shape=new THREE.Shape();shape.moveTo(...edge[0]);
 for(let i=1;i<edge.length;i++)shape.lineTo(...edge[i]);shape.closePath();
 const cliffGeometry=new THREE.ExtrudeGeometry(shape,{depth:1.75,
  bevelEnabled:true,bevelThickness:.28,bevelSize:.34,bevelSegments:2,steps:1});
 const sides=cliffGeometry.groups.filter(g=>g.materialIndex===1);
 cliffGeometry.clearGroups();for(const side of sides)cliffGeometry.addGroup(side.start,side.count,1);
 const cliff=new THREE.Mesh(cliffGeometry,[material('#8b7663'),material('#716150')]);
 cliff.rotation.x=Math.PI/2;cliff.position.y=-.09;
 cliff.receiveShadow=true;root.add(cliff);
 root.add(buildCarvedTerrain(edge,grass));
 const river=buildRiverArt(root);vegetation(root);resourceLandmarks(root,world);
 const camp=campVisual(root,world);
 const constructionLayer=group(root);constructionLayer.name='actual-settlement-registry';
 let roadLayer=drawFootpaths(root,world.roads);
 let lastRoads=roadGeometrySignature(world.roads);
 const people=world.founders.map(f=>makeFigure(root,f));
 const rainGeo=new THREE.BufferGeometry(),rainVertices=new Float32Array(270*6);
 const rainSeed=new Float32Array(270*3);
 for(let i=0;i<270;i++){
  rainSeed[3*i]=-15.1+hashFloat(i*19)*30.2;
  rainSeed[3*i+1]=.6+hashFloat(i*23+11)*9.4;
  rainSeed[3*i+2]=-10.1+hashFloat(i*31+7)*20.2;
 }
 rainGeo.setAttribute('position',new THREE.BufferAttribute(rainVertices,3).setUsage(THREE.DynamicDrawUsage));
 const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({
  color:'#c7dee2',transparent:true,opacity:.42,depthWrite:false}));
 rain.frustumCulled=false;root.add(rain);
 let lastBuildSig='',lastSeason='',lastProgressIndex=-1,renderedStructures=0;
 let latestWorld=world;
 function update(s:PioneerWorld,seconds:number){
  latestWorld=s;
  const phase=s.intent?.phase??'none';
  const progress=s.intent?.workDone??0;
  const progressIndex=Math.floor(progress*2);
  const signature=s.buildings.map(b=>b.id+':'+((b.condition??100)<78?'w':'c')).join(',')+
   '/'+(s.intent?.id??'')+'/'+phase+'/'+(s.intent?.parcel?.x??'')+'/'+
   (s.intent?.parcel?.z??'');
  if(signature!==lastBuildSig||progressIndex!==lastProgressIndex){
   while(constructionLayer.children.length){
    const old=constructionLayer.children[0];constructionLayer.remove(old);
   }
   for(const built of s.buildings)
    facilityVisual(constructionLayer,built.parcel,built.kind,'complete',1,built.condition);
   if(s.intent?.parcel&&s.intent.phase!=='survey'&&s.intent.phase!=='materials'){
    if(s.intent.kind==='repair'){
     const p=s.intent.parcel,g=group(constructionLayer,p.x,.19,p.z);
     g.rotation.y=p.rotation;g.name='pioneer-repair-scaffold';
     for(const x of [-p.width*.41,p.width*.41])for(const z of [-p.depth*.43,p.depth*.43])
      pole(g,x,.9,z,.04,1.72,lightWood);
     box(g,0,1.68,0,p.width*.88,.07,.12,lightWood);
    }else facilityVisual(constructionLayer,s.intent.parcel,s.intent.kind??'shelter',
      s.intent.phase,Math.min(1,progress/s.intent.workRequired));
   }
   renderedStructures=constructionLayer.children.length;
   lastBuildSig=signature;lastProgressIndex=progressIndex;
  }
  const roadSignature=roadGeometrySignature(s.roads);
  if(roadSignature!==lastRoads){
   root.remove(roadLayer);roadLayer=drawFootpaths(root,s.roads);lastRoads=roadSignature;
  }
  while(people.length<s.founders.length)people.push(makeFigure(root,s.founders[people.length]));
  const season=getPioneerCalendar(s).season;
  const weather=getPioneerWeather(s);
  if(lastSeason!==season){
   lastSeason=season;river.setSeason(season);
   grass.color.set({spring:'#8eae7d',summer:'#79a270',
    autumn:'#c4b07d',winter:'#c8d0bc'}[season]);
  }
  rain.visible=weather==='rain';
  if(rain.visible){
   for(let i=0;i<270;i++){
    const y=fallingRainY(rainSeed[3*i+1],seconds,6.2);
    const [head,tail]=rainSegmentY(y),idx=i*6;
    rainVertices.set([rainSeed[3*i],head,rainSeed[3*i+2],
     rainSeed[3*i]-.06,tail,rainSeed[3*i+2]+.02],idx);
   }
   (rainGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
  }
  const dayHour=getPioneerCalendar(s).hour;
  const flame=camp.fire;
  flame.scale.y=.30+Math.abs(Math.sin(seconds*6))*.16;
  flame.visible=!(weather==='rain'&&s.resources.wood<=0);
  camp.supplies.scale.setScalar(.84+Math.min(1,s.resources.food/14)*.2);
  people.forEach((visual,i)=>{
   const f=s.founders[i],night=dayHour>=20||dayHour<7;
   const path=f.commute?.length?f.commute:[[s.camp.x,s.camp.z],[f.target[0],f.target[1]]];
   const phaseHour=(s.minutes%60)/60;
   // Walk the actual saved route, including bends around houses and riverbank.
   const along=night?1:phaseHour<.27?phaseHour/.27:
    phaseHour>.78?(1-phaseHour)/.22:1;
   const t=Math.max(0,Math.min(1,along));
   const [x,z]=samplePioneerWalk(path,t);
   const ahead=samplePioneerWalk(path,Math.min(1,t+.035));
   const moving=!night&&(phaseHour<.27||phaseHour>.78)&&path.length>1;
   const bob=moving?Math.abs(Math.sin(seconds*7+i))*.045:0;
   visual.root.position.set(x,.19+bob,z);
   const heading=Math.atan2(ahead[0]-x,ahead[1]-z);
   if(Number.isFinite(heading)&&moving)visual.root.rotation.y=heading;
   const swing=moving?Math.sin(seconds*9+i)*.35:.04*Math.sin(seconds*2+i);
   visual.arms[0].rotation.x=swing;visual.arms[1].rotation.x=-swing;
   visual.legs[0].rotation.x=-swing;visual.legs[1].rotation.x=swing;
   visual.root.scale.setScalar(i<3?1:.95);
   if((f.activity==='build'||f.activity==='repair')&&!moving){
    const effort=Math.sin(seconds*5+i)*.20;
    visual.arms[0].rotation.x=-.72+effort;visual.arms[1].rotation.x=-.72-effort;
   }else if((f.activity==='forage'||f.activity==='farm')&&!moving){
    visual.root.position.y-=.15;visual.head.rotation.x=.12;
    visual.arms[0].rotation.x=-.55;visual.arms[1].rotation.x=-.55;
   }else visual.head.rotation.x=0;
   visual.root.visible=true;
  });
  river.animate(seconds);
 }
 update(world,0);
 return {root,update,signatures:()=>({
  buildings:latestWorld.buildings.length,renderedStructures,
  phase:latestWorld.intent?.phase??(latestWorld.buildings.length?'complete':'none'),
  people:people.length
 })};
}
function hashFloat(n:number){let k=(n+339)>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);return ((k^(k>>>13))>>>0)/4294967296;}
