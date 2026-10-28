import test from 'node:test';
import assert from 'node:assert/strict';
import {FishingSession,FISHING,reelEfficiency,TILAPIA} from '../fishing-rules.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const quiet=(random=()=>0)=>new FishingSession(random,{fish:{...TILAPIA,stamina:0}});
function fighting(yaw=0){const f=quiet();f.cast(0,yaw);f.hook(6);return f;}
test('cast is 23 m, cannot repeat, bite delay is in the agreed 6–13 second range',()=>{
  for(const [random,expected]of[[0,6],[.5,9.5],[1,13]]){const f=quiet(()=>random);assert.equal(f.cast(10,.5),true);close(f.distance,23);close(f.biteAt,10+expected);assert.equal(f.cast(10.5,1),false);close(f.fishYaw,.5);f.advance(10.8);assert.equal(f.state,'waiting');f.advance(f.biteAt-1e-6);assert.equal(f.state,'waiting');f.advance(f.biteAt);assert.equal(f.state,'bite');}
});
test('hook timing is checked on the input timestamp, including the 1.45 second boundary',()=>{
  const f=quiet();f.cast(0,0);assert.equal(f.hook(5.999),false);assert.equal(f.hook(7.45),true);assert.equal(f.state,'fighting');
  const late=quiet();late.cast(0,0);assert.equal(late.hook(7.450001),false);assert.equal(late.state,'idle');assert.equal(late.outcome,'missed');assert.equal(late.distance,0);assert.equal(late.cast(7.450001,0),true);
});
test('missing an entire bite window between frames restores idle without a phantom hook',()=>{const f=quiet();f.cast(0,0);f.advance(20);assert.equal(f.state,'idle');assert.equal(f.hook(20),false);assert.equal(f.reeling,false);});
test('the four exact angle boundaries and corresponding speeds',()=>{
  for(const [angle,multiplier]of[[0,1.2],[3,1.2],[3.000001,1],[30,1],[30.000001,.75],[90,.75],[90.000001,.2],[180,.2]]){close(reelEfficiency(angle),multiplier);close(reelEfficiency(-angle),multiplier);const f=fighting();f.setRodYaw(angle*Math.PI/180,6);close(f.speed,3.75*multiplier);}
});
test('world direction comparison wraps around ±180 degrees',()=>{const f=fighting(179*Math.PI/180);f.setRodYaw(-179*Math.PI/180,6);close(f.angle,2);close(f.speed,4.5);});
test('mouse release stops reeling and each interval uses the angle at that time',()=>{
  const f=fighting();f.advance(7);close(f.distance,23);f.setReeling(true,7);f.advance(8);close(f.distance,18.5);f.setRodYaw(Math.PI/3,8);f.advance(9);close(f.distance,15.6875);f.setReeling(false,9);f.advance(11);close(f.distance,15.6875);assert.equal(f.state,'fighting');
});
test('exhausted fish stays on its bearing while the rod remains independent',()=>{const f=fighting();f.setRodYaw(2,6);f.advance(50);close(f.fishYaw,0);close(f.rodYaw,2);close(f.distance,23);});
test('catch threshold, 0.3 s notice, 0.8 s recast and 4.5 s fade use the actual crossing time',()=>{
  const f=fighting();f.setReeling(true,6);const caughtAt=6+(23-1.25)/4.5;f.advance(caughtAt+.1);assert.equal(f.state,'caught');close(f.distance,1.25);close(f.catchAt,caughtAt);assert.equal(f.catches,1);
  close(f.noticeOpacity(caughtAt+.299),0);close(f.noticeOpacity(caughtAt+.301),1);
  assert.equal(f.cast(caughtAt+.799,0),false);assert.equal(f.cast(caughtAt+.801,.2),true);assert.equal(f.catches,1);assert.equal(f.state,'casting');close(f.noticeOpacity(caughtAt+4.499),1);close(f.noticeOpacity(caughtAt+4.8),.5);close(f.noticeOpacity(caughtAt+5.101),0);
});
test('all four speeds integrate correctly for an actual one-second hold',()=>{for(const [angle,speed]of[[0,4.5],[15,3.75],[60,2.8125],[120,.75]]){const f=fighting();f.setRodYaw(angle*Math.PI/180,6);f.setReeling(true,6);f.advance(7);close(23-f.distance,speed);}});
test('a long frame cannot count the same fish twice or keep the left button held for a new cast',()=>{const f=fighting();f.setReeling(true,6);f.advance(30);assert.equal(f.state,'idle');assert.equal(f.catches,1);assert.equal(f.reeling,false);f.cast(31,0);assert.equal(f.reeling,false);f.advance(40);assert.equal(f.catches,1);});
