import * as THREE from './vendor/three.module.js';
import {FishingSession,FISHING,signedAngle} from './fishing-rules.js?v=redear082';
import {isPondWater} from './pond-boundary.js?v=redear082';
import {createWaterEffects} from './water-effects.js?v=water1';
import {createFishingAudio} from './fishing-audio.js?v=redear082';

export function createFishing({scene,camera,player,canvas,idleRod,toast,onReady,onCast,onHook}){
  const session=new FishingSession(Math.random,{randomSpecies:true,player,isWater:(x,z)=>isPondWater(x,z)}),status=document.querySelector('#fishing-status'),notice=document.querySelector('#catch-notice');
  const now=()=>performance.now()/1000;
  const sounds=createFishingAudio();
  const distanceLabel=document.querySelector('#fish-distance'),distancePoint=new THREE.Vector3();
  let lastDistanceText='';
  const meters=document.querySelector('#fishing-meters'),lineFill=document.querySelector('#line-fill'),lineValue=document.querySelector('#line-value'),staminaFill=document.querySelector('#stamina-fill'),staminaValue=document.querySelector('#stamina-value'),phaseLabel=document.querySelector('#fish-phase');
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
  const retrieveStart=new THREE.Vector3(),retrieveEnd=new THREE.Vector3(),sideVector=new THREE.Vector3(),lastWetSurface=new THREE.Vector3(0,.025,9);
  let shorelineDistance=4.5,lastLandedCast=null,lastTrailAt=-Infinity,retrievalProgress=0;
  const target=new THREE.Vector3(),rodTip=new THREE.Vector3(),castDirection=new THREE.Vector3(),handOffset=new THREE.Vector3();
  let pointerX=null,lastStatus='';
  function getTarget(distance=session.distance){return target.set(player.x-Math.sin(session.fishYaw)*distance,.06,player.z-Math.cos(session.fishYaw)*distance);}
  function insideWater(x,z,margin=.995){return isPondWater(x,z,margin);}
  function waterPoint(yaw){return insideWater(player.x-Math.sin(yaw)*FISHING.distance,player.z-Math.cos(yaw)*FISHING.distance,.98);}
  function findShore(yaw){
    let wet=null;
    for(let d=.5;d<=55;d+=.5)if(insideWater(player.x-Math.sin(yaw)*d,player.z-Math.cos(yaw)*d)){wet=d;break;}
    if(wet===null)return Infinity;
    let dry=wet-.5;for(let i=0;i<20;i++){const d=(dry+wet)*.5;if(insideWater(player.x-Math.sin(yaw)*d,player.z-Math.cos(yaw)*d))wet=d;else dry=d;}return wet;
  }
  // Motion uses the actual fish position. Effects stop at the shoreline when the
  // allowed final ten meters include the player's dry-bank clearing.
  function surfaceTarget(distance=session.distance){
    getTarget(distance);
    if(!insideWater(target.x,target.z)){
      if(Number.isFinite(shorelineDistance))getTarget(Math.max(distance,shorelineDistance+.24));
      if(!insideWater(target.x,target.z))target.copy(lastWetSurface);
    }
    target.y=.025;lastWetSurface.copy(target);return target;
  }
  // Project after the main camera has moved so the label stays on the water point.
  function updateDistanceLabel(){
    distanceLabel.hidden=true;
    if(!['waiting','bite','fighting'].includes(session.state))return;
    distancePoint.copy(surfaceTarget());distancePoint.y=.12;distancePoint.project(camera);
    if(distancePoint.z<-1||distancePoint.z>1||Math.abs(distancePoint.x)>1||Math.abs(distancePoint.y)>1)return;
    const text=session.distance.toFixed(1)+' 米';
    if(text!==lastDistanceText){distanceLabel.textContent=text;lastDistanceText=text;}
    distanceLabel.style.left=((distancePoint.x+1)*50)+'%';
    distanceLabel.style.top=((1-distancePoint.y)*50)+'%';
    distanceLabel.hidden=false;
  }
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
    if(['fighting','caught'].includes(session.state))shorelineDistance=findShore(session.fishYaw);
    for(const event of session.drainEvents()){
      if(event.type==='cast'){shorelineDistance=findShore(session.fishYaw);lastTrailAt=-Infinity;retrievalProgress=0;}
      if(event.type==='hooked'){sounds.play('hooked');pointerX=null;waterEffects.pulse('hook',surfaceTarget(),event.at);onHook();toast('已提竿 · 移动鼠标转竿，按住左键收线');}
      if(event.type==='missed'){toast('鱼脱钩了 · 按空格重新抛竿');onReady(session.castYaw);}
      if(event.type==='failed'){
        if(event.reason==='line-broken')sounds.play('broken');
        const messages={'line-broken':'鱼线断了','escaped':'鱼跑出 50 米了','landed':'鱼跑到了 10 米外的陆地'};
        toast((messages[event.reason]||'钓鱼失败')+' · 按空格重新抛竿');onReady(session.castYaw);
      }
      if(event.type==='exhausted')toast('鱼已耗尽耐力 · 现在可安心收线');
      if(event.type==='caught'){
        sounds.play('caught');
        retrieveStart.copy(surfaceTarget(FISHING.catchDistance));
        retrieveEnd.set(.16,-.53,-.85).applyAxisAngle(axisY,session.fishYaw).add(player);
        sideVector.set(Math.cos(session.fishYaw),0,-Math.sin(session.fishYaw));
        waterEffects.pulse('catch',retrieveStart,event.at);
      }
      if(event.type==='ready')onReady(session.castYaw);
    }
    if(session.active&&session.castAt!==lastLandedCast&&t>=session.castAt+FISHING.flight){
      lastLandedCast=session.castAt;
      if(t-session.castAt-FISHING.flight<1.15)waterEffects.pulse('landing',surfaceTarget(FISHING.distance),session.castAt+FISHING.flight);
    }
    if(session.state==='fighting'&&(session.reeling||session.struggling)&&t-lastTrailAt>=.18){
      lastTrailAt=t;waterEffects.pulse('trail',surfaceTarget(),t,.8+session.efficiency*.24);
    }
    waterEffects.update(t);
    const resource=session.snapshot(t);
    line.material.color.set(resource.lineColor);
    meters.hidden=!['fighting','caught'].includes(session.state);
    meters.style.setProperty('--line-color',resource.lineColor);
    lineFill.style.width=resource.durability+'%';lineValue.textContent=resource.durability.toFixed(1)+' / 100';
    staminaFill.style.width=(resource.fishStamina/resource.fishStaminaMaximum*100)+'%';staminaValue.textContent=resource.fishStamina.toFixed(1)+' / '+resource.fishStaminaMaximum;
    document.querySelector('#line-meter').setAttribute('aria-valuenow',resource.durability.toFixed(1));
    document.querySelector('#stamina-meter').setAttribute('aria-valuemax',resource.fishStaminaMaximum);
    document.querySelector('#stamina-meter').setAttribute('aria-valuenow',resource.fishStamina.toFixed(1));
    if(session.struggling)phaseLabel.textContent=(session.phaseSide>0?'← 向左挣扎':'向右挣扎 →')+' · 削耐方向差 '+resource.struggleAngle.toFixed(0)+'° · '+resource.phaseRemaining.toFixed(1)+' 秒';
    else phaseLabel.textContent=session.fishPhase==='exhausted'?'耐力耗尽 · 永久休息':session.fishPhase==='rest'?'休息中 · '+resource.phaseRemaining.toFixed(1)+' 秒':'收竿中';
    notice.textContent=(session.lastCatchName||session.profile.name)+'已被钓';notice.style.color=session.lastCatchColor;
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
    handOffset.set(.34,-.47,-.12).applyAxisAngle(axisY,session.castYaw);rod.position.copy(player).add(handOffset);
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
    key,pointerMove,pointerDown,release,view,update,updateDistanceLabel,
    isFighting:()=>session.state==='fighting',isActive:()=>session.active,
    hideReflection(){rod.visible=line.visible=marker.visible=false;waterEffects.hide();},
    restoreReflection(){const active=session.active;rod.visible=line.visible=active;marker.visible=['casting','waiting','bite'].includes(session.state);idleRod.visible=!active;waterEffects.show();},
    getState:()=>({...session.snapshot(now()),visuals:{audio:sounds.snapshot(),fishModelCount:scene.getObjectsByProperty('name','tilapia').length,shorelineDistance,rodLift:rod.rotation.x,retrievalProgress,lineVisible:line.visible,lineColor:line.material.color.getHexString(),lineEnd:Array.from(lineArray.slice(-3)),lineTip:Array.from(lineArray.slice(0,3)),waves:waterEffects.snapshot()}}),
  };
}
