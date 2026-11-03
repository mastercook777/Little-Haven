import type {Weather} from './weather.ts';
import type {CalendarView} from './calendar.ts';
import {plotFor} from './plots.ts';

export type BuildingType='tavern'|'home'|'trainingYard'|'amenity';
export type BuildingPhase='planned'|'foundation'|'construction'|'occupied'|'repairing';
export type BuildingCondition='new'|'livedIn'|'worn'|'dilapidated';
export type RepairMode='roof'|'drainage'|'autonomy';
export interface BuildingState {
 id:string;plotId:string;type:BuildingType;name:string;ownerId:number|null;occupantIds:number[];
 foundedYear:number;yearsOld:number;conditionScore:number;useScore:number;
 phase:BuildingPhase;workProgress:number;upgradeLevel:0|1|2;
 props:string[];causeEventIds:string[];lastRepairYear:number|null;repairMode:RepairMode|null;
}
export interface BuildingChange {buildingId:string;title:string;text:string;tag:string;}
const clamp=(v:number)=>Math.min(100,Math.max(0,Math.round(v*100)/100));
function building(id:string,type:BuildingType,name:string,ownerId:number|null,occupantIds:number[],
 score:number,useScore:number,phase:BuildingPhase='occupied'):BuildingState{
 const plot=plotFor(id);if(!plot)throw Error('Missing village plot for '+id);
 return {id,type,name,plotId:plot.id,ownerId,occupantIds,
  foundedYear:1,yearsOld:0,conditionScore:score,useScore,phase,workProgress:0,
  upgradeLevel:0,props:[],causeEventIds:[],lastRepairYear:null,repairMode:null};
}
export function createBuildings():BuildingState[]{
 return [
  building('inn-001','tavern','无名酒肆',2,[2],70,54),
  building('home-001','home','柳下小屋',1,[1,8],74,42),
  building('yard-001','trainingYard','竹林练武坪',8,[8],92,38),
  building('bench-001','amenity','酒肆侧廊长凳',2,[],100,0,'planned')
 ];
}
export function conditionOf(b:BuildingState):BuildingCondition{
 if(b.conditionScore>=80)return 'new';
 if(b.conditionScore>=55)return 'livedIn';
 if(b.conditionScore>=30)return 'worn';
 return 'dilapidated';
}
export function startRepair(b:BuildingState,mode:RepairMode):boolean{
 if(b.phase!=='occupied'||b.type==='amenity')return false;
 b.phase='repairing';b.workProgress=0;b.repairMode=mode;
 return true;
}
function addProp(b:BuildingState,prop:string){
 if(!b.props.includes(prop))b.props.push(prop);
}
/** Mutate only on each *crossed game-day boundary*, never once per render frame. */
export function advanceBuildingsDay(buildings:BuildingState[],calendar:CalendarView,weather:Weather):BuildingChange[]{
 const changes:BuildingChange[]=[];
 const inn=buildings.find(b=>b.id==='inn-001');
 for(const b of buildings){
  b.yearsOld=Math.max(0,calendar.year-b.foundedYear);
  if(b.phase==='planned'&&b.id==='bench-001'&&inn&&inn.useScore>=58){
   b.phase='foundation';b.workProgress=0;
   changes.push({buildingId:b.id,title:'酒肆添置长凳',text:'陆娘客多，托梁伯在侧廊预备木料，留出一张歇脚长凳的位置。',tag:'plan'});
   continue;
  }
  if(b.phase==='foundation'){
   b.phase='construction';b.workProgress=.15;
   changes.push({buildingId:b.id,title:'木工开工',text:'梁伯支起木架，小七送来木料。长凳还要慢慢打磨。',tag:'construction'});
   continue;
  }
  if(b.phase==='construction'){
   b.workProgress=Math.min(1,b.workProgress+.22);
   if(b.workProgress>=1){
    b.phase='occupied';b.workProgress=1;b.upgradeLevel=1;addProp(b,'rest-bench');
    changes.push({buildingId:b.id,title:'歇脚长凳落成',text:'侧廊多出一张结实长凳，过客可以在酒旗下歇脚。',tag:'completed'});
   }
   continue;
  }
  if(b.phase==='repairing'){
   b.workProgress=Math.min(1,b.workProgress+(b.repairMode==='roof'?.18:b.repairMode==='drainage'?.14:.09));
   if(b.workProgress>=1){
    b.phase='occupied';b.conditionScore=clamp(b.conditionScore+(b.repairMode==='roof'?42:b.repairMode==='drainage'?38:32));
    b.lastRepairYear=calendar.year;b.upgradeLevel=Math.max(b.upgradeLevel,1) as 0|1|2;
    addProp(b,'repaired-tiles');
    if(b.repairMode==='drainage')addProp(b,'drainage');
    changes.push({buildingId:b.id,title:b.name+'修缮完成',text:'乡邻合力将屋檐修好。旧年岁仍在，新瓦却能遮风避雨。',tag:'repair-completed'});
    b.repairMode=null;
   }
   continue;
  }
  if(b.phase!=='occupied')continue;
  const rain=weather==='rain';
  const weatherWear=rain?.12:0;
  const protectedRoof=b.props.includes('drainage')?.45:1;
  const baseline=b.type==='tavern'?.35:b.type==='home'?.34:b.type==='trainingYard'?.14:0;
  b.conditionScore=clamp(b.conditionScore-(baseline+weatherWear)*protectedRoof);
  if(b.type==='tavern')b.useScore=clamp(b.useScore+.72);
  if(b.type==='home')b.useScore=clamp(b.useScore+.17);
  if(b.type==='trainingYard')b.useScore=clamp(b.useScore+.13);
  if(b.type==='home'&&calendar.absoluteDay>=4&&!b.props.includes('firewood')){
   addProp(b,'firewood');
   changes.push({buildingId:b.id,title:'门前添了柴堆',text:'梁伯每日劈柴，柳下小屋门前渐渐有了过冬的柴薪。',tag:'life'});
  }
  if(b.type==='home'&&calendar.absoluteDay>=9&&!b.props.includes('laundry')){
   addProp(b,'laundry');
   changes.push({buildingId:b.id,title:'院里晾起衣裳',text:'秦婶将洗净的衣裳挂在竹竿上，院落终于有了人住的模样。',tag:'life'});
  }
  // The one unprompted home repair ensures non-intervention still preserves village life.
  if(b.type==='home'&&b.conditionScore<43&&!b.props.includes('autonomous-repair-started')){
   if(startRepair(b,'autonomy')){
    addProp(b,'autonomous-repair-started');
    changes.push({buildingId:b.id,title:'乡邻合力修屋',text:'柳下小屋屋檐旧了，梁伯和秦婶商量后自发开始修补。',tag:'repair'});
   }
  }
 }
 return changes;
}
