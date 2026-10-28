// Distances are meters, angles are radians and timestamps are monotonic seconds.
export const FISHING = Object.freeze({distance:23,flight:.8,minWait:6,maxWait:13,hookWindow:1.45,baseSpeed:3.75,catchDistance:1.25,recastDelay:.8,noticeDelay:.3,noticeFadeAt:4.5,noticeFadeDuration:.6});
export function signedAngle(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}
export function reelEfficiency(angleDegrees){
  const angle=Math.abs(angleDegrees),epsilon=1e-9;
  if(angle<=3+epsilon)return 1.2;
  if(angle<=30+epsilon)return 1;
  if(angle<=90+epsilon)return .75;
  return .2;
}

export class FishingSession {
  constructor(random=Math.random){
    this.random=random;this.state='idle';this.distance=0;this.rodYaw=0;this.fishYaw=0;
    this.reeling=false;this.lastTime=null;this.castAt=null;this.biteAt=null;
    this.hookDeadline=null;this.catchAt=null;this.lastCatchAt=null;this.catches=0;this.outcome=null;this.events=[];
  }
  get angle(){return Math.abs(signedAngle(this.rodYaw-this.fishYaw))*180/Math.PI;}
  get efficiency(){return reelEfficiency(this.angle);}
  get speed(){return FISHING.baseSpeed*this.efficiency;}
  get active(){return this.state!=='idle';}
  cast(now,yaw){
    this.advance(now);
    if(this.state!=='idle')return false;
    this.state='casting';this.distance=FISHING.distance;this.fishYaw=yaw;this.rodYaw=yaw;
    this.castAt=now;this.biteAt=now+FISHING.minWait+Math.max(0,Math.min(1,this.random()))*(FISHING.maxWait-FISHING.minWait);
    this.hookDeadline=this.biteAt+FISHING.hookWindow;this.catchAt=null;this.reeling=false;this.outcome=null;
    this.events.push({type:'cast',at:now});return true;
  }
  hook(now){
    this.advance(now);
    if(this.state!=='bite')return false;
    this.state='fighting';this.reeling=false;this.events.push({type:'hooked',at:now});return true;
  }
  setRodYaw(yaw,now){this.advance(now);if(this.state==='fighting')this.rodYaw=yaw;}
  setReeling(pressed,now){this.advance(now);this.reeling=pressed&&this.state==='fighting';}
  advance(now){
    if(this.lastTime!==null&&now<this.lastTime)return;
    const previous=this.lastTime??now;this.lastTime=now;
    if(this.state==='casting'&&now>=this.castAt+FISHING.flight)this.state='waiting';
    if(this.state==='waiting'&&now>=this.biteAt){this.state='bite';this.events.push({type:'bite',at:this.biteAt});}
    if(this.state==='bite'&&now>this.hookDeadline){
      this.state='idle';this.distance=0;this.reeling=false;this.outcome='missed';
      this.events.push({type:'missed',at:this.hookDeadline});
    }
    if(this.state==='fighting'&&this.reeling){
      const travel=Math.max(0,now-previous)*this.speed;
      if(travel>=this.distance-FISHING.catchDistance){
        this.catchAt=previous+(this.distance-FISHING.catchDistance)/this.speed;
        this.lastCatchAt=this.catchAt;this.distance=FISHING.catchDistance;
        this.state='caught';this.reeling=false;this.catches++;this.outcome='caught';
        this.events.push({type:'caught',at:this.catchAt});
      }else this.distance-=travel;
    }
    if(this.state==='caught'&&now>=this.catchAt+FISHING.recastDelay){
      this.state='idle';this.distance=0;this.events.push({type:'ready',at:this.catchAt+FISHING.recastDelay});
    }
  }
  noticeOpacity(now){
    if(this.lastCatchAt===null)return 0;
    const age=now-this.lastCatchAt;
    if(age<FISHING.noticeDelay)return 0;
    if(age<FISHING.noticeFadeAt)return 1;
    return Math.max(0,1-(age-FISHING.noticeFadeAt)/FISHING.noticeFadeDuration);
  }
  drainEvents(){const events=this.events;this.events=[];return events;}
  snapshot(now){return {state:this.state,distance:this.distance,rodYaw:this.rodYaw,fishYaw:this.fishYaw,angle:this.angle,efficiency:this.efficiency,speed:this.speed,reeling:this.reeling,castAt:this.castAt,biteAt:this.biteAt,hookDeadline:this.hookDeadline,catchAt:this.catchAt,lastCatchAt:this.lastCatchAt,catches:this.catches,outcome:this.outcome,noticeOpacity:this.noticeOpacity(now)};}
}
