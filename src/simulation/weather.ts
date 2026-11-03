import {getCalendarFromMinutes,type Season} from './calendar.ts';

export type Weather='clear'|'rain'|'fog';
const weights:Record<Season,readonly [number,number,number]>={
 spring:[.48,.35,.17],summer:[.70,.23,.07],autumn:[.61,.14,.25],winter:[.67,.10,.23]
};
/** Stable date+seed hash; never roll weather inside the render loop. */
function hash(seed:number,day:number){
 let x=(Math.floor(seed)^(Math.imul(day+1,0x9e3779b1)))>>>0;
 x=Math.imul(x^(x>>>16),0x85ebca6b);
 x=Math.imul(x^(x>>>13),0xc2b2ae35);
 return ((x^(x>>>16))>>>0)/4294967296;
}
export function getWeatherForMinutes(minutes:number,seed=20261103):Weather{
 const c=getCalendarFromMinutes(minutes),r=hash(seed,c.absoluteDay);
 const [clear,rain]=weights[c.season];
 return r<clear?'clear':r<clear+rain?'rain':'fog';
}
export const WEATHER_NAMES:Record<Weather,string>={clear:'晴',rain:'雨',fog:'雾'};
