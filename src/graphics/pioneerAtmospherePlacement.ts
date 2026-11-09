import type {PioneerWorld} from '../simulation/pioneerWorld.ts';
import {pioneerCottageArchetype,pioneerCottageOrdinal} from './pioneerArchetypes.ts';
import {pioneerDeciduousLocations} from '../simulation/pioneerNaturalAnchors.ts';
import {distanceToCreekSpline} from '../simulation/creekCorridor.ts';
import {pioneerIslandFraction} from '../simulation/pioneerGeography.ts';
import type {WeatherArtPlacement} from './weatherArt.ts';

function hash(n:number){
 let k=(n+339)>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 return ((k^(k>>>13))>>>0)/4294967296;
}
export const PIONEER_DECIDUOUS_TREES=pioneerDeciduousLocations();
const riverDistance=distanceToCreekSpline;
/** Real land-only, stable contacts: the founders' camp and protected canopy
 * footprints. Do not use the classic mode's hardcoded tavern coordinates. */
export function pioneerWeatherPlacement(s:PioneerWorld):WeatherArtPlacement{
 const centers:[number,number,number][]=[
  [s.camp.x,s.camp.z,2.6],
  ...pioneerDeciduousLocations(s).map(([x,z,size])=>[x,z,2.1*size] as [number,number,number])
 ];
 const splashSites:[number,number][]=[];
 for(let i=0;splashSites.length<22&&i<180;i++){
  const [cx,cz,r]=centers[i%centers.length];
  const angle=hash(i*17+s.seed)*Math.PI*2;
  const distance=.55+hash(i*19+31)*r;
  const x=cx+Math.cos(angle)*distance,z=cz+Math.sin(angle)*distance;
  if(pioneerIslandFraction(x,z,1.4,1.4)>.82||riverDistance(x,z)<1.50)continue;
  splashSites.push([x,z]);
 }
 if(!splashSites.length)splashSites.push([s.camp.x,s.camp.z]);
 const puddles=splashSites.filter((_,i)=>i%5===0).slice(0,4)
  .map(([x,z],i)=>[x,z,.42+(i%2)*.18,.30+(i%3)*.05] as const);
 return {
  rainBounds:{minX:-19,maxX:15.8,minZ:-11,maxZ:11},
  splashSites,puddles,roofDrips:[],
  mistSites:[[-15,-5],[-14,5],[-9,0],[-4,6],[0,-7],[9,-4],[12,6]]
 };
}
/** No roof exists until an actual paid building finishes. Roof drips attach
 * to parcel rotations and the *same* eave profiles used by pioneerVillage. */
export function pioneerRoofDrips(s:PioneerWorld):readonly (readonly [number,number,number])[]{
 const positions:[number,number,number][]=[];
 const profiles:Record<string,readonly [number,number,number]>={
  granary:[1.23,1.14,2.64],
  'wood-yard':[1.29,1.18,1.86],'fish-hut':[1.34,1.11,1.85],
  'tea-stop':[1.19,1.03,1.52]
 };
 for(const built of s.buildings){
  const profile=built.kind==='cottage'?(()=>{
   const roof=pioneerCottageArchetype(
    pioneerCottageOrdinal(s.buildings,built.id)).roof;
   return [roof.halfWidth,roof.halfDepth,roof.eaveY] as const;
  })():profiles[built.kind];
  if(!profile)continue;
  const [halfWidth,halfDepth,eaveY]=profile,p=built.parcel;
  const cos=Math.cos(p.rotation),sin=Math.sin(p.rotation);
  for(let i=0;i<5;i++){
   const lx=(i-2)*halfWidth*.38,lz=halfDepth*.96;
   positions.push([p.x+lx*cos+lz*sin,eaveY+.18,p.z-lx*sin+lz*cos]);
  }
 }
 return positions;
}
