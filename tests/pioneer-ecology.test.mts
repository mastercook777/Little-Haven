import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {VALLEY_PINES,VALLEY_BAMBOO,VALLEY_RIVER} from '../src/simulation/valleyGeography.ts';
import {CREEK_WATER_HALF_WIDTH,CREEK_BANK_HALF_WIDTH,creekPointAt,
 distanceToCreekSpline} from '../src/simulation/creekCorridor.ts';
import {pioneerIslandFraction} from '../src/simulation/pioneerGeography.ts';
import {PIONEER_BASE_NATURAL_ANCHORS,resolvePioneerNaturalAnchors,
 pioneerNaturalParcels,getPioneerNaturalAnchors,pioneerDeciduousLocations,
 isSafePioneerWildPlant,auditPioneerNaturalScene,validatePioneerNaturalAnchors,
 pioneerNaturalAnchorParcel} from '../src/simulation/pioneerNaturalAnchors.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerSeasonalVfx} from '../src/graphics/pioneerSeasonalVfx.ts';
import {pioneerWeatherPlacement} from '../src/graphics/pioneerAtmospherePlacement.ts';

test('v0.5.6A: bank exclusion and water mesh interpolate the exact same centripetal spline',()=>{
 const curve=new THREE.CatmullRomCurve3(VALLEY_RIVER.map(([x,z])=>new THREE.Vector3(x,0,z)),
  false,'centripetal',.45);
 for(let i=0;i<=100;i++){
  const [x,z]=creekPointAt(i/100),point=curve.getPoint(i/100);
  assert.ok(Math.hypot(x-point.x,z-point.z)<.005,
   'numeric collision spline must agree with actual rendered Three curve');
  assert.ok(distanceToCreekSpline(x,z)<.01);
 }
 assert.equal(CREEK_WATER_HALF_WIDTH,1.38);
 assert.equal(CREEK_BANK_HALF_WIDTH,2.42);
 assert.equal(VALLEY_PINES[6][0],5.3,'classic trees never move');
 assert.equal(VALLEY_BAMBOO[5][0],5.3,'classic bamboo never moves');
 assert.ok(distanceToCreekSpline(...VALLEY_PINES[6].slice(0,2) as [number,number])<
  CREEK_WATER_HALF_WIDTH,'legacy pine-6 really did grow in the water');
});

test('v0.5.6A: all pioneer protected roots have legal water, island and distinct parcel footprints',()=>{
 const anchors=PIONEER_BASE_NATURAL_ANCHORS;
 assert.equal(anchors.length,VALLEY_PINES.length+VALLEY_BAMBOO.length);
 for(const a of anchors){
  assert.ok(distanceToCreekSpline(a.x,a.z)>CREEK_BANK_HALF_WIDTH+.10,
   'root in wet bank: '+a.id);
  assert.ok(pioneerIslandFraction(a.x,a.z,.5,.5)<1,
   'root outside cliff: '+a.id);
 }
 assert.equal(pioneerDeciduousLocations().length,2);
 assert.ok(!anchors.some(a=>a.id==='pine-6'&&a.x===VALLEY_PINES[6][0]));
 assert.ok(!anchors.some(a=>a.id==='pine-3'&&a.x===VALLEY_PINES[3][0]));
 assert.ok(!anchors.some(a=>a.id==='bamboo-5'&&a.x===VALLEY_BAMBOO[5][0]));
 const rects=pioneerNaturalParcels();
 assert.equal(rects.length,anchors.length);
 assert.deepEqual(rects.map(a=>a.id),anchors.map(a=>a.id));
});

test('v0.5.6A: old saved houses/roads keep their positions while conflicting trees are moved once',()=>{
 const s=createPioneerWorld(42,1000);
 const obstructed=PIONEER_BASE_NATURAL_ANCHORS.find(a=>a.id==='pine-6')!;
 const house={id:'old-roof',kind:'cottage',parcel:{
  ...pioneerNaturalAnchorParcel(obstructed),id:'old-roof',kind:'dwelling' as const},
  completedAt:100,causeId:'old',occupants:[],materialsSpent:{wood:9},workHours:15};
 const moved=resolvePioneerNaturalAnchors([house.parcel]);
 assert.ok(moved.some(a=>a.id==='pine-6'&&
  Math.hypot(a.x-obstructed.x,a.z-obstructed.z)>.1));
 assert.ok(validatePioneerNaturalAnchors(moved,[house.parcel]));
 // Legacy migration only adjusts scenery; it never edits the record for
 // historical homes or manufacture labour/money.
 advancePioneerWorld(s,(48*DAY_MINUTES-s.minutes)/3);
 const originalBuildings=JSON.stringify(s.buildings),originalRoads=JSON.stringify(s.roads);
 const old=JSON.parse(JSON.stringify(s));delete old.naturalAnchors;
 const restored=importPioneerWorld(JSON.stringify(old));
 assert.ok(restored,'legacy v4 must remain readable');
 assert.equal(JSON.stringify(restored!.buildings),originalBuildings);
 assert.equal(JSON.stringify(restored!.roads),originalRoads);
 assert.ok(restored!.naturalAnchors?.length);
 const next=importPioneerWorld(JSON.stringify(restored));
 assert.deepEqual(next?.naturalAnchors,restored!.naturalAnchors,
  'the second loading is not allowed to reroll pioneer scenery');
});

test('v0.5.6A: dynamic forest and brush roots must obey creek/road/building masks',()=>{
 const s=createPioneerWorld(42,1000);
 const water=creekPointAt(.33);
 assert.equal(isSafePioneerWildPlant(s,water[0],water[1],.25),false);
 const bank=creekPointAt(.6);
 assert.equal(isSafePioneerWildPlant(s,bank[0]+.8,bank[1],.25),false);
 const built=s.buildings[0];
 if(built)assert.equal(isSafePioneerWildPlant(s,built.parcel.x,built.parcel.z,.2),false);
 assert.equal(auditPioneerNaturalScene(s).length,0,
  JSON.stringify(auditPioneerNaturalScene(s)));
});

test('v0.5.6A: loaded fixed anchor coordinates and seasonal leaf/petal particles share one source',()=>{
 const s=createPioneerWorld(20261103,1000);
 const leafy=pioneerDeciduousLocations(s);
 const effect=createPioneerSeasonalVfx(new THREE.Group(),leafy);
 assert.equal(effect.signatures().springPetals,92);
 const centers=pioneerWeatherPlacement(s).splashSites;
 assert.equal(centers?.length,22);
 assert.equal(getPioneerNaturalAnchors(s).length,PIONEER_BASE_NATURAL_ANCHORS.length);
 for(const [x,z] of centers??[])assert.ok(distanceToCreekSpline(x,z)>1.50);
});

test('v0.5.6A: deterministic planted anchors survive seeds and multi-year autonomous growth',()=>{
 for(const seed of [42,7,1001,1002,20261103]){
  const s=createPioneerWorld(seed,1000);
  assert.deepEqual(getPioneerNaturalAnchors(s),getPioneerNaturalAnchors(createPioneerWorld(seed,1000)));
  assert.equal(auditPioneerNaturalScene(s).length,0,'new seed illegal: '+seed);
  advancePioneerWorld(s,(48*2*DAY_MINUTES-s.minutes)/3);
  assert.equal(auditPioneerNaturalScene(s).length,0,
   'natural anchors overlap built housing or roads: '+seed+' '+JSON.stringify(auditPioneerNaturalScene(s)));
  assert.deepEqual(importPioneerWorld(JSON.stringify(s))?.naturalAnchors,s.naturalAnchors);
 }
});
