export const DEFAULT_CATCH_COLOR='#d3d3d3';
// The only editable catalog for ordinary fish. Existing IDs/names are save/API identities.
// Keep encounter order stable. Inventory dimensions are width (w), then height (h).
function freeze(value){
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
  return value;
}
export function createFishCatalog(entries){
  const ids=new Set(),names=new Set();
  const fail=(label,message)=>{throw new TypeError(`${label}: ${message}`);};
  const positive=v=>Number.isFinite(v)&&v>0;
  const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  if(!Array.isArray(entries)||!entries.length)fail('fish data','expected a nonempty array');
  for(const e of entries){
    const label=e?.name||e?.id||'fish';
    if(!e||typeof e.id!=='string'||!(/^[A-Z][A-Z0-9_]*$/).test(e.id)||ids.has(e.id))fail(label,'invalid or duplicate id');
    if(typeof e.name!=='string'||!e.name.trim()||e.name!==e.name.trim()||names.has(e.name))fail(label,'invalid or duplicate name');
    ids.add(e.id);names.add(e.name);
    if(!positive(e.strength?.amount)||!positive(e.strength?.interval))fail(label,'strength amount/interval must be positive');
    if(!positive(e.restDuration)||!positive(e.speed)||!positive(e.stamina))fail(label,'restDuration/speed/stamina must be positive');
    if(e.catchColor!==undefined&&!color(e.catchColor))fail(label,'invalid catchColor');
    const s=e.struggle;
    if(!s||!Number.isFinite(s.minAngle)||!Number.isFinite(s.maxAngle)||s.minAngle<0||s.maxAngle>90||s.minAngle>s.maxAngle)fail(label,'invalid lateral angles');
    const durations=s.durations??[s.firstDuration,s.secondDuration];
    if(!Array.isArray(durations)||durations.length<1||durations.length>5||!durations.every(positive))fail(label,'expected 1–5 positive struggle durations');
    if(s.switchPause!==undefined&&(!Number.isFinite(s.switchPause)||s.switchPause<0))fail(label,'invalid switchPause');
    if(!Array.isArray(e.specials)||!e.specials.every(v=>typeof v==='string'))fail(label,'invalid specials');
    const item=e.inventory;
    if(!item||!Number.isInteger(item.w)||!Number.isInteger(item.h)||item.w<1||item.w>5||item.h<1||item.h>3)fail(label,'inventory must fit the 5×3 bag');
    if(!color(item.color))fail(label,'invalid inventory color');
    if(item.image!==null&&(typeof item.image!=='string'||!item.image||item.image.startsWith('/')||item.image.includes('..')||/[\\:?#]/.test(item.image)))fail(label,'image must be null or a relative asset path');
  }
  const profiles=entries.map(({id,inventory,...profile})=>freeze(structuredClone(profile)));
  return Object.freeze({
    profiles:Object.freeze(profiles),
    byId:Object.freeze(Object.fromEntries(entries.map((e,i)=>[e.id,profiles[i]]))),
    items:Object.freeze(Object.fromEntries(entries.map(e=>[e.name,freeze({...e.inventory})])))
  });
}

export const FISH_DATA=freeze([
  {"id":"TILAPIA","name":"罗非鱼","catchColor":"#808080","strength":{"amount":3,"interval":0.2},"restDuration":3.3,"speed":4.2,"stamina":44,"struggle":{"minAngle":32,"maxAngle":42,"firstDuration":3.9,"secondDuration":3.4},"specials":[],"inventory":{"w":2,"h":1,"color":"#808080","image":"cutouts/tilapia.png"}},
  {"id":"BLUEGILL","name":"蓝鳃太阳鱼","catchColor":"#008000","strength":{"amount":2,"interval":0.11},"restDuration":4.2,"speed":5.6,"stamina":56,"struggle":{"minAngle":35,"maxAngle":41,"durations":[3,0.9,1.6,4.2]},"specials":[],"inventory":{"w":2,"h":1,"color":"#008000","image":"cutouts/bluegill.png"}},
  {"id":"REDEAR","name":"红耳太阳鱼","catchColor":"#90ee90","strength":{"amount":3,"interval":0.13},"restDuration":4.2,"speed":5.5,"stamina":45,"struggle":{"minAngle":56,"maxAngle":63,"durations":[1.9,1,1.4,3]},"specials":[],"inventory":{"w":2,"h":1,"color":"#90ee90","image":"cutouts/redear.png"}},
  {"id":"BLACKBERRY_BASS","name":"黑莓鲈","catchColor":"#ffffff","strength":{"amount":3,"interval":0.23},"restDuration":5,"speed":5,"stamina":42,"struggle":{"minAngle":45,"maxAngle":63,"durations":[3.5,3.5,3.4],"switchPause":0.3},"specials":["换边前停顿0.3秒"],"inventory":{"w":3,"h":1,"color":"#ffffff","image":"cutouts/blackberry.png"}},
  {"id":"GOLDEN_SHINER","name":"金色闪光鲦","catchColor":"#0000ff","strength":{"amount":1,"interval":0.15},"restDuration":4.9,"speed":6.4,"stamina":75,"struggle":{"minAngle":52,"maxAngle":63,"durations":[4]},"specials":[],"inventory":{"w":1,"h":1,"color":"#0000ff","image":"cutouts/shiner.png"}},
  {"id":"NILE_TILAPIA","name":"尼罗罗非鱼","catchColor":"#ffffff","strength":{"amount":3,"interval":0.19},"restDuration":3.4,"speed":4.25,"stamina":45,"struggle":{"minAngle":40,"maxAngle":46,"durations":[3.9,3.4]},"specials":[],"inventory":{"w":2,"h":1,"color":"#ffffff","image":"nile-tilapia.png"}},
  {"id":"COMMON_CARP","name":"普通鲤鱼","catchColor":"#ffffff","strength":{"amount":3,"interval":0.17},"restDuration":3.9,"speed":4.1,"stamina":46,"struggle":{"minAngle":36,"maxAngle":45,"durations":[4,3.1]},"specials":[],"inventory":{"w":2,"h":1,"color":"#ffffff","image":"common-carp.png"}},
  {"id":"EUROPEAN_PERCH","name":"欧洲河鲈","catchColor":"#90ee90","strength":{"amount":3,"interval":0.2},"restDuration":4.7,"speed":4.9,"stamina":50,"struggle":{"minAngle":36,"maxAngle":59,"durations":[3.5,3.9,3.5],"switchPause":0.25},"specials":["换边前停顿0.25秒"],"inventory":{"w":3,"h":1,"color":"#90ee90","image":"cutouts/european-perch.png"}},
  {"id":"WHITE_CATFISH","name":"白鮰","catchColor":"#008000","strength":{"amount":6,"interval":0.15},"restDuration":1,"speed":3,"stamina":43,"struggle":{"minAngle":30,"maxAngle":36,"durations":[4,1.5]},"specials":[],"inventory":{"w":3,"h":1,"color":"#008000","image":"cutouts/white-catfish.png"}},
  {"id":"CHANNEL_CATFISH","name":"斑点叉尾鮰","catchColor":"#40e0d0","strength":{"amount":7,"interval":0.16},"restDuration":1.1,"speed":3.4,"stamina":47,"struggle":{"minAngle":31,"maxAngle":36,"durations":[4.4,1.5]},"specials":[],"inventory":{"w":3,"h":2,"color":"#40e0d0","image":"cutouts/channel-catfish.png"}},
  {"id":"LARGEMOUTH_BASS","name":"大口黑鲈","catchColor":"#0000ff","strength":{"amount":4,"interval":0.17},"restDuration":3,"speed":5.2,"stamina":69,"struggle":{"minAngle":37,"maxAngle":61,"durations":[6,4,4],"switchPause":0.3},"specials":["换边前停顿0.3秒"],"inventory":{"w":3,"h":2,"color":"#0000ff","image":"cutouts/largemouth-bass.png"}},
  {"id":"CHAIN_PICKEREL","name":"链纹狗鱼","catchColor":"#301934","strength":{"amount":2,"interval":0.11},"restDuration":4.8,"speed":7,"stamina":80,"struggle":{"minAngle":53,"maxAngle":65,"durations":[7.2]},"specials":[],"inventory":{"w":3,"h":1,"color":"#301934","image":"cutouts/chain-pickerel.png"}},
  {"id":"LEOPARD_PLECO","name":"豹纹翼甲鲶","catchColor":"#808080","strength":{"amount":3,"interval":0.16},"restDuration":2.6,"speed":2.7,"stamina":32,"struggle":{"minAngle":33,"maxAngle":40,"durations":[3.4,2]},"specials":[],"inventory":{"w":2,"h":2,"color":"#808080","image":"cutouts/leopard-pleco.png"}},
  {"id":"LONGNOSE_GAR","name":"长吻雀鳝","catchColor":"#4b0082","strength":{"amount":4,"interval":0.16},"restDuration":4.5,"speed":6.5,"stamina":90,"struggle":{"minAngle":46,"maxAngle":59,"durations":[4.5,2,1.5,1,0.8]},"specials":[],"inventory":{"w":4,"h":1,"color":"#4b0082","image":"cutouts/longnose-gar.png"}},
  {"id":"MAYAN_CICHLID","name":"玛雅慈鲷","catchColor":"#008000","strength":{"amount":3,"interval":0.15},"restDuration":4.1,"speed":5,"stamina":54,"struggle":{"minAngle":34,"maxAngle":42,"durations":[6.2,3.1]},"specials":[],"inventory":{"w":2,"h":2,"color":"#008000","image":"cutouts/mayan-cichlid.png"}},
  {"id":"OSCAR","name":"地图鱼","catchColor":"#40e0d0","strength":{"amount":4,"interval":0.15},"restDuration":4.2,"speed":5.2,"stamina":55,"struggle":{"minAngle":34,"maxAngle":43,"durations":[6.3,2.8,0.6]},"specials":[],"inventory":{"w":2,"h":2,"color":"#40e0d0","image":"cutouts/oscar.png"}},
  {"id":"FLORIDA_GAR","name":"佛罗里达雀鳝","catchColor":"#301934","strength":{"amount":4,"interval":0.15},"restDuration":4.9,"speed":6.2,"stamina":86,"struggle":{"minAngle":47,"maxAngle":57,"durations":[4,2,1.5,0.8,0.2]},"specials":[],"inventory":{"w":4,"h":1,"color":"#301934","image":"cutouts/florida-gar.png"}},
  {"id":"YELLOW_BULLHEAD","name":"黄鲶","catchColor":"#008000","strength":{"amount":6,"interval":0.17},"restDuration":0.9,"speed":3.1,"stamina":41,"struggle":{"minAngle":33,"maxAngle":36,"durations":[4,1.5]},"specials":[],"inventory":{"w":3,"h":1,"color":"#008000","image":"cutouts/yellow-bullhead.webp"}},
  {"id":"BOWFIN","name":"弓鳍鱼","catchColor":"#0000ff","strength":{"amount":3,"interval":0.11},"restDuration":4.2,"speed":5.3,"stamina":45,"struggle":{"minAngle":31,"maxAngle":40,"durations":[1.9,0.9,1.8,0.5,1]},"specials":[],"inventory":{"w":2,"h":1,"color":"#0000ff","image":"cutouts/bowfin.webp"}},
  {"id":"AMERICAN_EEL","name":"美洲鳗鲡","catchColor":"#40e0d0","strength":{"amount":3,"interval":0.38},"restDuration":4,"speed":8,"stamina":56,"struggle":{"minAngle":30,"maxAngle":60,"durations":[4,4,4]},"specials":[],"inventory":{"w":5,"h":1,"color":"#40e0d0","image":"cutouts/american-eel.png"}},
  {"id":"REDFIN_PICKEREL","name":"红鳍狗鱼","catchColor":"#00008b","strength":{"amount":2,"interval":0.12},"restDuration":4.8,"speed":7,"stamina":76,"struggle":{"minAngle":52,"maxAngle":65,"durations":[7.6]},"specials":[],"inventory":{"w":2,"h":1,"color":"#00008b","image":"cutouts/redfin-pickerel.png"}},
  {"id":"GRASS_CARP","name":"草鱼","catchColor":"#90ee90","strength":{"amount":3,"interval":0.15},"restDuration":4.1,"speed":5.7,"stamina":47,"struggle":{"minAngle":38,"maxAngle":42,"durations":[3.1,4.5]},"specials":[],"inventory":{"w":3,"h":1,"color":"#90ee90","image":"cutouts/grass-carp.png"}},
  {"id":"WALKING_CATFISH","name":"行走鲶","catchColor":"#40e0d0","strength":{"amount":6,"interval":0.16},"restDuration":0.8,"speed":3.2,"stamina":46,"struggle":{"minAngle":30,"maxAngle":37,"durations":[4.1,1.5]},"specials":[],"inventory":{"w":3,"h":1,"color":"#40e0d0","image":"cutouts/walking-catfish.png"}},
  {"id":"JACK_DEMPSEY","name":"杰克登普西慈鲷","catchColor":"#00008b","strength":{"amount":3,"interval":0.12},"restDuration":4.3,"speed":5.3,"stamina":55,"struggle":{"minAngle":33,"maxAngle":42,"durations":[6.3,3]},"specials":[],"inventory":{"w":2,"h":2,"color":"#00008b","image":"cutouts/jack-dempsey.png"}},
  {"id":"PEACOCK_BASS","name":"孔雀鲈","catchColor":"#00008b","strength":{"amount":4,"interval":0.19},"restDuration":3.2,"speed":5.6,"stamina":64,"struggle":{"minAngle":33,"maxAngle":70,"durations":[6,3.5,4.3]},"specials":[],"inventory":{"w":3,"h":1,"color":"#00008b","image":"cutouts/peacock-bass.png"}},
  {"id":"AFRICAN_JEWEL_CICHLID","name":"非洲宝石慈鲷","catchColor":"#0000ff","strength":{"amount":3,"interval":0.15},"restDuration":4.3,"speed":5,"stamina":56,"struggle":{"minAngle":34,"maxAngle":42,"durations":[6.1,3]},"specials":[],"inventory":{"w":2,"h":1,"color":"#0000ff","image":"cutouts/african-jewel-cichlid.png"}},
  {"id":"LAKE_SUCKER","name":"湖吸口鱼","catchColor":"#40e0d0","strength":{"amount":5,"interval":0.18},"restDuration":2.2,"speed":4,"stamina":42,"struggle":{"minAngle":30,"maxAngle":36,"durations":[4.2,1.3]},"specials":[],"inventory":{"w":3,"h":1,"color":"#40e0d0","image":"cutouts/lake-sucker.png"}}
]);

export const FISH_CATALOG=createFishCatalog(FISH_DATA);
