import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {createFishCard} from './item-card.js';
import {tackleFor,tackleDescription} from './equipment-rules.js';

export function createRefit({store,isFishing}){
  const panel=document.querySelector('#refit-panel'),list=document.querySelector('#refit-candidates'),status=document.querySelector('#refit-status');
  let selected='line',cleanups=[];
  function cleanup(){for(const stop of cleanups)stop();cleanups=[];}
  function card(item){const view=createFishCard(item,{positioned:false,canRetry:()=>true});cleanups.push(view.dispose);view.element.tabIndex=-1;return view.element;}
  function render(){
    if(panel.hidden||!document.querySelector('#shop-dialog').open)return;cleanup();
    const stats=store.model.tackleStats(),busy=isFishing();
    document.querySelector('#refit-stats').textContent=`线韧性上限 ${stats.lineMaximum} · 基础收线 ${Number(stats.reelBaseSpeed.toFixed(2))} 米/秒 · 鱼移速降低 ${Math.round((1-stats.fishSpeedScale)*100)}%`;
    document.querySelector('#refit-lock').textContent=busy?'本轮钓鱼未结束，仅可查看，收竿后才能装卸。':'每种装备只可装一件；空槽仍使用基础属性。';
    for(const slot of ['line','reel']){
      const button=document.querySelector('#refit-slot-'+slot),item=store.model.equipment[slot],content=button.querySelector('.refit-slot-content');content.replaceChildren();button.setAttribute('aria-pressed',String(selected===slot));
      if(item){
        const img=document.createElement('img');img.alt=item.name;img.className='refit-slot-image';img.decoding='async';content.append(img);
        cleanups.push(loadInventoryImage(img,inventoryImageSources((slot==='line'?'tackle/line-1.png':'tackle/reel-1.png')),state=>content.dataset.imageState=state));
        const label=document.createElement('strong');label.textContent=item.name;content.append(label);if(slot==='line'){const wear=document.createElement('span');wear.textContent=`耐久 ${item.lineWear} / ${tackleFor(item.name).maxWear}`;content.append(wear);}
      }
      else content.textContent=slot==='line'?'未装鱼线 · 基础韧性100':'未装渔轮';
      const unequip=document.querySelector('#refit-unequip-'+slot);unequip.disabled=busy||!item;
    }
    document.querySelector('#refit-list-title').textContent=selected==='line'?'选择鱼线':'选择渔轮';list.replaceChildren();
    const sources=[{key:'bag',title:'背包',items:store.model.inventory.items},...store.model.boxes.map((box,i)=>({key:i,title:`箱子 ${i+1}`,items:box.unlocked?box.items:[]}))];let count=0;
    for(const source of sources)for(const item of source.items){
      if(tackleFor(item.name)?.slot!==selected)continue;count++;
      const row=document.createElement('div');row.className='refit-candidate';row.dataset.equipmentId=item.id;row.append(card(item));
      const info=document.createElement('div'),name=document.createElement('h4'),details=document.createElement('p'),where=document.createElement('p');name.textContent=item.name;details.textContent=tackleDescription(item.name);where.textContent=source.title+(selected==='line'?` · 耐久 ${item.lineWear} / ${tackleFor(item.name).maxWear}`:'');info.append(name,details,where);
      const equip=document.createElement('button');equip.type='button';equip.className='refit-equip';equip.textContent='装备';equip.setAttribute('aria-label',`装备${item.name}`);equip.disabled=busy;equip.addEventListener('click',()=>{
        if(isFishing()){status.textContent='本轮结束后才能装卸装备。';return;}
        const result=store.run('equip',[item.id,source.key,selected]);status.textContent=result.ok?`已装备${result.name}`+(result.replaced?`，${result.replaced}已放回腾出的格子。`:'。'):result.error;
      });
      row.append(info,equip);list.append(row);
    }
    if(!count){const empty=document.createElement('p');empty.className='refit-empty';empty.textContent='背包和已解锁仓库里暂无此类装备，可先到商店购买。';list.append(empty);}
  }
  for(const slot of ['line','reel']){
    document.querySelector('#refit-slot-'+slot).addEventListener('click',()=>{selected=slot;status.textContent='';render();});
    document.querySelector('#refit-unequip-'+slot).addEventListener('click',()=>{
      if(isFishing()){status.textContent='本轮结束后才能装卸装备。';return;}
      const result=store.run('unequip',[slot]);status.textContent=result.ok?`已卸下${result.name}，放入${result.source==='bag'?'背包':`箱子 ${result.source+1}`}。`:result.error;
    });
  }
  store.subscribe(render);
  return {render,cleanup,open(){selected='line';status.textContent='';render();}};
}
