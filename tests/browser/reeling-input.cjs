const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),key='fisher-realm-save-slots-v1';
const legacy={version:1,items:[{id:'1',name:'罗非鱼',x:null,y:null}],storage:{version:1,quests:{version:1,mainCompleted:1,counts:[0,0],side1Done:false},coins:1000,activeBox:0,boxes:Array.from({length:10},(_,i)=>({unlocked:i===0,items:i?[]:[{id:'2',name:'1号鱼线',x:0,y:0},{id:'3',name:'2号鱼线',x:1,y:0},{id:'4',name:'3号鱼线',x:2,y:0},{id:'5',name:'1号渔轮-初学者',x:3,y:0},{id:'6',name:'1号亮片',quantity:2,x:5,y:0}]}))}};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
async function main(){
 const server=http.createServer((req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}).end(fs.readFileSync(file));
 }catch{res.writeHead(404).end();}});let browser;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port+'/';
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await context.addInitScript(legacy=>{
   window.refitTime=100;window.refitUnit=null;const random=Math.random;Math.random=()=>window.refitUnit===null?random():window.refitUnit;
   if(!localStorage.getItem('fisher-realm-save-slots-v1')&&!localStorage.getItem('fisher-realm-inventory-v1'))localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify(legacy));
  },legacy);
  await page.route('**/game-time.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game-time.js'),'utf8').replace('performance.now()/1000','globalThis.refitTime').replace('now(raw=this.raw()){','now(raw=this.raw()){raw=this.raw();')}));
  // Test-only strong, slow fish reliably causes a real line-broken event before escaping/catching.
  await page.route('**/fish-data.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'fish-data.js'),'utf8').split('\n').map(line=>{if(!line.includes('"id":"TILAPIA"'))return line;const f=JSON.parse(line.trim().replace(/,$/,''));Object.assign(f,{strength:{amount:.01,interval:10},speed:.01,stamina:10000});return JSON.stringify(f)+',';}).join('\n')}));
  const state=()=>page.evaluate(()=>window.lakeside.getState()),disk=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  async function loaded(){await page.waitForFunction(()=>window.lakeside);await page.locator('#loading').waitFor({state:'hidden'});assert.equal(await page.locator('#error').isVisible(),false);await page.evaluate(()=>window.refitUnit=0);}
  async function closeShop(){await page.locator('#shop-close').click();await page.waitForFunction(()=>!window.lakeside.getState().paused);}
  async function openRefit(){await page.locator('#shop-toggle').click();await page.locator('#shop-refit-tab').click();assert.equal((await state()).paused,true);}
  const candidate=id=>page.locator('[data-equipment-id="'+id+'"] .refit-equip');
  async function tick(seconds){const frame=await page.evaluate(s=>{window.refitTime+=s;return window.lakeside.getState().frames;},seconds);await page.waitForFunction(f=>window.lakeside.getState().frames>f,frame);}
  async function cast(){await page.locator('#scene').focus();await page.keyboard.press('Space');}
  async function reload(){await page.reload({waitUntil:'domcontentloaded'});await loaded();}
  async function selectOwner(){await page.locator('#settings-toggle').click();await page.locator('#realm-command').fill('realm owner');await page.locator('#owner-fish').selectOption({label:'罗非鱼'});await page.locator('#owner-fish-form .primary').click();await page.waitForFunction(()=>!window.lakeside.getState().paused);}
  async function breakLine(){await page.evaluate(()=>window.refitUnit=.99);await cast();await tick(6.1);assert.equal((await state()).fishing.state,'bite');await page.keyboard.press('KeyH');await page.mouse.move(720,500);await page.mouse.down();await tick(.2);await page.mouse.up();assert.equal((await state()).fishing.failure.reason,'line-broken');}
  if(process.argv.includes('--baseline'))for(const file of ['main.js','fishing.js'])await page.route('**/'+file+'*',r=>r.fulfill({contentType:'text/javascript',body:require('node:child_process').execFileSync('git',['show','origin/main:'+file],{cwd:root,encoding:'utf8'})}));
  await page.goto(url,{waitUntil:'domcontentloaded'});await loaded();await selectOwner();await cast();await tick(6.1);assert.equal((await state()).fishing.state,'bite');await page.keyboard.press('KeyH');assert.equal((await state()).fishing.state,'fighting');await page.mouse.move(720,500);
  await page.evaluate(()=>{window.reelEvents=[];for(const type of ['pointerdown','pointermove','pointerup','mousedown','mouseup'])document.querySelector('#scene').addEventListener(type,e=>window.reelEvents.push({type,button:e.button,buttons:e.buttons}));});
  await page.mouse.down({button:'right'});await page.mouse.down({button:'left'});console.log(JSON.stringify({case:'right-then-left',reeling:(await state()).fishing.reeling,events:await page.evaluate(()=>window.reelEvents)}));assert.equal((await state()).fishing.reeling,true,'left pressed while right held must start reeling');const distance=(await state()).fishing.distance;await tick(.2);assert.ok((await state()).fishing.distance<distance,'real fish must be reeled in');
  await page.mouse.up({button:'left'});assert.equal((await state()).fishing.reeling,false,'release left while right held must stop');await page.mouse.down({button:'left'});assert.equal((await state()).fishing.reeling,true);await page.mouse.up({button:'right'});assert.equal((await state()).fishing.reeling,true,'releasing right must not stop left reeling');await page.mouse.up({button:'left'});assert.equal((await state()).fishing.reeling,false);
  await reload();await selectOwner();await cast();await tick(6.1);await page.mouse.move(720,500);await page.mouse.down({button:'left'});assert.equal((await state()).fishing.state,'bite');await page.keyboard.press('KeyH');assert.equal((await state()).fishing.reeling,true,'left held before hook must start reeling without another click');await tick(.15);await page.mouse.up({button:'left'});assert.equal((await state()).fishing.reeling,false);
  await page.mouse.down({button:'left'});assert.equal((await state()).fishing.reeling,true);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).fishing.reeling,false,'blur releases input');await page.mouse.move(725,500);assert.equal((await state()).fishing.reeling,true,'actual held buttons recover after returning');await page.mouse.up({button:'left'});
  await page.locator('#shop-toggle').click();assert.equal((await state()).paused,true);assert.equal((await state()).fishing.reeling,false);await closeShop();await page.mouse.move(720,500);await page.mouse.down({button:'left'});assert.equal((await state()).fishing.reeling,true);await page.mouse.up({button:'left'});assert.equal((await state()).fishing.reeling,false);assert.deepEqual(errors,[]);
  const out=path.join(root,'.qa/reeling-input');fs.mkdirSync(out,{recursive:true});const report={result:'passed',rightThenLeft:true,leftReleaseDuringChord:true,rightReleaseKeepsLeft:true,heldBeforeHook:true,actualDistanceReduced:true,blurReleaseAndRecovery:true,modalRelease:true,pageErrors:errors};fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
