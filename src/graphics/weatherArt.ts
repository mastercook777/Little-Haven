import * as THREE from 'three';
import type {Weather} from '../simulation/weather.ts';

/** Rain is a physical, camera-readable curtain with roof runoff and expanding splashes.
 * The baseline Points rain was subpixel at the orthographic camera distance.
 * All streaks share one LineSegments draw; splash rings use one InstancedMesh.
 */
export interface WeatherArt{
 root:THREE.Group;setWeather(weather:Weather):void;animate(t:number):void;
 mode():Weather;streakCount:number;
}
const rnd=(n:number)=>{let x=(n+31)>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return ((x^(x>>>16))>>>0)/4294967296;};
export function createWeatherArt(parent:THREE.Object3D,mobile:boolean,reducedMotion=false):WeatherArt{
 const root=new THREE.Group();parent.add(root);
 const rainGroup=new THREE.Group();root.add(rainGroup);
 const fogGroup=new THREE.Group();root.add(fogGroup);
 const count=reducedMotion?140:mobile?340:730;
 const geometry=new THREE.BufferGeometry(),vertices=new Float32Array(count*6);
 const bases=new Float32Array(count*3);
 for(let i=0;i<count;i++){
  bases[3*i]=-15.7+rnd(i*17+13)*31.2;
  bases[3*i+1]=.5+rnd(i*13+22)*11;
  bases[3*i+2]=-11+rnd(i*19+5)*22;
 }
 function setStreak(i:number,y:number){
  const a=i*6,x=bases[3*i],z=bases[3*i+2];
  vertices[a]=x;vertices[a+1]=y;vertices[a+2]=z;
  vertices[a+3]=x-.055;vertices[a+4]=y-.58;vertices[a+5]=z+.025;
 }
 for(let i=0;i<count;i++)setStreak(i,bases[3*i+1]);
 geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage));
 const rain=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
  color:'#b7d0d7',transparent:true,opacity:.41,depthWrite:false,depthTest:true}));
 rain.frustumCulled=false;rainGroup.add(rain);
 // Darkened cloud banks remain overhead / behind the buildings rather than tinting the entire UI.
 const fogGeo=new THREE.IcosahedronGeometry(1.1,1);
 const poolGeo=new THREE.CircleGeometry(1,24);
 const rippleGeo=new THREE.RingGeometry(.23,.30,14);
 const rippleMat=new THREE.MeshBasicMaterial({color:'#d3e7e7',side:THREE.DoubleSide,transparent:true,opacity:.30,depthWrite:false});
 const splashCount=mobile?12:22;
 const splashes=new THREE.InstancedMesh(rippleGeo,rippleMat,splashCount);
 const dummy=new THREE.Object3D();
 splashes.frustumCulled=false;rainGroup.add(splashes);
 // Wet paving and puddles visibly collect under the tavern, behind the well and the bridge.
 const poolMat=new THREE.MeshStandardMaterial({color:'#638d91',metalness:.10,roughness:.22,transparent:true,opacity:.74,depthWrite:false,side:THREE.DoubleSide});
 for(const [x,z,w,d] of [[-6.15,3.8,1.3,.63],[-3.4,4.3,.86,.5],[-8.0,-2.9,1.0,.38],
  [3.7,2.4,1.35,.5],[6.3,2.9,.95,.37],[-10.1,5.5,.67,.35]] as const){
  const puddle=new THREE.Mesh(poolGeo,poolMat);
  puddle.rotation.x=-Math.PI/2;puddle.position.set(x,.294,z);
  puddle.scale.set(w,d,1);rainGroup.add(puddle);
 }
 const roofStreamMat=new THREE.LineBasicMaterial({color:'#bfd8d9',transparent:true,opacity:.54,depthWrite:false});
 const dripStart:[number,number,number][]=[];
 for(let i=0;i<12;i++)dripStart.push([-5.55+i*.41,3.95,2.33]);
 for(let i=0;i<6;i++)dripStart.push([-10.4+i*.51,2.91,-4.03]);
 for(let i=0;i<4;i++)dripStart.push([2.30+i*.59,3.38,-4.14]);
 const dripGeom=new THREE.BufferGeometry(),drips=new Float32Array(dripStart.length*6);
 for(let i=0;i<dripStart.length;i++){
  const [x,y,z]=dripStart[i],a=i*6;
  drips.set([x,y,z,x+.02,Math.max(.35,y-1.2),z+.05],a);
 }
 dripGeom.setAttribute('position',new THREE.BufferAttribute(drips,3));
 const dripMesh=new THREE.LineSegments(dripGeom,roofStreamMat);rainGroup.add(dripMesh);
 // Fog stays in the valley floor: landmarks remain readable above a mist bank.
 const mistMat=new THREE.MeshBasicMaterial({color:'#d5dedc',transparent:true,opacity:.26,depthWrite:false});
 for(let i=0;i<7;i++){
  const puff=new THREE.Mesh(fogGeo,mistMat);
  puff.position.set(-14+i*4.25,.55,-8+(i%3)*7);
  puff.scale.set(2.6,.32,1.6);fogGroup.add(puff);
 }
 let current:Weather='clear',lastSecond=-1;
 function animate(t:number){
  if(current==='rain'){
   if(reducedMotion)return;
   const quantized=Math.floor(t*30);
   if(quantized!==lastSecond){
    lastSecond=quantized;
    for(let i=0;i<count;i++){
     const y=.30+((bases[3*i+1]+t*(6.4+rnd(i)*2))%10.6);
     setStreak(i,y);
    }
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
   }
   for(let i=0;i<splashCount;i++){
    const x=-12+rnd(i*41+2)*25,z=-9+rnd(i*23+1)*18;
    const phase=(t*1.9+rnd(i*7)*2.1)%2.1;
    dummy.position.set(x,.32,z);dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.setScalar(.45+phase*.38);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);
   }
   splashes.instanceMatrix.needsUpdate=true;
  }else if(current==='fog'){
   fogGroup.position.x=Math.sin(t*.18)*.18;
  }
 }
 return {root,streakCount:count,mode:()=>current,setWeather(weather){
  current=weather;rainGroup.visible=weather==='rain';fogGroup.visible=weather==='fog';
 },animate};
}
