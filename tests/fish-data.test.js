import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {FISH_DATA,FISH_CATALOG,createFishCatalog} from '../fish-data.js';
import * as rules from '../fishing-rules.js';
import {FISH_ITEMS,FishInventory} from '../inventory-rules.js';
const baseline=JSON.parse(await readFile(new URL('./fixtures/fish-baseline-v0251.json',import.meta.url),'utf8'));
const clone=v=>structuredClone(v);

test('pre-refactor profiles remain exact except the approved catch color synchronization',()=>{
 const catchColors={'罗非鱼':'#808080','蓝鳃太阳鱼':'#008000','金色闪光鲦':'#0000ff','大口黑鲈':'#0000ff','弓鳍鱼':'#0000ff','长吻雀鳝':'#4b0082'};
 assert.deepEqual(rules.FISH_SPECIES.slice(0,baseline.profiles.length),baseline.profiles.map(p=>catchColors[p.name]?{...p,catchColor:catchColors[p.name]}:p));
 // Approved metadata deltas: Florida gar image and the violet palette adjustment.
 for(const [name,item]of Object.entries(baseline.items))assert.deepEqual(FISH_ITEMS[name],name==='佛罗里达雀鳝'?{...item,image:'cutouts/florida-gar.png'}:name==='长吻雀鳝'?{...item,color:'#4b0082'}:item);
 for(const [i,data]of FISH_DATA.entries()){assert.equal(rules[data.id]??FISH_CATALOG.byId[data.id],rules.FISH_SPECIES[i]);assert.deepEqual(FISH_ITEMS[data.name],data.inventory);}
 assert.equal(rules.TILAPIA.struggle.firstDuration,3.9);assert.equal(rules.TILAPIA.struggle.durations,undefined);
 for(const fish of FISH_DATA)assert.equal(fish.catchColor,fish.inventory.color,fish.name);
});

test('all catalog fish have matching assets, valid intervals and automatic owner/save support',async()=>{
 assert.equal(rules.FISH_SPECIES.length,FISH_DATA.length);assert.equal(Object.keys(FISH_ITEMS).length,FISH_DATA.length);
 for(const [i,data]of FISH_DATA.entries()){
  assert.equal(rules.pickFish(i/FISH_DATA.length),rules.FISH_SPECIES[i]);assert.equal(rules.pickFish((i+1)/FISH_DATA.length-1e-9),rules.FISH_SPECIES[i]);
  const f=new rules.FishingSession(()=>0);assert.equal(f.setForcedFish(data.name),true);f.cast(0,0);assert.equal(f.profile,rules.FISH_SPECIES[i]);assert.equal(f.fishStamina,data.stamina);
  const b=new FishInventory();b.add(data.name);assert.deepEqual(new FishInventory(b.serialize()).serialize(),b.serialize());
  if(data.inventory.image)assert.ok((await readFile(new URL('../fish-images/'+data.inventory.image,import.meta.url))).length>0);
 }
 assert.equal(rules.pickFish(1),rules.FISH_SPECIES.at(-1));
});

test('validation rejects duplicate identities, invalid resources, unsupported legs, angles and bag shapes',()=>{
 const invalid=[e=>e.id='',e=>e.name=' ',e=>e.strength.amount=0,e=>e.strength.interval=NaN,e=>e.speed=Infinity,e=>e.restDuration=-1,e=>e.stamina=0,e=>e.catchColor='green',e=>e.struggle.minAngle=-1,e=>e.struggle.maxAngle=91,e=>e.struggle.minAngle=80,e=>e.struggle.durations=[],e=>e.struggle.durations=[1,1,1,1,1,1],e=>e.struggle.durations=[0],e=>e.struggle.switchPause=-1,e=>e.inventory.w=6,e=>e.inventory.h=4,e=>e.inventory.w=1.5,e=>e.inventory.color='blue',e=>e.inventory.image='../outside.png',e=>e.specials=null];
 for(const change of invalid){const entry=clone(FISH_DATA[1]);change(entry);assert.throws(()=>createFishCatalog([entry]),TypeError);}
 assert.throws(()=>createFishCatalog([]),TypeError);assert.throws(()=>createFishCatalog([clone(FISH_DATA[0]),clone(FISH_DATA[0])]),/duplicate/);
 const sameName=clone(FISH_DATA[0]);sameName.id='OTHER';assert.throws(()=>createFishCatalog([clone(FISH_DATA[0]),sameName]),/duplicate name/);
 const sameId=clone(FISH_DATA[0]);sameId.name='另一个名字';assert.throws(()=>createFishCatalog([clone(FISH_DATA[0]),sameId]),/duplicate id/);
 assert.ok(Object.isFrozen(FISH_DATA[0].struggle));assert.ok(Object.isFrozen(FISH_CATALOG.profiles[0].strength));
});

test('adding one data entry alone supports encounters, owner selection, catch, packing and old saves',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'fisher-catalog-'));
 t.after(async()=>{assert.equal(dirname(resolve(temp)),resolve(tmpdir()));assert.ok(basename(temp).startsWith('fisher-catalog-'));await rm(temp,{recursive:true,force:true});});
 const extra={id:'TEST_FISH',name:'仅配置测试鱼',strength:{amount:2,interval:.2},restDuration:3,speed:2,stamina:12,struggle:{minAngle:35,maxAngle:40,durations:[1,2,1,2,1]},specials:[],catchColor:'#90ee90',inventory:{w:2,h:1,color:'#008000',image:null}};
 for(const name of ['fishing-rules.js','inventory-rules.js'])await copyFile(new URL('../'+name,import.meta.url),join(temp,name));
 const source=await readFile(new URL('../fish-data.js',import.meta.url),'utf8');
 await writeFile(join(temp,'fish-data.js'),source.replace('createFishCatalog(FISH_DATA);',`createFishCatalog([...FISH_DATA,${JSON.stringify(extra)}]);`));await writeFile(join(temp,'package.json'),'{"type":"module"}');
 const r=await import(pathToFileURL(join(temp,'fishing-rules.js'))),inv=await import(pathToFileURL(join(temp,'inventory-rules.js')));
 assert.equal(r.FISH_SPECIES.length,FISH_DATA.length+1);assert.equal(r.pickFish(1).name,extra.name);assert.deepEqual(inv.FISH_ITEMS[extra.name],extra.inventory);
 const f=new r.FishingSession(()=>0);assert.equal(f.setForcedFish(extra.name),true);f.cast(0,0);assert.equal(f.hook(6),true);assert.equal(f.profile.name,extra.name);assert.equal(f.fishStamina,12);
 f.setRodYaw(f.struggleYaw,6);f.setReeling(true,6);f.advance(6.2);assert.equal(f.durability,98);f.advance(6.25);assert.equal(f.fishStamina,9);
 f.fishStamina=0;f.fishPhase='exhausted';f.phaseEndsAt=Infinity;f.setRodYaw(f.fishYaw,6.25);f.advance(13);assert.equal(f.lastCatchName,extra.name);assert.equal(f.lastCatchColor,extra.catchColor);assert.equal(f.ownerState.remaining,9);
 const old={version:1,items:baseline.profiles.map((p,i)=>({id:String(i+1),name:p.name,x:null,y:null}))};const b=new inv.FishInventory(old);assert.deepEqual(b.serialize(),old);b.add(extra.name);assert.equal(b.items.at(-1).name,extra.name);assert.deepEqual(new inv.FishInventory(b.serialize()).serialize(),b.serialize());
});
