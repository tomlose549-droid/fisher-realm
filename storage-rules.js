import {FishInventory,FISH_ITEMS,BAG_WIDTH,BAG_HEIGHT} from './inventory-rules.js';
import {FISH_PRICES} from './fish-data.js';

export const BOX_SIZE=10,BOX_COUNT=10,BOX_COST=1000;
export const validCoins=value=>Number.isSafeInteger(value)&&value>=0;
const known=item=>item&&typeof item.name==='string'&&Object.hasOwn(FISH_ITEMS,item.name);
const fits=(item,x,y,w,h)=>known(item)&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+FISH_ITEMS[item.name].w<=w&&y+FISH_ITEMS[item.name].h<=h;
const overlaps=(items,item,x,y)=>items.some(other=>{
  if(other.id===item.id||other.x===null)return false;
  const a=FISH_ITEMS[item.name],b=FISH_ITEMS[other.name];
  return x<other.x+b.w&&x+a.w>other.x&&y<other.y+b.h&&y+a.h>other.y;
});

// Bag, pile, coins and all boxes form one transaction and one browser save.
export class PlayerStorage{
  constructor(saved){
    this.inventory=new FishInventory();this.coins=0;this.activeBox=0;
    this.boxes=Array.from({length:BOX_COUNT},(_,i)=>({unlocked:i===0,items:[]}));
    const used=new Set();let next=1;
    const restore=raw=>{
      if(!known(raw))return null;
      let id=typeof raw.id==='string'&&/^[1-9]\d*$/.test(raw.id)&&Number.isSafeInteger(Number(raw.id))?raw.id:null;
      if(!id||used.has(id)){while(used.has(String(next)))next++;id=String(next++);}
      used.add(id);return {id,name:raw.name,x:null,y:null};
    };
    if(saved?.version===1&&Array.isArray(saved.items))for(const raw of saved.items){
      const item=restore(raw);if(!item)continue;
      if(fits(item,raw.x,raw.y,BAG_WIDTH,BAG_HEIGHT)&&!overlaps(this.inventory.items,item,raw.x,raw.y)){item.x=raw.x;item.y=raw.y;}
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
          }else this.inventory.items.push(item); // Recover invalid placements into the pile, never discard a known fish.
        }
      }
      if(Number.isInteger(storage.activeBox)&&this.boxes[storage.activeBox]?.unlocked)this.activeBox=storage.activeBox;
    }
    while(used.has(String(next)))next++;this.inventory.nextId=next;
  }
  clone(){
    const copy=Object.assign(Object.create(PlayerStorage.prototype),structuredClone({coins:this.coins,activeBox:this.activeBox,boxes:this.boxes}));
    copy.inventory=Object.assign(Object.create(FishInventory.prototype),structuredClone(this.inventory));return copy;
  }
  addFish(name){
    // Find the next unused ID across bag and boxes after migrating older saves.
    const ids=new Set([...this.inventory.items,...this.boxes.flatMap(b=>b.items)].map(i=>i.id));
    while(ids.has(String(this.inventory.nextId)))this.inventory.nextId++;
    const item=this.inventory.add(name);return item?{ok:true,item}:{ok:false,error:'未知鱼种'};
  }
  moveBag(id,x,y){return {ok:this.inventory.moveToBag(id,x,y)};}
  movePile(id){return {ok:this.inventory.moveToPile(id)};}
  openWarehouse(){const before=this.inventory.items.length;this.inventory.items=this.inventory.items.filter(i=>i.x!==null);return {ok:true,removed:before-this.inventory.items.length};}
  placement(id,source,target,x,y){
    const from=source==='bag'?this.inventory.items:this.boxes[source]?.unlocked?this.boxes[source].items:null;
    const to=target==='bag'?this.inventory.items:this.boxes[target]?.unlocked?this.boxes[target].items:null;
    const item=from?.find(i=>i.id===id&&i.x!==null),w=target==='bag'?BAG_WIDTH:BOX_SIZE,h=target==='bag'?BAG_HEIGHT:BOX_SIZE;
    if(!item||!to||!fits(item,x,y,w,h)||overlaps(to,item,x,y))return null;
    return {item,from,to};
  }
  canTransfer(id,source,target,x,y){return !!this.placement(id,source,target,x,y);}
  transfer(id,source,target,x,y){
    const placement=this.placement(id,source,target,x,y);
    if(!placement)return {ok:false,error:'这里已被占用或放不下，鱼留在原处。'};
    const {item,from,to}=placement;
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
    const price=FISH_PRICES[item.name];
    if(!validCoins(price)||!validCoins(this.coins+price))return {ok:false,error:'金币金额超出可保存范围'};
    box.items.splice(box.items.indexOf(item),1);this.coins+=price;return {ok:true,name:item.name,price};
  }
  setCoins(value){if(!validCoins(value))return {ok:false,error:'请输入非负整数，且不超过 9007199254740991。'};this.coins=value;return {ok:true};}
  clearAll(){const removed=this.inventory.items.length;this.inventory.items=[];this.coins=0;return {ok:true,removed};}
  serialize(){return {...this.inventory.serialize(),storage:{version:1,coins:this.coins,activeBox:this.activeBox,boxes:structuredClone(this.boxes)}};}
}
