import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceToNextSeason,advanceWorld,chapterProgress,chooseFate,createWorld,getCalendar,getClock,getDay,getWeather,
 importWorld,loadWorld,residentMotion,saveWorld,SLOT_KEYS,STORAGE_KEY,PREVIOUS_STORAGE_KEY,STORY_VISITOR_AT,VILLAGERS} from '../src/simulation/world.ts';
import {DAY_MINUTES,DAYS_PER_SEASON,SEASON_MINUTES,getCalendarFromMinutes} from '../src/simulation/calendar.ts';
import {getWeatherForMinutes} from '../src/simulation/weather.ts';

const to=(s:ReturnType<typeof createWorld>,minute:number)=>advanceWorld(s,(minute-s.minutes)/3);
const arrived=()=>{const s=createWorld(0);to(s,STORY_VISITOR_AT);return s;};
const store=()=>{
 const memory=new Map<string,string>();
 return {memory,getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
};

test('v3 valley starts in the first spring with eight permanent residents',()=>{
 const s=createWorld(0);
 assert.equal(s.version,3);assert.equal(s.population,8);assert.equal(s.houses,6);
 assert.equal(s.choice,null);assert.equal(s.storyStage,'peace');
 assert.equal(getDay(s),1);assert.equal(getClock(s).text,'08:20');
 assert.deepEqual([getCalendar(s).year,getCalendar(s).season,getCalendar(s).dayOfSeason],[1,'spring',1]);
 assert.equal(VILLAGERS.length,11);
});

test('all four seasons and year boundaries come from minutes only',()=>{
 for(const [i,season] of ['spring','summer','autumn','winter','spring'].entries()){
  const c=getCalendarFromMinutes(i*SEASON_MINUTES);
  assert.equal(c.season,season);assert.equal(c.year,i===4?2:1);
  assert.equal(c.dayOfSeason,1);
 }
 assert.equal(getCalendarFromMinutes(48*DAY_MINUTES-1).dayOfYear,48);
 assert.equal(DAYS_PER_SEASON,12);
});

test('weather is seeded by calendar day, stable across calls and reloads',()=>{
 const s=createWorld(12);const first=getWeather(s);
 assert.equal(first,getWeather(s));assert.equal(first,getWeatherForMinutes(s.minutes,s.seed));
 for(let d=1;d<=48;d++){
  to(s,(d-1)*DAY_MINUTES+500);
  assert.ok(['clear','rain','fog'].includes(getWeather(s)));
 }
});

test('visitor and one-time guardian branch still work, but 15 real minutes cannot finish life',()=>{
 const s=createWorld();assert.equal(chooseFate(s,'host'),false);
 to(s,STORY_VISITOR_AT-1);assert.equal(s.storyStage,'peace');
 assert.equal(to(s,STORY_VISITOR_AT).visitor,true);
 assert.equal(chooseFate(s,'host'),true);
 assert.equal(chooseFate(s,'observe'),false);
 advanceWorld(s,900);assert.notEqual(s.storyStage,'legacy');
 assert.ok(getCalendar(s).year===1);assert.ok(chapterProgress(s)>=0);
});

test('host branch spans four years, producing the sword school and not a one-week ending',()=>{
 const s=arrived();chooseFate(s,'host');
 const start=s.storyStarted!;
 to(s,start+47*DAY_MINUTES);assert.equal(s.storyStage,'training');
 to(s,start+48*DAY_MINUTES);assert.equal(s.storyStage,'departed');
 assert.equal(residentMotion(VILLAGERS[7],s).visible,false);
 to(s,start+96*DAY_MINUTES);assert.equal(s.storyStage,'rumor');
 to(s,start+144*DAY_MINUTES);assert.equal(s.storyStage,'returned');
 const out=to(s,start+156*DAY_MINUTES);assert.equal(out.completed,true);
 assert.equal(s.storyStage,'legacy');assert.equal(s.population,9);assert.equal(s.renown,20);
 assert.ok(s.journal.some(e=>e.title==='竹隐剑庐落成'));
 assert.equal(residentMotion(VILLAGERS[10],s).activity,'在剑庐里练习基本功');
});

test('unanswered encounter takes a coherent, slow alternate route',()=>{
 const s=createWorld();
 to(s,2*DAY_MINUTES);
 assert.equal(s.choice,'observe');assert.equal(s.autoChosen,true);
 assert.notEqual(s.storyStage,'legacy');
 const start=s.storyStarted!;
 to(s,start+156*DAY_MINUTES);
 assert.equal(s.storyStage,'legacy');assert.equal(s.renown,15);
 assert.ok(s.journal.some(e=>e.title==='行脚茶亭开张'));
});

test('one-step, many-step, and season-boundary advances converge including chronicle IDs',()=>{
 const a=arrived(),b=arrived();chooseFate(a,'host');chooseFate(b,'host');
 const delta=100*DAY_MINUTES;
 advanceWorld(a,delta/3);
 for(let i=0;i<100;i++)advanceWorld(b,(delta/100)/3);
 assert.equal(a.minutes,b.minutes);
 assert.equal(a.storyStage,b.storyStage);
 assert.deepEqual(a.journal,b.journal);
 assert.equal(a.lastSeasonLogged,b.lastSeasonLogged);
});

test('flow-year advances only one season and journals the changed season',()=>{
 const s=createWorld();
 const first=advanceToNextSeason(s);assert.equal(first.crossedSeasons,1);
 assert.equal(getCalendar(s).season,'summer');
 assert.equal(first.crossedYears,0);
 assert.equal(s.minutes,SEASON_MINUTES+500);
 advanceToNextSeason(s);advanceToNextSeason(s);
 const winter=advanceToNextSeason(s);
 assert.equal(getCalendar(s).year,2);assert.equal(winter.crossedYears,1);
 assert.ok(s.journal.some(e=>e.title.includes('第 2 年')));
});

test('slot saves never overwrite older worlds and do not replay offline events twice',()=>{
 const db=store(),s=arrived();chooseFate(s,'host');
 db.memory.set(PREVIOUS_STORAGE_KEY,'KEEP V2');db.memory.set('little-haven-prototype-v01','KEEP V1');
 saveWorld(s,db,1000,1);
 const later=1000+1000*1000;
 const restored=loadWorld(db,later,1);
 assert.ok(restored.minutes<=s.minutes+4*DAY_MINUTES+1);
 assert.equal(restored.choice,'host');assert.equal(db.memory.get(PREVIOUS_STORAGE_KEY),'KEEP V2');
 saveWorld(restored,db,later,1);
 assert.deepEqual(loadWorld(db,later,1).journal,restored.journal);
 const second=createWorld(later);saveWorld(second,db,later,2);
 assert.equal(loadWorld(db,later,2).choice,null);
 assert.ok(db.memory.has(STORAGE_KEY));assert.ok(db.memory.has(SLOT_KEYS[1]));
});

test('v2 branch migration preserves the v2 payload and history without new fast-forward',()=>{
 const db=store(),s=arrived();chooseFate(s,'observe');
 const old={...s,version:2};delete (old as {seed?:number}).seed;
 db.memory.set(PREVIOUS_STORAGE_KEY,JSON.stringify(old));
 const migrated=loadWorld(db,0);
 assert.equal(migrated.version,3);assert.equal(migrated.choice,'observe');
 assert.equal(migrated.storyStage,'stranger');
 assert.deepEqual(migrated.journal,s.journal);
 assert.equal(JSON.parse(db.memory.get(PREVIOUS_STORAGE_KEY)!).version,2);
 assert.equal(loadWorld(db,0,2).choice,null);
});

test('imports reject invalid or unsupported snapshots',()=>{
 const s=createWorld(0);
 assert.equal(importWorld('{oops'),null);
 assert.equal(importWorld(JSON.stringify({...s,version:2})),null);
 assert.equal(importWorld(JSON.stringify({...s,storyStage:'bad'})),null);
 assert.equal(importWorld(JSON.stringify(s))?.version,3);
 advanceWorld(s,Number.NaN);advanceWorld(s,-1);assert.equal(s.minutes,500);
 assert.equal(loadWorld({getItem:()=>'{broken'},0).version,3);
});
