import {getCalendarFromMinutes,SEASON_NAMES} from '../simulation/calendar.ts';
import {pioneerBuildingLabel} from '../simulation/pioneerGrowth.ts';
import {pioneerCommonsNames} from '../simulation/pioneerCommons.ts';
import {getPioneerFacilityPreference,isPioneerFacilityActive,isPioneerOperational} from '../simulation/pioneerFacilities.ts';
import type {PioneerWorld,PioneerBuilding,PioneerResourceSite} from '../simulation/pioneerWorld.ts';

export type PioneerSelection={kind:'building'|'intent'|'site'|'camp';id:string};
export interface PioneerInspection{
 title:string;kicker:string;description:string;
 facts:{label:string;value:string}[];
 history:string[];operation?:{id:string;active:boolean;preference:string;
  variants:{value:string;label:string}[]};
}
const fixed=(n:number)=>n.toFixed(1).replace(/\.0$/,'');
const date=(minutes:number)=>{
 const c=getCalendarFromMinutes(minutes);
 return '第 '+c.year+' 年 · '+SEASON_NAMES[c.season]+c.dayOfSeason+' 日';
};
const siteLabels:Record<PioneerResourceSite['kind'],string>={
 forest:'山林木料区',forage:'野食采集地',spring:'山泉水源',field:'村民菜圃'
};
const relevant=(s:PioneerWorld,causeId:string)=>{
 const entries=s.journal.filter(x=>x.causeId===causeId);
 return entries.slice(-4).reverse().map(x=>date(x.minute)+' · '+x.title);
};
export function inspectPioneerSelection(s:PioneerWorld,
 selection:PioneerSelection):PioneerInspection|null{
 if(selection.kind==='building'){
  const b=s.buildings.find(x=>x.id===selection.id);
  if(!b)return null;
  const residents=b.occupants.map(id=>s.founders.find(f=>f.id===id)?.name??'旧住户');
  const condition=Math.max(0,Math.min(100,b.condition??100));
  const site=s.sites.find(x=>x.id==='field-'+b.id);
  const status=condition<68?'需要修缮':condition<83?'经历风雨':'维护良好';
  const facts=[
   {label:'落成时间',value:date(b.completedAt)},
   {label:'建筑情况',value:fixed(condition)+'% · '+status},
   {label:'村民使用',value:residents.length?residents.join('、'):'暂无常住住户'},
   {label:'实际木料',value:fixed(b.materialsSpent.wood)+' 份'},
   {label:'实际工时',value:fixed(b.workHours)+' 小时'},
   {label:'最近修缮',value:date(b.lastRepairAt??b.completedAt)}
  ];
  if(b.kind==='garden'&&site){
   facts.push({label:'田间余量',value:fixed(site.stock)+' / '+fixed(site.capacity)});
   facts.push({label:'累计收获',value:fixed(site.totalGathered)});
  }
  if(b.kind==='wood-yard'){
   facts.push({label:'当前功能',value:'木材整理与工具保养'});
  }
  const operation=isPioneerOperational(b)?{
   id:b.id,active:isPioneerFacilityActive(b),
   preference:getPioneerFacilityPreference(b),
   variants:b.kind==='garden'?
    [{value:'harvest',label:'及时收菜'},{value:'seed',label:'留种养地'}]:
    [{value:'timber',label:'备建筑木材'},{value:'repair',label:'优先修缮'}]
  }:undefined;
  const description=b.kind==='shelter'?'开荒三人亲手建成的避雨之处。':
   b.kind==='cottage'?'乡邻拥有真实住户与出入路径的山居。':
   b.kind==='garden'?'季节和生产安排决定收成，不能凭空供粮。':
   '木匠在这里晾晒材料、维护工具和准备建筑木料。';
  return {title:pioneerBuildingLabel(b.kind),kicker:'已建成 · '+b.id,
   description,facts,history:relevant(s,b.causeId),operation};
 }
 if(selection.kind==='intent'){
  const intent=s.intent;if(!intent||intent.id!==selection.id)return null;
  const title=intent.kind==='repair'?'修缮中的旧屋':pioneerBuildingLabel(intent.kind??'shelter')+'工地';
  return {title,kicker:'真实施工 · '+intent.phase,description:intent.reason,
   facts:[
    {label:'申请时间',value:date(intent.createdAt)},
    {label:'木料备齐',value:fixed(intent.woodCommitted)+' / '+fixed(intent.woodRequired)},
    {label:'施工工时',value:fixed(intent.workDone)+' / '+fixed(intent.workRequired)},
    {label:'当前状态',value:intent.pauseReason??'乡邻正在动工'},
    {label:'发起居民',value:intent.requestedBy.map(id=>
      s.founders.find(f=>f.id===id)?.name??'村民').join('、')}
   ],history:relevant(s,intent.id)};
 }
 if(selection.kind==='site'){
  const site=s.sites.find(x=>x.id===selection.id);if(!site)return null;
  return {title:siteLabels[site.kind],kicker:'真实资源点 · '+site.id,
   description:'库存由居民劳动采集和季节回补，画面不会生成免费的资源。',
   facts:[
    {label:'现场余量',value:fixed(site.stock)+' / '+fixed(site.capacity)},
    {label:'每日自然回补',value:fixed(site.renewPerDay)+'（天气/季节影响）'},
    {label:'历史采集',value:fixed(site.totalGathered)},
    {label:'正在工作',value:s.founders.filter(f=>
      Math.hypot(f.target[0]-site.x,f.target[1]-site.z)<2.1&&
      ['collect-wood','forage','fetch-water','farm'].includes(f.activity))
      .map(f=>f.name).join('、')||'暂无'}
   ],history:[]};
 }
 if(selection.kind==='camp'){
  const commons=s.commons,project=commons.project;
  const title=pioneerCommonsNames[commons.stage];
  const description=commons.stage===0?
   '最初的三张草席和营火仍是临时营地。等第一间真正的住屋落成，村民才会备木、动工重修村心。':
   commons.stage===1?'露宿草席已搬走，居民在安家火塘边坐下歇脚。':
   commons.stage===2?'有菜田和新邻居之后，村民用木料搭起共同做饭的灶台。':
   '这是居民铺出石路、修建公告栏和集会座位的公共生活中心。';
  const facts=[
   {label:'当前阶段',value:String(commons.stage)+' / 3 · '+title},
   {label:'现今人口',value:s.founders.length+' 位常住乡邻'},
   {label:'已耗木料',value:fixed(commons.woodSpent)+' 份'},
   {label:'实际工时',value:fixed(commons.workHours)+' 小时'},
   {label:'已用口粮',value:fixed(commons.mealsServed)+' 份'},
   {label:'烹饪工时',value:fixed(commons.cookingHours)+' 小时'},
   {label:'交谈人时',value:fixed(commons.socialHours)+' 小时'}
  ];
  if(project)facts.push(
   {label:'下一阶段',value:pioneerCommonsNames[project.targetStage]},
   {label:'备料进度',value:fixed(project.woodCommitted)+' / '+fixed(project.woodRequired)},
   {label:'施工进度',value:fixed(project.workDone)+' / '+fixed(project.workRequired)}
  );
  else if(commons.stage<3)facts.push({label:'接下来',value:commons.stage===0?
   '首间避雨棚入住':'菜圃和新邻居 / 更多住户、工坊'});
  // Commons milestones must remain inspectable even after hundreds of
  // routine conversations have pushed older journal lines out of the ring.
  const completed=commons.stageCompletedAt.flatMap((minute,i)=>
   minute===null?[]:[date(minute)+' · '+pioneerCommonsNames[i+1]+'落成']).reverse();
  const recent=relevant(s,commons.id).filter(line=>!line.includes('落成')).slice(0,2);
  return {title,kicker:'原始营火所在地 · '+commons.id,description,facts,
   history:[...completed,...recent]};
 }
 return null;
}
