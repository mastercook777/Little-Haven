import {DAY_MINUTES,nextSeasonBoundary} from '../calendar.ts';
import {pioneerEntrance} from '../pioneerPaths.ts';
import {getPioneerFacilityPreference,isPioneerFacilityActive} from '../pioneerFacilities.ts';
import type {PioneerWorld,PioneerFounder,PioneerResourceSite} from '../pioneerWorld.ts';

/** The field, not a menu, is the lasting recipient of ordinary lives' work.
 * Every hour here replaces another exclusive resident job. */
export interface SeedTrial{
 id:string;gardenId:string;actorIds:[number,number];startedAt:number;
 resolveAt:number;workBy:[number,number];lastWorkAt:[number,number];seedsSpent:number;
 phase:'working'|'resolved'|'abandoned';completedAt:number|null;
 outcomeEventId:number|null;effectId:string|null;
}
export interface FieldLegacy{
 id:string;gardenId:string;actorIds:[number,number];completedAt:number;
 harvestBonus:number;sourceTrialId:string;
}
export interface SeedFatesState{
 farmCoWorkHours:Record<string,number>;seedTrials:SeedTrial[];
 fieldLegacies:FieldLegacy[];appliedEffectIds:string[];
}
const round=(x:number)=>Math.round(x*1000)/1000;
const SEEDS=1.2,SHIFT_HOURS=5,MIN_CO_FARM=8;
const maxTrials=36;
const safeFood=(s:PioneerWorld)=>s.resources.food>=Math.max(6,s.founders.length*2.4);
const journal=(s:PioneerWorld,title:string,content:string,causeId:string)=>{
 if(s.journal.length>=160)s.journal.shift();
 const id=s.nextEventId++;
 s.journal.push({id,minute:s.minutes,title,text:content,causeId});
 return id;
};
export function farmPairKey(gardenId:string,a:number,b:number){
 return gardenId+':'+Math.min(a,b)+'-'+Math.max(a,b);
}
export function notePioneerFarmCoWork(s:PioneerWorld,a:PioneerFounder,b:PioneerFounder){
 // This is called by the same completed-hour evidence gate that logs co-work.
 if(a.activity!=='farm'||b.activity!=='farm')return;
 const garden=s.buildings.find(bld=>bld.kind==='garden'&&
  s.sites.some(site=>site.id==='field-'+bld.id&&
   Math.abs(a.target[0]-pioneerEntrance(bld.parcel)[0])<.005&&
   Math.abs(a.target[1]-pioneerEntrance(bld.parcel)[1])<.005));
 if(!garden)return;
 const key=farmPairKey(garden.id,a.id,b.id);
 s.livingFates.farmCoWorkHours[key]=Math.min(100000,
  (s.livingFates.farmCoWorkHours[key]??0)+1);
}
export function pioneerFieldLegacyMultiplier(s:PioneerWorld,siteId:string){
 const gardenId=siteId.startsWith('field-')?siteId.slice(6):siteId;
 const benefit=s.livingFates.fieldLegacies.find(x=>x.gardenId===gardenId);
 return benefit?1+benefit.harvestBonus:1;
}
export function activeSeedTrial(s:PioneerWorld):SeedTrial|null{
 return s.livingFates.seedTrials.find(t=>t.phase==='working')??null;
}
export function gardenSeedTrial(s:PioneerWorld,gardenId:string){
 return s.livingFates.seedTrials.filter(t=>t.gardenId===gardenId).at(-1)??null;
}
function eligiblePair(s:PioneerWorld,gardenId:string):[number,number]|null{
 const pairs=Object.entries(s.livingFates.farmCoWorkHours)
  .filter(([key,hours])=>key.startsWith(gardenId+':')&&hours>=MIN_CO_FARM)
  .map(([key,hours])=>{
   const ids=key.slice(gardenId.length+1).split('-').map(Number);
   return {ids:ids as [number,number],hours};
  }).sort((a,b)=>b.hours-a.hours||a.ids[0]-b.ids[0]||a.ids[1]-b.ids[1]);
 for(const entry of pairs){
  const [a,b]=entry.ids;
  const people=s.livingFates.people;
  if(!people[a]||!people[b]||people[a].state!=='resident'||people[b].state!=='resident')continue;
  if(people[a].skills.cultivation.xp<12||people[b].skills.cultivation.xp<6)continue;
  return [a,b];
 }
 return null;
}
/** Starts only after observed same-field co-work, real food reserves, and a
 * reachable operational garden. Other good villages can simply never do it. */
export function considerSeedTrial(s:PioneerWorld){
 if(activeSeedTrial(s)||s.livingFates.seedTrials.length>=maxTrials||
  !safeFood(s)||s.resources.water<s.founders.length*.6)return false;
 const boundary=nextSeasonBoundary(s.minutes);
 if(boundary-s.minutes<10*DAY_MINUTES)return false;
 for(const garden of s.buildings.filter(b=>b.kind==='garden'&&isPioneerFacilityActive(b))){
  const field=s.sites.find(x=>x.id==='field-'+garden.id&&x.stock>=.4);
  if(!field||s.livingFates.fieldLegacies.some(x=>x.gardenId===garden.id))continue;
  const prior=s.livingFates.seedTrials.filter(t=>t.gardenId===garden.id);
  if(prior.length>=3||prior.some(t=>t.resolveAt+8*DAY_MINUTES>s.minutes))continue;
  const pair=eligiblePair(s,garden.id);
  if(!pair)continue;
  const auto=!s.livingFates.seedTrials.length&&s.founders.length>=5&&
   s.resources.food>=s.founders.length*4.0&&
   s.livingFates.farmCoWorkHours[farmPairKey(garden.id,...pair)]>=24;
  if(getPioneerFacilityPreference(garden)!=='seed'&&!auto)continue;
  // This stock really leaves the village pantry now. No positive crop effect
  // or direct benefit is awarded until later, if enough separate trial shifts occur.
  if(s.resources.food<SEEDS+s.founders.length*1.5)continue;
  s.resources.food=round(s.resources.food-SEEDS);
  if(s.foodStats)s.foodStats.consumed=round(s.foodStats.consumed+SEEDS);
  const id='seed-trial-'+garden.id+'-'+(prior.length+1);
  const trial:SeedTrial={id,gardenId:garden.id,actorIds:pair,startedAt:s.minutes,
   resolveAt:boundary,workBy:[0,0],lastWorkAt:[0,0],seedsSpent:SEEDS,phase:'working',
   completedAt:null,outcomeEventId:null,effectId:null};
  s.livingFates.seedTrials.push(trial);
  const names=pair.map(id=>s.founders.find(f=>f.id===id)?.name??'乡邻');
  journal(s,'留下一把种子',names.join('和')+
   '曾在这块田里真实共劳。两人从粮仓留出 '+SEEDS+
   ' 份可吃的谷粮试种，接下来还须亲手照料，成败要等来季。',id);
  return true;
 }
 return false;
}
/** The caller must have successfully allocated a real field destination.
 * One shift displaces normal harvest/building work; no crop is deposited. */
export function performSeedTrialShift(s:PioneerWorld,f:PioneerFounder,
 field:PioneerResourceSite){
 const trial=activeSeedTrial(s);
 if(!trial||field.kind!=='field'||field.id!=='field-'+trial.gardenId||
  s.minutes>=trial.resolveAt||!safeFood(s)||f.activity!=='seed-trial')return false;
 const index=trial.actorIds.indexOf(f.id);
 if(index<0||trial.lastWorkAt[index]===s.minutes)return false;
 const garden=s.buildings.find(b=>b.id===trial.gardenId);
 if(!garden||!isPioneerFacilityActive(garden))return false;
 trial.workBy[index]=Math.min(SHIFT_HOURS,trial.workBy[index]+1);
 trial.lastWorkAt[index]=s.minutes;
 return true;
}
export function dueSeedTrial(s:PioneerWorld){
 const trial=activeSeedTrial(s);
 if(!trial||s.minutes<trial.resolveAt)return false;
 const successful=trial.workBy.every(work=>work>=SHIFT_HOURS);
 trial.completedAt=s.minutes;
 trial.phase=successful?'resolved':'abandoned';
 const names=trial.actorIds.map(id=>s.founders.find(f=>f.id===id)?.name??'乡邻');
 let effectId:string|null=null;
 if(successful){
  effectId='field-knowledge-'+trial.id;
  // If this had ever been applied, replay/reimport must not pay twice.
  if(!s.livingFates.appliedEffectIds.includes(effectId)){
   s.livingFates.fieldLegacies.push({id:effectId,gardenId:trial.gardenId,
    actorIds:trial.actorIds,completedAt:s.minutes,harvestBonus:.06,
    sourceTrialId:trial.id});
   s.livingFates.appliedEffectIds.push(effectId);
  }
  trial.effectId=effectId;
 }
 trial.outcomeEventId=journal(s,successful?'留种试种有成':'留种试种暂止',
  successful?names.join('和')+
   '各用至少五个真实劳动小时照料试田。新季起此田每次实际采收可多得少量收成，来年的工仍须自己做。':
   '乡邻忙于粮水与日常劳作，未能在季末前各完成五小时试种。种粮已经花掉，田地未获得免费增产。',
  trial.id);
 const memoryId='fate-'+trial.id;
 if(!s.livingFates.majorMemories[memoryId]){
  s.livingFates.majorMemories[memoryId]={id:memoryId,
   minute:s.minutes,actorIds:trial.actorIds,kind:'seed-trial',
   work:'seed-trial',placeId:trial.gardenId,
   sourceEventIds:[trial.outcomeEventId]};
  for(const id of trial.actorIds){
   const person=s.livingFates.people[id];
   if(person&&!person.majorMemoryIds.includes(memoryId))
    person.majorMemoryIds.push(memoryId);
  }
 }
 return true;
}
/** A legacy is a fixed productivity multiplier on real crops, not a deposit. */
export function validateSeedFates(s:PioneerWorld){
 const f=s.livingFates;
 if(!f.farmCoWorkHours||Array.isArray(f.farmCoWorkHours)||
  !Array.isArray(f.seedTrials)||f.seedTrials.length>maxTrials||
  !Array.isArray(f.fieldLegacies)||f.fieldLegacies.length>12||
  !Array.isArray(f.appliedEffectIds)||f.appliedEffectIds.length>12)return false;
 const residents=new Set(s.founders.map(x=>x.id));
 const gardens=new Set(s.buildings.filter(b=>b.kind==='garden').map(b=>b.id));
 const keys=Object.entries(f.farmCoWorkHours);
 if(keys.length>300||keys.some(([key,hours])=>{
  if(!Number.isSafeInteger(hours)||hours<0||hours>100000)return true;
  const match=key.match(/^(.*):(\d+)-(\d+)$/);
  return !match||!gardens.has(match[1])||!residents.has(Number(match[2]))||
   !residents.has(Number(match[3]))||Number(match[2])>=Number(match[3]);
 }))return false;
 const seenTrial=new Set<string>(),seenEffect=new Set<string>();
 for(const trial of f.seedTrials){
  if(!trial||typeof trial.id!=='string'||seenTrial.has(trial.id)||
   !gardens.has(trial.gardenId)||!Array.isArray(trial.actorIds)||
   trial.actorIds.length!==2||!trial.actorIds.every(x=>residents.has(x))||
   trial.actorIds[0]>=trial.actorIds[1]||
   !Array.isArray(trial.workBy)||trial.workBy.length!==2||
   !trial.workBy.every(n=>Number.isInteger(n)&&n>=0&&n<=SHIFT_HOURS)||
   !Array.isArray(trial.lastWorkAt)||trial.lastWorkAt.length!==2||
   !trial.lastWorkAt.every(n=>Number.isFinite(n)&&n>=0&&n<=s.minutes)||
   trial.seedsSpent!==SEEDS||!Number.isFinite(trial.startedAt)||
   trial.startedAt<0||trial.startedAt>s.minutes||
   !Number.isFinite(trial.resolveAt)||trial.resolveAt<=trial.startedAt||
   trial.resolveAt>nextSeasonBoundary(trial.startedAt)||
   !['working','resolved','abandoned'].includes(trial.phase)||
   (trial.phase==='working'&&(trial.completedAt!==null||
    trial.outcomeEventId!==null||trial.effectId!==null||trial.resolveAt<=s.minutes))||
   (trial.phase!=='working'&&(!Number.isFinite(trial.completedAt)||
    trial.completedAt! < trial.resolveAt||trial.completedAt! > s.minutes||
    !Number.isSafeInteger(trial.outcomeEventId)||trial.outcomeEventId! < 1||
    trial.outcomeEventId! >= s.nextEventId))||
   (trial.phase==='resolved'&&(!trial.workBy.every(n=>n===SHIFT_HOURS)||
    trial.effectId!=='field-knowledge-'+trial.id))||
   (trial.phase==='abandoned'&&(trial.effectId!==null||
    trial.workBy.every(n=>n===SHIFT_HOURS))))return false;
  seenTrial.add(trial.id);
 }
 const active=f.seedTrials.filter(t=>t.phase==='working');
 if(active.length>1)return false;
 for(const legacy of f.fieldLegacies){
  if(!legacy||typeof legacy.id!=='string'||seenEffect.has(legacy.id)||
   !gardens.has(legacy.gardenId)||legacy.harvestBonus!==.06||
   !Number.isFinite(legacy.completedAt)||legacy.completedAt>s.minutes||
   !Array.isArray(legacy.actorIds)||legacy.actorIds.length!==2||
   !legacy.actorIds.every(id=>residents.has(id))||
   !seenTrial.has(legacy.sourceTrialId)||legacy.id!=='field-knowledge-'+legacy.sourceTrialId||
   !f.seedTrials.some(t=>t.id===legacy.sourceTrialId&&t.phase==='resolved'&&
    t.effectId===legacy.id&&t.gardenId===legacy.gardenId&&
    t.completedAt===legacy.completedAt))return false;
  seenEffect.add(legacy.id);
 }
 return f.appliedEffectIds.length===seenEffect.size&&
  new Set(f.appliedEffectIds).size===seenEffect.size&&
  f.appliedEffectIds.every(id=>seenEffect.has(id));
}
