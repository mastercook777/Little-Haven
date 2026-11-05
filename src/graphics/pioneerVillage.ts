import * as THREE from 'three';
import {buildCarvedTerrain} from './carvedTerrain.ts';
import {buildRiverArt} from './riverArt.ts';
import {fallingRainY,rainSegmentY} from './weatherMotion.ts';
import {VALLEY_PINES,VALLEY_BAMBOO} from '../simulation/valleyGeography.ts';
import {PIONEER_VALLEY} from '../simulation/pioneerGeography.ts';
import {getPioneerCalendar,getPioneerWeather,type PioneerWorld,type PioneerFounder,
 type PioneerBuildKind} from '../simulation/pioneerWorld.ts';
import {samplePioneerWalk,roadGeometrySignature,type PioneerRoad,type WalkPoint} from '../simulation/pioneerPaths.ts';
import {buildPioneerRoof,PIONEER_SHELTER_ROOF} from './pioneerRoof.ts';
import {buildPioneerForestArt} from './pioneerForestArt.ts';
import type {VillageParcel} from '../simulation/villagePlanning.ts';
import type {PioneerSelection} from '../ui/pioneerInspection.ts';
import {pioneerCropAppearance,pioneerVisibleWoodLogs} from '../simulation/pioneerVisibility.ts';
import {pioneerVisitorPosition} from '../simulation/pioneerCommerce.ts';

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
  if(site.kind==='field')continue; // The garden model already depicts the crop site.
  const g=group(root,site.x,.18,site.z);g.name='resource-'+site.id;
  g.userData.siteId=site.id;
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
 const g=group(root,s.camp.x,.19,s.camp.z);
 g.name='pioneer-commons-at-original-camp';
 g.userData.pioneerCamp=true;
 const stages:THREE.Group[]=[],flames:THREE.Mesh[]=[];
 // Stocked logs are a visual receipt of actual work; construction costs
 // reduce the pile because the same saved village wood pool is charged.
 const timber=group(g,1.30,.02,-1.01);timber.name='shared-timber-stock';
 const woodLogs:THREE.Mesh[]=[];
 for(let i=0;i<12;i++){
  const row=Math.floor(i/4),column=i%4;
  const log=box(timber,(column-1.5)*.21,.12+row*.155,
   (row%2)*.055,.52,.145,.145,i%3?wood:lightWood);
  log.rotation.y=row%2?-.13:.12;log.name='real-camp-wood-log';
  woodLogs.push(log);
 }
 const stageRoot=(index:number,label:string)=>{
  const parent=group(g);parent.name=label;stages[index]=parent;return parent;
 };
 const flame=(parent:THREE.Group,x:number,z:number,scale=1)=>{
  const fire=orb(parent,x,.33,z,.22*scale,material('#ffc265','#ed6b32'),.75,1.44,.74);
  fire.name='commons-hearth-flame';flames.push(fire);
  return fire;
 };
 const ringStones=(parent:THREE.Group,x:number,z:number,r=.40,count=9)=>{
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count;
   orb(parent,x+Math.cos(a)*r,.075,z+Math.sin(a)*r,.14,stone,1.2,.52,.92);
  }
 };
 const bench=(parent:THREE.Group,x:number,z:number,angle:number)=>{
  const b=group(parent,x,0,z);b.rotation.y=angle;
  box(b,0,.33,0,.82,.12,.23,lightWood);
  for(const dx of [-.27,.27])box(b,dx,.16,0,.10,.29,.15,wood);
  return b;
 };
 const pad=(parent:THREE.Group,r:number)=>{
  const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),
   new THREE.MeshStandardMaterial({color:'#afa68a',side:THREE.DoubleSide,roughness:1}));
  m.rotation.x=-Math.PI/2;m.position.y=.024;
  parent.add(m);return m;
 };
 // 0: three bedrolls are visibly temporary. No permanent construction.
 const temporary=stageRoot(0,'commons-stage-0-three-bedrolls');
 pad(temporary,1.05);ringStones(temporary,0,0,.43,8);
 for(const sign of [-1,1]){
  const log=box(temporary,sign*.23,.16,0,.13,.14,.78,wood);log.rotation.y=sign*.65;
 }
 flame(temporary,0,0,1);
 for(const [x,z,angle] of [[-.95,.35,-.3],[.90,.30,.4],[0,1.03,0]]){
  const bed=box(temporary,x,.07,z,.83,.11,.43,cloth);bed.rotation.y=angle;
  box(temporary,x,.12,z-.22,.24,.16,.16,lightWood).rotation.y=angle;
 }
 const supplies=group(temporary,-1.28,.05,-1.12);supplies.name='camp-supplies';
 pole(supplies,0,.22,0,.29,.42,material('#9c815f'));
 for(let i=0;i<4;i++)orb(supplies,(i%2-.5)*.25,.49,
  Math.floor(i/2)*.19-.15,.12,material('#d2af68'));
 // 1: old grass beds disappear; residents now have a shared stone hearth.
 const hearth=stageRoot(1,'commons-stage-1-stone-hearth');
 pad(hearth,1.20);
 ringStones(hearth,0,0,.48,12);flame(hearth,0,0,.82);
 for(const [x,z,angle] of [[-1.04,.12,Math.PI/2],[1.04,.12,Math.PI/2],[0,1.02,0]]){
  bench(hearth,x,z,angle);
 }
 box(hearth,-.87,.26,-.84,.40,.32,.42,wood);
 for(let i=0;i<3;i++)orb(hearth,-.91+i*.23,.35,-.90,.14,material('#b39166'),1,.7,1);
 // 2: functional communal kitchen with pottery, food prep and weather cover.
 const kitchen=stageRoot(2,'commons-stage-2-open-community-kitchen');
 pad(kitchen,1.35);
 for(const z of [-.42,.38]){
  box(kitchen,0,.20,z,1.45,.36,.39,stone);
 }
 const oven=box(kitchen,0,.47,-.32,1.02,.57,.66,material('#a29a89'));
 oven.name='communal-oven';ringStones(kitchen,0,-.32,.32,8);
 flame(kitchen,0,-.28,.52);
 const ironPot=pole(kitchen,0,.85,-.30,.36,.30,material('#505a53'));
 ironPot.name='community-cooking-pot';
 orb(kitchen,0,.98,-.30,.32,material('#747870'),1,.30,1);
 for(const x of [-1.13,1.13])for(const z of [-.87,.78])
  pole(kitchen,x,1.12,z,.074,1.99,wood);
 box(kitchen,0,2.12,0,2.45,.13,1.94,thatch).rotation.x=-.14;
 box(kitchen,-.80,2.19,.78,.14,.13,2.1,lightWood);
 const prep=box(kitchen,.90,.66,.78,.59,.12,.48,lightWood);
 prep.name='kitchen-prep-table';
 for(const x of [.70,.90,1.07])
  orb(kitchen,x,.77,.80,.12,material('#a48d60'),1.2,.66,.9);
 bench(kitchen,-.64,1.13,0);
 // 3: social plaza with an off-center, small ceremonial ember, notice board,
 // tables and paving, not the three-bed overnight camp.
 const plaza=stageRoot(3,'commons-stage-3-village-square');
 const pavement=pad(plaza,1.47);pavement.name='village-plaza-ground';
 for(let i=0;i<18;i++){
  const a=i*2.399,r=.53+(i%5)*.17;
  const stoneP=orb(plaza,Math.cos(a)*r,.04,Math.sin(a)*r,.19,
   i%3?stone:material('#b0a48b'),1.6,.20,1.04);
  stoneP.rotation.y=a;
 }
 ringStones(plaza,-.96,-.76,.25,8);flame(plaza,-.96,-.76,.34);
 const board=group(plaza,.92,0,-.70);
 for(const x of [-.43,.43])pole(board,x,.89,0,.073,1.63,wood);
 box(board,0,1.41,0,1.07,.73,.11,lightWood);
 box(board,0,1.41,.08,.94,.60,.04,material('#bfb492'));
 for(let i=0;i<3;i++)box(board,-.27,1.60-i*.18,.12,.43,.045,.02,wood);
 box(board,0,1.87,0,1.26,.13,.17,wood);
 for(const x of [-.62,.62])box(plaza,x,.52,.72,.66,.17,.33,lightWood);
 box(plaza,0,.66,.69,.68,.10,.46,material('#a68d63'));
 for(const [x,z] of [[-1.2,.10],[1.2,.35]])
  pole(plaza,x,.59,z,.04,.96,lightWood);
 const lantern=orb(plaza,1.2,1.04,.35,.13,material('#e5c58d','#a8734e'));
 lantern.name='village-gathering-lantern';
 // A separate scaffold is only displayed when a real material-paid job
 // is in progress. It occupies this same reserved commons plot.
 const scaffold=group(g);scaffold.name='commons-real-construction-scaffold';
 for(const x of [-1.12,1.12]){
  pole(scaffold,x,.77,-1.08,.06,1.36,lightWood);
  box(scaffold,x,.17,-1.08,.22,.22,.20,stone);
 }
 box(scaffold,0,1.42,-1.08,2.35,.13,.14,wood);
 const progress=box(scaffold,0,.11,1.18,1.28,.20,.31,lightWood);
 progress.name='commons-actual-materials';
 function setStage(index:number,building=false,percent=0){
  for(let i=0;i<stages.length;i++)stages[i].visible=i===index;
  scaffold.visible=building;
  if(building)scaffold.scale.y=.45+.55*Math.min(1,Math.max(0,percent));
 }
 setStage(s.commons.stage);
 return {root:g,flames,supplies,setStage,stages,woodLogs};
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
 // Both slopes, ridge and thatch seams share a single physically valid roof.
 // The old per-strip Y offsets were inverted relative to the rotated roof.
 const roofCount=phase==='complete'?2:
  Math.min(2,Math.floor(Math.max(0,progress-.25)*3));
 if(roofCount){
  const roof=buildPioneerRoof(g,PIONEER_SHELTER_ROOF,thatch,wood,lightWood,thatchBright);
  if(roofCount<2){
   const leaf=roof.getObjectByName('roof-right-slope');
   leaf?.parent?.remove(leaf);
   // Hide associated right-half seams/rafters until the second slope is made.
   for(const child of [...roof.children])
    if(child.position.x>.12&&child.name!=='roof-ridge')child.visible=false;
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
interface Figure{root:THREE.Group;arms:THREE.Mesh[];legs:THREE.Mesh[];head:THREE.Mesh;tool:THREE.Group;mealBowl:THREE.Group;axe:THREE.Group;cargo:THREE.Group;rod:THREE.Group;}
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
 const ladle=box(tool,.33,1.17,.23,.055,.48,.07,wood);ladle.name='cooking-ladle';
 orb(tool,.33,.95,.23,.11,stone,1,.30,1);
 tool.visible=false;
 const mealBowl=group(g,0,.74,.27);mealBowl.name='resident-meal-bowl';
 orb(mealBowl,0,0,0,.21,material('#ad9671'),1,.36,1);
 orb(mealBowl,0,.04,0,.16,material('#d6c392'),1,.12,1);
 mealBowl.visible=false;
 const axe=group(g,.35,1.12,.27);axe.name='working-forester-axe';
 pole(axe,0,0,0,.035,.60,lightWood);
 box(axe,0,-.19,.03,.13,.14,.08,stone);
 axe.visible=false;
 const cargo=group(g,0,.63,-.31);cargo.name='carried-real-wood';
 for(let i=0;i<3;i++){
  const log=pole(cargo,(i-1)*.13,0,0,.085,.68,wood);
  log.rotation.x=Math.PI/2;
 }
 cargo.visible=false;
 const fishBasket=group(g,0,.62,-.30);fishBasket.name='carried-fish-basket';
 box(fishBasket,0,0,0,.55,.32,.42,material('#9d815e'));
 for(let i=0;i<3;i++)orb(fishBasket,(i-1)*.15,.21,.01,.10,
  material('#8da8a8'),1.28,.36,.67);
 fishBasket.visible=false;
 const rod=group(g,.35,1.02,.32);rod.name='working-river-fishing-rod';
 const stem=pole(rod,0,.36,.05,.026,.96,lightWood);stem.rotation.x=-.32;
 box(rod,0,.92,.23,.016,.50,.018,cloth);
 const reel=orb(rod,-.07,.22,0,.09,wood,.45,.80,1.3);
 reel.name='fisher-reel';rod.visible=false;
 return {root:g,arms,legs,head,tool,mealBowl,axe,cargo,fishBasket,rod};
}
/** The facility models share eave limits with the space planner while
 * changing the actual silhouette, not merely swapping a material. */
function facilityVisual(parent:THREE.Group,p:VillageParcel,kind:PioneerBuildKind,
 phase:'foundation'|'frame'|'complete',progress:number,condition=100,
 seedMark?:'working'|'resolved'|'abandoned',craftReady=false,loftReady=false){
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
    sprout.name='real-garden-crop';
    sprout.userData.cropIndex=row*7+n;
   }
  }
  if(phase==='complete'){
   if(seedMark){
    // The seed bed and its hand-written plot marker exist only with
    // an actual persisted trial; neither is a free-standing ghost building.
    const label=group(g,.86,.10,.81);
    label.name='persisted-seed-trial-'+seedMark;
    pole(label,0,.37,0,.035,.64,lightWood);
    const ink=seedMark==='resolved'?material('#66865a'):
     seedMark==='working'?material('#c8b078'):material('#a08a74');
    box(label,0,.68,0,.43,.24,.055,ink);
    box(label,0,.66,.036,.24,.045,.018,thatchBright);
    if(seedMark!=='abandoned')for(let i=0;i<3;i++){
     const v=orb(g,-.84+i*.22,.39,.93,.075,
      seedMark==='resolved'?grass:material('#afbd77'),.65,1.45,.62);
     v.name='actual-seed-trial-bed';
    }
   }
   for(const x of [-1.14,1.14])for(const z of [-1.11,1.11])
    pole(g,x,.36,z,.045,.50,wood);
   for(const z of [-1.11,1.11])box(g,0,.52,z,2.40,.07,.08,lightWood);
   box(g,1.15,.37,0,.07,.06,2.3,lightWood);
  }
  return g;
 }
 if(kind==='fish-hut'){
  // Real shore fishing bay: lower piling, shaded rack, net poles, baskets.
  box(g,0,.11,0,2.52,.16,2.23,material('#a8a08b'));
  if(phase==='foundation')return g;
  for(const x of [-1.07,1.07])for(const z of [-.86,.86])
   pole(g,x,.94,z,.085,1.76,wood);
  box(g,0,1.79,0,2.48,.13,2.20,lightWood);
  const roof=material('#ad9a70');
  buildPioneerRoof(g,{halfWidth:1.34,halfDepth:1.11,eaveY:1.85,
   ridgeY:2.30,thickness:.10},roof,wood,lightWood,thatchBright);
  if(phase!=='complete')return g;
  for(const x of [-.84,-.28,.28,.84])pole(g,x,.48,-.63,.022,.58,lightWood);
  for(const z of [-.75,-.39,-.03,.33]){
   const net=box(g,0,.56,z,1.82,.025,.022,material('#bcae86'));
   net.name='real-fishing-net';
  }
  box(g,.75,.46,.70,.60,.14,.51,wood);
   const waitingFish=orb(g,.75,.59,.70,.19,material('#91a9a4'),1.4,.40,.65);
   waitingFish.name='pending-fish-basket';waitingFish.visible=false;
   for(let i=0;i<5;i++){
   const fish=orb(g,-.75+i*.20,.47,-.08,.11,
    material('#879fa0'),1.5,.33,.58);
   fish.name='visible-caught-fish';
   fish.userData.fishIndex=i;
  }
  for(const x of [-1.12,1.12])pole(g,x,.32,1.04,.045,.48,wood);
  return g;
 }
 if(kind==='granary'){
  // Raised storage house; long-use grain jars are bound to actual supplies.
  for(const x of [-.94,.94])for(const z of [-.83,.83])
   pole(g,x,.75,z,.11,1.44,wood);
  box(g,0,1.35,0,2.30,.20,2.09,stone);
  if(phase==='foundation')return g;
  for(const x of [-1.01,1.01])box(g,x,1.98,0,.16,1.22,1.92,lightWood);
  box(g,0,2.03,-.94,2.05,1.19,.14,thatch);
  box(g,0,2.48,.94,2.05,.29,.14,wood);
  box(g,0,2.60,0,2.1,.15,2.0,thatchBright);
  const roof=material('#8b8e75');
  buildPioneerRoof(g,{halfWidth:1.23,halfDepth:1.14,eaveY:2.64,
   ridgeY:3.12,thickness:.09},roof,wood,lightWood);
  if(phase==='complete'){
   for(let i=0;i<6;i++){
    const jar=orb(g,-.83+(i%3)*.83,1.60,-.58+Math.floor(i/3)*.82,
     .24,material('#b69b72'),1,.72,1);
    jar.name='stored-real-grain-jar';jar.userData.jarIndex=i;
   }
   for(let k=0;k<4;k++)box(g,0,.26+k*.25,1.17,.84,.065,.12,lightWood);
  }
  return g;
 }
 if(kind==='tea-stop'){
  // Shrunk open eaves remain entirely inside the reserved legal 2.55×2.38m footprint.
  g.scale.setScalar(.84);
  box(g,0,.09,0,2.75,.14,2.38,material('#a89d83'));
  if(phase==='foundation')return g;
  for(const x of [-1.10,1.10])for(const z of [-.96,.96])
   pole(g,x,.91,z,.082,1.70,wood);
  box(g,0,1.74,0,2.48,.12,2.30,lightWood);
  buildPioneerRoof(g,{halfWidth:1.42,halfDepth:1.23,
   eaveY:1.81,ridgeY:2.29,thickness:.10},
   material('#8b9272'),wood,lightWood,thatchBright);
  if(phase!=='complete')return g;
  box(g,-.36,.68,.22,1.36,.14,.63,lightWood);
  for(const x of [-.80,.08])pole(g,x,.35,.22,.055,.56,wood);
  box(g,-.36,.37,.71,1.10,.09,.25,wood);
  for(let i=0;i<3;i++)orb(g,-.73+i*.35,.79,.10,.11,
   material('#b5aa8c'),1,.58,1).name='roadside-tea-cup';
  orb(g,-.31,.78,.36,.19,material('#8e968d'),1,.70,1);
  pole(g,-.31,.94,.36,.06,.12,material('#b2ada0'));
  box(g,.96,.74,-.41,.42,.73,.45,wood);
  for(let k=0;k<3;k++)box(g,.96,.29+k*.18,-.29,.40,.15,.28,lightWood);
  box(g,-.92,1.33,.96,.45,.29,.07,material('#ac8a68'));
  return g;
 }
 const cottage=kind==='cottage';
 const w=cottage?2.64:2.38,d=cottage?2.50:2.31,h=cottage?1.68:1.57;
 const plaster=material('#d4c5a7');
 box(g,0,.12,0,w+.06,.19,d+.03,material('#aba18c'));
 if(phase==='foundation')return g;
 for(const x of [-w/2+.14,w/2-.14])for(const z of [-d/2+.14,d/2-.14])
  pole(g,x,h/2+.21,z,.09,h,wood);
 if(cottage){
  // +Z is the functional front door. The original model only had a back
  // wall: add physically supported side/front walls and a usable opening.
  const wall=plaster,paper=material('#e2d6ad'),door=material('#956c52');
  box(g,0,h*.48+.24,-d*.48,w-.25,h*.78,.13,wall);
  for(const x of [-w*.47,w*.47])
   box(g,x,h*.48+.24,0,.13,h*.78,d-.18,wall);
  for(const sign of [-1,1]){
   const panelWidth=(w-.73)*.5;
   const x=sign*(.37+panelWidth*.5);
   box(g,x,h*.47+.24,d*.475,panelWidth,h*.75,.13,wall);
  }
  // Full timber wall plate takes the load from the roof into the posts.
  // Avoid the prototype's floating 20cm gap between cottage walls and eaves.
  for(const z of [-d*.46,d*.46])box(g,0,h+.16,z,w*.91,.14,.14,wood);
  for(const x of [-w*.45,w*.45])box(g,x,h+.16,0,.14,.14,d*.9,wood);
  box(g,0,h-.07,d*.475,.86,.29,.14,lightWood); // lintel above door
  if(phase==='complete'){
   if(loftReady){
    // A dormer reveals the paid interior bed without expanding the
    // original SAT/eave footprint or clipping into a neighbouring lane.
    const dormer=group(g,0,2.11,.58);dormer.name='paid-residential-loft';
    box(dormer,0,.06,0,.72,.49,.18,plaster);
    box(dormer,0,.08,.107,.43,.30,.045,paper);
    for(const x of [-.22,.22])box(dormer,x,.08,.13,.036,.37,.038,wood);
    box(dormer,0,.08,.14,.47,.038,.035,lightWood);
    box(dormer,0,.34,0,.94,.10,.49,material('#697e7a')).rotation.z=.08;
   }
   const doorMesh=box(g,0,.77,d*.51,.66,1.04,.075,door);
   doorMesh.name='cottage-door';
   orb(g,.22,.78,d*.56,.035,lightWood);
   for(const x of [-.93,.93]){
    box(g,x,1.04,d*.545,.38,.46,.045,wood);
    box(g,x,1.04,d*.57,.32,.38,.035,paper);
    for(const dx of [-.10,.10])box(g,x+dx,1.04,d*.60,.022,.42,.028,lightWood);
    box(g,x,1.04,d*.60,.36,.026,.028,lightWood);
   }
   box(g,0,.25,d/2+.18,.98,.14,.26,stone);
  }
 }else{
  // A real open-air woodworking bay: four timber posts, bracing, benches,
  // lumber racks, and a worktop. No floating residential walls/door.
  for(const z of [-d*.35,d*.35]){
   const beam=box(g,0,1.42,z,w*.83,.12,.15,wood);
   beam.name='wood-yard-crossbeam';
  }
  box(g,0,.82,-.45,1.78,.12,.72,lightWood);
  for(let n=0;n<5;n++)box(g,-.58+n*.28,.34,0,.19,.18,1.65,n%2?wood:lightWood);
  if(phase==='complete'){
   const workbench=box(g,.56,1.05,.28,.67,.12,.50,lightWood);
   workbench.name='wood-yard-workbench';
   const saw=box(g,.65,1.14,.28,.05,.06,.35,stone);saw.rotation.z=.45;
   box(g,-.76,.38,-.75,.38,.64,.30,material('#ac9270'));
  }
 }
 if(phase==='frame'){
  for(const z of [-d*.42,d*.42])box(g,0,h+.21,z,w,.12,.13,wood);
  return g;
 }
 if(kind==='wood-yard'&&phase==='complete'&&craftReady){
  const bench=group(g,-.54,0,.48);bench.name='actual-crafted-sawbench';
  box(bench,0,.81,0,1.04,.13,.43,lightWood);
  for(const x of [-.37,.37])pole(bench,x,.43,0,.061,.77,wood);
  box(bench,0,1.02,-.13,.074,.42,.08,stone).rotation.z=.34;
  for(let i=0;i<3;i++)box(bench,-.29+i*.29,.43,.53,.20,.16,.68,wood);
 }
 const roof=material(cottage?'#677a77':'#9c8668');
 buildPioneerRoof(g,{
  halfWidth:(w-.10)/2+.13,halfDepth:(d-.16)/2+.10,
  eaveY:h+.29,ridgeY:h+.29+(cottage?.52:.43),thickness:.095
 },roof,wood,lightWood,cottage?undefined:thatchBright,cottage?plaster:undefined);
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
 setSelected(selection:PioneerSelection|null):void;
 signatures():{buildings:number;renderedStructures:number;phase:string;people:number;
  roads:number;commonsStage:number;commonsBeds:number;cookingActors:number;socialActors:number;
  forestTrees:number;forestStumps:number;fallingTree:boolean;clearings:number;clearedPlots:number;
   seedMarkers:number;gardenSprouts:number;campWoodLogs:number;focusedResident:boolean;
   fishCaughtProps:number;grainJars:number;sawbenches:number;fishingActors:number;loftDormers:number;
   roadsideVisitor:boolean;activeVisitorName:string|null};
}
export function buildPioneerVillage(scene:THREE.Scene,world:PioneerWorld):PioneerGraphics{
 const root=group(scene);root.name='pioneer-valley-no-prebuilt-village';
 const edge:[number,number][]=[];
 for(let i=0;i<48;i++){
  const a=i/48*Math.PI*2,r=1+.032*Math.sin(i*2.9)+.020*Math.cos(i*5.8);
  edge.push([PIONEER_VALLEY.centerX+Math.cos(a)*PIONEER_VALLEY.radiusX*r,
   Math.sin(a)*PIONEER_VALLEY.radiusZ*r]);
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
 const forest=buildPioneerForestArt(root,world);
 const camp=campVisual(root,world);
 const constructionLayer=group(root);constructionLayer.name='actual-settlement-registry';
 let roadLayer=drawFootpaths(root,world.roads);
 let lastRoads=roadGeometrySignature(world.roads);
 const people=world.founders.map(f=>makeFigure(root,f));
 // A visitor is not a permanent resident and cannot occupy a house.
 const traveler=group(root);traveler.name='actual-roadside-visitor';
 box(traveler,0,.83,0,.52,.90,.37,material('#9e9374'));
 for(const x of [-.14,.14]){
  box(traveler,x,.29,0,.16,.56,.18,material('#655c54'));
  box(traveler,x*1.9,1.01,0,.12,.54,.14,material('#8c785f'));
 }
 orb(traveler,0,1.48,0,.30,material('#d2b18b'),1,1.08,.90);
 orb(traveler,0,1.72,0,.40,material('#6b6253'),1,.26,1).name='traveler-broad-hat';
 box(traveler,0,.87,-.34,.47,.68,.26,material('#8f765a')).name='traveler-trade-pack';
 traveler.visible=false;
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
 const gardenCrops=new Map<string,THREE.Mesh[]>();
 const fishProps=new Map<string,THREE.Mesh[]>(),grainProps=new Map<string,THREE.Mesh[]>();
 const waitingFishProps=new Map<string,THREE.Object3D>();
 let latestWorld=world;
 let selected:PioneerSelection|null=null;
 const glow=new THREE.Mesh(new THREE.RingGeometry(.89,1.0,48),
  new THREE.MeshBasicMaterial({color:'#f2d89b',side:THREE.DoubleSide,
   transparent:true,opacity:.90,depthWrite:false}));
 glow.name='selected-building-ground-marker';glow.rotation.x=-Math.PI/2;
 glow.renderOrder=9;glow.visible=false;root.add(glow);
 function updateMarker(s:PioneerWorld){
  if(!selected){glow.visible=false;return;}
  const b=selected.kind==='building'?s.buildings.find(x=>x.id===selected?.id):undefined;
  const site=selected.kind==='site'?s.sites.find(x=>x.id===selected?.id):undefined;
  const p=b?.parcel??(selected.kind==='intent'&&selected.id===s.intent?.id?s.intent.parcel:null);
  if(p){
   glow.visible=true;glow.position.set(p.x,.23,p.z);
   glow.scale.set(p.width*.80,p.depth*.80,1);
   glow.rotation.set(-Math.PI/2,0,p.rotation);
  }else if(site||selected.kind==='camp'||selected.kind==='clearing'){
   const clearing=selected.kind==='clearing'?s.frontier.clearings.find(c=>c.id===selected?.id):undefined;
   const loc=site??clearing??s.camp;
   glow.visible=true;glow.position.set(loc.x,.25,loc.z);
   glow.scale.setScalar(clearing?clearing.radius:site?1.0:1.3);glow.rotation.set(-Math.PI/2,0,0);
  }else if(selected.kind==='person'){
   const index=s.founders.findIndex(f=>String(f.id)===selected?.id);
   const figure=index>=0?people[index]:undefined;
   if(figure){
    glow.visible=true;glow.position.set(figure.root.position.x,.23,figure.root.position.z);
    glow.scale.set(.55,.55,1);glow.rotation.set(-Math.PI/2,0,0);
   }else glow.visible=false;
  }else glow.visible=false;
 }
 function update(s:PioneerWorld,seconds:number){
  updateMarker(s);forest.update(s,seconds);
  latestWorld=s;
  const phase=s.intent?.phase??'none';
  const progress=s.intent?.workDone??0;
  const progressIndex=Math.floor(progress*2);
  const signature=s.buildings.map(b=>b.id+':'+((b.condition??100)<78?'w':'c')+
    (b.kind==='cottage'&&b.loftAddedAt!==undefined?':loft':'')+
    (b.kind==='wood-yard'?':'+s.livelihood.craft.phase:'')+
    (b.kind==='garden'?':'+(s.livingFates.seedTrials.filter(t=>t.gardenId===b.id).at(-1)?.phase??''):'' )).join(',')+
   '/'+(s.intent?.id??'')+'/'+phase+'/'+(s.intent?.parcel?.x??'')+'/'+
   (s.intent?.parcel?.z??'');
  let rebuilt=false;
  if(signature!==lastBuildSig||progressIndex!==lastProgressIndex){
   rebuilt=true;gardenCrops.clear();fishProps.clear();grainProps.clear();waitingFishProps.clear();
   while(constructionLayer.children.length){
    const old=constructionLayer.children[0];constructionLayer.remove(old);
   }
   for(const built of s.buildings){
    const trial=built.kind==='garden'?
     s.livingFates.seedTrials.filter(t=>t.gardenId===built.id).at(-1):undefined;
    const plot=facilityVisual(constructionLayer,built.parcel,built.kind,'complete',1,built.condition,
     trial?.phase,s.livelihood.craft.phase==='complete',built.loftAddedAt!==undefined);
    if(built.kind==='garden'){
     const crops:THREE.Mesh[]=[];
     plot.traverse(child=>{
      if(child instanceof THREE.Mesh&&child.name==='real-garden-crop')crops.push(child);
     });
     crops.sort((a,b)=>Number(a.userData.cropIndex)-Number(b.userData.cropIndex));
     gardenCrops.set(built.id,crops);
    }
    if(built.kind==='fish-hut'||built.kind==='granary'){
     const items:THREE.Mesh[]=[];
     plot.traverse(child=>{
      if(child instanceof THREE.Mesh&&child.name===(built.kind==='fish-hut'?
       'visible-caught-fish':'stored-real-grain-jar'))items.push(child);
     });
     if(built.kind==='fish-hut'){
      fishProps.set(built.id,items);
      const waiting=plot.getObjectByName('pending-fish-basket');
      if(waiting)waitingFishProps.set(built.id,waiting);
     }else grainProps.set(built.id,items);
    }
   }
   if(s.intent?.parcel&&s.intent.phase!=='survey'&&s.intent.phase!=='materials'){
    if(s.intent.kind==='repair'||s.intent.kind==='loft'){
     const p=s.intent.parcel,g=group(constructionLayer,p.x,.19,p.z);
     g.rotation.y=p.rotation;g.name=s.intent.kind==='loft'?'pioneer-loft-scaffold':'pioneer-repair-scaffold';
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
  // Crop geometry now reflects the *same field stock* used for food collection.
  for(const [gardenId,crops] of gardenCrops){
   const appearance=pioneerCropAppearance(s,gardenId);
   if(!appearance)continue;
   for(let i=0;i<crops.length;i++){
    const sprout=crops[i];
    sprout.visible=((i*11)%28)<appearance.visibleSprouts;
    sprout.scale.y=appearance.height;
    sprout.position.y=.20+appearance.height*.86;
    if(rebuilt||season!==lastSeason){
     (sprout.material as THREE.MeshStandardMaterial).color.set(
      season==='winter'?'#b7b899':
       season==='autumn'?(i%2?'#a6a76a':'#b8b67b'):
       season==='summer'?(i%2?'#6f9e5e':'#80ac62'):
       i%2?'#75a46d':'#91af6b');
    }
   }
  }
  for(const [id,props] of fishProps){
   const caught=s.sites.find(site=>site.id==='fish-'+id)?.totalGathered??0;
   props.forEach((mesh,i)=>{mesh.visible=caught>=i+1;});
  }
  for(const [id,mesh] of waitingFishProps)
    mesh.visible=s.livelihood.fishTransport.pending?.siteId==='fish-'+id;
   for(const props of grainProps.values()){
   const stored=s.resources.food;
   props.forEach((jar,i)=>{jar.visible=stored>=(i+1)*8;});
  }
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
  const commonsProject=s.commons.project;
  camp.setStage(s.commons.stage,commonsProject?.phase==='building',
   commonsProject?commonsProject.workDone/commonsProject.workRequired:0);
  camp.flames.forEach((flame,i)=>{
   flame.scale.y=.30+Math.abs(Math.sin(seconds*6+i))*.16;
   flame.visible=i===s.commons.stage&&!(weather==='rain'&&s.resources.wood<=0);
  });
  camp.supplies.scale.setScalar(.84+Math.min(1,s.resources.food/14)*.2);
  const logs=pioneerVisibleWoodLogs(s);
  for(let i=0;i<camp.woodLogs.length;i++)
   camp.woodLogs[i].visible=i<logs;
  people.forEach((visual,i)=>{
   const f=s.founders[i],night=dayHour>=20||dayHour<7;
   const path:readonly WalkPoint[]=f.commute?.length?f.commute:[[s.camp.x,s.camp.z],[f.target[0],f.target[1]]];
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
   visual.tool.visible=f.activity==='cook';
   visual.mealBowl.visible=f.activity==='eat'||f.activity==='eat-home'||f.activity==='host-guest';
   const forester=f.activity==='collect-wood'||f.activity==='clear-land';
   visual.axe.visible=forester&&!(moving&&phaseHour>.78);
   visual.rod.visible=f.activity==='fish'&&!moving;
   visual.cargo.visible=f.activity==='collect-wood'&&moving&&phaseHour>.78;
   visual.fishBasket.visible=f.activity==='haul-fish';
   visual.axe.rotation.z=forester&&!moving?
    .32*Math.sin(seconds*6+i):0;
   if((f.activity==='build'||f.activity==='repair'||f.activity==='commons-build'||f.activity==='craft')&&!moving){
    const effort=Math.sin(seconds*5+i)*.20;
    visual.arms[0].rotation.x=-.72+effort;visual.arms[1].rotation.x=-.72-effort;
   }else if(forester&&!moving){
    visual.arms[0].rotation.x=-1.03+.35*Math.sin(seconds*7+i);
    visual.arms[1].rotation.x=-.38;
    visual.head.rotation.x=.15;
   }else if(f.activity==='fish'&&!moving){
    visual.arms[0].rotation.x=-.83+.10*Math.sin(seconds*2.4+i);
    visual.arms[1].rotation.x=-.61;
    visual.rod.rotation.x=.12*Math.sin(seconds*2+i);
   }else if(f.activity==='haul-fish'){
    visual.arms[0].rotation.x=-.84;visual.arms[1].rotation.x=-.84;
    visual.head.rotation.x=.08;
   }else if(f.activity==='host-guest'&&!moving){
     // The serving resident is at the actual tea stop with a bowl,
     // visibly spending this hour instead of collecting in the forest.
     visual.arms[0].rotation.x=-.81+.12*Math.sin(seconds*2.5+i);
     visual.arms[1].rotation.x=-.64;
     visual.head.rotation.y=.12*Math.sin(seconds*1.7+i);
    }else if(f.activity==='cook'&&!moving){
    visual.arms[0].rotation.x=-1.0+.3*Math.sin(seconds*4+i);
    visual.arms[1].rotation.x=-.50+.25*Math.cos(seconds*4+i);
    visual.tool.rotation.z=.15*Math.sin(seconds*4+i);
    visual.head.rotation.x=.13;
   }else if((f.activity==='eat'||f.activity==='eat-home')&&!moving){
    visual.arms[0].rotation.x=-.92+.16*Math.sin(seconds*5+i);
    visual.arms[1].rotation.x=-.66;
    visual.head.rotation.x=.16;
   }else if(f.activity==='socialize'&&!moving){
    visual.arms[0].rotation.z=.22*Math.sin(seconds*3+i);
    visual.arms[1].rotation.x=-.44+.22*Math.cos(seconds*2+i);
    visual.head.rotation.y=.22*Math.sin(seconds*1.8+i);
   }else if((f.activity==='forage'||f.activity==='farm'||f.activity==='seed-trial')&&!moving){
    visual.root.position.y-=.15;visual.head.rotation.x=.12;
    visual.arms[0].rotation.x=-.55;visual.arms[1].rotation.x=-.55;
   }else visual.head.rotation.x=0;
   if(f.activity!=='socialize'&&f.activity!=='host-guest'){visual.head.rotation.y=0;visual.arms[0].rotation.z=0;}
   visual.root.visible=true;
  });
  const visiting=s.commerce.activeVisitor;
  traveler.visible=!!visiting&&s.buildings.some(b=>b.id===visiting.teaStopId);
  if(traveler.visible&&visiting){
   const [x,z]=pioneerVisitorPosition(visiting,s.minutes);
   const [ax,az]=pioneerVisitorPosition(visiting,Math.min(visiting.leaveAt,s.minutes+6));
   traveler.position.set(x,.18+Math.abs(Math.sin(seconds*5))*.025,z);
   const angle=Math.atan2(ax-x,az-z);
   if(Number.isFinite(angle))traveler.rotation.y=angle;
  }
  river.animate(seconds);
 }
 update(world,0);
 return {root,update,setSelected:(selection)=>{selected=selection;updateMarker(latestWorld);},
  signatures:()=>({
  buildings:latestWorld.buildings.length,renderedStructures,
  phase:latestWorld.intent?.phase??(latestWorld.buildings.length?'complete':'none'),
  people:people.length,roads:latestWorld.roads.length,
  commonsStage:latestWorld.commons.stage,
  commonsBeds:latestWorld.commons.stage===0?3:0,
  cookingActors:latestWorld.founders.filter(f=>f.activity==='cook').length,
  socialActors:latestWorld.founders.filter(f=>f.activity==='socialize').length,
  forestTrees:forest.signatures().standing,
  forestStumps:forest.signatures().stumps,
  fallingTree:forest.signatures().falling,
  clearings:forest.signatures().clearings,clearedPlots:forest.signatures().cleared,
  seedMarkers:constructionLayer.children.filter(b=>b.getObjectByName('persisted-seed-trial-resolved')||
   b.getObjectByName('persisted-seed-trial-working')||
   b.getObjectByName('persisted-seed-trial-abandoned')).length,
  gardenSprouts:[...gardenCrops.values()].reduce((n,crops)=>
   n+crops.filter(c=>c.visible).length,0),
  campWoodLogs:camp.woodLogs.filter(log=>log.visible).length,
  focusedResident:glow.visible&&selected?.kind==='person',
  fishCaughtProps:[...fishProps.values()].reduce((n,items)=>
   n+items.filter(p=>p.visible).length,0),
  grainJars:[...grainProps.values()].reduce((n,items)=>
   n+items.filter(p=>p.visible).length,0),
  sawbenches:constructionLayer.children.filter(g=>g.getObjectByName('actual-crafted-sawbench')).length,
  fishingActors:latestWorld.founders.filter(f=>f.activity==='fish').length,
  loftDormers:constructionLayer.children.filter(g=>g.getObjectByName('paid-residential-loft')).length,
  roadsideVisitor:traveler.visible,
  activeVisitorName:latestWorld.commerce.activeVisitor?.name??null
 })};
}
function hashFloat(n:number){let k=(n+339)>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);return ((k^(k>>>13))>>>0)/4294967296;}

/** Resolve a raycast hit through authored model groups. The actual registry,
 * not geometry names or mesh order, owns a building's identity. */
export function pioneerHitSelection(s:PioneerWorld,hit:THREE.Object3D):PioneerSelection|null{
 let current:THREE.Object3D|null=hit;
 while(current){
  if(current.userData.founderId&&s.founders.some(f=>f.id===current?.userData.founderId))
   return {kind:'person',id:String(current.userData.founderId)};
  if(current.userData.buildingId){
   const parcelId=String(current.userData.buildingId);
   const built=s.buildings.find(b=>b.parcel.id===parcelId);
   if(built)return {kind:'building',id:built.id};
   if(s.intent?.parcel?.id===parcelId)return {kind:'intent',id:s.intent.id};
  }
  if(current.userData.siteId&&
   s.sites.some(site=>site.id===current?.userData.siteId))
   return {kind:'site',id:String(current.userData.siteId)};
  if(current.userData.clearingId&&
   s.frontier.clearings.some(c=>c.id===current?.userData.clearingId))
   return {kind:'clearing',id:String(current.userData.clearingId)};
  if(current.userData.pioneerCamp)return {kind:'camp',id:'camp'};
  current=current.parent;
 }
 return null;
}
