import {restoreShopProgress} from '../shop-progression.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,SHOP_BY_NAME,quantityOf} from '../item-data.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {tackleStats,tackleDescription} from '../equipment-rules.js';
import {withLure} from '../lure-encounters.js';
import {createLureCasting} from '../lure-casting.js';
import {FishingSession,reelEfficiency} from '../fishing-rules.js';
import {SUMMER_POND_ENCOUNTERS as lake} from '../maps/summer-pond-fish.js';
import {createEqualEncounterTable} from '../fish-encounters.js';
// Fixed scenario for the approved shop examples, independent of later map additions.
const amazon=createEqualEncounterTable(['AMAZON_LONG_SARDINE','AMAZON_SILVER_PACU','BANDED_LEPORINUS','GUPPY','AFRICAN_SHARPTOOTH_CATFISH','AMAZON_BRYCON','AMAZON_FRESHWATER_DRUM','RED_BELLIED_PIRANHA']);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const unlockStock=m=>{m.quests.shop=restoreShopProgress();m.quests.shop.main={completed:6,rewarded:6,count:0};return m;};
const funded=()=>{const m=new PlayerStorage();m.quests.mainCompleted=4;m.coins=100000;return unlockStock(m);};
function memory(){let blocked=false;const values=new Map();return {get blocked(){return blocked;},set blocked(v){blocked=v;},getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);},removeItem:k=>values.delete(k)};}
function equip(m,name,slot){assert.equal(m.buy(name,1).ok,true);const item=m.boxes[0].items.find(i=>i.name===name);assert.equal(m.equip(item.id,0,slot).ok,true);return item;}

test('the second shop has eight approved products, with its own prices, quality, art and stacking',()=>{
 const products=SHOP_ITEMS.filter(p=>p.shop==='shop');
 assert.equal(SHOP_ITEMS.filter(p=>p.shop==='starter').length,6);
 assert.deepEqual(products.map(p=>[p.name,p.price,p.sellPrice,p.quality,p.w,p.h,p.stackLimit,p.image]),[
  ['3号亮片',4,2,'light green',1,1,100,'tackle/lure-3.png'],
  ['4号亮片-中体型吸引',5,3,'green',1,1,100,'tackle/lure-4.png'],
  ['5号假饵',7,4,'green',1,1,100,'tackle/lure-5.png'],
  ['4号鱼线',20,10,'white',1,1,1,'tackle/line-2.png'],
  ['5号鱼线',60,30,'light green',1,1,1,'tackle/line-2.png'],
  ['6号鱼线',180,90,'light green',1,1,1,'tackle/line-2.png'],
  ['7号鱼线',200,100,'green',1,1,1,'tackle/line-2.png'],
  ['2号渔轮-常规级',899,450,'dark purple',2,2,1,'tackle/reel-2.png']
 ]);
});

test('model enforces shop ownership gates even when called without the UI',()=>{
 for(const progress of [0,1,3]){const m=funded();m.quests.mainCompleted=progress;const before=m.serialize();for(const p of SHOP_ITEMS.filter(p=>p.shop==='shop'))assert.equal(m.buy(p.name,1).ok,false);assert.deepEqual(m.serialize(),before);}
 const m=funded();m.quests.mainCompleted=1;m.quests.mainRewarded=4;assert.equal(m.buy('5号假饵',1).ok,true);
});

test('new stacks cap at 100, highest priced bag lure is used first and resale rounds each unit',()=>{
 const m=funded();for(const p of SHOP_ITEMS.filter(p=>p.kind==='lure')){assert.equal(m.buy(p.name,101).ok,true);const stacks=m.boxes[0].items.filter(i=>i.name===p.name);assert.deepEqual(stacks.map(quantityOf),[100,1]);const slot=Number(p.id.slice(-1))-1;assert.equal(m.transfer(stacks[1].id,0,'bag',slot,0).ok,true);}
 for(const name of ['5号假饵','4号亮片-中体型吸引','3号亮片','2号亮片','1号亮片']){const item=m.bestLure();assert.equal(item.name,name);assert.equal(m.consumeLure(item.id).ok,true);}assert.equal(m.bestLure(),null);
 const stack=m.boxes[0].items.find(i=>i.name==='4号亮片-中体型吸引'),before=m.coins;assert.equal(m.sell(stack.id,0).price,300);assert.equal(m.coins,before+300);
});

test('new purchases and pending casts roll back on failed saves; full or fragmented boxes reject whole batches',()=>{
 for(const action of ['buy','equip','beginCast']){
  const io=memory(),store=createPlayerStorage({storage:io});store.model.quests.mainCompleted=4;unlockStock(store.model);store.run('setCoins',[10000]);store.run('buy',['6号鱼线',1]);store.run('buy',['5号假饵',2]);const [line,lure]=store.model.boxes[0].items;
  store.run('transfer',[lure.id,0,'bag',0,0]);if(action==='beginCast')store.run('equip',[line.id,0,'line']);const before=store.snapshot();io.blocked=true;
  const args={buy:['2号渔轮-常规级',1],equip:[line.id,0,'line'],beginCast:[lure.id,.2]}[action];assert.equal(store.run(action,args).ok,false);assert.deepEqual(store.snapshot(),before);
 }
 for(const fragmented of [false,true]){const m=funded();m.buy('1号鱼线',100);if(fragmented)m.boxes[0].items=m.boxes[0].items.filter(i=>(i.x+i.y)%2===0);const before=m.serialize();assert.equal(m.buy('2号渔轮-常规级',1).ok,false);assert.deepEqual(m.serialize(),before);}
});

test('new line/reel bonuses add before angle efficiency, preserve exact slowdowns and retain reel tension after line breaks',()=>{
 for(const [name,max,speed,scale,wear]of [['4号鱼线',123,4.25,.94,15],['5号鱼线',139,4.23,.93,20],['6号鱼线',148,4.26,.924,40],['7号鱼线',171,3.93,.91,20]]){
  const m=funded();equip(m,name,'line');equip(m,'2号渔轮-常规级','reel');const stats=m.tackleStats();assert.equal(stats.lineMaximum,max);close(stats.reelBaseSpeed,speed);close(stats.fishSpeedScale,scale);assert.equal(m.equipment.line.lineWear,wear);
  const session=new FishingSession(()=>0);session.cast(0,0,{equipment:stats});for(const angle of [0,10,60,100]){session.rodYaw=session.fishYaw+angle*Math.PI/180;close(session.speed,speed*reelEfficiency(angle));}
  const saved=new PlayerStorage(m.serialize());assert.deepEqual(saved.equipment,m.equipment);m.equipment.line.lineWear=1;m.beginCast(null,.99);m.settleCast(m.pendingCast.id,'line-broken');assert.equal(m.equipment.line,null);assert.equal(m.equipment.reel.name,'2号渔轮-常规级');assert.equal(m.tackleStats().lineMaximum,120);
 }
 assert.match(tackleDescription('6号鱼线'),/3\.6%/);assert.deepEqual(tackleStats(),{lineMaximum:100,reelBaseSpeed:3.75,fishSpeedScale:1});
});

test('new quality reductions are relative, and only unaffected qualities receive the removed probability',()=>{
 const expected=[['3号亮片',{grey:13.2,white:23.79,'light green':13.6}],['5号假饵',{grey:10.34,white:16.77,'light green':12.8,green:11.76}]];
 for(const [name,totals]of expected){const table=withLure(lake,name);for(const [q,total]of Object.entries(totals))close(table.qualityTotals[q],total);close(Object.values(table.qualityTotals).reduce((n,v)=>n+v,0),100);}
 const three=withLure(amazon,'3号亮片');close(three.qualityTotals.white,7.625);close(three.qualityTotals['light green'],31.875);close(three.qualityTotals.green,15.125);
 const five=withLure(amazon,'5号假饵');close(five.qualityTotals.white,5.375);close(five.qualityTotals['light green'],30);close(five.qualityTotals.green,12.25);close(five.qualityTotals.turquoise,52.375);
});

test('medium lure applies the exact 20% increase after quality reduction and takes it proportionally from small fish',()=>{
 const table=withLure(amazon,'4号亮片-中体型吸引');
 for(const [id,percent]of [['AMAZON_LONG_SARDINE',7.8],['AMAZON_SILVER_PACU',13.65],['BANDED_LEPORINUS',3.65],['GUPPY',3.65],['AFRICAN_SHARPTOOTH_CATFISH',17.8125],['AMAZON_BRYCON',17.8125],['AMAZON_FRESHWATER_DRUM',17.8125],['RED_BELLIED_PIRANHA',17.8125]])close(table.probabilityFor(id),percent);
 const old=withLure(lake,'4号亮片-中体型吸引');close(old.probabilityFor('LEOPARD_PLECO'),7*.51*1.2);close(old.probabilityFor('BLACKBERRY_BASS'),16*.52*1.2);close(old.probabilityFor('GRASS_CARP'),6*.91*1.2);
 for(const [base,derived]of [[lake,old],[amazon,table]]){
  close(derived.ranges.reduce((n,r)=>n+r.percent,0),100);for(const r of derived.ranges){assert.ok(r.percent>=0);if(!base.probabilityFor(r.id))assert.equal(r.percent,0);if(r.units>0)assert.equal(derived.pick((r.start+r.end)/20000),r.profile);}
  assert.equal(derived.fishPool,base.fishPool);assert.equal(derived.pick(1),base.fishPool.at(-1));
 }
 assert.equal(amazon.probabilityFor('AMAZON_LONG_SARDINE'),12.5);assert.equal(lake.qualityTotals.grey,22);
});

test('new lures are debited exactly once per cast, admin bypasses them and map caches remain isolated',()=>{
 const io=memory(),store=createPlayerStorage({storage:io});store.model.quests.mainCompleted=4;unlockStock(store.model);store.run('setCoins',[1000]);store.run('buy',['4号亮片-中体型吸引',3]);const item=store.model.boxes[0].items[0];store.run('transfer',[item.id,0,'bag',0,0]);let base=amazon;
 const cast=createLureCasting({store,getEncounters:()=>base});assert.equal(cast.prepare({forced:true}).encounters,amazon);assert.equal(store.model.bestLure().quantity,3);const first=cast.prepare();close(first.encounters.probabilityFor('GUPPY'),3.65);assert.equal(store.model.bestLure().quantity,2);base=lake;assert.equal(cast.prepare().encounters.probabilityFor('AMAZON_LONG_SARDINE'),0);assert.equal(store.model.bestLure().quantity,1);io.blocked=true;assert.equal(cast.prepare().ok,false);assert.equal(store.model.bestLure().quantity,1);
});

test('second-shop stock and worn equipment persist only within the active save slot',()=>{
 const io=memory();let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});store.model.quests.mainCompleted=4;unlockStock(store.model);store.run('setCoins',[10000]);for(const p of SHOP_ITEMS.filter(p=>p.shop==='shop'))assert.equal(store.run('buy',[p.name,p.stackLimit>1?101:1]).ok,true);
 const line=store.model.boxes[0].items.find(i=>i.name==='6号鱼线');store.run('equip',[line.id,0,'line']);store.model.equipment.line.lineWear=17;store.run('setCoins',[123]);const before=store.snapshot();assert.equal(slots.create().ok,true);slots=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:slots.storage}).model.boxes[0].items.length,0);assert.equal(slots.select('1').ok,true);slots=createSaveSlots({storage:io});assert.deepEqual(createPlayerStorage({storage:slots.storage}).snapshot(),before);
});
