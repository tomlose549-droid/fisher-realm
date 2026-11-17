import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_QUALITIES,FISH_DATA} from '../fish-data.js';
import {giftRequirement} from '../quest-rules.js';
import {buildFishHelp} from '../fish-help.js';
test('new arowana quality order, matching display colors and minimum-quality quests',()=>{
 assert.deepEqual(FISH_QUALITIES.slice(-6),['violet','pink','yellow','orange','red','dark red']);
 for(const [id,quality,color,label]of [['BLACK_AROWANA','pink','#ffc0cb','粉色'],['SILVER_AROWANA','yellow','#ffff00','黄色'],['SOUTHERN_SARATOGA','yellow','#ffff00','黄色'],['AUSTRALIAN_PEARL_AROWANA','orange','#ffa500','橙色'],['GOLDEN_AROWANA','red','#ff0000','红色'],['ASIAN_AROWANA','dark red','#8b0000','深红色']]){
  const fish=FISH_DATA.find(f=>f.id===id);assert.equal(fish.quality,quality);assert.equal(fish.catchColor,color);assert.equal(fish.inventory.color,color);
  assert.equal(giftRequirement({mainCompleted:2,counts:[0,0]},'main-3',fish.name),0);
  assert.equal(giftRequirement({mainCompleted:4,counts:[0,0]},'main-5',fish.name),0);
  assert.ok(buildFishHelp([fish]).profiles[0].lines.some(line=>line.includes(label)));
 }
});
