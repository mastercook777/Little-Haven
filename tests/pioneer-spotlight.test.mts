import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES,SEASON_MINUTES} from '../src/simulation/calendar.ts';
import {advancePioneerWorld,createPioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {getPioneerSpotlight} from '../src/ui/pioneerSpotlight.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';
import {pioneerCropAppearance,pioneerVisibleWoodLogs} from '../src/simulation/pioneerVisibility.ts';

test('v0.4.5: first-night chapter points to an existing forest, not a fake prebuilt house',()=>{
 const s=createPioneerWorld(42,1000);
 const current=getPioneerSpotlight(s);
 assert.equal(s.buildings.length,0);
 assert.equal(current.selection.kind,'site');
 assert.ok(current.headline.includes('第一间屋'));
 assert.ok(inspectPioneerSelection(s,current.selection));
 assert.ok(!JSON.stringify(current).includes('privateFacts'));
 const restored=importPioneerWorld(JSON.stringify(s));
 assert.ok(restored);
 assert.deepEqual(getPioneerSpotlight(restored!),current);
});

test('v0.4.5: a truly completed first shelter moves both story and inspectable place',()=>{
 const s=createPioneerWorld(42,1000);
 const first=getPioneerSpotlight(s);
 advancePioneerWorld(s,8*DAY_MINUTES/3);
 assert.ok(s.buildings.some(b=>b.kind==='shelter'));
 const after=getPioneerSpotlight(s);
 assert.notEqual(after.key,first.key);
 assert.ok(inspectPioneerSelection(s,after.selection),
  'no chapter can advertise a house or job which cannot be inspected');
 assert.ok(after.headline.length>3);
 assert.deepEqual(getPioneerSpotlight(importPioneerWorld(JSON.stringify(s))!),after);
});

test('v0.4.5: woodpile model has no wood until real stored wood exists',()=>{
 const s=createPioneerWorld(42,1000);
 assert.equal(pioneerVisibleWoodLogs(s),1);
 s.resources.wood=0;
 assert.equal(pioneerVisibleWoodLogs(s),0);
 s.resources.wood=5;
 assert.equal(pioneerVisibleWoodLogs(s),4);
 s.resources.wood=12;
 assert.equal(pioneerVisibleWoodLogs(s),9);
 s.resources.wood=48;
 assert.equal(pioneerVisibleWoodLogs(s),12);
 assert.equal(s.buildings.length,0,'the wood props do not add phantom structures');
});

test('v0.4.5: the real garden crop stock changes leaves and seasonal form, never harvests food',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,25*DAY_MINUTES/3);
 const garden=s.buildings.find(b=>b.kind==='garden');
 assert.ok(garden,'the native settled world must grow a legitimate garden');
 const field=s.sites.find(x=>x.id==='field-'+garden!.id);
 assert.ok(field);
 const originalFood=s.resources.food,harvest=field!.totalGathered;
 s.minutes=SEASON_MINUTES+600; // summer
 field!.stock=0;
 const empty=pioneerCropAppearance(s,garden!.id)!;
 assert.equal(empty.visibleSprouts,0);
 field!.stock=field!.capacity;
 const lush=pioneerCropAppearance(s,garden!.id)!;
 assert.equal(lush.visibleSprouts,28);
 assert.ok(lush.height>empty.height);
 s.minutes=SEASON_MINUTES*3+600; // winter
 const winter=pioneerCropAppearance(s,garden!.id)!;
 assert.ok(winter.visibleSprouts<lush.visibleSprouts);
 assert.ok(winter.height<lush.height);
 assert.equal(s.resources.food,originalFood,'visuals do not award resources');
 assert.equal(field!.totalGathered,harvest,'visuals do not add farm shifts');
 assert.equal(pioneerCropAppearance(s,'imaginary-garden'),null);
 assert.equal(pioneerCropAppearance(createPioneerWorld(42,1000),'no-garden'),null);
});

test('v0.4.5: open world modes and saves stay unchanged after observing a chapter',()=>{
 const s=createPioneerWorld(123,1000);
 const before=structuredClone(s);
 getPioneerSpotlight(s);
 pioneerVisibleWoodLogs(s);
 assert.deepEqual(s,before);
 assert.equal(s.schemaVersion,6);
 assert.equal(s.mode,'pioneer');
});
