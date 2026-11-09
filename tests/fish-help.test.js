import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FISH_DATA,DEFAULT_CATCH_COLOR} from '../fish-data.js';
import {buildFishHelp} from '../fish-help.js';

test('help names, order, count and configured probability come from every catalog entry',()=>{
 const help=buildFishHelp();assert.equal(help.count,FISH_DATA.length);assert.deepEqual(help.profiles.map(f=>f.name),FISH_DATA.map(f=>f.name));assert.ok(help.summary.includes('独立随机'));assert.equal(help.profiles[0].probability,15);
 for(const [i,fish] of FISH_DATA.entries()){const text=help.profiles[i].lines.join('\n');for(const value of [fish.strength.amount,fish.strength.interval,fish.restDuration,fish.speed,fish.stamina])assert.ok(text.includes(String(value)));assert.ok(text.includes(`高${fish.inventory.h}格×宽${fish.inventory.w}格`));assert.equal(help.profiles[i].catchColor,fish.catchColor??DEFAULT_CATCH_COLOR);assert.equal(help.profiles[i].inventoryColor,fish.inventory.color);}
});
test('changing one configuration updates help parameters, sizes, colors, angle and segment text',()=>{
 const fish=structuredClone(FISH_DATA[0]);Object.assign(fish,{speed:8.1,restDuration:2.7,stamina:99,strength:{amount:7,interval:.18},catchColor:'#123456',inventory:{w:4,h:2,color:'#654321',image:null},struggle:{minAngle:27,maxAngle:40,durations:[2,3,4],switchPause:.25},specials:['换边前停顿0.25秒']});
 const text=buildFishHelp([fish]).profiles[0].lines.join('\n');for(const expected of ['每0.18秒降低7点','每秒8.1米','耐力：99','每轮2.7秒','27°–40°','2、3、4秒','共3段','停顿0.25秒','高2格×宽4格','#123456','#654321'])assert.ok(text.includes(expected),expected);assert.ok(!text.includes('3.9秒'));
});
test('adding an ordinary fish updates count, list, probability and profiles without editing help',()=>{
 const fish={...structuredClone(FISH_DATA[0]),id:'TEMP_HELP',name:'临时帮助测试鱼'};const h=buildFishHelp([...FISH_DATA,fish]);assert.equal(h.count,FISH_DATA.length+1);assert.ok(h.summary.includes(fish.name));assert.equal(h.profiles.at(-1).probability,null);assert.ok(h.profiles.at(-1).probabilityText.includes('未配置'));assert.equal(h.profiles.at(-1).name,fish.name);assert.equal(FISH_DATA.length,h.count-1);
});
test('legacy two-stage, one-stage and five-stage durations describe the actual engine order',()=>{
 const tilapia=buildFishHelp([FISH_DATA[0]]).profiles[0].lines[1];assert.ok(tilapia.includes('3.9、3.4秒'));
 const one=buildFishHelp([FISH_DATA.find(f=>f.id==='GOLDEN_SHINER')]).profiles[0].lines[1];assert.ok(one.includes('游动4秒，轮内不换边'));assert.ok(!one.includes('换边前停顿'));
 const five=buildFishHelp([FISH_DATA.find(f=>f.id==='FLORIDA_GAR')]).profiles[0].lines[1];assert.ok(five.includes('4、2、1.5、0.8、0.2秒，共5段'));
 assert.equal(buildFishHelp([]).summary,'目前暂无鱼种。');
});
test('help HTML has generated slots and no separately maintained species paragraphs',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const help=html.slice(html.indexOf('<dialog id="help-dialog">'),html.indexOf('<div id="loading"'));
 assert.ok(help.includes('id="help-species-summary"'));assert.ok(help.includes('id="help-fish-profiles"'));for(const fish of FISH_DATA)assert.ok(!help.includes(fish.name),fish.name+' is still hardcoded');
});
