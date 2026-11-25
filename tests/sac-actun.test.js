import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {SAC_ACTUN as map,cenoteShorePoint,isSacActunWater} from '../maps/sac-actun.js';
import {getMapContext,getMapDefinition,listMaps} from '../map-registry.js';
import {WORLD_LOCATIONS} from '../world-map-data.js';
import {mapEntryFee} from '../map-entry.js';
import {withLure} from '../lure-encounters.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage} from '../player-storage.js';
import {createLureCasting} from '../lure-casting.js';
import {FishingSession} from '../fishing-rules.js';
import {createMap} from '../cenote-scene.js';

test('Sac Actun is registered as an independent free map with its own preview and fixed rocky bank',()=>{
 const c=getMapContext(map.id),loc=WORLD_LOCATIONS.find(l=>l.id===map.id);
 assert.equal(listMaps().length,WORLD_LOCATIONS.length);assert.equal(c.entryFee,0);assert.equal(mapEntryFee(map.id),0);assert.equal(loc.markerId,'world-sac-actun-point');assert.equal(loc.preview,'map-images/sac-actun-preview.png');assert.ok(loc.latitude>20&&loc.latitude<21&&loc.longitude< -87&&loc.longitude> -88);assert.equal(c.labels.spot,'洞穴岩岸');assert.equal(c.isWater(map.spawn.position[0],map.spawn.position[2]),false);
 const [x,,z]=map.spawn.position;assert.equal(c.isWater(x-Math.sin(map.spawn.yaw)*23,z-Math.cos(map.spawn.yaw)*23,.98),true);assert.ok(getMapDefinition(map.id).load);assert.throws(()=>map.water.radii[0]=100,TypeError);
});
test('water follows its actual enclosing shore and rock ledge, ignoring underwater wood and tree roots',()=>{
 const c=getMapContext(map.id);
 for(let i=0;i<256;i++){const angle=i*Math.PI*2/256,p=cenoteShorePoint(angle,1.01);assert.equal(c.isWater(p[0],p[2]),false);const wet=cenoteShorePoint(angle,.94);if(!(wet[0]< -23&&wet[2]>12))assert.equal(c.isWater(wet[0],wet[2]),true);}
 for(const log of map.landmarks.submergedLogs)for(let i=0;i<=20;i++){const t=i/20;assert.equal(c.isWater(log.from[0]+t*(log.to[0]-log.from[0]),log.from[2]+t*(log.to[2]-log.from[2])),true);}
 assert.equal(c.isWater(map.landmarks.tree[0],map.landmarks.tree[2]),true);assert.equal(c.isWater(-26,20),false);assert.equal(c.isWater(80,0),false);
 const shifted={...map.water,center:[100,100],ledge:undefined};assert.equal(isSacActunWater(100,100,1,shifted),true);assert.equal(isSacActunWater(0,-15,1,shifted),false);
});
test('normal fishing remains tilapia 100 percent for all five lures; admin fish and old-map probabilities stay independent',()=>{
 const c=getMapContext(map.id);for(const lure of [null,'1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){const t=withLure(c.encounters,lure);assert.equal(t.fishPool.length,1);assert.equal(t.probabilityFor('TILAPIA'),100);for(const u of [0,.1,.5,.99,1])assert.equal(t.pick(u).name,'罗非鱼');}
 const data=new PlayerStorage({version:1,items:[{id:'1',name:'5号假饵',quantity:2,x:0,y:0}]});let saved=JSON.stringify(data.serialize());const store=createPlayerStorage({storage:{getItem:()=>saved,setItem:(k,v)=>saved=v}}),lures=createLureCasting({store,encounters:c.encounters});assert.equal(lures.prepare().encounters.probabilityFor('TILAPIA'),100);assert.equal(store.model.inventory.items[0].quantity,1);assert.equal(lures.prepare({forced:true}).lure,null);assert.equal(store.model.inventory.items[0].quantity,1);
 const [x,,z]=map.spawn.position,s=new FishingSession(()=>0,{player:{x,z},isWater:c.isWater,fishPool:c.fishPool,encounters:c.encounters});s.setForcedFish('孔雀鲈');s.cast(0,map.spawn.yaw);assert.equal(s.profile.name,'孔雀鲈');assert.equal(getMapContext('summer-pond').encounters.probabilityFor('TILAPIA'),15);assert.equal(getMapContext('amazon-flooded-forest').encounters.probabilityFor('TILAPIA'),12);
});
test('failed cenote construction cleans its root and restores the shared environment/camera/renderer',()=>{
 const oldDocument=globalThis.document,scene=new THREE.Scene(),background=new THREE.Color('#123456'),fog=new THREE.Fog('#445566',3,30),camera=new THREE.PerspectiveCamera();camera.position.set(9,8,7);scene.background=background;scene.fog=fog;const sentinel=new THREE.Group();scene.add(sentinel);const renderer={toneMappingExposure:.73,shadowMap:{autoUpdate:true,needsUpdate:false},capabilities:{getMaxAnisotropy:()=>4}};
 globalThis.document={createElement:()=>({getContext(){throw Error('cenote-canvas-failure');}})};
 try{assert.throws(()=>createMap(scene,camera,renderer),/cenote-canvas-failure/);assert.deepEqual(scene.children,[sentinel]);assert.equal(scene.background,background);assert.equal(scene.fog,fog);assert.equal(renderer.toneMappingExposure,.73);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,false);assert.deepEqual(camera.position.toArray(),[9,8,7]);}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
