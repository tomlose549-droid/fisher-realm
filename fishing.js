import * as THREE from './vendor/three.module.js';
import {FishingSession,FISHING,signedAngle} from './fishing-rules.js?v=fishing1';
import {createWaterEffects} from './water-effects.js?v=water1';

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
  // Fish exists only in the rules. There is no visible fish mesh or fish texture.
  const waterEffects=createWaterEffects(scene);
  const retrieveStart=new THREE.Vector3(),retrieveEnd=new THREE.Vector3(),sideVector=new THREE.Vector3();
  let shorelineDistance=4.5,lastLandedCast=null,lastTrailAt=-Infinity,retrievalProgress=0;
  const target=new THREE.Vector3(),rodTip=new THREE.Vector3(),castDirection=new THREE.Vector3(),handOffset=new THREE.Vector3();
  let pointerX=null,lastStatus='';
  function getTarget(distance=session.distance){return target.set(player.x-Math.sin(session.fishYaw)*distance,.06,player.z-Math.cos(session.fishYaw)*distance);}
  function insideWater(x,z,margin=.995){
    const nx=x/34,nz=(z+14)/41,a=Math.atan2(nz,nx),wobble=1+.026*Math.sin(a*5+.5)+.015*Math.cos(a*7);
    return Math.hypot(nx,nz)<wobble*margin;
  }
  function waterPoint(yaw){return insideWater(player.x-Math.sin(yaw)*FISHING.distance,player.z-Math.cos(yaw)*FISHING.distance,.98);}
  function findShore(yaw){let dry=0,wet=FISHING.distance;for(let i=0;i<22;i++){const d=(dry+wet)*.5;if(insideWater(player.x-Math.sin(yaw)*d,player.z-Math.cos(yaw)*d))wet=d;else dry=d;}return wet;}
  // Keep visible water effects in the pond even when the logical catch distance
  // extends into the player's natural-bank clearing.
  function surfaceTarget(distance=session.distance){getTarget(Math.max(distance,shorelineDistance+.24));target.y=.025;return target;}
  function retrieval(age){
    const progress=THREE.MathUtils.clamp(age/FISHING.recastDelay,0,1);
    const pull=THREE.MathUtils.clamp((age-.10)/.65,0,1),eased=THREE.MathUtils.smoothstep(pull,0,1);
    const lift=progress<.4?THREE.MathUtils.smoothstep(progress,0,.4):1-THREE.MathUtils.smoothstep(progress,.4,1);
    return {progress,eased,lift,arc:Math.sin(eased*Math.PI)};
  }
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
  function view(){
    if(!['fighting','caught'].includes(session.state))return null;
    surfaceTarget();castDirection.copy(target).sub(player);
    const yaw=Math.atan2(-castDirection.x,-castDirection.z);
    let pitch=Math.atan2(castDirection.y,Math.hypot(castDirection.x,castDirection.z));
    if(session.state==='caught'){
      const progress=THREE.MathUtils.clamp((now()-session.catchAt)/FISHING.recastDelay,0,1);
      pitch=THREE.MathUtils.lerp(pitch,-.065,THREE.MathUtils.smoothstep(progress,0,1))+Math.sin(progress*Math.PI)*.45;
    }
    return {yaw,pitch};
  }
  function update(t){
    session.advance(t);
    for(const event of session.drainEvents()){
      if(event.type==='cast'){shorelineDistance=findShore(session.fishYaw);lastTrailAt=-Infinity;retrievalProgress=0;}
      if(event.type==='hooked'){pointerX=null;waterEffects.pulse('hook',surfaceTarget(),event.at);onHook();toast('已提竿 · 移动鼠标转竿，按住左键收线');}
      if(event.type==='missed'){toast('鱼脱钩了 · 按空格重新抛竿');onReady(session.fishYaw);}
      if(event.type==='caught'){
        retrieveStart.copy(surfaceTarget(FISHING.catchDistance));
        retrieveEnd.set(.16,-.53,-.85).applyAxisAngle(axisY,session.fishYaw).add(player);
        sideVector.set(Math.cos(session.fishYaw),0,-Math.sin(session.fishYaw));
        waterEffects.pulse('catch',retrieveStart,event.at);
      }
      if(event.type==='ready')onReady(session.fishYaw);
    }
    if(session.active&&session.castAt!==lastLandedCast&&t>=session.castAt+FISHING.flight){
      lastLandedCast=session.castAt;
      if(t-session.castAt-FISHING.flight<1.15)waterEffects.pulse('landing',surfaceTarget(FISHING.distance),session.castAt+FISHING.flight);
    }
    if(session.state==='fighting'&&session.reeling&&t-lastTrailAt>=.18){
      lastTrailAt=t;waterEffects.pulse('trail',surfaceTarget(),t,.8+session.efficiency*.24);
    }
    waterEffects.update(t);
    const opacity=session.noticeOpacity(t);notice.style.opacity=String(opacity);notice.hidden=opacity===0;
    const stage=session.state;
    let text='空格抛竿 · 23 米';
    if(stage==='casting')text='抛竿中…';
    if(stage==='waiting')text='静候咬钩 · 23 米';
    if(stage==='bite')text=`鱼线在动 · 按任意键提竿  ${Math.max(0,session.hookDeadline-t).toFixed(2)} 秒`;
    if(stage==='fighting')text=`${session.reeling?'正在收线':'按住左键收线'} · ${session.distance.toFixed(2)} 米 · 效率 ${Math.round(session.efficiency*100)}%`;
    if(stage==='caught')text='收竿中…';
    if(text!==lastStatus){status.textContent=text;lastStatus=text;}status.dataset.state=stage;
    if(stage==='idle'){rod.visible=line.visible=marker.visible=false;idleRod.visible=true;canvas.style.cursor='grab';return;}
    idleRod.visible=false;rod.visible=line.visible=true;canvas.style.cursor=stage==='fighting'?'crosshair':'grab';
    handOffset.set(.34,-.47,-.12).applyAxisAngle(axisY,session.fishYaw);rod.position.copy(player).add(handOffset);
    rod.rotation.set(.025,session.rodYaw,0);
    const castProgress=THREE.MathUtils.clamp((t-session.castAt)/FISHING.flight,0,1);
    if(stage==='casting')rod.rotation.x+=Math.sin(castProgress*Math.PI)*.7;
    const motion=stage==='caught'?retrieval(t-session.catchAt):null;
    if(motion){
      retrievalProgress=motion.progress;rod.rotation.x+=motion.lift*.65;
      rod.rotation.y+=signedAngle(session.fishYaw-session.rodYaw)*motion.eased;
    }
    if(stage==='fighting'&&session.reeling)reelHandle.rotation.z=t*12;
    rod.updateMatrixWorld(true);rodTip.set(...points.at(-1)).applyMatrix4(rod.matrixWorld);
    getTarget();
    if(stage==='casting'){const destination=target.clone();target.copy(player).lerp(destination,castProgress);target.y=player.y*(1-castProgress)+Math.sin(castProgress*Math.PI)*2.9+.06;}
    else if(stage==='waiting')target.y=.06+Math.sin(t*2)*.015;
    else if(stage==='bite')target.y=.06+Math.sin((t-session.biteAt)*24)*.16;
    else if(stage==='caught'){
      target.copy(retrieveStart).lerp(retrieveEnd,motion.eased);
      target.y+=motion.arc*1.10;
      target.addScaledVector(sideVector,Math.sin(motion.eased*Math.PI*2)*.24*motion.arc);
    }else surfaceTarget();
    marker.visible=['casting','waiting','bite'].includes(stage);marker.position.copy(target);ring.material.opacity=stage==='bite'?.5:.25;
    for(let i=0;i<25;i++){
      const u=i/24,index=i*3,sag=stage==='fighting'?.055:stage==='caught'?.22+motion.arc*.36:.30;
      lineArray[index]=THREE.MathUtils.lerp(rodTip.x,target.x,u);
      lineArray[index+1]=THREE.MathUtils.lerp(rodTip.y,target.y,u)-Math.sin(u*Math.PI)*sag;
      lineArray[index+2]=THREE.MathUtils.lerp(rodTip.z,target.z,u);
      if(motion){const swing=Math.sin(u*Math.PI)*Math.sin(motion.eased*Math.PI*2)*.18;lineArray[index]+=sideVector.x*swing;lineArray[index+2]+=sideVector.z*swing;}
    }
    lineGeometry.attributes.position.needsUpdate=true;
  }
  return {
    key,pointerMove,pointerDown,release,view,update,
    isFighting:()=>session.state==='fighting',isActive:()=>session.active,
    hideReflection(){rod.visible=line.visible=marker.visible=false;waterEffects.hide();},
    restoreReflection(){const active=session.active;rod.visible=line.visible=active;marker.visible=['casting','waiting','bite'].includes(session.state);idleRod.visible=!active;waterEffects.show();},
    getState:()=>({...session.snapshot(now()),visuals:{fishModelCount:scene.getObjectsByProperty('name','tilapia').length,shorelineDistance,rodLift:rod.rotation.x,retrievalProgress,lineVisible:line.visible,lineEnd:Array.from(lineArray.slice(-3)),lineTip:Array.from(lineArray.slice(0,3)),waves:waterEffects.snapshot()}}),
  };
}
