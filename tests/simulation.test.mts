import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceToNextSeason,advanceWorld,buildingById,chapterProgress,chooseFate,chooseOpportunity,createWorld,getCalendar,getClock,getDay,getWeather,
 importWorld,loadWorld,pendingOpportunities,residentMotion,saveWorld,SLOT_KEYS,STORAGE_KEY,PREVIOUS_STORAGE_KEY,STORY_VISITOR_AT,VILLAGERS} from '../src/simulation/world.ts';
import {DAY_MINUTES,DAYS_PER_SEASON,SEASON_MINUTES,getCalendarFromMinutes} from '../src/simulation/calendar.ts';
import {getWeatherForMinutes} from '../src/simulation/weather.ts';
import {PLOTS,validatePlots} from '../src/simulation/plots.ts';
import {conditionOf} from '../src/simulation/buildings.ts';
import {dailyRoutePoints,dailyHash} from '../src/simulation/routines.ts';

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


test('stable plot registry has unique sockets and no floating unknown building IDs',()=>{
 assert.equal(validatePlots(),true);
 const s=createWorld(0);
 assert.deepEqual(s.buildings.map(b=>b.id),PLOTS.map(plot=>plot.occupiedBy));
 assert.equal(new Set(s.buildings.map(b=>b.id)).size,4);
 for(const b of s.buildings)assert.equal(PLOTS.find(p=>p.id===b.plotId)?.occupiedBy,b.id);
});

test('daily work generates a firewood pile, laundry and a physically staged tavern bench',()=>{
 const s=createWorld(0);
 to(s,4*DAY_MINUTES);
 assert.ok(buildingById(s,'home-001')?.props.includes('firewood'));
 assert.equal(buildingById(s,'bench-001')?.phase,'planned');
 to(s,8*DAY_MINUTES);
 assert.equal(buildingById(s,'bench-001')?.phase,'construction');
 to(s,14*DAY_MINUTES);
 const bench=buildingById(s,'bench-001')!;
 assert.equal(bench.phase,'occupied');
 assert.ok(bench.props.includes('rest-bench'));
 assert.ok(buildingById(s,'home-001')!.props.includes('laundry'));
 assert.ok(bench.causeEventIds.length>=2);
 assert.ok(s.journal.some(e=>e.title==='歇脚长凳落成'));
});

function findOpportunity(s:ReturnType<typeof createWorld>,kind:'rain-guest'|'roof-repair'){
 for(let i=0;i<180;i++){
  const found=pendingOpportunities(s).find(o=>o.kind===kind);
  if(found)return found;
  to(s,(Math.floor(s.minutes/DAY_MINUTES)+1)*DAY_MINUTES);
 }
 throw Error('Opportunity never appeared: '+kind);
}

test('rain guest appears only on a rainy day and supports three one-shot consequences',()=>{
 const paths=['stay','guide','observe'] as const;
 for(const option of paths){
  const s=createWorld(0),o=findOpportunity(s,'rain-guest');
  assert.equal(getWeather(s),'rain');
  assert.equal(chooseOpportunity(s,o.id,option),true);
  assert.equal(chooseOpportunity(s,o.id,option),false);
  assert.equal(s.guardianMemories.length,1);
  const inn=buildingById(s,'inn-001')!;
  assert.ok(inn.props.includes(option==='stay'?'guest-umbrella':option==='guide'?'road-sign':'warm-tea'));
  assert.ok(s.guardianMemories[0].producedEventIds.every(id=>inn.causeEventIds.includes(id)));
 }
});

test('unanswered rainy opportunity resolves autonomously instead of blocking the valley',()=>{
 const s=createWorld(0),o=findOpportunity(s,'rain-guest');
 to(s,o.deadlineMinutes);
 assert.equal(o.state,'resolved');
 assert.ok(s.guardianMemories.some(m=>m.opportunityId===o.id&&m.automatic===true));
 assert.ok(buildingById(s,'inn-001')!.props.includes('warm-tea'));
});

test('old tavern roof requests aid and gradually repairs; drainage leaves a durable benefit',()=>{
 const s=createWorld(0),o=findOpportunity(s,'roof-repair');
 const inn=buildingById(s,'inn-001')!;
 assert.ok(inn.conditionScore<55);
 assert.equal(conditionOf(inn),'worn');
 assert.equal(chooseOpportunity(s,o.id,'drainage'),true);
 assert.equal(inn.phase,'repairing');assert.equal(inn.workProgress,0);
 to(s,s.minutes+4*DAY_MINUTES);
 assert.equal(inn.phase,'repairing');
 to(s,s.minutes+6*DAY_MINUTES);
 assert.equal(inn.phase,'occupied');
 assert.ok(inn.props.includes('drainage')&&inn.props.includes('repaired-tiles'));
 assert.ok(inn.conditionScore>55);
 assert.ok(inn.causeEventIds.length>0);
 assert.ok(s.journal.some(e=>e.title==='无名酒肆修缮完成'));
});

test('ignoring roof invitation still starts non-destructive autonomous maintenance',()=>{
 const s=createWorld(0),o=findOpportunity(s,'roof-repair');
 to(s,o.deadlineMinutes);
 assert.equal(o.state,'resolved');
 assert.ok(s.guardianMemories.some(m=>m.opportunityId===o.id&&m.automatic));
 assert.equal(buildingById(s,'inn-001')!.phase,'repairing');
 to(s,s.minutes+14*DAY_MINUTES);
 assert.equal(buildingById(s,'inn-001')!.phase,'occupied');
 assert.ok(buildingById(s,'inn-001')!.conditionScore>30);
});

test('home gradually weathers and villagers repair it without a guardian order',()=>{
 const s=createWorld(0);
 to(s,120*DAY_MINUTES);
 const home=buildingById(s,'home-001')!;
 assert.ok(home.lastRepairYear!==null);
 assert.ok(home.props.includes('repaired-tiles'));
 assert.ok(home.props.includes('firewood')&&home.props.includes('laundry'));
 assert.ok(s.journal.some(e=>e.title==='乡邻合力修屋'));
});

test('one leap versus daily steps includes matching weather, buildings, opportunities and memories',()=>{
 const a=createWorld(0),b=createWorld(0);
 to(a,118*DAY_MINUTES);
 for(let day=1;day<=117;day++)to(b,day*DAY_MINUTES);
 to(b,118*DAY_MINUTES);
 assert.deepEqual(a.buildings,b.buildings);
 assert.deepEqual(a.opportunities,b.opportunities);
 assert.deepEqual(a.guardianMemories,b.guardianMemories);
 assert.deepEqual(a.journal,b.journal);
 assert.deepEqual(pendingOpportunities(a),pendingOpportunities(b));
});

test('old v3 Sprint 1 snapshots hydrate building data without changing story or save slots',()=>{
 const s=arrived();chooseFate(s,'host');
 const old=JSON.parse(JSON.stringify(s));
 delete old.buildings;delete old.opportunities;delete old.guardianMemories;
 const upgraded=importWorld(JSON.stringify(old))!;
 assert.equal(upgraded.version,3);
 assert.equal(upgraded.choice,'host');
 assert.equal(upgraded.buildings.length,4);
 assert.deepEqual(upgraded.opportunities,[]);
 assert.equal(upgraded.guardianMemories.length,0);
 const db=store();db.memory.set(STORAGE_KEY,JSON.stringify(old));
 assert.equal(loadWorld(db,0).buildings.length,4);
 assert.equal(loadWorld(db,0,2).choice,null);
});


test('sprint3: daytime routines differ by occupation rather than all meeting at tavern door',()=>{
 const s=createWorld(0),villagers=VILLAGERS.filter(v=>v.id<=8);
 for(let day=0;day<8;day++){
  for(const hour of [9.8,12.9,14.7,18.3,19.8]){
   s.minutes=day*DAY_MINUTES+hour*60;
   const states=villagers.map(v=>({id:v.id,...residentMotion(v,s)}));
   const crowd=states.filter(m=>Math.hypot(m.x+3.2,m.z-3.1)<1.25);
   assert.ok(crowd.length<=2,'Tavern doorway crowd of '+crowd.length+' on day '+day+' at '+hour+': '+crowd.map(v=>v.id));
   assert.ok(states.some(m=>m.x< -8),'No one working on the western farm');
   assert.ok(states.some(m=>m.x>3),'No one working on the eastern valley');
   for(const v of states){
    assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.heading));
    assert.notEqual(v.activityId,undefined);
   }
  }
 }
});

test('sprint3: role paths start/end at home and work on mapped lanes with stable day variation',()=>{
 for(const v of VILLAGERS.filter(v=>v.id<=8)){
  const route=dailyRoutePoints(v,5);
  assert.deepEqual(route[0],v.home);
  assert.ok(route.length>=2);
  assert.ok(route.every(([x,z])=>Math.abs(x)<=15.9&&Math.abs(z)<=11.5));
 }
 const trader=VILLAGERS[4],weaver=VILLAGERS[5];
 const positions:number[][]=[];
 for(let day=0;day<3;day++){
  const s=createWorld(0);s.minutes=day*DAY_MINUTES+13*60;
  const m=residentMotion(trader,s),w=residentMotion(weaver,s);
  positions.push([Math.round(m.x*10),Math.round(m.z*10),Math.round(w.x*10),Math.round(w.z*10)]);
 }
 assert.ok(new Set(positions.map(p=>p.join(':'))).size>=2,'Daily errands never vary');
 assert.equal(dailyHash(2,42),dailyHash(2,42));
 assert.notEqual(dailyHash(2,42),dailyHash(2,43));
});

test('sprint3: changing rain and fog alters activity without teleports or forced tavern attendance',()=>{
 const s=createWorld(0),v=VILLAGERS[6];
 for(let day=0;day<48;day++){
  s.minutes=day*DAY_MINUTES+13*60;
  if(getWeather(s)!=='rain')continue;
  const motion=residentMotion(v,s);
  assert.ok(motion.activityId==='shelter'||motion.activityId==='fish'||motion.activityId==='walk');
  assert.ok(Math.abs(motion.x-6.2)<3.2,'Fisher unexpectedly travels to tavern');
  return;
 }
 assert.fail('Expected at least one rainy day in first year');
});
