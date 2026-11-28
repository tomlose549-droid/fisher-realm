import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from '../vendor/addons/loaders/KTX2Loader.js';
import {HDRLoader} from '../vendor/addons/loaders/HDRLoader.js';
import {ResourceScope,ownTree} from './resources.js';
import {assetUrl} from '../release-assets.js';
export class Assets{
 constructor(renderer,progress=()=>{}){this.renderer=renderer;this.progress=progress;this.scope=new ResourceScope();this.cache=new Map();this.textureCache=new Map();this.controller=new AbortController();this.closed=false;this.pending=0;this.done=0;const base=new URL('../',import.meta.url);this.manager=new THREE.LoadingManager();this.manager.setURLModifier(url=>{if(/^(data|blob):/.test(url))return url;const resolved=new URL(url,base);if(resolved.origin!==base.origin||!resolved.pathname.startsWith(base.pathname))throw Error('地图素材超出本地资源目录');return assetUrl(decodeURIComponent(resolved.pathname.slice(base.pathname.length)));});this.ktx=new KTX2Loader(this.manager).setTranscoderPath(new URL('../vendor/addons/libs/basis/',import.meta.url).href).setWorkerLimit(2).detectSupport(renderer);
 const load=this.ktx.load.bind(this.ktx);this.ktx.load=(url,onLoad,onProgress,onError)=>{const key=new URL(url,location.href).href;if(!this.textureCache.has(key))this.textureCache.set(key,new Promise((resolve,reject)=>load(url,resolve,onProgress,reject)));this.textureCache.get(key).then(onLoad,onError);};
 this.gltf=new GLTFLoader(this.manager).setKTX2Loader(this.ktx);}
 async manifest(){const response=await fetch(assetUrl('map-assets/summer-pond/manifest.json'),{signal:this.controller.signal});if(!response.ok)throw Error('素材清单加载失败');return response.json();}
 async load(key,fn){if(this.closed)throw new DOMException('Disposed','AbortError');if(!this.cache.has(key)){this.pending++;this.progress(key,this.done,this.pending);this.cache.set(key,(async()=>{const result=await fn(),owner=this.closed?new ResourceScope():this.scope;if(result?.scene)ownTree(owner,result.scene);else owner.own(result);if(this.closed){owner.dispose();throw new DOMException('Disposed','AbortError');}this.done++;this.progress(key,this.done,this.pending);return result;})());}return this.cache.get(key);}
 async model(manifest,id,lod){const spec=manifest.models.find(m=>m.id===id);if(!spec)throw Error('Unknown asset: '+id);const url=assetUrl(spec.lods[lod].file);return this.load(url,async()=>{const r=await fetch(url,{signal:this.controller.signal});if(!r.ok)throw Error(`${r.status}: ${url}`);const gltf=await this.gltf.parseAsync(await r.arrayBuffer(),new URL('.',url).href);gltf.scene.updateMatrixWorld(true);return gltf;});}
 async texture(url){return this.load(url,()=>this.ktx.loadAsync(assetUrl(url)));}
 async environment(url){return this.load(url,()=>new HDRLoader(this.manager).loadAsync(assetUrl(url)));}
 async material(spec){const entries=await Promise.all(Object.entries(spec).map(async([key,v])=>[key,await this.texture(v.file)]));const values=Object.fromEntries(entries);for(const t of Object.values(values)){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());}return this.scope.own(new THREE.MeshStandardMaterial({...values,roughness:.92,normalScale:new THREE.Vector2(.55,.55),aoMapIntensity:.65}));}
 dispose(){if(this.closed)return;this.closed=true;this.controller.abort();this.ktx.dispose();this.scope.dispose();this.cache.clear();this.textureCache.clear();}
}
