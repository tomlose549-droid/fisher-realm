import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FISH_DATA} from '../fish-data.js';
import {inventoryImageSources} from '../inventory-images.js';
test('every configured fish has a smaller prebuilt WebP thumbnail and intact original path',async()=>{
 for(const fish of FISH_DATA){if(!fish.inventory.image)continue;const [thumb,original]=inventoryImageSources(fish.inventory.image);const [a,b]=await Promise.all([readFile(new URL(thumb)),readFile(new URL(original))]);assert.ok(a.length<b.length,fish.name);assert.equal(a.subarray(0,4).toString(),'RIFF');assert.equal(a.subarray(8,12).toString(),'WEBP');assert.ok(thumb.includes('/thumbnails/'));assert.ok(original.endsWith('/'+fish.inventory.image));}
});
