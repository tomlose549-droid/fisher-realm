import {FISH_DATA,FISH_QUALITIES} from './fish-data.js';
const fishByName=Object.fromEntries(FISH_DATA.map(f=>[f.name,f]));
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const OWNER_NAMES=freeze({starter:"starter's shop owner",shop:'shop owner',soda:'soda shop owner',cave:'cave owner'});
export const SHOP_TRACKS=freeze({
 main:[
  {id:'shop-main-1',title:'主线 · 任务1',coins:60,requirements:[],reward:{}},
  {id:'shop-main-2',title:'主线 · 任务2',requirements:[{count:5,minArea:2,label:'赠送任意5条占格 ≥ 2 的鱼'}],reward:{coins:40}},
  {id:'shop-main-3',title:'主线 · 任务3',requirements:[{count:4,minQuality:'turquoise',label:'赠送4条品质 ≥ turquoise 的鱼'}],reward:{items:[['5号鱼线',1]]}},
  {id:'shop-main-4',title:'主线 · 任务4',requirements:[{count:3,minQuality:'indigo',label:'赠送3条品质 ≥ indigo 的鱼'}],reward:{items:[['5号假饵',10]],coins:65}},
  {id:'shop-main-5',title:'主线 · 任务5',requirements:[{count:1,minQuality:'dark purple',minArea:3,label:'赠送1条品质 ≥ dark purple 且占格 ≥ 3 的鱼'}],reward:{items:[['5号假饵',5]],coins:30}},
  {id:'shop-main-6',title:'主线 · 任务6',requirements:[{count:2,minQuality:'pink',label:'赠送2条品质 ≥ pink 的鱼'}],reward:{coins:200}},
  {id:'shop-main-7',title:'主线 · 任务7',requirements:[{count:3,minPrice:48,label:'赠送3条每条价值 ≥ 48 金币的鱼'}],reward:{coins:200}}
 ],
 side1:[{id:'shop-side1-1',title:'支线1 · 任务1',requirements:[{count:1,minArea:6,label:'赠送1条占格 ≥ 6 的鱼'}],reward:{coins:45}}],
 side2:[
  {id:'shop-side2-1',title:'支线2 · 任务1',requirements:[{count:4,minQuality:'light green',label:'赠送4条品质 ≥ light green 的鱼'}],reward:{items:[['5号假饵',5]]}},
  {id:'shop-side2-2',title:'支线2 · 任务2',requirements:[{count:1,minPrice:81,label:'赠送1条价值 ≥ 81 金币的鱼'}],reward:{}}
 ]
});
const EMPTY=freeze({version:1,main:{completed:0,rewarded:0,count:0},side1:{completed:0,rewarded:0,count:0},side2:{completed:0,rewarded:0,count:0}});
export const shopProgress=quests=>quests?.shop??EMPTY;
export function restoreShopProgress(raw){
 if(raw===undefined)return structuredClone(EMPTY);
 const fail=()=>{throw Error('shop店主任务资料异常，已停止加载以保护存档。');};
 if(!raw||raw.version!==1)fail();
 const next={version:1};
 for(const [track,quests]of Object.entries(SHOP_TRACKS)){
  const s=raw[track];if(!s||!Number.isInteger(s.completed)||s.completed<0||s.completed>quests.length||!Number.isInteger(s.rewarded)||s.rewarded<s.completed||s.rewarded>quests.length||!Number.isInteger(s.count)||s.count<0)fail();
  const q=quests[s.completed],limit=q?.requirements[0]?.count??0;
  if(limit?s.count>=limit:s.count!==0)fail();next[track]={completed:s.completed,rewarded:s.rewarded,count:s.count};
 }
 return next;
}
export function findShopQuest(id){for(const [track,list]of Object.entries(SHOP_TRACKS)){const index=list.findIndex(q=>q.id===id);if(index>=0)return {track,index,quest:list[index]};}return null;}
export const starterUnlocked=quests=>(quests?.mainRewarded??quests?.mainCompleted??0)>=1;
export const shopPageUnlocked=quests=>(quests?.mainRewarded??quests?.mainCompleted??0)>=4;
export const shopSidesUnlocked=quests=>shopProgress(quests).main.rewarded>=2;
export const sodaShopUnlocked=quests=>shopPageUnlocked(quests)&&shopProgress(quests).main.rewarded>=7;
export const caveOwnerKnown=quests=>shopProgress(quests).side2.rewarded>=2;
export function productUnlocked(quests,product){return product.shop==='shop'?shopPageUnlocked(quests)&&shopProgress(quests).main.rewarded>=(product.id==='LURE_5'?6:1):product.shop==='starter'&&starterUnlocked(quests);}
export function mapUnlocked(quests,id){return id==='summer-pond'||id==='amazon-confluence'&&shopProgress(quests).main.rewarded>=1||id==='amazon-flooded-forest'&&shopProgress(quests).main.rewarded>=3||id==='sac-actun'&&caveOwnerKnown(quests);}
export function ownerAvailable(quests,owner){return owner==='starter'||owner==='shop'&&shopPageUnlocked(quests)||owner==='soda'&&sodaShopUnlocked(quests)||owner==='cave'&&caveOwnerKnown(quests);}
export function activeShopQuest(quests,id){const found=findShopQuest(id);if(!found||!shopPageUnlocked(quests)||found.track!=='main'&&!shopSidesUnlocked(quests))return null;return shopProgress(quests)[found.track].completed===found.index?found:null;}
export function shopGiftRequirement(quests,id,name){const found=activeShopQuest(quests,id),fish=Object.hasOwn(fishByName,name)?fishByName[name]:null,r=found?.quest.requirements[0];if(!r||!fish)return -1;if(r.minArea&&fish.inventory.h*fish.inventory.w<r.minArea||r.minQuality&&FISH_QUALITIES.indexOf(fish.quality)<FISH_QUALITIES.indexOf(r.minQuality)||r.minPrice&&(fish.sellPrice??0)<r.minPrice)return -1;return 0;}
