import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORLD_LOCATION,WORLD_IMAGE} from '../world-map-data.js';
import {getMapContext} from '../map-registry.js';
test('world point uses the existing stable map and display name, retaining its full encounter pool',()=>{
 const context=getMapContext(WORLD_LOCATION.id);assert.equal(context.id,'summer-pond');assert.equal(context.name,'美国奥基乔比湖');assert.equal(WORLD_LOCATION.name,context.name);assert.ok(WORLD_LOCATION.x>0&&WORLD_LOCATION.x<1&&WORLD_LOCATION.y>0&&WORLD_LOCATION.y<1);assert.equal(context.encounters.fishPool,context.fishPool);assert.ok(Object.isFrozen(WORLD_LOCATION));
});
test('world PNG and lightweight WebP preview are actual image assets rather than another scene',async()=>{
 const world=await readFile(new URL('../'+WORLD_IMAGE,import.meta.url));assert.deepEqual([...world.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const preview=await readFile(new URL('../'+WORLD_LOCATION.preview,import.meta.url));assert.equal(preview.toString('ascii',0,4),'RIFF');assert.equal(preview.toString('ascii',8,12),'WEBP');assert.ok(preview.length<200000);
 const loader=await readFile(new URL('../release-loader.js',import.meta.url),'utf8');assert.ok(loader.includes("import('./world-map.js')"));
});
