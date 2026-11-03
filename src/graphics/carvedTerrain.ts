import * as THREE from 'three';
import {creekDistance,CREEK_WATER_Y} from './riverArt.ts';

/**
 * The island is no longer a solid colored lid with a creek pasted on top.
 * A subdivided upper terrain surface dips BELOW water into an open channel,
 * and rises into continuous shore slopes on both banks.
 */
export const GRASS_Y=.17;
export const CHANNEL_FLOOR_Y=.044;
const INNER_WIDTH=1.40,OUTER_WIDTH=2.52;
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
function insidePolygon(x:number,z:number,edge:readonly (readonly [number,number])[]):boolean{
 let inside=false;
 for(let i=0,j=edge.length-1;i<edge.length;j=i++){
  const ax=edge[i][0],az=edge[i][1],bx=edge[j][0],bz=edge[j][1];
  const crosses=((az>z)!==(bz>z))&&(x<(bx-ax)*(z-az)/(bz-az)+ax);
  if(crosses)inside=!inside;
 }
 return inside;
}
export function buildCarvedTerrain(outline:readonly (readonly [number,number])[],material:THREE.MeshStandardMaterial){
 const columns=100,rows=74;
 const minX=-17.0,maxX=17.0,minZ=-12.5,maxZ=12.5;
 const coords:number[]=[],colors:number[]=[],indices:number[]=[];
 const base=new THREE.Color('#ffffff'),riverbank=new THREE.Color('#c6b69b');
 const c=new THREE.Color();
 for(let z=0;z<=rows;z++){
  const zz=minZ+(maxZ-minZ)*z/rows;
  for(let x=0;x<=columns;x++){
   const xx=minX+(maxX-minX)*x/columns;
   const distance=creekDistance(xx,zz);
   coords.push(xx,terrainHeightAt(xx,zz),zz);
   c.copy(base).lerp(riverbank,1-smooth((distance-1.26)/1.44));
   colors.push(c.r,c.g,c.b);
  }
 }
 for(let z=0;z<rows;z++)for(let x=0;x<columns;x++){
  const x0=minX+(maxX-minX)*(x+.5)/columns,z0=minZ+(maxZ-minZ)*(z+.5)/rows;
  if(!insidePolygon(x0,z0,outline))continue;
  const a=z*(columns+1)+x,b=a+1,d=a+columns+1,cc=d+1;
  indices.push(a,d,b,b,d,cc);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 material.vertexColors=true;material.needsUpdate=true;
 const mesh=new THREE.Mesh(geo,material);
 mesh.name='carved-island-ground';mesh.receiveShadow=true;mesh.castShadow=false;
 mesh.userData.riverCarved=true;
 return mesh;
}
