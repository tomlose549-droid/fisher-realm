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

export function createFishGuide({onOpen,onClose,entries=FISH_DATA,doc=document}){
  const dialog=doc.querySelector('#fish-guide-dialog'),list=doc.querySelector('#fish-guide-list'),
    search=doc.querySelector('#fish-guide-search'),count=doc.querySelector('#fish-guide-count'),
    empty=doc.querySelector('#fish-guide-empty'),toggle=doc.querySelector('#fish-guide-toggle');
  const catalog=buildFishGuide(entries);
  let cards=[];
  function el(tag,className,text){const e=doc.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function picture(fish,className){
    const wrap=el('div',className),image=el('img'),status=el('span','guide-image-status');
    image.alt=fish.name;image.draggable=false;image.decoding='async';wrap.append(image,status);
    if(!fish.image){wrap.dataset.imageState='missing';image.hidden=true;status.textContent='暂无图片';}
    return {wrap,image,status};
  }
  function swatch(label,color){
    const row=el('span','guide-color'),chip=el('i','guide-swatch');
    chip.style.backgroundColor=color;chip.setAttribute('aria-hidden','true');
    row.append(el('span','',label),chip);return row;
  }
  function field(label,value){const row=el('div');row.append(el('dt','',label),el('dd','',String(value)));return row;}
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
        loadInventoryImage(preview,inventoryImageSources(fish.image)[0],state=>{if(state==='ready')preview.hidden=false;});
        loadInventoryImage(large.image,inventoryImageSources(fish.image)[1],state=>{
          large.wrap.dataset.imageState=state;large.wrap.setAttribute('aria-busy',String(state==='loading'));
          large.status.textContent=state==='loading'?'原图加载中…':state==='error'?'原图加载失败，保留可用缩略图；重新打开图鉴可重试':'';
        });
      }
    }
    // Native details handles mouse, Enter and Space. Close siblings before loading.
    details.addEventListener('toggle',()=>{if(!details.open)return;for(const other of cards)if(other!==details)other.open=false;expand();});
    return {details,loadThumb(){if(fish.image)loadInventoryImage(thumb.image,inventoryImageSources(fish.image)[0],state=>{
      thumb.wrap.dataset.imageState=state;thumb.wrap.setAttribute('aria-busy',String(state==='loading'));
      thumb.status.textContent=state==='loading'?'图片加载中…':state==='error'?'缩略图加载失败':'';
    });}};
  }
  function filter(){
    const term=search.value.trim();let shown=0;
    cards.forEach((card,i)=>{card.hidden=!catalog.fish[i].name.includes(term);if(card.hidden)card.open=false;else shown++;});
    count.textContent=term?`找到 ${shown} 种 / 共 ${catalog.count} 种鱼`:`共收录 ${catalog.count} 种鱼`;
    empty.hidden=shown!==0;
  }
  function open(){
    if(dialog.open)return;onOpen();search.value='';
    const built=catalog.fish.map(card);cards=built.map(c=>c.details);list.replaceChildren(...cards);filter();
    dialog.showModal();list.scrollTop=0;search.focus({preventScroll:true});built.forEach(c=>c.loadThumb());
  }
  toggle.addEventListener('click',open);
  search.addEventListener('input',filter);
  doc.querySelector('#fish-guide-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();dialog.close();}});
  dialog.addEventListener('close',()=>{for(const card of cards)card.open=false;onClose();if(!doc.querySelector('dialog[open]'))doc.querySelector('#settings-toggle').focus({preventScroll:true});});
  return {open,isOpen:()=>dialog.open};
}
