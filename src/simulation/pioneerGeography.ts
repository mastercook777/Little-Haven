/** Pioneer-only enlargement of the miniature island. The classic valley
 * deliberately retains its existing geometry, routes and collision bounds.
 * Expansion is mostly to the west: the eastern creek continues to enter and
 * leave at the previous northern/southern island bank. */
export const PIONEER_VALLEY={
 centerX:-1.7,radiusX:18.5,radiusZ:12.2,
 walkMarginX:1.30,walkMarginZ:1.25,
} as const;
export function pioneerIslandFraction(x:number,z:number,marginX=0,marginZ=0){
 const b=PIONEER_VALLEY;
 return ((x-b.centerX)/(b.radiusX-marginX))**2+
  (z/(b.radiusZ-marginZ))**2;
}
