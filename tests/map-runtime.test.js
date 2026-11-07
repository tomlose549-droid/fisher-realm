import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SUMMER_POND,shorelinePoint} from '../maps/summer-pond.js';
import {isPondWater} from '../pond-boundary.js';
import {DEFAULT_MAP_ID,getMapDefinition,getMapContext,getMapFishPool,listMaps} from '../map-registry.js';
import {FISH_CATALOG} from '../fish-data.js';
import {FishingSession,pickFish} from '../fishing-rules.js';
import {createResourceScope} from '../scene-resources.js';
import {createWaterEffects} from '../water-effects.js';

test('only the current map is registered; all fish remain available and configuration is immutable',()=>{
  assert.equal(DEFAULT_MAP_ID,'summer-pond');assert.deepEqual(listMaps().map(m=>m.id),[DEFAULT_MAP_ID]);
  const map=getMapContext();assert.deepEqual(map.spawn.position,[0,1.78,32]);assert.equal(map.spawn.pitch,-.065);
  assert.equal(map.waterLevel,-.035);assert.equal(map.isWater,isPondWater);
  assert.equal(map.fishPool,FISH_CATALOG.profiles);assert.equal(getMapFishPool(),FISH_CATALOG.profiles);
  assert.throws(()=>getMapDefinition('not-a-map'),/Unknown map/);
  assert.throws(()=>map.spawn.position[0]=100,TypeError);
});

test('shared shoreline configuration exactly retains old water/land decisions',()=>{
  function legacy(x,z,margin){const nx=x/34,nz=(z+14)/41,a=Math.atan2(nz,nx);return Math.hypot(nx,nz)<(1+.026*Math.sin(a*5+.5)+.015*Math.cos(a*7))*(1+.018*((-.035+.16)/(.12+.16)))*margin;}
  for(const margin of [.98,.995,1,1.02])for(let x=-45;x<=45;x+=1.5)for(let z=-60;z<=35;z+=1.5)
    assert.equal(isPondWater(x,z,margin),legacy(x,z,margin),`${x},${z},${margin}`);
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2,p=shorelinePoint(a);assert.equal(isPondWater(p[0],p[2]),true);}
});

test('random encounters accept an injected pool without changing global inventory/catalog identity',()=>{
  const original=FISH_CATALOG.profiles,pool=[original.at(-1)],session=new FishingSession(()=>.5,{randomSpecies:true,fishPool:pool});
  pool[0]=original[0];session.cast(0,0);assert.equal(session.profile,original.at(-1));
  assert.equal(pickFish(0,[original[1]]),original[1]);assert.equal(pickFish(1,[original[1]]),original[1]);
  assert.equal(getMapFishPool(),original);assert.throws(()=>pickFish(0,[]),/nonempty/);
  assert.throws(()=>new FishingSession(()=>0,{fishPool:[]}),/nonempty/);
});

test('resource scopes release unique owned objects once and preserve shared/player resources',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group(),camera=new THREE.PerspectiveCamera();scene.add(root,camera);
  const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),uniformTexture=new THREE.Texture();
  const target=new THREE.WebGLRenderTarget(4,4),shadowTarget=new THREE.WebGLRenderTarget(4,4);
  const material=new THREE.ShaderMaterial({uniforms:{first:{value:texture},second:{value:uniformTexture},mirror:{value:target.texture}}});
  const instanced=new THREE.InstancedMesh(geometry,material,1);root.add(new THREE.Mesh(geometry,material),instanced);
  const sharedGeometry=new THREE.BoxGeometry(),sharedTexture=new THREE.Texture(),sharedMaterial=new THREE.MeshBasicMaterial({map:sharedTexture});
  root.add(new THREE.Mesh(sharedGeometry,sharedMaterial));
  const light=new THREE.DirectionalLight();light.shadow.map=shadowTarget;root.add(light);
  const counters={};
  for(const [name,object]of Object.entries({geometry,texture,uniformTexture,material,target,shadowTarget,instanced,sharedGeometry,sharedTexture,sharedMaterial,targetTexture:target.texture}))
    object.addEventListener('dispose',()=>counters[name]=(counters[name]??0)+1);
  const scope=createResourceScope(root,{targets:[target],shared:new Set([sharedGeometry,sharedTexture,sharedMaterial])});
  scope.dispose();scope.dispose();assert.equal(scope.disposed,true);assert.deepEqual(scene.children,[camera]);assert.equal(root.children.length,0);
  for(const name of ['geometry','texture','uniformTexture','material','target','shadowTarget','instanced'])assert.equal(counters[name],1,name);
  for(const name of ['sharedGeometry','sharedTexture','sharedMaterial','targetTexture'])assert.equal(counters[name],undefined,name);
  sharedGeometry.dispose();sharedTexture.dispose();sharedMaterial.dispose();
});

test('water effects use the supplied level and stop allocating/emitting after disposal',()=>{
  const scene=new THREE.Scene(),waves=createWaterEffects(scene,{waterLevel:7});
  waves.pulse('landing',{x:3,y:999,z:4},0);assert.deepEqual(waves.snapshot().last.landing.position,[3,7.012,4]);
  waves.update(.1);assert.equal(waves.snapshot().active,1);waves.dispose();waves.dispose();
  assert.equal(scene.children.length,0);waves.pulse('landing',{x:0,z:0},1);waves.update(1);
  assert.equal(waves.snapshot().emitted.landing,1);assert.equal(SUMMER_POND.water.level,-.035);
});
