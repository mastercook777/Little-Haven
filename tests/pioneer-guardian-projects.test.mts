import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePioneerWorld,createPioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {cancelGuardianProject,pioneerGuardianChoices,requestGuardianProject,schedulePioneerProject} from '../src/simulation/pioneerGrowth.ts';

function settled(){
 const s=createPioneerWorld(42,1000);
 for(let i=0;i<200&&!s.buildings.length;i++)advancePioneerWorld(s,20);
 assert.equal(s.buildings[0]?.kind,'shelter');
 return s;
}
test('guardian proposals require real shelter and do not spend or replace a job at submission',()=>{
 const fresh=createPioneerWorld(42,1000);
 assert.ok(pioneerGuardianChoices(fresh).every(c=>c.disabledReason));
 assert.equal(requestGuardianProject(fresh,'garden'),false);
 const s=settled();
 const resources=structuredClone(s.resources),intent=structuredClone(s.intent);
 assert.equal(requestGuardianProject(s,'garden'),true);
 assert.deepEqual(s.resources,resources);
 assert.deepEqual(s.intent,intent);
 assert.equal(s.guardianProject?.status,'queued');
 assert.equal(requestGuardianProject(s,'cottage'),false);
 assert.equal(cancelGuardianProject(s),true);
 assert.equal(cancelGuardianProject(s),false);
 assert.deepEqual(s.resources,resources);
 assert.deepEqual(s.intent,intent);
 assert.equal(s.guardianProject,undefined);
});

test('a queued garden becomes a paid real facility and survives save/reload',()=>{
 const s=settled();
 assert.equal(requestGuardianProject(s,'garden'),true);
 const resumed=importPioneerWorld(JSON.stringify(s));
 assert.ok(resumed);
 assert.deepEqual(resumed.guardianProject,s.guardianProject);
 for(let i=0;i<2500&&resumed.guardianProject?.status==='queued';i++)advancePioneerWorld(resumed,20);
 assert.equal(resumed.guardianProject?.status,'building');
 assert.ok(resumed.intent);
 const cause=resumed.guardianProject!.causeId;
 assert.equal(resumed.intent.id,cause);
 assert.equal(cancelGuardianProject(resumed),false);
 const loaded=importPioneerWorld(JSON.stringify(resumed));
 assert.ok(loaded);
 assert.deepEqual(loaded.guardianProject,resumed.guardianProject);
 assert.deepEqual(loaded.intent,resumed.intent);
 for(let i=0;i<2500&&loaded.guardianProject?.status==='building';i++)advancePioneerWorld(loaded,20);
 assert.equal(loaded.guardianProject?.status,'completed');
 const b=loaded.buildings.find(b=>b.causeId===cause);
 assert.ok(b);
 assert.equal(b.kind,'garden');
 assert.equal(b.materialsSpent.wood,3);
 assert.ok(b.workHours>=6);
 assert.ok(loaded.sites.some(site=>site.id==='field-'+b.id));
 assert.ok(loaded.roads.some(road=>road.buildingId===b.id));
 assert.equal(loaded.buildings.filter(b=>b.causeId===cause).length,1);
 assert.deepEqual(importPioneerWorld(JSON.stringify(loaded))?.guardianProject,loaded.guardianProject);
 const corrupt=structuredClone(loaded);
 corrupt.guardianProject!.causeId='pioneer-guardian-impossible';
 assert.equal(importPioneerWorld(JSON.stringify(corrupt)),null);
});

test('an invalidated queued demand is blocked, rather than replacing a real construction job',()=>{
 const s=settled();
 assert.equal(requestGuardianProject(s,'cottage'),true);
 // An existing unoccupied dwelling changes the original housing need.
 const shelter=s.buildings[0];
 s.buildings.push({...shelter,id:'fixture-vacant-home',kind:'cottage',occupants:[]});
 s.minutes+=1440;
 s.intent=null;s.nextSurveyAt=0;s.resources.wood=0;
 schedulePioneerProject(s);
 assert.equal(s.guardianProject?.status,'blocked');
 assert.ok(s.guardianProject?.message?.includes('空床'));
 assert.equal(s.resources.wood,0);
 assert.equal(s.buildings.length,2);
});
