import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES,nextSeasonBoundary} from '../src/simulation/calendar.ts';
import {createWorld} from '../src/simulation/world.ts';
import {parcelOverlaps,reservedParcels,validateVillageParcel} from '../src/simulation/villagePlanning.ts';
import {advancePioneerWorld,advancePioneerToSeason,createPioneerWorld,
 getPioneerCalendar,importPioneerWorld,loadPioneerWorld,PIONEER_SLOT_KEYS,
 planPioneerShelter,savePioneerWorld,setPioneerPolicy} from '../src/simulation/pioneerWorld.ts';

test('Pioneer starts with zero permanent buildings, exactly three founders, no ghost inn',()=>{
 for(const seed of [7,42,20261103,20261347]){
  const s=createPioneerWorld(seed,1000);
  assert.equal(s.schemaVersion,4);assert.equal(s.mode,'pioneer');
  assert.equal(s.founders.length,3);assert.equal(s.buildings.length,0);
  assert.equal(s.intent,null);
  assert.deepEqual(s.founders.map(x=>x.name),['梁伯','陆娘','阿禾']);
  assert.ok(s.founders.every(f=>f.homeBuildingId===null));
  assert.ok(s.journal.some(e=>e.title==='荒谷点火'));
  assert.ok(!JSON.stringify(s).includes('inn-001'));
  assert.ok(!JSON.stringify(s).includes('酒肆'));
 }
});

test('Pioneer camp and candidate shelter reuse SAT while excluding old BASE_PARCELS',()=>{
 const s=createPioneerWorld(42,1000);
 const occupied=reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
 const road=occupied[0];
 const camp={id:'camp',kind:'protected' as const,x:s.camp.x,z:s.camp.z,
  width:1.25,depth:1.25,rotation:0,clearance:.24,
  accessX:s.camp.x,accessZ:s.camp.z,builtAt:0};
 assert.ok(validateVillageParcel(camp,occupied,3.25).ok);
 assert.ok(!parcelOverlaps(camp,road));
 const shelter=planPioneerShelter(s);
 assert.ok(shelter,'Pioneer must be able to select a valid first shelter parcel');
 assert.ok(validateVillageParcel(shelter!,[...occupied,camp],3.75).ok);
});

test('Real work and gathered wood must create and occupy the first shelter',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,14*60);
 assert.equal(s.intent,null,'shelter should finish during early normal play');
 assert.equal(s.buildings.length,1);
 const b=s.buildings[0];
 assert.equal(b.kind,'shelter');
 assert.ok(b.parcel.id.startsWith('pioneer-'));
 assert.equal(b.materialsSpent.wood,7);
 assert.ok(b.workHours>=9);
 assert.deepEqual(b.occupants,[1,2,3]);
 assert.ok(s.founders.every(f=>f.homeBuildingId===b.id));
 const gathered=s.sites.find(x=>x.kind==='forest')!.totalGathered;
 assert.ok(Math.abs(s.resources.wood-(1+gathered-7))<.0001,'wood must be conserved');
 assert.ok(s.journal.some(e=>e.title==='商量搭棚'));
 assert.ok(s.journal.some(e=>e.title==='备齐搭棚木料'));
 assert.ok(s.journal.some(e=>e.title==='梁架起身'));
 assert.ok(s.journal.some(e=>e.title==='第一间棚子落成'));
});

test('Scarcity stalls shelter construction instead of spawning a building',()=>{
 const s=createPioneerWorld(42,1000);
 s.sites.find(x=>x.kind==='forest')!.stock=0;
 advancePioneerWorld(s,7*60);
 assert.equal(s.buildings.length,0);
 assert.ok(s.intent);
 assert.equal(s.intent!.phase,'materials');
 assert.equal(s.intent!.woodCommitted,0);
 assert.ok(s.intent!.pauseReason?.includes('木料'));
});

test('Same seed and policy yield equivalent settlements under chunked advancement',()=>{
 const seed=20261103;
 const whole=createPioneerWorld(seed,1000),chunked=createPioneerWorld(seed,1000);
 advancePioneerWorld(whole,3000);
 for(let i=0;i<150;i++)advancePioneerWorld(chunked,20);
 assert.deepEqual(chunked,whole);
 assert.equal(whole.buildings.length,1);
 assert.ok(whole.resources.food>=0&&whole.resources.water>=0);
 const before=JSON.stringify(whole.buildings);
 advancePioneerWorld(whole,1400);
 assert.equal(JSON.stringify(whole.buildings),before,'first shelter cannot be duplicated');
});

test('Guardians can influence labor without removing resident autonomy',()=>{
 const a=createPioneerWorld(42,1000),b=createPioneerWorld(42,1000);
 assert.equal(setPioneerPolicy(a,'food'),true);
 assert.equal(setPioneerPolicy(a,'food'),false);
 assert.equal(setPioneerPolicy(b,'shelter'),true);
 advancePioneerWorld(a,1000);advancePioneerWorld(b,1000);
 assert.ok(a.journal.some(x=>x.title==='守谷人的建议'));
 assert.ok(b.journal.some(x=>x.title==='守谷人的建议'));
 assert.notDeepEqual({resources:a.resources,work:a.intent?.workDone},
  {resources:b.resources,work:b.intent?.workDone});
 assert.ok(a.buildings.length<=1&&b.buildings.length<=1);
});

test('Season skip matches the authoritative hourly advancement',()=>{
 const a=createPioneerWorld(42,1000),b=createPioneerWorld(42,1000);
 const duration=(nextSeasonBoundary(a.minutes)-a.minutes)/3;
 advancePioneerToSeason(a);advancePioneerWorld(b,duration);
 assert.deepEqual(a,b);
 assert.equal(getPioneerCalendar(a).season,'summer');
 assert.equal(a.buildings.length,1);
});

test('Pioneer imports only v4 and validates reserved geometry and resources',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,14*60);
 assert.deepEqual(importPioneerWorld(JSON.stringify(s)),s);
 assert.equal(importPioneerWorld(JSON.stringify(createWorld(1000))),null);
 const broken=structuredClone(s);broken.resources.wood=-1;
 assert.equal(importPioneerWorld(JSON.stringify(broken)),null);
 const invalid=structuredClone(s);invalid.buildings[0].parcel.x=100;
 assert.equal(importPioneerWorld(JSON.stringify(invalid)),null);
});

test('Two Pioneer slots and both v3 save keys remain isolated',()=>{
 const data=new Map<string,string>([
  ['little-haven-living-v03-slot-1','classic-one'],
  ['little-haven-living-v03-slot-2','classic-two']
 ]);
 const store={getItem:(key:string)=>data.get(key)||null,
  setItem:(key:string,value:string)=>{data.set(key,value);}};
 const a=createPioneerWorld(42,1000),b=createPioneerWorld(7,1000);
 advancePioneerWorld(a,14*60);
 savePioneerWorld(a,store,1000,1);savePioneerWorld(b,store,1000,2);
 assert.equal(data.get('little-haven-living-v03-slot-1'),'classic-one');
 assert.equal(data.get('little-haven-living-v03-slot-2'),'classic-two');
 assert.ok(data.has(PIONEER_SLOT_KEYS[0]));
 assert.ok(data.has(PIONEER_SLOT_KEYS[1]));
 assert.equal(loadPioneerWorld(store,1000,1).buildings.length,1);
 assert.equal(loadPioneerWorld(store,1000,2).buildings.length,0);
});

test('Offline progress obeys the four-day cap and shares the normal step function',()=>{
 const saved=createPioneerWorld(42,1000);
 const data=new Map<string,string>();
 const store={getItem:(k:string)=>data.get(k)||null,
  setItem:(k:string,v:string)=>{data.set(k,v);}};
 savePioneerWorld(saved,store,1000,1);
 const loaded=loadPioneerWorld(store,1000+30*24*60*60*1000,1);
 const manual=createPioneerWorld(42,1000);
 advancePioneerWorld(manual,4*DAY_MINUTES/3);
 assert.deepEqual({...loaded,lastSavedAt:1000},{...manual,lastSavedAt:1000});
 assert.ok(loaded.minutes-saved.minutes<=4*DAY_MINUTES+1);
});
