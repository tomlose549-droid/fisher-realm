export const quantile=(values,q)=>{if(!values.length)return 0;const a=[...values].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*q))];};
export class AutoQuality{
 constructor(){this.scale=1;this.slow=0;this.fast=0;this.last=0;this.reason='等待稳定采样';}
 update({time,p95,cap,enabled}){if(!enabled){this.slow=this.fast=0;return false;}const budget=1000/cap;if(p95>budget*.82){this.slow++;this.fast=0;}else if(p95<budget*.48){this.fast++;this.slow=0;}else this.slow=this.fast=0;
 if(time-this.last<8000)return false;if(this.slow>=3&&this.scale>.7){this.scale=Math.max(.7,this.scale-.1);this.slow=this.fast=0;this.last=time;this.reason='持续超预算：降低分辨率';return true;}if(this.fast>=15&&this.scale<1){this.scale=Math.min(1,this.scale+.05);this.slow=this.fast=0;this.last=time;this.reason='持续稳定：缓慢恢复分辨率';return true;}return false;}
 reset(){this.scale=1;this.slow=this.fast=0;this.last=0;}
}
export class Metrics{
 constructor(renderer){this.renderer=renderer;this.samples=[];this.intervals=[];this.frames=0;this.previous=0;this.current={};this.last={};this.observedTasks=[];this.lastPublish=performance.now();this.snapshot={};try{this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){this.observedTasks.push({start:e.startTime,duration:e.duration});if(this.observedTasks.length>100)this.observedTasks.shift();}});this.observer.observe({type:'longtask',buffered:false});}catch{}}
 resetWindow(now=performance.now()){this.previous=0;this.samples=[];this.intervals=[];this.snapshot={};this.lastPublish=now;}
 begin(now){this.start=performance.now();if(this.previous)this.intervals.push(now-this.previous);this.previous=now;this.renderer.info.reset();this.current={};}
 measure(name,fn){const info=this.renderer.info,before={calls:info.render.calls,triangles:info.render.triangles},start=performance.now();fn();const row=this.current[name]??{calls:0,triangles:0,cpuMs:0};row.calls+=info.render.calls-before.calls;row.triangles+=info.render.triangles-before.triangles;row.cpuMs+=performance.now()-start;this.current[name]=row;}
 end(now){this.samples.push(performance.now()-this.start);this.frames++;this.last=this.current;if(now-this.lastPublish<1000)return false;const seconds=(now-this.lastPublish)/1000;this.snapshot={fps:this.samples.length/seconds,frameMs:quantile(this.intervals,.5),frameP95:quantile(this.intervals,.95),cpuMs:quantile(this.samples,.5),cpuP95:quantile(this.samples,.95),calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,passes:this.last,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frames:this.frames,largeTasks:this.observedTasks.filter(t=>t.start>=now-10000).length};this.samples=[];this.intervals=[];this.lastPublish=now;return true;}
 dispose(){this.observer?.disconnect();}
}
