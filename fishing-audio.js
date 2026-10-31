const CLIPS={hooked:'hooked.wav',broken:'line-broken.wav',caught:'caught.wav'};

export function createFishingAudio(){
  const clips=Object.fromEntries(Object.entries(CLIPS).map(([name,file])=>{
    const audio=new Audio(new URL('./audio/'+file,import.meta.url).href);
    audio.preload='auto';return [name,audio];
  }));
  const played={hooked:0,broken:0,caught:0},errors=[];
  function play(name){
    for(const audio of Object.values(clips))audio.pause();
    const audio=clips[name];audio.currentTime=0;
    audio.play().then(()=>played[name]++).catch(error=>errors.push({clip:name,message:error.message}));
  }
  let paused=[];
  return {play,pause(){paused=Object.values(clips).filter(a=>!a.paused&&!a.ended);for(const a of paused)a.pause();},resume(){for(const a of paused)a.play().catch(error=>errors.push({message:error.message}));paused=[];},snapshot:()=>({played:{...played},errors:errors.slice()})};
}
