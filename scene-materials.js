import * as THREE from './vendor/three.module.js';
export function surfaceTexture(kind,w,h){
 const height=new Float32Array(w*h),pixels=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4);
 const noise=(x,y)=>{let a=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967295;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h,n=noise(x,y),coarse=noise(x>>3,y>>3);let a,rgb;
  if(kind==='leaf'){const vein=Math.exp(-Math.abs(u-.5)*100),ribs=Math.pow(Math.max(0,Math.cos(v*95+Math.abs(u-.5)*20)),12);a=.52+vein*.3+ribs*.1+n*.05;rgb=[86+a*66,119+a*66,47+a*45];}
  else if(kind==='wood'){const grain=Math.sin(u*21+Math.sin(v*150)*.12+Math.sin(u*6)*2);a=.45+grain*.17+coarse*.17+n*.06;rgb=[99+a*59,78+a*49,53+a*36];}
  else if(kind==='bark'){const furrow=Math.pow(Math.abs(Math.sin(u*57+Math.sin(v*19)*.9+Math.sin(v*71)*.12)),.35);a=.12+furrow*.65+coarse*.13+n*.08;const moss=Math.max(0,Math.sin(u*22+v*7))*.15;rgb=[46+a*64-moss*10,44+a*57+moss*25,29+a*42];}
  else if(kind==='stone'){a=.15+coarse*.5+n*.2+Math.sin(v*93+Math.sin(u*23)*.8)*.08;rgb=[135+a*66,137+a*60,123+a*48];}else if(kind==='grassland'){a=.15+coarse*.55+n*.3;rgb=[155+a*50,167+a*45,132+a*45];}else{a=.15+coarse*.55+n*.3;rgb=[68+a*55,64+a*39,38+a*31];}
  const i=y*w+x,k=i*4;height[i]=a;pixels[k]=rgb[0];pixels[k+1]=rgb[1];pixels[k+2]=rgb[2];pixels[k+3]=255;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,k=i*4,dx=height[y*w+(x+1)%w]-height[y*w+(x+w-1)%w],dy=height[((y+1)%h)*w+x]-height[((y+h-1)%h)*w+x],l=Math.hypot(dx*1.8,dy*1.8,1);normal[k]=128-dx*1.8/l*127;normal[k+1]=128-dy*1.8/l*127;normal[k+2]=128+127/l;normal[k+3]=255;}
 const make=(data,color)=>{const t=new THREE.DataTexture(data,w,h);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;};
 return {map:make(pixels,true),normalMap:make(normal,false)};
}
