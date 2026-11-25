import * as THREE from './vendor/three.module.js';
import {SAC_ACTUN,cenoteShorePoint} from './maps/sac-actun.js';
import {createResourceScope} from './scene-resources.js';

// Modeled from the user's cenote composition; no image backdrop or remote assets.
export function createMap(parent,camera,renderer,config=SAC_ACTUN,{sharedResources=new Set()}={}){
 const root=new THREE.Group();root.name='map-'+config.id;parent.add(root);
 const previous={background:parent.background,fog:parent.fog,exposure:renderer.toneMappingExposure,auto:renderer.shadowMap.autoUpdate,dirty:renderer.shadowMap.needsUpdate},targets=[];
 try{
  let seed=841127;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},range=(a,b)=>a+rand()*(b-a),Y=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D(),tint=new THREE.Color(),time={value:0};
  const background=new THREE.Color(config.environment.background),fog=new THREE.Fog(config.environment.fog.color,config.environment.fog.near,config.environment.fog.far);
  parent.background=background;parent.fog=fog;renderer.toneMappingExposure=config.environment.exposure;
  const hemi=new THREE.HemisphereLight('#e1eddb','#294e50',2.3),fill=new THREE.AmbientLight('#c0d4c9',1.4),sun=new THREE.DirectionalLight('#fff1c8',4.1);
  sun.position.set(12,45,-14);sun.target.position.set(3,0,-25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-50,right:50,top:65,bottom:-65,near:1,far:115});sun.shadow.bias=-.0003;sun.shadow.normalBias=.05;root.add(hemi,fill,sun,sun.target);
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  const skylightBounce=new THREE.PointLight('#ffe4a9',350,52,2);skylightBounce.position.set(7,14,-20);root.add(skylightBounce);
  function texture(paint,w=512,h=512,repeat=[1,1]){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}
  function noise(x,y){const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j;const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};const a=u*u*(3-2*u),b=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(i,j),hash(i+1,j),a),THREE.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),a),b);}
  const limestone=texture((c,w,h)=>{
   const img=c.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let f=0,a=.5;for(let k=0;k<5;k++){const s=2**k;f+=noise(x*s/40,y*s/32)*a;a*=.5;}const seam=Math.pow(Math.max(0,Math.sin(y*.095+noise(x/75,y/60)*5)),15),grain=range(-9,9),v=75+f*124-seam*55+grain,i=(y*w+x)*4;img.data[i]=v*1.02;img.data[i+1]=v*1.025;img.data[i+2]=v*.99;img.data[i+3]=255;}c.putImageData(img,0,0);
   for(let i=0;i<170;i++){c.strokeStyle=i%3?'#182d2555':'#e6dab333';c.lineWidth=range(.5,2);const y=range(0,h);c.beginPath();c.moveTo(0,y);for(let x=0;x<=w;x+=10)c.lineTo(x,y+noise(x/40,i)*12);c.stroke();}
  },512,512,[4,3]);
  const bark=texture((c,w,h)=>{c.fillStyle='#716b50';c.fillRect(0,0,w,h);for(let i=0;i<2200;i++){const x=range(0,w),y=range(0,h);c.fillStyle=i%3?'#232f2144':'#d0bb8055';c.fillRect(x,y,range(.7,3),range(2,35));}for(let i=0;i<240;i++){const x=range(0,w);c.strokeStyle=i%2?'#b2a47d66':'#282e2366';c.lineWidth=range(.5,2);c.beginPath();c.moveTo(x,0);for(let y=0;y<=h;y+=10)c.lineTo(x+Math.sin(y*.025+i)*3,y);c.stroke();}},256,512,[2,5]);
  const foliage=texture((c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#234d20');g.addColorStop(.5,'#9cbf44');g.addColorStop(1,'#3f6f24');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#d9e79899';c.lineWidth=2;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();for(let y=10;y<h;y+=15)for(const d of [-1,1]){c.strokeStyle='#cee68a55';c.beginPath();c.moveTo(w/2,y);c.lineTo(w/2+d*w/2,y-16);c.stroke();}},128,256);
  const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.88,...extra});
  const stone=standard('#cbd3ce',{map:limestone,bumpMap:limestone,bumpScale:.28,side:THREE.DoubleSide,vertexColors:true});
  const rockMat=standard('#bac5b2',{map:limestone,bumpMap:limestone,bumpScale:.15}),barkMat=standard('#b2a17d',{map:bark,bumpMap:bark,bumpScale:.12}),mossMat=standard('#435c2e',{map:limestone,bumpMap:limestone,bumpScale:.06});
  function caustics(material){material.onBeforeCompile=s=>{s.uniforms.cenoteTime=time;s.vertexShader='varying vec3 cenoteWorld;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 cw=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    cw=instanceMatrix*cw;
   #endif
   cenoteWorld=(modelMatrix*cw).xyz;`);s.fragmentShader='uniform float cenoteTime;varying vec3 cenoteWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',`if(cenoteWorld.y<-.05){vec2 p=cenoteWorld.xz;float n=abs(sin(p.x*2.3+sin(p.y*1.8+cenoteTime*.19))+cos(p.y*2.1+sin(p.x*1.4-cenoteTime*.16)));float line=1.-smoothstep(.03,.18,n);gl_FragColor.rgb+=vec3(.08,.23,.19)*line*.12;}
   #include <dithering_fragment>`);};}
  caustics(rockMat);caustics(barkMat);
  function mesh(g,m,p=null,s=null){const o=new THREE.Mesh(g,m);if(p)o.position.set(...p);if(s)o.scale.set(...s);o.castShadow=o.receiveShadow=true;root.add(o);return o;}
  const pools=[];function pool(g,m,shadow=true){const entries=[];const p={add(pos,scale,rotation=null,color=null){entries.push({pos,scale,rotation,color});},finish(){if(!entries.length)return;const o=new THREE.InstancedMesh(g,m,entries.length);for(let i=0;i<entries.length;i++){const e=entries[i];dummy.position.set(...e.pos);dummy.scale.set(...e.scale);dummy.rotation.set(0,0,0);if(e.rotation?.isQuaternion)dummy.quaternion.copy(e.rotation);else if(e.rotation)dummy.rotation.set(...e.rotation);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(e.color)o.setColorAt(i,tint.set(e.color));}o.castShadow=shadow;o.receiveShadow=true;o.computeBoundingSphere();root.add(o);}};pools.push(p);return p;}
  const fractured=new THREE.IcosahedronGeometry(1,2),fracturedPos=fractured.attributes.position;for(let i=0;i<fracturedPos.count;i++){const x=fracturedPos.getX(i),y=fracturedPos.getY(i),z=fracturedPos.getZ(i),r=1+.16*Math.sin(x*13+z*7)*Math.cos(y*11-z*4)+.08*Math.sin(y*23+x*9);fracturedPos.setXYZ(i,x*r,y*r,z*r);}fractured.computeVertexNormals();
  const cylinder=new THREE.CylinderGeometry(1,1,1,10),rocks=pool(fractured,rockMat),moss=pool(new THREE.IcosahedronGeometry(1,1),mossMat,false),branches=pool(cylinder,barkMat),twigs=pool(new THREE.CylinderGeometry(1,1,1,6),barkMat,false);
  const beam=(p,a,b,r1,r2=r1)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);p.add(start.add(end).multiplyScalar(.5).toArray(),[r1,d.length(),r2],new THREE.Quaternion().setFromUnitVectors(Y,d.normalize()));};
  function surface(cols,rows,point){const pos=[],uv=[],colors=[],indices=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const p=point(i/cols,j/rows);pos.push(...p.position);uv.push(...p.uv);tint.set(p.color??'#ffffff');colors.push(tint.r,tint.g,tint.b);if(i&&j){const n=j*(cols+1)+i;indices.push(n,n-1,n-cols-1,n-1,n-cols-2,n-cols-1);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;}
  // Enclosing limestone walls with undulating ledges and shaded recesses.
  const wall=surface(192,26,(u,v)=>{const a=u*Math.PI*2,y=-5+v*35,p=cenoteShorePoint(a,1.08,config.water),inset=1+.035*Math.sin(a*17+y*.7)+.025*Math.cos(a*31-y*.9)+.04*Math.sin(y*.8);return {position:[p[0]*inset,y,config.water.center[1]+(p[2]-config.water.center[1])*inset],uv:[u*5,v*2],color:new THREE.Color('#ffffff').multiplyScalar(.78+.15*noise(u*43,v*15)+.06*Math.sin(y*.9+a*7)).getHex()};});mesh(wall,stone);
  const [ox,oy,oz]=config.landmarks.opening;
  const roof=surface(160,15,(u,v)=>{const a=u*Math.PI*2,p=cenoteShorePoint(a,1.08,config.water),inner=[ox+Math.cos(a)*18,oz+Math.sin(a)*22],w=v*v*(3-2*v);return {position:[THREE.MathUtils.lerp(inner[0],p[0],w),oy+Math.sin(a*7+v*11)*1.2-Math.sin(v*Math.PI)*4,THREE.MathUtils.lerp(inner[1],p[2],w)],uv:[u*5,v*2],color:new THREE.Color('#eee9cd').multiplyScalar(.75+noise(u*30,v*9)*.25).getHex()};});mesh(roof,stone);
  const bank=surface(192,7,(u,v)=>{const a=u*Math.PI*2,p=cenoteShorePoint(a,.995+v*.23,config.water);return {position:[p[0],v===0?-.14:.13+v*.7+noise(u*90,v*8)*.38,p[2]],uv:[u*15,v],color:v<.3?'#a6ac85':'#66734a'};});mesh(bank,stone);
  const floor=surface(100,38,(u,v)=>{const a=u*Math.PI*2,scale=.01+v*.99,p=cenoteShorePoint(a,scale,config.water),y=-5.6+Math.pow(v,3)*4.8+noise(p[0]*.2,p[2]*.2)*.6;return {position:[p[0],y,p[2]],uv:[p[0]/20,p[2]/20],color:'#7e9e80'};});const floorMat=standard('#4e9b8f',{map:limestone,bumpMap:limestone,bumpScale:.11,vertexColors:true});caustics(floorMat);mesh(floor,floorMat);
  // Jagged mineral pendants, with narrow wet tips and broad clustered roots.
  const stalactiteGeo=new THREE.CylinderGeometry(.04,1,1,11,5);const pp=stalactiteGeo.attributes.position;for(let i=0;i<pp.count;i++){const h=pp.getY(i)+.5,s=1+.15*Math.sin(i*2.39)+.09*Math.cos(i*.73);pp.setX(i,pp.getX(i)*s);pp.setZ(i,pp.getZ(i)*s);pp.setY(i,-pp.getY(i));}stalactiteGeo.computeVertexNormals();
  const stalactites=pool(stalactiteGeo,rockMat);
  for(let i=0;i<210;i++){const a=range(0,Math.PI*2),v=range(.05,.94),p=cenoteShorePoint(a,1.08,config.water),ix=ox+Math.cos(a)*18,iz=oz+Math.sin(a)*22,x=ix+(p[0]-ix)*v,z=iz+(p[2]-iz)*v,y=oy+Math.sin(a*7+v*11)*1.2-Math.sin(v*Math.PI)*4,len=range(1.2,6.5),r=range(.18,.65);stalactites.add([x,y-len*.5,z],[r,len,r],[range(-.1,.1),range(0,7),range(-.12,.12)],'#b9bc9b');}
  for(const [x,y,z,sx,sy,sz]of[[-21,17,-6,9,2.5,7],[-18,21,-17,8,2.8,7],[-31,13,7,8,2.4,8],[29,19,-7,8,2.5,8],[34,15,15,7,2.5,8],[-24,22,-30,8,2.3,7]]){
   rocks.add([x,y,z],[sx,sy,sz],[.12,range(-.5,.5),.08],'#c6c8b7');
   for(let k=0;k<5;k++){const len=range(2,5.5),px=x+range(-sx*.7,sx*.7),pz=z+range(-sz*.6,sz*.6);stalactites.add([px,y-sy-len*.4,pz],[range(.3,.65),len,range(.3,.65)],[range(-.08,.08),0,range(-.08,.08)],'#b9c2b4');}
  }
  // Shelves and rounded porous stones, at shore level and visible under clear water.
  for(let i=0;i<190;i++){const a=range(0,Math.PI*2),under=i%3!==0,p=cenoteShorePoint(a,under?range(.78,.98):range(1.01,1.08),config.water),s=range(.4,1.9),y=under?-s*.75-range(.65,1.8):range(-.1,.6);rocks.add([p[0],y,p[2]],[s*range(1,1.8),s*.45,s],[range(-.4,.4),range(0,7),range(-.4,.4)],under?'#6e9689':'#b5b59a');if(!under&&i%4===0)moss.add([p[0],y+s*.42,p[2]],[s*.9,.16,s*.85]);}
  // Eroded shelves break the walls into irregular limestone layers.
  for(let i=0;i<120;i++){const a=range(0,Math.PI*2),p=cenoteShorePoint(a,range(1.0,1.08),config.water),h=range(5,26);rocks.add([p[0],h,p[2]],[range(2,5.5),range(.7,2.2),range(2,4.5)],[range(-.15,.15),a,range(-.18,.18)],'#c3c1a8');}
  const ledgeShape=new THREE.Shape();config.water.ledge.forEach(([x,z],i)=>i?ledgeShape.lineTo(x,-z):ledgeShape.moveTo(x,-z));ledgeShape.closePath();const ledgeGeo=new THREE.ExtrudeGeometry(ledgeShape,{depth:1.0,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.3,bevelThickness:.15});ledgeGeo.rotateX(-Math.PI/2);ledgeGeo.translate(0,-.4,0);mesh(ledgeGeo,rockMat);
  // Huge central tree, with an interlaced buttress of roots at the waterline.
  const [tx,,tz]=config.landmarks.tree;
  const trunk=surface(28,22,(u,v)=>{const a=u*Math.PI*2,y=v*43,r=1.1+Math.pow(1-v,10)*2.8+.18*Math.sin(a*9+v*12),x=tx+Math.sin(v*3)*.7,z=tz+v*2;return {position:[x+Math.cos(a)*r,y-.45,z+Math.sin(a)*r],uv:[u,v*2],color:'#e0ceb0'};});mesh(trunk,new THREE.MeshStandardMaterial({color:'#b8a17b',map:bark,bumpMap:bark,bumpScale:.16,vertexColors:true,roughness:.9}));
  function rootCurve(points,r){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),g=new THREE.TubeGeometry(curve,24,r,8,false);mesh(g,barkMat);}
  for(let i=0;i<15;i++){const a=i*2.399,r=range(2.3,7);rocks.add([tx+Math.cos(a)*r,-.3,tz+Math.sin(a)*r],[range(1,2.5),.55,range(1,2.3)],[0,a,0],'#738675');}
  for(let i=0;i<29;i++){const a=i*2.399,len=range(5,10),height=range(6,16),ex=tx+Math.cos(a)*len,ez=tz+Math.sin(a)*len;rootCurve([[tx+Math.cos(a)*1.35,height,tz+Math.sin(a)*1.35],[tx+Math.cos(a)*2,height*.48,tz+Math.sin(a)*2],[tx+Math.cos(a)*3.1,1.4,tz+Math.sin(a)*3.1],[ex,.12,ez],[ex+Math.cos(a)*2,-.45,ez+Math.sin(a)*2]],range(.12,.37));}
  for(let i=0;i<17;i++){const a=i*2.399+.7,h=range(8,24),ex=tx+Math.cos(a+.5)*range(4,8),ez=tz+Math.sin(a+.5)*range(4,8);rootCurve([[tx+Math.cos(a)*1.4,h,tz+Math.sin(a)*1.4],[tx+Math.cos(a+.35)*range(2,4),h*.52,tz+Math.sin(a+.35)*range(2,4)],[ex,1.1,ez],[ex+Math.cos(a),-.25,ez+Math.sin(a)]],range(.08,.23));}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);beam(branches,[tx,range(22,35),tz],[tx+dx*range(8,15),range(34,42),tz+dz*range(8,15)],range(.25,.6),range(.25,.6));}
  const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.55,.25,-.45,.8,0,1);leafShape.bezierCurveTo(.45,.8,.55,.25,0,0);const leafGeo=new THREE.ShapeGeometry(leafShape,4),leafMat=standard('#ffffff',{map:foliage,side:THREE.DoubleSide,roughness:.72,emissive:'#304112',emissiveIntensity:.12}),leaves=pool(leafGeo,leafMat,false),colors=['#a4c34c','#8cae39','#719840','#bfd262','#637f36'];
  function leafCluster(x,y,z,count,size){for(let i=0;i<count;i++){const a=range(0,7),r=range(0,2.4),s=size*range(.65,1.3);leaves.add([x+Math.cos(a)*r,y+range(-1,1),z+Math.sin(a)*r],[s*.75,s,1],[range(.5,2.2),a,range(-.6,.6)],colors[i%colors.length]);}}
  for(let i=0;i<75;i++){const a=range(0,7),r=range(7,21);leafCluster(ox+Math.cos(a)*r,range(28,36),oz+Math.sin(a)*r,22,range(.7,1.4));}
  // Hanging roots and vine curtains around the skylight, with occasional leaves.
  for(let i=0;i<38;i++){const a=range(0,7),r=range(16,21),x=ox+Math.cos(a)*r,z=oz+Math.sin(a)*r,top=range(26,30),bottom=range(.3,16);let from=[x,top,z];for(let y=top-2;y>bottom;y-=2){const to=[x+Math.sin(y*.27+i)*.24,y,z+Math.cos(y*.35+i)*.2];beam(twigs,from,to,range(.018,.055));from=to;if(i%5===0&&y>5)leaves.add(to,[.4,.75,1],[range(.4,1.7),a,0],colors[i%5]);}}
  // Ferns and broad leaves frame the left rock shelf and the opening.
  for(let i=0;i<120;i++){const a=range(0,7),p=cenoteShorePoint(a,range(1,1.09),config.water);for(let k=0;k<5;k++)leaves.add([p[0],range(.3,1),p[2]],[range(.3,.7),range(.8,1.9),1],[range(.4,1.45),k*1.25+a,range(-.2,.2)],colors[(k+i)%5]);}
  for(const log of config.landmarks.submergedLogs){beam(branches,log.from,log.to,log.radius);const a=new THREE.Vector3(...log.from),b=new THREE.Vector3(...log.to);for(let k=1;k<6;k++){const p=a.clone().lerp(b,k/6);beam(branches,p.toArray(),[p.x+(k%2?2:-2.3),p.y+.5,p.z-1.9],log.radius*.23);}}
  // Equipment on the left rock ledge: cases, brass lantern and rod stand.
  const metal=standard('#343e38',{metalness:.65,roughness:.35}),brass=standard('#b29750',{metalness:.65,roughness:.35}),cube=new THREE.BoxGeometry(1,1,1);
  for(const [x,z,w,h,d,c]of[[-25.4,16.6,2.1,.95,1.2,'#313c32'],[-24.7,18.7,1.8,.65,1.15,'#8d8c58']]){mesh(cube,standard(c),[x,h*.5+.35,z],[w,h,d]);mesh(cube,metal,[x,h+.38,z],[w+.05,.1,d+.05]);for(const dx of [-.55,.55])mesh(cube,brass,[x+dx,h*.6+.35,z+d*.5],[.1,.25,.06]);}
  const light=new THREE.PointLight('#ffc86e',18,9,2);light.position.set(-25.4,2,16.6);root.add(light);mesh(new THREE.CylinderGeometry(.25,.31,.1,12),brass,[-25.4,1.42,16.6]);mesh(new THREE.CylinderGeometry(.22,.25,.5,12),standard('#ffd58b',{emissive:'#ffb137',emissiveIntensity:2.4}),[-25.4,1.7,16.6]);mesh(new THREE.ConeGeometry(.33,.18,12),brass,[-25.4,2.05,16.6]);for(const dx of [-.27,.27])mesh(cylinder,brass,[-25.4+dx,1.72,16.6],[.02,.65,.02]);const handle=mesh(new THREE.TorusGeometry(.22,.022,6,18),brass,[-25.4,2.24,16.6]);
  beam(twigs,[-28.5,.2,17.5],[-28.5,1.3,17.5],.04);
  // Sunbeams are soft, bounded ribbons; no screen-sized volumetric pass.
  const rayMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color('#ffe4ac')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 color;varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159),2.)*pow(sin(vUv.y*3.14159),.8)*.11;gl_FragColor=vec4(color,a);}' });
  const rays=[];for(let i=0;i<6;i++){const x=ox+range(-8,8),z=oz+range(-7,7),m=mesh(new THREE.PlaneGeometry(1,1),rayMat,[x,16,z],[range(1.5,4.5),29,1]);m.castShadow=m.receiveShadow=false;m.renderOrder=3;rays.push(m);}
  const hazeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{},vertexShader:'varying vec2 uv2d;void main(){uv2d=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uv2d;void main(){vec2 p=uv2d*2.-1.;float a=exp(-p.x*p.x*3.-p.y*p.y*9.)*.085;gl_FragColor=vec4(.32,.54,.58,a);}' });
  const haze=[];for(const z of [-16,-30,-43]){const m=mesh(new THREE.PlaneGeometry(78,3.1),hazeMat,[0,1.2,z]);m.castShadow=m.receiveShadow=false;m.renderOrder=2;haze.push(m);}
  // One transparent water surface shows actual bed stones and submerged wood.
  const target=new THREE.WebGLRenderTarget(...config.quality.fine.reflection,{depthBuffer:true});targets.push(target);
  const reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4(),direction=new THREE.Vector3(),look=new THREE.Vector3(),plane=new THREE.Plane(),clip=new THREE.Vector4(),q=new THREE.Vector4();
  const uniforms={time,mirrorMap:{value:target.texture},mirrorMatrix:{value:reflectionMatrix},sunDir:{value:sun.position.clone().normalize()}};
  const wg=surface(192,1,(u,v)=>{const p=cenoteShorePoint(u*Math.PI*2,v===0?.001:1,config.water);return {position:[p[0],config.water.level,p[2]],uv:[u,v]};});
  const water=mesh(wg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
   vertexShader:'varying vec3 vWorld;varying vec4 vMirror;uniform mat4 mirrorMatrix;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vMirror=mirrorMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}',
   fragmentShader:`uniform float time;uniform sampler2D mirrorMap;uniform vec3 sunDir;varying vec3 vWorld;varying vec4 vMirror;
   void main(){vec2 p=vWorld.xz;vec3 eye=normalize(cameraPosition-vWorld);vec3 n=normalize(vec3(sin(p.x*3.1+p.y*.7+time*.38)*.008+cos(p.y*9.-time*.5)*.012,1.,cos(p.y*4.1-p.x*.8-time*.32)*.007));float f=.11+.74*pow(1.-max(dot(eye,n),0.),3.);vec2 uv=vMirror.xy/vMirror.w*.5+.5+n.xz*.55;vec3 refl=texture2D(mirrorMap,clamp(uv,.001,.999)).rgb;vec3 c=mix(vec3(.012,.16,.18),refl*vec3(.86,.96,.90),f);float glow=exp(-length((p-vec2(4.,-24.))*vec2(.09,.07)));c+=vec3(.005,.17,.16)*glow;float sun=pow(max(dot(reflect(-sunDir,n),eye),0.),220.);c+=vec3(.8,.68,.35)*sun;gl_FragColor=vec4(c,.36+f*.48);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }` }));water.castShadow=water.receiveShadow=false;water.renderOrder=1;
  pools.forEach(p=>p.finish());
  const resources=createResourceScope(root,{targets,shared:sharedResources});
  return {
   update(t){if(resources.disposed)return;time.value=t;for(const m of rays)m.rotation.y=Math.atan2(camera.position.x-m.position.x,camera.position.z-m.position.z);for(const m of haze)m.rotation.y=Math.atan2(camera.position.x-m.position.x,camera.position.z-m.position.z);},
   setQuality(fine){if(!resources.disposed)target.setSize(...config.quality[fine?'fine':'fast'].reflection);},
   renderReflection({frame,fine,force=false,before=()=>{},after=()=>{}}){
    if(resources.disposed||(!force&&frame%config.quality[fine?'fine':'fast'].reflectionEvery!==0))return;
    reflectionCamera.copy(camera,false);reflectionCamera.position.y=2*config.water.level-camera.position.y;camera.getWorldDirection(direction);look.copy(camera.position).add(direction);look.y=2*config.water.level-look.y;reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(look);reflectionCamera.updateMatrixWorld();
    plane.set(new THREE.Vector3(0,1,0),-config.water.level).applyMatrix4(reflectionCamera.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);const e=reflectionCamera.projectionMatrix.elements;q.set((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);clip.multiplyScalar(2/clip.dot(q));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1;e[14]=clip.w;reflectionCamera.projectionMatrixInverse.copy(reflectionCamera.projectionMatrix).invert();reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
    const old=renderer.getRenderTarget(),visible=[water.visible,...rays.map(m=>m.visible),...haze.map(m=>m.visible)];
    try{water.visible=false;rays.forEach(m=>m.visible=false);haze.forEach(m=>m.visible=false);before();renderer.setRenderTarget(target);renderer.render(parent,reflectionCamera);}
    finally{renderer.setRenderTarget(old);water.visible=visible[0];rays.forEach((m,i)=>m.visible=visible[i+1]);haze.forEach((m,i)=>m.visible=visible[1+rays.length+i]);after();}
   },
   getDiagnostics:()=>({disposed:resources.disposed,objects:root.children.length,treeCount:1,chairs:[],reflectionSize:[target.width,target.height],waterMeshCount:1,reflectionTargetCount:1,decorationColliders:0,underwaterLogs:config.landmarks.submergedLogs.length,stalactites:240,lightShafts:rays.length,landmarks:['limestone-cave','stalactites','central-root-tree','skylight','clear-turquoise-water','submerged-wood','left-rock-bank','lantern','tackle-cases']}),
   dispose(){if(resources.disposed)return;resources.dispose();if(parent.background===background)parent.background=previous.background;if(parent.fog===fog)parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;}
  };
 }catch(error){createResourceScope(root,{targets,shared:sharedResources}).dispose();parent.background=previous.background;parent.fog=previous.fog;renderer.toneMappingExposure=previous.exposure;renderer.shadowMap.autoUpdate=previous.auto;renderer.shadowMap.needsUpdate=previous.dirty;throw error;}
}
