import {currentQuest,SIDE_QUEST,MAIN_QUESTS,giftRequirement,sideQuestUnlocked} from './quest-rules.js';
import {OWNER_NAMES,SHOP_TRACKS,shopProgress,shopSidesUnlocked,ownerAvailable,findShopQuest,activeShopQuest} from './shop-progression.js';
import {createFishCard} from './item-card.js';
import {ITEMS} from './item-data.js';
import {sizeBackpackGrid} from './backpack-upgrades.js';
export function createShopQuests({store,onClose}){
 const dialog=document.querySelector('#quest-dialog'),list=document.querySelector('#quest-list'),status=document.querySelector('#quest-status');
 const warehouse=document.querySelector('#quest-warehouse-dialog'),bag=document.querySelector('#quest-bag'),grid=document.querySelector('#quest-grid'),tabs=document.querySelector('#quest-box-tabs'),hint=document.querySelector('#quest-gift-status');
 const confirm=document.querySelector('#quest-coins-dialog'),coinStatus=document.querySelector('#quest-coins-status'),ownerNav=document.querySelector('#quest-owner-nav'),hackHint=document.querySelector('#quest-hack-hint');
 let owner='starter',hack=false,questId=null,coinQuestId=null,selected=null,cleanups=[];
 function cleanup(){for(const stop of cleanups)stop();cleanups=[];}
 function currentTasks(){const state=store.model.quests;if(owner==='starter')return [currentQuest(state),sideQuestUnlocked(state)&&!state.side1Done?SIDE_QUEST:null].filter(Boolean);if(owner!=='shop')return [];const progress=shopProgress(state);return Object.entries(SHOP_TRACKS).filter(([track])=>track==='main'||shopSidesUnlocked(state)).map(([track,quests])=>quests[progress[track].completed]).filter(Boolean);}
 function questFor(id){if(owner==='shop')return findShopQuest(id)?.quest;return [...MAIN_QUESTS,SIDE_QUEST].find(q=>q.id===id);}
 function countsFor(id){const found=findShopQuest(id);return found?[shopProgress(store.model.quests)[found.track].count]:store.model.quests.counts;}
 function done(id){const state=store.model.quests,found=findShopQuest(id);return found?found.index<shopProgress(state)[found.track].completed:id===SIDE_QUEST.id?state.side1Done:MAIN_QUESTS.findIndex(q=>q.id===id)<state.mainCompleted;}
 function row(quest){
  const element=document.createElement(hack?'button':'article');element.className='quest-row'+(hack?' quest-hack-row':'');
  if(hack){element.type='button';element.dataset.jumpQuest=quest.id;}else element.dataset.quest=quest.id;
  const info=document.createElement('div'),title=document.createElement('h3');title.textContent=quest.title;info.append(title);
  const descriptions=quest.coins?[`赠送${quest.coins}金币`]:quest.requirements.map((r,i)=>hack?r.label:`${r.label}（${countsFor(quest.id)[i]} / ${r.count}）`);
  for(const text of descriptions){const p=document.createElement('p');p.textContent=text;info.append(p);}
  const action=document.createElement(hack?'span':'button');action.textContent=hack?(done(quest.id)?'已完成 · 可回到此处':'跳转并完成'):'提交';
  if(!hack){action.type='button';action.dataset.submitQuest=quest.id;}element.append(info,action);return element;
 }
 function renderTasks(){
  if(!dialog.open)return;list.replaceChildren();
  const quests=hack?(owner==='starter'?[...MAIN_QUESTS,SIDE_QUEST]:owner==='shop'?Object.values(SHOP_TRACKS).flat():[]):currentTasks();
  for(const quest of quests)list.append(row(quest));
  if(!list.childElementCount){const p=document.createElement('p');p.textContent=['cave','soda'].includes(owner)?'暂时没有任务':'所有任务已完成';list.append(p);}
 }
 function cells(element,w,h){element.style.setProperty('--bag-columns',w);element.style.setProperty('--bag-rows',h);element.replaceChildren();for(let y=0;y<h;y++)for(let x=0;x<w;x++){const cell=document.createElement('div');cell.className='inventory-cell';cell.style.gridColumn=x+1;cell.style.gridRow=y+1;element.append(cell);}}
 function giftCard(item,source){
  const eligible=source!=='bag'&&giftRequirement(store.model.quests,questId,item.name)>=0;let element;
  if(eligible){const view=createFishCard(item,{canRetry:()=>false});element=view.element;cleanups.push(view.dispose);element.title='点击选中，再次点击赠送';element.setAttribute('aria-label',`${item.name}，点击选中，再次点击赠送`);}
  else{const meta=ITEMS[item.name];element=document.createElement('button');element.type='button';element.className='inventory-fish quest-blocked-item';element.style.gridColumn=`${item.x+1} / span ${meta.w}`;element.style.gridRow=`${item.y+1} / span ${meta.h}`;element.setAttribute('aria-disabled','true');element.setAttribute('aria-label','不可赠送的物品');}
  element.dataset.giftId=item.id;element.dataset.giftSource=source;element.dataset.eligible=String(eligible);element.classList.toggle('gift-selected',selected===item.id);return element;
 }
 function renderWarehouse(){
  if(!warehouse.open)return;cleanup();const model=store.model;sizeBackpackGrid(bag,model.inventory,document.querySelector('#quest-bag-size'));cells(bag,model.inventory.width,model.inventory.height);cells(grid,10,10);
  for(const item of model.inventory.items.filter(i=>i.x!==null))bag.append(giftCard(item,'bag'));for(const item of model.boxes[model.activeBox].items)grid.append(giftCard(item,model.activeBox));
  tabs.replaceChildren();model.boxes.forEach((box,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(box.unlocked?'▣':'🔒')+' '+(i+1);b.dataset.giftBox=i;b.className='warehouse-tab';b.disabled=!box.unlocked;b.setAttribute('aria-pressed',String(i===model.activeBox));b.setAttribute('aria-label',`箱子 ${i+1}`);tabs.append(b);});
  document.querySelector('#quest-box-title').textContent=`箱子 ${model.activeBox+1}`;const quest=questFor(questId),active=findShopQuest(questId)?activeShopQuest(model.quests,questId):currentQuest(model.quests)?.id===questId;
  document.querySelector('#quest-gift-progress').textContent=quest&&active?quest.requirements.map((r,i)=>`${r.label}：${countsFor(questId)[i]}/${r.count}`).join(' · '):'';
 }
 function select(id){selected=id;for(const card of warehouse.querySelectorAll('[data-gift-id]'))card.classList.toggle('gift-selected',card.dataset.giftId===id);}
 list.addEventListener('click',event=>{
  if(hack){const button=event.target.closest('[data-jump-quest]');if(!button)return;const result=store.run('hackQuest',[owner,button.dataset.jumpQuest]);status.textContent=result.ok?(result.unchanged?'该任务已完成，未重复发奖。':'任务进度已保存；尚未领取的奖励已补发。'):result.error;if(result.ok)list.querySelector(`[data-jump-quest="${button.dataset.jumpQuest}"]`)?.focus({preventScroll:true});return;}
  const button=event.target.closest('[data-submit-quest]');if(!button)return;status.textContent='';const quest=questFor(button.dataset.submitQuest);if(!quest)return;
  if(quest.coins){coinQuestId=quest.id;coinStatus.textContent='';document.querySelector('#quest-coins-question').textContent=`确认赠送${quest.coins}金币？`;document.querySelector('#quest-coins-submit').textContent=`确认赠送 · ${quest.coins} 金币`;confirm.showModal();return;}
  questId=quest.id;select(null);hint.textContent='只可赠送已解锁仓库内的鱼；点一次选中，再点同一条鱼上交。可随时关闭，已提交进度会保留。';warehouse.showModal();renderWarehouse();
 });
 warehouse.addEventListener('click',event=>{
  const button=event.target.closest('[data-gift-id]');if(!button||button.dataset.eligible!=='true'){select(null);return;}
  if(selected!==button.dataset.giftId){if(selected){select(null);return;}select(button.dataset.giftId);hint.textContent='再次点击绿框中的这条鱼即可上交；点击其他位置取消。';return;}
  const id=selected;select(null);const result=store.run('submitQuestFish',[questId,Number(button.dataset.giftSource),id]);if(!result.ok){hint.textContent=result.error;return;}if(result.completed){warehouse.close();status.textContent='任务已完成。';}else hint.textContent='已上交并保存进度，可以继续选择或关闭。';
 });
 tabs.addEventListener('click',event=>{const button=event.target.closest('[data-gift-box]');if(!button||button.disabled)return;select(null);const result=store.run('selectBox',[Number(button.dataset.giftBox)]);if(!result.ok)hint.textContent=result.error;});
 ownerNav.addEventListener('click',event=>{const button=event.target.closest('[data-quest-owner]');if(!button)return;owner=button.dataset.questOwner;updateOwner();status.textContent='';renderTasks();});
 function updateOwner(){document.querySelector('#quest-owner-name').textContent=OWNER_NAMES[owner];for(const button of ownerNav.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.questOwner===owner));}
 document.querySelector('#quest-close').addEventListener('click',()=>dialog.close());document.querySelector('#quest-gift-close').addEventListener('click',()=>warehouse.close());document.querySelector('#quest-coins-cancel').addEventListener('click',()=>confirm.close());
 document.querySelector('#quest-coins-form').addEventListener('submit',event=>{event.preventDefault();const result=store.run('submitQuestCoins',[coinQuestId]);if(!result.ok){coinStatus.textContent=result.error;return;}confirm.close();status.textContent='任务已完成。';});
 warehouse.addEventListener('close',()=>{cleanup();select(null);questId=null;onClose();});confirm.addEventListener('close',()=>{coinQuestId=null;onClose();});dialog.addEventListener('close',()=>{onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#settings-toggle').focus({preventScroll:true});});
 store.subscribe(()=>{renderTasks();renderWarehouse();});
 return {open(value,{admin=false}={}){if(!Object.hasOwn(OWNER_NAMES,value)||!admin&&!ownerAvailable(store.model.quests,value))return;owner=value;hack=admin;ownerNav.hidden=!hack;hackHint.hidden=!hack;dialog.classList.toggle('quest-hack',hack);updateOwner();status.textContent='';dialog.showModal();renderTasks();if(hack)ownerNav.querySelector('[aria-pressed="true"]').focus({preventScroll:true});}};
}
