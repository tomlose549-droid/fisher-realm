// Check only the requested catalog entry; never open another fish's asset.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

async function checkFish(selector) {
  const load=name=>import(pathToFileURL(path.join(root,name)).href);
  const {FISH_DATA,FISH_CATALOG,createFishCatalog,DEFAULT_CATCH_COLOR}=await load('fish-data.js');
  const {FishingSession,FISH_SPECIES,FISHING,pickFish}=await load('fishing-rules.js');
  const {FishInventory,FISH_ITEMS}=await load('inventory-rules.js');
  const {FishDiscoveries}=await load('fish-discoveries.js');
  const {buildFishGuide}=await load('fish-guide.js');
  const data=FISH_DATA.find(f=>f.id===selector||f.name===selector);
  assert.ok(data,`Unknown fish: ${selector}`);
  const expected=createFishCatalog([data]).byId[data.id],profile=FISH_CATALOG.byId[data.id];
  assert.deepEqual(profile,expected);assert.deepEqual(FISH_ITEMS[data.name],data.inventory);
  const index=FISH_DATA.findIndex(f=>f.id===data.id);
  assert.equal(pickFish((index+.5)/FISH_SPECIES.length),profile);
  const owner=new FishingSession(()=>0);
  assert.equal(owner.setForcedFish(data.name),true);owner.cast(0,0);
  assert.equal(owner.profile,profile);assert.equal(owner.fishStamina,data.stamina);
  const fight=(fish,random=()=>0)=>{const f=new FishingSession(random,{fish});f.cast(0,0);assert.equal(f.hook(6),true);return f;};
  const durations=data.struggle.durations??[data.struggle.firstDuration,data.struggle.secondDuration];
  for(const side of [0,1])for(const sample of [0,1]) {
    const rolls=[0,side,sample],moving=fight(profile,()=>rolls.shift()??0);
    const dt=Math.min(.01,durations[0]/10,.1/Math.max(1,data.speed));moving.advance(6+dt);
    const angle=(sample?data.struggle.maxAngle:data.struggle.minAngle)*Math.PI/180;
    close(moving.fishX,(side?1:-1)*data.speed*Math.cos(angle)*dt);
    close(moving.fishZ,-FISHING.distance-data.speed*Math.sin(angle)*dt);
  }
  // Check timing transitions without simulating an escape during a full struggle.
  const phases=fight({...profile,speed:0});let time=6;
  for(let i=0;i<durations.length;i++) {
    assert.equal(phases.phaseIndex,i);assert.equal(phases.struggling,true);
    assert.equal(phases.phaseSide,i%2?-1:1);close(phases.phaseEndsAt,time+durations[i]);
    close(Math.abs(phases.struggleYaw-phases.roundYaw),(90-data.struggle.minAngle)*Math.PI/180);
    time+=durations[i];phases.transition(time);
    if(i<durations.length-1 && data.struggle.switchPause>0) {
      assert.equal(phases.fishPhase,'switch-pause');time+=data.struggle.switchPause;
      close(phases.phaseEndsAt,time);phases.transition(time);
    }
  }
  assert.equal(phases.fishPhase,'rest');close(phases.phaseEndsAt,time+data.restDuration);
  phases.transition(time+data.restDuration);assert.equal(phases.round,2);
  const tension=fight({...profile,speed:0,stamina:Math.max(10000,data.stamina)});
  tension.setRodYaw(tension.struggleYaw,6);tension.setReeling(true,6);
  const tick=Math.min(.001,data.strength.interval/2,durations[0]/2);
  tension.damageClock=data.strength.interval-tick/2;tension.advance(6+tick);
  close(tension.durability,Math.max(0,100-data.strength.amount));
  const caught=fight({...profile,speed:0,stamina:0});caught.setRodYaw(caught.fishYaw,6);caught.setReeling(true,6);
  caught.advance(6+(FISHING.distance-FISHING.catchDistance)/(FISHING.baseSpeed*1.2)+.1);
  assert.equal(caught.lastCatchName,data.name);assert.equal(caught.lastCatchColor,data.catchColor??DEFAULT_CATCH_COLOR);
  const bag=new FishInventory(),capacity=Math.floor(5/data.inventory.w)*Math.floor(3/data.inventory.h);
  for(let i=0;i<=capacity;i++)bag.add(data.name);
  assert.equal(bag.items.at(-1).x,null);
  assert.deepEqual(new FishInventory(bag.serialize()).serialize(),bag.serialize());
  const discoveries=new FishDiscoveries(undefined,[data]);discoveries.unlock(data.name);assert.equal(discoveries.has(data.id),true);
  const guide=buildFishGuide([data]).fish[0];assert.equal(guide.id,data.id);
  assert.equal(guide.width,data.inventory.w);assert.equal(guide.height,data.inventory.h);assert.equal(guide.image,data.inventory.image);
  return {fish:data.id,scope:'selected-fish',passed:true,
    checks:['profile','encounter-owner','movement','legs-rest-pause','strength','catch','inventory-save','guide-unlock']};
}
module.exports={checkFish};
if(require.main===module) {
  if(process.argv.length!==3){console.error('Usage: node scripts/check-fish-rules.cjs FISH_ID_OR_NAME');process.exitCode=1;}
  else checkFish(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
}
