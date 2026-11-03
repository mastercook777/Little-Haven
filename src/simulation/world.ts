/**
 * 守望谷 v0.3: one authoritative minute count for days, seasons and years.
 * Deterministic, dependency-free game rules; the renderer never changes the world.
 */
import {DAY_MINUTES,SEASON_MINUTES,SEASON_NAMES,getCalendarFromMinutes,nextSeasonBoundary,type CalendarView} from './calendar.ts';
import {getWeatherForMinutes,type Weather} from './weather.ts';
import {advanceBuildingsDay,createBuildings,startRepair,type BuildingState} from './buildings.ts';
import {rainGuestOpportunity,roofRepairOpportunity,type Opportunity,type GuardianMemory} from './opportunities.ts';
import {validatePlots} from './plots.ts';
import {advanceVillageGrowthDay,chooseVillageDirection as makeVillageChoice,createVillageGrowth,hydrateVillageGrowth,type VillageDirection,type VillageGrowthState} from './villageGrowth.ts';
export {DEVELOPMENT_OPTIONS,villageGrowthLabel} from './villageGrowth.ts';
export type {VillageDirection,VillageGrowthState} from './villageGrowth.ts';
import {alongLane,dailyResidentMotion,type ActivityId} from './routines.ts';
export type {ActivityId} from './routines.ts';
export type {BuildingState,BuildingCondition,BuildingPhase} from './buildings.ts';
export type {Opportunity,GuardianMemory} from './opportunities.ts';
export {DAY_MINUTES} from './calendar.ts';
export type {Season,CalendarView} from './calendar.ts';
export type {Weather} from './weather.ts';

export type Decision='host'|'observe';
export type StoryStage='peace'|'stranger'|'training'|'departed'|'rumor'|'returned'|'legacy';
export type Occupation='樵夫'|'酒馆掌柜'|'茶农'|'药农'|'行脚货郎'|'织娘'|'渔夫'|'习武少年'|'江湖客'|'游商'|'剑庐学徒'|'茶亭伙计';
export interface Villager{
 id:number;name:string;occupation:Occupation;color:string;hair:string;
 personality:string;thought:string;home:[number,number];work:[number,number];offset:number;
}
export interface ChronicleEntry{id:number;day:number;time:number;title:string;text:string;}
export interface WorldState{
 version:3;minutes:number;seed:number;
 population:number;happiness:number;houses:number;renown:number;
 choice:Decision|null;storyStage:StoryStage;storyStarted:number|null;autoChosen:boolean;
 lastDayLogged:number;lastSeasonLogged:number;journal:ChronicleEntry[];lastSavedAt:number;
 buildings:BuildingState[];opportunities:Opportunity[];guardianMemories:GuardianMemory[];villageGrowth:VillageGrowthState;
}
export const MINUTES_PER_REAL_SECOND=3;
export const STORAGE_KEY='little-haven-living-v03-slot-1';
export const SLOT_KEYS=[STORAGE_KEY,'little-haven-living-v03-slot-2'] as const;
export const PREVIOUS_STORAGE_KEY='little-haven-jianghu-v02';
export const STORY_VISITOR_AT=9*60+40;
export const STORY_AUTO_CHOICE_AT=DAY_MINUTES+10*60;
/** Years of actual life separate from fast daily animation. Departure: year two; return: year four. */
export const STORY_MILESTONES={
 training:120,departed:48*DAY_MINUTES,rumor:96*DAY_MINUTES,
 returned:144*DAY_MINUTES,legacy:156*DAY_MINUTES
} as const;
const stageIndex:Record<StoryStage,number>={peace:0,stranger:1,training:2,departed:3,rumor:4,returned:5,legacy:6};
const STAGE_SCHEDULE=(Object.entries(STORY_MILESTONES) as [keyof typeof STORY_MILESTONES,number][]);
export const VILLAGERS:Villager[]=[
 {id:1,name:'梁伯',occupation:'樵夫',color:'#8f8a73',hair:'#554a42',personality:'寡言 · 可靠',thought:'“山里人靠山吃饭，也得懂得护山。”',home:[-9,-5.4],work:[-12.0,-1.3],offset:0},
 {id:2,name:'陆娘',occupation:'酒馆掌柜',color:'#b57763',hair:'#4d4137',personality:'爽朗 · 仗义',thought:'“过了这条山路，谁都能喝一碗热茶。”',home:[-4.5,-4.2],work:[-3.2,2.9],offset:12},
 {id:3,name:'阿禾',occupation:'茶农',color:'#849f79',hair:'#64503c',personality:'勤快 · 细心',thought:'“今年采下的第一篓茶，要留给酒馆。”',home:[-9.7,4.1],work:[-11,6.4],offset:37},
 {id:4,name:'苏婶',occupation:'药农',color:'#b69b76',hair:'#53483b',personality:'和善 · 坚韧',thought:'“山药得晒三回太阳，火候急不得。”',home:[-10,-5.2],work:[-10,5.3],offset:65},
 {id:5,name:'小七',occupation:'行脚货郎',color:'#789999',hair:'#52463b',personality:'好奇 · 机敏',thought:'“外头的消息，可比盐巴还抢手。”',home:[3.6,-5.8],work:[4.7,2.2],offset:90},
 {id:6,name:'秦婶',occupation:'织娘',color:'#aca0b7',hair:'#54463a',personality:'安静 · 体贴',thought:'“等天凉了，该给阿青缝件厚衣裳。”',home:[3.2,-5.4],work:[-8.8,-5.2],offset:120},
 {id:7,name:'沈叔',occupation:'渔夫',color:'#89a8a6',hair:'#685643',personality:'洒脱 · 爱听故事',thought:'“溪水往东流，江湖事却常往西传。”',home:[3.7,7.8],work:[6.2,-2.4],offset:150},
 {id:8,name:'阿青',occupation:'习武少年',color:'#bd9b72',hair:'#352f2b',personality:'坚韧 · 好学',thought:'“总有一天，我要看看山的另一面。”',home:[-9.1,-5.5],work:[1.3,5.8],offset:26},
 {id:9,name:'沈问舟',occupation:'江湖客',color:'#536d7c',hair:'#373738',personality:'寡言 · 藏锋',thought:'“山里这家酒肆，倒是个歇脚的好地方。”',home:[13.4,1.4],work:[-3.1,3.25],offset:0},
 {id:10,name:'阿罗',occupation:'游商',color:'#a99b6b',hair:'#584639',personality:'健谈 · 见多识广',thought:'“我从南边带来了些新鲜消息。”',home:[13.3,1.5],work:[-2.5,3.3],offset:0},
 {id:11,name:'小满',occupation:'剑庐学徒',color:'#a2ad84',hair:'#494339',personality:'勤学 · 伶俐',thought:'“跟阿青学本事，也能照顾来往的客人。”',home:[-1.5,-7.4],work:[4.2,8.8],offset:80}
];


export function createWorld(now=Date.now()):WorldState{
 return {version:3,minutes:8*60+20,seed:20261103,population:8,happiness:82,houses:6,renown:0,
 choice:null,storyStage:'peace',storyStarted:null,autoChosen:false,lastDayLogged:1,lastSeasonLogged:0,lastSavedAt:now,
 buildings:createBuildings(),opportunities:[],guardianMemories:[],villageGrowth:createVillageGrowth(8*60+20,now),
 journal:[{id:1,day:1,time:500,title:'山谷无名',text:'深山中只有几户人家、一间酒肆。少年阿青每日到竹林旁练剑，还不知外面有多大的江湖。'}]};
}
export function getCalendar(s:WorldState):CalendarView{return getCalendarFromMinutes(s.minutes);}
export function getWeather(s:WorldState):Weather{return getWeatherForMinutes(s.minutes,s.seed);}
export function getDay(s:WorldState){return getCalendar(s).absoluteDay;}
export function getClock(s:WorldState){
 const {hour,minute}=getCalendar(s);
 return {hour,minute,text:String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')};
}
export function getDaylight(s:WorldState){
 const h=(s.minutes%DAY_MINUTES)/60;
 return Math.max(0,Math.min(1,(h-5.4)/2,(20.3-h)/2.2));
}
function chronicle(s:WorldState,title:string,text:string,at=s.minutes){
 const time=Math.floor(at%DAY_MINUTES);
 s.journal.push({id:(s.journal.at(-1)?.id||0)+1,day:Math.floor(at/DAY_MINUTES)+1,time,title,text});
 if(s.journal.length>100)s.journal=s.journal.slice(-100);
 return 'journal-'+s.journal.at(-1)!.id;
}

/** Pending opportunities are not instructions to NPCs; they are optional guardian interventions. */
export function pendingOpportunities(s:WorldState):Opportunity[]{
 return s.opportunities.filter(o=>o.state==='available').slice(0,2);
}
/** A single valley-wide choice, independent from the hero's two story branches. */
export function chooseVillageDevelopment(s:WorldState,direction:VillageDirection,automatic=false):boolean{
 const decision=makeVillageChoice(s.villageGrowth,direction,s.minutes,automatic);
 if(!decision)return false;
 const id=chronicle(s,decision.title,decision.text);
 s.villageGrowth.prosperity=Math.min(100,s.villageGrowth.prosperity+2);
 // Keep a causal event in the existing journal. The phase state is the visual source.
 return id.startsWith('journal-');
}
export function buildingById(s:WorldState,id:string):BuildingState|undefined{
 return s.buildings.find(b=>b.id===id);
}
function addBuildingProp(b:BuildingState,prop:string){
 if(!b.props.includes(prop))b.props.push(prop);
}
export function chooseOpportunity(s:WorldState,id:string,optionId:string,automatic=false):boolean{
 const o=s.opportunities.find(item=>item.id===id&&item.state==='available');
 if(!o||!o.options.some(opt=>opt.id===optionId))return false;
 const inn=buildingById(s,'inn-001');
 if(o.kind==='roof-repair'&&(!inn||!startRepair(inn,optionId as 'roof'|'drainage'|'autonomy')))return false;
 o.state='resolved';
 let title='',description='';
 if(o.kind==='rain-guest'){
  if(!inn)return false;
  if(optionId==='stay'){
   addBuildingProp(inn,'guest-umbrella');inn.useScore=Math.min(100,inn.useScore+4);
   title='雨夜留灯';description='陆娘备了热茶，在酒肆门边添起伞架，旅人有了一夜安稳。';
  }else if(optionId==='guide'){
   addBuildingProp(inn,'road-sign');
   title='路口添了指路牌';description='小七按陆娘的话，在山道旁立起木牌，晚归的人不再摸黑走错路。';
  }else{
   addBuildingProp(inn,'warm-tea');
   title='檐下有热茶';description='守谷人未出手，陆娘仍给过路人端了一碗热茶，炉火多亮了一夜。';
  }
 }else{
  title=optionId==='roof'?'乡邻补瓦':optionId==='drainage'?'先修排水':'村民自修屋檐';
  description=optionId==='roof'?'守谷人备下新瓦，梁伯先搭木架，乡亲们开始逐日补屋顶。':
   optionId==='drainage'?'众人先疏通排水，梁伯支起木架，准备慢慢加固旧屋檐。':
   '无人安排修缮，陆娘与梁伯商量后也开始了保守修补。';
 }
 const eventId=chronicle(s,title,description);
 for(const id of o.buildingIds){
  const building=buildingById(s,id);
  if(building&&!building.causeEventIds.includes(eventId))building.causeEventIds.push(eventId);
 }
 s.guardianMemories.push({opportunityId:o.id,chosenOptionId:optionId,
  resolvedAtMinutes:s.minutes,automatic,producedEventIds:[eventId]});
 if(s.guardianMemories.length>120)s.guardianMemories=s.guardianMemories.slice(-120);
 return true;
}
function addOpportunitiesForDay(s:WorldState){
 const seasonIndex=Math.floor(s.minutes/SEASON_MINUTES),inn=buildingById(s,'inn-001');
 if(!inn)return;
 const present=pendingOpportunities(s).length;
 const rainId='rain-guest-'+seasonIndex;
 if(present<2&&getWeather(s)==='rain'&&
  !s.opportunities.some(o=>o.id===rainId)){
  const opportunity=rainGuestOpportunity(seasonIndex,s.minutes);
  const cause=chronicle(s,'雨夜将至','山道起雨，陆娘看见有行脚客在酒幌下躲雨。');
  opportunity.causeIds.push(cause);s.opportunities.push(opportunity);
 }
 const roofId='roof-repair-'+seasonIndex;
 if(pendingOpportunities(s).length<2&&inn.phase==='occupied'&&inn.conditionScore<55&&
  !s.opportunities.some(o=>o.id===roofId)&&
  !s.opportunities.some(o=>o.kind==='roof-repair'&&o.state==='available')){
  const opportunity=roofRepairOpportunity(seasonIndex,s.minutes);
  opportunity.causeIds.push(chronicle(s,'酒肆旧檐待修','连日风雨使瓦色黯淡，陆娘想要为老屋准备修缮。'));
  s.opportunities.push(opportunity);
 }
 // Resolved invitations stay in guardianMemories; keep the active window cheap to serialize.
 if(s.opportunities.length>48)s.opportunities=s.opportunities.filter(o=>o.state==='available').concat(s.opportunities.filter(o=>o.state==='resolved').slice(-32));
}

/** One deliberate choice, or an explicit, recorded autonomous fallback. */
export function chooseFate(s:WorldState,choice:Decision,automatic=false):boolean{
 if(s.storyStage!=='stranger'||s.choice!==null||!['host','observe'].includes(choice))return false;
 s.choice=choice;s.storyStarted=s.minutes;s.autoChosen=automatic;
 chronicle(s,choice==='host'?'留客一宿':'江湖自有缘',choice==='host'
 ?'守谷人为沈问舟留下一盏灯。他在酒馆过夜时，看见了每天练木剑的少年阿青。'
 :automatic?'沈问舟天亮便启程。无人安排阿青的前路，但少年还是记住了那位过客的剑影。'
 :'守谷人没有打断旅人的行程。阿青远远望着山路上的佩剑客，心中生出更大的向往。');
 return true;
}
export interface AdvanceResult{
 newDay:boolean;visitor:boolean;milestones:StoryStage[];completed:boolean;
 crossedSeasons:number;crossedYears:number;visualChanges:string[];pendingChoices:string[];
}
/** Time-ordered event boundaries make stepping, batching and offline recovery converge. */
export function advanceWorld(s:WorldState,realSeconds:number):AdvanceResult{
 const out:AdvanceResult={newDay:false,visitor:false,milestones:[],completed:false,crossedSeasons:0,crossedYears:0,visualChanges:[],pendingChoices:[]};
 if(!Number.isFinite(realSeconds)||realSeconds<=0)return out;
 const startDay=getDay(s),startYear=getCalendar(s).year;
 const target=s.minutes+realSeconds*MINUTES_PER_REAL_SECOND;
 // Practical upper bound: prevent untrusted imports from locking the browser in a giant loop.
 if(!Number.isFinite(target)||target-s.minutes>DAY_MINUTES*48*20)return out;
 let iterations=0;
 while(s.minutes<target-1e-8&&iterations++<1600){
  const nextSeason=nextSeasonBoundary(s.minutes);
  const nextDay=(Math.floor(s.minutes/DAY_MINUTES)+1)*DAY_MINUTES;
  const deadline=Math.min(Infinity,...s.opportunities.filter(o=>o.state==='available').map(o=>Math.max(s.minutes,o.deadlineMinutes)));
  const visitor=s.storyStage==='peace'&&s.minutes<=STORY_VISITOR_AT?STORY_VISITOR_AT:Infinity;
  const fallback=s.storyStage==='stranger'&&s.choice===null?Math.max(s.minutes,STORY_AUTO_CHOICE_AT):Infinity;
  const nextMilestone=s.choice===null||s.storyStarted===null?null:
   STAGE_SCHEDULE.find(([stage])=>stageIndex[s.storyStage]<stageIndex[stage]);
  const milestone=nextMilestone?Math.max(s.minutes,s.storyStarted!+nextMilestone[1]):Infinity;
  const next=Math.min(target,nextDay,nextSeason,visitor,fallback,milestone,deadline);
  if(next<s.minutes)break;
  s.minutes=next;
  if(visitor===next){
   s.storyStage='stranger';out.visitor=true;
   chronicle(s,'山道来客','佩剑的沈问舟从山外走来，在无名酒肆停步。陆娘为他温了一碗茶。');
  }
  if(fallback===next)chooseFate(s,'observe',true);
  if(milestone===next&&nextMilestone){
   const stage=nextMilestone[0];s.storyStage=stage;out.milestones.push(stage);
   if(stage==='training')chronicle(s,s.choice==='host'?'一柄竹剑，一位师父':'一柄竹剑，一条山路',s.choice==='host'
     ?'沈问舟在酒馆院中纠正了阿青的剑式。从此清晨，练武坪上多了一道静静看剑的身影。'
     :'沈问舟走后，阿青从行商手中换来一本残旧剑谱，开始照着书页独自练习。');
   if(stage==='departed')chronicle(s,'少年出山',s.choice==='host'
     ?'第二年，阿青向陆娘辞别，背上行囊，循着师父指的山道去见识江湖。'
     :'第二年，阿青跟着路过的商队踏出山谷。书上的剑法还生疏，远方的路却很长。');
   if(stage==='rumor'){
    s.renown+=s.choice==='host'?12:7;
    chronicle(s,'山外风闻',s.choice==='host'
      ?'游商说，在南边渡口见过一位名叫阿青的年轻剑客，替人挡下了欺客的恶徒。'
      :'行脚人捎来消息：阿青一路护送商旅，学会了看路、辨人，也摸索出自己的剑法。');
   }
   if(stage==='returned')chronicle(s,'故人归来',s.choice==='host'
     ?'数年江湖路后，阿青佩剑归乡，站在旧日练武坪前，半晌没有说话。'
     :'阿青带着满身风尘回到酒肆。他不急着远行了，先为过路人煮了一壶茶。');
   if(stage==='legacy'){
    s.houses+=1;s.population+=1;s.happiness=Math.min(100,s.happiness+7);s.renown+=8;out.completed=true;
    chronicle(s,s.choice==='host'?'竹隐剑庐落成':'行脚茶亭开张',s.choice==='host'
     ?'阿青在练武坪边搭起剑庐，收下第一位山中学徒。小小山谷终于有了一门自己的剑法。'
     :'阿青在通往山外的路边修起茶亭，让风尘仆仆的人都有一处歇脚之地。');
   }
  }
  if(deadline===next){
   for(const opportunity of [...s.opportunities]){
    if(opportunity.state==='available'&&opportunity.deadlineMinutes<=next)
     chooseOpportunity(s,opportunity.id,opportunity.defaultOutcomeId,true);
   }
  }
  if(nextDay===next){
   const daily=advanceBuildingsDay(s.buildings,getCalendar(s),getWeather(s));
   for(const change of daily){
    const id=chronicle(s,change.title,change.text);
    const building=buildingById(s,change.buildingId);
    if(building&&!building.causeEventIds.includes(id))building.causeEventIds.push(id);
    if(change.tag==='repair-completed'&&change.buildingId==='inn-001'){
     const memory=[...s.guardianMemories].reverse().find(m=>m.opportunityId.startsWith('roof-repair-')&&m.producedEventIds.length===1);
     if(memory&&!memory.producedEventIds.includes(id))memory.producedEventIds.push(id);
    }
    out.visualChanges.push(change.buildingId+':'+change.tag);
   }
   for(const milestone of advanceVillageGrowthDay(s.villageGrowth,s.minutes,getCalendar(s).season,getWeather(s),s.population)){
    chronicle(s,milestone.title,milestone.text);
    s.houses+=milestone.housesDelta;s.population+=milestone.populationDelta;
    s.renown+=milestone.renownDelta;
    s.happiness=Math.min(100,s.happiness+(milestone.stage==='landmark'||milestone.stage==='thriving'?2:0));
    out.visualChanges.push('valley:'+milestone.stage+':'+(s.villageGrowth.choice||'none'));
   }
   addOpportunitiesForDay(s);
  }
  if(nextSeason===next){
   const c=getCalendar(s);out.crossedSeasons++;
   const note:Record<string,string>={
    spring:'草木返青，山民开始整理农圃和屋檐。',
    summer:'竹林渐浓，酒肆前多了乘凉的脚步。',
    autumn:'野径染黄，乡邻晒起茶叶与谷物。',
    winter:'寒意入谷，晚归的人靠近酒肆的炉火。'};
   chronicle(s,'第 '+c.year+' 年 · '+SEASON_NAMES[c.season]+'至',note[c.season]);
   s.lastSeasonLogged=Math.floor(s.minutes/SEASON_MINUTES);
  }
  if(next===target)break;
 }
 s.lastDayLogged=getDay(s);out.newDay=s.lastDayLogged>startDay;
 out.crossedYears=Math.max(0,getCalendar(s).year-startYear);
 out.pendingChoices=pendingOpportunities(s).map(o=>o.id);
 return out;
}
export function advanceToNextSeason(s:WorldState):AdvanceResult{
 // Keep the local time of day so the player can actually see a seasonal vista.
 const target=nextSeasonBoundary(s.minutes)+(s.minutes%DAY_MINUTES);
 return advanceWorld(s,(target-s.minutes)/MINUTES_PER_REAL_SECOND);
}
export function chapterProgress(s:WorldState):number{
 if(s.storyStage==='legacy')return 1;
 if(s.storyStarted===null)return 0;
 const i=STAGE_SCHEDULE.findIndex(([stage])=>stageIndex[s.storyStage]<stageIndex[stage]);
 if(i<0)return 1;
 const prev=i===0?0:STAGE_SCHEDULE[i-1][1],next=STAGE_SCHEDULE[i][1];
 return Math.max(0,Math.min(1,(s.minutes-s.storyStarted-prev)/(next-prev)));
}
function valid(v:unknown):v is WorldState{
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<WorldState>;
 return s.version===3&&Number.isFinite(s.minutes)&&s.minutes!>=0&&Number.isFinite(s.lastSavedAt)
  &&Number.isFinite(s.seed)&&Number.isFinite(s.population)&&Array.isArray(s.journal)
  &&s.journal.length<=100&&s.journal.every(e=>e&&Number.isFinite(e.id)&&typeof e.title==='string'&&typeof e.text==='string')
  &&!!s.storyStage&&s.storyStage in stageIndex&&[null,'host','observe'].includes(s.choice??null)
  &&(s.choice===null||Number.isFinite(s.storyStarted))&&Number.isFinite(s.lastSeasonLogged);
}
/** Older v3 Sprint 1 JSON has no buildings; hydrate it without erasing the story. */
function hydrateWorld(s:WorldState):WorldState{
 const baseline=createBuildings();
 const incoming=Array.isArray(s.buildings)?s.buildings:[];
 const buildings=baseline.map(def=>{
  const old=incoming.find(x=>x&&x.id===def.id);
  if(!old||!Number.isFinite(old.conditionScore)||!Number.isFinite(old.workProgress)||!Array.isArray(old.props)||!Array.isArray(old.causeEventIds))return def;
  if(!['planned','foundation','construction','occupied','repairing'].includes(old.phase))return def;
  return {...def,...old,conditionScore:Math.max(0,Math.min(100,old.conditionScore)),
   workProgress:Math.max(0,Math.min(1,old.workProgress)),props:old.props.filter((p:unknown)=>typeof p==='string').slice(-30),
   causeEventIds:old.causeEventIds.filter((p:unknown)=>typeof p==='string').slice(-80)};
 });
 const opportunities=Array.isArray(s.opportunities)?s.opportunities.filter(o=>
  o&&typeof o.id==='string'&&Array.isArray(o.options)&&
  ['rain-guest','roof-repair'].includes(o.kind)&&
  ['available','resolved'].includes(o.state)&&Number.isFinite(o.deadlineMinutes)).slice(-48):[];
 const guardianMemories=Array.isArray(s.guardianMemories)?s.guardianMemories.filter(m=>
  m&&typeof m.opportunityId==='string'&&Array.isArray(m.producedEventIds)).slice(-120):[];
 return {...s,buildings,opportunities,guardianMemories,villageGrowth:hydrateVillageGrowth(s.villageGrowth,s.minutes,s.lastSavedAt)};
}
export function importWorld(raw:string):WorldState|null{
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!valid(parsed)||!validatePlots())return null;
  return hydrateWorld(parsed);
 }catch{return null;}
}
/** Migration copies the old world and preserves its branch/chronicle; never touches the v0.2 key. */
function migrateV2(raw:string,now:number):WorldState|null{
 try{
  const old=JSON.parse(raw) as Omit<Partial<WorldState>,'version'>&{version:number};
  if(old.version!==2||!Number.isFinite(old.minutes)||!Array.isArray(old.journal)
   ||!old.storyStage||!(old.storyStage in stageIndex)||![null,'host','observe'].includes(old.choice??null))return null;
  const fresh=createWorld(now);
  return {...fresh,...old,version:3,seed:fresh.seed,buildings:createBuildings(),opportunities:[],guardianMemories:[],villageGrowth:createVillageGrowth(old.minutes||0,now),
   lastSeasonLogged:Math.floor((old.minutes||0)/SEASON_MINUTES),lastSavedAt:now};
 }catch{return null;}
}
/** At most 4 game days per restore. Slots are isolated; only slot 1 reads v0.2. */
export function loadWorld(storage:Pick<Storage,'getItem'>,now=Date.now(),slot=1):WorldState{
 try{
  const key=SLOT_KEYS[slot-1];if(!key)return createWorld(now);
  const raw=storage.getItem(key);
  let s:WorldState|null=raw?importWorld(raw):null;
  if(raw&&!s)return createWorld(now);
  if(!s&&slot===1){
   const previous=storage.getItem(PREVIOUS_STORAGE_KEY);
   if(previous)s=migrateV2(previous,now);
  }
  if(!s)return createWorld(now);
  const away=Math.min(4*DAY_MINUTES/MINUTES_PER_REAL_SECOND,Math.max(0,(now-s.lastSavedAt)/1000));
  if(away>1)advanceWorld(s,away);
  s.lastSavedAt=now;return s;
 }catch{return createWorld(now);}
}
export function saveWorld(s:WorldState,storage:Pick<Storage,'setItem'>,now=Date.now(),slot=1){
 const key=SLOT_KEYS[slot-1];if(!key)throw Error('Invalid slot');
 s.lastSavedAt=now;storage.setItem(key,JSON.stringify(s));
}
export interface ResidentMotion{
 x:number;z:number;activity:string;visible:boolean;walking:boolean;heading:number;practicing:boolean;
 activityId:ActivityId;interactionTargetId:string|null;
}
/** The two visitors have their own town-entry journeys; regular residents never queue at the tavern door. */
export function residentMotion(v:Villager,s:WorldState):ResidentMotion{
 const h=(s.minutes%DAY_MINUTES)/60;
 const hidden=(activity:string):ResidentMotion=>({
  x:v.home[0],z:v.home[1],heading:0,visible:false,walking:false,practicing:false,
  activity,activityId:'idle',interactionTargetId:null
 });
 if(v.id===8&&(s.storyStage==='departed'||s.storyStage==='rumor'))
  return hidden('正在山外闯荡江湖');
 if(v.id===9){
  const stay=s.storyStage==='stranger'||(s.choice==='host'&&s.storyStage==='training');
  const arrival=Math.min(1,Math.max(0,(s.minutes-STORY_VISITOR_AT)/170));
  const route:[[number,number],[number,number],[number,number],[number,number],[number,number]]=
   [[13.2,2.2],[8.3,2.2],[6.3,2.2],[1.5,3.15],[-2.7,3.35]];
  const walking=stay&&s.storyStage==='stranger'&&s.choice===null&&arrival<.99;
  const pos=walking?alongLane(route,arrival):{x:-2.7,z:3.65,heading:0};
  return {...pos,visible:stay,walking,practicing:false,
   activity:walking?'沿桥入谷寻找歇脚之处':s.storyStage==='training'?'正指点阿青的剑式':'在酒肆歇脚',
   activityId:walking?'walk':s.storyStage==='training'?'train':'rest',interactionTargetId:'inn-001'};
 }
 if(v.id===10){
  const visible=(Math.floor(s.minutes/DAY_MINUTES)+1)%2===0&&h>9.7&&h<18.8;
  if(!visible)return hidden('在山外行商');
  const route:[[number,number],[number,number],[number,number],[number,number],[number,number]]=
   [[13.5,2.2],[8.3,2.2],[6.0,2.2],[3,2.8],[-2.3,3.3]];
  const first=h<12.3,returning=h>16.4;
  const pos=first?alongLane(route,Math.max(0,(h-9.7)/2.6)):
   returning?alongLane([...route].reverse(),Math.max(0,(h-16.4)/2.4)):
   {x:-2.1,z:3.8,heading:0};
  return {...pos,visible:true,walking:first||returning,practicing:false,
   activity:first?'推着货担走过山桥':returning?'沿山道继续行商':'把山外新鲜事告诉陆娘',
   activityId:first||returning?'walk':'greet',interactionTargetId:'inn-001'};
 }
 if(v.id===11&&s.storyStage!=='legacy')return hidden('尚未走进山谷');
 if(v.id===11&&s.choice==='observe'){
  const shop:[number,number]=[12.3,-.9];
  const home=v.home;
  const route:[[number,number],[number,number],[number,number],[number,number],[number,number]]=
   [home,[1,-2],[6,2.2],[8.3,2.2],shop];
  const leave=7.1+(v.offset%60)/90,returnAt=17.8;
  if(h<leave||h>19.3)return {x:home[0],z:home[1],heading:0,visible:h>6.5&&h<21,
   walking:false,practicing:false,activity:'在家休息',activityId:'rest',interactionTargetId:null};
  const outbound=h<9.4,returning=h>=returnAt;
  const p=outbound?alongLane(route,(h-leave)/(9.4-leave)):returning?
   alongLane([...route].reverse(),(h-returnAt)/1.5):{x:shop[0],z:shop[1],heading:0};
  return {...p,visible:true,walking:outbound||returning,practicing:false,
   activity:outbound||returning?'往返山外茶亭':'煮茶，招待山道过客',
   activityId:outbound||returning?'walk':'serve',interactionTargetId:'tea-pavilion'};
 }
 const life=dailyResidentMotion(v,s.minutes,getWeather(s),s.villageGrowth);
 const practice=life.activityId==='train'&&!life.walking;
 return {...life,visible:h>6.4&&h<21,practicing:practice};
}
