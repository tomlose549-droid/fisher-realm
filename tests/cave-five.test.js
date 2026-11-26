import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA} from '../fish-data.js';
import {PlayerStorage} from '../storage-rules.js';
const prices={"墨西哥盲鱼":120,"尤卡坦盲沼鳝":168,"米切尔洞穴虾":33,"莫氏洞穴虾":32,"尤卡坦食蚊鱼":1};
const expected=[
 ['MEXICAN_BLINDFISH','墨西哥盲鱼','orange',2,.15,6,41,1.9,37,47,[1,1,1,1],2],
 ['YUCATAN_BLIND_SWAMP_EEL','尤卡坦盲沼鳝','orange',2,.18,6.8,33,2,37,47,[1,1.7,1.2,1.8],3],
 ['MITCHELL_CAVE_SHRIMP','米切尔洞穴虾','pink',6,.16,12,40,2,40,45,[.35],1],
 ['MO_CAVE_SHRIMP','莫氏洞穴虾','pink',5,.1,10,40,1.6,41,45,[.5],1],
 ['YUCATAN_MOSQUITOFISH','尤卡坦食蚊鱼','white',2,.29,3,40,2.1,37,48,[1,.4,1.5],1]
];
for(const [id,name,quality,amount,interval,speed,stamina,restDuration,minAngle,maxAngle,durations,w]of expected)test(name+' matches the confirmed stats, footprint and confirmed sale price',()=>{
 const f=FISH_DATA.find(f=>f.id===id);assert.ok(f);assert.equal(f.name,name);assert.equal(f.quality,quality);assert.equal(f.sellPrice,prices[name]);assert.deepEqual(f.strength,{amount,interval});assert.equal(f.speed,speed);assert.equal(f.stamina,stamina);assert.equal(f.restDuration,restDuration);assert.deepEqual(f.struggle,{minAngle,maxAngle,durations});assert.deepEqual(f.specials,[]);assert.equal(f.inventory.w,w);assert.equal(f.inventory.h,1);assert.equal(f.catchColor,{orange:'#ffa500',pink:'#ffc0cb',white:'#ffffff'}[quality]);assert.equal(f.inventory.color,f.catchColor);
 const model=new PlayerStorage();assert.equal(model.giveFish(name).ok,true);const item=model.boxes[0].items[0];const sold=model.sell(item.id,0);assert.equal(sold.ok,true);assert.equal(model.coins,prices[name]);assert.equal(model.boxes[0].items.length,0);
});
