export const RENDER_SETTINGS_KEY='fisher-realm-render-settings-v1';
export const FRAME_CAPS=Object.freeze([25,50,100]);
const clean=raw=>({quality:['low','medium','high'].includes(raw?.quality)?raw.quality:'high',maxFps:FRAME_CAPS.includes(raw?.maxFps)?raw.maxFps:25,automatic:raw?.automatic!==false,showStats:raw?.showStats===true});
// Device preferences are independent of all three progress slots.
export function createRenderSettings(storage){
 if(arguments.length===0)try{storage=globalThis.localStorage;}catch{storage=null;}
 let value;try{value=clean(JSON.parse(storage?.getItem(RENDER_SETTINGS_KEY)??'null'));}catch{value=clean();}
 return {get value(){return {...value};},set(patch){value=clean({...value,...patch});try{storage?.setItem(RENDER_SETTINGS_KEY,JSON.stringify(value));return true;}catch{return false;}}};
}
export function nextFrameTime(now,previous,maxFps){const next=previous+1000/maxFps;return next<=now?now+1000/maxFps:next;}
// Reflection work is bounded in seconds, independent of the selected main-frame cap.
export function createReflectionSchedule(interval=.12){let last=-Infinity;return {due(time,force=false){if(force||time<last||time-last>=interval-1e-8){last=time;return true;}return false;}};}
