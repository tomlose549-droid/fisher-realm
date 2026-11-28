import {createReflectionSchedule} from './render-settings.js';
import * as THREE from './vendor/three.module.js';
import {getMapDefinition,getMapContext,DEFAULT_MAP_ID} from './map-registry.js';
import {withDeadline,nextPaint,cancelable} from './rendering/preparation.js';

// One map instance at a time. This factory does not create UI, saves or a render loop.
export async function createMapRuntime({scene,camera,renderer,id=DEFAULT_MAP_ID,sharedResources=new Set(),quality='high',onProgress=()=>{},signal,hooks={}}){
 const definition=getMapDefinition(id),context=getMapContext(id),hasRealistic=typeof definition.loadRealistic==='function',reflections=createReflectionSchedule((definition.config.quality.fine.reflectionEvery??3)/25);
 let view=null,tier=null,controller=null,generation=0,disposed=false,busy=false;
 const normalize=value=>typeof value==='boolean'?(value?'high':'low'):['low','medium','high'].includes(value)?value:'high';
 const measure=(name,fn)=>fn();
 function resize(candidate=view){const size=renderer.getDrawingBufferSize?.(new THREE.Vector2());if(size)candidate?.resize?.(size.x,size.y);}
 function prepasses(candidate,options){if(candidate.renderPrepasses){try{options.before?.();candidate.renderPrepasses(options.time??0,options.metrics??{measure},[]);}finally{options.after?.();}}else candidate.renderReflection({...options,fine:true,force:true});}
 async function setQuality(value){
  if(disposed)throw Error('地图已释放');const next=normalize(value);
  if(view&&next===tier)return;
  if(!hasRealistic&&view){view.setQuality(next!=='low');tier=next;return;}
  const token=++generation;controller?.abort();view?.dispose();view=null;controller=new AbortController();const job=controller;busy=true;
  const abort=()=>job.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let candidate=null;const release=()=>candidate?.dispose();job.signal.addEventListener('abort',release,{once:true});
  try{
   const work=(async()=>{
    if(job.signal.aborted)throw job.signal.reason??new DOMException('Cancelled','AbortError');
    if(hasRealistic&&next!=='low'){
     const module=await definition.loadRealistic();if(job.signal.aborted)throw job.signal.reason??new DOMException('Cancelled','AbortError');
     candidate=await module.createRealistic({parentScene:scene,renderer,camera,quality:next,progress:onProgress,signal:job.signal});
    }else{const {createMap}=await definition.load();if(job.signal.aborted)throw job.signal.reason??new DOMException('Cancelled','AbortError');candidate=createMap(scene,camera,renderer,definition.config,{sharedResources});candidate.setQuality(hasRealistic||next!=='low');}
    if(job.signal.aborted){release();throw job.signal.reason??new DOMException('Cancelled','AbortError');}
    // Retained fishing/rod materials were compiled against the previous environment
    // and shadow filter. Rebuild their programs once when replacing the visual view.
    const materials=new Set();scene.traverse(o=>{for(const m of [].concat(o.material??[]))materials.add(m);});for(const m of materials)m.needsUpdate=true;
    resize(candidate);onProgress('compile',0,0);
    if(renderer.compileAsync)await withDeadline(cancelable(renderer.compileAsync(scene,camera),job.signal),20000,()=>job.abort(Error('材质准备超时')),'材质准备');
    if(job.signal.aborted)throw job.signal.reason;candidate.update(0);prepasses(candidate,{frame:1,time:0,...hooks});renderer.setRenderTarget?.(null);renderer.render(scene,camera);await nextPaint();return candidate;
   })();
   const ready=await withDeadline(cancelable(work,job.signal),45000,()=>job.abort(Error('场景准备超时')),'场景准备');
   if(token!==generation||disposed||job.signal.aborted){ready.dispose();throw new DOMException('Cancelled','AbortError');}
   view=ready;tier=next;
  }catch(error){release();throw error;}finally{signal?.removeEventListener('abort',abort);job.signal.removeEventListener('abort',release);if(token===generation)busy=false;}
 }
 const previousPosition=camera.position.clone(),previousQuaternion=camera.quaternion.clone();
 camera.position.set(...context.spawn.position);camera.rotation.set(context.spawn.pitch,context.spawn.yaw,0);camera.updateMatrixWorld();
 try{await setQuality(quality);}catch(error){disposed=true;controller?.abort();view?.dispose();camera.position.copy(previousPosition);camera.quaternion.copy(previousQuaternion);camera.updateMatrixWorld();throw error;}
 return Object.freeze({context,playerPosition:new THREE.Vector3(...context.spawn.position),setQuality,
  update:elapsed=>view?.update(elapsed),resize:()=>resize(),setAdaptive:value=>view?.setAdaptive?.(value),
  renderReflection:options=>{if(!view)return;if(view.renderPrepasses)prepasses(view,options);else if(!Number.isFinite(options.time)||reflections.due(options.time,options.force))view.renderReflection({...options,fine:true,force:true});},
  getDiagnostics:()=>{const d=view?.getDiagnostics()??{disposed,chairs:[],treeCount:0};return {...d,waterLevel:context.waterLevel,renderBusy:busy,presentation:{...d.presentation,quality:tier??normalize(quality),backend:d.backend??'classic'}};},
  dispose(){if(disposed)return;disposed=true;generation++;controller?.abort();view?.dispose();view=null;}
 });
}
