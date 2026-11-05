import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {performPioneerGuestShift,pioneerFamiliarRoadDays,pioneerResidentContacts,
 validPioneerCommerce} from '../src/simulation/pioneerCommerce.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';
import {pioneerMilestoneBoard} from '../src/simulation/pioneerLivelihood.ts';

function grown(years=5){
 const s=createPioneerWorld(42,1000);
 advancePioneerWorld(s,(years*48*DAY_MINUTES-s.minutes)/3);
 return s;
}
test('v0.5.2: actual host must spend separate reachable tea shift; no invisible free exchange',()=>{
 const s=grown(5);
 assert.ok(s.commerce.totalExchanges>0);
 assert.ok(s.commerce.receptionHours>=s.commerce.totalExchanges+s.commerce.totalHosted,
  'every paid visit needs a resident hour; actual hours '+s.commerce.receptionHours);
 assert.ok(s.commerce.visits.some(v=>v.outcome==='exchange'&&
  Number.isInteger(v.hostResidentId)&&s.founders.some(f=>f.id===v.hostResidentId)));
 assert.ok(validPioneerCommerce(s));
 assert.ok(importPioneerWorld(JSON.stringify(s)));
});
test('v0.5.2: same resident and guest eventually recognize their real repeated meetings',()=>{
 const s=grown(6);
 const known=s.commerce.contacts.find(c=>c.meetings>=2);
 assert.ok(known,JSON.stringify({contacts:s.commerce.contacts,
  arrivals:s.commerce.totalArrivals,workers:s.commerce.receptionHours}));
 const host=s.founders.find(f=>f.id===known!.hostResidentId)!;
 assert.ok(host);
 assert.equal(pioneerFamiliarRoadDays(s),2,'real repeated paid meetings shorten route wait');
 assert.ok(pioneerResidentContacts(s,host.id).some(c=>c.key===known!.key));
 const card=inspectPioneerSelection(s,{kind:'person',id:String(host.id)});
 assert.ok(card?.facts.some(x=>x.label==='山路故人'&&x.value.includes(known!.name)));
 assert.equal(pioneerMilestoneBoard(s).find(x=>x.id==='familiar')?.done,true);
 assert.ok(s.journal.some(x=>x.title==='山路上认出了故人'),'specific resident fate must enter saved village record');
 assert.ok(importPioneerWorld(JSON.stringify(s)));
 const last=s.commerce.visits.at(-1);
 if(!s.commerce.activeVisitor&&last&&s.commerce.nextVisitorAt!==null)
  assert.ok(s.commerce.nextVisitorAt-last.leftAt<=14*DAY_MINUTES,
   'earned known road makes the next visit 10 to 14 days away');
});
test('v0.5.2: old v0.5.1 commerce imports anonymously with no fabricated acquaintance',()=>{
 const s=grown(5);
 const old=structuredClone(s) as any;
 delete old.commerce.contacts;delete old.commerce.receptionHours;
 for(const v of old.commerce.visits)delete v.hostResidentId;
 if(old.commerce.activeVisitor)delete old.commerce.activeVisitor.hostResidentId;
 const legacy=importPioneerWorld(JSON.stringify(old));
 assert.ok(legacy);
 assert.deepEqual(legacy!.commerce.contacts,[]);
 assert.equal(legacy!.commerce.receptionHours,0);
 assert.equal(legacy!.commerce.totalExchanges,s.commerce.totalExchanges);
 assert.equal(legacy!.founders.length,s.founders.length);
 assert.ok(importPioneerWorld(JSON.stringify(legacy)));
 const partial=structuredClone(s) as any;
 delete partial.commerce.receptionHours;
 assert.equal(importPioneerWorld(JSON.stringify(partial)),null,'partly broken commerce must be rejected');
});
test('v0.5.2: no-shift/replayed visitor cannot settle an extra goods transaction',()=>{
 const s=grown(5);
 for(let i=0;!s.commerce.activeVisitor&&i<24*22;i++)advancePioneerWorld(s,60/3);
 const v=s.commerce.activeVisitor;
 assert.ok(v);
 const wood=s.resources.wood,food=s.resources.food,ex=s.commerce.totalExchanges;
 assert.equal(performPioneerGuestShift(s,s.founders[3].id),false,
  'cannot transact without actually reaching tea hut and doing reception shift');
 assert.equal(s.resources.wood,wood);assert.equal(s.resources.food,food);
 assert.equal(s.commerce.totalExchanges,ex);
 const c=s.commerce;
 const counterfeit=structuredClone(s);
 counterfeit.commerce.contacts=[{key:'bad',name:'假客',origin:'无',hostResidentId:999,
  meetings:30,firstMetAt:0,lastMetAt:s.minutes,recentVisitorIds:['visitor-42-1']}];
 assert.equal(importPioneerWorld(JSON.stringify(counterfeit)),null);
 assert.equal(validPioneerCommerce(s),true);
});
