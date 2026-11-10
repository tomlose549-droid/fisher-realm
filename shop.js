import {createRefit} from './refit.js';
import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {tackleDescription} from './equipment-rules.js';
import {SHOP_ITEMS} from './item-data.js';
import {withLure} from './lure-encounters.js';

export function createShop({store,encounters,onOpen,onClose,isFishing=()=>false}){
  const dialog=document.querySelector('#shop-dialog'),list=document.querySelector('#shop-products'),status=document.querySelector('#shop-status'),cards=[];
  const refit=createRefit({store,isFishing});let imageCleanups=[];
  function stopImages(){for(const stop of imageCleanups)stop();imageCleanups=[];refit.cleanup();}
  function show(tab){
    const modifying=tab==='refit';document.querySelector('#shop-products').hidden=modifying;document.querySelector('#refit-panel').hidden=!modifying;
    document.querySelector('#shop-title').textContent=modifying?'改装':"starter's shop";document.querySelector('#shop-intro').textContent=modifying?'选择鱼线或渔轮槽，再从已有物品中装备；每个槽位仅可装一件。':'购入仓库 · 背包亮片自动使用，每竿消耗一个，优先使用价值最高的亮片。';
    document.querySelector('#shop-stock-tab').setAttribute('aria-selected',String(!modifying));document.querySelector('#shop-refit-tab').setAttribute('aria-selected',String(modifying));if(modifying)refit.open();else refit.cleanup();
  }
  document.querySelector('#shop-stock-tab').addEventListener('click',()=>show('stock'));document.querySelector('#shop-refit-tab').addEventListener('click',()=>show('refit'));
  for(const product of SHOP_ITEMS){
    const card=document.createElement('form');card.className='shop-product';card.dataset.productId=product.id;
    const picture=document.createElement('div');picture.className='shop-picture';const img=document.createElement('img');img.alt=product.name;img.decoding='async';picture.append(img);
    const heading=document.createElement('h3');heading.textContent=product.name;
    const price=document.createElement('p');price.className='shop-price';price.textContent=`${product.price} 金币 / 个`;
    const detail=document.createElement('p');detail.className='shop-detail';
    detail.textContent=`高 ${product.h} × 宽 ${product.w} 格 · ${product.stackLimit>1?'每堆最多 100 个':'不堆叠'} · 出售 ${product.sellPrice} 金币 / 个`;
    const effect=document.createElement('p');effect.className='shop-effect';
    if(product.kind==='lure'){
      const table=withLure(encounters,product.name);
      effect.textContent=`灰色概率降低 ${Math.round((1-product.modifiers.grey)*100)}%，白色降低 ${Math.round((1-product.modifiers.white)*100)}%。当前地图：灰 ${Number(table.qualityTotals.grey.toFixed(4))}% · 白 ${Number(table.qualityTotals.white.toFixed(4))}%。放入背包后每竿消耗 1 个。`;
    }else effect.textContent=tackleDescription(product.name);
    const quantity=document.createElement('div');quantity.className='shop-quantity';
    const minus=document.createElement('button'),plus=document.createElement('button'),input=document.createElement('input');
    minus.type=plus.type='button';minus.textContent='−';plus.textContent='＋';minus.setAttribute('aria-label',`减少${product.name}数量`);plus.setAttribute('aria-label',`增加${product.name}数量`);
    input.type='number';input.min='1';input.step='1';input.value='1';input.setAttribute('aria-label',`${product.name}购买数量`);
    quantity.append(minus,input,plus);
    const total=document.createElement('p');total.className='shop-total';
    const buy=document.createElement('button');buy.className='shop-buy';buy.type='submit';buy.textContent='购买';buy.setAttribute('aria-label',`购买${product.name}`);
    function update(){
      const amount=input.valueAsNumber,cost=amount*product.price,valid=Number.isSafeInteger(amount)&&amount>0&&Number.isSafeInteger(cost);
      total.textContent=valid?`合计 ${cost} 金币`:'请输入正整数数量';minus.disabled=!valid||amount<=1;plus.disabled=!valid||!Number.isSafeInteger(amount+1);buy.disabled=!valid;
    }
    minus.addEventListener('click',()=>{input.value=String(Math.max(1,input.valueAsNumber-1));update();});
    plus.addEventListener('click',()=>{input.value=String(input.valueAsNumber+1);update();});input.addEventListener('input',update);
    card.noValidate=true;card.addEventListener('submit',event=>{
      event.preventDefault();update();if(buy.disabled)return;
      const result=store.run('buy',[product.name,input.valueAsNumber]);
      status.textContent=result.ok?`已购买 ${result.quantity} 个${result.name}，花费 ${result.cost} 金币，已放入仓库。`:result.error;
      status.dataset.state=result.ok?'success':'error';
    });
    card.append(heading,picture,price,detail,effect,quantity,total,buy);list.append(card);cards.push({input,update,img,product,picture});update();
  }
  document.querySelector('#shop-toggle').addEventListener('click',()=>{onOpen();status.textContent='';for(const card of cards){card.input.value='1';card.update();}dialog.showModal();show('stock');for(const card of cards)imageCleanups.push(loadInventoryImage(card.img,inventoryImageSources(card.product.image),state=>card.picture.dataset.imageState=state));});
  document.querySelector('#shop-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{stopImages();onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#shop-toggle').focus({preventScroll:true});});
}
