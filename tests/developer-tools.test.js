import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import command from '../scripts/bounded-command.cjs';
import acceptance from '../scripts/check-new-fish.cjs';
import network from '../scripts/git-network.cjs';

test('acceptance stops at failed assets and cannot report partial checks as passed', async()=>{
  const called=[];
  const result=await acceptance.executeSteps(['thumbnail','rules','browser'].map(name=>({name})), async step=>{
    called.push(step.name); throw new Error('Missing thumbnail');
  });
  assert.deepEqual(called, ['thumbnail']); assert.equal(result.passed, false);
  assert.equal(result.stages[0].error, 'Missing thumbnail');
  const complete=await acceptance.executeSteps([{name:'one'},{name:'two'}], async()=>({stdout:'ok'}));
  assert.equal(complete.passed, true); assert.equal(complete.stages.length, 2);
});

test('bounded command distinguishes nonzero exit from timeout and preserves Chinese output', async()=>{
  assert.equal((await command.run(process.execPath,['-e',"process.stdout.write('美洲鳗鲡')"])).stdout, '美洲鳗鲡');
  await assert.rejects(command.run(process.execPath,['-e','process.exit(7)']), error=>error.code===7 && !error.timedOut);
  await assert.rejects(command.run(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:80}), error=>error.timedOut);
});

test('timeout terminates descendants rather than leaving a late background write', async()=>{
  const folder=await mkdtemp(join(tmpdir(),'fisher-process-'));
  const marker=join(folder,'late.txt');
  try {
    const descendant=`setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'orphan'),1000)`;
    const parent=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore',windowsHide:true});setInterval(()=>{},1000)`;
    await assert.rejects(command.run(process.execPath,['-e',parent],{timeoutMs:500}), error=>error.timedOut);
    await new Promise(resolve=>setTimeout(resolve,1200));
    await assert.rejects(readFile(marker), {code:'ENOENT'});
  } finally {
    assert.equal(dirname(folder),resolve(tmpdir()));
    await rm(folder,{recursive:true,force:true});
  }
});

test('authentication and rejected history do not trigger network retry',()=>{
  for(const message of ['Authentication failed','non-fast-forward','Permission denied'])
    assert.equal(network.networkFailure(new Error(message)),false);
  for(const message of ['SSL connection failed','Could not resolve host','Connection reset'])
    assert.equal(network.networkFailure(new Error(message)),true);
  assert.equal(network.networkFailure({timedOut:true}),true);
  assert.equal(network.networkFailure({timedOut:true,killFailed:true}),false);
});

function fixture({race=false,badHash=false}={}) {
  const base='a'.repeat(40),head='b'.repeat(40),tree='c'.repeat(40),blob='d'.repeat(40);
  const writes=[];let reads=0,ref=base;
  const git=async(...args)=>{
    if(args[0]==='merge-base')return '';
    if(args[0]==='rev-list')return head+'\n';
    if(args[0]==='ls-tree')return '100644 blob '+blob+'\tfish-data.js\0';
    if(args[0]==='rev-parse')return tree;
    if(args[0]==='cat-file')return `tree ${tree}\nparent ${base}\nauthor Test <test@example.com> 1 +0000\ncommitter Test <test@example.com> 1 +0000\n\nfish\n`;
    if(args[0]==='show')return '1970-01-01T00:00:01+00:00';
    throw Error('Unexpected git command');
  };
  const api=async(method,endpoint,body)=>{
    if(method==='GET')return {object:{sha:endpoint.endsWith('/main')?base:(race && reads++>0?'e'.repeat(40):ref)}};
    writes.push({method,endpoint,body});
    if(endpoint==='/git/trees')return {sha:badHash?'BAD':tree};
    if(endpoint==='/git/commits')return {sha:head};
    if(method==='PATCH')ref=body.sha;
    return {};
  };
  return {args:{git,api,branch:'feat/new-fish',head,main:base},writes};
}

test('API fallback refuses protected branch, hash mismatch and concurrent branch change',async()=>{
  const protectedCase=fixture();
  await assert.rejects(network.apiPush({...protectedCase.args,branch:'main'}),/work branches/);
  assert.equal(protectedCase.writes.length,0);
  for(const options of [{race:true},{badHash:true}]) {
    const sample=fixture(options);
    await assert.rejects(network.apiPush(sample.args));
    assert.equal(sample.writes.some(w=>w.endpoint.includes('/git/refs')),false);
  }
});

test('API fallback advances verified work branch with force disabled',async()=>{
  const sample=fixture(); await network.apiPush(sample.args);
  const updates=sample.writes.filter(w=>w.endpoint.includes('/git/refs'));
  assert.deepEqual(updates,[{method:'PATCH',endpoint:'/git/refs/heads/feat/new-fish',
    body:{sha:sample.args.head,force:false}}]);
});
