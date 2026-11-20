import test from 'node:test';
import assert from 'node:assert/strict';
import {AMAZON_CONFLUENCE,riverCenter,riverHalfWidth,riverBank,riverBankOffset,amazonWaterMaxZ,isAmazonWater} from '../maps/amazon-confluence.js';
import {getMapContext} from '../map-registry.js';
import {FishingSession} from '../fishing-rules.js';
const {water,spawn}=AMAZON_CONFLUENCE;
test('right basin extends the cut end, while fixed fishing station and forward channel retain their positions',()=>{
 assert.equal(water.basin.rightX-water.basin.leftX,203);assert.equal(amazonWaterMaxZ(),230);assert.deepEqual([spawn.yaw,spawn.pitch],[-.6844,.0447]);
 const original={...water,basin:undefined};assert.equal(amazonWaterMaxZ(original),48);
 for(let z=water.minZ;z<=water.basin.startZ;z+=.5)for(const side of [-1,1]){assert.equal(riverBank(z,side),riverBank(z,side,original));assert.equal(riverBankOffset(z,side),riverBankOffset(z,side,original));}
 assert.equal(isAmazonWater(100,100),true);assert.equal(isAmazonWater(100,100,1,original),false);assert.equal(isAmazonWater(spawn.position[0],spawn.position[2]),false);
});
test('basin shore bounds and water checks agree across the transition and full basin, including custom configs',()=>{
 for(const w of [water,{...water,basin:{startZ:40,fullZ:110,maxZ:210,leftX:-45,rightX:190}}]){
  for(let z=w.basin.startZ;z<amazonWaterMaxZ(w);z+=.5){const left=riverBank(z,-1,w),right=riverBank(z,1,w);assert.ok(right>left);assert.equal(isAmazonWater((left+right)/2,z,1,w),true);assert.equal(isAmazonWater(left-.01,z,1,w),false);assert.equal(isAmazonWater(right+.01,z,1,w),false);assert.equal(isAmazonWater(left+.01,z,1,w),true);assert.equal(isAmazonWater(right-.01,z,1,w),true);}
  assert.equal(isAmazonWater(0,amazonWaterMaxZ(w),1,w),false);assert.equal(isAmazonWater(0,amazonWaterMaxZ(w)+1,1,w),false);
  for(const z of [w.basin.startZ,w.basin.fullZ])for(const side of [-1,1])assert.ok(Math.abs(riverBank(z+1e-5,side,w)-riverBank(z-1e-5,side,w))<.0001);
 }
 const z=120;assert.equal(riverBank(z,-1),-38);assert.equal(riverBank(z,1),165);assert.equal(isAmazonWater(164,z,.98),false);assert.equal(isAmazonWater(100,z,.98),true);
 assert.equal(riverBank(20,1),riverCenter(20)+riverHalfWidth(20));
});
test('a 23 m cast into the previously missing right-turn water remains fishable during a fight',()=>{
 const context=getMapContext('amazon-confluence'),yaw=-2.8,x=spawn.position[0]-Math.sin(yaw)*23,z=spawn.position[2]-Math.cos(yaw)*23;
 assert.ok(z>water.maxZ);assert.equal(context.isWater(x,z,.98),true);
 const session=new FishingSession(()=>0,{player:{x:spawn.position[0],z:spawn.position[2]},isWater:context.isWater,fishPool:context.fishPool,encounters:context.encounters});
 assert.equal(session.cast(0,yaw),true);assert.equal(session.hook(6),true);session.advance(6.2);assert.equal(session.state,'fighting');assert.equal(session.failure,null);
});
