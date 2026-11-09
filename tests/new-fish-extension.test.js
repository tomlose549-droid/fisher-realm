import {copyCatalogSandbox} from './helpers/catalog-sandbox.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('appending a fish does not break eel checks; selected-fish rules need no old images',async t=>{
  const temp=await mkdtemp(join(tmpdir(),'fisher-extension-'));
  t.after(async()=>{assert.equal(dirname(resolve(temp)),resolve(tmpdir()));await rm(temp,{recursive:true,force:true});});
  const extra={id:'EXTENSION_TEST',name:'新增验收测试鱼',quality:'green',sellPrice:7,catchColor:'#008000',
    strength:{amount:3,interval:.16},restDuration:1.1,speed:3.4,stamina:47,
    struggle:{minAngle:31,maxAngle:36,durations:[4.4,1.5],switchPause:.3},
    specials:['换边前停顿0.3秒'],inventory:{w:3,h:2,color:'#008000',image:null}};
  await copyCatalogSandbox(temp,extra);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const existing=execFileSync(process.execPath,['--test','tests/american-eel.test.js'],{cwd:temp,env,encoding:'utf8',timeout:15000});
  assert.match(existing,/pass 4/);
  const run=id=>JSON.parse(execFileSync(process.execPath,['scripts/check-fish-rules.cjs',id],{cwd:temp,env,encoding:'utf8',timeout:15000}));
  assert.equal(run('AMERICAN_EEL').passed,true);
  const report=run(extra.id);assert.equal(report.passed,true);assert.equal(report.fish,extra.id);
  assert.equal(report.scope,'selected-fish');
  await assert.rejects(access(join(temp,'fish-images')),{code:'ENOENT'});
});
