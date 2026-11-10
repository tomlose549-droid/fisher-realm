import {withLure} from './lure-encounters.js';

// Called only after idle/water checks. Saving the one-unit debit must succeed before casting.
export function createLureCasting({store,encounters}){
  const tables=new Map();
  return {prepare({forced=false}={}){
    const item=forced?null:store.model.bestLure();
    if(!item)return {ok:true,encounters,lure:null};
    let table;
    try{if(!tables.has(item.name))tables.set(item.name,withLure(encounters,item.name));table=tables.get(item.name);}
    catch(error){return {ok:false,error:error.message};}
    const result=store.run('consumeLure',[item.id]);
    return result.ok?{ok:true,encounters:table,lure:item.name}:{ok:false,error:result.error};
  }};
}
