import {FISH_DATA} from '../fish-data.js';
import {createEncounterTable} from '../fish-encounters.js';

// Eight approved Amazon species share normal encounters equally.
const amazonIds=new Set(["AMAZON_LONG_SARDINE","AMAZON_SILVER_PACU","BANDED_LEPORINUS","GUPPY","AFRICAN_SHARPTOOTH_CATFISH","AMAZON_BRYCON","AMAZON_FRESHWATER_DRUM","RED_BELLIED_PIRANHA"]);
export const AMAZON_CONFLUENCE_ENCOUNTERS=createEncounterTable(FISH_DATA.map(f=>({id:f.id,percent:amazonIds.has(f.id)?12.5:0})));
