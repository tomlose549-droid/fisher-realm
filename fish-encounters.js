import {FISH_DATA,FISH_CATALOG,FISH_QUALITIES,createFishCatalog} from './fish-data.js';

// Percentages use integer basis points so totals and bands do not accumulate rounding.
export const ENCOUNTER_UNITS=10000;
export function createEncounterTable(probabilities,{entries=FISH_DATA,requireAll=true}={}){
  if(!Array.isArray(probabilities)||!probabilities.length)throw new TypeError('Expected a nonempty probability table');
  const byId=new Map(entries.map(f=>[f.id,f])),weights=new Map();
  for(const row of probabilities){
    if(!row||!byId.has(row.id)||weights.has(row.id))throw new TypeError('Unknown or duplicate fish probability: '+row?.id);
    const units=Math.round(row.percent*100);
    if(!Number.isFinite(row.percent)||row.percent<0||row.percent>100||Math.abs(row.percent*100-units)>1e-8)
      throw new TypeError('Fish probability must be 0–100 percent with at most two decimals: '+row.id);
    weights.set(row.id,units);
  }
  if(requireAll&&entries.some(f=>!weights.has(f.id)))throw new TypeError('Missing fish probability; confirm allocation before adding fish');
  if([...weights.values()].reduce((sum,n)=>sum+n,0)!==ENCOUNTER_UNITS)throw new TypeError('Fish probabilities must total 100%');
  const profiles=entries===FISH_DATA?FISH_CATALOG.byId:createFishCatalog(entries).byId;
  const qualityUnits=Object.fromEntries(FISH_QUALITIES.map(q=>[q,0]));let end=0;
  const ranges=entries.filter(f=>weights.has(f.id)).map(f=>{
    if(!FISH_QUALITIES.includes(f.quality))throw new TypeError('Missing or invalid fish quality: '+f.id);
    const units=weights.get(f.id),start=end;end+=units;qualityUnits[f.quality]+=units;
    return Object.freeze({id:f.id,quality:f.quality,percent:units/100,units,start,end,profile:profiles[f.id]});
  });
  const fishPool=Object.freeze(ranges.filter(r=>r.units>0).map(r=>r.profile));
  return Object.freeze({ranges:Object.freeze(ranges),fishPool,
    qualityTotals:Object.freeze(Object.fromEntries(FISH_QUALITIES.map(q=>[q,qualityUnits[q]/100]))),
    probabilityFor:id=>weights.has(id)?weights.get(id)/100:null,
    pick(unit){
      if(!Number.isFinite(unit))throw new TypeError('Expected a finite random value');
      const sample=Math.max(0,Math.min(1,unit));
      for(const row of ranges)if(row.units>0&&sample<row.end/ENCOUNTER_UNITS)return row.profile;
      return fishPool.at(-1);
    }
  });
}
