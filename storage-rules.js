import {tackleFor,tackleStats,wearRoll} from './equipment-rules.js';
import {BACKPACK_LEVELS} from './backpack-upgrades.js';
import {FishInventory} from './inventory-rules.js';
import {ITEMS,SHOP_BY_NAME,isFishName,isShopName,knownItem,quantityOf,quantityFields,stackLimit,unitSalePrice,bestLure} from './item-data.js';

export const BOX_SIZE=10,BOX_COUNT=10,BOX_COST=1000;
export const validCoins=value=>Number.isSafeInteger(value)&&value>=0;
const known=item=>item&&knownItem(item.name);
const fits=(item,x,y,w,h)=>known(item)&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+ITEMS[item.name].w<=w&&y+ITEMS[item.name].h<=h;
const overlaps=(items,item,x,y)=>items.some(other=>{
  if(other.id===item.id||other.x===null)return false;
  const a=ITEMS[item.name],b=ITEMS[other.name];
  return x<other.x+b.w&&x+a.w>other.x&&y<other.y+b.h&&y+a.h>other.y;
});

// Bag, pile, coins and all boxes form one transaction and one browser save.
export class PlayerStorage{
  constructor(saved){
    this.inventory=new FishInventory({version:1,backpackLevel:saved?.version===1?saved.backpackLevel:undefined,items:[]});this.coins=0;this.activeBox=0;this.equipment={line:null,reel:null};this.pendingCast=null;this.castSequence=0;
    this.boxes=Array.from({length:BOX_COUNT},(_,i)=>({unlocked:i===0,items:[]}));
    const used=new Set();let next=1;
    const restore=raw=>{
      if(!known(raw))return null;
      let id=typeof raw.id==='string'&&/^[1-9]\d*$/.test(raw.id)&&Number.isSafeInteger(Number(raw.id))?raw.id:null;
      if(!id||used.has(id)){while(used.has(String(next)))next++;id=String(next++);}
      used.add(id);return {id,name:raw.name,x:null,y:null,...quantityFields(raw)};
    };
    if(saved?.version===1&&Array.isArray(saved.items))for(const raw of saved.items){
      const item=restore(raw);if(!item)continue;
      if(fits(item,raw.x,raw.y,this.inventory.width,this.inventory.height)&&!overlaps(this.inventory.items,item,raw.x,raw.y)){item.x=raw.x;item.y=raw.y;}
      if(!isFishName(item.name)&&item.x===null)throw Error('道具位置异常，已停止加载以保护存档。');
      this.inventory.items.push(item);
    }
    const storage=saved?.version===1&&saved.storage?.version===1?saved.storage:null;
    if(storage){
      if(validCoins(storage.coins))this.coins=storage.coins;
      for(let i=0;i<BOX_COUNT;i++){
        const rawBox=storage.boxes?.[i],box=this.boxes[i];box.unlocked=i===0||rawBox?.unlocked===true;
        if(!Array.isArray(rawBox?.items))continue;
        for(const raw of rawBox.items){
          const item=restore(raw);if(!item)continue;
          if(box.unlocked&&fits(item,raw.x,raw.y,BOX_SIZE,BOX_SIZE)&&!overlaps(box.items,item,raw.x,raw.y)){
            item.x=raw.x;item.y=raw.y;box.items.push(item);
          }else{if(!isFishName(item.name))throw Error('仓库道具位置异常，已停止加载以保护存档。');this.inventory.items.push(item);} // Invalid fish placements recover into the pile.
        }
      }
      if(Number.isInteger(storage.activeBox)&&this.boxes[storage.activeBox]?.unlocked)this.activeBox=storage.activeBox;
    }
    if(storage){
      for(const slot of ['line','reel']){
        const raw=storage.equipment?.[slot];if(raw==null)continue;
        if(tackleFor(raw.name)?.slot!==slot||used.has(String(raw.id)))throw Error('已装备物品资料异常，已停止加载以保护存档。');
        this.equipment[slot]=restore(raw);
      }
      if(Number.isSafeInteger(storage.castSequence)&&storage.castSequence>=0)this.castSequence=storage.castSequence;
      if(storage.pendingCast!=null){
        const pending=storage.pendingCast;
        if(!this.equipment.line||pending.lineId!==this.equipment.line.id||!Number.isSafeInteger(pending.id)||pending.id<1||pending.id>this.castSequence||![0,1].includes(pending.normalLoss)||![1,3].includes(pending.brokenLoss))throw Error('鱼线结算资料异常，已停止加载以保护存档。');
        this.pendingCast={id:pending.id,lineId:pending.lineId,normalLoss:pending.normalLoss,brokenLoss:pending.brokenLoss};
      }
    }
    while(used.has(String(next)))next++;this.inventory.nextId=next;
  }
  clone(){
    const copy=Object.assign(Object.create(PlayerStorage.prototype),structuredClone({coins:this.coins,activeBox:this.activeBox,boxes:this.boxes,equipment:this.equipment,pendingCast:this.pendingCast,castSequence:this.castSequence}));
    copy.inventory=Object.assign(Object.create(FishInventory.prototype),structuredClone(this.inventory));return copy;
  }
  addFish(name){
    if(!isFishName(name))return {ok:false,error:'未知鱼种'};
    // Find the next unused ID across bag and boxes after migrating older saves.
    const ids=new Set([...this.inventory.items,...this.boxes.flatMap(b=>b.items),...Object.values(this.equipment).filter(Boolean)].map(i=>i.id));
    while(ids.has(String(this.inventory.nextId)))this.inventory.nextId++;
    const item=this.inventory.add(name);return item?{ok:true,item}:{ok:false,error:'未知鱼种'};
  }
  moveBag(id,x,y){return {ok:this.inventory.moveToBag(id,x,y)};}
  movePile(id){return {ok:this.inventory.moveToPile(id)};}
  openWarehouse(){const before=this.inventory.items.length;this.inventory.items=this.inventory.items.filter(i=>i.x!==null);return {ok:true,removed:before-this.inventory.items.length};}
  placement(id,source,target,x,y){
    const from=source==='bag'?this.inventory.items:this.boxes[source]?.unlocked?this.boxes[source].items:null;
    const to=target==='bag'?this.inventory.items:this.boxes[target]?.unlocked?this.boxes[target].items:null;
    const item=from?.find(i=>i.id===id&&i.x!==null),w=target==='bag'?this.inventory.width:BOX_SIZE,h=target==='bag'?this.inventory.height:BOX_SIZE;
    if(!item||!to||!fits(item,x,y,w,h))return null;
    const covered=to.filter(other=>other.id!==id&&other.x!==null&&overlaps([other],item,x,y));
    if(covered.length){
      const merge=covered.length===1&&covered[0].name===item.name&&stackLimit(item.name)>1&&covered[0].x===x&&covered[0].y===y&&quantityOf(covered[0])<stackLimit(item.name)?covered[0]:null;
      return merge?{item,from,to,merge}:null;
    }
    return {item,from,to};
  }
  canTransfer(id,source,target,x,y){return !!this.placement(id,source,target,x,y);}
  transfer(id,source,target,x,y){
    const placement=this.placement(id,source,target,x,y);
    if(!placement)return {ok:false,error:'这里已被占用或放不下，鱼留在原处。'};
    const {item,from,to,merge}=placement;
    if(merge){const moved=Math.min(quantityOf(item),stackLimit(item.name)-quantityOf(merge));merge.quantity=quantityOf(merge)+moved;item.quantity=quantityOf(item)-moved;if(!item.quantity)from.splice(from.indexOf(item),1);return {ok:true,moved,merged:true};}
    if(from!==to){from.splice(from.indexOf(item),1);to.push(item);}item.x=x;item.y=y;return {ok:true};
  }
  selectBox(index){if(!Number.isInteger(index)||!this.boxes[index]?.unlocked)return {ok:false};this.activeBox=index;return {ok:true};}
  unlock(index){
    if(!Number.isInteger(index)||index<1||!this.boxes[index]||this.boxes[index].unlocked)return {ok:false,error:'箱子已解锁或不存在'};
    if(this.coins<BOX_COST)return {ok:false,error:'金币不足，需要 1000 金币。'};
    this.coins-=BOX_COST;this.boxes[index].unlocked=true;this.activeBox=index;return {ok:true};
  }
  sell(id,index){
    const box=this.boxes[index],item=box?.unlocked?box.items.find(i=>i.id===id):null;
    if(!item)return {ok:false,error:'这条鱼已不在仓库中'};
    const quantity=quantityOf(item),unitPrice=unitSalePrice(item.name),price=unitPrice*quantity;
    if(!validCoins(price)||!validCoins(this.coins+price))return {ok:false,error:'金币金额超出可保存范围'};
    box.items.splice(box.items.indexOf(item),1);this.coins+=price;return {ok:true,name:item.name,price,quantity};
  }
  buy(name,quantity){
    if(!isShopName(name)||!Number.isSafeInteger(quantity)||quantity<1)return {ok:false,error:'请输入正整数购买数量。'};
    const meta=SHOP_BY_NAME[name],cost=meta.price*quantity;
    if(!Number.isSafeInteger(cost)||cost>this.coins)return {ok:false,error:'金币不足，无法购买。'};
    const boxes=structuredClone(this.boxes),order=[this.activeBox,...boxes.map((_,i)=>i).filter(i=>i!==this.activeBox)].filter(i=>boxes[i].unlocked);
    let remaining=quantity,nextId=this.inventory.nextId;
    const ids=new Set([...this.inventory.items,...boxes.flatMap(box=>box.items),...Object.values(this.equipment).filter(Boolean)].map(item=>item.id));
    if(meta.stackLimit>1)for(const index of order)for(const item of boxes[index].items){
      if(item.name!==name)continue;const moved=Math.min(remaining,meta.stackLimit-quantityOf(item));item.quantity=quantityOf(item)+moved;remaining-=moved;
    }
    for(const index of order){
      const box=boxes[index];
      for(let y=0;y<BOX_SIZE&&remaining;y++)for(let x=0;x<BOX_SIZE&&remaining;x++){
        const probe={id:'',name};if(!fits(probe,x,y,BOX_SIZE,BOX_SIZE)||overlaps(box.items,probe,x,y))continue;
        while(ids.has(String(nextId)))nextId++;const id=String(nextId++);ids.add(id);
        const amount=Math.min(remaining,meta.stackLimit);box.items.push({id,name,x,y,...quantityFields({name,...(meta.stackLimit>1?{quantity:amount}:{})})});remaining-=amount;
      }
    }
    if(remaining)return {ok:false,error:'已解锁的仓库空间不足，整批购买已取消。'};
    this.boxes=boxes;this.inventory.nextId=nextId;this.coins-=cost;return {ok:true,name,quantity,cost};
  }
  equip(id,source,slot){
    if(this.pendingCast)return {ok:false,error:'本轮钓鱼结束后才能装卸装备。'};
    if(!['line','reel'].includes(slot))return {ok:false,error:'无效装备槽。'};
    const from=source==='bag'?this.inventory.items:this.boxes[source]?.unlocked?this.boxes[source].items:null,item=from?.find(i=>i.id===id&&i.x!==null);
    if(!item||tackleFor(item.name)?.slot!==slot)return {ok:false,error:'请选择对应类型的装备。'};
    const old=this.equipment[slot];
    if(old){
      const w=source==='bag'?this.inventory.width:BOX_SIZE,h=source==='bag'?this.inventory.height:BOX_SIZE;
      if(!fits(old,item.x,item.y,w,h)||overlaps(from.filter(i=>i.id!==id),old,item.x,item.y))return {ok:false,error:'旧装备无法放回腾出的格子，本次更换已取消。'};
    }
    const index=from.indexOf(item),{x,y}=item;from.splice(index,1);if(old)from.splice(index,0,{...old,x,y});
    this.equipment[slot]={...item,x:null,y:null};return {ok:true,name:item.name,replaced:old?.name??null};
  }
  unequip(slot){
    if(this.pendingCast)return {ok:false,error:'本轮钓鱼结束后才能装卸装备。'};
    if(!['line','reel'].includes(slot)||!this.equipment[slot])return {ok:false,error:'此槽位没有装备。'};
    const item=this.equipment[slot],targets=[this.activeBox,...this.boxes.map((_,i)=>i).filter(i=>i!==this.activeBox)].filter(i=>this.boxes[i].unlocked);
    for(const source of [...targets,'bag']){
      const to=source==='bag'?this.inventory.items:this.boxes[source].items,w=source==='bag'?this.inventory.width:BOX_SIZE,h=source==='bag'?this.inventory.height:BOX_SIZE;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(fits(item,x,y,w,h)&&!overlaps(to,item,x,y)){
        to.push({...item,x,y});this.equipment[slot]=null;return {ok:true,name:item.name,source};
      }
    }
    return {ok:false,error:'背包与已解锁仓库没有足够空位，无法卸下。'};
  }
  tackleStats(){return tackleStats(this.equipment);}
  beginCast(lureId,unit){
    if(this.pendingCast)return {ok:false,error:'上一竿耐久尚未结算，请先重试保存。'};
    if(!this.equipment.line)return {ok:false,error:'没有需要结算的鱼线。'};
    const loss=wearRoll(unit);if(!Number.isSafeInteger(this.castSequence+1))return {ok:false,error:'存档轮次超出范围。'};
    if(lureId){const debit=this.consumeLure(lureId);if(!debit.ok)return debit;}
    this.castSequence++;this.pendingCast={id:this.castSequence,lineId:this.equipment.line.id,...loss};
    return {ok:true,castId:this.castSequence,equipment:this.tackleStats()};
  }
  settleCast(id,outcome){
    const pending=this.pendingCast;
    if(!pending||pending.id!==id)return {ok:false,error:'本竿已结算或编号不一致。'};
    if(this.equipment.line?.id!==pending.lineId)return {ok:false,error:'本竿鱼线资料不一致。'};
    const item=this.equipment.line,loss=outcome==='line-broken'?pending.brokenLoss:pending.normalLoss;
    item.lineWear=Math.max(0,item.lineWear-loss);const destroyed=item.lineWear===0;
    this.pendingCast=null;if(destroyed)this.equipment.line=null;
    return {ok:true,name:item.name,loss,remaining:item.lineWear,destroyed};
  }
  bestLure(){return bestLure(this.inventory.items);}
  consumeLure(id){
    const item=this.inventory.items.find(item=>item.id===id&&item.x!==null);
    if(!item||!isShopName(item.name)||SHOP_BY_NAME[item.name].kind!=='lure'||quantityOf(item)<1)return {ok:false,error:'背包内没有可用亮片。'};
    const name=item.name;item.quantity=quantityOf(item)-1;if(!item.quantity)this.inventory.items.splice(this.inventory.items.indexOf(item),1);
    return {ok:true,name,remaining:item.quantity};
  }
  upgradeBackpack(expectedLevel){
    const current=this.inventory.level,next=BACKPACK_LEVELS[current+1];
    if(expectedLevel!==current)return {ok:false,error:'背包等级已变化，请核对后重试。'};
    if(!next)return {ok:false,error:'背包已满级。'};
    if(this.coins<next.cost)return {ok:false,error:`金币不足，需要 ${next.cost} 金币。`};
    this.coins-=next.cost;this.inventory.level=next.level;
    return {ok:true,level:next.level,cost:next.cost};
  }
  setCoins(value){if(!validCoins(value))return {ok:false,error:'请输入非负整数，且不超过 9007199254740991。'};this.coins=value;return {ok:true};}
  clearAll(){const removed=this.inventory.items.reduce((sum,item)=>sum+quantityOf(item),0);this.inventory.items=[];this.coins=0;return {ok:true,removed};}
  serialize(){return {...this.inventory.serialize(),storage:{version:1,coins:this.coins,activeBox:this.activeBox,boxes:structuredClone(this.boxes),...((this.equipment.line||this.equipment.reel||this.castSequence)?{equipment:structuredClone(this.equipment),castSequence:this.castSequence,pendingCast:this.pendingCast?{...this.pendingCast}:null}:{})}};}
}
