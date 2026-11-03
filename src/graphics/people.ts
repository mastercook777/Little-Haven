import * as THREE from 'three';
import {getCalendar,getWeather,type ActivityId,type Villager,type WorldState,residentMotion} from '../simulation/world';

const fabric=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:string)=>{let m=fabric.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:1});fabric.set(color,m);}return m;};
const skinColors=['#e7be9f','#d4a484','#eac6a6','#cfa18a'];
function piece(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){
 const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
export interface PersonModel {
 villager:Villager;group:THREE.Group;legs:THREE.Group[];arms:THREE.Group[];
 grownGear:THREE.Group|null;winterGear:THREE.Group;gear:Partial<Record<ActivityId,THREE.Group>>;
 robe:THREE.Mesh;head:THREE.Mesh;lastT:number;heading:number;
}
export function makePeople(scene:THREE.Scene,villagers:Villager[]):PersonModel[]{
 return villagers.map(v=>{
  const g=new THREE.Group();g.userData.villagerId=v.id;scene.add(g);
  const cloth=mat(v.color),hair=mat(v.hair),skin=mat(skinColors[(v.id-1)%4]),dark=mat('#4e4a46');
  const robe=piece(g,new THREE.CylinderGeometry(.19,.36,.77,8),cloth,0,.59,0);robe.rotation.z=-.035;
  piece(g,new THREE.CylinderGeometry(.19,.19,.34,8),cloth,0,1.02,0);
  piece(g,new THREE.BoxGeometry(.44,.095,.10),mat('#d8c4a2'),0,.81,.25);
  const lapel=piece(g,new THREE.BoxGeometry(.09,.37,.07),mat('#eee1c6'),-.09,1.05,.18);lapel.rotation.z=.39;
  const head=piece(g,new THREE.SphereGeometry(.25,10,9),skin,0,1.38,0);
  piece(g,new THREE.SphereGeometry(.255,11,7,0,Math.PI*2,0,Math.PI*.46),hair,0,1.46,0);
  piece(g,new THREE.SphereGeometry(.115,8,6),hair,0,1.67,-.045);
  // Tied-up hair / topknots, readable at tiny camera scale.
  cylinderIn(g,.07,.10,.19,0,1.74,-.02,hair);
  for(const side of [-1,1])piece(g,new THREE.SphereGeometry(.026,5,5),dark,side*.095,1.40,.222);
  const arms:THREE.Group[]=[],legs:THREE.Group[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.235,1.14,0);g.add(arm);
    piece(arm,new THREE.CapsuleGeometry(.073,.29,2,6),cloth,0,-.24,0);
    piece(arm,new THREE.CylinderGeometry(.14,.11,.13,7),mat('#e0d2bd'),0,-.43,0);
    arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.14,.29,0);g.add(leg);
    piece(leg,new THREE.CapsuleGeometry(.085,.19,2,6),mat('#5e6163'),0,-.12,0);
    piece(leg,new THREE.BoxGeometry(.21,.11,.31),mat('#554e47'),0,-.34,.08);legs.push(leg);
  }
  if(v.id===1||v.id===3||v.id===4){
    cylinderIn(g,.39,.39,.065,0,1.71,0,mat('#c1aa7c'));cylinderIn(g,.14,.27,.30,0,1.86,0,mat('#b7a175'));
  }
  if(v.id===2){piece(g,new THREE.BoxGeometry(.44,.37,.10),mat('#d7c39a'),0,.72,.28);}
  if(v.id===8){
    const sword=new THREE.Group();arms[1].add(sword);
    piece(sword,new THREE.BoxGeometry(.055,.92,.075),mat('#b99c73'),0,-.80,.20);
    piece(sword,new THREE.BoxGeometry(.30,.075,.10),mat('#7a5949'),0,-.40,.20);
  }
  if(v.id===9){
    const straw=mat('#9f9070');cylinderIn(g,.56,.56,.065,0,1.75,0,straw,11);
    const hat=cylinderIn(g,.04,.48,.30,0,1.93,0,straw,11);hat.rotation.z=.06;
    piece(g,new THREE.BoxGeometry(.16,1.26,.14),mat('#514b4e'),-.30,.84,-.14).rotation.z=-.20;
  }
  if(v.id===10){piece(g,new THREE.BoxGeometry(.40,.38,.30),mat('#947051'),-.35,.88,-.10);}
  const grownGear=v.id===8?new THREE.Group():null;
  if(grownGear){g.add(grownGear);piece(grownGear,new THREE.BoxGeometry(.17,1.18,.12),mat('#556773'),-.35,.84,-.20).rotation.z=-.18;
    piece(grownGear,new THREE.BoxGeometry(.56,.09,.14),mat('#b6ad9d'),-.35,1.28,-.18).rotation.z=-.18;
    grownGear.visible=false;
  }
  // Occupation-specific hand tools (no generic idle arm flapping during work).
  const gear:Partial<Record<ActivityId,THREE.Group>>={};
  const makeGear=(kind:ActivityId,parent:THREE.Group)=>{
   const tool=new THREE.Group();parent.add(tool);tool.visible=false;gear[kind]=tool;return tool;
  };
  if(v.id===1||v.id===10){
   const logs=makeGear('carry',g);
   for(let i=0;i<3;i++){const l=piece(logs,new THREE.CylinderGeometry(.065,.065,.83,7),mat('#91704f'),
     (i-1)*.18,.65,.47);l.rotation.z=Math.PI/2;}
  }
  if(v.id===2){
   const broom=makeGear('sweep',arms[1]);
   const stick=piece(broom,new THREE.CylinderGeometry(.025,.035,1.0,7),mat('#ad8b62'),.08,-.86,.24);stick.rotation.z=.20;
   piece(broom,new THREE.CylinderGeometry(.16,.11,.26,7),mat('#bfad78'),.18,-1.32,.24);
   const tray=makeGear('serve',arms[1]);
   piece(tray,new THREE.CylinderGeometry(.28,.30,.075,12),mat('#9f7a59'),0,-.49,.32).rotation.x=Math.PI/2;
   piece(tray,new THREE.CylinderGeometry(.09,.08,.17,9),mat('#d4c6a9'),0,-.44,.43);
  }
  if(v.id===3||v.id===4){
   const harvest=makeGear('gather',g);
   const basket=piece(harvest,new THREE.CylinderGeometry(.18,.14,.26,9),mat('#b5966d'),-.42,.44,.27);
   basket.rotation.z=-.16;
   for(let i=0;i<3;i++)piece(harvest,new THREE.IcosahedronGeometry(.13,0),
    mat(v.id===3?'#6c9c65':'#87976a'),-.51+i*.12,.65,.25);
  }
  if(v.id===6){
   const needle=makeGear('weave',g);
   const thread=piece(needle,new THREE.BoxGeometry(.28,.08,.48),mat('#d8b79b'),.42,.49,.35);
   thread.rotation.y=.32;
   const spindle=piece(needle,new THREE.CylinderGeometry(.07,.14,.42,9),mat('#a47e5e'),.49,.65,.34);
   spindle.rotation.z=.25;
  }
  if(v.id===7){
   const rod=makeGear('fish',arms[1]);
   const pole=piece(rod,new THREE.CylinderGeometry(.017,.028,2.1,7),mat('#8f714d'),.34,-.20,.28);
   pole.rotation.z=-.57;
   piece(rod,new THREE.BoxGeometry(.012,.8,.014),mat('#d1cbb7'),1.17,-.45,.28);
  }
  const winterGear=new THREE.Group();g.add(winterGear);
  piece(winterGear,new THREE.CylinderGeometry(.257,.25,.13,11),mat('#d7c4a5'),0,1.17,0);
  const scarf=piece(winterGear,new THREE.BoxGeometry(.18,.34,.11),mat(v.id%2===0?'#b46b5a':'#9baead'),.20,.97,.20);
  scarf.rotation.z=-.14;winterGear.visible=false;
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.35,14),new THREE.MeshBasicMaterial({color:'#304637',transparent:true,opacity:.18,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;g.add(shadow);
  return {villager:v,group:g,legs,arms,grownGear,winterGear,gear,robe,head,lastT:0,heading:0};
 });
}
function cylinderIn(p:THREE.Object3D,a:number,b:number,h:number,x:number,y:number,z:number,m:THREE.Material,seg=8){return piece(p,new THREE.CylinderGeometry(a,b,h,seg),m,x,y,z);}
/**
 * Smooth pose blending avoids sharp arm snaps when villagers stop walking.
 * The underlying destinations are driven by game minutes, not the render clock.
 */
export function updatePeople(people:PersonModel[],state:WorldState,t:number,selected:number|null){
 const winter=getCalendar(state).season==='winter',rain=getWeather(state)==='rain';
 for(const person of people){
  const v=person.villager,movement=residentMotion(v,state);
  person.group.visible=movement.visible;
  if(!movement.visible){person.lastT=t;continue;}
  const dt=Math.min(.06,Math.max(.005,t-person.lastT));person.lastT=t;
  const smoothing=1-Math.exp(-dt*9);
  const action=movement.activityId,walking=movement.walking;
  const stride=t*(rain?11:8)+v.id*.74;
  const step=walking?Math.sin(stride)*(rain?.50:.41):0;
  const heel=walking?Math.cos(stride)*.024:0;
  const idle= Math.sin(t*1.55+v.id)*.010;
  person.group.position.set(movement.x,.19+(walking?Math.abs(heel):idle),movement.z);
  const angleDiff=Math.atan2(Math.sin(movement.heading-person.heading),Math.cos(movement.heading-person.heading));
  person.heading+=angleDiff*smoothing;
  person.group.rotation.y=person.heading;
  const grown=v.id===8&&(state.storyStage==='returned'||state.storyStage==='legacy');
  if(person.grownGear)person.grownGear.visible=grown;
  person.winterGear.visible=winter;
  for(const [key,g] of Object.entries(person.gear))if(g)g.visible=key===action;
  let leftX=walking?step*.72:.02,rightX=walking?-step*.72:-.02;
  let leftZ=0,rightZ=0,bend=0,headY=0;
  if(!walking){
   switch(action){
    case 'sweep':
     rightX=-.70+Math.sin(t*4+v.id)*.60;rightZ=-.2+Math.cos(t*2.1)*.25;
     leftX=-.35;leftZ=.1;bend=.1;break;
    case 'carry':
     leftX=-.72;rightX=-.74;leftZ=-.18;rightZ=.18;bend=.05;break;
    case 'serve':
     leftX=-.30;rightX=-1.0;rightZ=-.12;headY=Math.sin(t*.7)*.04;break;
    case 'gather':
     leftX=-.60+Math.sin(t*2.4+v.id)*.17;
     rightX=-.82+Math.cos(t*2.4+v.id)*.21;bend=.22;break;
    case 'weave':
     leftX=-.58+Math.sin(t*3.1)*.35;rightX=-.64-Math.sin(t*3.1)*.31;break;
    case 'fish':
     rightX=-.84+Math.sin(t*.63+v.id)*.08;leftX=-.24;rightZ=-.11;break;
    case 'greet':
     rightX=-.52+Math.sin(t*2.1)*.27;rightZ=-.46;leftX=-.18;break;
    case 'train':{
     // Two-stroke practice: guard, sweep, reset. Works with the bamboo sword.
     const phase=(t*1.06+v.id*.27)%2.8;
     rightX=phase<1.1?-.9-phase*.63:phase<1.9?-.30+(phase-1.1)*.8:-.2;
     rightZ=-.28+Math.sin(t*2.2+v.id)*.44;
     leftX=-.44+Math.sin(t*1.6)*.25;leftZ=.12;bend=.06;
     break;
    }
    case 'shelter':leftX=-.28;rightX=-.32;bend=.12;break;
    case 'sleep':leftX=.05;rightX=-.05;break;
    default:leftX=.03;rightX=-.03;headY=Math.sin(t*.36+v.id)*.035;break;
   }
  }
  const legScale=walking?1:action==='train'?.2:.015;
  const set=(part:THREE.Group,key:'x'|'z',dest:number)=>{
   part.rotation[key]=THREE.MathUtils.lerp(part.rotation[key],dest,smoothing);
  };
  set(person.legs[0],'x',step*legScale);set(person.legs[1],'x',-step*legScale);
  set(person.arms[0],'x',leftX);set(person.arms[1],'x',rightX);
  set(person.arms[0],'z',leftZ);set(person.arms[1],'z',rightZ);
  person.robe.rotation.x=THREE.MathUtils.lerp(person.robe.rotation.x,bend,smoothing);
  person.head.rotation.y=THREE.MathUtils.lerp(person.head.rotation.y,headY,smoothing);
  const scale=(grown?1.16:v.id===8?.91:1)*(selected===v.id?1.08:1);
  person.group.scale.setScalar(scale);
 }
}
