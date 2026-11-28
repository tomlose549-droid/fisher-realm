import {SUMMER_POND,shorelineScale,isSummerPondWater} from '../maps/summer-pond.js';
export const MAP=SUMMER_POND;
export const CHAIRS=Object.freeze([
 {name:'left',x:-9.6,z:29.2,color:'#343c3c'},
 {name:'center',x:0,z:32,color:'#b56e35'},
 {name:'right',x:9.6,z:29.2,color:'#d9c99d'}
]);
export const PROFILES=Object.freeze({
 low:{label:'低 · 当前场景',legacy:true,dpr:1.4},
 medium:{label:'中 · 写实',dpr:1,reflection:[640,360],reflectionInterval:.16,refractionScale:.6,shadow:1024,near:12,mid:45,grass:650},
 high:{label:'高 · 写实',dpr:1.35,reflection:[960,540],reflectionInterval:.12,refractionScale:.8,shadow:2048,near:18,mid:60,grass:1100}
});
export function rng(seed=17329){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
export const surfaceFactor=1+MAP.water.ramp.width*((MAP.water.level-MAP.water.ramp.startY)/(MAP.water.ramp.endY-MAP.water.ramp.startY));
export function normalizedRadius(x,z){const w=MAP.water,nx=(x-w.center[0])/w.radii[0],nz=(z-w.center[1])/w.radii[1];return Math.hypot(nx,nz)/shorelineScale(Math.atan2(nz,nx),w);}
export function elevation(x,z){const r=normalizedRadius(x,z),w=MAP.water;
 if(r<=1){const t=Math.min(1,Math.max(0,(1-r)/.27));return w.ramp.startY-4.2*Math.pow(t,1.25);}
 if(r<=1+w.ramp.width)return w.ramp.startY+(r-1)/w.ramp.width*(w.ramp.endY-w.ramp.startY);
 if(r<=1.045)return .12+(r-1.018)/(.027)*.2;
 const shore=.32+Math.min(1,(r-1.045)/.055)*.15;return shore+Math.max(0,r-1.12)*1.1+Math.max(0,r-1.25)*Math.sin(x*.09+z*.07)*.45;
}
export {isSummerPondWater};
