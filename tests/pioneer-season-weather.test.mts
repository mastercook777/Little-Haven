import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPioneerWorld,advancePioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createWeatherArt} from '../src/graphics/weatherArt.ts';
import {createPioneerSeasonalVfx} from '../src/graphics/pioneerSeasonalVfx.ts';
import {PIONEER_DECIDUOUS_TREES,pioneerWeatherPlacement,
 pioneerRoofDrips} from '../src/graphics/pioneerAtmospherePlacement.ts';
import {pioneerIslandFraction} from '../src/simulation/pioneerGeography.ts';
import {VALLEY_RIVER} from '../src/simulation/valleyGeography.ts';

test('v0.5.5: rain contacts lie on pioneer land rather than the inherited classic tavern or river',()=>{
 const s=createPioneerWorld(42,1000);
 const placement=pioneerWeatherPlacement(s);
 const spots=placement.splashSites??[];
 assert.equal(spots.length,22);
 for(const [x,z] of spots){
  assert.ok(pioneerIslandFraction(x,z,1.4,1.4)<=.82);
  let nearRiver=Infinity;
  for(let i=1;i<VALLEY_RIVER.length;i++){
   const [ax,az]=VALLEY_RIVER[i-1],[bx,bz]=VALLEY_RIVER[i];
   const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,
    ((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
   nearRiver=Math.min(nearRiver,Math.hypot(x-ax-dx*t,z-az-dz*t));
  }
  assert.ok(nearRiver>=1.50,'land splash must avoid stream');
 }
 const root=new THREE.Group(),vfx=createWeatherArt(root,false,false,placement);
 assert.equal(vfx.roofDripCount(),0,'zero-building start cannot have inherited roof drip streams');
 vfx.setWeather('clear');
 assert.equal(vfx.root.getObjectByName('storm-rain-and-ground-impact')?.visible,false);
 vfx.setWeather('rain');vfx.animate(1.7);
 assert.equal(vfx.streakCount,730);
 assert.equal(vfx.splashCount,22);
 assert.equal(vfx.sampleSplashCenters().length,22);
 assert.equal(vfx.root.getObjectByName('ground-impact-water-crowns')?.visible,true);
 assert.ok(vfx.puddleCount>=3);
 for(const sample of vfx.sampleDrops(24))assert.ok(sample.headY>sample.tailY);
 const group=vfx.root.getObjectByName('storm-rain-and-ground-impact')!;
 assert.ok(group.children.some(c=>c instanceof THREE.InstancedMesh));
 assert.ok(group.children.some(c=>c instanceof THREE.LineSegments));
 const ripple=group.getObjectByName('shared-classic-rain-impact-ripples')!;
 const intersections:THREE.Intersection[]=[];
 ripple.raycast(new THREE.Raycaster(),intersections);
 assert.equal(intersections.length,0,'decorative effects cannot steal building selection');
 vfx.setWeather('fog');assert.equal(group.visible,false);
 assert.equal(vfx.root.getObjectByName('terrain-mist')?.visible,true);
});

test('v0.5.5: one shared leaf kit follows the protected trees through spring autumn and winter',()=>{
 const parent=new THREE.Group(),fx=createPioneerSeasonalVfx(parent,PIONEER_DECIDUOUS_TREES);
 assert.equal(PIONEER_DECIDUOUS_TREES.length,2);
 fx.setSeason('spring');fx.animate(1);
 assert.ok(fx.signatures().springPetals>=70);
 assert.equal(fx.signatures().fallingLeaves,0);
 fx.setSeason('autumn');fx.animate(2);
 const leaf=fx.root.getObjectByName('animated-falling-autumn-leaves');
 assert.ok(leaf instanceof THREE.InstancedMesh);
 const first=new THREE.Matrix4(),second=new THREE.Matrix4();
 leaf.getMatrixAt(0,first);fx.animate(3);leaf.getMatrixAt(0,second);
 assert.ok(!first.equals(second),'falling leaves must move, not remain a frozen autumn texture');
 assert.equal(fx.signatures().fallingLeaves,20);
 assert.ok(fx.signatures().fallenLeaves>=100);
 const autumn=fx.root.getObjectByName('autumn-falling-and-settled-leaves');
 assert.equal(autumn?.visible,true);
 fx.setSeason('winter');fx.animate(4);
 assert.equal(fx.signatures().fallingLeaves,0);
 assert.equal(fx.signatures().winterSnowPatches,24);
 assert.equal(autumn?.visible,false);
 fx.setSeason('summer');
 assert.equal(fx.signatures().winterSnowPatches,0);
 assert.ok(fx.root.children.every(child=>child.visible===false));
});

test('v0.5.5: low-motion and mobile path caps leaf/rain work without hiding seasonal ground cues',()=>{
 const p=new THREE.Group(),fx=createPioneerSeasonalVfx(p,PIONEER_DECIDUOUS_TREES,true,true);
 fx.setSeason('autumn');fx.animate(10);
 assert.equal(fx.signatures().fallingLeaves,0);
 assert.ok(fx.signatures().fallenLeaves>=40);
 const rain=createWeatherArt(p,true,true,pioneerWeatherPlacement(createPioneerWorld(42)));
 assert.equal(rain.streakCount,140);
 assert.equal(rain.splashCount,12);
 rain.setWeather('rain');rain.animate(5);
 assert.equal(rain.root.getObjectByName('ground-impact-water-crowns')?.visible,false);
});

test('v0.5.5: drip streams only arise from genuine completed roofs and follow rotated parcels',()=>{
 const s=createPioneerWorld(42,1000);
 assert.equal(s.buildings.length,0);
 assert.deepEqual(pioneerRoofDrips(s),[]);
 advancePioneerWorld(s,(48*2*DAY_MINUTES-s.minutes)/3);
 const built=s.buildings.filter(b=>['cottage','granary','wood-yard','fish-hut','tea-stop'].includes(b.kind));
 assert.ok(built.length>0,'two-year autonomous village should have genuinely built roofs');
 const drips=pioneerRoofDrips(s);
 assert.equal(drips.length,built.length*5);
 for(const [x,y,z] of drips)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
 const art=createWeatherArt(new THREE.Group(),false,false,pioneerWeatherPlacement(s));
 art.setRoofDrips(drips);assert.equal(art.roofDripCount(),drips.length);
 art.setRoofDrips([]);assert.equal(art.roofDripCount(),0);
});

test('v0.5.5: classic weather without pioneer placement retains its original roof runoff and fixed pools',()=>{
 const art=createWeatherArt(new THREE.Group(),false);
 assert.equal(art.roofDripCount(),22);
 assert.equal(art.puddleCount,6);
 art.setWeather('rain');art.animate(.35);
 assert.equal(art.mode(),'rain');
 assert.equal(art.sampleDrops(3).length,3);
});
