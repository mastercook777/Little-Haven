import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWorld,chapterProgress,chooseFate,createWorld,getClock,getDay,getDaylight,loadWorld,residentMotion,saveWorld,STORAGE_KEY,STORY_AUTO_CHOICE_AT,STORY_VISITOR_AT,VILLAGERS} from '../src/simulation/world.ts';

const advanceTo=(s:ReturnType<typeof createWorld>,minutes:number)=>advanceWorld(s,(minutes-s.minutes)/6);

test('new wuxia valley starts with the inn, eight permanent residents, and no imposed decision',()=>{
 const s=createWorld(1000);assert.equal(s.version,2);assert.equal(s.population,8);assert.equal(s.houses,6);
 assert.equal(s.storyStage,'peace');assert.equal(s.choice,null);assert.equal(s.renown,0);
 assert.equal(getDay(s),1);assert.equal(getClock(s).text,'08:20');assert.ok(getDaylight(s)>.8);
 assert.equal(VILLAGERS.length,11);
});

test('visitor and guardian prompt become available only after the actual arrival',()=>{
 const s=createWorld();assert.equal(chooseFate(s,'host'),false);
 advanceTo(s,STORY_VISITOR_AT-1);assert.equal(s.storyStage,'peace');
 const event=advanceTo(s,STORY_VISITOR_AT);assert.equal(event.visitor,true);
 assert.equal(s.storyStage,'stranger');assert.equal(chooseFate(s,'host'),true);
 assert.equal(chooseFate(s,'observe'),false);assert.equal(s.choice,'host');
});

test('host branch gives a mentorship, travel, rumor, homecoming and visible sword school',()=>{
 const s=createWorld();advanceTo(s,STORY_VISITOR_AT);chooseFate(s,'host');
 const result=advanceWorld(s,1000);
 assert.equal(s.storyStage,'legacy');assert.equal(s.choice,'host');assert.equal(result.completed,true);
 assert.deepEqual(result.milestones,['training','departed','rumor','returned','legacy']);
 assert.equal(s.houses,7);assert.equal(s.population,9);assert.equal(s.renown,20);
 assert.equal(residentMotion(VILLAGERS[10],s).activity,'在剑庐里练习基本功');
 assert.ok(s.journal.some(e=>e.title==='竹隐剑庐落成'));
 assert.ok(s.journal.some(e=>e.title==='少年出山'));
 assert.equal(chapterProgress(s),1);
});

test('observe branch is a meaningful alternative and ends with a roadside teahouse',()=>{
 const s=createWorld();advanceTo(s,STORY_VISITOR_AT);chooseFate(s,'observe');advanceWorld(s,1000);
 assert.equal(s.storyStage,'legacy');assert.equal(s.renown,15);
 assert.equal(residentMotion(VILLAGERS[10],s).activity,'在行脚茶亭忙着招待过客');
 assert.ok(s.journal.some(e=>e.title==='行脚茶亭开张'));
 assert.equal(s.journal.some(e=>e.title==='竹隐剑庐落成'),false);
});

test('autonomous valley continues when player never responds',()=>{
 const s=createWorld();advanceTo(s,STORY_AUTO_CHOICE_AT+5800);
 assert.equal(s.choice,'observe');assert.equal(s.autoChosen,true);assert.equal(s.storyStage,'legacy');
 assert.equal(s.storyStarted,STORY_AUTO_CHOICE_AT);
 assert.equal(chooseFate(s,'host'),false);
});

test('small and large advances converge on the same narrative sequence and state',()=>{
 const a=createWorld(),b=createWorld();advanceTo(a,STORY_VISITOR_AT);advanceTo(b,STORY_VISITOR_AT);
 chooseFate(a,'host');chooseFate(b,'host');
 advanceWorld(a,1000);for(let i=0;i<100;i++)advanceWorld(b,10);
 assert.equal(a.storyStage,b.storyStage);assert.equal(a.renown,b.renown);
 const titles=(s:typeof a)=>s.journal.filter(e=>!e.title.startsWith('山谷的第')).map(e=>e.title);
 assert.deepEqual(titles(a),titles(b));
});

test('character movement matches story: boy absent on journey, returns grown, traveler at the inn',()=>{
 const s=createWorld();advanceTo(s,STORY_VISITOR_AT);
 const traveler=residentMotion(VILLAGERS[8],s);assert.equal(traveler.visible,true);
 chooseFate(s,'host');advanceWorld(s,22);
 const pupil=residentMotion(VILLAGERS[7],s);assert.equal(pupil.visible,true);
 advanceWorld(s,350);assert.equal(s.storyStage,'departed');assert.equal(residentMotion(VILLAGERS[7],s).visible,false);
 advanceWorld(s,650);assert.equal(s.storyStage,'legacy');
 // Set a daytime after returning to check visible daytime pose.
 s.minutes=Math.ceil(s.minutes/1440)*1440+9*60;
 assert.equal(residentMotion(VILLAGERS[7],s).visible,true);
});

test('new save key preserves v0.1 data and offline advance is bounded and idempotent',()=>{
 const memory=new Map<string,string>();const store={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
 memory.set('little-haven-prototype-v01','OLD VALLEY SAVE');
 const s=createWorld(1000);advanceTo(s,STORY_VISITOR_AT);chooseFate(s,'host');saveWorld(s,store,1000);
 const restored=loadWorld(store,501000);assert.ok(restored.minutes<=s.minutes+721);
 assert.equal(restored.choice,'host');assert.equal(restored.storyStage,'training');
 assert.equal(memory.get('little-haven-prototype-v01'),'OLD VALLEY SAVE');
 assert.ok(memory.has(STORAGE_KEY));
 const savedChronicle=restored.journal.length;saveWorld(restored,store,501000);
 const second=loadWorld(store,501000);assert.equal(second.journal.length,savedChronicle);
});

test('bad saves and invalid time deltas fail closed',()=>{
 const s=createWorld();advanceWorld(s,Number.NaN);advanceWorld(s,-5);assert.equal(s.minutes,500);
 assert.equal(loadWorld({getItem:()=>'{bad'},222).version,2);
 assert.equal(loadWorld({getItem:()=>JSON.stringify({...s,storyStage:'impossible'})},222).storyStage,'peace');
});
