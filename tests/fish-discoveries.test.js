import test from 'node:test';
import assert from 'node:assert/strict';
import {FISH_DATA} from '../fish-data.js';
import {FishDiscoveries,createFishDiscoveries,DISCOVERIES_KEY} from '../fish-discoveries.js';

function memory(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}

test('a new guide starts fully locked; only valid catches unlock stable fish IDs',()=>{
  const d=new FishDiscoveries();for(const f of FISH_DATA)assert.equal(d.has(f.id),false);
  assert.equal(d.unlock('unknown'),false);assert.equal(d.unlock(FISH_DATA[0].name),true);assert.equal(d.unlock(FISH_DATA[0].name),false);
  assert.equal(d.has(FISH_DATA[0].id),true);assert.deepEqual(d.serialize(),{version:1,fishIds:[FISH_DATA[0].id]});
  for(const f of FISH_DATA.slice(1))assert.equal(d.unlock(f.name),true);assert.deepEqual(d.serialize().fishIds,FISH_DATA.map(f=>f.id));
});
test('saved discoveries restore by ID, reject invalid data and retain configuration order',()=>{
  const ids=[FISH_DATA[3].id,FISH_DATA[0].id,'UNKNOWN',FISH_DATA[3].id,null];
  const d=new FishDiscoveries({version:1,fishIds:ids});assert.deepEqual(d.serialize().fishIds,[FISH_DATA[0].id,FISH_DATA[3].id]);
  const copy=d.serialize();copy.fishIds.length=0;assert.equal(d.has(FISH_DATA[0].id),true);
  for(const bad of [null,{},[],{version:2,fishIds:ids},{version:1,fishIds:'all'}])assert.deepEqual(new FishDiscoveries(bad).serialize().fishIds,[]);
});
test('legacy bag and pile fish seed discoveries without modifying inventory data',()=>{
  const items=[{name:FISH_DATA[0].name,x:0,y:0},{name:FISH_DATA[3].name,x:null,y:null},{name:FISH_DATA[0].name},{name:'unknown'}],before=structuredClone(items),d=new FishDiscoveries();
  assert.equal(d.seed(items),true);assert.equal(d.seed(items),false);assert.deepEqual(d.serialize().fishIds,[FISH_DATA[0].id,FISH_DATA[3].id]);assert.deepEqual(items,before);
});
test('catch history persists independently of clearing bag and pile or reloading',()=>{
  const storage=memory(),inventoryKey='fisher-realm-inventory-v1',items=[{name:FISH_DATA[0].name,x:0,y:0}];storage.setItem(inventoryKey,JSON.stringify({version:1,items}));
  const history=createFishDiscoveries({items,storage});assert.equal(history.has(FISH_DATA[0].id),true);assert.equal(history.unlock(FISH_DATA[1].name),true);
  storage.setItem(inventoryKey,JSON.stringify({version:1,items:[]}));
  const reloaded=createFishDiscoveries({items:[],storage});assert.equal(reloaded.has(FISH_DATA[0].id),true);assert.equal(reloaded.has(FISH_DATA[1].id),true);assert.deepEqual(JSON.parse(storage.getItem(inventoryKey)).items,[]);
  assert.deepEqual(JSON.parse(storage.getItem(DISCOVERIES_KEY)).fishIds,[FISH_DATA[0].id,FISH_DATA[1].id]);
});
test('corrupt discovery saves can recover known bag fish and future catches',()=>{
  const storage=memory();storage.setItem(DISCOVERIES_KEY,'{bad json');const d=createFishDiscoveries({items:[{name:FISH_DATA[2].name}],storage});
  assert.equal(d.has(FISH_DATA[2].id),true);assert.equal(d.has(FISH_DATA[0].id),false);d.unlock(FISH_DATA[0].name);
  assert.deepEqual(JSON.parse(storage.getItem(DISCOVERIES_KEY)).fishIds,[FISH_DATA[0].id,FISH_DATA[2].id]);
});
test('blocked storage keeps session unlocks and reports failed persistence without crashing catches',()=>{
  let failures=0;const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}};
  const d=createFishDiscoveries({storage,onSaveError:()=>failures++});assert.equal(d.unlock(FISH_DATA[0].name),true);assert.equal(d.has(FISH_DATA[0].id),true);assert.equal(failures,1);assert.equal(d.unlock(FISH_DATA[0].name),false);assert.equal(failures,1);
});

test('failed discovery save retries on duplicate catch and persists after inventory is cleared',()=>{
  const storage=memory();let blocked=true,warnings=0,writes=0;const original=storage.setItem;
  storage.setItem=(key,value)=>{writes++;if(blocked)throw Error('quota');original(key,value);};
  const d=createFishDiscoveries({storage,onSaveError:()=>warnings++});d.unlock(FISH_DATA[0].name);assert.equal(warnings,1);assert.equal(d.has(FISH_DATA[0].id),true);
  blocked=false;assert.equal(d.unlock(FISH_DATA[0].name),false);assert.equal(writes,2);
  assert.equal(createFishDiscoveries({items:[],storage}).has(FISH_DATA[0].id),true);d.flush();assert.equal(writes,2);
});
test('explicit flush retries failed migration, deduplicates warnings and stops writing after success',()=>{
  const storage=memory();let blocked=true,warnings=0,writes=0;const original=storage.setItem;
  storage.setItem=(key,value)=>{writes++;if(blocked)throw Error('blocked');original(key,value);};
  const d=createFishDiscoveries({items:[{name:FISH_DATA[0].name}],storage,onSaveError:()=>warnings++});assert.equal(d.flush(),false);assert.equal(warnings,1);
  blocked=false;assert.equal(d.flush(),true);const before=writes;d.flush();assert.equal(writes,before);assert.equal(createFishDiscoveries({storage}).has(FISH_DATA[0].id),true);
});
