import {createEncounterTable} from '../fish-encounters.js';

// Absolute percentages of all normal casts in summer-pond, not percentages within a quality.
export const SUMMER_POND_PROBABILITIES=Object.freeze([
  Object.freeze({"id":"LEOPARD_PLECO","percent":7}),
  Object.freeze({"id":"TILAPIA","percent":15}),
  Object.freeze({"id":"NILE_TILAPIA","percent":14}),
  Object.freeze({"id":"COMMON_CARP","percent":9}),
  Object.freeze({"id":"BLACKBERRY_BASS","percent":16}),
  Object.freeze({"id":"EUROPEAN_PERCH","percent":7}),
  Object.freeze({"id":"REDEAR","percent":3}),
  Object.freeze({"id":"GRASS_CARP","percent":6}),
  Object.freeze({"id":"BLUEGILL","percent":2.5}),
  Object.freeze({"id":"WHITE_CATFISH","percent":3}),
  Object.freeze({"id":"MAYAN_CICHLID","percent":3.5}),
  Object.freeze({"id":"YELLOW_BULLHEAD","percent":3}),
  Object.freeze({"id":"CHANNEL_CATFISH","percent":1.5}),
  Object.freeze({"id":"OSCAR","percent":2}),
  Object.freeze({"id":"AMERICAN_EEL","percent":0.9}),
  Object.freeze({"id":"WALKING_CATFISH","percent":0.3}),
  Object.freeze({"id":"LAKE_SUCKER","percent":0.3}),
  Object.freeze({"id":"GOLDEN_SHINER","percent":0.7}),
  Object.freeze({"id":"LARGEMOUTH_BASS","percent":0.9}),
  Object.freeze({"id":"BOWFIN","percent":0.9}),
  Object.freeze({"id":"AFRICAN_JEWEL_CICHLID","percent":1}),
  Object.freeze({"id":"REDFIN_PICKEREL","percent":0.3}),
  Object.freeze({"id":"JACK_DEMPSEY","percent":0.7}),
  Object.freeze({"id":"PEACOCK_BASS","percent":0.5}),
  Object.freeze({"id":"CHAIN_PICKEREL","percent":0.2}),
  Object.freeze({"id":"FLORIDA_GAR","percent":0.5}),
  Object.freeze({"id":"LONGNOSE_GAR","percent":0.3}),
]);
export const SUMMER_POND_ENCOUNTERS=createEncounterTable(SUMMER_POND_PROBABILITIES);
