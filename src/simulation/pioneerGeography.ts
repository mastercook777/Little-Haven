/** The western hills extend the pioneer map without moving the creek,
 * the east shore or any coordinate stored by the previous release. */
export const PIONEER_VALLEY={
 centerX:-1.7,radiusX:18.5,westRadius:27.5,radiusZ:12.2,
 westBulgeZ:4.8,walkMarginX:1.30,walkMarginZ:1.25,westernHomesX:-17,
} as const;

export function pioneerValleyDepth(x:number){
 const depthGain=Math.max(0,Math.min(1,(-x-12)/9));
 return PIONEER_VALLEY.radiusZ+PIONEER_VALLEY.westBulgeZ*depthGain;
}

export function pioneerIslandFraction(x:number,z:number,marginX=0,marginZ=0){
 const b=PIONEER_VALLEY;
 const radiusX=x<b.centerX?b.westRadius:b.radiusX;
 return ((x-b.centerX)/(radiusX-marginX))**2+(z/(pioneerValleyDepth(x)-marginZ))**2;
}
