import {DAY_MINUTES} from './calendar.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';
import type {PioneerWorld,PioneerFounder} from './pioneerWorld.ts';

export type PioneerDirection='autonomous'|'river'|'fields'|'craft'|'road';
export interface PioneerCraftProject{
 phase:'idle'|'building'|'complete';
 woodSpent:number;workHours:number;completedAt:number|null;
}
export interface PioneerLivelihood{
 direction:PioneerDirection;chosenAt:number;
 craft:PioneerCraftProject;firstFishAt:number|null;
}
export const PIONEER_DIRECTIONS:{id:PioneerDirection;label:string;description:string}[]=[
 {id:'autonomous',label:'顺着人心',description:'乡邻仍会自发尝试渔业、储粮与手艺，谁也不被强迫'},
 {id:'river',label:'靠河吃饭',description:'优先勘察岸边建渔棚，真实渔获进入全谷口粮'},
 {id:'fields',label:'田园有余',description:'优先修粮仓，扩大已有口粮储存而不免费增粮'},
 {id:'craft',label:'林间匠村',description:'让木匠花储木和工时试作锯木台，再改善真实采木效率'},
 {id:'road',label:'山路有客',description:'先修茶棚与现成乡路，商旅有实际来往与有代价的招待、交换'}
];
export const PIONEER_CRAFT_WOOD=4,PIONEER_CRAFT_HOURS=6;
const round=(n:number)=>Math.round(n*1000)/1000;
const entry=(s:PioneerWorld,title:string,text:string,causeId:string|null)=>{
 appendPioneerJournal(s,title,text,causeId);
};
export const createPioneerLivelihood=():PioneerLivelihood=>({
 direction:'autonomous',chosenAt:0,
 craft:{phase:'idle',woodSpent:0,workHours:0,completedAt:null},
 firstFishAt:null
});
export function validPioneerLivelihood(s:PioneerWorld){
 const p=s.livelihood,c=p?.craft;
 if(!p||!['autonomous','river','fields','craft','road'].includes(p.direction)||
  !Number.isFinite(p.chosenAt)||p.chosenAt<0||p.chosenAt>s.minutes||
  !c||!['idle','building','complete'].includes(c.phase)||
  !Number.isFinite(c.woodSpent)||!Number.isFinite(c.workHours)||
  !Number.isFinite(c.completedAt??0)||
  !((c.completedAt===null)||(c.completedAt>=0&&c.completedAt<=s.minutes))||
  (p.firstFishAt!==null&&(!Number.isFinite(p.firstFishAt)||p.firstFishAt<0||p.firstFishAt>s.minutes)))return false;
 if(c.phase==='idle')return c.woodSpent===0&&c.workHours===0&&c.completedAt===null;
 if(!s.buildings.some(b=>b.kind==='wood-yard')||c.woodSpent!==PIONEER_CRAFT_WOOD||
  c.workHours<0||c.workHours>PIONEER_CRAFT_HOURS)return false;
 if(c.phase==='building')return c.workHours<PIONEER_CRAFT_HOURS&&c.completedAt===null;
 return c.workHours===PIONEER_CRAFT_HOURS&&c.completedAt!==null;
}
export function setPioneerDirection(s:PioneerWorld,direction:PioneerDirection){
 if(!PIONEER_DIRECTIONS.some(v=>v.id===direction)||s.livelihood.direction===direction)return false;
 // At the first shelter residents may start discussing the later livelihood,
 // but choosing is not a free instant construction.
 if(!s.buildings.some(b=>b.kind==='shelter'))return false;
 s.livelihood.direction=direction;s.livelihood.chosenAt=s.minutes;
 const label=PIONEER_DIRECTIONS.find(x=>x.id===direction)!;
 entry(s,'守谷人提议生计方向',label.label+'。'+label.description,'pioneer-commons');
 return true;
}
export function pioneerFoodCapacity(s:PioneerWorld){
 return s.buildings.some(b=>b.kind==='granary')?54:36;
}
export function pioneerCraftMultiplier(s:PioneerWorld){
 return s.livelihood.craft.phase==='complete'?1.16:1;
}
/** A real carpenter's worksite, a paid material transaction and six
 * exclusive assigned hours are required, not a free tech-point unlock. */
export function considerPioneerCraft(s:PioneerWorld){
 const p=s.livelihood.craft;
 if(p.phase!=='idle'||!s.buildings.some(b=>b.kind==='wood-yard')||
  s.founders.length<5||s.resources.food<s.founders.length*1.5||
  s.resources.wood<Math.max(PIONEER_CRAFT_WOOD+3,8)||
  s.livelihood.direction!=='craft'&&
   !(s.livelihood.direction==='autonomous'&&
     s.buildings.some(b=>b.kind==='fish-hut')&&s.buildings.some(b=>b.kind==='granary')))
  return false;
 s.resources.wood=round(s.resources.wood-PIONEER_CRAFT_WOOD);
 p.phase='building';p.woodSpent=PIONEER_CRAFT_WOOD;p.workHours=0;
 const yard=s.buildings.find(b=>b.kind==='wood-yard')!;
 entry(s,'木作棚试制锯台','从现有存木中拨出 '+PIONEER_CRAFT_WOOD+
  ' 份材料。木匠还要在木作棚里做足六小时，才能改善日后的采木。',yard.id);
 return true;
}
export function performPioneerCraftShift(s:PioneerWorld,worker:PioneerFounder){
 const p=s.livelihood.craft, yard=s.buildings.find(b=>b.kind==='wood-yard');
 if(!yard||p.phase!=='building'||worker.activity!=='craft'||p.workHours>=PIONEER_CRAFT_HOURS)
  return false;
 p.workHours=round(Math.min(PIONEER_CRAFT_HOURS,p.workHours+1));
 if(p.workHours>=PIONEER_CRAFT_HOURS){
  p.phase='complete';p.completedAt=s.minutes;
  entry(s,'锯木台终于装好',worker.name+
   '在真实木作棚做完六小时工。以后同样一次伐木可整理出更多可用木料。',yard.id);
 }
 return true;
}
export function markPioneerFishing(s:PioneerWorld,worker:PioneerFounder,fish:number){
 if(fish<=0||s.livelihood.firstFishAt!==null)return;
 s.livelihood.firstFishAt=s.minutes;
 const hut=s.buildings.find(b=>b.kind==='fish-hut');
 entry(s,'第一篓渔获',worker.name+'在真实河岸站位收下 '+round(fish)+
  ' 份渔获，计入村里实际口粮；不是来访人口或免费赏赐。',hut?.id??null);
}
export interface PioneerMilestoneView{
 id:string;label:string;done:boolean;requirement:string;progress:string;
}
export function pioneerMilestoneBoard(s:PioneerWorld):PioneerMilestoneView[]{
 const counts=(kind:string)=>s.buildings.filter(b=>b.kind===kind).length;
 const fish=s.sites.find(x=>x.kind==='fish');
 return [
  {id:'shelter',label:'避雨有屋',done:counts('shelter')>0,
   requirement:'乡邻用木料与工时盖好第一间棚屋',progress:counts('shelter')?'已落成':'尚在营火旁'},
  {id:'garden',label:'农田第一收',done:s.sites.some(x=>x.kind==='field'&&x.totalGathered>0),
   requirement:'菜圃建成，至少有人实际收一次菜',progress:'菜圃 '+counts('garden')+' 处'},
  {id:'commons',label:'村心渐成',done:s.commons.stage>=3,
   requirement:'住房、人口、灶台与木坊支撑公共议事',progress:s.commons.stage+' / 3 阶'},
  {id:'loft',label:'老屋新阁',done:s.buildings.some(b=>b.kind==='cottage'&&b.loftAddedAt!==undefined),
   requirement:'旧山居土地不够时，村民投入四份木料和八小时改造，才可添一名常住者',
   progress:s.buildings.filter(b=>b.kind==='cottage'&&b.loftAddedAt!==undefined).length+
    ' 座木阁 · 眼下 '+s.founders.length+' 位常住乡邻'},
  {id:'fish',label:'靠河吃饭',done:!!fish&&fish.totalGathered>0,
   requirement:'四位居民、菜圃与村心 → 安全河岸渔棚 → 真实捕鱼',
   progress:fish?'累计捕鱼 '+round(fish.totalGathered)+' 份':counts('fish-hut')?'渔棚已落成':'尚无渔棚'},
  {id:'granary',label:'田园有余',done:counts('granary')>0,
   requirement:'人口增长与两处菜圃 → 投材建粮仓',
   progress:counts('granary')?'存粮上限 54 份':'存粮上限 36 份'},
  {id:'tea',label:'山路有客',done:s.commerce.totalArrivals>0,
   requirement:'稳定村心、九位乡邻、合法乡路 → 付材建茶棚 → 真实访客进出',
   progress:s.buildings.some(b=>b.kind==='tea-stop')?
    '来客 '+s.commerce.totalArrivals+' 位 · 真交换 '+s.commerce.totalExchanges+
     ' 次 · 热茶招待 '+s.commerce.totalHosted+' 次':'尚无茶棚'},
  {id:'craft',label:'林间手艺',done:s.livelihood.craft.phase==='complete',
   requirement:'五位居民、木作棚 → 支付四份木料 → 实际锯作六小时',
   progress:s.livelihood.craft.phase==='idle'?'尚未开工':
    s.livelihood.craft.phase==='building'?'锯台工时 '+s.livelihood.craft.workHours+' / 6':
    '锯台落成 · 木料整理效率提高'}
 ];
}
