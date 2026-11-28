import * as THREE from './vendor/three.module.js';

import {surfaceTexture} from './scene-materials.js';

export function createAmazonQuality({root,renderer,camera,config,pools,treeRecords,barkMat,woodMat,darkWood,soil,leafMat,hemi,sun,ambient,fog,waterUniform}){
 const textures={bark:surfaceTexture('bark',512,512),wood:surfaceTexture('wood',512,512),ground:surfaceTexture('ground',512,512),leaf:surfaceTexture('leaf',128,256)};
 textures.bark.map.repeat.set(2,3);textures.bark.normalMap.repeat.set(2,3);
 const materialPairs=new Map();
 function material(low,kind){const high=low.clone();high.onBeforeCompile=low.onBeforeCompile;high.map=textures[kind].map;high.normalMap=textures[kind].normalMap;high.bumpMap=null;high.normalScale.setScalar(kind==='leaf'?.18:.36);high.color.set(kind==='ground'?'#d5c8ae':'#ffffff');if(kind==='leaf'){high.emissiveMap=high.map;high.emissive.set('#567449');high.emissiveIntensity=.08;high.roughness=.72;}materialPairs.set(low,high);return high;}
 material(barkMat,'bark');material(woodMat,'wood');const dark=material(darkWood,'wood');dark.color.set('#8e7860');material(soil,'ground');material(leafMat,'leaf');
 const bindings=[];root.traverse(o=>{if(o.isMesh&&materialPairs.has(o.material))bindings.push({mesh:o,low:o.material,high:materialPairs.get(o.material)});});
 const highRoot=new THREE.Group();highRoot.name='amazon-high-quality';root.add(highRoot);const legacy=[],chunks=[],geometryCache=new Map();
 const station={x:config.spawn.position[0],z:config.spawn.position[2]};
 function foliageGeometry(original,level){const key=original.uuid+':'+level;if(geometryCache.has(key))return geometryCache.get(key);if(level===2){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.5,.5,0,0,1,.035,.5,.5,0],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([.5,1,0,.5,.5,0,1,.5],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();geometryCache.set(key,g);return g;}const rows=level===0?5:3,pos=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<3;i++){const t=j/rows,u=i/2,x=(u-.5)*Math.pow(Math.sin(Math.PI*t),.62);pos.push(x,t,Math.sin(t*Math.PI)*.11-Math.abs(x)*.16);uv.push(u,1-t);if(i&&j){const n=j*3+i;indices.push(n,n-1,n-3,n-1,n-4,n-3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();geometryCache.set(key,g);return g;
 }
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),tint=new THREE.Color();
 for(const [kind,pool]of Object.entries(pools)){
  const old=pool.mesh;if(!old)continue;legacy.push(old);const groups=new Map(),leaf=kind==='leaves'||kind==='smallLeaves';
  for(let i=0;i<old.count;i++){old.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);const d=Math.hypot(position.x-station.x,position.z-station.z),level=d<18?0:d<55?1:2;
   // Keep all near silhouettes, thin only small distant decoration deterministically.
   if(leaf&&level===2&&i%2===0)continue;
   const cell=level===0?40:level===1?80:160,key=Math.floor(position.x/cell)+':'+Math.floor(position.z/cell)+':'+level;
   if(!groups.has(key))groups.set(key,{level,entries:[]});if(leaf){scale.x*=level===0?1.36:1.22;scale.y*=1.10;matrix.compose(position,rotation,scale);}const c=old.instanceColor?(old.getColorAt(i,tint),tint.clone()):null;groups.get(key).entries.push({matrix:matrix.clone(),color:c});
  }
  for(const {level,entries}of groups.values()){
   const key=kind+':'+level;let geo=old.geometry;if(leaf)geo=foliageGeometry(old.geometry,level);else if(level>0){if(!geometryCache.has(key)){const p=old.geometry.parameters;geometryCache.set(key,p.radiusTop!==undefined?new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,1,level===1?6:4,1):new THREE.IcosahedronGeometry(1,0));}geo=geometryCache.get(key);}const inst=new THREE.InstancedMesh(geo,materialPairs.get(old.material)??old.material,entries.length);inst.name='amazon-'+kind+'-lod'+level;entries.forEach((e,i)=>{inst.setMatrixAt(i,e.matrix);if(e.color)inst.setColorAt(i,e.color);});inst.castShadow=old.castShadow&&level<2;inst.receiveShadow=true;inst.computeBoundingSphere();highRoot.add(inst);chunks.push(inst);
  }
 }
 // Leafy crown cards fill exposed branch tips using a single alpha-tested atlas and few quads.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
 let seed=41713;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<720;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand()),x=128+Math.cos(a)*r*115,y=128+Math.sin(a)*r*96;const light=1-y/256;ctx.fillStyle=`rgb(${Math.floor(38+light*48+rand()*25)},${Math.floor(68+light*55+rand()*25)},${Math.floor(24+light*19)})`;ctx.beginPath();ctx.ellipse(x,y,4+rand()*10,2+rand()*5,rand()*6.28,0,Math.PI*2);ctx.fill();}
 const crownMap=new THREE.CanvasTexture(canvas);crownMap.colorSpace=THREE.SRGBColorSpace;
 const crownMat=new THREE.MeshStandardMaterial({map:crownMap,alphaTest:.45,side:THREE.DoubleSide,roughness:.85,emissive:'#304620',emissiveMap:crownMap,emissiveIntensity:.22});
 const cards=[];for(const t of treeRecords)for(let j=0;j<4;j++){const angle=j*2.4+rand(),r=1.3+rand()*2.2;for(let k=0;k<3;k++){const o=new THREE.Object3D();o.position.set((t.top?.[0]??t.x)+Math.cos(angle)*r,t.h-1.2+rand()*1.3,(t.top?.[2]??t.z)+Math.sin(angle)*r);o.rotation.set(rand()*.25,k*Math.PI/3+angle,rand()*.3-.15);o.scale.set(5+rand()*3,3+rand()*2,1);o.updateMatrix();cards.push(o.matrix.clone());}}
 const crowns=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),crownMat,cards.length);cards.forEach((m,i)=>crowns.setMatrixAt(i,m));crowns.name='amazon-leafy-crowns';crowns.castShadow=false;crowns.receiveShadow=true;crowns.computeBoundingSphere();highRoot.add(crowns);
 const forest=config.id==='amazon-flooded-forest',base={hemi:hemi.intensity,sun:sun.intensity,ambient:ambient.intensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone(),sunColor:sun.color.clone(),fog:fog.color.clone(),near:fog.near,far:fog.far,exposure:renderer.toneMappingExposure};let high=true;
 function setQuality(value){high=!!value;highRoot.visible=high;legacy.forEach(o=>o.visible=!high);bindings.forEach(b=>{b.mesh.material=high?b.high:b.low;});hemi.intensity=high?(forest?2.0:2.6):base.hemi;sun.intensity=high?(forest?2.1:2.8):base.sun;ambient.intensity=high?(forest?.5:.72):base.ambient;hemi.color.copy(high?new THREE.Color(forest?'#dce8ce':'#e4f0e6'):base.sky);hemi.groundColor.copy(high?new THREE.Color(forest?'#424e33':'#625e48'):base.ground);sun.color.copy(high?new THREE.Color('#fff2d3'):base.sunColor);fog.color.copy(high?new THREE.Color(forest?'#829c87':'#b0c4b8'):base.fog);fog.near=high?(forest?43:65):base.near;fog.far=high?(forest?160:195):base.far;renderer.toneMappingExposure=high?(forest?.95:1.02):base.exposure;waterUniform.value=high?1:0;renderer.shadowMap.needsUpdate=true;}
 // Both material alternatives stay owned by the one root, even when detached from visible meshes.
 const assets=new THREE.Mesh(new THREE.BufferGeometry(),[...materialPairs.keys(),...materialPairs.values()]);assets.name='amazon-quality-resources';assets.visible=false;root.add(assets);
 return {setQuality,snapshot:()=>({quality:high?'high':'low',chunkCount:chunks.length,lodLevels:3})};
}
