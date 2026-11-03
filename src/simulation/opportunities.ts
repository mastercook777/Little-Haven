/** A reusable invitation: a choice influences events, but villagers perform the work. */
export type OpportunityKind='rain-guest'|'roof-repair';
export type OpportunityStatus='available'|'resolved';
export interface OpportunityOption{id:string;label:string;preview:string;}
export interface Opportunity{
 id:string;kind:OpportunityKind;createdAtMinutes:number;deadlineMinutes:number;
 subjectIds:number[];buildingIds:string[];causeIds:string[];
 title:string;description:string;options:OpportunityOption[];
 defaultOutcomeId:string;state:OpportunityStatus;
}
export interface GuardianMemory{
 opportunityId:string;chosenOptionId:string;resolvedAtMinutes:number;
 automatic:boolean;producedEventIds:string[];
}
export function rainGuestOpportunity(seasonIndex:number,minutes:number):Opportunity{
 return {id:'rain-guest-'+seasonIndex,kind:'rain-guest',createdAtMinutes:minutes,
  deadlineMinutes:minutes+1440,subjectIds:[2,9],buildingIds:['inn-001'],causeIds:[],
  title:'雨夜，有客欲借宿',
  description:'山道下起了雨。陆娘看见有行脚客徘徊檐下，酒肆里还有一盏未熄的灯。',
  options:[
   {id:'stay',label:'留一盏灯',preview:'陆娘会准备热茶，门边添起伞架'},
   {id:'guide',label:'指一条路',preview:'乡民会在山道边留下路牌'},
   {id:'observe',label:'顺其自然',preview:'陆娘自己决定如何招待'}],
  defaultOutcomeId:'observe',state:'available'};
}
export function roofRepairOpportunity(index:number,minutes:number):Opportunity{
 return {id:'roof-repair-'+index,kind:'roof-repair',createdAtMinutes:minutes,
  deadlineMinutes:minutes+24*1440,subjectIds:[1,2],buildingIds:['inn-001'],causeIds:[],
  title:'无名酒肆的旧屋檐',
  description:'多季风雨后，瓦缝开始漏水。陆娘正和梁伯商量怎样一点点把屋顶修好。',
  options:[
   {id:'roof',label:'帮忙补瓦',preview:'修缮更快，旧屋换新瓦'},
   {id:'drainage',label:'先修排水',preview:'改善雨季磨损，但施工稍慢'},
   {id:'autonomy',label:'由乡邻商量',preview:'村民自己慢慢修缮'}],
  defaultOutcomeId:'autonomy',state:'available'};
}
