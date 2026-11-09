import {PLAYER_STORAGE_KEY} from './player-storage.js';
import {DISCOVERIES_KEY} from './fish-discoveries.js';

export const SAVE_SLOTS_KEY='fisher-realm-save-slots-v1',MAX_SAVE_SLOTS=3;
const fields={[PLAYER_STORAGE_KEY]:'inventory',[DISCOVERIES_KEY]:'discoveries'};
const emptyData=()=>({inventory:{version:1,items:[]},discoveries:{version:1,fishIds:[]}});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validRecord=record=>object(record)&&record.version===1;
function validate(saved){
  if(!object(saved)||saved.version!==1||!Number.isSafeInteger(saved.revision)||saved.revision<0||!Array.isArray(saved.slots)||saved.slots.length<1||saved.slots.length>MAX_SAVE_SLOTS)return false;
  const ids=new Set();
  for(const slot of saved.slots){
    if(!object(slot)||!['1','2','3'].includes(slot.id)||ids.has(slot.id)||!object(slot.data)||!validRecord(slot.data.inventory)||!Array.isArray(slot.data.inventory.items)||!validRecord(slot.data.discoveries)||!Array.isArray(slot.data.discoveries.fishIds))return false;
    ids.add(slot.id);
  }
  return ids.has(saved.activeId);
}

// A single canonical save contains every slot, so changing/deleting a slot is atomic.
// Legacy keys are read once; cleanup happens only after the canonical save succeeds.
export function createSaveSlots({storage=localStorage,now=()=>new Date().toISOString()}={}){
  let diskText,state;
  try{diskText=storage.getItem(SAVE_SLOTS_KEY);}catch{diskText=null;}
  if(diskText!==null){
    try{state=JSON.parse(diskText);}catch{throw Error('存档资料无法读取，已停止写入以保护原有进度。请保留浏览器数据并联系维护者。');}
    if(!validate(state))throw Error('存档资料格式异常，已停止写入以保护原有进度。请保留浏览器数据并联系维护者。');
  }else{
    const data=emptyData();
    for(const [key,field]of Object.entries(fields)){
      try{const value=JSON.parse(storage.getItem(key));if(validRecord(value)&&Array.isArray(value[field==='inventory'?'items':'fishIds']))data[field]=value;}catch{}
    }
    state={version:1,revision:0,activeId:'1',slots:[{id:'1',createdAt:now(),data}]};
  }
  const sessionId=state.activeId;
  function activeSlot(){return state.slots.find(slot=>slot.id===sessionId);}
  function writable(){
    if(state.activeId!==sessionId)throw Error('存档已切换，请等待重新进入游戏。');
    const latest=storage.getItem(SAVE_SLOTS_KEY);
    if(latest!==diskText)throw Error('存档已在其他窗口更新，请刷新游戏后再操作。');
  }
  function commit(next){
    writable();if(!Number.isSafeInteger(state.revision+1))throw Error('存档版本超出可保存范围');
    next.revision=state.revision+1;const text=JSON.stringify(next);storage.setItem(SAVE_SLOTS_KEY,text);state=next;diskText=text;
    for(const key of Object.keys(fields))try{storage.removeItem?.(key);}catch{} // A failed cleanup never invalidates a committed save.
  }
  function action(fn){try{return fn();}catch(error){return {ok:false,error:error.message.includes('存档已')?error.message:'存档保存失败，本次操作未执行；请释放浏览器存储空间后重试。'};}}
  const adapter={
    getItem(key){if(!Object.hasOwn(fields,key))throw Error('不支持的存档字段');const field=fields[key];return JSON.stringify(activeSlot()?.data[field]??null);},
    setItem(key,text){
      if(!Object.hasOwn(fields,key))throw Error('不支持的存档字段');const field=fields[key];
      const value=JSON.parse(text);if(!validRecord(value)||!Array.isArray(value[field==='inventory'?'items':'fishIds']))throw Error('无效的存档资料');
      const next=structuredClone(state),slot=next.slots.find(slot=>slot.id===sessionId);slot.data[field]=value;commit(next);
    }
  };
  return {
    storage:adapter,
    get activeId(){return state.activeId;},
    snapshot:()=>structuredClone(state),
    create(){return action(()=>{
      if(state.slots.length>=MAX_SAVE_SLOTS)return {ok:false,error:'最多可保留 3 个存档，请先删除其他存档。'};
      const next=structuredClone(state),id=['1','2','3'].find(id=>!next.slots.some(slot=>slot.id===id));
      next.slots.push({id,createdAt:now(),data:emptyData()});next.slots.sort((a,b)=>Number(a.id)-Number(b.id));next.activeId=id;commit(next);return {ok:true,id};
    });},
    select(id){return action(()=>{
      if(!state.slots.some(slot=>slot.id===id))return {ok:false,error:'该存档不存在。'};
      if(id===state.activeId)return {ok:true,id,unchanged:true};
      const next=structuredClone(state);next.activeId=id;commit(next);return {ok:true,id};
    });},
    remove(id){return action(()=>{
      if(id===state.activeId)return {ok:false,error:'当前存档正在使用，请先切换到其他存档再删除。'};
      if(!state.slots.some(slot=>slot.id===id))return {ok:false,error:'该存档不存在。'};
      const next=structuredClone(state);next.slots=next.slots.filter(slot=>slot.id!==id);commit(next);return {ok:true,id};
    });}
  };
}
