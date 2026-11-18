import test from 'node:test';
import assert from 'node:assert/strict';
import {getMapContext,listMaps} from '../map-registry.js';
import {AMAZON_CONFLUENCE,riverBank,riverHalfWidth,riverBankOffset,isAmazonWater} from '../maps/amazon-confluence.js';
import {AMAZON_CONFLUENCE_ENCOUNTERS as amazon} from '../maps/amazon-confluence-fish.js';
import {SUMMER_POND_ENCOUNTERS as lake} from '../maps/summer-pond-fish.js';
import {AMAZON_LOCATION,WORLD_LOCATIONS} from '../world-map-data.js';
import {FISH_DATA,FISH_CATALOG} from '../fish-data.js';
import {withLure} from '../lure-encounters.js';
import {createLureCasting} from '../lure-casting.js';
import {createPlayerStorage} from '../player-storage.js';
import {FishingSession} from '../fishing-rules.js';
import {createMapSession} from '../map-session.js';

test('Amazon is independently registered, anchored near Manaus, and uses thirty-six equally likely Amazon species',()=>{
 assert.deepEqual(listMaps().map(m=>m.id),['summer-pond','amazon-confluence']);assert.equal(WORLD_LOCATIONS.length,2);
 assert.ok(Math.abs(AMAZON_LOCATION.latitude+3.14)<.01&&Math.abs(AMAZON_LOCATION.longitude+59.91)<.01);
 const ids=['AMAZON_LONG_SARDINE','AMAZON_SILVER_PACU','BANDED_LEPORINUS','GUPPY','AFRICAN_SHARPTOOTH_CATFISH','AMAZON_BRYCON','AMAZON_FRESHWATER_DRUM','RED_BELLIED_PIRANHA','SOUTH_AMERICAN_WOLFFISH','BLOCH_CATFISH','RED_BELLIED_PACU','BROWN_TROUT','CUTTHROAT_TROUT','TAMBAQUI','TIGER_SHOVELNOSE_CATFISH','REDTAIL_CATFISH','AMAZON_GILDED_CATFISH','BLACK_AROWANA','SILVER_AROWANA','SOUTHERN_SARATOGA','AUSTRALIAN_PEARL_AROWANA','GOLDEN_AROWANA','ASIAN_AROWANA','BLOTCHED_SNAKEHEAD','NORTHERN_SNAKEHEAD','GIANT_SNAKEHEAD','BLUE_SNAKEHEAD','COBRA_SNAKEHEAD','RAINBOW_SNAKEHEAD','GOLDEN_COBRA_SNAKEHEAD','BARCA_SNAKEHEAD','PINK_RIVER_DOLPHIN','BLACK_BACKED_GIANT_CATFISH','LOWLAND_ELECTRIC_EEL','AMAZON_GIANT_CATFISH','ARAPAIMA'],map=getMapContext('amazon-confluence');
 assert.deepEqual(map.fishPool,ids.map(id=>FISH_CATALOG.byId[id]));
 assert.equal(amazon.qualityTotals.white,100/36);assert.equal(amazon.qualityTotals['light green'],300/36);assert.equal(amazon.qualityTotals.green,100/36);assert.equal(amazon.qualityTotals.turquoise,300/36);assert.equal(amazon.qualityTotals.blue,200/36);assert.equal(amazon.qualityTotals.indigo,200/36);assert.equal(amazon.qualityTotals.violet,300/36);assert.equal(amazon.qualityTotals['dark purple'],200/36);assert.equal(amazon.qualityTotals.pink,300/36);assert.equal(amazon.qualityTotals.yellow,500/36);assert.equal(amazon.qualityTotals.orange,200/36);assert.equal(amazon.qualityTotals.red,600/36);assert.equal(amazon.qualityTotals['dark red'],300/36);
 for(const fish of FISH_DATA)assert.equal(amazon.probabilityFor(fish.id),ids.includes(fish.id)?100/36:0);
 for(let i=0;i<ids.length;i++){assert.equal(amazon.pick(i/ids.length),FISH_CATALOG.byId[ids[i]]);assert.equal(amazon.pick((i+1)/ids.length-1e-8),FISH_CATALOG.byId[ids[i]]);assert.equal(lake.probabilityFor(ids[i]),0);}
 assert.equal(amazon.pick(1),FISH_CATALOG.byId.ARAPAIMA);assert.equal(lake.probabilityFor('TILAPIA'),15);assert.equal(lake.fishPool.length,FISH_DATA.length-ids.length);
});
test('river geometry and water decisions share the same banks; 23 m forward cast is in water',()=>{
 const {spawn}=AMAZON_CONFLUENCE,x=spawn.position[0]-Math.sin(spawn.yaw)*23,z=spawn.position[2]-Math.cos(spawn.yaw)*23;
 assert.equal(isAmazonWater(x,z,.98),true);assert.equal(isAmazonWater(spawn.position[0],spawn.position[2]),false);assert.equal(isAmazonWater(spawn.position[0],23),true);
 for(let z=-180;z<45;z+=3){const left=riverBank(z,-1),right=riverBank(z,1);assert.equal(isAmazonWater((left+right)/2,z),true);assert.equal(isAmazonWater(left-.01,z),false);assert.equal(isAmazonWater(right+.01,z),false);if(z<AMAZON_CONFLUENCE.water.platform.minZ||z>AMAZON_CONFLUENCE.water.platform.maxZ)assert.equal(isAmazonWater(left+.01,z),true);}
 assert.equal(isAmazonWater(0,500),false);
});
test('both lures debit once and redistribute white probability to other qualities, cache by current map, and admin bypass retains every global species',()=>{
 let base=amazon,blocked=false;const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);}};
 const store=createPlayerStorage({storage});store.model.quests.mainCompleted=1;store.run('setCoins',[1000]);
 store.run('buy',['1号亮片',2]);store.run('buy',['2号亮片',2]);
 const low=store.model.boxes[0].items.find(i=>i.name==='1号亮片'),high=store.model.boxes[0].items.find(i=>i.name==='2号亮片');
 store.run('transfer',[low.id,0,'bag',0,0]);store.run('transfer',[high.id,0,'bag',1,0]);
 const casting=createLureCasting({store,getEncounters:()=>base});
 assert.equal(casting.prepare().lure,'2号亮片');assert.equal(store.model.inventory.items.find(i=>i.id===high.id).quantity,1);const highTable=casting.prepare().encounters;assert.ok(Math.abs(highTable.probabilityFor('AMAZON_LONG_SARDINE')-60/36)<1e-10);assert.ok(Math.abs(highTable.probabilityFor('GUPPY')-(100-60/36)/35)<1e-10);assert.equal(highTable.probabilityFor('TILAPIA'),0);
 const lowCast=casting.prepare();assert.equal(lowCast.lure,'1号亮片');assert.ok(Math.abs(lowCast.encounters.probabilityFor('AMAZON_LONG_SARDINE')-75/36)<1e-10);assert.ok(Math.abs(lowCast.encounters.probabilityFor('GUPPY')-(100-75/36)/35)<1e-10);
 base=lake;assert.equal(casting.prepare().encounters.probabilityFor('TILAPIA'),withLure(lake,'1号亮片').probabilityFor('TILAPIA'));assert.equal(store.model.bestLure(),null);
 store.run('buy',['2号亮片',1]);const item=store.model.boxes[0].items.find(i=>i.name==='2号亮片');store.run('transfer',[item.id,0,'bag',0,0]);base=amazon;
 blocked=true;const before=store.model.serialize();assert.equal(casting.prepare().ok,false);assert.deepEqual(store.model.serialize(),before);blocked=false;
 assert.equal(casting.prepare({forced:true}).encounters,amazon);assert.equal(store.model.bestLure().quantity,1);
 for(const fish of FISH_CATALOG.profiles){const session=new FishingSession(()=>.8,{randomSpecies:true,fishPool:amazon.fishPool,encounters:amazon});assert.equal(session.setForcedFish(fish.name),true);session.cast(0,0);assert.equal(session.profile.name,fish.name);}
});
test('map session releases old map and fishing before constructing another; owner remainder survives; failed load stays empty',async()=>{
 const events=[];let live=0,maximum=0,failMap=false,failFish=false;
 const runtime=createMapSession({createMap:async id=>{events.push('load '+id);assert.equal(live,0);if(failMap)throw Error('load failed');live++;maximum=Math.max(maximum,live);return {id,dispose(){events.push('dispose '+id);live--;}};},createFishing:(map,owner)=>{if(failFish)throw Error('fishing failed');let mode={...owner};return {getOwnerState:()=>mode,getState:()=>({state:'idle',ownerMode:{...mode}}),setOwner:value=>mode=value,dispose:()=>events.push('dispose fishing '+map.id)};}});
 await runtime.enter('lake');runtime.fishing.setOwner({fishName:'孔雀鲈',remaining:7});await runtime.enter('amazon');assert.equal(maximum,1);assert.deepEqual(runtime.getOwnerState(),{fishName:'孔雀鲈',remaining:7});assert.deepEqual(events.slice(0,4),['load lake','dispose fishing lake','dispose lake','load amazon']);
 runtime.leave();runtime.leave();assert.equal(live,0);assert.equal(runtime.diagnostics().liveMaps,0);assert.equal(runtime.diagnostics().created,runtime.diagnostics().released);
 failMap=true;await assert.rejects(runtime.enter('broken'),/load failed/);assert.equal(live,0);failMap=false;failFish=true;await assert.rejects(runtime.enter('broken-fishing'),/fishing failed/);assert.equal(live,0);failFish=false;
 await runtime.enter('lake');assert.equal(live,1);runtime.leave();
});
test('overlapping entry is rejected and owner restore never replenishes a partially used selection',async()=>{
 let resolve;const runtime=createMapSession({createMap:()=>new Promise(r=>resolve=r),createFishing:()=>({getState:()=>({}),getOwnerState:()=>({fishName:null,remaining:0}),dispose(){}})});
 const pending=runtime.enter('one');await assert.rejects(runtime.enter('two'),/正在加载/);resolve({dispose(){}});await pending;runtime.leave();
 const session=new FishingSession();session.restoreOwnerState({fishName:'孔雀鲈',remaining:6});assert.equal(session.ownerState.remaining,6);assert.throws(()=>session.restoreOwnerState({fishName:'missing',remaining:1}),/Unknown/);session.restoreOwnerState({fishName:null,remaining:0});assert.deepEqual(session.ownerState,{fishName:null,remaining:0});
});

test('channel is exactly 1.5 times as wide, with the platform and seated player following the bank',()=>{
 const {water,spawn}=AMAZON_CONFLUENCE;
 for(let z=water.minZ;z<=water.maxZ;z+=.5){const original=13+2.5*Math.sin(z*.035+.5),width=2*riverHalfWidth(z,water);assert.ok(Math.abs(width-3*original)<1e-10);assert.ok(width>=31.5&&width<=46.5);for(const side of [-1,1])assert.ok(Math.abs(riverBankOffset(z,side,water)-side*original*.5)<1e-10);}
 const shift=riverBankOffset(28,-1,water);assert.ok(Math.abs(spawn.position[0]-(-13+shift))<1e-10);assert.ok(Math.abs(water.platform.minX-(-21.85+shift))<1e-10);assert.ok(Math.abs(water.platform.maxX-(-10.15+shift))<1e-10);assert.ok(Math.abs(water.platform.maxX-water.platform.minX-11.7)<1e-10);assert.equal(isAmazonWater(spawn.position[0],spawn.position[2]),false);
});

test('the five appended giant fish explicitly sell for zero without losing coins',async()=>{
 const {PlayerStorage}=await import('../storage-rules.js'),{BACKPACK_LEVELS}=await import('../backpack-upgrades.js');
 for(const id of ['PINK_RIVER_DOLPHIN','BLACK_BACKED_GIANT_CATFISH','LOWLAND_ELECTRIC_EEL','AMAZON_GIANT_CATFISH','ARAPAIMA']){
  const fish=FISH_DATA.find(f=>f.id===id);assert.equal(fish.sellPrice,0);
  const level=BACKPACK_LEVELS.find(l=>l.w>=fish.inventory.w&&l.h>=fish.inventory.h).level;const model=new PlayerStorage({version:1,backpackLevel:level,items:[]});model.coins=123;model.addFish(fish.name);
  const item=model.inventory.items[0];assert.equal(model.transfer(item.id,'bag',0,0,0).ok,true);
  assert.equal(model.sell(item.id,0).price,0);assert.equal(model.coins,123);assert.equal(model.boxes[0].items.length,0);
 }
});
