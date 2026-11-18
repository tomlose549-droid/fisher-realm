import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA,createFishCatalog} from '../fish-data.js';
import {FishingSession} from '../fishing-rules.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const id of ['RAINBOW_SNAKEHEAD','GOLDEN_COBRA_SNAKEHEAD','BARCA_SNAKEHEAD'])test(id+' actively fights in every late leg, alternates, rests after the final leg and starts a new round',()=>{
 const original=FISH_DATA.find(f=>f.id===id),fish={...original,speed:.05,stamina:10000},f=new FishingSession(()=>0,{fish});f.cast(0,0);assert.equal(f.hook(6),true);let t=6;
 const names=['first','second','third','fourth','fifth','sixth','seventh','eighth'];
 for(const [i,duration]of fish.struggle.durations.entries()){
  f.advance(t);assert.equal(f.phaseIndex,i);assert.equal(f.fishPhase,names[i]);assert.equal(f.struggling,true);assert.equal(f.phaseSide,i%2?-1:1);near(f.phaseEndsAt,t+duration);
  if(i>=5){const position=[f.fishX,f.fishZ],durability=f.durability,stamina=f.fishStamina;f.setRodYaw(f.struggleYaw,t);f.setReeling(true,t);f.advance(t+.26);assert.notDeepEqual([f.fishX,f.fishZ],position);assert.ok(f.durability<durability);assert.ok(f.fishStamina<stamina);f.setReeling(false,t+.26);}
  t+=duration;f.advance(t-.0001);assert.equal(f.phaseIndex,i);
 }
 f.advance(t);assert.equal(f.fishPhase,'rest');near(f.phaseEndsAt,t+fish.restDuration);const position=[f.fishX,f.fishZ];f.advance(t+fish.restDuration-.0001);assert.deepEqual([f.fishX,f.fishZ],position);f.advance(t+fish.restDuration);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');
});
test('catalog accepts one through eight legs and rejects nine or invalid durations',async()=>{
 const source=FISH_DATA.find(f=>f.id==='BARCA_SNAKEHEAD');
 for(let n=1;n<=8;n++){const f=structuredClone(source);f.struggle.durations=Array(n).fill(.2);assert.equal(createFishCatalog([f]).profiles[0].struggle.durations.length,n);}
 for(const durations of [[],Array(9).fill(.2),[.2,0],[.2,NaN]]){const f=structuredClone(source);f.struggle.durations=durations;assert.throws(()=>createFishCatalog([f]),TypeError);}
});
