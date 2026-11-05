import * as THREE from 'three';
import type {Weather} from '../simulation/weather.ts';
import {fallingRainY,rainSegmentY} from './weatherMotion.ts';

/** Shared classic storm renderer. The pioneer valley supplies its own physical
 * land, puddle and eave positions rather than inheriting the classic tavern. */
export interface WeatherArtPlacement {
 rainBounds?:{minX:number;maxX:number;minZ:number;maxZ:number};
 splashSites?:readonly (readonly [number,number])[];
 puddles?:readonly (readonly [number,number,number,number])[];
 mistSites?:readonly (readonly [number,number])[];
 roofDrips?:readonly (readonly [number,number,number])[];
}
export interface WeatherArt {
 root:THREE.Group;setWeather(weather:Weather):void;animate(t:number):void;
 setRoofDrips(points:readonly (readonly [number,number,number])[]):void;
 mode():Weather;streakCount:number;splashCount:number;puddleCount:number;
 roofDripCount():number;sampleSplashCenters():readonly (readonly [number,number])[];
 sampleDrops(count:number):{headY:number;tailY:number}[];
}
const rnd=(n:number)=>{
 let x=(n+31)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);
 x=Math.imul(x^(x>>>13),0xc2b2ae35);return ((x^(x>>>16))>>>0)/4294967296;
};
export function createWeatherArt(parent:THREE.Object3D,mobile:boolean,reducedMotion=false,
 placement:WeatherArtPlacement={}):WeatherArt {
 const root=new THREE.Group();parent.add(root);
 root.name='classic-shared-weather-system';
 const rainGroup=new THREE.Group();rainGroup.name='storm-rain-and-ground-impact';root.add(rainGroup);
 const fogGroup=new THREE.Group();fogGroup.name='terrain-mist';root.add(fogGroup);
 const count=reducedMotion?140:mobile?340:730;
 const bounds=placement.rainBounds??{minX:-15.7,maxX:15.5,minZ:-11,maxZ:11};
 const geometry=new THREE.BufferGeometry(),vertices=new Float32Array(count*6);
 const bases=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  bases[3*i]=bounds.minX+rnd(i*17+13)*(bounds.maxX-bounds.minX);
  bases[3*i+1]=.5+rnd(i*13+22)*11;
  bases[3*i+2]=bounds.minZ+rnd(i*19+5)*(bounds.maxZ-bounds.minZ);
 }
 function setStreak(i:number,y:number){
  const a=i*6,x=bases[3*i],z=bases[3*i+2];
  const [head,tail]=rainSegmentY(y);
  vertices[a]=x;vertices[a+1]=head;vertices[a+2]=z;
  vertices[a+3]=x-.055;vertices[a+4]=tail;vertices[a+5]=z+.025;
 }
 for(let i=0;i<count;i++)setStreak(i,bases[3*i+1]);
 geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3)
  .setUsage(THREE.DynamicDrawUsage));
 const rain=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
  color:'#b7d0d7',transparent:true,opacity:.43,depthWrite:false,depthTest:true}));
 rain.name='shared-classic-falling-rain';rain.frustumCulled=false;
 rain.raycast=()=>{};rainGroup.add(rain);

 const rippleGeo=new THREE.RingGeometry(.23,.30,14);
 const rippleMat=new THREE.MeshBasicMaterial({color:'#d3e7e7',side:THREE.DoubleSide,
  transparent:true,opacity:.33,depthWrite:false});
 const splashCount=mobile?12:22;
 const defaultSites=Array.from({length:splashCount},(_,i)=>
  [-12+rnd(i*41+2)*25,-9+rnd(i*23+1)*18] as const);
 const splashSites=placement.splashSites?.length?placement.splashSites:defaultSites;
 const splashes=new THREE.InstancedMesh(rippleGeo,rippleMat,splashCount);
 const dummy=new THREE.Object3D();
 splashes.name='shared-classic-rain-impact-ripples';splashes.frustumCulled=false;
 splashes.raycast=()=>{};rainGroup.add(splashes);

 // Short, three-pronged upward crowns grow from the same landing positions
 // as the ring. All crowns share ONE LineSegments draw call.
 const sprayVertices=new Float32Array(splashCount*18);
 const sprayGeometry=new THREE.BufferGeometry();
 sprayGeometry.setAttribute('position',new THREE.BufferAttribute(sprayVertices,3)
  .setUsage(THREE.DynamicDrawUsage));
 const spray=new THREE.LineSegments(sprayGeometry,new THREE.LineBasicMaterial({
  color:'#d5e9e9',transparent:true,opacity:.54,depthWrite:false}));
 spray.name='ground-impact-water-crowns';spray.frustumCulled=false;
 spray.raycast=()=>{};spray.visible=!reducedMotion;rainGroup.add(spray);

 const poolGeo=new THREE.CircleGeometry(1,24);
 const poolMat=new THREE.MeshStandardMaterial({color:'#638d91',metalness:.10,
  roughness:.22,transparent:true,opacity:.74,depthWrite:false,side:THREE.DoubleSide});
 const puddleSites=placement.puddles??[[-6.15,3.8,1.3,.63],[-3.4,4.3,.86,.5],
  [-8.0,-2.9,1.0,.38],[3.7,2.4,1.35,.5],[6.3,2.9,.95,.37],
  [-10.1,5.5,.67,.35]] as const;
 for(const [x,z,w,d] of puddleSites){
  const puddle=new THREE.Mesh(poolGeo,poolMat);
  puddle.name='shared-classic-rain-puddle';puddle.rotation.x=-Math.PI/2;
  puddle.position.set(x,.294,z);puddle.scale.set(w,d,1);
  puddle.raycast=()=>{};rainGroup.add(puddle);
 }

 const roofStreamMat=new THREE.LineBasicMaterial({color:'#bfd8d9',transparent:true,
  opacity:.54,depthWrite:false});
 const dripMesh=new THREE.LineSegments(new THREE.BufferGeometry(),roofStreamMat);
 dripMesh.name='real-roof-rain-runoff';dripMesh.raycast=()=>{};rainGroup.add(dripMesh);
 let dripCount=0;
 function setRoofDrips(points:readonly (readonly [number,number,number])[]){
  const drips=new Float32Array(points.length*6);
  for(let i=0;i<points.length;i++){
   const [x,y,z]=points[i],a=i*6;
   drips.set([x,y,z,x+.02,Math.max(.35,y-1.2),z+.05],a);
  }
  const next=new THREE.BufferGeometry();
  next.setAttribute('position',new THREE.BufferAttribute(drips,3));
  dripMesh.geometry.dispose();dripMesh.geometry=next;dripCount=points.length;
 }
 const classicRoofDrips:[number,number,number][]=[];
 if(!placement.roofDrips){
  for(let i=0;i<12;i++)classicRoofDrips.push([-5.55+i*.41,3.95,2.33]);
  for(let i=0;i<6;i++)classicRoofDrips.push([-10.4+i*.51,2.91,-4.03]);
  for(let i=0;i<4;i++)classicRoofDrips.push([2.30+i*.59,3.38,-4.14]);
 }
 setRoofDrips(placement.roofDrips??classicRoofDrips);

 const fogGeo=new THREE.IcosahedronGeometry(1.1,1);
 const mistMat=new THREE.MeshBasicMaterial({color:'#d5dedc',transparent:true,
  opacity:.26,depthWrite:false});
 const mistSites=placement.mistSites??Array.from({length:7},(_,i)=>
  [-14+i*4.25,-8+(i%3)*7] as const);
 for(const [x,z] of mistSites){
  const puff=new THREE.Mesh(fogGeo,mistMat);
  puff.position.set(x,.55,z);puff.scale.set(2.6,.32,1.6);
  puff.raycast=()=>{};fogGroup.add(puff);
 }
 let current:Weather='clear',lastTick=-1;
 function setSplash(i:number,t:number){
  const [x,z]=splashSites[i%splashSites.length];
  const phase=((t*1.9+rnd(i*7)*2.1)%2.1)/2.1;
  dummy.position.set(x,.325,z);dummy.rotation.set(-Math.PI/2,0,0);
  dummy.scale.setScalar((.43+phase*.94)*(phase>.85?.35:1));
  dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);
  for(let k=0;k<3;k++){
   const a=i*18+k*6,theta=k*2.094+i*.63;
   const dist=.07+phase*.17,px=x+Math.cos(theta)*dist,pz=z+Math.sin(theta)*dist;
   const height=.035+Math.sin(phase*Math.PI)*.24;
   sprayVertices.set([x,.34,z,px,.34+height,pz],a);
  }
 }
 for(let i=0;i<splashCount;i++)setSplash(i,0);
 splashes.instanceMatrix.needsUpdate=true;
 function animate(t:number){
  if(current==='rain'){
   if(reducedMotion)return;
   const tick=Math.floor(t*30);
   if(tick===lastTick)return;lastTick=tick;
   for(let i=0;i<count;i++)setStreak(i,fallingRainY(bases[3*i+1],t,6.4+rnd(i)*2));
   (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
   for(let i=0;i<splashCount;i++)setSplash(i,t);
   splashes.instanceMatrix.needsUpdate=true;
   (sprayGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
  }else if(current==='fog'){
   fogGroup.position.x=Math.sin(t*.18)*.18;
  }
 }
 rainGroup.visible=false;fogGroup.visible=false;
 return {root,streakCount:count,splashCount,puddleCount:puddleSites.length,
  roofDripCount:()=>dripCount,sampleSplashCenters:()=>splashSites,
  setRoofDrips,mode:()=>current,sampleDrops:(requested:number)=>{
   const samples:{headY:number;tailY:number}[]=[];
   for(let i=0;i<Math.min(count,Math.max(0,requested));i++)
    samples.push({headY:vertices[i*6+1],tailY:vertices[i*6+4]});
   return samples;
  },setWeather(weather){
   current=weather;rainGroup.visible=weather==='rain';fogGroup.visible=weather==='fog';
  },animate};
}
