import * as THREE from './vendor/three.module.js';
import { createPond } from './pond-scene.js?v=pond1';
import { createFishing } from './fishing.js?v=distance052';

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let adaptiveScale=1;
function applyResolution(){renderer.setPixelRatio(Math.min(devicePixelRatio,fine?1.4:1)*adaptiveScale);renderer.setSize(innerWidth,innerHeight);}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.06,420);camera.rotation.order='YXZ';scene.add(camera);
const {mat,materials,mesh,box,beam,sun,water,waterUniforms,reflectionTarget,reflectionCamera,reflectionMatrix,ripples,birds,vegetationTime,chairs,cameraOrigin,treeCount}=createPond(scene,camera,renderer);
// Rod lives in camera space: it follows every look direction and stays first person.
const rod = new THREE.Group(); camera.add(rod);
rod.scale.setScalar(.84);rod.position.set(.08,-.19,-.03);rod.rotation.y=-.16;
const corkMat = mat('#ae8955'), rodMat = mat('#263d37', { roughness: .34, metalness: .25 });
const rodPoints = [[.57,-.63,-.75],[.48,-.38,-1.1],[.29,-.02,-1.7],[.04,.28,-2.4],[-.17,.43,-3.1],[-.30,.47,-3.65]];
for (let i = 1; i < rodPoints.length; i++) beam(rod, rodPoints[i-1], rodPoints[i], .025 - i*.0032, .022 - i*.0032, i === 1 ? corkMat : rodMat);
for (let i = 1; i < rodPoints.length; i++) {
  const p = rodPoints[i], guide = mesh(new THREE.TorusGeometry(.035 - i*.0035, .004, 5, 12), materials.metal, rod, [p[0], p[1] - .035, p[2]]);
  guide.rotation.x = .3;
}
mesh(new THREE.CylinderGeometry(.085, .085, .07, 12), materials.metal, rod, [.49,-.43,-1.08]).rotation.z = Math.PI / 2;
mesh(new THREE.CylinderGeometry(.062, .062, .075, 12), mat('#c4b384', { metalness: .5 }), rod, [.445,-.43,-1.08]).rotation.z = Math.PI / 2;
beam(rod, [.44,-.43,-1.08], [.37,-.51,-1.08], .009, .009, materials.metal);
box(rod, corkMat, [.35,-.51,-1.08], [.07,.025,.025]);
const linePoints = rodPoints.slice(1).map(p => new THREE.Vector3(p[0], p[1]-.035, p[2]));
linePoints.push(new THREE.Vector3(-.28,-.28,-3.63));
const fishingLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color:'#dfdfc9',transparent:true,opacity:.58 })); rod.add(fishingLine);
beam(rod, [-.28,-.28,-3.63],[-.28,-.36,-3.63], .015,.015,mat('#ce8b65'));

let targetYaw = 0, targetPitch = -.065, yaw = 0, pitch = -.065, dragging = false, touchId = null;
let lastX = 0, lastY = 0, fine = true, frame = 0, explored = false, contextLost = false;
const keys = new Set(), toastElement = document.querySelector('#toast');
let toastTimer;
function toast(message) { toastElement.textContent = message; toastElement.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 2400); }
function dismissWelcome() { if (!explored) { explored = true; document.querySelector('#welcome').classList.add('dismissed'); } }
function reset() { if(fishing.isActive()){toast('本轮结束后可重置视角');return;}targetYaw = 0; targetPitch = -.065; toast('已回到面向池塘的初始视角'); }
function stopDragging() { dragging = false; touchId = null; canvas.style.cursor = 'grab'; }
const fishing=createFishing({scene,camera,player:cameraOrigin,canvas,idleRod:rod,toast,onReady:heading=>{targetYaw=heading;targetPitch=-.065;keys.clear();stopDragging();},onCast:()=>{dismissWelcome();keys.clear();stopDragging();},onHook:()=>{keys.clear();stopDragging();}});
canvas.style.cursor = 'grab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if(!settingsPanel.hidden||dialog.open)return;
  if(fishing.pointerDown(e))return;
  if(fishing.isFighting())return;
  if (e.button !== 2 && e.pointerType !== 'touch') return;
  if (dragging) return;
  dragging = true; touchId = e.pointerId; lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';canvas.focus();
});
canvas.addEventListener('pointermove', e => {
  if(!settingsPanel.hidden||dialog.open)return;
  fishing.pointerMove(e);if(fishing.isFighting())return;
  if (!dragging || e.pointerId !== touchId) return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;
  targetYaw -= dx*.003;targetPitch = THREE.MathUtils.clamp(targetPitch-dy*.0027,-1.12,.94);
  lastX=e.clientX;lastY=e.clientY;if(Math.abs(dx)+Math.abs(dy)>1)dismissWelcome();
});
canvas.addEventListener('pointerup', stopDragging);canvas.addEventListener('pointercancel',stopDragging);canvas.addEventListener('lostpointercapture',stopDragging);
document.addEventListener('pointerup',e=>{if(e.button===0)fishing.release();});
document.addEventListener('pointercancel',()=>fishing.release());
window.addEventListener('blur', () => {stopDragging();keys.clear();fishing.release();});
document.addEventListener('visibilitychange', () => {stopDragging();keys.clear();fishing.release();});
const settingsToggle=document.querySelector('#settings-toggle'),settingsPanel=document.querySelector('#settings-panel');
function setSettingsOpen(open) {
  settingsPanel.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));
  settingsToggle.title=open?'收起设置':'展开设置';settingsToggle.setAttribute('aria-label',settingsToggle.title);
  if(open){keys.clear();stopDragging();fishing.release();}
  else if(settingsPanel.contains(document.activeElement))settingsToggle.focus({preventScroll:true});
}
settingsToggle.addEventListener('click',()=>setSettingsOpen(settingsPanel.hidden));
document.addEventListener('pointerdown',e=>{
  if(!settingsPanel.hidden&&!settingsPanel.contains(e.target)&&!settingsToggle.contains(e.target))setSettingsOpen(false);
});
document.addEventListener('focusin',e=>{
  if(!settingsPanel.hidden&&!settingsPanel.contains(e.target)&&!settingsToggle.contains(e.target))setSettingsOpen(false);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!settingsPanel.hidden){e.preventDefault();setSettingsOpen(false);settingsToggle.focus({preventScroll:true});}
});
document.querySelector('#reset').addEventListener('click',()=>{reset();setSettingsOpen(false);});
document.querySelector('#quality').addEventListener('click', () => {
  fine=!fine;adaptiveScale=1;applyResolution();renderer.shadowMap.enabled=fine;renderer.shadowMap.needsUpdate=true;reflectionTarget.setSize(fine?1024:640,fine?640:400);
  document.querySelector('#quality span').textContent=`画质 · ${fine?'精细':'流畅'}`;toast(fine?'精细画质 · 树荫与池塘倒影已开启':'流畅画质 · 降低分辨率与反射更新频率');
});
async function fullscreen() {
  setSettingsOpen(false);
  try { if (document.fullscreenElement) await document.exitFullscreen();else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();else toast('当前预览不支持全屏，可在浏览器中打开游戏'); }
  catch { toast('当前窗口限制了全屏，请在独立浏览器中打开'); }
}
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
const dialog=document.querySelector('#help-dialog');
document.querySelector('#help').addEventListener('click',()=>{setSettingsOpen(false);keys.clear();stopDragging();fishing.release();dialog.showModal();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||dialog.open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(!/^(BUTTON|A)$/.test(e.target.tagName)&&settingsPanel.hidden&&fishing.key(e)){e.preventDefault();return;}
  if(fishing.isFighting()&&e.code.startsWith('Arrow'))return;
  if(!settingsPanel.hidden&&e.code.startsWith('Arrow'))return;
  if(e.code.startsWith('Arrow')){e.preventDefault();keys.add(e.code);dismissWelcome();}
  if(e.repeat)return;
  if(e.code==='KeyR')reset();if(e.code==='KeyF')fullscreen();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();applyResolution();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;window.showGameError('浏览器的 3D 渲染被中断，请关闭部分标签页后点击重新加载。');});

// The requested 25 FPS cap keeps GPU demand stable; motion uses elapsed seconds.
rod.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});
const TARGET_FPS=25,FRAME_MS=1000/TARGET_FPS;
const lookDirection=new THREE.Vector3(),lookTarget=new THREE.Vector3();
const clock=new THREE.Timer();clock.connect(document);
let elapsed=0,nextFrame=performance.now(),sampleStart=performance.now(),sampleFrames=0,measuredFps=0,slowSamples=0;
function animate(now){
  if(contextLost)return;
  requestAnimationFrame(animate);
  if(document.hidden){nextFrame=now+FRAME_MS;sampleStart=now;sampleFrames=0;return;}
  if(now<nextFrame)return;
  nextFrame+=FRAME_MS;if(nextFrame<=now)nextFrame=now+FRAME_MS;
  clock.update();const dt=Math.min(clock.getDelta(),.12);elapsed+=dt;
  fishing.update(now/1000);const tracked=fishing.view();
  if(tracked){targetYaw=yaw+Math.atan2(Math.sin(tracked.yaw-yaw),Math.cos(tracked.yaw-yaw));targetPitch=tracked.pitch;}
  if(keys.has('ArrowLeft'))targetYaw+=dt*.8;if(keys.has('ArrowRight'))targetYaw-=dt*.8;
  if(keys.has('ArrowUp'))targetPitch+=dt*.55;if(keys.has('ArrowDown'))targetPitch-=dt*.55;
  targetPitch=THREE.MathUtils.clamp(targetPitch,-1.12,.94);
  const smooth=1-Math.exp(-dt*16);yaw+=(targetYaw-yaw)*smooth;pitch+=(targetPitch-pitch)*smooth;
  camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();
  fishing.updateDistanceLabel();
  rod.position.y=-.19+Math.sin(elapsed*1.1)*.004;rod.rotation.z=Math.sin(elapsed*.65)*.003;
  for(const r of ripples){const phase=(elapsed*.14+r.userData.phase)%1;r.scale.setScalar(.3+phase*2);r.material.opacity=(1-phase)*.08;}
  for(const b of birds){const o=b.userData.origin;b.position.x=o.x+Math.sin(elapsed*.035+b.userData.phase)*8;b.position.y=o.y+Math.sin(elapsed*2+b.userData.phase)*.12;b.rotation.z=Math.sin(elapsed*3+b.userData.phase)*.1;}
  vegetationTime.value=elapsed;waterUniforms.time.value=elapsed;
  if(frame>0&&frame%(fine?2:4)===0){
    reflectionCamera.copy(camera,false);reflectionCamera.position.y=2*water.position.y-camera.position.y;
    camera.getWorldDirection(lookDirection);lookTarget.copy(camera.position).add(lookDirection);lookTarget.y=2*water.position.y-lookTarget.y;
    reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(lookTarget);reflectionCamera.updateMatrixWorld();
    reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
    water.visible=false;rod.visible=false;fishing.hideReflection();
    renderer.setRenderTarget(reflectionTarget);renderer.render(scene,reflectionCamera);renderer.setRenderTarget(null);
    water.visible=true;fishing.restoreReflection();
  }
  renderer.render(scene,camera);frame++;sampleFrames++;
  if(frame===3){sampleStart=performance.now();sampleFrames=0;}
  if(now-sampleStart>=2000){
    measuredFps=sampleFrames*1000/(now-sampleStart);sampleStart=now;sampleFrames=0;
    slowSamples=measuredFps<21?slowSamples+1:0;
    if(slowSamples>=2&&adaptiveScale>.70){adaptiveScale=Math.max(.70,adaptiveScale-.15);applyResolution();slowSamples=0;}
  }
}
animate(performance.now());
document.querySelector('#loading').classList.add('done');
setTimeout(()=>{document.querySelector('#loading').hidden=true;},750);
window.lakeside={getState:()=>({version:'0.5.2',scene:'summer-pond',fishing:fishing.getState(),yaw,pitch,targetYaw,targetPitch,fine,explored,dragging,frames:frame,camera:camera.position.toArray(),rodFollowsCamera:rod.parent===camera,targetFps:TARGET_FPS,measuredFps,adaptiveScale,chairs,treeCount,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2!==false})};
