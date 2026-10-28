// Dimensions and shoreline perturbation match pond-scene.js.
export function isPondWater(x,z,margin=1){
  const nx=x/34,nz=(z+14)/41,a=Math.atan2(nz,nx);
  const shoreline=1+.026*Math.sin(a*5+.5)+.015*Math.cos(a*7);
  // Water y=-.035 intersects the first terrain ramp (r=1..1.018, y=-.16...12).
  const waterSurfaceFactor=1+.018*((-.035+.16)/(.12+.16));
  return Math.hypot(nx,nz)<shoreline*waterSurfaceFactor*margin;
}
