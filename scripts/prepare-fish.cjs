// The assistant fills this structured template from the user's Chinese description.
// Never guess units, special behavior or missing parameters; never modify fish-data.js.
const fs=require('node:fs'), path=require('node:path'), {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const COLORS=Object.freeze({grey:'#808080',gray:'#808080',green:'#008000','light green':'#90ee90',
  white:'#ffffff',blue:'#0000ff',turquoise:'#40e0d0','dark purple':'#301934',violet:'#ee82ee'});

function fields(object, names, label) {
  if(!object || typeof object!=='object' || Array.isArray(object)) throw Error(`${label}：应填写对象`);
  for(const key of Object.keys(object)) if(!names.includes(key)) throw Error(`${label}：不认识字段“${key}”，请确认含义和单位`);
  for(const key of names) if(!Object.hasOwn(object,key)) throw Error(`${label}：缺少“${key}”`);
}

async function prepare(input, entries) {
  const {FISH_DATA,createFishCatalog}=await import(pathToFileURL(path.join(root,'fish-data.js')).href);
  entries??=FISH_DATA;
  fields(input,['标识','名称','颜色','力量','速度米每秒','耐力','休息秒','挣扎','背包','特殊属性'],'鱼种');
  fields(input.力量,['间隔秒','降低韧性'],'力量');
  fields(input.挣扎,['最小角度','最大角度','每段秒','换边停顿秒'],'挣扎');
  fields(input.背包,['高','宽','图片'],'背包');
  const color=typeof input.颜色==='string' ? COLORS[input.颜色.trim().toLowerCase()] ?? input.颜色 : null;
  if(typeof color!=='string' || !/^#[0-9a-f]{6}$/i.test(color)) throw Error('颜色：请填已有英文颜色名或六位十六进制颜色');
  const pause=input.挣扎.换边停顿秒;
  if(!Number.isFinite(pause) || pause<0) throw Error('换边停顿秒：必须是大于或等于0的数字');
  const fish={id:input.标识,name:input.名称,catchColor:color.toLowerCase(),
    strength:{amount:input.力量.降低韧性,interval:input.力量.间隔秒},
    restDuration:input.休息秒,speed:input.速度米每秒,stamina:input.耐力,
    struggle:{minAngle:input.挣扎.最小角度,maxAngle:input.挣扎.最大角度,durations:input.挣扎.每段秒},
    specials:input.特殊属性,inventory:{w:input.背包.宽,h:input.背包.高,color:color.toLowerCase(),image:input.背包.图片}};
  if(pause>0) fish.struggle.switchPause=pause;
  createFishCatalog([...entries,fish]);
  if(pause>0 && fish.struggle.durations.length<2) throw Error('换边停顿秒：只有一段游动，不存在换边；请先确认');
  // Current ordinary-fish engine only implements the documented switch pause.
  const expected=pause>0 ? [`换边前停顿${pause}秒`] : [];
  if(JSON.stringify(fish.specials)!==JSON.stringify(expected))
    throw Error(`特殊属性：当前普通鱼仅支持换边停顿；请填写 ${JSON.stringify(expected)}，其他特殊行为先讨论`);
  return fish;
}

async function main() {
  const [input,flag,output,...extra]=process.argv.slice(2);
  if(!input || extra.length || (flag!==undefined && (flag!=='--output' || !output)))
    throw Error('Usage: node scripts/prepare-fish.cjs template.json [--output .qa/fish-config.json]');
  const fish=await prepare(JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'')));
  const text=JSON.stringify(fish,null,2)+'\n';
  // An exclusive create prevents accidentally overwriting the catalog or an existing draft.
  if(output) fs.writeFileSync(output,text,{flag:'wx'});
  else process.stdout.write(text);
  console.error('参数检查通过：已生成待核对配置，未修改鱼种名单。');
  if(!fish.inventory.image) console.error('缺少图片：允许先接入属性；补图时须同时准备缩略图。');
  else if(!fs.existsSync(path.join(root,'fish-images',fish.inventory.image))) console.error('图片文件尚不存在：素材未完成。');
}
module.exports={prepare};
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
