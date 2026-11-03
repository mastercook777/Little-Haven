import * as THREE from 'three';
import type {Villager} from '../simulation/world.ts';

/**
 * Human-sized workshop-doll clothing kit. Maintains costume at the default
 * orthographic camera scale: shapes and profession matter more than face detail.
 * The upper group has pivot y=.78 world-local; costume uses absolute-world-height
 * converted by that offset. Animating upper/hem must not animate leg placement.
 */
const fabrics=new Map<string,THREE.MeshStandardMaterial>();
const mat=(color:string)=>{
 let m=fabrics.get(color);
 if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.94});fabrics.set(color,m);}
 return m;
};
const boxGeo=new THREE.BoxGeometry(1,1,1);
const coneGeo=new THREE.CylinderGeometry(.80,1.0,1,8);
const sphereGeo=new THREE.IcosahedronGeometry(1,1);
const discGeo=new THREE.CylinderGeometry(1,1,1,10);
const dark=mat('#62564b'),pale=mat('#ddd2b7'),stitch=mat('#ae9578'),bronze=mat('#a88b60'),
 leather=mat('#806b58'),ink=mat('#484748'),linen=mat('#d7c8aa'),rice=mat('#bbac8b'),
 red=mat('#ae7060'),green=mat('#728774');
const Y=.78;
function block(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=leather){
 const a=new THREE.Mesh(boxGeo,m);a.scale.set(w,h,d);a.position.set(x,y-Y,z);
 a.castShadow=true;parent.add(a);return a;
}
function volume(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material=leather){
 const a=new THREE.Mesh(sphereGeo,m);a.scale.set(w,h,d);a.position.set(x,y-Y,z);
 a.castShadow=true;parent.add(a);return a;
}
function brim(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number,m:THREE.Material=rice){
 const a=new THREE.Mesh(discGeo,m);a.scale.set(r,h,r);a.position.set(x,y-Y,z);
 a.castShadow=true;parent.add(a);return a;
}
function strap(parent:THREE.Object3D,s:number,y:number,material:THREE.Material,rotation=0){
 const a=block(parent,s*.19,y,.17,.075,.65,.08,material);a.rotation.z=rotation||s*.22;
}
function hairTie(parent:THREE.Object3D,color:THREE.Material){
 for(const sx of [-1,1]){
  const a=block(parent,sx*.24,1.45,.02,.11,.20,.16,color);a.rotation.z=sx*.15;
 }
 volume(parent,0,1.74,-.08,.15,.10,.12,color);
}
export interface CharacterCostume{
 hems:THREE.Group[];cape:THREE.Group|null;hat:THREE.Group|null;
 workStrap:THREE.Group|null;
}
function panel(parent:THREE.Group,s:number,length:number,cloth:THREE.Material):THREE.Group{
 const panelGroup=new THREE.Group();panelGroup.position.set(s*.24,.81-Y,-.07);parent.add(panelGroup);
 const mesh=new THREE.Mesh(coneGeo,cloth);mesh.scale.set(.18,length,.13);
 mesh.position.set(0,-length*.43,0);mesh.castShadow=true;panelGroup.add(mesh);
 const piping=new THREE.Mesh(boxGeo,stitch);piping.scale.set(.13,.035,.15);
 piping.position.set(0,-length*.89,.01);panelGroup.add(piping);
 return panelGroup;
}
function buildPack(parent:THREE.Object3D,bodyColor:THREE.Material,w=.44,h=.55){
 block(parent,0,.96,-.30,w,h,.28,bodyColor);
 for(const sx of [-1,1])strap(parent,sx,1.06,dark,sx*.17);
 block(parent,0,1.23,-.46,w+.04,.12,.08,stitch);
}
function woodenTool(parent:THREE.Object3D,x:number,z:number,kind:'axe'|'staff'){
 const stick=block(parent,x,.91,z,.055,.68,.06,leather);
 stick.rotation.z=.42;
 if(kind==='axe')block(parent,x+.16,1.19,z,.26,.18,.055,ink);
}
export function dressCharacter(upper:THREE.Group,v:Villager):CharacterCostume{
 const base=mat(v.color),secondary=mat(new THREE.Color(v.color).multiplyScalar(.78).getStyle());
 const trim=v.id===8||v.id===9?red:stitch;
 const hems=[panel(upper,-1,.36,secondary),panel(upper,1,.39,secondary)];
 const capeG=new THREE.Group();capeG.position.set(0,1.14-Y,-.15);upper.add(capeG);
 const cape=block(capeG,0,Y-.25,-.08,.49,.63,.075,secondary);
 cape.rotation.x=.14;capeG.visible=[1,7,8,9,10].includes(v.id);
 // Shared tunic structure, cuffs, sash and readable layered neckline.
 block(upper,0,1.08,.235,.34,.22,.10,secondary);
 block(upper,0,.83,.24,.47,.075,.12,trim);
 block(upper,0,.79,.285,.14,.11,.13,pale);
 for(const sx of [-1,1]){
  block(upper,sx*.235,1.07,.085,.11,.19,.19,base);
  block(upper,sx*.245,.94,.17,.11,.075,.11,trim);
 }
 const hat=new THREE.Group();hat.name='profession-headwear';upper.add(hat);hat.visible=false;
 let workStrap:THREE.Group|null=null;
 switch(v.id){
  case 1: // Forest woodcutter: broad vest, strapped axe and shoulder cloak.
   block(upper,0,1.18,.24,.40,.48,.13,leather);
   for(const sx of [-1,1])strap(upper,sx,1.13,rice,sx*.27);
   buildPack(upper,leather,.47,.40);
   woodenTool(upper,-.42,-.33,'axe');
   break;
  case 2: // Innkeeper: apron and a clear tied bow at the back.
   block(upper,0,.66,.38,.43,.65,.08,linen);
   block(upper,0,.95,.38,.46,.08,.11,dark);
   for(const sx of [-1,1]){
    const sash=block(upper,sx*.29,.67,-.18,.11,.37,.05,linen);sash.rotation.z=sx*.16;
   }
   hairTie(upper,dark);
   break;
  case 3: // Tea farmer: gathered cloth around shoulders and bamboo basket.
   block(upper,0,1.20,.16,.51,.19,.16,green);
   buildPack(upper,rice,.49,.42);
   brim(hat,0,0,0,.43,.055,rice);
   brim(hat,0,.17,0,.23,.21,stitch);
   hat.visible=true;
   break;
  case 4: // Herb gatherer: double shawl, pouches and lighter basket.
   for(const sx of [-1,1]){
    const shoulder=block(upper,sx*.21,1.18,.15,.22,.41,.12,green);
    shoulder.rotation.z=sx*.22;
   }
   block(upper,.34,.67,.28,.24,.30,.15,rice);
   brim(hat,0,0,0,.35,.04,rice);hat.visible=true;
   break;
  case 5: // Traveling peddler: hanging large backpack and narrow traveling scarf.
   buildPack(upper,leather,.54,.68);
   block(upper,.35,.75,.29,.24,.40,.18,rice);
   strap(upper,-1,1.19,red,-.22);
   break;
  case 6: // Weaver: short inner vest and headcloth framing the face.
   block(upper,0,1.12,.22,.43,.30,.09,pale);
   hairTie(upper,rice);
   for(const sx of [-1,1]){
    const ribbon=block(upper,sx*.32,.99,.15,.15,.39,.13,linen);
    ribbon.rotation.z=sx*.17;
   }
   break;
  case 7: // Fisherman: unmistakable broad sun hat and net satchel.
   brim(hat,0,0,0,.55,.075,rice);
   brim(hat,0,.18,0,.27,.25,stitch);hat.visible=true;
   buildPack(upper,green,.42,.45);
   workStrap=new THREE.Group();workStrap.position.set(-.32,1.05-Y,-.31);upper.add(workStrap);
   for(let n=0;n<3;n++)block(workStrap,-.12+n*.11,Y-.14,-.10,.04,.57,.045,rice);
   break;
  case 8: // A-Qing: fitted training jacket, contrasting sash and strapped sheath.
   block(upper,0,1.15,.23,.43,.36,.15,secondary);
   for(const sx of [-1,1])strap(upper,sx,1.11,red,sx*.21);
   block(upper,-.34,.83,-.22,.14,.73,.16,leather).rotation.z=-.22;
   block(upper,0,.69,.31,.48,.14,.11,red);
   break;
  case 9: // Veteran swordsman: long layered cape and sword scabbard.
   block(upper,-.39,.98,-.20,.17,.90,.18,ink).rotation.z=-.18;
   block(upper,0,.87,.30,.44,.13,.08,rice);
   for(const sx of [-1,1])strap(upper,sx,1.14,rice,sx*.35);
   break;
  case 10: // Visiting merchant with a wide, overloaded luggage silhouette.
   buildPack(upper,rice,.62,.62);block(upper,.33,.85,.22,.33,.37,.23,stitch);
   break;
  default: // Junior swordsman.
   block(upper,0,1.16,.25,.39,.29,.13,green);
   block(upper,0,.78,.30,.45,.095,.10,rice);
 }
 // Fine face/hair details stay subtle and do not dominate the miniature view.
 return {hems,cape:capeG,hat:hat.visible?hat:null,workStrap};
}
