import test from 'node:test';
import assert from 'node:assert/strict';
import {createEqualEncounterTable,createEncounterTable} from '../fish-encounters.js';
import {AMAZON_CONFLUENCE_ENCOUNTERS as table,AMAZON_FISH_IDS as ids} from '../maps/amazon-confluence-fish.js';
import {withLure} from '../lure-encounters.js';
import {ITEMS} from '../item-data.js';
test('thirteen equal shares are not rounded into an unequal hundredth-percent allocation',()=>{
 assert.equal(ids.length,13);const counts=new Map(ids.map(id=>[id,0]));
 for(let i=0;i<13000;i++){const fish=table.pick((i+.5)/13000);const id=table.ranges.find(r=>r.profile===fish).id;counts.set(id,counts.get(id)+1);}
 for(const id of ids){assert.equal(counts.get(id),1000);assert.equal(table.probabilityFor(id),100/13);}
 for(let i=0;i<13;i++){assert.equal(table.pick(i/13),table.fishPool[i]);assert.equal(table.pick((i+1)/13-1e-10),table.fishPool[i]);}
 assert.equal(table.pick(1),table.fishPool.at(-1));assert.equal(table.probabilityFor('TILAPIA'),0);assert.equal(table.ranges.at(-1).end,10000);
});
test('equal-share membership must be explicitly valid and normal percent validation remains strict',()=>{
 for(const ids of [[],['UNKNOWN'],['TILAPIA','TILAPIA']])assert.throws(()=>createEqualEncounterTable(ids),TypeError);
 assert.throws(()=>createEncounterTable([{id:'TILAPIA',percent:100/13}],{requireAll:false}),/two decimals/);
 assert.throws(()=>table.pick(NaN),/finite/);assert.ok(Object.isFrozen(table.ranges));
});
test('all five lure calculations preserve the thirteen-fish pool, zero chances and total probability',()=>{
 for(const name of ['1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){
  const derived=withLure(table,name);assert.equal(derived.fishPool,table.fishPool);assert.ok(Math.abs(derived.ranges.reduce((n,r)=>n+r.percent,0)-100)<1e-8);
  for(const row of derived.ranges){assert.ok(row.percent>=0);if(!ids.includes(row.id))assert.equal(row.percent,0);}
 }
 const medium=withLure(table,'4号亮片-中体型吸引'),stepOne=row=>{const factor={white:.52,'light green':.91};return 100/13*(factor[row.quality]??(1+.75/9));};
 const big=table.ranges.filter(r=>r.units>0&&ITEMS[r.profile.name].w*ITEMS[r.profile.name].h>=3),small=table.ranges.filter(r=>r.units>0&&!big.includes(r));
 const extra=big.reduce((n,r)=>n+stepOne(r)*.2,0),smallTotal=small.reduce((n,r)=>n+stepOne(r),0);
 for(const r of big)assert.ok(Math.abs(medium.probabilityFor(r.id)-stepOne(r)*1.2)<1e-8);
 for(const r of small)assert.ok(Math.abs(medium.probabilityFor(r.id)-stepOne(r)*(1-extra/smallTotal))<1e-8);
});
