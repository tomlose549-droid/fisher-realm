import {FISH_DATA,FISH_CATALOG,FISH_QUALITIES,createFishCatalog} from './fish-data.js';

// Percentage tables use an explicit integer scale; equal-share tables use integer weights.
export const ENCOUNTER_UNITS=10000;
export function createEncounterTable(probabilities,{entries=FISH_DATA,requireAll=true,decimalPlaces=2}={}){
  if(!Array.isArray(probabilities)||!probabilities.length)throw new TypeError('Expected a nonempty probability table');
  if(![2,3].includes(decimalPlaces))throw new TypeError('Expected two or three decimal places');
  const scale=10**decimalPlaces,totalWeight=100*scale;
  const byId=new Map(entries.map(f=>[f.id,f])),weights=new Map();
  for(const row of probabilities){
    if(!row||!byId.has(row.id)||weights.has(row.id))throw new TypeError('Unknown or duplicate fish probability: '+row?.id);
    const units=Math.round(row.percent*scale);
    if(!Number.isFinite(row.percent)||row.percent<0||row.percent>100||Math.abs(row.percent*scale-units)>1e-8)
      throw new TypeError(`Fish probability must be 0–100 percent with at most ${decimalPlaces===2?'two':'three'} decimals: `+row.id);
    weights.set(row.id,units);
  }
  if(requireAll&&entries.some(f=>!weights.has(f.id)))throw new TypeError('Missing fish probability; confirm allocation before adding fish');
  if([...weights.values()].reduce((sum,n)=>sum+n,0)!==totalWeight)throw new TypeError('Fish probabilities must total 100%');
  return compileTable(entries,weights,totalWeight);
}

// Separate explicit equal-share mode: never round 1/N to a two-decimal percentage.
export function createEqualEncounterTable(ids,{entries=FISH_DATA}={}){
  if(!Array.isArray(ids)||!ids.length)throw new TypeError('Expected a nonempty equal-share fish list');
  const known=new Set(entries.map(f=>f.id)),selected=new Set();
  for(const id of ids){if(!known.has(id)||selected.has(id))throw new TypeError('Unknown or duplicate equal-share fish: '+id);selected.add(id);}
  return compileTable(entries,new Map(entries.map(f=>[f.id,selected.has(f.id)?1:0])),ids.length);
}

function compileTable(entries,weights,totalWeight){
  const profiles=entries===FISH_DATA?FISH_CATALOG.byId:createFishCatalog(entries).byId;
  const qualityUnits=Object.fromEntries(FISH_QUALITIES.map(q=>[q,0]));let cumulative=0;const limits=[];
  const ranges=entries.filter(f=>weights.has(f.id)).map(f=>{
    if(!FISH_QUALITIES.includes(f.quality))throw new TypeError('Missing or invalid fish quality: '+f.id);
    const weight=weights.get(f.id),units=weight*ENCOUNTER_UNITS/totalWeight,start=cumulative*ENCOUNTER_UNITS/totalWeight;cumulative+=weight;const end=cumulative*ENCOUNTER_UNITS/totalWeight;qualityUnits[f.quality]+=weight;limits.push(end/ENCOUNTER_UNITS);
    return Object.freeze({id:f.id,quality:f.quality,percent:weight*100/totalWeight,units,start,end,profile:profiles[f.id]});
  });
  const fishPool=Object.freeze(ranges.filter(r=>r.units>0).map(r=>r.profile));
  return Object.freeze({ranges:Object.freeze(ranges),fishPool,
    qualityTotals:Object.freeze(Object.fromEntries(FISH_QUALITIES.map(q=>[q,qualityUnits[q]*100/totalWeight]))),
    probabilityFor:id=>weights.has(id)?weights.get(id)*100/totalWeight:null,
    pick(unit){
      if(!Number.isFinite(unit))throw new TypeError('Expected a finite random value');
      const sample=Math.max(0,Math.min(1,unit));
      for(let i=0;i<ranges.length;i++)if(ranges[i].units>0&&sample<limits[i])return ranges[i].profile;
      return fishPool.at(-1);
    }
  });
}
