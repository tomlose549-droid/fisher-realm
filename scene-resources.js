// Scope owns only its root and explicit targets, never the shared renderer/camera.
export function createResourceScope(root,{targets=[],shared=new Set()}={}){
  let disposed=false;
  return {get disposed(){return disposed;},dispose(){
    if(disposed)return;disposed=true;
    const geometries=new Set(),materials=new Set(),textures=new Set(),instances=new Set(),shadows=new Set();
    const renderTargets=new Set(targets),targetTextures=new Set();
    for(const target of renderTargets)for(const texture of target.textures??[target.texture])targetTextures.add(texture);
    function texture(value){if(Array.isArray(value))value.forEach(texture);else if(value?.isTexture&&!shared.has(value)&&!targetTextures.has(value))textures.add(value);}
    root.traverse(object=>{
      if(object.geometry&&!shared.has(object.geometry))geometries.add(object.geometry);
      for(const material of [].concat(object.material??[]))if(!shared.has(material)){
        materials.add(material);Object.values(material).forEach(texture);
        for(const uniform of Object.values(material.uniforms??{}))texture(uniform.value);
      }
      if(object.isInstancedMesh)instances.add(object);
      if(object.shadow)shadows.add(object.shadow);
    });
    instances.forEach(instance=>instance.dispose());shadows.forEach(shadow=>shadow.dispose());
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    renderTargets.forEach(target=>{if(!shared.has(target))target.dispose();});
    root.removeFromParent();root.clear();
  }};
}
