import test from 'node:test';
import assert from 'node:assert/strict';
import {REDEAR,BLUEGILL,TILAPIA,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish={...REDEAR,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('redear profile and four-species selection boundaries',()=>{
  assert.deepEqual(REDEAR,{name:'红耳太阳鱼',catchColor:'#90ee90',strength:{amount:3,interval:.13},restDuration:4.2,speed:5.6,stamina:45,struggle:{minAngle:56,maxAngle:65,durations:[1.9,1,1.4,3]},specials:[]});
  for(const [r,fish]of [[0,TILAPIA],[.25-1e-9,TILAPIA],[.25,BLUEGILL],[.5-1e-9,BLUEGILL],[.5,REDEAR],[.75-1e-9,REDEAR]])assert.equal(pickFish(r),fish);
});
test('redear alternates all four timed legs against a fixed baseline then rests 4.2 s',()=>{
  const rolls=[0,0,0,.2,.4,.6,1,0,0],f=fight({...REDEAR,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;close(f.struggleYaw,rad(34));
  for(const [at,phase,side,angle]of [[7.9,'second',-1,57.8],[8.9,'third',1,59.6],[10.3,'fourth',-1,61.4]]){f.advance(at-.001);assert.ok(f.struggling);f.advance(at);assert.equal(f.fishPhase,phase);assert.equal(f.phaseSide,side);close(f.roundYaw,base);close(f.struggleYaw-base,rad(side*(90-angle)));}
  f.advance(13.299);assert.equal(f.fishPhase,'fourth');f.advance(13.3);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(17.499);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(17.5);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('redear moves 5.6 m per second while reeling still applies simultaneously',()=>{const run=fight(REDEAR);run.advance(7);close(run.fishX,-Math.sin(rad(34))*5.6);close(run.fishZ,-23-Math.cos(rad(34))*5.6);const pull=fight(REDEAR);pull.setReeling(true,6);pull.advance(7);assert.ok(pull.distance<run.distance);});
test('redear damage is 3 per .13 s and retains regeneration and stamina tiers',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.129);close(f.durability,100);f.advance(6.13);close(f.durability,97);f.advance(6.39);close(f.durability,91);close(f.fishStamina,42);f.setReeling(false,6.39);f.advance(7.339);close(f.durability,91);f.advance(7.34);close(f.durability,93.5);});
test('redear third and fourth legs drain resources but rest does not',()=>{for(const t of [8.9,10.3]){const f=fight();f.advance(t);f.setRodYaw(f.struggleYaw,t);f.setReeling(true,t);f.advance(t+.28);close(f.durability,94);close(f.fishStamina,42);}const f=fight();f.advance(13.3);f.setReeling(true,13.3);f.advance(14.3);close(f.durability,100);close(f.fishStamina,45);});
test('green catch color stays with the catch across recasting, and the next tilapia catch returns to grey',()=>{
  const f=fight({...REDEAR,stamina:0});f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchColor,'#90ee90');assert.equal(f.lastCatchName,'红耳太阳鱼');f.advance(12);
  f.profile={...TILAPIA,stamina:0};f.cast(13,0);assert.equal(f.snapshot(13).lastCatchColor,'#90ee90');f.hook(19);f.setReeling(true,19);f.advance(24);assert.equal(f.lastCatchName,'罗非鱼');assert.equal(f.lastCatchColor,'#d3d3d3');
});
