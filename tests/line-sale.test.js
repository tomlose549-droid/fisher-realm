import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,itemUnitSalePrice,unitSalePrice} from '../item-data.js';
import {tackleFor} from '../equipment-rules.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
const saved=(item,coins=17)=>({version:1,items:[],storage:{version:1,coins,boxes:[{unlocked:true,items:[{id:'1',x:0,y:0,...item}]}]}});
test('all seven lines sell at zero when worn, full price when full, and legacy missing wear restores full',()=>{
 const lines=SHOP_ITEMS.filter(p=>p.kind==='line');assert.equal(lines.length,7);
 for(const line of lines){const max=tackleFor(line.name).maxWear;
  for(const wear of [undefined,max,max-1,1]){const item={name:line.name,...(wear===undefined?{}:{lineWear:wear})},expected=wear===undefined||wear===max?line.sellPrice:0;
   assert.equal(itemUnitSalePrice(item),expected);const m=new PlayerStorage(saved(item));assert.equal(itemUnitSalePrice(m.boxes[0].items[0]),expected);assert.equal(m.sell('1',0).price,expected);assert.equal(m.coins,17+expected);assert.equal(m.boxes[0].items.length,0);assert.equal(m.sell('1',0).ok,false);
  }
 }
});
test('worn sale survives equip, unload, move and reload; equipped or backpack lines cannot be sold',()=>{
 const m=new PlayerStorage(saved({name:'3号鱼线',lineWear:19}));assert.equal(m.equip('1',0,'line').ok,true);assert.equal(m.sell('1',0).ok,false);assert.equal(m.unequip('line').ok,true);assert.equal(m.transfer('1',0,'bag',0,0).ok,true);assert.equal(m.sell('1',0).ok,false);assert.equal(m.transfer('1','bag',0,0,0).ok,true);
 const restored=new PlayerStorage(m.serialize());assert.equal(restored.boxes[0].items[0].lineWear,19);assert.equal(restored.sell('1',0).price,0);assert.equal(restored.coins,17);
});
test('zero-price sale persists item removal and rolls back both item and coins on save failure',()=>{
 let value=JSON.stringify(saved({name:'7号鱼线',lineWear:19})),blocked=true;const io={getItem:()=>value,setItem(k,v){assert.equal(k,PLAYER_STORAGE_KEY);if(blocked)throw Error('quota');value=v;}};
 const store=createPlayerStorage({storage:io}),before=store.snapshot(),storedBefore=value;assert.equal(store.run('sell',['1',0]).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(value,storedBefore);
 blocked=false;const result=store.run('sell',['1',0]);assert.equal(result.ok,true);assert.equal(result.price,0);assert.equal(new PlayerStorage(JSON.parse(value)).boxes[0].items.length,0);assert.equal(store.model.coins,17);
});
test('fish, reels and stacked lures keep current prices; zero sale is allowed at max coins',()=>{
 for(const item of [{name:'罗非鱼'},...SHOP_ITEMS.filter(p=>p.kind!=='line').map(p=>({name:p.name,quantity:p.stackLimit>1?10:1}))]){
  assert.equal(itemUnitSalePrice(item),unitSalePrice(item.name));const m=new PlayerStorage(saved(item)),count=item.quantity??1;assert.equal(m.sell('1',0).price,unitSalePrice(item.name)*count);
 }
 const m=new PlayerStorage(saved({name:'7号鱼线',lineWear:1},Number.MAX_SAFE_INTEGER));assert.equal(m.sell('1',0).price,0);assert.equal(m.coins,Number.MAX_SAFE_INTEGER);
});
