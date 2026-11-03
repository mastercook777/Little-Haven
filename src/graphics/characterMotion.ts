import type {ActivityId} from '../simulation/routines.ts';

/** A small deterministic procedural pose library: no clip mixer, no LLM, no frame RNG. */
export interface CharacterPose{
 leftArmX:number;rightArmX:number;leftArmZ:number;rightArmZ:number;
 leftLegX:number;rightLegX:number;leftKnee:number;rightKnee:number;
 torsoX:number;torsoZ:number;headY:number;hem:number;bob:number;
}
export const REST_POSE:CharacterPose={
 leftArmX:.09,rightArmX:.09,leftArmZ:.06,rightArmZ:-.06,
 leftLegX:0,rightLegX:0,leftKnee:.05,rightKnee:.05,
 torsoX:0,torsoZ:0,headY:0,hem:0,bob:0
};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const x=clamp(v);return x*x*(3-2*x);};
const wave=(t:number,s=1)=>Math.sin(t*s);
const eased=(t:number,start:number,end:number)=>smooth((t-start)/(end-start));
const lerp=(a:number,b:number,u:number)=>a+(b-a)*u;
export function sampleCharacterPose(action:ActivityId,t:number,id:number,walking:boolean,rain:boolean):CharacterPose{
 const breath=Math.sin(t*1.42+id*.67),slow=Math.sin(t*.39+id*.91);
 const p:CharacterPose={...REST_POSE,bob:breath*.011,hem:slow*.034,headY:slow*.09};
 if(walking){
  const phase=t*(rain?9.8:7.7)+id*.83,step=Math.sin(phase);
  const reach=Math.cos(phase);
  p.leftLegX=step*.51;p.rightLegX=-step*.51;
  p.leftKnee=.08+Math.max(0,-reach)*.47;
  p.rightKnee=.08+Math.max(0,reach)*.47;
  p.leftArmX=-step*.37-.07;p.rightArmX=step*.37-.07;
  p.leftArmZ=.08;p.rightArmZ=-.08;
  p.torsoX=.045;p.torsoZ=step*.038;
  p.bob=.012+Math.abs(reach)*.016;
  p.hem=step*.10;p.headY=step*.035;
  return p;
 }
 switch(action){
  case 'sweep':{
   // Sweep left and right with low broom contact and weight transfer.
   const stroke=Math.sin(t*2.50+id*.28);
   p.rightArmX=-.86+stroke*.38;p.rightArmZ=-.28+stroke*.19;
   p.leftArmX=-.48-stroke*.21;p.leftArmZ=.17;
   p.torsoX=.13;p.torsoZ=stroke*.085;
   p.leftLegX=.16;p.rightLegX=-.13;
   p.headY=stroke*.045;break;
  }
  case 'carry':{
   const shift=Math.sin(t*1.1+id*.33);
   p.leftArmX=-.83;p.rightArmX=-.81;p.leftArmZ=.17;p.rightArmZ=-.17;
   p.torsoX=.13+shift*.028;p.torsoZ=shift*.026;
   p.leftKnee=.14;p.rightKnee=.12;
   p.bob=shift*.009;break;
  }
  case 'serve':{
   const serve=Math.sin(t*.83+id*.24);
   p.leftArmX=-.37;p.rightArmX=-1.06+serve*.035;p.rightArmZ=-.12;
   p.torsoX=.01;p.headY=serve*.14;
   p.bob=.006+breath*.009;break;
  }
  case 'gather':{
   // Bend → reach → pick → rise. A single cycle instead of perpetual flailing.
   const cycle=(t*.29+id*.11)%1,bend=eased(cycle,.11,.36)*(1-eased(cycle,.68,.92));
   p.torsoX=.40*bend;p.leftArmX=-.43-.57*bend;p.rightArmX=-.40-.66*bend;
   p.leftKnee=.12+.25*bend;p.rightKnee=.11+.29*bend;
   p.headY=-.13*bend;p.bob=-.10*bend;
   break;
  }
  case 'weave':{
   const shuttle=Math.sin(t*3.35+id*.26);
   p.leftArmX=-.54+shuttle*.39;p.rightArmX=-.58-shuttle*.37;
   p.leftArmZ=.15;p.rightArmZ=-.15;
   p.torsoX=.07;p.torsoZ=shuttle*.033;
   break;
  }
  case 'fish':{
   // Patient stillness interrupted by a deliberate brief rod lift.
   const phase=(t*.12+id*.17)%1,lift=eased(phase,.66,.78)*(1-eased(phase,.89,.98));
   p.rightArmX=-.76-.45*lift;p.leftArmX=-.27;
   p.rightArmZ=-.1;p.torsoX=-.03-.07*lift;
   p.headY=-.10*lift+slow*.035;break;
  }
  case 'train':{
   // Guard (0–0.9) → slash (0.9–1.45) → settle (1.45–2.7).
   const phase=(t*.91+id*.13)%2.7;
   const lift=eased(phase,.24,.92);
   const strike=eased(phase,.95,1.42);
   const settle=eased(phase,1.53,2.40);
   p.rightArmX=lerp(lerp(-.35,-1.23,lift),.38,strike)* (1-settle)+(-.42)*settle;
   p.rightArmZ=-.32+Math.sin(phase*2.2)*.22;
   p.leftArmX=-.53+Math.sin(phase*1.9)*.17;p.leftArmZ=.14;
   p.leftLegX=.25;p.rightLegX=-.28;
   p.leftKnee=.27;p.rightKnee=.24;
   p.torsoZ=(-.11*lift+.23*strike)*(1-settle);
   p.torsoX=.09*lift-.06*strike;
   p.hem=p.torsoZ*.48;break;
  }
  case 'greet':{
   const hello=Math.sin(t*2.18+id*.4);
   p.rightArmX=-1.03+hello*.14;p.rightArmZ=-.32+hello*.17;
   p.leftArmX=-.21;p.headY=.15+slow*.04;break;
  }
  case 'shelter':
   p.leftArmX=-.34;p.rightArmX=-.37;p.torsoX=.12;p.headY=.11;break;
  case 'rest':
   p.leftArmX=-.15;p.rightArmX=-.13;p.headY=slow*.15;break;
  case 'sleep':
   p.leftArmX=.10;p.rightArmX=.10;p.headY=slow*.025;break;
  default:
   p.torsoZ=slow*.016;p.headY=slow*.12;break;
 }
 return p;
}
export function interpolatePose(previous:CharacterPose,target:CharacterPose,alpha:number):CharacterPose{
 const factor=clamp(alpha);
 if(factor===0)return {...previous};
 if(factor===1)return {...target};
 const out={...previous};
 for(const k of Object.keys(out) as (keyof CharacterPose)[])out[k]+= (target[k]-out[k])*factor;
 return out;
}
