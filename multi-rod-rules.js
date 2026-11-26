import {FishingSession,FISHING} from './fishing-rules.js';
import {FISH_DATA,FISH_CATALOG,FISH_QUALITIES} from './fish-data.js';

export const MULTI_ROD=Object.freeze({maxRods:3,minWait:15,maxWait:60,hookWindow:3.7,guaranteeLimit:24,guaranteeMin:20,guaranteeMax:24,netWindow:10,scoopDuration:.7,netStruggleDuration:2.6,netStruggleChance:.4});
const unit=random=>Math.max(0,Math.min(1,random()));
export function trailScale(speed){return speed>=10?1.8:speed>=6?1.35:1;}
export function hookScale(name){const item=FISH_CATALOG.items[name],area=item?item.w*item.h:1;return area>=8?1.9:area>=4?1.45:1;}
export function mustStruggleInNet(name){const fish=FISH_DATA.find(f=>f.name===name);return !!fish&&FISH_QUALITIES.indexOf(fish.quality)>=FISH_QUALITIES.indexOf('red');}

// Waiting rods own independent timers and snapshots; only the selected rod owns a fight/wear transaction.
export class ThreeRodSession{
 constructor({random=Math.random,player={x:0,z:0},isWater=()=>true,fishPool,encounters,ownerState={fishName:null,remaining:0},prepareCast=()=>({ok:true}),beginFight=()=>({ok:true}),finishFight=()=>({ok:true})}={}){
  Object.assign(this,{random,player,isWater,fishPool,encounters,prepareCast,beginFight,finishFight});
  this.rods=[];this.selected=null;this.net=null;this.events=[];this.nextCastAt=-Infinity;this.sequence=0;this.batch=null;this.freeCasts=0;this.owner={...ownerState};this.lastCatchName=null;this.lastCatchColor='#808080';this.lastCatchAt=null;this.catches=0;this.session=this.createSession();
 }
 createSession(){const s=new FishingSession(this.random,{randomSpecies:true,player:this.player,isWater:this.isWater,fishPool:this.fishPool,encounters:this.encounters,requireNet:true,timing:MULTI_ROD});s.restoreOwnerState(this.owner);return s;}
 get state(){if(this.net)return this.net.state;if(this.selected)return this.session.state;if(!this.rods.length)return 'idle';if(this.rods.some(r=>r.session.state==='bite'))return 'bite';if(this.rods.some(r=>r.session.state==='casting'))return 'casting';return 'waiting';}
 get active(){return !!this.selected||this.rods.length>0;}
 get ownerState(){return {...this.owner};}
 setForcedFish(name){if(this.active)return false;const fish=FISH_DATA.find(f=>f.name===name);if(!fish)return false;this.owner={fishName:name,remaining:10};return true;}
 emit(type,at,extra={}){this.events.push({type,at,...extra});}
 drainEvents(){return this.events.splice(0);}
 cast(now,yaw){
  this.advance(now);if(this.selected||this.rods.length>=3||now<this.nextCastAt)return {ok:false};
  const free=this.rods.length>0&&this.batch&&this.freeCasts>0,reuse=free?this.batch:null;
  const prepared=this.prepareCast({forced:this.owner.remaining>0,deferWear:true,reuse});if(!prepared?.ok)return prepared??{ok:false};
  const empty=this.rods.length===0,slot=[0,1,2].find(i=>!this.rods.some(r=>r.slot===i)),s=this.createSession();
  s.cast(now,yaw,{encounters:prepared.encounters??this.encounters,equipment:prepared.equipment});
  const rod={id:++this.sequence,slot,session:s,lure:prepared.lure??null,prepared};this.rods.push(rod);this.session=s;this.nextCastAt=now+FISHING.flight;
  if(empty){this.batch=prepared;this.freeCasts=2;}else if(free)this.freeCasts--;
  this.collect(rod);this.ensureEarlyBite(now);this.advance(now);return {ok:true,id:rod.id,slot};
 }
 ensureEarlyBite(now){
  if(this.rods.length!==3||!this.rods.every(r=>['casting','waiting'].includes(r.session.state)&&r.session.biteAt-r.session.castAt>24))return;
  const rod=this.rods[Math.min(2,Math.floor(unit(this.random)*3))],delay=20+unit(this.random)*4;
  rod.session.biteAt=Math.max(now,rod.session.castAt+delay);rod.session.hookDeadline=rod.session.biteAt+3.7;this.emit('guaranteed',now,{rodId:rod.id,delay});
 }
 collect(rod){for(const event of rod.session.drainEvents()){
  if(event.type==='missed'){this.rods=this.rods.filter(r=>r!==rod);this.batch=null;this.freeCasts=0;}
  this.events.push({...event,rodId:rod.id,slot:rod.slot,session:rod.session});
 }}
 choose(slot,now){
  this.advance(now);if(this.selected)return {ok:false};const rod=this.rods.find(r=>r.slot===slot&&r.session.state==='bite');if(!rod)return {ok:false};
  const result=this.beginFight(rod.prepared);if(!result?.ok)return result??{ok:false};
  if(!rod.session.hook(now))throw Error('Selected bite lost its timestamp');
  this.selected=rod;this.session=rod.session;this.rods=[];this.batch=null;this.freeCasts=0;this.collect(rod);return {ok:true};
 }
 finish(outcome,at){const result=this.finishFight(outcome);this.emit('settled',at,{result});}
 failNet(reason,now){this.net=null;this.session.fail(reason,now);this.collectSelected();}
 complete(now){
  this.net=null;this.session.confirmCatch(now);this.owner=this.session.ownerState;this.catches++;this.lastCatchName=this.session.lastCatchName;this.lastCatchColor=this.session.lastCatchColor;this.lastCatchAt=now;this.collectSelected();
 }
 clickNet(now,hit=true){
  this.advance(now);if(!this.net)return false;
  if(this.net.state==='net-ready'&&hit){this.net={state:'net-scooping',startedAt:now,endsAt:now+.7};this.emit('scoop',now);return true;}
  if(this.net.state==='net-struggling'){this.complete(now);return true;}return false;
 }
 collectSelected(){
  const rod=this.selected;if(!rod)return;
  for(const e of this.session.drainEvents()){
   this.events.push({...e,rodId:rod.id,slot:rod.slot,session:this.session});
   if(e.type==='net-ready')this.net={state:'net-ready',startedAt:e.at,deadline:e.at+10};
   if(e.type==='caught')this.finish('caught',e.at);
   if(e.type==='failed'){this.finish(e.reason,e.at);this.selected=null;this.net=null;}
   if(e.type==='ready')this.selected=null;
  }
 }
 advance(now){
  if(this.selected){this.session.advance(now);this.collectSelected();
   if(this.net?.state==='net-ready'&&now>this.net.deadline)this.failNet('net-timeout',this.net.deadline);
   if(this.net?.state==='net-scooping'&&now>=this.net.endsAt){const at=this.net.endsAt;if(mustStruggleInNet(this.session.profile.name)||unit(this.random)<.4){this.net={state:'net-struggling',startedAt:at,deadline:at+2.6};this.emit('net-struggling',at);}else this.complete(at);}
   if(this.net?.state==='net-struggling'&&now>this.net.deadline)this.failNet('net-escaped',this.net.deadline);
  }else for(const rod of [...this.rods]){rod.session.advance(now);this.collect(rod);}
 }
 interrupt(now){this.advance(now);this.rods=[];this.batch=null;this.freeCasts=0;if(this.selected&&this.session.state!=='caught'){this.net=null;this.session.fail('interrupted',now);this.collectSelected();}else this.selected=null;}
 snapshot(now){return {time:now,...this.session.snapshot(now),state:this.state,catches:this.catches,lastCatchName:this.lastCatchName,lastCatchColor:this.lastCatchColor,lastCatchAt:this.lastCatchAt,noticeOpacity:this.lastCatchAt===null?0:(now-this.lastCatchAt<FISHING.noticeDelay?0:now-this.lastCatchAt<FISHING.noticeFadeAt?1:Math.max(0,1-(now-this.lastCatchAt-FISHING.noticeFadeAt)/FISHING.noticeFadeDuration)),ownerMode:this.ownerState,rods:this.rods.map(r=>({id:r.id,slot:r.slot,lure:r.lure,...r.session.snapshot(now)})),net:this.net?{...this.net}:null};}
}
