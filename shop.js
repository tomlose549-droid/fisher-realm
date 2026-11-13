import {BACKPACK_LEVELS} from './backpack-upgrades.js';
import {createRefit} from './refit.js';
import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {tackleDescription} from './equipment-rules.js';
import {SHOP_ITEMS} from './item-data.js';
import {withLure} from './lure-encounters.js';

export function createShop({store,encounters,onOpen,onClose,isFishing=()=>false}){
  const dialog=document.querySelector('#shop-dialog'),list=document.querySelector('#shop-products'),status=document.querySelector('#shop-status'),cards=[];
  const refit=createRefit({store,isFishing});let imageCleanups=[];
  function stopImages(){for(const stop of imageCleanups)stop();imageCleanups=[];refit.cleanup();}
  let activeTab='stock',upgrading=false;
  const upgradeButton=document.querySelector('#backpack-upgrade-buy'),upgradeStatus=document.querySelector('#backpack-upgrade-status');
  function renderUpgrade(){
    if(!dialog.open||activeTab!=='backpack')return;
    const bag=store.model.inventory,next=BACKPACK_LEVELS[bag.level+1];
    document.querySelector('#backpack-upgrade-level').textContent=`lv${bag.level}`;
    document.querySelector('#backpack-upgrade-current').textContent=`当前容量：高 ${bag.height} × 宽 ${bag.width}（${bag.height*bag.width} 格）`;
    document.querySelector('#backpack-upgrade-next').textContent=next?`下一级 lv${next.level}：高 ${next.h} × 宽 ${next.w}（${next.h*next.w} 格）`:'已达到最大容量';
    upgradeButton.textContent=next?`${next.cost} 金币 · 升级至 lv${next.level}`:'已满级';
    upgradeButton.disabled=upgrading||!next||store.model.coins<next.cost;
    if(!upgrading)upgradeStatus.textContent=next&&store.model.coins<next.cost?`金币不足，需要 ${next.cost} 金币。`:'';
  }
  function show(tab){
    activeTab=tab;
    for(const [name,panel] of [['stock','shop-products'],['refit','refit-panel'],['backpack','backpack-upgrade-panel']]){
      document.getElementById(panel).hidden=name!==tab;
      document.getElementById(`shop-${name}-tab`).setAttribute('aria-selected',String(name===tab));
    }
    document.querySelector('#shop-title').textContent={stock:"starter's shop",refit:'改装',backpack:'背包升级'}[tab];
    document.querySelector('#shop-intro').textContent={stock:'购入仓库 · 背包亮片自动使用，每竿消耗一个，优先使用价值最高的亮片。',refit:'选择鱼线或渔轮槽，再从已有物品中装备；每个槽位仅可装一件。',backpack:'逐级扩充背包，让每次湖畔之行多一份收获。'}[tab];
    status.textContent='';if(tab==='refit')refit.open();else refit.cleanup();renderUpgrade();
  }
  for(const tab of ['stock','refit','backpack'])document.getElementById(`shop-${tab}-tab`).addEventListener('click',()=>show(tab));
  upgradeButton.addEventListener('click',()=>{
    if(upgrading||upgradeButton.disabled)return;
    upgrading=true;upgradeButton.disabled=true;
    const result=store.run('upgradeBackpack',[store.model.inventory.level]);
    renderUpgrade();upgradeStatus.textContent=result.ok?`已升级至 lv${result.level}，花费 ${result.cost} 金币，已保存。`:result.error;
    // Ignore queued double clicks; a deliberate next upgrade is a separate purchase.
    setTimeout(()=>{upgrading=false;const message=upgradeStatus.textContent;renderUpgrade();upgradeStatus.textContent=message;},450);
  });
  store.subscribe(renderUpgrade);
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
