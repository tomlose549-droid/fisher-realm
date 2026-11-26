import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA} from '../fish-data.js';
import {getMapContext,listMaps} from '../map-registry.js';
import {withLure} from '../lure-encounters.js';
import {PlayerStorage} from '../storage-rules.js';
const expected=[
 ['MEXICAN_BLINDFISH','墨西哥盲鱼','orange',2,.15,6,41,1.9,37,47,[1,1,1,1],2],
 ['YUCATAN_BLIND_SWAMP_EEL','尤卡坦盲沼鳝','orange',2,.18,6.8,33,2,37,47,[1,1.7,1.2,1.8],3],
 ['MITCHELL_CAVE_SHRIMP','米切尔洞穴虾','pink',6,.16,13,70,.5,40,47,[.4],1],
 ['MO_CAVE_SHRIMP','莫氏洞穴虾','pink',5,.1,11,70,.6,41,47,[.6],1],
 ['YUCATAN_MOSQUITOFISH','尤卡坦食蚊鱼','white',2,.29,3,40,2.1,37,48,[1,.4,1.5],1]
];
for(const [id,name,quality,amount,interval,speed,stamina,restDuration,minAngle,maxAngle,durations,w]of expected)test(name+' matches the confirmed stats, footprint and zero sale price',()=>{
 const f=FISH_DATA.find(f=>f.id===id);assert.ok(f);assert.equal(f.name,name);assert.equal(f.quality,quality);assert.equal(f.sellPrice,0);assert.deepEqual(f.strength,{amount,interval});assert.equal(f.speed,speed);assert.equal(f.stamina,stamina);assert.equal(f.restDuration,restDuration);assert.deepEqual(f.struggle,{minAngle,maxAngle,durations});assert.deepEqual(f.specials,[]);assert.equal(f.inventory.w,w);assert.equal(f.inventory.h,1);assert.equal(f.catchColor,{orange:'#ffa500',pink:'#ffc0cb',white:'#ffffff'}[quality]);assert.equal(f.inventory.color,f.catchColor);
 const model=new PlayerStorage();assert.equal(model.giveFish(name).ok,true);const item=model.boxes[0].items[0];const sold=model.sell(item.id,0);assert.equal(sold.ok,true);assert.equal(model.coins,0);assert.equal(model.boxes[0].items.length,0);
});
test('only Sac Actun gives the five new species equal 20 percent shares; tilapia is zero',()=>{
 const cave=getMapContext('sac-actun').encounters;assert.deepEqual(cave.fishPool.map(f=>f.name),expected.map(r=>r[1]));assert.equal(cave.probabilityFor('TILAPIA'),0);assert.equal(cave.qualityTotals.orange,40);assert.equal(cave.qualityTotals.pink,40);assert.equal(cave.qualityTotals.white,20);
 for(const {id}of listMaps()){const table=getMapContext(id).encounters;for(const [fishId]of expected)assert.equal(table.probabilityFor(fishId),id==='sac-actun'?20:0);assert.equal(table.ranges.reduce((n,r)=>n+r.percent,0).toFixed(6),'100.000000');}
 for(let i=0;i<5;i++){assert.equal(cave.pick((i+.5)/5).name,expected[i][1]);assert.equal(cave.pick(i/5).name,expected[i][1]);}assert.equal(cave.pick(1).name,expected.at(-1)[1]);
});
test('all cave lures use current modifiers and never add other fish; medium lure boosts only the 3-cell eel',()=>{
 const cave=getMapContext('sac-actun').encounters;
 for(const lure of ['1号亮片','2号亮片','3号亮片','4号亮片-中体型吸引','5号假饵']){const t=withLure(cave,lure);assert.equal(t.probabilityFor('TILAPIA'),0);assert.ok(Math.abs(t.ranges.reduce((n,r)=>n+r.percent,0)-100)<1e-8);assert.deepEqual(t.fishPool,cave.fishPool);for(const [id]of expected)assert.ok(t.probabilityFor(id)>0);}
 assert.equal(withLure(cave,'1号亮片').probabilityFor('YUCATAN_MOSQUITOFISH'),15);assert.equal(withLure(cave,'1号亮片').probabilityFor('MEXICAN_BLINDFISH'),21.25);const medium=withLure(cave,'4号亮片-中体型吸引');assert.ok(Math.abs(medium.probabilityFor('YUCATAN_BLIND_SWAMP_EEL')-26.88)<1e-8);
});
