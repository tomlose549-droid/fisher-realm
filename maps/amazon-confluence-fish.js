import {FISH_DATA} from '../fish-data.js';
import {createEncounterTable} from '../fish-encounters.js';

// Approved initial pool: ordinary tilapia only. Other species remain in global saves/guide.
export const AMAZON_CONFLUENCE_ENCOUNTERS=createEncounterTable(FISH_DATA.map(f=>({id:f.id,percent:f.id==='TILAPIA'?100:0})));
