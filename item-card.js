import {tackleFor} from './equipment-rules.js';
import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {ITEMS,quantityOf,unitSalePrice,isShopName,stackLimit} from './item-data.js';

export function createFishCard(item,{selected=false,positioned=true,canRetry=()=>true}={}){
  const meta=ITEMS[item.name],button=document.createElement('button');
  button.type='button';button.className='inventory-fish'+(selected?' selected':'');
  button.dataset.itemKind=isShopName(item.name)?meta.kind:'fish';button.dataset.itemName=item.name;button.dataset.fishId=item.id;button.dataset.fishWidth=meta.w;
  button.style.setProperty('--fish-color',meta.color);
  button.style.setProperty('--fish-label-color',['#008000','#0000ff','#301934','#4b0082','#00008b'].includes(meta.color)?'#ffffff':'#294137');
  const count=quantityOf(item),wear=tackleFor(item.name)?.maxWear,title=`${item.name} · 高${meta.h}格 × 宽${meta.w}格 · 售价 ${unitSalePrice(item.name)} 金币 / 个`+(stackLimit(item.name)>1?` · 数量 ${count} / 100 · 整堆售价 ${count*unitSalePrice(item.name)} 金币`:'')+(wear?` · 物品耐久 ${item.lineWear??wear} / ${wear}`:'');
  button.title=title;button.setAttribute('aria-label',title);
  if(positioned){button.style.gridColumn=`${item.x+1} / span ${meta.w}`;button.style.gridRow=`${item.y+1} / span ${meta.h}`;}
  let cleanup=()=>{};
  if(meta.image){
    const img=document.createElement('img');img.alt=item.name;img.draggable=false;img.decoding='async';button.append(img);
    cleanup=loadInventoryImage(img,inventoryImageSources(meta.image),state=>{
      button.dataset.imageState=state;button.setAttribute('aria-busy',String(state==='loading'));
      button.title=title+(state==='error'?' · 图片加载失败，点击重试':'');button.setAttribute('aria-label',button.title);
    });
    button.addEventListener('click',event=>{if(button.dataset.imageState!=='error'||!canRetry())return;event.preventDefault();event.stopPropagation();cleanup.retry();});
  }else button.classList.add('inventory-fish-no-image');
  const name=document.createElement('span');name.textContent=item.name;button.append(name);
  if(stackLimit(item.name)>1){const badge=document.createElement('b');badge.className='item-quantity';badge.textContent=count;button.append(badge);}
  if(wear){const badge=document.createElement('b');badge.className='item-wear';badge.textContent=`${item.lineWear??wear}/${wear}`;button.append(badge);}
  return {element:button,dispose:cleanup};
}
