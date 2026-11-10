export const TACKLE=Object.freeze({
  '1号鱼线':Object.freeze({slot:'line',lineBonus:4,reelBonus:.1,slowdown:.01,maxWear:20}),
  '2号鱼线':Object.freeze({slot:'line',lineBonus:10,reelBonus:.1,slowdown:.03,maxWear:40}),
  '3号鱼线':Object.freeze({slot:'line',lineBonus:25,reelBonus:.1,slowdown:.03,maxWear:20}),
  '1号渔轮-初学者':Object.freeze({slot:'reel',lineBonus:0,reelBonus:.15,slowdown:.02,maxWear:null})
});
export const tackleFor=name=>typeof name==='string'&&Object.hasOwn(TACKLE,name)?TACKLE[name]:null;
export function wearFields(raw){
  const config=tackleFor(raw.name);if(!config?.maxWear)return {};
  const lineWear=raw.lineWear??config.maxWear;
  if(!Number.isInteger(lineWear)||lineWear<1||lineWear>config.maxWear)throw Error('鱼线耐久资料异常，已停止加载以保护存档。');
  return {lineWear};
}
export function tackleStats(equipment={}){
  const line=tackleFor(equipment.line?.name),reel=tackleFor(equipment.reel?.name);
  return Object.freeze({lineMaximum:100+(line?.lineBonus??0),reelBaseSpeed:3.75+(line?.reelBonus??0)+(reel?.reelBonus??0),fishSpeedScale:1-(line?.slowdown??0)-(reel?.slowdown??0)});
}
export function wearRoll(unit){
  if(!Number.isFinite(unit)||unit<0||unit>1)throw TypeError('Invalid wear roll');
  return {normalLoss:unit<.65?1:0,brokenLoss:unit<.95?1:3};
}
export function tackleDescription(name){
  const stats=tackleFor(name);if(!stats)return '';
  return (stats.lineBonus?`线韧性 +${stats.lineBonus} · `:'')+`收线 +${stats.reelBonus} 米/秒 · 鱼移速降低 ${Math.round(stats.slowdown*100)}%`+(stats.maxWear?` · 满耐久 ${stats.maxWear}`:' · 无耐久损耗');
}
