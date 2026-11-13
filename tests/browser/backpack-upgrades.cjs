const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {readSavedSection}=require('./save-fixture.cjs');
const root=path.resolve(__dirname,'../..'),key='fisher-realm-save-slots-v1',legacy={version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}],storage:{version:1,coins:1000,activeBox:0,boxes:Array.from({length:10},(_,i)=>({unlocked:i===0,items:[]}))}};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
async function main(){
 const server=http.createServer((req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
 }catch{res.writeHead(404).end();}});let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1050}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{if(!localStorage.getItem('fisher-realm-save-slots-v1')&&!localStorage.getItem('fisher-realm-inventory-v1'))localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify({version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0},{id:'2',name:'长吻雀鳝',x:null,y:null}],storage:{version:1,coins:100000,boxes:[{unlocked:true,items:[]}]}}));});
  const state=()=>page.evaluate(()=>window.lakeside.getState()),bag=async()=>(await state()).inventory;
  async function loaded(){await page.waitForFunction(()=>window.lakeside);await page.locator('#loading').waitFor({state:'hidden'});}
  async function openUpgrade(){await page.locator('#shop-toggle').click();await page.locator('#shop-backpack-tab').click();}
  async function upgrade(level){await page.locator('#backpack-upgrade-buy').click();assert.equal((await bag()).backpackLevel,level);await page.waitForTimeout(500);}
  const shots=path.join(root,'.qa/backpack-upgrades');fs.mkdirSync(shots,{recursive:true});
  await page.goto(url);await loaded();await openUpgrade();assert.match(await page.locator('#backpack-upgrade-level').textContent(),/lv0/);assert.equal((await state()).paused,true);
  const items=(await bag()).items;
  // A double click must only purchase one step, despite enough money for both.
  await page.locator('#backpack-upgrade-buy').dblclick();assert.equal((await bag()).backpackLevel,1);assert.equal((await state()).storage.coins,99970);await page.waitForTimeout(500);
  await page.locator('#shop-close').click();await page.locator('#backpack-toggle').click();assert.equal(await page.locator('#inventory-grid>.inventory-cell').count(),20);assert.deepEqual((await bag()).items,items);await page.locator('#inventory-close').click();
  await openUpgrade();for(let level=2;level<=9;level++)await upgrade(level);
  assert.equal((await state()).storage.coins,63333);assert.equal(await page.locator('#backpack-upgrade-buy').isDisabled(),true);assert.match(await page.locator('#backpack-upgrade-buy').textContent(),/已满级/);await page.screenshot({path:path.join(shots,'upgrade-desktop.png')});
  await page.locator('#shop-stock-tab').click();assert.equal(await page.locator('.shop-product:visible').count(),6);await page.locator('#shop-refit-tab').click();assert.equal(await page.locator('#refit-panel').isVisible(),true);await page.locator('#shop-close').click();
  await page.locator('#backpack-toggle').click();const grid=page.locator('#inventory-grid');assert.equal(await grid.locator('>.inventory-cell').count(),70);
  const fish=grid.locator('[data-fish-id="1"]');await fish.click();await grid.locator('>[data-x="8"][data-y="6"]').click();assert.deepEqual((await bag()).items.find(i=>i.id==='1'),{id:'1',name:'罗非鱼',x:8,y:6});
  // Move back through the real pointer path: geometry must include grid gaps/padding.
  const source=await grid.locator('[data-fish-id="1"]').boundingBox(),target=await grid.locator('>[data-x="0"][data-y="0"]').boundingBox();
  await page.mouse.move(source.x+5,source.y+5);await page.mouse.down();await page.mouse.move(target.x+5,target.y+5,{steps:12});await page.mouse.up();assert.equal((await bag()).items.find(i=>i.id==='1').x,0);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#inventory-dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:path.join(shots,'inventory-mobile.png')});await page.locator('#inventory-close').click();
  await page.setViewportSize({width:1440,height:1050});await page.locator('#warehouse-toggle').click();assert.equal(await page.locator('#warehouse-bag>.inventory-cell').count(),70);assert.equal(await page.locator('#warehouse-grid>.inventory-cell').count(),100);
  await page.locator('#warehouse-bag [data-fish-id="1"]').click();await page.locator('#warehouse-grid>[data-x="0"][data-y="0"]').click();await page.locator('#warehouse-grid [data-fish-id="1"]').click();await page.locator('#warehouse-bag>[data-x="8"][data-y="6"]').click();assert.equal((await bag()).items.find(i=>i.id==='1').y,6);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#warehouse-dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:path.join(shots,'warehouse-mobile.png')});await page.locator('#warehouse-close').click();
  await page.reload();await loaded();assert.equal((await bag()).backpackLevel,9);assert.equal((await bag()).items.find(i=>i.id==='1').x,8);
  await page.locator('#settings-toggle').click();await page.locator('#realm-command').fill('clear');await page.locator('#realm-command').press('Enter');assert.equal((await bag()).backpackLevel,9);assert.equal((await bag()).items.length,0);assert.equal((await state()).storage.coins,0);await page.keyboard.press('Escape');
  await page.locator('#settings-toggle').click();await page.locator('#save-new').click();await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#save-confirm-apply').click()]);await loaded();assert.equal((await bag()).backpackLevel??0,0);
  await page.locator('#settings-toggle').click();await page.locator('#realm-command').fill('rich');await page.locator('#realm-command').press('Enter');await page.locator('#rich-amount').fill('1000');await page.locator('#rich-form .primary').click();await openUpgrade();
  const before=await state();await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fisher-realm-save-slots-v1')throw Error('quota');return window.originalSet.call(this,k,v);};});await page.locator('#backpack-upgrade-buy').click();assert.match(await page.locator('#backpack-upgrade-status').textContent(),/保存失败/);assert.deepEqual(await bag(),before.inventory);assert.equal((await state()).storage.coins,before.storage.coins);await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);await page.waitForTimeout(500);await upgrade(1);await page.locator('#shop-close').click();
  await page.locator('#settings-toggle').click();await page.locator('#save-select').click();await page.locator('[data-save-id="1"] [data-save-action=select]').click();await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#save-confirm-apply').click()]);await loaded();assert.equal((await bag()).backpackLevel,9);assert.equal((await state()).storage.coins,0);
  await openUpgrade();await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#shop-dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.screenshot({path:path.join(shots,'upgrade-mobile.png')});assert.deepEqual(errors,[]);
  const report={result:'passed',nineCostsAndSizes:true,doubleClickGuard:true,itemPositionsPreserved:true,grid70Cells:true,pointerDrag:true,warehouseBidirectional:true,refreshAndClearRetainLevel:true,newSlotLv0:true,slotIsolation:true,saveFailureRollback:true,mobileNoOverflow:true,threeShopTabs:true,pageErrors:errors};fs.writeFileSync(path.join(shots,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
