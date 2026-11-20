import {pioneerV6CourtyardPoint,pioneerV6HomesteadPlan} from './homesteadPlan.ts';
import type {PioneerBuilding,PioneerWorld} from './pioneerWorld.ts';
import type {VillageParcel} from './villagePlanning.ts';

export const PIONEER_HOMESTEAD_PORCH={wood:6,hours:12} as const;

export interface PioneerHomesteadImprovement{
 completedAt:number;
 woodSpent:number;
 workHours:number;
 causeId:string;
}

export function pioneerHomesteadPorchLocalX(parcel:VillageParcel):number|null{
 const plan=pioneerV6HomesteadPlan(parcel);
 return plan?.kind==='home'?-(plan.yard.width/2-.57):null;
}

export function pioneerHomesteadPorchPoint(parcel:VillageParcel):readonly [number,number]|null{
 const x=pioneerHomesteadPorchLocalX(parcel);
 return x===null?null:pioneerV6CourtyardPoint(parcel,x);
}

export function validPioneerHomesteadImprovement(building:PioneerBuilding,minute:number){
 const porch=building.homesteadImprovement;
 if(porch===undefined)return true;
 return !!porch&&building.kind==='cottage'&&
  typeof building.loftAddedAt==='number'&&pioneerHomesteadPorchPoint(building.parcel)!==null&&
  Number.isFinite(porch.completedAt)&&porch.completedAt>=building.loftAddedAt&&porch.completedAt<=minute&&
  porch.woodSpent===PIONEER_HOMESTEAD_PORCH.wood&&porch.workHours===PIONEER_HOMESTEAD_PORCH.hours&&
  typeof porch.causeId==='string'&&/^pioneer-porch-\d+$/.test(porch.causeId);
}

export function validPioneerHomesteadImprovementIntent(world:PioneerWorld){
 const intent=world.intent;
 if(intent?.kind!=='homestead-improvement')return true;
 const home=world.buildings.find(b=>b.id===intent.targetBuildingId&&b.kind==='cottage');
 return !!home&&home.loftAddedAt!==undefined&&!home.homesteadImprovement&&
  pioneerHomesteadPorchPoint(home.parcel)!==null&&home.parcel.id===intent.parcel?.id&&
  intent.woodRequired===PIONEER_HOMESTEAD_PORCH.wood&&intent.workRequired===PIONEER_HOMESTEAD_PORCH.hours&&
  ((intent.phase==='materials'&&intent.woodCommitted===0&&intent.workDone===0)||
   ((intent.phase==='foundation'||intent.phase==='frame')&&intent.woodCommitted===intent.woodRequired&&
    intent.workDone>=0&&intent.workDone<=intent.workRequired));
}
