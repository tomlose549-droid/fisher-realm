import test from 'node:test';
import assert from 'node:assert/strict';
import {GOLDEN_SHINER,FISH_SPECIES,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish={...GOLDEN_SHINER,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('golden shiner profile and five equal species intervals including both boundaries',()=>{
  assert.deepEqual(GOLDEN_SHINER,{name:'金色闪光鲦',catchColor:'#4c9fff',strength:{amount:1,interval:.15},restDuration:4.9,speed:6.2,stamina:75,struggle:{minAngle:35,maxAngle:63,durations:[4]},specials:[]});
  for(let i=0;i<5;i++){assert.equal(pickFish(i/5),FISH_SPECIES[i]);assert.equal(pickFish((i+1)/5-1e-9),FISH_SPECIES[i]);}assert.equal(pickFish(1),GOLDEN_SHINER);
});
test('one four-second leg goes directly to 4.9 seconds rest and the next round rerolls its starting side',()=>{
  const rolls=[0,0,0,1,.5],f=fight({...GOLDEN_SHINER,speed:.01},()=>rolls.shift()??0);close(f.struggleYaw,rad(55));f.advance(9.999);assert.equal(f.fishPhase,'first');f.advance(10);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(14.899);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(14.9);assert.equal(f.fishPhase,'first');assert.equal(f.round,2);assert.equal(f.phaseSide,-1);close(f.roundYaw,f.fishYaw);close(f.struggleYaw-f.roundYaw,-rad(41));
});
test('actual motion is 6.2 m/s with angles measured from the lateral direction',()=>{const f=fight(GOLDEN_SHINER);f.advance(7);close(f.fishX,-6.2*Math.cos(rad(35)));close(f.fishZ,-23-6.2*Math.sin(rad(35)));});
test('damage is one per .15 seconds with the shared delayed regeneration',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.149);close(f.durability,100);f.advance(6.15);close(f.durability,99);f.advance(6.45);close(f.durability,97);close(f.fishStamina,72);f.setReeling(false,6.45);f.advance(7.399);close(f.durability,97);f.advance(7.4);close(f.durability,99.5);f.advance(7.5);close(f.durability,100);});
test('rest allows reeling without reducing line or fish stamina',()=>{const f=fight();f.advance(10);const d=f.distance;f.setReeling(true,10);f.advance(11);close(d-f.distance,4.5);close(f.durability,100);close(f.fishStamina,75);assert.equal(f.fishPhase,'rest');});
test('75 stamina lasts across rounds then exhaustion permanently cancels active swimming',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(10);close(f.fishStamina,27);f.setReeling(false,10);f.advance(14.9);f.setRodYaw(f.struggleYaw,14.9);f.setReeling(true,14.9);f.advance(17.15);close(f.fishStamina,0);assert.equal(f.fishPhase,'exhausted');f.setReeling(false,17.15);const p=[f.fishX,f.fishZ];f.advance(100);assert.deepEqual([f.fishX,f.fishZ],p);assert.equal(f.fishPhase,'exhausted');});
test('catch notice records the golden shiner name and blue color',()=>{const f=fight({...GOLDEN_SHINER,stamina:0});f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,'金色闪光鲦');assert.equal(f.lastCatchColor,'#4c9fff');});
