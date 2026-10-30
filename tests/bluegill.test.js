import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEGILL,TILAPIA,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const rad=d=>d*Math.PI/180;
function fight(fish={...BLUEGILL,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('bluegill profile and species selection boundary',()=>{
  assert.deepEqual(BLUEGILL,{name:'蓝鳃太阳鱼',strength:{amount:2,interval:.11},restDuration:4.2,speed:5.6,stamina:56,struggle:{minAngle:35,maxAngle:41,durations:[3,.9,1.6,4.2]},specials:[]});
  for(const r of [0,.25-1e-9])assert.equal(pickFish(r),TILAPIA);for(const r of [.25,.5-1e-9])assert.equal(pickFish(r),BLUEGILL);
});
test('four timed legs alternate, reroll angles against the fixed baseline, then rest 4.2 s',()=>{
  const rolls=[0,0,0,.2,.4,.6,1,1,0],f=fight({...BLUEGILL,speed:.01},()=>rolls.shift()??0);
  close(f.struggleYaw,rad(55));const base=f.roundYaw;
  for(const [before,at,name,side,angle]of [[8.999,9,'second',-1,36.2],[9.899,9.9,'third',1,37.4],[11.499,11.5,'fourth',-1,38.6]]){
    f.advance(before);assert.ok(f.struggling);f.advance(at);assert.equal(f.fishPhase,name);assert.equal(f.phaseSide,side);close(f.struggleYaw-base,rad(side*(90-angle)));close(f.roundYaw,base);
  }
  f.advance(15.699);assert.equal(f.fishPhase,'fourth');f.advance(15.7);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(19.899);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(19.9);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('bluegill actually travels 5.6 m in one second',()=>{const f=fight(BLUEGILL);f.advance(7);close(f.fishX,-Math.sin(rad(55))*5.6);close(f.fishZ,-23-Math.cos(rad(55))*5.6);});
test('bluegill damage uses 2 per .11 seconds and keeps shared regeneration',()=>{const f=fight();f.setReeling(true,6);f.advance(6.109);close(f.durability,100);f.advance(6.11);close(f.durability,98);f.advance(6.33);close(f.durability,94);f.setReeling(false,6.33);f.advance(7.279);close(f.durability,94);f.advance(7.28);close(f.durability,96.5);});
test('third and fourth legs both consume stamina and line; rest does neither',()=>{
  for(const t of [9.9,11.5]){const f=fight();f.advance(t);f.setRodYaw(f.struggleYaw,t);f.setReeling(true,t);f.advance(t+.28);close(f.durability,96);close(f.fishStamina,53);}
  const f=fight();f.advance(15.7);f.setReeling(true,15.7);f.advance(16.7);close(f.durability,100);close(f.fishStamina,56);
});
test('exhausting bluegill during the third leg permanently stops all later legs',()=>{const f=fight({...BLUEGILL,speed:0,stamina:3});f.advance(9.9);f.setRodYaw(f.struggleYaw,9.9);f.setReeling(true,9.9);f.advance(10.15);close(f.fishStamina,0);assert.equal(f.fishPhase,'exhausted');f.setReeling(false,10.15);const p=[f.fishX,f.fishZ];f.advance(100);assert.deepEqual([f.fishX,f.fishZ],p);assert.equal(f.fishPhase,'exhausted');});
test('fresh casts pick species once, reset resources and retain the previous catch name',()=>{
  const rolls=[.375,0,0,0,0,0],f=new FishingSession(()=>rolls.shift()??0,{randomSpecies:true});f.cast(0,0);assert.equal(f.profile,BLUEGILL);close(f.fishStamina,56);assert.equal(f.cast(.1,0),false);assert.equal(f.profile,BLUEGILL);f.hook(6);f.fishStamina=0;f.fishPhase='exhausted';f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,'蓝鳃太阳鱼');f.advance(12);f.cast(13,0);assert.equal(f.profile,TILAPIA);close(f.fishStamina,44);close(f.durability,100);assert.equal(f.snapshot(13).lastCatchName,'蓝鳃太阳鱼');
});
