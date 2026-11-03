/** Deterministic role-specific routes. Paths reuse the physical lanes in village.ts. */
import type {Villager} from './world.ts';
import type {Weather} from './weather.ts';
export type ActivityId='sleep'|'idle'|'walk'|'work'|'sweep'|'carry'|'serve'|'gather'|'weave'|'fish'|'train'|'greet'|'rest'|'shelter';
export type Point=readonly [number,number];
export interface LifeMotion{x:number;z:number;heading:number;walking:boolean;activity:string;activityId:ActivityId;interactionTargetId:string|null}
type RolePlan={route:Point[];job:ActivityId;description:string;local:Point;errand:ActivityId;errandText:string;target:string};
const rolePlan=(v:Villager,day:number):RolePlan=>{
 const home=v.home,work=v.work;
 switch(v.id){
  case 1:return {route:[home,[-9,-3.9],[-10.4,-2.6],work],job:'carry',description:'在林缘伐木',local:day%3===0?[-8.7,-5.2]:[-11.3,-2.7],errand:'carry',errandText:'沿林边搬运柴薪',target:'home-001'};
  case 2:return {route:[home,[-5.3,-4],[-4.4,-.3],[-4,2.7],work],job:'serve',description:'在酒肆招呼客人',local:day%3===0?[-5.6,3.6]:[-4.2,3.7],errand:'sweep',errandText:'清扫侧廊，擦拭酒盏',target:'inn-001'};
  case 3:return {route:[home,[-10.2,5.1],work],job:'gather',description:'在茶垄采摘嫩叶',local:day%2===0?[-10.5,5.8]:[-10.3,4.6],errand:'gather',errandText:'整理茶筐，修剪枝叶',target:'tea-patch'};
  case 4:return {route:[home,[-9,-3.9],[-8.8,-.8],[-9.2,1.1],[-10.7,5.8],work],job:'gather',description:'在药圃采集草药',local:day%2===0?[-11.4,5.5]:[-9.4,4.7],errand:'gather',errandText:'把草药铺到竹匾上',target:'herbs'};
  case 5:return {route:[home,[1,-2],[3,1.3],work],job:'greet',description:'沿路与乡邻交换货物',local:day%3===0?[6.4,2.2]:day%3===1?[4.0,4.4]:[2.4,.5],errand:'greet',errandText:'推着货担沿山路兜售',target:'road'};
  case 6:{
   const near=day%3!==0;
   return {route:near?[home,[3.0,-6.2]]:[home,[1,-2],[-2,2.8],[-4.4,-.3],[-5.3,-4],work],
    job:'weave',description:'纺线织布，整理衣料',local:near?[2.7,-5.5]:[-9.0,-5.9],errand:'weave',errandText:'在小院里晾晒冬衣',target:'laundry'};
  }
  case 7:return {route:[home,[3.7,5.7],[4.6,3.2],[6,2.2],work],job:'fish',description:'在河畔静静垂钓',local:day%2===0?[6.6,-3.1]:[6.9,.4],errand:'fish',errandText:'查看河岸边的鱼篓',target:'river'};
  case 8:return {route:[home,[-9,-3.9],[-6,-2.7],[-4,2.7],[-.2,4.5],work],job:'train',description:'在练武坪练剑',local:day%2===0?[1.4,6.4]:[3.7,8.2],errand:'train',errandText:'在竹荫中练习步法',target:'yard-001'};
  default:return {route:[home,[-2,2.8],[-.2,4.5],work],job:'train',description:'在剑庐里练习基本功',local:[3.8,8.6],errand:'train',errandText:'擦拭剑架',target:'yard-001'};
 }
};
export function dailyHash(id:number,day:number,salt=0){
 let n=(Math.imul(id+19,2654435761)^Math.imul(day+3,2246822519)^Math.imul(salt+7,3266489917))>>>0;
 n=Math.imul(n^(n>>>16),2246822507);
 return ((n^(n>>>13))>>>0)/4294967296;
}
export function alongLane(route:readonly Point[],progress:number){
 if(route.length<2){const p=route[0]||[0,0];return {x:p[0],z:p[1],heading:0};}
 let total=0;const length:number[]=[];
 for(let i=1;i<route.length;i++){const d=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);length.push(d);total+=d;}
 let left=Math.max(0,Math.min(1,progress))*total;
 for(let i=1;i<route.length;i++){const d=length[i-1];
  if(left<=d||i===route.length-1){const a=route[i-1],b=route[i],t=d?Math.min(1,left/d):0;
   return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,heading:Math.atan2(b[0]-a[0],b[1]-a[1])};}
  left-=d;
 }
 return {x:route[0][0],z:route[0][1],heading:0};
}
export function dailyResidentMotion(v:Villager,minutes:number,weather:Weather):LifeMotion{
 const day=Math.floor(minutes/1440),hour=(minutes%1440)/60;
 const plan=rolePlan(v,day),home=v.home,work=plan.route.at(-1)!;
 const stagger=(v.offset%137)/190+dailyHash(v.id,day,5)*.38;
 const depart=7+stagger,arrive=8.2+stagger;
 const errandStart=11.5+dailyHash(v.id,day,4)*.65;
 const back=13.7+dailyHash(v.id,day,6)*.5;
 const leave=17.2+stagger*.35+dailyHash(v.id,day,7)*.5;
 const localRain=weather==='rain'&&v.id!==2&&dailyHash(v.id,day,8)>.43;
 const local=localRain?work:plan.local;
 const walking=(route:Point[],start:number,end:number,label:string):LifeMotion=>{
  const at=alongLane(route,(hour-start)/(end-start));
  return {...at,walking:route.length>1&&Math.hypot(route.at(-1)![0]-route[0][0],route.at(-1)![1]-route[0][1])>.10,
   activity:label,activityId:'walk',interactionTargetId:null};
 };
 const still=(point:Point,id:ActivityId,label:string,target:string|null):LifeMotion=>
  ({x:point[0],z:point[1],heading:((v.id*7)%9)*.42,walking:false,activity:label,activityId:id,interactionTargetId:target});
 if(hour<depart||hour>leave+1.3)return still(home,hour<5||hour>21?'sleep':'idle','在家收拾一天的物件',null);
 if(hour<arrive)return walking(plan.route,depart,arrive,'沿山路前往工作地点');
 if(hour<errandStart)return still(work,plan.job,plan.description,plan.target);
 if(hour<errandStart+.45)return walking([work,local],errandStart,errandStart+.45,'去做午间杂事');
 if(hour<back)return still(local,localRain?'shelter':plan.errand,localRain?'在熟悉的廊檐躲雨':plan.errandText,plan.target);
 if(hour<back+.48)return walking([local,work],back,back+.48,'回到自己的工作地点');
 if(hour<leave)return still(work,plan.job,plan.description,plan.target);
 return walking([...plan.route].reverse(),leave,leave+1.3,'带着一天的收获归家');
}
export function dailyRoutePoints(v:Villager,day:number):readonly Point[]{return rolePlan(v,day).route;}
