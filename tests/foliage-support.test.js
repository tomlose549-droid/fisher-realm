import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {bankPlantHeight,discardUnsupportedVegetation} from '../foliage-support.js';
import {AMAZON_CONFLUENCE,riverBank,amazonWaterMaxZ} from '../maps/amazon-confluence.js';
import {AMAZON_FLOODED_FOREST} from '../maps/amazon-flooded-forest.js';
test('land plants sit on the actual triangulated bank in both Amazon maps, including the widened basins',()=>{
 const strips=[0,.45,1.5,4,12,30,75];for(const {water}of [AMAZON_CONFLUENCE,AMAZON_FLOODED_FOREST]){const meshes=[];for(const side of [-1,1]){const points=[],indices=[];for(let j=0;j<=145;j++){const z=water.minZ+(amazonWaterMaxZ(water)-water.minZ)*j/145;for(let i=0;i<strips.length;i++){const x=riverBank(z,side,water)+side*strips[i],y=i===0?-.13:i===1?.14:.34+Math.min(2,strips[i]*.025)+.12*Math.sin(x*.9+z*.4);points.push(x,y,z);if(i&&j){const n=j*strips.length+i;indices.push(n,n-7,n-1,n-1,n-7,n-8);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();meshes.push(mesh);}const ray=new THREE.Raycaster();
  for(const z of [-155,-60,10,28,43,70,95,140])for(const side of [-1,1])for(const offset of [.2,.7,2,8,29,50]){const step=(amazonWaterMaxZ(water)-water.minZ)/145,j=Math.floor((z-water.minZ)/step),a=water.minZ+j*step,t=(z-a)/step,x=riverBank(a,side,water)*(1-t)+riverBank(a+step,side,water)*t+side*offset;ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes,false)[0];assert.ok(hit);assert.ok(Math.abs(bankPlantHeight(x,z,water)-hit.point.y-.008)<2e-5,JSON.stringify({x,z,actual:bankPlantHeight(x,z,water),surface:hit.point.y}));}
  meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 }
});
test('removing unsupported groups consumes original authoring steps while retaining existing objects and their order',()=>{
 const a={entries:[{id:'rooted'}]},b={entries:[]};let randomCalls=0;const removed=discardUnsupportedVegetation([a,b],()=>{for(let i=0;i<10;i++){randomCalls++;a.entries.push({id:i});b.entries.push({id:i});}});assert.equal(removed,20);assert.equal(randomCalls,10);assert.deepEqual(a.entries,[{id:'rooted'}]);assert.deepEqual(b.entries,[]);
});
