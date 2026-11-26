import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FISH_DATA} from '../fish-data.js';
import {SAC_ACTUN_ENCOUNTERS as table} from '../maps/sac-actun-fish.js';
import {mapEntryFee,createMapEntry} from '../map-entry.js';
import {PlayerStorage} from '../storage-rules.js';
import {createPlayerStorage} from '../player-storage.js';
import {createSaveSlots} from '../save-slots.js';
import {withLure} from '../lure-encounters.js';
import {buildFishHelp} from '../fish-help.js';
import {buildFishGuide} from '../fish-guide.js';
const spec=JSON.parse(readFileSync(new URL('./fixtures/sac-actun-economy.json',import.meta.url))),approved=spec.groups.flatMap(([quality,_,fish])=>fish.map(([name,percent])=>({name,percent,quality}))),wanted=new Map(approved.map(r=>[r.name,r]));
test('all 59 approved probabilities and 14 quality totals exactly match and reach 100 percent',()=>{
 assert.equal(approved.length,59);assert.equal(table.fishPool.length,59);assert.equal(table.ranges.length,FISH_DATA.length);assert.equal(approved.reduce((n,r)=>n+Math.round(r.percent*1000),0),100000);
 for(const [q,total,fish]of spec.groups){assert.equal(table.qualityTotals[q],total,q);assert.equal(fish.reduce((n,[,p])=>n+Math.round(p*1000),0),Math.round(total*1000));}
 const counts=new Map();for(let i=0;i<100000;i++){const f=table.pick((i+.5)/100000);counts.set(f.name,(counts.get(f.name)||0)+1);}
 for(const f of FISH_DATA){const row=wanted.get(f.name);assert.equal(table.probabilityFor(f.id),row?.percent??0,f.name);if(row)assert.equal(f.quality,row.quality);assert.equal(counts.get(f.name)??0,Math.round((row?.percent??0)*1000),f.name);}
 assert.equal(table.probabilityFor('REDTAIL_CATFISH'),.2);assert.equal(table.probabilityFor('ASIAN_AROWANA'),.035);assert.equal(table.probabilityFor('BARCA_SNAKEHEAD'),.035);assert.equal(table.pick(1),table.fishPool.at(-1));
});
test('all five lures preserve the exact zero list, positive rare probabilities and total; 1号 applies expected reductions',()=>{
 for(const lure of ['1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){const t=withLure(table,lure);assert.ok(Math.abs(t.ranges.reduce((n,r)=>n+r.percent,0)-100)<1e-8);for(const r of t.ranges)assert.ok(wanted.has(r.profile.name)?r.percent>0:r.percent===0,r.profile.name);}
 const t=withLure(table,'1号亮片');assert.ok(Math.abs(t.probabilityFor('TILAPIA')-4.9)<1e-8);assert.equal(t.probabilityFor('YUCATAN_MOSQUITOFISH'),15);assert.ok(Math.abs(t.probabilityFor('MEXICAN_BLINDFISH')-.15*(1+14.2/46))<1e-8);
});
test('existing saved fish adopt all five prices and their sale proceeds persist',()=>{
 let total=0;for(const [name,price]of Object.entries(spec.prices)){const model=new PlayerStorage({version:1,items:[],storage:{version:1,coins:9,boxes:[{unlocked:true,items:[{id:'1',name,x:0,y:0}]}]}});assert.equal(model.sell('1',0).price,price);assert.equal(new PlayerStorage(model.serialize()).coins,9+price);total+=price;}assert.equal(total,354);
});
test('help and guide read the updated two shrimp parameters and new cave probabilities without stale text',()=>{
 for(const [id,expected]of Object.entries(spec.shrimp)){const fish=FISH_DATA.find(f=>f.id===id);for(const [k,v]of Object.entries(expected))assert.deepEqual(fish[k],v);const help=buildFishHelp([fish],table).profiles[0],guide=buildFishGuide([fish],table).fish[0];assert.equal(help.probability,.3);assert.equal(guide.probability,'0.3%');assert.equal(guide.speed,expected.speed);assert.equal(guide.stamina,40);assert.equal(guide.restDuration,expected.restDuration);assert.ok(guide.movement.includes('游动'+expected.struggle.durations[0]+'秒'));assert.ok(guide.movement.includes('45°'));}
});
function fixture(coins){let blocked=false;const values=new Map(),store=createPlayerStorage({storage:{getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('quota');values.set(k,v);}}});store.run('setCoins',[coins]);return {store,block(v){blocked=v;}};}
test('45-coin entry charges exactly once per success, 44 cannot prepare, and repeat entry pays again',async()=>{
 assert.equal(mapEntryFee('sac-actun'),45);assert.equal(mapEntryFee('summer-pond'),0);assert.equal(mapEntryFee('amazon-confluence'),28);assert.equal(mapEntryFee('amazon-flooded-forest'),43);
 let builds=0;const poor=fixture(44),no=createMapEntry({store:poor.store,prepare:async()=>builds++,activate(){},rollback(){}});await assert.rejects(no.enter('sac-actun'),/45/);assert.equal(builds,0);assert.equal(poor.store.model.coins,44);
 const {store}=fixture(90),entry=createMapEntry({store,prepare:async()=>({}),activate(){},rollback(){}});await entry.enter('sac-actun');assert.equal(store.model.coins,45);await entry.enter('sac-actun');assert.equal(store.model.coins,0);
});
test('load, activation or failed saving never debit entry; successful retry deducts only 45',async()=>{
 for(const mode of ['load','activate','save']){const f=fixture(45);let fail=true,rollbacks=0;const entry=createMapEntry({store:f.store,prepare:async()=>{if(fail&&mode==='load')throw Error('load');return {};},activate(){if(fail&&mode==='activate')throw Error('activate');},rollback(){rollbacks++;}});if(mode==='save')f.block(true);await assert.rejects(entry.enter('sac-actun'));assert.equal(f.store.model.coins,45);assert.equal(entry.busy,false);assert.equal(rollbacks,1);fail=false;f.block(false);await entry.enter('sac-actun');assert.equal(f.store.model.coins,0);}
});
test('entry payment remains isolated and persistent in each save slot',async()=>{
 const values=new Map(),io={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let slots=createSaveSlots({storage:io}),store=createPlayerStorage({storage:slots.storage});store.run('setCoins',[45]);const enter=store=>createMapEntry({store,prepare:async()=>({}),activate(){},rollback(){}}).enter('sac-actun');await enter(store);assert.equal(store.model.coins,0);assert.equal(slots.create().ok,true);slots=createSaveSlots({storage:io});store=createPlayerStorage({storage:slots.storage});store.run('setCoins',[50]);await enter(store);assert.equal(store.model.coins,5);slots.select('1');slots=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:slots.storage}).model.coins,0);slots.select('2');slots=createSaveSlots({storage:io});assert.equal(createPlayerStorage({storage:slots.storage}).model.coins,5);
});
