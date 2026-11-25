import {REWARD_ITEMS} from './redeem-codes.js';
import {wearFields,tackleFor} from './equipment-rules.js';
import {FISH_CATALOG,FISH_PRICES} from './fish-data.js';

const product=(id,name,price,w,h,quality,color,kind,stackLimit=1,modifiers=null,options={})=>Object.freeze({id,name,price,sellPrice:Math.round(price*.5),w,h,quality,color,kind,stackLimit,shop:options.shop??'starter',image:options.image??(kind==='line'?'tackle/line-1.png':kind==='reel'?'tackle/reel-1.png':id==='LURE_1'?'tackle/lure-1.png':'tackle/lure-2.png'),modifiers:modifiers?Object.freeze(modifiers):null,areaBoost:options.areaBoost?Object.freeze(options.areaBoost):null});
const second=(image,areaBoost=null)=>({shop:'shop',image:'tackle/'+image+'.png',areaBoost});
export const SHOP_ITEMS=Object.freeze([
  product('LINE_1','1号鱼线',2,1,1,'grey','#808080','line'),
  product('LINE_2','2号鱼线',10,1,1,'white','#ffffff','line'),
  product('LINE_3','3号鱼线',45,1,1,'white','#ffffff','line'),
  product('LURE_1','1号亮片',1,1,1,'white','#ffffff','lure',100,{grey:.7,white:.75}),
  product('LURE_2','2号亮片',3,1,1,'light green','#90ee90','lure',100,{grey:.56,white:.6}),
  product('REEL_1','1号渔轮-初学者',150,2,2,'turquoise','#40e0d0','reel'),
  product('LURE_3','3号亮片',4,1,1,'light green','#90ee90','lure',100,{grey:.6,white:.61,'light green':.85},second('lure-3')),
  product('LURE_4','4号亮片-中体型吸引',5,1,1,'green','#008000','lure',100,{grey:.51,white:.52,'light green':.91},second('lure-4',{minArea:3,increase:.2})),
  product('LURE_5','5号假饵',7,1,1,'green','#008000','lure',100,{grey:.47,white:.43,'light green':.8,green:.98},second('lure-5')),
  product('LINE_4','4号鱼线',20,1,1,'white','#ffffff','line',1,null,second('line-2')),
  product('LINE_5','5号鱼线',60,1,1,'light green','#90ee90','line',1,null,second('line-2')),
  product('LINE_6','6号鱼线',180,1,1,'light green','#90ee90','line',1,null,second('line-2')),
  product('LINE_7','7号鱼线',200,1,1,'green','#008000','line',1,null,second('line-2')),
  product('REEL_2','2号渔轮-常规级',899,2,2,'dark purple','#301934','reel',1,null,second('reel-2'))
]);
export const SHOP_BY_NAME=Object.freeze(Object.fromEntries(SHOP_ITEMS.map(item=>[item.name,item])));
export const REWARD_BY_NAME=Object.freeze(Object.fromEntries(REWARD_ITEMS.map(item=>[item.name,item])));
export const isRewardName=name=>typeof name==='string'&&Object.hasOwn(REWARD_BY_NAME,name);
export const ITEMS=Object.freeze({...FISH_CATALOG.items,...SHOP_BY_NAME,...REWARD_BY_NAME});
export const isFishName=name=>typeof name==='string'&&Object.hasOwn(FISH_CATALOG.items,name);
export const isShopName=name=>typeof name==='string'&&Object.hasOwn(SHOP_BY_NAME,name);
export const knownItem=name=>typeof name==='string'&&Object.hasOwn(ITEMS,name);
export const quantityOf=item=>isShopName(item?.name)?(item.quantity??1):1;
export const stackLimit=name=>isShopName(name)?SHOP_BY_NAME[name].stackLimit:1;
export const unitSalePrice=name=>isFishName(name)?FISH_PRICES[name]:isShopName(name)?SHOP_BY_NAME[name].sellPrice:isRewardName(name)?REWARD_BY_NAME[name].sellPrice:null;
// Legacy items without wear are restored as full durability.
export function itemUnitSalePrice(item){
  const max=tackleFor(item?.name)?.maxWear;
  return max&&(item.lineWear??max)<max?0:unitSalePrice(item?.name);
}
export function quantityFields(raw){
  if(!isShopName(raw.name))return {};
  const quantity=raw.quantity??1,limit=stackLimit(raw.name);
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>limit)throw Error('道具数量异常，已停止加载以保护存档，请保留浏览器数据并联系维护者。');
  return {...wearFields(raw),...(limit>1?{quantity}:{})};
}
export function bestLure(items){
  return items.reduce((best,item)=>{
    if(item.x===null||!isShopName(item.name)||SHOP_BY_NAME[item.name].kind!=='lure'||quantityOf(item)<1)return best;
    return !best||SHOP_BY_NAME[item.name].price>SHOP_BY_NAME[best.name].price?item:best;
  },null);
}
