import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {createPioneerFishTransport,pioneerFoodCapacity,pioneerMilestoneBoard} from '../src/simulation/pioneerLivelihood.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';

const grow=(seed=42)=>{
 const s=createPioneerWorld(seed,1000);
 advancePioneerWorld(s,(48*4*DAY_MINUTES-s.minutes)/3);
 return s;
};

test('v0.5.3: four years deliver fish through paid carrying shifts instead of minting edible catches',()=>{
 const s=grow(),fish=s.sites.find(x=>x.kind==='fish');
 const hut=s.buildings.find(b=>b.kind==='fish-hut'),t=s.livelihood.fishTransport;
 assert.ok(fish&&hut,'fish must come from a built, reachable river hut');
 assert.ok(fish.totalGathered>0);
 assert.ok(t.haulHours>0&&t.totalDelivered>0,'fish require separate hauling shifts');
 assert.ok(t.totalDelivered<=fish.totalGathered+.002);
 assert.ok(!t.pending||t.totalDelivered+t.pending.amount<=fish.totalGathered+.002);
 assert.ok(t.lastDeliveredAt!==null&&t.lastDeliveredAt<=s.minutes);
 assert.equal(pioneerMilestoneBoard(s).find(x=>x.id==='fish-haul')?.done,true);
 const card=inspectPioneerSelection(s,{kind:'building',id:hut.id});
 assert.ok(card?.facts.some(x=>x.label==='实际入村口粮'&&x.value.includes(String(t.haulHours))));
 assert.ok(importPioneerWorld(JSON.stringify(s)),'transport ledger must survive saving');
});

test('v0.5.3: a fish catch waits at shore until the next exclusive reachable shift',()=>{
 const s=grow(),reach=s.sites.find(x=>x.kind==='fish')!;
 let nextSeven=Math.floor(s.minutes/DAY_MINUTES)*DAY_MINUTES+7*60;
 if(nextSeven<=s.minutes)nextSeven+=DAY_MINUTES;
 advancePioneerWorld(s,(nextSeven-s.minutes)/3);
 s.resources.food=3;reach.stock=reach.capacity;
 const before=s.livelihood.fishTransport.totalDelivered;
 advancePioneerWorld(s,60/3); // 8:00, catch without food credit
 const cargo=s.livelihood.fishTransport.pending;
 assert.ok(cargo,'fish must remain outside storage until the haul');
 assert.equal(cargo.siteId,reach.id);
 assert.equal(s.livelihood.fishTransport.totalDelivered,before);
 assert.ok(cargo.amount>0);
 assert.ok(importPioneerWorld(JSON.stringify(s)),'pending real cargo survives a reload');
 advancePioneerWorld(s,60/3); // 9:00, carry along route to camp/granary
 assert.equal(s.livelihood.fishTransport.pending,null);
 assert.equal(s.livelihood.fishTransport.totalDelivered,Math.round((before+cargo.amount)*1000)/1000);
 assert.equal(s.founders.find(f=>f.id===cargo.workerId)?.activity,'haul-fish');
 assert.ok(s.resources.food>=cargo.amount);
});

test('v0.5.3: full storage blocks delivery and old saves cannot forge earlier hauling',()=>{
 const s=grow(),reach=s.sites.find(x=>x.kind==='fish')!;
 let nextSeven=Math.floor(s.minutes/DAY_MINUTES)*DAY_MINUTES+7*60;
 if(nextSeven<=s.minutes)nextSeven+=DAY_MINUTES;
 advancePioneerWorld(s,(nextSeven-s.minutes)/3);
 s.resources.food=3;reach.stock=reach.capacity;
 advancePioneerWorld(s,60/3);
 const pending=structuredClone(s.livelihood.fishTransport.pending);
 assert.ok(pending);
 const count=s.livelihood.fishTransport.totalDelivered;
 s.resources.food=pioneerFoodCapacity(s);
 advancePioneerWorld(s,60/3);
 assert.deepEqual(s.livelihood.fishTransport.pending,pending);
 assert.equal(s.livelihood.fishTransport.totalDelivered,count);
 const legacy=structuredClone(s);
 delete (legacy.livelihood as Partial<typeof legacy.livelihood>).fishTransport;
 const restored=importPioneerWorld(JSON.stringify(legacy));
 assert.ok(restored);
 assert.deepEqual(restored.livelihood.fishTransport,createPioneerFishTransport());
 assert.equal(restored.resources.food,s.resources.food);
 const forged=structuredClone(s);
 forged.livelihood.fishTransport.totalDelivered=1e9;
 assert.equal(importPioneerWorld(JSON.stringify(forged)),null);
 const forgedOwner=structuredClone(s);
 forgedOwner.livelihood.fishTransport.pending!.workerId=9999;
 assert.equal(importPioneerWorld(JSON.stringify(forgedOwner)),null);
});
