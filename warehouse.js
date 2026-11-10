import {ITEMS as FISH_ITEMS,isFishName,quantityOf} from './item-data.js';
import {createFishCard} from './item-card.js';
import {BOX_SIZE,BOX_COST} from './storage-rules.js';

export function createWarehouse({store,onOpen,onClose,toast}){
  const dialog=document.querySelector('#warehouse-dialog'),bag=document.querySelector('#warehouse-bag'),grid=document.querySelector('#warehouse-grid');
  const tabs=document.querySelector('#warehouse-tabs'),hint=document.querySelector('#warehouse-hint'),saleButton=document.querySelector('#warehouse-sale');
  const unlockDialog=document.querySelector('#warehouse-unlock-dialog'),unlockMessage=document.querySelector('#warehouse-unlock-message');
  let sale=false,selected=null,drag=null,suppressClick=false,pendingBox=null,cleanups=[];
  const sourceGrid=element=>element?.closest('[data-storage-grid]');
  const sourceKey=element=>element.dataset.storageGrid==='bag'?'bag':store.model.activeBox;
  const sourceItems=source=>source==='bag'?store.model.inventory.items:store.model.boxes[source].items;
  const find=(id,source)=>sourceItems(source).find(i=>i.id===id);
  function stopImages(){for(const cleanup of cleanups)cleanup();cleanups=[];}
  function resetDrag(){drag?.ghost?.remove();drag=null;for(const el of [bag,grid])el.classList.remove('drop-valid','drop-invalid');}
  function select(value){selected=value;for(const card of dialog.querySelectorAll('[data-fish-id]'))card.classList.toggle('selected',card.dataset.fishId===selected?.id);}
  function say(message){hint.textContent=message;}
  function defaultHint(){say(sale?'出售中：双击右侧仓库物品出售（亮片整堆出售）；再点按钮停止。':'拖动物品在背包与仓库之间转移；也可先点鱼，再点目标格；同种亮片可合并。悬停查看售价。');}
  function cells(element,width,height){
    element.replaceChildren();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const cell=document.createElement('button');cell.type='button';cell.className='inventory-cell';cell.dataset.x=x;cell.dataset.y=y;
      cell.style.gridColumn=x+1;cell.style.gridRow=y+1;cell.setAttribute('aria-label',`${element===bag?'背包':'仓库'}第${y+1}行第${x+1}列`);element.append(cell);
    }
  }
  function card(item,source){
    const result=createFishCard(item,{selected:item.id===selected?.id,canRetry:()=>!sale});
    result.element.dataset.source=source;cleanups.push(result.dispose);return result.element;
  }
  function render(){
    if(!dialog.open)return;
    const focused=document.activeElement?.id;stopImages();tabs.replaceChildren();
    const model=store.model;
    model.boxes.forEach((box,index)=>{
      const button=document.createElement('button');button.type='button';button.dataset.box=index;button.id=`warehouse-box-${index}`;
      button.textContent=(box.unlocked?'▣':'🔒')+' '+(index+1);button.className='warehouse-tab';
      button.setAttribute('aria-label',box.unlocked?`箱子 ${index+1}`:`解锁箱子 ${index+1}，1000 金币`);
      button.setAttribute('aria-pressed',String(index===model.activeBox));button.classList.toggle('locked',!box.unlocked);tabs.append(button);
    });
    document.querySelector('#warehouse-box-title').textContent=`箱子 ${model.activeBox+1}`;
    cells(bag,5,3);cells(grid,BOX_SIZE,BOX_SIZE);
    for(const item of model.inventory.items.filter(i=>i.x!==null))bag.append(card(item,'bag'));
    for(const item of model.boxes[model.activeBox].items)grid.append(card(item,model.activeBox));
    document.querySelector('#warehouse-count').textContent=`${model.boxes[model.activeBox].items.filter(i=>isFishName(i.name)).length} 条鱼 · ${model.boxes[model.activeBox].items.filter(i=>!isFishName(i.name)).reduce((n,i)=>n+quantityOf(i),0)} 件道具 · 10 × 10`;
    if(focused?.startsWith('warehouse-box-'))document.getElementById(focused)?.focus({preventScroll:true});
  }
  function transfer(id,source,target,x,y){
    select(null);const result=store.run('transfer',[id,source,target,x,y]);
    if(!result.ok)say(result.error||'无法移动');else defaultHint();return result.ok;
  }
  function destination(event){
    for(const element of [bag,grid]){
      const rect=element.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>=rect.right||event.clientY<rect.top||event.clientY>=rect.bottom)continue;
      const first=element.querySelector('.inventory-cell').getBoundingClientRect(),second=element.querySelector('[data-x="1"]').getBoundingClientRect(),nextRow=element.querySelector('[data-x="0"][data-y="1"]').getBoundingClientRect();
      return {source:sourceKey(element),element,x:Math.floor((event.clientX-first.left)/(second.left-first.left))-(drag?.offsetX??0),y:Math.floor((event.clientY-first.top)/(nextRow.top-first.top))-(drag?.offsetY??0)};
    }return null;
  }
  function canPlace(dest){
    return !!dest&&store.model.canTransfer(drag.id,drag.source,dest.source,dest.x,dest.y);
  }
  dialog.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-fish-id]');if(!button||event.button!==0||sale)return;
    const source=sourceKey(sourceGrid(button)),item=find(button.dataset.fishId,source);if(!item)return;
    const rect=button.getBoundingClientRect(),meta=FISH_ITEMS[item.name];
    drag={id:item.id,source,pointer:event.pointerId,x:event.clientX,y:event.clientY,button,
      offsetX:Math.min(meta.w-1,Math.floor((event.clientX-rect.left)/rect.width*meta.w)),
      offsetY:Math.min(meta.h-1,Math.floor((event.clientY-rect.top)/rect.height*meta.h))};
    button.setPointerCapture(event.pointerId);
  });
  dialog.addEventListener('pointermove',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
    event.preventDefault();
    if(!drag.ghost){const rect=drag.button.getBoundingClientRect();drag.ghost=drag.button.cloneNode(true);drag.ghost.classList.add('inventory-drag-ghost');drag.ghost.removeAttribute('data-fish-id');drag.ghost.style.width=rect.width+'px';drag.ghost.style.height=rect.height+'px';dialog.append(drag.ghost);}
    drag.ghost.style.left=event.clientX+12+'px';drag.ghost.style.top=event.clientY+12+'px';
    const dest=destination(event),valid=canPlace(dest);
    for(const el of [bag,grid]){el.classList.toggle('drop-valid',dest?.element===el&&valid);el.classList.toggle('drop-invalid',dest?.element===el&&!valid);}
  });
  dialog.addEventListener('pointerup',event=>{
    if(!drag||drag.pointer!==event.pointerId)return;
    if(drag.ghost){
      const dest=destination(event),{id,source}=drag;resetDrag();suppressClick=true;setTimeout(()=>suppressClick=false,0);
      if(dest)transfer(id,source,dest.source,dest.x,dest.y);else say('请放入背包或仓库格子，鱼留在原处。');
    }else resetDrag();
  });
  dialog.addEventListener('pointercancel',resetDrag);
  dialog.addEventListener('click',event=>{
    if(suppressClick||sale)return;
    const button=event.target.closest('[data-fish-id]'),element=sourceGrid(event.target);if(!element)return;
    const source=sourceKey(element);
    if(button){
      const item=find(button.dataset.fishId,source);
      if(selected&&selected.id!==item.id)transfer(selected.id,selected.source,source,item.x,item.y);
      else select(selected?.id===item.id?null:{id:item.id,source});
    }else{
      const cell=event.target.closest('[data-x]');if(selected&&cell)transfer(selected.id,selected.source,source,Number(cell.dataset.x),Number(cell.dataset.y));
    }
  });
  grid.addEventListener('dblclick',event=>{
    if(!sale)return;const button=event.target.closest('[data-fish-id]');if(!button)return;
    event.preventDefault();const result=store.run('sell',[button.dataset.fishId,store.model.activeBox]);
    if(result.ok){say(`已出售${result.name} × ${result.quantity}，获得 ${result.price} 金币。`);toast(`+${result.price} 金币 · ${result.name}`);}else say(result.error);
  });
  saleButton.addEventListener('click',()=>{resetDrag();select(null);sale=!sale;saleButton.setAttribute('aria-pressed',String(sale));saleButton.textContent=sale?'停止出售':'出售';dialog.classList.toggle('selling',sale);defaultHint();});
  tabs.addEventListener('click',event=>{
    const button=event.target.closest('[data-box]');if(!button)return;resetDrag();select(null);
    const index=Number(button.dataset.box);
    if(store.model.boxes[index].unlocked){const result=store.run('selectBox',[index]);if(!result.ok)say(result.error);else defaultHint();}
    else{pendingBox=index;document.querySelector('#warehouse-unlock-title').textContent=`解锁箱子 ${index+1}`;unlockMessage.textContent=`花费 ${BOX_COST} 金币，解锁独立的 10 × 10 箱子。`;unlockDialog.showModal();}
  });
  document.querySelector('#warehouse-unlock-form').addEventListener('submit',event=>{
    event.preventDefault();const result=store.run('unlock',[pendingBox]);
    if(!result.ok){unlockMessage.textContent=result.error;return;}unlockDialog.close();defaultHint();toast('箱子已解锁 · −1000 金币');
  });
  document.querySelector('#warehouse-unlock-cancel').addEventListener('click',()=>unlockDialog.close());
  unlockDialog.addEventListener('close',()=>{document.querySelector(`#warehouse-box-${pendingBox}`)?.focus({preventScroll:true});pendingBox=null;});
  document.querySelector('#warehouse-toggle').addEventListener('click',()=>{
    // Settle the current fishing tick before clearing the pile, including a catch on this exact frame.
    onOpen();const result=store.run('openWarehouse');if(!result.ok){toast(result.error);onClose();return;}
    sale=false;select(null);saleButton.setAttribute('aria-pressed','false');saleButton.textContent='出售';dialog.classList.remove('selling');
    dialog.showModal();render();defaultHint();if(result.removed)toast(`鱼堆已清空 · ${result.removed} 条鱼`);
  });
  document.querySelector('#warehouse-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    if(unlockDialog.open)unlockDialog.close();stopImages();resetDrag();select(null);sale=false;onClose();
    if(!document.querySelector('dialog[open]'))document.querySelector('#warehouse-toggle').focus({preventScroll:true});
  });
  store.subscribe(()=>{resetDrag();render();});
  return {isOpen:()=>dialog.open};
}

export function createCoinControls({store,onOpen,onClose,toast}){
  const badges=[];
  for(const container of [document.querySelector('#game'),...document.querySelectorAll('dialog')]){
    const badge=document.createElement('div');badge.className='coin-balance'+(container.id==='game'?' coin-hud':'');badge.setAttribute('aria-label','金币余额');
    const icon=document.createElement('span');icon.textContent='◉';icon.setAttribute('aria-hidden','true');const amount=document.createElement('span');amount.dataset.coins='';
    badge.append(icon,amount,document.createTextNode(' 金币'));container.append(badge);badges.push(amount);
  }
  let previous=-1;
  function update(){const coins=store.model.coins;if(previous===coins)return;previous=coins;for(const badge of badges)badge.textContent=String(coins);}
  store.subscribe(update);update();
  const dialog=document.querySelector('#rich-dialog'),input=document.querySelector('#rich-amount'),message=document.querySelector('#rich-message');
  document.querySelector('#rich-form').addEventListener('submit',event=>{
    event.preventDefault();const value=input.value.trim();
    if(!/^\d+$/.test(value)){message.textContent='请输入非负整数。';return;}
    const result=store.run('setCoins',[Number(value)]);if(!result.ok){message.textContent=result.error;return;}dialog.close();toast(`金币已设为 ${store.model.coins}`);
  });
  document.querySelector('#rich-cancel').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#settings-toggle').focus({preventScroll:true});});
  return {openRich(){onOpen();input.value=String(store.model.coins);message.textContent='';dialog.showModal();input.focus();input.select();}};
}
