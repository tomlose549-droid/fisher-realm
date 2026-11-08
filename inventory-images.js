import {assetUrl} from './release-assets.js';

// Share downloads across cards, rerenders and background warmup.
// Reserve three of the four slots for visible cards; warmup uses at most one.
const downloads=new Map(),queue=[];
let active=0,backgroundActive=0,retryId=0;
const BACKGROUND_TIMEOUT=8000,VISIBLE_TIMEOUT=45000,LARGE_IMAGE_TIMEOUT=120000;
function pump(){
  while(active<4){
    let index=queue.findIndex(job=>job.record.priority===0);
    if(index<0){if(backgroundActive>=1||!queue.length)return;index=0;}
    const job=queue.splice(index,1)[0],background=job.record.priority>0;
    active++;if(background)backgroundActive++;
    readImage(job.record,job.attempt).then(job.resolve,job.reject).finally(()=>{
      active--;if(background)backgroundActive--;pump();
    });
  }
}
function readImage(record,attempt){return new Promise((resolve,reject)=>{
  const image=new Image();let timer,settled=false;
  // Expanded guide originals can be much larger; their thumbnail stays visible.
  const visibleTimeout=record.src.includes('/fish-images/')&&!record.src.includes('/fish-images/thumbnails/')?LARGE_IMAGE_TIMEOUT:VISIBLE_TIMEOUT;
  image.decoding='async';image.fetchPriority=record.priority?'low':'high';
  const finish=error=>{
    if(settled)return;settled=true;clearTimeout(timer);
    if(record.promote===promote)delete record.promote;
    image.onload=null;image.onerror=null;if(error){image.src='';reject(error);}else resolve(image);
  };
  function armTimeout(ms){clearTimeout(timer);timer=setTimeout(()=>{const error=new Error('Image request timed out');error.code='IMAGE_TIMEOUT';finish(error);},ms);}
  function promote(){if(settled)return;image.fetchPriority='high';armTimeout(visibleTimeout);}
  record.promote=promote;
  image.onload=()=>finish();image.onerror=()=>finish(new Error('Image request failed'));
  armTimeout(record.priority?BACKGROUND_TIMEOUT:visibleTimeout);
  const retry=record.retryToken?record.retryToken+'-'+attempt:attempt;
  image.src=record.src+(retry?(record.src.includes('?')?'&':'?')+'retry='+encodeURIComponent(retry):'');
});}
function sharedImage(src,priority=0,retryToken=null){
  const existing=downloads.get(src);
  if(existing){
    const promoted=existing.priority>priority;
    existing.priority=Math.min(existing.priority,priority);if(promoted)existing.promote?.();
    pump();return existing.promise;
  }
  const record={src,priority,ready:false,retryToken};
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
  let cancelled=false,started=false,observer,state,retryToken=null;
  const update=next=>{if(!cancelled&&state!==next){state=next;onState(next);}};
  update('loading');
  async function start(){
    if(started||cancelled||!img.isConnected)return;started=true;observer?.disconnect();update('loading');
    for(const source of sources){
      if(cancelled||!img.isConnected)return;
      try{
        const ready=await sharedImage(source,0,retryToken);
        if(cancelled||!img.isConnected)return;
        img.onload=()=>update('ready');img.onerror=()=>{if(downloads.get(source)?.ready)downloads.delete(source);update('error');};img.src=ready.src;
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
  const cleanup=()=>{cancelled=true;observer?.disconnect();img.onload=null;img.onerror=null;};
  // Retry in place so selection, inventory placement and guide expansion stay intact.
  cleanup.retry=()=>{
    if(cancelled||!img.isConnected||state!=='error')return;
    img.onload=null;img.onerror=null;started=false;
    retryToken='manual-'+Date.now().toString(36)+'-'+ ++retryId;start();
  };
  return cleanup;
}
