import * as THREE from './vendor/three.module.js';

// All scenery is procedural geometry. No model, texture or network service is needed.
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a5c9c5');
scene.fog = new THREE.FogExp2('#b1ccbc', .0065);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .06, 650);
camera.position.set(0, 3.05, 40);
camera.rotation.order = 'YXZ';
scene.add(camera);
const hemi = new THREE.HemisphereLight('#d6e9ed', '#727c43', 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0cb', 3.0);
sun.position.set(-45, 68, -75);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 170 });
sun.target.position.set(0, 0, 27);
sun.shadow.bias = -.0006;
sun.shadow.normalBias = .04;
scene.add(sun, sun.target);

let seed = 42721;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + random() * (b - a);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .94, flatShading: true, ...extra });
const materials = {
  bark: mat('#65563d'), wood: mat('#b08753'), darkWood: mat('#765734'), metal: mat('#465353', { metalness: .65, roughness: .35 }),
  leaves: ['#4c714d', '#62834b', '#426447', '#779352'].map(c => mat(c)),
  pine: ['#244d43', '#325e48', '#406c50', '#527d56'].map(c => mat(c)),
  rocks: ['#969d86', '#7c8a7e', '#b5b59a'].map(c => mat(c)),
};
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
function mesh(geometry, material, parent, position, scale) {
  const item = new THREE.Mesh(geometry, material);
  if (position) item.position.set(...position);
  if (scale) item.scale.set(...scale);
  item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}
function box(parent, material, position, scale) { return mesh(boxGeometry, material, parent, position, scale); }
const Y = new THREE.Vector3(0, 1, 0);
function beam(parent, a, b, r1, r2, material, sides = 8) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
  const item = mesh(new THREE.CylinderGeometry(r2, r1, d.length(), sides), material, parent);
  item.position.copy(start).add(end).multiplyScalar(.5);
  item.quaternion.setFromUnitVectors(Y, d.normalize()); return item;
}

// The sky is a real, surrounding sphere and remains visible in the lake reflection.
const sky = mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `varying vec3 vDirection;
    void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);
      vec3 c=mix(vec3(.78,.85,.72),vec3(.36,.65,.73),pow(h,.6));
      vec3 s=normalize(vec3(-45.,68.,-75.));float glow=pow(max(dot(d,s),0.),18.);
      c+=vec3(.26,.19,.08)*glow;c=mix(c,vec3(1.,.94,.72),smoothstep(.9993,.9997,dot(d,s)));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}), scene);
sky.castShadow = false; sky.receiveShadow = false; sky.frustumCulled = false;

function coast(angle, factor = 1) {
  const wobble = 1 + .035 * Math.sin(angle * 5 + .6) + .023 * Math.cos(angle * 9);
  return new THREE.Vector3(Math.cos(angle) * 74 * wobble * factor, 0, -30 + Math.sin(angle) * 88 * wobble * factor);
}
const terrain = new THREE.BufferGeometry();
const verts = [], colors = [], indices = [];
const layers = [1, 1.025, 1.11, 1.3, 1.65, 2.3, 4];
const shore = new THREE.Color('#c5bc85'), grass = new THREE.Color('#86995b');
for (let l = 0; l < layers.length; l++) {
  for (let i = 0; i <= 180; i++) {
    const a = i / 180 * Math.PI * 2, p = coast(a, layers[l]);
    p.y = l === 0 ? -.10 : l === 1 ? .32 : .58 + (Math.sin(a * 7) * .28 + Math.cos(a * 11) * .19) * Math.min(l, 3) + (l > 2 ? (l - 2) * .9 : 0);
    verts.push(p.x, p.y, p.z);
    const c = (l < 2 ? shore : grass).clone().multiplyScalar(range(.88, 1.08)); colors.push(c.r, c.g, c.b);
    if (l && i) { const n = l * 181 + i; indices.push(n, n - 181, n - 1, n - 1, n - 181, n - 182); }
  }
}
terrain.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrain.setIndex(indices); terrain.computeVertexNormals();
mesh(terrain, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), scene);

// Distant ridges, with individual faceted peaks and muted atmospheric colors.
const mountainGeo = new THREE.ConeGeometry(1, 1, 7, 3);
for (let layer = 0; layer < 3; layer++) {
  const mountainMat = mat(['#91aaa0', '#79978b', '#688779'][layer]);
  for (let i = 0; i < 15; i++) {
    const x = -240 + i * 35 + range(-13, 13), h = range(25, 59) + (2 - layer) * 12;
    const m = mesh(mountainGeo, mountainMat, scene, [x, h * .45 - 4, -221 + layer * 32 + range(-14, 14)], [range(27, 49), h, range(25, 45)]);
    m.rotation.y = range(0, 6); m.castShadow = false;
  }
}
const treeTrunk = new THREE.CylinderGeometry(.18, .29, 1, 6);
const pineGeo = new THREE.ConeGeometry(1, 1, 7);
const leafGeo = new THREE.IcosahedronGeometry(1, 0);
function tree(x, z, size, pine, y = .6) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = range(0, 6.28); group.scale.setScalar(size); scene.add(group);
  mesh(treeTrunk, materials.bark, group, [0, 1.9, 0], [1, 3.8, 1]);
  if (pine) {
    for (let j = 0; j < 3; j++) mesh(pineGeo, materials.pine[(j + Math.floor(random() * 2)) % 4], group, [0, 3 + j * 1.25, 0], [2.1 - j * .47, 3.5 - j * .45, 2.1 - j * .47]);
  } else {
    mesh(leafGeo, materials.leaves[Math.floor(random() * 4)], group, [0, 4.5, 0], [2.5, 2.7, 2.2]);
    mesh(leafGeo, materials.leaves[Math.floor(random() * 4)], group, [1.3, 3.9, .4], [1.8, 1.9, 1.8]);
    mesh(leafGeo, materials.leaves[Math.floor(random() * 4)], group, [-1.1, 4, -.4], [1.7, 1.8, 1.7]);
  }
}
for (let i = 0; i < 165; i++) {
  const a = range(0, Math.PI * 2), factor = range(1.055, 1.5), p = coast(a, factor);
  if (Math.abs(p.x) < 7 && p.z > 48) continue;
  tree(p.x, p.z, range(.75, 1.75), random() > .24, .65 + Math.max(0, factor - 1.11) * 4);
}
// Two small wooded headlands create a frame around the open water.
for (const side of [-1, 1]) {
  const group = new THREE.Group(); group.position.set(side * 43, -.8, -9); scene.add(group);
  mesh(new THREE.SphereGeometry(1, 12, 5), mat('#899561'), group, [0, 0, 0], [12, 2, 18]);
  for (let i = 0; i < 9; i++) tree(side * 43 + range(-6, 6), -9 + range(-11, 11), range(.8, 1.35), true, .7);
}
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
for (let i = 0; i < 72; i++) {
  const p = coast(range(0, Math.PI * 2), range(.995, 1.055));
  const r = range(.4, 1.8);
  const rock = mesh(rockGeo, materials.rocks[i % 3], scene, [p.x, r * .22, p.z], [r * 1.4, r * .8, r]); rock.rotation.set(range(0, 2), range(0, 5), range(0, .5));
}

// Grasses and reeds use instancing to keep the scene light.
const reedMaterial = mat('#71854d', { side: THREE.DoubleSide });
const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(.08, 1.15, 3), reedMaterial, 550);
const dummy = new THREE.Object3D();
for (let i = 0; i < 550; i++) {
  const p = coast(range(0, Math.PI * 2), range(.992, 1.035));
  dummy.position.set(p.x, range(.25, .5), p.z); dummy.rotation.set(range(-.3, .3), range(0, 6), range(-.25, .25)); dummy.scale.set(1, range(.5, 1.4), 1); dummy.updateMatrix(); reeds.setMatrixAt(i, dummy.matrix);
}
scene.add(reeds);

// A plank-by-plank dock, with fasteners, rope-bound posts and a few everyday props.
const dock = new THREE.Group(); scene.add(dock);
const plankMats = ['#ac8352', '#b7905d', '#bd9763', '#a98050', '#c29a68'].map(c => mat(c));
const nailMat = mat('#4c5144', { metalness: .6 });
for (let i = 0; i < 39; i++) {
  const z = 34.5 + i * .62;
  box(dock, plankMats[i % 5], [0, .98 + range(-.012, .012), z], [5.0, .17, .58]);
  for (const x of [-2.13, 2.13]) mesh(new THREE.CylinderGeometry(.025, .025, .007, 6), nailMat, dock, [x, 1.073, z]);
  // Thin wood grain cuts catch light without external textures.
  if (i % 2 === 0) box(dock, materials.darkWood, [range(-1.2, .4), 1.072, z + .10], [range(.6, 1.7), .002, .012]);
}
for (const x of [-1.85, 1.85]) box(dock, materials.darkWood, [x, .65, 46], [.23, .4, 24]);
const ropeMat = mat('#bdb18a');
for (const x of [-2.45, 2.45]) for (const z of [35.0, 43, 51, 58]) {
  mesh(new THREE.CylinderGeometry(.15, .21, 2.35, 7), materials.darkWood, dock, [x, .55, z]);
  mesh(new THREE.CylinderGeometry(.21, .21, .10, 8), materials.wood, dock, [x, 1.75, z]);
  for (let j = 0; j < 3; j++) { const rope = mesh(new THREE.TorusGeometry(.165, .026, 5, 12), ropeMat, dock, [x, 1.39 + j * .045, z]); rope.rotation.x = Math.PI / 2; }
}
// A folded canvas stool and tackle box behind the player's fixed position.
const canvasMat = mat('#c3ba8e', { side: THREE.DoubleSide });
box(dock, canvasMat, [-1.1, 1.67, 43], [.85, .08, .72]);
for (const x of [-1.43, -.77]) {
  beam(dock, [x, 1.1, 42.65], [x, 1.64, 43.35], .035, .035, materials.metal);
  beam(dock, [x, 1.1, 43.35], [x, 1.64, 42.65], .035, .035, materials.metal);
}
box(dock, mat('#496f65'), [1.55, 1.34, 41.7], [.8, .52, .5]);
box(dock, mat('#608376'), [1.55, 1.63, 41.7], [.86, .08, .56]);
box(dock, materials.metal, [1.55, 1.46, 41.43], [.12, .15, .035]);
beam(dock, [1.31, 1.75, 41.7], [1.79, 1.75, 41.7], .033, .033, materials.metal);

// A little moored rowboat on the left: a geometric hull with visible gunwales and seats.
const boat = new THREE.Group(); boat.position.set(-6.2, .12, 39); boat.rotation.y = -.2; scene.add(boat);
const hullShape = new THREE.Shape(); hullShape.moveTo(0, -2.6); hullShape.lineTo(.78, -1.1); hullShape.lineTo(.8, 1.7); hullShape.lineTo(.5, 2.2); hullShape.lineTo(-.5, 2.2); hullShape.lineTo(-.8, 1.7); hullShape.lineTo(-.78, -1.1); hullShape.closePath();
const hull = mesh(new THREE.ExtrudeGeometry(hullShape, { depth: .45, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 1, steps: 1 }), mat('#476d61'), boat);
hull.rotation.x = -Math.PI / 2;
const edge = [[0,-2.6],[.78,-1.1],[.8,1.7],[.5,2.2],[-.5,2.2],[-.8,1.7],[-.78,-1.1],[0,-2.6]];
for (let i = 1; i < edge.length; i++) beam(boat, [edge[i-1][0], .62, -edge[i-1][1]], [edge[i][0], .62, -edge[i][1]], .06, .06, materials.wood);
for (const z of [-.9, .9]) box(boat, materials.wood, [0, .68, z], [1.4, .08, .32]);
beam(boat, [-.7, .74, -1.4], [.7, .74, 1.5], .035, .035, materials.wood);
box(boat, materials.wood, [.67, .74, 1.42], [.19, .055, .6]).rotation.y = -.43;
const mooring = new THREE.CatmullRomCurve3([new THREE.Vector3(-2.45,1.45,35),new THREE.Vector3(-4.1,.35,35.8),new THREE.Vector3(-6.4,.75,36.8)]);
mesh(new THREE.TubeGeometry(mooring, 16, .018, 4, false), ropeMat, scene);

// Planar reflection camera + animated water shader, without external textures.
const reflectionTarget = new THREE.WebGLRenderTarget(768, 512, { depthBuffer: true });
const reflectionCamera = new THREE.PerspectiveCamera();
const reflectionMatrix = new THREE.Matrix4();
const waterUniforms = { time: { value: 0 }, mirrorMap: { value: reflectionTarget.texture }, mirrorMatrix: { value: reflectionMatrix }, sunDir: { value: sun.position.clone().normalize() } };
const water = mesh(new THREE.PlaneGeometry(650, 650), new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: `varying vec3 vWorld;varying vec4 vMirror;uniform mat4 mirrorMatrix;
    void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vMirror=mirrorMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader: `uniform float time;uniform sampler2D mirrorMap;uniform vec3 sunDir;varying vec3 vWorld;varying vec4 vMirror;
    void main(){vec2 p=vWorld.xz;float t=time;
      float a=sin(p.x*1.65+p.y*.9+t*.8);float b=cos(p.y*2.5-p.x*.45-t*.65);
      vec3 n=normalize(vec3(a*.047+sin(p.x*.26+t*.5)*.035,1.,b*.038));
      vec3 eye=normalize(cameraPosition-vWorld);float fresnel=.15+.65*pow(1.-max(dot(eye,n),0.),3.);
      vec2 uv=vMirror.xy/vMirror.w*.5+.5;uv+=n.xz*.023;
      vec3 reflected=texture2D(mirrorMap,clamp(uv,.002,.998)).rgb;
      vec3 base=mix(vec3(.16,.43,.37),vec3(.22,.54,.48),sin(p.y*.06+p.x*.025)*.5+.5);
      vec3 color=mix(base,reflected,fresnel*.79);
      float spec=pow(max(dot(reflect(-sunDir,n),eye),0.),180.);
      color+=vec3(1.,.85,.49)*spec*.85;
      float fleck=pow(max(0.,sin(p.x*3.4+p.y*2.1+t*.7)*cos(p.y*5.2-t*.45)),18.);
      color+=vec3(.16,.21,.14)*fleck*.30;
      float distanceFog=1.-exp(-.000038*dot(cameraPosition-vWorld,cameraPosition-vWorld));
      color=mix(color,vec3(.56,.70,.61),distanceFog*.65);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}), scene);
water.rotation.x = -Math.PI / 2; water.position.y = -.035; water.castShadow = false; water.receiveShadow = false;

// A few lily pads close to the bank and fine ring ripples on the lake.
const padMat = mat('#719156', { side: THREE.DoubleSide });
for (let i = 0; i < 27; i++) {
  const a = range(.23, 1.15), p = coast(a, range(.86, .95));
  const pad = mesh(new THREE.CircleGeometry(range(.16, .39), 9, .2, Math.PI * 1.85), padMat, scene, [p.x, .007, p.z]); pad.rotation.x = -Math.PI / 2; pad.rotation.z = range(0, 6);
}
const ripples = [];
for (let i = 0; i < 7; i++) {
  const ring = mesh(new THREE.RingGeometry(.98, 1, 48), new THREE.MeshBasicMaterial({ color: '#c2d9bd', transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }), scene, [range(-28, 27), .009, range(-55, 29)]);
  ring.rotation.x = -Math.PI / 2; ring.castShadow = false; ring.userData.phase = random(); ripples.push(ring);
}

// Rod lives in camera space: it follows every look direction and stays first person.
const rod = new THREE.Group(); camera.add(rod);
rod.scale.setScalar(.84);rod.position.set(.08,-.19,-.03);rod.rotation.y=-.16;
const corkMat = mat('#ae8955'), rodMat = mat('#263d37', { roughness: .34, metalness: .25 });
const rodPoints = [[.57,-.63,-.75],[.48,-.38,-1.1],[.29,-.02,-1.7],[.04,.28,-2.4],[-.17,.43,-3.1],[-.30,.47,-3.65]];
for (let i = 1; i < rodPoints.length; i++) beam(rod, rodPoints[i-1], rodPoints[i], .025 - i*.0032, .022 - i*.0032, i === 1 ? corkMat : rodMat);
for (let i = 1; i < rodPoints.length; i++) {
  const p = rodPoints[i], guide = mesh(new THREE.TorusGeometry(.035 - i*.0035, .004, 5, 12), materials.metal, rod, [p[0], p[1] - .035, p[2]]);
  guide.rotation.x = .3;
}
mesh(new THREE.CylinderGeometry(.085, .085, .07, 12), materials.metal, rod, [.49,-.43,-1.08]).rotation.z = Math.PI / 2;
mesh(new THREE.CylinderGeometry(.062, .062, .075, 12), mat('#c4b384', { metalness: .5 }), rod, [.445,-.43,-1.08]).rotation.z = Math.PI / 2;
beam(rod, [.44,-.43,-1.08], [.37,-.51,-1.08], .009, .009, materials.metal);
box(rod, corkMat, [.35,-.51,-1.08], [.07,.025,.025]);
const linePoints = rodPoints.slice(1).map(p => new THREE.Vector3(p[0], p[1]-.035, p[2]));
linePoints.push(new THREE.Vector3(-.28,-.28,-3.63));
const fishingLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color:'#dfdfc9',transparent:true,opacity:.58 })); rod.add(fishingLine);
beam(rod, [-.28,-.28,-3.63],[-.28,-.36,-3.63], .015,.015,mat('#ce8b65'));

// Small distant birds drift across the sky.
const birds = [];
for (let i = 0; i < 7; i++) {
  const bird = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.55,.15,0),new THREE.Vector3(0,0,0),new THREE.Vector3(.55,.15,0)]), new THREE.LineBasicMaterial({ color: '#46645b' }));
  bird.position.set(range(-45, 45),range(17,27),range(-110,-65)); bird.userData.origin = bird.position.clone(); bird.userData.phase=range(0,6); scene.add(bird); birds.push(bird);
}

let targetYaw = 0, targetPitch = -.065, yaw = 0, pitch = -.065, dragging = false, touchId = null;
let lastX = 0, lastY = 0, fine = true, frame = 0, explored = false, contextLost = false;
const keys = new Set(), toastElement = document.querySelector('#toast');
let toastTimer;
function toast(message) { toastElement.textContent = message; toastElement.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastElement.classList.remove('visible'), 2400); }
function dismissWelcome() { if (!explored) { explored = true; document.querySelector('#welcome').classList.add('dismissed'); } }
function reset() { targetYaw = 0; targetPitch = -.065; toast('已回到面向湖心的初始视角'); }
function stopDragging() { dragging = false; touchId = null; canvas.style.cursor = 'grab'; }
canvas.style.cursor = 'grab';
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 2 && e.pointerType !== 'touch') return;
  if (dragging) return;
  dragging = true; touchId = e.pointerId; lastX=e.clientX;lastY=e.clientY;
  canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';canvas.focus();
});
canvas.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId !== touchId) return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;
  targetYaw -= dx*.003;targetPitch = THREE.MathUtils.clamp(targetPitch-dy*.0027,-1.12,.94);
  lastX=e.clientX;lastY=e.clientY;if(Math.abs(dx)+Math.abs(dy)>1)dismissWelcome();
});
canvas.addEventListener('pointerup', stopDragging);canvas.addEventListener('pointercancel',stopDragging);canvas.addEventListener('lostpointercapture',stopDragging);
window.addEventListener('blur', () => {stopDragging();keys.clear();});
document.addEventListener('visibilitychange', () => {stopDragging();keys.clear();});
document.querySelector('#reset').addEventListener('click',reset);
document.querySelector('#quality').addEventListener('click', () => {
  fine=!fine;renderer.setPixelRatio(Math.min(devicePixelRatio,fine?1.7:1));renderer.shadowMap.enabled=fine;renderer.shadowMap.needsUpdate=true;
  document.querySelector('#quality span').textContent=`画质 · ${fine?'精细':'流畅'}`;toast(fine?'精细画质 · 阴影与湖面反射已开启':'流畅画质 · 降低分辨率与反射更新频率');
});
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen();else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();else toast('当前预览不支持全屏，可在浏览器中打开游戏'); }
  catch { toast('当前窗口限制了全屏，请在独立浏览器中打开'); }
}
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
const dialog=document.querySelector('#help-dialog');
document.querySelector('#help').addEventListener('click',()=>{keys.clear();stopDragging();dialog.showModal();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('keydown',e=>{
  if(dialog.open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.code.startsWith('Arrow')){e.preventDefault();keys.add(e.code);dismissWelcome();}
  if(e.repeat)return;
  if(e.code==='KeyR')reset();if(e.code==='KeyF')fullscreen();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;window.showGameError('浏览器的 3D 渲染被中断，请关闭部分标签页后点击重新加载。');});

const lookDirection=new THREE.Vector3(),lookTarget=new THREE.Vector3();
const clock=new THREE.Timer();clock.connect(document);let elapsed=0;
function animate() {
  if(contextLost)return;
  clock.update();const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
  if(!document.hidden){
    if(keys.has('ArrowLeft'))targetYaw+=dt*.8;if(keys.has('ArrowRight'))targetYaw-=dt*.8;
    if(keys.has('ArrowUp'))targetPitch+=dt*.55;if(keys.has('ArrowDown'))targetPitch-=dt*.55;
    targetPitch=THREE.MathUtils.clamp(targetPitch,-1.12,.94);
    const smooth=1-Math.exp(-dt*16);yaw+=(targetYaw-yaw)*smooth;pitch+=(targetPitch-pitch)*smooth;
    camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();
    rod.position.y=-.19+Math.sin(elapsed*1.1)*.004;rod.rotation.z=Math.sin(elapsed*.65)*.003;
    boat.position.y=.12+Math.sin(elapsed*.8)*.035;boat.rotation.z=Math.sin(elapsed*.7)*.012;
    for(const r of ripples){const phase=(elapsed*.14+r.userData.phase)%1;r.scale.setScalar(.4+phase*3.3);r.material.opacity=(1-phase)*.12;}
    for(const b of birds){const o=b.userData.origin;b.position.x=o.x+Math.sin(elapsed*.035+b.userData.phase)*15;b.position.y=o.y+Math.sin(elapsed*2+b.userData.phase)*.18;b.rotation.z=Math.sin(elapsed*3+b.userData.phase)*.13;}
    waterUniforms.time.value=elapsed;
    // Reflect the camera about y = water level; skip the held rod in the reflection.
    // Initialize the main shadow depth texture before a reflection samples it.
    if(frame>0 && frame%(fine?2:5)===0){
      reflectionCamera.copy(camera,false);reflectionCamera.position.y=2*water.position.y-camera.position.y;
      camera.getWorldDirection(lookDirection);lookTarget.copy(camera.position).add(lookDirection);lookTarget.y=2*water.position.y-lookTarget.y;
      reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(lookTarget);reflectionCamera.updateMatrixWorld();
      reflectionMatrix.multiplyMatrices(reflectionCamera.projectionMatrix,reflectionCamera.matrixWorldInverse);
      water.visible=false;rod.visible=false;const shadows=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
      renderer.setRenderTarget(reflectionTarget);renderer.render(scene,reflectionCamera);renderer.setRenderTarget(null);
      renderer.shadowMap.autoUpdate=shadows;water.visible=true;rod.visible=true;
    }
    renderer.render(scene,camera);frame++;
  }
  requestAnimationFrame(animate);
}
animate();
document.querySelector('#loading').classList.add('done');
setTimeout(()=>{document.querySelector('#loading').hidden=true;},750);
// Read-only diagnostics for local smoke tests and later development.
window.lakeside={getState:()=>({version:'0.1.0',yaw,pitch,targetYaw,targetPitch,fine,explored,dragging,frames:frame,camera:camera.position.toArray(),rodFollowsCamera:rod.parent===camera,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,webgl:renderer.capabilities.isWebGL2!==false})};
