import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MOUNTAIN_MATERIALS} from '../src/graphics/villageBuildings.ts';
import {dressCharacter} from '../src/graphics/characterKit.ts';
import {makePioneerMountainRoof,dressPioneerCottage,dressPioneerGranary,
 makePioneerSeasonalGrove,pioneerHouseVariant} from '../src/graphics/pioneerHeritageArt.ts';
import {PIONEER_SHELTER_ROOF} from '../src/graphics/pioneerRoof.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';

test('v0.5.4: same classic curved roof factory fits the saved pioneer eave envelope',()=>{
 const group=new THREE.Group();
 const profile={halfWidth:1.40,halfDepth:1.27,eaveY:1.97,ridgeY:2.49,thickness:.095};
 const roof=makePioneerMountainRoof(group,profile,'cottage',1);
 assert.equal(roof.name,'one-piece-upturned-roof');
 assert.equal(roof.material,MOUNTAIN_MATERIALS.roofBlue);
 assert.equal(group.getObjectsByProperty('name','one-piece-upturned-roof').length,1);
 const bounds=new THREE.Box3().setFromObject(group);
 assert.ok(bounds.min.x>-profile.halfWidth-.10&&bounds.max.x<profile.halfWidth+.10,JSON.stringify(bounds));
 assert.ok(bounds.min.z>-profile.halfDepth-.17&&bounds.max.z<profile.halfDepth+.17,JSON.stringify(bounds));
 assert.ok(group.getObjectByName('seasonally-frosted-authored-roof'));
 assert.equal(group.getObjectByName('seasonally-frosted-authored-roof')?.visible,false);
 // Founder shelter remains its distinct original thatch roof, not inherited
 // as a prebuilt home at zero-building start.
 assert.equal(PIONEER_SHELTER_ROOF.halfWidth,1.19);
});
test('v0.5.4: one complete house facade without a second roof; shared art kit is deterministic',()=>{
 const house=new THREE.Group();
 const variant=pioneerHouseVariant('pioneer-cottage-12');
 assert.equal(variant,pioneerHouseVariant('pioneer-cottage-12'));
 dressPioneerCottage(house,2.64,2.50,1.68,'pioneer-cottage-12');
 assert.ok(house.getObjectByName('classic-inspired-mountain-cottage-facade'));
 assert.ok(house.getObjectByName('batched-classic-inspired-mountain-cottage-facade'),
  'shared paper/wood material meshes should batch rather than add dozens of draw calls');
 assert.equal(house.getObjectByName('one-piece-upturned-roof'),undefined);
 const granary=new THREE.Group();dressPioneerGranary(granary);
 assert.ok(granary.getObjectByName('classic-inspired-raised-granary'));
});
test('v0.5.4: classic fabric identity fits founders without making them classic-village citizens',()=>{
 for(const id of [1,2,3,7,12]){
  const upper=new THREE.Group();
  const appearance=dressCharacter(upper,{id,color:'#879a77'});
  assert.ok(appearance.hems.length===2);
  assert.ok(upper.children.length>=3);
  assert.ok(upper.getObjectByName('profession-headwear')||id===1||id===2||id===12);
 }
 const s=createPioneerWorld(42,1000);
 assert.equal(s.buildings.length,0);
 assert.deepEqual(s.founders.map(f=>f.name),['梁伯','陆娘','阿禾']);
 advancePioneerWorld(s,(7*DAY_MINUTES-s.minutes)/3);
 assert.ok(importPioneerWorld(JSON.stringify(s)),'visual-only code cannot alter save schema');
});
test('v0.5.4: protected seasonal crowns use the same legal tree positions without simulation writes',()=>{
 const root=new THREE.Group(),locations=[
  [-6,8.7,1.12],[11.3,-7,1.0]
 ] as const;
 const v=makePioneerSeasonalGrove(root,locations);
 assert.equal(v.count,2);
 assert.equal(root.getObjectByName('protected-seasonal-tree')?.position.x,-6);
 v.update('spring');
 assert.ok(v.root.getObjectsByProperty('name','protected-seasonal-tree').length===2);
 v.update('winter');
 assert.equal(v.root.children.length,2,'winter should not duplicate tree geometry');
 v.update('summer');
 assert.ok(v.root.children.every(t=>t.children.some(c=>c instanceof THREE.Group&&c.visible)),
  'summer crowns return to the protected grove');
});
