import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage,BOX_COUNT} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {FISH_DATA,FISH_PRICES,createFishCatalog} from '../fish-data.js';

const legacy={version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}]};
const savedStore=initial=>{
  let value=initial?JSON.stringify(initial):null,fail=false,writes=0;
  const storage={getItem:()=>value,setItem(key,next){assert.equal(key,PLAYER_STORAGE_KEY);writes++;if(fail)throw Error('quota');value=next;}};
  const store=createPlayerStorage({storage});return {store,fail:v=>fail=v,get value(){return JSON.parse(value);},get writes(){return writes;}};
};

test('all 27 approved per-fish prices are explicit and do not enter combat profiles',()=>{
  const expected={'豹纹翼甲鲶':3,'罗非鱼':1,'尼罗罗非鱼':2,'普通鲤鱼':3,'黑莓鲈':4,'欧洲河鲈':6,'红耳太阳鱼':6,'草鱼':7,'蓝鳃太阳鱼':7,'白鮰':10,'玛雅慈鲷':13,'黄鲶':10,'斑点叉尾鮰':39,'地图鱼':31,'美洲鳗鲡':33,'行走鲶':20,'湖吸口鱼':19,'金色闪光鲦':10,'大口黑鲈':55,'弓鳍鱼':20,'非洲宝石慈鲷':19,'红鳍狗鱼':26,'杰克登普西慈鲷':48,'孔雀鲈':39,'链纹狗鱼':65,'佛罗里达雀鳝':80,'长吻雀鳝':109};
  assert.deepEqual({...FISH_PRICES},expected);
  const catalog=createFishCatalog(FISH_DATA);assert.ok(catalog.profiles.every(f=>!Object.hasOwn(f,'sellPrice')));
  for(const value of [undefined,null,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const fish={...FISH_DATA[0],sellPrice:value};assert.throws(()=>createFishCatalog([fish]),/sellPrice/);
  }
});
test('legacy migration preserves bag and pile without clearing or changing coins, refresh round trips all storage',()=>{
  const model=new PlayerStorage(legacy);assert.deepEqual(model.inventory.serialize(),legacy);assert.equal(model.coins,0);
  assert.equal(model.boxes.length,BOX_COUNT);assert.equal(model.boxes.filter(b=>b.unlocked).length,1);
  model.setCoins(2000);assert.equal(model.unlock(9).ok,true);model.transfer('1','bag',9,8,9);
  const snapshot=model.serialize();assert.deepEqual(new PlayerStorage(JSON.parse(JSON.stringify(snapshot))).serialize(),snapshot);
});
test('only opening warehouse discards pile, with no coins and no warehouse loss',()=>{
  const m=new PlayerStorage(legacy);m.setCoins(30);assert.equal(m.openWarehouse().removed,1);assert.equal(m.coins,30);
  assert.equal(m.inventory.items.length,1);m.transfer('1','bag',0,0,0);m.selectBox(0);
  assert.equal(m.boxes[0].items.length,1);assert.equal(m.openWarehouse().removed,0);
});
test('bidirectional transfers preserve identities and reject overlap, boundary, rotation and locked boxes',()=>{
  const m=new PlayerStorage();const a=m.addFish('美洲鳗鲡').item,b=m.addFish('罗非鱼').item;
  assert.equal(m.transfer(a.id,'bag',0,5,9).ok,true);assert.equal(m.boxes[0].items[0].id,a.id);
  const before=m.serialize();
  for(const [target,x,y]of [[0,6,9],[0,5,10],[0,9,5],[1,0,0],[0,.5,1],[0,5,9]])assert.equal(m.transfer(b.id,'bag',target,x,y).ok,false);
  assert.deepEqual(m.serialize(),before);
  assert.equal(m.transfer(a.id,0,'bag',0,2).ok,true);assert.equal(m.boxes[0].items.length,0);
  assert.equal(m.inventory.items.find(i=>i.id===a.id).name,'美洲鳗鲡');
  assert.equal(m.transfer(b.id,'bag','bag',0,2).ok,false);
});
test('normal backpack retains its existing overlap-to-pile behavior while warehouse rejects it',()=>{
  const m=new PlayerStorage(),a=m.addFish('罗非鱼').item,b=m.addFish('黑莓鲈').item;
  assert.equal(m.transfer(b.id,'bag','bag',0,0).ok,false);
  assert.equal(m.moveBag(b.id,0,0).ok,true);assert.equal(m.inventory.items.find(i=>i.id===a.id).x,null);
});
test('any locked box costs exactly 1000 once; insufficient funds and repeated unlocks are unchanged',()=>{
  const m=new PlayerStorage();m.setCoins(999);const before=m.serialize();assert.equal(m.unlock(5).ok,false);assert.deepEqual(m.serialize(),before);
  m.setCoins(2000);assert.equal(m.unlock(9).ok,true);assert.equal(m.coins,1000);assert.equal(m.activeBox,9);
  assert.equal(m.unlock(9).ok,false);assert.equal(m.coins,1000);assert.equal(m.unlock(2).ok,true);assert.equal(m.coins,0);
  assert.equal(m.boxes.filter(b=>b.unlocked).length,3);
});
test('warehouse sale removes exactly one fish, pays its whole value once and rejects backpack sales',()=>{
  const m=new PlayerStorage(),fish=m.addFish('长吻雀鳝').item;
  assert.equal(m.sell(fish.id,0).ok,false);m.transfer(fish.id,'bag',0,0,0);
  assert.equal(m.sell(fish.id,0).price,109);assert.equal(m.coins,109);assert.equal(m.sell(fish.id,0).ok,false);assert.equal(m.coins,109);
});
test('clear resets pile, bag and coins but preserves warehouse fish and unlocked boxes',()=>{
  const m=new PlayerStorage(legacy);m.setCoins(2000);m.unlock(7);m.transfer('1','bag',7,0,0);
  const boxes=structuredClone(m.boxes);assert.equal(m.clearAll().removed,1);assert.equal(m.coins,0);assert.deepEqual(m.inventory.items,[]);assert.deepEqual(m.boxes,boxes);
  const newFish=m.addFish('罗非鱼').item;assert.notEqual(newFish.id,'1');
});
test('invalid rich amounts and coin overflow cannot mutate balance or remove a fish',()=>{
  const m=new PlayerStorage();for(const value of [-1,.5,'3',null,Infinity,Number.MAX_SAFE_INTEGER+1])assert.equal(m.setCoins(value).ok,false);
  m.setCoins(Number.MAX_SAFE_INTEGER);const a=m.addFish('罗非鱼').item;m.transfer(a.id,'bag',0,0,0);
  assert.equal(m.sell(a.id,0).ok,false);assert.equal(m.boxes[0].items.length,1);assert.equal(m.coins,Number.MAX_SAFE_INTEGER);
  assert.equal(m.setCoins(0).ok,true);assert.equal(m.coins,0);
});
test('invalid or overlapping saved warehouse placements recover fish into pile without erasing known items',()=>{
  const raw=new PlayerStorage().serialize();raw.storage.coins=-10;
  raw.storage.boxes[0].items=[{id:'1',name:'罗非鱼',x:0,y:0},{id:'1',name:'黑莓鲈',x:0,y:0},{id:'3',name:'长吻雀鳝',x:9,y:0}];
  raw.storage.boxes[1].items=[{id:'4',name:'草鱼',x:0,y:0}];
  const m=new PlayerStorage(raw);assert.equal(m.coins,0);assert.equal(m.boxes[0].items.length,1);assert.equal(m.inventory.items.length,3);
  assert.equal(new Set([...m.inventory.items,...m.boxes[0].items].map(i=>i.id)).size,4);
});
test('transfer, unlock, sale, clear, rich and pile discard all roll back completely on save failure',()=>{
  for(const operation of ['transfer','unlock','sell','clearAll','setCoins','openWarehouse']){
    const io=savedStore(legacy),s=io.store;s.run('setCoins',[2000]);
    if(operation==='sell')s.run('transfer',['1','bag',0,0,0]);
    const before=s.snapshot(),disk=io.value;io.fail(true);
    const args={transfer:['1','bag',0,0,0],unlock:[5],sell:['1',0],clearAll:[],setCoins:[99],openWarehouse:[]}[operation];
    const result=s.run(operation,args);assert.equal(result.ok,false,operation);assert.equal(result.saved,false);
    assert.deepEqual(s.snapshot(),before,operation);assert.deepEqual(io.value,disk,operation);
  }
});
test('unsaved catch remains in memory and is included exactly once in a later atomic save',()=>{
  const io=savedStore(),s=io.store;io.fail(true);const caught=s.run('addFish',['罗非鱼'],{retainOnFailure:true});
  assert.equal(caught.ok,true);assert.equal(caught.saved,false);assert.equal(s.model.inventory.items.length,1);
  assert.equal(s.run('setCoins',[100]).ok,false);assert.equal(s.model.coins,0);
  io.fail(false);assert.equal(s.flush(),true);assert.equal(io.value.items.length,1);
  assert.equal(s.run('transfer',[caught.item.id,'bag',0,0,0]).ok,true);
  assert.equal(io.value.items.length,0);assert.equal(io.value.storage.boxes[0].items.length,1);
});
test('closed UI listeners are notified only by a committed or retained mutation, not by failed actions',()=>{
  const io=savedStore(legacy);let notifications=0;io.store.subscribe(()=>notifications++);
  io.store.run('unlock',[9]);assert.equal(notifications,0);
  io.fail(true);io.store.run('setCoins',[1000]);assert.equal(notifications,0);
  io.fail(false);io.store.run('setCoins',[1000]);assert.equal(notifications,1);assert.equal(io.writes,2);
});
