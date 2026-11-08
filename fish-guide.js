import {FISH_DATA} from './fish-data.js';
import {buildFishHelp} from './fish-help.js';
import {inventoryImageSources,loadInventoryImage} from './inventory-images.js';

// The guide and help describe the same catalog, including legacy two-leg timings.
export function buildFishGuide(entries=FISH_DATA){
  const help=buildFishHelp(entries);
  return {count:help.count,fish:entries.map((fish,i)=>({
    ...help.profiles[i],strength:{...fish.strength},stamina:fish.stamina,speed:fish.speed,
    restDuration:fish.restDuration,image:fish.inventory.image,width:fish.inventory.w,height:fish.inventory.h,
    movement:help.profiles[i].lines[1],specials:fish.specials.length?fish.specials.join('；'):'无',
    probability:`1/${help.count}（约${(100/help.count).toFixed(2)}%）`
  }))};
}

export function createFishGuide({onOpen,onClose,isDiscovered=()=>false,entries=FISH_DATA,doc=document}){
  const dialog=doc.querySelector('#fish-guide-dialog'),list=doc.querySelector('#fish-guide-list'),
    search=doc.querySelector('#fish-guide-search'),count=doc.querySelector('#fish-guide-count'),
    empty=doc.querySelector('#fish-guide-empty'),toggle=doc.querySelector('#fish-guide-toggle');
  const catalog=buildFishGuide(entries);
  let cards=[],imageCleanups=[];
  function watchImage(image,source,onState,retryButton){
    const cleanup=loadInventoryImage(image,source,state=>{onState(state);if(retryButton)retryButton.hidden=state!=='error';});
    const retry=event=>{event.preventDefault();event.stopPropagation();cleanup.retry();};
    retryButton?.addEventListener('click',retry);
    imageCleanups.push(()=>{cleanup();retryButton?.removeEventListener('click',retry);});
  }
  function el(tag,className,text){const e=doc.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function picture(fish,className){
    const wrap=el('div',className),image=el('img'),message=el('span','guide-image-status'),status=el('span','guide-image-message'),retry=el('button','guide-image-retry','点击重试');
    retry.type='button';retry.hidden=true;retry.setAttribute('aria-label',fish.name+(className==='guide-large-image'?'原图':'缩略图')+'加载失败，点击重试');
    message.append(status,retry);
    image.alt=fish.name;image.draggable=false;image.decoding='async';wrap.append(image,message);
    if(!fish.image){wrap.dataset.imageState='missing';image.hidden=true;status.textContent='暂无图片';}
    return {wrap,image,status,retry};
  }
  function swatch(label,color){
    const row=el('span','guide-color'),chip=el('i','guide-swatch');
    chip.style.backgroundColor=color;chip.setAttribute('aria-hidden','true');
    row.append(el('span','',label),chip);return row;
  }
  function field(label,value){const row=el('div');row.append(el('dt','',label),el('dd','',String(value)));return row;}
  function lockedCard(){
    const details=el('div','guide-fish guide-locked'),lock=el('span','','🔒');
    details.dataset.guideLocked='true';details.setAttribute('role','img');details.setAttribute('aria-label','未解锁，钓获后可查看');lock.setAttribute('aria-hidden','true');details.append(lock);
    return {details,loadThumb(){}};
  }
  function card(fish){
    const details=el('details','guide-fish'),summary=el('summary','guide-summary');details.dataset.guideFishId=fish.id;
    const thumb=picture(fish,'guide-thumbnail'),info=el('div','guide-info'),stats=el('div','guide-stats');
    info.append(el('h3','',fish.name));
    for(const text of [`耐力 ${fish.stamina}`,`速度 ${fish.speed} 米/秒`,`力量 ${fish.strength.amount} 点/${fish.strength.interval}秒`])stats.append(el('span','',text));
    info.append(stats);const colors=el('div','guide-colors');
    colors.append(swatch('钓获提示色',fish.catchColor),swatch('背包底色',fish.inventoryColor));
    summary.append(thumb.wrap,info,colors);details.append(summary);
    let expanded=false;
    function expand(){
      if(expanded)return;expanded=true;
      const body=el('div','guide-detail'),large=picture(fish,'guide-large-image'),data=el('div','guide-detail-data'),fields=el('dl','guide-fields');
      fields.append(field('每轮休息',fish.restDuration+' 秒'),field('背包尺寸',`高 ${fish.height} 格 × 宽 ${fish.width} 格，不旋转`),field('普通随机遇鱼概率',fish.probability),field('特殊属性',fish.specials));
      data.append(el('h4','','游戏设定'),fields,el('h4','','挣扎轨迹'),el('p','guide-movement',fish.movement),el('p','guide-angle-note','角度从正左或正右朝本轮正前方计算：0°为横向，90°为正前方。每轮以起始时玩家指向鱼的方向为固定正前方。'));
      body.append(large.wrap,data);details.append(body);
      if(fish.image){
        // Keep a separate thumbnail under the original until the latter has loaded.
        const preview=thumb.image.cloneNode(false);preview.className='guide-preview';preview.alt='';preview.hidden=true;large.wrap.prepend(preview);
        watchImage(preview,inventoryImageSources(fish.image)[0],state=>{if(state==='ready')preview.hidden=false;});
        watchImage(large.image,inventoryImageSources(fish.image)[1],state=>{
          large.wrap.dataset.imageState=state;large.wrap.setAttribute('aria-busy',String(state==='loading'));
          large.status.textContent=state==='loading'?'原图加载中…':state==='error'?'原图加载失败，保留可用缩略图':'';
        },large.retry);
      }
    }
    // Keyboard activation also emits click. Select synchronously so rapid clicks
    // cannot let an earlier queued toggle event close the latest selection.
    summary.addEventListener('click',event=>{
      event.preventDefault();const opening=!details.open;
      if(opening)for(const other of cards)if(other!==details&&other.open)other.open=false;
      details.open=opening;if(opening)expand();
    });
    details.addEventListener('toggle',()=>{if(!details.open)return;for(const other of cards)if(other!==details&&other.open)other.open=false;expand();});
    return {details,loadThumb(){if(fish.image)watchImage(thumb.image,inventoryImageSources(fish.image)[0],state=>{
      thumb.wrap.dataset.imageState=state;thumb.wrap.setAttribute('aria-busy',String(state==='loading'));
      thumb.status.textContent=state==='loading'?'图片加载中…':state==='error'?'缩略图加载失败':'';
    },thumb.retry);}};
  }
  function filter(){
    const term=search.value.trim(),unlocked=catalog.fish.filter(f=>isDiscovered(f.id)).length;let shown=0;
    cards.forEach((card,i)=>{
      const fish=catalog.fish[i],known=isDiscovered(fish.id);
      card.hidden=term?(!known||!fish.name.includes(term)):false;
      if(card.hidden&&card.open)card.open=false;if(!card.hidden)shown++;
    });
    count.textContent=term?`找到 ${shown} 种 · 已解锁 ${unlocked} / ${catalog.count} 种鱼`:`已解锁 ${unlocked} / ${catalog.count} 种鱼`;
    empty.hidden=shown!==0;
  }
  function open(){
    if(dialog.open)return;onOpen();search.value='';
    const built=catalog.fish.map(f=>isDiscovered(f.id)?card(f):lockedCard());cards=built.map(c=>c.details);list.replaceChildren(...cards);filter();
    dialog.showModal();doc.querySelector('.guide-scroll').scrollTop=0;search.focus({preventScroll:true});built.forEach(c=>c.loadThumb());
  }
  toggle.addEventListener('click',open);
  search.addEventListener('input',filter);
  doc.querySelector('#fish-guide-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();dialog.close();}});
  dialog.addEventListener('close',()=>{for(const cleanup of imageCleanups)cleanup();imageCleanups=[];for(const card of cards)if(card.open)card.open=false;onClose();if(!doc.querySelector('dialog[open]'))doc.querySelector('#settings-toggle').focus({preventScroll:true});});
  return {open,isOpen:()=>dialog.open};
}
