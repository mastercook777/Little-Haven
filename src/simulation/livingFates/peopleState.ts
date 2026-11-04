import type {PioneerFounder,PioneerWork,PioneerWorld} from '../pioneerWorld.ts';
import {pioneerEntrance} from '../pioneerPaths.ts';
import {notePioneerFarmCoWork,validateSeedFates,
 type FieldLegacy,type SeedTrial} from './seedTrial.ts';

/** v0.4.4-A/B: identity is an adjunct to the authoritative resident roster.
 * Truth never flows into public inspections unless a later earned reveal does it. */
export type PersonOrigin='farmer_refugee'|'artisan'|'herbalist'|'soldier'|'trader'|'scholar';
export type PersonSkill='wayfinding'|'cultivation'|'healing'|'protection';
export interface PersonLife{
 residentId:number;generatorVersion:1;origin:PersonOrigin;
 publicFacts:{arrivalReason:string;habit:string;knownSkills:string[]};
 privateFacts:{tags:string[];secretSkills:PersonSkill[]};
 knownTruth:Record<string,'clue'|'suspected'|'confirmed'|'public'>;
 skills:Record<PersonSkill,{level:number;xp:number;lastPracticeAt:number}>;
 majorMemoryIds:string[];arrivalAt:number;arrivalKnown:boolean;state:'resident'|'away'|'departed'|'deceased';
}
export interface RelationshipEdge{
 id:string;a:number;b:number;trust:number;closeness:number;
 sharedWorkHours:number;sharedMeals:number;memoryIds:string[];
}
export interface MajorMemory{
 id:string;minute:number;actorIds:number[];kind:'shared-work'|'seed-trial';
 work:PioneerWork;placeId:string;sourceEventIds:number[];
}
export interface PioneerCandidate{
 id:number;name:string;role:string;color:string;createdAt:number;person:PersonLife;
}
export interface LivingFatesState{
 schemaVersion:1;people:Record<string,PersonLife>;
 relationships:RelationshipEdge[];majorMemories:Record<string,MajorMemory>;
 pendingCandidate:PioneerCandidate|null;
 farmCoWorkHours:Record<string,number>;seedTrials:SeedTrial[];
 fieldLegacies:FieldLegacy[];appliedEffectIds:string[];
}

const ORIGINS:PersonOrigin[]=[
 'farmer_refugee','artisan','herbalist','soldier','trader','scholar'
];
const hash=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);
 return (k^(k>>>16))>>>0;
};
const pick=(seed:number,id:number,salt:number)=>
 hash(seed+Math.imul(id,0x9e3779b1)+salt);
const clamp=(v:number,max=100)=>Math.max(0,Math.min(max,v));
const relevantWork=new Set<PioneerWork>([
 'farm','seed-trial','collect-wood','forage','fetch-water','build','repair','commons-build','clear-land'
]);

/** Public presentation text is based on the present role, not secret origins. */
function publicFacts(role:string,isFounder:boolean):PersonLife['publicFacts']{
 return {
  arrivalReason:isFounder?'最早在山谷点起营火，与乡邻一起寻找落脚处。':
   '听说谷中已有可以栖身的屋舍和谋生的活计，沿山路来此安家。',
  habit:role.includes('农')||role.includes('园')?'常留心菜畦和时令。':
   role.includes('木')||role.includes('樵')?'习惯检查木料与屋舍。':
   role.includes('采集')||role.includes('山野')?'熟悉草木，喜欢在山边走动。':
   '愿意做些寻常劳动，慢慢融入邻里。',
  knownSkills:role.includes('农')||role.includes('园')?['日常田作']:
   role.includes('樵')||role.includes('采集')?['山野采集']:
   role.includes('木')||role.includes('石')?['工料整理']:[],
 };
}
export function generatePersonLife(seed:number,f:Pick<PioneerFounder,'id'|'role'>,
 arrivalAt:number,isFounder=false):PersonLife{
 const origin:PersonOrigin=isFounder?
  (f.id===1?'artisan':f.id===2?'farmer_refugee':'herbalist'):
  ORIGINS[pick(seed,f.id,17)%ORIGINS.length];
 const secretRoll=pick(seed,f.id,79)%100;
 // A complicated past is not a superpower; most residents have no secret.
 const privateFacts:PersonLife['privateFacts']=
  secretRoll<72?{tags:[],secretSkills:[]}:
  secretRoll<95?{tags:['不愿主动谈起的旧事'],secretSkills:[]}:
  {tags:['曾经走过危险的山路'],secretSkills:['wayfinding']};
 const skills=Object.fromEntries((['wayfinding','cultivation','healing','protection'] as PersonSkill[])
  .map(id=>[id,{level:0,xp:0,lastPracticeAt:0}])) as PersonLife['skills'];
 return {residentId:f.id,generatorVersion:1,origin,
  publicFacts:publicFacts(f.role,isFounder),privateFacts,knownTruth:{},
  skills,majorMemoryIds:[],arrivalAt,arrivalKnown:true,state:'resident'};
}
export function createLivingFates(seed:number,founders:PioneerFounder[],minute:number,
 migratingOldSave=false):LivingFatesState{
 const people:Record<string,PersonLife>={};
 for(const f of founders){
  const person=generatePersonLife(seed,f,f.id<=3?8*60+20:minute,f.id<=3);
  if(migratingOldSave&&f.id>3)person.arrivalKnown=false;
  people[f.id]=person;
 }
 return {schemaVersion:1,people,relationships:[],majorMemories:{},pendingCandidate:null,
  farmCoWorkHours:{},seedTrials:[],fieldLegacies:[],appliedEffectIds:[]};
}
/** An identified traveler exists in the save before housing/food admission is checked.
 * Moving them into people does NOT reroll their identity or create a second citizen. */
export function makePioneerCandidate(seed:number,id:number,
 data:readonly [string,string,string],minute:number):PioneerCandidate{
 return {id,name:data[0],role:data[1],color:data[2],createdAt:minute,
  person:generatePersonLife(seed,{id,role:data[1]},minute)};
}
export function welcomePioneerCandidate(s:PioneerWorld,candidate:PioneerCandidate){
 const person=candidate.person;
 s.livingFates.people[candidate.id]={...person,arrivalAt:s.minutes,arrivalKnown:true,state:'resident'};
 s.livingFates.pendingCandidate=null;
}
export function pioneerCultivationMultiplier(s:PioneerWorld,id:number){
 const level=s.livingFates.people[id]?.skills.cultivation.level??0;
 return 1+Math.min(.12,level*.02);
}
const sharedPlace=(s:PioneerWorld,f:PioneerFounder)=>{
 if(f.activity==='farm'||f.activity==='seed-trial'){
  const garden=s.buildings.find(b=>b.kind==='garden'&&
   Math.hypot(f.target[0]-pioneerEntrance(b.parcel)[0],
    f.target[1]-pioneerEntrance(b.parcel)[1])<.65);
  if(garden)return f.activity+':'+garden.id;
 }
 return f.activity+':'+f.target.map(n=>n.toFixed(2)).join(':');
};
function practice(person:PersonLife,skill:PersonSkill,minute:number){
 const entry=person.skills[skill];
 entry.xp=Math.min(100000,entry.xp+1);
 entry.level=Math.min(10,Math.floor(entry.xp/24));
 entry.lastPracticeAt=minute;
}
function makeEdge(a:number,b:number):RelationshipEdge{
 return {id:a+'-'+b,a,b,trust:0,closeness:0,
  sharedWorkHours:0,sharedMeals:0,memoryIds:[]};
}
/** Called only after a completed simulation hour, never from a render frame.
 * Tasks are exclusive in pioneerWorld.step. Merely standing nearby is not work. */
export function settleLivingFatesHour(s:PioneerWorld){
 const lives=s.livingFates;
 for(const f of s.founders){
  const person=lives.people[f.id];
  if(!person)continue;
  if(f.activity==='farm'||f.activity==='seed-trial')practice(person,'cultivation',s.minutes);
  if(f.activity==='collect-wood'||f.activity==='clear-land')
   practice(person,'wayfinding',s.minutes);
 }
 for(let i=0;i<s.founders.length;i++){
  const left=s.founders[i];
  for(let j=i+1;j<s.founders.length;j++){
   const right=s.founders[j];
   const working=left.activity===right.activity&&relevantWork.has(left.activity)&&
    sharedPlace(s,left)===sharedPlace(s,right);
   const eating=left.activity==='eat'&&right.activity==='eat'&&
    s.resources.food>=0; // servePioneerMeal already committed this meal.
   if(!working&&!eating)continue;
   const a=Math.min(left.id,right.id),b=Math.max(left.id,right.id),id=a+'-'+b;
   let edge=lives.relationships.find(e=>e.id===id);
   if(!edge){edge=makeEdge(a,b);lives.relationships.push(edge);}
   if(eating)edge.sharedMeals++;
   if(working){
    edge.sharedWorkHours++;
    if(left.activity==='farm')notePioneerFarmCoWork(s,left,right);
   }
   edge.trust=clamp(Math.floor(edge.sharedWorkHours/12),60);
   edge.closeness=clamp(Math.floor(edge.sharedMeals/24),60);
   if(working&&edge.sharedWorkHours===24){
    const memoryId='co-work-'+id+'-24';
    if(!lives.majorMemories[memoryId]){
     lives.majorMemories[memoryId]={id:memoryId,minute:s.minutes,
      actorIds:[a,b],kind:'shared-work',work:left.activity,
      placeId:sharedPlace(s,left),sourceEventIds:[]};
     edge.memoryIds.push(memoryId);
     for(const id of [a,b])lives.people[id].majorMemoryIds.push(memoryId);
    }
   }
  }
 }
}
export function publicPersonHistory(s:PioneerWorld,id:number){
 const person=s.livingFates.people[id];
 if(!person)return [];
 return person.majorMemoryIds.flatMap(memoryId=>{
  const m=s.livingFates.majorMemories[memoryId];
  if(!m)return [];
  const partnerId=m.actorIds.find(other=>other!==id);
  const partner=s.founders.find(f=>f.id===partnerId);
  return [{minute:m.minute,text:m.kind==='seed-trial'?
   '与'+(partner?.name??'乡邻')+'在菜圃留种试验，'+
   (s.livingFates.seedTrials.find(t=>'fate-'+t.id===m.id)?.phase==='resolved'?
    '经过真实工时与一季等待，将田间经验留给后人。':
    '粮水与工时不足，试种中止，花掉的种粮不曾凭空返回。'):
   '与'+(partner?.name??'乡邻')+'一同承担实际劳作，累计达到二十四小时。'}];
 }).sort((a,b)=>b.minute-a.minute).slice(0,5);
}
export function publicPersonRelations(s:PioneerWorld,id:number){
 return s.livingFates.relationships.filter(e=>e.a===id||e.b===id)
  .filter(e=>e.sharedMeals>0||e.sharedWorkHours>0)
  .map(e=>({id:e.a===id?e.b:e.a,work:e.sharedWorkHours,
   meals:e.sharedMeals,trust:e.trust,closeness:e.closeness}))
  .sort((a,b)=>b.work-a.work||b.meals-a.meals||a.id-b.id).slice(0,4);
}

/** Reject invalid v1 saves rather than quietly replacing a character's truth.
 * Old v4 saves without the field are migrated by the caller, with no fake memories. */
export function validateLivingFates(s:PioneerWorld):boolean{
 const value=s.livingFates;
 if(!value||value.schemaVersion!==1||!value.people||
  Array.isArray(value.people)||!Array.isArray(value.relationships)||
  value.relationships.length>66||!value.majorMemories||
  Array.isArray(value.majorMemories)||Object.keys(value.majorMemories).length>150)return false;
 const ids=new Set(s.founders.map(f=>f.id));
 if(Object.keys(value.people).length!==ids.size)return false;
 const validPerson=(p:PersonLife,id:number)=>
  p?.residentId===id&&p.generatorVersion===1&&ORIGINS.includes(p.origin)&&
  typeof p.publicFacts?.arrivalReason==='string'&&
  typeof p.publicFacts?.habit==='string'&&Array.isArray(p.publicFacts?.knownSkills)&&
  Array.isArray(p.privateFacts?.tags)&&Array.isArray(p.privateFacts?.secretSkills)&&
  p.knownTruth&&typeof p.knownTruth==='object'&&
  ['resident','away','departed','deceased'].includes(p.state)&&
  typeof p.arrivalKnown==='boolean'&&
  Number.isFinite(p.arrivalAt)&&p.arrivalAt>=0&&p.arrivalAt<=s.minutes&&
  Array.isArray(p.majorMemoryIds)&&p.majorMemoryIds.length<=50&&
  (['wayfinding','cultivation','healing','protection'] as PersonSkill[]).every(skill=>{
   const stat=p.skills?.[skill];
   return stat&&Number.isInteger(stat.level)&&stat.level>=0&&stat.level<=10&&
    Number.isFinite(stat.xp)&&stat.xp>=0&&stat.xp<=100000&&
    stat.level===Math.min(10,Math.floor(stat.xp/24))&&
    Number.isFinite(stat.lastPracticeAt)&&stat.lastPracticeAt>=0&&
    stat.lastPracticeAt<=s.minutes;
  });
 if(s.founders.some(f=>!validPerson(value.people[f.id],f.id)))return false;
 const candidate=value.pendingCandidate;
 if(candidate!==null){
  if(!candidate||candidate.id!==s.nextResidentId||ids.has(candidate.id)||
   !Number.isFinite(candidate.createdAt)||candidate.createdAt>s.minutes||
   typeof candidate.name!=='string'||typeof candidate.role!=='string'||
   typeof candidate.color!=='string'||
   !validPerson(candidate.person,candidate.id))return false;
 }
 const edgeIds=new Set<string>();
 for(const e of value.relationships){
  if(!e||!ids.has(e.a)||!ids.has(e.b)||e.a>=e.b||
   e.id!==e.a+'-'+e.b||edgeIds.has(e.id)||
   ![e.sharedWorkHours,e.sharedMeals,e.trust,e.closeness].every(n=>Number.isInteger(n)&&n>=0)||
   e.trust!==clamp(Math.floor(e.sharedWorkHours/12),60)||
   e.closeness!==clamp(Math.floor(e.sharedMeals/24),60)||
   !Array.isArray(e.memoryIds)||e.memoryIds.length>20)return false;
  edgeIds.add(e.id);
 }
 for(const [id,m] of Object.entries(value.majorMemories)){
  if(m?.id!==id||!['shared-work','seed-trial'].includes(m.kind)||!Number.isFinite(m.minute)||
   m.minute<0||m.minute>s.minutes||!Array.isArray(m.actorIds)||
   m.actorIds.length!==2||!m.actorIds.every(p=>ids.has(p))||
   !Array.isArray(m.sourceEventIds)||m.sourceEventIds.length>20||
   typeof m.placeId!=='string'||!relevantWork.has(m.work))return false;
  for(const p of m.actorIds)
   if(!value.people[p].majorMemoryIds.includes(id))return false;
 }
 return Object.values(value.people).every(p=>
  p.majorMemoryIds.every(id=>Boolean(value.majorMemories[id])))&&
  value.relationships.every(e=>e.memoryIds.every(id=>Boolean(value.majorMemories[id])))&&
  validateSeedFates(s);
}
