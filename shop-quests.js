import {currentQuest,SIDE_QUEST,giftRequirement,secondShopUnlocked} from './quest-rules.js';
import {createFishCard} from './item-card.js';
import {ITEMS} from './item-data.js';
import {sizeBackpackGrid} from './backpack-upgrades.js';
export function createShopQuests({store,onClose}){
  const dialog=document.querySelector('#quest-dialog'),list=document.querySelector('#quest-list'),status=document.querySelector('#quest-status');
  const warehouse=document.querySelector('#quest-warehouse-dialog'),bag=document.querySelector('#quest-bag'),grid=document.querySelector('#quest-grid'),tabs=document.querySelector('#quest-box-tabs'),hint=document.querySelector('#quest-gift-status');
  const confirm=document.querySelector('#quest-coins-dialog'),coinStatus=document.querySelector('#quest-coins-status');
  let owner='starter',questId=null,selected=null,cleanups=[];
  function cleanup(){for(const stop of cleanups)stop();cleanups=[];}
  function taskRow(quest){
    const row=document.createElement('article');row.className='quest-row';row.dataset.quest=quest.id;
    const info=document.createElement('div'),title=document.createElement('h3');title.textContent=quest.title;info.append(title);
    if(quest.coins){const p=document.createElement('p');p.textContent='赠送30金币';info.append(p);}
    else quest.requirements.forEach((r,i)=>{const p=document.createElement('p');p.textContent=`${r.label}（${store.model.quests.counts[i]} / ${r.count}）`;info.append(p);});
    const button=document.createElement('button');button.type='button';button.textContent='提交';button.dataset.submitQuest=quest.id;row.append(info,button);return row;
  }
  function renderTasks(){
    if(!dialog.open)return;list.replaceChildren();
    if(owner==='shop'){const p=document.createElement('p');p.textContent='暂时没有任务';list.append(p);return;}
    const state=store.model.quests,quest=currentQuest(state);if(quest)list.append(taskRow(quest));
    if(state.mainCompleted>=2&&!state.side1Done)list.append(taskRow(SIDE_QUEST));
    if(!list.childElementCount){const p=document.createElement('p');p.textContent='所有任务已完成';list.append(p);}
  }
  function cells(element,w,h){
    element.style.setProperty('--bag-columns',w);element.style.setProperty('--bag-rows',h);element.replaceChildren();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const cell=document.createElement('div');cell.className='inventory-cell';cell.style.gridColumn=x+1;cell.style.gridRow=y+1;element.append(cell);}
  }
  function giftCard(item,source){
    const eligible=source!=='bag'&&giftRequirement(store.model.quests,questId,item.name)>=0;
    let element;
    if(eligible){const view=createFishCard(item,{canRetry:()=>false});element=view.element;cleanups.push(view.dispose);element.title='点击选中，再次点击赠送';element.setAttribute('aria-label',`${item.name}，点击选中，再次点击赠送`);}
    else{const meta=ITEMS[item.name];element=document.createElement('button');element.type='button';element.className='inventory-fish quest-blocked-item';element.style.gridColumn=`${item.x+1} / span ${meta.w}`;element.style.gridRow=`${item.y+1} / span ${meta.h}`;element.setAttribute('aria-disabled','true');element.setAttribute('aria-label','不可赠送的物品');}
    element.dataset.giftId=item.id;element.dataset.giftSource=source;element.dataset.eligible=String(eligible);element.classList.toggle('gift-selected',selected===item.id);return element;
  }
  function renderWarehouse(){
    if(!warehouse.open)return;cleanup();const model=store.model;
    sizeBackpackGrid(bag,model.inventory,document.querySelector('#quest-bag-size'));cells(bag,model.inventory.width,model.inventory.height);cells(grid,10,10);
    for(const item of model.inventory.items.filter(i=>i.x!==null))bag.append(giftCard(item,'bag'));
    for(const item of model.boxes[model.activeBox].items)grid.append(giftCard(item,model.activeBox));
    tabs.replaceChildren();model.boxes.forEach((box,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(box.unlocked?'▣':'🔒')+' '+(i+1);b.dataset.giftBox=i;b.className='warehouse-tab';b.disabled=!box.unlocked;b.setAttribute('aria-pressed',String(i===model.activeBox));b.setAttribute('aria-label',`箱子 ${i+1}`);tabs.append(b);});
    document.querySelector('#quest-box-title').textContent=`箱子 ${model.activeBox+1}`;
    const quest=currentQuest(model.quests);document.querySelector('#quest-gift-progress').textContent=quest?.id===questId?quest.requirements.map((r,i)=>`${r.label}：${model.quests.counts[i]}/${r.count}`).join(' · '):'';
  }
  function select(id){selected=id;for(const card of warehouse.querySelectorAll('[data-gift-id]'))card.classList.toggle('gift-selected',card.dataset.giftId===id);}
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-submit-quest]');if(!button)return;status.textContent='';
    if(button.dataset.submitQuest===SIDE_QUEST.id){coinStatus.textContent='';confirm.showModal();return;}
    questId=button.dataset.submitQuest;select(null);hint.textContent='只可赠送已解锁仓库内的鱼；点一次选中，再点同一条鱼上交。可随时关闭，已提交进度会保留。';warehouse.showModal();renderWarehouse();
  });
  warehouse.addEventListener('click',event=>{
    const button=event.target.closest('[data-gift-id]');
    if(!button||button.dataset.eligible!=='true'){select(null);return;}
    if(selected!==button.dataset.giftId){if(selected){select(null);return;}select(button.dataset.giftId);hint.textContent='再次点击绿框中的这条鱼即可上交；点击其他位置取消。';return;}
    const id=selected;select(null);const result=store.run('submitQuestFish',[questId,Number(button.dataset.giftSource),id]);
    if(!result.ok){hint.textContent=result.error;return;}
    if(result.completed){warehouse.close();status.textContent='任务已完成。';}else hint.textContent='已上交并保存进度，可以继续选择或关闭。';
  });
  tabs.addEventListener('click',event=>{const button=event.target.closest('[data-gift-box]');if(!button||button.disabled)return;select(null);const result=store.run('selectBox',[Number(button.dataset.giftBox)]);if(!result.ok)hint.textContent=result.error;});
  document.querySelector('#quest-close').addEventListener('click',()=>dialog.close());
  document.querySelector('#quest-gift-close').addEventListener('click',()=>warehouse.close());
  document.querySelector('#quest-coins-cancel').addEventListener('click',()=>confirm.close());
  document.querySelector('#quest-coins-form').addEventListener('submit',event=>{event.preventDefault();const result=store.run('submitQuestCoins',[SIDE_QUEST.id]);if(!result.ok){coinStatus.textContent=result.error;return;}confirm.close();status.textContent='任务已完成。';});
  warehouse.addEventListener('close',()=>{cleanup();select(null);questId=null;onClose();});
  confirm.addEventListener('close',onClose);dialog.addEventListener('close',onClose);
  store.subscribe(()=>{renderTasks();renderWarehouse();});
  return {open(value){if(value==='shop'&&!secondShopUnlocked(store.model.quests))return;owner=value;document.querySelector('#quest-owner-name').textContent=value==='shop'?'shop owner':"starter's shop owner";status.textContent='';dialog.showModal();renderTasks();}};
}
