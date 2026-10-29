import test from 'node:test';
import assert from 'node:assert/strict';
import {FishingSession,TILAPIA,BLUEGILL,REDEAR,signedAngle} from '../fishing-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function start(fish,side=0,yaw=.4){const rolls=[0,side,0];const f=new FishingSession(()=>rolls.shift()??0,{fish});f.cast(0,yaw);f.hook(6);return f;}
test('lateral 0 is sideways, lateral 30 turns 30 toward forward, lateral 90 is forward on both sides',()=>{
  for(const a of [0,30,90])for(const side of [0,1]){const fish={...TILAPIA,struggle:{...TILAPIA.struggle,minAngle:a,maxAngle:a}},f=start(fish,side);close(signedAngle(f.struggleYaw-f.roundYaw),(side===0?1:-1)*rad(90-a));}
});
test('30 from the side has lateral speed v*cos(30) and forward speed v*sin(30)',()=>{
  for(const side of [0,1]){const fish={...TILAPIA,struggle:{...TILAPIA.struggle,minAngle:30,maxAngle:30}},f=start(fish,side,0);f.advance(7);close(f.fishX,(side===0?-1:1)*fish.speed*Math.cos(rad(30)));close(f.fishZ,-23-fish.speed*Math.sin(rad(30)));}
});
test('all three species retain their numeric ranges and convert both randomized endpoints once',()=>{
  for(const fish of [TILAPIA,BLUEGILL,REDEAR])for(const sample of [0,1]){const rolls=[0,0,sample];const f=new FishingSession(()=>rolls.shift()??0,{fish});f.cast(0,0);f.hook(6);close(f.struggleYaw,rad(90-(sample?fish.struggle.maxAngle:fish.struggle.minAngle)));assert.equal(f.profile,fish);}
});
