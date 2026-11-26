import {createEncounterTable} from '../fish-encounters.js';

// User-confirmed base odds: these five cave species share 100%; tilapia is disabled here.
export const SAC_ACTUN_PROBABILITIES=Object.freeze([
  Object.freeze({id:'TILAPIA',percent:0}),
  Object.freeze({"id":"MEXICAN_BLINDFISH","percent":20}),
  Object.freeze({"id":"YUCATAN_BLIND_SWAMP_EEL","percent":20}),
  Object.freeze({"id":"MITCHELL_CAVE_SHRIMP","percent":20}),
  Object.freeze({"id":"MO_CAVE_SHRIMP","percent":20}),
  Object.freeze({"id":"YUCATAN_MOSQUITOFISH","percent":20}),
]);
export const SAC_ACTUN_ENCOUNTERS=createEncounterTable(SAC_ACTUN_PROBABILITIES,{requireAll:false});
