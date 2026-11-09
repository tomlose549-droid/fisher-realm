import {SUMMER_POND,isSummerPondWater} from './maps/summer-pond.js';
import {SUMMER_POND_ENCOUNTERS} from './maps/summer-pond-fish.js';

export const DEFAULT_MAP_ID=SUMMER_POND.id;
const definitions=Object.freeze({[DEFAULT_MAP_ID]:Object.freeze({config:SUMMER_POND,
    isWater:isSummerPondWater,encounters:SUMMER_POND_ENCOUNTERS,load:()=>import('./pond-scene.js')})});
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
  return Object.freeze({id:config.id,name:config.name,spawn:config.spawn,waterLevel:config.water.level,
    labels:config.labels,isWater:(x,z,margin)=>isWater(x,z,margin,config.water),fishPool:getMapFishPool(id),encounters});
}
export function listMaps(){return Object.values(definitions).map(d=>({id:d.config.id,name:d.config.name}));}
