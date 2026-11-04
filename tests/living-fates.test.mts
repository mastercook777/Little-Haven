import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {considerPioneerMigration} from '../src/simulation/pioneerGrowth.ts';
import {generatePersonLife,pioneerCultivationMultiplier,settleLivingFatesHour,
 validateLivingFates} from '../src/simulation/livingFates/peopleState.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';

test('v0.4.4-A: identities are stable, six origins reachable, founders keep old canon',()=>{
 const origins=new Set<string>();
 for(let seed=1;seed<=96;seed++){
  const a=generatePersonLife(seed,{id:4,role:'园丁'},4000);
  const b=generatePersonLife(seed,{id:4,role:'园丁'},4000);
  assert.deepEqual(a,b);
  origins.add(a.origin);
 }
 assert.equal(origins.size,6);
 const s=createPioneerWorld(42,1000);
 assert.deepEqual(s.founders.map(f=>[f.id,f.name]),[[1,'梁伯'],[2,'陆娘'],[3,'阿禾']]);
 assert.equal(Object.keys(s.livingFates.people).length,3);
 assert.equal(s.livingFates.relationships.length,0);
 assert.equal(Object.keys(s.livingFates.majorMemories).length,0);
 assert.equal(validateLivingFates(s),true);
 const publicCard=inspectPioneerSelection(s,{kind:'person',id:'1'});
 assert.equal(publicCard?.title,'梁伯');
 assert.ok(publicCard?.facts.some(x=>x.label==='眼前的营生'));
 const privateSecret=s.livingFates.people[1].privateFacts;
 assert.ok(!JSON.stringify(publicCard).includes('privateFacts'));
 for(const tag of privateSecret.tags)assert.ok(!JSON.stringify(publicCard).includes(tag));
 assert.equal(inspectPioneerSelection(s,{kind:'person',id:'999'}),null);
});

test('v0.4.4-A: old v4 saves gain profiles without fabricating history or changing economy',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*2*DAY_MINUTES-s.minutes)/3);
 const old=structuredClone(s) as unknown as Record<string,unknown>;
 delete old.livingFates;
 const restored=importPioneerWorld(JSON.stringify(old));
 assert.ok(restored);
 assert.deepEqual(restored.founders,s.founders);
 assert.deepEqual(restored.buildings,s.buildings);
 assert.deepEqual(restored.resources,s.resources);
 assert.deepEqual(restored.journal,s.journal);
 assert.deepEqual(restored.roads,s.roads);
 assert.equal(Object.keys(restored.livingFates.people).length,restored.founders.length);
 assert.equal(restored.livingFates.relationships.length,0);
 assert.equal(Object.keys(restored.livingFates.majorMemories).length,0);
 for(const f of restored.founders){
  const person=restored.livingFates.people[f.id];
  assert.equal(person.arrivalKnown,f.id<=3,
   'older migrant arrival dates are unknown, but founders share the known opening');
  assert.equal(person.arrivalAt,f.id<=3?8*60+20:restored.minutes,
   'an imported past cannot fabricate a migrant arrival timestamp');
 }
 assert.equal(validateLivingFates(restored),true);
 assert.deepEqual(importPioneerWorld(JSON.stringify(restored)),restored);
});

test('v0.4.4-A: candidate persists before admission and is not a phantom resident',()=>{
 const s=createPioneerWorld(99,1000);
 s.minutes=7*DAY_MINUTES+60;
 s.resources.food=0;
 assert.equal(considerPioneerMigration(s),false);
 const pending=structuredClone(s.livingFates.pendingCandidate);
 assert.ok(pending);
 assert.equal(pending.id,4);
 assert.equal(s.founders.length,3);
 assert.equal(Object.keys(s.livingFates.people).length,3);
 assert.equal(considerPioneerMigration(s),false);
 assert.deepEqual(s.livingFates.pendingCandidate,pending);
 assert.deepEqual(importPioneerWorld(JSON.stringify(s))?.livingFates.pendingCandidate,pending);
});

test('v0.4.4-B: no labor or relationship credit from idle bodies',()=>{
 const s=createPioneerWorld(42,1000);
 s.founders[0].activity='rest';
 s.founders[1].activity='rest';
 s.founders[0].target=[1,1];s.founders[1].target=[1,1];
 settleLivingFatesHour(s);
 assert.deepEqual(s.livingFates.relationships,[]);
 assert.equal(s.livingFates.people[1].skills.wayfinding.xp,0);
 assert.equal(s.livingFates.people[2].skills.cultivation.xp,0);
});

test('v0.4.4-B: real hourly work, meals, and bonds persist across long simulations',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*3*DAY_MINUTES-s.minutes)/3);
 assert.ok(s.founders.length>=6);
 assert.equal(Object.keys(s.livingFates.people).length,s.founders.length);
 assert.ok(s.livingFates.relationships.some(e=>e.sharedMeals>0));
 assert.ok(s.livingFates.relationships.some(e=>e.sharedWorkHours>0));
 assert.ok(Object.values(s.livingFates.people).some(p=>
  p.skills.cultivation.xp>0||p.skills.wayfinding.xp>0));
 assert.ok(s.livingFates.relationships.every(e=>e.a<e.b));
 assert.ok(s.livingFates.relationships.every(e=>e.trust<=60&&e.closeness<=60));
 const memoryCount=Object.keys(s.livingFates.majorMemories).length;
 assert.ok(memoryCount<=36,'memory table must stay bounded by real relationships');
 assert.equal(validateLivingFates(s),true);
 const restored=importPioneerWorld(JSON.stringify(s));
 assert.deepEqual(restored,s);
 // A trained field worker can harvest only from real stocked fields, never
 // directly add food by reading a person profile.
 const experienced=s.founders.find(f=>s.livingFates.people[f.id].skills.cultivation.level>0);
 if(experienced)assert.ok(pioneerCultivationMultiplier(s,experienced.id)>1);
});

test('v0.4.4-B: time partitioning cannot duplicate relationship or skill gains',()=>{
 const a=createPioneerWorld(20261103,1000),b=createPioneerWorld(20261103,1000);
 advancePioneerWorld(a,18000);
 for(let i=0;i<15;i++)advancePioneerWorld(b,1200);
 assert.deepEqual(b.livingFates,a.livingFates);
 assert.deepEqual(b.resources,a.resources);
 assert.deepEqual(b.founders,a.founders);
});

test('v0.4.4: reject forged or inconsistent saved social records',()=>{
 const s=createPioneerWorld(42,1000);
 const extra=structuredClone(s);
 extra.livingFates.people[1].skills.cultivation.level=7;
 assert.equal(importPioneerWorld(JSON.stringify(extra)),null);
 const phantom=structuredClone(s);
 phantom.livingFates.relationships.push({id:'1-42',a:1,b:42,
  trust:1,closeness:0,sharedWorkHours:12,sharedMeals:0,memoryIds:[]});
 assert.equal(importPioneerWorld(JSON.stringify(phantom)),null);
 const future=structuredClone(s);
 future.livingFates.people[1].arrivalAt=s.minutes+5000;
 assert.equal(importPioneerWorld(JSON.stringify(future)),null);
 const duplicate=structuredClone(s);
 duplicate.livingFates.majorMemories['invented']={
  id:'invented',minute:s.minutes,actorIds:[1,2],kind:'shared-work',
  work:'farm',placeId:'imaginary',sourceEventIds:[]
 };
 assert.equal(importPioneerWorld(JSON.stringify(duplicate)),null);
});
