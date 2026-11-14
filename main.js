import {createShop} from './shop.js';
import {createLureCasting} from './lure-casting.js';
import {createSaveSlots} from './save-slots.js';
import {createSavePanel} from './save-panel.js';
import {createPlayerStorage} from './player-storage.js';
import {createWarehouse,createCoinControls} from './warehouse.js';
import {preloadInventoryImages} from './inventory-images.js';
import {FISH_DATA} from './fish-data.js';
import {renderFishHelp} from './fish-help.js';
import {createFishGuide} from './fish-guide.js';
import {createFishDiscoveries} from './fish-discoveries.js';
import {releaseVersion} from './release-assets.js';
import {GameTime} from './game-time.js';
import {createInventory} from './inventory.js';
import * as THREE from './vendor/three.module.js';
import {createMapRuntime} from './map-runtime.js';
import {createIdleRod} from './idle-rod.js';
import {createOwnerPanel} from './owner-panel.js';
import { createFishing } from './fishing.js';

// An older cached HTML entry must reload before it can launch the new module graph.
if(!releaseVersion()){
  const button=document.querySelector('#error button');
  if(button)button.onclick=()=>{const next=new URL(location.href);next.searchParams.set('reload',Date.now());location.replace(next.href);};
  throw new Error('页面入口已更新，请点击重新加载以获取最新版本。');
}

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let adaptiveScale=1;
function applyResolution(){renderer.setPixelRatio(Math.min(devicePixelRatio,fine?1.4:1)*adaptiveScale);renderer.setSize(innerWidth,innerHeight);sceneDirty=true;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.06,420);camera.rotation.order='YXZ';scene.add(camera);
const map=await createMapRuntime({scene,camera,renderer}),cameraOrigin=map.playerPosition;
const equipment=createIdleRod(camera),rod=equipment.root;

let targetYaw=map.context.spawn.yaw,targetPitch=map.context.spawn.pitch,yaw=targetYaw,pitch=targetPitch,dragging=false,touchId=null;
let lastX = 0, lastY = 0, fine = true, frame = 0, explored = false, contextLost = false;
const keys = new Set(), toastElement = document.querySelector('#toast');
let toastTimer;
function toast(message) { toastElement.textContent = message; toastElement.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 2400); }
function dismissWelcome() { if (!explored) { explored = true; document.querySelector('#welcome').classList.add('dismissed'); } }
function reset() { if(fishing.isActive()){toast('本轮结束后可重置视角');return;}targetYaw=map.context.spawn.yaw;targetPitch=map.context.spawn.pitch;toast(map.context.labels.reset); }
function stopDragging() { dragging = false; touchId = null; canvas.style.cursor = 'grab'; }
const gameTime=new GameTime();
let sceneDirty=true;
// Closing a previous modal queues its close event; only the last modal may resume.
function prepareModal(){
  setSettingsOpen(false);keys.clear();stopDragging();fishing.release();
  if(!gameTime.paused){gameTime.pause();fishing.update(gameTime.now());fishing.pauseAudio();}
  for(const open of document.querySelectorAll('dialog[open]'))open.close();
  sceneDirty=true;
}
function finishModal(){discoveries.flush();playerStorage.flush();if(!document.querySelector('dialog[open]')){gameTime.resume();fishing.resumeAudio();clock.reset();nextFrame=performance.now();sampleStart=nextFrame;sampleFrames=0;}}
const saveSlots=createSaveSlots();
const playerStorage=createPlayerStorage({storage:saveSlots.storage,onSaveError:()=>toast('存储空间不足或不可用，请稍后重试保存')});
const inventory=createInventory({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal});
const discoveries=createFishDiscoveries({storage:saveSlots.storage,items:[...playerStorage.model.inventory.items,...playerStorage.model.boxes.flatMap(box=>box.items)],onSaveError:()=>toast('图鉴解锁记录暂未保存，本次游戏仍可查看')});
window.addEventListener('focus',()=>discoveries.flush());
window.addEventListener('pagehide',()=>{fishing.interrupt();discoveries.flush();playerStorage.flush();});
window.addEventListener('focus',()=>playerStorage.flush());
createWarehouse({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal});
const coinControls=createCoinControls({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal});
const lureCasting=createLureCasting({store:playerStorage,encounters:map.context.encounters});
const shop=createShop({store:playerStorage,encounters:map.context.encounters,onOpen:prepareModal,onClose:finishModal,isFishing:()=>fishing.isActive()});
const fishing=createFishing({onRoundEnd:outcome=>lureCasting.finish(outcome),prepareCast:options=>lureCasting.prepare(options),scene,camera,player:cameraOrigin,mapContext:map.context,canvas,idleRod:rod,toast,getTime:()=>gameTime.now(),onCaught:name=>{inventory.addFish(name);discoveries.unlock(name);},onReady:heading=>{targetYaw=heading;targetPitch=map.context.spawn.pitch;keys.clear();stopDragging();},onCast:()=>{dismissWelcome();keys.clear();stopDragging();},onHook:()=>{keys.clear();stopDragging();}});
createSavePanel({saves:saveSlots,onOpen:prepareModal,onClose:finishModal,beforeChange:action=>{if(action!=='delete')fishing.interrupt();const itemsSaved=playerStorage.flush(),guideSaved=discoveries.flush();return itemsSaved&&guideSaved;}});
canvas.style.cursor = 'grab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if(!settingsPanel.hidden||Boolean(document.querySelector('dialog[open]')))return;
  if(fishing.pointerDown(e))return;
  if(fishing.isFighting())return;
  if (e.button !== 2 && e.pointerType !== 'touch') return;
  if (dragging) return;
  dragging = true; touchId = e.pointerId; lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';canvas.focus();
});
canvas.addEventListener('pointermove', e => {
  if(!settingsPanel.hidden||Boolean(document.querySelector('dialog[open]')))return;
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
  fine=!fine;adaptiveScale=1;applyResolution();renderer.shadowMap.enabled=fine;renderer.shadowMap.needsUpdate=true;map.setQuality(fine);
  document.querySelector('#quality span').textContent=`画质 · ${fine?'精细':'流畅'}`;toast(fine?'精细画质 · 树荫与池塘倒影已开启':'流畅画质 · 降低分辨率与反射更新频率');
});
async function fullscreen() {
  setSettingsOpen(false);
  try { if (document.fullscreenElement) await document.exitFullscreen();else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();else toast('当前预览不支持全屏，可在浏览器中打开游戏'); }
  catch { toast('当前窗口限制了全屏，请在独立浏览器中打开'); }
}
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
const dialog=document.querySelector('#help-dialog');
const ownerPanel=createOwnerPanel({fishing,toast,onClearAll:()=>inventory.clearAll(),onRich:()=>coinControls.openRich(),onOwnerHack:()=>shop.openOwnerHack(),onOpen:prepareModal});
document.querySelector('#owner-dialog').addEventListener('close',finishModal);
createFishGuide({onOpen:prepareModal,onClose:finishModal,isDiscovered:id=>discoveries.has(id),encounters:map.context.encounters});
document.querySelector('#help').addEventListener('click',()=>{prepareModal();renderFishHelp(document,FISH_DATA,map.context.encounters);dialog.showModal();});
dialog.addEventListener('close',finishModal);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('keydown',e=>{
  if(e.defaultPrevented||Boolean(document.querySelector('dialog[open]'))||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
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
const TARGET_FPS=25,FRAME_MS=1000/TARGET_FPS;
const clock=new THREE.Timer();clock.connect(document);
let elapsed=0,nextFrame=performance.now(),sampleStart=performance.now(),sampleFrames=0,measuredFps=0,slowSamples=0;
function animate(now){
  if(contextLost)return;
  requestAnimationFrame(animate);
  if(document.hidden){nextFrame=now+FRAME_MS;sampleStart=now;sampleFrames=0;return;}
  // Keep the last canvas as a static backdrop; resize requests one fresh frame.
  if(gameTime.paused&&!sceneDirty){clock.update();nextFrame=now+FRAME_MS;sampleStart=now;sampleFrames=0;return;}
  if(now<nextFrame)return;
  nextFrame+=FRAME_MS;if(nextFrame<=now)nextFrame=now+FRAME_MS;
  const refreshScene=sceneDirty;sceneDirty=false;
  clock.update();const dt=gameTime.paused?0:Math.min(clock.getDelta(),.12);elapsed+=dt;
  fishing.update(gameTime.now(now/1000));ownerPanel.update();const tracked=fishing.view();
  if(tracked){targetYaw=yaw+Math.atan2(Math.sin(tracked.yaw-yaw),Math.cos(tracked.yaw-yaw));targetPitch=tracked.pitch;}
  if(keys.has('ArrowLeft'))targetYaw+=dt*.8;if(keys.has('ArrowRight'))targetYaw-=dt*.8;
  if(keys.has('ArrowUp'))targetPitch+=dt*.55;if(keys.has('ArrowDown'))targetPitch-=dt*.55;
  targetPitch=THREE.MathUtils.clamp(targetPitch,-1.12,.94);
  const smooth=1-Math.exp(-dt*16);yaw+=(targetYaw-yaw)*smooth;pitch+=(targetPitch-pitch)*smooth;
  camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();
  fishing.updateDistanceLabel();
  rod.position.y=-.19+Math.sin(elapsed*1.1)*.004;rod.rotation.z=Math.sin(elapsed*.65)*.003;
  map.update(elapsed);
  map.renderReflection({frame,fine,force:refreshScene,before:()=>{rod.visible=false;fishing.hideReflection();},after:()=>fishing.restoreReflection()});
  renderer.render(scene,camera);frame++;sampleFrames++;
  if(gameTime.paused){sampleStart=now;sampleFrames=0;return;}
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
// Warm discovered thumbnails only, after the scene is usable.
setTimeout(()=>{
  const warmup=()=>preloadInventoryImages(FISH_DATA.filter(fish=>discoveries.has(fish.id)).map(fish=>fish.inventory.image));
  if(globalThis.requestIdleCallback)requestIdleCallback(warmup,{timeout:3000});else warmup();
},1500);
window.lakeside={getState:()=>({paused:gameTime.paused,activeSave:saveSlots.activeId,inventory:inventory.snapshot(),storage:playerStorage.snapshot().storage,version:releaseVersion(),scene:map.context.id,map:map.getDiagnostics(),fishing:fishing.getState(),yaw,pitch,targetYaw,targetPitch,fine,explored,dragging,frames:frame,camera:camera.position.toArray(),rodFollowsCamera:rod.parent===camera,targetFps:TARGET_FPS,measuredFps,adaptiveScale,chairs:map.getDiagnostics().chairs,treeCount:map.getDiagnostics().treeCount,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2!==false})};
