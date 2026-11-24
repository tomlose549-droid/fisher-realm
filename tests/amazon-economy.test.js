import {createSaveSlots} from '../save-slots.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FISH_DATA} from '../fish-data.js';
import {createEncounterTable} from '../fish-encounters.js';
import {AMAZON_CONFLUENCE_ENCOUNTERS as table} from '../maps/amazon-confluence-fish.js';
import {createMapEntry,mapEntryFee} from '../map-entry.js';
import {createPlayerStorage} from '../player-storage.js';
import {PlayerStorage} from '../storage-rules.js';
import {BACKPACK_LEVELS} from '../backpack-upgrades.js';
import {withLure} from '../lure-encounters.js';
const spec=JSON.parse(readFileSync(new URL('./fixtures/amazon-economy.json',import.meta.url)));
test('approved fish and quality probabilities total 100 with all thousandth-percent outcomes reachable',()=>{
 const rows=spec.groups.flatMap(([quality,_,fish])=>fish.map(([name,percent])=>({name,percent,quality})));assert.equal(rows.length,63);
 for(const [quality,total,fish]of spec.groups){assert.equal(table.qualityTotals[quality],total);assert.equal(fish.reduce((n,[,p])=>n+Math.round(p*1000),0),Math.round(total*1000));}
 const counts=new Map();for(let i=0;i<100000;i++){const f=table.pick((i+.5)/100000);counts.set(f.name,(counts.get(f.name)||0)+1);}
 for(const row of rows){const fish=FISH_DATA.find(f=>f.name===row.name);assert.equal(fish.quality,row.quality);assert.equal(table.probabilityFor(fish.id),row.percent);assert.equal(counts.get(row.name),Math.round(row.percent*1000));}
 assert.equal([...counts.values()].reduce((a,b)=>a+b,0),100000);assert.equal(counts.get('亚洲龙鱼'),1);assert.equal(counts.get('巴卡雷龙'),1);
});
test('three-decimal mode is explicit, rejects lost precision, bad totals, duplicate/omitted species and invalid modes',()=>{
 const rows=[{id:'ASIAN_AROWANA',percent:.001},{id:'ARAPAIMA',percent:99.999}];const good=createEncounterTable(rows,{decimalPlaces:3,requireAll:false});assert.equal(good.probabilityFor('ASIAN_AROWANA'),.001);assert.equal(good.pick(0).name,'亚洲龙鱼');
 assert.throws(()=>createEncounterTable(rows,{requireAll:false}),/two decimals/);assert.throws(()=>createEncounterTable(rows,{decimalPlaces:4,requireAll:false}));assert.throws(()=>createEncounterTable([{id:'ASIAN_AROWANA',percent:.0001},{id:'ARAPAIMA',percent:99.9999}],{decimalPlaces:3,requireAll:false}),/three decimals/);assert.throws(()=>createEncounterTable(rows,{decimalPlaces:3}),/Missing/);assert.throws(()=>createEncounterTable([...rows,rows[0]],{decimalPlaces:3,requireAll:false}),/duplicate/);assert.throws(()=>createEncounterTable([{id:'ASIAN_AROWANA',percent:.001}],{decimalPlaces:3,requireAll:false}),/100/);
});
test('all 36 approved sale prices apply to existing saved fish and their proceeds persist',()=>{
 let count=0;for(const [,_,fish]of spec.groups)for(const [name,,price]of fish){if(price===undefined)continue;count++;const f=FISH_DATA.find(f=>f.name===name);assert.equal(f.sellPrice,price);const level=BACKPACK_LEVELS.find(l=>l.w>=f.inventory.w&&l.h>=f.inventory.h).level;
  const model=new PlayerStorage({version:1,backpackLevel:level,items:[{id:'1',name,x:0,y:0}]});model.coins=17;assert.equal(model.transfer('1','bag',0,0,0).ok,true);assert.equal(model.sell('1',0).price,price);assert.equal(new PlayerStorage(model.serialize()).coins,17+price);
 }assert.equal(count,36);
});
test('five lures keep weighted rare species positive and preserve total probability',()=>{
 for(const name of ['1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){const derived=withLure(table,name);assert.ok(Math.abs(derived.ranges.reduce((n,r)=>n+r.percent,0)-100)<1e-8);assert.ok(derived.probabilityFor('ASIAN_AROWANA')>0);assert.ok(derived.probabilityFor('BARCA_SNAKEHEAD')>0);assert.ok(derived.ranges.every(r=>r.percent>=0));}
});
function fixture(coins=57){let blocked=false;const values=new Map(),store=createPlayerStorage({storage:{getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);}}});store.run('setCoins',[coins]);return {store,block(value){blocked=value;}};}
test('entry charges once after successful preparation and activation; repeat entry pays again and lake stays free',async()=>{
 const {store}=fixture(),events=[];const entry=createMapEntry({store,prepare:async id=>{events.push('prepare');assert.equal(store.model.coins,events.length===1?57:29);return {id};},activate:()=>events.push('activate'),rollback:()=>events.push('rollback')});
 assert.equal(mapEntryFee('amazon-confluence'),spec.entryFee);assert.equal(mapEntryFee('summer-pond'),0);await entry.enter('amazon-confluence');assert.equal(store.model.coins,29);await entry.enter('amazon-confluence');assert.equal(store.model.coins,1);assert.deepEqual(events,['prepare','activate','prepare','activate']);
 const lake=createMapEntry({store,prepare:async()=>({}),activate(){},rollback(){}});await lake.enter('summer-pond');assert.equal(store.model.coins,1);
});
test('insufficient funds do not prepare; load, activation and persistence failures charge nothing and allow retry',async()=>{
 const poor=fixture(27);let prepared=0;const unavailable=createMapEntry({store:poor.store,prepare:async()=>{prepared++;},activate(){},rollback(){}});await assert.rejects(unavailable.enter('amazon-confluence'),/金币不足/);assert.equal(prepared,0);assert.equal(poor.store.model.coins,27);
 for(const mode of ['load','activate','save']){const f=fixture(),events=[];let fail=true;const entry=createMapEntry({store:f.store,prepare:async()=>{if(mode==='load'&&fail)throw Error('load');return {};},activate(){if(mode==='activate'&&fail)throw Error('activate');},rollback(){events.push('rollback');}});if(mode==='save')f.block(true);await assert.rejects(entry.enter('amazon-confluence'));assert.equal(f.store.model.coins,57);assert.equal(entry.busy,false);assert.deepEqual(events,['rollback']);fail=false;f.block(false);await entry.enter('amazon-confluence');assert.equal(f.store.model.coins,29);}
});
test('overlapping entry cannot double-charge; invalid fees cannot add coins',async()=>{
 const {store}=fixture();let resolve;const entry=createMapEntry({store,prepare:()=>new Promise(r=>resolve=r),activate(){},rollback(){}});const pending=entry.enter('amazon-confluence');await assert.rejects(entry.enter('amazon-confluence'),/正在加载/);resolve({});await pending;assert.equal(store.model.coins,29);
 for(const cost of [-1,.5,Infinity,NaN]){const before=store.snapshot();assert.equal(store.run('payMapEntry',[cost]).ok,false);assert.deepEqual(store.snapshot(),before);}
 await assert.rejects(entry.enter('missing'),/Unknown/);assert.equal(store.model.coins,29);
});

test('entry fees persist independently in each active save slot',async()=>{
 const values=new Map(),io={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});store.run('setCoins',[28]);
 const enter=store=>createMapEntry({store,prepare:async()=>({}),activate(){},rollback(){}}).enter('amazon-confluence');
 await enter(store);assert.equal(store.model.coins,0);assert.equal(slots.create().ok,true);
 slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});store.run('setCoins',[33]);await enter(store);assert.equal(store.model.coins,5);
 slots.select('1');slots=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:slots.storage}).model.coins,0);
 slots.select('2');slots=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:slots.storage}).model.coins,5);
});
