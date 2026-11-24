import test from 'node:test';
import assert from 'node:assert/strict';
import {AMAZON_FLOODED_FOREST as config,isFloodedForestWater} from '../maps/amazon-flooded-forest.js';
import {riverBank,amazonWaterMaxZ} from '../maps/amazon-confluence.js';

test('right backwater joins the channel, preserves the fishing bank and agrees with both shore boundaries',()=>{
 const water=config.water,old={...water,basin:undefined},bay=water.basin;
 assert.equal(bay.rightX-bay.leftX,146);assert.equal(amazonWaterMaxZ(water),210);
 for(const z of [-60,0,28,36])for(const side of [-1,1])assert.equal(riverBank(z,side,water),riverBank(z,side,old));
 assert.equal(isFloodedForestWater(...[config.spawn.position[0],config.spawn.position[2]]),false);
 for(const [x,z]of [[30,70],[90,110],[110,160]]){assert.equal(isFloodedForestWater(x,z),true);assert.equal(isFloodedForestWater(x,z,1,old),false);}
 for(let z=37;z<210;z+=.5){const left=riverBank(z,-1,water),right=riverBank(z,1,water);assert.equal(isFloodedForestWater(left+.001,z),true);assert.equal(isFloodedForestWater(left-.001,z),false);assert.equal(isFloodedForestWater(right-.001,z),true);assert.equal(isFloodedForestWater(right+.001,z),false);}
 assert.equal(isFloodedForestWater(50,210),false);
});

test('driftwood and faint grass are visual decorations inside fishable water, never obstacles',()=>{
 assert.equal(config.decorations.backwaterLogs.length,5);assert.equal(config.decorations.backwaterGrass.length,7);
 for(const {from,to}of config.decorations.backwaterLogs)for(let i=0;i<=20;i++){const u=i/20,x=from[0]+u*(to[0]-from[0]),z=from[2]+u*(to[2]-from[2]);assert.equal(isFloodedForestWater(x,z),true,`${x},${z}`);}
 for(const [x,z]of config.decorations.backwaterGrass)assert.equal(isFloodedForestWater(x,z),true);
 const {platform}=config.water;assert.equal(isFloodedForestWater((platform.minX+platform.maxX)/2,(platform.minZ+platform.maxZ)/2),false);
});
