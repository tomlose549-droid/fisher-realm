import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {FISH_ITEMS} from './inventory-rules.js';
import {FISH_PRICES} from './fish-data.js';

export function createFishCard(item,{selected=false,positioned=true,canRetry=()=>true}={}){
  const meta=FISH_ITEMS[item.name],button=document.createElement('button');
  button.type='button';button.className='inventory-fish'+(selected?' selected':'');
  button.dataset.fishId=item.id;button.dataset.fishWidth=meta.w;
  button.style.setProperty('--fish-color',meta.color);
  button.style.setProperty('--fish-label-color',['#008000','#0000ff','#301934','#4b0082','#00008b'].includes(meta.color)?'#ffffff':'#294137');
  const title=`${item.name} · 高${meta.h}格 × 宽${meta.w}格 · 售价 ${FISH_PRICES[item.name]} 金币`;
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
  return {element:button,dispose:cleanup};
}
