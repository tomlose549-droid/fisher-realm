import {mapEntryFee} from './map-entry.js';
// Normalized anchors are calibrated to the illustrated landmasses, not a flat projection.
export const WORLD_LOCATION=Object.freeze({id:'summer-pond',entryFee:mapEntryFee('summer-pond'),name:'美国奥基乔比湖',region:'美国 · 佛罗里达州',x:.224,y:.426,preview:'map-images/okeechobee-preview.png',markerId:'world-lake-point'});
// Approx. geographic anchor: Negro/Solimões confluence near Manaus, Brazil.
// Source: https://sigep.eco.br/sitio054/Poligonal_area_protecao_Sitio054_Ponta_das_Lajes_e_o_Encontro_das_Aguas_AM.pdf
export const AMAZON_LOCATION=Object.freeze({id:'amazon-confluence',entryFee:mapEntryFee('amazon-confluence'),name:'亚马逊 · 河道交汇区',region:'巴西 · 玛瑙斯附近',latitude:-3.14,longitude:-59.91,x:.303,y:.553,preview:'map-images/amazon-preview.png',markerId:'world-amazon-point'});
export const WORLD_LOCATIONS=Object.freeze([WORLD_LOCATION,AMAZON_LOCATION]);
export const WORLD_IMAGE='map-images/world.png';
