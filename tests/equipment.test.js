import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {TACKLE,tackleStats,wearRoll} from '../equipment-rules.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {createLureCasting} from '../lure-casting.js';
import {SUMMER_POND_ENCOUNTERS as encounters} from '../maps/summer-pond-fish.js';
import {FishingSession,TILAPIA,durabilityTier} from '../fishing-rules.js';
import {SHOP_ITEMS} from '../item-data.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const memory=()=>{const map=new Map();let blocked=false;return {map,set blocked(v){blocked=v;},getItem:k=>map.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');map.set(k,v);},removeItem:k=>map.delete(k)};};
function model(line='3号鱼线',reel=true){const m=new PlayerStorage();m.quests.mainCompleted=1;m.setCoins(10000);m.buy(line,1);m.equip(m.boxes[0].items[0].id,0,'line');if(reel){m.buy('1号渔轮-初学者',1);m.equip(m.boxes[0].items[0].id,0,'reel');}return m;}
const ids=m=>[...m.inventory.items,...m.boxes.flatMap(b=>b.items),...Object.values(m.equipment).filter(Boolean)].map(i=>i.id);

test('all three line upgrades and reel compose the exact approved stats without requiring any equipment',()=>{
  assert.deepEqual(tackleStats(),{lineMaximum:100,reelBaseSpeed:3.75,fishSpeedScale:1});
  for(const [line,max,wear,scale]of [['1号鱼线',104,20,.97],['2号鱼线',110,40,.95],['3号鱼线',125,20,.95]]){
    const m=model(line);assert.equal(m.equipment.line.lineWear,wear);assert.equal(m.tackleStats().lineMaximum,max);close(m.tackleStats().reelBaseSpeed,4);close(m.tackleStats().fishSpeedScale,scale);
  }
});
test('equipping moves actual unique items into one line and one reel slot, no copying or extra slots',()=>{
  const m=model();assert.equal(m.boxes[0].items.length,0);assert.equal(m.inventory.items.length,0);assert.equal(Object.values(m.equipment).filter(Boolean).length,2);assert.equal(new Set(ids(m)).size,2);
  assert.equal(m.equip(m.equipment.line.id,0,'line').ok,false);assert.equal(m.equip('missing',0,'rod').ok,false);
  m.buy('1号亮片',1);const before=m.serialize();assert.equal(m.equip(m.boxes[0].items[0].id,0,'line').ok,false);assert.deepEqual(m.serialize(),before);
});
test('full-inventory swap returns worn old line to exactly the slot freed by the new line',()=>{
  const m=new PlayerStorage();m.quests.mainCompleted=1;m.setCoins(10000);m.buy('1号鱼线',99);m.buy('2号鱼线',1);const first=m.boxes[0].items[0];m.equip(first.id,0,'line');m.equipment.line.lineWear=7;m.buy('1号鱼线',1);for(let i=0;i<15;i++)m.addFish('金色闪光鲦');
  const next=m.boxes[0].items.find(i=>i.name==='2号鱼线'),position=[next.x,next.y];assert.equal(m.equip(next.id,0,'line').ok,true);const returned=m.boxes[0].items.find(i=>i.id===first.id);assert.equal(returned.lineWear,7);assert.deepEqual([returned.x,returned.y],position);assert.equal(m.boxes[0].items.length,100);assert.equal(new Set(ids(m)).size,ids(m).length);
  const before=m.serialize();assert.equal(m.unequip('line').ok,false);assert.deepEqual(m.serialize(),before);m.clearAll();assert.equal(m.equipment.line.name,'2号鱼线');assert.equal(m.unequip('line').source,'bag');
});
test('can equip from backpack, but equipped gear cannot be sold until unloaded into warehouse',()=>{
  const m=new PlayerStorage();m.quests.mainCompleted=1;m.setCoins(1000);m.buy('1号鱼线',1);const item=m.boxes[0].items[0];m.transfer(item.id,0,'bag',0,0);m.equip(item.id,'bag','line');assert.equal(m.sell(item.id,0).ok,false);assert.equal(m.unequip('line').ok,true);assert.equal(m.sell(item.id,0).price,1);
});
test('legacy lines migrate to their own full wear, used items retain wear through moves, swaps and reloads',()=>{
  const raw={version:1,items:[{id:'1',name:'2号鱼线',x:0,y:0},{id:'2',name:'1号鱼线',x:1,y:0}]},m=new PlayerStorage(raw);assert.deepEqual(m.inventory.items.map(i=>i.lineWear),[40,20]);m.inventory.items[0].lineWear=13;m.equip('1','bag','line');m.equip('2','bag','line');assert.equal(m.inventory.items.find(i=>i.id==='1').lineWear,13);
  const loaded=new PlayerStorage(m.serialize());assert.deepEqual(loaded.serialize(),m.serialize());assert.equal(loaded.inventory.items[0].lineWear,13);
});
test('65/35 and 95/5 probabilities and exact thresholds are deterministic at every percentile',()=>{
  const draws=Array.from({length:100},(_,i)=>wearRoll((i+.5)/100));assert.equal(draws.filter(r=>r.normalLoss===1).length,65);assert.equal(draws.filter(r=>r.normalLoss===0).length,35);assert.equal(draws.filter(r=>r.brokenLoss===1).length,95);assert.equal(draws.filter(r=>r.brokenLoss===3).length,5);
  assert.equal(wearRoll(.65).normalLoss,0);assert.equal(wearRoll(.95).brokenLoss,3);assert.throws(()=>wearRoll(NaN));
});
test('every round resolves once, normal outcomes share one saved roll while line-broken uses its saved branch',()=>{
  for(const outcome of ['caught','missed','escaped','landed','interrupted','line-broken']){
    const m=model('1号鱼线',false),before=m.equipment.line.lineWear;m.beginCast(null,.99);assert.equal(m.equipment.line.lineWear,before);assert.equal(m.equip('missing',0,'line').ok,false);assert.equal(m.unequip('line').ok,false);
    const id=m.pendingCast.id,result=m.settleCast(id,outcome);assert.equal(result.loss,outcome==='line-broken'?3:0);assert.equal(m.settleCast(id,outcome).ok,false);assert.equal(m.equipment.line.lineWear,before-result.loss);
  }
});
test('depleted line disappears, only that instance breaks, reel remains, bonuses revert without auto-equipping spare',()=>{
  const m=model();m.equipment.line.lineWear=2;m.buy('3号鱼线',1);const stats=m.tackleStats();m.beginCast(null,.99);const result=m.settleCast(m.pendingCast.id,'line-broken');assert.equal(result.destroyed,true);assert.equal(result.remaining,0);assert.equal(m.equipment.line,null);assert.ok(m.equipment.reel);assert.equal(m.boxes[0].items[0].lineWear,20);assert.equal(m.tackleStats().lineMaximum,100);close(m.tackleStats().reelBaseSpeed,3.9);close(m.tackleStats().fishSpeedScale,.98);assert.equal(stats.lineMaximum,125);
});
test('unfinished round recovery uses saved draw and never charges twice after repeated refreshes',()=>{
  const io=memory(),m=model('1号鱼线',false);m.beginCast(null,.2);io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));
  for(let i=0;i<3;i++){const store=createPlayerStorage({storage:io});let randomCalls=0;createLureCasting({store,encounters,random:()=>{randomCalls++;return .9;}});assert.equal(store.model.equipment.line.lineWear,19);assert.equal(store.model.pendingCast,null);assert.equal(randomCalls,0);}
});
test('recovery without storage permission stays in memory at the same wear and does not reroll on another reload',()=>{
  const io=memory(),m=model('1号鱼线',false);m.beginCast(null,.2);io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));io.blocked=true;
  for(let i=0;i<2;i++){const store=createPlayerStorage({storage:io});const c=createLureCasting({store,encounters});assert.equal(store.model.equipment.line.lineWear,19);assert.equal(c.prepare().ok,false);}
  io.blocked=false;const store=createPlayerStorage({storage:io});createLureCasting({store,encounters});assert.equal(store.model.equipment.line.lineWear,19);assert.equal(new PlayerStorage(JSON.parse(io.getItem(PLAYER_STORAGE_KEY))).equipment.line.lineWear,19);
});
test('lure debit and pending wear start commit atomically; failed equip/unload/start cannot mutate or consume items',()=>{
  for(const action of ['equip','unequip','beginCast']){
    const io=memory(),m=model();m.buy('1号鱼线',1);m.buy('2号亮片',2);const line=m.boxes[0].items.find(i=>i.name==='1号鱼线'),lure=m.boxes[0].items.find(i=>i.name==='2号亮片');m.transfer(lure.id,0,'bag',0,0);io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));const store=createPlayerStorage({storage:io}),before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;
    const args={equip:[line.id,0,'line'],unequip:['line'],beginCast:[lure.id,.2]}[action];assert.equal(store.run(action,args).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);
  }
});
test('failed terminal save keeps one pending in-memory loss and blocks another cast until a successful flush',()=>{
  const io=memory(),m=model();io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));const store=createPlayerStorage({storage:io}),c=createLureCasting({store,encounters,random:()=>.99});assert.equal(c.prepare().ok,true);io.blocked=true;const result=c.finish('line-broken');assert.equal(result.saved,false);assert.equal(store.model.equipment.line.lineWear,17);assert.equal(c.finish('line-broken').unchanged,true);assert.equal(c.prepare().ok,false);io.blocked=false;assert.equal(store.flush(),true);assert.equal(new PlayerStorage(JSON.parse(io.getItem(PLAYER_STORAGE_KEY))).equipment.line.lineWear,17);
});
test('clear keeps equipped items and pending draw; new slots start empty and switching restores worn equipment',()=>{
  const io=memory(),slots=createSaveSlots({storage:io}),m=model('2号鱼线');m.equipment.line.lineWear=13;m.beginCast(null,.2);slots.storage.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));const store=createPlayerStorage({storage:slots.storage});const c=createLureCasting({store,encounters});assert.equal(store.model.equipment.line.lineWear,12);store.run('clearAll');assert.equal(store.model.equipment.line.lineWear,12);assert.ok(store.model.equipment.reel);slots.create();
  let next=createSaveSlots({storage:io});assert.deepEqual(createPlayerStorage({storage:next.storage}).model.equipment,{line:null,reel:null});next.select('1');next=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:next.storage}).model.equipment.line.lineWear,12);assert.equal(c.finish().unchanged,true);
});
test('restored equipment IDs remain globally unique when purchasing more items into freed grid cells',()=>{
  const m=model();for(let i=0;i<5;i++)m.buy('1号鱼线',1);const loaded=new PlayerStorage(m.serialize());for(let i=0;i<5;i++)loaded.buy('2号鱼线',1);assert.equal(new Set(ids(loaded)).size,ids(loaded).length);
});
test('invalid wear, wrong slot, duplicate equipped ID and malformed pending record protect the save',()=>{
  for(const mutate of [r=>r.storage.equipment.line.lineWear=0,r=>r.storage.equipment.line.lineWear=21,r=>r.storage.equipment.line.name='1号亮片',r=>r.storage.pendingCast={id:1,lineId:'unknown',normalLoss:1,brokenLoss:3}]){
    const raw=model('1号鱼线').serialize();mutate(raw);assert.throws(()=>new PlayerStorage(raw));
  }
  const raw=model().serialize();raw.items.push({...raw.storage.equipment.line,x:0,y:0});assert.throws(()=>new PlayerStorage(raw));
});
test('reeling bonus is multiplied by every angle efficiency and movement slowdown does not mutate fish profiles',()=>{
  const stats=model().tackleStats(),session=new FishingSession(()=>0),original=structuredClone(TILAPIA);session.cast(0,0,{equipment:stats});
  for(const [degrees,speed]of [[0,4.8],[10,4],[60,3],[100,.8]]){session.rodYaw=session.fishYaw+degrees*Math.PI/180;close(session.speed,speed);}
  assert.equal(session.durability,125);session.hook(6);session.advance(6.1);const angle=TILAPIA.struggle.minAngle*Math.PI/180;close(session.fishX,-Math.cos(angle)*TILAPIA.speed*.95*.1);close(session.fishZ,-23-Math.sin(angle)*TILAPIA.speed*.95*.1);assert.deepEqual(TILAPIA,original);
});
test('line recovery reaches equipped maximum and color tiers use percentage, not absolute old thresholds',()=>{
  const session=new FishingSession(()=>0);session.cast(0,0,{equipment:model().tackleStats()});session.durability=110;session.nextRegenAt=.95;session.restore(.94);assert.equal(session.durability,110);session.restore(.95);assert.equal(session.durability,112.5);session.restore(1.45);assert.equal(session.durability,125);
  assert.equal(durabilityTier(75,125),'yellow');assert.equal(durabilityTier(25,125),'orange');assert.equal(durabilityTier(6.25,125),'red');assert.equal(durabilityTier(76,125),'normal');assert.equal(session.snapshot(1.45).durabilityMaximum,125);
});
test('four selected tackle assets have matching hashes, lightweight proportional thumbnails, and shared line art',async()=>{
  assert.equal(new Set(SHOP_ITEMS.filter(i=>i.kind==='line').map(i=>i.image)).size,1);
  for(const name of ['line-1','lure-1','lure-2','reel-1']){
    const read=p=>readFile(new URL('../'+p,import.meta.url)),full=await read(`fish-images/tackle/${name}.png`),thumb=await read(`fish-images/thumbnails/tackle/${name}.webp`),meta=JSON.parse(await read(`fish-images/thumbnails/tackle/${name}.webp.meta.json`));
    assert.equal(createHash('sha256').update(full).digest('hex'),meta.fullSHA256);assert.equal(createHash('sha256').update(thumb).digest('hex'),meta.thumbnailSHA256);assert.ok(thumb.length<180000);assert.ok(meta.size[0]<=512&&meta.size[1]<=384);const scale=Math.min(512/full.readUInt32BE(16),384/full.readUInt32BE(20),1);assert.ok(Math.abs(full.readUInt32BE(16)*scale-meta.size[0])<=1);assert.ok(Math.abs(full.readUInt32BE(20)*scale-meta.size[1])<=1);assert.equal(meta.lossless,true);
  }
});
