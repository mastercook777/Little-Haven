import {getCalendarFromMinutes,SEASON_NAMES} from '../simulation/calendar.ts';
import {publicPersonHistory,publicPersonRelations} from '../simulation/livingFates/peopleState.ts';
import {pioneerBuildingLabel} from '../simulation/pioneerGrowth.ts';
import {pioneerFoodCapacity} from '../simulation/pioneerLivelihood.ts';
import {gardenSeedTrial} from '../simulation/livingFates/seedTrial.ts';
import {pioneerCommonsNames} from '../simulation/pioneerCommons.ts';
import {getPioneerFacilityPreference,isPioneerFacilityActive,isPioneerOperational} from '../simulation/pioneerFacilities.ts';
import type {PioneerWorld,PioneerBuilding,PioneerResourceSite} from '../simulation/pioneerWorld.ts';

export type PioneerSelection={kind:'building'|'intent'|'site'|'camp'|'clearing'|'person';id:string};
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
 forest:'山林木料区',forage:'野食采集地',spring:'山泉水源',field:'村民菜圃',fish:'河岸鱼群'
};
const relevant=(s:PioneerWorld,causeId:string)=>{
 const entries=s.journal.filter(x=>x.causeId===causeId);
 return entries.slice(-4).reverse().map(x=>date(x.minute)+' · '+x.title);
};
export function inspectPioneerSelection(s:PioneerWorld,
 selection:PioneerSelection):PioneerInspection|null{
 if(selection.kind==='person'){
  const f=s.founders.find(x=>String(x.id)===selection.id);
  const person=f&&s.livingFates.people[f.id];
  if(!f||!person)return null;
  const bonds=publicPersonRelations(s,f.id);
  const memories=publicPersonHistory(s,f.id);
  const notes=bonds.map(b=>{
   const peer=s.founders.find(x=>x.id===b.id);
   return (peer?.name??'乡邻')+' · 共劳 '+b.work+' 小时 / 同席 '+b.meals+' 次';
  });
  const fields=[
   {label:'眼前的营生',value:f.role},
   {label:'来谷记录',value:person.arrivalKnown?date(person.arrivalAt):'旧档已有乡邻 · 来时未详'},
   {label:'落脚住处',value:f.homeBuildingId?
    (s.buildings.find(b=>b.id===f.homeBuildingId)?.kind==='cottage'?'山居':'避雨棚'):'尚在营地'},
   {label:'此刻正在',value:f.activity==='seed-trial'?'留种照料试田':f.activity==='fish'?'河岸捕鱼':
     f.activity==='craft'?'木坊锯作':f.activity==='farm'?'实际耕作':f.activity==='collect-wood'?'入林采木':
    f.activity==='build'?'参与建屋':f.activity==='eat'?'村心用餐':f.activity==='socialize'?'邻里闲谈':'村中日常'},
   {label:'已见本领',value:person.publicFacts.knownSkills.join('、')||'仍在相处中'},
   {label:'田间实践',value:person.skills.cultivation.xp+' 小时；经验 '+person.skills.cultivation.level+' 阶'},
   {label:'山路实践',value:person.skills.wayfinding.xp+' 小时'},
   {label:'有迹可循的邻里',value:notes.join('；')||'尚无共同劳动或同席记录'}
  ];
  return {title:f.name,kicker:'谷中常住 · 人物 '+f.id,
   description:person.publicFacts.arrivalReason+' '+person.publicFacts.habit+
    ' 往事只能从共同生活与实际经历里慢慢得知。',
   facts:fields,history:memories.map(m=>date(m.minute)+' · '+m.text)};
 }
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
   const trial=gardenSeedTrial(s,b.id);
   const legacy=s.livingFates.fieldLegacies.find(x=>x.gardenId===b.id);
   if(trial){
    const pair=trial.actorIds.map(id=>s.founders.find(f=>f.id===id)?.name??'乡邻');
    facts.push({label:'留种来历',value:pair.join('与')});
    facts.push({label:'留种工时',value:trial.workBy.join(' / ')+' 小时（每人至少 5 小时）'});
    facts.push({label:'种粮成本',value:fixed(trial.seedsSpent)+' 份 · 已实际扣库'});
    facts.push({label:'试种结局',value:trial.phase==='working'?'照料中 · 待下一季':
     trial.phase==='resolved'?'成功 · 此田真实采收增益 6%':'中止 · 收成无加成'});
   }
   if(legacy)facts.push({label:'田间传承',value:'实际收获 +'+Math.round(legacy.harvestBonus*100)+'% · 长期保留'});
  }
  if(b.kind==='wood-yard'){
   facts.push({label:'当前功能',value:'木材整理与工具保养'});
   facts.push({label:'锯木台进展',value:s.livelihood.craft.phase==='idle'?'尚未投资':
    s.livelihood.craft.phase==='building'?'已耗 4 份木料，已作 '+s.livelihood.craft.workHours+' / 6 小时':
    '已由乡邻做完 6 小时 · 此后采木再多整理 16%'});
  }
  if(b.kind==='fish-hut'){
   const fish=s.sites.find(x=>x.id==='fish-'+b.id);
   facts.push({label:'渔点存量',value:fixed(fish?.stock??0)+' / '+fixed(fish?.capacity??0)});
   facts.push({label:'真实总渔获',value:fixed(fish?.totalGathered??0)+' 份入村粮'});
   facts.push({label:'这次有谁捕鱼',value:s.founders.filter(f=>f.activity==='fish')
    .map(f=>f.name).join('、')||'此时无人下竿'});
   facts.push({label:'渔业始于',value:s.livelihood.firstFishAt===null?'尚未有第一篓':
    date(s.livelihood.firstFishAt)});
  }
  if(b.kind==='cottage'){
   facts.push({label:'现有安居容量',value:(b.loftAddedAt!==undefined?'3':'2')+' 人'});
   if(b.loftAddedAt!==undefined)facts.push({label:'木阁改造',value:
    date(b.loftAddedAt)+' · 4 份木料 / 8 工时 · 屋界未扩张'});
  }
  if(b.kind==='tea-stop'){
   const c=s.commerce,v=c.activeVisitor;
   facts.push({label:'路上来往',value:c.totalArrivals+' 人实际经过；未计入常住人口'});
   facts.push({label:'真实交换',value:c.totalExchanges+' 次；交换的净木料 '+
    fixed(c.netWood)+' / 口粮 '+fixed(c.netFood)});
   facts.push({label:'热茶招待',value:c.totalHosted+' 次；水耗 '+fixed(-c.netWater)});
   facts.push({label:'此刻旅人',value:v?v.name+' · '+v.origin+' · '+v.occupation:'此时无客'});
   facts.push({label:'下一次来往',value:c.nextVisitorAt===null?'尚未安排':date(c.nextVisitorAt)});
  }
  if(b.kind==='granary'){
   facts.push({label:'全村储粮容量',value:fixed(pioneerFoodCapacity(s))+' 份'});
   facts.push({label:'眼下实有粮食',value:fixed(s.resources.food)+' 份 · 非免费填仓'});
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
   b.kind==='fish-hut'?'河岸先要合法落地、村民出工，冬季鱼群恢复慢。每一篓才会变成村中的粮食。':
   b.kind==='granary'?'架高的储粮阁扩大储量但不生产粮食，所有仓中口粮仍来自真实劳动。':
   b.kind==='tea-stop'?'客人需要沿真实道路抵达；能换粮木、付粮水招待，也可选择安静不交易。访客不会冒充常住人口。':
   '木匠在这里晾晒材料、维护工具和准备建筑木料。';
  return {title:pioneerBuildingLabel(b.kind),kicker:'已建成 · '+b.id,
   description,facts,history:[
     ...s.livingFates.seedTrials.filter(t=>t.gardenId===b.id).slice(-3).reverse().map(t=>
      date(t.completedAt??t.startedAt)+' · 留种试田'+
      (t.phase==='working'?'开始':t.phase==='resolved'?'有成':'中止')+
      '（'+t.actorIds.map(id=>s.founders.find(f=>f.id===id)?.name??'乡邻').join('、')+'）'),
     ...s.commerce.visits.slice(-3).reverse().map(v=>
      date(v.arrivedAt)+' · '+v.name+'自'+v.origin+'来访'+
       (v.outcome==='exchange'?'，真实交换了货物':v.outcome==='hosted'?'，村民为他付出粮水':'，未作交换')),
     ...relevant(s,b.causeId)
    ],operation};
 }
 if(selection.kind==='intent'){
  const intent=s.intent;if(!intent||intent.id!==selection.id)return null;
  const title=intent.kind==='repair'?'修缮中的旧屋':intent.kind==='loft'?'山居木阁改造':pioneerBuildingLabel(intent.kind??'shelter')+'工地';
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
   description:site.kind==='forest'?
    '林木不是一次性装饰：村民确实伐木时库存减少，可见林木稀疏、倒落并留下树桩；其后自然恢复。':
    '库存由居民劳动采集和季节回补，画面不会生成免费的资源。',
   facts:[
    {label:'现场余量',value:fixed(site.stock)+' / '+fixed(site.capacity)},
    {label:'每日自然回补',value:fixed(site.renewPerDay)+'（天气/季节影响）'},
    {label:'历史采集',value:fixed(site.totalGathered)},
    ...(site.kind==='forest'?[
     {label:'全谷真实伐倒事件',value:s.frontier.totalFelled+' 次'},
     {label:'最近一次落木',value:s.frontier.lastFelling?.siteId===site.id?
      date(s.frontier.lastFelling.minute):'暂无记录'}
    ]:[]),
    {label:'正在工作',value:s.founders.filter(f=>
      Math.hypot(f.target[0]-site.x,f.target[1]-site.z)<2.1&&
      ['collect-wood','forage','fetch-water','farm','fish'].includes(f.activity))
      .map(f=>f.name).join('、')||'暂无'}
   ],history:[]};
 }
 if(selection.kind==='clearing'){
  const p=s.frontier.clearings.find(c=>c.id===selection.id);
  if(!p)return null;
  const buildings=s.buildings.filter(b=>
   Math.hypot(b.parcel.x-p.x,b.parcel.z-p.z)<p.radius+2.7);
  return {title:p.phase==='cleared'?'已开出的林间空地':'林缘开垦现场',
   kicker:'逐次清障 · '+p.id,
   description:p.phase==='cleared'?
    '村民清去真实灌木和碎石，这块缓冲区现在进入了可调查、可选址的土地储备。':
    '这里仍有未清的灌丛；需要居民真实抵达并花费劳动工时，不能直接在树丛中盖房。',
   facts:[
    {label:'建设阶段',value:p.phase==='cleared'?'已清理完成':'正在逐次开垦'},
    {label:'实际开垦工时',value:fixed(p.workDone)+' / '+fixed(p.workRequired)},
    {label:'开始日期',value:date(p.startedAt)},
    {label:'清障完成',value:p.clearedAt===null?'仍需劳动':date(p.clearedAt)},
    {label:'邻近永久设施',value:buildings.length+' 处'}
   ],
   history:relevant(s,p.id)};
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
