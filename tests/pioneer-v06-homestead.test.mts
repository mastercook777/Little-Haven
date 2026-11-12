import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {PIONEER_SLOT_KEYS,PIONEER_VERSION,createPioneerWorld,advancePioneerWorld,
 importPioneerWorld,savePioneerWorld,loadPioneerWorld,setPioneerPolicy} from '../src/simulation/pioneerWorld.ts';
import {setPioneerDirection} from '../src/simulation/pioneerLivelihood.ts';
import {pioneerClearingReachable} from '../src/simulation/pioneerFrontier.ts';
import {PIONEER_V6_LOTS,pioneerV6HomesteadPlan,pioneerV6PlanFits,pioneerV6YardWalkable,pioneerV6CourtyardPoint} from '../src/simulation/homesteadPlan.ts';
import {pioneerWalkable,pioneerEntrance,roadSegmentsSafe,findPioneerWalk} from '../src/simulation/pioneerPaths.ts';
import {makeV6Homestead,pioneerV6Roof} from '../src/graphics/homesteadScene.ts';
import {buildPioneerFacilityVisual} from '../src/graphics/pioneerVillage.ts';
import {pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import {buildPioneerForestArt} from '../src/graphics/pioneerForestArt.ts';
import {pioneerGroundUsePlan,makePioneerGroundUseArt} from '../src/graphics/pioneerGroundUseArt.ts';
import {pioneerTerrainUseAt,applyPioneerTerrainUse} from '../src/graphics/pioneerTerrainUse.ts';
import {buildCarvedTerrain} from '../src/graphics/carvedTerrain.ts';
import {creekPointAt} from '../src/simulation/creekCorridor.ts';
import {validatePioneerParcel} from '../src/simulation/pioneerParcelRules.ts';
import {parcelOverlaps} from '../src/simulation/villagePlanning.ts';
import {pioneerNaturalParcels} from '../src/simulation/pioneerNaturalAnchors.ts';
import {surveyPioneerPlot,type PioneerSurveyMetrics} from '../src/simulation/pioneerGrowth.ts';

test('v0.6 Phase B terrain carries real growing land use without altering the riverbed',()=>{
 const empty=createPioneerWorld(42,1000);
 assert.equal(pioneerTerrainUseAt(empty,empty.camp.x,empty.camp.z).weight,0);
 const creek=creekPointAt(.51);
 assert.equal(pioneerTerrainUseAt(empty,creek[0],creek[1]).weight,0);
 const outline:[number,number][]=[[-15,-10],[13,-10],[13,10],[-15,10]];
 const grass=new THREE.MeshStandardMaterial({color:'#8eae7d'});
 const mesh=buildCarvedTerrain(outline,grass);
 const verts=mesh.geometry.getAttribute('position');
 const colors=mesh.geometry.getAttribute('color');
 const original=Array.from(colors.array);
 const noUse=applyPioneerTerrainUse(mesh,empty);
 assert.equal(noUse.alteredVertices,0);
 assert.deepEqual(Array.from(colors.array),original);
 advancePioneerWorld(empty,(48*3*DAY_MINUTES-empty.minutes)/3);
 const home=empty.buildings.find(b=>b.kind==='cottage')!;
 assert.ok(home);
 const inhabited=pioneerTerrainUseAt(empty,home.parcel.x,home.parcel.z);
 assert.ok(inhabited.weight>.30,'real households must affect surrounding land');
 assert.equal(pioneerTerrainUseAt(empty,creek[0],creek[1]).weight,0,
  'the actual creek corridor may never be painted over');
 const paid=applyPioneerTerrainUse(mesh,empty);
 assert.ok(paid.alteredVertices>40&&paid.meanUse>.01,
  'the new land-use layer must affect the full visible terrain, not one tiny decal');
 const first=Array.from(colors.array);
 assert.notDeepEqual(first,original);
 applyPioneerTerrainUse(mesh,empty);
 assert.deepEqual(Array.from(colors.array),first,
  'repeated rendering cannot accumulate or drift soil colors');
 const restored=createPioneerWorld(42,1000);
 const gone=applyPioneerTerrainUse(mesh,restored);
 assert.equal(gone.alteredVertices,0);
 assert.deepEqual(Array.from(colors.array),original,
  'new-game land must restore the actual unbuilt grassy island');
 assert.equal(mesh.geometry.getAttribute('position'),verts,
  'no decorative paint can move the riverbed or walkable terrain');
});

test('v0.6 Phase B ground is paid and registered, not a canned empty valley',()=>{
 const s=createPioneerWorld(42,1000);
 const empty=pioneerGroundUsePlan(s),emptyMesh=makePioneerGroundUseArt(s);
 assert.equal(empty.plots.length,0);
 assert.equal(empty.paths.length,0);
 assert.equal(empty.sharedNodes.length,0);
 assert.equal(emptyMesh.root.children.length,0,
  'no permanent paths, private courtyards or paving before first construction');
 advancePioneerWorld(s,(48*3*DAY_MINUTES-s.minutes)/3);
 const plan=pioneerGroundUsePlan(s),scene=makePioneerGroundUseArt(s);
 assert.ok(s.buildings.length>=5&&s.roads.length>=5);
 assert.equal(plan.plots.length,s.buildings.length);
 assert.equal(scene.signatures().paidGroundPlots,s.buildings.length);
 assert.equal(scene.signatures().paintedRealRoads,s.roads.length);
 assert.ok(scene.signatures().roadLength>20);
 assert.ok(scene.root.getObjectByName('registered-road-shoulder-not-an-extra-path'));
 assert.ok(scene.root.getObjectByName('paid-fields-soil-courts'));
 assert.ok(scene.root.getObjectByName('paid-homes-soil-courts'));
 const ids=new Set(s.buildings.map(b=>b.id));
 assert.ok(plan.paths.every(road=>s.roads.some(r=>r.id===road.id&&ids.has(r.buildingId))),
  'visible tracks must be actual registered roads to completed buildings');
 // The soil meshes are formed only from the paid parcel interior, not from
 // an arbitrary painted district that crosses other roofs, forest or river.
 for(const child of scene.root.children){
  if(!(child instanceof THREE.Mesh)||!child.name.startsWith('paid-'))continue;
  const vertices=child.geometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++){
   const x=vertices.getX(i),z=vertices.getZ(i);
   const inside=s.buildings.some(b=>{
    const p=b.parcel,dx=x-p.x,dz=z-p.z,
     cs=Math.cos(p.rotation),sn=Math.sin(p.rotation);
    const lx=dx*cs+dz*sn,lz=-dx*sn+dz*cs;
    return Math.abs(lx)<=p.width/2+.001&&Math.abs(lz)<=p.depth/2+.001;
   });
   assert.ok(inside,'paid soil escaped legal built land at '+x+','+z);
  }
 }
});

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
  const actualYard=pioneerV6CourtyardPoint(p)!;
  const gateApproach=pioneerEntrance(p);
  assert.ok(pioneerV6YardWalkable(p,actualYard[0],actualYard[1]),
   lot.styleId+' must have a real traversable yard');
  assert.equal(pioneerV6YardWalkable(p,p.x,p.z),false,
   'the occupied house/shop core is never an open pedestrian shortcut');
  // The global A* still treats a complete private lot as reserved. The
  // interior gate mask is tested here but remains a Phase-B integration task.
  assert.ok(!pioneerWalkable(actualYard,[p],true));
  assert.ok(!pioneerWalkable([p.x,p.z],[p],true));
  assert.ok(Number.isFinite(gateApproach[0]));
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

test('v0.6 paid compound models are actually used by the real village renderer',()=>{
 for(const entry of Object.values(PIONEER_V6_LOTS)){
  const style=entry.styleId,kind=style==='W1-open-yard'?'wood-yard':'cottage';
  const parcel={id:'live-'+style,kind:'dwelling' as const,x:-6,z:-3,
   width:entry.width,depth:entry.depth,rotation:0,clearance:.30,
   accessX:-6,accessZ:-3+entry.depth/2+.8,builtAt:100,homesteadStyle:style};
  const root=new THREE.Group();
  const unfinished=buildPioneerFacilityVisual(root,parcel,kind,'foundation',.3);
  assert.ok(unfinished.getObjectByName('paid-foundation'),style+' actual builder floor missing');
  assert.ok(!unfinished.getObjectByName('real-main-building-volume'),
   style+' must not generate complete buildings during excavation');
  const full=buildPioneerFacilityVisual(root,parcel,kind,'complete',1,98,
   undefined,false,true);
  assert.equal(full.userData.buildingId,parcel.id);
  assert.ok(full.userData.staticBatchStats?.merged>=3&&
   full.userData.staticBatchStats.after<full.userData.staticBatchStats.before,
   style+' live authored house should batch repetitive wood geometry');
  assert.ok(full.getObjectByName('paid-working-ground'));
  assert.ok(full.getObjectByName('real-main-building-volume'),
   style+' was replaced by the old generic roof despite saved homesteadStyle');
  assert.ok(full.getObjectByName('paid-residential-loft')||
   kind==='wood-yard',style+' paid loft missing');
  if(kind==='cottage'){
   assert.ok(full.getObjectByName('real-courtyard-gatewall'));
   assert.ok(full.getObjectByName('household-footpath'));
  }else{
   assert.ok(full.getObjectByName('actual-wood-working-apron'));
  }
 }
});

test('v0.6 Phase B paid silhouette geometry distinguishes all three residential types',()=>{
 const seen=new Set<string>();
 const featureByStyle={
  'H1-thatch':'low-thatch-roof-rhythm',
  'H2-farmyard':'farmyard-attached-veranda',
  'H3-wing':'paid-side-work-wing'
 } as const;
 for(const style of Object.keys(featureByStyle) as Array<keyof typeof featureByStyle>){
  const lot=PIONEER_V6_LOTS[style];
  const parcel={id:'paid-'+style,kind:'dwelling' as const,x:0,z:0,
   width:lot.width,depth:lot.depth,rotation:0,clearance:.3,
   accessX:0,accessZ:lot.depth/2+.8,builtAt:100,homesteadStyle:style};
  const foundation=makeV6Homestead(new THREE.Group(),parcel,'foundation')!;
  assert.equal(foundation.getObjectByName(featureByStyle[style]),undefined,
   'silhouette additions cannot appear before a paid house is completed');
  const full=makeV6Homestead(new THREE.Group(),parcel,'complete',94,true,true)!;
  assert.equal(full.userData.buildingId,parcel.id);
  const addition=full.getObjectByName(featureByStyle[style]);
  assert.ok(addition,style+' must have a visibly distinct physical silhouette');
  if(style!=='H1-thatch'){
   const box=new THREE.Box3().setFromObject(addition!);
   assert.ok(box.max.x<lot.width/2+.04&&box.min.x>-lot.width/2-.04,
    style+' side-volume cannot protrude outside the surveyed paid lot');
  }
  assert.ok(full.getObjectByName('paid-residential-loft'));
  const realProfile=pioneerV6Roof(style);
  seen.add(realProfile.ridgeY.toFixed(2)+'/'+realProfile.eaveY.toFixed(2));
 }
 assert.equal(seen.size,3,'three homesteads need three different true roof heights');
});

test('v0.6 rotated full lot faces its saved A* entrance, not the opposite wall',()=>{
 const lot=PIONEER_V6_LOTS['H2-farmyard'];
 const p={id:'rotated-homestead',kind:'dwelling' as const,x:0,z:0,
  width:lot.width,depth:lot.depth,clearance:.3,rotation:Math.PI/2,
  accessX:-lot.depth/2-.82,accessZ:0,builtAt:0,homesteadStyle:lot.styleId};
 const target=pioneerV6CourtyardPoint(p)!;
 const front=pioneerEntrance(p);
 assert.ok(front[0]<target[0]&&target[0]<p.x,
  'saved road and courtyard must be on the same rotated front side');
 assert.ok(pioneerV6YardWalkable(p,target[0],target[1]));
 // Ignore river/island for this synthetic rotation-only sample. The mature
 // world below checks the *entire* gate-to-road segment against real terrain.
 for(let step=0;step<=12;step++){
  const t=step/12,x=front[0]*(1-t)+target[0]*t,z=front[1]*(1-t)+target[1]*t;
  assert.ok(pioneerV6YardWalkable(p,x,z),'a rotation cannot block the front gate');
 }
 const root=new THREE.Group();
 const g=makeV6Homestead(root,p,'complete')!;
 assert.equal(g.rotation.y,-p.rotation);
});

test('v0.6 forest clearing and tree felling leave actual visible traces by year three',()=>{
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(48*3*DAY_MINUTES-s.minutes)/3);
 const grove=buildPioneerForestArt(new THREE.Group(),s).signatures();
 const cleared=s.frontier.clearings.filter(c=>c.phase==='cleared');
 assert.ok(cleared.length>=1&&grove.cleared>=1&&grove.stumps>=1,
  'simulated clearing and durable cut marks are missing: '+
  JSON.stringify({land:s.frontier.clearings,grove,food:s.resources.food,
   water:s.resources.water,wood:s.resources.wood,
   people:s.founders.length,forest:s.sites.filter(x=>x.kind==='forest')
    .map(x=>({stock:x.stock,harvested:x.totalGathered})),
   nearby:s.buildings.map(b=>({kind:b.kind,id:b.id,at:[b.parcel.x,b.parcel.z]})),
   recent:s.journal.slice(-12).map(e=>e.title)}));
});

test('v0.6 browser default seed and shelter/river vote retain reachable clearing',()=>{
 // The browser starts with slot-1 seed 20261103 + 193, not the
 // separate seed=42 maturity benchmark. Cover the actual player startup.
 const s=createPioneerWorld(20261103+193,1000);
 assert.equal(setPioneerPolicy(s,'shelter'),true);
 for(let step=0;!s.buildings.length&&step<1000;step++)advancePioneerWorld(s,60/3);
 assert.ok(s.buildings.length>0);
 assert.equal(setPioneerDirection(s,'river'),true);
 advancePioneerWorld(s,(48*3*DAY_MINUTES-s.minutes)/3);
 const fishMetrics={} as PioneerSurveyMetrics;
 const futureMetrics={} as PioneerSurveyMetrics;
 const reachableFish=surveyPioneerPlot(s,'fish-hut',fishMetrics);
 const futureFish=surveyPioneerPlot(s,'fish-hut',futureMetrics,true);
 assert.ok(s.buildings.some(b=>b.kind==='fish-hut')&&
  s.sites.some(site=>site.kind==='fish'&&site.totalGathered>0),
  'real browser seed after shelter/river vote must establish river livelihood: '+
  JSON.stringify({intent:s.intent?.kind,people:s.founders.length,
   houses:s.buildings.map(b=>({kind:b.kind,x:b.parcel.x,z:b.parcel.z})),
   resource:s.resources,fishMetrics,futureMetrics,
   currentSite:reachableFish?.parcel,futureSite:futureFish?.parcel,
   nextSurveyAt:s.nextSurveyAt,clearings:s.frontier.clearings,
   journal:s.journal.slice(-15).map(x=>x.title)}));
 const grove=buildPioneerForestArt(new THREE.Group(),s).signatures();
 assert.ok(s.frontier.clearings.some(c=>c.phase==='cleared')&&grove.stumps>0,
  'a 3-year river-policy hamlet cannot leave old clearing inaccessible: '+
  JSON.stringify({clearings:s.frontier.clearings,grove,water:s.resources.water,
   clearingCampReachable:s.frontier.clearings.map(p=>pioneerClearingReachable(s,p)),
   luWorkRoute:s.frontier.clearings.map(p=>{
    const lu=s.founders[1],home=s.buildings.find(b=>b.id===lu.homeBuildingId);
    const from=home?pioneerEntrance(home.parcel):[s.camp.x,s.camp.z] as const;
    const blockers=[...pioneerNaturalParcels(s),...s.buildings.map(b=>b.parcel)]
     .filter(parcel=>parcel.id!==home?.id);
    return {from,route:!!findPioneerWalk(from,[p.x,p.z],blockers),home:home?.id};
   }),
   currentIntent:s.intent?.kind,food:s.resources.food,wood:s.resources.wood,
   forest:s.sites.filter(x=>x.kind==='forest').map(x=>({stock:x.stock,totalGathered:x.totalGathered})),
   people:s.founders.length,houses:s.buildings.map(b=>({
    kind:b.kind,at:[b.parcel.x,b.parcel.z],size:[b.parcel.width,b.parcel.depth]}))}));
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
  const publicRoad=s.roads.find(r=>r.buildingId===b.id);
  assert.ok(publicRoad,'every paid compound needs a registered public approach');
  assert.ok(roadSegmentsSafe(publicRoad!.points,[
   ...natural,...s.buildings.filter(other=>other.id!==b.id).map(other=>other.parcel)
  ]),'the actual registered public approach cannot cross the river or other buildings');
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
