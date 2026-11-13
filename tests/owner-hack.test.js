import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {rewardedMain,shopUnlocked,secondShopUnlocked,sideQuestUnlocked,currentQuest,restoreQuests} from '../quest-rules.js';
const memory=()=>{const data=new Map();return {blocked:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.blocked)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};};
const count=(m,name)=>m.boxes.flatMap(b=>b.items).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??1),0);
function give(m,name){const item=m.addFish(name).item;for(let y=0;y<10;y++)for(let x=0;x<10;x++)if(m.canTransfer(item.id,'bag',0,x,y)){m.transfer(item.id,'bag',0,x,y);return m.submitQuestFish(currentQuest(m.quests).id,0,item.id);}throw Error('full');}
test('jumping to main 5 grants all missing main rewards once, bypasses donation and keeps side separate',()=>{
 const m=new PlayerStorage();m.addFish('罗非鱼');const items=structuredClone(m.inventory.items);assert.equal(m.hackQuest('starter','main-5').ok,true);
 assert.equal(m.quests.mainCompleted,5);assert.equal(m.coins,125);assert.equal(count(m,'2号亮片'),10);assert.equal(count(m,'3号鱼线'),1);assert.equal(m.quests.side1Done,false);assert.deepEqual(m.inventory.items,items);assert.equal(shopUnlocked(m.quests),true);assert.equal(secondShopUnlocked(m.quests),true);
 const before=m.serialize();for(let i=0;i<3;i++)assert.equal(m.hackQuest('starter','main-5').ok,true);assert.deepEqual(m.serialize(),before);
});
test('side can be completed before main, never costs coins, survives reload and never changes main progress',()=>{
 const m=new PlayerStorage();assert.equal(m.hackQuest('starter','side-1').ok,true);assert.equal(m.coins,0);assert.equal(m.quests.mainCompleted,0);assert.equal(shopUnlocked(m.quests),false);assert.equal(count(m,'2号亮片'),10);assert.equal(count(m,'3号鱼线'),1);
 const restored=new PlayerStorage(m.serialize()),before=restored.serialize();assert.equal(restored.quests.side1Done,true);assert.equal(restored.hackQuest('starter','side-1').unchanged,true);assert.deepEqual(restored.serialize(),before);
 restored.hackQuest('starter','main-5');assert.equal(restored.coins,125);assert.equal(count(restored,'2号亮片'),20);assert.equal(count(restored,'3号鱼线'),2);
});
test('rewinding preserves permanent rewards and unlocks; ordinary replays cannot duplicate any reward',()=>{
 let m=new PlayerStorage();m.hackQuest('starter','main-5');const stock=structuredClone(m.boxes);m.hackQuest('starter','main-1');assert.equal(m.quests.mainCompleted,1);assert.equal(rewardedMain(m.quests),5);assert.equal(secondShopUnlocked(m.quests),true);assert.equal(sideQuestUnlocked(m.quests),true);
 m=new PlayerStorage(m.serialize());assert.equal(rewardedMain(m.quests),5);
 assert.equal(give(m,'草鱼').completed,true);assert.equal(m.coins,125);for(let i=0;i<3;i++)give(m,'蓝鳃太阳鱼');for(let i=0;i<10;i++)give(m,'草鱼');give(m,'地图鱼');give(m,'红鳍狗鱼');
 assert.equal(m.quests.mainCompleted,5);assert.equal(m.quests.mainRewarded,undefined);assert.equal(m.coins,125);assert.deepEqual(m.boxes,stock);
});
test('moving backward and forward repeatedly never regrants rewards, including after clear',()=>{
 const m=new PlayerStorage();m.hackQuest('starter','main-4');const stock=structuredClone(m.boxes);m.hackQuest('starter','main-2');assert.equal(rewardedMain(m.quests),4);m.hackQuest('starter','main-5');assert.equal(m.coins,125);assert.deepEqual(m.boxes,stock);
 m.clearAll();assert.equal(m.coins,0);m.hackQuest('starter','main-1');m.hackQuest('starter','main-5');assert.equal(m.coins,0);assert.deepEqual(m.boxes,stock);assert.equal(secondShopUnlocked(m.quests),true);
});
test('old saves infer claimed rewards from completed main, and only later missing rewards are granted',()=>{
 const raw={version:1,items:[],storage:{version:1,coins:7,quests:{version:1,mainCompleted:3,counts:[2,0],side1Done:false},boxes:[]}},m=new PlayerStorage(raw);
 assert.equal(rewardedMain(m.quests),3);m.hackQuest('starter','main-1');assert.deepEqual(m.quests.counts,[0,0]);m.hackQuest('starter','main-5');assert.equal(m.coins,107);assert.equal(count(m,'3号鱼线'),1);assert.equal(count(m,'2号亮片'),0);
});
test('partial normal progress is reset to selected completed task, no extra fish consumed or refunded',()=>{
 const m=new PlayerStorage();m.hackQuest('starter','main-2');give(m,'蓝鳃太阳鱼');assert.deepEqual(m.quests.counts,[1,0]);const items=structuredClone(m.inventory.items);
 m.hackQuest('starter','main-4');assert.deepEqual(m.quests.counts,[0,0]);assert.equal(m.coins,25);assert.equal(count(m,'2号亮片'),10);assert.equal(count(m,'3号鱼线'),1);assert.deepEqual(m.inventory.items,items);
});
test('reward space and coin overflow roll back the entire multi-task jump without partial rewards or IDs',()=>{
 for(const filled of [99,100]){const m=new PlayerStorage();m.receiveGoods('1号鱼线',filled);const before=m.serialize();assert.equal(m.hackQuest('starter','main-5').ok,false);assert.deepEqual(m.serialize(),before);}
 const m=new PlayerStorage();m.coins=Number.MAX_SAFE_INTEGER;const before=m.serialize();assert.equal(m.hackQuest('starter','main-5').ok,false);assert.deepEqual(m.serialize(),before);
 m.coins=0;m.hackQuest('starter','main-5');m.receiveGoods('1号鱼线',98);assert.equal(m.boxes[0].items.length,100);assert.equal(m.hackQuest('starter','main-1').ok,true);assert.equal(m.hackQuest('starter','main-5').ok,true);assert.equal(m.coins,125);
});
test('multi-task reward packing merges partial stacks and may use other unlocked boxes',()=>{
 const m=new PlayerStorage();m.receiveGoods('2号亮片',95);m.receiveGoods('1号鱼线',99);m.boxes[2].unlocked=true;assert.equal(m.hackQuest('starter','main-5').ok,true);assert.equal(count(m,'2号亮片'),105);assert.equal(count(m,'3号鱼线'),1);assert.equal(m.boxes[0].items[0].quantity,100);assert.equal(m.boxes[2].items.length,2);
});
test('invalid owner/task has no effect, and both forward and backward writes roll back on save failure',()=>{
 const m=new PlayerStorage();for(const args of [['shop','main-5'],['unknown','main-1'],['starter','missing'],['starter','main-0']]){const before=m.serialize();assert.equal(m.hackQuest(...args).ok,false);assert.deepEqual(m.serialize(),before);}
 const io=memory(),store=createPlayerStorage({storage:io});for(const id of ['main-5','side-1']){const before=store.snapshot();io.blocked=true;assert.equal(store.run('hackQuest',['starter',id]).ok,false);assert.deepEqual(store.snapshot(),before);io.blocked=false;}
 store.run('hackQuest',['starter','main-5']);const before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;assert.equal(store.run('hackQuest',['starter','main-1']).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);
});
test('claimed history and current progress are isolated across all three slots and persist after clear',()=>{
 const io=memory();let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});store.run('hackQuest',['starter','main-5']);store.run('hackQuest',['starter','main-1']);slots.create();
 slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(rewardedMain(store.model.quests),0);store.run('hackQuest',['starter','side-1']);slots.create();
 slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(rewardedMain(store.model.quests),0);assert.equal(store.model.quests.side1Done,false);slots.select('1');
 slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(store.model.quests.mainCompleted,1);assert.equal(rewardedMain(store.model.quests),5);store.run('clearAll');store.run('hackQuest',['starter','main-5']);assert.equal(store.model.coins,0);slots.select('2');
 slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.equal(store.model.quests.side1Done,true);assert.equal(store.model.quests.mainCompleted,0);
});
test('corrupt reward history fails closed; valid history with zero current progress remains serializable',()=>{
 const valid={version:1,mainCompleted:3,counts:[0,0],side1Done:false};for(const mainRewarded of [-1,2,6,1.5,'5',null])assert.throws(()=>restoreQuests({...valid,mainRewarded}));
 const m=new PlayerStorage({version:1,items:[],storage:{version:1,quests:{...valid,mainCompleted:0,mainRewarded:5}}});assert.equal(m.serialize().storage.quests.mainRewarded,5);
});
