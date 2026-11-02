import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMON_CARP,FISH_SPECIES,pickFish,FishingSession} from '../fishing-rules.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish=COMMON_CARP,random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);assert.equal(f.hook(6),true);return f;}
test('common carp has its own random encounter slot, owner override, 46 stamina and no special behavior',()=>{
 assert.ok(FISH_SPECIES.includes(COMMON_CARP));assert.equal(pickFish(6/FISH_SPECIES.length),COMMON_CARP);assert.equal(pickFish(7/FISH_SPECIES.length-1e-9),COMMON_CARP);const f=new FishingSession(()=>0,{randomSpecies:true});assert.equal(f.setForcedFish('普通鲤鱼'),true);f.cast(0,0);assert.equal(f.profile,COMMON_CARP);assert.equal(f.fishStamina,46);assert.deepEqual(COMMON_CARP.specials,[]);
});
test('common carp swims 4.1 m each second at both lateral angle endpoints on either side',()=>{
 for(const side of [0,1])for(const sample of [0,1]){const rolls=[0,side,sample],f=fight(COMMON_CARP,()=>rolls.shift()??0),a=sample?45:36;close(f.struggleYaw,(side?-1:1)*rad(90-a));f.advance(7);close(f.fishX,(side?1:-1)*4.1*Math.cos(rad(a)));close(f.fishZ,-23-4.1*Math.sin(rad(a)));}
});
test('common carp alternates after 4 seconds, swims 3.1 seconds, rests 3.9 seconds and resets its round baseline',()=>{
 const rolls=[0,0,0,1,1,.5],f=fight({...COMMON_CARP,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;
 f.advance(9.999);assert.equal(f.fishPhase,'first');f.advance(10);assert.equal(f.fishPhase,'second');close(f.struggleYaw-base,-rad(45));close(f.roundYaw,base);f.advance(13.099);assert.equal(f.fishPhase,'second');f.advance(13.1);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(16.999);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(17);assert.equal(f.round,2);assert.equal(f.phaseSide,-1);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('common carp drains 3 line toughness each .17 seconds only while struggling and reeled, then regenerates',()=>{
 const f=fight({...COMMON_CARP,speed:0});f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.169);close(f.durability,100);f.advance(6.17);close(f.durability,97);f.advance(6.51);close(f.durability,91);close(f.fishStamina,40);f.setReeling(false,6.51);f.advance(7.459);close(f.durability,91);f.advance(7.46);close(f.durability,93.5);
});
test('common carp rest permits safe reeling and successful catches have the correct name and white text',()=>{
 const f=fight({...COMMON_CARP,speed:0});f.advance(13.1);f.setReeling(true,13.1);f.advance(14.1);close(f.distance,18.5);close(f.durability,100);close(f.fishStamina,46);
 const c=fight({...COMMON_CARP,stamina:0});c.setReeling(true,6);c.advance(11);assert.equal(c.lastCatchName,'普通鲤鱼');assert.equal(c.lastCatchColor,'#ffffff');
});

test('common carp white image item packs two columns and survives pile moves and reload',()=>{assert.deepEqual(FISH_ITEMS['普通鲤鱼'],{w:2,h:1,color:'#ffffff',image:'common-carp.png'});const b=new FishInventory();for(let i=0;i<7;i++)b.add('普通鲤鱼');assert.equal(b.items[6].x,null);b.moveToBag(b.items[6].id,0,0);assert.equal(b.items[0].x,null);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());});
