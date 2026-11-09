import {SUMMER_POND_ENCOUNTERS} from '../../maps/summer-pond-fish.js';
export function unitForFish(fish,position=.5){const range=SUMMER_POND_ENCOUNTERS.ranges.find(r=>r.profile.name===fish.name);if(!range)throw Error('Unconfigured fish');return (range.start+range.units*position)/10000;}
