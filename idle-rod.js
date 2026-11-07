import * as THREE from './vendor/three.module.js';
import {createResourceScope} from './scene-resources.js';

// Player equipment owns its materials independently of any map.
export function createIdleRod(camera){
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.91,...extra});
  const metal=mat('#293632',{metalness:.5,roughness:.45}),boxGeometry=new THREE.BoxGeometry(1,1,1),axisY=new THREE.Vector3(0,1,0);
  function mesh(geometry,material,parent,position,scale){const m=new THREE.Mesh(geometry,material);if(position)m.position.set(...position);if(scale)m.scale.set(...scale);parent.add(m);return m;}
  function beam(parent,a,b,r1,r2,material){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const m=mesh(new THREE.CylinderGeometry(r2,r1,d.length(),8),material,parent);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(axisY,d.normalize());return m;}
  const rod=new THREE.Group();camera.add(rod);rod.scale.setScalar(.84);rod.position.set(.08,-.19,-.03);rod.rotation.y=-.16;
  const corkMat=mat('#ae8955'),rodMat=mat('#263d37',{roughness:.34,metalness:.25});
  const points=[[.57,-.63,-.75],[.48,-.38,-1.1],[.29,-.02,-1.7],[.04,.28,-2.4],[-.17,.43,-3.1],[-.30,.47,-3.65]];
  for(let i=1;i<points.length;i++)beam(rod,points[i-1],points[i],.025-i*.0032,.022-i*.0032,i===1?corkMat:rodMat);
  for(let i=1;i<points.length;i++){const p=points[i],guide=mesh(new THREE.TorusGeometry(.035-i*.0035,.004,5,12),metal,rod,[p[0],p[1]-.035,p[2]]);guide.rotation.x=.3;}
  mesh(new THREE.CylinderGeometry(.085,.085,.07,12),metal,rod,[.49,-.43,-1.08]).rotation.z=Math.PI/2;
  mesh(new THREE.CylinderGeometry(.062,.062,.075,12),mat('#c4b384',{metalness:.5}),rod,[.445,-.43,-1.08]).rotation.z=Math.PI/2;
  beam(rod,[.44,-.43,-1.08],[.37,-.51,-1.08],.009,.009,metal);
  mesh(boxGeometry,corkMat,rod,[.35,-.51,-1.08],[.07,.025,.025]);
  const linePoints=points.slice(1).map(p=>new THREE.Vector3(p[0],p[1]-.035,p[2]));linePoints.push(new THREE.Vector3(-.28,-.28,-3.63));
  rod.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints),new THREE.LineBasicMaterial({color:'#dfdfc9',transparent:true,opacity:.58})));
  beam(rod,[-.28,-.28,-3.63],[-.28,-.36,-3.63],.015,.015,mat('#ce8b65'));
  rod.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});
  const resources=createResourceScope(rod);return {root:rod,dispose:()=>resources.dispose()};
}
