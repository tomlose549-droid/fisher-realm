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
  return {finish,beginFight(){if(!store.flush())return {ok:false,error:'上一笔进度尚未保存，请重试。'};return store.model.equipment.line?store.run('beginCast',[null,random()]):{ok:true};},prepare({forced=false,deferWear=false,reuse=null}={}){
    if(!store.flush())return {ok:false,error:'上一笔进度尚未保存，请稍后重试。'};
    if(reuse)return {ok:true,encounters:reuse.encounters,lure:reuse.lure,equipment:store.model.tackleStats()};
    const item=forced?null:store.model.bestLure();
    const base=getEncounters();let table=base;
    try{if(item){if(!tables.has(base))tables.set(base,new Map());const cached=tables.get(base);if(!cached.has(item.name))cached.set(item.name,withLure(base,item.name));table=cached.get(item.name);}}
    catch(error){return {ok:false,error:error.message};}
    const result=store.model.equipment.line&&!deferWear?store.run('beginCast',[item?.id??null,random()]):item?store.run('consumeLure',[item.id]):{ok:true};
    return result.ok?{ok:true,encounters:table,lure:item?.name??null,equipment:store.model.tackleStats()}:{ok:false,error:result.error};
  }};
}
