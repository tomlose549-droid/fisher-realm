// Optional browser regression: set PLAYWRIGHT_MODULE/CHROME_PATH for an existing install.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.html':'text/html'};
let version='91.0.0',failure=null,legacyEntry=false;const requests=[];
const server=http.createServer((req,res)=>{try{
 const url=new URL(req.url,'http://localhost');requests.push({path:url.pathname,query:url.search});
 if(!url.pathname.startsWith('/fisher-realm/')){res.writeHead(404).end();return;}
 const name=decodeURIComponent(url.pathname.slice('/fisher-realm/'.length))||'index.html',file=path.resolve(root,name);
 if(path.relative(root,file).startsWith('..')){res.writeHead(403).end();return;}
 if(name==='package.json'){
  if(failure==='manifest'){res.writeHead(503).end('Unavailable');return;}
  const data={...manifest,version,fisherRealm:{...manifest.fisherRealm,modules:[...manifest.fisherRealm.modules,'maps/__lazy-test.js']}};if(failure==='invalid')data.version='bad-version';
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public,max-age=31536000'}).end(JSON.stringify(data));return;
 }
 if(name==='maps/__lazy-test.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public,max-age=31536000'}).end('export const version='+JSON.stringify(url.searchParams.get('v'))+';');return;}
 if(failure==='style'&&name==='style.css'){res.writeHead(503).end('Unavailable');return;}
 if(failure==='loader'&&name==='release-loader.js'){res.writeHead(503).end('Unavailable');return;}
 let data=fs.readFileSync(file);
 if(name==='index.html'&&legacyEntry)data=Buffer.from(data.toString().replace(/else \{ const loader=.*?document.head.append\(loader\); \}/,"else { import('./main.js?v=legacy').catch(e=>showGameError(e.message)); }"));
 if(name==='fish-data.js'&&version==='91.0.1')data=Buffer.from(data.toString().split('\n').map(line=>line.includes('"id":"OSCAR"')?line.replace('"stamina":55','"stamina":56'):line).join('\n'));
 if(name==='style.css')data=Buffer.concat([data,Buffer.from('\nbody{--release-test:"'+version+'"}')]);
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=31536000'}).end(data);
}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/fisher-realm/';
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],chromiumSandbox:false,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{
 const context=await browser.newContext(),saved={version:1,items:[{id:'1',name:'黄鲶',x:0,y:0},{id:'2',name:'弓鳍鱼',x:null,y:null}]};
 const reports=[];
 for(const next of ['91.0.0','91.0.1']){
  version=next;const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url,{waitUntil:'networkidle'});await p.waitForFunction(v=>window.lakeside?.getState().version===v,version);
  assert.equal(await p.locator('#game-version').textContent(),'V'+version);
  assert.equal(await p.evaluate(async()=>{const m=await import('./fish-data.js');return m.FISH_DATA.find(f=>f.id==='OSCAR').stamina;}),version==='91.0.0'?55:56);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--release-test').trim()),'"'+version+'"');
  assert.ok(!requests.some(r=>r.path==='/fisher-realm/maps/__lazy-test.js'&&new URLSearchParams(r.query).get('v')===version),'registered map module was eagerly downloaded');
  assert.equal(await p.evaluate(async()=> (await import('./maps/__lazy-test.js')).version),version);
  // Explicitly request optional/compatibility modules to verify their import-map
  // versions without requiring the game to eagerly download unused maps.
  await p.evaluate(async names=>{for(const name of names)await import(new URL(name,document.baseURI).href);},manifest.fisherRealm.modules);
  if(version==='91.0.0'){await p.evaluate(s=>localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(s)),saved);await p.close();continue;}
  assert.deepEqual(await p.evaluate(()=>window.lakeside.getState().inventory.items),saved.items);
  await p.locator('#loading').waitFor({state:'hidden'});await p.locator('#backpack-toggle').click();await p.waitForFunction(()=>[...document.querySelectorAll('.inventory-fish')].every(e=>e.dataset.imageState==='ready'));
  for(const src of await p.locator('.inventory-fish img').evaluateAll(a=>a.map(i=>i.currentSrc)))assert.equal(new URL(src).searchParams.get('v'),version);
  assert.deepEqual(errors,[]);reports.push({cacheUpgrade:true,version,dataUpdated:true,stylesUpdated:true,imagesUpdated:true,oldSave:true});await p.close();
 }
 for(const v of ['91.0.0','91.0.1'])for(const name of manifest.fisherRealm.modules){assert.ok(requests.some(r=>r.path==='/fisher-realm/'+name&&new URLSearchParams(r.query).get('v')===v),'missing versioned module '+name+' '+v);}
 for(const v of ['91.0.0','91.0.1'])for(const name of ['audio/hooked.wav','audio/line-broken.wav','audio/caught.wav'])assert.ok(requests.some(r=>r.path==='/fisher-realm/'+name&&new URLSearchParams(r.query).get('v')===v),'missing versioned audio '+name);
 const checks=requests.filter(r=>r.path.endsWith('/package.json')).map(r=>new URLSearchParams(r.query).get('check'));assert.equal(checks.length,2);assert.equal(new Set(checks).size,2);assert.ok(checks.every(Boolean));
 legacyEntry=true;version='93.0.0';const legacy=await context.newPage();await legacy.goto(url+'?old-entry=1',{waitUntil:'domcontentloaded'});await legacy.locator('#error').waitFor({state:'visible'});assert.equal(await legacy.evaluate(()=>typeof window.lakeside),'undefined');legacyEntry=false;await legacy.locator('#error button').click();await legacy.waitForFunction(v=>window.lakeside?.getState().version===v,version);assert.ok(new URL(legacy.url()).searchParams.has('reload'));await legacy.close();reports.push({legacyHtmlRecovery:true});
 for(const [i,scenario] of ['manifest','invalid','style','loader'].entries()){
  version='92.0.'+i;
  failure=scenario;const p=await context.newPage(),start=requests.length;
  await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#error').waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>typeof window.lakeside),'undefined');assert.ok(!requests.slice(start).some(r=>r.path.endsWith('/main.js')));reports.push({failure:scenario,errorVisible:true,gameNotStarted:true});if(scenario==='manifest'){failure=null;await p.locator('#error button').click();await p.waitForFunction(v=>window.lakeside?.getState().version===v,version);reports.push({retryAfterFailure:true});}await p.close();
 }
 await context.close();console.log(JSON.stringify({reports,allModuleVersions:true,lazyModuleVersions:true,noEagerLazyDownload:true,allAudioVersions:true,uncachedManifest:true,subdirectory:true}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
