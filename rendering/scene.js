import * as THREE from '../vendor/three.module.js';
import {Assets} from './assets.js';
import {ResourceScope} from './resources.js';
import {MAP,PROFILES,CHAIRS} from './config.js';
import {terrain,chairs} from './terrain.js';
import {vegetation} from './vegetation.js';
import {createWater} from './water.js';
export async function createRealistic({renderer,camera,quality,progress,signal,parentScene}){
 const profile=PROFILES[quality],scene=parentScene??new THREE.Scene(),scope=new ResourceScope(),assets=new Assets(renderer,progress),root=new THREE.Group(),time={value:0};
 const properties=['background','environment','fog','environmentIntensity','backgroundIntensity','backgroundBlurriness'];
 const previous=Object.fromEntries(properties.map(k=>[k,scene[k]])),bgRotation=scene.backgroundRotation.clone(),envRotation=scene.environmentRotation.clone(),exposure=renderer.toneMappingExposure,shadowType=renderer.shadowMap.type,shadowAuto=renderer.shadowMap.autoUpdate;
 const owner={},oldOwner=scene.userData.visualOwner;scene.userData.visualOwner=owner;scene.add(root);root.name='map-summer-pond-realistic';let closed=false;
 function dispose(){if(closed)return;closed=true;signal?.removeEventListener('abort',dispose);root.removeFromParent();assets.dispose();scope.dispose();root.clear();if(scene.userData.visualOwner===owner){Object.assign(scene,previous);scene.backgroundRotation.copy(bgRotation);scene.environmentRotation.copy(envRotation);scene.userData.visualOwner=oldOwner;renderer.toneMappingExposure=exposure;renderer.shadowMap.type=shadowType;renderer.shadowMap.autoUpdate=shadowAuto;}}
 signal?.addEventListener('abort',dispose,{once:true});
 try{const manifest=await assets.manifest();const [sky,ground]=await Promise.all([assets.environment(manifest.environment),assets.material(manifest.textures.gravelly_sand)]);if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const pmrem=new THREE.PMREMGenerator(renderer);const env=scope.own(pmrem.fromEquirectangular(sky));pmrem.dispose();renderer.toneMappingExposure=.94;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=true;scene.background=sky;sky.mapping=THREE.EquirectangularReflectionMapping;scene.environment=env.texture;scene.environmentIntensity=.65;scene.backgroundIntensity=.85;scene.backgroundBlurriness=.025;scene.backgroundRotation.y=.5;scene.environmentRotation.y=.5;scene.fog=new THREE.Fog('#c8dbcf',85,220);
 const sun=new THREE.DirectionalLight('#fff4de',2.55);sun.position.set(-38,62,24);sun.target.position.set(0,0,-9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.00015;sun.shadow.normalBias=.045;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;root.add(sun,sun.target);scope.own(sun.shadow);
 const near=new THREE.DirectionalLight('#fff4de',.25);near.position.copy(sun.position).sub(sun.target.position).add(new THREE.Vector3(0,0,25));near.target.position.set(0,0,25);near.castShadow=true;near.shadow.mapSize.set(profile.shadow,profile.shadow);Object.assign(near.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:130});near.shadow.normalBias=.035;near.shadow.bias=-.0002;near.shadow.autoUpdate=false;root.add(near,near.target);scope.own(near.shadow);
 root.add(new THREE.HemisphereLight('#d7e7f3','#5b6342',.35));root.add(terrain(scope,ground));root.add(chairs(scope));
 const plant=await vegetation({assets,manifest,scope,profile,time});root.add(plant.root);if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 root.traverse(o=>{if(o.isLight||o.name==='shore-and-lakebed'||o.name==='batched-rock_moss_set_01'||o.name.startsWith('tree_stump_01-'))o.layers.enable(1);});
 const water=createWater(scope,profile);root.add(water.mesh);scope.own(water);let lastShadow=-Infinity;scene.updateMatrixWorld(true);
 let adaptive=1;const result={scene,root,quality,water,setAdaptive(value){adaptive=value;water.setAdaptive(value);},resize(w,h){water.resize(w,h);},update(t){time.value=t;water.update(t);if(t-lastShadow>.12/Math.max(.5,adaptive*adaptive)||t<lastShadow){near.shadow.needsUpdate=true;lastShadow=t;}},renderPrepasses(t,metrics,hidden){water.render(renderer,scene,camera,t,(n,fn)=>metrics.measure(n,fn),hidden);},getDiagnostics(){return {backend:'realistic',presentation:{quality,backend:'realistic',lodLevels:3,chunkCount:plant.diagnostics.batches},quality,chairs:CHAIRS.map(c=>({...c,position:[c.x,.5,c.z],horizontalDistance:Math.hypot(c.x,c.z-32)})),treeCount:plant.diagnostics.treeCount,waterLevel:MAP.water.level,waterMeshes:1,...plant.diagnostics,assetsLoaded:assets.done,disposed:closed};},dispose};
 return result;
 }catch(e){dispose();throw e;}
}
