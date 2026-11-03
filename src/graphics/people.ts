import * as THREE from 'three';
import { type Villager,type WorldState,residentMotion } from '../simulation/world';

const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:1});
const skin=mat('#ebc5a5'),face=mat('#493e34'),shoes=mat('#6c635c');
const skinVariants=[mat('#e8bd99'),mat('#c99575'),mat('#f0cda8'),mat('#d7ac8c')];
function piece(parent:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number){
 const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
export interface PersonModel {villager:Villager;group:THREE.Group;legs:THREE.Group[];arms:THREE.Group[];}
export function makePeople(scene:THREE.Scene,villagers:Villager[]):PersonModel[]{
 return villagers.map((villager)=>{
   const g=new THREE.Group();g.userData.villagerId=villager.id;scene.add(g);
   const skinColor=skinVariants[(villager.id-1)%skinVariants.length];
   const shirt=mat(villager.color),hair=mat(villager.hair);
   const torso=piece(g,new THREE.CylinderGeometry(.18,.24,.52,8),shirt,0,.69,0);torso.rotation.z=-.04;
   // Apron/vest, neck scarf and tiny buttons make the characters readable at scale.
   piece(g,new THREE.BoxGeometry(.25,.31,.055),villager.occupation==='面包师'?mat('#f6ebd1'):mat('#d7c6ab'),0,.63,.2);
   piece(g,new THREE.BoxGeometry(.3,.08,.12),hair,0,.96,.025);
   const head=piece(g,new THREE.SphereGeometry(.25,11,9),skinColor,0,1.12,0);
   piece(g,new THREE.SphereGeometry(.254,11,7,0,Math.PI*2,0,Math.PI*.44),hair,0,1.18,0);
   for(const s of [-1,1]){
     piece(g,new THREE.SphereGeometry(.027,5,5),face,s*.10,1.15,.222);
     piece(g,new THREE.SphereGeometry(.029,5,5),skinColor,s*.24,1.09,0);
   }
   const arms:THREE.Group[]=[], legs:THREE.Group[]=[];
   for(const s of [-1,1]){
     const arm=new THREE.Group();arm.position.set(s*.235,.86,0);g.add(arm);
     piece(arm,new THREE.CapsuleGeometry(.068,.31,3,6),shirt,0,-.20,0);
     piece(arm,new THREE.SphereGeometry(.07,7,6),skinColor,0,-.39,.02);arms.push(arm);
     const leg=new THREE.Group();leg.position.set(s*.115,.40,0);g.add(leg);
     piece(leg,new THREE.CapsuleGeometry(.079,.25,2,6),mat('#7e7b77'),0,-.19,0);
     piece(leg,new THREE.BoxGeometry(.2,.10,.30),shoes,0,-.38,.06);legs.push(leg);
   }
   if(villager.occupation==='农夫' || villager.occupation==='花匠'){
     piece(g,new THREE.CylinderGeometry(.33,.33,.08,12),mat('#b99b6e'),0,1.34,0);
     piece(g,new THREE.CylinderGeometry(.19,.26,.29,12),mat('#bc9a6d'),0,1.47,0);
   }
   if(villager.occupation==='信使'){
     const bag=piece(g,new THREE.BoxGeometry(.23,.28,.16),mat('#9c7057'),-.25,.61,.12);bag.rotation.z=.16;
   }
   // Contact shadow: small soft-ish dark disk, does not require high shadow map resolution.
   const shadow=new THREE.Mesh(new THREE.CircleGeometry(.32,12),new THREE.MeshBasicMaterial({color:'#334f3c',transparent:true,opacity:.20,depthWrite:false}));
   shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;g.add(shadow);
   return {villager,group:g,legs,arms};
 });
}
export function updatePeople(people:PersonModel[],world:WorldState,t:number,selected:number|null){
 for(const person of people){
   const v=person.villager;
   person.group.visible=v.id<=world.population;
   if(!person.group.visible)continue;
   const motion=residentMotion(v,world);
   person.group.visible=motion.visible || v.id===selected;
   person.group.position.set(motion.x,.21+(motion.walking?Math.max(0,Math.sin(t*12+v.id))*0.05:Math.sin(t*2+v.id)*.016),motion.z);
   person.group.rotation.y=motion.heading || (Math.sin(t*.32+v.id)*.28);
   const amp=motion.walking?.50:.04;
   person.legs[0].rotation.x=Math.sin(t*9+v.id)*amp;
   person.legs[1].rotation.x=-Math.sin(t*9+v.id)*amp;
   person.arms[0].rotation.x=-Math.sin(t*9+v.id)*amp*.72;
   person.arms[1].rotation.x=Math.sin(t*9+v.id)*amp*.72;
   person.group.scale.setScalar(v.id===selected?1.1:1.0);
 }
}
