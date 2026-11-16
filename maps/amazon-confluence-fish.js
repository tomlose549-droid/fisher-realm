import {createEqualEncounterTable} from '../fish-encounters.js';

// Explicit approved membership; each fish receives one equal share.
export const AMAZON_FISH_IDS=Object.freeze(["AMAZON_LONG_SARDINE","AMAZON_SILVER_PACU","BANDED_LEPORINUS","GUPPY","AFRICAN_SHARPTOOTH_CATFISH","AMAZON_BRYCON","AMAZON_FRESHWATER_DRUM","RED_BELLIED_PIRANHA","SOUTH_AMERICAN_WOLFFISH","BLOCH_CATFISH","RED_BELLIED_PACU","BROWN_TROUT","CUTTHROAT_TROUT"]);
export const AMAZON_CONFLUENCE_ENCOUNTERS=createEqualEncounterTable(AMAZON_FISH_IDS);
