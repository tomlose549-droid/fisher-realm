import test from 'node:test';
import assert from 'node:assert/strict';
import {LONGNOSE_GAR,MAYAN_CICHLID,FISH_SPECIES,pickFish,FishingSession} from '../fishing-rules.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),rad=d=>d*Math.PI/180;
function fight(fish,random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);assert.equal(f.hook(6),true);return f;}
test('gar and cichlid join the random and owner catalogs with exact profiles',()=>{

  for(const [fish,index,expected] of [
    [LONGNOSE_GAR,13,{name:'长吻雀鳝',catchColor:'#ee82ee',strength:{amount:4,interval:.16},restDuration:4.5,speed:6.5,stamina:90,struggle:{minAngle:46,maxAngle:59,durations:[4.5,2,1.5,1,.8]},specials:[]}],
    [MAYAN_CICHLID,14,{name:'玛雅慈鲷',catchColor:'#008000',strength:{amount:3,interval:.15},restDuration:4.1,speed:5,stamina:54,struggle:{minAngle:34,maxAngle:42,durations:[6.2,3.1]},specials:[]}]
  ]){assert.deepEqual(fish,expected);assert.equal(pickFish(index/FISH_SPECIES.length),fish);assert.equal(pickFish((index+1)/FISH_SPECIES.length-1e-9),fish);const f=new FishingSession(()=>0);assert.equal(f.setForcedFish(fish.name),true);f.cast(0,0);assert.equal(f.profile,fish);assert.equal(f.fishStamina,expected.stamina);assert.deepEqual(f.ownerState,{fishName:fish.name,remaining:10});}
  assert.equal(pickFish(15/FISH_SPECIES.length-1e-9),MAYAN_CICHLID);
});
test('both new fish move at requested speeds and lateral endpoint angles on either side',()=>{
  for(const fish of [LONGNOSE_GAR,MAYAN_CICHLID])for(const side of [0,1])for(const sample of [0,1]){const rolls=[0,side,sample],f=fight(fish,()=>rolls.shift()??0),a=sample?fish.struggle.maxAngle:fish.struggle.minAngle;f.advance(7);close(f.fishX,(side?1:-1)*fish.speed*Math.cos(rad(a)));close(f.fishZ,-23-fish.speed*Math.sin(rad(a)));}
});
test('all five gar legs alternate with rerolled angles, then rest exactly 4.5 seconds',()=>{
  const rolls=[0,0,0,1,.5,0,1,1,0],f=fight({...LONGNOSE_GAR,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;
  for(const [at,phase,side,angle] of [[6,'first',1,46],[10.5,'second',-1,59],[12.5,'third',1,52.5],[14,'fourth',-1,46],[15,'fifth',1,59]]){if(at>6){f.advance(at-.001);assert.notEqual(f.fishPhase,phase);}f.advance(at);assert.equal(f.fishPhase,phase);assert.equal(f.struggling,true);assert.equal(f.phaseSide,side);close(f.roundYaw,base);close(f.struggleYaw-base,side*rad(90-angle));}
  f.advance(15.799);assert.equal(f.fishPhase,'fifth');f.advance(15.8);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(20.299);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(20.3);assert.equal(f.fishPhase,'first');assert.equal(f.round,2);assert.equal(f.phaseSide,-1);close(f.roundYaw,f.fishYaw);
});
test('gar fifth leg actively swims and applies damage and stamina drain while reeled',()=>{
  const f=fight({...LONGNOSE_GAR,speed:.01});f.advance(15);const p=[f.fishX,f.fishZ],s=f.snapshot(15);assert.equal(s.fishPhase,'fifth');assert.notEqual(s.struggleYaw,null);f.advance(15.1);assert.notDeepEqual([f.fishX,f.fishZ],p);f.setRodYaw(f.struggleYaw,15.1);f.setReeling(true,15.1);f.advance(15.26);close(f.durability,96);f.advance(15.6);close(f.durability,88);close(f.fishStamina,84);f.advance(15.8);assert.equal(f.fishPhase,'rest');const d=f.durability,st=f.fishStamina,dist=f.distance;f.advance(16);close(f.durability,d);close(f.fishStamina,st);assert.ok(f.distance<dist);
});
test('cichlid runs 6.2 and 3.1 seconds with no pause then rests 4.1 seconds',()=>{
  const rolls=[0,1,0,1,0,0],f=fight({...MAYAN_CICHLID,speed:.01},()=>rolls.shift()??0),base=f.roundYaw;f.advance(12.199);assert.equal(f.fishPhase,'first');f.advance(12.2);assert.equal(f.fishPhase,'second');assert.equal(f.phaseSide,1);close(f.struggleYaw-base,rad(48));f.advance(15.299);assert.equal(f.fishPhase,'second');f.advance(15.3);assert.equal(f.fishPhase,'rest');const p=[f.fishX,f.fishZ];f.advance(19.399);assert.deepEqual([f.fishX,f.fishZ],p);f.advance(19.4);assert.equal(f.round,2);assert.equal(f.fishPhase,'first');close(f.roundYaw,f.fishYaw);
});
test('cichlid damage ticks and release recovery use .15-second strength and .95-second delay',()=>{
  const f=fight({...MAYAN_CICHLID,speed:0});f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.149);close(f.durability,100);f.advance(6.15);close(f.durability,97);f.advance(6.45);close(f.durability,91);close(f.fishStamina,51);f.setReeling(false,6.45);f.advance(7.399);close(f.durability,91);f.advance(7.4);close(f.durability,93.5);
});
test('fifth-leg exhaustion cancels future movement and catches keep each new name and color',()=>{
  const f=fight({...LONGNOSE_GAR,speed:0});f.advance(15);f.fishStamina=3;f.setRodYaw(f.struggleYaw,15);f.setReeling(true,15);f.advance(15.25);assert.equal(f.fishPhase,'exhausted');close(f.fishStamina,0);f.setReeling(false,15.25);const p=[f.fishX,f.fishZ];f.advance(40);assert.deepEqual([f.fishX,f.fishZ],p);assert.equal(f.fishPhase,'exhausted');
  for(const fish of [LONGNOSE_GAR,MAYAN_CICHLID]){const c=fight({...fish,stamina:0});c.setReeling(true,6);c.advance(11);assert.equal(c.lastCatchName,fish.name);assert.equal(c.lastCatchColor,fish.catchColor);}
});
test('one-by-four and two-by-two packing, overflow, whole-fish replacement and save roundtrip',()=>{
  assert.deepEqual(FISH_ITEMS['长吻雀鳝'],{w:4,h:1,color:'#ee82ee',image:'cutouts/longnose-gar.png'});assert.deepEqual(FISH_ITEMS['玛雅慈鲷'],{w:2,h:2,color:'#008000',image:'cutouts/mayan-cichlid.png'});
  const b=new FishInventory(),gars=Array.from({length:4},()=>b.add('长吻雀鳝')),c=b.add('玛雅慈鲷');assert.deepEqual(gars.slice(0,3).map(i=>[i.x,i.y]),[[0,0],[0,1],[0,2]]);assert.equal(gars[3].x,null);assert.equal(c.x,null);assert.equal(b.moveToBag(c.id,3,1),true);assert.equal(gars[1].x,null);assert.equal(gars[2].x,null);assert.deepEqual([gars[0].x,gars[0].y],[0,0]);assert.equal(b.moveToBag(gars[3].id,2,0),false);assert.equal(b.moveToBag(c.id,4,1),false);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());assert.equal(b.clearAll(),5);assert.equal(b.items.length,0);
});
