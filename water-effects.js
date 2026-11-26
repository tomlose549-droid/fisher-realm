import * as THREE from './vendor/three.module.js';
import {createResourceScope} from './scene-resources.js';

const POOL_SIZE=24,PARTICLES_PER_PULSE=96;
export const WATER_EFFECT_PRESETS=Object.freeze(Object.fromEntries(Object.entries({
 landing:{radius:1.65,life:1.4,rings:3,opacity:.92,drops:36,height:.85,dropLife:1.05,dropSize:.12},
 hook:{radius:2.05,life:1.65,rings:3,opacity:.98,drops:48,height:1.25,dropLife:1.15,dropSize:.14},
 trail:{radius:.9,life:1.05,rings:2,opacity:.72,drops:18,height:.42,dropLife:.58,dropSize:.11},
 catch:{radius:2.35,life:1.95,rings:3,opacity:.78,drops:36,height:.75,dropLife:1.1,dropSize:.12},
 // Landing-net idle/struggle water remains the original small effect.
 net:{radius:.44,life:.85,rings:1,opacity:.25,drops:0,height:0,dropLife:0,dropSize:0,quiet:true},
}).map(([kind,preset])=>[kind,Object.freeze(preset)])));

// All casts and continuous splashes reuse these meshes/particles, including at the 6/10m/s tiers.
export function createWaterEffects(scene,{waterLevel=0}={}){
 const root=new THREE.Group();root.name='fishing-water-ripples';scene.add(root);
 const geometry=new THREE.RingGeometry(.82,1,48),pool=[];
 const bright=new THREE.Color('#eefaff'),quiet=new THREE.Color('#d0e8cb');
 const counts=Object.fromEntries(Object.keys(WATER_EFFECT_PRESETS).map(kind=>[kind,0])),last={};let cursor=0;
 for(let i=0;i<POOL_SIZE;i++){
  const group=new THREE.Group();group.visible=false;root.add(group);const rings=[];
  for(let j=0;j<3;j++){
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{tint:{value:bright},alpha:{value:0},inner:{value:.82},phase:{value:0},quiet:{value:0}},
    vertexShader:'varying vec2 vPoint;void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vPoint;uniform vec3 tint;uniform float alpha;uniform float inner;uniform float phase;uniform float quiet;
     void main(){float r=length(vPoint);float edge=sin(clamp((r-inner)/(1.-inner),0.,1.)*3.14159265);
      float a=atan(vPoint.y,vPoint.x);float foam=mix(.6+.4*smoothstep(-.6,.65,sin(a*9.+phase)),1.,quiet);
      gl_FragColor=vec4(tint,alpha*edge*foam);
      #include <colorspace_fragment>
     }`,
   });
   const ring=new THREE.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.position.y=j*.0015;ring.renderOrder=2;group.add(ring);rings.push(ring);
  }
  pool.push({group,rings,at:-Infinity,kind:null,settings:null,strength:1,particles:0});
 }
 const capacity=POOL_SIZE*PARTICLES_PER_PULSE,data=new Float32Array(capacity*3),alphas=new Float32Array(capacity),sizes=new Float32Array(capacity);
 const dropGeometry=new THREE.BufferGeometry();
 dropGeometry.setAttribute('position',new THREE.BufferAttribute(data,3).setUsage(THREE.DynamicDrawUsage));
 dropGeometry.setAttribute('particleAlpha',new THREE.BufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));
 dropGeometry.setAttribute('particleSize',new THREE.BufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));
 const drops=new THREE.Points(dropGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  vertexShader:'attribute float particleAlpha;attribute float particleSize;varying float vAlpha;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(particleSize*850./max(1.,-mv.z),3.25,11.);vAlpha=particleAlpha;}',
  fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;float edge=1.-smoothstep(.28,1.,r);gl_FragColor=vec4(.94,.985,1.,vAlpha*edge);
   #include <colorspace_fragment>
  }`,
 }));
 drops.frustumCulled=false;drops.name='fishing-splash-droplets';drops.visible=false;drops.renderOrder=3;root.add(drops);
 const resources=createResourceScope(root);
 function pulse(kind,position,time,strength=1){
  const settings=WATER_EFFECT_PRESETS[kind];if(resources.disposed||!settings||!Number.isFinite(strength)||strength<=0)return;
  const slot=pool[cursor];cursor=(cursor+1)%pool.length;
  Object.assign(slot,{at:time,kind,settings,strength,particles:Math.min(PARTICLES_PER_PULSE,Math.ceil(settings.drops*strength))});
  slot.group.position.set(position.x,waterLevel+.012,position.z);slot.group.visible=true;
  counts[kind]++;last[kind]={at:time,position:[position.x,waterLevel+.012,position.z],radius:settings.radius*strength,height:settings.height*strength,particles:slot.particles};
 }
 function update(time){
  if(resources.disposed)return;let particleCount=0;
  for(const slot of pool){
   if(!slot.settings)continue;const age=time-slot.at,s=slot.settings;
   slot.group.visible=age>=0&&age<s.life+.24;
   if(slot.group.visible)for(let j=0;j<3;j++){
    const progress=(age-j*.12)/s.life,ring=slot.rings[j];ring.visible=j<s.rings&&progress>=0&&progress<1;if(!ring.visible)continue;
    const radius=(.1+s.radius*Math.pow(progress,.68))*slot.strength;ring.scale.set(radius,radius,1);
    const u=ring.material.uniforms;u.tint.value=s.quiet?quiet:bright;u.inner.value=s.quiet?.91:.82;u.quiet.value=s.quiet?1:0;u.phase.value=age*2+j*1.7;
    u.alpha.value=s.opacity*Math.sin(Math.min(1,progress*5)*Math.PI*.5)*Math.pow(1-progress,s.quiet?1.2:.8);
   }
   if(!slot.particles||age<0||age>s.dropLife+.15)continue;
   for(let j=0;j<slot.particles;j++){
    const local=age-(j%6)*.025,life=s.dropLife*(.74+(j%7)*.045);if(local<0||local>=life)continue;
    const p=local/life,a=j*2.399963+slot.at*.37,r=(.04+p*s.radius*.7)*slot.strength*(.68+(j%9)*.045),k=particleCount*3;
    data[k]=slot.group.position.x+Math.cos(a)*r;data[k+1]=waterLevel+.035+Math.sin(p*Math.PI)*s.height*slot.strength*(.65+(j%5)*.08);data[k+2]=slot.group.position.z+Math.sin(a)*r;
    alphas[particleCount]=.95*Math.pow(1-p,.55);sizes[particleCount]=s.dropSize*Math.sqrt(slot.strength)*(.8+(j%4)*.12);particleCount++;
   }
  }
  dropGeometry.setDrawRange(0,particleCount);drops.visible=particleCount>0;
  for(const attribute of Object.values(dropGeometry.attributes))attribute.needsUpdate=true;
 }
 return {pulse,update,dispose:()=>resources.dispose(),hide(){root.visible=false;},show(){root.visible=true;},snapshot(){return {emitted:{...counts},last:{...last},active:pool.filter(slot=>slot.group.visible).length,poolSize:POOL_SIZE,activeParticles:dropGeometry.drawRange.count,particleCapacity:capacity};}};
}
