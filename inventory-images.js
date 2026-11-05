// Keep loading visible and retry transient failures without changing inventory items.
export function loadInventoryImage(img,src,onState){
  let attempts=0,timer;
  function request(){
    onState('loading');
    img.onload=()=>{clearTimeout(timer);onState('ready');};
    img.onerror=failed;
    img.src=src+(attempts?(src.includes('?')?'&':'?')+'retry='+attempts:'');
    timer=setTimeout(failed,45000);
  }
  function failed(){
    clearTimeout(timer);img.onload=null;img.onerror=null;
    if(!img.isConnected)return;
    if(attempts<2){attempts++;timer=setTimeout(request,attempts*1000);}
    else onState('error');
  }
  request();
}
