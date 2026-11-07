import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_CATALOG,FISH_DATA} from '../fish-data.js';
import {FishingSession,FISH_SPECIES,pickFish} from '../fishing-rules.js';
import {FishInventory,FISH_ITEMS} from '../inventory-rules.js';
import {FishDiscoveries} from '../fish-discoveries.js';
import {buildFishGuide} from '../fish-guide.js';
const eel=FISH_CATALOG.byId.AMERICAN_EEL,close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fight(fish={...eel,speed:0},random=()=>0){const f=new FishingSession(random,{fish});f.cast(0,0);f.hook(6);return f;}
test('American eel exact profile, configured encounter slot and owner selection',()=>{
 assert.deepEqual(eel,{name:'美洲鳗鲡',catchColor:'#40e0d0',strength:{amount:3,interval:.38},restDuration:4,speed:8,stamina:56,struggle:{minAngle:30,maxAngle:60,durations:[4,4,4]},specials:[]});
 const index=FISH_DATA.findIndex(f=>f.id==='AMERICAN_EEL');assert.ok(index>=0);assert.equal(pickFish((index+.5)/FISH_SPECIES.length),eel);const f=new FishingSession(()=>0);assert.equal(f.setForcedFish(eel.name),true);f.cast(0,0);assert.equal(f.profile,eel);
});
test('three alternating four-second legs use lateral angles, then rest four seconds without pauses',()=>{
 for(const side of [0,1])for(const angle of [0,1]){const rolls=[0,side,angle,angle,angle],f=fight({...eel,speed:.01},()=>rolls.shift()??0);let t=6;const base=f.roundYaw;
 for(let i=0;i<3;i++){f.advance(t);assert.equal(f.phaseIndex,i);assert.equal(f.phaseSide,(side?-1:1)*(i%2?-1:1));close(Math.abs(f.struggleYaw-base),(90-(angle?60:30))*Math.PI/180);f.advance(t+3.999);assert.equal(f.struggling,true);t+=4;}
 f.advance(18);assert.equal(f.fishPhase,'rest');const pos=f.snapshot(18).fishPosition;f.advance(21.999);assert.deepEqual(f.snapshot(21.999).fishPosition,pos);f.advance(22);assert.equal(f.round,2);assert.equal(f.phaseIndex,0);}
});
test('American eel swims at eight meters per second and drains three toughness every .38 seconds',()=>{
 for(const side of [0,1])for(const sample of [0,1]){const rolls=[0,side,sample],f=fight(eel,()=>rolls.shift()??0),angle=(sample?60:30)*Math.PI/180;f.advance(6.2);close(f.fishX,(side?1:-1)*8*Math.cos(angle)*.2);close(f.fishZ,-23-8*Math.sin(angle)*.2);}
 const f=fight();f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.379);close(f.durability,100);f.advance(6.38);close(f.durability,97);f.advance(6.76);close(f.durability,94);close(f.fishStamina,47);
});
test('five-wide eel packs a whole row, overflows intact and survives reload; catch unlocks guide',()=>{
 assert.deepEqual(FISH_ITEMS[eel.name],{w:5,h:1,color:'#40e0d0',image:'cutouts/american-eel.png'});const b=new FishInventory();for(let i=0;i<4;i++)b.add(eel.name);assert.deepEqual(b.items.map(i=>[i.x,i.y]),[[0,0],[0,1],[0,2],[null,null]]);assert.equal(b.moveToBag(b.items[3].id,1,0),false);assert.equal(b.moveToBag(b.items[3].id,0,0),true);assert.equal(b.items[0].x,null);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());
 const f=fight({...eel,stamina:0});f.setReeling(true,6);f.advance(11);assert.equal(f.lastCatchName,eel.name);assert.equal(f.lastCatchColor,'#40e0d0');const history=new FishDiscoveries();assert.equal(history.has('AMERICAN_EEL'),false);history.unlock(f.lastCatchName);assert.equal(history.has('AMERICAN_EEL'),true);const guide=buildFishGuide().fish.find(f=>f.id==='AMERICAN_EEL');assert.equal(guide.name,eel.name);assert.equal(guide.width,5);assert.equal(guide.height,1);assert.ok(guide.probability.includes('1/'+FISH_DATA.length));
});
