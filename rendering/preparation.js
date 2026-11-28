export async function withDeadline(work,ms,onTimeout,label='场景准备'){
 let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();reject(new Error(label+'超时，可切换低档重试'));},ms);})]);}finally{clearTimeout(timer);}
}
// Background tabs may never receive RAF. Initialization must still settle.
export function nextPaint(limit=100){return new Promise(resolve=>{let frame=null,settled=false;const done=()=>{if(settled)return;settled=true;clearTimeout(timer);if(frame!==null)globalThis.cancelAnimationFrame?.(frame);resolve();};const timer=setTimeout(done,limit);if(globalThis.requestAnimationFrame)frame=requestAnimationFrame(done);});}
export function cancelable(work,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason??new DOMException('Cancelled','AbortError'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});Promise.resolve(work).then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)value?.dispose?.();else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
