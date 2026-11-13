import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {currentQuest,giftRequirement,shopUnlocked,secondShopUnlocked,restoreQuests} from '../quest-rules.js';
const memory=()=>{const data=new Map();return {blocked:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.blocked)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};};
function fish(m,name,index=0){const item=m.addFish(name).item;for(let y=0;y<10;y++)for(let x=0;x<10;x++)if(m.canTransfer(item.id,'bag',index,x,y)){m.transfer(item.id,'bag',index,x,y);return item;}throw Error('fixture is full');}
const submit=(m,name)=>m.submitQuestFish(currentQuest(m.quests).id,0,fish(m,name).id);
const quantity=(m,name)=>m.boxes.flatMap(b=>b.items).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??1),0);
test('new and legacy shops start locked without changing assets, upgrades, equipment or clear behavior',()=>{
 const raw={version:1,backpackLevel:9,items:[{id:'1',name:'罗非鱼',x:8,y:6}],storage:{version:1,coins:500,boxes:[]}},m=new PlayerStorage(raw);
 assert.equal(shopUnlocked(m.quests),false);const before=m.serialize();assert.equal(m.buy('1号鱼线',1).ok,false);assert.deepEqual(m.serialize(),before);assert.equal(m.inventory.level,9);assert.equal(m.inventory.items[0].y,6);
 assert.equal(submit(m,'罗非鱼').completed,true);assert.equal(shopUnlocked(m.quests),true);assert.equal(m.coins,500);assert.equal(m.buy('1号鱼线',1).ok,true);assert.equal(m.equip(m.boxes[0].items[0].id,0,'line').ok,true);m.clearAll();assert.equal(shopUnlocked(m.quests),true);assert.equal(m.inventory.level,9);assert.ok(m.equipment.line);
});
test('main chain gates steps, area and quality, grants exact rewards once and unlocks second shop at step 4',()=>{
 const m=new PlayerStorage();m.setCoins(100);const f=fish(m,'罗非鱼');assert.equal(m.submitQuestFish('main-2',0,f.id).ok,false);
 assert.equal(m.submitQuestFish('main-1',0,f.id).completed,true);assert.equal(m.submitQuestFish('main-1',0,f.id).ok,false);
 assert.equal(giftRequirement(m.quests,'main-2','罗非鱼'),-1);assert.equal(submit(m,'豹纹翼甲鲶').completed,true);assert.equal(m.coins,125);
 assert.equal(giftRequirement(m.quests,'main-3','红耳太阳鱼'),-1);assert.equal(submit(m,'蓝鳃太阳鱼').completed,false);assert.equal(submit(m,'长吻雀鳝').completed,false);assert.equal(submit(m,'金色闪光鲦').completed,true);assert.equal(quantity(m,'2号亮片'),10);
 assert.equal(secondShopUnlocked(m.quests),false);assert.equal(submit(m,'湖吸口鱼').completed,false);assert.deepEqual(m.quests.counts,[0,1]);
 for(let i=0;i<10;i++)assert.equal(submit(m,'草鱼').completed,i===9);
 assert.equal(m.quests.mainCompleted,4);assert.equal(secondShopUnlocked(m.quests),true);assert.equal(quantity(m,'3号鱼线'),1);
 assert.equal(giftRequirement(m.quests,'main-5','大口黑鲈'),-1);assert.equal(submit(m,'红鳍狗鱼').completed,true);assert.equal(m.coins,225);assert.equal(currentQuest(m.quests),null);
 assert.equal(m.submitQuestFish('main-5',0,'missing').ok,false);assert.equal(m.coins,225);assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),m.serialize());
});
test('task 4 requires eleven separate fish even if every fish meets both thresholds',()=>{
 const m=new PlayerStorage();m.quests.mainCompleted=3;
 for(let i=0;i<10;i++)assert.equal(submit(m,'红鳍狗鱼').completed,false);assert.deepEqual(m.quests.counts,[9,1]);assert.equal(m.quests.mainCompleted,3);
 assert.equal(submit(m,'红鳍狗鱼').completed,true);assert.equal(m.quests.mainCompleted,4);
});
test('low-quality first also requires additional high-quality fish; completed subgoals filter donations',()=>{
 const m=new PlayerStorage();m.quests.mainCompleted=3;for(let i=0;i<10;i++)submit(m,'草鱼');assert.deepEqual(m.quests.counts,[10,0]);
 assert.equal(giftRequirement(m.quests,'main-4','草鱼'),-1);assert.equal(submit(m,'地图鱼').completed,true);
});
test('only fish in unlocked boxes can be donated; bag, pile, gear, stale IDs and steps are rejected',()=>{
 const m=new PlayerStorage(),item=m.addFish('罗非鱼').item;assert.equal(m.submitQuestFish('main-1','bag',item.id).ok,false);assert.equal(m.submitQuestFish('main-1',0,item.id).ok,false);
 m.quests.mainCompleted=1;m.setCoins(100);m.buy('1号鱼线',1);assert.equal(m.submitQuestFish('main-2',0,m.boxes[0].items[0].id).ok,false);
 m.boxes[1].items=[{...item,x:0,y:0}];assert.equal(m.submitQuestFish('main-2',1,item.id).ok,false);const before=m.serialize();assert.equal(m.submitQuestCoins('side-1').ok,false);assert.deepEqual(m.serialize(),before);
});
test('side quest unlocks after main 2, exact price, two item rewards, merge first and one-time submission',()=>{
 const m=new PlayerStorage();assert.equal(m.submitQuestCoins('side-1').ok,false);m.quests.mainCompleted=2;m.setCoins(29);assert.equal(m.submitQuestCoins('side-1').ok,false);
 m.setCoins(100);m.receiveGoods('2号亮片',95);assert.equal(m.submitQuestCoins('side-1').ok,true);assert.equal(m.coins,70);assert.equal(quantity(m,'3号鱼线'),1);assert.equal(quantity(m,'2号亮片'),105);assert.deepEqual(m.boxes[0].items.filter(i=>i.name==='2号亮片').map(i=>i.quantity),[100,5]);
 const before=m.serialize();assert.equal(m.submitQuestCoins('side-1').ok,false);assert.deepEqual(m.serialize(),before);
});
test('full reward storage cancels all grants, coin debit, progress and IDs, with no partial rewards',()=>{
 const m=new PlayerStorage();m.quests.mainCompleted=2;m.setCoins(100);m.receiveGoods('1号鱼线',99);const before=m.serialize();assert.equal(m.submitQuestCoins('side-1').ok,false);assert.deepEqual(m.serialize(),before);assert.equal(quantity(m,'3号鱼线'),0);
});
test('coin overflow cancels final fish donation and progress without consuming fish',()=>{
 const m=new PlayerStorage();m.quests.mainCompleted=1;m.setCoins(Number.MAX_SAFE_INTEGER);const item=fish(m,'草鱼'),before=m.serialize();assert.equal(m.submitQuestFish('main-2',0,item.id).ok,false);assert.deepEqual(m.serialize(),before);
});
test('saving failure rolls back partial fish donation, finishing rewards and side payment together',()=>{
 for(const [completed,count,side]of [[2,0,false],[2,2,false],[2,0,true]]){
  const m=new PlayerStorage();m.quests.mainCompleted=completed;m.quests.counts=[count,0];m.setCoins(100);const item=fish(m,'蓝鳃太阳鱼'),io=memory();io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));const store=createPlayerStorage({storage:io});const before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;
  const result=side?store.run('submitQuestCoins',['side-1']):store.run('submitQuestFish',['main-3',0,item.id]);assert.equal(result.ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);
 }
});
test('partial progress survives reload/clear; three slots isolate progress and new slots start locked',()=>{
 const io=memory();let slots=createSaveSlots({storage:io});const m=new PlayerStorage();m.quests.mainCompleted=3;submit(m,'草鱼');m.quests.side1Done=true;slots.storage.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));assert.equal(slots.create().ok,true);
 slots=createSaveSlots({storage:io});let store=createPlayerStorage({storage:slots.storage});assert.equal(shopUnlocked(store.model.quests),false);store.run('setCoins',[123]);assert.equal(slots.create().ok,true);
 slots=createSaveSlots({storage:io});assert.equal(shopUnlocked(createPlayerStorage({storage:slots.storage}).model.quests),false);slots.select('1');slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});assert.deepEqual(store.model.quests.counts,[1,0]);store.run('clearAll');assert.deepEqual(store.model.quests,{version:1,mainCompleted:3,counts:[1,0],side1Done:true});assert.equal(new PlayerStorage(JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY))).quests.mainCompleted,3);
});
test('invalid quest saves fail closed instead of losing unlocks or allowing repeated rewards',()=>{
 const valid={version:1,mainCompleted:2,counts:[1,0],side1Done:false};
 for(const change of [{mainCompleted:-1},{mainCompleted:6},{mainCompleted:1.5},{counts:[3,0]},{counts:[0,-1]},{counts:[0]},{side1Done:'yes'},{version:2},{mainCompleted:0,side1Done:true}])assert.throws(()=>restoreQuests({...valid,...change}),/任务资料异常/);
});
