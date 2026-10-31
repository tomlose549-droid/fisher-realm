export const BAG_WIDTH=5,BAG_HEIGHT=3;
export const FISH_ITEMS=Object.freeze({
  '罗非鱼':{w:2,h:1,color:'#808080',image:'cutouts/tilapia.png'},
  '蓝鳃太阳鱼':{w:2,h:1,color:'#008000',image:'cutouts/bluegill.png'},
  '红耳太阳鱼':{w:2,h:1,color:'#90ee90',image:'cutouts/redear.png'},
  '黑莓鲈':{w:3,h:1,color:'#ffffff',image:'cutouts/blackberry.png'},
  '金色闪光鲦':{w:1,h:1,color:'#0000ff',image:'cutouts/shiner.png'},
});
export class FishInventory{
  constructor(saved){this.items=[];this.nextId=1;
    if(saved?.version===1&&Array.isArray(saved.items))for(const raw of saved.items){
      if(!FISH_ITEMS[raw?.name])continue;
      const item={id:String(this.nextId++),name:raw.name,x:null,y:null};this.items.push(item);
      if(this.fits(item,raw.x,raw.y)&&this.overlaps(item,raw.x,raw.y).length===0){item.x=raw.x;item.y=raw.y;}
    }
  }
  fits(item,x,y){const m=FISH_ITEMS[item.name];return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+m.w<=BAG_WIDTH&&y+m.h<=BAG_HEIGHT;}
  overlaps(item,x,y){const m=FISH_ITEMS[item.name];return this.items.filter(o=>{if(o.id===item.id||o.x===null)return false;const b=FISH_ITEMS[o.name];return x<o.x+b.w&&x+m.w>o.x&&y<o.y+b.h&&y+m.h>o.y;});}
  add(name){if(!FISH_ITEMS[name])return null;const item={id:String(this.nextId++),name,x:null,y:null};this.items.push(item);for(let y=0;y<BAG_HEIGHT;y++)for(let x=0;x<BAG_WIDTH;x++)if(this.fits(item,x,y)&&!this.overlaps(item,x,y).length){item.x=x;item.y=y;return item;}return item;}
  moveToBag(id,x,y){const item=this.items.find(i=>i.id===id);if(!item||!this.fits(item,x,y))return false;for(const other of this.overlaps(item,x,y)){other.x=null;other.y=null;}item.x=x;item.y=y;return true;}
  moveToPile(id){const item=this.items.find(i=>i.id===id);if(!item)return false;item.x=null;item.y=null;return true;}
  serialize(){return {version:1,items:this.items.map(i=>({...i}))};}
}
