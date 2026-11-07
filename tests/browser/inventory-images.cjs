const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),fish=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',"import {FISH_DATA} from './fish-data.js';console.log(JSON.stringify(FISH_DATA))"],{cwd:root,encoding:'utf8'}));
let mode='all',active=0,peak=0;const requests=[];const types={'.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.html':'text/html'};
const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname.slice(1))||'index.html',file=path.resolve(root,name);if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();requests.push(name);const thumb=name.includes('/thumbnails/');if(thumb&&mode==='fallback'&&name.endsWith('/oscar.webp'))return res.writeHead(404).end();if(mode==='error'&&name.startsWith('fish-images/'))return res.writeHead(503).end();const data=fs.readFileSync(file);if(thumb){active++;peak=Math.max(peak,active);}setTimeout(()=>{res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=31536000'}).end(data);if(thumb)active--;},thumb?150:0);}catch{res.writeHead(404).end();}});
async function revealImages(p,expected){
 for(const card of await p.locator('#fish-pile-list .inventory-fish').all()){
  await card.scrollIntoViewIfNeeded();
  await card.waitFor({state:'visible'});
  await p.waitForFunction(({id,expected})=>document.querySelector('[data-fish-id="'+id+'"]')?.dataset.imageState===expected,{id:await card.getAttribute('data-fish-id'),expected},{timeout:30000});
 }
 await p.locator('#fish-pile-list').evaluate(e=>e.scrollTop=0);
 await p.waitForFunction(expected=>[...document.querySelectorAll('.inventory-fish')].length===22&&[...document.querySelectorAll('.inventory-fish')].every(e=>e.dataset.imageState===expected),expected,{timeout:30000});
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],chromiumSandbox:false});try{const reports=[];
for(const scenario of ['all','warm','fallback','error']){mode=scenario;requests.length=0;peak=0;const c=await b.newContext({viewport:{width:1440,height:900}});try{const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const saved={version:1,items:[{id:'1',name:'佛罗里达雀鳝',x:0,y:0},{id:'2',name:'大口黑鲈',x:0,y:1},{id:'3',name:'地图鱼',x:3,y:1},...fish.map((f,i)=>({id:String(i+4),name:f.name,x:null,y:null}))]};await p.addInitScript(s=>localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(s)),saved);await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.lakeside);await p.locator('#loading').waitFor({state:'hidden'});
if(scenario==='warm'){
 await p.waitForFunction(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/thumbnails/')&&e.responseEnd>0).length===19,null,{timeout:20000});
 assert.equal(peak,1,'background warmup must use only one slot');
 assert.equal(await p.locator('#inventory-dialog').evaluate(e=>e.open),false);
}
await p.locator('#backpack-toggle').click();await revealImages(p,scenario==='error'?'error':'ready');assert.deepEqual(await p.evaluate(()=>window.lakeside.getState().inventory.items),saved.items);
if(scenario!=='error')assert.equal(await p.locator('.inventory-fish img').evaluateAll(a=>a.every(i=>i.complete&&i.naturalWidth>0&&getComputedStyle(i).objectFit==='contain')),true);
if(scenario==='all'||scenario==='warm'){assert.ok(peak<=4,peak);for(const f of fish){const n='fish-images/thumbnails/'+f.inventory.image.replace(/\.[^./]+$/,'.webp');assert.equal(requests.filter(x=>x===n).length,1,n);}assert.ok(!requests.some(n=>n.startsWith('fish-images/')&&!n.includes('/thumbnails/')));const count=requests.filter(n=>n.includes('/thumbnails/')).length;await p.locator('[data-fish-id="1"]').click();await p.waitForFunction(()=>[...document.querySelectorAll('.inventory-fish')].every(e=>e.dataset.imageState==='ready'));assert.equal(requests.filter(n=>n.includes('/thumbnails/')).length,count);fs.mkdirSync(path.join(root,'.qa'),{recursive:true});await p.screenshot({path:path.join(root,'.qa/all-fish-images-fixed.png')});}
if(scenario==='fallback')assert.ok(requests.includes('fish-images/cutouts/oscar.png'));
if(scenario==='error'){mode='all';await p.locator('#inventory-close').click();await p.locator('#inventory-dialog').waitFor({state:'hidden'});await p.locator('#backpack-toggle').click();await revealImages(p,'ready');}
assert.deepEqual(errors,[]);reports.push({scenario,fish:19,cards:22,peak,saved:true,errors});}finally{await c.close();}}
console.log(JSON.stringify(reports));}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
