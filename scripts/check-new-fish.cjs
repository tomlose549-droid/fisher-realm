const fs=require('node:fs'), path=require('node:path'), {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const {run}=require('./bounded-command.cjs');
const root=path.resolve(__dirname, '..');

async function executeSteps(steps, execute) {
  const results=[];
  for (const step of steps) {
    const start=Date.now();
    try {
      const result=await execute(step);
      results.push({stage:step.name, passed:true, durationMs:Date.now()-start, output:result.stdout});
    } catch (error) {
      results.push({stage:step.name, passed:false, durationMs:Date.now()-start,
        error:error.message, output:error.stdout, stderr:error.stderr});
      break;
    }
  }
  return {passed:results.length===steps.length && results.every(r=>r.passed), stages:results};
}

async function main() {
  const selector=process.argv[2];
  if (!selector || process.argv.length!==3) throw new Error('Usage: node scripts/check-new-fish.cjs FISH_ID_OR_NAME');
  const {FISH_DATA}=await import(pathToFileURL(path.join(root, 'fish-data.js')).href);
  const fish=FISH_DATA.find(f=>f.id===selector || f.name===selector);
  if (!fish) throw new Error(`Unknown fish: ${selector}`);
  const output=path.join(root, '.qa', 'new-fish', fish.id+'-acceptance.json');
  // Fail missing browser dependencies before starting otherwise successful tests.
  const steps=[
    {name:'browser-dependencies', command:process.execPath, args:['-e',
      "const fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');if(!fs.existsSync(process.env.CHROME_PATH||chromium.executablePath()))throw Error('Chrome missing: set CHROME_PATH or install Playwright browser')"], timeoutMs:10000},
    {name:'thumbnail', command:process.env.PYTHON || 'python', args:[
      path.join(root, 'scripts/build-inventory-thumbnails.py'), '--fish', fish.id, '--check'], timeoutMs:30000},
    {name:'rules', command:process.execPath, args:['--test', ...fs.readdirSync(path.join(root, 'tests'))
      .filter(name=>name.endsWith('.test.js')).sort().map(name=>path.join(root, 'tests', name))], timeoutMs:60000},
    {name:'browser', command:process.execPath, args:[path.join(root, 'tests/browser/new-fish.cjs'), fish.id], timeoutMs:120000}
  ];
  const result=await executeSteps(steps, async step=>{
    console.log(`Checking ${step.name}...`);
    return run(step.command, step.args, {cwd:root, timeoutMs:step.timeoutMs});
  });
  const resources=['fish-data.js', fish.inventory.image && 'fish-images/'+fish.inventory.image,
    fish.inventory.image && 'fish-images/thumbnails/'+fish.inventory.image.replace(/\.[^./]+$/, '.webp'),
    fish.inventory.image && 'fish-images/thumbnails/'+fish.inventory.image.replace(/\.[^./]+$/, '.webp.meta.json')].filter(Boolean);
  const report={fish:fish.id, name:fish.name, checkedAt:new Date().toISOString(), configuration:fish,
    fingerprints:Object.fromEntries(resources.map(file=>[file, fs.existsSync(path.join(root,file)) ?
      createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex') : null])), ...result};
  fs.mkdirSync(path.dirname(output), {recursive:true});
  fs.writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
  for (const stage of result.stages) console.log(`${stage.passed?'PASS':'FAIL'} ${stage.stage} (${stage.durationMs}ms)${stage.error?': '+stage.error:''}`);
  console.log(`Report: ${output}`);
  if (!result.passed) process.exitCode=1;
}
module.exports={executeSteps};
if (require.main===module) main().catch(error=>{console.error(error.message); process.exitCode=1;});
