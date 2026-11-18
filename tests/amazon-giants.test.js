import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA,createFishCatalog} from '../fish-data.js';
import {FishInventory} from '../inventory-rules.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage} from '../player-storage.js';
test('six-wide arapaima stays in the pile until lv3 and round-trips through the warehouse without loss',()=>{
 const values=new Map();let blocked=false;
 const store=createPlayerStorage({storage:{getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);}}});
 assert.equal(store.run('setCoins',[1000]).ok,true);assert.equal(store.run('addFish',['巨骨舌鱼']).ok,true);const id=store.model.inventory.items[0].id;
 assert.equal(store.model.inventory.items[0].x,null);assert.equal(store.run('moveBag',[id,0,0]).ok,false);
 for(let level=0;level<3;level++){assert.equal(store.run('upgradeBackpack',[level]).ok,true);if(level<2)assert.equal(store.run('moveBag',[id,0,0]).ok,false);}
 assert.equal(store.model.inventory.width,6);assert.equal(store.model.coins,670);assert.equal(store.run('moveBag',[id,0,0]).ok,true);
 assert.equal(store.run('transfer',[id,'bag',0,4,7]).ok,true);let before=store.snapshot();assert.equal(store.run('transfer',[id,0,0,5,7]).ok,false);assert.deepEqual(store.snapshot(),before);
 assert.equal(store.run('addFish',['粉红河豚']).ok,true);before=store.snapshot();assert.equal(store.run('transfer',[id,0,'bag',0,0]).ok,false);assert.deepEqual(store.snapshot(),before);
 assert.equal(store.run('transfer',[id,0,'bag',0,2]).ok,true);assert.deepEqual(new PlayerStorage(store.snapshot()).serialize(),store.snapshot());
 blocked=true;before=store.snapshot();assert.equal(store.run('transfer',[id,'bag',0,4,7]).ok,false);assert.deepEqual(store.snapshot(),before);
});
test('oversize saved placement recovers to pile and width validation accepts six but rejects seven',()=>{
 const fish=FISH_DATA.find(f=>f.id==='ARAPAIMA');assert.equal(fish.inventory.w,6);assert.equal(fish.inventory.h,3);assert.doesNotThrow(()=>createFishCatalog([fish]));
 const invalid=structuredClone(fish);invalid.inventory.w=7;assert.throws(()=>createFishCatalog([invalid]),TypeError);
 const raw={version:1,items:[{id:'1',name:fish.name,x:0,y:0}]},bag=new FishInventory(raw);assert.equal(bag.items[0].x,null);assert.equal(bag.items.length,1);
 const restored=new FishInventory({...bag.serialize(),backpackLevel:3});assert.equal(restored.moveToBag('1',0,0),true);assert.deepEqual(new FishInventory(restored.serialize()).serialize(),restored.serialize());
});
