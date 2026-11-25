function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const SAC_ACTUN=freeze({
 id:'sac-actun',name:'墨西哥·萨克阿克通水下洞穴系统',
 spawn:{position:[-23.8,1.85,22.5],yaw:-.45,pitch:.015},
 water:{level:0,center:[0,-15],radii:[40,49],ledge:[[-34,29],[-23,27],[-23,20],[-25,15],[-31,12]]},
 environment:{background:'#bad4c0',fog:{color:'#173b40',near:48,far:135},exposure:1.05},
 quality:{fine:{reflection:[768,480],reflectionEvery:3},fast:{reflection:[448,280],reflectionEvery:5}},
 labels:{spot:'洞穴岩岸',weather:'洞顶透光',breeze:'静水幽蓝',castHint:'请面向洞穴水面，再按空格抛竿',reset:'已回到洞穴岩岸钓位'},
 landmarks:{tree:[4,0,-25],opening:[6,29,-20],submergedLogs:[{from:[-18,-1.1,12],to:[9,-.7,-4],radius:.45},{from:[-20,-1.5,4],to:[-3,-1.8,-9],radius:.28},{from:[-4,-2.1,12],to:[16,-1.2,5],radius:.23}]}
});
export function cenoteShorePoint(angle,scale=1,water=SAC_ACTUN.water){
 const shape=1+.028*Math.sin(angle*5+.4)+.015*Math.cos(angle*9),[cx,cz]=water.center,[rx,rz]=water.radii;
 return [cx+Math.cos(angle)*rx*shape*scale,water.level,cz+Math.sin(angle)*rz*shape*scale];
}
// Only the enclosing shore is solid. Roots, submerged wood and rocks are visual.
export function isSacActunWater(x,z,margin=1,water=SAC_ACTUN.water){
 const ledge=water.ledge;if(ledge){let inside=false;for(let i=0,j=ledge.length-1;i<ledge.length;j=i++){const [xi,zi]=ledge[i],[xj,zj]=ledge[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}if(inside)return false;}
 const nx=(x-water.center[0])/water.radii[0],nz=(z-water.center[1])/water.radii[1],a=Math.atan2(nz,nx);
 return Math.hypot(nx,nz)<(1+.028*Math.sin(a*5+.4)+.015*Math.cos(a*9))*margin;
}
