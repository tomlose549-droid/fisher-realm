import {riverBank,isAmazonWater} from './amazon-confluence.js';
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const water={level:0,minZ:-190,maxZ:150,halfWidth:14,widthVariation:1.8};
const bank=riverBank(28,-1,water);
export const AMAZON_FLOODED_FOREST=freeze({
 id:'amazon-flooded-forest',name:'亚马逊 · 沉木水草区',
 spawn:{position:[bank-1,1.72,28],yaw:-.30,pitch:-.14},
 water:{...water,platform:{minX:bank-5,maxX:bank-.35,minZ:24,maxZ:34}},
 environment:{background:'#6c8b78',fog:{color:'#71836b',near:38,far:140},exposure:.86},
 quality:{fine:{reflection:[768,480],reflectionEvery:3},fast:{reflection:[448,280],reflectionEvery:5}},
 labels:{castHint:'请面向林间水面，再按空格抛竿',reset:'已回到沉木水草区岸边钓位'},
 // These landmarks are visual only. Fishing checks shore/water, never decorations.
 decorations:{fallenTree:[[-16,5.4,-4],[7,4.5,-13]],submergedLog:[[-2,-.14,10],[7,-.05,2]],floatingLog:[[5,.08,12],[11,.15,4]]}
});
export const isFloodedForestWater=(x,z,margin=1,water=AMAZON_FLOODED_FOREST.water)=>isAmazonWater(x,z,margin,water);
