import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createFishingProps} from '../fishing-props.js';
import {createResourceScope} from '../scene-resources.js';
test('ground slots stay separated at the fishing spot when cast bearings differ; line targets retain each original bearing',()=>{
 const root=new THREE.Group(),p=createFishingProps(root,{player:new THREE.Vector3(0,1.85,0),waterLevel:0,groundYaw:.2}),rods=[-.3,0,.4].map((castYaw,slot)=>({slot,session:{state:'waiting',castYaw,fishX:-Math.sin(castYaw)*23,fishZ:-Math.cos(castYaw)*23}}));p.updateGround(rods,1);
 for(let i=1;i<3;i++)assert.ok(Math.abs(p.ground[i].rod.position.distanceTo(p.ground[i-1].rod.position)-.7)<1e-8);
 for(let i=0;i<3;i++){assert.equal(p.ground[i].rod.rotation.y,.2);assert.ok(Math.abs(p.ground[i].data[72]-rods[i].session.fishX)<1e-5);assert.ok(Math.abs(p.ground[i].data[74]-rods[i].session.fishZ)<1e-5);}createResourceScope(root).dispose();assert.equal(root.children.length,0);
});
test('net rolls from the fish right side back to level and uses a fixed bubble pool with no fish mesh',()=>{
 const root=new THREE.Group(),p=createFishingProps(root,{player:new THREE.Vector3(0,1.85,0),waterLevel:0}),point=new THREE.Vector3(0,.06,-3);p.updateNet('net-ready',point,0,0);assert.equal(p.net.position.x,.85);assert.equal(p.bubbles.geometry.attributes.position.count,24);p.updateNet.startedAt=1;p.updateNet('net-scooping',point,0,1.35);assert.ok(p.net.rotation.z< -1);p.updateNet('net-scooping',point,0,1.7);assert.ok(Math.abs(p.net.rotation.z)<1e-8);assert.ok(Math.abs(p.net.position.x)<1e-8);p.updateNet('caught',point,0,2);assert.equal(p.bubbles.visible,false);assert.equal(root.getObjectsByProperty('name','tilapia').length,0);createResourceScope(root).dispose();
});

test('the real rod tip is clickable without requiring the label, and neighboring slots do not overlap',()=>{
 const root=new THREE.Group(),p=createFishingProps(root,{player:new THREE.Vector3(0,1.85,0),waterLevel:0});p.updateGround([0,1,2].map(slot=>({slot,session:{state:'waiting',castYaw:0,fishX:0,fishZ:-23}})),0);root.updateMatrixWorld(true);for(let slot=0;slot<3;slot++){const point=new THREE.Vector3(0,.52,-2.8).applyMatrix4(p.ground[slot].rod.matrixWorld),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,0,5)),new THREE.Vector3(0,0,-1)),hits=ray.intersectObjects(p.ground.map(r=>r.hit),false);assert.ok(hits.length);assert.equal(hits[0].object.userData.rodSlot,slot);}createResourceScope(root).dispose();
});
