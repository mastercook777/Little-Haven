import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWorld,chooseProject,createWorld,getClock,getDay,getDaylight,loadWorld,projectProgress,residentMotion,saveWorld,STORAGE_KEY,VILLAGERS} from '../src/simulation/world.ts';

test('initial state is a playable eight-person valley',()=>{
 const s=createWorld(1000);
 assert.equal(s.population,8);assert.equal(s.houses,6);assert.equal(s.projectState,'waiting');
 assert.equal(getDay(s),1);assert.equal(getClock(s).text,'08:20');
 assert.ok(getDaylight(s)>.8);assert.equal(VILLAGERS.length,10);
});
test('the chosen bridge advances over simulation time and changes population',()=>{
 const s=createWorld();assert.equal(chooseProject(s,'bridge'),true);
 assert.equal(chooseProject(s,'garden'),false);
 advanceWorld(s,20);assert.ok(projectProgress(s)>0 && projectProgress(s)<1);
 const event=advanceWorld(s,30);
 assert.equal(event.completed,true);assert.equal(s.projectState,'complete');
 assert.equal(s.population,10);assert.equal(projectProgress(s),1);
 assert.ok(s.journal.some(e=>e.title.includes('竣工')));
});
test('garden is a different permanent choice',()=>{
 const s=createWorld();chooseProject(s,'garden');advanceWorld(s,50);
 assert.equal(s.decision,'garden');assert.equal(s.projectState,'complete');assert.equal(s.happiness,89);
 assert.ok(s.journal.some(e=>e.title.includes('花园终于开放')));
});
test('resident daily schedule moves through living landmarks',()=>{
 const s=createWorld();const a=residentMotion(VILLAGERS[0],s);
 advanceWorld(s,37);const b=residentMotion(VILLAGERS[0],s);
 assert.notDeepEqual([a.x,a.z],[b.x,b.z]);
});
test('save/load offline progress remains bounded',()=>{
 const store=new Map<string,string>();const memory={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
 const s=createWorld(1_000);chooseProject(s,'bridge');saveWorld(s,memory,1_000);
 const resumed=loadWorld(memory,500_000);
 assert.ok(resumed.minutes<=s.minutes+721);
 assert.equal(resumed.projectState,'complete');assert.equal(resumed.population,10);
 assert.ok(store.has(STORAGE_KEY));
});
test('invalid saves fail safely and time advance rejects bad delta',()=>{
 const s=createWorld();advanceWorld(s,Number.NaN);advanceWorld(s,-100);
 assert.equal(s.minutes,500);
 const broken=loadWorld({getItem:()=>'{bad'},222);
 assert.equal(broken.minutes,500);
});

test('new residents cross at the actual bridge route',()=>{
 const s=createWorld();chooseProject(s,'bridge');advanceWorld(s,50);
 // The newcomer travels from the west side toward work across the east bank.
 s.minutes=410;
 const route=residentMotion(VILLAGERS[8],s);
 assert.ok(route.x>6.2 && route.x<10.0);
 assert.ok(Math.abs(route.z)<.1);
 assert.equal(s.decision,'bridge');
});
