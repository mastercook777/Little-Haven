import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {agePioneerBuildings} from '../src/simulation/pioneerGrowth.ts';
import {pioneerV6YardWalkable,PIONEER_V6_LOTS} from '../src/simulation/homesteadPlan.ts';
import {PIONEER_HOMESTEAD_PORCH,pioneerHomesteadPorchPoint} from '../src/simulation/pioneerHomesteadImprovement.ts';
import {advancePioneerWorld,createPioneerWorld,importPioneerWorld,type PioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {makeV6Homestead} from '../src/graphics/homesteadScene.ts';
import {pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import type {VillageParcel} from '../src/simulation/villagePlanning.ts';

function advanceTo(world:PioneerWorld,day:number){
 advancePioneerWorld(world,(day*DAY_MINUTES+720-world.minutes)/3);
}
function upgrades(world:PioneerWorld){
 return world.buildings.flatMap(b=>[
  ...(b.loftAddedAt===undefined?[]:[b.loftAddedAt]),
  ...(b.homesteadImprovement?[b.homesteadImprovement.completedAt]:[])
 ]);
}

test('v0.6.4 established households spend wood and labor on upgrades after year three',()=>{
 for(const seed of [42,20261296]){
  const world=createPioneerWorld(seed,1000);
  advanceTo(world,108);
  const oldSave=JSON.stringify(world);
  const knownHomes=structuredClone(world.buildings.filter(b=>b.occupants.length));
  const knownRoads=world.roads.map(r=>({id:r.id,points:structuredClone(r.points)}));
  assert.ok(knownHomes.length>=4,seed+' should actually have settled households');
  assert.equal(world.buildings.filter(b=>b.homesteadImprovement).length,0);
  const imported=importPioneerWorld(oldSave)!;
  assert.deepEqual(upgrades(imported),upgrades(world));

  const first=upgrades(world).length;
  advanceTo(world,132);
  const yearThree=upgrades(world).length;
  assert.ok(yearThree>first);
  advanceTo(world,204);
  const yearFive=upgrades(world).length;
  assert.ok(yearFive>yearThree);
  assert.ok(world.buildings.some(b=>b.homesteadImprovement));
  advanceTo(world,288);
  assert.ok(upgrades(world).length>yearFive);
  assert.equal(world.founders.length,12);
  const builtPorches=world.buildings.filter(b=>b.homesteadImprovement);
  assert.ok(builtPorches.length>=2);
  for(const home of knownHomes){
   const mature=world.buildings.find(b=>b.id===home.id)!;
   assert.deepEqual(mature.occupants,home.occupants);
   assert.deepEqual(mature.parcel,home.parcel);
  }
  for(const r of knownRoads)assert.deepEqual(world.roads.find(road=>road.id===r.id)?.points,r.points);
  for(const home of builtPorches){
   const porch=home.homesteadImprovement!;
   assert.ok(home.occupants.length>0);
   assert.ok(home.loftAddedAt!<porch.completedAt);
   assert.equal(porch.woodSpent,PIONEER_HOMESTEAD_PORCH.wood);
   assert.equal(porch.workHours,PIONEER_HOMESTEAD_PORCH.hours);
   assert.ok(pioneerV6YardWalkable(home.parcel,...pioneerHomesteadPorchPoint(home.parcel)!));
  }
  const restored=importPioneerWorld(JSON.stringify(world))!;
  assert.deepEqual(restored.buildings,world.buildings);
  assert.equal(pioneerRoofDrips(world).length-pioneerRoofDrips(imported).length,builtPorches.length*2);
 }
});

test('v0.6.4 porch construction resumes with its escrow and improves weather wear',()=>{
 const world=createPioneerWorld(42,1000);
 advanceTo(world,110);
 while(world.minutes<190*DAY_MINUTES){
  const intent=world.intent;
  if(intent?.kind==='homestead-improvement'&&intent.woodCommitted===intent.woodRequired&&
   intent.workDone<intent.workRequired)break;
  advancePioneerWorld(world,20);
 }
 const intent=world.intent!;
 assert.equal(intent.kind,'homestead-improvement');
 assert.equal(intent.woodCommitted,PIONEER_HOMESTEAD_PORCH.wood);
 const homeId=intent.targetBuildingId!;
 assert.equal(world.buildings.find(b=>b.id===homeId)?.homesteadImprovement,undefined);
 const resumed=importPioneerWorld(JSON.stringify(world))!;
 assert.deepEqual(resumed.intent,intent);
 const corrupt=structuredClone(world);
 corrupt.intent!.woodCommitted=0;
 assert.equal(importPioneerWorld(JSON.stringify(corrupt)),null);
 advancePioneerWorld(world,4*DAY_MINUTES/3);
 advancePioneerWorld(resumed,4*DAY_MINUTES/3);
 assert.deepEqual(resumed.resources,world.resources);
 assert.deepEqual(resumed.buildings,world.buildings);
 const home=world.buildings.find(b=>b.id===homeId)!;
 assert.equal(home.homesteadImprovement?.causeId,intent.id);
 const exposed=structuredClone(world);
 delete exposed.buildings.find(b=>b.id===homeId)!.homesteadImprovement;
 // Winter and rain both add wear on this exact daily boundary for seed 42.
 world.minutes=exposed.minutes=188*DAY_MINUTES;
 agePioneerBuildings(world);agePioneerBuildings(exposed);
 assert.ok(home.condition!>exposed.buildings.find(b=>b.id===homeId)!.condition!);
});

test('v0.6.4 the paid roof and bench remain inside all authored residential parcels',()=>{
 for(const style of ['H1-thatch','H2-farmyard','H3-wing'] as const){
  const {width,depth}=PIONEER_V6_LOTS[style];
  const p:VillageParcel={id:'porch-plan',kind:'dwelling',x:0,z:0,width,depth,
   rotation:0,clearance:.30,homesteadStyle:style,accessX:0,accessZ:0,builtAt:0};
  const make=(complete:boolean,paid:boolean)=>makeV6Homestead(
   new THREE.Group(),p,complete?'complete':'frame',100,false,true,paid)!;
  assert.equal(make(true,false).getObjectByName('paid-residential-work-porch'),undefined);
  assert.equal(make(false,true).getObjectByName('paid-residential-work-porch'),undefined);
  const porch=make(true,true).getObjectByName('paid-residential-work-porch')!;
  assert.ok(porch.getObjectByName('porch-household-workbench'));
  assert.deepEqual([porch.position.x,porch.position.z].map(n=>Math.round(n*1000)/1000),
   pioneerHomesteadPorchPoint(p));
  const box=new THREE.Box3().setFromObject(porch);
  assert.ok(box.min.x>-width/2&&box.max.x<width/2);
  assert.ok(box.min.z>-depth/2&&box.max.z<depth/2);
 }
});
