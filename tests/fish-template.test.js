import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import tool from '../scripts/prepare-fish.cjs';
import {FISH_DATA} from '../fish-data.js';

const sample=()=>({'标识':'TEMPLATE_TEST_FISH','名称':'模板测试鱼','颜色':'turquoise',
  '力量':{'间隔秒':.38,'降低韧性':3},'速度米每秒':8,'耐力':56,'休息秒':4,
  '挣扎':{'最小角度':30,'最大角度':60,'每段秒':[4,4,4],'换边停顿秒':0},
  '背包':{'高':1,'宽':5,'图片':null},'特殊属性':[]});

test('Chinese template converts exact units, height/width and shared catch/bag color',async()=>{
  assert.deepEqual(await tool.prepare(sample()),{
    id:'TEMPLATE_TEST_FISH',name:'模板测试鱼',catchColor:'#40e0d0',
    strength:{amount:3,interval:.38},restDuration:4,speed:8,stamina:56,
    struggle:{minAngle:30,maxAngle:60,durations:[4,4,4]},specials:[],
    inventory:{w:5,h:1,color:'#40e0d0',image:null}
  });
  const paused=sample();paused.挣扎.换边停顿秒=.3;paused.特殊属性=['换边前停顿0.3秒'];
  assert.equal((await tool.prepare(paused)).struggle.switchPause,.3);
});

test('missing values, ambiguous speed units, unsupported behavior and invalid bag shapes fail',async()=>{
  for(const mutate of [x=>delete x.速度米每秒,x=>x.速度每轮米=8,x=>x.力量.间隔秒=null,
    x=>x.速度米每秒='8米',x=>x.背包.高=5,x=>x.挣扎.每段秒=[0],
    x=>x.特殊属性=['跳出水面'],x=>x.背包.图片='../outside.png',x=>x.颜色='unknown',
    x=>{x.挣扎.每段秒=[4];x.挣扎.换边停顿秒=.3;x.特殊属性=['换边前停顿0.3秒'];}]) {
    const input=sample();mutate(input);await assert.rejects(tool.prepare(input));
  }
  const blank=JSON.parse(await readFile(new URL('../scripts/fish-template.json',import.meta.url),'utf8'));
  await assert.rejects(tool.prepare(blank));
});

test('template rejects duplicate identities using the real catalog without editing it',async()=>{
  for(const key of ['标识','名称']) {
    const input=sample();input[key]=key==='标识'?FISH_DATA[0].id:FISH_DATA[0].name;
    await assert.rejects(tool.prepare(input),/duplicate/);
  }
});

test('CLI emits a draft, warns missing art and cannot overwrite an existing output or catalog',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'fish-template-'));
  try {
    const input=join(folder,'input.json'),output=join(folder,'output.json');
    await writeFile(input,JSON.stringify(sample()));
    const original=await readFile(new URL('../fish-data.js',import.meta.url));
    const command=[fileURLToPath(new URL('../scripts/prepare-fish.cjs',import.meta.url)),input,'--output',output];
    const first=spawnSync(process.execPath,command,{encoding:'utf8'});
    assert.equal(first.status,0);assert.equal(first.stdout,'');
    assert.ok(first.stderr.includes('缺少图片'));
    assert.equal(JSON.parse(await readFile(output,'utf8')).speed,8);
    const before=await readFile(output);
    assert.throws(()=>execFileSync(process.execPath,command,{stdio:['ignore','pipe','pipe']}));
    assert.deepEqual(await readFile(output),before);
    assert.deepEqual(await readFile(new URL('../fish-data.js',import.meta.url)),original);
  } finally {
    assert.equal(dirname(folder),resolve(tmpdir()));
    await rm(folder,{recursive:true,force:true});
  }
});
