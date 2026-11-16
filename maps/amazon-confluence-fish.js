import {FISH_DATA} from '../fish-data.js';
import {createEncounterTable} from '../fish-encounters.js';

// Four approved Amazon species share the former tilapia probability equally.
const amazonIds=new Set(["AMAZON_LONG_SARDINE","AMAZON_SILVER_PACU","BANDED_LEPORINUS","GUPPY"]);
export const AMAZON_CONFLUENCE_ENCOUNTERS=createEncounterTable(FISH_DATA.map(f=>({id:f.id,percent:amazonIds.has(f.id)?25:0})));
