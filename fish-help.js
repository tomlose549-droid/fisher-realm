import {FISH_DATA,DEFAULT_CATCH_COLOR} from './fish-data.js';
import {getMapEncounterTable} from './map-registry.js';

const colors={'#d3d3d3':'浅灰色','#808080':'灰色','#008000':'绿色','#90ee90':'浅绿色','#ffffff':'白色','#0000ff':'蓝色','#4c9fff':'蓝色','#301934':'深紫色','#40e0d0':'青绿色','#4b0082':'紫罗兰色','#00008b':'靛蓝色'};
const colorText=value=>colors[value.toLowerCase()]??value;

// Pure formatting makes additions and tuning use the same data as the game.
export function buildFishHelp(entries=FISH_DATA,encounters=getMapEncounterTable()){
  const count=entries.length;
  const summary=count?`目前有${count}种鱼：${entries.map(f=>f.name).join('、')}。每竿按当前地图配置的概率独立随机遇鱼，具体概率见各鱼种资料；实际成功钓获比例受成功率影响。`:'目前暂无鱼种。';
  const profiles=entries.map(f=>{
    const s=f.struggle,times=s.durations??[s.firstDuration,s.secondDuration];
    const angle=s.minAngle===s.maxAngle?`${s.minAngle}°`:`${s.minAngle}°–${s.maxAngle}°`;
    const movement=times.length===1?`游动${times[0]}秒，轮内不换边。`:`依次交替游动${times.join('、')}秒，共${times.length}段；每次换边重新随机角度。`;
    const pause=times.length>1&&s.switchPause>0?`换边前停顿${s.switchPause}秒，最后一段结束后直接休息。`:'';
    const probability=encounters.probabilityFor(f.id),probabilityText=probability===null?'未配置（需先确认分配）':probability+'%';
    return {id:f.id,name:f.name,quality:f.quality,probability,probabilityText,catchColor:f.catchColor??DEFAULT_CATCH_COLOR,inventoryColor:f.inventory.color,lines:[
      `力量：挣扎中收线时，每${f.strength.interval}秒降低${f.strength.amount}点线韧性。休息：每轮${f.restDuration}秒。速度：挣扎时每秒${f.speed}米。耐力：${f.stamina}。`,
      `挣扎：每轮随机先左或右，从横向朝本轮正前方转${angle}，${movement}${pause}全部挣扎结束后休息${f.restDuration}秒。`,
      `特殊属性：${f.specials.length?f.specials.join('；'):'无'}。背包：高${f.inventory.h}格×宽${f.inventory.w}格，不支持旋转。`,
      `当前地图遇鱼概率：${probabilityText}。`,
      `钓获文字色：${colorText(f.catchColor??DEFAULT_CATCH_COLOR)}；背包底色：${colorText(f.inventory.color)}。`
    ]};
  });
  return {count,summary,profiles};
}

export function renderFishHelp(doc=document,entries=FISH_DATA,encounters=getMapEncounterTable()){
  const content=buildFishHelp(entries,encounters);
  doc.querySelector('#help-species-summary').textContent=content.summary;
  const cards=content.profiles.map(f=>{
    const card=doc.createElement('details');card.className='help-fish-entry';card.dataset.helpFishId=f.id;
    const title=doc.createElement('summary');title.textContent=f.name;card.append(title);
    for(const line of f.lines){const p=doc.createElement('p');p.textContent=line;card.append(p);}
    return card;
  });
  doc.querySelector('#help-fish-profiles').replaceChildren(...cards);
}
