import {getPioneerCalendar,type PioneerWorld} from './pioneerWorld.ts';

/** Projection of real stored supplies; never a new production system. */
export function pioneerVisibleWoodLogs(s:PioneerWorld):number{
 return Math.max(0,Math.min(12,Math.round(Math.max(0,s.resources.wood)*.75)));
}
/** Exactly the corresponding field site drives both harvesting and its foliage.
 * A stripped garden looks stripped; regeneration is drawn only from stock. */
export function pioneerCropAppearance(s:PioneerWorld,gardenId:string){
 const built=s.buildings.find(b=>b.id===gardenId&&b.kind==='garden');
 const field=s.sites.find(site=>site.id==='field-'+gardenId&&site.kind==='field');
 if(!built||!field)return null;
 const coverage=Math.min(1,Math.max(0,field.stock/Math.max(.001,field.capacity)));
 const season=getPioneerCalendar(s).season;
 const winter=season==='winter';
 return {coverage,visibleSprouts:Math.max(0,Math.min(28,
  Math.round(28*coverage*(winter?.70:1)))),
  height:(.065+.12*coverage)*(winter?.64:1),
  season,fieldId:field.id};
}
