import {assetUrl} from './release-assets.js';
const CLIPS={hooked:'hooked.wav',broken:'line-broken.wav',caught:'caught.wav'};

export function createFishingAudio(){
  let disposed=false;
  const clips=Object.fromEntries(Object.entries(CLIPS).map(([name,file])=>{
    const audio=new Audio(assetUrl('./audio/'+file));
    audio.preload='auto';return [name,audio];
  }));
  const played={hooked:0,broken:0,caught:0},errors=[];
  function play(name){
    if(disposed)return;
    for(const audio of Object.values(clips))audio.pause();
    const audio=clips[name];audio.currentTime=0;
    audio.play().then(()=>played[name]++).catch(error=>errors.push({clip:name,message:error.message}));
  }
  let paused=[];
  return {play,pause(){if(disposed)return;paused=Object.values(clips).filter(a=>!a.paused&&!a.ended);for(const a of paused)a.pause();},resume(){if(disposed)return;for(const a of paused)a.play().catch(error=>errors.push({message:error.message}));paused=[];},dispose(){if(disposed)return;disposed=true;paused=[];for(const audio of Object.values(clips)){audio.pause();audio.removeAttribute('src');audio.load();}},snapshot:()=>({played:{...played},errors:errors.slice()})};
}
