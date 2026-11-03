/**
 * Little Haven's deterministic simulation: no rendering and no browser APIs.
 * A day lasts 240 real seconds at speed 1. One simulated minute = 1/6 real second.
 */
export type Decision = 'bridge' | 'garden';
export type ProjectState = 'waiting' | 'building' | 'complete';
export type Occupation = '木匠' | '花匠' | '面包师' | '农夫' | '信使' | '织工' | '渔夫' | '学徒' | '旅行商人' | '牧羊人';
export interface Villager {
  id: number; name: string; occupation: Occupation; color: string; hair: string;
  personality: string; thought: string; home: [number, number]; work: [number, number]; offset: number;
}
export interface ChronicleEntry { id: number; day: number; time: number; title: string; text: string; }
export interface WorldState {
  version: 1;
  minutes: number;
  population: number;
  happiness: number;
  houses: number;
  decision: Decision | null;
  projectState: ProjectState;
  projectStarted: number | null;
  projectCompleteAt: number | null;
  lastDayLogged: number;
  journal: ChronicleEntry[];
  lastSavedAt: number;
}
export const DAY_MINUTES = 1440;
export const MINUTES_PER_REAL_SECOND = 6;
export const PROJECT_DURATION_MINUTES = 260;
export const STORAGE_KEY = 'little-haven-prototype-v01';

export const VILLAGERS: Villager[] = [
  { id: 1, name: '托马斯', occupation: '木匠', color: '#678b7d', hair:'#654936', personality:'认真 · 善良', thought:'“河对面的土地，看起来很适合建一座小桥。”', home:[-6.7,-4.5], work:[-10.3,0.5], offset:0 },
  { id: 2, name: '米娅', occupation: '花匠', color: '#d8a2aa', hair:'#a8724a', personality:'温柔 · 好奇', thought:'“如果广场能种满花，那该有多好。”', home:[-2.2,-6.7], work:[0.1,5.2], offset:22 },
  { id: 3, name: '艾莉', occupation: '面包师', color: '#e9af6e', hair:'#745139', personality:'热情 · 勤奋', thought:'“刚出炉的面包最适合与朋友分享。”', home:[4.0,-5.2], work:[3.8,1.8], offset:48 },
  { id: 4, name: '阿诺', occupation: '农夫', color: '#b5b977', hair:'#594a37', personality:'务实 · 乐观', thought:'“今年的小麦看起来会长得很好。”', home:[-7.2,-4.5], work:[-10.7,5.3], offset:75 },
  { id: 5, name: '莉莉', occupation: '信使', color: '#7eabc5', hair:'#473e35', personality:'活泼 · 爱聊天', thought:'“我认识这里的每一位邻居！”', home:[-2.3,-6.6], work:[5.8,4.6], offset:110 },
  { id: 6, name: '诺拉', occupation: '织工', color: '#b7a1d7', hair:'#a67544', personality:'安静 · 细心', thought:'“我想给大家织一条暖和的围巾。”', home:[4.0,-5.4], work:[-3.7,2.0], offset:134 },
  { id: 7, name: '芬恩', occupation: '渔夫', color: '#8db9bc', hair:'#4e433c', personality:'悠闲 · 观察者', thought:'“河边总有一些不为人知的小秘密。”', home:[5.0,5.7], work:[6.5,-2.1], offset:163 },
  { id: 8, name: '卡伊', occupation: '学徒', color: '#d4a783', hair:'#6f4b39', personality:'勇敢 · 爱探索', thought:'“总有一天我会走到山谷的另一边。”', home:[5.2,5.6], work:[-9.7,-0.4], offset:200 },
  { id: 9, name: '露西', occupation: '旅行商人', color: '#e3b57f', hair:'#654936', personality:'外向 · 有眼光', thought:'“新修的路会带来好多客人。”', home:[4.8,5.1], work:[11.6,2.1], offset:40 },
  { id: 10, name: '贝尔', occupation: '牧羊人', color: '#a5c1b8', hair:'#b39255', personality:'开朗 · 有耐心', thought:'“小羊们好像很喜欢这里。”', home:[-2.0,-6.6], work:[12.3,-4.2], offset:94 }
];

export function createWorld(now=Date.now()): WorldState {
  return {
    version:1, minutes: 8 * 60 + 20, population:8, happiness:78, houses:6,
    decision:null, projectState:'waiting', projectStarted:null, projectCompleteAt:null,
    lastDayLogged:1, lastSavedAt:now,
    journal:[{id:1,day:1,time:8*60+20,title:'山谷的第一天',text:'晨雾缓缓散开。八位居民在这里开始了新生活。'}]
  };
}
export function getDay(state:WorldState):number { return Math.floor(state.minutes / DAY_MINUTES)+1; }
export function getClock(state:WorldState) {
  const t = Math.floor(state.minutes % DAY_MINUTES);
  const hour = Math.floor(t / 60), minute = t%60;
  return {hour,minute,text:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};
}
export function getDaylight(state:WorldState):number {
  const hours = (state.minutes % DAY_MINUTES) / 60;
  // 0 = full night, 1 = midday
  return Math.max(0, Math.min(1, (hours-5.4)/2, (20.3-hours)/2.2));
}
export function projectProgress(state:WorldState):number {
  if (state.projectState === 'complete') return 1;
  if (state.projectState !== 'building' || state.projectStarted===null) return 0;
  return Math.max(0,Math.min(1,(state.minutes-state.projectStarted)/PROJECT_DURATION_MINUTES));
}
function record(state:WorldState,title:string,text:string) {
  state.journal.push({id:state.journal.length?Math.max(...state.journal.map(e=>e.id))+1:1,day:getDay(state),time:Math.floor(state.minutes%DAY_MINUTES),title,text});
  if(state.journal.length>80) state.journal=state.journal.slice(-80);
}
export function chooseProject(state:WorldState,choice:Decision):boolean {
  if (state.projectState!=='waiting' || state.decision!==null) return false;
  state.decision=choice; state.projectState='building'; state.projectStarted=state.minutes;
  if(choice==='bridge') record(state,'一座小桥的约定','托马斯和几位居民决定在河面上搭建木桥，让河对面的草地成为村庄的一部分。');
  else record(state,'让广场开满花','米娅邀请邻居们一起整理广场。大家决定为山谷种下一座公共花园。');
  return true;
}
export function advanceWorld(state:WorldState,realSeconds:number):{completed:boolean;newDay:boolean;newResidents:boolean} {
  const out={completed:false,newDay:false,newResidents:false};
  if(!Number.isFinite(realSeconds)||realSeconds<=0) return out;
  state.minutes+=realSeconds*MINUTES_PER_REAL_SECOND;
  if(state.projectState==='building' && projectProgress(state)>=1){
    state.projectState='complete'; state.projectCompleteAt=state.minutes; state.population=10;
    state.happiness=Math.min(100,state.happiness+(state.decision==='garden'?11:7));
    out.completed=true; out.newResidents=true;
    if(state.decision==='bridge') record(state,'第一座桥竣工了','木桥终于连接了两岸。来自远方的露西和贝尔决定留下来，河对面的土地从此热闹起来。');
    else record(state,'花园终于开放了','第一朵花在广场开放。村民们开始在这里聊天，露西和贝尔也被热闹的山谷吸引而来。');
  }
  const nowDay=getDay(state);
  if(nowDay>state.lastDayLogged){
    // Cap to one daily entry on large offline jumps.
    state.lastDayLogged=nowDay;
    out.newDay=true;
    record(state,`第 ${nowDay} 天的清晨`,state.decision==='bridge' && state.projectState==='complete' ? '桥上又出现了新的脚步声。每个人都在寻找属于自己的小小冒险。' : '窗户渐渐亮起来，新的一天从鸟鸣和面包的香气中开始。');
  }
  return out;
}
export function loadWorld(storage:Pick<Storage,'getItem'>, now=Date.now()):WorldState {
  try {
    const raw=storage.getItem(STORAGE_KEY);
    if(!raw) return createWorld(now);
    const state=JSON.parse(raw) as WorldState;
    if(state.version!==1 || !Number.isFinite(state.minutes)||!Array.isArray(state.journal)||!['waiting','building','complete'].includes(state.projectState)) throw Error('Corrupt save');
    // Offline growth is bounded to 12 simulated hours per revisit.
    const offlineSeconds=Math.min(120,Math.max(0,(now-state.lastSavedAt)/1000));
    if(offlineSeconds>1) advanceWorld(state,offlineSeconds);
    state.lastSavedAt=now;
    return state;
  }catch{return createWorld(now);}
}
export function saveWorld(state:WorldState,storage:Pick<Storage,'setItem'>,now=Date.now()):void {
  state.lastSavedAt=now;
  storage.setItem(STORAGE_KEY,JSON.stringify(state));
}

export interface ResidentMotion { x:number;z:number;activity:string;visible:boolean;walking:boolean;heading:number; }
/** A deterministic schedule, interpolated between locations rather than random wandering. */
export function residentMotion(v:Villager,state:WorldState):ResidentMotion {
  const hour=(state.minutes / 60 + v.offset/60) %24;
  const plaza:[number,number]=[0.2,0.9];
  const garden:[number,number]=state.decision==='garden'&&state.projectState==='complete'?[0.5,4.8]:[1.2,2.6];
  const workplace=(state.decision==='bridge'&&state.projectState==='complete'&&v.id>=9)?v.work:(v.id>=9?garden:v.work);
  const steps:{h:number;point:[number,number];what:string}[]=[
    {h:0,point:v.home,what:'在家休息'},
    {h:6.8,point:v.home,what:'准备出门'},
    {h:7.8,point:workplace,what:'走向工作地点'},
    {h:11.7,point:workplace,what:`正在${v.occupation==='面包师'?'制作面包':v.occupation==='花匠'?'照料花草':v.occupation==='农夫'?'照看田地':'工作'}`},
    {h:12.5,point:plaza,what:'前往广场'},
    {h:14.6,point:plaza,what:'与邻居聊天'},
    {h:15.3,point:workplace,what:'准备下午的工作'},
    {h:17.3,point:workplace,what:'继续工作'},
    {h:18.5,point:garden,what:'去散散步'},
    {h:20.6,point:garden,what:'享受傍晚'},
    {h:21.5,point:v.home,what:'走在回家的路上'},
    {h:24,point:v.home,what:'在家休息'}
  ];
  let a=steps[0],b=steps[1];
  for(let i=1;i<steps.length;i++){if(hour<=steps[i].h){a=steps[i-1];b=steps[i];break;}}
  const raw=(hour-a.h)/(b.h-a.h || 1);
  const t=Math.max(0,Math.min(1,raw));
  // Newcomers use the actual bridge when traveling to the far bank.
  const westToEast=a.point[0]<7&&b.point[0]>10;
  const eastToWest=a.point[0]>10&&b.point[0]<7;
  const points:[number,number][]=(v.id>=9&&state.decision==='bridge'&&state.projectState==='complete'&&(westToEast||eastToWest))
    ? westToEast?[a.point,[6.2,0],[10.0,0],b.point]:[a.point,[10.0,0],[6.2,0],b.point]
    : [a.point,b.point];
  let length=0;const lengths:number[]=[];
  for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(d);length+=d;}
  let remaining=t*length,px=points[0][0],pz=points[0][1],dx=0,dz=0;
  for(let i=1;i<points.length;i++){
    const d=lengths[i-1];dx=points[i][0]-points[i-1][0];dz=points[i][1]-points[i-1][1];
    if(remaining<=d || i===points.length-1){const u=d>0?Math.min(1,remaining/d):0;px=points[i-1][0]+dx*u;pz=points[i-1][1]+dz*u;break;}
    remaining-=d;
  }
  const walking=length>0.01 && t>0.02 && t<0.98;
  return {x:px,z:pz,visible:hour>6.9 && hour<21.5,
    walking,heading:Math.atan2(dx,dz),activity:walking?b.what:a.what};
}
