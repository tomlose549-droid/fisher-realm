// Classic script, freshly loaded before any game modules or import map resolution.
(async()=>{
  try{
    if(!HTMLScriptElement.supports?.('importmap'))throw new Error('请使用支持模块映射的最新 Chrome 或 Edge。');
    const base=new URL('./',document.baseURI);
    const manifestUrl=new URL('package.json',base);
    manifestUrl.searchParams.set('check',Date.now()+'-'+Math.random().toString(36).slice(2));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    let manifest;
    try{
      const response=await fetch(manifestUrl,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('版本清单请求失败：'+response.status);
      manifest=await response.json();
    }finally{clearTimeout(timer);}
    if(typeof manifest.version!=='string'||!/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i.test(manifest.version))throw new Error('版本号无效。');
    const release=manifest.fisherRealm;
    if(!release||!Array.isArray(release.modules)||!release.modules.includes('main.js')||!Array.isArray(release.styles)||!release.styles.length||!Array.isArray(release.preloadImages))throw new Error('版本资源清单无效。');
    const localPath=path=>{
      if(typeof path!=='string'||!path||path.startsWith('/')||path.includes('..')||/[\\:?#]/.test(path))throw new Error('资源路径无效。');
      const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new Error('资源路径超出游戏目录。');return url;
    };
    // Validate the whole manifest before installing any release state.
    for(const path of [...release.modules,...release.styles,...release.preloadImages])localPath(path);
    const assetUrl=path=>{const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw new Error('资源路径超出游戏目录。');url.searchParams.set('v',manifest.version);return url.href;};
    globalThis.fisherRelease=Object.freeze({version:manifest.version,assetUrl});
    document.querySelector('#game-version').textContent='V'+manifest.version;
    const imports=Object.fromEntries(release.modules.map(path=>[localPath(path).href,assetUrl(path)]));
    const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
    // Do not start rendering until the versioned stylesheet is available.
    await Promise.all(release.styles.map(path=>new Promise((resolve,reject)=>{
      const link=document.createElement('link');link.rel='stylesheet';link.href=assetUrl(path);
      const timeout=setTimeout(()=>reject(new Error('样式加载超时。')),30000);
      link.onload=()=>{clearTimeout(timeout);resolve();};link.onerror=()=>{clearTimeout(timeout);reject(new Error('样式加载失败。'));};document.head.append(link);
    })));
    document.querySelector('#bootstrap-style')?.remove();
    for(const path of release.preloadImages){const link=document.createElement('link');link.rel='preload';link.as='image';link.href=assetUrl(path);link.fetchPriority='low';document.head.append(link);}
    await import('./main.js');
  }catch(error){console.error(error);showGameError('加载游戏失败，请检查网络后重新加载。详情：'+error.message);}
})();
