import {mapEntryFee} from './map-entry.js';
// Normalized anchors are calibrated to the illustrated landmasses, not a flat projection.
export const WORLD_LOCATION=Object.freeze({id:'summer-pond',entryFee:mapEntryFee('summer-pond'),name:'美国奥基乔比湖',region:'美国 · 佛罗里达州',x:.224,y:.426,preview:'map-images/okeechobee-realistic-preview.webp',markerId:'world-lake-point'});
// Approx. geographic anchor: Negro/Solimões confluence near Manaus, Brazil.
// Source: https://sigep.eco.br/sitio054/Poligonal_area_protecao_Sitio054_Ponta_das_Lajes_e_o_Encontro_das_Aguas_AM.pdf
export const AMAZON_LOCATION=Object.freeze({id:'amazon-confluence',entryFee:mapEntryFee('amazon-confluence'),name:'亚马逊 · 河道交汇区',region:'巴西 · 玛瑙斯附近',latitude:-3.14,longitude:-59.91,x:.303,y:.553,preview:'map-images/amazon-preview.png',markerId:'world-amazon-point'});
// Illustrated Amazon-region anchor, deliberately offset from the existing marker.
export const FLOODED_FOREST_LOCATION=Object.freeze({id:'amazon-flooded-forest',entryFee:mapEntryFee('amazon-flooded-forest'),name:'亚马逊 · 沉木水草区',region:'亚马逊 · 林间缓水钓点',x:.323,y:.603,preview:'map-images/flooded-forest-preview.png',markerId:'world-flooded-forest-point'});
// Geographic anchor: IUGS Sac Actun site, calibrated to the illustrated Yucatan coast.
// https://iugs-geoheritage.org/geoheritage_sites/sac-actum-underwater-cave-system/
export const SAC_ACTUN_LOCATION=Object.freeze({id:'sac-actun',entryFee:mapEntryFee('sac-actun'),name:'墨西哥·萨克阿克通水下洞穴系统',region:'墨西哥 · 尤卡坦半岛',latitude:20.2464,longitude:-87.4642,x:.201,y:.463,preview:'map-images/sac-actun-preview.png',markerId:'world-sac-actun-point'});
export const WORLD_LOCATIONS=Object.freeze([WORLD_LOCATION,AMAZON_LOCATION,FLOODED_FOREST_LOCATION,SAC_ACTUN_LOCATION]);
export const WORLD_IMAGE='map-images/world.png';
