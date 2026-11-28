import {riverBank,amazonWaterMaxZ} from './maps/amazon-confluence.js';
const strips=[0,.45,1.5,4,12,30,75];
function vertex(z,i,side,water){const x=riverBank(z,side,water)+side*strips[i];return [x,i===0?-.13:i===1?.14:.34+Math.min(2,strips[i]*.025)+.12*Math.sin(x*.9+z*.4),z];}
function height(a,b,c,x,z){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]),u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;return Math.min(u,v,w)>=-1e-6?u*a[1]+v*b[1]+w*c[1]:null;}
// Sample the exact two triangles used by the visual bank. This never changes water/collision rules.
export function bankPlantHeight(x,z,water){const end=amazonWaterMaxZ(water),step=(end-water.minZ)/145,j=Math.max(0,Math.min(144,Math.floor((z-water.minZ)/step))),z0=water.minZ+j*step,z1=z0+step,t=Math.max(0,Math.min(1,(z-z0)/step));
 for(const side of [-1,1]){const offset=(x-(riverBank(z0,side,water)*(1-t)+riverBank(z1,side,water)*t))*side;if(offset<0||offset>75)continue;let i=1;while(i<strips.length-1&&offset>strips[i])i++;const a=vertex(z0,i-1,side,water),b=vertex(z0,i,side,water),c=vertex(z1,i-1,side,water),d=vertex(z1,i,side,water);const y=height(d,b,c,x,z)??height(c,b,a,x,z);if(y!==null)return y+.008;}return .35;
}
// Run the original seeded authoring steps, then discard unsupported groups without reshuffling other plants.
export function discardUnsupportedVegetation(pools,build){const sizes=pools.map(p=>p.entries.length);build();let removed=0;pools.forEach((p,i)=>{removed+=p.entries.length-sizes[i];p.entries.length=sizes[i];});return removed;}
