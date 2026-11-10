import {SHOP_ITEMS} from './item-data.js';
import {withLure} from './lure-encounters.js';

export function createShop({store,encounters,onOpen,onClose}){
  const dialog=document.querySelector('#shop-dialog'),list=document.querySelector('#shop-products'),status=document.querySelector('#shop-status'),cards=[];
  for(const product of SHOP_ITEMS){
    const card=document.createElement('form');card.className='shop-product';card.dataset.productId=product.id;
    const heading=document.createElement('h3');heading.textContent=product.name;
    const price=document.createElement('p');price.className='shop-price';price.textContent=`${product.price} 金币 / 个`;
    const detail=document.createElement('p');detail.className='shop-detail';
    detail.textContent=`高 ${product.h} × 宽 ${product.w} 格 · ${product.stackLimit>1?'每堆最多 100 个':'不堆叠'} · 出售 ${product.sellPrice} 金币 / 个`;
    const effect=document.createElement('p');effect.className='shop-effect';
    if(product.kind==='lure'){
      const table=withLure(encounters,product.name);
      effect.textContent=`灰色概率降低 ${Math.round((1-product.modifiers.grey)*100)}%，白色降低 ${Math.round((1-product.modifiers.white)*100)}%。当前地图：灰 ${Number(table.qualityTotals.grey.toFixed(4))}% · 白 ${Number(table.qualityTotals.white.toFixed(4))}%。放入背包后每竿消耗 1 个。`;
    }else effect.textContent='目前暂不提供使用效果。';
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
    card.append(heading,price,detail,effect,quantity,total,buy);list.append(card);cards.push({input,update});update();
  }
  document.querySelector('#shop-toggle').addEventListener('click',()=>{onOpen();status.textContent='';for(const card of cards){card.input.value='1';card.update();}dialog.showModal();});
  document.querySelector('#shop-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#shop-toggle').focus({preventScroll:true});});
}
