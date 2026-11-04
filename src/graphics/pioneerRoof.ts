import * as THREE from 'three';

/** Local coordinates: +Z = doorway, +Y = up, Z is the ridge direction.
 * Roof boards, eaves and reeds all share exactly one plane equation.
 * Geometry is within the external collision-protected roof footprint. */
export interface PioneerRoofProfile {
 halfWidth:number;halfDepth:number;ridgeY:number;eaveY:number;thickness:number;
}
export function pioneerRoofHeight(profile:PioneerRoofProfile,x:number){
 return profile.ridgeY+(profile.eaveY-profile.ridgeY)*
  Math.max(0,Math.min(1,Math.abs(x)/profile.halfWidth));
}
function roofWedge(profile:PioneerRoofProfile,side:-1|1){
 const {halfWidth:w,halfDepth:d,thickness:t}=profile;
 const point=(u:number,z:number,lower=false)=>{
  const x=side*u*w,y=pioneerRoofHeight(profile,x)-(lower?t:0);
  return [x,y,z] as const;
 };
 // Axis order is x, y, z. Both faces are drawn, not culled by a fixed
 // triangle winding that incorrectly hides one of the two roof slopes.
 const vertices=[
  ...point(0,-d),...point(1,-d),...point(1,d),...point(0,d),
  ...point(0,-d,true),...point(1,-d,true),
  ...point(1,d,true),...point(0,d,true)
 ];
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex([
  0,1,2,0,2,3, 4,6,5,4,7,6,
  0,4,5,0,5,1, 3,2,6,3,6,7,
  0,3,7,0,7,4, 1,5,6,1,6,2
 ]);
 geo.computeVertexNormals();
 return geo;
}
export function buildPioneerRoof(parent:THREE.Object3D,
 profile:PioneerRoofProfile,
 roofMat:THREE.Material,beamMat:THREE.Material,
 ridgeMat:THREE.Material,reedMat?:THREE.Material,gableMat?:THREE.Material){
 const g=new THREE.Group();g.name='pioneer-roof-assembly';parent.add(g);
 const surface=roofMat.clone();surface.side=THREE.DoubleSide;
 for(const side of [-1,1] as const){
  const leaf=new THREE.Mesh(roofWedge(profile,side),surface);
  leaf.name=side===-1?'roof-left-slope':'roof-right-slope';
  leaf.castShadow=true;leaf.receiveShadow=true;g.add(leaf);
  const eave=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,profile.halfDepth*2+.04),beamMat);
  eave.position.set(side*profile.halfWidth,profile.eaveY-profile.thickness-.025,0);
  eave.name='continuous-wood-eave';eave.castShadow=true;g.add(eave);
  // Cross-rib rafters are *under* the same roof slope; slender reed seams
  // are *on top* of that same slope. No free-floating crossing roof bars.
  for(const z of [-profile.halfDepth+.17,0,profile.halfDepth-.17]){
   const slopeAngle=Math.atan2(profile.eaveY-profile.ridgeY,profile.halfWidth);
   const length=Math.hypot(profile.halfWidth,profile.eaveY-profile.ridgeY);
   const rafter=new THREE.Mesh(new THREE.BoxGeometry(length,.075,.085),beamMat);
   rafter.position.set(side*profile.halfWidth*.5,
    (profile.ridgeY+profile.eaveY)*.5-profile.thickness-.06,z);
   rafter.rotation.z=side===1?slopeAngle:-slopeAngle;
   rafter.name='load-bearing-rafter';rafter.castShadow=true;g.add(rafter);
  }
  if(reedMat){
   for(let j=1;j<=4;j++){
    const x=side*(.15+j*(profile.halfWidth-.2)/5);
    const seam=new THREE.Mesh(new THREE.BoxGeometry(.025,.024,profile.halfDepth*2-.06),reedMat);
    seam.position.set(x,pioneerRoofHeight(profile,x)+.024,0);
    seam.name='roof-reed-on-slope';seam.castShadow=true;g.add(seam);
   }
  }
 }
 if(gableMat){
  // Occupied cottages have real enclosed triangular end walls under the
  // roof, unlike an open workshop or the founding shelter.
  const wall=gableMat.clone();wall.side=THREE.DoubleSide;
  for(const z of [-profile.halfDepth+.11,profile.halfDepth-.11]){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -profile.halfWidth+.11,profile.eaveY-.06,z,
    profile.halfWidth-.11,profile.eaveY-.06,z,
    0,profile.ridgeY-.095,z
   ],3));
   geometry.setIndex([0,1,2]);geometry.computeVertexNormals();
   const mesh=new THREE.Mesh(geometry,wall);
   mesh.name='enclosed-cottage-gable';mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  }
 }
 const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,profile.halfDepth*2+.16,9),
  ridgeMat);
 ridge.position.set(0,profile.ridgeY+.01,0);ridge.rotation.x=Math.PI/2;
 ridge.name='roof-ridge';ridge.castShadow=true;g.add(ridge);
 return g;
}

/** Spatial contract for the shelter: roof / facade must stay within parcel
 * dimensions plus clearance. Planners store the footprint independently. */
export const PIONEER_SHELTER_ROOF:PioneerRoofProfile={
 halfWidth:1.19,halfDepth:1.14,ridgeY:2.49,eaveY:2.11,thickness:.10
};
