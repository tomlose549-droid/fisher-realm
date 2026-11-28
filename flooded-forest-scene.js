import {createAmazonQuality} from './amazon-quality.js';
import {bankPlantHeight,discardUnsupportedVegetation} from './foliage-support.js';
import * as THREE from './vendor/three.module.js';
import {riverBank,riverCenter,riverBankOffset,riverHalfWidth,amazonWaterMaxZ,isAmazonWater} from './maps/amazon-confluence.js';
import {AMAZON_FLOODED_FOREST} from './maps/amazon-flooded-forest.js';
import {createResourceScope} from './scene-resources.js';

// Real geometry at meter scale; the reference image is never used as a scene backdrop.
export function createMap(parent,camera,renderer,config=AMAZON_FLOODED_FOREST,{sharedResources=new Set()}={}){
  const root=new THREE.Group();root.name='map-'+config.id;parent.add(root);
  const previous={background:parent.background,fog:parent.fog,exposure:renderer.toneMappingExposure,auto:renderer.shadowMap.autoUpdate,dirty:renderer.shadowMap.needsUpdate};
  const targets=[];let removedUnsupported=0;
  try{
    let seed=621831;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const range=(a,b)=>a+random()*(b-a),Y=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D(),color=new THREE.Color();
    const platformShift=riverBankOffset(28,-1,config.water),waterEnd=amazonWaterMaxZ(config.water),waterSegments=145;
    const bankX=(x,z,side=x<riverCenter(z)?-1:1)=>x+riverBankOffset(z,side,config.water);
    function inPlatformClearing(x,z,padding=1.5){const p=config.water.platform;return x>p.minX-padding&&x<p.maxX+padding&&z>p.minZ-padding&&z<p.maxZ+padding;}

    const background=new THREE.Color(config.environment.background),fog=new THREE.Fog(config.environment.fog.color,config.environment.fog.near,config.environment.fog.far);
    parent.background=background;parent.fog=fog;renderer.toneMappingExposure=config.environment.exposure;
    const hemi=new THREE.HemisphereLight('#cad8bb','#343b23',1.45),sun=new THREE.DirectionalLight('#fff0bf',2.5);
    sun.position.set(-18,34,16);sun.target.position.set(0,0,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-46,right:46,top:45,bottom:-45,near:1,far:110});sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;const ambient=new THREE.AmbientLight('#9baa76',.35);root.add(hemi,sun,sun.target,ambient);
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
    function texture(paint,w=512,h=512,repeat=[1,1]){
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(...repeat);map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return map;
    }
    const bark=texture((c,w,h)=>{
      c.fillStyle='#6a6042';c.fillRect(0,0,w,h);
      for(let i=0;i<3400;i++){const x=range(0,w),y=range(0,h),r=range(1,5);c.fillStyle=i%3?'rgba(29,32,19,.18)':'rgba(184,171,116,.24)';c.fillRect(x,y,r,range(3,44));}
      for(let i=0;i<170;i++){const x=range(0,w);c.strokeStyle=i%3?'#393d29':'#9c956a';c.globalAlpha=range(.15,.6);c.lineWidth=range(.5,2.6);c.beginPath();c.moveTo(x,0);for(let y=0;y<=h;y+=16)c.lineTo(x+Math.sin(y*.025+i)*range(1,8),y);c.stroke();}c.globalAlpha=1;
      for(let i=0;i<180;i++){c.fillStyle=i%2?'#63744366':'#b4b29144';c.beginPath();c.ellipse(range(0,w),range(0,h),range(2,13),range(1,7),random()*6,0,7);c.fill();}
    },512,512,[2,3]);
    const wood=texture((c,w,h)=>{
      c.fillStyle='#827c65';c.fillRect(0,0,w,h);
      for(let i=0;i<1300;i++){const y=range(0,h);c.strokeStyle=i%3?'rgba(46,42,29,.18)':'rgba(197,186,148,.23)';c.lineWidth=range(.3,2);c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=16)c.lineTo(x,y+Math.sin(x*.02+i)*range(1,5));c.stroke();}
      for(let i=0;i<14;i++){c.strokeStyle='#3c352345';c.beginPath();c.ellipse(range(0,w),range(0,h),range(7,28),range(1,4),0,0,7);c.stroke();}
    });
    const litter=texture((c,w,h)=>{
      c.fillStyle='#51462b';c.fillRect(0,0,w,h);
      for(let i=0;i<6000;i++){c.fillStyle=['#2c351f','#768040','#7a6741','#30291e','#a28c52'][i%5];c.globalAlpha=range(.2,.65);c.beginPath();c.ellipse(range(0,w),range(0,h),range(.5,7),range(.5,2),range(0,7),0,7);c.fill();}c.globalAlpha=1;
    });
    const leafTexture=texture((c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#3d651d');g.addColorStop(.45,'#91b34f');g.addColorStop(.52,'#becb7c');g.addColorStop(1,'#4d7b28');c.fillStyle=g;c.fillRect(0,0,w,h);
      c.strokeStyle='#bfd27999';c.lineWidth=2;c.beginPath();c.moveTo(w/2,h);c.lineTo(w/2,0);c.stroke();
      for(let y=12;y<h;y+=17){for(const side of [-1,1]){c.strokeStyle='#c4cb8055';c.lineWidth=.8;c.beginPath();c.moveTo(w/2,y);c.quadraticCurveTo(w/2+side*w*.18,y-h*.08,w/2+side*w*.49,y-h*.16);c.stroke();}}
      for(let i=0;i<1800;i++){c.fillStyle=i%2?'#e6e3a11a':'#0d281323';c.fillRect(range(0,w),range(0,h),range(1,3),range(1,5));}
    },128,256);
    const standard=(tint,extra={})=>new THREE.MeshStandardMaterial({color:tint,roughness:.88,...extra});
    const barkMat=standard('#d4ccb0',{map:bark,bumpMap:bark,bumpScale:.15}),woodMat=standard('#b9b49f',{map:wood,bumpMap:wood,bumpScale:.045}),darkWood=standard('#786747',{map:wood});
    const metal=standard('#454c3e',{metalness:.62,roughness:.42}),soil=standard('#c1b28c',{map:litter,vertexColors:true,bumpMap:litter,bumpScale:.06});
    const leafMat=standard('#ffffff',{map:leafTexture,side:THREE.DoubleSide,roughness:.64,emissive:'#5c7622',emissiveMap:leafTexture,emissiveIntensity:.10});
    const wind={value:0};leafMat.onBeforeCompile=shader=>{
      shader.uniforms.amazonTime=wind;shader.vertexShader='uniform float amazonTime;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.z+=sin(amazonTime*.75+instanceMatrix[3].x*.45+instanceMatrix[3].z*.15)*position.y*position.y*.026;\n#endif');
    };
    function mesh(geo,mat,p,s,parentNode=root){const m=new THREE.Mesh(geo,mat);if(p)m.position.set(...p);if(s)m.scale.set(...s);m.castShadow=m.receiveShadow=true;parentNode.add(m);return m;}
    const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10),sphere=new THREE.SphereGeometry(1,10,7);
    const pools=[];
    function pool(geo,mat,shadow=true,parentNode=root){const entries=[];const result={entries,add(p,s,r=null,tint=null){if(mat===leafMat&&p[1]===.35)p=[p[0],bankPlantHeight(p[0],p[2],config.water),p[2]];entries.push({p,s,r,tint});},finish(){if(!entries.length)return;const inst=new THREE.InstancedMesh(geo,mat,entries.length);for(let i=0;i<entries.length;i++){const e=entries[i];dummy.position.set(...e.p);dummy.scale.set(...e.s);dummy.rotation.set(0,0,0);if(e.r?.isQuaternion)dummy.quaternion.copy(e.r);else if(e.r)dummy.rotation.set(...e.r);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);if(e.tint)inst.setColorAt(i,color.set(e.tint));}inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();parentNode.add(inst);result.mesh=inst;}};pools.push(result);return result;}
    const trunks=pool(new THREE.CylinderGeometry(.68,1,1,12,3),barkMat),roots=pool(new THREE.CylinderGeometry(.48,1,1,8,2),barkMat),vines=pool(new THREE.CylinderGeometry(.7,1,1,5),standard('#4b5330'));
    function beam(target,a,b,radius,taper=1,tint=null){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);target.add(from.clone().add(to).multiplyScalar(.5).toArray(),[radius,delta.length(),radius*taper],new THREE.Quaternion().setFromUnitVectors(Y,delta.normalize()),tint);}
    function leafGeometry(rows=3){
      const pos=[],uv=[],indices=[],cols=2;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const t=j/rows,u=i/cols,x=(u-.5)*Math.pow(Math.sin(Math.PI*t),.72);pos.push(x,t,Math.sin(Math.PI*t)*.035-Math.abs(x)*.045);uv.push(u,1-t);if(i&&j){const n=j*(cols+1)+i;indices.push(n,n-1,n-cols-1,n-1,n-cols-2,n-cols-1);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
    }
    const leaves=pool(leafGeometry(),leafMat),smallLeaves=pool(leafGeometry(4),leafMat,false),pebbles=pool(new THREE.IcosahedronGeometry(1,1),standard('#6c7052'));
    const foliage=['#c3d994','#a1bc78','#d8e3a0','#d9d78b','#b1c981','#b9d49c'];
    // Submerge the inner bank strip beneath the water edge, closing the exposed sky seam.
    // Fishing retains the same analytic shoreline.
    for(const side of [-1,1]){
      const pos=[],uv=[],tints=[],indices=[],strips=[-.42,.45,1.5,4,12,30,75],segments=waterSegments;
      for(let j=0;j<=segments;j++){const z=config.water.minZ+(waterEnd-config.water.minZ)*j/segments;
        for(let i=0;i<strips.length;i++){const x=riverBank(z,side,config.water)+side*strips[i],height=i===0?-.13:i===1?.14:.34+Math.min(2,strips[i]*.025)+.12*Math.sin(x*.9+z*.4);pos.push(x,height,z);uv.push(x/4,z/4);color.set(i<2?'#c0b18a':i<4?'#98a06b':'#6f8057').multiplyScalar(range(.83,1.08));tints.push(color.r,color.g,color.b);
          if(i&&j){const n=j*strips.length+i;if(side===1)indices.push(n,n-strips.length,n-1,n-1,n-strips.length,n-strips.length-1);else indices.push(n,n-1,n-strips.length,n-1,n-strips.length-1,n-strips.length);}}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));g.setIndex(indices);g.computeVertexNormals();mesh(g,soil);
    }
    function leafyTwig(start,end,count=6,size=.8){
      beam(vines,start,end,.018);const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=b.clone().sub(a).normalize(),side=new THREE.Vector3(direction.z,0,-direction.x).normalize();
      for(let j=1;j<=count;j++)for(const sign of [-1,1]){
        const t=j/(count+1),base=a.clone().lerp(b,t),out=side.clone().multiplyScalar(sign).addScaledVector(direction,.6).add(new THREE.Vector3(0,range(-.12,.4),0)).normalize();
        const length=size*(.75+.3*Math.sin(t*Math.PI));leaves.add(base.toArray(),[length*.72,length,1],new THREE.Quaternion().setFromUnitVectors(Y,out),foliage[(j+(sign>0?1:0))%6]);
      }
    }
    const treeRecords=[];
    function tree(x,z,h,r,far=false){
      if(inPlatformClearing(x,z))return;
      const lean=range(-1.6,1.6),base=bankPlantHeight(x,z,config.water),top=[x+lean,h,z+range(-1,1)];treeRecords.push({x,z,h,top});beam(trunks,[x,base,z],top,r);
      for(let k=0;k<(far?3:7);k++){const a=k*Math.PI*2/(far?3:7)+range(-.18,.18),length=range(2,4.5)*r,ex=x+Math.cos(a)*length,ez=z+Math.sin(a)*length;
        const side=x<riverCenter(z)?-1:1,edge=riverBank(ez,side,config.water),inWater=side<0?ex>edge:ex<edge,y=inWater?-.05:bankPlantHeight(ex,ez,config.water);
        beam(roots,[x,base+range(.6,2)*r,z],[ex,y,ez],r*range(.28,.55),.65);beam(roots,[ex,y,ez],[ex+Math.cos(a)*range(.7,1.8),y-.04,ez+Math.sin(a)*range(.7,1.8)],r*.13);
      }
      for(let k=0;k<(far?3:5);k++){
        const a=k*2.399+range(-.3,.3),reach=range(2.2,4.2),cy=h*range(.72,.98),cx=x+lean+Math.cos(a)*reach,cz=z+Math.sin(a)*reach;
        beam(trunks,[x+lean*.7,h*.62,z],[cx,cy,cz],r*.25);
        for(let j=0;j<(far||z< -55?2:4);j++){const la=a+j*1.5,reach=range(1.8,3.8);leafyTwig([cx,cy,cz],[cx+Math.cos(la)*reach,cy+range(-.8,1.2),cz+Math.sin(la)*reach],far||z< -55?4:6,range(.6,1.1));}
      }
      if(!far&&z> -48)removedUnsupported+=discardUnsupportedVegetation([vines,smallLeaves],()=>{for(let k=0;k<2;k++){
        const vx=x+range(-1.8,1.8),vz=z+range(-1,1),bottom=range(1.6,4),top=h*range(.65,.92);let from=[vx,top,vz];
        for(let y=top-1;y>bottom;y-=1){const to=[vx+Math.sin(y*.65+k)*.32,y,vz+Math.cos(y*.5)*.3];beam(vines,from,to,.025);from=to;if(y%2<1)smallLeaves.add(to,[.25,.5,1],[range(.1,2),range(0,7),0],foliage[k+1]);}
      }});
    }
    // Near trees carry roots and hanging vines; distant trees need only instanced silhouettes.
    for(const side of [-1,1])for(let row=0;row<2;row++)for(let j=0;j<21;j++){
      const z=43-j*8.5+range(-4,4),x=riverBank(z,side,config.water)+side*(range(1.2,8.2)+row*7);
      tree(x,z,range(10,20)+row*2,range(.45,.95));
    }
    tree(bankX(-22,22),22,23,1.45);tree(bankX(22,17),17,24,1.6);tree(bankX(-24,35),35,22,1.3);
    // Low-detail trees frame the backwater; leave its center open.
    const vegetationSeed=seed;
    if(config.water.basin)for(const side of [-1,1])for(let j=0;j<13;j++){
      const z=52+j*12,x=riverBank(z,side,config.water)+side*range(2,6);
      tree(x,z,range(10,17),range(.4,.7),true);
      for(let k=0;k<12;k++)smallLeaves.add([x+range(-2,2),.35,z+range(-3,3)],[.5,range(.9,1.7),1],[range(.6,1.4),range(0,7),0],foliage[k%6]);
    }
    seed=vegetationSeed;
    // Lower arching boughs form an overhead rainforest canopy rather than rows of bare poles.
    for(const side of [-1,1])for(let j=0;j<10;j++){
      const z=22-j*11+range(-2,2),x=riverBank(z,side,config.water)+side*range(1,3),h=range(6.5,11),reach=range(6,12),tip=[x-side*reach,h+range(0,2),z-3];
      beam(trunks,[x,bankPlantHeight(x,z,config.water),z],[x-side*1.8,h*.55,z-1],range(.4,.7));beam(trunks,[x-side*1.8,h*.55,z-1],tip,range(.23,.42));
      for(let k=0;k<9;k++){const u=.25+random()*.75,start=[x-side*1.8*(1-u)-side*reach*u,h*.55+(tip[1]-h*.55)*u,z-1-2*u],a=range(0,7),length=range(2,4);leafyTwig(start,[start[0]+Math.cos(a)*length,start[1]+range(-.8,1),start[2]+Math.sin(a)*length],6,range(.8,1.4));}
    }
    removedUnsupported+=discardUnsupportedVegetation([trunks,vines,leaves,smallLeaves],()=>{
    // Broad boughs bridge the river high overhead, leaving a softly lit opening downriver.
    for(const [authoredX,z,side]of [[-21,17,-1],[21,0,1],[-18,-17,-1],[25,-35,1]]){
      const x=bankX(authoredX,z,side);
      const tip=[x-side*17,12,z-9];beam(trunks,[x,5,z],tip,.32);
      for(let k=0;k<14;k++){const u=.15+random()*.85,start=[x-side*17*u,5+7*u,z-9*u],a=range(0,7),length=range(2,4.2);leafyTwig(start,[start[0]+Math.cos(a)*length,start[1]+range(-.5,1.5),start[2]+Math.sin(a)*length],7,range(.8,1.4));}
    }
        });
    // Understory fans, ferns and broad tropical foliage: all drawn in two instanced batches.
    for(let i=0;i<1600;i++){
      const z=range(-156,47),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(.4,12);
      if(inPlatformClearing(x,z))continue;
      const h=z> -40?range(.7,2.1):range(.7,1.5),a=range(0,7),broad=i%6===0;
      for(let k=0;k<4;k++){const length=h*range(.65,1.2);smallLeaves.add([x,.35,z],[broad?length*.65:length*.28,length,1],[range(.4,1.65),a+k*1.8,range(-.3,.3)],foliage[(i+k)%6]);}
      if(i%4===0)pebbles.add([x,.25,z],[range(.1,.45),range(.1,.3),range(.1,.4)],[0,range(0,7),0]);
    }
    for(const [authoredX,z]of[[-19,21],[-22.8,25],[-11,35],[18,22],[19,13],[-22,30]]){const x=bankX(authoredX,z),build=()=>{for(let k=0;k<12;k++)smallLeaves.add([x,.35,z],[range(.65,1.25),range(1.8,3.1),1],[range(.4,1.5),k*.53,range(-.2,.2)],foliage[k%6]);};if(isAmazonWater(x,z,1,config.water))removedUnsupported+=discardUnsupportedVegetation([smallLeaves],build);else build();}
    // Dense midstory hides bare ground and breaks up the tall trunks into layered jungle.
    for(let i=0;i<260;i++){
      const z=range(-100,46),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(1.4,9);if(inPlatformClearing(x,z))continue;
      const height=range(1.5,4.5),base=bankPlantHeight(x,z,config.water);beam(vines,[x,base,z],[x,base+height,z],.035);
      for(let k=0;k<6;k++){const a=k*1.05+random()*.4,length=range(1,2.2),y=base+height*(.4+k*.09);leafyTwig([x,y,z],[x+Math.cos(a)*length,y+range(.1,.7),z+Math.sin(a)*length],4,range(.45,.9));}
    }
    // Fine fern leaflets sit on connected fronds along the visible bank.
    for(let i=0;i<220;i++){const z=range(-56,43),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(.5,4);if(inPlatformClearing(x,z))continue;
      for(let k=0;k<4;k++){const a=k*1.57+random(),length=range(.7,1.7),base=bankPlantHeight(x,z,config.water);leafyTwig([x,base,z],[x+Math.cos(a)*length,base+.3+length*.3,z+Math.sin(a)*length],7,range(.15,.28));}
    }
    // A few warm red heliconia bracts beside the platform.
    const red=standard('#a84322');for(const [authoredX,z]of[[-22.7,24],[-23.2,29],[19,20]]){const x=bankX(authoredX,z);beam(vines,[x,.4,z],[x,2.4,z],.035);for(let k=0;k<5;k++){const bract=mesh(new THREE.ConeGeometry(.12,.65,7),red,[x+(k%2?.18:-.18),1.1+k*.25,z]);bract.rotation.z=k%2?-.9:.9;}}
    // Natural mud/leaf bank. Decorations never participate in water/collision tests.
    const bx=config.spawn.position[0],bz=config.spawn.position[2];
    const frames=pool(cylinder,metal),moss=pool(sphere,standard('#54713c'),false);
    const propBeam=(a,b,r=.025)=>beam(frames,a,b,r);
    // Folding canvas chair and tackle box beside the seated first-person fishing spot.
    const canvasMat=standard('#9a9670',{side:THREE.DoubleSide});
    for(const x of [bx-.8,bx+.2]){propBeam([x,.1,bz-3],[x,.8,bz-4.2]);propBeam([x,.1,bz-4.2],[x,.8,bz-3]);propBeam([x,.65,bz-3],[x,1.2,bz-2.85]);}
    mesh(cube,canvasMat,[bx-.3,.73,bz-3.6],[1.05,.07,1.2]);const back=mesh(cube,canvasMat,[bx-.3,1.02,bz-2.92],[1.05,.6,.06]);back.rotation.x=-.12;
    const boxMat=standard('#526047');mesh(cube,boxMat,[bx-1.3,.72,bz-3],[1.5,.65,.85]);mesh(cube,metal,[bx-1.3,1.06,bz-3],[1.55,.05,.9]);for(const x of [bx-1.8,bx-.8])mesh(cube,metal,[x,.8,bz-2.55],[.06,.45,.05]);
    const lanternMat=standard('#ffe6a0',{emissive:'#ffb849',emissiveIntensity:1.5}),glassMat=standard('#d9bd78',{transparent:true,opacity:.42,roughness:.25});
    propBeam([bx-3,2.5,bz-4],[bx-2,2.5,bz-4]);mesh(cylinder,metal,[bx-2,2.1,bz-4],[.17,.07,.17]);mesh(cylinder,glassMat,[bx-2,2.3,bz-4],[.13,.36,.13]);mesh(cylinder,lanternMat,[bx-2,2.3,bz-4],[.04,.24,.04]);mesh(cylinder,metal,[bx-2,2.5,bz-4],[.17,.07,.17]);
    const net=new THREE.Group();root.add(net);net.position.set(bx-3.1,.85,bz-1.5);net.rotation.set(.1,.2,.12);const hoop=mesh(new THREE.TorusGeometry(.44,.018,6,36),metal,[0,.7,0],null,net);propBeam([bx-3.1,.1,bz-1.5],[bx-3.1,.85,bz-1.5]);
    const threads=[];for(let i=-4;i<=4;i++){const x=i*.09,dy=Math.sqrt(.44*.44-x*x);threads.push(x,.7-dy,0,x,.7+dy,0,-dy,.7+x,0,dy,.7+x,0);}const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(threads,3));net.add(new THREE.LineSegments(ng,new THREE.LineBasicMaterial({color:'#252d20',transparent:true,opacity:.65})));
    for(const key of ['fallenTree','submergedLog','floatingLog']){
      const [a,b]=config.decorations[key],r=key==='fallenTree'?.48:.32;beam(trunks,a,b,r,.8);
      const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);for(let k=1;k<5;k++){const p=av.clone().lerp(bv,k/5),end=p.clone().add(new THREE.Vector3(k%2?2:-1.5,key==='fallenTree'?1.1:.4,-1.5));beam(trunks,p.toArray(),end.toArray(),r*.26);moss.add([p.x,p.y+r*.7,p.z],[r*1.1,.08,r*.85],null,'#6b823e');if(key==='fallenTree')leafyTwig(p.toArray(),[p.x+.3,p.y+1.8,p.z],5,.5);}
    }
    for(const {from,to,radius}of config.decorations.backwaterLogs??[]){
      beam(trunks,from,to,radius,.85);
      const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to);
      for(let k=1;k<=3;k++){const p=a.clone().lerp(b,k/4),sign=k%2?1:-1;
        beam(trunks,p.toArray(),[p.x+sign*radius*3,p.y+radius*.9,p.z+radius*2],radius*.2);
        moss.add([p.x,p.y+radius*.6,p.z],[radius*1.2,.035,radius*.8],null,'#667044');
      }
    }
    removedUnsupported+=discardUnsupportedVegetation([trunks,vines,leaves,smallLeaves],()=>{
    // Low overhead boughs and epiphytes make a sheltered forest opening.
    for(const side of [-1,1])for(let j=0;j<7;j++){const z=20-j*10,x=riverBank(z,side,config.water)+side*2,tip=[x-side*9,8+Math.sin(j)*1.3,z-5];beam(trunks,[x,3,z],tip,.25);for(let k=0;k<10;k++){const a=k*.628,p=new THREE.Vector3(x,3,z).lerp(new THREE.Vector3(...tip),.5+k*.045);leafyTwig(p.toArray(),[p.x+Math.cos(a)*3,p.y+.5,p.z+Math.sin(a)*3],8,1.2);}}
        });
    // Submerged ribbons grow in clumps; their roots stay underwater and are purely visual.
    const grass=pool(leafGeometry(5),standard('#6e8245',{side:THREE.DoubleSide,transparent:true,opacity:.65,roughness:.6}),false);
    for(let i=0;i<230;i++){const z=range(-35,25),side=i%2?1:-1,x=riverBank(z,side,config.water)-side*range(.6,6);for(let k=0;k<3;k++)grass.add([x,-2.85,z],[.07,range(1.2,2.6),1],[range(1.15,1.45),range(0,7),range(-.4,.4)],'#92a85a');}

    // Same blue gradient and seeded white cloud banks as the first lake.
    // Sky randomness is independent of the bank and vegetation layout.
    let skySeed=17329;
    const skyRange=(a,b)=>{skySeed=(1664525*skySeed+1013904223)>>>0;return a+(b-a)*skySeed/4294967296;};
    const sky=mesh(new THREE.SphereGeometry(300,24,14),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.57,.65,.53),vec3(.22,.39,.35),smoothstep(0.,.35,h));float glow=pow(max(dot(d,normalize(vec3(-38.,62.,24.))),0.),32.);c+=vec3(.18,.13,.035)*glow;gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`}));sky.castShadow=false;sky.receiveShadow=false;sky.frustumCulled=false;
    const cloudPool=pool(new THREE.SphereGeometry(1,10,7),new THREE.ShaderMaterial({vertexShader:'varying vec3 cloudNormal;void main(){cloudNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 cloudNormal;void main(){float light=smoothstep(-.7,.65,normalize(cloudNormal).y-normalize(cloudNormal).x*.2);gl_FragColor=vec4(mix(vec3(.63,.77,.91),vec3(1.),light),1.);
      #include <colorspace_fragment>
    }`}),false);
    for(let i=0;i<5;i++){const a=skyRange(0,Math.PI*2),r=skyRange(105,170),x=Math.cos(a)*r,z=-15+Math.sin(a)*r,y=skyRange(34,56),s=skyRange(2.8,5.5);for(let j=0;j<7;j++)cloudPool.add([x+(j-3)*s*.95,y+Math.sin(j*.9)*s*.5,z+skyRange(-2,2)],[s*skyRange(.85,1.5),s*skyRange(.65,1.1),s*.8],null,'#ffffff');}

    // A sparse bed of submerged ribbons is blended beneath the water shading.
    // This avoids extra transparent meshes, surface reeds and reflection passes.
    const bay=config.water.basin,grassPatches=config.decorations.backwaterGrass??[];
    const grassBounds=new THREE.Vector4(bay?.leftX??0,bay?.startZ??0,bay?bay.rightX-bay.leftX:1,bay?bay.maxZ-bay.startZ:1);
    const grassMask=texture((c,w,h)=>{
      c.clearRect(0,0,w,h);let grassSeed=391751;
      const r=(a,b)=>{grassSeed=(Math.imul(grassSeed,1664525)+1013904223)>>>0;return a+(b-a)*grassSeed/4294967296;};
      const px=x=>(x-grassBounds.x)/grassBounds.z*w,pz=z=>(z-grassBounds.y)/grassBounds.w*h;
      for(const [x,z,rx,rz]of grassPatches)for(let tuft=0;tuft<22;tuft++){
        const a=r(0,Math.PI*2),radius=r(0,1),tx=x+Math.cos(a)*rx*radius,tz=z+Math.sin(a)*rz*radius;
        for(let blade=0;blade<4;blade++){const dx=r(-1,1),dz=r(-1.5,1.5);c.strokeStyle='rgba(151,167,91,'+r(.22,.55)+')';c.lineWidth=r(.65,1.1);c.beginPath();c.moveTo(px(tx),pz(tz));c.quadraticCurveTo(px(tx+dx*.35),pz(tz+dz*.7),px(tx+dx),pz(tz+dz));c.stroke();}
      }
    });
    grassMask.flipY=false;grassMask.wrapS=grassMask.wrapT=THREE.ClampToEdgeWrapping;
    // River water reflects the actual current scene. Reflection resolution/frequency are bounded.
    const reflectionTarget=new THREE.WebGLRenderTarget(...config.quality.fine.reflection,{depthBuffer:true});targets.push(reflectionTarget);
    const reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4(),lookDirection=new THREE.Vector3(),lookTarget=new THREE.Vector3();
    const highQuality={value:0};const uniforms={highQuality,time:{value:0},mirrorMap:{value:reflectionTarget.texture},mirrorMatrix:{value:reflectionMatrix},sunDir:{value:sun.position.clone().normalize()},grassMask:{value:grassMask},grassBounds:{value:grassBounds}};
    const waterGeo=new THREE.BufferGeometry(),wp=[],wi=[];
    for(let j=0;j<=waterSegments;j++){const z=config.water.minZ+(waterEnd-config.water.minZ)*j/waterSegments;wp.push(riverBank(z,-1,config.water),0,z,riverBank(z,1,config.water),0,z);if(j){const n=j*2;wi.push(n,n+1,n-2,n+1,n-1,n-2);}}
    waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();
    const water=mesh(waterGeo,new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,
      vertexShader:'varying vec3 vWorld;varying vec4 vMirror;uniform mat4 mirrorMatrix;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vMirror=mirrorMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`uniform float highQuality;uniform float time;uniform sampler2D mirrorMap;uniform sampler2D grassMask;uniform vec4 grassBounds;uniform vec3 sunDir;varying vec3 vWorld;varying vec4 vMirror;
      void main(){vec2 p=vWorld.xz;float t=time;vec3 eye=normalize(cameraPosition-vWorld);vec3 n=normalize(vec3((sin(p.x*5.2+p.y*.9+t*.52)+.32*cos(p.y*13.-t))* .010,1.,cos(p.y*8.-p.x*.5-t*.38)*.009));n=normalize(mix(n,vec3(0.,1.,0.),highQuality*.35));float f=mix(.14,.22,highQuality)+.68*pow(1.-max(dot(eye,n),0.),2.8);vec2 uv=vMirror.xy/vMirror.w*.5+.5+n.xz*.17;vec3 reflection=texture2D(mirrorMap,clamp(uv,.002,.998)).rgb*.5+texture2D(mirrorMap,clamp(uv+vec2(.0015,.001),.002,.998)).rgb*.25+texture2D(mirrorMap,clamp(uv-vec2(.0015,.001),.002,.998)).rgb*.25;vec3 c=mix(mix(vec3(.047,.028,.009),vec3(.025,.055,.042),highQuality),reflection*mix(vec3(.81,.83,.56),vec3(.91,.98,.95),highQuality),f);vec2 grassUV=(p-grassBounds.xy)/grassBounds.zw+n.xz*.035;float inside=step(0.,grassUV.x)*step(grassUV.x,1.)*step(0.,grassUV.y)*step(grassUV.y,1.);float submerged=texture2D(grassMask,clamp(grassUV,0.,1.)).a*inside;float clarity=(1.-smoothstep(35.,120.,distance(cameraPosition,vWorld)))*(1.-f*.65);c=mix(c,vec3(.13,.16,.055),submerged*clarity*.26);float fleck=pow(max(dot(reflect(-sunDir,n),eye),0.),180.);c+=vec3(.84,.68,.30)*fleck*.65;float thread=pow(max(0.,sin(p.y*17.+sin(p.x*2.)*.7-t*.52)),35.);c+=vec3(.025,.023,.009)*thread;float haze=smoothstep(45.,160.,distance(cameraPosition,vWorld));c=mix(c,vec3(.24,.30,.17),haze*.6);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}),[0,config.water.level,0]);water.castShadow=water.receiveShadow=false;
    const pads=pool(new THREE.CircleGeometry(1,14,.1,Math.PI*1.88),standard('#ffffff',{side:THREE.DoubleSide,roughness:.55}),false);
    for(let i=0;i<630;i++){const z=range(-130,42),side=i%2?1:-1,x=riverBank(z,side,config.water)-side*range(.12,2.7),s=range(.08,.25);pads.add([x,.018,z],[s,s,1],[-Math.PI/2,0,range(0,7)],foliage[i%6]);}
    pools.forEach(p=>p.finish());grass.mesh.computeBoundingBox();const submergedGrassTop=grass.mesh.boundingBox.max.y;
    smallLeaves.mesh.name='amazon-smallLeaves-classic';
    const presentation=createAmazonQuality({root,renderer,camera,config,treeRecords,pools:{leaves,smallLeaves,trunks,roots,vines,pebbles},barkMat,woodMat,darkWood,soil,leafMat,hemi,sun,ambient,fog,waterUniform:highQuality});presentation.setQuality(true);
    const resources=createResourceScope(root,{targets,shared:sharedResources});
    return {
      update(elapsed){if(resources.disposed)return;wind.value=elapsed;uniforms.time.value=elapsed;},
      setQuality(fine){if(!resources.disposed){presentation.setQuality(fine);reflectionTarget.setSize(...config.quality.fine.reflection);}},
      renderReflection({frame,fine,force=false,before=()=>{},after=()=>{}}){
        if(resources.disposed||(!force&&frame%config.quality[fine?'fine':'fast'].reflectionEvery!==0))return;
        reflectionCamera.copy(camera,false);reflectionCamera.position.y=2*config.water.level-camera.position.y;camera.getWorldDirection(lookDirection);lookTarget.copy(camera.position).add(lookDirection);lookTarget.y=2*config.water.level-lookTarget.y;reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(lookTarget);reflectionCamera.updateMatrixWorld();reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
        const target=renderer.getRenderTarget(),visible=water.visible;
        try{water.visible=false;before();renderer.setRenderTarget(reflectionTarget);renderer.render(parent,reflectionCamera);}
        finally{renderer.setRenderTarget(target);water.visible=visible;after();}
      },
      getDiagnostics:()=>({disposed:resources.disposed,presentation:presentation.snapshot(),foliageCleanup:{removedUnsupportedInstances:removedUnsupported,groundedPlants:true},treeCount:treeRecords.length,chairs:[],objects:root.children.length,reflectionSize:[reflectionTarget.width,reflectionTarget.height],shorePosition:config.spawn.position,decorationColliders:0,decorations:config.decorations,riverWidthAtSpawn:2*riverHalfWidth(config.spawn.position[2],config.water),basin:config.water.basin?{...config.water.basin,width:config.water.basin.rightX-config.water.basin.leftX}:null,surfacePlantCount:pads.mesh.count,waterMeshCount:1,reflectionTargetCount:targets.length,waterSegments,waterEnd,backwaterLogs:config.decorations.backwaterLogs?.length??0,submergedGrassPatches:grassPatches.length,submergedGrassTop,landmarks:['open-backwater','natural-bank','folding-chair','tackle-box','hanging-lantern','landing-net','fallen-tree','submerged-log','floating-log','submerged-grass','dense-canopy']}),
      dispose(){if(resources.disposed)return;resources.dispose();if(parent.background===background)parent.background=previous.background;if(parent.fog===fog)parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;}
    };
  }catch(error){createResourceScope(root,{targets,shared:sharedResources}).dispose();parent.background=previous.background;parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;throw error;}
}
