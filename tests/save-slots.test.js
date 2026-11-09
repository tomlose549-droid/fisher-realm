import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveSlots,SAVE_SLOTS_KEY} from '../save-slots.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createFishDiscoveries,DISCOVERIES_KEY} from '../fish-discoveries.js';

const legacy={version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}]};
const history={version:1,fishIds:['TILAPIA','LONGNOSE_GAR']};
function memory(){const map=new Map();let blocked=false;return {map,set blocked(value){blocked=value;},getItem:key=>map.get(key)??null,setItem(key,value){if(blocked)throw Error('quota');map.set(key,value);},removeItem(key){map.delete(key);}};}
const seeded=()=>{const io=memory();io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(legacy));io.setItem(DISCOVERIES_KEY,JSON.stringify(history));return io;};
const read=(slots,key)=>JSON.parse(slots.storage.getItem(key));

test('migration retains legacy bag, pile and discoveries in slot 1 before any mutation',()=>{
  const io=seeded(),slots=createSaveSlots({storage:io});assert.equal(slots.activeId,'1');assert.equal(slots.snapshot().slots.length,1);
  assert.deepEqual(read(slots,PLAYER_STORAGE_KEY),legacy);assert.deepEqual(read(slots,DISCOVERIES_KEY),history);
  assert.equal(io.getItem(SAVE_SLOTS_KEY),null);assert.deepEqual(JSON.parse(io.getItem(PLAYER_STORAGE_KEY)),legacy);
});
test('successful canonical migration preserves warehouse coins, unlocks and items, then retires legacy keys',()=>{
  const io=seeded(),old=createPlayerStorage({storage:io});old.run('setCoins',[2300]);old.run('unlock',[9]);old.run('transfer',['1','bag',9,0,0]);
  const before=old.snapshot(),slots=createSaveSlots({storage:io}),game=createPlayerStorage({storage:slots.storage});
  assert.deepEqual(game.snapshot(),before);game.run('setCoins',[1400]);
  assert.equal(io.getItem(PLAYER_STORAGE_KEY),null);assert.equal(io.getItem(DISCOVERIES_KEY),null);
  const reloaded=createSaveSlots({storage:io});assert.equal(read(reloaded,PLAYER_STORAGE_KEY).storage.coins,1400);assert.deepEqual(read(reloaded,PLAYER_STORAGE_KEY).storage.boxes,before.storage.boxes);
});
test('new slot starts with zero coins, empty bag/pile/warehouse, one free box and locked discoveries',()=>{
  const io=seeded(),slots=createSaveSlots({storage:io});const before=slots.snapshot().slots[0];assert.equal(slots.create().id,'2');
  assert.deepEqual(slots.snapshot().slots[0],before);
  const next=createSaveSlots({storage:io}),game=createPlayerStorage({storage:next.storage}),guide=createFishDiscoveries({storage:next.storage});
  assert.equal(next.activeId,'2');assert.equal(game.model.coins,0);assert.equal(game.model.inventory.items.length,0);assert.equal(game.model.boxes.length,10);assert.equal(game.model.boxes.filter(b=>b.unlocked).length,1);assert.ok(game.model.boxes.every(b=>b.items.length===0));assert.equal(guide.has('TILAPIA'),false);
});
test('maximum three slots, stable numbered slots and deleted capacity can be reused without reviving old progress',()=>{
  const io=seeded();let s=createSaveSlots({storage:io});s.create();s=createSaveSlots({storage:io});s.create();s=createSaveSlots({storage:io});
  const before=s.snapshot();assert.equal(s.create().ok,false);assert.deepEqual(s.snapshot(),before);
  assert.equal(s.remove('2').ok,true);assert.equal(s.create().id,'2');s=createSaveSlots({storage:io});assert.equal(s.activeId,'2');assert.deepEqual(read(s,PLAYER_STORAGE_KEY),{version:1,items:[]});
});
test('switching slots restores exact independent inventory, money, boxes and discovery history after refresh',()=>{
  const io=seeded();let s=createSaveSlots({storage:io}),game=createPlayerStorage({storage:s.storage});
  game.run('setCoins',[3456]);game.run('unlock',[7]);game.run('transfer',['1','bag',7,4,5]);const first=read(s,PLAYER_STORAGE_KEY);s.create();
  s=createSaveSlots({storage:io});game=createPlayerStorage({storage:s.storage});const guide=createFishDiscoveries({storage:s.storage});game.run('addFish',['草鱼']);game.run('setCoins',[7]);guide.unlock('草鱼');const second=read(s,PLAYER_STORAGE_KEY);
  s.select('1');s=createSaveSlots({storage:io});assert.deepEqual(read(s,PLAYER_STORAGE_KEY),first);assert.deepEqual(read(s,DISCOVERIES_KEY),history);
  s.select('2');s=createSaveSlots({storage:io});assert.deepEqual(read(s,PLAYER_STORAGE_KEY),second);assert.deepEqual(read(s,DISCOVERIES_KEY).fishIds,['GRASS_CARP']);
});
test('clear only resets the active slot bag/pile/coins and keeps other slots and its warehouse/history',()=>{
  const io=seeded();let s=createSaveSlots({storage:io});s.create();s=createSaveSlots({storage:io});const game=createPlayerStorage({storage:s.storage}),guide=createFishDiscoveries({storage:s.storage});
  game.run('addFish',['草鱼']);guide.unlock('草鱼');game.run('transfer',['1','bag',0,0,0]);game.run('setCoins',[100]);const first=structuredClone(s.snapshot().slots[0]);game.run('clearAll');
  assert.deepEqual(s.snapshot().slots[0],first);assert.equal(game.model.coins,0);assert.equal(game.model.boxes[0].items.length,1);assert.equal(guide.has('GRASS_CARP'),true);
});
test('current slot cannot be deleted, the last remaining slot survives and deletion never switches active slot',()=>{
  const io=seeded();let s=createSaveSlots({storage:io});assert.equal(s.remove('1').ok,false);assert.equal(s.snapshot().slots.length,1);s.create();
  s=createSaveSlots({storage:io});assert.equal(s.remove('2').ok,false);assert.equal(s.remove('1').ok,true);assert.equal(s.activeId,'2');assert.deepEqual(s.snapshot().slots.map(slot=>slot.id),['2']);assert.equal(s.remove('2').ok,false);
});
test('migration and create/select/delete roll back together when storage is full',()=>{
  for(const operation of ['create','select','remove']){
    const io=seeded();let s=createSaveSlots({storage:io});if(operation!=='create'){s.create();s=createSaveSlots({storage:io});}
    const before=s.snapshot(),disk=new Map(io.map);io.blocked=true;
    const result=operation==='create'?s.create():operation==='select'?s.select('1'):s.remove('1');
    assert.equal(result.ok,false);assert.deepEqual(s.snapshot(),before);assert.deepEqual(io.map,disk);
  }
});
test('pending catch/discovery must persist before switching; quota recovery keeps fish in its original slot',()=>{
  const io=seeded(),s=createSaveSlots({storage:io}),game=createPlayerStorage({storage:s.storage}),guide=createFishDiscoveries({storage:s.storage});io.blocked=true;
  game.run('addFish',['草鱼'],{retainOnFailure:true});guide.unlock('草鱼');assert.equal(game.flush(),false);assert.equal(guide.flush(),false);
  assert.equal(s.create().ok,false);assert.equal(s.activeId,'1');io.blocked=false;assert.equal(game.flush(),true);assert.equal(guide.flush(),true);s.create();
  const restored=createSaveSlots({storage:io});restored.select('1');const first=createSaveSlots({storage:io});assert.equal(read(first,PLAYER_STORAGE_KEY).items.filter(f=>f.name==='草鱼').length,1);assert.ok(read(first,DISCOVERIES_KEY).fishIds.includes('GRASS_CARP'));
});
test('an outgoing page cannot write its old models into the newly selected slot',()=>{
  const io=seeded(),old=createSaveSlots({storage:io});old.create();const before=io.getItem(SAVE_SLOTS_KEY);
  assert.throws(()=>old.storage.setItem(PLAYER_STORAGE_KEY,JSON.stringify(legacy)),/存档已切换/);assert.equal(io.getItem(SAVE_SLOTS_KEY),before);
});
test('stale tabs cannot overwrite, restore deleted slots or switch active progress after another tab commits',()=>{
  const io=seeded(),a=createSaveSlots({storage:io}),b=createSaveSlots({storage:io});a.create();const before=io.getItem(SAVE_SLOTS_KEY);
  assert.throws(()=>b.storage.setItem(DISCOVERIES_KEY,JSON.stringify(history)),/其他窗口更新/);assert.equal(b.create().ok,false);assert.equal(io.getItem(SAVE_SLOTS_KEY),before);
});
test('existing canonical slots take priority over leftover legacy keys and invalid canonical data is never overwritten',()=>{
  const io=seeded(),s=createSaveSlots({storage:io});s.create();io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(legacy));assert.equal(createSaveSlots({storage:io}).activeId,'2');
  for(const value of ['{bad',JSON.stringify({version:2}),JSON.stringify({...s.snapshot(),slots:[]})]){
    io.setItem(SAVE_SLOTS_KEY,value);assert.throws(()=>createSaveSlots({storage:io}),/存档资料/);assert.equal(io.getItem(SAVE_SLOTS_KEY),value);
  }
});
test('failed legacy cleanup does not undo a successful canonical save or reimport old progress',()=>{
  const io=seeded();io.removeItem=()=>{throw Error('blocked cleanup');};const s=createSaveSlots({storage:io});assert.equal(s.create().ok,true);assert.equal(createSaveSlots({storage:io}).activeId,'2');
});
test('storage adapter rejects unrelated and inherited field names without modifying any slot',()=>{
  const io=seeded(),s=createSaveSlots({storage:io}),before=s.snapshot();
  for(const key of ['__proto__','constructor','toString','unrelated']){
    assert.throws(()=>s.storage.getItem(key),/不支持/);assert.throws(()=>s.storage.setItem(key,JSON.stringify(legacy)),/不支持/);
  }
  assert.deepEqual(s.snapshot(),before);assert.equal(io.getItem(SAVE_SLOTS_KEY),null);
});
