import test from 'node:test';
import assert from 'node:assert/strict';
import {FishingSession,TILAPIA,staminaDrain,durabilityTier,signedAngle} from '../fishing-rules.js';
import {isPondWater} from '../pond-boundary.js';
const close=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const radians=d=>d*Math.PI/180;
function fight({fish={...TILAPIA,speed:0},random=()=>0,isWater=()=>true}={}){const f=new FishingSession(random,{fish,isWater});f.cast(0,0);f.hook(6);return f;}
test('tilapia profile and inclusive line color thresholds',()=>{
  assert.equal(TILAPIA.strength.amount,3);assert.equal(TILAPIA.strength.interval,.2);assert.equal(TILAPIA.restDuration,3.3);assert.equal(TILAPIA.speed,5.4);assert.equal(TILAPIA.stamina,44);assert.deepEqual(TILAPIA.specials,[]);
  for(const[v,t]of[[100,'normal'],[60.00001,'normal'],[60,'yellow'],[20.00001,'yellow'],[20,'orange'],[5.00001,'orange'],[5,'red'],[0,'red']])assert.equal(durabilityTier(v),t);
});
test('stamina tier boundaries at 25 and 75 degrees',()=>{
  for(const[a,amount,interval]of[[0,3,.25],[25,3,.25],[25.000001,1,.25],[75,1,.25],[75.000001,.5,.2],[180,.5,.2]])assert.deepEqual(staminaDrain(a),{amount,interval});
});
test('a round fixes its baseline, rerolls the opposite angle, then rests exactly 3.3 seconds',()=>{
  const values=[0,.1,.2,.9,.8,.7,.3],f=fight({fish:{...TILAPIA,speed:.1},random:()=>values.shift()??.5});
  assert.equal(f.fishPhase,'first');assert.equal(f.phaseSide,1);close(f.struggleYaw,radians(34.6));const baseline=f.roundYaw;
  f.advance(9.999);assert.equal(f.fishPhase,'first');f.advance(10);assert.equal(f.fishPhase,'second');assert.equal(f.phaseSide,-1);close(f.struggleYaw-baseline,radians(-43.7));
  f.advance(13.5);assert.equal(f.fishPhase,'rest');const point=[f.fishX,f.fishZ];f.advance(16.799);assert.deepEqual([f.fishX,f.fishZ],point);f.advance(16.8);assert.equal(f.fishPhase,'first');assert.equal(f.round,2);assert.equal(f.phaseSide,-1);close(f.roundYaw,f.fishYaw);close(f.fishStamina,44);
});
test('5.4 m/s movement and reeling are simultaneous vectors',()=>{
  const run=fight({fish:TILAPIA});run.advance(7);close(run.fishX,-Math.sin(radians(32))*5.4);close(run.fishZ,-23-Math.cos(radians(32))*5.4);
  const pull=fight({fish:TILAPIA});pull.setReeling(true,6);pull.advance(7);assert.ok(pull.distance<run.distance);assert.ok(pull.fishX<0);assert.ok(pull.fishZ<-23);assert.notEqual(pull.fishYaw,pull.rodYaw);
});
test('line loses 3 per 0.2 s only while reeling against struggle; recovery begins 0.95 s after the last loss',()=>{
  const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.199);close(f.durability,100);f.advance(6.2);close(f.durability,97);f.advance(7);close(f.durability,85);close(f.fishStamina,32);
  f.setReeling(false,7);f.advance(7.949);close(f.durability,85);f.advance(7.95);close(f.durability,87.5);f.advance(8.05);close(f.durability,90);f.advance(9.5);close(f.durability,100);close(f.fishStamina,32);
});
test('button tapping retains partial resource tick time',()=>{
  const f=fight();f.setReeling(true,6);f.setReeling(false,6.1);close(f.durability,100);f.setReeling(true,6.6);f.advance(6.7);close(f.durability,97);
});
test('fish stamina ticks at all three specified rates, without recovering',()=>{
  for(const[offset,expected]of[[0,32],[50,40],[100,41.5]]){const f=fight();f.setRodYaw(f.struggleYaw+radians(offset),6);f.setReeling(true,6);f.advance(7);close(f.fishStamina,expected);f.setReeling(false,7);f.advance(9);close(f.fishStamina,expected);}
});
test('position angle and swimming-direction angle remain distinct',()=>{const f=fight();f.setRodYaw(0,6);close(f.angle,0);close(f.struggleAngle,32);close(f.efficiency,1.2);assert.equal(staminaDrain(f.struggleAngle).amount,1);});
test('stamina zero immediately ends struggle forever, even across many potential rounds',()=>{
  const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(9.75);close(f.fishStamina,0);close(f.durability,46);assert.equal(f.fishPhase,'exhausted');f.setReeling(false,9.75);const p=[f.fishX,f.fishZ];f.advance(100);assert.equal(f.fishPhase,'exhausted');assert.deepEqual([f.fishX,f.fishZ],p);close(f.durability,100);
});
test('resting fish can be reeled without line loss or stamina reduction',()=>{
  const f=fight();f.advance(13);f.setReeling(true,13);f.advance(13.5);assert.equal(f.fishPhase,'rest');const stamina=f.fishStamina,distance=f.distance;f.advance(14.6);assert.ok(f.distance<distance);close(f.fishStamina,stamina);close(f.durability,100);
});
test('zero durability causes one failure and a fresh cast starts at 100',()=>{
  const f=fight({fish:TILAPIA});f.setReeling(true,6);f.advance(12.81);assert.equal(f.state,'idle');assert.equal(f.outcome,'line-broken');close(f.durability,0);assert.equal(f.drainEvents().filter(e=>e.type==='failed').length,1);assert.equal(f.cast(12.82,0),true);close(f.durability,100);close(f.fishStamina,44);
});
test('exactly 50 m is permitted; exceeding 50 m fails between render frames',()=>{
  const fish={...TILAPIA,speed:1,struggle:{...TILAPIA.struggle,minAngle:0,maxAngle:0,firstDuration:100,secondDuration:100}},f=fight({fish});
  f.advance(33);close(f.distance,50);assert.equal(f.state,'fighting');f.advance(33.001);assert.equal(f.state,'idle');assert.equal(f.outcome,'escaped');close(f.failure.distance,50,1e-6);
});
test('land outside 10 m fails; land within 10 m permits the normal catch',()=>{
  const fish={...TILAPIA,stamina:0};
  const far=fight({fish,isWater:(x,z)=>Math.hypot(x,z)>15});far.setReeling(true,6);far.advance(10);assert.equal(far.outcome,'landed');close(far.failure.distance,15,1e-5);
  const near=fight({fish,isWater:(x,z)=>Math.hypot(x,z)>10});near.setReeling(true,6);near.advance(11);assert.equal(near.outcome,'caught');assert.equal(near.catches,1);
});
test('one long update agrees with small frames for phase, ticks and movement',()=>{
  const a=fight({fish:{...TILAPIA,speed:.1}}),b=fight({fish:{...TILAPIA,speed:.1}});a.setRodYaw(a.struggleYaw,6);b.setRodYaw(b.struggleYaw,6);a.setReeling(true,6);b.setReeling(true,6);a.advance(9);for(let t=6.04;t<9;t+=.04)b.advance(t);b.advance(9);close(a.durability,b.durability);close(a.fishStamina,b.fishStamina);close(a.distance,b.distance,.001);
});
test('shared pond boundary recognizes the seated bank and the cast point',()=>{assert.equal(isPondWater(0,32),false);assert.equal(isPondWater(0,9),true);assert.equal(isPondWater(100,0),false);});
