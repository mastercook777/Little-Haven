import * as THREE from 'three';
import type {VillageGrowthState,VillageDirection} from '../simulation/villageGrowth.ts';
import {batchStaticSubtree} from './batchStatic.ts';

/**
 * Makes the *original* village core evolve. Former versions only appended a
 * small new branch district while the starter tavern and five homes remained
 * visually frozen. These states swap complete, preauthored building volumes
 * and remodel the public floor area in four time-dependent stages.
 */
export interface ArchitecturePair{
 original:THREE.Group;renovated:THREE.Group;name:string;
}
export interface VillageCoreGrowth{
 update(growth:VillageGrowthState):void;signature():string;
 stage():number;centerBounds():THREE.Box3;deferredExpansions():string[];collidingPairs():string[];
}
/** Drawn volume (not just wall dimensions) is the safety envelope. */
export function modelOverlapXZ(a:THREE.Object3D,b:THREE.Object3D,minArea=.10):boolean{
 a.updateWorldMatrix(true,true);b.updateWorldMatrix(true,true);
 const x=new THREE.Box3().setFromObject(a),y=new THREE.Box3().setFromObject(b);
 if(x.isEmpty()||y.isEmpty())return false;
 const dx=Math.max(0,Math.min(x.max.x,y.max.x)-Math.max(x.min.x,y.min.x));
 const dz=Math.max(0,Math.min(x.max.z,y.max.z)-Math.max(x.min.z,y.min.z));
 return dx*dz>minArea&&Math.min(x.max.y,y.max.y)-Math.max(x.min.y,y.min.y)>.22;
}
export function maturityTier(g:VillageGrowthState):number{
 if(!g.choice)return 0;
 if(g.workDays>=78)return 4;
 if(g.workDays>=37)return 3;
 if(g.workDays>=16)return 2;
 if(g.workDays>=6)return 1;
 return 0;
}
const mat=(hex:string)=>new THREE.MeshStandardMaterial({
 color:hex,roughness:.99,side:THREE.DoubleSide
});
const S={
 stone:mat('#b9afa1'),river:mat('#9daca5'),warm:mat('#c5b696'),
 country:mat('#c0ae86'),boundary:mat('#827966'),timber:mat('#9a7658'),
 bark:mat('#6b6559'),cobble:mat('#a9a18f'),grass:mat('#89a58a')
};
function polygon(p:THREE.Object3D,pts:readonly (readonly [number,number])[],
 y:number,m:THREE.Material){
 const shape=new THREE.Shape();
 // XY to XZ with rotation -PI/2: invert source Y to preserve world +Z.
 shape.moveTo(pts[0][0],-pts[0][1]);
 for(let i=1;i<pts.length;i++)shape.lineTo(pts[i][0],-pts[i][1]);
 shape.closePath();
 const geo=new THREE.ShapeGeometry(shape);
 // A ShapeGeometry uses XY coordinates; rotate onto the ground XZ plane.
 const mesh=new THREE.Mesh(geo,m);mesh.rotation.x=-Math.PI/2;
 mesh.position.y=y;mesh.receiveShadow=true;mesh.name='public-place-paving';p.add(mesh);
 return mesh;
}
function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),m);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;
 mesh.castShadow=false;parent.add(mesh);return mesh;
}
function court(parent:THREE.Object3D,direction:VillageDirection,advanced:boolean){
 const g=new THREE.Group();parent.add(g);g.name='town-core-'+direction+(advanced?'-grown':'-repair');
 // Different materials tell the construction history of the central place:
 // paving is an actual *land-use transformation*, not a patch on a wall.
 const base=direction==='bridge'?S.stone:direction==='ferry'?S.river:S.country;
 const width=advanced?7.45:5.22;
 polygon(g,[[-3.15-width*.5,3.18],[-2.95+width*.5,3.11],
  [-2.83+width*.5,5.10],[-3.44-width*.5,5.02]],.252,base);
 // A radial path connects the old tavern square with the bridge or fields.
 const axis=direction==='bridge'?
  [[-.60,3.15],[1.22,2.80],[3.40,2.28],[5.90,2.25]]:
  direction==='ferry'?
  [[-1.20,4.10],[.58,3.5],[2.50,1.28],[4.95,-1.35]]:
  [[-5.9,3.9],[-7.1,2.7],[-8.7,.2],[-10.5,-2.30]];
 for(let i=0;i<axis.length-1;i++){
  const a=axis[i],b=axis[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
  const centerX=(a[0]+b[0])*.5,centerZ=(a[1]+b[1])*.5;
  const length=Math.hypot(dx,dz);
  const path=box(g,centerX,.251,centerZ,.90,.018,length+.22,base);
  path.rotation.y=Math.atan2(dx,dz);
 }
 if(advanced){
  // Architectural definition instead of filler clutter: long retaining curb,
  // one low public bench and a planted/washed center depending on identity.
  for(const z of [3.08,5.12])
   box(g,-3.2,.28,z,width*.86,.12,.105,S.boundary);
  if(direction==='grove'){
   polygon(g,[[-7.0,5.1],[-5.5,5.02],[-4.8,6.2],[-6.55,6.70]],.270,S.grass);
  }else if(direction==='ferry'){
   box(g,.54,.36,4.85,2.65,.22,.33,S.timber);
  }else{
   box(g,.84,.39,4.82,2.45,.22,.36,S.cobble);
  }
 }
 batchStaticSubtree(g,{disposeOriginals:false});
 return g;
}
export function makeVillageCoreGrowth(parent:THREE.Object3D,
 tavern:ArchitecturePair,homes:ArchitecturePair[]):VillageCoreGrowth{
 const root=new THREE.Group();root.name='village-core-maturity';parent.add(root);
 const courts=new Map<string,THREE.Group>();
 for(const dir of ['bridge','ferry','grove'] as const)
  for(const grown of [false,true]){
   const key=dir+(grown?'-grown':'-repair');
   const place=court(root,dir,grown);place.visible=false;courts.set(key,place);
  }
 const bounds=new THREE.Box3();
 let signature='';let tier=0;let deferred:string[]=[],currentCollisions:string[]=[];
 function update(g:VillageGrowthState){
  const next=maturityTier(g);
  const key=(g.choice||'none')+':'+next+':'+g.phase;
  if(signature===key)return;
  signature=key;tier=next;
  // Complete form replacement: no base box under a new decorative roof.
  // Start with every pre-growth shape. An upgrade can replace its original
  // only when its complete rendered roof/porch volume does not introduce a
  // NEW collision with its neighbors. Existing accidental proximity remains
  // visible for art rework; growth is not permitted to make it worse.
  deferred=[];
  const slots=[tavern,...homes],active=slots.map(slot=>slot.original);
  function attempt(slotIndex:number){
   const slot=slots[slotIndex],original=slot.original,expanded=slot.renovated;
   for(let j=0;j<active.length;j++){
    if(j===slotIndex)continue;
    const already=modelOverlapXZ(original,active[j]);
    const proposed=modelOverlapXZ(expanded,active[j]);
    if(proposed&&!already){
     deferred.push(slot.name);return;
    }
   }
   active[slotIndex]=expanded;
  }
  if(tier>=3)attempt(0);
  homes.forEach((slot,i)=>{
   if(tier>=[2,3,4,4,3][i]!)attempt(i+1);
  });
  slots.forEach((slot,i)=>{
   slot.original.visible=active[i]===slot.original;
   slot.renovated.visible=active[i]===slot.renovated;
  });
  currentCollisions=[];
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)
   if(modelOverlapXZ(active[i],active[j]))currentCollisions.push(slots[i].name+' × '+slots[j].name);
  courts.forEach((place,name)=>{
   const wants=g.choice!==null&&name.startsWith(g.choice);
   place.visible=wants&&(tier>=3?name.endsWith('-grown'):tier>=1&&name.endsWith('-repair'));
  });
 }
 // Initial presentation is the original structure, not a pre-renovated one.
 tavern.renovated.visible=false;
 for(const slot of homes)slot.renovated.visible=false;
 update({choice:null,phase:'quiet',decisionAt:0,deadlineAt:0,chosenAt:null,
  automatic:false,workDays:0,lastDayProcessed:0,wood:0,food:0,trade:0,prosperity:0,completedStages:[],
  plannerSeed:0,settlementLots:[],lastPlotAttemptDay:0,lastMigrationDay:0});
 return {
  update,signature:()=>signature,stage:()=>tier,deferredExpansions:()=>[...deferred],collidingPairs:()=>[...currentCollisions],
  centerBounds:()=>{
   bounds.makeEmpty();
   const active=tavern.original.visible?tavern.original:tavern.renovated;
   bounds.expandByObject(active);
   for(const h of homes){
    const m=h.original.visible?h.original:h.renovated;
    bounds.expandByObject(m);
   }
   return bounds.clone();
  }
 };
}
