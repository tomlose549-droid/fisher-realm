import {createRenderSettings,nextFrameTime} from './render-settings.js';
import {Metrics,AutoQuality} from './rendering/performance.js';
import {mapUnlocked} from './shop-progression.js';
import {createMapEntry} from './map-entry.js';
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
import {createMapSession} from './map-session.js';
import {getMapContext,DEFAULT_MAP_ID} from './map-registry.js';
import {createIdleRod} from './idle-rod.js';
import {createOwnerPanel} from './owner-panel.js';
import { createFishing } from './fishing.js';

// An older cached HTML entry must reload before it can launch the new module graph.
if(!releaseVersion()){
  const button=document.querySelector('#error button');
  if(button)button.onclick=()=>{const next=new URL(location.href);next.searchParams.set('reload',Date.now());location.replace(next.href);};
  throw new Error('页面入口已更新，请点击重新加载以获取最新版本。');
}

const renderSettings=createRenderSettings();
const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let adaptiveScale=1,renderBusy=false,renderOperation=0,initialPreparation=null,renderSettledAt=0;
const renderMetrics=new Metrics(renderer),autoQuality=new AutoQuality();renderer.info.autoReset=false;
function applyResolution(){const tier=renderSettings.value.quality,limit=map?.context.id==='summer-pond'?({low:1.4,medium:1,high:1.35}[tier]):tier==='medium'?1:1.4;renderer.setPixelRatio(Math.min(devicePixelRatio,limit)*adaptiveScale);renderer.setSize(innerWidth,innerHeight);map?.resize();sceneDirty=true;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.06,420);camera.rotation.order='YXZ';scene.add(camera);
let map=null;
const encounters=()=>map?.context.encounters??getMapContext().encounters;
const equipment=createIdleRod(camera),rod=equipment.root;

let targetYaw=0,targetPitch=-.065,yaw=targetYaw,pitch=targetPitch,dragging=false,touchId=null;
let lastX = 0, lastY = 0, fine = renderSettings.value.quality!=='low', frame = 0, explored = false, contextLost = false;
const keys = new Set(), toastElement = document.querySelector('#toast');
let toastTimer;
function toast(message) { toastElement.textContent = message; toastElement.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 2400); }
function dismissWelcome() { if (!explored) { explored = true; document.querySelector('#welcome').classList.add('dismissed'); } }
function reset() { if(!map)return;if(fishing.isActive()){toast('本轮结束后可重置视角');return;}targetYaw=map.context.spawn.yaw;targetPitch=map.context.spawn.pitch;toast(map.context.labels.reset); }
function stopDragging() { dragging = false; touchId = null; canvas.style.cursor = 'grab'; }
const gameTime=new GameTime();
let sceneDirty=true,inWorld=true,worldReturn=()=>{};
gameTime.pause();
// Closing a previous modal queues its close event; only the last modal may resume.
function prepareModal(){
  setSettingsOpen(false);keys.clear();stopDragging();fishing.release();
  if(!gameTime.paused){gameTime.pause();fishing.update(gameTime.now());fishing.pauseAudio();}
  for(const open of document.querySelectorAll('dialog[open]'))open.close();
  sceneDirty=true;
}
function finishModal(){discoveries.flush();playerStorage.flush();if(!inWorld&&!renderBusy&&!document.querySelector('dialog[open]')){gameTime.resume();fishing.resumeAudio();clock.reset();renderMetrics.resetWindow();nextFrame=performance.now();sampleStart=nextFrame;sampleFrames=0;}}
const saveSlots=createSaveSlots();
const playerStorage=createPlayerStorage({storage:saveSlots.storage,onSaveError:()=>toast('存储空间不足或不可用，请稍后重试保存')});
const inventory=createInventory({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal});
const discoveries=createFishDiscoveries({storage:saveSlots.storage,items:[...playerStorage.model.inventory.items,...playerStorage.model.boxes.flatMap(box=>box.items)],onSaveError:()=>toast('图鉴解锁记录暂未保存，本次游戏仍可查看')});
window.addEventListener('focus',()=>discoveries.flush());
window.addEventListener('pagehide',()=>{fishing.interrupt();discoveries.flush();playerStorage.flush();});
window.addEventListener('focus',()=>playerStorage.flush());
createWarehouse({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal,beforeOpen:prepareWorldReturn,onOpened:returnToWorld});
const coinControls=createCoinControls({store:playerStorage,toast,onOpen:prepareModal,onClose:finishModal});
const lureCasting=createLureCasting({store:playerStorage,getEncounters:encounters});
const shop=createShop({store:playerStorage,getEncounters:encounters,onOpen:prepareModal,onClose:finishModal,isFishing:()=>fishing.isActive()});
const mapSession=createMapSession({
  createMap:prepareMapView,
  createFishing:(next,ownerState)=>createFishing({ownerState,onRoundEnd:outcome=>lureCasting.finish(outcome),prepareCast:options=>lureCasting.prepare(options),beginFight:()=>lureCasting.beginFight(),scene,camera,player:next.playerPosition,mapContext:next.context,canvas,idleRod:rod,toast,getTime:()=>gameTime.now(),onCaught:name=>{inventory.addFish(name);discoveries.unlock(name);},onReady:heading=>{targetYaw=heading;targetPitch=next.context.spawn.pitch;keys.clear();stopDragging();},onCast:()=>{dismissWelcome();keys.clear();stopDragging();},onHook:()=>{keys.clear();stopDragging();}}),
  onRelease:()=>renderer.renderLists.dispose()
});
// UI/input listeners are registered once and forward to the currently owned fishing instance.
const fishing={...Object.fromEntries(['key','pointerDown','pointerMove','mouseButtons','release','update','updateDistanceLabel','interrupt','pauseAudio','resumeAudio','view','hideReflection','restoreReflection','setForcedFish'].map(method=>[method,(...args)=>mapSession.fishing?.[method](...args)])),
  isActive:()=>mapSession.fishing?.isActive()??false,isFighting:()=>mapSession.fishing?.isFighting()??false,getState:()=>mapSession.getState(),getOwnerState:()=>mapSession.getOwnerState()};
createSavePanel({saves:saveSlots,onOpen:prepareModal,onClose:finishModal,beforeChange:action=>{if(action!=='delete')fishing.interrupt();const itemsSaved=playerStorage.flush(),guideSaved=discoveries.flush();return itemsSaved&&guideSaved;}});
canvas.style.cursor = 'grab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if(renderBusy||inWorld||!settingsPanel.hidden||Boolean(document.querySelector('dialog[open]')))return;
  if(fishing.pointerDown(e))return;
  if(fishing.isFighting())return;
  if (e.button !== 2 && e.pointerType !== 'touch') return;
  if (dragging) return;
  dragging = true; touchId = e.pointerId; lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';canvas.focus();
});
canvas.addEventListener('pointermove', e => {
  if(renderBusy||inWorld||!settingsPanel.hidden||Boolean(document.querySelector('dialog[open]')))return;
  fishing.pointerMove(e);if(fishing.isFighting())return;
  if (!dragging || e.pointerId !== touchId) return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;
  targetYaw -= dx*.003;targetPitch = THREE.MathUtils.clamp(targetPitch-dy*.0027,-1.12,.94);
  lastX=e.clientX;lastY=e.clientY;if(Math.abs(dx)+Math.abs(dy)>1)dismissWelcome();
});
canvas.addEventListener('pointerup', stopDragging);canvas.addEventListener('pointercancel',stopDragging);canvas.addEventListener('lostpointercapture',stopDragging);
// Mouse events include intermediate button changes that pointerup omits in chords.
canvas.addEventListener('mousedown',e=>{
  if(renderBusy||inWorld||!settingsPanel.hidden||document.querySelector('dialog[open]'))return;
  fishing.mouseButtons(e);
});
document.addEventListener('mouseup',e=>{if(e.button===0)fishing.release();});
document.addEventListener('pointerup',e=>{if(e.button===0)fishing.release();});
document.addEventListener('pointercancel',()=>fishing.release());
window.addEventListener('blur', () => {stopDragging();keys.clear();fishing.release();});
document.addEventListener('visibilitychange', () => {stopDragging();keys.clear();fishing.release();renderMetrics.resetWindow();});
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
const qualityNames={low:'低',medium:'中',high:'高'};
function syncRenderControls(){document.querySelector('#quality span').textContent='画质 · '+qualityNames[renderSettings.value.quality];document.querySelector('#auto-render').checked=renderSettings.value.automatic;document.querySelector('#show-performance').checked=renderSettings.value.showStats;document.querySelector('#performance-panel').hidden=!renderSettings.value.showStats;}
function loadingView(open){document.querySelector('#render-loading').hidden=!open;canvas.setAttribute('aria-busy',String(open));}
function renderProgress(kind,done,total){document.querySelector('#render-progress').textContent=kind==='compile'?'正在准备湖岸光照…':'正在准备湖岸素材'+(total?'（'+done+'/'+total+'）':'…');}
const renderHooks={before(){rod.visible=false;fishing.hideReflection();},after(){fishing.restoreReflection();if(!mapSession.fishing)rod.visible=true;}};
async function prepareMapView(id){renderBusy=true;loadingView(true);initialPreparation=new AbortController();try{
 try{return await createMapRuntime({scene,camera,renderer,id,quality:renderSettings.value.quality,onProgress:renderProgress,signal:initialPreparation.signal,hooks:renderHooks});}
 catch(error){if(id!=='summer-pond'||renderSettings.value.quality==='low'&&!initialPreparation.signal.aborted)throw error;renderSettings.set({quality:'low'});fine=false;syncRenderControls();toast('写实场景暂不可用，已切回当前场景');return await createMapRuntime({scene,camera,renderer,id,quality:'low',onProgress:renderProgress,hooks:renderHooks});}
}finally{initialPreparation=null;renderBusy=false;loadingView(false);}}
async function changeQuality(tier){if(!['low','medium','high'].includes(tier))throw Error('画质无效');renderSettings.set({quality:tier});fine=tier!=='low';syncRenderControls();
 if(initialPreparation){if(tier==='low')initialPreparation.abort();return;}
 if(!map){adaptiveScale=1;applyResolution();return;}
 const token=++renderOperation;renderBusy=true;loadingView(true);keys.clear();stopDragging();fishing.release();if(!gameTime.paused){gameTime.pause();fishing.update(gameTime.now());fishing.pauseAudio();}
 try{await map.setQuality(tier);}catch(error){if(token!==renderOperation)return;if(tier!=='low'){renderSettings.set({quality:'low'});fine=false;syncRenderControls();await map.setQuality('low');toast('写实场景暂不可用，已切回当前场景');}else{toast('画面准备失败，请返回地图重试');throw error;}}
 finally{if(token===renderOperation){renderBusy=false;loadingView(false);autoQuality.reset();adaptiveScale=1;applyResolution();renderSettledAt=performance.now();renderMetrics.resetWindow();sceneDirty=true;clock.reset();nextFrame=performance.now();if(!inWorld&&!document.querySelector('dialog[open]')){gameTime.resume();fishing.resumeAudio();}canvas.focus({preventScroll:true});}}
}
document.querySelector('#quality').addEventListener('click',()=>{const tiers=['low','medium','high'];void changeQuality(tiers[(tiers.indexOf(renderSettings.value.quality)+1)%3]).catch(console.error);});
document.querySelector('#auto-render').addEventListener('change',event=>{renderSettings.set({automatic:event.target.checked});autoQuality.reset();adaptiveScale=1;map?.setAdaptive(1);applyResolution();});
document.querySelector('#show-performance').addEventListener('change',event=>{renderSettings.set({showStats:event.target.checked});syncRenderControls();});
document.querySelector('#render-fallback').addEventListener('click',()=>void changeQuality('low').catch(console.error));
syncRenderControls();
const frameSelect=document.querySelector('#max-fps');frameSelect.value=String(renderSettings.value.maxFps);
frameSelect.addEventListener('change',()=>{renderSettings.set({maxFps:Number(frameSelect.value)});TARGET_FPS=renderSettings.value.maxFps;frameSelect.value=String(TARGET_FPS);nextFrame=performance.now();sampleStart=nextFrame;sampleFrames=0;slowSamples=0;toast('最高帧率 · '+TARGET_FPS+'帧');});
async function fullscreen() {
  setSettingsOpen(false);
  try { if (document.fullscreenElement) await document.exitFullscreen();else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();else toast('当前预览不支持全屏，可在浏览器中打开游戏'); }
  catch { toast('当前窗口限制了全屏，请在独立浏览器中打开'); }
}
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
const dialog=document.querySelector('#help-dialog');
const ownerPanel=createOwnerPanel({fishing,toast,onRedeem:code=>playerStorage.run('redeemCode',[code]),onGive:name=>{const result=playerStorage.run('giveFish',[name]);if(result.ok)discoveries.unlock(name);return result;},onClearAll:()=>inventory.clearAll(),onRich:()=>coinControls.openRich(),onOwnerHack:()=>shop.openOwnerHack(),onOpen:prepareModal});
document.querySelector('#owner-dialog').addEventListener('close',finishModal);
document.querySelector('#give-dialog').addEventListener('close',finishModal);
createFishGuide({onOpen:prepareModal,onClose:finishModal,isDiscovered:id=>discoveries.has(id),getEncounters:encounters});
document.querySelector('#help').addEventListener('click',()=>{prepareModal();renderFishHelp(document,FISH_DATA,encounters());dialog.showModal();});
dialog.addEventListener('close',finishModal);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('keydown',e=>{
  if(renderBusy||inWorld||e.defaultPrevented||Boolean(document.querySelector('dialog[open]'))||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
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

// The display cap is independent of elapsed-time fishing rules and reflection cadence.
let TARGET_FPS=renderSettings.value.maxFps;
const clock=new THREE.Timer();clock.connect(document);
let elapsed=0,nextFrame=performance.now(),sampleStart=performance.now(),sampleFrames=0,measuredFps=0,slowSamples=0;
function animate(now){
  if(contextLost)return;
  requestAnimationFrame(animate);
  if(inWorld||!map||renderBusy){clock.update();sceneDirty=false;nextFrame=now+1000/TARGET_FPS;sampleStart=now;sampleFrames=0;return;}
  if(document.hidden){nextFrame=now+1000/TARGET_FPS;sampleStart=now;sampleFrames=0;return;}
  // Keep the last canvas as a static backdrop; resize requests one fresh frame.
  if(gameTime.paused&&!sceneDirty){clock.update();nextFrame=now+1000/TARGET_FPS;sampleStart=now;sampleFrames=0;return;}
  if(now<nextFrame)return;
  nextFrame=nextFrameTime(now,nextFrame,TARGET_FPS);
  renderMetrics.begin(now);const refreshScene=sceneDirty;sceneDirty=false;
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
  map.renderReflection({frame,fine,time:elapsed,force:refreshScene,before:()=>{rod.visible=false;fishing.hideReflection();},after:()=>fishing.restoreReflection(),metrics:renderMetrics});
  renderMetrics.measure('main',()=>renderer.render(scene,camera));frame++;sampleFrames++;
  if(renderMetrics.end(now)){const m=renderMetrics.snapshot;if(!gameTime.paused&&now-renderSettledAt>5000&&autoQuality.update({time:now,p95:Math.max(m.cpuP95,m.fps<TARGET_FPS*.94?1000/TARGET_FPS:0),cap:TARGET_FPS,enabled:renderSettings.value.automatic})){adaptiveScale=autoQuality.scale;map.setAdaptive(adaptiveScale);applyResolution();}if(renderSettings.value.showStats){document.querySelector('#performance-values').textContent=m.fps.toFixed(1)+' FPS · 帧间隔 '+m.frameMs.toFixed(1)+'ms · CPU '+m.cpuMs.toFixed(1)+'ms · Draw Call '+m.calls+' · 三角形 '+m.triangles.toLocaleString();}}
  if(gameTime.paused){sampleStart=now;sampleFrames=0;return;}
  if(frame===3){sampleStart=performance.now();sampleFrames=0;}
  if(now-sampleStart>=2000){
    measuredFps=sampleFrames*1000/(now-sampleStart);sampleStart=now;sampleFrames=0;
    slowSamples=measuredFps<21?slowSamples+1:0;
    // Automatic quality is sampled independently of gameplay time above.
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
window.lakeside={setQuality:changeQuality,getState:()=>({quality:renderSettings.value.quality,renderBusy,renderMetrics:renderMetrics.snapshot,screen:inWorld?'world':'lake',paused:gameTime.paused,activeSave:saveSlots.activeId,inventory:inventory.snapshot(),storage:playerStorage.snapshot().storage,version:releaseVersion(),scene:map?.context.id??null,map:map?.getDiagnostics()??{disposed:true,chairs:[],treeCount:0},mapSession:mapSession.diagnostics(),gpu:{...renderer.info.memory},fishing:fishing.getState(),yaw,pitch,targetYaw,targetPitch,fine,explored,dragging,frames:frame,camera:camera.position.toArray(),rodFollowsCamera:rod.parent===camera,targetFps:TARGET_FPS,measuredFps,adaptiveScale,chairs:map?.getDiagnostics().chairs??[],treeCount:map?.getDiagnostics().treeCount??0,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2!==false})};

function prepareWorldReturn(){
  fishing.interrupt();const itemsSaved=playerStorage.flush(),guideSaved=discoveries.flush();
  if(!itemsSaved||!guideSaved){toast('进度暂未保存，无法离开钓点；请重试保存。');return false;}
  return true;
}
function returnToWorld(){
  inWorld=true;keys.clear();stopDragging();fishing.release();gameTime.pause();fishing.pauseAudio();mapSession.leave();map=null;document.querySelector('#game').classList.add('world-mode');worldReturn();return true;
}
const mapEntry=createMapEntry({store:playerStorage,getFee:id=>getMapContext(id).entryFee,isUnlocked:id=>mapUnlocked(playerStorage.model.quests,id),
  async prepare(id){
    map=await mapSession.enter(id);autoQuality.reset();adaptiveScale=1;applyResolution();renderSettledAt=performance.now();renderMetrics.resetWindow();
    document.querySelector('.location h2').textContent=map.context.name+' · '+(map.context.labels.spot??(id==='amazon-confluence'?'雨林木平台':'林间钓位'));
    const weather=document.querySelector('.location p'),icon=weather.querySelector('svg'),breeze=weather.querySelector('span');breeze.textContent=map.context.labels.breeze??'微风拂面';weather.replaceChildren(icon,document.createTextNode((map.context.labels.weather??'晴朗夏日')+' '),breeze);
    yaw=targetYaw=map.context.spawn.yaw;pitch=targetPitch=map.context.spawn.pitch;camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();return map;
  },
  activate(){inWorld=false;document.querySelector('#game').classList.remove('world-mode');gameTime.resume();fishing.resumeAudio();clock.reset();nextFrame=performance.now();sampleStart=nextFrame;sampleFrames=0;slowSamples=0;sceneDirty=true;canvas.focus({preventScroll:true});},
  rollback:returnToWorld
});
export const gameUI={
  setWorldReturn(callback){worldReturn=callback;},
  subscribeBalance(callback){playerStorage.subscribe(()=>callback(playerStorage.model.coins,playerStorage.model.quests));callback(playerStorage.model.coins,playerStorage.model.quests);},
  async enter(id=DEFAULT_MAP_ID){if(!inWorld)throw Error('请先返回世界地图');return mapEntry.enter(id);},
  openWarehouse(){document.querySelector('#warehouse-toggle').click();}
};
