import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA,FISH_CATALOG} from '../fish-data.js';
import {createEncounterTable} from '../fish-encounters.js';
import {SUMMER_POND_PROBABILITIES,SUMMER_POND_ENCOUNTERS as table} from '../maps/summer-pond-fish.js';
import {FishingSession,pickFish} from '../fishing-rules.js';
import {getMapContext} from '../map-registry.js';
import {buildFishHelp} from '../fish-help.js';
import {buildFishGuide} from '../fish-guide.js';
import {FishInventory} from '../inventory-rules.js';
import {FishDiscoveries} from '../fish-discoveries.js';

// Independent copy of the approved specification, expressed by user-facing names.
const expected={
  grey:[22,{'豹纹翼甲鲶':7,'罗非鱼':15}],
  white:[39,{'尼罗罗非鱼':14,'普通鲤鱼':9,'黑莓鲈':16}],
  'light green':[16,{'欧洲河鲈':7,'红耳太阳鱼':3,'草鱼':6}],
  green:[12,{'蓝鳃太阳鱼':2.5,'白鮰':3,'玛雅慈鲷':3.5,'黄鲶':3}],
  turquoise:[5,{'斑点叉尾鮰':1.5,'地图鱼':2,'美洲鳗鲡':.9,'行走鲶':.3,'湖吸口鱼':.3}],
  blue:[3.5,{'金色闪光鲦':.7,'大口黑鲈':.9,'弓鳍鱼':.9,'非洲宝石慈鲷':1}],
  indigo:[1.5,{'红鳍狗鱼':.3,'杰克登普西慈鲷':.7,'孔雀鲈':.5}],
  'dark purple':[.7,{'链纹狗鱼':.2,'佛罗里达雀鳝':.5}],
  violet:[.3,{'长吻雀鳝':.3}]
};

test('all 27 fish match the approved absolute percentages, qualities and quality totals',()=>{
  let count=0;
  for(const [quality,[total,fish]] of Object.entries(expected)){
    assert.equal(table.qualityTotals[quality],total);
    for(const [name,percent] of Object.entries(fish)){
      const data=FISH_DATA.find(f=>f.name===name);assert.ok(data,name);
      assert.equal(data.quality,quality);assert.equal(table.probabilityFor(data.id),percent);count++;
    }
  }
  assert.equal(count,27);assert.equal(FISH_DATA.length,count);assert.equal(SUMMER_POND_PROBABILITIES.length,count);
  assert.equal(Object.values(table.qualityTotals).reduce((n,p)=>n+Math.round(p*100),0),10000);
});

test('every one of 10000 equal random buckets lands in the exact approved fish distribution',()=>{
  const counts=new Map();
  for(let i=0;i<10000;i++){const fish=pickFish((i+.5)/10000);counts.set(fish.name,(counts.get(fish.name)||0)+1);}
  for(const [,fish]of Object.values(expected))for(const [name,percent]of Object.entries(fish))assert.equal(counts.get(name),percent*100,name);
  for(const [i,range]of table.ranges.entries()){
    assert.equal(pickFish(range.start/10000),range.profile);
    assert.equal(pickFish((range.end-.5)/10000),range.profile);
    if(i+1<table.ranges.length)assert.equal(pickFish(range.end/10000),table.ranges[i+1].profile);
  }
  assert.equal(pickFish(-1),table.fishPool[0]);assert.equal(pickFish(1),table.fishPool.at(-1));
  assert.equal(pickFish(2),table.fishPool.at(-1));assert.throws(()=>pickFish(NaN),/finite/);
});

test('invalid, incomplete and silently normalized distributions are rejected',()=>{
  const rows=()=>structuredClone(SUMMER_POND_PROBABILITIES);
  for(const bad of [-1,NaN,Infinity,'15',15.001]){const r=rows();r[0].percent=bad;assert.throws(()=>createEncounterTable(r),/probability/);}
  const duplicate=rows();duplicate.push(duplicate[0]);assert.throws(()=>createEncounterTable(duplicate),/duplicate/);
  const unknown=rows();unknown[0].id='UNKNOWN';assert.throws(()=>createEncounterTable(unknown),/Unknown/);
  const missing=rows();missing[1].percent+=missing[0].percent;missing.shift();assert.throws(()=>createEncounterTable(missing),/Missing/);
  const wrong=rows();wrong[0].percent+=.1;assert.throws(()=>createEncounterTable(wrong),/100%/);
  const data=structuredClone(FISH_DATA);delete data[0].quality;assert.throws(()=>createEncounterTable(rows(),{entries:data}),/quality/);
  const extra={...FISH_DATA[0],id:'NEW_NO_CHANCE',name:'尚未分配概率的新鱼'};
  assert.throws(()=>createEncounterTable(rows(),{entries:[...FISH_DATA,extra]}),/Missing/);
});

test('colors do not determine quality or chance and a different map can use its own distribution',()=>{
  const recolored=structuredClone(FISH_DATA);for(const f of recolored){f.catchColor='#123456';f.inventory.color='#abcdef';}
  const same=createEncounterTable(SUMMER_POND_PROBABILITIES,{entries:recolored});
  assert.deepEqual(same.qualityTotals,table.qualityTotals);
  const other=createEncounterTable([{id:'TILAPIA',percent:30},{id:'BLUEGILL',percent:70}],{requireAll:false});
  assert.equal(other.pick(.3).name,'蓝鳃太阳鱼');assert.equal(table.probabilityFor('TILAPIA'),15);
  const f=new FishingSession(()=>.5,{randomSpecies:true,fishPool:other.fishPool,encounters:other});f.cast(0,0);assert.equal(f.profile.name,'蓝鳃太阳鱼');
  assert.throws(()=>new FishingSession(()=>0,{randomSpecies:true,fishPool:other.fishPool}),/probability table/);
  assert.throws(()=>pickFish(0,other.fishPool,table),/matching/);
  assert.equal(getMapContext().encounters,table);
});

test('help and guide use the current map table, not their filtered list size',()=>{
  const fish=FISH_DATA.find(f=>f.id==='TILAPIA');
  assert.equal(buildFishHelp([fish]).profiles[0].probability,15);assert.equal(buildFishGuide([fish]).fish[0].probability,'15%');
  assert.ok(buildFishHelp().summary.includes('独立随机'));assert.ok(!buildFishHelp().summary.includes('每种概率为1/'));
  const other=createEncounterTable([{id:fish.id,percent:100}],{requireAll:false});
  assert.equal(buildFishHelp([fish],other).profiles[0].probability,100);assert.equal(buildFishGuide([fish],other).fish[0].probability,'100%');
  const unknown={...fish,id:'NEW',name:'待配置鱼'};assert.equal(buildFishGuide([unknown]).fish[0].probability,'未配置（需先确认分配）');
});

test('owner override lasts ten successful catches then returns to weighted randomness; saves retain all fish',()=>{
  const f=new FishingSession(()=>0,{randomSpecies:true});f.setForcedFish('长吻雀鳝');
  for(let i=0;i<10;i++){
    const t=i*12;f.cast(t,0);f.hook(t+6);f.fishStamina=0;f.fishPhase='exhausted';f.phaseEndsAt=Infinity;
    f.setRodYaw(0,t+6);f.setReeling(true,t+6);f.advance(t+11);assert.equal(f.lastCatchName,'长吻雀鳝');f.advance(t+12);
  }
  f.cast(120,0);assert.equal(f.profile,FISH_CATALOG.byId.TILAPIA);assert.equal(f.ownerState.remaining,0);
  const saved={version:1,items:FISH_DATA.map((fish,i)=>({id:String(i+1),name:fish.name,x:null,y:null}))};
  assert.deepEqual(new FishInventory(saved).serialize(),saved);
  const discovered={version:1,fishIds:FISH_DATA.map(f=>f.id)};assert.deepEqual(new FishDiscoveries(discovered).serialize(),discovered);
});
