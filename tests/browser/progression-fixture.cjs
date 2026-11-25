// Explicit preconditions for scene/stock suites; never applied to fresh-save or quest suites.
const mapProgress={version:1,main:{completed:7,rewarded:7,count:0},side1:{completed:0,rewarded:0,count:0},side2:{completed:2,rewarded:2,count:0}};
function withMapAccess(saved){const data=structuredClone(saved);data.storage??={version:1,coins:0};data.storage.quests??={version:1,mainCompleted:0,counts:[0,0],side1Done:false};data.storage.quests.shop=structuredClone(mapProgress);return data;}
module.exports={mapProgress,withMapAccess};
