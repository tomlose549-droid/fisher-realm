const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),canonical='fisher-realm-save-slots-v1',inventoryKey='fisher-realm-inventory-v1';
const inventory={version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}],storage:{version:1,coins:2345,activeBox:9,boxes:Array.from({length:10},(_,i)=>({unlocked:i===0||i===9,items:i===0?[{id:'3',name:'草鱼',x:0,y:0}]:i===9?[{id:'4',name:'大口黑鲈',x:0,y:0}]:[]}))}};
const discoveries={version:1,fishIds:['TILAPIA','LONGNOSE_GAR','LARGEMOUTH_BASS','GRASS_CARP']};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
async function main(){
 const server=http.createServer((req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
 }catch{res.writeHead(404).end();}});let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({canonical,inventoryKey,inventory,discoveries})=>{if(!localStorage.getItem(canonical)&&!localStorage.getItem(inventoryKey)){localStorage.setItem(inventoryKey,JSON.stringify(inventory));localStorage.setItem('fisher-realm-discoveries-v1',JSON.stringify(discoveries));}},{canonical,inventoryKey,inventory,discoveries});
  const state=()=>page.evaluate(()=>window.lakeside.getState()),disk=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),canonical);
  async function loaded(){await page.waitForFunction(()=>window.lakeside);await page.locator('#loading').waitFor({state:'hidden'});assert.equal(await page.locator('#error').isVisible(),false);}
  async function settings(){await page.locator('#settings-toggle').click();}
  async function choose(){await settings();await page.locator('#save-select').click();assert.equal((await state()).paused,true);}
  const row=id=>page.locator('[data-save-id="'+id+'"]');
  async function confirmReload(id){await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#save-confirm-apply').click()]);await loaded();assert.equal((await state()).activeSave,id);}
  async function create(id){await settings();await page.locator('#save-new').click();await confirmReload(id);}
  async function switchTo(id){await choose();await row(id).locator('[data-save-action=select]').click();await confirmReload(id);}
  async function rich(value){await settings();await page.locator('#realm-command').fill('rich');await page.locator('#realm-command').press('Enter');await page.locator('#rich-amount').fill(String(value));await page.locator('#rich-form .primary').click();}
  const shots=path.join(root,'.qa/save-slots');fs.mkdirSync(shots,{recursive:true});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await loaded();
  assert.equal((await state()).activeSave,'1');assert.equal((await state()).storage.coins,2345);assert.equal((await state()).storage.boxes[9].items[0].name,'大口黑鲈');
  await choose();assert.equal(await row('1').locator('[data-save-action=delete]').isDisabled(),true);assert.equal(await page.locator('.save-slot').count(),1);await page.screenshot({path:path.join(shots,'existing-save.png')});await page.locator('#save-select-close').click();
  await settings();await page.locator('#save-new').click();await page.locator('#save-confirm-cancel').click();await page.waitForFunction(()=>!window.lakeside.getState().paused);assert.equal((await state()).activeSave,'1');
  await page.locator('#scene').focus();await page.keyboard.press('Space');assert.notEqual((await state()).fishing.state,'idle');
  await create('2');let current=await state();assert.equal(current.fishing.state,'idle');assert.equal(current.storage.coins,0);assert.equal(current.inventory.items.length,0);assert.ok(current.storage.boxes.every(b=>b.items.length===0));assert.equal(current.storage.boxes.filter(b=>b.unlocked).length,1);
  const first=(await disk()).slots.find(s=>s.id==='1');assert.deepEqual(first.data.inventory,inventory);assert.deepEqual(first.data.discoveries,discoveries);assert.equal(await page.evaluate(()=>localStorage.getItem('fisher-realm-inventory-v1')),null);
  await settings();await page.locator('#fish-guide-toggle').click();assert.equal(await page.locator('.guide-summary').count(),0);assert.equal(await page.locator('.guide-locked').count(),27);await page.locator('#fish-guide-close').click();
  await rich(99);await create('3');await rich(88);await settings();await page.locator('#save-new').click();assert.equal(await page.locator('#save-confirm-apply').isDisabled(),true);assert.match(await page.locator('#save-confirm-message').textContent(),/上限/);await page.locator('#save-confirm-choose').click();
  assert.equal(await page.locator('.save-slot').count(),3);assert.equal(await row('3').locator('[data-save-action=delete]').isDisabled(),true);
  await row('2').locator('[data-save-action=delete]').click();await page.locator('#save-confirm-cancel').click();assert.equal((await disk()).slots.length,3);
  await page.screenshot({path:path.join(shots,'three-slots.png')});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#save-select-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);await page.screenshot({path:path.join(shots,'mobile.png')});await page.setViewportSize({width:1440,height:1000});
  await row('2').locator('[data-save-action=delete]').click();await page.locator('#save-confirm-apply').click();assert.deepEqual((await disk()).slots.map(s=>s.id),['1','3']);assert.equal((await state()).activeSave,'3');assert.equal((await state()).paused,true);
  await page.locator('#save-select-close').click();await create('2');assert.equal((await state()).storage.coins,0);assert.deepEqual((await disk()).slots.find(s=>s.id==='2').data.discoveries.fishIds,[]);
  await switchTo('1');current=await state();assert.equal(current.storage.coins,2345);assert.deepEqual(current.inventory.items,inventory.items);assert.deepEqual(current.storage.boxes,inventory.storage.boxes);
  await settings();await page.locator('#fish-guide-toggle').click();assert.equal(await page.locator('.guide-summary').count(),4);await page.locator('#fish-guide-close').click();
  await switchTo('3');assert.equal((await state()).storage.coins,88);
  await choose();await row('1').locator('[data-save-action=delete]').click();
  const before=await disk();await page.evaluate(()=>{window.saveSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,text){if(key==='fisher-realm-save-slots-v1')throw new DOMException('test quota','QuotaExceededError');return window.saveSetItem.call(this,key,text);};});
  await page.locator('#save-confirm-apply').click();assert.match(await page.locator('#save-confirm-message').textContent(),/保存失败/);assert.deepEqual(await disk(),before);assert.equal((await state()).activeSave,'3');
  await page.evaluate(()=>{Storage.prototype.setItem=window.saveSetItem;});await page.locator('#save-confirm-apply').click();assert.equal((await disk()).slots.some(s=>s.id==='1'),false);await page.locator('#save-select-close').click();
  await settings();await page.locator('#save-new').click();const beforeCreate=await disk();await page.evaluate(()=>{Storage.prototype.setItem=function(key,text){if(key==='fisher-realm-save-slots-v1')throw new DOMException('test quota','QuotaExceededError');return window.saveSetItem.call(this,key,text);};});await page.locator('#save-confirm-apply').click();assert.match(await page.locator('#save-confirm-message').textContent(),/保存失败/);assert.deepEqual(await disk(),beforeCreate);
  await page.evaluate(()=>{Storage.prototype.setItem=window.saveSetItem;});await page.locator('#save-confirm-cancel').click();
  await page.reload({waitUntil:'domcontentloaded'});await loaded();assert.equal((await state()).activeSave,'3');assert.equal((await state()).storage.coins,88);assert.equal((await disk()).slots.length,2);
  await choose();await row('2').locator('[data-save-action=select]').click();const beforeSwitch=await disk();await page.evaluate(()=>{window.saveSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,text){if(key==='fisher-realm-save-slots-v1')throw new DOMException('test quota','QuotaExceededError');return window.saveSetItem.call(this,key,text);};});await page.locator('#save-confirm-apply').click();assert.match(await page.locator('#save-confirm-message').textContent(),/保存失败/);assert.deepEqual(await disk(),beforeSwitch);assert.equal((await state()).activeSave,'3');await page.evaluate(()=>{Storage.prototype.setItem=window.saveSetItem;});await page.locator('#save-confirm-cancel').click();await page.locator('#save-select-close').click();
  assert.deepEqual(errors,[]);const report={result:'passed',legacyPreserved:true,newGameEmpty:true,maxThree:true,switchRestoresAllProgress:true,currentCannotDelete:true,deleteConfirmAndCancel:true,reuseDeletedSlotEmpty:true,saveFailureRollback:['create','switch','delete'],refreshActiveSlot:true,modalPause:true,fishingReset:true,mobileNoOverflow:true,pageErrors:errors};fs.writeFileSync(path.join(shots,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
