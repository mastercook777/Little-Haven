/**
 * Life-driven village development. Simulation only; no DOM, Three.js, clock
 * mutation or renderer references. A guardian can influence the *direction*,
 * but residents carry out all subsequent work independently.
 */
import type {Weather} from './weather.ts';
import type {Season} from './calendar.ts';
import {DAY_MINUTES} from './calendar.ts';

export type VillageDirection='bridge'|'ferry'|'grove';
export type VillagePhase='quiet'|'invitation'|'foundation'|'construction'|'landmark'|'thriving';
export interface VillageGrowthState{
 choice:VillageDirection|null;phase:VillagePhase;
 decisionAt:number;deadlineAt:number;chosenAt:number|null;automatic:boolean;
 workDays:number;lastDayProcessed:number;
 wood:number;food:number;trade:number;prosperity:number;
 completedStages:VillagePhase[];
}
export interface VillageGrowthEvent{
 stage:VillagePhase;title:string;text:string;
 housesDelta:number;populationDelta:number;renownDelta:number;
}
export const DEVELOPMENT_OPTIONS:readonly {id:VillageDirection;label:string;preview:string;landmark:string}[]=[
 {id:'bridge',label:'加固山桥，迎接商路',preview:'新石桥、东岸商棚与两层旅舍，山谷逐渐热闹',landmark:'石桥与山路商埠'},
 {id:'ferry',label:'沿溪设渡，靠水谋生',preview:'下水栈桥、木船、渔市与舟棚，村民聚居河岸',landmark:'河畔渡口与渔市'},
 {id:'grove',label:'整理农圃，邻里共居',preview:'梯田菜圃、果树和新院落，山谷更宁静自足',landmark:'果园田舍与新院落'}
];
const DIRECTIONS=['bridge','ferry','grove'] as const;
const PHASES=['quiet','invitation','foundation','construction','landmark','thriving'] as const;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

/** Existing v3 saves receive a future invitation rather than a retroactive decision. */
export function createVillageGrowth(startMinute=500):VillageGrowthState{
 const day=Math.floor(Math.max(0,startMinute)/DAY_MINUTES);
 const decisionDay=Math.max(24,day+12);
 return {choice:null,phase:'quiet',decisionAt:decisionDay*DAY_MINUTES,
  deadlineAt:(decisionDay+12)*DAY_MINUTES,chosenAt:null,automatic:false,
  workDays:0,lastDayProcessed:day,wood:14,food:18,trade:5,prosperity:20,completedStages:[]};
}
export function hydrateVillageGrowth(raw:unknown,currentMinutes:number):VillageGrowthState{
 const fresh=createVillageGrowth(currentMinutes);
 if(!raw||typeof raw!=='object')return fresh;
 const a=raw as Partial<VillageGrowthState>;
 if(!PHASES.includes(a.phase as VillagePhase)||a.choice!==null&&!DIRECTIONS.includes(a.choice as VillageDirection)
  ||!Number.isFinite(a.decisionAt)||!Number.isFinite(a.deadlineAt)
  ||!Number.isFinite(a.lastDayProcessed)||!Number.isFinite(a.workDays)
  ||!Array.isArray(a.completedStages)||a.completedStages.some(s=>!PHASES.includes(s))
  ||!(a.chosenAt===null||Number.isFinite(a.chosenAt)))return fresh;
 if(a.deadlineAt!<a.decisionAt!||a.decisionAt!<0||a.lastDayProcessed!<0)return fresh;
 if((a.choice===null)!==(a.chosenAt===null))return fresh;
 return {...fresh,...a,wood:clamp(Number(a.wood)||0,0,500),
  food:clamp(Number(a.food)||0,0,500),trade:clamp(Number(a.trade)||0,0,500),
  prosperity:clamp(Number(a.prosperity)||0,0,100),
  workDays:clamp(a.workDays!,0,100_000),lastDayProcessed:Math.floor(a.lastDayProcessed!),
  completedStages:[...new Set(a.completedStages)]};
}
const label=(id:VillageDirection)=>DEVELOPMENT_OPTIONS.find(x=>x.id===id)!;
const event=(stage:VillagePhase,title:string,text:string,housesDelta=0,populationDelta=0,renownDelta=0):VillageGrowthEvent=>
 ({stage,title,text,housesDelta,populationDelta,renownDelta});
export function chooseVillageDirection(g:VillageGrowthState,direction:VillageDirection,minute:number,automatic=false):VillageGrowthEvent|null{
 if(g.phase!=='invitation'||g.choice!==null||!DIRECTIONS.includes(direction)||minute<g.decisionAt)return null;
 g.choice=direction;g.chosenAt=minute;g.automatic=automatic;g.phase='foundation';g.completedStages.push('foundation');
 const desc=direction==='bridge'?'村民将木料送上石桥，商人开始测量桥头铺位。':
  direction==='ferry'?'沈叔和乡邻沿河打桩，准备渡船和晒网场。':
  '乡邻整出河西空地，开始修菜畦、果园和新院落。';
 return event('foundation',automatic?'乡邻自定新去处':'守谷人指了一条发展路',
  (automatic?'无人干预，乡邻商议后决定：':'守谷人选择：')+label(direction).label+'。'+desc);
}
const nextPhase=(days:number):VillagePhase=>days>=78?'thriving':days>=37?'landmark':days>=15?'construction':'foundation';
/** Called once per chronological day boundary, not per frame. */
export function advanceVillageGrowthDay(g:VillageGrowthState,minute:number,season:Season,weather:Weather):VillageGrowthEvent[]{
 const day=Math.floor(minute/DAY_MINUTES);
 if(day<=g.lastDayProcessed)return [];
 const events:VillageGrowthEvent[]=[];
 // World.advanceWorld already visits every crossed day; loop makes this helper
 // safe when called independently on sparse day stamps.
 for(let current=g.lastDayProcessed+1;current<=day;current++){
  const at=current*DAY_MINUTES;
  const woods=weather==='rain'?1:season==='winter'?2:3;
  const harvest=season==='winter'?1:season==='autumn'?4:3;
  g.wood=clamp(g.wood+woods,0,500);g.food=clamp(g.food+harvest-2,0,500);
  g.trade=clamp(g.trade+(g.choice==='bridge'?3:g.choice==='ferry'?2:1),0,500);
  if(g.phase==='quiet'&&at>=g.decisionAt){
   g.phase='invitation';
   events.push(event('invitation','水脉与村路','一季雨水过后，乡邻开始商议这条河该如何改变村庄：加固山桥、发展渡口，还是整出田舍。'));
  }
  if(g.phase==='invitation'&&at>=g.deadlineAt){
   const result=chooseVillageDirection(g,'grove',at,true);
   if(result)events.push(result);
  }
  if(g.choice){
   // Foundation/erection requires actual neighbors and finite labor. At least
   // one workday is performed on every day after the decision.
   if(at>g.chosenAt!){
    g.workDays++;
    const cost=g.choice==='bridge'?3:g.choice==='ferry'?2:2;
    g.wood=clamp(g.wood-cost,0,500);
    if(g.workDays%4===0)g.food=clamp(g.food-1,0,500);
    const stage=nextPhase(g.workDays);
    if(stage!==g.phase){
     g.phase=stage;g.completedStages.push(stage);
     if(stage==='construction')
      events.push(event(stage,'新地基渐渐成形',label(g.choice).landmark+'的梁架和围挡已经立起，村民正按日施工。'));
     else if(stage==='landmark'){
      g.prosperity=clamp(g.prosperity+18,0,100);
      const housing=g.choice==='bridge'?2:g.choice==='ferry'?1:2;
      events.push(event(stage,label(g.choice).landmark+'落成',
       '村庄的道路和建筑轮廓变了。'+label(g.choice).preview, housing,g.choice==='bridge'?2:1,g.choice==='bridge'?6:2));
     }else if(stage==='thriving'){
      g.prosperity=clamp(g.prosperity+24,0,100);
      events.push(event(stage,'村庄有了自己的模样',
       label(g.choice).landmark+'日渐兴盛，旧日空地成了人们工作、往来和生活的新地方。',
       g.choice==='grove'?2:1,g.choice==='bridge'?3:2,g.choice==='bridge'?8:3));
     }
    }
   }
  }
 }
 g.lastDayProcessed=day;
 return events;
}
export function villageGrowthLabel(g:VillageGrowthState){
 const route=g.choice?label(g.choice).landmark:'水脉与村路';
 const stages:Record<VillagePhase,string>={quiet:'等待生长',invitation:'等待守谷人选择',foundation:'整理土地',construction:'乡邻施工中',landmark:'新建筑落成',thriving:'村落渐成形'};
 return route+' · '+stages[g.phase];
}
