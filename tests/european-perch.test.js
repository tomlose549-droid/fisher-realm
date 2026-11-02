import test from 'node:test';
import assert from 'node:assert/strict';
import {EUROPEAN_PERCH,FISH_SPECIES,pickFish,FishingSession} from '../fishing-rules.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish={...EUROPEAN_PERCH,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);assert.equal(f.hook(6),true);return f;}
test('European perch is the eighth species and packs a light green three-wide image item',()=>{
 assert.ok(FISH_SPECIES.includes(EUROPEAN_PERCH));assert.equal(pickFish(7/FISH_SPECIES.length),EUROPEAN_PERCH);assert.equal(pickFish(8/FISH_SPECIES.length-1e-9),EUROPEAN_PERCH);assert.deepEqual(FISH_ITEMS['欧洲河鲈'],{w:3,h:1,color:'#90ee90',image:'cutouts/european-perch.png'});const b=new FishInventory();for(let i=0;i<4;i++)b.add('欧洲河鲈');assert.equal(b.items[3].x,null);assert.equal(b.moveToBag(b.items[3].id,2,0),true);assert.equal(b.items[0].x,null);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());
});
test('European perch moves 4.9 m/s at both lateral angle endpoints on either side',()=>{
 for(const side of [0,1])for(const sample of [0,1]){const rolls=[0,side,sample],f=fight(EUROPEAN_PERCH,()=>rolls.shift()??0),a=sample?59:36;close(f.struggleYaw,(side?-1:1)*rad(90-a));f.advance(7);close(f.fishX,(side?1:-1)*4.9*Math.cos(rad(a)));close(f.fishZ,-23-4.9*Math.sin(rad(a)));}
});
test('two switches pause .25 seconds, alternate and reroll, then rest 4.7 seconds without a third pause',()=>{
 const rolls=[0,0,0,.5,1],f=fight({...EUROPEAN_PERCH,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;
 for(const [start,end,phase,side,angle]of [[9.5,9.75,'second',-1,47.5],[13.65,13.9,'third',1,59]]){f.advance(start-.001);assert.ok(f.struggling);const old=f.phaseSide;f.advance(start);assert.equal(f.fishPhase,'switch-pause');assert.equal(f.phaseSide,old);const p=[f.fishX,f.fishZ];f.advance(end-.001);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(end);assert.equal(f.fishPhase,phase);assert.equal(f.phaseSide,side);close(f.struggleYaw-base,side*rad(90-angle));close(f.roundYaw,base);}
 f.advance(17.399);assert.equal(f.fishPhase,'third');f.advance(17.4);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(22.099);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(22.1);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('perch drains 3 toughness each .2 seconds and 50 initial stamina uses the shared drain tiers',()=>{const f=fight();assert.equal(f.fishStamina,50);f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.199);close(f.durability,100);f.advance(6.2);close(f.durability,97);f.advance(6.6);close(f.durability,91);close(f.fishStamina,44);});
test('perch switch pause permits reeling without line or stamina loss and retains fractional ticks',()=>{const f=fight();f.advance(9.4);f.setReeling(true,9.4);f.advance(9.5);const d=f.distance,s=f.fishStamina;f.advance(9.749);close(d-f.distance,.249*4.5);close(f.durability,100);close(f.fishStamina,s);f.advance(9.849);close(f.durability,100);f.advance(9.85);close(f.durability,97);});
test('perch rest permits safe reeling and exhaustion permanently cancels later pauses',()=>{const f=fight();f.advance(17.4);f.setReeling(true,17.4);f.advance(18.4);close(f.durability,100);close(f.fishStamina,50);close(f.distance,18.5);const c=fight({...EUROPEAN_PERCH,stamina:3});c.setRodYaw(c.struggleYaw,6);c.setReeling(true,6);c.advance(6.25);assert.equal(c.fishPhase,'exhausted');c.setReeling(false,6.25);const p=[c.fishX,c.fishZ];c.advance(100);assert.deepEqual([c.fishX,c.fishZ],p);assert.equal(c.fishPhase,'exhausted');});
test('European perch records its name and light green catch text',()=>{const f=fight({...EUROPEAN_PERCH,stamina:0});f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,'欧洲河鲈');assert.equal(f.lastCatchColor,'#90ee90');});
