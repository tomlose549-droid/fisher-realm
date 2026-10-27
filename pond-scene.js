import * as THREE from './vendor/three.module.js';

// A meter-based, fully navigable 3D scene; the reference image is not a backdrop.
export function createPond(scene, camera, renderer) {
  const cameraOrigin = new THREE.Vector3(0, 1.78, 32);
  camera.position.copy(cameraOrigin);
  scene.background = new THREE.Color('#49a4ef');
  scene.fog = new THREE.Fog('#9dc6b3', 82, 225);
  renderer.toneMappingExposure = 1.0;
  const hemi = new THREE.HemisphereLight('#c4e5ff', '#9b9259', 1.55);
  const sun = new THREE.DirectionalLight('#fff0c7', 2.8);
  sun.position.set(-38, 62, 24);sun.target.position.set(0,0,-9);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-49,right:49,top:49,bottom:-49,near:1,far:155});
  sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;
  scene.add(hemi,sun,sun.target);
  // The landscape is static. Bake its shadows once; animate water and foliage separately.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  let seed=17329;
  function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
  const range=(a,b)=>a+random()*(b-a),Y=new THREE.Vector3(0,1,0);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.91,...extra});
  const materials={bark:mat('#705338'),wood:mat('#9b7043'),darkWood:mat('#514135'),metal:mat('#293632',{metalness:.5,roughness:.45})};
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  function mesh(geometry,material,parent,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,material,p,s){return mesh(boxGeometry,material,parent,p,s);}
  function beam(parent,a,b,r1,r2,material,sides=8){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const m=mesh(new THREE.CylinderGeometry(r2,r1,d.length(),sides),material,parent);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y,d.normalize());return m;}
  const pools=[],dummy=new THREE.Object3D(),color=new THREE.Color();
  function pool(geometry,material,shadow=true){const entries=[];const p={entries,add(position,scale,rotation,tint){entries.push({position,scale,rotation,tint});},finish(){if(!entries.length)return;const inst=new THREE.InstancedMesh(geometry,material,entries.length);entries.forEach((e,i)=>{dummy.position.set(...e.position);dummy.scale.set(...e.scale);dummy.quaternion.identity();if(e.rotation?.isQuaternion)dummy.quaternion.copy(e.rotation);else if(e.rotation)dummy.rotation.set(...e.rotation);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);if(e.tint)inst.setColorAt(i,color.set(e.tint));});inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();scene.add(inst);}};pools.push(p);return p;}
  function pooledBeam(p,a,b,r1,r2){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);p.add(start.clone().add(end).multiplyScalar(.5).toArray(),[r1,d.length(),r2],new THREE.Quaternion().setFromUnitVectors(Y,d.normalize()),'#77583b');}

  // Saturated summer sky and rounded white cloud banks.
  const sky=mesh(new THREE.SphereGeometry(300,24,14),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(.56,.79,.94),vec3(.012,.20,.75),smoothstep(0.,.35,h));float glow=pow(max(dot(d,normalize(vec3(-38.,62.,24.))),0.),32.);c+=vec3(.18,.13,.035)*glow;gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
  }`}),scene);sky.castShadow=false;sky.receiveShadow=false;sky.frustumCulled=false;
  const cloudPool=pool(new THREE.SphereGeometry(1,10,7),new THREE.ShaderMaterial({vertexShader:'varying vec3 cloudNormal;void main(){cloudNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 cloudNormal;void main(){float light=smoothstep(-.7,.65,normalize(cloudNormal).y-normalize(cloudNormal).x*.2);gl_FragColor=vec4(mix(vec3(.63,.77,.91),vec3(1.),light),1.);
    #include <colorspace_fragment>
  }`}),false);
  for(let i=0;i<14;i++){const a=range(0,Math.PI*2),r=range(105,170),x=Math.cos(a)*r,z=-15+Math.sin(a)*r,y=range(34,56),s=range(2.8,5.5);for(let j=0;j<7;j++)cloudPool.add([x+(j-3)*s*.95,y+Math.sin(j*.9)*s*.5,z+range(-2,2)],[s*range(.85,1.5),s*range(.65,1.1),s*.8],null,'#ffffff');}

  function coast(a,f=1){const wobble=1+.026*Math.sin(a*5+.5)+.015*Math.cos(a*7);return new THREE.Vector3(Math.cos(a)*34*wobble*f,0,-14+Math.sin(a)*41*wobble*f);}
  function groundY(x,z){return .47+Math.max(0,Math.hypot(x/34,(z+14)/41)-1.12)*1.1;}
  // A continuous sandy edge, grassy ground and gently wooded hills.
  const terrain=new THREE.BufferGeometry(),verts=[],colors=[],indices=[],layers=[1,1.018,1.045,1.10,1.2,1.5,2.1,4];
  for(let l=0;l<layers.length;l++)for(let i=0;i<=192;i++){
    const a=i/192*Math.PI*2,p=coast(a,layers[l]);
    p.y=l===0?-.16:l===1?.12:l===2?.32:groundY(p.x,p.z)+(l>3?Math.sin(a*5)*.3*(l-3):0);
    verts.push(p.x,p.y,p.z);color.set(l<3?'#c8b78b':'#6f983e').multiplyScalar(range(.91,1.08));colors.push(color.r,color.g,color.b);
    if(l&&i){const n=l*193+i;indices.push(n,n-1,n-193,n-1,n-194,n-193);}
  }
  terrain.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(indices);terrain.computeVertexNormals();
  const land=mesh(terrain,mat('#ffffff',{vertexColors:true}),scene);land.castShadow=false;
  const hills=pool(new THREE.SphereGeometry(1,14,9),mat('#557e4d'),false);
  for(let i=0;i<15;i++)hills.add([-115+i*16,range(0,3),range(-115,-88)],[range(18,26),range(10,18),range(15,24)],null,['#5a8554','#638d59','#527c54'][i%3]);
  // Fishing clearings follow the bank. Gravel, grass and stones soften their edges.
  const sandCanvas=document.createElement('canvas');sandCanvas.width=sandCanvas.height=512;const sandCtx=sandCanvas.getContext('2d');sandCtx.fillStyle='#bda876';sandCtx.fillRect(0,0,512,512);
  for(let i=0;i<12500;i++){sandCtx.fillStyle=['#b29c68','#d7c38f','#a38d61','#c9b583'][i%4];const r=range(.4,1.6);sandCtx.beginPath();sandCtx.ellipse(random()*512,random()*512,r*1.5,r,random()*3,0,Math.PI*2);sandCtx.fill();}
  const sandTexture=new THREE.CanvasTexture(sandCanvas);sandTexture.colorSpace=THREE.SRGBColorSpace;sandTexture.wrapS=sandTexture.wrapT=THREE.RepeatWrapping;sandTexture.repeat.set(3,3);sandTexture.anisotropy=4;
  const edgeCanvas=document.createElement('canvas');edgeCanvas.width=edgeCanvas.height=128;const edgeCtx=edgeCanvas.getContext('2d'),edgeGradient=edgeCtx.createRadialGradient(64,64,23,64,64,64);edgeGradient.addColorStop(0,'white');edgeGradient.addColorStop(.55,'#dddddd');edgeGradient.addColorStop(1,'black');edgeCtx.fillStyle=edgeGradient;edgeCtx.fillRect(0,0,128,128);const edgeTexture=new THREE.CanvasTexture(edgeCanvas);
  const dirtMat=mat('#f4e0b3',{map:sandTexture,alphaMap:edgeTexture,transparent:true,depthWrite:false});
  for(const [x,z,sx,sz] of [[0,34.5,3.8,4],[-9.6,31.2,2.6,2.8],[9.6,31.2,2.6,2.8]]){
    const patch=mesh(new THREE.CircleGeometry(1,23),dirtMat,scene,[x,.49,z],[sx,sz,1]);patch.rotation.x=-Math.PI/2;
  }
  const rockPool=pool(new THREE.IcosahedronGeometry(1,1),mat('#ffffff',{flatShading:true}));
  const rockColors=['#c4bea3','#b3b4a0','#d4c7a3','#989f88'];
  for(let i=0;i<320;i++){const a=range(0,Math.PI*2),p=coast(a,range(1.006,1.035)),r=range(.20,.68)*(p.z>22&&Math.abs(p.x)<15?.55:1);rockPool.add([p.x,r*.28+.08,p.z],[r*range(1.1,1.8),r*.7,r], [range(-.3,.3),range(0,6.28),range(-.3,.3)],rockColors[i%4]);}
  for(let i=0;i<390;i++){const x=range(-17,17),z=range(27,38);if(Math.hypot(x/34,(z+14)/41)<1.025)continue;const r=range(.025,.11);rockPool.add([x,.51,z],[r*1.4,r*.6,r],null,rockColors[i%4]);}

  // Broadleaf crowns are instanced clusters plus thousands of individual leaf silhouettes.
  const trunkPool=pool(new THREE.CylinderGeometry(.7,1,1,8),mat('#76583d'));
  const crownPool=pool(new THREE.IcosahedronGeometry(1,1),mat('#ffffff'));
  const leafShape=new THREE.Shape();leafShape.moveTo(0,-.5);leafShape.quadraticCurveTo(.45,-.1,0,.5);leafShape.quadraticCurveTo(-.45,-.1,0,-.5);
  const leafMat=mat('#ffffff',{side:THREE.DoubleSide});
  const leafPool=pool(new THREE.ShapeGeometry(leafShape,3),leafMat,false);
  const leafColors=['#578c22','#679b28','#79a72d','#86ae32','#4b7e23','#9bbd3c'];
  const treeRecords=[];
  function tree(x,z,s=1){const y=groundY(x,z),h=range(5.4,7.5)*s,r=range(2.6,3.6)*s;treeRecords.push({x,z,r});
    pooledBeam(trunkPool,[x,y,z],[x+.18*s,y+h*.78,z+.1*s],.19*s,.19*s);
    for(let j=0;j<6;j++){const a=j/6*Math.PI*2+range(-.4,.4),bx=x+Math.cos(a)*r*.73,bz=z+Math.sin(a)*r*.73,by=y+h*range(.65,.88);pooledBeam(trunkPool,[x,y+h*.40,z],[bx,by,bz],.10*s,.10*s);}
    for(let j=0;j<29;j++){const a=range(0,Math.PI*2),rad=r*Math.sqrt(random())*.9,px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad,py=y+h*.85+(1-rad/r)*s*.9+range(-1.3,1.2)*s;
      const near=Math.hypot(x,z-32)<30,leafCount=near?44:14;const size=range(.8,1.2)*s;crownPool.add([px,py,pz],[size*(near?.58:.8),size*(near?.58:.8),size*(near?.58:.8)],[range(-.6,.6),range(0,6),0],leafColors[(j+Math.floor(random()*3))%6]);
      for(let k=0;k<leafCount;k++){const la=range(0,Math.PI*2),lr=size*range(.65,1.28);leafPool.add([px+Math.cos(la)*lr,py+range(-.7,.9)*size,pz+Math.sin(la)*lr],[range(.29,.48)*s,range(.38,.62)*s,1],[range(-1.2,1.2),range(0,6.28),range(-2,2)],leafColors[(j+k)%6]);}
    }
  }
  for(let i=0;i<90;i++){const a=i/90*Math.PI*2+range(-.022,.022),p=coast(a,range(1.09,1.32));if(p.z>22&&Math.abs(p.x)<19)continue;tree(p.x,p.z,range(.85,1.4));}
  for(let i=0;i<55;i++){const a=range(0,Math.PI*2),p=coast(a,range(1.4,1.85));tree(p.x,p.z,range(.85,1.3));}
  tree(-7,28,1.5);tree(7.5,28,1.5);tree(-13,30,1.35);tree(14,31,1.4);tree(-7,38,1.1);tree(9,40,1.2);
  const bushPool=pool(new THREE.IcosahedronGeometry(1,1),mat('#ffffff'));
  for(const t of treeRecords){for(let j=0;j<3;j++){const a=range(0,Math.PI*2),d=range(.8,2.6),x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d,r=range(.6,1.2);if(z>25&&Math.abs(x)<12)continue;bushPool.add([x,groundY(x,z)+r*.55,z],[r*1.4,r,r],[0,range(0,6),0],leafColors[j%6]);}}
  for(let i=0;i<230;i++){const a=range(0,Math.PI*2),p=coast(a,range(1.04,1.11)),s=range(.35,.85);if(p.z>24&&Math.abs(p.x)<15)continue;bushPool.add([p.x,.5+s*.5,p.z],[s*1.4,s,s],[0,range(0,6),0],leafColors[i%6]);}

  // Five curved blades per tuft; the entire bank is a handful of draw calls.
  function tuftGeometry(){const positions=[],idx=[];for(let k=0;k<5;k++){const a=k*2.399,w=.045,h=.38+k*.055,lean=.13+k*.017,base=positions.length/3;
    for(let j=0;j<4;j++){const t=j/3,cx=Math.cos(a)*lean*t*t,cz=Math.sin(a)*lean*t*t,half=w*(1-t)*.5;positions.push(cx-Math.sin(a)*half,h*t,cz+Math.cos(a)*half,cx+Math.sin(a)*half,h*t,cz-Math.cos(a)*half);if(j<3){const n=base+j*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}}
  }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(idx);g.computeVertexNormals();return g;}
  const grassMaterial=mat('#ffffff',{side:THREE.DoubleSide});
  const vegetationTime={value:0};grassMaterial.onBeforeCompile=shader=>{shader.uniforms.pondTime=vegetationTime;shader.vertexShader='uniform float pondTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x+=sin(pondTime*1.3+instanceMatrix[3].x*.7+instanceMatrix[3].z*.3)*position.y*position.y*.08;\n#endif');};
  const grassPool=pool(tuftGeometry(),grassMaterial,false),grassColors=['#759b25','#94b22e','#547f22','#a7bb3a','#66972b'];
  for(let i=0;i<6400;i++){const a=range(0,Math.PI*2),p=coast(a,range(1.026,1.20));const clearing=(p.z>30.5&&Math.abs(p.x)<3.5&&p.z<38)||(p.z>29.2&&Math.abs(Math.abs(p.x)-9.6)<2.4&&p.z<34);if(clearing&&random()>.04)continue;if(p.z>28.5&&Math.abs(p.x)<1.3)continue;grassPool.add([p.x,groundY(p.x,p.z),p.z],[range(.9,1.7),range(.7,1.65),range(.9,1.7)],[0,range(0,6),0],grassColors[i%5]);}
  for(let i=0;i<1300;i++){const x=range(-19,19),z=range(27,41);if(Math.hypot(x/34,(z+14)/41)<1.035)continue;if(Math.abs(x)<3.5&&z>30.5&&z<38)continue;if(Math.abs(Math.abs(x)-9.6)<2.4&&z>29.2&&z<34)continue;grassPool.add([x,groundY(x,z),z],[range(.9,1.8),range(.8,1.7),range(.9,1.8)],[0,range(0,6),0],grassColors[i%5]);}
  // Small daisies and yellow wildflowers along the clearings, kept below seated eye level.
  const stemPool=pool(new THREE.CylinderGeometry(.007,.009,1,4),mat('#647b2b'),false);
  const petalPositions=[],petalIndices=[];
  for(let k=0;k<6;k++){const a=k*Math.PI/3,b=petalPositions.length/3;petalPositions.push(0,0,0,Math.cos(a-.4)*.095,0,Math.sin(a-.4)*.095,Math.cos(a)*.15,.018,Math.sin(a)*.15,Math.cos(a+.4)*.095,0,Math.sin(a+.4)*.095);petalIndices.push(b,b+1,b+2,b,b+2,b+3);}
  const flowerGeo=new THREE.BufferGeometry();flowerGeo.setAttribute('position',new THREE.Float32BufferAttribute(petalPositions,3));flowerGeo.setIndex(petalIndices);flowerGeo.computeVertexNormals();
  const flowerPool=pool(flowerGeo,mat('#ffffff',{side:THREE.DoubleSide}),false),pollenPool=pool(new THREE.SphereGeometry(.025,6,4),mat('#e9bc28'),false);
  for(let i=0;i<160;i++){const x=range(-17,17),z=range(26.5,37);if(Math.hypot(x/34,(z+14)/41)<1.035||(Math.abs(x)<2.5&&z>30.5))continue;const y=groundY(x,z),h=range(.23,.57);stemPool.add([x,y+h/2,z],[1,h,1],null,'#637f2b');flowerPool.add([x,y+h,z],[.65,.65,.65],[range(-.2,.2),range(0,6),range(-.15,.15)],i%3?'#f3d22b':'#fff4d5');pollenPool.add([x,y+h+.015,z],[1,1,1]);}

  // Three folding chairs at true scale. Side chairs are exactly 10 m horizontally away.
  const chairs=[],chairSpecs=[{name:'left',x:-9.6,z:29.2,color:'#343c3c',label:'黑灰'},{name:'center',x:0,z:32,color:'#b56e35',label:'棕橙'},{name:'right',x:9.6,z:29.2,color:'#d9c99d',label:'米白'}];
  function chair(spec){const g=new THREE.Group();g.name='chair-'+spec.name;g.position.set(spec.x,.5,spec.z);g.rotation.y=spec.name==='left'?-.12:spec.name==='right'?.12:0;scene.add(g);
    const fabric=mat(spec.color,{side:THREE.DoubleSide}),frameMat=mat('#303a34',{metalness:.35,roughness:.55});
    const seat=mesh(new THREE.PlaneGeometry(.67,.64,5,5),fabric,g,[0,.43,0]);seat.rotation.x=-Math.PI/2;
    const back=mesh(new THREE.PlaneGeometry(.68,.64,4,4),fabric,g,[0,.80,.34]);back.rotation.x=.16;
    for(const x of [-.39,.39]){beam(g,[x,.035,-.39],[x,.68,.27],.021,.021,frameMat);beam(g,[x,.035,.41],[x,.65,-.30],.021,.021,frameMat);beam(g,[x,.32,.25],[x,1.13,.42],.022,.022,frameMat);beam(g,[x,.44,-.23],[x,.69,-.23],.018,.018,frameMat);box(g,materials.wood,[x,.70,.02],[.105,.045,.64]);}
    beam(g,[-.37,.45,-.29],[.37,.45,-.29],.018,.018,frameMat);beam(g,[-.35,1.13,.40],[.35,1.13,.40],.018,.018,frameMat);
    const seamMat=mat(spec.name==='center'?'#d09252':spec.name==='left'?'#748074':'#ece0bf');for(const x of [-.31,.31])beam(g,[x,.51,.29],[x,1.1,.39],.007,.007,seamMat,5);
    chairs.push({name:spec.name,color:spec.color,label:spec.label,position:g.position.toArray(),horizontalDistance:Math.hypot(spec.x-cameraOrigin.x,spec.z-cameraOrigin.z)});
    return g;
  }
  chairSpecs.forEach(chair);
  // Buckets have an open rim and water inside, rather than closed solid cylinders.
  for(const [x,z,c]of[[-8.7,29.2,'#535d53'],[10.5,28.9,'#d6d7c4'],[1.1,31.6,'#7c8870']]){
    const y=.5;mesh(new THREE.CylinderGeometry(.18,.145,.31,16,1,true),mat(c,{side:THREE.DoubleSide}),scene,[x,y+.16,z]);
    const rim=mesh(new THREE.TorusGeometry(.18,.014,6,20),mat(c),scene,[x,y+.32,z]);rim.rotation.x=Math.PI/2;
    const fill=mesh(new THREE.CircleGeometry(.16,18),mat('#456b5b',{roughness:.22}),scene,[x,y+.19,z]);fill.rotation.x=-Math.PI/2;
    const handle=mesh(new THREE.TorusGeometry(.19,.008,5,16,Math.PI),materials.metal,scene,[x,y+.31,z]);handle.rotation.y=Math.PI/2;
  }

  const reflectionTarget=new THREE.WebGLRenderTarget(1024,640,{depthBuffer:true}),reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4();
  const waterUniforms={time:{value:0},mirrorMap:{value:reflectionTarget.texture},mirrorMatrix:{value:reflectionMatrix},sunDir:{value:sun.position.clone().normalize()}};
  const water=mesh(new THREE.PlaneGeometry(480,480),new THREE.ShaderMaterial({uniforms:waterUniforms,
    vertexShader:'varying vec3 vWorld;varying vec4 vMirror;uniform mat4 mirrorMatrix;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vMirror=mirrorMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float time;uniform sampler2D mirrorMap;uniform vec3 sunDir;varying vec3 vWorld;varying vec4 vMirror;
    void main(){vec2 p=vWorld.xz;float t=time;float a=sin(p.x*3.5+p.y*1.2+t*.8)+.38*sin(p.y*8.-t*1.1);float b=cos(p.y*5.5-p.x*.8-t*.75);vec3 n=normalize(vec3(a*.017,1.,b*.013));vec3 eye=normalize(cameraPosition-vWorld);float f=.24+.46*pow(1.-max(dot(eye,n),0.),2.5);vec2 uv=vMirror.xy/vMirror.w*.5+.5;uv+=n.xz*.035;vec3 reflected=texture2D(mirrorMap,clamp(uv,.002,.998)).rgb;float shore=clamp((length(vec2(p.x/34.,(p.y+14.)/41.))-.83)/.16,0.,1.);vec3 base=mix(vec3(.024,.16,.095),vec3(.15,.23,.075),shore*.65);vec3 c=mix(base,reflected*vec3(.68,.87,.72),f*.85);float spec=pow(max(dot(reflect(-sunDir,n),eye),0.),170.);c+=vec3(.9,.8,.43)*spec*.65;float threads=pow(max(0.,sin(p.y*9.+sin(p.x*.8)+t*.9)),25.);c+=vec3(.025,.045,.035)*threads*(1.-shore*.5);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}),scene);water.rotation.x=-Math.PI/2;water.position.y=-.035;water.castShadow=false;water.receiveShadow=false;
  const padPool=pool(new THREE.CircleGeometry(1,12,.15,Math.PI*1.88),mat('#ffffff',{side:THREE.DoubleSide}),false);
  for(let i=0;i<370;i++){const a=range(0,Math.PI*2),p=coast(a,range(.91,.995));if(Math.abs(p.x)<3&&p.z>20)continue;const s=range(.06,.18);padPool.add([p.x,.006+range(0,.006),p.z],[s,s,1],[-Math.PI/2,0,range(0,6)],['#8d9b30','#687f26','#a3aa37'][i%3]);}
  const ripples=[];for(let i=0;i<6;i++){const ring=mesh(new THREE.RingGeometry(.98,1,40),new THREE.MeshBasicMaterial({color:'#b9cf88',transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}),scene,[range(-19,19),.009,range(-35,19)]);ring.rotation.x=-Math.PI/2;ring.castShadow=false;ring.userData.phase=random();ripples.push(ring);}
  const birds=[];for(let i=0;i<5;i++){const b=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.3,.07,0),new THREE.Vector3(0,0,0),new THREE.Vector3(.3,.07,0)]),new THREE.LineBasicMaterial({color:'#3f6260'}));b.position.set(range(-25,25),range(17,23),range(-80,-54));b.userData.origin=b.position.clone();b.userData.phase=range(0,6);scene.add(b);birds.push(b);}
  pools.forEach(p=>p.finish());
  return {mat,materials,mesh,box,beam,sun,water,waterUniforms,reflectionTarget,reflectionCamera,reflectionMatrix,ripples,birds,vegetationTime,chairs,cameraOrigin,treeCount:treeRecords.length};
}
