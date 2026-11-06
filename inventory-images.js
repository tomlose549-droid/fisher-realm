import {assetUrl} from './release-assets.js';

// Share downloads across identical fish, rerenders and reopening the bag.
const downloads=new Map(),queue=[];
let active=0;
function pump(){
  while(active<4&&queue.length){const job=queue.shift();active++;job.run().then(job.resolve,job.reject).finally(()=>{active--;pump();});}
}
function readImage(src){return new Promise((resolve,reject)=>{
  const image=new Image();let timer;
  const finish=(error)=>{clearTimeout(timer);image.onload=null;image.onerror=null;if(error){image.src='';reject(error);}else resolve(image);};
  image.onload=()=>finish();image.onerror=()=>finish(new Error('Image request failed'));
  timer=setTimeout(()=>finish(new Error('Image request timed out')),120000);image.src=src;
});}
function sharedImage(src){
  if(downloads.has(src))return downloads.get(src);
  const promise=new Promise((resolve,reject)=>{queue.push({resolve,reject,async run(){
    for(let attempt=0;attempt<2;attempt++){
      try{return await readImage(src+(attempt?(src.includes('?')?'&':'?')+'retry='+attempt:''));}
      catch(error){if(attempt===1)throw error;await new Promise(r=>setTimeout(r,750));}
    }
  }});});
  downloads.set(src,promise);promise.catch(()=>{if(downloads.get(src)===promise)downloads.delete(src);});pump();return promise;
}
export function inventoryImageSources(image){
  return [assetUrl('./fish-images/thumbnails/'+image.replace(/\.[^./]+$/,'.webp')),assetUrl('./fish-images/'+image)];
}
export function loadInventoryImage(img,src,onState){
  onState('loading');
  (async()=>{
    for(const source of Array.isArray(src)?src:[src]){
      try{
        const ready=await sharedImage(source);
        if(!img.isConnected)return;
        img.onload=()=>onState('ready');img.onerror=()=>onState('error');img.src=ready.src;
        if(img.complete&&img.naturalWidth>0)onState('ready');return;
      }catch{/* Missing thumbnails can use the intact source image. */}
    }
    if(img.isConnected)onState('error');
  })();
}
