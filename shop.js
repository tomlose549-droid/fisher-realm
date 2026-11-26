import {productUnlocked,sodaShopUnlocked,caveOwnerKnown} from './shop-progression.js';
import {createShopQuests} from './shop-quests.js';
import {shopUnlocked,secondShopUnlocked} from './quest-rules.js';
import {BACKPACK_LEVELS} from './backpack-upgrades.js';
import {createRefit} from './refit.js';
import {loadInventoryImage,inventoryImageSources} from './inventory-images.js';
import {tackleDescription} from './equipment-rules.js';
import {SHOP_ITEMS} from './item-data.js';
import {withLure} from './lure-encounters.js';

export function createShop({store,encounters,getEncounters=()=>encounters,onOpen,onClose,isFishing=()=>false}){
  const dialog=document.querySelector('#shop-dialog'),list=document.querySelector('#shop-products'),status=document.querySelector('#shop-status'),cards=[];
  const refit=createRefit({store,isFishing});
  function stopImages(){stopProductImages();refit.cleanup();}
  const quests=createShopQuests({store,onClose});
  let activeTab='stock',upgrading=false;
  const ownerButton=document.querySelector('#shop-owner'),caveButton=document.querySelector('#shop-cave-owner');
  function stopProductImages(){for(const card of cards){card.stop?.();card.stop=null;}}
  function renderStock(){
    const unlocked={starter:shopUnlocked(store.model.quests),shop:secondShopUnlocked(store.model.quests)};
    document.querySelector('#shop-other-tab').hidden=!unlocked.shop;document.querySelector('#shop-soda-tab').hidden=!sodaShopUnlocked(store.model.quests);caveButton.disabled=!caveOwnerKnown(store.model.quests);
    if(['stock','other'].includes(activeTab))document.querySelector('#shop-intro').textContent=(activeTab==='other'?cards.some(card=>card.product.shop==='shop'&&productUnlocked(store.model.quests,card.product)):unlocked.starter)?'购入仓库 · 背包内的亮片与假饵首批最多三竿共用一个，超时补抛另扣一个，优先使用价值最高的。':'店主正在等候，点击木质人物图标与他交谈。';
    for(const card of cards){
      const available=productUnlocked(store.model.quests,card.product),visible=dialog.open&&available&&(card.product.shop==='shop'?activeTab==='other':activeTab==='stock');
      if(card.unlocked!==available){
        card.unlocked=available;card.card.replaceChildren();card.card.classList.toggle('shop-product-locked',!available);
        if(available){card.card.removeAttribute('aria-label');card.card.append(...card.contents);}
        else{const lock=document.createElement('span');lock.className='shop-product-lock';lock.textContent='🔒';lock.setAttribute('aria-hidden','true');const label=document.createElement('p');label.textContent='尚未解锁';card.card.setAttribute('aria-label','尚未解锁的商品');card.card.append(lock,label);}
      }
      if(visible){card.updateEffect();if(!card.stop)card.stop=loadInventoryImage(card.img,inventoryImageSources(card.product.image),state=>card.picture.dataset.imageState=state);}
      else{card.stop?.();card.stop=null;}
    }
  }
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
    if(tab==='other'&&!secondShopUnlocked(store.model.quests)||tab==='soda'&&!sodaShopUnlocked(store.model.quests))return;
    activeTab=tab;document.querySelector('.shop-footer>div').hidden=tab==='soda';ownerButton.hidden=!['stock','other','soda'].includes(tab);caveButton.hidden=tab!=='other';ownerButton.classList.toggle('owner-stonewood',tab==='soda');ownerButton.setAttribute('aria-label',tab==='other'?'拜访 shop owner':tab==='soda'?'拜访 soda shop owner':"拜访 starter's shop owner");
    for(const [name,panel] of [['stock','shop-products'],['refit','refit-panel'],['backpack','backpack-upgrade-panel'],['other','shop-empty-panel'],['soda','shop-soda-panel']]){
      document.getElementById(panel).hidden=name!==tab;
      document.getElementById(`shop-${name}-tab`).setAttribute('aria-selected',String(name===tab));
    }
    document.querySelector('#shop-title').textContent={stock:"starter's shop",refit:'改装',backpack:'背包升级',other:'shop',soda:'soda shop'}[tab];
    document.querySelector('#shop-intro').textContent={stock:'购入仓库 · 背包亮片自动使用，首批最多三竿共用一个，超时补抛另扣一个，优先使用价值最高的亮片。',refit:'选择鱼线或渔轮槽，再从已有物品中装备；每个槽位仅可装一件。',backpack:'逐级扩充背包，让每次湖畔之行多一份收获。',other:'',soda:''}[tab];
    status.textContent='';if(tab==='refit')refit.open();else refit.cleanup();renderUpgrade();renderStock();
  }
  for(const tab of ['stock','refit','backpack','other','soda'])document.getElementById(`shop-${tab}-tab`).addEventListener('click',()=>show(tab));
  upgradeButton.addEventListener('click',()=>{
    if(upgrading||upgradeButton.disabled)return;
    upgrading=true;upgradeButton.disabled=true;
    const result=store.run('upgradeBackpack',[store.model.inventory.level]);
    renderUpgrade();upgradeStatus.textContent=result.ok?`已升级至 lv${result.level}，花费 ${result.cost} 金币，已保存。`:result.error;
    // Ignore queued double clicks; a deliberate next upgrade is a separate purchase.
    setTimeout(()=>{upgrading=false;const message=upgradeStatus.textContent;renderUpgrade();upgradeStatus.textContent=message;},450);
  });
  ownerButton.addEventListener('click',()=>quests.open(activeTab==='other'?'shop':activeTab==='soda'?'soda':'starter'));
  caveButton.addEventListener('click',()=>{if(!caveButton.disabled)quests.open('cave');});
  store.subscribe(()=>{renderUpgrade();renderStock();});
  for(const product of SHOP_ITEMS){
    const card=document.createElement('form');card.className='shop-product';card.dataset.productId=product.id;
    const picture=document.createElement('div');picture.className='shop-picture';const img=document.createElement('img');img.alt=product.name;img.decoding='async';picture.append(img);
    const heading=document.createElement('h3');heading.textContent=product.name;
    const price=document.createElement('p');price.className='shop-price';price.textContent=`${product.price} 金币 / 个`;
    const detail=document.createElement('p');detail.className='shop-detail';
    detail.textContent=`高 ${product.h} × 宽 ${product.w} 格 · ${product.stackLimit>1?'每堆最多 100 个':'不堆叠'} · 出售 ${product.sellPrice} 金币 / 个`;
    const effect=document.createElement('p');effect.className='shop-effect';
    function updateEffect(){if(product.kind==='lure'){
      const table=withLure(getEncounters(),product.name);
      const labels={grey:'灰',white:'白','light green':'浅绿',green:'绿',turquoise:'青绿',blue:'蓝',indigo:'靛蓝','dark purple':'深紫',violet:'紫罗兰',pink:'粉',yellow:'黄',orange:'橙',red:'红','dark red':'深红'};
      const reductions=Object.entries(product.modifiers).map(([quality,scale])=>`${labels[quality]}色降低 ${Number(((1-scale)*100).toFixed(2))}%`).join('，');
      const boost=product.areaBoost?'占格≥3的鱼在品质调整后概率最多再提高20%，以小鱼可分配概率为上限，小鱼最低降至0%。':'';
      const totals=Object.entries(table.qualityTotals).filter(([quality])=>Object.hasOwn(product.modifiers,quality)).map(([quality,value])=>`${labels[quality]} ${Number(value.toFixed(4))}%`).join(' · ');
      effect.textContent=`${reductions}。${boost}当前地图：${totals}。放入背包后首批最多三竿共用1个，超时补抛另扣1个。`;
    }else effect.textContent=tackleDescription(product.name);}
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
    card.append(heading,picture,price,detail,effect,quantity,total,buy);(product.shop==='shop'?document.querySelector('#shop-empty-panel'):list).append(card);cards.push({updateEffect,card,contents:[heading,picture,price,detail,effect,quantity,total,buy],input,update,img,product,picture,stop:null});update();
  }
  renderStock();
  document.querySelector('#shop-toggle').addEventListener('click',()=>{onOpen();status.textContent='';for(const card of cards){card.input.value='1';card.update();}dialog.showModal();show('stock');});
  document.querySelector('#shop-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{stopImages();onClose();if(!document.querySelector('dialog[open]'))document.querySelector('#shop-toggle').focus({preventScroll:true});});
  return {openOwnerHack(){onOpen();quests.open('starter',{admin:true});}};
}
