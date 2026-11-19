import {mapEntryFee} from './map-entry.js';
import {SUMMER_POND,isSummerPondWater} from './maps/summer-pond.js';
import {SUMMER_POND_ENCOUNTERS} from './maps/summer-pond-fish.js';
import {AMAZON_CONFLUENCE,isAmazonWater} from './maps/amazon-confluence.js';
import {AMAZON_CONFLUENCE_ENCOUNTERS} from './maps/amazon-confluence-fish.js';

export const DEFAULT_MAP_ID=SUMMER_POND.id;
const definitions=Object.freeze({[DEFAULT_MAP_ID]:Object.freeze({config:SUMMER_POND,
    isWater:isSummerPondWater,encounters:SUMMER_POND_ENCOUNTERS,load:()=>import('./pond-scene.js')}),
  [AMAZON_CONFLUENCE.id]:Object.freeze({config:AMAZON_CONFLUENCE,isWater:isAmazonWater,encounters:AMAZON_CONFLUENCE_ENCOUNTERS,load:()=>import('./amazon-scene.js')})});
export function getMapDefinition(id=DEFAULT_MAP_ID){
  if(!Object.hasOwn(definitions,id))throw new RangeError('Unknown map: '+id);
  return definitions[id];
}
export function getMapFishPool(id=DEFAULT_MAP_ID){
  return getMapDefinition(id).encounters.fishPool;
}
export function getMapEncounterTable(id=DEFAULT_MAP_ID){return getMapDefinition(id).encounters;}
export function getMapContext(id=DEFAULT_MAP_ID){
  const {config,isWater,encounters}=getMapDefinition(id);
  return Object.freeze({id:config.id,name:config.name,entryFee:mapEntryFee(config.id),spawn:config.spawn,waterLevel:config.water.level,
    labels:config.labels,isWater:(x,z,margin)=>isWater(x,z,margin,config.water),fishPool:getMapFishPool(id),encounters});
}
export function listMaps(){return Object.values(definitions).map(d=>({id:d.config.id,name:d.config.name}));}
