import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES,nextSeasonBoundary} from '../src/simulation/calendar.ts';
import {createWorld} from '../src/simulation/world.ts';
import {parcelOverlaps,reservedParcels,validateVillageParcel} from '../src/simulation/villagePlanning.ts';
import {pioneerWalkable,roadSegmentsSafe} from '../src/simulation/pioneerPaths.ts';
import {validatePioneerParcel} from '../src/simulation/pioneerParcelRules.ts';
import {pioneerHousingCapacity} from '../src/simulation/pioneerGrowth.ts';
import {isPioneerFacilityActive,getPioneerFacilityPreference,setPioneerFacilityOperating,
 setPioneerFacilityPreference} from '../src/simulation/pioneerFacilities.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';
import {buildPioneerRoof,pioneerRoofHeight,PIONEER_SHELTER_ROOF} from '../src/graphics/pioneerRoof.ts';
import * as THREE from 'three';
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
 for(let i=0;i<100&&!s.buildings.length;i++)advancePioneerWorld(s,20);
 assert.ok(s.buildings.length>0,'shelter should finish during early normal play');
 assert.equal(s.buildings[0].kind,'shelter');
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
 assert.ok(s.journal.some(e=>e.title==='工材送达'));
 assert.ok(s.journal.some(e=>e.title==='梁架起身'));
 assert.ok(s.journal.some(e=>e.title==='避雨棚落成'));
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
 assert.ok(whole.buildings.length>=1);
 assert.ok(whole.resources.food>=0&&whole.resources.water>=0);
 const first=whole.buildings[0].id;
 advancePioneerWorld(whole,1400);
 assert.equal(whole.buildings.filter(b=>b.id===first).length,1,'first shelter cannot be duplicated');
});

test('Guardians can influence labor without removing resident autonomy',()=>{
 const a=createPioneerWorld(42,1000),b=createPioneerWorld(42,1000);
 assert.equal(setPioneerPolicy(a,'food'),true);
 assert.equal(setPioneerPolicy(a,'food'),false);
 assert.equal(setPioneerPolicy(b,'shelter'),true);
 advancePioneerWorld(a,260);advancePioneerWorld(b,260);
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
 assert.ok(a.buildings.length>=1);
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

test('Phase B grows genuine facilities and safe roads rather than revealing static houses',()=>{
 const s=createPioneerWorld(42,1000);
 assert.equal(s.roads.length,0);
 advancePioneerWorld(s,(48*3*DAY_MINUTES-s.minutes)/3);
 const kinds=new Set(s.buildings.map(b=>b.kind));
 assert.ok(kinds.has('shelter'));
 assert.ok(kinds.has('garden'),'missing garden: '+JSON.stringify({intent:s.intent,resources:s.resources,sites:s.sites,founders:s.founders,buildings:s.buildings.map(b=>b.kind)}));
 assert.ok(kinds.has('cottage'),'housing demand must cause a real new dwelling');
 assert.ok(kinds.has('wood-yard'),'resource logistics must produce a workplace');
 assert.ok(s.roads.length>=3,'resident-made paths must connect finished facilities');
 assert.ok(s.founders.length>=6,'growth stall: '+JSON.stringify({
  people:s.founders.length,buildings:s.buildings.map(b=>b.kind),
  food:s.resources.food,wood:s.resources.wood,sites:s.sites.filter(x=>x.kind==='field').map(x=>x.stock),
  intent:s.intent?.kind,paused:s.intent?.pauseReason,surveyAt:s.nextSurveyAt,
  recent:s.journal.slice(-8).map(x=>x.title)
 }));
 assert.ok(s.founders.every(f=>f.homeBuildingId&&s.buildings.some(b=>b.id===f.homeBuildingId)));
 assert.ok(pioneerHousingCapacity(s)>=s.founders.length);
 assert.ok(s.journal.some(e=>e.title==='又添一位乡邻'));
 const ids=new Set();
 for(const b of s.buildings){
  assert.ok(!ids.has(b.id));ids.add(b.id);
  assert.ok(b.materialsSpent.wood>0&&b.workHours>0,'construction work and wood must be real');
  assert.ok(s.journal.some(x=>x.id&&x.causeId===b.causeId));
 }
 const natural=reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
 const occupied=[...natural];
 const camp={id:'camp',kind:'protected',x:s.camp.x,z:s.camp.z,
  width:1.25,depth:1.25,rotation:0,clearance:.24,
  accessX:s.camp.x,accessZ:s.camp.z,builtAt:0};
 occupied.push(camp);
 for(const b of s.buildings){
  assert.ok(validatePioneerParcel(b.parcel,occupied,s.roads.filter(r=>r.buildingId!==b.id)).ok,'unsafe '+b.id);
  occupied.push(b.parcel);
 }
 for(const road of s.roads){
  const others=[...natural,...s.buildings.filter(b=>b.id!==road.buildingId).map(b=>b.parcel)];
  assert.ok(roadSegmentsSafe(road.points,others),'road intersects obstacles '+road.id);
  assert.ok(road.uses>=0);
  assert.ok(s.buildings.some(b=>b.id===road.buildingId));
 }
});

test('By year 3 different guardian priorities and seeds produce different physical layouts',()=>{
 const seed=20261103,models=[];
 for(const policy of ['balanced','food','shelter']){
  const world=createPioneerWorld(seed,1000);
  if(policy!=='balanced')setPioneerPolicy(world,policy);
  advancePioneerWorld(world,(48*2*DAY_MINUTES)/3);
  models.push(world.buildings.map(b=>[b.kind,b.parcel.x,b.parcel.z,b.parcel.rotation]));
 }
 assert.equal(new Set(models.map(JSON.stringify)).size,3,'worlds must physically diverge');
 const other=createPioneerWorld(seed+765,1000);
 advancePioneerWorld(other,(48*2*DAY_MINUTES)/3);
 assert.notDeepEqual(other.buildings.map(b=>[b.parcel.x,b.parcel.z]),models[0].map(b=>[b[1],b[2]]));
});

test('Phase B hourly, season skips and import/reload keep the exact same world',()=>{
 const a=createPioneerWorld(42,1000),b=createPioneerWorld(42,1000);
 const until=48*2*DAY_MINUTES;
 advancePioneerWorld(a,(until-a.minutes)/3);
 while(b.minutes<until-1){
  const step=Math.min(until-b.minutes,3*DAY_MINUTES);
  advancePioneerWorld(b,step/3);
 }
 assert.deepEqual(a,b);
 const imported=importPioneerWorld(JSON.stringify(a));
 assert.ok(imported,'invalid saved growth: '+JSON.stringify({
  buildings:a.buildings.map(b=>({kind:b.kind,parcel:b.parcel})),
  intent:a.intent,sites:a.sites.length,roads:a.roads.length,
  housing:pioneerHousingCapacity(a),residents:a.founders.length
 }));
 assert.deepEqual(imported,a);
 assert.ok(imported!.roads.length>0);
});

test('Phase B repair changes building wear and can only spend real materials',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,4*48*DAY_MINUTES/3);
 const first=s.buildings[0];
 assert.ok(Number.isFinite(first.condition));
 assert.ok(s.journal.some(e=>e.title==='修屋工单'),'missing repair: '+JSON.stringify({intent:s.intent,resources:s.resources,buildings:s.buildings.map(b=>({kind:b.kind,condition:b.condition})),journal:s.journal.slice(-4)}));
 assert.ok(s.journal.some(e=>e.title==='旧屋焕新'),'actual repairs must be completed');
 assert.ok(first.lastRepairAt!>=first.completedAt);
});

test('Architectural roof keeps both slopes and every reed on one measured pitch',()=>{
 const p=PIONEER_SHELTER_ROOF,base=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial({color:'#ab946f'});
 const roof=buildPioneerRoof(base,p,mat,mat,mat,mat);
 assert.equal(roof.children.filter(x=>x.name==='roof-left-slope'||x.name==='roof-right-slope').length,2);
 assert.ok(pioneerRoofHeight(p,0)>pioneerRoofHeight(p,p.halfWidth));
 assert.equal(pioneerRoofHeight(p,p.halfWidth),pioneerRoofHeight(p,-p.halfWidth));
 const seams=roof.children.filter(x=>x.name==='roof-reed-on-slope');
 assert.equal(seams.length,8);
 for(const seam of seams){
  assert.ok(Math.abs(seam.position.y-(pioneerRoofHeight(p,seam.position.x)+.024))<.0001);
 }
 for(const leaf of roof.children.filter(x=>x.name==='roof-left-slope'||x.name==='roof-right-slope')){
  const obj=leaf as THREE.Mesh,coords=obj.geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<coords.count;i++){
   const x=coords.getX(i),y=coords.getY(i),z=coords.getZ(i);
   assert.ok(Math.abs(x)<=p.halfWidth+.0001&&Math.abs(z)<=p.halfDepth+.0001);
   assert.ok(y<=pioneerRoofHeight(p,x)+.0001&&y>=pioneerRoofHeight(p,x)-p.thickness-.0001);
  }
 }
 const bounds=new THREE.Box3().setFromObject(base);
 assert.ok(bounds.min.x>=-1.30&&bounds.max.x<=1.30, 'eaves must remain inside the 2.65m protected footprint');
 assert.ok(bounds.min.z>=-1.25&&bounds.max.z<=1.25);
});

test('Built cottages, gardens and work yards expose real saved detail, not cosmetic count',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*2*DAY_MINUTES-s.minutes)/3);
 const cottage=s.buildings.find(b=>b.kind==='cottage');
 const garden=s.buildings.find(b=>b.kind==='garden');
 assert.ok(cottage&&garden);
 const detail=inspectPioneerSelection(s,{kind:'building',id:cottage!.id});
 assert.equal(detail?.title,'山居');
 assert.ok(detail?.facts.find(x=>x.label==='村民使用'));
 assert.equal(detail?.facts.find(x=>x.label==='实际木料')?.value,'9 份');
 assert.ok(detail?.facts.find(x=>x.label==='落成时间'));
 assert.ok(detail?.history.length);
 const plot=inspectPioneerSelection(s,{kind:'building',id:garden!.id});
 assert.equal(plot?.operation?.active,true);
 assert.equal(plot?.operation?.preference,'harvest');
 const site=s.sites.find(x=>x.id==='field-'+garden!.id)!;
 assert.ok(inspectPioneerSelection(s,{kind:'site',id:site.id})?.facts.length);
 assert.equal(inspectPioneerSelection(s,{kind:'building',id:'not-a-real-building'}),null);
 const intent=inspectPioneerSelection(s,{kind:'camp',id:'camp'});
 assert.ok(intent?.facts.some(x=>x.label==='现今人口'));
});

test('Pause and production preferences change simulated output and survive save import',()=>{
 const original=createPioneerWorld(42,1000);
 advancePioneerWorld(original,(48*DAY_MINUTES-original.minutes)/3);
 const garden=original.buildings.find(b=>b.kind==='garden')!;
 assert.ok(garden,'garden must emerge from need before operations can be changed');
 const before=structuredClone(original),active=structuredClone(original);
 assert.equal(setPioneerFacilityOperating(before,garden.id,false),true);
 assert.equal(setPioneerFacilityOperating(before,garden.id,false),false);
 assert.equal(setPioneerFacilityOperating(before,garden.id,true),true);
 assert.equal(setPioneerFacilityPreference(before,garden.id,'seed'),true);
 assert.equal(setPioneerFacilityPreference(before,garden.id,'seed'),false);
 assert.equal(getPioneerFacilityPreference(before.buildings.find(b=>b.id===garden.id)!), 'seed');
 assert.equal(setPioneerFacilityOperating(active,garden.id,false),true);
 const stockBefore=active.sites.find(site=>site.id==='field-'+garden.id)!.totalGathered;
 advancePioneerWorld(active,3*DAY_MINUTES/3);
 assert.equal(active.sites.find(site=>site.id==='field-'+garden.id)!.totalGathered,stockBefore,
  'paused farm must not yield resources even when calendar advances');
 const resumed=structuredClone(active);
 assert.equal(setPioneerFacilityOperating(resumed,garden.id,true),true);
 advancePioneerWorld(resumed,3*DAY_MINUTES/3);
 assert.ok(resumed.sites.find(site=>site.id==='field-'+garden.id)!.totalGathered>stockBefore,
  'resumed farm should actually supply village food');
 assert.deepEqual(importPioneerWorld(JSON.stringify(before)),before);
 const bad=structuredClone(before);bad.buildings.find(b=>b.id===garden.id)!.productionMode='repair';
 assert.equal(importPioneerWorld(JSON.stringify(bad)),null,'wood-shop mode cannot be used by a farm');
 const early=structuredClone(original) as unknown as Record<string,unknown>;
 delete early.foodStats;
 assert.ok(importPioneerWorld(JSON.stringify(early))?.foodStats,
  'old Phase B v4 saves without grain statistics must migrate safely');
 assert.equal(isPioneerFacilityActive(active.buildings.find(b=>b.id===garden.id)!),false);
});

test('Four-year food security scales actual farm capacity before filling every home',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*4*DAY_MINUTES-s.minutes)/3);
 const crops=s.buildings.filter(b=>b.kind==='garden');
 const population=s.founders.length;
 assert.ok(population>=6,'four-year growth stall: '+JSON.stringify({
  people:population,buildings:s.buildings.map(b=>b.kind),
  food:s.resources.food,wood:s.resources.wood,
  intent:s.intent?.kind,paused:s.intent?.pauseReason,
  sites:s.sites.filter(x=>x.kind==='field').map(x=>x.stock),
  recent:s.journal.slice(-8).map(x=>x.title)
 }));
 assert.ok(crops.length>=Math.ceil(population/4),
  'must build enough real field parcels for population '+population);
 assert.ok(s.resources.food>0,'year-four starvation persists: '+JSON.stringify({
  food:s.resources.food,people:population,gardens:crops.length,stats:s.foodStats,
  sites:s.sites.map(site=>({kind:site.kind,stock:site.stock,gathered:site.totalGathered})),
  intent:s.intent?.kind
 }));
 assert.ok(s.foodStats&&s.foodStats.consumed>=0&&s.foodStats.collected>=0);
 assert.ok(s.journal.some(x=>x.title==='又添一位乡邻'));
});
