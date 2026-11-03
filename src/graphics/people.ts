import * as THREE from 'three';
import {getCalendar,getWeather,type ActivityId,type Villager,type WorldState,residentMotion} from '../simulation/world';
import {dressCharacter,type CharacterCostume} from './characterKit';
import {REST_POSE,sampleCharacterPose,interpolatePose,type CharacterPose} from './characterMotion';
import {batchStaticSubtree} from './batchStatic';
import {createHeroAnimator,type HeroAnimator} from './heroClips';

/** An articulated workshop-doll body with a real upper-body and head pivot. */
const fabric=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:string)=>{
 let m=fabric.get(color);
 if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.94});fabric.set(color,m);}
 return m;
};
const skinColors=['#e7be9f','#d4a484','#eac6a6','#cfa18a'];
const modelGeometries=new Map<string,THREE.BufferGeometry>();
const contactGeometry=new THREE.CircleGeometry(.35,14);
const contactMaterial=new THREE.MeshBasicMaterial({
 color:'#304637',transparent:true,opacity:.18,depthWrite:false
});
const UPPER_Y=.78;
function piece(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){
 const params=(geometry as THREE.BufferGeometry&{parameters?:Record<string,unknown>}).parameters;
 const key=geometry.type+':'+JSON.stringify(params||{});
 let shared=modelGeometries.get(key);
 if(!shared){shared=geometry;modelGeometries.set(key,shared);}
 else if(shared!==geometry)geometry.dispose();
 const o=new THREE.Mesh(shared,material);
 o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;
 parent.add(o);return o;
}
function cylinder(parent:THREE.Object3D,top:number,bottom:number,h:number,
 x:number,y:number,z:number,m:THREE.Material,segments=8){
 return piece(parent,new THREE.CylinderGeometry(top,bottom,h,segments),m,x,y,z);
}
function torsoPart(parent:THREE.Object3D,geo:THREE.BufferGeometry,m:THREE.Material,
 x:number,worldY:number,z:number){
 return piece(parent,geo,m,x,worldY-UPPER_Y,z);
}
export interface PersonModel{
 villager:Villager;group:THREE.Group;upper:THREE.Group;headRig:THREE.Group;
 legs:THREE.Group[];knees:THREE.Group[];arms:THREE.Group[];
 grownGear:THREE.Group|null;winterGear:THREE.Group;
 gear:Partial<Record<ActivityId,THREE.Group>>;
 robe:THREE.Mesh;costume:CharacterCostume;
 pose:CharacterPose;lastT:number;heading:number;heroAnimator:HeroAnimator|null;
}
export function makePeople(scene:THREE.Scene,villagers:Villager[]):PersonModel[]{
 const models=villagers.map(v=>{
  const g=new THREE.Group();g.userData.villagerId=v.id;g.name='villager-'+v.id;scene.add(g);
  const cloth=mat(v.color),hair=mat(v.hair),skin=mat(skinColors[(v.id-1)%4]),dark=mat('#4e4a46');
  const upper=new THREE.Group();upper.position.y=UPPER_Y;upper.name='articulated-torso';g.add(upper);
  const robe=torsoPart(upper,new THREE.CylinderGeometry(.20,.365,.77,9),cloth,0,.59,0);
  robe.userData.keepDynamicMesh=true;
  torsoPart(upper,new THREE.CylinderGeometry(.19,.21,.35,9),cloth,0,1.02,0);
  torsoPart(upper,new THREE.BoxGeometry(.46,.095,.13),mat('#d8c4a2'),0,.81,.25);
  const lapel=torsoPart(upper,new THREE.BoxGeometry(.09,.37,.075),mat('#eee1c6'),-.09,1.05,.19);
  lapel.rotation.z=.39;
  const headRig=new THREE.Group();headRig.name='head-and-hair';headRig.position.y=1.38-UPPER_Y;
  upper.add(headRig);
  piece(headRig,new THREE.SphereGeometry(.247,12,10),skin,0,0,0);
  piece(headRig,new THREE.SphereGeometry(.258,12,8,0,Math.PI*2,0,Math.PI*.46),hair,0,.085,0);
  piece(headRig,new THREE.SphereGeometry(.12,8,6),hair,0,.28,-.045);
  cylinder(headRig,.07,.10,.19,0,.37,-.02,hair);
  // Tiny but clear brows and eyes preserve the toy-like face at default zoom.
  for(const sx of [-1,1]){
   piece(headRig,new THREE.SphereGeometry(.025,5,5),dark,sx*.095,.022,.225);
   const brow=piece(headRig,new THREE.BoxGeometry(.078,.022,.018),hair,sx*.093,.115,.219);
   brow.rotation.z=-sx*.06;
  }
  const arms:THREE.Group[]=[],legs:THREE.Group[]=[],knees:THREE.Group[]=[];
  for(const sx of [-1,1]){
   const arm=new THREE.Group();arm.name=sx<0?'left-shoulder':'right-shoulder';
   arm.position.set(sx*.235,1.14-UPPER_Y,0);upper.add(arm);
   piece(arm,new THREE.CapsuleGeometry(.088,.26,2,7),cloth,0,-.21,0);
   cylinder(arm,.131,.10,.15,0,-.40,0,mat('#e0d2bd'));
   piece(arm,new THREE.SphereGeometry(.065,8,6),skin,0,-.51,.01);
   arms.push(arm);
   const leg=new THREE.Group();leg.name=sx<0?'left-hip':'right-hip';
   leg.position.set(sx*.147,.39,0);g.add(leg);
   piece(leg,new THREE.CapsuleGeometry(.083,.18,2,6),mat('#5e6163'),0,-.12,0);
   const knee=new THREE.Group();knee.name=sx<0?'left-knee':'right-knee';
   knee.position.y=-.255;leg.add(knee);
   piece(knee,new THREE.CapsuleGeometry(.074,.14,2,6),mat('#50575c'),0,-.082,0);
   piece(knee,new THREE.BoxGeometry(.215,.11,.31),mat('#554e47'),0,-.22,.082);
   legs.push(leg);knees.push(knee);
  }
  if(v.id===1){ // Forest hat with broad, identifiable flattened brim.
   cylinder(headRig,.39,.39,.065,0,.34,0,mat('#c1aa7c'));
   cylinder(headRig,.14,.27,.30,0,.48,0,mat('#b7a175'));
  }
  if(v.id===8){
   // Hand-gripped blade follows the wrist pivot, not an unrelated static body block.
   const wrist=new THREE.Group();wrist.name='sword-wrist';wrist.position.set(0,-.50,.035);
   arms[1].add(wrist);
   const sword=new THREE.Group();wrist.add(sword);sword.name='training-sword';
   piece(sword,new THREE.BoxGeometry(.065,.065,1.05),mat('#c0a179'),0,0,.62);
   piece(sword,new THREE.BoxGeometry(.31,.085,.10),mat('#755749'),0,0,.13);
   piece(sword,new THREE.CylinderGeometry(.058,.067,.28,7),mat('#9b7558'),0,0,-.05).rotation.x=Math.PI/2;
  }
  if(v.id===9){
   const straw=mat('#9f9070');
   cylinder(headRig,.56,.56,.065,0,.35,0,straw,11);
   const hat=cylinder(headRig,.04,.48,.30,0,.53,0,straw,11);hat.rotation.z=.06;
  }
  const grownGear=v.id===8?new THREE.Group():null;
  if(grownGear){
   upper.add(grownGear);grownGear.name='returned-swordsman';
   torsoPart(grownGear,new THREE.BoxGeometry(.17,1.18,.12),mat('#556773'),-.35,.84,-.20).rotation.z=-.18;
   torsoPart(grownGear,new THREE.BoxGeometry(.56,.09,.14),mat('#b6ad9d'),-.35,1.28,-.18).rotation.z=-.18;
   grownGear.visible=false;
  }
  const gear:Partial<Record<ActivityId,THREE.Group>>={};
  const makeGear=(kind:ActivityId,parent:THREE.Group)=>{
   const tool=new THREE.Group();tool.name='tool-'+kind;parent.add(tool);tool.visible=false;gear[kind]=tool;return tool;
  };
  if(v.id===1||v.id===10){
   const logs=makeGear('carry',g);
   for(let i=0;i<3;i++){
    const l=piece(logs,new THREE.CylinderGeometry(.065,.065,.83,7),
     mat('#91704f'),(i-1)*.18,.70,.47);l.rotation.z=Math.PI/2;
   }
  }
  if(v.id===2){
   const broom=makeGear('sweep',arms[1]);
   cylinder(broom,.025,.035,1.0,.08,-.86,.24,mat('#ad8b62')).rotation.z=.20;
   cylinder(broom,.16,.11,.26,.18,-1.32,.24,mat('#bfad78'));
   const tray=makeGear('serve',arms[1]);
   cylinder(tray,.28,.30,.075,0,-.49,.32,mat('#9f7a59')).rotation.x=Math.PI/2;
   cylinder(tray,.09,.08,.17,0,-.44,.43,mat('#d4c6a9'));
  }
  if(v.id===3||v.id===4){
   const basket=makeGear('gather',g);
   cylinder(basket,.18,.14,.26,-.42,.44,.27,mat('#b5966d')).rotation.z=-.16;
   for(let i=0;i<3;i++)piece(basket,new THREE.IcosahedronGeometry(.13,0),
    mat(v.id===3?'#6c9c65':'#87976a'),-.51+i*.12,.65,.25);
  }
  if(v.id===6){
   const loom=makeGear('weave',g);
   piece(loom,new THREE.BoxGeometry(.28,.08,.48),mat('#d8b79b'),.42,.49,.35).rotation.y=.32;
   cylinder(loom,.07,.14,.42,.49,.65,.34,mat('#a47e5e')).rotation.z=.25;
  }
  if(v.id===7){
   const rod=makeGear('fish',arms[1]);
   cylinder(rod,.017,.028,2.1,.34,-.20,.28,mat('#8f714d')).rotation.z=-.57;
   piece(rod,new THREE.BoxGeometry(.012,.8,.014),mat('#d1cbb7'),1.17,-.45,.28);
  }
  const winterGear=new THREE.Group();winterGear.name='winter-scarf';upper.add(winterGear);
  cylinder(winterGear,.257,.25,.13,0,1.17-UPPER_Y,0,mat('#d7c4a5'));
  const scarf=piece(winterGear,new THREE.BoxGeometry(.18,.34,.11),
   mat(v.id%2===0?'#b46b5a':'#9baead'),.20,.97-UPPER_Y,.20);scarf.rotation.z=-.14;
  winterGear.visible=false;
  const costume=dressCharacter(upper,v);
  const shadow=new THREE.Mesh(contactGeometry,contactMaterial);
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;shadow.name='contact-shadow';g.add(shadow);
  return {villager:v,group:g,upper,headRig,legs,knees,arms,grownGear,winterGear,gear,robe,
   costume,pose:{...REST_POSE},lastT:0,heading:0,heroAnimator:null};
 });
 for(const person of models){
  batchStaticSubtree(person.group,{disposeOriginals:false});
  if(person.villager.id===8)person.heroAnimator=createHeroAnimator(person.group);
 }
 return models;
}
export function updatePeople(people:PersonModel[],state:WorldState,t:number,selected:number|null){
 const winter=getCalendar(state).season==='winter',rain=getWeather(state)==='rain';
 for(const person of people){
  const v=person.villager,movement=residentMotion(v,state),g=person.group;
  g.visible=movement.visible;
  if(!movement.visible){person.lastT=t;continue;}
  const dt=Math.min(.06,Math.max(0,t-person.lastT));person.lastT=t;
  const alpha=1-Math.exp(-dt*8.5);
  const action=movement.activityId,walking=movement.walking;
  const hero=person.heroAnimator;
  if(hero)hero.update(dt,walking?'walk':action==='train'?'sword-form':'idle');
  else{
   const target=sampleCharacterPose(action,t,v.id,walking,rain);
   person.pose=interpolatePose(person.pose,target,alpha);
  }
  const p=person.pose;
  g.position.set(movement.x,.19+(hero?0:p.bob),movement.z);
  const angleDiff=Math.atan2(Math.sin(movement.heading-person.heading),
   Math.cos(movement.heading-person.heading));
  person.heading+=angleDiff*alpha;
  g.rotation.y=person.heading;
  if(!hero){
  person.upper.rotation.set(p.torsoX,0,p.torsoZ);
  person.headRig.rotation.set(-p.torsoX*.16,p.headY,0);
  person.legs[0].rotation.x=p.leftLegX;person.legs[1].rotation.x=p.rightLegX;
  person.knees[0].rotation.x=-p.leftKnee;person.knees[1].rotation.x=-p.rightKnee;
  person.arms[0].rotation.set(p.leftArmX,0,p.leftArmZ);
  person.arms[1].rotation.set(p.rightArmX,0,p.rightArmZ);
  person.costume.hems[0].rotation.x=-p.hem;
  person.costume.hems[1].rotation.x=p.hem;
  if(person.costume.cape)person.costume.cape.rotation.x=-p.hem*.35;
  person.robe.rotation.z=p.torsoZ*.3;
  }else{
   // The mixer has already authored all named joint rotations. Never overwrite
   // them with the old procedural sine-pose system in the same render frame.
   person.pose={...person.pose,rightArmX:person.arms[1].rotation.x,
    rightArmZ:person.arms[1].rotation.z,leftArmX:person.arms[0].rotation.x,
    torsoX:person.upper.rotation.x,torsoZ:person.upper.rotation.z,
    leftLegX:person.legs[0].rotation.x,rightLegX:person.legs[1].rotation.x};
  }
  person.winterGear.visible=winter;
  for(const [key,tool] of Object.entries(person.gear))if(tool)tool.visible=key===action;
  const grown=v.id===8&&(state.storyStage==='returned'||state.storyStage==='legacy');
  if(person.grownGear)person.grownGear.visible=grown;
  const scale=(grown?1.16:v.id===8?.91:1)*(selected===v.id?1.08:1);
  g.scale.setScalar(scale);
 }
}
