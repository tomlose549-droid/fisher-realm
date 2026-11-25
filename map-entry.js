export const MAP_ENTRY_FEES=Object.freeze({'summer-pond':0,'amazon-confluence':28,'amazon-flooded-forest':43,'sac-actun':0});
export function mapEntryFee(id){
 if(!Object.hasOwn(MAP_ENTRY_FEES,id))throw new RangeError('Unknown map: '+id);
 return MAP_ENTRY_FEES[id];
}
function denied(message){return Object.assign(new Error(message),{entryDenied:true});}
// Complete preparation and activation before attempting the fee transaction.
// No animation frame can run between activation and this synchronous transaction.
export function createMapEntry({store,prepare,activate,rollback,getFee=mapEntryFee,isUnlocked=()=>true}){
 let busy=false;
 return {get busy(){return busy;},async enter(id){
  if(busy)throw denied('地图正在加载，请稍候');
  busy=true;let prepared=false;
  try{
   if(!isUnlocked(id))throw denied('钓点尚未解锁，请先完成店主任务。');
   const fee=getFee(id);
   if(!Number.isSafeInteger(fee)||fee<0)throw new TypeError('Invalid map entry fee');
   if(store.model.coins<fee)throw denied(`金币不足，进入此地图需要 ${fee} 金币。`);
   prepared=true;const map=await prepare(id);activate(map);
   if(fee){const result=store.run('payMapEntry',[fee]);if(!result.ok)throw denied(result.error||'入场费保存失败，请重试。');}
   return map;
  }catch(error){if(prepared)rollback();throw error;}
  finally{busy=false;}
 }};
}
