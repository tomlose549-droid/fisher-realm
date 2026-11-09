const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),saved={version:1,items:[{id:'1',name:'罗非鱼',x:0,y:0}]};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
async function main(){
  const {FISH_DATA}=await import(pathToFileURL(path.join(root,'fish-data.js')).href);
  const {SUMMER_POND_ENCOUNTERS}=await import(pathToFileURL(path.join(root,'maps/summer-pond-fish.js')).href);
  const server=http.createServer((req,res)=>{try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
  }catch{res.writeHead(404).end();}});
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:1440,height:960}});
    await context.addInitScript(saved=>{const random=Math.random;window.encounterTestUnit=null;Math.random=()=>window.encounterTestUnit===null?random():window.encounterTestUnit;if(!localStorage.getItem('fisher-realm-inventory-v1'))localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(saved));},saved);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    async function loaded(){await page.locator('#loading').waitFor({state:'hidden'});assert.equal(await page.locator('#error').isVisible(),false);}
    await loaded();
    for(const [unit,name]of [[.155,'蓝鳃太阳鱼'],[.799,'长吻雀鳝']]){
      await page.evaluate(unit=>{window.encounterTestUnit=unit;},unit);await page.locator('#scene').focus();await page.keyboard.press('Space');
      assert.equal((await page.evaluate(()=>window.lakeside.getState())).fishing.fishName,name);
      await page.reload({waitUntil:'domcontentloaded'});await loaded();
    }
    await page.locator('#help').click();assert.equal(await page.locator('.help-fish-entry').count(),FISH_DATA.length);
    assert.ok(!(await page.locator('#help-species-summary').textContent()).includes('每种概率为1/'));
    for(const fish of FISH_DATA){const text=await page.locator('[data-help-fish-id="'+fish.id+'"]').textContent();assert.ok(text.includes('当前地图遇鱼概率：'+SUMMER_POND_ENCOUNTERS.probabilityFor(fish.id)+'%。'),fish.name);}
    await page.locator('[data-help-fish-id="TILAPIA"] summary').click();
    const shots=path.join(root,'.qa/map-probabilities');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'help.png')});
    await page.locator('#help-dialog .close').click();await page.locator('#settings-toggle').click();await page.locator('#fish-guide-toggle').click();
    assert.equal(await page.locator('.guide-locked').count(),FISH_DATA.length-1);
    assert.equal(await page.locator('[data-guide-fish-id]').count(),1);
    await page.locator('#fish-guide-search').fill('罗非鱼');const guide=page.locator('[data-guide-fish-id="TILAPIA"]');await guide.locator('summary').click();
    assert.ok((await guide.locator('dd').allTextContents()).includes('15%'));
    await page.waitForFunction(()=>document.querySelector('.guide-large-image')?.dataset.imageState==='ready');
    await page.screenshot({path:path.join(shots,'guide.png')});
    await page.reload({waitUntil:'domcontentloaded'});await loaded();
    await page.locator('#settings-toggle').click();await page.locator('#realm-command').fill('realm owner');await page.locator('#owner-fish').selectOption({label:'长吻雀鳝'});await page.locator('#owner-fish-form .primary').click();
    await page.evaluate(()=>{window.encounterTestUnit=0;});await page.locator('#scene').focus();await page.keyboard.press('Space');
    let state=await page.evaluate(()=>window.lakeside.getState());assert.equal(state.fishing.fishName,'长吻雀鳝');assert.equal(state.fishing.ownerMode.remaining,10);
    await page.reload({waitUntil:'domcontentloaded'});await loaded();await page.evaluate(()=>{window.encounterTestUnit=0;});await page.locator('#scene').focus();await page.keyboard.press('Space');
    state=await page.evaluate(()=>window.lakeside.getState());assert.equal(state.fishing.fishName,'罗非鱼');assert.equal(state.fishing.ownerMode.remaining,0);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('fisher-realm-inventory-v1'))),saved);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('fisher-realm-discoveries-v1')).fishIds),['TILAPIA']);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',weightedCasts:true,helpAll27:true,guideLockedAndChance:true,ownerOverride:true,savesPreserved:true}));
  }finally{if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
