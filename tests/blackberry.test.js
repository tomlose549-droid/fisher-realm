import test from 'node:test';
import assert from 'node:assert/strict';
import {BLACKBERRY_BASS,TILAPIA,BLUEGILL,REDEAR,pickFish,FishingSession} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish={...BLACKBERRY_BASS,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('blackberry profile, white notice and five-species encounter ranges',()=>{
  assert.deepEqual(BLACKBERRY_BASS,{name:'黑莓鲈',catchColor:'#ffffff',strength:{amount:3,interval:.23},restDuration:5,speed:5,stamina:42,struggle:{minAngle:45,maxAngle:63,durations:[3.5,3.5,3.4],switchPause:.3},specials:['换边前停顿0.3秒']});
  for(const [v,fish]of [[0,TILAPIA],[.2-1e-9,TILAPIA],[.2,BLUEGILL],[.4-1e-9,BLUEGILL],[.4,REDEAR],[.6-1e-9,REDEAR],[.6,BLACKBERRY_BASS],[.8-1e-9,BLACKBERRY_BASS]])assert.equal(pickFish(v),fish);
});
test('only the two actual switches pause .3 s; rest starts immediately after leg three',()=>{
  const values=[0,0,0,.5,1],f=fight({...BLACKBERRY_BASS,speed:.01},()=>values.shift()??0),base=f.roundYaw;close(f.struggleYaw-base,rad(45));
  for(const [start,end,phase,side,angle]of [[9.5,9.8,'second',-1,54],[13.3,13.6,'third',1,63]]){
    f.advance(start-.001);assert.ok(f.struggling);const oldSide=f.phaseSide,oldYaw=f.struggleYaw;f.advance(start);assert.equal(f.fishPhase,'switch-pause');assert.equal(f.struggling,false);assert.equal(f.phaseSide,oldSide);const point=[f.fishX,f.fishZ];f.advance(end-.001);assert.deepEqual([f.fishX,f.fishZ],point);close(f.struggleYaw,oldYaw);f.advance(end);assert.equal(f.fishPhase,phase);assert.equal(f.phaseSide,side);close(f.roundYaw,base);close(f.struggleYaw-base,side*rad(90-angle));
  }
  f.advance(16.999);assert.equal(f.fishPhase,'third');f.advance(17);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(21.999);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(22);assert.equal(f.fishPhase,'first');assert.equal(f.round,2);close(f.roundYaw,f.fishYaw);
});
test('blackberry damage ticks at .23 s and moves at 5 m/s',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.229);close(f.durability,100);f.advance(6.23);close(f.durability,97);f.advance(6.69);close(f.durability,91);close(f.fishStamina,36);const swim=fight(BLACKBERRY_BASS);swim.advance(7);close(swim.fishX,-5*Math.sin(rad(45)));close(swim.fishZ,-23-5*Math.cos(rad(45)));});
test('pause permits reeling without line loss or stamina drain',()=>{const f=fight();f.advance(9.5);const d=f.distance;f.setReeling(true,9.5);f.advance(9.7);close(d-f.distance,.9);close(f.durability,100);close(f.fishStamina,42);assert.equal(f.fishPhase,'switch-pause');});
test('pause preserves fractional damage progress without charging for paused time',()=>{const f=fight();f.advance(9.4);f.setReeling(true,9.4);f.advance(9.799);close(f.durability,100);f.advance(9.929);close(f.durability,100);f.advance(9.93);close(f.durability,97);});
test('exhaustion at the first switch boundary permanently cancels later legs and pauses',()=>{const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(9.5);close(f.fishStamina,0);assert.equal(f.fishPhase,'exhausted');f.setReeling(false,9.5);const p=[f.fishX,f.fishZ];f.advance(100);assert.deepEqual([f.fishX,f.fishZ],p);assert.equal(f.fishPhase,'exhausted');});
test('a blackberry catch records its white color and correct name',()=>{const f=fight({...BLACKBERRY_BASS,stamina:0});f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,'黑莓鲈');assert.equal(f.lastCatchColor,'#ffffff');});
