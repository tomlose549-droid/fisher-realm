import {SUMMER_POND_ENCOUNTERS} from '../maps/summer-pond-fish.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA,DEFAULT_CATCH_COLOR} from '../fish-data.js';
import {buildFishGuide} from '../fish-guide.js';

test('guide uses all catalog fish in encounter order with two independent actual colors',()=>{
  const guide=buildFishGuide();assert.equal(guide.count,FISH_DATA.length);
  assert.deepEqual(guide.fish.map(f=>f.id),FISH_DATA.map(f=>f.id));
  for(const [i,fish] of FISH_DATA.entries()){
    const entry=guide.fish[i];assert.equal(entry.name,fish.name);assert.equal(entry.image,fish.inventory.image);
    assert.equal(entry.catchColor,fish.catchColor??DEFAULT_CATCH_COLOR);assert.equal(entry.inventoryColor,fish.inventory.color);
    assert.deepEqual(entry.strength,fish.strength);assert.equal(entry.stamina,fish.stamina);assert.equal(entry.speed,fish.speed);
    assert.equal(entry.restDuration,fish.restDuration);assert.deepEqual([entry.height,entry.width],[fish.inventory.h,fish.inventory.w]);
    assert.equal(entry.probability,SUMMER_POND_ENCOUNTERS.probabilityFor(fish.id)+'%');
  }
});

test('new and changed fish automatically update guide fields, probability and missing image',()=>{
  const extra={...structuredClone(FISH_DATA[0]),id:'GUIDE_TEST',name:'临时<图鉴>鱼',stamina:99,speed:8.1,restDuration:2.7,strength:{amount:7,interval:.18},catchColor:'#123456',inventory:{w:4,h:2,color:'#654321',image:null},struggle:{minAngle:27,maxAngle:40,durations:[2,3,4],switchPause:.25},specials:['换边前停顿0.25秒']};
  const result=buildFishGuide([...FISH_DATA,extra]),f=result.fish.at(-1);
  assert.equal(result.count,FISH_DATA.length+1);assert.equal(f.name,extra.name);assert.equal(f.image,null);assert.equal(f.stamina,99);assert.equal(f.speed,8.1);assert.equal(f.restDuration,2.7);assert.deepEqual(f.strength,extra.strength);
  assert.equal(f.catchColor,'#123456');assert.equal(f.inventoryColor,'#654321');assert.deepEqual([f.height,f.width],[2,4]);
  for(const text of ['27°–40°','2、3、4秒','停顿0.25秒','休息2.7秒'])assert.ok(f.movement.includes(text),text);
  assert.equal(f.specials,extra.specials[0]);assert.equal(f.probability,'未配置（需先确认分配）');
});

test('guide describes legacy, single and five legs without inventing special behavior',()=>{
  const {fish}=buildFishGuide();assert.ok(fish[0].movement.includes('3.9、3.4秒'));
  assert.ok(fish.find(f=>f.id==='GOLDEN_SHINER').movement.includes('轮内不换边'));
  assert.ok(fish.find(f=>f.id==='FLORIDA_GAR').movement.includes('4、2、1.5、0.8、0.2秒，共5段'));
  assert.equal(fish[0].specials,'无');assert.deepEqual(buildFishGuide([]),{count:0,fish:[]});
});
