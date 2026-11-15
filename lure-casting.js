import {withLure} from './lure-encounters.js';

// Called only after idle/water checks. Saving the one-unit debit must succeed before casting.
export function createLureCasting({store,encounters,getEncounters=()=>encounters,random=Math.random}){
  const tables=new WeakMap();
  function finish(outcome='interrupted'){
    const pending=store.model.pendingCast;
    return pending?store.run('settleCast',[pending.id,outcome],{retainOnFailure:true}):{ok:true,loss:0,unchanged:true};
  }
  // An unfinished saved round uses its already persisted normal-loss draw, never a fresh random roll.
  finish('interrupted');
  return {finish,prepare({forced=false}={}){
    if(!store.flush())return {ok:false,error:'上一笔进度尚未保存，请稍后重试。'};
    const item=forced?null:store.model.bestLure();
    const base=getEncounters();let table=base;
    try{if(item){if(!tables.has(base))tables.set(base,new Map());const cached=tables.get(base);if(!cached.has(item.name))cached.set(item.name,withLure(base,item.name));table=cached.get(item.name);}}
    catch(error){return {ok:false,error:error.message};}
    const result=store.model.equipment.line?store.run('beginCast',[item?.id??null,random()]):item?store.run('consumeLure',[item.id]):{ok:true};
    return result.ok?{ok:true,encounters:table,lure:item?.name??null,equipment:store.model.tackleStats()}:{ok:false,error:result.error};
  }};
}
