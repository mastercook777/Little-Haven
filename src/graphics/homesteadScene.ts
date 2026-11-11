import * as THREE from 'three';
import type {VillageParcel} from '../simulation/villagePlanning.ts';
import {pioneerV6HomesteadPlan,type PioneerV6Style} from '../simulation/homesteadPlan.ts';
import {makePioneerMountainRoof,dressPioneerCottage} from './pioneerHeritageArt.ts';
import {buildPioneerRoof,type PioneerRoofProfile} from './pioneerRoof.ts';

/** Phase A authored lots. The full footprint belongs to ONE real building
 * registry entry, and does not appear until residents pay and construct it. */
const cube=new THREE.BoxGeometry(1,1,1);
const cylinder=new THREE.CylinderGeometry(1,1,1,7);
const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.95});
const earth=mat('#a98e69'),track=mat('#c1a57b'),stone=mat('#948b76');
const mortar=mat('#bfb09a'),darkTimber=mat('#67513d'),wood=mat('#997454');
const thatch=mat('#a99562'),reed=mat('#ceb983'),paper=mat('#e9d9b5');
const slab=mat('#b9ab91'),clay=mat('#c9aa8c'),winter=mat('#d9d6ca');
function part(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,name?:string){
 const o=new THREE.Mesh(cube,m);o.position.set(x,y,z);o.scale.set(w,h,d);
 if(name)o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function upright(parent:THREE.Object3D,x:number,y:number,z:number,r:number,h:number){
 const o=new THREE.Mesh(cylinder,darkTimber);o.position.set(x,y,z);
 o.scale.set(r,h,r);o.castShadow=true;parent.add(o);return o;
}
function group(parent:THREE.Object3D,x=0,y=0,z=0,name?:string){
 const g=new THREE.Group();g.position.set(x,y,z);if(name)g.name=name;parent.add(g);return g;
}
/** Exact roof envelope drives both the mesh and rain contact sockets. */
export function pioneerV6Roof(style:PioneerV6Style):PioneerRoofProfile{
 if(style==='H1-thatch')return {halfWidth:1.31,halfDepth:1.22,eaveY:1.85,ridgeY:2.22,thickness:.13};
 if(style==='H3-wing')return {halfWidth:1.80,halfDepth:1.37,eaveY:2.27,ridgeY:2.95,thickness:.11};
 if(style==='W1-open-yard')return {halfWidth:1.67,halfDepth:1.28,eaveY:1.96,ridgeY:2.38,thickness:.10};
 return {halfWidth:1.68,halfDepth:1.34,eaveY:2.17,ridgeY:2.78,thickness:.10};
}
/** Returns null for legacy model test samples: no visual overlap. */
export function makeV6Homestead(
 parent:THREE.Object3D,parcel:VillageParcel,phase:'foundation'|'frame'|'complete',
 condition=100,craftReady=false,loftReady=false):THREE.Group|null{
 const plan=pioneerV6HomesteadPlan(parcel);if(!plan)return null;
 const g=group(parent,parcel.x,plan.padY,parcel.z,'v06-'+plan.styleId+'-'+phase);
 // Three.js +Y rotates local +Z toward +X; zoning/entrance uses the
 // opposite signed XZ rotation. Keep visual door aligned with saved A* gate.
 g.rotation.y=-parcel.rotation;g.userData.buildingId=parcel.id;
 g.userData.homesteadStyle=plan.styleId;
 const b=plan.building,yard=plan.yard,gate=plan.gate;
 const house=plan.kind==='home',style=plan.styleId,roof=pioneerV6Roof(style);
 // The hard-packed yellow soil is NOT a free permanent site at day zero:
 // its mesh is only in the paid, surveyed building's construction registry.
 part(g,0,.025,yard.z,yard.width,.048,yard.depth,house?track:earth,'paid-working-ground');
 // Stone/rammed earth foundation registers visibly from the first labor phase.
 part(g,b.x,.088,b.z,b.width+.28,.17,b.depth+.28,house?stone:slab,'paid-foundation');
 if(phase==='foundation')return g;
 const body=group(g,b.x,0,b.z,'real-main-building-volume');
 const h=style==='H1-thatch'?1.53:style==='H3-wing'?2.01:style==='W1-open-yard'?1.68:1.85;
 // Full rear/side footprint, instead of another miniature roof dropped on a
 // flat 3x3 plot. The complete lot is already collision checked by SAT.
 for(const x of [-b.width/2+.13,b.width/2-.13])
  for(const z of [-b.depth/2+.15,b.depth/2-.15])
   upright(body,x,.24+h/2,z,.080,h);
 for(const z of [-b.depth*.45,b.depth*.45])
  part(body,0,h+.23,z,b.width,.13,.16,wood);
 if(house){
  const plaster=style==='H1-thatch'?clay:mortar;
  part(body,0,.30+h*.46,-b.depth*.47,b.width-.18,h*.86,.16,plaster);
  for(const x of [-b.width*.46,b.width*.46])
   part(body,x,.30+h*.46,0,.15,h*.86,b.depth-.23,plaster);
  // Doorway is a real break in the front wall, not a dark rectangle pasted on.
  const panel=(b.width-.82)/2;
  for(const sign of [-1,1])
   part(body,sign*(.41+panel/2),.27+h*.43,b.depth*.485,panel,h*.82,.16,plaster);
  part(body,0,h+.04,b.depth*.485,.94,.36,.18,wood);
  if(phase==='complete')dressPioneerCottage(body,b.width,b.depth,h,parcel.id);
 }else{
  // Open-sided timber work hall, emphatically NOT a cottage without windows.
  for(const x of [-b.width*.41,b.width*.41])
   part(body,x,.99,-b.depth*.40,.12,1.11,.15,wood);
  part(body,0,1.25,-b.depth*.45,b.width*.92,.10,.14,wood);
 }
 if(house&&style!=='H1-thatch'){
  makePioneerMountainRoof(body,roof,'cottage',style==='H3-wing'?1:0,condition);
 }else{
  buildPioneerRoof(body,roof,house?thatch:mat('#7d7868'),darkTimber,wood,house?reed:undefined);
  // Simple coherent frost on both slopes of the straw roof; not an extra
  // hovering rectangular snow tile. Seasonal visibility follows the scene.
  if(house){
   const frost=group(body,0,0,0,'seasonally-frosted-authored-roof');
   frost.userData.seasonalRoofSnow=true;frost.visible=false;
   for(const side of [-1,1]){
    const strip=part(frost,side*.69,2.01,0,.80,.027,2.13,winter);
    strip.rotation.z=side===1?-.27:.27;
   }
  }
 }
 if(phase!=='complete')return g;
 if(house){
  // A household entrance across real stone tread / earth courtyard.
  const front=b.z+b.depth/2;
  part(g,0,.062,(front+gate.z)/2,.92,.068,gate.z-front,earth,'household-footpath');
  // The actual saved route ends outside the full SAT; bridge its last meter
  // to the visible gate without painting a fake settlement-wide road.
  const outside=parcel.depth/2+parcel.clearance+.52;
  part(g,0,.045,(gate.z+outside)/2,.90,.05,outside-gate.z,
   earth,'household-gate-to-real-road');
  for(let i=0;i<3;i++)part(g,0,.087+i*.021,front+.16+i*.22,1.06-i*.04,.07,.20,slab);
  const sideX=yard.width/2-.08,wallY=.23;
  // Low wall on three sides, with 1.10-unit clear gate at +Z.
  for(const x of [-sideX,sideX])
   part(g,x,wallY,yard.z,.15,.34,yard.depth,stone,'real-courtyard-sidewall');
  const wingW=(yard.width-gate.opening)/2;
  for(const sign of [-1,1]){
   part(g,sign*(gate.opening/2+wingW/2),wallY,gate.z,
    wingW,.34,.16,stone,'real-courtyard-gatewall');
   upright(g,sign*gate.opening/2,.34,gate.z,.075,.52);
  }
  part(g,0,.19,yard.z-yard.depth/2,yard.width,.06,.11,stone);
  // A side service wing is paid as H3 and already reserved in the large lot.
  // Each home owns its secondary silhouette *inside the surveyed and paid
  // parcel*. These are inhabited extensions or functional verandas, not
  // free-standing decorative homes with phantom inhabitants.
  if(style==='H1-thatch'){
   const ribs=group(body,0,0,0,'low-thatch-roof-rhythm');
   // Long light reed seams reinforce the low straw roof at this camera scale.
   for(const side of [-1,1])for(const z of [-.75,.03,.78]){
    const tie=part(ribs,side*.81,2.065,z,.092,.085,.16,reed,'real-thatch-ridge-tie');
    tie.rotation.z=side===1?-.27:.27;
   }
   // A modest wood drying pole is located in the actual front courtyard.
   for(const x of [-.77,.77])upright(g,x,.69,gate.z-.69,.049,.98);
   part(g,0,1.20,gate.z-.69,1.64,.09,.10,wood,'thatched-house-drying-rail');
  }else if(style==='H2-farmyard'){
   // A broad low side veranda breaks the H2 house into a main tiled volume
   // and a sheltered working edge, instead of another identical blue box.
   const veranda=group(g,b.width/2+.12,0,b.z+.26,'farmyard-attached-veranda');
   part(veranda,.01,.13,0,1.02,.20,1.67,stone,'farmyard-veranda-stone-step');
   for(const z of [-.67,.67])upright(veranda,.43,1.00,z,.075,1.63);
   const eave=part(veranda,.10,1.91,0,1.00,.16,1.86,darkTimber,'farmyard-veranda-sloping-eave');
   eave.rotation.z=-.18;
   for(const z of [-.56,.54])
    part(veranda,.12,1.81,z,1.00,.045,.10,wood);
   part(veranda,.30,.69,-.45,.56,.73,.13,clay,'real-farmyard-kitchen-bench');
   part(g,0,.52,gate.z,1.35,.15,.17,wood,'farmyard-timber-gate-lintel');
  }else if(style==='H3-wing'){
   // The wide side wing has a distinct lower roofline and genuine wall
   // volume. It is included in H3's 5.25-unit reserved plot and paid labor.
   const wing=group(g,b.width/2+.34,0,b.z+.10,'paid-side-work-wing');
   part(wing,0,1.03,0,1.07,1.81,1.70,clay,'wing-inhabited-volume');
   for(const z of [-.65,.65])
    part(wing,-.03,1.09,z,1.12,.10,.15,darkTimber);
   part(wing,.17,1.02,.855,.40,.48,.05,paper,'wing-front-window');
   const lean=part(wing,.06,2.04,0,1.14,.17,2.00,darkTimber,'wing-separate-roof-plane');
   lean.rotation.z=-.21;
   for(const z of [-.70,0,.70]){
    const tile=part(wing,.03,2.16,z,1.08,.035,.14,slab);
    tile.rotation.z=-.21;
   }
   part(g,0,1.06,gate.z,1.55,.16,.22,darkTimber,'wing-courtyard-gate-header');
   for(const x of [-.63,.63])upright(g,x,.64,gate.z,.067,.98);
   const cap=part(g,0,1.24,gate.z,1.76,.17,.55,slab,'wing-tiled-entry-canopy');
   cap.rotation.z=-.035;
  }
  if(loftReady){
   const tall=style==='H3-wing';
   const loft=group(body,tall?-.53:.72,roof.eaveY+.11,tall?-.19:.19,'paid-residential-loft');
   const w=tall ? .90 : style==='H2-farmyard' ? .78 : .57;
   const lift=tall ? .64 : .43;
   part(loft,0,lift*.45,0,w,lift,.36,style==='H1-thatch'?clay:mortar,
    'visible-paid-dormer-body');
   part(loft,0,lift*.45,.20,w*.61,.29,.05,paper,'paid-dormer-window');
   for(const side of [-1,1]){
    const lid=part(loft,side*w*.26,lift+.10,0,w*.57,.09,.65,
     style==='H1-thatch'?thatch:darkTimber,'paid-dormer-real-roof');
    lid.rotation.z=side===1?-.27:.27;
   }
  }
 }else{
  // Raw logs, work apron and two open racks; the advanced saw appears ONLY
  // when the separate real crafting work is saved as complete.
  const lane=group(g,0,0,yard.z,'actual-wood-working-apron');
  for(const x of [-yard.width*.42,yard.width*.42]){
   for(const z of [-yard.depth*.27,yard.depth*.27])upright(lane,x,.52,z,.062,.76);
   part(lane,x,.93,0,.12,.10,yard.depth*.94,wood);
  }
  for(let k=0;k<5;k++)
   part(lane,-yard.width*.33+k*.25,.24,-yard.depth*.20,.18,.15,1.12,
    k%2?wood:darkTimber,'drying-cut-timber');
  part(body,.54,.73,.25,1.02,.14,.59,wood,'basic-hand-worktable');
  if(craftReady){
   const bench=group(body,-.70,0,.43,'actual-crafted-sawbench');
   part(bench,0,.82,0,1.04,.13,.44,wood);
   for(const x of [-.39,.39])upright(bench,x,.42,0,.065,.75);
   const saw=part(bench,.14,1.02,-.13,.07,.43,.07,stone);
   saw.rotation.z=.35;
  }
 }
 return g;
}
