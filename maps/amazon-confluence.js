function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

// Authored landmark coordinates used the original 21–31 m channel.
const REFERENCE_WIDTH=Object.freeze({halfWidth:13,widthVariation:2.5});
const water={level:0,minZ:-210,maxZ:48,halfWidth:19.5,widthVariation:3.75};
const platformShift=riverBankOffset(28,-1,water);

// Widen by 1.5 without scaling the platform, furniture, trees or player.
export const AMAZON_CONFLUENCE=freeze({
  id:'amazon-confluence',name:'亚马逊 · 河道交汇区',
  spawn:{position:[-13+platformShift,1.82,28],yaw:-.6844,pitch:.0447},
  water:{...water,platform:{minX:-21.85+platformShift,maxX:-10.15+platformShift,minZ:23.77,maxZ:33.35}},
  environment:{background:'#49a4ef',fog:{color:'#a5b78f',near:55,far:170},exposure:.94},
  quality:{fine:{reflection:[768,480],reflectionEvery:3},fast:{reflection:[448,280],reflectionEvery:5}},
  labels:{castHint:'请面向河道水面，再按空格抛竿',reset:'已回到亚马逊木平台钓位'}
});

export function riverCenter(z){return 2*Math.sin((z-20)*.025)+1.4*Math.sin(z*.06)+.005*Math.min(0,z+25)**2;}
export function riverHalfWidth(z,water=AMAZON_CONFLUENCE.water){return water.halfWidth+(water.widthVariation??2.5)*Math.sin(z*.035+.5);}
export function riverBank(z,side=1,water=AMAZON_CONFLUENCE.water){return riverCenter(z)+side*riverHalfWidth(z,water);}
export function riverBankOffset(z,side,water=AMAZON_CONFLUENCE.water){return side*(riverHalfWidth(z,water)-riverHalfWidth(z,REFERENCE_WIDTH));}
export function isAmazonWater(x,z,margin=1,water=AMAZON_CONFLUENCE.water){
  const deck=water.platform,onDeck=deck&&x>=deck.minX&&x<=deck.maxX&&z>=deck.minZ&&z<=deck.maxZ;
  return !onDeck&&z>water.minZ&&z<water.maxZ&&Math.abs(x-riverCenter(z))<riverHalfWidth(z,water)*margin;
}
