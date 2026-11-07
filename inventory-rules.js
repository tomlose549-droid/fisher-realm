import {FISH_CATALOG} from './fish-data.js';
export const BAG_WIDTH=5,BAG_HEIGHT=3;
export const FISH_ITEMS=FISH_CATALOG.items;
const knownName=name=>typeof name==='string'&&Object.hasOwn(FISH_ITEMS,name);
export class FishInventory{
  constructor(saved){this.items=[];this.nextId=1;
    if(saved?.version===1&&Array.isArray(saved.items))for(const raw of saved.items){
      if(!knownName(raw?.name))continue;
      const item={id:String(this.nextId++),name:raw.name,x:null,y:null};this.items.push(item);
      if(this.fits(item,raw.x,raw.y)&&this.overlaps(item,raw.x,raw.y).length===0){item.x=raw.x;item.y=raw.y;}
    }
  }
  fits(item,x,y){if(!knownName(item?.name))return false;const m=FISH_ITEMS[item.name];return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+m.w<=BAG_WIDTH&&y+m.h<=BAG_HEIGHT;}
  overlaps(item,x,y){const m=FISH_ITEMS[item.name];return this.items.filter(o=>{if(o.id===item.id||o.x===null)return false;const b=FISH_ITEMS[o.name];return x<o.x+b.w&&x+m.w>o.x&&y<o.y+b.h&&y+m.h>o.y;});}
  add(name){if(!knownName(name))return null;const item={id:String(this.nextId++),name,x:null,y:null};this.items.push(item);for(let y=0;y<BAG_HEIGHT;y++)for(let x=0;x<BAG_WIDTH;x++)if(this.fits(item,x,y)&&!this.overlaps(item,x,y).length){item.x=x;item.y=y;return item;}return item;}
  moveToBag(id,x,y){const item=this.items.find(i=>i.id===id);if(!item||!this.fits(item,x,y))return false;for(const other of this.overlaps(item,x,y)){other.x=null;other.y=null;}item.x=x;item.y=y;return true;}
  moveToPile(id){const item=this.items.find(i=>i.id===id);if(!item)return false;item.x=null;item.y=null;return true;}
  clearAll(){const count=this.items.length;this.items=[];this.nextId=1;return count;}
  serialize(){return {version:1,items:this.items.map(i=>({...i}))};}
}
