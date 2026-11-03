/** A single authoritative minute count drives all calendar views. No parallel clocks. */
export const DAY_MINUTES=1440;
export const DAYS_PER_SEASON=12;
export const DAYS_PER_YEAR=DAYS_PER_SEASON*4;
export const SEASON_MINUTES=DAYS_PER_SEASON*DAY_MINUTES;
export const YEAR_MINUTES=DAYS_PER_YEAR*DAY_MINUTES;
export type Season='spring'|'summer'|'autumn'|'winter';
export const SEASONS:readonly Season[]=['spring','summer','autumn','winter'];
export const SEASON_NAMES:Record<Season,string>={spring:'春',summer:'夏',autumn:'秋',winter:'冬'};

export interface CalendarView {
 year:number;dayOfYear:number;season:Season;dayOfSeason:number;
 absoluteDay:number;hour:number;minute:number;
}
export function getCalendarFromMinutes(minutes:number):CalendarView{
 const safe=Math.max(0,Number.isFinite(minutes)?minutes:0);
 const absoluteDay=Math.floor(safe/DAY_MINUTES);
 const dayOfYear=absoluteDay%DAYS_PER_YEAR+1;
 const season=SEASONS[Math.floor((dayOfYear-1)/DAYS_PER_SEASON)];
 const time=Math.floor(safe%DAY_MINUTES);
 return {year:Math.floor(absoluteDay/DAYS_PER_YEAR)+1,dayOfYear,season,
  dayOfSeason:(dayOfYear-1)%DAYS_PER_SEASON+1,absoluteDay:absoluteDay+1,
  hour:Math.floor(time/60),minute:time%60};
}
/** Advance exactly to a boundary, never past a second season. */
export function nextSeasonBoundary(minutes:number):number{
 return (Math.floor(Math.max(0,minutes)/SEASON_MINUTES)+1)*SEASON_MINUTES;
}
