import type {PioneerWorld,PioneerJournal} from './pioneerWorld.ts';

/** One bounded chronological journal. Protect authored, *earned* lifetime
 * milestones from everyday shift noise, without growing save files forever.
 * The journal still has at most 160 entries and all event IDs remain stable.
 * No additional time, resources or population can be created here. */
const HISTORY_TITLES=new Set([
 '安家火塘落成','公共灶台落成','村心空地落成',
 '又添一位乡邻','林地开出空场','第一篓渔获','锯木台终于装好',
 '山居木阁落成','留种试种有成','留种试种暂止',
 '山路茶棚落成','山谷第一次交换了货物','山路上认出了故人'
]);
function isPermanentHistory(s:PioneerWorld,e:PioneerJournal,causes:Set<string>){
 if(HISTORY_TITLES.has(e.title))return true;
 if(e.causeId&&causes.has(e.causeId)&&
  (e.title.endsWith('落成')||e.title.startsWith('乡邻谋划')||
   e.title==='商量搭棚'||e.title==='工材送达'))return true;
 return false;
}
export function appendPioneerJournal(s:PioneerWorld,title:string,text:string,
 causeId:string|null=null):number{
 if(s.journal.length>=160){
  const buildingCauses=new Set(s.buildings.map(b=>b.causeId));
  // Remove oldest *routine* entry. Original milestone IDs continue to be
  // referenced from houses and life history even after hundreds of days.
  const removable=s.journal.findIndex(e=>!isPermanentHistory(s,e,buildingCauses));
  s.journal.splice(removable<0?0:removable,1);
 }
 const id=s.nextEventId++;
 s.journal.push({id,minute:s.minutes,title,text,causeId});
 return id;
}
