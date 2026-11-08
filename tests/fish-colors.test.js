import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA,FISH_CATALOG} from '../fish-data.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
import {FishingSession} from '../fishing-rules.js';
import {buildFishHelp} from '../fish-help.js';
import {buildFishGuide} from '../fish-guide.js';
import template from '../scripts/prepare-fish.cjs';

const changed=[['REDFIN_PICKEREL','#00008b','靛蓝色'],['LONGNOSE_GAR','#4b0082','紫罗兰色']];

test('updated colors reach catches, inventory, help and guide without changing fish identities',()=>{
  for(const [id,color,label] of changed){
    const fish=FISH_DATA.find(f=>f.id===id),profile=FISH_CATALOG.byId[id];
    const session=new FishingSession(()=>0,{fish:{...profile,stamina:0}});
    session.cast(0,0);assert.equal(session.hook(6),true);
    session.setReeling(true,6);session.advance(11);
    assert.equal(session.lastCatchName,fish.name);assert.equal(session.lastCatchColor,color);
    assert.equal(FISH_ITEMS[fish.name].color,color);
    const help=buildFishHelp([fish]).profiles[0],guide=buildFishGuide([fish]).fish[0];
    for(const data of [help,guide]){
      assert.equal(data.id,id);assert.equal(data.catchColor,color);assert.equal(data.inventoryColor,color);
    }
    assert.ok(help.lines.at(-1).includes(`钓获文字色：${label}；背包底色：${label}`));
  }
  for(const id of ['GOLDEN_SHINER','LARGEMOUTH_BASS','BOWFIN']){
    const fish=FISH_DATA.find(f=>f.id===id);
    assert.equal(fish.catchColor,'#0000ff');assert.equal(fish.inventory.color,'#0000ff');
  }
});

test('existing saved fish retain their names, positions and dimensions while using the new colors',()=>{
  const saved={version:1,items:[{id:'1',name:'红鳍狗鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:0,y:1},{id:'3',name:'长吻雀鳝',x:null,y:null}]};
  const bag=new FishInventory(saved);assert.deepEqual(bag.serialize(),saved);
  assert.deepEqual([FISH_ITEMS['红鳍狗鱼'].h,FISH_ITEMS['红鳍狗鱼'].w],[1,2]);
  assert.deepEqual([FISH_ITEMS['长吻雀鳝'].h,FISH_ITEMS['长吻雀鳝'].w],[1,4]);
});

test('future indigo and violet inputs use the new colors while blue keeps its existing color',async()=>{
  for(const [color,expected] of [['indigo','#00008b'],['violet','#4b0082'],['blue','#0000ff']]){
    const input={'标识':'PALETTE_TEST','名称':'配色测试鱼','颜色':color,
      '力量':{'间隔秒':0.2,'降低韧性':2},'速度米每秒':4,'耐力':40,'休息秒':3,
      '挣扎':{'最小角度':30,'最大角度':40,'每段秒':[4],'换边停顿秒':0},
      '背包':{'高':1,'宽':2,'图片':null},'特殊属性':[]};
    const fish=await template.prepare(input);
    assert.equal(fish.catchColor,expected);assert.equal(fish.inventory.color,expected);
  }
});
