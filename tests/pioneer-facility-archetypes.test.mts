import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 PIONEER_FACILITY_ARCHETYPES,pioneerFacilityArchetype,
 pioneerFacilityRoofDripProfile,pioneerFacilityEnvelopeSafe,
 PIONEER_GARDEN_STYLES,pioneerGardenStyle,type PioneerFacilityKind
} from '../src/graphics/pioneerFacilityArchetypes.ts';
import {buildPioneerFacilityVisual} from '../src/graphics/pioneerVillage.ts';
import {pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld}
 from '../src/simulation/pioneerWorld.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import type {VillageParcel} from '../src/simulation/villagePlanning.ts';

const kindSizes:Record<PioneerFacilityKind,[number,number]>={
 'wood-yard':[2.85,2.80],'fish-hut':[2.85,2.65],
 granary:[2.65,2.45],'tea-stop':[2.55,2.38]
};
const makeParcel=(id:string,kind:PioneerFacilityKind|'garden'):VillageParcel=>{
 const [width,depth]=kind==='garden'?[2.75,2.65]:kindSizes[kind];
 return {id,kind:'workshop',x:0,z:0,width,depth,rotation:0,clearance:.30,
  accessX:0,accessZ:0,builtAt:0};
};
function findVariant(kind:PioneerFacilityKind,id:string){
 for(let i=0;i<120;i++){
  const parcelId='authored-site-'+i;
  if(pioneerFacilityArchetype(kind,parcelId).id===id)return parcelId;
 }
 throw Error('no stable deterministic ID for '+id);
}
function meshes(root:THREE.Object3D,name:string){
 const objects:THREE.Object3D[]=[];
 root.traverse(o=>{if(o.name===name)objects.push(o);});
 return objects;
}

test('v0.5.6C: every real workplace has multiple stable physical roof silhouettes within its reserved parcel',()=>{
 for(const kind of Object.keys(PIONEER_FACILITY_ARCHETYPES) as PioneerFacilityKind[]){
  const shapes=PIONEER_FACILITY_ARCHETYPES[kind];
  assert.ok(shapes.length>=2,kind);
  assert.equal(new Set(shapes.map(a=>a.id)).size,shapes.length);
  const roofSignatures=new Set(shapes.map(a=>
   [a.roof.halfWidth,a.roof.halfDepth,a.roof.eaveY,a.roof.ridgeY].join('/')));
  assert.equal(roofSignatures.size,shapes.length,'color-only variation is insufficient: '+kind);
  for(const spec of shapes){
   const parcel=makeParcel(findVariant(kind,spec.id),kind);
   assert.equal(pioneerFacilityArchetype(kind,parcel.id).id,spec.id);
   assert.ok(pioneerFacilityEnvelopeSafe(spec,parcel),'roof exceeds paid plot: '+spec.id);
   const parent=new THREE.Group(),built=buildPioneerFacilityVisual(
    parent,parcel,kind,'complete',1,100,undefined,true,false);
   assert.equal(built.userData.facilityArchetype,spec.id);
   const roof=built.getObjectByName(
    kind==='granary'?'one-piece-upturned-roof':'pioneer-roof-assembly');
   assert.ok(roof,'missing actual authored roof: '+spec.id);
   const bounds=new THREE.Box3().setFromObject(roof);
   assert.ok(bounds.max.x<=parcel.width/2+parcel.clearance+.10,
    spec.id+' x roof exceeds paid parcel');
   assert.ok(bounds.min.x>=-parcel.width/2-parcel.clearance-.10);
   assert.ok(bounds.max.z<=parcel.depth/2+parcel.clearance+.10);
   assert.ok(bounds.min.z>=-parcel.depth/2-parcel.clearance-.10);
   const drizzle=pioneerFacilityRoofDripProfile(kind,parcel.id);
   assert.equal(drizzle[2],spec.roof.eaveY*spec.scale);
   if(kind==='fish-hut'){
    assert.equal(meshes(built,'visible-caught-fish').length,5);
    assert.equal(meshes(built,'pending-fish-basket').length,1);
   }
   if(kind==='granary')assert.equal(meshes(built,'stored-real-grain-jar').length,6);
   if(kind==='tea-stop')assert.equal(meshes(built,'roadside-tea-cup').length,3);
   if(kind==='wood-yard'){
    assert.equal(meshes(built,'actual-crafted-sawbench').length,1,
     'workbench must be tied to actual completed crafting');
   }
   if(spec.id==='F2-raised')assert.ok(built.getObjectByName('raised-fish-hut-landing'));
   if(spec.id==='G2-ventilated')assert.ok(built.getObjectByName('granary-ventilated-gallery'));
   if(spec.id==='T2-pavilion')assert.ok(built.getObjectByName('tea-stop-tall-lantern-bay'));
   if(spec.id==='W2-slat')assert.ok(built.getObjectByName('wood-yard-open-slat-wall'));
   if(spec.id==='W3-high')assert.ok(built.getObjectByName('wood-yard-high-loft-storage'));
  }
 }
});

test('v0.5.6C: work/food/tea detail is never placed on just a foundation',()=>{
 for(const kind of Object.keys(PIONEER_FACILITY_ARCHETYPES) as PioneerFacilityKind[]){
  const parcel=makeParcel('foundation-'+kind,kind);
  const foundation=buildPioneerFacilityVisual(
   new THREE.Group(),parcel,kind,'foundation',0);
  assert.ok(!foundation.getObjectByName('stored-real-grain-jar'));
  assert.ok(!foundation.getObjectByName('visible-caught-fish'));
  assert.ok(!foundation.getObjectByName('roadside-tea-cup'));
  assert.ok(!foundation.getObjectByName('actual-crafted-sawbench'));
  const uncrafted=buildPioneerFacilityVisual(
   new THREE.Group(),parcel,kind,'complete',1,100,undefined,false);
  assert.ok(!uncrafted.getObjectByName('actual-crafted-sawbench'));
 }
});

test('v0.5.6C: three gardens vary bed/fence arrangements without changing 28 authentic crop nodes',()=>{
 const found=new Set<string>();
 for(let i=0;i<160;i++){
  const parcel=makeParcel('garden-'+i,'garden');
  const style=pioneerGardenStyle(parcel.id);
  found.add(style);
  const model=buildPioneerFacilityVisual(
   new THREE.Group(),parcel,'garden','complete',1);
  assert.equal(model.userData.facilityArchetype,style);
  assert.equal(meshes(model,'real-garden-crop').length,28);
  if(style==='P2-raised-terrace')
   assert.equal(model.getObjectByName('real-garden-beds')?.rotation.y,Math.PI/2);
  if(style==='P3-woven-boundary')
   assert.ok(model.getObjectByName('woven-garden-boundary'));
  if(found.size===PIONEER_GARDEN_STYLES.length)break;
 }
 assert.deepEqual([...found].sort(),[...PIONEER_GARDEN_STYLES].sort());
});

test('v0.5.6C: mature autonomous village has genuine paid facility profiles and rain eaves exactly match',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*5*DAY_MINUTES-s.minutes)/3);
 const facilities=s.buildings.filter(b=>
  b.kind==='wood-yard'||b.kind==='fish-hut'||b.kind==='granary'||b.kind==='tea-stop');
 assert.equal(facilities.length,4,'real five-year economy still builds all four facility kinds');
 const drip=pioneerRoofDrips(s);
 assert.equal(drip.length,s.buildings.filter(b=>
  b.kind!=='shelter'&&b.kind!=='garden').length*5);
 for(const f of facilities){
  const kind=f.kind as PioneerFacilityKind;
  const [, ,height]=pioneerFacilityRoofDripProfile(kind,f.parcel.id);
  // The real mesh is y=.18 + scaled eave. The 5 emitter streams must
  // follow that mesh (not a stale constant baked before the archetype).
  const worldHeight=height+.18;
  assert.ok(drip.some(([,,z])=>Number.isFinite(z)));
  assert.ok(drip.some(([,y])=>Math.abs(y-worldHeight)<.00001),
   'rain streams detached from '+kind+' '+f.parcel.id);
 }
 const again=importPioneerWorld(JSON.stringify(s));
 assert.ok(again);
 assert.deepEqual(again!.buildings,s.buildings);
 assert.deepEqual(facilities.map(f=>pioneerFacilityArchetype(
  f.kind as PioneerFacilityKind,f.parcel.id).id),
  again!.buildings.filter(b=>facilities.some(f=>f.id===b.id)).map(f=>
   pioneerFacilityArchetype(f.kind as PioneerFacilityKind,f.parcel.id).id));
});
