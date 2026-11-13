// Dimensions are rows × columns in the UI; costs apply to each individual step.
export const BACKPACK_LEVELS=Object.freeze([
  [3,5,0],[4,5,30],[5,5,100],[5,6,200],[6,6,750],
  [6,7,1200],[6,8,2000],[6,9,3500],[6,10,8888],[7,10,19999]
].map(([h,w,cost],level)=>Object.freeze({level,h,w,cost})));
export function backpackLevel(value){
  if(value===undefined)return 0;
  if(!Number.isInteger(value)||!BACKPACK_LEVELS[value])throw Error('背包等级异常，已停止加载以保护存档。');
  return value;
}
// Both views use the same cell geometry, including padding and gaps.
export function sizeBackpackGrid(grid,inventory,label){
  grid.style.setProperty('--bag-columns',inventory.width);
  grid.style.setProperty('--bag-rows',inventory.height);
  grid.setAttribute('aria-label',`背包宽${inventory.width}格高${inventory.height}格`);
  label.textContent=`${inventory.width} 列 × ${inventory.height} 行 · lv${inventory.level}`;
}
export function backpackDestination(grid,event,offsetX=0,offsetY=0){
  const bounds=grid.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>=bounds.right||event.clientY<bounds.top||event.clientY>=bounds.bottom)return null;
  const first=grid.querySelector('[data-x="0"][data-y="0"]').getBoundingClientRect();
  const next=grid.querySelector('[data-x="1"][data-y="0"]').getBoundingClientRect();
  const row=grid.querySelector('[data-x="0"][data-y="1"]').getBoundingClientRect();
  return {x:Math.floor((event.clientX-first.left)/(next.left-first.left))-offsetX,y:Math.floor((event.clientY-first.top)/(row.top-first.top))-offsetY};
}
