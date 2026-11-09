import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PIONEER_COTTAGE_ARCHETYPES,pioneerCottageArchetype,
 pioneerCottageOrdinal,cottageEnvelopeSafe} from '../src/graphics/pioneerArchetypes.ts';
import {makePioneerMountainRoof} from '../src/graphics/pioneerHeritageArt.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';

test('v0.5.6B: four cottage shapes change actual body width, height, roof profile and porch/bay silhouettes',()=>{
 const palette=PIONEER_COTTAGE_ARCHETYPES;
 assert.equal(palette.length,4);
 assert.equal(new Set(palette.map(x=>x.id)).size,4);
 assert.equal(new Set(palette.map(x=>x.bodyWidth)).size,4);
 assert.equal(new Set(palette.map(x=>x.wallHeight)).size,4);
 assert.ok(palette.find(x=>x.porch&&x.recessedFront>.1));
 assert.ok(palette.find(x=>x.sideBay));
 const parcel={width:3.10,depth:2.95,clearance:.30};
 for(let i=0;i<4;i++){
  const design=pioneerCottageArchetype(i);
  assert.ok(cottageEnvelopeSafe(design,parcel),design.id+' exceeds paid parcel');
  const p=new THREE.Group(),roof=makePioneerMountainRoof(p,design.roof,'cottage',i);
  const bb=new THREE.Box3().setFromObject(roof);
  assert.ok(bb.max.x<=parcel.width/2+parcel.clearance+.10);
  assert.ok(bb.min.x>=-parcel.width/2-parcel.clearance-.10);
  assert.ok(bb.max.z<=parcel.depth/2+parcel.clearance+.10);
  assert.ok(bb.min.z>=-parcel.depth/2-parcel.clearance-.10);
  assert.ok(bb.max.y>design.wallHeight);
  assert.ok(roof.getObjectByName('one-piece-upturned-roof'));
 }
 assert.equal(pioneerCottageArchetype(4).id,pioneerCottageArchetype(0).id);
});

test('v0.5.6B: chronological built cottage identity is deterministic, independent of array display order',()=>{
 const houses=[
  {id:'late',kind:'cottage',completedAt:900},
  {id:'middle',kind:'cottage',completedAt:500},
  {id:'early',kind:'cottage',completedAt:200},
  {id:'other',kind:'granary',completedAt:100},
  {id:'last',kind:'cottage',completedAt:1100}
 ];
 assert.deepEqual(houses.filter(x=>x.kind==='cottage').map(x=>
  pioneerCottageArchetype(pioneerCottageOrdinal(houses,x.id)).id),
 ['C3-porch','C2-broad','C1-gabled','C4-side-bay']);
 assert.equal(pioneerCottageOrdinal([...houses].reverse(),'early'),0);
});

test('v0.5.6B: actual mature valley gains different roofs, keeps all paid beds and rain runs from each roof',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*5*DAY_MINUTES-s.minutes)/3);
 const cottages=s.buildings.filter(b=>b.kind==='cottage');
 assert.ok(cottages.length>=3,
  'mature village must build at least three genuine cottages under existing resource rules');
 const ids=cottages.map(b=>pioneerCottageArchetype(
  pioneerCottageOrdinal(s.buildings,b.id)).id);
 assert.ok(new Set(ids).size>=3);
 const profiles=cottages.map(b=>pioneerCottageArchetype(
  pioneerCottageOrdinal(s.buildings,b.id)).roof);
 assert.ok(new Set(profiles.map(x=>x.ridgeY)).size>=3);
 const runoff=pioneerRoofDrips(s);
 const expected=s.buildings.filter(b=>
  ['cottage','granary','wood-yard','fish-hut','tea-stop'].includes(b.kind));
 assert.equal(runoff.length,expected.length*5);
 // Each cottage has five attached roof drips following the family eave
 // height, rather than inheriting v0.5.5's hard-coded 1.97 y.
 for(const b of cottages){
  const expectedY=pioneerCottageArchetype(pioneerCottageOrdinal(s.buildings,b.id)).roof.eaveY+.18;
  assert.ok(runoff.some(([,y])=>Math.abs(y-expectedY)<.002));
 }
 const restored=importPioneerWorld(JSON.stringify(s));
 assert.ok(restored);
 assert.deepEqual(restored!.buildings,s.buildings);
 assert.deepEqual(restored!.buildings.filter(b=>b.kind==='cottage').map(b=>
  pioneerCottageArchetype(pioneerCottageOrdinal(restored!.buildings,b.id)).id),ids);
});
