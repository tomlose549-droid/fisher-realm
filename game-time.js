export class GameTime{
  constructor(raw=()=>performance.now()/1000){this.raw=raw;this.offset=0;this.pausedAt=null;}
  now(raw=this.raw()){return (this.pausedAt??raw)-this.offset;}
  get paused(){return this.pausedAt!==null;}
  pause(){if(!this.paused)this.pausedAt=this.raw();}
  resume(){if(this.paused){this.offset+=this.raw()-this.pausedAt;this.pausedAt=null;}}
}
