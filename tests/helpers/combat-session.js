import {FishingSession as CoreSession} from '../../fishing-rules.js';
// Combat regression clocks stay independent from the production three-rod waiting schedule.
export class CombatSession extends CoreSession{constructor(random,options={}){super(random,{...options,timing:{minWait:6,maxWait:13,hookWindow:1.45}});}}
