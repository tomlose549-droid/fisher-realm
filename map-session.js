// Own one map and its fishing presentation. Global inventory/UI never belong here.
export function createMapSession({createMap,createFishing,onRelease=()=>{}}){
  let map=null,fishing=null,busy=false,lastState=null,ownerState={fishName:null,remaining:0},created=0,released=0;
  function leave(){
    if(fishing){ownerState=fishing.getOwnerState();lastState=fishing.getState();fishing.dispose();fishing=null;}
    if(map){map.dispose();map=null;released++;onRelease();}
  }
  return {
    get map(){return map;},get fishing(){return fishing;},
    getState:()=>fishing?.getState()??lastState??{state:'idle',ownerMode:{...ownerState},reeling:false},
    getOwnerState:()=>fishing?.getOwnerState()??{...ownerState},
    diagnostics:()=>({liveMaps:map?1:0,liveFishing:fishing?1:0,busy,created,released}),
    async enter(id){
      if(busy)throw Error('地图正在加载，请稍候');
      busy=true;
      try{
        leave();map=await createMap(id);created++;
        fishing=createFishing(map,ownerState);
        return map;
      }catch(error){leave();throw error;}
      finally{busy=false;}
    },
    leave(){if(busy)throw Error('地图正在加载');leave();}
  };
}
