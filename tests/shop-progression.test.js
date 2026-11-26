import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage,PLAYER_STORAGE_KEY} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {createMapEntry} from '../map-entry.js';
import {SHOP_ITEMS} from '../item-data.js';
import {restoreQuests} from '../quest-rules.js';
import {SHOP_TRACKS,shopProgress,restoreShopProgress,productUnlocked,mapUnlocked,caveOwnerKnown,sodaShopUnlocked,shopGiftRequirement} from '../shop-progression.js';
const memory=()=>{const data=new Map();return {blocked:false,getItem:k=>data.get(k)??null,setItem(k,v){if(this.blocked)throw Error('quota');data.set(k,v);},removeItem:k=>data.delete(k)};};
const fixture=()=>{const m=new PlayerStorage();m.quests.mainCompleted=4;m.coins=100;return m;};
const count=(m,name)=>m.boxes.flatMap(b=>b.items).filter(i=>i.name===name).reduce((n,i)=>n+(i.quantity??1),0);
function fish(m,name){const result=m.giveFish(name);assert.equal(result.ok,true);return result;}
function donate(m,id,name,n=1){let result;for(let i=0;i<n;i++){const f=fish(m,name);result=m.submitQuestFish(id,f.box,f.item.id);assert.equal(result.ok,true,JSON.stringify(result));}return result;}

test('exact shop task requirements and rewards match all seven main and three side steps',()=>{
 assert.deepEqual(Object.values(SHOP_TRACKS).map(a=>a.length),[7,1,2]);
 assert.deepEqual(SHOP_TRACKS.main.map(q=>[q.coins??0,q.requirements[0]?.count??0,q.requirements[0]?.minArea??0,q.requirements[0]?.minQuality??'',q.requirements[0]?.minPrice??0,q.reward]),[
  [60,0,0,'',0,{}],[0,5,2,'',0,{coins:40}],[0,4,0,'turquoise',0,{items:[['5号鱼线',1]]}],[0,3,0,'indigo',0,{items:[['5号假饵',10]],coins:65}],[0,1,3,'dark purple',0,{items:[['5号假饵',5]],coins:30}],[0,2,0,'pink',0,{coins:200}],[0,3,0,'',48,{coins:200}]
 ]);
 assert.deepEqual(SHOP_TRACKS.side1[0].requirements,[{count:1,minArea:6,label:'赠送1条占格 ≥ 6 的鱼'}]);assert.deepEqual(SHOP_TRACKS.side1[0].reward,{coins:45});assert.equal(SHOP_TRACKS.side2[0].requirements[0].minQuality,'light green');assert.equal(SHOP_TRACKS.side2[0].requirements[0].count,4);assert.deepEqual(SHOP_TRACKS.side2[0].reward,{items:[['5号假饵',5]]});assert.equal(SHOP_TRACKS.side2[1].requirements[0].minPrice,81);
});
test('legacy assets and starter progress stay intact while shop stock and three maps re-lock; initialization is idempotent',()=>{
 const old=fixture();old.inventory.level=6;old.receiveGoods('5号假饵',17);old.receiveGoods('6号鱼线',1);const line=old.boxes[0].items.find(i=>i.name==='6号鱼线');old.equip(line.id,0,'line');old.equipment.line.lineWear=17;old.addFish('草鱼');const raw=old.serialize();assert.equal(raw.storage.quests.shop,undefined);
 const m=new PlayerStorage(raw);assert.deepEqual(m.serialize(),raw);assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),raw);assert.equal(m.quests.mainCompleted,4);assert.equal(m.equipment.line.lineWear,17);assert.equal(m.inventory.level,6);
 for(const p of SHOP_ITEMS.filter(p=>p.shop==='shop'))assert.equal(productUnlocked(m.quests,p),false);for(const id of ['amazon-confluence','amazon-flooded-forest','sac-actun'])assert.equal(mapUnlocked(m.quests,id),false);assert.equal(mapUnlocked(m.quests,'summer-pond'),true);assert.equal(m.buy('5号假饵',1).ok,false);
 const newProfile=new PlayerStorage();assert.equal(newProfile.submitQuestCoins('shop-main-1').ok,false);assert.equal(newProfile.quests.mainCompleted,0);
});
test('normal main and independent side chains grant exact rewards and unlock only the approved milestones',()=>{
 const m=fixture();assert.equal(m.submitQuestCoins('shop-main-1').ok,true);assert.equal(m.coins,40);assert.equal(mapUnlocked(m.quests,'amazon-confluence'),true);assert.equal(mapUnlocked(m.quests,'amazon-flooded-forest'),false);
 for(const p of SHOP_ITEMS.filter(p=>p.shop==='shop'))assert.equal(productUnlocked(m.quests,p),p.id!=='LURE_5');
 assert.equal(shopGiftRequirement(m.quests,'shop-main-2','金色闪光鲦'),-1);assert.equal(shopGiftRequirement(m.quests,'shop-side1-1','大口黑鲈'),-1);donate(m,'shop-main-2','罗非鱼',5);assert.equal(m.coins,80);
 assert.equal(shopGiftRequirement(m.quests,'shop-main-3','草鱼'),-1);donate(m,'shop-side1-1','大口黑鲈');assert.equal(m.coins,125);donate(m,'shop-main-3','地图鱼',4);assert.equal(count(m,'5号鱼线'),1);assert.equal(mapUnlocked(m.quests,'amazon-flooded-forest'),true);
 donate(m,'shop-side2-1','草鱼',4);assert.equal(count(m,'5号假饵'),5);assert.equal(m.buy('5号假饵',1).ok,false);assert.equal(shopGiftRequirement(m.quests,'shop-side2-2','佛罗里达雀鳝'),-1);donate(m,'shop-side2-2','乌鳢');assert.equal(mapUnlocked(m.quests,'sac-actun'),true);assert.equal(caveOwnerKnown(m.quests),true);
 donate(m,'shop-main-4','红鳍狗鱼',3);assert.equal(m.coins,190);assert.equal(count(m,'5号假饵'),15);assert.equal(shopGiftRequirement(m.quests,'shop-main-5','斑鳢'),-1);assert.equal(shopGiftRequirement(m.quests,'shop-main-5','孔雀鲈'),-1);donate(m,'shop-main-5','链纹狗鱼');assert.equal(m.coins,220);assert.equal(count(m,'5号假饵'),20);
 assert.equal(shopGiftRequirement(m.quests,'shop-main-6','长吻雀鳝'),-1);donate(m,'shop-main-6','黑龙鱼',2);assert.equal(m.coins,420);assert.equal(SHOP_ITEMS.filter(p=>p.shop==='shop').every(p=>productUnlocked(m.quests,p)),true);
 assert.equal(shopGiftRequirement(m.quests,'shop-main-7','孔雀鲈'),-1);assert.equal(shopGiftRequirement(m.quests,'shop-main-7','杰克登普西慈鲷'),0);donate(m,'shop-main-7','杰克登普西慈鲷',3);assert.equal(m.coins,620);assert.equal(sodaShopUnlocked(m.quests),true);assert.equal(m.quests.mainCompleted,4);assert.deepEqual(new PlayerStorage(m.serialize()).serialize(),m.serialize());
});
test('only warehouse fish count; each fish is consumed once, invalid targets and money bypasses cannot advance a task',()=>{
 const m=fixture();m.submitQuestCoins('shop-main-1');const f=fish(m,'罗非鱼');const before=m.serialize();assert.equal(m.submitQuestFish('shop-main-3',f.box,f.item.id).ok,false);assert.equal(m.submitQuestCoins('shop-main-2').ok,false);assert.deepEqual(m.serialize(),before);assert.equal(m.submitQuestFish('shop-main-2',f.box,f.item.id).ok,true);const after=m.serialize();assert.equal(m.submitQuestFish('shop-main-2',f.box,f.item.id).ok,false);assert.deepEqual(m.serialize(),after);
 const bag=m.addFish('罗非鱼').item;assert.equal(m.submitQuestFish('shop-main-2','bag',bag.id).ok,false);assert.equal(m.submitQuestFish('shop-main-2',0,bag.id).ok,false);m.boxes[1].items=[{id:'999',name:'罗非鱼',x:0,y:0}];assert.equal(m.submitQuestFish('shop-main-2',1,'999').ok,false);
 const poor=fixture();poor.coins=59;assert.equal(poor.submitQuestCoins('shop-main-1').ok,false);assert.equal(poor.coins,59);assert.equal(shopProgress(poor.quests).main.rewarded,0);
});
test('owner hack keeps tracks separate and claims rewards once even after rewinding and ordinary replay',()=>{
 const m=fixture();m.coins=0;assert.equal(m.hackQuest('shop','shop-side2-2').ok,true);assert.equal(m.coins,0);assert.equal(shopProgress(m.quests).main.completed,0);assert.equal(shopProgress(m.quests).side1.completed,0);assert.equal(caveOwnerKnown(m.quests),true);assert.equal(count(m,'5号假饵'),5);
 assert.equal(m.hackQuest('shop','shop-main-7').ok,true);assert.equal(m.coins,535);assert.equal(count(m,'5号鱼线'),1);assert.equal(count(m,'5号假饵'),20);assert.equal(shopProgress(m.quests).side1.completed,0);const before=m.serialize();assert.equal(m.hackQuest('shop','shop-main-7').unchanged,true);assert.deepEqual(m.serialize(),before);
 m.hackQuest('shop','shop-main-1');assert.equal(shopProgress(m.quests).main.completed,1);assert.equal(sodaShopUnlocked(m.quests),true);assert.equal(mapUnlocked(m.quests,'amazon-flooded-forest'),true);donate(m,'shop-main-2','罗非鱼',5);assert.equal(m.coins,535);m.hackQuest('shop','shop-main-7');assert.equal(m.coins,535);assert.equal(count(m,'5号假饵'),20);m.clearAll();assert.equal(shopProgress(m.quests).main.rewarded,7);assert.equal(caveOwnerKnown(m.quests),true);
});
test('full storage and overflow cancel multi-step grants without any partial reward, progress or item-ID mutation',()=>{
 for(const mode of ['full','overflow']){const m=fixture();if(mode==='full')m.receiveGoods('1号鱼线',100);else m.coins=Number.MAX_SAFE_INTEGER-100;const before=m.serialize();assert.equal(m.hackQuest('shop','shop-main-7').ok,false);assert.deepEqual(m.serialize(),before);}
 const m=fixture();m.submitQuestCoins('shop-main-1');donate(m,'shop-main-2','罗非鱼',4);m.coins=Number.MAX_SAFE_INTEGER;const f=fish(m,'罗非鱼'),before=m.serialize();assert.equal(m.submitQuestFish('shop-main-2',f.box,f.item.id).ok,false);assert.deepEqual(m.serialize(),before);
});
test('failed persistence cancels coin gifts, partial/final fish gifts and administrator rewards atomically',()=>{
 for(const mode of ['coins','partial','final','hack']){const m=fixture();let method='submitQuestCoins',args=['shop-main-1'];if(['partial','final'].includes(mode)){m.submitQuestCoins('shop-main-1');if(mode==='final')donate(m,'shop-main-2','罗非鱼',4);const f=fish(m,'罗非鱼');method='submitQuestFish';args=['shop-main-2',f.box,f.item.id];}if(mode==='hack'){method='hackQuest';args=['shop','shop-main-7'];}const io=memory();io.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));const store=createPlayerStorage({storage:io}),before=store.snapshot(),disk=io.getItem(PLAYER_STORAGE_KEY);io.blocked=true;assert.equal(store.run(method,args).ok,false);assert.deepEqual(store.snapshot(),before);assert.equal(io.getItem(PLAYER_STORAGE_KEY),disk);}
});
test('partial new progress survives reload and clear, three saves isolate it, corrupt records fail closed',()=>{
 const io=memory();let slots=createSaveSlots({storage:io});const m=fixture();m.submitQuestCoins('shop-main-1');donate(m,'shop-main-2','罗非鱼',2);slots.storage.setItem(PLAYER_STORAGE_KEY,JSON.stringify(m.serialize()));slots.create();slots=createSaveSlots({storage:io});assert.equal(shopProgress(createPlayerStorage({storage:slots.storage}).model.quests).main.completed,0);slots.select('1');slots=createSaveSlots({storage:io});const store=createPlayerStorage({storage:slots.storage});assert.equal(shopProgress(store.model.quests).main.count,2);store.run('clearAll');assert.equal(shopProgress(store.model.quests).main.count,2);assert.equal(new PlayerStorage(JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY))).quests.shop.main.count,2);
 for(const change of [{version:2},{main:{completed:8,rewarded:8,count:0}},{main:{completed:2,rewarded:1,count:0}},{main:{completed:1,rewarded:1,count:5}},{side2:{completed:2,rewarded:2,count:1}}])assert.throws(()=>restoreQuests({...m.quests,shop:{...restoreShopProgress(),...change}}),/任务资料异常/);
});
test('locked map entry rejects before creating a scene or charging, and claimed map unlocks survive rewind',async()=>{
 const m=fixture();let prepares=0;const entry=createMapEntry({store:{model:m,run:(method,args)=>m[method](...args)},isUnlocked:id=>mapUnlocked(m.quests,id),prepare:async()=>{prepares++;return {};},activate(){},rollback(){}});await assert.rejects(entry.enter('sac-actun'),/尚未解锁/);assert.equal(prepares,0);assert.equal(m.coins,100);m.hackQuest('shop','shop-side2-2');await entry.enter('sac-actun');assert.equal(prepares,1);m.hackQuest('shop','shop-side2-1');await entry.enter('sac-actun');assert.equal(prepares,2);assert.equal(m.coins,10);
});
