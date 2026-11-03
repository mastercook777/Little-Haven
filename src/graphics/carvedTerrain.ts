import * as THREE from 'three';
import {creekDistance,CREEK_WATER_Y} from './riverArt.ts';

/**
 * A continuous, shoreline-conforming island surface.
 * Rectangular center-cell clipping used to leave ugly missing sawtooth tiles
 * around the island. Every outer-ring vertex now lies exactly on a polygon
 * side. Radial rings fill the interior without gaps, and share one height
 * function with the river water.
 */
export const GRASS_Y=.17;
export const CHANNEL_FLOOR_Y=.044;
const INNER_WIDTH=1.40,OUTER_WIDTH=2.52;
const RINGS=36;
const smooth=(x:number)=>{const y=Math.min(1,Math.max(0,x));return y*y*(3-2*y);};
export function terrainHeightAt(x:number,z:number):number{
 const d=creekDistance(x,z);
 if(d<=INNER_WIDTH)return CHANNEL_FLOOR_Y;
 if(d>=OUTER_WIDTH)return GRASS_Y;
 return CHANNEL_FLOOR_Y+(GRASS_Y-CHANNEL_FLOOR_Y)*smooth((d-INNER_WIDTH)/(OUTER_WIDTH-INNER_WIDTH));
}
export function terrainChannelProbe(x:number,z:number){
 return {groundY:terrainHeightAt(x,z),waterY:CREEK_WATER_Y,distance:creekDistance(x,z)};
}
export function buildCarvedTerrain(outline:readonly (readonly [number,number])[],material:THREE.MeshStandardMaterial){
 if(outline.length<3)throw Error('The valley outline must have 3 or more points');
 const samples=outline.length*3,coords:number[]=[],colors:number[]=[],indices:number[]=[];
 const grass=new THREE.Color('#ffffff'),bank=new THREE.Color('#c6b69b'),mix=new THREE.Color();
 const append=(x:number,z:number)=>{
  const distance=creekDistance(x,z),y=terrainHeightAt(x,z);
  coords.push(x,y,z);
  mix.copy(grass).lerp(bank,1-smooth((distance-1.26)/1.44));
  colors.push(mix.r,mix.g,mix.b);
 };
 // One shared center + inward-to-outward concentric rings. This contour is
 // star-shaped around the origin (the supplied lowpoly floating island).
 append(0,0);
 for(let ring=1;ring<=RINGS;ring++){
  const radius=ring/RINGS;
  for(let a=0;a<samples;a++){
   const edgePosition=a/3,from=Math.floor(edgePosition),t=edgePosition-from;
   const left=outline[from%outline.length],right=outline[(from+1)%outline.length];
   const x=(left[0]+(right[0]-left[0])*t)*radius;
   const z=(left[1]+(right[1]-left[1])*t)*radius;
   append(x,z);
  }
 }
 const ringAt=(ring:number,a:number)=>1+(ring-1)*samples+(a%samples+samples)%samples;
 // Counterclockwise in XZ is clockwise when seen from +Y, hence reverse
 // the fan order for an upward-facing top surface.
 for(let a=0;a<samples;a++)indices.push(0,ringAt(1,a+1),ringAt(1,a));
 for(let r=2;r<=RINGS;r++)for(let a=0;a<samples;a++){
  const innerA=ringAt(r-1,a),innerB=ringAt(r-1,a+1);
  const outerA=ringAt(r,a),outerB=ringAt(r,a+1);
  indices.push(innerA,innerB,outerA,outerA,innerB,outerB);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.userData.terrainRings=RINGS;
 geo.userData.terrainSegments=samples;
 material.vertexColors=true;material.needsUpdate=true;
 const mesh=new THREE.Mesh(geo,material);
 mesh.name='carved-island-ground';mesh.receiveShadow=true;mesh.castShadow=false;
 mesh.userData.riverCarved=true;
 return mesh;
}
