import * as THREE from './vendor/three.module.js';
import {AMAZON_CONFLUENCE,riverBank,riverCenter,riverBankOffset,riverHalfWidth,amazonWaterMaxZ} from './maps/amazon-confluence.js';
import {createResourceScope} from './scene-resources.js';

// Real geometry at meter scale; the reference image is never used as a scene backdrop.
export function createMap(parent,camera,renderer,config=AMAZON_CONFLUENCE,{sharedResources=new Set()}={}){
  const root=new THREE.Group();root.name='map-'+config.id;parent.add(root);
  const previous={background:parent.background,fog:parent.fog,exposure:renderer.toneMappingExposure,auto:renderer.shadowMap.autoUpdate,dirty:renderer.shadowMap.needsUpdate};
  const targets=[];
  try{
    let seed=621831;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const range=(a,b)=>a+random()*(b-a),Y=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D(),color=new THREE.Color();
    const platformShift=riverBankOffset(28,-1,config.water),waterEnd=amazonWaterMaxZ(config.water),waterSegments=145;
    const bankX=(x,z,side=x<riverCenter(z)?-1:1)=>x+riverBankOffset(z,side,config.water);
    function inPlatformClearing(x,z,padding=1.5){const p=config.water.platform;return x>p.minX-padding&&x<p.maxX+padding&&z>p.minZ-padding&&z<p.maxZ+padding;}

    const background=new THREE.Color(config.environment.background),fog=new THREE.Fog(config.environment.fog.color,config.environment.fog.near,config.environment.fog.far);
    parent.background=background;parent.fog=fog;renderer.toneMappingExposure=config.environment.exposure;
    const hemi=new THREE.HemisphereLight('#e0edc9','#706246',2.3),sun=new THREE.DirectionalLight('#fff0ba',3.4);
    sun.position.set(-18,34,16);sun.target.position.set(0,0,0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-46,right:46,top:45,bottom:-45,near:1,far:110});sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;root.add(hemi,sun,sun.target,new THREE.AmbientLight('#a1b27e',.55));
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
    function pool(geo,mat,shadow=true,parentNode=root){const entries=[];const result={add(p,s,r=null,tint=null){entries.push({p,s,r,tint});},finish(){if(!entries.length)return;const inst=new THREE.InstancedMesh(geo,mat,entries.length);for(let i=0;i<entries.length;i++){const e=entries[i];dummy.position.set(...e.p);dummy.scale.set(...e.s);dummy.rotation.set(0,0,0);if(e.r?.isQuaternion)dummy.quaternion.copy(e.r);else if(e.r)dummy.rotation.set(...e.r);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);if(e.tint)inst.setColorAt(i,color.set(e.tint));}inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();parentNode.add(inst);}};pools.push(result);return result;}
    const trunks=pool(new THREE.CylinderGeometry(.68,1,1,12,3),barkMat),roots=pool(new THREE.CylinderGeometry(.48,1,1,8,2),barkMat),vines=pool(new THREE.CylinderGeometry(.7,1,1,5),standard('#4b5330'));
    function beam(target,a,b,radius,taper=1,tint=null){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);target.add(from.clone().add(to).multiplyScalar(.5).toArray(),[radius,delta.length(),radius*taper],new THREE.Quaternion().setFromUnitVectors(Y,delta.normalize()),tint);}
    function leafGeometry(rows=3){
      const pos=[],uv=[],indices=[],cols=2;
      for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const t=j/rows,u=i/cols,x=(u-.5)*Math.pow(Math.sin(Math.PI*t),.72);pos.push(x,t,Math.sin(Math.PI*t)*.035-Math.abs(x)*.045);uv.push(u,1-t);if(i&&j){const n=j*(cols+1)+i;indices.push(n,n-1,n-cols-1,n-1,n-cols-2,n-cols-1);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
    }
    const leaves=pool(leafGeometry(),leafMat),smallLeaves=pool(leafGeometry(4),leafMat,false),pebbles=pool(new THREE.IcosahedronGeometry(1,1),standard('#6c7052'));
    const foliage=['#c3d994','#a1bc78','#d8e3a0','#d9d78b','#b1c981','#b9d49c'];
    // Continuous meandering banks share the exact boundary used by fishing rules.
    for(const side of [-1,1]){
      const pos=[],uv=[],tints=[],indices=[],strips=[0,.45,1.5,4,12,30,75],segments=waterSegments;
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
      const lean=range(-1.6,1.6),base=.35;treeRecords.push({x,z,h});beam(trunks,[x,base,z],[x+lean,h,z+range(-1,1)],r);
      for(let k=0;k<(far?3:7);k++){const a=k*Math.PI*2/(far?3:7)+range(-.18,.18),length=range(2,4.5)*r,ex=x+Math.cos(a)*length,ez=z+Math.sin(a)*length;
        const side=x<riverCenter(z)?-1:1,edge=riverBank(ez,side,config.water),inWater=side<0?ex>edge:ex<edge,y=inWater?-.05:.38;
        beam(roots,[x,base+range(.6,2)*r,z],[ex,y,ez],r*range(.28,.55),.65);beam(roots,[ex,y,ez],[ex+Math.cos(a)*range(.7,1.8),y-.04,ez+Math.sin(a)*range(.7,1.8)],r*.13);
      }
      for(let k=0;k<(far?3:5);k++){
        const a=k*2.399+range(-.3,.3),reach=range(2.2,4.2),cy=h*range(.72,.98),cx=x+lean+Math.cos(a)*reach,cz=z+Math.sin(a)*reach;
        beam(trunks,[x+lean*.7,h*.62,z],[cx,cy,cz],r*.25);
        for(let j=0;j<(far||z< -55?2:4);j++){const la=a+j*1.5,reach=range(1.8,3.8);leafyTwig([cx,cy,cz],[cx+Math.cos(la)*reach,cy+range(-.8,1.2),cz+Math.sin(la)*reach],far||z< -55?4:6,range(.6,1.1));}
      }
      if(!far&&z> -48)for(let k=0;k<2;k++){
        const vx=x+range(-1.8,1.8),vz=z+range(-1,1),bottom=range(1.6,4),top=h*range(.65,.92);let from=[vx,top,vz];
        for(let y=top-1;y>bottom;y-=1){const to=[vx+Math.sin(y*.65+k)*.32,y,vz+Math.cos(y*.5)*.3];beam(vines,from,to,.025);from=to;if(y%2<1)smallLeaves.add(to,[.25,.5,1],[range(.1,2),range(0,7),0],foliage[k+1]);}
      }
    }
    // Near trees carry roots and hanging vines; distant trees need only instanced silhouettes.
    for(const side of [-1,1])for(let row=0;row<2;row++)for(let j=0;j<21;j++){
      const z=43-j*8.5+range(-4,4),x=riverBank(z,side,config.water)+side*(range(1.2,8.2)+row*7);
      tree(x,z,range(10,20)+row*2,range(.45,.95));
    }
    tree(bankX(-22,22),22,23,1.45);tree(bankX(22,17),17,24,1.6);tree(bankX(-24,35),35,22,1.3);
    // Lower arching boughs form an overhead rainforest canopy rather than rows of bare poles.
    for(const side of [-1,1])for(let j=0;j<10;j++){
      const z=22-j*11+range(-2,2),x=riverBank(z,side,config.water)+side*range(1,3),h=range(6.5,11),reach=range(6,12),tip=[x-side*reach,h+range(0,2),z-3];
      beam(trunks,[x,.6,z],[x-side*1.8,h*.55,z-1],range(.4,.7));beam(trunks,[x-side*1.8,h*.55,z-1],tip,range(.23,.42));
      for(let k=0;k<9;k++){const u=.25+random()*.75,start=[x-side*reach*u,h*.55+(tip[1]-h*.55)*u,z-3*u],a=range(0,7),length=range(2,4);leafyTwig(start,[start[0]+Math.cos(a)*length,start[1]+range(-.8,1),start[2]+Math.sin(a)*length],6,range(.8,1.4));}
    }
    // Broad boughs bridge the river high overhead, leaving a softly lit opening downriver.
    for(const [authoredX,z,side]of [[-21,17,-1],[21,0,1],[-18,-17,-1],[25,-35,1]]){
      const x=bankX(authoredX,z,side);
      const tip=[x-side*17,12,z-9];beam(trunks,[x,5,z],tip,.32);
      for(let k=0;k<14;k++){const u=.15+random()*.85,start=[x-side*17*u,5+7*u,z-9*u],a=range(0,7),length=range(2,4.2);leafyTwig(start,[start[0]+Math.cos(a)*length,start[1]+range(-.5,1.5),start[2]+Math.sin(a)*length],7,range(.8,1.4));}
    }
    // Understory fans, ferns and broad tropical foliage: all drawn in two instanced batches.
    for(let i=0;i<1600;i++){
      const z=range(-156,47),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(.4,12);
      if(inPlatformClearing(x,z))continue;
      const h=z> -40?range(.7,2.1):range(.7,1.5),a=range(0,7),broad=i%6===0;
      for(let k=0;k<4;k++){const length=h*range(.65,1.2);smallLeaves.add([x,.35,z],[broad?length*.65:length*.28,length,1],[range(.4,1.65),a+k*1.8,range(-.3,.3)],foliage[(i+k)%6]);}
      if(i%4===0)pebbles.add([x,.25,z],[range(.1,.45),range(.1,.3),range(.1,.4)],[0,range(0,7),0]);
    }
    for(const [authoredX,z]of[[-19,21],[-22.8,25],[-11,35],[18,22],[19,13],[-22,30]]){const x=bankX(authoredX,z);for(let k=0;k<12;k++)smallLeaves.add([x,.35,z],[range(.65,1.25),range(1.8,3.1),1],[range(.4,1.5),k*.53,range(-.2,.2)],foliage[k%6]);}
    // Dense midstory hides bare ground and breaks up the tall trunks into layered jungle.
    for(let i=0;i<260;i++){
      const z=range(-100,46),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(1.4,9);if(inPlatformClearing(x,z))continue;
      const height=range(1.5,4.5);beam(vines,[x,.3,z],[x,height,z],.035);
      for(let k=0;k<6;k++){const a=k*1.05+random()*.4,length=range(1,2.2),y=height*(.4+k*.09);leafyTwig([x,y,z],[x+Math.cos(a)*length,y+range(.1,.7),z+Math.sin(a)*length],4,range(.45,.9));}
    }
    // Fine fern leaflets sit on connected fronds along the visible bank.
    for(let i=0;i<220;i++){const z=range(-56,43),side=i%2?1:-1,x=riverBank(z,side,config.water)+side*range(.5,4);if(inPlatformClearing(x,z))continue;
      for(let k=0;k<4;k++){const a=k*1.57+random(),length=range(.7,1.7);leafyTwig([x,.4,z],[x+Math.cos(a)*length,.7+length*.3,z+Math.sin(a)*length],7,range(.15,.28));}
    }
    // A few warm red heliconia bracts beside the platform.
    const red=standard('#a84322');for(const [authoredX,z]of[[-22.7,24],[-23.2,29],[19,20]]){const x=bankX(authoredX,z);beam(vines,[x,.4,z],[x,2.4,z],.035);for(let k=0;k<5;k++){const bract=mesh(new THREE.ConeGeometry(.12,.65,7),red,[x+(k%2?.18:-.18),1.1+k*.25,z]);bract.rotation.z=k%2?-.9:.9;}}
    // Translate the whole fishing station with the left bank, retaining meter-scale props.
    const platformRoot=new THREE.Group();platformRoot.name='amazon-platform';platformRoot.position.x=platformShift;root.add(platformRoot);
    const platformMesh=(geo,mat,p,s,g=platformRoot)=>mesh(geo,mat,p,s,g);
    const platformBox=(mat,p,s,g=platformRoot)=>mesh(cube,mat,p,s,g);
    // Weathered wooden platform and fishing station from the reference.
    for(let i=0;i<20;i++)platformBox(woodMat,[-16,.46,24+i*.48],[11.7,.17,.455]);
    for(const x of [-21,-16,-10.5]){platformBox(darkWood,[x,.22,28.6],[.18,.24,10.4]);for(const z of [24,33.2])platformMesh(cylinder,barkMat,[x,-.05,z],[.13,.9,.13]);}
    const nailPool=pool(sphere,metal,false,platformRoot);for(let i=0;i<20;i++)for(const x of [-21,-16,-10.5])nailPool.add([x,.552,24+i*.48],[.018,.007,.018]);
    for(const x of [-17.5,-10.5]){platformBox(darkWood,[x,.95,24],[.14,1.0,.14]);platformBox(woodMat,[x,1.47,24],[.23,.07,.23]);}
    platformBox(darkWood,[-14,.83,24],[7,.07,.07]);
    for(const x of [-16.8,-12]){const rest=platformMesh(new THREE.TorusGeometry(.12,.018,6,14,Math.PI),metal,[x,1.20,24]);rest.rotation.z=Math.PI;}
    const tackle=standard('#727958'),trim=standard('#333e30',{metalness:.35}),cushion=standard('#77785b',{roughness:1}),brass=standard('#b4a77b',{metalness:.7,roughness:.5});
    const chest=new THREE.Group();chest.name='amazon-tackle-seat';chest.position.set(-16.7,.58,28.5);platformRoot.add(chest);
    platformBox(tackle,[0,.40,0],[1.5,.80,1.15],chest);platformBox(cushion,[0,.88,0],[1.58,.18,1.2],chest);
    for(const x of [-.72,.72])platformBox(trim,[x,.41,0],[.085,.86,1.18],chest);
    for(let j=0;j<3;j++){platformBox(trim,[0,.17+j*.23,-.585],[1.36,.024,.018],chest);platformBox(brass,[0,.25+j*.23,-.61],[.27,.045,.04],chest);}
    for(const x of [-.6,.6])platformBox(brass,[x,.64,-.62],[.08,.17,.055],chest);
    const shelf=new THREE.Group();shelf.name='amazon-wood-shelf';shelf.position.set(-19,.58,25.6);platformRoot.add(shelf);
    for(const x of [-1.1,1.1])for(const z of [-.36,.36])platformBox(darkWood,[x,.56,z],[.11,1.18,.11],shelf);
    for(const y of [.16,1.04])platformBox(woodMat,[0,y,0],[2.5,.12,.92],shelf);
    const glass=standard('#b5ad7d',{transparent:true,opacity:.55,roughness:.2}),jarLid=standard('#403e2d');
    for(let i=0;i<3;i++){const x=-.70+i*.5;platformMesh(cylinder,glass,[x,1.32,0],[.16,.42,.16],shelf);platformMesh(cylinder,jarLid,[x,1.55,0],[.18,.05,.18],shelf);platformMesh(cylinder,standard(i%2?'#9c7745':'#a6883f'),[x,1.25,0],[.13,.24,.13],shelf);}
    const thermos=standard('#7b9180',{metalness:.55,roughness:.3});platformMesh(cylinder,thermos,[.88,1.43,.04],[.15,.64,.15],shelf);platformMesh(cylinder,metal,[.88,1.77,.04],[.16,.07,.16],shelf);
    platformBox(tackle,[-.3,.43,.02],[1.14,.4,.65],shelf);
    const lantern=new THREE.Group();lantern.name='amazon-lantern';lantern.position.set(-17.8,1.18,25.3);platformRoot.add(lantern);
    platformMesh(cylinder,metal,[0,.06,0],[.15,.10,.15],lantern);platformMesh(cylinder,glass,[0,.24,0],[.11,.30,.11],lantern);platformMesh(cylinder,metal,[0,.44,0],[.16,.08,.16],lantern);
    platformMesh(cylinder,standard('#ffe8a6',{emissive:'#ffc45d',emissiveIntensity:1}),[0,.22,0],[.035,.18,.035],lantern);
    const bucketMat=standard('#737958'),bucket=platformMesh(new THREE.CylinderGeometry(.28,.23,.49,20,1,true),bucketMat,[-14.9,.81,23.8]);bucket.material.side=THREE.DoubleSide;
    const bucketRim=platformMesh(new THREE.TorusGeometry(.28,.018,6,22),metal,[-14.9,1.06,23.8]);bucketRim.rotation.x=Math.PI/2;
    const bucketFill=platformMesh(new THREE.CircleGeometry(.24,22),standard('#2a3724',{roughness:.18}),[-14.9,.87,23.8]);bucketFill.rotation.x=-Math.PI/2;
    const handle=platformMesh(new THREE.TorusGeometry(.30,.009,6,20,Math.PI),metal,[-14.9,1.07,23.8]);handle.rotation.y=Math.PI/2;
    // Landing net: a real hoop and sagging line mesh rather than a solid black disk.
    const net=new THREE.Group();net.name='amazon-landing-net';net.position.set(-10.6,1.17,23.5);net.rotation.set(.18,0,.13);platformRoot.add(net);
    const hoop=platformMesh(new THREE.TorusGeometry(.43,.016,7,40),metal,null,null,net);hoop.rotation.x=Math.PI/2;
    const strings=[];for(let k=0;k<20;k++){const a=k*Math.PI/10;for(let j=0;j<5;j++){const r1=.43*(1-j/5),r2=.43*(1-(j+1)/5);strings.push(Math.cos(a)*r1,-.45*(j/5),Math.sin(a)*r1,Math.cos(a)*r2,-.45*((j+1)/5),Math.sin(a)*r2);}}
    for(let j=1;j<5;j++)for(let k=0;k<40;k++){const a=k*Math.PI/20,b=(k+1)*Math.PI/20,r=.43*(1-j/5);strings.push(Math.cos(a)*r,-.45*j/5,Math.sin(a)*r,Math.cos(b)*r,-.45*j/5,Math.sin(b)*r);}
    const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(strings,3));net.add(new THREE.LineSegments(ng,new THREE.LineBasicMaterial({color:'#222b20',transparent:true,opacity:.8})));
    const netHandle=platformMesh(cylinder,woodMat,[-.9,0,0],[.025,1.0,.025],net);netHandle.rotation.z=Math.PI/2;
    // Same blue gradient and seeded white cloud banks as the first lake.
    // Sky randomness is independent of the bank and vegetation layout.
    let skySeed=17329;
    const skyRange=(a,b)=>{skySeed=(1664525*skySeed+1013904223)>>>0;return a+(b-a)*skySeed/4294967296;};
    const sky=mesh(new THREE.SphereGeometry(300,24,14),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.56,.79,.94),vec3(.012,.20,.75),smoothstep(0.,.35,h));float glow=pow(max(dot(d,normalize(vec3(-38.,62.,24.))),0.),32.);c+=vec3(.18,.13,.035)*glow;gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`}));sky.castShadow=false;sky.receiveShadow=false;sky.frustumCulled=false;
    const cloudPool=pool(new THREE.SphereGeometry(1,10,7),new THREE.ShaderMaterial({vertexShader:'varying vec3 cloudNormal;void main(){cloudNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 cloudNormal;void main(){float light=smoothstep(-.7,.65,normalize(cloudNormal).y-normalize(cloudNormal).x*.2);gl_FragColor=vec4(mix(vec3(.63,.77,.91),vec3(1.),light),1.);
      #include <colorspace_fragment>
    }`}),false);
    for(let i=0;i<14;i++){const a=skyRange(0,Math.PI*2),r=skyRange(105,170),x=Math.cos(a)*r,z=-15+Math.sin(a)*r,y=skyRange(34,56),s=skyRange(2.8,5.5);for(let j=0;j<7;j++)cloudPool.add([x+(j-3)*s*.95,y+Math.sin(j*.9)*s*.5,z+skyRange(-2,2)],[s*skyRange(.85,1.5),s*skyRange(.65,1.1),s*.8],null,'#ffffff');}

    // River water reflects the actual current scene. Reflection resolution/frequency are bounded.
    const reflectionTarget=new THREE.WebGLRenderTarget(...config.quality.fine.reflection,{depthBuffer:true});targets.push(reflectionTarget);
    const reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4(),lookDirection=new THREE.Vector3(),lookTarget=new THREE.Vector3();
    const uniforms={time:{value:0},mirrorMap:{value:reflectionTarget.texture},mirrorMatrix:{value:reflectionMatrix},sunDir:{value:sun.position.clone().normalize()}};
    const waterGeo=new THREE.BufferGeometry(),wp=[],wi=[];
    for(let j=0;j<=waterSegments;j++){const z=config.water.minZ+(waterEnd-config.water.minZ)*j/waterSegments;wp.push(riverBank(z,-1,config.water),0,z,riverBank(z,1,config.water),0,z);if(j){const n=j*2;wi.push(n,n+1,n-2,n+1,n-1,n-2);}}
    waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();
    const water=mesh(waterGeo,new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,
      vertexShader:'varying vec3 vWorld;varying vec4 vMirror;uniform mat4 mirrorMatrix;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vMirror=mirrorMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader:`uniform float time;uniform sampler2D mirrorMap;uniform vec3 sunDir;varying vec3 vWorld;varying vec4 vMirror;
      void main(){vec2 p=vWorld.xz;float t=time;vec3 eye=normalize(cameraPosition-vWorld);vec3 n=normalize(vec3((sin(p.x*5.2+p.y*.9+t*.52)+.32*cos(p.y*13.-t))* .010,1.,cos(p.y*8.-p.x*.5-t*.38)*.009));float f=.14+.68*pow(1.-max(dot(eye,n),0.),2.8);vec2 uv=vMirror.xy/vMirror.w*.5+.5+n.xz*.17;vec3 reflection=texture2D(mirrorMap,clamp(uv,.002,.998)).rgb*.5+texture2D(mirrorMap,clamp(uv+vec2(.0015,.001),.002,.998)).rgb*.25+texture2D(mirrorMap,clamp(uv-vec2(.0015,.001),.002,.998)).rgb*.25;vec3 c=mix(vec3(.047,.028,.009),reflection*vec3(.81,.83,.56),f);float fleck=pow(max(dot(reflect(-sunDir,n),eye),0.),180.);c+=vec3(.84,.68,.30)*fleck*.65;float thread=pow(max(0.,sin(p.y*17.+sin(p.x*2.)*.7-t*.52)),35.);c+=vec3(.025,.023,.009)*thread;float haze=smoothstep(45.,160.,distance(cameraPosition,vWorld));c=mix(c,vec3(.24,.30,.17),haze*.6);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`}),[0,config.water.level,0]);water.castShadow=water.receiveShadow=false;
    const pads=pool(new THREE.CircleGeometry(1,14,.1,Math.PI*1.88),standard('#ffffff',{side:THREE.DoubleSide,roughness:.55}),false);
    for(let i=0;i<630;i++){const z=range(-130,42),side=i%2?1:-1,x=riverBank(z,side,config.water)-side*range(.12,2.7),s=range(.08,.25);pads.add([x,.018,z],[s,s,1],[-Math.PI/2,0,range(0,7)],foliage[i%6]);}
    // Sparse far-shore trees join the existing instance batches; no extra water pass/target.
    if(config.water.basin){
      for(const side of [-1,1])for(let z=60;z<waterEnd;z+=20)tree(riverBank(z,side,config.water)+side*range(2,6),z,range(9,15),range(.4,.65),true);
      // A low far bank closes the basin beyond the fog, rather than exposing another cut edge.
      const pos=[],uv=[],tints=[],indices=[],strips=[0,.45,2,8,30],steps=24;
      for(let j=0;j<strips.length;j++)for(let i=0;i<=steps;i++){
        const x=THREE.MathUtils.lerp(riverBank(waterEnd,-1,config.water),riverBank(waterEnd,1,config.water),i/steps),z=waterEnd+strips[j];
        pos.push(x,j===0?-.13:j===1?.14:.45,z);uv.push(x/4,z/4);color.set(j<2?'#c0b18a':'#6f8057');tints.push(color.r,color.g,color.b);
        if(i&&j){const n=j*(steps+1)+i;indices.push(n,n-steps-1,n-1,n-1,n-steps-1,n-steps-2);}
      }
      const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));cap.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));cap.setIndex(indices);cap.computeVertexNormals();mesh(cap,soil);
      for(let i=0;i<12;i++)tree(THREE.MathUtils.lerp(config.water.basin.leftX,config.water.basin.rightX,(i+.5)/12),waterEnd+3,range(10,15),.5,true);
    }
    pools.forEach(p=>p.finish());
    const resources=createResourceScope(root,{targets,shared:sharedResources});
    return {
      update(elapsed){if(resources.disposed)return;wind.value=elapsed;uniforms.time.value=elapsed;},
      setQuality(fine){if(!resources.disposed)reflectionTarget.setSize(...config.quality[fine?'fine':'fast'].reflection);},
      renderReflection({frame,fine,force=false,before=()=>{},after=()=>{}}){
        if(resources.disposed||(!force&&frame%config.quality[fine?'fine':'fast'].reflectionEvery!==0))return;
        reflectionCamera.copy(camera,false);reflectionCamera.position.y=2*config.water.level-camera.position.y;camera.getWorldDirection(lookDirection);lookTarget.copy(camera.position).add(lookDirection);lookTarget.y=2*config.water.level-lookTarget.y;reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(lookTarget);reflectionCamera.updateMatrixWorld();reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
        const target=renderer.getRenderTarget(),visible=water.visible;
        try{water.visible=false;before();renderer.setRenderTarget(reflectionTarget);renderer.render(parent,reflectionCamera);}
        finally{renderer.setRenderTarget(target);water.visible=visible;after();}
      },
      getDiagnostics:()=>({disposed:resources.disposed,treeCount:treeRecords.length,chairs:[],objects:root.children.length,reflectionSize:[reflectionTarget.width,reflectionTarget.height],platformShift,platformBounds:{...config.water.platform},riverWidthAtSpawn:2*riverHalfWidth(config.spawn.position[2],config.water),basin:config.water.basin?{...config.water.basin,width:config.water.basin.rightX-config.water.basin.leftX}:null,waterMeshCount:1,reflectionTargetCount:targets.length,waterSegments,waterEnd,landmarks:['wood-platform','tackle-seat','wood-shelf','lantern','landing-net','buttress-roots','hanging-vines',...(config.water.basin?['right-water-basin']:[])]}),
      dispose(){if(resources.disposed)return;resources.dispose();if(parent.background===background)parent.background=previous.background;if(parent.fog===fog)parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;}
    };
  }catch(error){createResourceScope(root,{targets,shared:sharedResources}).dispose();parent.background=previous.background;parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;throw error;}
}
