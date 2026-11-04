import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {createPioneerLivelihood,setPioneerDirection,pioneerMilestoneBoard,
 pioneerFoodCapacity,validPioneerLivelihood,PIONEER_CRAFT_WOOD} from '../src/simulation/pioneerLivelihood.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';
import {surveyPioneerPlot} from '../src/simulation/pioneerGrowth.ts';
import {findPioneerWalk,pioneerEntrance} from '../src/simulation/pioneerPaths.ts';
import {reservedParcels} from '../src/simulation/villagePlanning.ts';
import {getPioneerSpotlight} from '../src/ui/pioneerSpotlight.ts';

const round=(n:number)=>Math.round(n*1000)/1000;
function grow(s:ReturnType<typeof createPioneerWorld>,years=4){
 advancePioneerWorld(s,(48*years*DAY_MINUTES-s.minutes)/3);return s;
}
test('v0.5: zero-build village cannot instantly vote a new industry into existence',()=>{
 const s=createPioneerWorld(42,1000);
 const snapshot=structuredClone(s);
 assert.equal(setPioneerDirection(s,'river'),false);
 assert.equal(s.livelihood.direction,'autonomous');
 assert.deepEqual(s,snapshot);
 assert.equal(s.buildings.length,0);
 assert.equal(s.sites.some(x=>x.kind==='fish'),false);
 assert.equal(pioneerFoodCapacity(s),36);
 assert.equal(pioneerMilestoneBoard(s).filter(m=>m.done).length,0);
});
test('v0.5: existing v4 world migrates to neutral autonomous industries without fake work',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(9*DAY_MINUTES-s.minutes)/3);
 const old=structuredClone(s) as unknown as Record<string,unknown>;
 delete old.livelihood;
 const imported=importPioneerWorld(JSON.stringify(old));
 assert.ok(imported);
 assert.deepEqual(imported!.livelihood,createPioneerLivelihood());
 assert.equal(imported!.resources.food,s.resources.food);
 assert.deepEqual(imported!.buildings,s.buildings);
 assert.equal(validPioneerLivelihood(imported!),true);
 const broken=structuredClone(s);
 broken.livelihood.craft.phase='complete';
 broken.livelihood.craft.completedAt=s.minutes;
 assert.equal(importPioneerWorld(JSON.stringify(broken)),null);
});
test('v0.5: four years of actual autonomous resident work form a new livelihood, not only cottages',()=>{
 const s=grow(createPioneerWorld(42,1000),4);
 const kinds=s.buildings.map(b=>b.kind);
 const fish=s.sites.find(x=>x.kind==='fish');
 assert.ok(kinds.includes('fish-hut'),JSON.stringify({kinds,people:s.founders.length,
  phase:s.intent?.kind,report:s.journal.slice(-8),woods:s.resources.wood,
  surveys:s.frontier.clearings,food:s.resources.food}));
 assert.ok(fish,'completed fish hut must create one actual reachable fish reach');
 const hut=s.buildings.find(b=>b.kind==='fish-hut')!;
 assert.ok(hut.materialsSpent.wood>=7&&hut.workHours>=12);
 assert.ok(fish!.totalGathered>0,'fishing must produce actual food through labor');
 assert.ok(s.livelihood.firstFishAt!==null,'first successful catch must leave a real record');
 assert.ok(kinds.includes('granary'),'a settled population needs food storage past year two');
 assert.equal(pioneerFoodCapacity(s),54);
 assert.ok(s.founders.length>9,'population must be able to exceed original nine-person cap: '+
  JSON.stringify({people:s.founders.length,kinds,food:s.resources.food,wood:s.resources.wood,
   fields:s.sites.filter(x=>x.kind==='field').map(x=>x.stock),
   intent:s.intent?.kind,reason:s.intent?.pauseReason,
   clearing:s.frontier.clearings.map(c=>({id:c.id,phase:c.phase,x:c.x,z:c.z})),
   surveyAt:s.nextSurveyAt,minutes:s.minutes,history:s.journal.slice(-6).map(x=>x.title)}));
 const lofts=s.buildings.filter(b=>b.kind==='cottage'&&b.loftAddedAt!==undefined);
 assert.ok(lofts.length>0,'no false extra houses: exhausted centre should be able to convert one existing cottage');
 for(const home of lofts){
  assert.equal(home.loftWoodSpent,4,'the loft must consume real lumber');
  assert.equal(home.loftWorkHours,8,'the loft must consume actual resident shifts');
  assert.ok(home.loftAddedAt!>=home.completedAt);
  assert.ok(home.occupants.length<=3);
 }
 assert.ok(s.journal.some(e=>e.title==='山居木阁落成'),
  'a completed loft needs permanent causal history');
 assert.ok(s.founders.every(f=>f.homeBuildingId&&s.buildings.some(b=>b.id===f.homeBuildingId)));
 assert.ok(s.buildings.length<=20&&s.sites.length<=20&&s.roads.length<=20);
 const expected=s.journal.filter(x=>x.title==='河岸渔棚落成');
 assert.ok(expected.length<=1,'one facility cannot spontaneously re-complete');
 const fishing=pioneerMilestoneBoard(s).find(x=>x.id==='fish')!;
 assert.equal(fishing.done,true);
 const card=inspectPioneerSelection(s,{kind:'building',id:hut.id});
 assert.ok(card?.facts.some(x=>x.label==='真实总渔获'&&x.value.includes('份')));
 assert.ok(getPioneerSpotlight(s).selection.kind!=='site','the old first-night chapter must be gone');
 assert.ok(importPioneerWorld(JSON.stringify(s)),'a genuine year-four village must reload');
 const blockers=[...reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-')),
  ...s.buildings.filter(b=>b.id!==hut.id).map(b=>b.parcel)];
 assert.ok(findPioneerWalk([s.camp.x,s.camp.z],pioneerEntrance(hut.parcel),blockers));
});
test('v0.5: suggestions persist with causal records, no instant production, bounded grain storage',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(9*DAY_MINUTES-s.minutes)/3);
 assert.ok(s.buildings.some(b=>b.kind==='shelter'));
 const food=s.resources.food,wood=s.resources.wood,people=s.founders.length;
 assert.equal(setPioneerDirection(s,'fields'),true);
 assert.equal(setPioneerDirection(s,'fields'),false);
 assert.equal(s.livelihood.direction,'fields');
 assert.equal(s.resources.food,food);
 assert.equal(s.resources.wood,wood);
 assert.equal(s.founders.length,people);
 assert.equal(s.journal.at(-1)?.title,'守谷人提议生计方向');
 assert.ok(importPioneerWorld(JSON.stringify(s)));
});
