// Run with an existing Playwright installation; no game/runtime dependencies added.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),mime={'.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.html':'text/html'},requests=[];
let imageMode='normal';
const server=http.createServer((req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname.slice(1))||'index.html',file=path.resolve(root,name);if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();
 requests.push(name);const original=name.startsWith('fish-images/')&&!name.includes('/thumbnails/');
 if(imageMode==='fail-original'&&original||imageMode==='fail-thumb'&&name.includes('/thumbnails/'))return res.writeHead(404).end();
 const data=fs.readFileSync(file);setTimeout(()=>res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=31536000'}).end(data),original&&imageMode==='slow-original'?2000:0);
 }catch{res.writeHead(404).end();}});
const saved={version:1,items:[{id:'1',name:'佛罗里达雀鳝',x:0,y:0},{id:'2',name:'黄鲶',x:null,y:null}]};
async function state(p){return p.evaluate(()=>window.lakeside.getState());}
async function ready(p,url){
 // These existing cases verify the fully unlocked view. Lock/catch migration
 // has separate coverage in fish-guide-unlocks.cjs, without this seed.
 const ids=fs.readFileSync(path.join(root,'fish-data.js'),'utf8').split('\n').filter(l=>l.trim().startsWith('{"id":')).map(l=>JSON.parse(l.trim().replace(/,$/,'' )).id);
 await p.addInitScript(fishIds=>localStorage.setItem('fisher-realm-discoveries-v1',JSON.stringify({version:1,fishIds})),[...ids,'GUIDE_TEST']);
 await p.goto(url,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.lakeside);await p.locator('#loading').waitFor({state:'hidden'});
}
async function open(p){
 // A held mouse is captured by the rod. Use real keyboard activation to open
 // the guide while still reeling, then verify that opening releases that state.
 if((await state(p)).fishing.reeling){await p.locator('#settings-toggle').focus();await p.keyboard.press('Enter');await p.locator('#fish-guide-toggle').focus();await p.keyboard.press('Enter');}
 else{await p.locator('#settings-toggle').click();await p.locator('#fish-guide-toggle').click();}
 await p.locator('#fish-guide-dialog').waitFor({state:'visible'});
}
async function close(p){await p.locator('#fish-guide-close').click();await p.waitForFunction(()=>!window.lakeside.getState().paused);}
const originalRequests=()=>requests.filter(n=>n.startsWith('fish-images/')&&!n.includes('/thumbnails/'));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/',b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],chromiumSandbox:false}),reports=[];fs.mkdirSync(path.join(root,'.qa'),{recursive:true});
try{
 const c=await b.newContext({viewport:{width:1440,height:960}});try{const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(s=>localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(s)),saved);
 await ready(p,url);requests.length=0;await open(p);assert.equal((await state(p)).paused,true);assert.equal(await p.locator('#fish-guide-search').evaluate(e=>e===document.activeElement),true);
 for(const row of await p.locator('.guide-summary').all()){await row.scrollIntoViewIfNeeded();await p.waitForFunction(id=>document.querySelector('[data-guide-fish-id=\"'+id+'\"] .guide-thumbnail')?.dataset.imageState==='ready',await row.evaluate(e=>e.parentElement.dataset.guideFishId));}
 await p.locator('.guide-scroll').evaluate(e=>e.scrollTop=0);
 assert.equal(originalRequests().length,0);assert.equal(await p.locator('.guide-fish[open]').count(),0);
 const fish=await p.evaluate(async()=>(await import('./fish-data.js')).FISH_DATA);assert.deepEqual(await p.locator('.guide-info h3').allTextContents(),fish.map(f=>f.name));
 for(const f of fish){const row=p.locator(`[data-guide-fish-id="${f.id}"]`);assert.equal(await row.locator('.guide-swatch').count(),2);const colors=await row.locator('.guide-swatch').evaluateAll(a=>a.map(e=>e.style.backgroundColor));const expected=await p.evaluate(f=>[f.catchColor??'#d3d3d3',f.inventory.color].map(color=>{const e=document.createElement('i');e.style.backgroundColor=color;return e.style.backgroundColor}),f);assert.deepEqual(colors,expected);assert.ok((await row.locator('summary').textContent()).includes(`力量 ${f.strength.amount} 点/${f.strength.interval}秒`));}
 assert.ok(!/#[0-9a-f]{6}/i.test(await p.locator('#fish-guide-list').textContent()));
 imageMode='slow-original';await p.locator('[data-guide-fish-id="TILAPIA"] summary').click();await p.waitForFunction(()=>document.querySelector('.guide-large-image')?.dataset.imageState==='loading');
 await p.waitForFunction(()=>{const i=document.querySelector('.guide-preview');return i&&!i.hidden&&i.complete&&i.naturalWidth>0});assert.equal(originalRequests().length,1);
 await p.waitForFunction(()=>document.querySelector('.guide-large-image')?.dataset.imageState==='ready');assert.ok((await p.locator('.guide-detail').textContent()).includes('0°为横向，90°为正前方'));
 await p.locator('[data-guide-fish-id="LARGEMOUTH_BASS"] summary').click();await p.waitForFunction(()=>document.querySelectorAll('.guide-fish[open]').length===1&&document.querySelector('[data-guide-fish-id="LARGEMOUTH_BASS"]').open);
 assert.equal(await p.locator('[data-guide-fish-id="TILAPIA"]').evaluate(e=>e.open),false);
 await p.waitForFunction(()=>document.querySelector('[data-guide-fish-id="LARGEMOUTH_BASS"] .guide-large-image')?.dataset.imageState==='ready');
 await p.screenshot({path:path.join(root,'.qa/guide-desktop.png')});
 await p.locator('.guide-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await p.locator('.guide-scroll').evaluate(e=>e.scrollTop>0));await close(p);await open(p);assert.equal(await p.locator('.guide-scroll').evaluate(e=>e.scrollTop),0);
 await p.evaluate(()=>{const summaries=document.querySelectorAll('.guide-summary');summaries[0].click();summaries[1].click();});await p.waitForFunction(()=>document.querySelectorAll('.guide-fish[open]').length===1&&document.querySelector('[data-guide-fish-id="BLUEGILL"]').open);
 await p.locator('[data-guide-fish-id="BLUEGILL"] summary').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelectorAll('.guide-fish[open]').length===0);await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('[data-guide-fish-id="BLUEGILL"]').open);
 await p.locator('#fish-guide-search').fill('太阳鱼');assert.deepEqual(await p.locator('.guide-fish:not([hidden]) .guide-info h3').allTextContents(),['蓝鳃太阳鱼','红耳太阳鱼']);assert.ok((await p.locator('#fish-guide-count').textContent()).includes('找到 2 种 · 已解锁 19 / 19'));
 await p.locator('#fish-guide-search').fill('不存在');await p.locator('#fish-guide-empty').waitFor({state:'visible'});await close(p);await open(p);assert.equal(await p.locator('#fish-guide-search').inputValue(),'');assert.equal(await p.locator('.guide-fish[open]').count(),0);assert.equal(await p.locator('.guide-scroll').evaluate(e=>e.scrollTop),0);
 await p.setViewportSize({width:390,height:844});await p.locator('[data-guide-fish-id="TILAPIA"] summary').click();await p.waitForFunction(()=>document.querySelector('[data-guide-fish-id="TILAPIA"] .guide-large-image')?.dataset.imageState==='ready');await p.screenshot({path:path.join(root,'.qa/guide-mobile.png')});
 const overflow=await p.locator('#fish-guide-dialog').evaluate(e=>({width:e.scrollWidth>e.clientWidth,body:document.documentElement.scrollWidth>innerWidth,box:e.getBoundingClientRect().toJSON()}));assert.equal(overflow.width,false);assert.equal(overflow.body,false);assert.ok(overflow.box.x>=0&&overflow.box.right<=390&&overflow.box.height<=844);
 await p.setViewportSize({width:844,height:390});assert.ok((await p.locator('#fish-guide-dialog').boundingBox()).height<=390);await p.screenshot({path:path.join(root,'.qa/guide-landscape.png')});
 await p.keyboard.press('Escape');await p.locator('#fish-guide-dialog').waitFor({state:'hidden'});assert.equal((await state(p)).fishing.state,'idle');
 // Exercise handoff close events: a queued close must not resume another modal.
 await p.evaluate(()=>document.querySelector('#backpack-toggle').click());await p.waitForFunction(()=>window.lakeside.getState().paused);
 await p.evaluate(()=>document.querySelector('#fish-guide-toggle').click());await p.waitForFunction(()=>document.querySelector('#fish-guide-dialog').open&&!document.querySelector('#inventory-dialog').open);
 await p.waitForTimeout(100);assert.equal((await state(p)).paused,true);assert.equal(await p.locator('#fish-guide-search').evaluate(e=>e===document.activeElement),true);
 await p.evaluate(()=>document.querySelector('#help').click());await p.waitForFunction(()=>document.querySelector('#help-dialog').open&&!document.querySelector('#fish-guide-dialog').open);assert.equal((await state(p)).paused,true);assert.equal(await p.locator('.help-fish-entry').count(),19);
 await p.locator('#help-dialog .close').click();await p.waitForFunction(()=>!window.lakeside.getState().paused);assert.deepEqual((await state(p)).inventory.items,saved.items);assert.deepEqual(errors,[]);console.log('checked','interface');reports.push({scenario:'interface',fish:19,colors:true,searchOrder:true,reset:true,originalOnDemand:true,preview:true,mobile:true,handoff:true,save:true,errors});
 }finally{await c.close();}
 // Missing configured images and failed downloads remain different states.
 for(const mode of ['fail-original','fail-thumb','missing']){imageMode=mode;requests.length=0;const c=await b.newContext();try{const p=await c.newPage();if(mode==='missing')await p.route('**/fish-data.js*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'fish-data.js'),'utf8').replace('"image":"cutouts/tilapia.png"','"image":null')}));await ready(p,url);await open(p);
 const card=p.locator('[data-guide-fish-id="TILAPIA"]');await p.waitForFunction(expected=>document.querySelector('[data-guide-fish-id="TILAPIA"] .guide-thumbnail')?.dataset.imageState===expected,mode==='missing'?'missing':mode==='fail-thumb'?'error':'ready');assert.equal(originalRequests().length,0);
 await card.locator('summary').click();await p.waitForFunction(expected=>document.querySelector('[data-guide-fish-id="TILAPIA"] .guide-large-image')?.dataset.imageState===expected,mode==='missing'?'missing':mode==='fail-original'?'error':'ready');
 if(mode==='fail-original'){await p.waitForFunction(()=>{const e=document.querySelector('.guide-preview');return e&&!e.hidden&&e.complete&&e.naturalWidth>0});assert.ok((await card.textContent()).includes('原图加载失败'));imageMode='normal';await close(p);await open(p);await p.locator('[data-guide-fish-id="TILAPIA"] summary').click();await p.waitForFunction(()=>document.querySelector('.guide-large-image')?.dataset.imageState==='ready');}
 if(mode==='missing'){assert.equal(await card.locator('img[src]').count(),0);assert.ok((await card.textContent()).includes('暂无图片'));}
 console.log('checked',mode);reports.push({scenario:mode,expectedState:true,recovery:mode==='fail-original'});
 }finally{await c.close();}}
 imageMode='normal';
 const updated=await b.newContext();try{const p=await updated.newPage();
 await p.route('**/fish-data.js*',route=>{let source=fs.readFileSync(path.join(root,'fish-data.js'),'utf8');source=source.split('\n').map(line=>{if(!line.includes('"id":"TILAPIA"'))return line;const f=JSON.parse(line.trim().replace(/,$/,''));Object.assign(f,{speed:8.1,stamina:99,strength:{amount:7,interval:.18},catchColor:'#123456',inventory:{w:4,h:2,color:'#654321',image:null},struggle:{minAngle:27,maxAngle:40,durations:[2,3,4],switchPause:.25},specials:['换边前停顿0.25秒']});return JSON.stringify(f)+',';}).join('\n');const extra={id:'GUIDE_TEST',name:'临时<图鉴>鱼',strength:{amount:1,interval:.2},speed:1,stamina:5,restDuration:2,struggle:{minAngle:20,maxAngle:30,durations:[1]},specials:[],inventory:{w:1,h:1,color:'#008000',image:null}},at=source.lastIndexOf('\n]);');source=source.slice(0,at)+',\n'+JSON.stringify(extra)+source.slice(at);return route.fulfill({contentType:'text/javascript',body:source});});
 await ready(p,url);await open(p);assert.equal(await p.locator('.guide-fish').count(),20);assert.equal(await p.locator('.guide-info h3').last().textContent(),'临时<图鉴>鱼');assert.equal(await p.locator('.guide-info h3 img').count(),0);
 const tilapia=p.locator('[data-guide-fish-id="TILAPIA"]');assert.ok((await tilapia.textContent()).includes('耐力 99'));assert.ok((await tilapia.textContent()).includes('速度 8.1 米/秒'));assert.ok((await tilapia.textContent()).includes('力量 7 点/0.18秒'));
 const colors=await tilapia.locator('.guide-swatch').evaluateAll(a=>a.map(e=>e.style.backgroundColor));assert.deepEqual(colors,['rgb(18, 52, 86)','rgb(101, 67, 33)']);
 await p.locator('#fish-guide-search').fill('罗非鱼');await tilapia.locator('summary').click();await p.waitForFunction(()=>document.querySelector('.guide-detail'));
 const detail=await tilapia.locator('.guide-detail').textContent();for(const text of ['1/20（约5.00%）','高 2 格 × 宽 4 格','27°–40°','2、3、4秒','停顿0.25秒'])assert.ok(detail.includes(text),text);
 console.log('checked','configuration');reports.push({scenario:'configuration',count:20,newFish:true,parameters:true,colors:true,probabilityNotFiltered:true,textSafe:true});
 }finally{await updated.close();}
 // The test controls the existing GameTime input, not fishing state or algorithms.
 // Every stage is reached by real cast/hook/reel input and production session code.
 for(const scenario of ['stages','switch-pause','catch']){const c=await b.newContext({viewport:{width:1440,height:960}});try{const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.__guideTime=100;Math.random=()=>0;window.__guideAudio=[];window.Audio=class{constructor(src){this.src=src;this.paused=true;this.ended=false;this.currentTime=0;this.plays=0;window.__guideAudio.push(this);}play(){this.paused=false;this.plays++;return Promise.resolve();}pause(){this.paused=true;}};});
 await p.route('**/game-time.js*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game-time.js'),'utf8').replace('performance.now()/1000','globalThis.__guideTime').replace('now(raw=this.raw()){','now(raw=this.raw()){raw=this.raw();')}));
 if(scenario==='catch')await p.route('**/fish-data.js*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'fish-data.js'),'utf8').split('\n').map(line=>{if(!line.includes('"id":"TILAPIA"'))return line;const f=JSON.parse(line.trim().replace(/,$/,''));Object.assign(f,{strength:{amount:1,interval:1},speed:.01,stamina:1});return JSON.stringify(f)+',';}).join('\n')}));
 await ready(p,url);
 async function tick(seconds){const frame=await p.evaluate(s=>{window.__guideTime+=s;return {frames:window.lakeside.getState().frames,paused:window.lakeside.getState().paused};},seconds);if(frame.paused)await p.waitForTimeout(80);else await p.waitForFunction(f=>window.lakeside.getState().frames>f,frame.frames);}
 async function pauseCheck(label){console.log('checking pause',label);await open(p);const before=await state(p);assert.equal(before.paused,true);assert.equal(before.fishing.reeling,false);const audio=await p.evaluate(()=>window.__guideAudio.map(a=>({paused:a.paused,plays:a.plays})));assert.ok(audio.every(a=>a.paused));await tick(30);await p.locator('#fish-guide-search').fill('鱼');await p.keyboard.press('Space');await p.keyboard.press('ArrowLeft');await p.keyboard.press('KeyR');await p.keyboard.press('Enter');const after=await state(p);assert.deepEqual(after.fishing,before.fishing,label+' fishing/visual timers');assert.deepEqual([after.yaw,after.pitch],[before.yaw,before.pitch],label+' camera');await p.keyboard.press('Escape');await p.waitForFunction(()=>!window.lakeside.getState().paused);assert.equal((await state(p)).fishing.state,before.fishing.state);return before.fishing;}
 if(scenario==='switch-pause'){await p.locator('#settings-toggle').click();await p.locator('#realm-command').fill('realm owner');await p.locator('#owner-fish').selectOption({label:'黑莓鲈'});await p.locator('#owner-fish-form .primary').click();await p.waitForFunction(()=>!window.lakeside.getState().paused);}
 if(scenario==='stages')await pauseCheck('idle');await p.locator('#scene').focus();await p.keyboard.press('Space');assert.equal((await state(p)).fishing.state,'casting');
 if(scenario==='stages')await pauseCheck('casting');await tick(1);assert.equal((await state(p)).fishing.state,'waiting');
 if(scenario==='stages')await pauseCheck('waiting');await tick(5.1);assert.equal((await state(p)).fishing.state,'bite');
 if(scenario==='stages')await pauseCheck('bite');await p.locator('#scene').focus();await p.keyboard.press('KeyH');assert.equal((await state(p)).fishing.state,'fighting');
 await p.waitForFunction(()=>window.__guideAudio.find(a=>a.src.includes('hooked.wav')).plays>0);
 await p.mouse.move(720,500);await p.mouse.down();await tick(.3);
 if(scenario==='stages'){assert.ok((await state(p)).fishing.durability<100);const f=await pauseCheck('struggle');assert.ok(f.phaseRemaining>0);assert.ok(await p.evaluate(()=>!window.__guideAudio.find(a=>a.src.includes('hooked.wav')).paused));await tick(.1);assert.equal((await state(p)).fishing.reeling,false);await p.mouse.up();await tick(7.1);assert.equal((await state(p)).fishing.fishPhase,'rest');await pauseCheck('rest');await tick(.1);assert.equal((await state(p)).fishing.fishPhase,'rest');}
 else if(scenario==='switch-pause'){await p.mouse.up();await tick(3.25);assert.equal((await state(p)).fishing.fishPhase,'switch-pause');await pauseCheck('switch-pause');await tick(.1);assert.equal((await state(p)).fishing.fishPhase,'switch-pause');await tick(.2);assert.equal((await state(p)).fishing.fishPhase,'second');}
 else{assert.equal((await state(p)).fishing.fishPhase,'exhausted');await pauseCheck('exhausted');await p.mouse.up();await p.mouse.move(720,500);await p.mouse.down();await tick(4.2);assert.equal((await state(p)).fishing.state,'fighting');await tick(.4);assert.equal((await state(p)).fishing.state,'caught');await p.mouse.up();await tick(.3);assert.ok(!(await p.locator('#catch-notice').isHidden()));await pauseCheck('caught');await tick(.5);assert.equal((await state(p)).fishing.state,'idle');await pauseCheck('notice');await tick(4.5);assert.equal(await p.locator('#catch-notice').isHidden(),true);assert.equal((await state(p)).inventory.items.length,1);}
 assert.deepEqual(errors,[]);reports.push({scenario,pauseResume:true,inputIsolated:true,reelReleased:true,audio:true,errors});
 }finally{await c.close();}}
 console.log(JSON.stringify(reports));
}finally{await b.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
