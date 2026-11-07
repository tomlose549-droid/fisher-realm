import {assetUrl} from './release-assets.js';

// Share downloads across cards, rerenders and background warmup.
// Reserve three of the four slots for visible cards; warmup uses at most one.
const downloads=new Map(),queue=[];
let active=0,backgroundActive=0;
function pump(){
  while(active<4){
    let index=queue.findIndex(job=>job.record.priority===0);
    if(index<0){if(backgroundActive>=1||!queue.length)return;index=0;}
    const job=queue.splice(index,1)[0],background=job.record.priority>0;
    active++;if(background)backgroundActive++;
    readImage(job.record.src,job.record.priority,job.attempt).then(job.resolve,job.reject).finally(()=>{
      active--;if(background)backgroundActive--;pump();
    });
  }
}
function readImage(src,priority,attempt){return new Promise((resolve,reject)=>{
  const image=new Image();let timer;
  image.decoding='async';image.fetchPriority=priority?'low':'high';
  const finish=error=>{clearTimeout(timer);image.onload=null;image.onerror=null;if(error){image.src='';reject(error);}else resolve(image);};
  image.onload=()=>finish();image.onerror=()=>finish(new Error('Image request failed'));
  timer=setTimeout(()=>{const error=new Error('Image request timed out');error.code='IMAGE_TIMEOUT';finish(error);},8000);
  image.src=src+(attempt?(src.includes('?')?'&':'?')+'retry='+attempt:'');
});}
function sharedImage(src,priority=0){
  const existing=downloads.get(src);
  if(existing){existing.priority=Math.min(existing.priority,priority);pump();return existing.promise;}
  const record={src,priority,ready:false};
  record.promise=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const image=await new Promise((resolve,reject)=>{queue.push({record,attempt,resolve,reject});pump();});
        record.ready=true;return image;
      }catch(error){
        // Never let a failed background request retry ahead of visible fish.
        if(record.priority>0||error.code!=='IMAGE_TIMEOUT'||attempt===1)throw error;
        await new Promise(resolve=>setTimeout(resolve,500));
      }
    }
  })();
  downloads.set(src,record);
  record.promise.catch(()=>{if(downloads.get(src)===record)downloads.delete(src);});
  return record.promise;
}
export function inventoryImageSources(image){
  return [assetUrl('./fish-images/thumbnails/'+image.replace(/\.[^./]+$/,'.webp')),assetUrl('./fish-images/'+image)];
}
export function preloadInventoryImages(images){
  // Warm thumbnails only: missing thumbnails must not trigger large source downloads.
  for(const image of new Set(images.filter(Boolean)))sharedImage(inventoryImageSources(image)[0],1).catch(()=>{});
}
export function loadInventoryImage(img,src,onState){
  const sources=Array.isArray(src)?src:[src];
  let cancelled=false,started=false,observer,state;
  const update=next=>{if(!cancelled&&state!==next){state=next;onState(next);}};
  update('loading');
  async function start(){
    if(started||cancelled)return;started=true;observer?.disconnect();
    for(const source of sources){
      if(cancelled||!img.isConnected)return;
      try{
        const ready=await sharedImage(source);
        if(cancelled||!img.isConnected)return;
        img.onload=()=>update('ready');img.onerror=()=>update('error');img.src=ready.src;
        if(img.complete&&img.naturalWidth>0)update('ready');return;
      }catch(error){
        // Slow connections should not fall back to multi-megabyte originals.
        // Missing or undecodable thumbnails may still use the intact source image.
        if(error.code==='IMAGE_TIMEOUT')break;
      }
    }
    if(img.isConnected)update('error');
  }
  if(sources.some(source=>downloads.get(source)?.ready)||typeof IntersectionObserver==='undefined')queueMicrotask(start);
  else{observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))start();},{rootMargin:'64px'});observer.observe(img.parentElement??img);}
  return ()=>{cancelled=true;observer?.disconnect();img.onload=null;img.onerror=null;};
}
