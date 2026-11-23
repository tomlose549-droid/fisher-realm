import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage} from '../storage-rules.js';
import {FISH_DATA} from '../fish-data.js';
import {createPlayerStorage} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
test('every species can be granted once with its original size into warehouse, never bag or pile',()=>{
 for(const fish of FISH_DATA){const m=new PlayerStorage();m.setCoins(17);const r=m.giveFish(fish.name);assert.equal(r.ok,true);assert.equal(r.quantity,1);assert.equal(r.box,0);assert.deepEqual(m.boxes[0].items,[{id:'1',name:fish.name,x:0,y:0}]);assert.equal(m.inventory.items.length,0);assert.equal(m.coins,17);assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),m.serialize());}
});
test('current box wins; falls back to another unlocked box, unique IDs and existing items retained',()=>{
 const m=new PlayerStorage();m.addFish('罗非鱼');m.boxes[1].unlocked=true;m.activeBox=1;assert.equal(m.giveFish('巨骨舌鱼').box,1);assert.equal(m.giveFish('巨骨舌鱼').item.x,0);assert.equal(m.boxes[1].items[1].y,3);m.boxes[1].items=Array.from({length:100},(_,i)=>({id:String(i+2),name:'孔雀鱼',x:i%10,y:Math.floor(i/10)}));const r=m.giveFish('巨骨舌鱼');assert.equal(r.box,0);assert.ok(Number(r.item.id)>101);assert.equal(m.inventory.items[0].name,'罗非鱼');
});
test('full and fragmented warehouses reject without any mutation; locked boxes and free backpack do not count',()=>{
 for(const fragmented of [false,true]){const m=new PlayerStorage();m.boxes[0].items=Array.from({length:100},(_,i)=>({id:String(i+1),name:'孔雀鱼',x:i%10,y:Math.floor(i/10)})).filter(i=>!fragmented||(i.x+i.y)%2===0);const before=m.serialize();assert.equal(m.giveFish('巨骨舌鱼').ok,false);assert.deepEqual(m.serialize(),before);}
 const m=new PlayerStorage();for(const name of ['bad','1号鱼线','toString']){const before=m.serialize();assert.equal(m.giveFish(name).ok,false);assert.deepEqual(m.serialize(),before);}
});
test('failed save grants nothing, retry grants one; grants are isolated and persistent in save slots',()=>{
 const values=new Map();let blocked=false;const io={getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);},removeItem:k=>values.delete(k)};
 let slots=createSaveSlots({storage:io});let store=createPlayerStorage({storage:slots.storage});store.run('setCoins',[17]);const before=store.snapshot(),disk=JSON.stringify([...values]);blocked=true;assert.equal(store.run('giveFish',['巨骨舌鱼']).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(JSON.stringify([...values]),disk);blocked=false;assert.equal(store.run('giveFish',['巨骨舌鱼']).ok,true);
 assert.equal(slots.create().ok,true);slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(store.model.boxes[0].items.length,0);assert.equal(store.run('giveFish',['孔雀鱼']).ok,true);slots.select('1');slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.deepEqual(store.model.boxes[0].items.map(i=>i.name),['巨骨舌鱼']);assert.equal(store.model.coins,17);
});
