import {FISH_SPECIES} from './fishing-rules.js';

export function createOwnerPanel({fishing,onOpen,toast,onClearAll,onRich,onOwnerHack}){
  const command=document.querySelector('#realm-command'),message=document.querySelector('#realm-command-message'),dialog=document.querySelector('#owner-dialog'),select=document.querySelector('#owner-fish'),status=document.querySelector('#owner-mode-status');
  for(const fish of FISH_SPECIES){const option=document.createElement('option');option.value=fish.name;option.textContent=fish.name;select.appendChild(option);}
  let lastStatus='';
  function update(){const mode=fishing.getOwnerState(),text=mode.remaining>0?`当前：${mode.fishName} · 剩余 ${mode.remaining} 条`:'当前：随机鱼种';if(text!==lastStatus){status.textContent=text;lastStatus=text;}}
  function open(){
    if(command.value.trim()==='owner hack'){command.value='';message.textContent='';onOwnerHack();return true;}
    if(command.value.trim()!=='realm owner')return false;
    command.value='';message.textContent='';onOpen();lastStatus='';update();
    const mode=fishing.getOwnerState();if(mode.fishName)select.value=mode.fishName;
    dialog.showModal();return true;
  }
  command.addEventListener('input',()=>{message.textContent=command.value.trim()==='clear'?'按回车清空鱼堆、背包和金币；仓库与图鉴保留。':'';open();});
  document.querySelector('#realm-command-form').addEventListener('submit',event=>{
    event.preventDefault();const value=command.value.trim();
    if(value==='clear'){
      command.value='';const result=onClearAll();
      message.textContent=result.ok?`已重置鱼堆、背包和金币，共清除 ${result.removed} 件物品。仓库与图鉴保留。`:result.error;
      if(result.ok)toast(`鱼堆、背包和金币已清空 · ${result.removed} 件物品`);return;
    }
    if(value==='rich'){command.value='';message.textContent='';onRich();return;}
    if(!open())message.textContent='未识别的内容';
  });
  document.querySelector('#owner-close').addEventListener('click',()=>dialog.close());
  document.querySelector('#owner-fish-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!fishing.setForcedFish(select.value)){status.textContent='请先结束当前这一轮，再确认选择';return;}
    update();dialog.close();toast(`已选择${select.value} · 接下来成功钓获 10 条`);
  });
  dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.querySelector('#settings-toggle').focus({preventScroll:true});});
  return {update:()=>{if(dialog.open)update();}};
}
