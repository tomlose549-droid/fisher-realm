import test from 'node:test';import assert from 'node:assert/strict';
import {FISH_DATA,FISH_CATALOG,createFishCatalog} from '../fish-data.js';import {FishingSession} from '../fishing-rules.js';import {buildFishHelp} from '../fish-help.js';import {buildFishGuide} from '../fish-guide.js';
const dolphin=FISH_CATALOG.byId.PINK_RIVER_DOLPHIN,arapaima=FISH_CATALOG.byId.ARAPAIMA;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fight(fish){const s=new FishingSession(()=>0,{fish});s.cast(0,0,{equipment:{lineMaximum:100000,reelBaseSpeed:3.75,fishSpeedScale:1}});s.hook(6);return s;}
function exhausted(distance){const s=fight(dolphin);s.fishStamina=0;s.fishPhase='exhausted';s.phaseEndsAt=Infinity;s.fishX=0;s.fishZ=-distance;return s;}
test('approved two profiles retain base stats, footprints and expose validated special configuration in help/guide',()=>{
 for(const [id,stats,size]of [['PINK_RIVER_DOLPHIN',[6,.15,6.4,117,4.9,42,59,[4.5,3.7,2.6,1.1]],[4,2]],['ARAPAIMA',[8,.13,6,201,4.7,32,59,[3.9,2.9,3.1,1.5]],[6,3]]]){const f=FISH_DATA.find(f=>f.id===id);assert.deepEqual([f.strength.amount,f.strength.interval,f.speed,f.stamina,f.restDuration,f.struggle.minAngle,f.struggle.maxAngle,f.struggle.durations],stats);assert.deepEqual([f.inventory.w,f.inventory.h],size);assert.ok(buildFishHelp([f]).profiles[0].lines.join(' ').includes(f.specials[0]));assert.ok(buildFishGuide([f]).fish[0].specials.includes(f.specials[0]));}
 const base=FISH_DATA.find(f=>f.id==='ARAPAIMA');for(const behavior of [null,[],{bad:{}},{lastBurst:{distance:0,duration:5}},{turnDebuff:{chance:1.1}},{turnDebuff:{...base.behavior.turnDebuff,fishSpeedScale:0}},{turnDebuff:{...base.behavior.turnDebuff,damageRateScale:-1}}])assert.throws(()=>createFishCatalog([{...base,behavior}]),/behavior|lastBurst|turnDebuff/);
});
test('dolphin triggers only with both zero stamina and distance at most 9 m, even when not reeling',()=>{
 const far=exhausted(9.0001);far.advance(7);assert.equal(far.lastBurstUsed,false);
 const alive=fight(dolphin);alive.fishZ=-8;alive.advance(6.01);assert.equal(alive.lastBurstUsed,false);
 for(const d of [9,8]){const s=exhausted(d);s.advance(6.01);assert.equal(s.fishPhase,'last-burst');assert.equal(s.lastBurstUsed,true);close(s.phaseEndsAt,11);assert.equal(s.fishStamina,0);const a=Math.abs(s.struggleYaw-s.roundYaw)*180/Math.PI;assert.ok(a>=31&&a<=48);}
});
test('crossing 9 m triggers at the exact crossing time within a long frame, lasts 5 seconds, never retriggers',()=>{
 const s=exhausted(9.1);s.setReeling(true,6);const at=6+.1/4.5;s.advance(at+.01);close(s.drainEvents().find(e=>e.type==='last-burst').at,at);close(s.phaseEndsAt,at+5);s.setReeling(false,at+.01);s.advance(at+5);assert.equal(s.fishPhase,'exhausted');assert.equal(s.fishStamina,0);s.fishX=0;s.fishZ=-8;s.advance(at+7);assert.equal(s.fishPhase,'exhausted');assert.equal(s.lastBurstUsed,true);s.fail('escaped',20);s.cast(21,0);assert.equal(s.lastBurstUsed,false);
});
test('dolphin final struggle moves at original speed and still damages line; exhaustion during a normal fight triggers it',()=>{
 const s=exhausted(8);s.advance(6.01);s.reeling=true;const before=s.durability;s.advance(6.31);assert.equal(before-s.durability,12);assert.equal(s.fishStamina,0);assert.equal(s.fishPhase,'last-burst');close(s.fishMoveSpeed,6.4);
 const n=fight(dolphin);n.fishStamina=1;n.fishZ=-5;n.rodYaw=n.struggleYaw;n.setReeling(true,6);n.advance(6.25);assert.equal(n.lastBurstUsed,true);assert.equal(n.fishStamina,0);assert.equal(n.fishPhase,'last-burst');
});
test('arapaima turn probability is exactly 20 percent, first leg normal, every change rerolls without stacking',()=>{
 let count=0;for(let i=0;i<100;i++){const s=fight(arapaima);assert.equal(s.turnSpecialActive,false);s.random=()=>(i+.5)/100;s.phaseIndex=1;s.nextLeg(6);if(s.turnSpecialActive)count++;}assert.equal(count,20);
 const s=fight(arapaima);s.phaseIndex=1;s.nextLeg(6);assert.equal(s.turnSpecialActive,true);s.random=()=>.2;s.phaseIndex=2;s.nextLeg(7);assert.equal(s.turnSpecialActive,false);s.random=()=>.199999;s.phaseIndex=3;s.nextLeg(8);assert.equal(s.turnSpecialActive,true);s.transition(s.phaseEndsAt);assert.equal(s.fishPhase,'rest');assert.equal(s.turnSpecialActive,false);s.transition(s.phaseEndsAt);assert.equal(s.turnSpecialActive,false);s.fail('escaped',30);s.cast(31,0);assert.equal(s.turnSpecialActive,false);
});
test('arapaima reductions multiply equipment and angular efficiency; only combat line damage ticks three times faster',()=>{
 const s=fight(arapaima);s.phaseIndex=1;s.nextLeg(6);s.struggleYaw=0;s.rodYaw=0;s.fishSpeedScale=.94;s.reelBaseSpeed=4.18;close(s.fishMoveSpeed,6*.94*.2);close(s.speed,4.18*1.2*.4);s.reeling=true;const z=s.fishZ,before=s.durability;s.advance(6.13);assert.equal(before-s.durability,24);close(s.fishZ-z,(4.18*1.2*.4-6*.94*.2)*.13);assert.equal(s.damageRateScale,3);s.reeling=false;s.advance(6.3);assert.equal(before-s.durability,24);s.fishStamina=0;s.fishPhase='exhausted';assert.equal(s.damageRateScale,1);close(s.speed,4.18*1.2);s.caught(6.31);assert.equal(s.turnDebuffActive,false);
});
test('both special paths agree between one long update and small render frames',()=>{
 for(const kind of ['dolphin','arapaima']){const make=()=>{if(kind==='dolphin'){const s=exhausted(9.1);s.setReeling(true,6);return s;}const s=fight(arapaima);s.phaseIndex=1;s.nextLeg(6);s.reeling=true;return s;};const a=make(),b=make();a.advance(7);for(let i=1;i<=200;i++)b.advance(6+i*.005);for(const k of ['fishX','fishZ'])assert.ok(Math.abs(a[k]-b[k])<.01,k);for(const k of ['durability','fishStamina'])close(a[k],b[k]);assert.equal(a.fishPhase,b.fishPhase);assert.equal(a.lastBurstUsed,b.lastBurstUsed);assert.equal(a.turnSpecialActive,b.turnSpecialActive);}
});
