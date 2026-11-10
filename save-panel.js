import {isFishName,quantityOf} from './item-data.js';
import {MAX_SAVE_SLOTS} from './save-slots.js';

export function createSavePanel({saves,onOpen,onClose,beforeChange,reload=()=>location.reload()}){
  const chooser=document.querySelector('#save-select-dialog'),list=document.querySelector('#save-list'),status=document.querySelector('#save-select-status');
  const confirm=document.querySelector('#save-confirm-dialog'),title=document.querySelector('#save-confirm-title'),description=document.querySelector('#save-confirm-description'),message=document.querySelector('#save-confirm-message');
  const apply=document.querySelector('#save-confirm-apply'),chooseButton=document.querySelector('#save-confirm-choose');
  let operation=null,busy=false,returnToList=false;
  const label=id=>`存档 ${id}`;
  function summary(slot){
    const inventory=slot.data.inventory,warehouse=inventory.storage;
    const boxes=Array.isArray(warehouse?.boxes)?warehouse.boxes:[],coins=Number.isSafeInteger(warehouse?.coins)&&warehouse.coins>=0?warehouse.coins:0;
    const all=[...inventory.items,...boxes.flatMap(box=>Array.isArray(box?.items)?box.items:[])],count=all.filter(item=>isFishName(item.name)).length,gear=all.filter(item=>!isFishName(item.name)).reduce((sum,item)=>sum+quantityOf(item),0);
    return `${coins} 金币 · ${count} 条鱼${gear?` · ${gear} 件道具`:''} · 图鉴已解锁 ${slot.data.discoveries.fishIds.length} 种`;
  }
  function render(){
    const state=saves.snapshot();list.replaceChildren();
    document.querySelector('#save-select-count').textContent=`${state.slots.length} / ${MAX_SAVE_SLOTS} 个存档`;
    for(const slot of state.slots){
      const row=document.createElement('section');row.className='save-slot';row.dataset.saveId=slot.id;
      const info=document.createElement('div'),heading=document.createElement('h3'),detail=document.createElement('p');
      heading.textContent=label(slot.id)+(slot.id===state.activeId?' · 使用中':'');detail.textContent=summary(slot);info.append(heading,detail);
      const actions=document.createElement('div');actions.className='save-slot-actions';
      for(const [action,text]of [['select','切换'],['delete','删除']]){
        const button=document.createElement('button');button.type='button';button.dataset.saveAction=action;button.textContent=text;button.disabled=slot.id===state.activeId;
        button.setAttribute('aria-label',`${text}${label(slot.id)}`);if(action==='delete'&&button.disabled)button.title='当前存档需先切换后才能删除';actions.append(button);
      }
      row.append(info,actions);list.append(row);
    }
    document.querySelector('#save-current-label').textContent=`当前：${label(state.activeId)} · ${state.slots.length} / 3`;
  }
  function openChoose(){onOpen();operation=null;busy=false;status.textContent='';render();chooser.showModal();}
  function openConfirm(action,id){
    onOpen();operation={action,id};busy=false;returnToList=action!=='create';message.textContent='';chooseButton.hidden=true;apply.disabled=false;apply.classList.toggle('danger',action==='delete');
    if(action==='create'){
      title.textContent='创建新存档';description.textContent='创建并进入完全全新的存档：背包、鱼堆、仓库和金币清空，图鉴从未解锁开始，只有第一个箱子免费。原存档会保留。本轮钓鱼会结束。';apply.textContent='创建并进入';
      if(saves.snapshot().slots.length>=MAX_SAVE_SLOTS){message.textContent='已达到 3 个存档上限，请先在“选择存档”里删除其他存档。';apply.disabled=true;chooseButton.hidden=false;}
    }else if(action==='select'){
      title.textContent=`切换到${label(id)}`;description.textContent='当前进度会自动保存，本轮钓鱼会结束。切换后恢复该存档的背包、仓库、金币和图鉴。';apply.textContent='保存并切换';
    }else{
      title.textContent=`删除${label(id)}？`;description.textContent='此存档的背包、鱼堆、仓库、金币及图鉴将一起永久删除，无法撤销。当前存档不受影响。';apply.textContent='确认删除';
    }
    confirm.showModal();
  }
  document.querySelector('#save-new').addEventListener('click',()=>openConfirm('create'));
  document.querySelector('#save-select').addEventListener('click',openChoose);
  document.querySelector('#save-select-close').addEventListener('click',()=>chooser.close());
  chooseButton.addEventListener('click',openChoose);
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-save-action]');if(!button||button.disabled)return;
    openConfirm(button.dataset.saveAction,button.closest('[data-save-id]').dataset.saveId);
  });
  function cancel(){if(returnToList)openChoose();else confirm.close();}
  document.querySelector('#save-confirm-cancel').addEventListener('click',cancel);
  confirm.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  document.querySelector('#save-confirm-form').addEventListener('submit',event=>{
    event.preventDefault();if(busy||!operation||apply.disabled)return;
    // Settle pending catches/discoveries before changing the active slot or deleting another one.
    if(!beforeChange()){message.textContent='当前进度尚未保存，已取消操作。请释放浏览器存储空间后重试。';return;}
    busy=true;apply.disabled=true;
    const {action,id}=operation,result=action==='create'?saves.create():action==='select'?saves.select(id):saves.remove(id);
    if(!result.ok){busy=false;apply.disabled=false;message.textContent=result.error;return;}
    if(action==='delete'){openChoose();status.textContent=`${label(id)}已删除。`;return;}
    description.textContent=`正在进入${label(result.id)}…`;message.textContent='';reload();
  });
  for(const dialog of [chooser,confirm])dialog.addEventListener('close',()=>{onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#settings-toggle').focus({preventScroll:true});});
  render();return {openChoose};
}
