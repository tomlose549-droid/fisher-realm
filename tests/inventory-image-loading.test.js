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

test('stalled warmup frees capacity after 8 seconds; foreground retry queues behind waiting fish and avoids original fallback',async t=>{
 imageGlobal(t);t.mock.timers.enable({apis:['setTimeout']});
 const {requests,loader,target}=await setup(t);
 loader.preloadInventoryImages(['stalled-background.png','next-background.png']);
 for(const src of ['stalled-a','stalled-b','stalled-c'])loader.loadInventoryImage(target(),[src,'large-original-'+src],()=>{});
 let finalState;loader.loadInventoryImage(target(),'next-visible',state=>finalState=state);
 await flush();assert.equal(requests.length,4);
 t.mock.timers.tick(8000);await flush();assert.ok(requests.some(r=>r.src==='next-visible'));
 assert.ok(requests.some(r=>r.src.includes('next-background.webp')));
 requests.find(r=>r.src==='next-visible').succeed();requests.find(r=>r.src.includes('next-background.webp')).succeed();await flush();
 t.mock.timers.tick(500);await flush();assert.equal(requests.filter(r=>r.src.includes('retry=1')).length,3);
 t.mock.timers.tick(8000);await flush();
 assert.equal(finalState,'ready');assert.ok(!requests.some(r=>r.src.includes('large-original')));
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
