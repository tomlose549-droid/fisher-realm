const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html',file=path.resolve(root,name);if(path.relative(root,file).startsWith('..'))return res.writeHead(403).end();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
(async()=>{let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('fisher-realm-inventory-v1',JSON.stringify({version:1,items:[{id:'1',name:'美洲鳗鲡',x:0,y:0}]}));});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#loading').waitFor({state:'hidden'});
  const initial=await page.evaluate(()=>window.lakeside.getState());
  assert.equal(initial.scene,'summer-pond');assert.equal(initial.treeCount,137);assert.equal(initial.targetFps,25);
  assert.deepEqual(initial.camera,[0,1.78,32]);assert.deepEqual(initial.chairs.map(c=>c.horizontalDistance),[10,0,10]);
  await page.locator('#settings-toggle').click();await page.locator('#quality').click();
  await page.waitForFunction(()=>window.lakeside.getState().map.reflectionSize[0]===640);
  await page.locator('#quality').click();
  await page.waitForFunction(()=>window.lakeside.getState().map.reflectionSize[0]===1024);
  await page.locator('#help').click();await page.waitForFunction(()=>window.lakeside.getState().paused);
  const reports=await page.evaluate(async()=>{
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const THREE=await import('./vendor/three.module.js'),{createMapRuntime}=await import('./map-runtime.js');
    const {getMapContext,listMaps}=await import('./map-registry.js'),{createPond}=await import('./pond-scene.js');
    const {createIdleRod}=await import('./idle-rod.js'),{createFishing}=await import('./fishing.js');
    const inventoryBefore=localStorage.getItem('fisher-realm-inventory-v1'),guideBefore=localStorage.getItem('fisher-realm-discoveries-v1');
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,4/3,.06,420),sentinel=new THREE.Group();scene.add(camera,sentinel);
    const background=new THREE.Color('#123456'),fog=new THREE.Fog('#ffffff',10,100);scene.background=background;scene.fog=fog;
    const renderer=new THREE.WebGLRenderer();renderer.setSize(320,240);renderer.shadowMap.enabled=true;
    const memory=[],cycleReports=[];
    try{
      for(let i=0;i<3;i++){
        const map=await createMapRuntime({scene,camera,renderer});map.update(1);map.setQuality(false);
        check(map.getDiagnostics().reflectionSize.join(',')==='640,400','fast reflection size');
        map.setQuality(true);camera.updateMatrixWorld();map.renderReflection({frame:1,fine:true,force:true});renderer.render(scene,camera);
        if(i===0){
          const render=renderer.render;let after=false;renderer.render=()=>{throw Error('intentional reflection failure');};
          try{map.renderReflection({frame:2,fine:true,force:true,after:()=>{after=true;}});}catch(error){check(error.message==='intentional reflection failure','unexpected reflection error');}
          finally{renderer.render=render;}
          check(after&&renderer.getRenderTarget()===null,'reflection did not restore renderer/hooks');
          let water;scene.traverse(o=>{if(o.material?.uniforms?.mirrorMap)water=o;});check(water.visible,'reflection left water hidden');
        }
        map.dispose();map.dispose();check(map.getDiagnostics().disposed,'map not disposed');
        check(scene.children.length===2&&sentinel.parent===scene&&camera.parent===scene,'map disposed shared objects');
        check(scene.background===background&&scene.fog===fog,'map environment not restored');
        renderer.render(scene,camera);memory.push({...renderer.info.memory});cycleReports.push({disposed:true,sharedObjectsPreserved:true});
      }
      check(memory.every(m=>m.geometries===memory[0].geometries&&m.textures===memory[0].textures),'GPU allocations accumulated across map lifecycles');
      const create=document.createElement;
      document.createElement=function(tag,...args){if(tag==='canvas')throw Error('intentional map create failure');return create.call(this,tag,...args);};
      try{createPond(scene,camera,renderer);throw Error('expected creation failure');}
      catch(error){check(error.message==='intentional map create failure','wrong create failure');}
      finally{document.createElement=create;}
      check(scene.children.length===2&&scene.background===background&&scene.fog===fog,'failed construction leaked map state');
    }finally{renderer.dispose();renderer.forceContextLoss();}

    const ownScene=new THREE.Scene(),ownCamera=new THREE.PerspectiveCamera(),position=new THREE.Vector3(10,9,20);ownCamera.position.copy(position);
    const equipment=createIdleRod(ownCamera),base=getMapContext(),pool=[{...base.fishPool[0],speed:0,stamina:.001}],AudioBefore=window.Audio,random=Math.random,catches=[];
    let clock=0,fishing;
    try{
      window.Audio=class{constructor(){this.paused=true;this.ended=false;}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}removeAttribute(){}load(){}};
      Math.random=()=>0;
      const context={...base,waterLevel:7,spawn:{position:position.toArray(),yaw:0,pitch:-.065},isWater:()=>true,fishPool:pool};
      fishing=createFishing({scene:ownScene,camera:ownCamera,player:position,mapContext:context,canvas:{setPointerCapture(){},focus(){},style:{}},idleRod:equipment.root,toast(){},onReady(){},onCast(){},onHook(){},onCaught:name=>catches.push(name),getTime:()=>clock});
      check(fishing.key({code:'Space',repeat:false}),'cast input rejected');clock=1;fishing.update(clock);
      const waiting=fishing.getState();check(waiting.fishName===pool[0].name,'injected fish pool ignored');
      check(Math.abs(waiting.visuals.lineEnd[1]-(7.095+Math.sin(2)*.015))<1e-5,'waiting float ignored water height');
      check(Math.abs(waiting.visuals.waves.last.landing.position[1]-7.012)<1e-9,'landing ignored water height');
      clock=6;fishing.key({code:'KeyA',repeat:false});fishing.update(clock);
      check(fishing.getState().state==='fighting','hook input failed');
      check(Math.abs(fishing.getState().visuals.waves.last.hook.position[1]-7.012)<1e-9,'hook ignored water height');
      fishing.pointerDown({button:0,pointerId:1});clock=11.1;fishing.update(clock);
      const caught=fishing.getState();check(caught.state==='caught'&&catches.join(',')===pool[0].name,'catch callback failed');
      check(caught.visuals.rodLift>.025&&caught.visuals.retrievalProgress>0,'catch lift animation missing');
      check(Math.abs(caught.visuals.waves.last.catch.position[1]-7.012)<1e-9,'catch wave ignored water height');
      clock=11.8;fishing.update(clock);check(fishing.getState().state==='idle','recast reset failed');
      fishing.dispose();fishing.dispose();check(ownScene.children.length===0,'fishing resources leaked');
      check(equipment.root.parent===ownCamera,'fishing disposed shared idle rod');equipment.dispose();
    }finally{fishing?.dispose();equipment.dispose();window.Audio=AudioBefore;Math.random=random;}
    check(localStorage.getItem('fisher-realm-inventory-v1')===inventoryBefore,'map lifecycle changed inventory');
    check(localStorage.getItem('fisher-realm-discoveries-v1')===guideBefore,'map lifecycle changed discoveries');
    check(listMaps().length===1,'a second production map was added');
    return {cycles:cycleReports,memory,constructionFailureCleaned:true,reflectionFailureRestored:true,
      injectedWaterAndPool:true,catchAndRetrieval:true,globalSavesPreserved:true,registeredMaps:listMaps()};
  });
  assert.deepEqual(errors,[]);console.log(JSON.stringify(reports));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
