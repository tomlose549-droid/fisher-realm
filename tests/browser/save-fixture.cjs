// Inspect the active section without depending on the retired single-save keys.
function readInPage(key){
  const root=JSON.parse(localStorage.getItem('fisher-realm-save-slots-v1'));
  if(!root)return JSON.parse(localStorage.getItem(key));
  const field=key==='fisher-realm-inventory-v1'?'inventory':'discoveries';
  return root.slots.find(slot=>slot.id===root.activeId)?.data[field]??null;
}
module.exports={readInPage,readSavedSection:(page,key)=>page.evaluate(readInPage,key)};
