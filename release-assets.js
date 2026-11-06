// The browser bootstrap owns the release version; Node rule tests need no bootstrap.
export function releaseVersion(){return globalThis.fisherRelease?.version??null;}
export function assetUrl(path){return globalThis.fisherRelease?.assetUrl(path)??new URL(path,import.meta.url).href;}
