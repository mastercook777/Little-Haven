import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {PIONEER_SLOT_KEYS,PIONEER_VERSION,createPioneerWorld,advancePioneerWorld,
 importPioneerWorld,savePioneerWorld,loadPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {PIONEER_V6_LOTS,pioneerV6HomesteadPlan,pioneerV6PlanFits} from '../src/simulation/homesteadPlan.ts';
import {makeV6Homestead,pioneerV6Roof} from '../src/graphics/homesteadScene.ts';
import {pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import {validatePioneerParcel} from '../src/simulation/pioneerParcelRules.ts';
import {parcelOverlaps} from '../src/simulation/villagePlanning.ts';
import {pioneerNaturalParcels} from '../src/simulation/pioneerNaturalAnchors.ts';

test('v0.6 starts with three founders and no phantom houses or paid courtyards',()=>{
 const s=createPioneerWorld(42,1000);
 assert.equal(s.schemaVersion,6);
 assert.equal(s.founders.length,3);
 assert.equal(s.buildings.length,0);
 assert.equal(s.roads.length,0);
 assert.equal(PIONEER_VERSION,6);
 assert.equal(makeV6Homestead(new THREE.Group(),{
  id:'legacy',kind:'dwelling',x:0,z:0,width:3,depth:3,clearance:.3,
  rotation:0,accessX:0,accessZ:2,builtAt:0
 },'complete'),null);
});

test('v0.6 paid full-lot residential shapes and open workspace have actual gate and legal eaves',()=>{
 for(const lot of Object.values(PIONEER_V6_LOTS)){
  const p={id:'lot',kind:'dwelling' as const,x:-7,z:-6,
   width:lot.width,depth:lot.depth,clearance:.3,rotation:0,
   accessX:-7,accessZ:-6+lot.depth/2+.82,builtAt:0,homesteadStyle:lot.styleId};
  assert.ok(pioneerV6PlanFits(p),lot.styleId);
  const plan=pioneerV6HomesteadPlan(p)!;
  assert.equal(plan.styleId,lot.styleId);
  assert.ok(plan.gate.opening>=1.0);
  const roof=pioneerV6Roof(lot.styleId);
  assert.ok(roof.halfWidth*2<lot.width);
  assert.ok(plan.building.z-roof.halfDepth>-lot.depth/2);
  assert.ok(plan.building.z+roof.halfDepth<lot.depth/2);
  const parent=new THREE.Group();
  const foundation=makeV6Homestead(parent,p,'foundation')!;
  assert.ok(foundation.getObjectByName('paid-foundation'));
  assert.equal(foundation.getObjectByName('real-courtyard-gatewall'),undefined);
  const full=makeV6Homestead(parent,p,'complete',96,true,true)!;
  assert.ok(full.getObjectByName('paid-working-ground'));
  assert.ok(full.getObjectByName('real-main-building-volume'));
  if(plan.kind==='home'){
   assert.ok(full.getObjectByName('real-courtyard-gatewall'));
   assert.ok(full.getObjectByName('paid-residential-loft'));
  }else{
   assert.ok(full.getObjectByName('actual-wood-working-apron'));
   assert.ok(full.getObjectByName('actual-crafted-sawbench'));
   assert.equal(full.getObjectByName('mountain-double-leaf-door'),undefined);
  }
 }
});

test('v0.6 genuine five-year growth pays for complete lots without occupying the river, roots or prior roads',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*5*DAY_MINUTES-s.minutes)/3);
 const homes=s.buildings.filter(b=>b.kind==='cottage'&&b.parcel.homesteadStyle);
 const workshops=s.buildings.filter(b=>b.kind==='wood-yard'&&b.parcel.homesteadStyle);
 assert.ok(homes.length>=1,'real households must complete at least one family compound');
 assert.ok(workshops.length>=1,'workers must complete at least one open yard');
 const natural=pioneerNaturalParcels(s);
 for(const b of [...homes,...workshops]){
  assert.ok(pioneerV6PlanFits(b.parcel));
  assert.ok(b.materialsSpent.wood>=PIONEER_V6_LOTS[b.parcel.homesteadStyle!].wood);
  assert.ok(b.workHours>=PIONEER_V6_LOTS[b.parcel.homesteadStyle!].hours);
  assert.ok(validatePioneerParcel(b.parcel,natural,
   s.roads.filter(r=>r.buildingId!==b.id)).ok);
 }
 for(let i=0;i<s.buildings.length;i++)for(let j=0;j<i;j++)
  assert.equal(parcelOverlaps(s.buildings[i].parcel,s.buildings[j].parcel),false);
 const drips=pioneerRoofDrips(s);
 assert.equal(drips.length,s.buildings.filter(b=>
  ['cottage','wood-yard','granary','fish-hut','tea-stop'].includes(b.kind)).length*5);
 assert.deepEqual(importPioneerWorld(JSON.stringify(s))?.buildings,s.buildings);
});

test('v0.6 slots reject old world documents without deleting any old key',()=>{
 const old=createPioneerWorld(7,1000);
 const prior=JSON.stringify({...old,schemaVersion:4});
 assert.equal(importPioneerWorld(prior),null);
 assert.deepEqual(PIONEER_SLOT_KEYS,[
  'little-haven-pioneer-v06-slot-1','little-haven-pioneer-v06-slot-2']);
 const map=new Map<string,string>([
  ['little-haven-pioneer-v04-slot-1',prior],
  ['little-haven-living-v03-slot-1','old-classic']
 ]);
 const storage={
  getItem:(k:string)=>map.get(k)??null,
  setItem:(k:string,v:string)=>{map.set(k,v);}
 };
 const fresh=createPioneerWorld(42,1000);
 savePioneerWorld(fresh,storage,1000,1);
 const loaded=loadPioneerWorld(storage,1000,1);
 assert.equal(loaded.schemaVersion,6);
 assert.equal(loaded.buildings.length,0);
 assert.equal(map.get('little-haven-pioneer-v04-slot-1'),prior);
 assert.equal(map.get('little-haven-living-v03-slot-1'),'old-classic');
});
