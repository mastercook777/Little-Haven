import {DAY_MINUTES} from './calendar.ts';
import {pioneerBuildingPath,type WalkPoint} from './pioneerPaths.ts';
import {appendPioneerJournal} from './pioneerChronicle.ts';
import {reservedParcels} from './villagePlanning.ts';
import {pioneerFoodCapacity} from './pioneerLivelihood.ts';
import type {PioneerWorld} from './pioneerWorld.ts';

export type PioneerGuestPolicy='exchange'|'hospitality'|'quiet';
export const PIONEER_GUEST_POLICIES:{id:PioneerGuestPolicy;label:string;effect:string}[]=[
 {id:'exchange',label:'余物换物',effect:'有足够库存才用两份粮换三份木，或三份木换两份粮。来客不白送物资'},
 {id:'hospitality',label:'热茶待客',effect:'每次留客消耗 1.2 份粮和 0.5 份水，换来一段真实人情记录，不获得赠品'},
 {id:'quiet',label:'清静为先',effect:'商旅仍可经过，但村民不在茶棚交换和招待'}
];
export interface PioneerVisitor{
 id:string;serial:number;name:string;origin:string;occupation:string;
 arrivalAt:number;leaveAt:number;settledAt:number|null;
 outcome:'pending'|'exchange'|'hosted'|'passing';
 foodDelta:number;woodDelta:number;waterDelta:number;
 teaStopId:string;route:WalkPoint[];hostResidentId?:number|null;
}
export interface PioneerVisitHistory{
 id:string;name:string;origin:string;arrivedAt:number;leftAt:number;
 outcome:'exchange'|'hosted'|'passing';foodDelta:number;woodDelta:number;waterDelta:number;
 hostResidentId?:number|null;
}
export interface PioneerRoadContact{
 key:string;name:string;origin:string;hostResidentId:number;
 meetings:number;firstMetAt:number;lastMetAt:number;recentVisitorIds:string[];
}
export interface PioneerCommerce{
 guestPolicy:PioneerGuestPolicy;policySetAt:number;
 nextVisitorAt:number|null;activeVisitor:PioneerVisitor|null;visits:PioneerVisitHistory[];
 totalArrivals:number;totalExchanges:number;totalHosted:number;
 netFood:number;netWood:number;netWater:number;
 receptionHours:number;contacts:PioneerRoadContact[];
}
const round=(n:number)=>Math.round(n*1000)/1000;
const chance=(n:number)=>{
 let k=n>>>0;k=Math.imul(k^(k>>>16),0x85ebca6b);
 k=Math.imul(k^(k>>>13),0xc2b2ae35);return ((k^(k>>>16))>>>0)/4294967296;
};
const names=[
 ['贾二','江北山道','走乡货郎'],['明姑','西边驿路','寻亲旅人'],
 ['柳客','河口渡头','行脚药师'],['卫婆','南边田乡','挑担菜贩'],
 ['小杜','岭外旧路','赶路学徒'],['莫生','近山野径','探路说书人'],
 ['秦氏','东边村镇','替人送信'],['阿成','水边旧渡','补网匠']
] as const;
const trees=()=>reservedParcels(null).filter(p=>p.id.startsWith('pine-')||p.id.startsWith('bamboo-'));
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
const legalDeltas=(outcome:PioneerVisitor['outcome'],food:number,wood:number,water:number)=>{
 const near=(a:number,b:number)=>Math.abs(a-b)<.002;
 if(outcome==='pending'||outcome==='passing')return near(food,0)&&near(wood,0)&&near(water,0);
 if(outcome==='hosted')return near(food,-1.2)&&near(wood,0)&&near(water,-.5);
 return outcome==='exchange'&&near(water,0)&&
  ((near(food,-2)&&near(wood,3))||(near(food,2)&&near(wood,-3)));
};
const visitFields=(v:PioneerVisitor)=>{
 if(!v||typeof v.id!=='string'||!/^visitor-\d+-\d+$/.test(v.id)||
  !Number.isInteger(v.serial)||v.serial<1||!v.name||!v.origin||!v.occupation||
  !finite(v.arrivalAt)||!finite(v.leaveAt)||v.leaveAt!==v.arrivalAt+6*60||
  !finite(v.foodDelta)||!finite(v.woodDelta)||!finite(v.waterDelta)||
  !['pending','exchange','hosted','passing'].includes(v.outcome)||
  !(v.settledAt===null||finite(v.settledAt))||
  typeof v.teaStopId!=='string'||!Array.isArray(v.route)||
  v.route.length<2||v.route.length>200||
  !v.route.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite))||
  !(v.hostResidentId===undefined||v.hostResidentId===null||
    Number.isSafeInteger(v.hostResidentId)&&v.hostResidentId>=1))return false;
 if(v.outcome==='pending')
  return v.settledAt===null&&legalDeltas(v.outcome,v.foodDelta,v.woodDelta,v.waterDelta);
 return v.settledAt!==null&&v.settledAt>=v.arrivalAt&&v.settledAt<=v.leaveAt&&
  legalDeltas(v.outcome,v.foodDelta,v.woodDelta,v.waterDelta);
};
export function createPioneerCommerce():PioneerCommerce{
 return {guestPolicy:'exchange',policySetAt:0,nextVisitorAt:null,activeVisitor:null,
  visits:[],totalArrivals:0,totalExchanges:0,totalHosted:0,
  netFood:0,netWood:0,netWater:0,receptionHours:0,contacts:[]};
}
export function validPioneerCommerce(s:PioneerWorld){
 const c=s.commerce;
 if(!c||!['exchange','hospitality','quiet'].includes(c.guestPolicy)||
  !finite(c.policySetAt)||c.policySetAt<0||c.policySetAt>s.minutes||
  !(c.nextVisitorAt===null||finite(c.nextVisitorAt)&&c.nextVisitorAt>=0)||
  !Array.isArray(c.visits)||c.visits.length>12||
  !Array.isArray(c.contacts)||c.contacts.length>64||
  !Number.isSafeInteger(c.receptionHours)||c.receptionHours<0||
  ![c.totalArrivals,c.totalExchanges,c.totalHosted,c.netFood,c.netWood,c.netWater].every(finite)||
  ![c.totalArrivals,c.totalExchanges,c.totalHosted].every(n=>Number.isInteger(n)&&n>=0)||
  c.totalExchanges+c.totalHosted>c.totalArrivals||
  !c.visits.every(v=>v&&/^visitor-\d+-\d+$/.test(v.id)&&!!v.name&&!!v.origin&&
   finite(v.arrivedAt)&&finite(v.leftAt)&&v.leftAt>=v.arrivedAt&&
   v.leftAt<=s.minutes&&['exchange','hosted','passing'].includes(v.outcome)&&
   [v.foodDelta,v.woodDelta,v.waterDelta].every(finite)&&
   (v.hostResidentId===undefined||v.hostResidentId===null||
    Number.isSafeInteger(v.hostResidentId)&&
    s.founders.some(f=>f.id===v.hostResidentId))&&
   legalDeltas(v.outcome,v.foodDelta,v.woodDelta,v.waterDelta)))return false;
 // Every material inflow must be matched by a real outbound payment. A
 // forged save cannot mint wood/food by changing only the account totals.
 const exchangedWoodUnits=c.netWood/3;
 if(!Number.isInteger(exchangedWoodUnits)||Math.abs(exchangedWoodUnits)>c.totalExchanges||
  (c.totalExchanges+exchangedWoodUnits)%2!==0||
  Math.abs(c.netWater+.5*c.totalHosted)>.002||
  Math.abs(c.netFood+c.netWood*2/3+1.2*c.totalHosted)>.002||
  c.totalArrivals<c.visits.length+(c.activeVisitor?1:0)||
  c.totalExchanges<c.visits.filter(v=>v.outcome==='exchange').length||
  c.totalHosted<c.visits.filter(v=>v.outcome==='hosted').length)return false;
 const contactKeys=new Set<string>();
 let paidMeetings=0;
 for(const contact of c.contacts){
  const key=contact?.name+'|'+contact?.origin+'|'+contact?.hostResidentId;
  if(!contact||contact.key!==key||contactKeys.has(key)||
   !contact.name||!contact.origin||!s.founders.some(f=>f.id===contact.hostResidentId)||
   !Number.isSafeInteger(contact.meetings)||contact.meetings<1||
   !finite(contact.firstMetAt)||!finite(contact.lastMetAt)||
   contact.firstMetAt<0||contact.firstMetAt>contact.lastMetAt||
   contact.lastMetAt>s.minutes||!Array.isArray(contact.recentVisitorIds)||
   contact.recentVisitorIds.length<1||contact.recentVisitorIds.length>6||
   contact.meetings<contact.recentVisitorIds.length||
   new Set(contact.recentVisitorIds).size!==contact.recentVisitorIds.length||
   !contact.recentVisitorIds.every(id=>/^visitor-\d+-\d+$/.test(id)))return false;
  paidMeetings+=contact.meetings;contactKeys.add(key);
 }
 if(paidMeetings>c.totalExchanges+c.totalHosted||
  c.receptionHours<paidMeetings)return false;
 const hut=s.buildings.find(b=>b.kind==='tea-stop');
 if(c.activeVisitor){
  const v=c.activeVisitor;
  if(!hut||!visitFields(v)||v.teaStopId!==hut.id||v.arrivalAt>s.minutes||
   v.id!=='visitor-'+(s.seed>>>0)+'-'+v.serial||
   c.totalArrivals<v.serial||c.visits.some(h=>h.id===v.id)||
   (v.hostResidentId!==undefined&&v.hostResidentId!==null&&
    !s.founders.some(f=>f.id===v.hostResidentId)))return false;
 }else if(c.totalArrivals===0&&c.visits.length>0)return false;
 if(!hut&&(c.activeVisitor!==null||c.totalArrivals!==0||c.visits.length>0||
  c.nextVisitorAt!==null))return false;
 if(new Set(c.visits.map(v=>v.id)).size!==c.visits.length)return false;
 if(c.activeVisitor&&c.activeVisitor.outcome==='pending'&&
  (c.activeVisitor.foodDelta!==0||c.activeVisitor.woodDelta!==0))return false;
 return true;
}
export function setPioneerGuestPolicy(s:PioneerWorld,policy:PioneerGuestPolicy){
 if(s.commerce.guestPolicy===policy||!PIONEER_GUEST_POLICIES.some(p=>p.id===policy)||
  !s.buildings.some(b=>b.kind==='tea-stop'))return false;
 s.commerce.guestPolicy=policy;s.commerce.policySetAt=s.minutes;
 const desc=PIONEER_GUEST_POLICIES.find(p=>p.id===policy)!;
 appendPioneerJournal(s,'村民商议待客之道',desc.label+'：'+desc.effect,'pioneer-commons');
 return true;
}
export function onPioneerTeaStopBuilt(s:PioneerWorld){
 if(s.commerce.nextVisitorAt!==null)return;
 s.commerce.nextVisitorAt=s.minutes+3*DAY_MINUTES;
}
export function pioneerVisitorPosition(v:PioneerVisitor,minutes:number):WalkPoint{
 // Only interpolated visual movement; the economic transaction is never
 // performed in a render frame. Path itself is the A*-verified village road.
 const t=Math.max(0,minutes-v.arrivalAt);
 const f=t<120?t/120:t<240?1:1-(t-240)/120;
 // Avoid importing Three.js into simulation. Interpolate the saved path in
 // distance order and reverse it when this same actual person walks away.
 const points=v.route;
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const total=lengths.reduce((a,b)=>a+b,0);
 let remain=Math.max(0,Math.min(1,f))*total;
 for(let i=0;i<lengths.length;i++){
  if(remain>lengths[i]){remain-=lengths[i];continue;}
  const w=lengths[i]?remain/lengths[i]:1;
  return [points[i][0]+(points[i+1][0]-points[i][0])*w,
   points[i][1]+(points[i+1][1]-points[i][1])*w];
 }
 return points.at(-1)!;
}
function arrive(s:PioneerWorld,teaStopId:string,route:WalkPoint[]){
 const c=s.commerce,serial=c.totalArrivals+1;
 const data=names[Math.floor(chance(s.seed+serial*9187)*names.length)];
 const visitor:PioneerVisitor={
  id:'visitor-'+(s.seed>>>0)+'-'+serial,serial,name:data[0],origin:data[1],
  occupation:data[2],arrivalAt:s.minutes,leaveAt:s.minutes+6*60,
  settledAt:null,outcome:'pending',foodDelta:0,woodDelta:0,waterDelta:0,
  hostResidentId:null,teaStopId,route:route.map(p=>[round(p[0]),round(p[1])])
 };
 c.activeVisitor=visitor;c.totalArrivals=serial;
 appendPioneerJournal(s,'山路上有客',visitor.name+'自述来自'+visitor.origin+
  '，做'+visitor.occupation+'，沿有路的山道走到茶棚。来客并不算谷中常住人口。',visitor.id);
}
function transact(s:PioneerWorld,v:PioneerVisitor,hostResidentId:number|null){
 if(v.outcome!=='pending')return;
 const c=s.commerce,policy=c.guestPolicy;let description='';
 v.hostResidentId=hostResidentId;
 if(policy==='hospitality'&&s.resources.food>=1.2&&s.resources.water>=.5){
  s.resources.food=round(s.resources.food-1.2);
  s.resources.water=round(s.resources.water-.5);
  v.foodDelta=-1.2;v.waterDelta=-.5;v.outcome='hosted';c.totalHosted++;
  description='乡邻从真实粮水里取出 1.2 份口粮与 0.5 份水招待'+v.name+
   '。这是一笔花销和真实来往，不免费产生物资。';
 }else if(policy==='exchange'){
  if(s.resources.food>=s.founders.length*2.4+2&&s.resources.wood<=45){
   s.resources.food=round(s.resources.food-2);s.resources.wood=round(s.resources.wood+3);
   v.foodDelta=-2;v.woodDelta=3;v.outcome='exchange';c.totalExchanges++;
   description=v.name+'从外路带来三份木料，换走两份谷中实粮，双方都付出各自的货物。';
  }else if(s.resources.wood>=10&&
   s.resources.food<=s.founders.length*1.6&&pioneerFoodCapacity(s)-s.resources.food>=2){
   s.resources.wood=round(s.resources.wood-3);s.resources.food=round(s.resources.food+2);
   v.foodDelta=2;v.woodDelta=-3;v.outcome='exchange';c.totalExchanges++;
   description=v.name+'用两份外来口粮换走谷中三份实木；不是无代价的粮食奖励。';
  }
 }
 if(v.outcome==='pending'){
  v.outcome='passing';
  description=policy==='quiet'?'村民选择清静，不在茶棚做买卖或招待，'+v.name+'只在山路稍歇。':
   '现有粮水和货物不足，'+v.name+'在茶棚短暂停步，没有虚构交换或招待。';
 }
 v.settledAt=s.minutes;
 if(hostResidentId!==null){
  const host=s.founders.find(f=>f.id===hostResidentId)!;
  c.receptionHours++;
  if(v.outcome==='exchange'||v.outcome==='hosted'){
   const key=v.name+'|'+v.origin+'|'+host.id;
   let contact=c.contacts.find(x=>x.key===key);
   if(!contact){
    if(c.contacts.length>=64)
     c.contacts.sort((a,b)=>a.lastMetAt-b.lastMetAt).shift();
    contact={key,name:v.name,origin:v.origin,hostResidentId:host.id,
     meetings:0,firstMetAt:s.minutes,lastMetAt:s.minutes,recentVisitorIds:[]};
    c.contacts.push(contact);
   }
   contact.meetings++;contact.lastMetAt=s.minutes;
   contact.recentVisitorIds.push(v.id);
   if(contact.recentVisitorIds.length>6)contact.recentVisitorIds.shift();
   if(contact.meetings===2)
    appendPioneerJournal(s,'山路上认出了故人',
     host.name+'第二次在茶棚与'+v.name+'（'+v.origin+'）完成真实往来。'+
     '山路上开始有人认识这处茶棚；来客能更快找到路，但待客仍占劳动。',
     v.id);
  }
 }
 c.netFood=round(c.netFood+v.foodDelta);
 c.netWood=round(c.netWood+v.woodDelta);
 c.netWater=round(c.netWater+v.waterDelta);
 appendPioneerJournal(s,v.outcome==='exchange'?(c.totalExchanges===1?'山谷第一次交换了货物':'茶棚又有真实换物'):
  v.outcome==='hosted'?'茶棚里有一杯热茶':'过客未曾留下交易',
  description,v.id);
}
function leave(s:PioneerWorld,v:PioneerVisitor){
 const c=s.commerce;
 c.visits.push({id:v.id,name:v.name,origin:v.origin,hostResidentId:v.hostResidentId,
  arrivedAt:v.arrivalAt,leftAt:s.minutes,
  outcome:v.outcome==='pending'?'passing':v.outcome,
  foodDelta:v.foodDelta,woodDelta:v.woodDelta,waterDelta:v.waterDelta});
 if(c.visits.length>12)c.visits.shift();
 c.activeVisitor=null;
 // An actual repeated host/guest relationship makes the route familiar.
 // Quiet villages do not receive the saved-route frequency benefit.
 const familiar=c.guestPolicy!=='quiet'&&c.contacts.some(x=>x.meetings>=2);
 c.nextVisitorAt=s.minutes+((familiar?10:12)+
  Math.floor(chance(s.seed+v.serial*371)*5))*DAY_MINUTES;
 // Only a few meaningful farewells enter the short journal. Every arrival
 // and exact exchange survives in the bounded visit register and totals.
 if(v.serial<=2||v.serial%6===0)
  appendPioneerJournal(s,'山路客去',v.name+'沿真乡路离开茶棚。'+
   (v.outcome==='exchange'?'此番货物已入村里台账。':
    v.outcome==='hosted'?'乡邻付出热茶招待。':'没有发生货物交换。'),v.id);
}
/** Settles this exact visitor once after a real resident reaches the
 * tea stop during an exclusive afternoon job. No ghost transactions. */
export function performPioneerGuestShift(s:PioneerWorld,residentId:number){
 const v=s.commerce.activeVisitor;
 if(!v||v.outcome!=='pending'||s.commerce.guestPolicy==='quiet'||
  s.minutes<v.arrivalAt+3*60||s.minutes>=v.leaveAt||
  !s.founders.some(f=>f.id===residentId&&f.activity==='host-guest'))return false;
 transact(s,v,residentId);
 return true;
}
export function pioneerFamiliarRoadDays(s:PioneerWorld){
 return s.commerce.guestPolicy!=='quiet'&&
  s.commerce.contacts.some(c=>c.meetings>=2)?2:0;
}
export function pioneerResidentContacts(s:PioneerWorld,residentId:number){
 return s.commerce.contacts.filter(c=>c.hostResidentId===residentId)
  .sort((a,b)=>b.lastMetAt-a.lastMetAt).slice(0,5);
}
/** One called per authoritative simulation hour; invisible world ticks
 * still advance visits, and a visitor can never transact twice. */
export function advancePioneerCommerce(s:PioneerWorld){
 const c=s.commerce;
 if(c.activeVisitor){
  const v=c.activeVisitor;
  // Trades cannot settle until a resident actually arrives and spends a
  // separate shift, except quiet passing (which spends no guest supplies).
  if(v.outcome==='pending'&&c.guestPolicy==='quiet'&&
   s.minutes>=v.arrivalAt+3*60)transact(s,v,null);
  if(s.minutes>=v.leaveAt)leave(s,v);
  return;
 }
 const hut=s.buildings.find(b=>b.kind==='tea-stop');
 if(!hut)return;
 if(c.nextVisitorAt===null)onPioneerTeaStopBuilt(s);
 if(c.nextVisitorAt===null||s.minutes<c.nextVisitorAt)return;
 const hour=Math.floor(s.minutes%DAY_MINUTES/60);
 if(hour!==10)return;
 const road=s.roads.find(r=>r.buildingId===hut.id);
 if(!road||road.points.length<2){
  c.nextVisitorAt=s.minutes+3*DAY_MINUTES;
  return;
 }
 // A past built path cannot become a magical teleport when new houses grow.
 const path=pioneerBuildingPath(s.camp,hut.parcel,
  [...trees(),...s.buildings.map(b=>b.parcel)]);
 if(!path){c.nextVisitorAt=s.minutes+3*DAY_MINUTES;return;}
 arrive(s,hut.id,path);
}
