import {FISH_DATA,FISH_QUALITIES} from './fish-data.js';
const fishByName=Object.fromEntries(FISH_DATA.map(f=>[f.name,f]));
const requirement=(count,label,extra={})=>Object.freeze({count,label,...extra});
export const MAIN_QUESTS=Object.freeze([
  {id:'main-1',title:'主线 · 任务1',requirements:[requirement(1,'赠送任意一条鱼')]},
  {id:'main-2',title:'主线 · 任务2',requirements:[requirement(1,'赠送任意一条占格 ≥ 3 的鱼',{minArea:3})]},
  {id:'main-3',title:'主线 · 任务3',requirements:[requirement(3,'赠送3条品质 ≥ green 的鱼',{minQuality:'green'})]},
  {id:'main-4',title:'主线 · 任务4',requirements:[requirement(10,'赠送10条品质 ≥ light green 的鱼',{minQuality:'light green'}),requirement(1,'另外赠送1条品质 ≥ turquoise 的鱼',{minQuality:'turquoise'})]},
  {id:'main-5',title:'主线 · 任务5',requirements:[requirement(1,'赠送一条品质 ≥ indigo 的鱼',{minQuality:'indigo'})]}
].map(q=>Object.freeze({...q,requirements:Object.freeze(q.requirements)})));
export const SIDE_QUEST=Object.freeze({id:'side-1',title:'支线1 · 任务1',coins:30});
export const currentQuest=state=>MAIN_QUESTS[state.mainCompleted]??null;
// Claimed rewards are a permanent prefix; the playable progress can move backwards.
export const rewardedMain=state=>state.mainRewarded===undefined?state.mainCompleted:state.mainRewarded;
export const shopUnlocked=state=>rewardedMain(state)>=1;
export const secondShopUnlocked=state=>rewardedMain(state)>=4;
export const sideQuestUnlocked=state=>rewardedMain(state)>=2;
export function setMainProgress(state,completed,rewarded){
  state.mainCompleted=completed;state.counts=[0,0];
  if(rewarded>completed)state.mainRewarded=rewarded;else delete state.mainRewarded;
}
export function restoreQuests(raw){
  if(raw===undefined)return {version:1,mainCompleted:0,counts:[0,0],side1Done:false};
  const fail=()=>{throw Error('店主任务资料异常，已停止加载以保护存档。');};
  if(!raw||raw.version!==1||!Number.isInteger(raw.mainCompleted)||raw.mainCompleted<0||raw.mainCompleted>MAIN_QUESTS.length||typeof raw.side1Done!=='boolean'||!Array.isArray(raw.counts)||raw.counts.length!==2)fail();
  const quest=currentQuest(raw);
  for(let i=0;i<2;i++)if(!Number.isInteger(raw.counts[i])||raw.counts[i]<0||raw.counts[i]>(quest?.requirements[i]?.count??0))fail();
  if(quest&&quest.requirements.every((r,i)=>raw.counts[i]===r.count))fail();
  const rewarded=rewardedMain(raw);
  if(!Number.isInteger(rewarded)||rewarded<raw.mainCompleted||rewarded>MAIN_QUESTS.length)fail();
  return {version:1,mainCompleted:raw.mainCompleted,counts:[...raw.counts],side1Done:raw.side1Done,...(rewarded>raw.mainCompleted?{mainRewarded:rewarded}:{})};
}
export const hasQuestProgress=state=>rewardedMain(state)>0||state.counts.some(Boolean)||state.side1Done;
export function giftRequirement(state,questId,name){
  const quest=currentQuest(state),fish=Object.hasOwn(fishByName,name)?fishByName[name]:null;
  if(!quest||quest.id!==questId||!fish)return -1;
  // Reserve the additional high-quality fish first; no fish counts toward both goals.
  for(let i=quest.requirements.length-1;i>=0;i--){
    const r=quest.requirements[i];if(state.counts[i]>=r.count)continue;
    if(r.minArea&&fish.inventory.h*fish.inventory.w<r.minArea)continue;
    if(r.minQuality&&FISH_QUALITIES.indexOf(fish.quality)<FISH_QUALITIES.indexOf(r.minQuality))continue;
    return i;
  }
  return -1;
}
// Rewards stay out of task descriptions and are granted with the whole submission transaction.
export function questReward(id){
  return {'main-1':{},'main-2':{coins:25},'main-3':{items:[['2号亮片',10]]},'main-4':{items:[['3号鱼线',1]]},'main-5':{coins:100},'side-1':{items:[['3号鱼线',1],['2号亮片',10]]}}[id];
}
