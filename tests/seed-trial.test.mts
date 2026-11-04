import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES,nextSeasonBoundary} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {setPioneerFacilityPreference,setPioneerFacilityOperating} from '../src/simulation/pioneerFacilities.ts';
import {activeSeedTrial,considerSeedTrial,dueSeedTrial,farmPairKey,
 gardenSeedTrial,performSeedTrialShift,pioneerFieldLegacyMultiplier,
 validateSeedFates} from '../src/simulation/livingFates/seedTrial.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';

let cachedFarmFixture:{s:ReturnType<typeof createPioneerWorld>;gardenId:string;a:number;b:number}|null=null;
function realCoFarmFixture(){
 if(!cachedFarmFixture){
  const s=createPioneerWorld(42,1000);
  let found:{gardenId:string;a:number;b:number}|null=null;
  // Advance the ACTUAL untouched simulation until two residents have
  // shared meaningful labor at the same farm. Pick the next early-season
  // morning before an optional autonomous trial already changes the field.
  for(let day=0;day<48*4&&!found;day++){
   advancePioneerWorld(s,DAY_MINUTES/3);
   const remaining=nextSeasonBoundary(s.minutes)-s.minutes;
   if(remaining<10*DAY_MINUTES||s.livingFates.seedTrials.some(t=>t.phase==='working'))continue;
   for(const [key,hours] of Object.entries(s.livingFates.farmCoWorkHours)
    .sort((a,b)=>b[1]-a[1])){
    if(hours<8)continue;
    const gardenId=key.slice(0,key.lastIndexOf(':'));
    const garden=s.buildings.find(x=>x.kind==='garden'&&x.id===gardenId);
    const field=s.sites.find(site=>site.id==='field-'+gardenId&&site.stock>=.4);
    const [a,b]=key.slice(key.lastIndexOf(':')+1).split('-').map(Number);
    if(!garden||!field||garden.operating===false||
     s.livingFates.fieldLegacies.some(x=>x.gardenId===gardenId)||
     s.livingFates.seedTrials.some(x=>x.gardenId===gardenId)||
     (s.livingFates.people[a]?.skills.cultivation.xp??0)<12||
     (s.livingFates.people[b]?.skills.cultivation.xp??0)<6)continue;
    found={gardenId,a,b};break;
   }
  }
  assert.ok(found,'real coordinated field shifts must generate an eligible garden pair before four years');
  cachedFarmFixture={s,gardenId:found.gardenId,a:found.a,b:found.b};
 }
 const {gardenId,a,b}=cachedFarmFixture;
 const s=structuredClone(cachedFarmFixture.s);
 assert.equal(s.livingFates.seedTrials.length,0,'fixture predates a previous field fate');
 assert.ok(s.livingFates.farmCoWorkHours[farmPairKey(gardenId,a,b)]>=8);
 assert.ok(s.livingFates.people[a].skills.cultivation.xp>=12);
 assert.ok(s.livingFates.people[b].skills.cultivation.xp>=6);
 // A controlled prosperous harvest fixture must STILL be charged for seeds
 // and labor by the production code. Do not grant a result through the test.
 s.resources.food=36;
 s.resources.water=Math.max(s.resources.water,s.founders.length*3);
 assert.equal(setPioneerFacilityPreference(s,gardenId,'seed'),true);
 return {s,gardenId,a,b};
}

test('C: recorded same-field work produces a candidate, not free fate',()=>{
 const {s,gardenId,a,b}=realCoFarmFixture();
 assert.equal(activeSeedTrial(s),null);
 const food=s.resources.food;
 const duration=nextSeasonBoundary(s.minutes)-s.minutes;
 assert.ok(duration>=10*DAY_MINUTES);
 assert.equal(considerSeedTrial(s),true);
 const t=activeSeedTrial(s)!;
 assert.ok(t);
 assert.deepEqual(t.actorIds,[a,b]);
 assert.equal(t.gardenId,gardenId);
 assert.equal(t.workBy[0]+t.workBy[1],0);
 assert.equal(s.resources.food,food-1.2,'real reserved seed comes from pantry');
 assert.equal(s.livingFates.fieldLegacies.length,0,'no early magical yield');
 assert.equal(pioneerFieldLegacyMultiplier(s,'field-'+gardenId),1);
 assert.equal(considerSeedTrial(s),false,'cannot start two trials in the same hour');
 assert.ok(inspectPioneerSelection(s,{kind:'building',id:gardenId})?.facts
  .some(x=>x.label==='种粮成本'&&x.value.includes('1.2')));
});

test('C: two people spend exclusive hours and leave a persistent field legacy at season end',()=>{
 const {s,gardenId}=realCoFarmFixture();
 assert.equal(considerSeedTrial(s),true);
 const target=nextSeasonBoundary(s.minutes);
 advancePioneerWorld(s,(target-s.minutes)/3);
 const trial=gardenSeedTrial(s,gardenId)!;
 assert.equal(trial.phase,'resolved',JSON.stringify({trial,food:s.resources.food}));
 assert.deepEqual(trial.workBy,[5,5]);
 assert.equal(trial.resolveAt,target);
 const legacy=s.livingFates.fieldLegacies.find(l=>l.gardenId===gardenId)!;
 assert.ok(legacy);
 assert.equal(legacy.harvestBonus,.06);
 assert.equal(pioneerFieldLegacyMultiplier(s,'field-'+gardenId),1.06);
 assert.equal(s.livingFates.appliedEffectIds.filter(x=>x===legacy.id).length,1);
 assert.equal(s.livingFates.majorMemories['fate-'+trial.id]?.kind,'seed-trial');
 assert.equal(validateSeedFates(s),true);
 const before=s.resources.food;
 const restored=importPioneerWorld(JSON.stringify(s));
 assert.ok(restored,'validated state with fate effects must import');
 assert.deepEqual(restored!.livingFates,s.livingFates);
 assert.equal(restored!.resources.food,before,'loading a finished arc cannot grant crops');
 assert.equal(dueSeedTrial(s),false);
 assert.equal(s.resources.food,before);
 const inspector=inspectPioneerSelection(s,{kind:'building',id:gardenId});
 assert.ok(inspector?.facts.some(x=>x.label==='田间传承'&&x.value.includes('6%')));
 assert.ok(inspector?.history.some(x=>x.includes('试田有成')));
 for(const id of trial.actorIds){
  const p=inspectPioneerSelection(s,{kind:'person',id:String(id)});
  assert.ok(p?.history.some(x=>x.includes('田间经验')));
 }
});

test('C: closed garden ends a paid trial without fabricated yield or returned seed',()=>{
 const {s,gardenId}=realCoFarmFixture();
 const foodBefore=s.resources.food;
 assert.equal(considerSeedTrial(s),true);
 assert.equal(setPioneerFacilityOperating(s,gardenId,false),true);
 const target=nextSeasonBoundary(s.minutes);
 advancePioneerWorld(s,(target-s.minutes)/3);
 const trial=gardenSeedTrial(s,gardenId)!;
 assert.equal(trial.phase,'abandoned');
 assert.deepEqual(trial.workBy,[0,0]);
 assert.equal(s.livingFates.fieldLegacies.length,0);
 assert.equal(s.livingFates.appliedEffectIds.length,0);
 assert.equal(pioneerFieldLegacyMultiplier(s,'field-'+gardenId),1);
 assert.ok(trial.outcomeEventId!==null);
 assert.ok(trial.completedAt!==null);
 assert.ok(s.livingFates.majorMemories['fate-'+trial.id]);
 assert.ok(foodBefore-1.2<=36,'the 1.2 seeds were spent before closing');
 assert.equal(dueSeedTrial(s),false);
 assert.deepEqual(importPioneerWorld(JSON.stringify(s))?.livingFates,s.livingFates);
});

test('C: only one paid field trial shift per resident per hour',()=>{
 const {s,gardenId,a}=realCoFarmFixture();
 assert.equal(considerSeedTrial(s),true);
 const field=s.sites.find(site=>site.id==='field-'+gardenId)!;
 const worker=s.founders.find(f=>f.id===a)!;
 assert.equal(performSeedTrialShift(s,worker,field),false,'an idle worker cannot perform trials');
 worker.activity='seed-trial';
 s.minutes=Math.ceil(s.minutes/60)*60;
 assert.equal(performSeedTrialShift(s,worker,field),true);
 assert.equal(performSeedTrialShift(s,worker,field),false,'same-hour labor cannot double-credit');
 assert.equal(activeSeedTrial(s)?.workBy[0],1);
 assert.equal(s.livingFates.fieldLegacies.length,0);
});

test('C: old v0.4.4 A/B save migrates with no invented field records',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*DAY_MINUTES-s.minutes)/3);
 const old=structuredClone(s) as unknown as {livingFates:Record<string,unknown>;resources:unknown};
 for(const key of ['farmCoWorkHours','seedTrials','fieldLegacies','appliedEffectIds'])
  delete old.livingFates[key];
 const revived=importPioneerWorld(JSON.stringify(old));
 assert.ok(revived);
 assert.deepEqual(revived.livingFates.farmCoWorkHours,{});
 assert.deepEqual(revived.livingFates.seedTrials,[]);
 assert.deepEqual(revived.livingFates.fieldLegacies,[]);
 assert.deepEqual(revived.resources,s.resources);
 const partial=structuredClone(old);
 partial.livingFates.seedTrials=[];
 assert.equal(importPioneerWorld(JSON.stringify(partial)),null,
  'partially missing arc data is corrupt, not a legacy save');
});

test('C: imported forged land effect and future trial are rejected',()=>{
 const s=createPioneerWorld(42,1000);
 const bad=structuredClone(s);
 bad.livingFates.fieldLegacies.push({id:'fake',gardenId:'phantom',
  actorIds:[1,2],completedAt:s.minutes,harvestBonus:.06,sourceTrialId:'none'});
 assert.equal(importPioneerWorld(JSON.stringify(bad)),null);
 const badKey=structuredClone(s);
 badKey.livingFates.farmCoWorkHours['nonexistent:1-2']=100;
 assert.equal(importPioneerWorld(JSON.stringify(badKey)),null);
});
