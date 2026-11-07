function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

// Stable map identity. One world unit is one meter. No fish membership fields yet.
export const SUMMER_POND=freeze({
  id:'summer-pond',name:'夏日池塘',
  spawn:{position:[0,1.78,32],yaw:0,pitch:-.065},
  water:{level:-.035,center:[0,-14],radii:[34,41],
    shoreline:{sinFrequency:5,sinAmplitude:.026,sinPhase:.5,cosFrequency:7,cosAmplitude:.015},
    ramp:{startY:-.16,endY:.12,width:.018}},
  environment:{background:'#49a4ef',fog:{color:'#9dc6b3',near:82,far:225},exposure:1},
  quality:{fine:{reflection:[1024,640],reflectionEvery:2},fast:{reflection:[640,400],reflectionEvery:4}},
  labels:{castHint:'请面向池塘水面，再按空格抛竿',reset:'已回到面向池塘的初始视角'}
});

export function shorelineScale(angle){
  const s=SUMMER_POND.water.shoreline;
  return 1+s.sinAmplitude*Math.sin(angle*s.sinFrequency+s.sinPhase)+s.cosAmplitude*Math.cos(angle*s.cosFrequency);
}
export function shorelinePoint(angle,factor=1){
  const {center,radii}=SUMMER_POND.water,wobble=shorelineScale(angle);
  return [center[0]+Math.cos(angle)*radii[0]*wobble*factor,0,center[1]+Math.sin(angle)*radii[1]*wobble*factor];
}
export function groundHeight(x,z){
  const {center,radii}=SUMMER_POND.water;
  return .47+Math.max(0,Math.hypot((x-center[0])/radii[0],(z-center[1])/radii[1])-1.12)*1.1;
}
export function isSummerPondWater(x,z,margin=1){
  const {center,radii,level,ramp}=SUMMER_POND.water,nx=(x-center[0])/radii[0],nz=(z-center[1])/radii[1];
  const surfaceFactor=1+ramp.width*((level-ramp.startY)/(ramp.endY-ramp.startY));
  return Math.hypot(nx,nz)<shorelineScale(Math.atan2(nz,nx))*surfaceFactor*margin;
}
