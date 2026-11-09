import {PlayerStorage} from './storage-rules.js';
export const PLAYER_STORAGE_KEY='fisher-realm-inventory-v1';

export function createPlayerStorage({storage=localStorage,onSaveError=()=>{}}={}){
  let saved;try{saved=JSON.parse(storage.getItem(PLAYER_STORAGE_KEY));}catch{}
  let model=new PlayerStorage(saved),dirty=false;const listeners=new Set();
  function persist(next){try{storage.setItem(PLAYER_STORAGE_KEY,JSON.stringify(next.serialize()));return true;}catch{onSaveError();return false;}}
  function publish(){for(const listener of listeners)listener(model);}
  return {
    get model(){return model;},
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
    run(method,args=[],{retainOnFailure=false}={}){
      const next=model.clone(),result=next[method](...args);if(!result.ok)return {...result,saved:!dirty};
      const saved=persist(next);
      // Economic/destructive operations roll back together if saving fails. Catches stay playable and retry later.
      if(saved||retainOnFailure){model=next;dirty=!saved;publish();return {...result,saved};}
      return {ok:false,saved:false,error:'保存失败，本次操作未执行；请释放浏览器存储空间后重试。'};
    },
    flush(){if(!dirty)return true;if(!persist(model))return false;dirty=false;return true;},
    snapshot:()=>model.serialize()
  };
}
