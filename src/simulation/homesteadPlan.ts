import type {VillageParcel} from './villagePlanning.ts';

/**
 * v0.6 Phase A: a single paid parcel reserves the complete house/work shed,
 * its ground and a usable gate. No decorative second house can be spawned.
 * Coordinates are local to the parcel; +Z faces the real A* entrance.
 */
export type PioneerV6Style='H1-thatch'|'H2-farmyard'|'H3-wing'|'W1-open-yard';
export interface PioneerLotCatalogEntry{
 styleId:PioneerV6Style; width:number;depth:number;wood:number;hours:number;
}
export const PIONEER_V6_LOTS:Readonly<Record<PioneerV6Style,PioneerLotCatalogEntry>>={
 'H1-thatch':{styleId:'H1-thatch',width:3.70,depth:3.95,wood:9,hours:16},
 'H2-farmyard':{styleId:'H2-farmyard',width:4.50,depth:4.75,wood:11,hours:18},
 'H3-wing':{styleId:'H3-wing',width:5.25,depth:5.00,wood:14,hours:23},
 'W1-open-yard':{styleId:'W1-open-yard',width:4.40,depth:4.35,wood:8,hours:14}
};
export function pioneerV6LotFor(kind:'cottage'|'wood-yard',cottageOrdinal=0){
 if(kind==='wood-yard')return PIONEER_V6_LOTS['W1-open-yard'];
 // The first real family courtyard is deliberately different from the old
 // small tiled box. Later households can be smaller or obtain a paid side wing.
 return PIONEER_V6_LOTS[
  (['H2-farmyard','H1-thatch','H3-wing'] as const)[Math.abs(cottageOrdinal)%3]];
}
export interface PioneerHomesteadPlan{
 styleId:PioneerV6Style;kind:'home'|'workyard';
 building:{x:number;z:number;width:number;depth:number};
 yard:{x:number;z:number;width:number;depth:number};
 /** Wall segments leave a physical front gate centered on the approach. */
 gate:{x:number;z:number;opening:number};
 /** One plane for the yard: the route remains on the actual terrain. */
 padY:number;
}
export function pioneerV6HomesteadPlan(parcel:VillageParcel):PioneerHomesteadPlan|null{
 const style=parcel.homesteadStyle;
 if(!style||!PIONEER_V6_LOTS[style]||
  parcel.width<PIONEER_V6_LOTS[style].width-.01||
  parcel.depth<PIONEER_V6_LOTS[style].depth-.01)return null;
 const work=style==='W1-open-yard';
 const width=work?3.05:style==='H1-thatch'?2.40:
  style==='H3-wing'?3.30:3.05;
 const depth=work?2.25:style==='H1-thatch'?2.20:2.42;
 const centerZ=-(parcel.depth/2-depth/2-.32);
 const yardStart=centerZ+depth/2+.04,gateZ=parcel.depth/2-.18;
 return {
  styleId:style,kind:work?'workyard':'home',
  building:{x:0,z:centerZ,width,depth},
  yard:{x:0,z:(gateZ+yardStart)/2,width:parcel.width-.34,depth:gateZ-yardStart},
  gate:{x:0,z:gateZ,opening:1.10},
  padY:.22
 };
}
export function pioneerV6PlanFits(parcel:VillageParcel):boolean{
 const plan=pioneerV6HomesteadPlan(parcel);
 if(!plan)return false;
 const b=plan.building,y=plan.yard;
 return b.width/2<parcel.width/2&&y.width/2<parcel.width/2&&
  b.z-b.depth/2>=-parcel.depth/2&&
  y.z+y.depth/2<=parcel.depth/2&&y.depth>.42&&
  plan.gate.opening<y.width-1.0;
}
