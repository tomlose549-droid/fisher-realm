// Bounded Git operations and optional, verified API push for ordinary work branches.
const path=require('node:path'), assert=require('node:assert/strict');
const {run}=require('./bounded-command.cjs');
const root=path.resolve(__dirname, '..');

function networkFailure(error) {
  if(error.killFailed) return false;
  return error.timedOut || /timed? out|could not resolve host|couldn't connect|failed to connect|connection (?:was )?(?:reset|closed|refused)|TLS|SSL|schannel|RPC failed|remote end hung up/i.test(error.message);
}

async function apiPush({git, api, branch, head, main}) {
  assert.ok(branch!=='main' && branch!=='master', 'API push is only for work branches');
  async function remote() {
    try { return (await api('GET', '/git/ref/heads/'+branch)).object.sha; }
    catch (error) { if (error.status===404) return null; throw error; }
  }
  const initial=await remote(), base=initial || main;
  if (base===head) return;
  await git('merge-base', '--is-ancestor', base, head);
  const commits=(await git('rev-list', '--reverse', base+'..'+head)).trim().split('\n');
  assert.ok(commits.length<=20, 'API fallback limited to 20 ordinary commits');
  const entries=async ref=>(await git('ls-tree', '-rz', '--full-tree', ref)).split('\0').filter(Boolean).map(line=>{
    const i=line.indexOf('\t'), [mode,type,sha]=line.slice(0,i).split(' ');
    assert.equal(type, 'blob', 'Submodules are not supported by API fallback');
    return {path:line.slice(i+1), mode, type, sha};
  });
  const known=new Set((await entries(base)).map(e=>e.sha));
  let parent=base;
  for (const commit of commits) {
    const raw=await git('cat-file', 'commit', commit), treeSha=(await git('rev-parse', commit+'^{tree}')).trim();
    assert.deepEqual([...raw.matchAll(/^parent (\w+)$/gm)].map(m=>m[1]), [parent], 'API fallback needs linear history');
    assert.ok(!/^gpgsig /m.test(raw), 'Signed commits need normal Git transport');
    const tree=await entries(commit);
    for (const entry of tree) if (!known.has(entry.sha)) {
      // base64 avoids passing binary content through text decoding.
      const content=(await git('show', '--no-textconv', entry.sha, {binary:true})).toString('base64');
      assert.equal((await api('POST', '/git/blobs', {content, encoding:'base64'})).sha, entry.sha);
      known.add(entry.sha);
    }
    assert.equal((await api('POST', '/git/trees', {tree})).sha, treeSha);
    async function identity(kind) {
      const match=raw.match(new RegExp('^'+kind+' (.*) <([^>]+)> (\\d+) ([+-]\\d{4})$', 'm'));
      assert.ok(match, 'Unsupported commit identity');
      return {name:match[1], email:match[2], date:(await git('show', '-s',
        kind==='author'?'--format=%aI':'--format=%cI', commit)).trim()};
    }
    assert.equal((await api('POST', '/git/commits', {message:raw.slice(raw.indexOf('\n\n')+2),
      tree:treeSha, parents:[parent], author:await identity('author'), committer:await identity('committer')})).sha, commit);
    parent=commit;
  }
  // Publish only after every object hash matches; recheck concurrent branch changes.
  assert.equal(await remote(), initial, 'Remote work branch changed; stop and review');
  assert.equal((await api('GET', '/git/ref/heads/main')).object.sha, main, 'Main changed; review latest baseline');
  if (initial) await api('PATCH', '/git/refs/heads/'+branch, {sha:head, force:false});
  else await api('POST', '/git/refs', {ref:'refs/heads/'+branch, sha:head});
  assert.equal(await remote(), head, 'Remote SHA verification failed');
}

async function main() {
  const [action,...options]=process.argv.slice(2);
  let timeoutMs=20000, fallback=false;
  for(let i=0;i<options.length;i++) {
    if(options[i]==='--api-fallback') fallback=true;
    else if(options[i]==='--timeout-ms') timeoutMs=Number(options[++i]);
    else throw new Error('Unknown option: '+options[i]);
  }
  assert.ok(['fetch','push'].includes(action) && Number.isInteger(timeoutMs) && timeoutMs>=100 && timeoutMs<=60000,
    'Usage: node scripts/git-network.cjs fetch|push [--timeout-ms 20000] [--api-fallback]');
  const env={...process.env, GIT_TERMINAL_PROMPT:'0', GCM_INTERACTIVE:'Never', GH_PROMPT_DISABLED:'1'};
  const deadline=Date.now()+180000;
  const invoke=(command,args,extra={})=>{
    const remaining=deadline-Date.now();
    assert.ok(remaining>0, 'Overall network budget exhausted (180s)');
    return run(command,args,{cwd:root, env, timeoutMs:Math.min(timeoutMs,remaining), ...extra});
  };
  const git=async(...args)=>{
    const extra=typeof args.at(-1)==='object'?args.pop():{};
    if(extra.binary) {
      // Git base64 output is obtained without shell or UTF-8 conversion.
      const {execFileSync}=require('node:child_process');
      return execFileSync('git',args,{cwd:root, windowsHide:true, timeout:10000, maxBuffer:32*1024*1024});
    }
    return (await invoke('git',args)).stdout;
  };
  const origin=(await git('remote','get-url','origin')).trim();
  const match=origin.match(/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  assert.ok(match, 'Expected a plain github.com origin without embedded credentials');
  const repo=match[1], branch=action==='push'?(await git('symbolic-ref','--short','HEAD')).trim():null;
  if(action==='push') {
    assert.ok(!['main','master'].includes(branch), 'Use a work branch; no direct main push');
    assert.equal((await git('status','--porcelain')).trim(), '', 'Commit reviewed changes before pushing');
  }
  const api=async(method,endpoint,body)=>{
    try {
      const args=['api','--method',method,'repos/'+repo+endpoint];
      if(body!==undefined) args.push('--input','-');
      return JSON.parse((await invoke('gh',args,{input:body===undefined?undefined:JSON.stringify(body)})).stdout);
    } catch(error) {
      if(/HTTP 404/.test(error.stderr||'')) error.status=404;
      throw error;
    }
  };
  try {
    await invoke('git',action==='fetch'?['fetch','origin','main']:['push','origin',branch]);
    console.log(JSON.stringify({action, method:'git', result:'passed'}));
    return;
  } catch(error) {
    console.error(error.message);
    if(!networkFailure(error)) throw new Error('Non-network failure: review authentication or branch conflict; no automatic retry');
  }
  const mainSha=(await api('GET','/git/ref/heads/main')).object.sha;
  console.log(JSON.stringify({diagnosis:'Git transport failed; GitHub API reachable', main:mainSha}));
  if(!fallback) throw new Error('No changes through API. Review diagnosis, then use --api-fallback if appropriate');
  if(action==='fetch') {
    // Do not claim synchronization when remote objects have not been downloaded.
    await git('cat-file','-e',mainSha+'^{commit}');
    const objects=await git('rev-list','--objects','--missing=print',mainSha);
    assert.ok(!/^\?/m.test(objects), 'Remote commit has missing objects; download them before developing');
    await git('update-ref','refs/remotes/origin/main',mainSha);
  } else {
    const head=(await git('rev-parse','HEAD')).trim();
    await apiPush({git,api,branch,head,main:mainSha});
    await git('update-ref','refs/remotes/origin/'+branch,head);
  }
  console.log(JSON.stringify({action, method:'api', result:'passed'}));
}
module.exports={networkFailure,apiPush};
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
