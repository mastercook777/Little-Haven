import {DAY_MINUTES,SEASON_NAMES,getCalendarFromMinutes} from '../simulation/calendar.ts';
import {pioneerBuildingLabel} from '../simulation/pioneerGrowth.ts';
import {getPioneerCalendar,type PioneerJournal,type PioneerWorld} from '../simulation/pioneerWorld.ts';
import type {PioneerSelection} from './pioneerInspection.ts';

/** A viewpoint is a projection of the single world timeline, not a parallel
 * story scheduler. Opening it only changes the camera/inspector, never time. */
export interface PioneerSpotlight{
 key:string;chapter:string;headline:string;detail:string;
 selection:PioneerSelection;action:string;
}
const pick=(chapter:string,headline:string,detail:string,selection:PioneerSelection,
 key:string,action='看这里'):PioneerSpotlight=>
 ({chapter,headline,detail,selection,key,action});
const camp: PioneerSelection={kind:'camp',id:'camp'};
const built=(id:string):PioneerSelection=>({kind:'building',id});
const site=(id:string):PioneerSelection=>({kind:'site',id});
const material=(n:number)=>n.toFixed(1).replace(/\.0$/,'');
function fromEvent(s:PioneerWorld,e:PioneerJournal):PioneerSpotlight|null{
 const label=SEASON_NAMES[getCalendarFromMinutes(e.minute).season];
 const when='乡邻见闻 · '+label+'时';
 const b=s.buildings.find(x=>x.causeId===e.causeId||x.id===e.causeId);
 if((e.title==='避雨棚落成'||e.title==='菜圃落成'||
  e.title==='山居落成'||e.title==='木作棚落成'||
  e.title==='河岸渔棚落成'||e.title==='架高粮仓落成')&&b)
  return pick(when,e.title,e.text,built(b.id),'event-'+e.id,'看新建的'+pioneerBuildingLabel(b.kind));
 if(['第一篓渔获','锯木台终于装好','木作棚试制锯台'].includes(e.title)&&b)
  return pick(when,e.title,e.text,built(b.id),'event-'+e.id,'看新的生计');
 if(e.title==='又添一位乡邻'){
  const newcomer=s.founders.find(f=>f.id>3&&e.text.includes(f.name));
  if(newcomer)return pick(when,newcomer.name+'在谷中安下家',
   e.text,{kind:'person',id:String(newcomer.id)},'event-'+e.id,'认识'+newcomer.name);
 }
 if(e.title==='留种试种有成'||e.title==='留种试种暂止'||e.title==='留下一把种子'){
  const trial=s.livingFates.seedTrials.find(t=>t.id===e.causeId);
  if(trial&&s.buildings.some(b=>b.id===trial.gardenId)){
   const title=e.title==='留种试种有成'?'这块田，留下了经验':
    e.title==='留种试种暂止'?'两人暂时放下试田':'有人决定留下一把种子';
   return pick('人物命运 · 田间',title,e.text,built(trial.gardenId),
    'event-'+e.id,'去看这块田');
  }
 }
 if(['安家火塘落成','公共灶台落成','村心空地落成'].includes(e.title)||
  e.title==='旧屋焕新'&&b)
  return pick(when,e.title,e.text,b?built(b.id):camp,'event-'+e.id);
 if(e.title.includes('清障')||e.title.includes('开垦')){
  const cleared=s.frontier.clearings.find(c=>c.id===e.causeId);
  if(cleared)return pick(when,'山道边多了一片空地',e.text,
   {kind:'clearing',id:cleared.id},'event-'+e.id,'看开出的地');
 }
 return null;
}
export function getPioneerSpotlight(s:PioneerWorld):PioneerSpotlight{
 const cal=getPioneerCalendar(s),current='第 '+cal.year+' 年 · '+SEASON_NAMES[cal.season];
 // The full journal is chronological, but not every daily line is a meaningful
 // chapter. A fresh event temporarily takes precedence over ongoing planning.
 for(let i=s.journal.length-1;i>=0;i--){
  const e=s.journal[i];
  if(e.minute>s.minutes||s.minutes-e.minute>3*DAY_MINUTES)break;
  const recent=fromEvent(s,e);
  if(recent)return recent;
 }
 const trial=s.livingFates.seedTrials.find(t=>t.phase==='working');
 if(trial&&s.buildings.some(b=>b.id===trial.gardenId)){
  const partner=trial.actorIds.map(id=>s.founders.find(f=>f.id===id)?.name??'乡邻').join('和');
  return pick(current+' · 生活在延续','一块田里，两个人的试验',
   partner+'已经留出 '+material(trial.seedsSpent)+' 份种粮。试田照料 '+
   trial.workBy.join(' / ')+' 小时，各需五小时；到下一季才知道结果。',
   built(trial.gardenId),'seed-trial-'+trial.id,'看试田');
 }
 const project=s.intent;
 if(project){
  if(project.parcel){
   const detail=project.phase==='materials'?
    '乡邻正在真实备木：目前库存 '+material(s.resources.wood)+
    ' 份，工地仍需 '+material(Math.max(0,project.woodRequired-s.resources.wood))+' 份。':
    project.phase==='survey'?'梁伯正在核对一条安全可走的山路。':
    '这处工地已投入 '+material(project.workDone)+' / '+
    material(project.workRequired)+' 小时；材料已从库存扣除。';
   return pick(current+' · 屋舍在长大',
    project.kind==='repair'?'旧屋还要有人修':'乡邻正在建'+pioneerBuildingLabel(project.kind??'shelter'),
    detail,{kind:'intent',id:project.id},
    'project-'+project.id+'-'+project.phase,'看工地');
  }
  return pick(current+' · 勘地','先找一块能安家的地方',
   '还没有可建造的安全地块，乡邻不会凭空把屋舍变出来。',
   camp,'survey-'+project.id);
 }
 if(!s.buildings.length){
  const forest=s.sites.find(x=>x.kind==='forest');
  return pick(current+' · 初来乍到','第一间屋，要从一捆柴开始',
   '梁伯、陆娘和阿禾只有营火与少量口粮。待有人真正采木、选址，才能看见第一间屋的地基。',
   forest?site(forest.id):camp,'first-night','看林地');
 }
 const fishing=s.buildings.find(b=>b.kind==='fish-hut');
 if(fishing){
  const site=s.sites.find(site=>site.id==='fish-'+fishing.id);
  return pick(current+' · 靠河吃饭',
   s.livelihood.firstFishAt===null?'一处渔棚已经搭好':'村里多了捕鱼的人',
   s.livelihood.firstFishAt===null?'渔棚已投入木材和工时，村民要在安全岸边实地捕到鱼才有口粮。':
    '真实渔获累计 '+material(site?.totalGathered??0)+
    ' 份。天气与季节决定鱼群恢复，渔夫还要占用自己的劳动时间。',
   built(fishing.id),'fish-'+fishing.id,'看河岸渔棚');
 }
 const granary=s.buildings.find(b=>b.kind==='granary');
 if(granary)return pick(current+' · 有粮好过冬','乡邻把粮存到了架高仓里',
  '投木和施工后，全谷的粮食储备容量变大，但每一份粮仍要亲手收获。',
  built(granary.id),'granary-'+granary.id,'看粮仓');
 const completed=s.livingFates.seedTrials.find(t=>t.phase==='resolved'&&
  s.livingFates.fieldLegacies.some(l=>l.sourceTrialId===t.id));
 if(completed&&s.buildings.some(b=>b.id===completed.gardenId)){
  return pick(current+' · 人与土地','两人的本事留在了田里',
   '这块真实菜圃因为两人共劳、花种粮又跨过一季，如今实际采收多得 6%。',
   built(completed.gardenId),'legacy-'+completed.id,'看留下的田');
 }
 const garden=s.buildings.find(b=>b.kind==='garden');
 const settlement=s.founders.length>3?current+' · 有了新邻居':
  s.commons.stage>=2?current+' · 炊烟渐起':current+' · 有屋可住';
 if(garden){
  const p=s.sites.find(x=>x.id==='field-'+garden.id);
  return pick(settlement,'谷里终于开出了田',
   '田里现存可收成的粮食 '+material(p?.stock??0)+
   ' 份。农人要亲手采收，田地也随着季节慢慢回补。',
   built(garden.id),'garden-'+garden.id,'看看田苗');
 }
 const first=s.buildings.find(b=>b.kind==='shelter')??s.buildings[0];
 return pick(settlement,'营火旁有了第一处屋檐',
  '第一间住屋靠乡邻采来的木料与真实工时建成；入夜后他们可以回屋休息。',
  built(first.id),'shelter-'+first.id,'看第一间屋');
}
