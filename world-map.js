import {createSaveSlots} from './save-slots.js';
import {PLAYER_STORAGE_KEY} from './player-storage.js';
import {assetUrl,releaseVersion} from './release-assets.js';
import {WORLD_LOCATIONS,WORLD_IMAGE} from './world-map-data.js';
const root=document.querySelector('#world-map'),viewport=document.querySelector('#world-viewport'),surface=document.querySelector('#world-surface'),image=document.querySelector('#world-image'),card=document.querySelector('#world-preview'),preview=document.querySelector('#world-preview-image'),status=document.querySelector('#world-status');
let game=null,gamePromise=null,selected=null,busy=false,ready=false,zoom=1,panX=0,panY=0,pinch=null,moved=false;
const pointers=new Map(),markers=new Map();
for(const location of WORLD_LOCATIONS){
  const marker=document.createElement('button');marker.type='button';marker.id=location.markerId;marker.className='world-map-point';marker.dataset.mapId=location.id;marker.disabled=true;
  marker.setAttribute('aria-label',location.name+'，第一次点击预览，再次点击进入');marker.setAttribute('aria-controls','world-preview');marker.setAttribute('aria-expanded','false');
  marker.style.left=location.x*100+'%';marker.style.top=location.y*100+'%';marker.append(document.createElement('span'));surface.append(marker);markers.set(location.id,marker);
  marker.addEventListener('click',()=>{if(selected?.id!==location.id){select(location);say('再次点击同一个白色光点进入钓点');}else void run('enter');});
}
document.querySelector('#world-version').textContent='V'+releaseVersion();
function say(message){status.textContent=message;}
function enableMarkers(){for(const marker of markers.values())marker.disabled=busy||!ready;}
function select(location){
  selected=location;card.hidden=!location;
  for(const [id,marker]of markers){const active=id===location?.id;marker.setAttribute('aria-expanded',String(active));marker.classList.toggle('selected',active);}
  if(!location)return;
  document.querySelector('#world-location-name').textContent=location.name;document.querySelector('#world-region').textContent=location.region;
  preview.alt=location.name+' 3D场景预览';preview.hidden=false;document.querySelector('#world-preview-fallback').hidden=true;
  const source=assetUrl(location.preview);if(preview.src!==source)preview.src=source;
}
function layout(){
  const box=viewport.getBoundingClientRect(),ratio=(image.naturalWidth||1672)/(image.naturalHeight||941),w=Math.min(box.width-24,(box.height-24)*ratio),h=w/ratio;
  surface.style.width=w+'px';surface.style.height=h+'px';
  panX=Math.max(-(w*zoom+box.width)/2+45,Math.min((w*zoom+box.width)/2-45,panX));panY=Math.max(-(h*zoom+box.height)/2+45,Math.min((h*zoom+box.height)/2-45,panY));
  surface.style.transform=`translate(-50%,-50%) translate(${panX}px,${panY}px) scale(${zoom})`;
}
function balance(value){document.querySelector('#world-coins').textContent=value+' 金币';}
function readBalance(){try{const slots=createSaveSlots(),saved=JSON.parse(slots.storage.getItem(PLAYER_STORAGE_KEY)),coins=saved?.storage?.coins;balance(Number.isSafeInteger(coins)&&coins>=0?coins:0);}catch{balance('—');}}
function showWorld(){readBalance();root.hidden=false;document.querySelector('#game').classList.add('world-mode');select(null);pointers.clear();pinch=null;layout();say('点击白色光点选择钓点');}
async function loadGame(){
  if(game)return game;
  if(!gamePromise)gamePromise=import('./main.js').then(module=>{game=module.gameUI;game.setWorldReturn(showWorld);game.subscribeBalance(balance);return game;});
  return gamePromise;
}
async function run(action){
  if(busy)return;document.querySelector('#world-reload').hidden=true;const destination=selected?.id;busy=true;enableMarkers();document.querySelector('#world-warehouse').disabled=true;say(action==='enter'?'正在走向钓点…':'正在打开仓库…');
  try{const runtime=await loadGame();if(action==='enter'){await runtime.enter(destination);root.hidden=true;}else runtime.openWarehouse();document.querySelector('#world-reload').hidden=true;say('点击白色光点选择钓点');}
  catch(error){say('暂时无法加载：'+error.message+'。可重新选择钓点或重新加载。');document.querySelector('#world-reload').hidden=false;}
  finally{busy=false;enableMarkers();document.querySelector('#world-warehouse').disabled=false;}
}
document.querySelector('#world-preview-close').addEventListener('click',()=>select(null));
document.querySelector('#world-warehouse').addEventListener('click',()=>void run('warehouse'));
document.querySelector('#world-reload').addEventListener('click',()=>location.reload());
preview.addEventListener('error',()=>{preview.hidden=true;document.querySelector('#world-preview-fallback').hidden=false;});
image.addEventListener('load',()=>{ready=true;enableMarkers();layout();say('点击白色光点选择钓点');});
image.addEventListener('error',()=>{ready=false;enableMarkers();say('世界地图图片加载失败，请重新加载。');document.querySelector('#world-reload').hidden=false;});image.src=assetUrl(WORLD_IMAGE);
function changeZoom(next){zoom=Math.max(1,Math.min(4,next));layout();}
document.querySelector('#world-zoom-in').addEventListener('click',()=>changeZoom(zoom*1.25));document.querySelector('#world-zoom-out').addEventListener('click',()=>changeZoom(zoom/1.25));document.querySelector('#world-reset').addEventListener('click',()=>{zoom=1;panX=panY=0;layout();});
viewport.addEventListener('wheel',event=>{event.preventDefault();changeZoom(zoom*(event.deltaY<0?1.15:1/1.15));},{passive:false});
function startPinch(){const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2,zoom,panX,panY};}
viewport.addEventListener('pointerdown',event=>{
  if(event.target.closest('button')||busy||(event.pointerType!=='touch'&&event.button!==0)||pointers.size>=2)return;
  event.preventDefault();viewport.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===1)moved=false;else{moved=true;startPinch();}
});
viewport.addEventListener('pointermove',event=>{
  const before=pointers.get(event.pointerId);if(!before)return;event.preventDefault();const dx=event.clientX-before.x,dy=event.clientY-before.y;if(Math.hypot(dx,dy)>2)moved=true;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()];zoom=Math.max(1,Math.min(4,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));panX=pinch.panX+(a.x+b.x)/2-pinch.x;panY=pinch.panY+(a.y+b.y)/2-pinch.y;}else{panX+=dx;panY+=dy;}layout();
});
function endPointer(event){if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);pinch=null;if(!pointers.size&&!moved&&event.type==='pointerup')select(null);}
for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,endPointer);
window.addEventListener('resize',layout);window.addEventListener('keydown',event=>{if(!root.hidden&&!document.querySelector('dialog[open]')&&event.key==='Escape')select(null);});
window.worldMap={getState:()=>({screen:root.hidden?'lake':'world',selected:!!selected,selectedMap:selected?.id??null,busy,ready,zoom,panX,panY,gameLoaded:!!game})};
document.querySelector('#loading').hidden=true;showWorld();
