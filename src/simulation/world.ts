/**
 * 守望谷：江湖初现。Pure deterministic simulation — no DOM, Three.js or network.
 * A simulated day = 240 real seconds at 1×. The long-distance story is compressed.
 */
export type Decision = 'host' | 'observe';
export type StoryStage = 'peace' | 'stranger' | 'training' | 'departed' | 'rumor' | 'returned' | 'legacy';
export type Occupation = '樵夫' | '酒馆掌柜' | '茶农' | '药农' | '行脚货郎' | '织娘' | '渔夫' | '习武少年' | '江湖客' | '游商' | '剑庐学徒' | '茶亭伙计';
export interface Villager {
  id: number; name: string; occupation: Occupation; color: string; hair: string;
  personality: string; thought: string; home: [number,number]; work:[number,number]; offset:number;
}
export interface ChronicleEntry { id:number;day:number;time:number;title:string;text:string; }
export interface WorldState {
  version: 2;
  minutes:number;
  population:number;
  happiness:number;
  houses:number;
  renown:number;
  choice:Decision|null;
  storyStage:StoryStage;
  storyStarted:number|null;
  autoChosen:boolean;
  lastDayLogged:number;
  journal:ChronicleEntry[];
  lastSavedAt:number;
}
export const DAY_MINUTES=1440;
export const MINUTES_PER_REAL_SECOND=6;
/** Distinct from v0.1 to preserve a player's older valley rather than overwriting it. */
export const STORAGE_KEY='little-haven-jianghu-v02';
export const STORY_VISITOR_AT=9*60+40;
export const STORY_AUTO_CHOICE_AT=DAY_MINUTES+10*60;
export const STORY_MILESTONES={training:120,departed:1500,rumor:3000,returned:4500,legacy:5600} as const;
const stageIndex:Record<StoryStage,number>={peace:0,stranger:1,training:2,departed:3,rumor:4,returned:5,legacy:6};

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
 return {version:2,minutes:8*60+20,population:8,happiness:82,houses:6,renown:0,
   choice:null,storyStage:'peace',storyStarted:null,autoChosen:false,lastDayLogged:1,lastSavedAt:now,
   journal:[{id:1,day:1,time:500,title:'山谷无名',text:'深山中只有几户人家、一间酒肆。少年阿青每日到竹林旁练剑，还不知外面有多大的江湖。'}]};
}
export function getDay(s:WorldState){return Math.floor(s.minutes/DAY_MINUTES)+1;}
export function getClock(s:WorldState){const t=Math.floor(s.minutes%DAY_MINUTES);const hour=Math.floor(t/60),minute=t%60;return {hour,minute,text:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};}
export function getDaylight(s:WorldState){const h=(s.minutes%DAY_MINUTES)/60;return Math.max(0,Math.min(1,(h-5.4)/2,(20.3-h)/2.2));}
function chronicle(s:WorldState,title:string,text:string,at=s.minutes){
 const time=Math.floor(at%DAY_MINUTES);s.journal.push({id:(s.journal.at(-1)?.id||0)+1,day:Math.floor(at/DAY_MINUTES)+1,time,title,text});
 if(s.journal.length>100)s.journal=s.journal.slice(-100);
}
/** One gently consequential intervention. An unanswered letter resolves on its own. */
export function chooseFate(s:WorldState,choice:Decision,automatic=false):boolean{
 if(s.storyStage!=='stranger'||s.choice!==null||!['host','observe'].includes(choice))return false;
 s.choice=choice;s.storyStarted=automatic?STORY_AUTO_CHOICE_AT:s.minutes;s.autoChosen=automatic;
 chronicle(s,choice==='host'?'留客一宿':'江湖自有缘',choice==='host'
   ?'守谷人为沈问舟留下一盏灯。他在酒馆过夜时，看见了每天练木剑的少年阿青。'
   :automatic?'沈问舟天亮便启程。无人安排阿青的前路，但少年还是记住了那位过客的剑影。'
   :'守谷人没有打断旅人的行程。阿青远远望着山路上的佩剑客，心中生出更大的向往。',s.storyStarted);
 return true;
}
export interface AdvanceResult {newDay:boolean;visitor:boolean;milestones:StoryStage[];completed:boolean;}
export function advanceWorld(s:WorldState,realSeconds:number):AdvanceResult{
 const out:AdvanceResult={newDay:false,visitor:false,milestones:[],completed:false};
 if(!Number.isFinite(realSeconds)||realSeconds<=0)return out;
 s.minutes+=realSeconds*MINUTES_PER_REAL_SECOND;
 if(s.storyStage==='peace'&&s.minutes>=STORY_VISITOR_AT){
   s.storyStage='stranger';out.visitor=true;
   chronicle(s,'山道来客','佩剑的沈问舟从山外走来，在无名酒肆停步。陆娘为他温了一碗茶。',STORY_VISITOR_AT);
 }
 if(s.storyStage==='stranger'&&s.choice===null&&s.minutes>=STORY_AUTO_CHOICE_AT)chooseFate(s,'observe',true);
 if(s.choice!==null&&s.storyStarted!==null){
   const origin=s.storyStarted;
   const schedule:[StoryStage,number][]=[
     ['training',STORY_MILESTONES.training],['departed',STORY_MILESTONES.departed],['rumor',STORY_MILESTONES.rumor],
     ['returned',STORY_MILESTONES.returned],['legacy',STORY_MILESTONES.legacy]
   ];
   for(const [stage,offset] of schedule){
     if(s.minutes<origin+offset||stageIndex[s.storyStage]>=stageIndex[stage])continue;
     s.storyStage=stage;out.milestones.push(stage);
     const at=origin+offset;
     if(stage==='training')chronicle(s,s.choice==='host'?'一柄竹剑，一位师父':'一柄竹剑，一条山路',s.choice==='host'
       ?'沈问舟在酒馆院中纠正了阿青的剑式。从此清晨，练武坪上多了一道静静看剑的身影。'
       :'沈问舟走后，阿青从行商手中换来一本残旧剑谱，开始照着书页独自练习。',at);
     if(stage==='departed')chronicle(s,'少年出山',s.choice==='host'
       ?'阿青向陆娘辞别，背上行囊，循着师父指的山道去见识江湖。'
       :'阿青跟着路过的商队踏出山谷。书上的剑法还生疏，远方的路却很长。',at);
     if(stage==='rumor'){
       s.renown+=s.choice==='host'?12:7;
       chronicle(s,'山外风闻',s.choice==='host'
         ?'游商说，在南边渡口见过一位名叫阿青的年轻剑客，替人挡下了欺客的恶徒。'
         :'行脚人捎来消息：阿青一路护送商旅，学会了看路、辨人，也摸索出自己的剑法。',at);
     }
     if(stage==='returned')chronicle(s,'故人归来',s.choice==='host'
       ?'多年江湖路后，阿青佩剑归乡，站在旧日练武坪前，半晌没有说话。'
       :'阿青带着满身风尘回到酒肆。他不急着远行了，先为过路人煮了一壶茶。',at);
     if(stage==='legacy'){
       s.houses+=1;s.population+=1;s.happiness=Math.min(100,s.happiness+7);s.renown+=8;out.completed=true;
       chronicle(s,s.choice==='host'?'竹隐剑庐落成':'行脚茶亭开张',s.choice==='host'
         ?'阿青在练武坪边搭起剑庐，收下第一位山中学徒。小小山谷终于有了一门自己的剑法。'
         :'阿青在通往山外的路边修起茶亭，让风尘仆仆的人都有一处歇脚之地。',at);
     }
   }
 }
 const day=getDay(s);
 if(day>s.lastDayLogged){s.lastDayLogged=day;out.newDay=true;
   chronicle(s,`山谷的第 ${day} 日`,s.storyStage==='departed'||s.storyStage==='rumor'
      ?'酒肆依旧开门，阿青不在的日子，山里仍有柴米茶香。':'晨雾沿竹林散开，酒肆的炉火照常亮起。');
 }
 return out;
}
/** Progress through the next chapter of the one-shot v0.2 tale. */
export function chapterProgress(s:WorldState):number{
 if(s.storyStage==='legacy')return 1;
 if(s.storyStarted===null)return 0;
 const phase=s.storyStage as keyof typeof STORY_MILESTONES;
 const thresholds=Object.values(STORY_MILESTONES);
 const index=Object.keys(STORY_MILESTONES).indexOf(phase);
 const prev=index<0?0:thresholds[index];const next=thresholds[index+1]??thresholds[0];
 return Math.max(0,Math.min(1,(s.minutes-s.storyStarted-prev)/(next-prev||1)));
}
export function loadWorld(storage:Pick<Storage,'getItem'>,now=Date.now()):WorldState{
 try{
  const raw=storage.getItem(STORAGE_KEY);if(!raw)return createWorld(now);
  const s=JSON.parse(raw) as WorldState;
  if(s.version!==2||!Number.isFinite(s.minutes)||!Number.isFinite(s.lastSavedAt)||!Array.isArray(s.journal)
   ||!(s.storyStage in stageIndex)||!Number.isFinite(s.population)||!['host','observe',null].includes(s.choice)
   ||(s.choice!==null&&!Number.isFinite(s.storyStarted)))throw Error('Invalid world');
  const away=Math.min(120,Math.max(0,(now-s.lastSavedAt)/1000));if(away>1)advanceWorld(s,away);
  s.lastSavedAt=now;return s;
 }catch{return createWorld(now);}
}
export function saveWorld(s:WorldState,storage:Pick<Storage,'setItem'>,now=Date.now()){
 s.lastSavedAt=now;storage.setItem(STORAGE_KEY,JSON.stringify(s));
}
export interface ResidentMotion {x:number;z:number;activity:string;visible:boolean;walking:boolean;heading:number;practicing:boolean;}
type Waypoint={h:number;p:[number,number];what:string};
function alongRoute(points:[number,number][],t:number){
 let total=0;const lengths:number[]=[];for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(d);total+=d;}
 let distance=t*total;
 for(let i=1;i<points.length;i++){
  const d=lengths[i-1];const dx=points[i][0]-points[i-1][0],dz=points[i][1]-points[i-1][1];
  if(distance<=d||i===points.length-1){const u=d?Math.min(1,distance/d):0;return {x:points[i-1][0]+u*dx,z:points[i-1][1]+u*dz,heading:Math.atan2(dx,dz)};}
  distance-=d;
 }
 return {x:points[0][0],z:points[0][1],heading:0};
}
function routine(steps:Waypoint[],h:number){
 let a=steps[0],b=steps[1];for(let i=1;i<steps.length;i++)if(h<=steps[i].h){a=steps[i-1];b=steps[i];break;}
 const t=Math.max(0,Math.min(1,(h-a.h)/(b.h-a.h||1)));
 const route=alongRoute([a.p,b.p],t);
 return {...route,walking:Math.hypot(b.p[0]-a.p[0],b.p[1]-a.p[1])>.1&&t>.03&&t<.97,activity:t>.98?b.what:a.what};
}
const BRIDGE:[number,number]=[8.3,2.2];
const INN:[number,number]=[-3,3.2];
const PRACTICE:[number,number]=[1.3,5.8];
export function residentMotion(v:Villager,s:WorldState):ResidentMotion{
 const h=(s.minutes/60+v.offset/60)%24;
 if(v.id===8&&(s.storyStage==='departed'||s.storyStage==='rumor'))return {x:13.6,z:2.2,heading:0,visible:false,walking:false,practicing:false,activity:'正在山外闯荡江湖'};
 if(v.id===9){
  const stay=s.storyStage==='stranger'||(s.choice==='host'&&s.storyStage==='training');
  const arrival=Math.max(0,Math.min(1,(s.minutes-STORY_VISITOR_AT)/180));
  const pos=s.storyStage==='stranger'&&s.choice===null?alongRoute([[13.2,2.2],BRIDGE,[5.8,2.2],INN],arrival):{x:-2.8,z:3.9,heading:0};
  return {...pos,visible:stay,walking:stay&&arrival<.98&&s.choice===null,practicing:s.storyStage==='training'&&s.choice==='host',activity:s.storyStage==='training'?'正在指点阿青练剑':'在酒肆歇脚'};
 }
 if(v.id===11){
  const visible=s.storyStage==='legacy'&&h>6.5&&h<22;
  const work:[number,number]=s.choice==='host'?[4.2,8.8]:[12.3,-.9];
  const route=s.choice==='host'?[v.home,work]:[v.home,[6.4,2.2],BRIDGE,work] as [number,number][];
  const t=Math.max(0,Math.min(1,(h-7)/3));const pos=alongRoute(route,t);
  return {...pos,visible,walking:t>.02&&t<.98,practicing:s.choice==='host'&&t>=.98&&h<18,activity:s.choice==='host'?'在剑庐里练习基本功':'在行脚茶亭忙着招待过客'};
 }
 if(v.id===10){
  const visible=getDay(s)%2===0&&h>10&&h<19;
  const t=Math.max(0,Math.min(1,(h-10)/3));const pos=alongRoute([[13.5,2.2],BRIDGE,[6,2.2],INN],t);
  return {...pos,visible,walking:t>.02&&t<.98,practicing:false,activity:'带来一些山外的新消息'};
 }
 const work=v.id===8?PRACTICE:v.work;
 const plaza:[number,number]=[-1.6,3.2];
 const steps:Waypoint[]=[
  {h:0,p:v.home,what:'在家休息'},{h:6.4,p:v.home,what:'准备出门'},
  {h:8.7,p:work,what:v.id===8?'去练武坪练剑':'走向工作地点'},
  {h:11.5,p:work,what:v.id===8?'正在练剑':`正在忙着${v.occupation==='酒馆掌柜'?'招呼客人':'手头的活计'}`},
  {h:12.5,p:plaza,what:'前往酒肆'},{h:14,p:plaza,what:'在酒肆门前歇脚'},
  {h:15.1,p:work,what:'回去做事'},{h:18.3,p:work,what:v.id===8?'日暮时再练一套剑式':'收拾一天的活计'},
  {h:19.4,p:INN,what:'去酒肆听听故事'},{h:20.5,p:INN,what:'听说书和山外传闻'},
  {h:22,p:v.home,what:'沿着小路回家'},{h:24,p:v.home,what:'在家休息'}
 ];
 const motion=routine(steps,h);
 const training=v.id===8 && (h>8.7&&h<11.5||h>15.1&&h<18.3);
 return {...motion,visible:h>6.6&&h<22,practicing:training&&!motion.walking};
}
