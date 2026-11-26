import * as THREE from './vendor/three.module.js';
import {createResourceScope} from './scene-resources.js';

// Fixed-size pools: casts and continuous reeling never create more meshes at runtime.
export function createWaterEffects(scene,{waterLevel=0}={}){
  const root=new THREE.Group();root.name='fishing-water-ripples';scene.add(root);
  const geometry=new THREE.RingGeometry(.91,1,64);
  const presets={
    landing:{radius:1.12,life:1.15,rings:2,opacity:.54},
    hook:{radius:1.40,life:1.25,rings:2,opacity:.58},
    trail:{radius:.44,life:.85,rings:1,opacity:.25},
    catch:{radius:2.35,life:1.95,rings:3,opacity:.66},
  };
  const counts={landing:0,hook:0,trail:0,catch:0},last={},pool=[];
  let cursor=0;
  for(let i=0;i<24;i++){
    const group=new THREE.Group();group.visible=false;root.add(group);
    const rings=[];
    for(let j=0;j<3;j++){
      const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{tint:{value:new THREE.Color('#d0e8cb')},alpha:{value:0}},
        vertexShader:'varying float vRadius;void main(){vRadius=length(position.xy);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying float vRadius;uniform vec3 tint;uniform float alpha;
          void main(){float edge=sin(clamp((vRadius-.91)/.09,0.,1.)*3.14159265);gl_FragColor=vec4(tint,alpha*edge);
            #include <colorspace_fragment>
          }`,
      });
      const ring=new THREE.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.position.y=j*.0015;ring.renderOrder=2;group.add(ring);rings.push(ring);
    }
    pool.push({group,rings,at:-Infinity,kind:null,settings:null,strength:1});
  }
  function pulse(kind,position,time,strength=1){
    if(resources.disposed)return;
    const settings=presets[kind];if(!settings)return;
    const slot=pool[cursor];cursor=(cursor+1)%pool.length;
    slot.at=time;slot.kind=kind;slot.settings=settings;slot.strength=strength;
    slot.group.position.set(position.x,waterLevel+.012,position.z);slot.group.visible=true;
    counts[kind]++;last[kind]={at:time,position:[position.x,waterLevel+.012,position.z],radius:settings.radius*strength};
  }
  const dropData=new Float32Array(24*6*3),dropGeometry=new THREE.BufferGeometry();dropGeometry.setAttribute('position',new THREE.BufferAttribute(dropData,3).setUsage(THREE.DynamicDrawUsage));const drops=new THREE.Points(dropGeometry,new THREE.PointsMaterial({color:'#e3efe0',size:.07,transparent:true,opacity:.65,depthWrite:false}));drops.frustumCulled=false;root.add(drops);
  function update(time){
    if(resources.disposed)return;
    for(const slot of pool){
      if(!slot.settings)continue;
      const age=time-slot.at,s=slot.settings;
      slot.group.visible=age>=0&&age<s.life+.24;
      if(!slot.group.visible)continue;
      for(let j=0;j<3;j++){
        const local=age-j*.12,progress=local/s.life;
        const visible=j<s.rings&&progress>=0&&progress<1;
        const ring=slot.rings[j];ring.visible=visible;if(!visible)continue;
        const radius=(.10+s.radius*Math.pow(progress,.68))*slot.strength;
        ring.scale.set(radius,radius,1);
        ring.material.uniforms.alpha.value=s.opacity*Math.sin(Math.min(1,progress*5)*Math.PI*.5)*Math.pow(1-progress,1.2);
      }
    }
  }
  const updateRings=update;
  function updateAll(time){if(resources.disposed)return;updateRings(time);let count=0;for(const slot of pool){const age=time-slot.at;if(!['hook','catch','landing'].includes(slot.kind)||age<0||age>=.9)continue;for(let j=0;j<6;j++){const a=j*Math.PI/3,r=age*(.3+j*.045)*slot.strength,k=count++*3;dropData[k]=slot.group.position.x+Math.cos(a)*r;dropData[k+1]=waterLevel+.03+Math.max(0,Math.sin(age/.9*Math.PI))*(slot.kind==='hook'?.7:.42)*slot.strength;dropData[k+2]=slot.group.position.z+Math.sin(a)*r;}}dropGeometry.setDrawRange(0,count);drops.visible=count>0;dropGeometry.attributes.position.needsUpdate=true;}
  const resources=createResourceScope(root);
  return{pulse,update:updateAll,dispose:()=>resources.dispose(),hide(){root.visible=false;},show(){root.visible=true;},snapshot(){return {emitted:{...counts},last:{...last},active:pool.filter(s=>s.group.visible).length,poolSize:pool.length};}};
}
