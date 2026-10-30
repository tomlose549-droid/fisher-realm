// Meters, radians, monotonic seconds; resource ticks are independent of rendering.
export const FISHING=Object.freeze({distance:23,flight:.8,minWait:6,maxWait:13,hookWindow:1.45,baseSpeed:3.75,catchDistance:1.25,recastDelay:.8,noticeDelay:.3,noticeFadeAt:4.5,noticeFadeDuration:.6,maxDistance:50,landGraceDistance:10,lineMaximum:100,regenDelay:.95,regenInterval:.1,regenAmount:2.5});
export const TILAPIA=Object.freeze({name:'罗非鱼',strength:Object.freeze({amount:3,interval:.2}),restDuration:3.3,speed:4.2,stamina:44,struggle:Object.freeze({minAngle:32,maxAngle:42,firstDuration:3.9,secondDuration:3.4}),specials:Object.freeze([])});
export const BLUEGILL=Object.freeze({name:'蓝鳃太阳鱼',strength:Object.freeze({amount:2,interval:.11}),restDuration:4.2,speed:5.6,stamina:56,struggle:Object.freeze({minAngle:35,maxAngle:41,durations:Object.freeze([3,.9,1.6,4.2])}),specials:Object.freeze([])});
export const REDEAR=Object.freeze({name:'红耳太阳鱼',catchColor:'#90ee90',strength:Object.freeze({amount:3,interval:.13}),restDuration:4.2,speed:5.5,stamina:45,struggle:Object.freeze({minAngle:56,maxAngle:63,durations:Object.freeze([1.9,1,1.4,3])}),specials:Object.freeze([])});
export const BLACKBERRY_BASS=Object.freeze({name:'黑莓鲈',catchColor:'#ffffff',strength:Object.freeze({amount:3,interval:.23}),restDuration:5,speed:5,stamina:42,struggle:Object.freeze({minAngle:45,maxAngle:63,durations:Object.freeze([3.5,3.5,3.4]),switchPause:.3}),specials:Object.freeze(['换边前停顿0.3秒'])});
export const GOLDEN_SHINER=Object.freeze({name:'金色闪光鲦',catchColor:'#4c9fff',strength:Object.freeze({amount:1,interval:.15}),restDuration:4.9,speed:6.2,stamina:75,struggle:Object.freeze({minAngle:52,maxAngle:63,durations:Object.freeze([4])}),specials:Object.freeze([])});
export const FISH_SPECIES=Object.freeze([TILAPIA,BLUEGILL,REDEAR,BLACKBERRY_BASS,GOLDEN_SHINER]);
export function pickFish(unit){return FISH_SPECIES[Math.min(FISH_SPECIES.length-1,Math.max(0,Math.floor(unit*FISH_SPECIES.length)))];}
const PHASES=['first','second','third','fourth'];
const EPS=1e-9,STEP=.01;
export function signedAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
export function reelEfficiency(a){a=Math.abs(a);return a<=3+EPS?1.2:a<=30+EPS?1:a<=90+EPS?.75:.2;}
const DRAIN=[Object.freeze({interval:.25,amount:3}),Object.freeze({interval:.25,amount:1}),Object.freeze({interval:.2,amount:.5})];
export function staminaDrain(a){a=Math.abs(a);return a<=25+EPS?DRAIN[0]:a<=75+EPS?DRAIN[1]:DRAIN[2];}
export function durabilityTier(v){return v<=5?'red':v<=20?'orange':v<=60?'yellow':'normal';}
export const LINE_COLORS=Object.freeze({normal:'#e4e9d5',yellow:'#e7cc4e',orange:'#ef943d',red:'#f05b50'});
function circleCrossing(x,z,dx,dz,r,entering){
  const a=dx*dx+dz*dz;if(a<EPS*EPS)return null;
  const b=2*(x*dx+z*dz),c=x*x+z*z-r*r,d=b*b-4*a*c;if(d<0)return null;
  for(const u of[(-b-Math.sqrt(d))/(2*a),(-b+Math.sqrt(d))/(2*a)])
    if(u>=-EPS&&u<=1+EPS&&((x+dx*u)*dx+(z+dz*u)*dz)*(entering?1:-1)<0)return Math.max(0,Math.min(1,u));
  return null;
}
export class FishingSession{
  constructor(random=Math.random,{fish=TILAPIA,randomSpecies=false,player={x:0,z:0},isWater=()=>true}={}){
    this.random=random;this.randomSpecies=randomSpecies;this.profile=fish;this.player={x:player.x,z:player.z};this.isWater=isWater;
    this.phaseIndex=0;this.lastCatchName=null;this.lastCatchColor='#d3d3d3';
    this.forcedFish=null;this.forcedRemaining=0;this.forcedCastFish=null;
    this.state='idle';this.fishX=player.x;this.fishZ=player.z;this.castYaw=0;this.rodYaw=0;
    this.reeling=false;this.lastTime=null;this.castAt=null;this.biteAt=null;this.hookDeadline=null;this.catchAt=null;this.lastCatchAt=null;
    this.catches=0;this.outcome=null;this.failure=null;this.events=[];
    this.durability=100;this.fishStamina=fish.stamina;this.fishPhase=null;this.phaseEndsAt=Infinity;this.round=0;this.roundYaw=0;this.phaseSide=0;this.struggleYaw=0;
    this.damageClock=0;this.staminaClock=0;this.lastDamageAt=null;this.nextRegenAt=Infinity;
  }
  get distance(){return Math.hypot(this.fishX-this.player.x,this.fishZ-this.player.z);}
  get fishYaw(){return this.distance>EPS?Math.atan2(this.player.x-this.fishX,this.player.z-this.fishZ):this.castYaw;}
  get angle(){return Math.abs(signedAngle(this.rodYaw-this.fishYaw))*180/Math.PI;}
  get struggleAngle(){return this.struggling?Math.abs(signedAngle(this.rodYaw-this.struggleYaw))*180/Math.PI:null;}
  get efficiency(){return reelEfficiency(this.angle);}
  get speed(){return FISHING.baseSpeed*this.efficiency;}
  get active(){return this.state!=='idle';}
  get struggling(){return PHASES.includes(this.fishPhase);}
  get struggleDurations(){const s=this.profile.struggle;return s.durations??[s.firstDuration,s.secondDuration];}
  randomUnit(){return Math.max(0,Math.min(1,this.random()));}
  get ownerState(){return {fishName:this.forcedFish?.name??null,remaining:this.forcedRemaining};}
  setForcedFish(name){
    const fish=FISH_SPECIES.find(f=>f.name===name);
    if(this.state!=='idle'||!fish)return false;
    this.forcedFish=fish;this.forcedRemaining=10;return true;
  }
  cast(now,yaw){
    this.advance(now);if(this.state!=='idle')return false;
    this.forcedCastFish=this.forcedRemaining>0?this.forcedFish:null;
    if(this.forcedCastFish)this.profile=this.forcedCastFish;
    else if(this.randomSpecies)this.profile=pickFish(this.randomUnit());
    this.state='casting';this.castYaw=yaw;this.rodYaw=yaw;
    this.fishX=this.player.x-Math.sin(yaw)*FISHING.distance;this.fishZ=this.player.z-Math.cos(yaw)*FISHING.distance;
    this.castAt=now;this.biteAt=now+FISHING.minWait+this.randomUnit()*(FISHING.maxWait-FISHING.minWait);this.hookDeadline=this.biteAt+FISHING.hookWindow;
    this.catchAt=null;this.reeling=false;this.outcome=null;this.failure=null;
    this.durability=100;this.fishStamina=this.profile.stamina;this.fishPhase=null;this.phaseEndsAt=Infinity;this.round=0;
    this.damageClock=0;this.staminaClock=0;this.lastDamageAt=null;this.nextRegenAt=Infinity;
    this.events.push({type:'cast',at:now});return true;
  }
  hook(now){this.advance(now);if(this.state!=='bite')return false;this.state='fighting';this.reeling=false;this.beginRound(now);this.events.push({type:'hooked',at:now});return true;}
  beginRound(t){
    if(this.fishStamina<=EPS){this.fishStamina=0;this.fishPhase='exhausted';this.phaseEndsAt=Infinity;return;}
    this.round++;this.roundYaw=this.fishYaw;this.phaseSide=this.randomUnit()<.5?1:-1;
    this.phaseIndex=0;this.fishPhase=PHASES[0];this.chooseDirection();this.phaseEndsAt=t+this.struggleDurations[0];
  }
  // Species angles start at the left/right lateral axis and turn toward forward.
  chooseDirection(){const s=this.profile.struggle,sideAngle=s.minAngle+this.randomUnit()*(s.maxAngle-s.minAngle);this.struggleYaw=this.roundYaw+this.phaseSide*(90-sideAngle)*Math.PI/180;}
  nextLeg(t){this.fishPhase=PHASES[this.phaseIndex];this.phaseSide*=-1;this.chooseDirection();this.phaseEndsAt=t+this.struggleDurations[this.phaseIndex];}
  transition(t){
    while(this.state==='fighting'&&t>=this.phaseEndsAt-EPS){
      const end=this.phaseEndsAt;
      if(this.struggling){
        this.phaseIndex++;
        if(this.phaseIndex<this.struggleDurations.length){
          const pause=this.profile.struggle.switchPause||0;
          if(pause>0){this.fishPhase='switch-pause';this.phaseEndsAt=end+pause;}
          else this.nextLeg(end);
        }
        else{this.fishPhase='rest';this.phaseEndsAt=end+this.profile.restDuration;}
      }
      else if(this.fishPhase==='switch-pause')this.nextLeg(end);
      else if(this.fishPhase==='rest')this.beginRound(end);else break;
    }
  }
  setRodYaw(yaw,now){this.advance(now);if(this.state==='fighting')this.rodYaw=yaw;}
  setReeling(v,now){this.advance(now);this.reeling=v&&this.state==='fighting';}
  restore(t){
    if(this.durability>=100-EPS){this.durability=100;this.nextRegenAt=Infinity;return;}
    if(t+EPS<this.nextRegenAt)return;
    const n=Math.floor((t-this.nextRegenAt+EPS)/FISHING.regenInterval)+1;
    this.durability=Math.min(100,this.durability+n*FISHING.regenAmount);this.nextRegenAt+=n*FISHING.regenInterval;
    if(this.durability===100)this.nextRegenAt=Infinity;
  }
  fail(reason,t){
    this.failure={reason,at:t,distance:this.distance,position:{x:this.fishX,z:this.fishZ}};
    this.state='idle';this.reeling=false;this.outcome=reason;this.fishPhase=null;this.phaseEndsAt=Infinity;
    this.fishX=this.player.x;this.fishZ=this.player.z;this.events.push({type:reason==='missed'?'missed':'failed',reason,at:t});
  }
  caught(t){
    if(this.forcedCastFish&&this.forcedCastFish===this.forcedFish){
      this.forcedRemaining--;if(this.forcedRemaining===0)this.forcedFish=null;
      this.forcedCastFish=null;
    }
    this.lastCatchName=this.profile.name;this.lastCatchColor=this.profile.catchColor||'#d3d3d3';
    const d=this.distance;this.fishX=this.player.x+(this.fishX-this.player.x)*FISHING.catchDistance/d;this.fishZ=this.player.z+(this.fishZ-this.player.z)*FISHING.catchDistance/d;
    this.catchAt=t;this.lastCatchAt=t;this.state='caught';this.reeling=false;this.catches++;this.outcome='caught';this.fishPhase=null;this.phaseEndsAt=Infinity;this.events.push({type:'caught',at:t});
  }
  move(dt){
    const x=this.fishX-this.player.x,z=this.fishZ-this.player.z,d=Math.hypot(x,z);
    let vx=0,vz=0;if(this.struggling){vx=-Math.sin(this.struggleYaw)*this.profile.speed;vz=-Math.cos(this.struggleYaw)*this.profile.speed;}
    if(this.reeling){const speed=this.speed;vx-=x/d*speed;vz-=z/d*speed;}
    const dx=vx*dt,dz=vz*dt,nd=Math.hypot(x+dx,z+dz);let event=null,fraction=1;
    if(nd<=FISHING.catchDistance+EPS&&this.reeling){event='caught';fraction=circleCrossing(x,z,dx,dz,FISHING.catchDistance,true)??1;}
    if(nd>FISHING.maxDistance+EPS){const u=circleCrossing(x,z,dx,dz,FISHING.maxDistance,false)??1;if(u<=fraction){event='escaped';fraction=u;}}
    const isLand=u=>Math.hypot(x+dx*u,z+dz*u)>FISHING.landGraceDistance+EPS&&!this.isWater(this.player.x+x+dx*u,this.player.z+z+dz*u);
    if(isLand(1)){let low=0,high=1;for(let i=0;i<26;i++){const mid=(low+high)/2;if(isLand(mid))high=mid;else low=mid;}if(high<=fraction){event='landed';fraction=high;}}
    this.fishX+=dx*fraction;this.fishZ+=dz*fraction;return {event,fraction};
  }
  simulate(from,to){
    let cursor=from;
    while(this.state==='fighting'&&cursor<to-EPS){
      this.transition(cursor);
      if(this.fishPhase==='exhausted'&&!this.reeling){this.restore(to);break;}
      const active=this.struggling&&this.reeling,band=active?staminaDrain(this.struggleAngle):null;
      let dt=Math.min(STEP,to-cursor,this.phaseEndsAt-cursor);
      if(active)dt=Math.min(dt,this.profile.strength.interval-this.damageClock,(1-this.staminaClock)*band.interval);
      if(this.nextRegenAt>cursor+EPS)dt=Math.min(dt,this.nextRegenAt-cursor);else this.restore(cursor);
      if(dt<EPS)dt=Math.min(STEP,to-cursor);
      const result=this.move(dt);dt*=result.fraction;cursor+=dt;
      if(active){this.damageClock+=dt;this.staminaClock+=dt/band.interval;}
      if(result.event){if(result.event==='caught')this.caught(cursor);else this.fail(result.event,cursor);break;}
      if(active&&this.damageClock>=this.profile.strength.interval-EPS){
        this.damageClock=Math.max(0,this.damageClock-this.profile.strength.interval);
        this.durability=Math.max(0,this.durability-this.profile.strength.amount);this.lastDamageAt=cursor;this.nextRegenAt=cursor+FISHING.regenDelay;
        if(this.durability<=EPS){this.durability=0;this.fail('line-broken',cursor);break;}
      }
      if(active&&this.staminaClock>=1-EPS){
        this.staminaClock=Math.max(0,this.staminaClock-1);this.fishStamina=Math.max(0,this.fishStamina-band.amount);
        if(this.fishStamina<=EPS){this.fishStamina=0;this.fishPhase='exhausted';this.phaseEndsAt=Infinity;this.events.push({type:'exhausted',at:cursor});}
      }
      this.restore(cursor);
    }
    if(this.state==='fighting')this.transition(to);
  }
  advance(now){
    if(this.lastTime!==null&&now<this.lastTime)return;
    const previous=this.lastTime??now;this.lastTime=now;
    if(this.state==='casting'&&now>=this.castAt+FISHING.flight)this.state='waiting';
    if(this.state==='waiting'&&now>=this.biteAt){this.state='bite';this.events.push({type:'bite',at:this.biteAt});}
    if(this.state==='bite'&&now>this.hookDeadline)this.fail('missed',this.hookDeadline);
    if(this.state==='fighting')this.simulate(previous,now);else this.restore(now);
    if(this.state==='caught'&&now>=this.catchAt+FISHING.recastDelay){this.state='idle';this.fishX=this.player.x;this.fishZ=this.player.z;this.events.push({type:'ready',at:this.catchAt+FISHING.recastDelay});}
  }
  noticeOpacity(now){if(this.lastCatchAt===null)return 0;const age=now-this.lastCatchAt;if(age<FISHING.noticeDelay)return 0;if(age<FISHING.noticeFadeAt)return 1;return Math.max(0,1-(age-FISHING.noticeFadeAt)/FISHING.noticeFadeDuration);}
  drainEvents(){const e=this.events;this.events=[];return e;}
  snapshot(now){return {ownerMode:this.ownerState,fishName:this.profile.name,lastCatchName:this.lastCatchName,lastCatchColor:this.lastCatchColor,phaseIndex:this.phaseIndex,state:this.state,distance:this.distance,rodYaw:this.rodYaw,fishYaw:this.fishYaw,castYaw:this.castYaw,fishPosition:{x:this.fishX,z:this.fishZ},angle:this.angle,efficiency:this.efficiency,speed:this.speed,reeling:this.reeling,castAt:this.castAt,biteAt:this.biteAt,hookDeadline:this.hookDeadline,catchAt:this.catchAt,lastCatchAt:this.lastCatchAt,catches:this.catches,outcome:this.outcome,failure:this.failure,noticeOpacity:this.noticeOpacity(now),durability:this.durability,durabilityTier:durabilityTier(this.durability),lineColor:LINE_COLORS[durabilityTier(this.durability)],fishStamina:this.fishStamina,fishStaminaMaximum:this.profile.stamina,fishPhase:this.fishPhase,phaseSide:this.phaseSide,phaseRemaining:Number.isFinite(this.phaseEndsAt)?Math.max(0,this.phaseEndsAt-now):null,round:this.round,roundYaw:this.roundYaw,struggleYaw:this.struggling?this.struggleYaw:null,struggleAngle:this.struggleAngle,lastDamageAt:this.lastDamageAt,nextRegenAt:Number.isFinite(this.nextRegenAt)?this.nextRegenAt:null};}
}
