import {SHOP_BY_NAME,isShopName} from './item-data.js';
import {ENCOUNTER_UNITS} from './fish-encounters.js';

// The approved reduction is relative to the base probability, not to a renormalized weight.
// Only the other qualities receive the removed grey/white probability, in their original ratios.
export function withLure(base,name){
  if(!name)return base;
  if(!isShopName(name)||SHOP_BY_NAME[name].kind!=='lure')throw TypeError('Unknown lure');
  const modifiers=SHOP_BY_NAME[name].modifiers;
  const affected=row=>Object.hasOwn(modifiers,row.quality);
  const removed=base.ranges.reduce((sum,row)=>sum+(affected(row)?row.percent*(1-modifiers[row.quality]):0),0);
  const others=base.ranges.reduce((sum,row)=>sum+(!affected(row)?row.percent:0),0);
  if(removed>0&&others<=0)throw Error('当前地图无法分配亮片调整后的概率');
  const multiplier=others>0?1+removed/others:1,qualityTotals=Object.fromEntries(Object.keys(base.qualityTotals).map(q=>[q,0]));
  let end=0;
  const ranges=base.ranges.map(row=>{
    const percent=row.percent*(affected(row)?modifiers[row.quality]:multiplier),units=percent*100,start=end;
    end+=units;qualityTotals[row.quality]+=percent;return Object.freeze({...row,percent,units,start,end});
  });
  if(Math.abs(end-ENCOUNTER_UNITS)>1e-6)throw Error('亮片概率合计异常');
  const weights=new Map(ranges.map(row=>[row.id,row.percent]));
  return Object.freeze({ranges:Object.freeze(ranges),fishPool:base.fishPool,qualityTotals:Object.freeze(qualityTotals),probabilityFor:id=>weights.get(id)??null,
    pick(unit){
      if(!Number.isFinite(unit))throw TypeError('Expected a finite random value');
      const sample=Math.max(0,Math.min(1,unit));
      return ranges.find(row=>row.units>0&&sample<row.end/ENCOUNTER_UNITS)?.profile??base.fishPool.at(-1);
    }
  });
}
