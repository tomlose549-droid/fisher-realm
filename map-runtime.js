import * as THREE from './vendor/three.module.js';
import {getMapDefinition,getMapContext,DEFAULT_MAP_ID} from './map-registry.js';

// One map instance at a time. This factory does not create UI, saves or a render loop.
export async function createMapRuntime({scene,camera,renderer,id=DEFAULT_MAP_ID,sharedResources=new Set()}){
  const definition=getMapDefinition(id),context=getMapContext(id);
  const {createMap}=await definition.load();
  const view=createMap(scene,camera,renderer,definition.config,{sharedResources});
  camera.position.set(...context.spawn.position);camera.rotation.set(context.spawn.pitch,context.spawn.yaw,0);
  return Object.freeze({context,playerPosition:new THREE.Vector3(...context.spawn.position),
    update:elapsed=>view.update(elapsed),setQuality:fine=>view.setQuality(fine),
    renderReflection:options=>view.renderReflection(options),
    getDiagnostics:()=>view.getDiagnostics(),dispose:()=>view.dispose()});
}
