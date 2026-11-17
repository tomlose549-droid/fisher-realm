import {SHOP_BY_NAME,ITEMS,isShopName} from './item-data.js';
import {ENCOUNTER_UNITS} from './fish-encounters.js';

// Relative quality reductions retain their exact values; the removed probability
// goes only to unaffected qualities, in their original proportions.
export function withLure(base,name){
  if(!name)return base;
  if(!isShopName(name)||SHOP_BY_NAME[name].kind!=='lure')throw TypeError('Unknown lure');
  const {modifiers,areaBoost}=SHOP_BY_NAME[name],affected=row=>Object.hasOwn(modifiers,row.quality);
  const removed=base.ranges.reduce((sum,row)=>sum+(affected(row)?row.percent*(1-modifiers[row.quality]):0),0);
  const others=base.ranges.reduce((sum,row)=>sum+(!affected(row)?row.percent:0),0);
  if(base.fishPool.length===1)return base;
  if(removed>0&&others<=0)throw Error('当前地图无法分配亮片调整后的概率');
  const multiplier=others>0?1+removed/others:1;
  let percentages=base.ranges.map(row=>row.percent*(affected(row)?modifiers[row.quality]:multiplier));
  if(areaBoost){
    const large=base.ranges.map(row=>{const item=ITEMS[row.profile.name];return item.w*item.h>=areaBoost.minArea;});
    const big=percentages.reduce((sum,p,i)=>sum+(large[i]?p:0),0),small=percentages.reduce((sum,p,i)=>sum+(large[i]?0:p),0),extra=Math.min(big*areaBoost.increase,small);
    // A size-heavy pool can exhaust small-fish probability; only transfer what is available.
    const bigScale=big>0?1+extra/big:1;
    const smallScale=small>0?Math.max(0,1-extra/small):1;
    percentages=percentages.map((p,i)=>p*(large[i]?bigScale:smallScale));
  }
  const qualityTotals=Object.fromEntries(Object.keys(base.qualityTotals).map(q=>[q,0]));let end=0;
  const ranges=base.ranges.map((row,i)=>{
    const percent=percentages[i],units=percent*100,start=end;end+=units;qualityTotals[row.quality]+=percent;
    return Object.freeze({...row,percent,units,start,end});
  });
  if(Math.abs(end-ENCOUNTER_UNITS)>1e-6)throw Error('亮片概率合计异常');
  const weights=new Map(ranges.map(row=>[row.id,row.percent]));
  return Object.freeze({ranges:Object.freeze(ranges),fishPool:base.fishPool,qualityTotals:Object.freeze(qualityTotals),probabilityFor:id=>weights.get(id)??null,
    pick(unit){
      if(!Number.isFinite(unit))throw TypeError('Expected a finite random value');
      const sample=Math.max(0,Math.min(1,unit));
      return ranges.find(row=>row.units>0&&sample<row.end/ENCOUNTER_UNITS)?.profile??ranges.findLast(row=>row.units>0)?.profile;
    }
  });
}
