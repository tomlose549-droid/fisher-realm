// Reproduce cold, slow and failed grass-carp downloads without a player's save.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..');
const thumb='/fish-images/thumbnails/cutouts/grass-carp.webp',original='/fish-images/cutouts/grass-carp.png';
const saved={version:1,items:[{id:'1',name:'草鱼',x:0,y:0},{id:'2',name:'草鱼',x:null,y:null}]};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
async function state(page,wrapper,expected){
  await wrapper.scrollIntoViewIfNeeded();
  await page.waitForFunction(el=>['ready','error'].includes(el.dataset.imageState),await wrapper.elementHandle(),{timeout:20000});
  assert.equal(await wrapper.getAttribute('data-image-state'),expected);
  if(expected==='ready')assert.ok(await wrapper.locator('img:not(.guide-preview)').evaluate(img=>img.complete&&img.naturalWidth>0));
}
async function main(){
  const server=http.createServer((req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
      if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
      res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
    }catch{res.writeHead(404).end();}
  });
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
    for(const scenario of ['cold-slow','backpack-retry','guide-retry']){
      const context=await browser.newContext({viewport:{width:1440,height:960}});
      try{
        await context.addInitScript(saved=>localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(saved)),saved);
        const page=await context.newPage(),errors=[],requests=[];let fail=scenario!=='cold-slow',failOriginal=false;
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/fish-images/**',async route=>{
          const url=new URL(route.request().url());requests.push(url);
          assert.ok([thumb,original].includes(url.pathname),'Only the affected fish should be requested');
          if(fail||(failOriginal&&url.pathname===original))return route.fulfill({status:503,body:'temporary failure'});
          if(scenario==='cold-slow'&&url.pathname===thumb)await new Promise(resolve=>setTimeout(resolve,11000));
          return route.continue();
        });
        await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
        await page.locator('#loading').waitFor({state:'hidden'});
        if(scenario!=='guide-retry'){
          await page.locator('#backpack-toggle').click();
          const cards=page.locator('.inventory-fish');assert.equal(await cards.count(),2);
          for(let i=0;i<2;i++)await state(page,cards.nth(i),fail?'error':'ready');
          if(fail){
            fail=false;await cards.nth(0).click();await state(page,cards.nth(0),'ready');
            assert.equal(await page.locator('.inventory-fish.selected').count(),0,'Retry must not select or move a fish');
            await cards.nth(1).focus();await page.keyboard.press('Enter');await state(page,cards.nth(1),'ready');
            assert.equal(await page.locator('.inventory-fish.selected').count(),0);
            assert.ok(requests.some(url=>url.searchParams.get('retry')?.startsWith('manual-')),'Manual retry must bypass a cached failure');
          }else{
            assert.equal(requests.filter(url=>url.pathname===thumb).length,1,'Slow cards share one request without an 8-second abort');
            assert.equal(requests.filter(url=>url.pathname===original).length,0,'Slow thumbnails must not fall back to the original');
          }
          const shots=path.join(root,'.qa/image-retry');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,scenario+'.png')});
          await page.locator('#inventory-close').click();
        }else{
          await page.locator('#settings-toggle').click();await page.locator('#fish-guide-toggle').click();await page.locator('#fish-guide-search').fill('草鱼');
          const guide=page.locator('[data-guide-fish-id="GRASS_CARP"]'),thumbnail=guide.locator('.guide-thumbnail');
          await state(page,thumbnail,'error');assert.equal(await guide.evaluate(el=>el.open),false);
          assert.equal(requests.filter(url=>url.pathname===original).length,0);
          fail=false;await thumbnail.locator('.guide-image-retry').focus();await page.keyboard.press('Enter');await state(page,thumbnail,'ready');
          assert.equal(await guide.evaluate(el=>el.open),false,'Retry must not expand the summary');
          failOriginal=true;await guide.locator('summary').click();const large=guide.locator('.guide-large-image');await state(page,large,'error');
          assert.ok(await large.locator('.guide-preview').evaluate(img=>!img.hidden&&img.complete&&img.naturalWidth>0),'Keep the thumbnail when the original fails');
          failOriginal=false;await large.locator('.guide-image-retry').click();await state(page,large,'ready');assert.equal(await guide.evaluate(el=>el.open),true);
          const shots=path.join(root,'.qa/image-retry');fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,scenario+'.png')});
          await page.locator('#fish-guide-close').click();
        }
        assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('fisher-realm-inventory-v1'))),saved);
        assert.deepEqual(errors,[]);console.log(JSON.stringify({scenario,result:'passed'}));
      }finally{await context.close();}
    }
  }finally{
    if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
