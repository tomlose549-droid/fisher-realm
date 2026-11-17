import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_QUALITIES,FISH_DATA} from '../fish-data.js';
import {giftRequirement} from '../quest-rules.js';
import {buildFishHelp} from '../fish-help.js';
test('pink and yellow follow violet and participate in minimum-quality quests with matching display colors',()=>{
 assert.deepEqual(FISH_QUALITIES.slice(-3),['violet','pink','yellow']);
 for(const [id,quality,color,label]of [['REDTAIL_CATFISH','pink','#ffc0cb','粉色'],['AMAZON_GILDED_CATFISH','yellow','#ffff00','黄色']]){
  const fish=FISH_DATA.find(f=>f.id===id);assert.equal(fish.quality,quality);assert.equal(fish.catchColor,color);assert.equal(fish.inventory.color,color);
  assert.equal(giftRequirement({mainCompleted:2,counts:[0,0]},'main-3',fish.name),0);
  assert.equal(giftRequirement({mainCompleted:4,counts:[0,0]},'main-5',fish.name),0);
  assert.ok(buildFishHelp([fish]).profiles[0].lines.some(line=>line.includes(label)));
 }
});
