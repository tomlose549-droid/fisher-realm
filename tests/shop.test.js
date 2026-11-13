import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,SHOP_BY_NAME,quantityOf,isFishName} from '../item-data.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {FishDiscoveries} from '../fish-discoveries.js';
import {withLure} from '../lure-encounters.js';
import {createLureCasting} from '../lure-casting.js';
import {SUMMER_POND_ENCOUNTERS as base} from '../maps/summer-pond-fish.js';
import {FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const owned=m=>[...m.inventory.items,...m.boxes.flatMap(b=>b.items)];
const count=(m,name)=>owned(m).filter(i=>i.name===name).reduce((n,i)=>n+quantityOf(i),0);
const funded=()=>{const m=new PlayerStorage();m.quests.mainCompleted=1;m.setCoins(100000);return m;};
function memory(){const map=new Map();let blocked=false;return {map,set blocked(v){blocked=v;},getItem:k=>map.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');map.set(k,v);},removeItem:k=>map.delete(k)};}

test('six exact products, footprints, qualities, stack caps and rounded per-unit resale values',()=>{
  assert.deepEqual(SHOP_ITEMS.map(p=>[p.name,p.price,p.sellPrice,p.h,p.w,p.quality,p.stackLimit]),[
    ['1号鱼线',2,1,1,1,'grey',1],['2号鱼线',10,5,1,1,'white',1],['3号鱼线',45,23,1,1,'white',1],
    ['1号亮片',1,1,1,1,'white',100],['2号亮片',3,2,1,1,'light green',100],['1号渔轮-初学者',150,75,2,2,'turquoise',1]
  ]);assert.ok(SHOP_ITEMS.every(p=>typeof p.image==='string'&&Object.isFrozen(p)));
});
test('buy packs each line/reel separately, stacks lures to 100 and fills existing stacks before empty cells',()=>{
  const m=funded();m.buy('1号鱼线',2);m.buy('1号渔轮-初学者',2);assert.equal(m.boxes[0].items.length,4);
  m.buy('1号亮片',105);assert.deepEqual(m.boxes[0].items.filter(i=>i.name==='1号亮片').map(quantityOf),[100,5]);
  const before=m.boxes[0].items.length;m.buy('1号亮片',95);assert.equal(m.boxes[0].items.length,before);assert.equal(count(m,'1号亮片'),200);
  assert.equal(m.coins,100000-4-300-200);assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),m.serialize());
});
test('purchase fills current box first, then other unlocked boxes, and never uses locked boxes or backpack',()=>{
  const m=funded();m.unlock(4);m.buy('1号鱼线',101);assert.equal(m.boxes[4].items.length,100);assert.equal(m.boxes[0].items.length,1);assert.equal(m.inventory.items.length,0);assert.equal(m.boxes[1].items.length,0);
});
test('existing partial lure stacks in another box are filled before creating a stack in current box',()=>{
  const m=funded();m.buy('2号亮片',95);m.unlock(8);m.buy('2号亮片',5);assert.equal(count(m,'2号亮片'),100);assert.equal(m.boxes[0].items[0].quantity,100);assert.equal(m.boxes[8].items.length,0);
});
test('full warehouse, partial-capacity batch and fragmented 2x2 reject the whole purchase without mutation',()=>{
  for(const mode of ['full','batch','fragmented']){
    const m=funded();
    if(mode==='full')m.buy('1号鱼线',100);
    if(mode==='batch')m.buy('1号鱼线',99);
    if(mode==='fragmented'){m.buy('1号鱼线',100);m.boxes[0].items=m.boxes[0].items.filter(i=>(i.x+i.y)%2===0);}
    const before=m.serialize(),result=m.buy(mode==='fragmented'?'1号渔轮-初学者':'2号鱼线',mode==='batch'?2:1);assert.equal(result.ok,false,mode);assert.deepEqual(m.serialize(),before,mode);
  }
});
test('failed purchase cannot partially fill an existing stack or consume IDs/coins',()=>{
  const m=funded();m.buy('1号亮片',99);m.buy('1号鱼线',99);const before=m.serialize();assert.equal(m.buy('1号亮片',2).ok,false);assert.deepEqual(m.serialize(),before);
});
test('invalid quantity, unknown name, unsafe cost and insufficient money leave all data unchanged',()=>{
  const m=new PlayerStorage(),before=m.serialize();
  for(const n of [0,-1,.5,NaN,Infinity,'2',Number.MAX_SAFE_INTEGER+1])assert.equal(m.buy('1号亮片',n).ok,false);
  assert.equal(m.buy('toString',1).ok,false);assert.equal(m.buy('罗非鱼',1).ok,false);assert.equal(m.buy('1号亮片',1).ok,false);assert.equal(m.buy('1号渔轮-初学者',Number.MAX_SAFE_INTEGER).ok,false);assert.deepEqual(m.serialize(),before);
});
test('same lure stacks merge to 100 across bag/warehouse, leftovers retain source position, full stacks reject',()=>{
  const m=funded();m.buy('1号亮片',140);const [a,b]=m.boxes[0].items;m.transfer(a.id,0,'bag',0,0);m.consumeLure(a.id);m.consumeLure(a.id);
  assert.equal(m.transfer(b.id,0,'bag',0,0).ok,true);assert.equal(m.inventory.items[0].quantity,100);assert.equal(m.boxes[0].items[0].quantity,38);assert.equal(m.transfer(b.id,0,'bag',0,0).ok,false);
  m.moveBag(a.id,1,0);m.transfer(b.id,0,'bag',0,0);for(let i=0;i<5;i++)m.consumeLure(a.id);assert.equal(m.moveBag(b.id,1,0).ok,true);assert.equal(m.inventory.items.find(i=>i.id===a.id).quantity,100);assert.equal(m.inventory.items.find(i=>i.id===b.id).quantity,33);
});
test('fully merged source stack disappears and moving within its own cells does not merge with itself',()=>{
  const m=funded();m.buy('2号亮片',101);const [a,b]=m.boxes[0].items;m.transfer(a.id,0,'bag',0,0);m.consumeLure(a.id);m.transfer(b.id,0,'bag',0,0);
  assert.equal(m.boxes[0].items.length,0);assert.equal(m.inventory.items[0].quantity,100);assert.equal(m.transfer(a.id,'bag','bag',0,0).ok,true);assert.equal(count(m,'2号亮片'),100);
});
test('gear cannot enter pile, displace fish, or be evicted by fish; ordinary fish-over-fish rules remain',()=>{
  const m=funded(),fish=m.addFish('罗非鱼').item;m.buy('1号鱼线',1);const gear=m.boxes[0].items[0];m.transfer(gear.id,0,'bag',2,0);
  const before=m.serialize();assert.equal(m.movePile(gear.id).ok,false);assert.equal(m.moveBag(fish.id,1,0).ok,false);assert.equal(m.moveBag(gear.id,0,0).ok,false);assert.deepEqual(m.serialize(),before);
  const other=m.addFish('红耳太阳鱼').item;assert.equal(m.moveBag(other.id,0,0).ok,true);assert.equal(m.inventory.items.find(i=>i.id===fish.id).x,null);
});
test('selling a stack rounds each unit first, sells the whole stack once and cannot sell from backpack',()=>{
  const m=funded();m.buy('2号亮片',99);const item=m.boxes[0].items[0],coins=m.coins;
  assert.equal(m.sell(item.id,0).price,198);assert.equal(m.coins,coins+198);assert.equal(m.sell(item.id,0).ok,false);
  m.buy('1号亮片',5);const next=m.boxes[0].items[0];m.transfer(next.id,0,'bag',0,0);assert.equal(m.sell(next.id,0).ok,false);
});
test('best lure uses bag only, highest value first, counts down once and removes empty stacks then falls back',()=>{
  const m=funded();m.buy('1号亮片',2);m.buy('2号亮片',1);assert.equal(m.bestLure(),null);const [low,high]=m.boxes[0].items;
  m.transfer(low.id,0,'bag',0,0);m.transfer(high.id,0,'bag',1,0);assert.equal(m.bestLure().name,'2号亮片');m.consumeLure(high.id);assert.equal(m.bestLure().name,'1号亮片');assert.equal(m.inventory.items.some(i=>i.id===high.id),false);
  m.consumeLure(low.id);assert.equal(m.bestLure().quantity,1);m.consumeLure(low.id);assert.equal(m.bestLure(),null);assert.equal(m.consumeLure(low.id).ok,false);
});
test('approved lure quality totals are exact; only other qualities receive redistributed probability',()=>{
  for(const [name,grey,white]of [['1号亮片',15.4,29.25],['2号亮片',12.32,23.4]]){
    const table=withLure(base,name);close(table.qualityTotals.grey,grey);close(table.qualityTotals.white,white);close(Object.values(table.qualityTotals).reduce((n,v)=>n+v,0),100);
    const multiplier=(100-grey-white)/39;for(const q of ['light green','green','turquoise','blue','indigo','dark purple','violet'])close(table.qualityTotals[q],base.qualityTotals[q]*multiplier);
    close(table.probabilityFor('TILAPIA')/table.probabilityFor('LEOPARD_PLECO'),15/7);close(table.probabilityFor('NILE_TILAPIA')/table.probabilityFor('COMMON_CARP'),14/9);assert.equal(table.fishPool,base.fishPool);
  }
  assert.equal(withLure(base,null),base);assert.equal(base.qualityTotals.grey,22);assert.equal(base.qualityTotals.white,39);
});
test('derived probabilities preserve every fish interval, zero/one boundaries and real session selection',()=>{
  const table=withLure(base,'2号亮片');for(const row of table.ranges){assert.equal(table.pick((row.start+row.end)/20000).name,row.profile.name);}
  assert.equal(table.pick(0),base.fishPool[0]);assert.equal(table.pick(1),base.fishPool.at(-1));assert.equal(table.probabilityFor('UNKNOWN'),null);
  const session=new FishingSession(()=>.1,{randomSpecies:true});session.cast(0,0,{encounters:table});assert.equal(session.profile.name,table.pick(.1).name);assert.notEqual(session.profile.name,base.pick(.1).name);
  assert.throws(()=>withLure(base,'1号鱼线'));assert.throws(()=>table.pick(NaN));
});
test('equipment never unlocks a fish guide or enters the fish catalog',()=>{
  const d=new FishDiscoveries();for(const p of SHOP_ITEMS){assert.equal(d.unlock(p.name),false);assert.equal(isFishName(p.name),false);}assert.deepEqual(d.serialize().fishIds,[]);
});
test('buy, sell, merge transfer and lure debit all roll back together if persistence fails',()=>{
  for(const method of ['buy','sell','transfer','consumeLure']){
    const io=memory(),store=createPlayerStorage({storage:io});store.model.quests.mainCompleted=1;store.run('setCoins',[1000]);store.run('buy',['2号亮片',101]);const [a,b]=store.model.boxes[0].items;
    if(method==='consumeLure')store.run('transfer',[a.id,0,'bag',0,0]);
    const before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;
    const args={buy:['1号鱼线',1],sell:[a.id,0],transfer:[b.id,0,'bag',0,0],consumeLure:[a.id]}[method];assert.equal(store.run(method,args).ok,false,method);assert.deepEqual(store.snapshot(),before,method);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk,method);
  }
});
test('cast preparation saves one debit, admin casts bypass it and quota failure cannot grant a free effect',()=>{
  const io=memory(),store=createPlayerStorage({storage:io});store.model.quests.mainCompleted=1;store.run('setCoins',[100]);store.run('buy',['2号亮片',2]);const item=store.model.boxes[0].items[0];store.run('transfer',[item.id,0,'bag',0,0]);const cast=createLureCasting({store,encounters:base});
  assert.equal(cast.prepare({forced:true}).encounters,base);assert.equal(count(store.model,'2号亮片'),2);io.blocked=true;assert.equal(cast.prepare().ok,false);assert.equal(count(store.model,'2号亮片'),2);
  io.blocked=false;const first=cast.prepare();assert.equal(first.lure,'2号亮片');assert.equal(count(store.model,'2号亮片'),1);assert.equal(cast.prepare().encounters,first.encounters);assert.equal(cast.prepare().encounters,base);
});
test('all products and stack counts survive reload, remain slot-local, and clear preserves warehouse stock',()=>{
  const io=memory();let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});store.model.quests.mainCompleted=1;store.run('setCoins',[10000]);for(const p of SHOP_ITEMS)store.run('buy',[p.name,p.stackLimit>1?101:2]);
  const lure=store.model.boxes[0].items.find(i=>i.name==='2号亮片');store.run('transfer',[lure.id,0,'bag',0,0]);const expected=store.snapshot();slots.create();slots=createSaveSlots({storage:io});assert.equal(owned(createPlayerStorage({storage:slots.storage}).model).length,0);slots.select('1');slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.deepEqual(store.snapshot(),expected);
  const boxes=structuredClone(store.model.boxes);store.run('clearAll');assert.equal(store.model.inventory.items.length,0);assert.deepEqual(store.model.boxes,boxes);
});
