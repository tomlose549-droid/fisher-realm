const {readInPage,readSavedSection}=require('./save-fixture.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),key='fisher-realm-inventory-v1';
const legacy={version:1,items:[{id:'1',name:'长吻雀鳝',x:0,y:0},{id:'2',name:'大口黑鲈',x:0,y:1},{id:'3',name:'地图鱼',x:3,y:1},{id:'4',name:'罗非鱼',x:null,y:null}]};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
const shots=path.join(root,'.qa/warehouse');fs.mkdirSync(shots,{recursive:true});
async function main(){
  const server=http.createServer((req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}});
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:1440,height:1050}});
    await context.addInitScript(({key,legacy})=>{if(!localStorage.getItem('fisher-realm-save-slots-v1')&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(legacy));},{key,legacy});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const state=()=>page.evaluate(()=>window.lakeside.getState());
    const disk=()=>readSavedSection(page,key);
    async function loaded(){await page.waitForFunction(()=>window.lakeside);await page.locator('#loading').waitFor({state:'hidden'});assert.equal(await page.locator('#error').isVisible(),false);}
    async function command(text){await page.locator('#settings-toggle').click();await page.locator('#realm-command').fill(text);if(text!=='realm owner')await page.locator('#realm-command').press('Enter');}
    async function rich(value){await command('rich');await page.locator('#rich-amount').fill(String(value));await page.locator('#rich-form .primary').click();await page.locator('#rich-dialog').waitFor({state:'hidden'});}
    const card=(container,id)=>page.locator(container+' [data-fish-id="'+id+'"]');
    const cell=(container,x,y)=>page.locator(container+' > .inventory-cell[data-x="'+x+'"][data-y="'+y+'"]');
    async function dragTo(source,target){
      await source.scrollIntoViewIfNeeded();const a=await source.boundingBox();await target.scrollIntoViewIfNeeded();const b=await target.boundingBox();
      await page.mouse.move(a.x+8,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();
    }
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await loaded();
    assert.deepEqual((await state()).inventory.items,legacy.items);assert.deepEqual(await disk(),legacy);
    const gear=await page.locator('#settings-toggle').boundingBox(),warehouseButton=await page.locator('#warehouse-toggle').boundingBox();assert.ok(warehouseButton.y>gear.y+gear.height);assert.ok(Math.abs(warehouseButton.x+warehouseButton.width/2-gear.x-gear.width/2)<2);
    await page.screenshot({path:path.join(shots,'hud.png')});
    await page.locator('#warehouse-toggle').click();assert.equal((await state()).paused,true);
    assert.equal((await state()).inventory.items.length,3);assert.equal((await state()).storage.coins,0);
    assert.equal(await page.locator('#warehouse-grid>.inventory-cell').count(),100);assert.equal(await page.locator('#warehouse-tabs .locked').count(),9);
    assert.equal(await card('#warehouse-bag','1').getAttribute('data-fish-width'),'4');
    await page.waitForFunction(()=>[...document.querySelectorAll('#warehouse-dialog .inventory-fish')].every(e=>e.dataset.imageState==='ready'));
    await page.evaluate(()=>{window.stillCell=document.querySelector('#warehouse-grid .inventory-cell');});
    await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>window.stillCell===document.querySelector('#warehouse-grid .inventory-cell')),true,'no repeated modal rendering');
    await dragTo(card('#warehouse-bag','1'),cell('#warehouse-grid',0,0));assert.equal((await state()).storage.boxes[0].items[0].id,'1');assert.equal(await card('#warehouse-bag','1').count(),0);
    await card('#warehouse-grid','1').click();await card('#warehouse-bag','2').click();assert.equal((await state()).storage.boxes[0].items.length,1);assert.match(await page.locator('#warehouse-hint').textContent(),/占用/);
    await dragTo(card('#warehouse-grid','1'),cell('#warehouse-bag',0,0));assert.equal((await state()).storage.boxes[0].items.length,0);
    await card('#warehouse-bag','1').click();await cell('#warehouse-grid',0,0).click();
    await page.locator('#warehouse-box-9').click();assert.equal((await state()).paused,true);assert.equal(await page.locator('#warehouse-dialog').evaluate(e=>e.open),true);
    await page.locator('#warehouse-unlock-form .primary').click();assert.match(await page.locator('#warehouse-unlock-message').textContent(),/金币不足/);assert.equal((await state()).storage.boxes[9].unlocked,false);
    await page.locator('#warehouse-unlock-cancel').click();assert.equal((await state()).paused,true);
    await page.screenshot({path:path.join(shots,'warehouse.png')});
    await page.locator('#warehouse-close').click();await page.waitForFunction(()=>!window.lakeside.getState().paused);
    await rich(2500);assert.equal((await state()).storage.coins,2500);
    await command('rich');await page.locator('#rich-amount').fill('-1');await page.locator('#rich-form .primary').click();assert.match(await page.locator('#rich-message').textContent(),/非负整数/);
    await page.locator('#rich-amount').fill('1.5');await page.locator('#rich-form .primary').click();assert.equal((await state()).storage.coins,2500);
    await page.locator('#rich-amount').fill('99');await page.locator('#rich-cancel').click();assert.equal((await state()).storage.coins,2500);
    await page.locator('#warehouse-toggle').click();
    for(const index of [9,4]){await page.locator('#warehouse-box-'+index).click();await page.locator('#warehouse-unlock-form .primary').click();await page.locator('#warehouse-unlock-dialog').waitFor({state:'hidden'});assert.equal((await state()).paused,true);}
    assert.equal((await state()).storage.coins,500);assert.equal((await state()).storage.boxes[4].unlocked,true);
    await page.locator('#warehouse-box-0').click();
    await page.locator('#warehouse-sale').click();assert.equal(await page.locator('#warehouse-sale').getAttribute('aria-pressed'),'true');
    await card('#warehouse-bag','2').dblclick();assert.equal((await state()).inventory.items.length,2);assert.equal((await state()).storage.coins,500);
    await card('#warehouse-grid','1').dblclick();assert.equal((await state()).storage.coins,609);assert.equal((await state()).storage.boxes[0].items.length,0);
    await page.screenshot({path:path.join(shots,'sale.png')});
    await page.locator('#warehouse-sale').click();
    await card('#warehouse-bag','2').click();await cell('#warehouse-grid',0,0).click();
    await page.locator('#warehouse-close').click();await page.locator('#warehouse-toggle').click();assert.equal(await page.locator('#warehouse-sale').getAttribute('aria-pressed'),'false');
    const frozen=await disk();await page.reload({waitUntil:'domcontentloaded'});await loaded();assert.deepEqual(await disk(),frozen);assert.equal((await state()).storage.coins,609);
    const discoveriesBefore=await readSavedSection(page,'fisher-realm-discoveries-v1');
    await command('clear');assert.equal((await state()).inventory.items.length,0);assert.equal((await state()).storage.coins,0);assert.equal((await state()).storage.boxes[0].items[0].name,'大口黑鲈');assert.equal((await state()).storage.boxes[9].unlocked,true);
    assert.deepEqual(await readSavedSection(page,'fisher-realm-discoveries-v1'),discoveriesBefore);
    await page.locator('#settings-toggle').click();await page.locator('#warehouse-toggle').click();
    await page.evaluate(()=>{window.originalSave=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='fisher-realm-save-slots-v1')throw new DOMException('test quota','QuotaExceededError');return window.originalSave.call(this,key,value);};});
    const before=await state(),diskBefore=await disk();await page.locator('#warehouse-sale').click();await card('#warehouse-grid','2').dblclick();
    assert.match(await page.locator('#warehouse-hint').textContent(),/保存失败/);assert.deepEqual((await state()).storage,before.storage);assert.deepEqual(await disk(),diskBefore);
    await page.locator('#warehouse-close').click();await page.locator('#warehouse-toggle').click();
    assert.equal(await page.locator('#warehouse-dialog').evaluate(e=>e.open),false);await page.waitForFunction(()=>!window.lakeside.getState().paused);
    assert.deepEqual(await disk(),diskBefore);
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSave;});
    assert.equal(await page.locator('dialog>.coin-balance').count(),await page.locator('dialog').count());
    assert.equal(await page.locator('[data-coins]').evaluateAll(els=>els.every(e=>e.textContent==='0')),true);
    await command('realm owner');assert.equal((await state()).paused,true);await page.locator('#owner-close').click();
    await page.locator('#help').click();assert.ok(await page.locator('#help-dialog>.coin-balance').isVisible());await page.locator('#help-dialog .close').click();
    await page.locator('#backpack-toggle').click();assert.equal((await state()).inventory.items.length,0);await page.locator('#inventory-close').click();
    await page.setViewportSize({width:800,height:900});await page.locator('#warehouse-toggle').click();await page.screenshot({path:path.join(shots,'tablet.png')});await page.locator('#warehouse-close').click();
    await page.setViewportSize({width:390,height:844});await page.locator('#warehouse-toggle').click();await page.screenshot({path:path.join(shots,'mobile.png')});assert.equal(await page.locator('#warehouse-close').isVisible(),true);
    assert.deepEqual(errors,[]);
    const report={result:'passed',legacyMigration:true,dragBothDirections:true,collisionRejected:true,unlockAnyBox:true,warehouseOnlySale:true,richAndClear:true,refreshSaved:true,saveFailureRollback:true,modalPause:true,noRepeatedRender:true,viewports:[1440,800,390]};
    fs.writeFileSync(path.join(shots,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
