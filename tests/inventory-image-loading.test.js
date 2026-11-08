import test from 'node:test';
import assert from 'node:assert/strict';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let serial=0;
async function setup(t){
 const requests=[];
 class FakeImage{
  set src(value){this._src=value;if(value)requests.push(this);}
  get src(){return this._src;}
  succeed(){this.onload?.();}
  fail(){this.onerror?.();}
 }
 globalThis.Image=FakeImage;
 const loader=await import('../inventory-images.js?loading-test='+ ++serial);
 const target=()=>({isConnected:true,complete:true,naturalWidth:100});
 return {requests,loader,target};
}
// Image does not exist in Node; restore globals after each independent loader instance.
function imageGlobal(t){const original=Object.getOwnPropertyDescriptor(globalThis,'Image');globalThis.Image=function(){};t.after(()=>{if(original)Object.defineProperty(globalThis,'Image',original);else delete globalThis.Image;});}

test('visible fish bypass warmup queue, share downloads and reuse completed images',async t=>{
 imageGlobal(t);const {requests,loader,target}=await setup(t);
 loader.preloadInventoryImages(['background-a.png','background-b.png','background-c.png']);
 assert.equal(requests.length,1);assert.equal(requests[0].fetchPriority,'low');
 const states=[];
 for(const src of ['visible-a','visible-b','visible-c','visible-d'])loader.loadInventoryImage(target(),src,state=>states.push(state));
 loader.loadInventoryImage(target(),'visible-a',()=>{});
 await flush();assert.equal(requests.length,4);assert.deepEqual(requests.slice(1).map(r=>r.src),['visible-a','visible-b','visible-c']);
 requests[1].succeed();await flush();assert.equal(requests.at(-1).src,'visible-d');
 // Clear all queued jobs and their timers.
 for(let i=0;i<requests.length;i++){requests[i].succeed();await flush();}
 assert.equal(states.filter(s=>s==='ready').length,4);
 const count=requests.length;loader.loadInventoryImage(target(),'visible-a',()=>{});await flush();assert.equal(requests.length,count);
});

test('stalled warmup frees its slot after 8 seconds while slow visible images keep loading',async t=>{
 imageGlobal(t);t.mock.timers.enable({apis:['setTimeout']});
 const {requests,loader,target}=await setup(t);
 loader.preloadInventoryImages(['stalled-background.png','next-background.png']);
 for(const src of ['stalled-a','stalled-b','stalled-c'])loader.loadInventoryImage(target(),[src,'large-original-'+src],()=>{});
 await flush();assert.equal(requests.length,4);
 t.mock.timers.tick(8000);await flush();
 assert.ok(requests.some(r=>r.src.includes('next-background.webp')));
 assert.equal(requests.filter(r=>r.src.startsWith('stalled-')).length,3);
 requests.find(r=>r.src.includes('next-background.webp')).succeed();
 t.mock.timers.tick(22000);await flush();
 for(const request of requests.filter(r=>r.src.startsWith('stalled-')))request.succeed();
 await flush();assert.ok(!requests.some(r=>r.src.includes('large-original')));
});

test('visible timeout stays bounded at 45 seconds, retries once and avoids a large-original fallback',async t=>{
 imageGlobal(t);t.mock.timers.enable({apis:['setTimeout']});
 const {requests,loader,target}=await setup(t);let state;
 loader.loadInventoryImage(target(),['slow-thumb','large-original'],value=>state=value);await flush();
 t.mock.timers.tick(44999);await flush();assert.equal(state,'loading');assert.equal(requests.length,1);
 t.mock.timers.tick(1);await flush();assert.equal(requests[0].src,'');
 t.mock.timers.tick(500);await flush();assert.equal(requests[1].src,'slow-thumb?retry=1');
 t.mock.timers.tick(45000);await flush();assert.equal(state,'error');assert.equal(requests.length,2);
});

test('a background request becoming visible gets high priority and a fresh foreground deadline',async t=>{
 imageGlobal(t);t.mock.timers.enable({apis:['setTimeout']});
 const {requests,loader,target}=await setup(t);
 loader.preloadInventoryImages(['promoted.png']);t.mock.timers.tick(7900);await flush();
 let state;const src=loader.inventoryImageSources('promoted.png')[0];
 loader.loadInventoryImage(target(),src,value=>state=value);await flush();
 assert.equal(requests.length,1);assert.equal(requests[0].fetchPriority,'high');
 t.mock.timers.tick(44200);await flush();assert.equal(state,'loading');assert.notEqual(requests[0].src,'');
 requests[0].succeed();await flush();assert.equal(state,'ready');assert.equal(requests.length,1);
});

test('expanded originals can load for 90 seconds and still have a bounded 120-second deadline',async t=>{
 imageGlobal(t);t.mock.timers.enable({apis:['setTimeout']});
 const {requests,loader,target}=await setup(t);let state;
 loader.loadInventoryImage(target(),'https://game.test/fish-images/cutouts/large.png',value=>state=value);await flush();
 t.mock.timers.tick(90000);await flush();assert.equal(state,'loading');assert.equal(requests.length,1);assert.notEqual(requests[0].src,'');
 requests[0].succeed();await flush();assert.equal(state,'ready');
 loader.loadInventoryImage(target(),'https://game.test/fish-images/cutouts/stalled.png',value=>state=value);await flush();
 t.mock.timers.tick(119999);await flush();assert.equal(state,'loading');
 t.mock.timers.tick(1);await flush();assert.equal(requests[1].src,'');
 t.mock.timers.tick(500);await flush();assert.ok(requests[2].src.endsWith('?retry=1'));
 t.mock.timers.tick(120000);await flush();assert.equal(state,'error');
});

test('failed images can retry in place with a fresh URL and share the successful result',async t=>{
 imageGlobal(t);const {requests,loader,target}=await setup(t);const states=[];
 const cleanup=loader.loadInventoryImage(target(),'retry-thumb?v=1',value=>states.push(value));await flush();
 requests[0].fail();await flush();assert.equal(states.at(-1),'error');
 cleanup.retry();cleanup.retry();await flush();assert.equal(requests.length,2);
 assert.match(requests[1].src,/retry-thumb\?v=1&retry=manual-/);
 requests[1].succeed();await flush();assert.deepEqual(states,['loading','error','loading','ready']);
 loader.loadInventoryImage(target(),'retry-thumb?v=1',()=>{});await flush();assert.equal(requests.length,2);
 cleanup();cleanup.retry();await flush();assert.equal(requests.length,2);
});

test('a display-image error invalidates the completed request so manual retry can recover',async t=>{
 imageGlobal(t);const {requests,loader,target}=await setup(t);const img=target();let state;
 const cleanup=loader.loadInventoryImage(img,'display-failure',value=>state=value);await flush();
 requests[0].succeed();await flush();assert.equal(state,'ready');
 img.onerror();assert.equal(state,'error');cleanup.retry();await flush();assert.equal(requests.length,2);
 requests[1].succeed();await flush();assert.equal(state,'ready');
});

test('offscreen cards wait for visibility and detached observers are cancelled',async t=>{
 imageGlobal(t);const observers=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,'IntersectionObserver');
 globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
 t.after(()=>{if(original)Object.defineProperty(globalThis,'IntersectionObserver',original);else delete globalThis.IntersectionObserver;});
 const {requests,loader,target}=await setup(t);
 const cancel=loader.loadInventoryImage(target(),'offscreen',()=>{});await flush();assert.equal(requests.length,0);
 cancel();assert.equal(observers[0].disconnected,true);observers[0].callback([{isIntersecting:true}]);await flush();assert.equal(requests.length,0);
 loader.loadInventoryImage(target(),'visible-after-scroll',()=>{});observers[1].callback([{isIntersecting:true}]);await flush();assert.equal(requests.length,1);requests[0].succeed();await flush();
});
