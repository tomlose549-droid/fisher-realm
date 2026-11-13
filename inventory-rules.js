import {ITEMS,isFishName,quantityOf,quantityFields,stackLimit} from './item-data.js';
import {BACKPACK_LEVELS,backpackLevel} from './backpack-upgrades.js';
import {FISH_CATALOG} from './fish-data.js';
export const BAG_WIDTH=5,BAG_HEIGHT=3;
export const FISH_ITEMS=FISH_CATALOG.items;
const knownName=name=>typeof name==='string'&&Object.hasOwn(ITEMS,name);
export class FishInventory{
  constructor(saved){this.items=[];this.nextId=1;this.level=backpackLevel(saved?.version===1?saved.backpackLevel:undefined);
    if(saved?.version===1&&Array.isArray(saved.items))for(const raw of saved.items){
      if(!knownName(raw?.name))continue;
      const item={id:String(this.nextId++),name:raw.name,x:null,y:null,...quantityFields(raw)};this.items.push(item);
      if(this.fits(item,raw.x,raw.y)&&this.overlaps(item,raw.x,raw.y).length===0){item.x=raw.x;item.y=raw.y;}
    }
  }
  get width(){return BACKPACK_LEVELS[this.level].w;}
  get height(){return BACKPACK_LEVELS[this.level].h;}
  fits(item,x,y){if(!knownName(item?.name))return false;const m=ITEMS[item.name];return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+m.w<=this.width&&y+m.h<=this.height;}
  overlaps(item,x,y){const m=ITEMS[item.name];return this.items.filter(o=>{if(o.id===item.id||o.x===null)return false;const b=ITEMS[o.name];return x<o.x+b.w&&x+m.w>o.x&&y<o.y+b.h&&y+m.h>o.y;});}
  add(name){if(!isFishName(name))return null;const item={id:String(this.nextId++),name,x:null,y:null};this.items.push(item);for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)if(this.fits(item,x,y)&&!this.overlaps(item,x,y).length){item.x=x;item.y=y;return item;}return item;}
  moveToBag(id,x,y){
    const item=this.items.find(i=>i.id===id);if(!item||!this.fits(item,x,y))return false;
    const covered=this.overlaps(item,x,y);
    if(covered.length===1&&covered[0].name===item.name&&stackLimit(item.name)>1&&covered[0].x===x&&covered[0].y===y){
      const target=covered[0],moved=Math.min(quantityOf(item),stackLimit(item.name)-quantityOf(target));if(!moved)return false;
      target.quantity=quantityOf(target)+moved;item.quantity=quantityOf(item)-moved;if(!item.quantity)this.items.splice(this.items.indexOf(item),1);return true;
    }
    if(covered.length&&(!isFishName(item.name)||covered.some(other=>!isFishName(other.name))))return false;
    for(const other of covered){other.x=null;other.y=null;}item.x=x;item.y=y;return true;
  }
  moveToPile(id){const item=this.items.find(i=>i.id===id);if(!item||!isFishName(item.name))return false;item.x=null;item.y=null;return true;}
  clearAll(){const count=this.items.length;this.items=[];this.nextId=1;return count;}
  serialize(){return {version:1,...(this.level?{backpackLevel:this.level}:{}),items:this.items.map(i=>({...i}))};}
}
