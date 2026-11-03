/** Hand-authored sockets. Roads, the bridge and the tavern doorway remain unobstructed. */
export interface PlotState {
 id:string;area:'tavern'|'homes'|'practice';occupiedBy:string;
 position:readonly [number,number];accessNodeId:string;radius:number;
}
export const PLOTS:readonly PlotState[]=[
 {id:'inn-core',area:'tavern',occupiedBy:'inn-001',position:[-3.4,-.2],accessNodeId:'inn-door',radius:3},
 {id:'willow-home',area:'homes',occupiedBy:'home-001',position:[-9,-5.5],accessNodeId:'south-lane',radius:1.65},
 {id:'bamboo-yard',area:'practice',occupiedBy:'yard-001',position:[1.6,6.1],accessNodeId:'training-lane',radius:2.2},
 {id:'inn-side-bench',area:'tavern',occupiedBy:'bench-001',position:[-6.9,2],accessNodeId:'inn-side-path',radius:.85}
];
export function plotFor(buildingId:string){return PLOTS.find(p=>p.occupiedBy===buildingId);}
export function validatePlots():boolean{
 const keys=new Set<string>();
 for(const p of PLOTS){
  if(keys.has(p.id)||p.radius<=0||!Number.isFinite(p.position[0])||!Number.isFinite(p.position[1]))return false;
  keys.add(p.id);
 }
 return true;
}
