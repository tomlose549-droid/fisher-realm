import test from 'node:test';
import assert from 'node:assert/strict';
import {REDEAR,BLUEGILL,TILAPIA,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish={...REDEAR,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('redear profile and equal three-species selection boundaries',()=>{
  assert.deepEqual(REDEAR,{name:'红耳太阳鱼',strength:{amount:3,interval:.14},restDuration:4.2,speed:5.3,stamina:45,struggle:{minAngle:40,maxAngle:50,durations:[1.9,1,1.4,3]},specials:[]});
  for(const [r,fish]of [[0,TILAPIA],[1/3-1e-9,TILAPIA],[1/3,BLUEGILL],[2/3-1e-9,BLUEGILL],[2/3,REDEAR],[1,REDEAR]])assert.equal(pickFish(r),fish);
});
test('redear alternates all four timed legs against a fixed baseline then rests 4.2 s',()=>{
  const rolls=[0,0,0,.2,.4,.6,1,0,0],f=fight({...REDEAR,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;close(f.struggleYaw,rad(40));
  for(const [at,phase,side,angle]of [[7.9,'second',-1,42],[8.9,'third',1,44],[10.3,'fourth',-1,46]]){f.advance(at-.001);assert.ok(f.struggling);f.advance(at);assert.equal(f.fishPhase,phase);assert.equal(f.phaseSide,side);close(f.roundYaw,base);close(f.struggleYaw-base,rad(side*angle));}
  f.advance(13.299);assert.equal(f.fishPhase,'fourth');f.advance(13.3);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(17.499);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(17.5);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('redear moves 5.3 m per second while reeling still applies simultaneously',()=>{const run=fight(REDEAR);run.advance(7);close(run.fishX,-Math.sin(rad(40))*5.3);close(run.fishZ,-23-Math.cos(rad(40))*5.3);const pull=fight(REDEAR);pull.setReeling(true,6);pull.advance(7);assert.ok(pull.distance<run.distance);});
test('redear damage is 3 per .14 s and retains regeneration and stamina tiers',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.139);close(f.durability,100);f.advance(6.14);close(f.durability,97);f.advance(6.42);close(f.durability,91);close(f.fishStamina,42);f.setReeling(false,6.42);f.advance(7.369);close(f.durability,91);f.advance(7.37);close(f.durability,93.5);});
test('redear third and fourth legs drain resources but rest does not',()=>{for(const t of [8.9,10.3]){const f=fight();f.advance(t);f.setRodYaw(f.struggleYaw,t);f.setReeling(true,t);f.advance(t+.28);close(f.durability,94);close(f.fishStamina,42);}const f=fight();f.advance(13.3);f.setReeling(true,13.3);f.advance(14.3);close(f.durability,100);close(f.fishStamina,45);});
