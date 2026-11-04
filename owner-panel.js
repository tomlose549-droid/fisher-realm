import {FISH_SPECIES} from './fishing-rules.js?v=fish023';

export function createOwnerPanel({fishing,onOpen,toast,onClearAll}){
  const command=document.querySelector('#realm-command'),message=document.querySelector('#realm-command-message'),dialog=document.querySelector('#owner-dialog'),select=document.querySelector('#owner-fish'),status=document.querySelector('#owner-mode-status');
  for(const fish of FISH_SPECIES){const option=document.createElement('option');option.value=fish.name;option.textContent=fish.name;select.appendChild(option);}
  let lastStatus='';
  function update(){const mode=fishing.getOwnerState(),text=mode.remaining>0?`当前：${mode.fishName} · 剩余 ${mode.remaining} 条`:'当前：随机鱼种';if(text!==lastStatus){status.textContent=text;lastStatus=text;}}
  function open(){
    if(command.value.trim()!=='realm owner')return false;
    command.value='';message.textContent='';onOpen();lastStatus='';update();
    const mode=fishing.getOwnerState();if(mode.fishName)select.value=mode.fishName;
    dialog.showModal();return true;
  }
  command.addEventListener('input',()=>{message.textContent=command.value.trim()==='clear'?'按回车清空鱼堆和背包里的全部鱼。':'';open();});
  document.querySelector('#realm-command-form').addEventListener('submit',event=>{event.preventDefault();if(command.value.trim()==='clear'){command.value='';const result=onClearAll();message.textContent=`已重置鱼堆和背包，共清除 ${result.removed} 条鱼。`+(result.saved?'':'本次未能保存。');if(result.saved)toast(`鱼堆和背包已清空 · ${result.removed} 条鱼`);return;}if(!open())message.textContent='未识别的内容';});
  document.querySelector('#owner-close').addEventListener('click',()=>dialog.close());
  document.querySelector('#owner-fish-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!fishing.setForcedFish(select.value)){status.textContent='请先结束当前这一轮，再确认选择';return;}
    update();dialog.close();toast(`已选择${select.value} · 接下来成功钓获 10 条`);
  });
  dialog.addEventListener('close',()=>document.querySelector('#settings-toggle').focus({preventScroll:true}));
  return {update:()=>{if(dialog.open)update();}};
}
