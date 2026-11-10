import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MINUTES} from '../src/simulation/calendar.ts';
import {createPioneerWorld,advancePioneerWorld,importPioneerWorld} from '../src/simulation/pioneerWorld.ts';
import {setPioneerGuestPolicy,pioneerVisitorPosition,validPioneerCommerce,
 PIONEER_GUEST_POLICIES} from '../src/simulation/pioneerCommerce.ts';
import {pioneerMilestoneBoard,setPioneerDirection} from '../src/simulation/pioneerLivelihood.ts';
import {surveyPioneerPlot} from '../src/simulation/pioneerGrowth.ts';
import {inspectPioneerSelection} from '../src/ui/pioneerInspection.ts';
import {pioneerEntrance,findPioneerWalk,roadSegmentsSafe,pioneerWalkable,type WalkPoint} from '../src/simulation/pioneerPaths.ts';
import {pioneerNaturalParcels} from '../src/simulation/pioneerNaturalAnchors.ts';

const round=(v:number)=>Math.round(v*1000)/1000;
const days=(s:ReturnType<typeof createPioneerWorld>,d:number)=>
 advancePioneerWorld(s,(d*DAY_MINUTES-s.minutes)/3);
const matured=()=>{const s=createPioneerWorld(42,1000);days(s,48*5);return s;};
function diagnoseTeaCommutes(s:ReturnType<typeof createPioneerWorld>){
 const tea=s.buildings.find(b=>b.kind==='tea-stop');
 if(!tea)return {teaMissing:true};
 const to=pioneerEntrance(tea.parcel);
 const teaRoad=s.roads.find(r=>r.buildingId===tea.id);
 return {tea:tea.parcel.id,teaRoad:teaRoad?.points.length??0,
  routes:s.founders.map(f=>{
   const home=s.buildings.find(b=>b.id===f.homeBuildingId);
   const from:WalkPoint=home?pioneerEntrance(home.parcel):[s.camp.x,s.camp.z];
   const blockers=[...pioneerNaturalParcels(s),...s.buildings.map(b=>b.parcel)]
    .filter(p=>p.id!==home?.id);
   const homeRoad=s.roads.find(r=>r.buildingId===home?.id);
   const via=homeRoad&&teaRoad?[...homeRoad.points.slice().reverse(),...teaRoad.points.slice(1)]:[];
   return {id:f.id,home:home?.kind,from,to,fromOk:pioneerWalkable(from,blockers),
    toOk:pioneerWalkable(to,blockers),direct:!!findPioneerWalk(from,to,blockers),
    via:via.length>1&&roadSegmentsSafe(via,blockers),
    homeRoad:homeRoad?.points.length??0};
  })};
}

test('v0.5.1: founder camp has no ghost tea stall, visitors, exchange or permanent strangers',()=>{
 const s=createPioneerWorld(42,1000);
 assert.equal(s.commerce.totalArrivals,0);
 assert.equal(s.commerce.activeVisitor,null);
 assert.equal(s.buildings.length,0);
 assert.equal(s.founders.length,3);
 assert.equal(setPioneerGuestPolicy(s,'hospitality'),false);
 assert.equal(setPioneerDirection(s,'road'),false);
 assert.equal(validPioneerCommerce(s),true);
 assert.equal(pioneerMilestoneBoard(s).find(x=>x.id==='tea')?.done,false);
});
test('v0.5.1: 5 years create real tea shed and bounded distinct visitors, not phantom settlers',()=>{
 const s=matured(),tea=s.buildings.find(b=>b.kind==='tea-stop'),c=s.commerce;
 assert.ok(tea,'year-five autonomous village must have genuinely built a tea stop: '+
  JSON.stringify({built:s.buildings.map(b=>b.kind),stage:s.commons.stage,
   people:s.founders.length,wood:s.resources.wood,roads:s.roads.length,
   intent:s.intent?.kind,journal:s.journal.slice(-4),
   survey:(()=>{
    const metrics={candidateParcels:0,legalGeometry:0,openedLand:0,routeReached:0,
     resourceRoutesKept:0};
    const parcel=surveyPioneerPlot(s,'tea-stop',metrics)?.parcel??null;
    const futureMetrics={candidateParcels:0,legalGeometry:0,openedLand:0,
     routeReached:0,resourceRoutesKept:0};
    const future=surveyPioneerPlot(s,'tea-stop',futureMetrics,true);
    return {parcel,metrics,future:future?.parcel??null,futureMetrics,
     clearings:s.frontier.clearings};
   })(),
   nextSurveyAt:s.nextSurveyAt,latestSurveys:s.journal.filter(e=>e.title==='勘地暂缓').slice(-4),
   elapsed:s.minutes,route:s.commerce.nextVisitorAt}));
 assert.ok(tea!.materialsSpent.wood>=9&&tea!.workHours>=12);
 assert.ok(s.roads.some(r=>r.buildingId===tea!.id&&r.points.length>=2));
 assert.ok(c.totalArrivals>=2,'tea must actually receive named finite-time travelers');
 assert.ok(c.totalExchanges>=1,'a resource-backed exchange must be paid by both parties: '+
  JSON.stringify({food:s.resources.food,wood:s.resources.wood,water:s.resources.water,
   population:s.founders.length,visits:c.visits.slice(-3),arrivals:c.totalArrivals,
   receptions:c.receptionHours,guest:c.activeVisitor,
   commuteDiagnostics:diagnoseTeaCommutes(s),
   tea:tea?.parcel,homes:s.founders.slice(3).map(f=>({
    id:f.id,activity:f.activity,home:f.homeBuildingId,commute:f.commute?.length
   }))}));
 assert.equal(s.founders.length,12,'passing guests cannot silently enlarge resident population');
 assert.ok(c.visits.length<=12&&c.visits.length>0);
 assert.equal(new Set(c.visits.map(v=>v.id)).size,c.visits.length);
 assert.ok(c.visits.every(v=>v.leftAt>v.arrivedAt&&v.outcome!=='pending'));
 assert.equal(validPioneerCommerce(s),true);
 const ledger=inspectPioneerSelection(s,{kind:'building',id:tea!.id});
 assert.ok(ledger?.facts.some(f=>f.label==='路上来往'&&f.value.includes('未计入常住人口')));
 assert.ok(ledger?.history.some(h=>h.includes('来访')));
 assert.equal(pioneerMilestoneBoard(s).find(x=>x.id==='tea')?.done,true);
 assert.ok(importPioneerWorld(JSON.stringify(s)),'legitimate 5-year visitors roundtrip');
});
test('v0.5.1: any paid visitor ledger survives save import without a second payment',()=>{
 const s=matured(),c=s.commerce;
 const replay=importPioneerWorld(JSON.stringify(s));
 assert.ok(replay);
 assert.equal(replay!.commerce.totalArrivals,c.totalArrivals);
 assert.equal(replay!.commerce.totalExchanges,c.totalExchanges);
 assert.equal(replay!.commerce.netWood,c.netWood);
 assert.deepEqual(replay!.commerce.visits,c.visits);
 const forgedTotal=structuredClone(s);
 forgedTotal.commerce.netFood+=2;
 assert.equal(importPioneerWorld(JSON.stringify(forgedTotal)),null,
  'a visit ledger cannot mint inventory without its reciprocal payment');
 const forgedHistory=structuredClone(s);
 const exchange=forgedHistory.commerce.visits.find(v=>v.outcome==='exchange');
 assert.ok(exchange);
 exchange!.woodDelta=0;
 assert.equal(importPioneerWorld(JSON.stringify(forgedHistory)),null,
  'an observed paid exchange must keep its actual per-visit materials');
 // Advancing less than an hour cannot materialize an additional arrival or exchange.
 const pre=replay!.commerce.totalExchanges,old=replay!.resources.food,wood=replay!.resources.wood;
 advancePioneerWorld(replay!,.08);
 assert.equal(replay!.commerce.totalExchanges,pre);
 assert.equal(replay!.resources.food,old);
 assert.equal(replay!.resources.wood,wood);
});
test('v0.5.1: previous v4 save migrates to no fabricated visitors, but rejects partial corruption',()=>{
 const original=createPioneerWorld(21,1000);days(original,40);
 const legacy=structuredClone(original) as unknown as Record<string,unknown>;
 delete legacy.commerce;
 const restored=importPioneerWorld(JSON.stringify(legacy));
 assert.ok(restored);
 assert.equal(restored!.commerce.totalArrivals,0);
 assert.equal(restored!.commerce.nextVisitorAt,null);
 assert.equal(restored!.founders.length,original.founders.length);
 const broken=structuredClone(original) as unknown as Record<string,unknown>;
 broken.commerce={guestPolicy:'exchange',totalArrivals:500};
 assert.equal(importPioneerWorld(JSON.stringify(broken)),null);
 const forged=structuredClone(original);
 forged.commerce.totalArrivals=1;
 assert.equal(importPioneerWorld(JSON.stringify(forged)),null,
  'people cannot appear before a tea shed is paid for');
});
test('v0.5.1: hospitality and quietness are actual inventory differences, not flavor text',()=>{
 const s=matured();assert.ok(s.buildings.some(b=>b.kind==='tea-stop'));
 const visitor=s.commerce.activeVisitor;
 // A new visitor always arrives within 16 days, including the next shift.
 let turns=0;
 while(!s.commerce.activeVisitor&&turns++<24*22)
  advancePioneerWorld(s,60/3);
 assert.ok(s.commerce.activeVisitor,'a real walkable road should produce a guest');
 const incoming=s.commerce.activeVisitor!;
 assert.equal(incoming.outcome,'pending');
 assert.ok(incoming.route.length>=2);
 const pos=pioneerVisitorPosition(incoming,incoming.arrivalAt+120);
 assert.ok(Number.isFinite(pos[0])&&Number.isFinite(pos[1]));
 const hosp=structuredClone(s),quiet=structuredClone(s);
 assert.equal(setPioneerGuestPolicy(hosp,'hospitality'),true);
 assert.equal(setPioneerGuestPolicy(quiet,'quiet'),true);
 const food=hosp.resources.food,water=hosp.resources.water;
 advancePioneerWorld(hosp,60);advancePioneerWorld(quiet,60);
 assert.equal(hosp.commerce.activeVisitor?.outcome,'hosted');
 assert.equal(quiet.commerce.activeVisitor?.outcome,'passing');
 assert.equal(hosp.commerce.activeVisitor?.foodDelta,-1.2);
 assert.equal(hosp.commerce.activeVisitor?.waterDelta,-.5);
 assert.equal(quiet.commerce.activeVisitor?.foodDelta,0);
 // Both villages still consume hourly water from the same real residents;
 // only the hosted transaction additionally subtracts precisely 0.5 water.
 assert.equal(round(quiet.resources.water-hosp.resources.water),.5);
 assert.equal(hosp.commerce.totalHosted,quiet.commerce.totalHosted+1);
 assert.ok(hosp.resources.food<quiet.resources.food);
 assert.ok(importPioneerWorld(JSON.stringify(hosp)));
 assert.ok(importPioneerWorld(JSON.stringify(quiet)));
});
