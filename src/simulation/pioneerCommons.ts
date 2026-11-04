import type {PioneerWorld} from './pioneerWorld.ts';

export type PioneerCommonsStage=0|1|2|3;
export interface PioneerCommonsProject{
 targetStage:1|2|3;
 phase:'materials'|'building';
 woodRequired:number;
 woodCommitted:number;
 workDone:number;
 workRequired:number;
 startedAt:number;
}
export interface PioneerCommons{
 id:'pioneer-commons';
 stage:PioneerCommonsStage;
 project:PioneerCommonsProject|null;
 woodSpent:number;workHours:number;
 stageCompletedAt:[number|null,number|null,number|null];
 mealsServed:number;cookingHours:number;socialHours:number;
}
const spec={
 1:{wood:1.5,hours:4,title:'安家火塘',why:'三人不再露宿，旧草席搬进了屋，乡邻决定筑一圈能坐下来歇脚的火塘。'},
 2:{wood:3,hours:6,title:'公共灶台',why:'菜田和新邻居让一户户分灶费力，乡邻共同修起避雨的灶台。'},
 3:{wood:4,hours:9,title:'村心空地',why:'乡路连着工坊与多户人家，乡邻想有个能聚会、议事和交换故事的地方。'}
} as const;
const round=(n:number)=>Math.round(n*1000)/1000;
const record=(s:PioneerWorld,title:string,text:string)=>{
 if(s.journal.length>=160)s.journal.shift();
 s.journal.push({id:s.nextEventId++,minute:s.minutes,title,text,causeId:'pioneer-commons'});
};
export const pioneerCommonsNames=['临时营火','安家火塘','公共灶台','村心空地'] as const;
export function createPioneerCommons():PioneerCommons{
 return {id:'pioneer-commons',stage:0,project:null,woodSpent:0,workHours:0,
  stageCompletedAt:[null,null,null],mealsServed:0,cookingHours:0,socialHours:0};
}
export function eligiblePioneerCommonsUpgrade(s:PioneerWorld):PioneerCommonsStage|null{
 const stage=s.commons.stage;
 if(stage===0){
  const shelter=s.buildings.find(b=>b.kind==='shelter');
  if(shelter&&s.founders.slice(0,3).every(f=>f.homeBuildingId===shelter.id))
   return 1;
 }else if(stage===1){
  if(s.buildings.some(b=>b.kind==='garden')&&s.founders.length>=4)return 2;
 }else if(stage===2){
  if(s.buildings.filter(b=>b.kind==='cottage').length>=2&&
   s.buildings.some(b=>b.kind==='wood-yard')&&s.founders.length>=6)return 3;
 }
 return null;
}
export function schedulePioneerCommons(s:PioneerWorld){
 if(s.commons.project)return;
 const target=eligiblePioneerCommonsUpgrade(s);
 if(target===null)return;
 const data=spec[target as 1|2|3];
 s.commons.project={targetStage:target as 1|2|3,phase:'materials',
  woodRequired:data.wood,woodCommitted:0,workDone:0,workRequired:data.hours,startedAt:s.minutes};
 record(s,'商议'+data.title,data.why+' 木料和工时要从村庄的真实储备与劳动中取得。');
}
export function reservePioneerCommonsMaterials(s:PioneerWorld){
 const p=s.commons.project;
 if(!p||p.phase!=='materials')return false;
 // Preserve material headroom for active new houses. The village commons
 // never consumes timber that a previously committed shelter still needs.
 const priority=s.intent?.phase==='materials'?s.intent.woodRequired:0;
 if(s.resources.wood+1e-7<p.woodRequired+priority+1.0||
  s.resources.food<s.founders.length*.6||s.resources.water<1)return false;
 s.resources.wood=round(s.resources.wood-p.woodRequired);
 p.woodCommitted=p.woodRequired;p.phase='building';
 s.commons.woodSpent=round(s.commons.woodSpent+p.woodRequired);
 record(s,'村心备料',spec[p.targetStage].title+'需要的 '+p.woodRequired+' 份木料已从实际库存扣除。');
 return true;
}
/** Only called after a resident has been assigned to an accessible commons
 * worksite. No autonomous construction by a clock or a DOM button. */
export function performPioneerCommonsWork(s:PioneerWorld,effort=1){
 const p=s.commons.project;
 if(!p||p.phase!=='building'||effort<=0)return false;
 const step=Math.min(p.workRequired-p.workDone,effort);
 p.workDone=round(p.workDone+step);
 s.commons.workHours=round(s.commons.workHours+step);
 if(p.workDone+1e-7>=p.workRequired){
  const stage=p.targetStage,data=spec[stage];
  s.commons.stage=stage;s.commons.stageCompletedAt[stage-1]=s.minutes;
  s.commons.project=null;
  record(s,data.title+'落成',data.title+'由村民亲手搭建。'+
   (stage===1?'三张旧草席搬入第一间遮蔽，石火塘与围坐的木凳替换了原始营地。':
    stage===2?'架起灶棚和备菜案，乡邻轮流生火做饭。':
    '火塘退入公共生活角，路牌、铺石和议事桌接管村子中心。'));
 }
 return true;
}
/** A meal draws from real food stores. No free cooked rations. */
export function servePioneerMeal(s:PioneerWorld){
 const need=round(s.founders.length/3);
 const eaten=round(Math.min(s.resources.food,need));
 s.resources.food=round(Math.max(0,s.resources.food-eaten));
 s.foodStats?.consumed!==undefined&&(s.foodStats.consumed=round(s.foodStats.consumed+eaten));
 s.commons.mealsServed=round(s.commons.mealsServed+eaten);
 return eaten;
}
export function validatePioneerCommons(value:PioneerCommons){
 if(!value||value.id!=='pioneer-commons'||
  ![0,1,2,3].includes(value.stage)||
  ![value.woodSpent,value.workHours,value.mealsServed,value.cookingHours,value.socialHours]
   .every(x=>Number.isFinite(x)&&x>=0)||
  !Array.isArray(value.stageCompletedAt)||value.stageCompletedAt.length!==3||
  !value.stageCompletedAt.every(x=>x===null||(Number.isFinite(x)&&x>=0)))return false;
 const project=value.project;
 if(project){
  if(![1,2,3].includes(project.targetStage)||project.targetStage!==value.stage+1||
   !['materials','building'].includes(project.phase)||
   ![project.woodRequired,project.woodCommitted,project.workDone,project.workRequired,project.startedAt]
    .every(x=>Number.isFinite(x)&&x>=0)||
   project.woodCommitted>project.woodRequired||
   project.workDone>project.workRequired||project.workRequired===0||
   project.woodRequired!==spec[project.targetStage].wood||
   project.workRequired!==spec[project.targetStage].hours||
   (project.phase==='building'&&project.woodCommitted!==project.woodRequired))return false;
 }
 return true;
}
