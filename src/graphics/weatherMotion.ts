/** World-space motion shared by rendering and deterministic QA.
 * y decreases while the drop falls. The only positive jump occurs at the wrap.
 */
export function fallingRainY(baseY:number,time:number,speed:number,bottom=.30,span=10.6):number{
 if(!Number.isFinite(time)||!Number.isFinite(baseY)||speed<=0||span<=0)throw new Error('Invalid rain motion parameters');
 const displacement=baseY-bottom-time*speed;
 return bottom+(((displacement%span)+span)%span);
}
/** The vertices must define an upper head and a lower tail. */
export function rainSegmentY(headY:number,length=.58):readonly [number,number]{
 if(length<=0)throw new Error('Rain segment length must be positive');
 return [headY,headY-length];
}
