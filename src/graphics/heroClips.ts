import * as THREE from 'three';

/**
 * Authored animation clips based on CloudAI-X/threejs-animation SKILL.md.
 *
 * This is a real AnimationMixer/Action/Clip pipeline, but it currently drives
 * the game's named articulated workshop-doll groups. It is NOT a claim that a
 * new skinned GLB or professionally rigged character has been produced.
 */
export type HeroClipId='idle'|'walk'|'sword-form';
type PoseKey='upperX'|'upperZ'|'headY'|'leftArmX'|'leftArmZ'|'rightArmX'|'rightArmZ'
 |'leftLegX'|'rightLegX'|'leftKneeX'|'rightKneeX'|'wristX'|'wristZ';
export const HERO_TRACKS:Readonly<Record<PoseKey,string>>={
 upperX:'articulated-torso.rotation[x]',upperZ:'articulated-torso.rotation[z]',
 headY:'head-and-hair.rotation[y]',
 leftArmX:'left-shoulder.rotation[x]',leftArmZ:'left-shoulder.rotation[z]',
 rightArmX:'right-shoulder.rotation[x]',rightArmZ:'right-shoulder.rotation[z]',
 leftLegX:'left-hip.rotation[x]',rightLegX:'right-hip.rotation[x]',
 leftKneeX:'left-knee.rotation[x]',rightKneeX:'right-knee.rotation[x]',
 wristX:'sword-wrist.rotation[x]',wristZ:'sword-wrist.rotation[z]'
};
export interface HeroPose{
 upperX:number;upperZ:number;headY:number;leftArmX:number;leftArmZ:number;
 rightArmX:number;rightArmZ:number;leftLegX:number;rightLegX:number;
 leftKneeX:number;rightKneeX:number;wristX:number;wristZ:number;
}
const neutral:HeroPose={upperX:0,upperZ:0,headY:0,leftArmX:.07,leftArmZ:.07,
 rightArmX:-.18,rightArmZ:-.05,leftLegX:0,rightLegX:0,
 leftKneeX:-.08,rightKneeX:-.08,wristX:0,wristZ:0};
const pose=(args:Partial<HeroPose>):HeroPose=>({...neutral,...args});
export const SWORD_FORM_KEYFRAMES:readonly {phase:'ready'|'guard'|'gather'|'cut'|'follow'|'recover';time:number;pose:HeroPose}[]=[
 {phase:'ready',time:0,pose:pose({rightArmX:-.38,leftArmX:-.28})},
 {phase:'guard',time:.48,pose:pose({rightArmX:-1.24,rightArmZ:-.30,wristZ:.28,
  upperX:.04,upperZ:-.12,leftArmX:-.68,leftLegX:.21,rightLegX:-.23,leftKneeX:-.22,rightKneeX:-.29})},
 {phase:'gather',time:.98,pose:pose({rightArmX:-1.42,rightArmZ:-.47,wristZ:.53,
  upperX:-.06,upperZ:-.24,leftArmX:-.73,leftArmZ:.15,
  leftLegX:.32,rightLegX:-.31,leftKneeX:-.34,rightKneeX:-.28})},
 {phase:'cut',time:1.19,pose:pose({rightArmX:-.18,rightArmZ:.48,wristX:.30,wristZ:-.99,
  upperX:.13,upperZ:.24,headY:.19,leftArmX:-.45,leftArmZ:.16,
  leftLegX:-.08,rightLegX:.33,leftKneeX:-.26,rightKneeX:-.50})},
 {phase:'follow',time:1.53,pose:pose({rightArmX:.12,rightArmZ:.62,wristX:.52,wristZ:-1.28,
  upperX:.16,upperZ:.28,headY:.26,leftArmX:-.38,leftArmZ:.14,
  leftLegX:-.14,rightLegX:.26,leftKneeX:-.24,rightKneeX:-.43})},
 {phase:'recover',time:2.10,pose:pose({rightArmX:-.56,rightArmZ:-.10,wristX:.08,
  upperX:.06,upperZ:.04,leftArmX:-.41,leftArmZ:.03,
  leftLegX:.16,rightLegX:-.12,leftKneeX:-.15,rightKneeX:-.15})},
 {phase:'ready',time:2.74,pose:pose({rightArmX:-.38,leftArmX:-.28})}
];
function buildClip(name:HeroClipId,duration:number,frames:readonly {time:number;pose:HeroPose}[]):THREE.AnimationClip{
 const times=frames.map(f=>f.time);
 const tracks:THREE.KeyframeTrack[]=[];
 for(const [property,path] of Object.entries(HERO_TRACKS) as [PoseKey,string][]){
  const values=frames.map(f=>f.pose[property]);
  const track=new THREE.NumberKeyframeTrack(path,times,values);
  track.setInterpolation(name==='sword-form'?THREE.InterpolateLinear:THREE.InterpolateSmooth);
  tracks.push(track);
 }
 const clip=new THREE.AnimationClip(name,duration,tracks);
 if(!clip.validate())throw new Error('Invalid hero clip: '+name);
 return clip;
}
const idleFrames=[
 {time:0,pose:pose({rightArmX:-.26,leftArmX:-.26})},
 {time:.85,pose:pose({upperX:.025,headY:.055,rightArmX:-.28,leftArmX:-.25})},
 {time:1.7,pose:pose({rightArmX:-.26,leftArmX:-.26})}
];
const walkFrames=[
 {time:0,pose:pose({leftLegX:.46,rightLegX:-.46,leftKneeX:-.16,rightKneeX:-.50,
  leftArmX:-.39,rightArmX:.26,upperX:.045,upperZ:-.04,wristZ:.13})},
 {time:.25,pose:pose({leftLegX:0,rightLegX:0,leftKneeX:-.45,rightKneeX:-.15,
  leftArmX:-.13,rightArmX:-.13,upperX:.04})},
 {time:.50,pose:pose({leftLegX:-.46,rightLegX:.46,leftKneeX:-.50,rightKneeX:-.16,
  leftArmX:.27,rightArmX:-.39,upperX:.045,upperZ:.04,wristZ:-.08})},
 {time:.75,pose:pose({leftLegX:0,rightLegX:0,leftKneeX:-.15,rightKneeX:-.45,
  leftArmX:-.13,rightArmX:-.13,upperX:.04})},
 {time:1,pose:pose({leftLegX:.46,rightLegX:-.46,leftKneeX:-.16,rightKneeX:-.50,
  leftArmX:-.39,rightArmX:.26,upperX:.045,upperZ:-.04,wristZ:.13})}
];
export function makeHeroClips():Record<HeroClipId,THREE.AnimationClip>{
 return {idle:buildClip('idle',1.7,idleFrames),
  walk:buildClip('walk',1,walkFrames),
  'sword-form':buildClip('sword-form',2.74,SWORD_FORM_KEYFRAMES)};
}
export interface HeroAnimator{
 update(dt:number,mode:HeroClipId):void;
 currentMode():HeroClipId;
 currentPhase():string;
 tracks:Readonly<Record<HeroClipId,THREE.AnimationClip>>;
}
export function createHeroAnimator(root:THREE.Object3D):HeroAnimator{
 const clips=makeHeroClips();
 const mixer=new THREE.AnimationMixer(root);
 const actions:Record<HeroClipId,THREE.AnimationAction>={
  idle:mixer.clipAction(clips.idle),
  walk:mixer.clipAction(clips.walk),
  'sword-form':mixer.clipAction(clips['sword-form'])
 };
 for(const a of Object.values(actions))a.setLoop(THREE.LoopRepeat,Infinity);
 let active:HeroClipId='idle';
 actions.idle.play();
 return {
  tracks:clips,
  currentMode:()=>active,
  currentPhase:()=>{
   if(active!=='sword-form')return active;
   const t=actions['sword-form'].time%2.74;
   return [...SWORD_FORM_KEYFRAMES].reverse().find(p=>p.time<=t)?.phase||'ready';
  },
  update(dt,mode){
   if(mode!==active){
    const previous=actions[active],next=actions[mode];
    // Match velocity via smooth 0.28s crossfades, not resetting every frame.
    next.reset().play();
    previous.crossFadeTo(next,.28,false);
    active=mode;
   }
   mixer.update(Math.max(0,Math.min(.30,dt)));
  }
 };
}
