import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {releaseVersion,assetUrl} from '../release-assets.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(await read('package.json'));
test('one package version matches npm lock metadata and both startup paths use it',async()=>{
 const lock=JSON.parse(await read('package-lock.json'));assert.equal(lock.version,manifest.version);assert.equal(lock.packages[''].version,manifest.version);
 const html=await read('index.html');assert.ok(!html.includes('V'+manifest.version));assert.match(html,/id="game-version"/);
 assert.match(await read('start.ps1'),/ConvertFrom-Json\)\.version/);assert.match(await read('server.cjs'),/require\('\.\/package\.json'\)\.version/);
});
test('import-map manifest covers every runtime module and every relative module dependency',async()=>{
 const config=manifest.fisherRealm,modules=config.modules;assert.equal(new Set(modules).size,modules.length);
 const root=(await readdir(new URL('../',import.meta.url))).filter(p=>p.endsWith('.js')&&p!=='release-loader.js');
 async function mapModules(directory='maps'){
  const entries=await readdir(new URL('../'+directory+'/',import.meta.url),{withFileTypes:true});
  return (await Promise.all(entries.map(entry=>entry.isDirectory()?mapModules(directory+'/'+entry.name):entry.name.endsWith('.js')?[directory+'/'+entry.name]:[]))).flat();
 }
 const maps=await mapModules();
 const expected=[...root,...maps,'vendor/three.module.js','vendor/three.core.js'].sort();assert.deepEqual([...modules].sort(),expected);
 for(const name of modules){const source=await read(name);assert.ok(!/from\s+['"][^'"]+\?v=/.test(source),name+' has a manual module version');for(const m of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){const url=new URL(m[1],new URL('../'+name,import.meta.url));const relative=decodeURI(url.pathname.slice(new URL('../',import.meta.url).pathname.length));assert.ok(modules.includes(relative),name+' missing dependency '+relative);}}
 for(const name of [...config.styles,...config.preloadImages])assert.ok((await readFile(new URL('../'+name,import.meta.url))).length>0);
});
test('asset helper reads the active release without hardcoded versions and preserves Node fallback',()=>{
 const old=globalThis.fisherRelease;try{delete globalThis.fisherRelease;assert.equal(releaseVersion(),null);assert.ok(assetUrl('./audio/hooked.wav').endsWith('/audio/hooked.wav'));
 globalThis.fisherRelease={version:'8.9.10',assetUrl:p=>'release:'+p};assert.equal(releaseVersion(),'8.9.10');assert.equal(assetUrl('./fish-images/example.webp'),'release:./fish-images/example.webp');}finally{if(old===undefined)delete globalThis.fisherRelease;else globalThis.fisherRelease=old;}
});
