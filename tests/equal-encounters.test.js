import test from 'node:test';
import assert from 'node:assert/strict';
import {createEqualEncounterTable,createEncounterTable} from '../fish-encounters.js';
import {AMAZON_CONFLUENCE_ENCOUNTERS as table,AMAZON_FISH_IDS as ids} from '../maps/amazon-confluence-fish.js';
import {withLure} from '../lure-encounters.js';
import {ITEMS} from '../item-data.js';
import {FISH_DATA} from '../fish-data.js';
test('equal shares are not rounded into an unequal hundredth-percent allocation',()=>{
 const n=ids.length;const counts=new Map(ids.map(id=>[id,0]));
 for(let i=0;i<n*1000;i++){const fish=table.pick((i+.5)/(n*1000));const id=table.ranges.find(r=>r.profile===fish).id;counts.set(id,counts.get(id)+1);}
 for(const id of ids){assert.equal(counts.get(id),1000);assert.equal(table.probabilityFor(id),100/n);}
 for(let i=0;i<n;i++){assert.equal(table.pick(i/n),table.fishPool[i]);assert.equal(table.pick((i+1)/n-1e-10),table.fishPool[i]);}
 assert.equal(table.pick(1),table.fishPool.at(-1));assert.equal(table.probabilityFor('TILAPIA'),0);assert.equal(table.ranges.at(-1).end,10000);
});
test('equal-share membership must be explicitly valid and normal percent validation remains strict',()=>{
 for(const ids of [[],['UNKNOWN'],['TILAPIA','TILAPIA']])assert.throws(()=>createEqualEncounterTable(ids),TypeError);
 assert.throws(()=>createEncounterTable([{id:'TILAPIA',percent:100/13}],{requireAll:false}),/two decimals/);
 assert.throws(()=>table.pick(NaN),/finite/);assert.ok(Object.isFrozen(table.ranges));
});
test('all five lure calculations preserve the current equal-share pool, zero chances and total probability',()=>{
 for(const name of ['1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){
  const derived=withLure(table,name);assert.equal(derived.fishPool,table.fishPool);assert.ok(Math.abs(derived.ranges.reduce((n,r)=>n+r.percent,0)-100)<1e-8);
  for(const row of derived.ranges){assert.ok(row.percent>=0);if(!ids.includes(row.id))assert.equal(row.percent,0);}
 }
 const otherCount=table.ranges.filter(r=>r.units>0&&!['white','light green'].includes(r.quality)).length;
 const medium=withLure(table,'4号亮片-中体型吸引'),stepOne=row=>{const factor={white:.52,'light green':.91};return 100/ids.length*(factor[row.quality]??(1+.75/otherCount));};
 const big=table.ranges.filter(r=>r.units>0&&ITEMS[r.profile.name].w*ITEMS[r.profile.name].h>=3),small=table.ranges.filter(r=>r.units>0&&!big.includes(r));
 const bigTotal=big.reduce((n,r)=>n+stepOne(r),0),smallTotal=small.reduce((n,r)=>n+stepOne(r),0),extra=Math.min(bigTotal*.2,smallTotal);
 for(const r of big)assert.ok(Math.abs(medium.probabilityFor(r.id)-stepOne(r)*(1+extra/bigTotal))<1e-8);
 for(const r of small)assert.ok(Math.abs(medium.probabilityFor(r.id)-stepOne(r)*(1-extra/smallTotal))<1e-8);
});

// No image or old fish parameter checks are involved in these boundary fixtures.
test('medium lure caps size boost when small-fish probability is exhausted',()=>{
 const base=createEqualEncounterTable(['BLACK_AROWANA','SILVER_AROWANA','GUPPY']);
 const table=withLure(base,'4号亮片-中体型吸引');
 assert.ok(Math.abs(table.probabilityFor('BLACK_AROWANA')-41.8)<1e-8);
 assert.ok(Math.abs(table.probabilityFor('GUPPY')-16.4)<1e-8);
 const saturated=createEqualEncounterTable(['BLACK_AROWANA','SILVER_AROWANA','SOUTHERN_SARATOGA','AUSTRALIAN_PEARL_AROWANA','GOLDEN_AROWANA','ASIAN_AROWANA','GUPPY']);
 const derived=withLure(saturated,'4号亮片-中体型吸引');
 assert.equal(derived.probabilityFor('GUPPY'),0);
 for(const f of saturated.ranges.filter(r=>r.units>0&&r.id!=='GUPPY'))assert.ok(Math.abs(derived.probabilityFor(f.id)-100/6)<1e-8);
 assert.ok(Math.abs(derived.ranges.reduce((sum,r)=>sum+r.percent,0)-100)<1e-8);
 assert.equal(derived.probabilityFor('TILAPIA'),0);
 const entries=FISH_DATA.filter(f=>['BLACK_AROWANA','SILVER_AROWANA','SOUTHERN_SARATOGA','AUSTRALIAN_PEARL_AROWANA','GOLDEN_AROWANA','ASIAN_AROWANA'].includes(f.id)).concat(FISH_DATA.find(f=>f.id==='GUPPY'));
 const lastZero=withLure(createEqualEncounterTable(entries.map(f=>f.id),{entries}),'4号亮片-中体型吸引');assert.equal(lastZero.probabilityFor('GUPPY'),0);assert.notEqual(lastZero.pick(1).name,'孔雀鱼');assert.notEqual(lastZero.pick(1-Number.EPSILON).name,'孔雀鱼');
 const allBig=withLure(createEqualEncounterTable(['BLACK_AROWANA','SILVER_AROWANA']),'4号亮片-中体型吸引');
 assert.equal(allBig.probabilityFor('BLACK_AROWANA'),50);assert.equal(allBig.probabilityFor('SILVER_AROWANA'),50);
 const allSmall=withLure(createEqualEncounterTable(['GUPPY']),'4号亮片-中体型吸引');
 assert.equal(allSmall.probabilityFor('GUPPY'),100);
});
