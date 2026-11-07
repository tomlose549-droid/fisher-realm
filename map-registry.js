import {SUMMER_POND,isSummerPondWater} from './maps/summer-pond.js';
import {FISH_CATALOG} from './fish-data.js';

export const DEFAULT_MAP_ID=SUMMER_POND.id;
const definitions=Object.freeze({[DEFAULT_MAP_ID]:Object.freeze({config:SUMMER_POND,
  isWater:isSummerPondWater,load:()=>import('./pond-scene.js')})});
export function getMapDefinition(id=DEFAULT_MAP_ID){
  if(!Object.hasOwn(definitions,id))throw new RangeError('Unknown map: '+id);
  return definitions[id];
}
export function getMapFishPool(id=DEFAULT_MAP_ID){
  getMapDefinition(id);
  // The only map still contains every fish. Membership editing is a later feature.
  return FISH_CATALOG.profiles;
}
export function getMapContext(id=DEFAULT_MAP_ID){
  const {config,isWater}=getMapDefinition(id);
  return Object.freeze({id:config.id,name:config.name,spawn:config.spawn,waterLevel:config.water.level,
    labels:config.labels,isWater:(x,z,margin)=>isWater(x,z,margin,config.water),fishPool:getMapFishPool(id)});
}
export function listMaps(){return Object.values(definitions).map(d=>({id:d.config.id,name:d.config.name}));}
