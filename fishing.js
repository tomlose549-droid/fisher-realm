import * as THREE from './vendor/three.module.js';
import {FishingSession,FISHING} from './fishing-rules.js?v=fishing1';

export function createFishing({scene,camera,player,canvas,idleRod,toast,onReady,onCast,onHook}){
  const session=new FishingSession(),status=document.querySelector('#fishing-status'),notice=document.querySelector('#catch-notice');
  const now=()=>performance.now()/1000;
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.7,...extra});
  const add=(geo,mat,parent,p,s)=>{const m=new THREE.Mesh(geo,mat);if(p)m.position.set(...p);if(s)m.scale.set(...s);parent.add(m);return m;};
  const axisY=new THREE.Vector3(0,1,0);
  function beam(a,b,r0,r1,mat,parent){const v=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(v);const m=add(new THREE.CylinderGeometry(r1,r0,d.length(),8),mat,parent);m.position.copy(v).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(axisY,d.normalize());return m;}
  const rod=new THREE.Group();rod.visible=false;rod.name='independent-fishing-rod';scene.add(rod);
  const cork=material('#b79764'),carbon=material('#30483c',{roughness:.32,metalness:.35}),metal=material('#8a9387',{metalness:.65,roughness:.35});
  const points=[[0,-.25,.30],[0,0,0],[0,.23,-.7],[0,.43,-1.5],[0,.51,-2.2],[0,.53,-2.9]];
  for(let i=1;i<points.length;i++)beam(points[i-1],points[i],.027-i*.0036,.024-i*.0036,i===1?cork:carbon,rod);
  for(let i=2;i<points.length;i++){const p=points[i],guide=add(new THREE.TorusGeometry(.035-i*.004,.004,5,12),metal,rod,[0,p[1]-.025,p[2]]);guide.rotation.x=.2;}
  const reel=add(new THREE.CylinderGeometry(.075,.075,.09,14),metal,rod,[.07,-.04,.03]);reel.rotation.z=Math.PI/2;
  beam([.11,-.04,.03],[.17,-.11,.03],.009,.009,metal,rod);
  const reelHandle=add(new THREE.SphereGeometry(.025,6,4),cork,rod,[.17,-.11,.03],[1.4,.7,.7]);
  const lineArray=new Float32Array(25*3),lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(lineArray,3).setUsage(THREE.DynamicDrawUsage));
  const line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:'#e4e9d5',transparent:true,opacity:.86}));line.frustumCulled=false;line.visible=false;scene.add(line);
  const marker=new THREE.Group();marker.visible=false;scene.add(marker);
  add(new THREE.SphereGeometry(.085,10,7),material('#e7e3c6'),marker,[0,.015,0],[.8,1.1,.8]);
  add(new THREE.CylinderGeometry(.033,.04,.13,8),material('#cb6450'),marker,[0,.13,0]);
  const ring=add(new THREE.RingGeometry(.18,.20,32),new THREE.MeshBasicMaterial({color:'#dce5b6',transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}),marker,[0,.012,0]);ring.rotation.x=-Math.PI/2;
  // One species: an oval tilapia body, striped scales, spiny dorsal fin and tail.
  const fish=new THREE.Group();fish.name='tilapia';fish.visible=false;scene.add(fish);
  const scaleCanvas=document.createElement('canvas');scaleCanvas.width=256;scaleCanvas.height=128;const ctx=scaleCanvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#637455');gradient.addColorStop(.5,'#b6bd94');gradient.addColorStop(1,'#dadbc1');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);
  for(let i=0;i<7;i++){ctx.fillStyle='#344e3e66';ctx.fillRect(i*38+7,15,12,88);}
  ctx.strokeStyle='#f0eed348';for(let y=15;y<120;y+=12)for(let x=(y%24?0:8);x<256;x+=16){ctx.beginPath();ctx.arc(x,y,8,0,Math.PI);ctx.stroke();}
  const scales=new THREE.CanvasTexture(scaleCanvas);scales.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.SphereGeometry(1,20,14),material('#ffffff',{map:scales,roughness:.48}),fish,[0,0,0],[.14,.23,.40]);
  const finMat=material('#82936c',{side:THREE.DoubleSide,transparent:true,opacity:.85});
  const finPositions=[],finIndices=[];for(let i=0;i<8;i++){const z=-.27+i*.073,h=.22+Math.sin(i/7*Math.PI)*.13;finPositions.push(0,.13,z,0,h,z+.025);if(i<7){const n=i*2;finIndices.push(n,n+1,n+2,n+1,n+3,n+2);}}
  const dorsal=new THREE.BufferGeometry();dorsal.setAttribute('position',new THREE.Float32BufferAttribute(finPositions,3));dorsal.setIndex(finIndices);dorsal.computeVertexNormals();add(dorsal,finMat,fish);
  const tail=new THREE.BufferGeometry();tail.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-.32,0,.19,-.59,0,.02,-.53,0,-.19,-.59],3));tail.setIndex([0,1,2,0,2,3]);tail.computeVertexNormals();add(tail,finMat,fish);
  for(const side of[-1,1]){add(new THREE.SphereGeometry(.039,10,7),material('#dedfc9'),fish,[side*.11,.075,.25]);add(new THREE.SphereGeometry(.023,8,6),material('#1d2a21',{roughness:.18}),fish,[side*.142,.075,.26]);const fin=add(new THREE.ConeGeometry(.06,.20,5),finMat,fish,[side*.16,-.03,.08]);fin.rotation.z=side*.9;}
  const mouth=add(new THREE.TorusGeometry(.035,.011,5,12),material('#939b7a'),fish,[0,-.025,.39]);
  const target=new THREE.Vector3(),rodTip=new THREE.Vector3(),castDirection=new THREE.Vector3(),handOffset=new THREE.Vector3();
  let pointerX=null,lastStatus='';
  function getTarget(distance=session.distance){return target.set(player.x-Math.sin(session.fishYaw)*distance,.06,player.z-Math.cos(session.fishYaw)*distance);}
  function fishHeight(distance){const t=1-THREE.MathUtils.smoothstep(distance,FISHING.catchDistance,5);return .06+t*.94;}
  function waterPoint(yaw){const x=player.x-Math.sin(yaw)*FISHING.distance,z=player.z-Math.cos(yaw)*FISHING.distance;
    const nx=x/34,nz=(z+14)/41,a=Math.atan2(nz,nx),wobble=1+.026*Math.sin(a*5+.5)+.015*Math.cos(a*7);return Math.hypot(nx,nz)<wobble*.98;}
  function key(event){
    if(event.repeat)return event.code==='Space';
    const t=now();session.advance(t);
    if(session.state==='bite'){session.hook(t);return true;}
    if(event.code!=='Space')return false;
    if(session.state==='idle'){
      const heading=camera.rotation.y;
      if(!waterPoint(heading)){toast('请面向池塘水面，再按空格抛竿');return true;}
      session.cast(t,heading);pointerX=null;onCast();
    }
    return true;
  }
  function pointerMove(event){
    if(session.state!=='fighting'){pointerX=event.clientX;return;}
    const dx=Number.isFinite(event.movementX)&&event.movementX!==0?event.movementX:(pointerX===null?0:event.clientX-pointerX);
    pointerX=event.clientX;if(dx)session.setRodYaw(session.rodYaw-dx*.006,now());
  }
  function pointerDown(event){if(event.button===0&&session.state==='fighting'){session.setReeling(true,now());canvas.setPointerCapture(event.pointerId);canvas.focus();return true;}return false;}
  function release(){session.setReeling(false,now());pointerX=null;}
  function view(){if(!['fighting','caught'].includes(session.state))return null;getTarget();target.y=fishHeight(session.distance)+.05;castDirection.copy(target).sub(player);return {yaw:Math.atan2(-castDirection.x,-castDirection.z),pitch:Math.atan2(castDirection.y,Math.hypot(castDirection.x,castDirection.z))};}
  function update(t){
    session.advance(t);
    for(const event of session.drainEvents()){
      if(event.type==='hooked'){pointerX=null;onHook();toast('已提竿 · 移动鼠标转竿，按住左键收线');}
      if(event.type==='missed'){toast('鱼脱钩了 · 按空格重新抛竿');onReady(session.fishYaw);}
      if(event.type==='ready')onReady(session.fishYaw);
    }
    const opacity=session.noticeOpacity(t);notice.style.opacity=String(opacity);notice.hidden=opacity===0;
    const stage=session.state;
    let text='空格抛竿 · 23 米';
    if(stage==='casting')text='抛竿中…';
    if(stage==='waiting')text='静候咬钩 · 23 米';
    if(stage==='bite')text=`鱼线在动 · 按任意键提竿  ${Math.max(0,session.hookDeadline-t).toFixed(2)} 秒`;
    if(stage==='fighting')text=`${session.reeling?'正在收线':'按住左键收线'} · ${session.distance.toFixed(2)} 米 · 效率 ${Math.round(session.efficiency*100)}%`;
    if(stage==='caught')text='收竿中…';
    if(text!==lastStatus){status.textContent=text;lastStatus=text;}status.dataset.state=stage;
    if(stage==='idle'){rod.visible=line.visible=marker.visible=fish.visible=false;idleRod.visible=true;canvas.style.cursor='grab';return;}
    idleRod.visible=false;rod.visible=line.visible=true;canvas.style.cursor=stage==='fighting'?'crosshair':'grab';
    handOffset.set(.34,-.47,-.12).applyAxisAngle(axisY,session.fishYaw);rod.position.copy(player).add(handOffset);
    rod.rotation.set(.025,session.rodYaw,0);
    const castProgress=THREE.MathUtils.clamp((t-session.castAt)/FISHING.flight,0,1);
    if(stage==='casting')rod.rotation.x+=Math.sin(castProgress*Math.PI)*.7;
    if(stage==='caught')rod.rotation.x+=THREE.MathUtils.clamp((t-session.catchAt)/.4,0,1)*.3;
    if(stage==='fighting'&&session.reeling)reelHandle.rotation.z=t*12;
    rod.updateMatrixWorld(true);rodTip.set(...points.at(-1)).applyMatrix4(rod.matrixWorld);
    getTarget();
    if(stage==='casting'){const destination=target.clone();target.copy(player).lerp(destination,castProgress);target.y=player.y*(1-castProgress)+Math.sin(castProgress*Math.PI)*2.9+.06;}
    else if(stage==='waiting')target.y=.06+Math.sin(t*2)*.015;
    else if(stage==='bite')target.y=.06+Math.sin((t-session.biteAt)*24)*.16;
    else target.y=fishHeight(session.distance);
    marker.visible=['casting','waiting','bite'].includes(stage);marker.position.copy(target);ring.material.opacity=stage==='bite'?.5:.25;
    fish.visible=['fighting','caught'].includes(stage);fish.position.copy(target);fish.position.y-=.08;fish.rotation.set(0,session.fishYaw+(stage==='caught'?.7:0),0);
    for(let i=0;i<25;i++){const u=i/24,index=i*3;lineArray[index]=THREE.MathUtils.lerp(rodTip.x,target.x,u);lineArray[index+1]=THREE.MathUtils.lerp(rodTip.y,target.y,u)-Math.sin(u*Math.PI)*(stage==='fighting'?.055:.30);lineArray[index+2]=THREE.MathUtils.lerp(rodTip.z,target.z,u);}
    lineGeometry.attributes.position.needsUpdate=true;
  }
  return {key,pointerMove,pointerDown,release,view,update,isFighting:()=>session.state==='fighting',isActive:()=>session.active,hideReflection(){rod.visible=line.visible=marker.visible=fish.visible=false;},restoreReflection(){const active=session.active;rod.visible=line.visible=active;marker.visible=['casting','waiting','bite'].includes(session.state);fish.visible=['fighting','caught'].includes(session.state);idleRod.visible=!active;},getState:()=>session.snapshot(now())};
}
