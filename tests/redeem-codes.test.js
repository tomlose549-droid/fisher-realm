import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {ESPORTS_TOKEN as token,restoreRedemptions} from '../redeem-codes.js';
import {ITEMS,SHOP_ITEMS,isShopName,isFishName,itemUnitSalePrice,stackLimit} from '../item-data.js';
import {FISH_DATA} from '../fish-data.js';
import {giftRequirement} from '../quest-rules.js';
const code='67电竞不成',owned=m=>[...m.inventory.items,...m.boxes.flatMap(b=>b.items)],tokens=m=>owned(m).filter(i=>i.name===token.name);
const memory=()=>{const data=new Map();return {blocked:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.blocked)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};};
test('reward metadata is exact and stays outside fish, shop stock, equipment and lure behavior',()=>{
 assert.deepEqual([token.name,token.h,token.w,token.quality,token.color,token.sellPrice,token.image,token.kind],['68电竞打手专属滚木令牌：魔王护不成',3,3,'dark red','#8b0000',67,null,'token']);assert.equal(ITEMS[token.name],token);assert.equal(isFishName(token.name),false);assert.equal(isShopName(token.name),false);assert.equal(SHOP_ITEMS.some(i=>i.name===token.name),false);assert.equal(FISH_DATA.some(i=>i.name===token.name),false);assert.equal(stackLimit(token.name),1);assert.equal(itemUnitSalePrice({name:token.name}),67);
 const m=new PlayerStorage();m.quests.mainCompleted=4;m.hackQuest('shop','shop-main-4');assert.equal(giftRequirement(m.quests,'shop-main-5',token.name),-1);assert.equal(m.buy(token.name,1).ok,false);assert.equal(m.giveFish(token.name).ok,false);
});
test('one redemption grants exactly 67 coins and one token; repeat, sale, clear and reload never reopen it',()=>{
 let m=new PlayerStorage();m.coins=13;m.addFish('罗非鱼');const quests=structuredClone(m.quests);assert.equal(m.redeemCode('  '+code+'  ').ok,true);assert.equal(m.coins,80);assert.equal(tokens(m).length,1);assert.equal(m.inventory.items.length,1);assert.deepEqual(m.quests,quests);const item=tokens(m)[0],before=m.serialize();assert.equal(m.redeemCode(code).ok,false);assert.deepEqual(m.serialize(),before);assert.deepEqual(new PlayerStorage(before).serialize(),before);
 assert.equal(m.sell(item.id,0).price,67);assert.equal(m.coins,147);m=new PlayerStorage(m.serialize());assert.equal(m.redeemCode(code).ok,false);m.clearAll();assert.equal(m.coins,0);assert.equal(m.redeemCode(code).ok,false);assert.equal(tokens(m).length,0);
});
test('token uses a real 3 by 3 rectangle, can move between bag and warehouse, never pile or equipment',()=>{
 const m=new PlayerStorage();m.addFish('罗非鱼');m.redeemCode(code);const t=tokens(m)[0];assert.equal(m.canTransfer(t.id,0,'bag',0,0),false);assert.equal(m.canTransfer(t.id,0,'bag',2,1),false);assert.equal(m.transfer(t.id,0,'bag',2,0).ok,true);assert.equal(m.movePile(t.id).ok,false);assert.equal(m.equip(t.id,'bag','line').ok,false);assert.equal(m.bestLure(),null);assert.equal(m.transfer(t.id,'bag',0,4,4).ok,true);assert.deepEqual([tokens(m)[0].x,tokens(m)[0].y],[4,4]);
});
test('full or fragmented warehouses and coin overflow reject everything without consuming redemption',()=>{
 for(const mode of ['full','fragmented','overflow']){const m=new PlayerStorage();m.coins=mode==='overflow'?Number.MAX_SAFE_INTEGER-66:10;if(mode!=='overflow')m.boxes[0].items=Array.from({length:100},(_,i)=>({id:String(i+1),name:'孔雀鱼',x:i%10,y:Math.floor(i/10)})).filter(i=>mode==='full'||(i.x+i.y)%2===0);const before=m.serialize();assert.equal(m.redeemCode(code).ok,false);assert.deepEqual(m.serialize(),before);m.boxes[0].items=[];m.coins=10;assert.equal(m.redeemCode(code).ok,true);assert.equal(m.coins,77);}
});
test('current warehouse wins and other unlocked boxes are used without overwriting original contents',()=>{
 const m=new PlayerStorage();m.boxes[1].unlocked=true;m.activeBox=1;assert.equal(m.redeemCode(code).ok,true);assert.equal(m.boxes[1].items[0].name,token.name);assert.equal(m.boxes[0].items.length,0);
 const other=new PlayerStorage();other.boxes[0].items=Array.from({length:100},(_,i)=>({id:String(i+1),name:'孔雀鱼',x:i%10,y:Math.floor(i/10)}));other.boxes[1].unlocked=true;assert.equal(other.redeemCode(code).ok,true);assert.equal(other.boxes[0].items.length,100);assert.equal(other.boxes[1].items[0].name,token.name);assert.ok(Number(other.boxes[1].items[0].id)>100);
});
test('failed saving rolls back coins, token and receipt together; retry succeeds once',()=>{
 const io=memory(),store=createPlayerStorage({storage:io});store.run('setCoins',[20]);const before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;assert.equal(store.run('redeemCode',[code]).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);io.blocked=false;assert.equal(store.run('redeemCode',[code]).ok,true);assert.equal(store.model.coins,87);assert.equal(tokens(store.model).length,1);assert.equal(createPlayerStorage({storage:io}).run('redeemCode',[code]).ok,false);
});
test('three save slots redeem independently and the first remains used after switching back',()=>{
 const io=memory();let slots=createSaveSlots({storage:io});for(let i=1;i<=3;i++){if(i>1){assert.equal(slots.create().ok,true);slots=createSaveSlots({storage:io});}const store=createPlayerStorage({storage:slots.storage});assert.equal(store.run('redeemCode',[code]).ok,true);assert.equal(store.model.coins,67);assert.equal(tokens(store.model).length,1);}
 slots.select('1');slots=createSaveSlots({storage:io});const store=createPlayerStorage({storage:slots.storage});assert.equal(store.run('redeemCode',[code]).ok,false);assert.equal(store.model.coins,67);assert.equal(tokens(store.model).length,1);
});
test('legacy records initialize without changing assets, unknown codes do nothing, corrupt receipts fail closed',()=>{
 const m=new PlayerStorage();m.coins=31;m.addFish('罗非鱼');const raw=m.serialize();assert.equal(raw.storage.redemptions,undefined);assert.deepEqual(new PlayerStorage(raw).serialize(),raw);for(const input of [null,{},'','68电竞不成','toString']){assert.equal(m.redeemCode(input).ok,false);assert.deepEqual(m.serialize(),raw);}
 for(const bad of [null,{version:2,codes:[]},{version:1,codes:['ESPORTS_67','ESPORTS_67']},{version:1,codes:['unknown']},{version:1,codes:'ESPORTS_67'}])assert.throws(()=>restoreRedemptions(bad),/兑换记录异常/);
});
