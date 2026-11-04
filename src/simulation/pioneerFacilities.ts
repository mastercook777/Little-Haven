import type {PioneerWorld,PioneerBuilding,PioneerResourceSite} from './pioneerWorld.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';

export type PioneerFacilityPreference='harvest'|'seed'|'timber'|'repair';
export type PioneerOperationalKind='garden'|'wood-yard';
const options:Record<PioneerOperationalKind,readonly PioneerFacilityPreference[]>={
 garden:['harvest','seed'],'wood-yard':['timber','repair']
};
function entry(s:PioneerWorld,title:string,text:string,id:string){
 appendPioneerJournal(s,title,text,causeId);
}
export const pioneerFacilityLabel=(kind:PioneerOperationalKind)=>
 kind==='garden'?'菜圃':'木作棚';
export function isPioneerOperational(b:PioneerBuilding):b is PioneerBuilding&{kind:PioneerOperationalKind}{
 return b.kind==='garden'||b.kind==='wood-yard';
}
export function isPioneerFacilityActive(b:PioneerBuilding){
 return b.operating!==false;
}
export function getPioneerFacilityPreference(b:PioneerBuilding):PioneerFacilityPreference{
 return b.productionMode??(b.kind==='garden'?'harvest':'timber');
}
export function setPioneerFacilityOperating(s:PioneerWorld,id:string,active:boolean){
 const b=s.buildings.find(x=>x.id===id);
 if(!b||!isPioneerOperational(b)||isPioneerFacilityActive(b)===active)return false;
 b.operating=active;
 entry(s,active?'工坊复工':'设施暂停',
  pioneerFacilityLabel(b.kind as PioneerOperationalKind)+(active?'重新开始实际生产。':
   '暂停生产，村民可转去其他工作；设施仍会随天气老化。'),b.causeId);
 return true;
}
export function setPioneerFacilityPreference(s:PioneerWorld,id:string,
 preference:PioneerFacilityPreference){
 const b=s.buildings.find(x=>x.id===id);
 if(!b||!isPioneerOperational(b)||!options[b.kind].includes(preference)||
  getPioneerFacilityPreference(b)===preference)return false;
 b.productionMode=preference;
 const detail=preference==='harvest'?'优先即时收成':
  preference==='seed'?'留种养地：近期收成较少，但田地回补更快':
  preference==='timber'?'优先备新屋木料':'优先维护和修补工具、旧房';
 entry(s,'调整生产用途',
  pioneerFacilityLabel(b.kind)+'调整为'+detail+'。此举会影响居民的劳动和产出。',b.causeId);
 return true;
}
export function pioneerFieldBuilding(s:PioneerWorld,site:PioneerResourceSite){
 return s.buildings.find(b=>b.kind==='garden'&&site.id==='field-'+b.id);
}
export function availablePioneerFields(s:PioneerWorld){
 return s.sites.filter(site=>site.kind==='field'&&site.stock>.001&&
  !!pioneerFieldBuilding(s,site)&&isPioneerFacilityActive(pioneerFieldBuilding(s,site)!));
}
export function pioneerHarvestMultiplier(s:PioneerWorld,site:PioneerResourceSite){
 const b=pioneerFieldBuilding(s,site);
 return b&&getPioneerFacilityPreference(b)==='seed'?.62:1;
}
export function pioneerFieldRenewMultiplier(s:PioneerWorld,site:PioneerResourceSite){
 const b=pioneerFieldBuilding(s,site);
 return b&&getPioneerFacilityPreference(b)==='seed'?1.45:1;
}
export function pioneerWoodWorkingMultiplier(s:PioneerWorld){
 const b=s.buildings.find(x=>x.kind==='wood-yard');
 return b&&isPioneerFacilityActive(b)&&getPioneerFacilityPreference(b)==='timber'?1.25:1;
}
export function pioneerRepairPriority(s:PioneerWorld){
 const b=s.buildings.find(x=>x.kind==='wood-yard');
 return b&&isPioneerFacilityActive(b)&&getPioneerFacilityPreference(b)==='repair'?82:68;
}
export function validatePioneerFacilityConfiguration(b:PioneerBuilding){
 if(b.operating!==undefined&&typeof b.operating!=='boolean')return false;
 if(b.productionMode===undefined)return true;
 if(b.kind!=='garden'&&b.kind!=='wood-yard')return false;
 return options[b.kind].includes(b.productionMode);
}
