import {FISH_DATA} from './fish-data.js';

export const DISCOVERIES_KEY='fisher-realm-discoveries-v1';

// Stable catalog IDs survive item moves, bag clearing and page reloads.
export class FishDiscoveries{
  constructor(saved,entries=FISH_DATA){
    this.entries=entries;this.ids=new Set();
    const valid=new Set(entries.map(f=>f.id));
    if(saved?.version===1&&Array.isArray(saved.fishIds))for(const id of saved.fishIds)if(valid.has(id))this.ids.add(id);
  }
  has(id){return this.ids.has(id);}
  unlock(name){const fish=this.entries.find(f=>f.name===name);if(!fish||this.has(fish.id))return false;this.ids.add(fish.id);return true;}
  seed(items=[]){let changed=false;for(const item of items)if(this.unlock(item?.name))changed=true;return changed;}
  serialize(){return {version:1,fishIds:this.entries.filter(f=>this.has(f.id)).map(f=>f.id)};}
}

export function createFishDiscoveries({items=[],storage,onSaveError=()=>{}}={}){
  let saved;
  try{storage??=globalThis.localStorage;saved=JSON.parse(storage?.getItem(DISCOVERIES_KEY)??'null');}catch{}
  const model=new FishDiscoveries(saved);
  let pending=false,warned=false;
  function flush(){
    if(!pending)return true;
    try{storage??=globalThis.localStorage;if(!storage)throw new Error('Storage unavailable');storage.setItem(DISCOVERIES_KEY,JSON.stringify(model.serialize()));pending=false;warned=false;return true;}
    catch{if(!warned){warned=true;onSaveError();}return false;}
  }
  // Existing inventory is the only reliable evidence available in older saves.
  pending=model.seed(items);flush();
  return {has:id=>model.has(id),flush,unlock(name){const added=model.unlock(name);if(added)pending=true;flush();return added;}};
}
