/** Shared world-space landmarks. Gameplay and graphics must use identical data. */
export type GroundPoint=readonly [number,number];
export const VALLEY_RIVER:readonly GroundPoint[]=[
 [3.8,-12.2],[4.8,-10.5],[6.85,-6.1],[7.5,-2.2],
 [8.35,2.2],[8.72,7.2],[8.05,9.2],[4.35,12.1]
];
export const VALLEY_ROUTES:readonly (readonly GroundPoint[])[]=[
 [[-12,-5],[-9,-3.9],[-6,-2.7],[-4,2.7],[-3,3.2],[-1,3.1],[3,2.2],[6.3,2.2],[8.3,2.2],[11.2,2.2],[15.9,2.2]],
 [[-2.6,3.0],[-.2,4.5],[1.6,6.1],[4.1,8.5]],
 [[-6.8,-3.0],[-9.2,1.1],[-10.7,5.8]],
 [[-4.1,3.0],[-5.9,5.1],[-9.3,4.0]],
 [[-2,2.8],[1,-2.0],[3.4,-5.5]],
 [[-4.4,-.3],[-5.3,-4],[-8.8,-5.3]]
];
export const VALLEY_BOUNDS={radiusX:16.8,radiusZ:12.2} as const;

/** Major silhouettes survive until an explicit tree-clearing action exists. */
export const VALLEY_PINES:readonly (readonly [number,number,number])[]=[
 [-14,-6,1],[-13,8,1.2],[-6,8.7,1.12],[4.7,10.2,.8],
 [11.3,-7,1.0],[14.5,7,1.25],[5.3,-8.3,1.0]
];
export const VALLEY_BAMBOO:readonly (readonly [number,number,number])[]=[
 [-13.8,3.1,1.12],[-13.2,5.4,.95],[-7,8.0,1.08],
 [-4.2,8.8,1.12],[-1.3,9.6,1.0],[5.3,10.1,.76],
 [12,8.4,1.1],[14.5,4.8,1.05],[13,-5.8,.85],[10.5,-8.8,.88]
];
