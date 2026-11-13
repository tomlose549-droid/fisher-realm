import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKPACK_LEVELS} from '../backpack-upgrades.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
const expected=[[3,5,0],[4,5,30],[5,5,100],[5,6,200],[6,6,750],[6,7,1200],[6,8,2000],[6,9,3500],[6,10,8888],[7,10,19999]];
const memory=()=>{const data=new Map();return {blocked:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.blocked)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};};
test('approved sizes and individual prices; each step keeps all items and positions and round trips',()=>{
  assert.deepEqual(BACKPACK_LEVELS.map(l=>[l.h,l.w,l.cost]),expected);
  const m=new PlayerStorage({version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}]});m.setCoins(100000);
  for(let level=1;level<=9;level++){
    const items=structuredClone(m.inventory.items),coins=m.coins;
    assert.equal(m.upgradeBackpack(level-1).ok,true);assert.equal(m.coins,coins-expected[level][2]);assert.deepEqual(m.inventory.items,items);
    assert.deepEqual([m.inventory.height,m.inventory.width],expected[level].slice(0,2));assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),m.serialize());
  }
  const before=m.serialize();assert.equal(m.upgradeBackpack(9).ok,false);assert.deepEqual(m.serialize(),before);
});
test('insufficient funds, stale level and maximum cannot debit; exact funds succeed',()=>{
  const m=new PlayerStorage();m.setCoins(29);let before=m.serialize();assert.equal(m.upgradeBackpack(0).ok,false);assert.deepEqual(m.serialize(),before);
  m.setCoins(30);assert.equal(m.upgradeBackpack(0).ok,true);assert.equal(m.coins,0);m.setCoins(1000);before=m.serialize();
  for(const level of [0,2,undefined,'1'])assert.equal(m.upgradeBackpack(level).ok,false);assert.deepEqual(m.serialize(),before);
});
test('every added boundary works for fish placement, warehouse transfers and worn equipment',()=>{
  for(let level=1;level<=9;level++){
    const m=new PlayerStorage();m.setCoins(100000);for(let i=0;i<level;i++)m.upgradeBackpack(i);
    m.quests.mainCompleted=1;m.buy('1号鱼线',1);const line=m.boxes[0].items[0],x=m.inventory.width-1,y=m.inventory.height-1;
    assert.equal(m.transfer(line.id,0,'bag',x,y).ok,true);m.inventory.items[0].lineWear=8;
    const loaded=new PlayerStorage(m.serialize());assert.deepEqual(loaded.inventory.items,m.inventory.items);
    assert.equal(loaded.equip(line.id,'bag','line').ok,true);assert.equal(loaded.equipment.line.lineWear,8);
    const fish=loaded.addFish('罗非鱼').item;assert.equal(loaded.moveBag(fish.id,x-1,y).ok,true);
    assert.equal(loaded.moveBag(fish.id,x,y).ok,false);assert.equal(loaded.moveBag(fish.id,x-1,y+1).ok,false);
    assert.equal(loaded.transfer(fish.id,'bag',0,0,0).ok,true);assert.equal(loaded.transfer(fish.id,0,'bag',x-1,y).ok,true);
    const filled=new PlayerStorage();filled.setCoins(100000);for(let i=0;i<level;i++)filled.upgradeBackpack(i);
    for(let i=0;i<filled.inventory.width*filled.inventory.height;i++)assert.notEqual(filled.addFish('金色闪光鲦').item.x,null);
    assert.equal(filled.addFish('金色闪光鲦').item.x,null);
  }
});
test('legacy is lv0; invalid level fails closed without shrinking an upgraded save',()=>{
  assert.equal(new PlayerStorage({version:1,items:[]}).inventory.level,0);
  for(const backpackLevel of [-1,10,1.5,'9',null])assert.throws(()=>new PlayerStorage({version:1,backpackLevel,items:[]}),/等级异常/);
});
test('failed persistence rolls back both coins and capacity; clear keeps level and boxes',()=>{
  const io=memory(),store=createPlayerStorage({storage:io});store.run('setCoins',[1000]);const before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);
  io.blocked=true;assert.equal(store.run('upgradeBackpack',[0]).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);
  io.blocked=false;store.run('upgradeBackpack',[0]);store.model.quests.mainCompleted=1;store.run('buy',['1号鱼线',1]);const boxes=structuredClone(store.model.boxes);store.run('clearAll');
  assert.equal(store.model.inventory.level,1);assert.deepEqual(store.model.boxes,boxes);assert.equal(store.model.coins,0);assert.equal(new PlayerStorage(JSON.parse(io.getItem(PLAYER_STORAGE_KEY))).inventory.level,1);
});
test('three slots own separate permanent levels; new slots always begin lv0',()=>{
  const io=memory();let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});
  store.run('setCoins',[100000]);for(let i=0;i<9;i++)store.run('upgradeBackpack',[i]);assert.equal(slots.create().ok,true);
  slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(store.model.inventory.level,0);store.run('setCoins',[30]);store.run('upgradeBackpack',[0]);slots.create();
  slots=createSaveSlots({storage:io});assert.equal(new PlayerStorage(JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY))).inventory.level,0);slots.select('1');
  slots=createSaveSlots({storage:io});assert.equal(new PlayerStorage(JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY))).inventory.level,9);slots.select('2');
  slots=createSaveSlots({storage:io});assert.equal(new PlayerStorage(JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY))).inventory.level,1);
});
