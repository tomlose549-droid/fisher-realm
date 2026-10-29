import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEGILL,TILAPIA,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const rad=d=>d*Math.PI/180;
function fight(fish={...BLUEGILL,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('bluegill profile and species selection boundary',()=>{
  assert.deepEqual(BLUEGILL,{name:'蓝鳃太阳鱼',strength:{amount:2,interval:.14},restDuration:4.25,speed:5.1,stamina:53,struggle:{minAngle:27,maxAngle:36,durations:[3,.9,1.6,3.2]},specials:[]});
  for(const r of [0,.499999])assert.equal(pickFish(r),TILAPIA);for(const r of [.5,1])assert.equal(pickFish(r),BLUEGILL);
});
test('four timed legs alternate, reroll angles against the fixed baseline, then rest 4.25 s',()=>{
  const rolls=[0,0,0,.2,.4,.6,1,1,0],f=fight({...BLUEGILL,speed:.01},()=>rolls.shift()??0);
  close(f.struggleYaw,rad(27));const base=f.roundYaw;
  for(const [before,at,name,side,angle]of [[8.999,9,'second',-1,28.8],[9.899,9.9,'third',1,30.6],[11.499,11.5,'fourth',-1,32.4]]){
    f.advance(before);assert.ok(f.struggling);f.advance(at);assert.equal(f.fishPhase,name);assert.equal(f.phaseSide,side);close(f.struggleYaw-base,rad(side*angle));close(f.roundYaw,base);
  }
  f.advance(14.699);assert.equal(f.fishPhase,'fourth');f.advance(14.7);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(18.949);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(18.95);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('bluegill actually travels 5.1 m in one second',()=>{const f=fight(BLUEGILL);f.advance(7);close(f.fishX,-Math.sin(rad(27))*5.1);close(f.fishZ,-23-Math.cos(rad(27))*5.1);});
test('bluegill damage uses 2 per .14 seconds and keeps shared regeneration',()=>{const f=fight();f.setReeling(true,6);f.advance(6.139);close(f.durability,100);f.advance(6.14);close(f.durability,98);f.advance(6.42);close(f.durability,94);f.setReeling(false,6.42);f.advance(7.369);close(f.durability,94);f.advance(7.37);close(f.durability,96.5);});
test('third and fourth legs both consume stamina and line; rest does neither',()=>{
  for(const t of [9.9,11.5]){const f=fight();f.advance(t);f.setRodYaw(f.struggleYaw,t);f.setReeling(true,t);f.advance(t+.28);close(f.durability,96);close(f.fishStamina,50);}
  const f=fight();f.advance(14.7);f.setReeling(true,14.7);f.advance(15.7);close(f.durability,100);close(f.fishStamina,53);
});
test('exhausting bluegill during the third leg permanently stops all later legs',()=>{const f=fight({...BLUEGILL,speed:0,stamina:3});f.advance(9.9);f.setRodYaw(f.struggleYaw,9.9);f.setReeling(true,9.9);f.advance(10.15);close(f.fishStamina,0);assert.equal(f.fishPhase,'exhausted');f.setReeling(false,10.15);const p=[f.fishX,f.fishZ];f.advance(100);assert.deepEqual([f.fishX,f.fishZ],p);assert.equal(f.fishPhase,'exhausted');});
test('fresh casts pick species once, reset resources and retain the previous catch name',()=>{
  const rolls=[.75,0,0,0,0,0],f=new FishingSession(()=>rolls.shift()??0,{randomSpecies:true});f.cast(0,0);assert.equal(f.profile,BLUEGILL);close(f.fishStamina,53);assert.equal(f.cast(.1,0),false);assert.equal(f.profile,BLUEGILL);f.hook(6);f.fishStamina=0;f.fishPhase='exhausted';f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,'蓝鳃太阳鱼');f.advance(12);f.cast(13,0);assert.equal(f.profile,TILAPIA);close(f.fishStamina,44);close(f.durability,100);assert.equal(f.snapshot(13).lastCatchName,'蓝鳃太阳鱼');
});
