import test from 'node:test';
import assert from 'node:assert/strict';
import {NILE_TILAPIA,FISH_SPECIES,pickFish,FishingSession} from '../fishing-rules.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish=NILE_TILAPIA,random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);assert.equal(f.hook(6),true);return f;}
test('Nile tilapia is a distinct sixth species and uses a white two-wide inventory item',()=>{
 assert.equal(FISH_SPECIES.length,6);assert.equal(pickFish(5/6),NILE_TILAPIA);assert.equal(pickFish(1),NILE_TILAPIA);
 const f=fight();assert.equal(f.fishStamina,45);assert.deepEqual(NILE_TILAPIA.specials,[]);
 assert.deepEqual(FISH_ITEMS[NILE_TILAPIA.name],{w:2,h:1,color:'#ffffff',image:'nile-tilapia.png'});
 const b=new FishInventory();for(let i=0;i<7;i++)b.add(NILE_TILAPIA.name);assert.equal(b.items[6].x,null);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());
});
test('both randomized angle endpoints move at 4.25 m/s from lateral toward forward on either side',()=>{
 for(const side of [0,1])for(const sample of [0,1]){const rolls=[0,side,sample],f=fight(NILE_TILAPIA,()=>rolls.shift()??0),a=sample?46:40;close(f.struggleYaw,(side? -1:1)*rad(90-a));f.advance(7);close(f.fishX,(side?1:-1)*4.25*Math.cos(rad(a)));close(f.fishZ,-23-4.25*Math.sin(rad(a)));}
});
test('3.9 and 3.4 second legs alternate without a switch pause, then rest 3.4 seconds and reset baseline',()=>{
 const rolls=[0,0,0,1,1,.5],f=fight({...NILE_TILAPIA,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;
 f.advance(9.899);assert.equal(f.fishPhase,'first');f.advance(9.9);assert.equal(f.fishPhase,'second');close(f.struggleYaw-base,-rad(44));close(f.roundYaw,base);
 f.advance(13.299);assert.equal(f.fishPhase,'second');f.advance(13.3);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(16.699);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(16.7);assert.equal(f.round,2);assert.equal(f.phaseSide,-1);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('line loses 3 each .19 seconds during struggle reeling; releasing restores after .95 seconds',()=>{
 const f=fight({...NILE_TILAPIA,speed:0});f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.189);close(f.durability,100);f.advance(6.19);close(f.durability,97);f.advance(6.57);close(f.durability,91);close(f.fishStamina,39);f.setReeling(false,6.57);f.advance(7.519);close(f.durability,91);f.advance(7.52);close(f.durability,93.5);
});
test('rest permits reeling with no damage; catch is white and retains distinct fish name',()=>{
 const f=fight({...NILE_TILAPIA,speed:0});f.advance(13.3);f.setReeling(true,13.3);f.advance(14.3);close(f.distance,18.5);close(f.durability,100);close(f.fishStamina,45);
 const c=fight({...NILE_TILAPIA,stamina:0});c.setReeling(true,6);c.advance(11);assert.equal(c.lastCatchName,'尼罗罗非鱼');assert.equal(c.lastCatchColor,'#ffffff');
});
