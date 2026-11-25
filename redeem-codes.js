export const ESPORTS_TOKEN=Object.freeze({id:'ESPORTS_TOKEN_68',name:'68电竞打手专属滚木令牌：魔王护不成',w:3,h:3,quality:'dark red',color:'#8b0000',kind:'token',stackLimit:1,image:null,sellPrice:67});
export const REWARD_ITEMS=Object.freeze([ESPORTS_TOKEN]);
export const REDEEM_CODES=Object.freeze({'67电竞不成':Object.freeze({id:'ESPORTS_67',coins:67,items:Object.freeze([Object.freeze([ESPORTS_TOKEN.name,1])])})});
const knownIds=new Set(Object.values(REDEEM_CODES).map(code=>code.id));
export function restoreRedemptions(raw){
 if(raw===undefined)return {version:1,codes:[]};
 if(!raw||raw.version!==1||!Array.isArray(raw.codes)||new Set(raw.codes).size!==raw.codes.length||raw.codes.some(id=>typeof id!=='string'||!knownIds.has(id)))throw Error('兑换记录异常，已停止加载以保护存档，请保留浏览器数据并联系维护者。');
 return {version:1,codes:[...raw.codes]};
}
