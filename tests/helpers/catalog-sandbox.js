import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';

// A new fish needs both metadata and a reviewed probability allocation.
export async function copyCatalogSandbox(temp,extra){
  for(const file of ['item-data.js','fishing-rules.js','inventory-rules.js','fish-discoveries.js','fish-guide.js',
    'fish-help.js','fish-encounters.js','map-registry.js','maps/summer-pond.js','inventory-images.js','release-assets.js',
    'tests/american-eel.test.js','tests/helpers/encounter-unit.js','scripts/check-fish-rules.cjs']){
    await mkdir(dirname(join(temp,file)),{recursive:true});
    await copyFile(new URL('../../'+file,import.meta.url),join(temp,file));
  }
  const source=await readFile(new URL('../../fish-data.js',import.meta.url),'utf8');
  const appended=source.replace(/\r?\n\]\);(?=\s*export const FISH_CATALOG)/,',\n'+JSON.stringify(extra)+'\n]);');
  if(appended===source)throw new Error('Catalog append point missing');
  await writeFile(join(temp,'fish-data.js'),appended);
  const map=await readFile(new URL('../../maps/summer-pond-fish.js',import.meta.url),'utf8');
  const adjusted=map.replace('createEncounterTable(SUMMER_POND_PROBABILITIES)',
    `createEncounterTable([...SUMMER_POND_PROBABILITIES.map(row=>row.id==='BLUEGILL'?{...row,percent:1.5}:row),${JSON.stringify({id:extra.id,percent:1})}])`);
  await mkdir(join(temp,'maps'),{recursive:true});await writeFile(join(temp,'maps/summer-pond-fish.js'),adjusted);
  await writeFile(join(temp,'package.json'),'{"type":"module"}');
}
