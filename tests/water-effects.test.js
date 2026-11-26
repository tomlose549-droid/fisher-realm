import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWaterEffects,WATER_EFFECT_PRESETS as presets} from '../water-effects.js';
const point={x:2,z:-23};
test('ordinary landing, hook and moving fish now emit a visible dense upward spray and wider brighter foam',()=>{
 for(const kind of ['landing','hook','trail']){const scene=new THREE.Scene(),waves=createWaterEffects(scene,{waterLevel:3});waves.pulse(kind,point,10);waves.update(10.3);const s=waves.snapshot(),drops=scene.getObjectByName('fishing-splash-droplets');assert.ok(s.activeParticles>=presets[kind].drops*.7);assert.ok(s.last[kind].height>0);assert.ok(s.last[kind].particles>=10);assert.ok(presets[kind].opacity>=.7);const data=drops.geometry.attributes.position.array;assert.ok(Array.from({length:s.activeParticles},(_,i)=>data[i*3+1]).some(y=>y>3.15));assert.equal(drops.geometry.drawRange.count,s.activeParticles);waves.dispose();assert.equal(scene.children.length,0);}
 assert.equal(presets.landing.drops,36);assert.equal(presets.hook.drops,48);assert.equal(presets.trail.rings,2);
});
test('body and actual-speed tiers increase spray count, height and coverage, including 1.45/1.9 hook tiers',()=>{
 for(const kind of ['hook','trail']){const waves=createWaterEffects(new THREE.Scene());let previous=null;for(const strength of [1,1.35,1.45,1.8,1.9]){waves.pulse(kind,point,10,strength);const s=waves.snapshot().last[kind];if(previous){assert.ok(s.radius>previous.radius);assert.ok(s.height>previous.height);assert.ok(s.particles>previous.particles);}previous=s;}waves.dispose();}
});
test('net water remains small and has no spray, and all effects remain on the injected map water level',()=>{
 const scene=new THREE.Scene(),waves=createWaterEffects(scene,{waterLevel:7});waves.pulse('net',point,10,.65);waves.update(10.3);const s=waves.snapshot();assert.equal(s.last.net.radius,.44*.65);assert.equal(s.last.net.particles,0);assert.equal(s.activeParticles,0);assert.ok(Math.abs(s.last.net.position[1]-7.012)<1e-8);assert.equal(presets.net.rings,1);assert.equal(presets.net.opacity,.25);waves.dispose();
});
test('continuous high-speed spray uses fixed geometry/material/particle pools and releases every resource',()=>{
 const scene=new THREE.Scene(),waves=createWaterEffects(scene),root=scene.getObjectByName('fishing-water-ripples');let objects=0;root.traverse(()=>objects++);const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});for(let i=0;i<1000;i++){waves.pulse(i%3?'trail':'hook',point,i*.04,1.9);waves.update(i*.04+.2);assert.ok(waves.snapshot().activeParticles<=waves.snapshot().particleCapacity);}let after=0;root.traverse(()=>after++);assert.equal(after,objects);assert.equal(waves.snapshot().poolSize,24);assert.equal(waves.snapshot().particleCapacity,2304);let disposed=0;for(const g of geometry)g.addEventListener('dispose',()=>disposed++);for(const m of materials)m.addEventListener('dispose',()=>disposed++);waves.update(100);assert.equal(waves.snapshot().activeParticles,0);waves.dispose();assert.equal(disposed,geometry.size+materials.size);assert.equal(scene.children.length,0);waves.update(200);waves.dispose();assert.equal(disposed,geometry.size+materials.size);
});
