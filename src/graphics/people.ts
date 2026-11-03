import * as THREE from 'three';
import {type Villager,type WorldState,residentMotion} from '../simulation/world';

const fabric=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:string)=>{let m=fabric.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:1});fabric.set(color,m);}return m;};
const skinColors=['#e7be9f','#d4a484','#eac6a6','#cfa18a'];
function piece(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){
 const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
export interface PersonModel {villager:Villager;group:THREE.Group;legs:THREE.Group[];arms:THREE.Group[];grownGear:THREE.Group|null;}
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
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.35,14),new THREE.MeshBasicMaterial({color:'#304637',transparent:true,opacity:.18,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;g.add(shadow);
  return {villager:v,group:g,legs,arms,grownGear};
 });
}
function cylinderIn(p:THREE.Object3D,a:number,b:number,h:number,x:number,y:number,z:number,m:THREE.Material,seg=8){return piece(p,new THREE.CylinderGeometry(a,b,h,seg),m,x,y,z);}
export function updatePeople(people:PersonModel[],state:WorldState,t:number,selected:number|null){
 for(const person of people){
  const v=person.villager;const movement=residentMotion(v,state);
  person.group.visible=movement.visible;
  if(!movement.visible)continue;
  person.group.position.set(movement.x,.19+(movement.walking?Math.max(0,Math.sin(t*10+v.id))*.035:Math.sin(t*1.8+v.id)*.011),movement.z);
  person.group.rotation.y=movement.heading||(Math.sin(t*.31+v.id)*.23);
  const grown=v.id===8&&(state.storyStage==='returned'||state.storyStage==='legacy');
  if(person.grownGear)person.grownGear.visible=grown;
  const walking=movement.walking;
  const amplitude=walking?.43:.025;
  person.legs[0].rotation.x=Math.sin(t*8+v.id)*amplitude;person.legs[1].rotation.x=-Math.sin(t*8+v.id)*amplitude;
  person.arms[0].rotation.x=-Math.sin(t*8+v.id)*amplitude*.72;
  person.arms[1].rotation.x=Math.sin(t*8+v.id)*amplitude*.72;
  if(movement.practicing){
   person.arms[1].rotation.x=-.50+Math.sin(t*3.7+v.id)*.95;
   person.arms[1].rotation.z=-.2+Math.sin(t*1.8)*.35;
   person.arms[0].rotation.x=-.2+Math.sin(t*2)*.30;
  }else person.arms[1].rotation.z=0;
  const scale=(grown?1.16:v.id===8?.91:1)*(selected===v.id?1.08:1);
  person.group.scale.setScalar(scale);
 }
}
