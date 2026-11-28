export class ResourceScope{
 constructor(){this.resources=new Set();this.closed=false;}
 own(value){if(value){if(this.closed){value.dispose?.();throw Error('Resource scope already closed');}this.resources.add(value);}return value;}
 dispose(){if(this.closed)return;this.closed=true;for(const r of this.resources){r.dispose?.();if(r.isTexture)r.source?.data?.close?.();}this.resources.clear();}
}
export function ownTree(scope,root){root.traverse(o=>{if(o.geometry)scope.own(o.geometry);if(o.isInstancedMesh)scope.own(o);for(const m of [].concat(o.material??[])){scope.own(m);for(const v of Object.values(m))if(v?.isTexture)scope.own(v);}});return root;}
