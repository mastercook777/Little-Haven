import test from 'node:test';
import assert from 'node:assert/strict';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld}
 from '../src/simulation/pioneerWorld.ts';
import {nearestPioneerRoad,pioneerNeighborhoodScore}
 from '../src/simulation/pioneerNeighborhood.ts';
import {pioneerEntrance,findPioneerWalk,type PioneerRoad}
 from '../src/simulation/pioneerPaths.ts';
import {pioneerNaturalParcels} from '../src/simulation/pioneerNaturalAnchors.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import type {VillageParcel} from '../src/simulation/villagePlanning.ts';

const parcel=(x:number,z:number,rotation=0):VillageParcel=>({
 id:'candidate',kind:'dwelling',x,z,width:3.10,depth:2.95,
 rotation,clearance:.30,accessX:x,accessZ:z,builtAt:0
});
const road=(points:readonly (readonly [number,number])[]):PioneerRoad=>({
 id:'real-pioneer-road',buildingId:'real-cottage',
 points:[...points],uses:19,grade:'dirt',createdAt:123
});

test('v0.5.6D: road selection uses ONLY resident-created persistent road segments',()=>{
 assert.equal(nearestPioneerRoad(0,0,[]),null,
  'never fall back to an invisible v0.3 prebuilt path');
 const r=road([[-10,3],[0,3],[10,3]]);
 const near=nearestPioneerRoad(.7,0,[r]);
 assert.ok(near);
 assert.equal(near!.roadId,'real-pioneer-road');
 assert.ok(Math.abs(near!.distance-3)<1e-8);
 assert.ok(Math.abs(near!.point[0]-.7)<1e-8);
 assert.equal(near!.point[1],3);
});

test('v0.5.6D: a real nearby path makes the physical front door face the road',()=>{
 const s=createPioneerWorld(42,1000);
 s.roads=[road([[-10,3],[10,3]])];
 const north=parcel(0,0,0),west=parcel(0,0,Math.PI/2);
 const n=pioneerNeighborhoodScore(s,'cottage',north);
 const w=pioneerNeighborhoodScore(s,'cottage',west);
 assert.ok(n.roadDistance!==null&&w.roadDistance!==null);
 assert.ok(n.roadDistance!<w.roadDistance!);
 assert.ok(n.total<w.total,
  'front entrance facing real road must win without sacrificing parcel geometry');
 s.roads=[];
 const noRoad=pioneerNeighborhoodScore(s,'cottage',north);
 assert.equal(noRoad.roadDistance,null);
 assert.equal(noRoad.doorRoadPreference,0);
});

test('v0.5.6D: homes cluster, timber works approach forest, granaries approach actual gardens',()=>{
 const s=createPioneerWorld(42,1000);
 const oldHome={...parcel(0,0),id:'built-home'};
 s.buildings.push({id:'built-home',kind:'cottage',parcel:oldHome,
  completedAt:10,causeId:'paid',occupants:[],materialsSpent:{wood:9},
  workHours:15});
 const nearHome=pioneerNeighborhoodScore(s,'cottage',parcel(4.65,0));
 const farHome=pioneerNeighborhoodScore(s,'cottage',parcel(10.5,0));
 assert.ok(nearHome.neighborPreference<farHome.neighborPreference);
 const forest=s.sites.find(x=>x.kind==='forest')!;
 const closeForest=pioneerNeighborhoodScore(s,'wood-yard',parcel(forest.x+4.8,forest.z));
 const farForest=pioneerNeighborhoodScore(s,'wood-yard',parcel(forest.x+12,forest.z));
 assert.ok(closeForest.livelihoodPreference<farForest.livelihoodPreference);
 const garden={...parcel(1,6),id:'real-grown-garden'};
 s.buildings.push({id:'real-garden',kind:'garden',parcel:garden,
  completedAt:50,causeId:'paid',occupants:[],materialsSpent:{wood:3},
  workHours:6});
 const nearStore=pioneerNeighborhoodScore(s,'granary',parcel(5.2,6));
 const farStore=pioneerNeighborhoodScore(s,'granary',parcel(11.3,6));
 assert.ok(nearStore.livelihoodPreference<farStore.livelihoodPreference);
});

test('v0.5.6D: all new permanent buildings save REAL doorway coordinates and remain reachable',()=>{
 for(const seed of [42,20261103]){
  const s=createPioneerWorld(seed,1000);
  assert.equal(s.buildings.length,0);
  assert.equal(s.founders.length,3);
  advancePioneerWorld(s,(48*2*DAY_MINUTES-s.minutes)/3);
  assert.ok(s.buildings.length>=3,'authentic village should develop: '+seed);
  const natural=pioneerNaturalParcels(s);
  for(const b of s.buildings.filter(b=>b.kind!=='shelter')){
   const [x,z]=pioneerEntrance(b.parcel);
   assert.ok(Math.abs(b.parcel.accessX-x)<1e-5);
   assert.ok(Math.abs(b.parcel.accessZ-z)<1e-5);
   const blockers=[...natural,...s.buildings.filter(other=>other.id!==b.id).map(b=>b.parcel)];
   assert.ok(findPioneerWalk([s.camp.x,s.camp.z],[x,z],blockers),
    'new real entrance must be reachable, '+b.id+' seed '+seed);
  }
  const restored=importPioneerWorld(JSON.stringify(s));
  assert.ok(restored);
  assert.deepEqual(restored!.buildings,s.buildings,
   'old IDs/parcel/access/real wood and labor cannot be recreated on import');
  assert.deepEqual(restored!.roads,s.roads);
 }
});
