// Environnement 3D de Babylon : relief, ciel, nuages, eau, lumière du jour et de la nuit, ombres,
// post-traitement, matériaux et petits outils de modélisation. Repris de la démo 3 et rendu modulaire.
// Dépend de BABYLON (global, chargé depuis le CDN) ; aucune logique de jeu ici.

export const MAP = 420, HALF = MAP / 2;
export const LAKE = { x: 42, z: 34, r: 38 };
export const CAMP = { x: 4, z: -6 };      // emplacement du campement (bord du lac)

/* ------------------------------------------------------------
   OUTILS : bruit procédural
   ------------------------------------------------------------ */
function hash(i, j){
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = t => t*t*(3-2*t);
function vnoise(x, y, p){ // p = période (0 = non périodique)
  let i = Math.floor(x), j = Math.floor(y); const fx = x-i, fy = y-j;
  const w = (a)=> p ? ((a % p) + p) % p : a;
  const a = hash(w(i),w(j)), b = hash(w(i+1),w(j)), c = hash(w(i),w(j+1)), d = hash(w(i+1),w(j+1));
  const u = sm(fx), v = sm(fy);
  return (a + (b-a)*u) + ((c + (d-c)*u) - (a + (b-a)*u))*v;
}
function fbm(x, y, oct=5, p=0){
  let s=0, amp=0.5, f=1, n=0;
  for(let o=0;o<oct;o++){ s += amp*vnoise(x*f, y*f, p? p*f : 0); n+=amp; amp*=0.5; f*=2; }
  return s/n;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const lerp=(a,b,t)=>a+(b-a)*t;


export { hash, fbm, vnoise, clamp, smooth, lerp };

export function height(x, z){
  let h = 2.2 + (fbm(x*0.012+11, z*0.012-7, 5)-0.5)*9;
  h += (fbm(x*0.045, z*0.045, 3)-0.5)*1.2;
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smooth(120, 205, e) * (18 + fbm(x*0.02, z*0.02, 4)*30);
  // replat du campement
  const dC = Math.hypot(x-CAMP.x, z-CAMP.z);
  h = lerp(2.0, h, smooth(10, 32, dC));
  h = Math.max(h, 1.6);
  // lac (forme irrégulière)
  const ang = Math.atan2(z-LAKE.z, x-LAKE.x);
  const rr = LAKE.r * (0.85 + 0.3*vnoise(Math.cos(ang)*2+5, Math.sin(ang)*2+5));
  const dL = Math.hypot(x-LAKE.x, z-LAKE.z);
  const lk = 1 - smooth(rr*0.55, rr*1.08, dL);
  h = lerp(h, -4.5, lk);
  return h;
}

export function creerEnvironnement(canvas){
const engine = new BABYLON.Engine(canvas, true, { stencil:true, preserveDrawingBuffer:false, antialias:true }, true);
engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio||1, 1.5));
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.55,0.7,0.85,1);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.0032;
scene.fogColor = new BABYLON.Color3(0.72,0.8,0.88);
scene.skipPointerMovePicking = true;

const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI/2 - 0.6, 0.9, 26, new BABYLON.Vector3(CAMP.x, 3, CAMP.z), scene);
camera.minZ = 0.2; camera.maxZ = 4000;
camera.lowerRadiusLimit = 3; camera.upperRadiusLimit = 160;
camera.lowerBetaLimit = 0.22; camera.upperBetaLimit = 1.42;
camera.wheelDeltaPercentage = 0.012;
camera.attachControl(canvas, true);
camera.inputs.removeByType("ArcRotateCameraPointersInput");
camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
camera.fov = 0.8;

const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5,-1,0.4), scene);
sun.position = new BABYLON.Vector3(100,200,-80);
const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);
hemi.intensity = 0.55;
const lune = new BABYLON.DirectionalLight("lune", new BABYLON.Vector3(0.3,-1,-0.4), scene);
lune.diffuse = new BABYLON.Color3(0.55,0.65,0.95); lune.specular = new BABYLON.Color3(0,0,0); lune.intensity = 0;

let shadowGen;
if (engine.webGLVersion >= 2){
  shadowGen = new BABYLON.CascadedShadowGenerator(2048, sun);
  shadowGen.numCascades = 4; shadowGen.lambda = 0.85; shadowGen.shadowMaxZ = 220;
  shadowGen.stabilizeCascades = true; shadowGen.cascadeBlendPercentage = 0.08;
  shadowGen.usePercentageCloserFiltering = true; shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
  shadowGen.darkness = 0.25; shadowGen.bias = 0.004; shadowGen.normalBias = 0.02;
} else {
  shadowGen = new BABYLON.ShadowGenerator(2048, sun);
  shadowGen.usePercentageCloserFiltering = true; shadowGen.darkness = 0.3;
}
const addCaster = m => shadowGen.addShadowCaster(m, false);

/* ============================================================
   TEXTURES PROCÉDURALES
   ============================================================ */
function makeTex(name, size, fn, opts={}){
  const t = new BABYLON.DynamicTexture(name, {width:size, height:size}, scene, true);
  const ctx = t.getContext(); const img = ctx.createImageData(size, size); const d = img.data;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const c = fn(x, y, size); const k = (y*size+x)*4;
    d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]= c.length>3 ? c[3] : 255;
  }
  ctx.putImageData(img,0,0); t.update(opts.invertY ?? true);
  t.wrapU = t.wrapV = opts.clamp ? BABYLON.Texture.CLAMP_ADDRESSMODE : BABYLON.Texture.WRAP_ADDRESSMODE;
  if(opts.alpha) t.hasAlpha = true;
  return t;
}
// grain du sol
const detailTex = makeTex("detail", 256, (x,y,s)=>{
  const v = 0.82 + 0.18*fbm(x/s*16, y/s*16, 4, 16);
  const g = Math.round(v*255); return [g,g,g];
});
// normales de l'eau (périodique)
const waterBump = (()=>{
  const S=256, H=new Float32Array(S*S);
  for(let y=0;y<S;y++) for(let x=0;x<S;x++) H[y*S+x] = fbm(x/S*8, y/S*8, 4, 8);
  return makeTex("waterBump", S, (x,y)=>{
    const l=H[y*S+((x-1+S)%S)], r=H[y*S+((x+1)%S)], u=H[((y-1+S)%S)*S+x], d=H[((y+1)%S)*S+x];
    let nx=(l-r)*6, ny=(u-d)*6, nz=1; const L=Math.hypot(nx,ny,nz); nx/=L; ny/=L; nz/=L;
    return [ (nx*0.5+0.5)*255, (ny*0.5+0.5)*255, (nz*0.5+0.5)*255 ];
  });
})();
// nuages (périodique)
const cloudTex = makeTex("clouds", 512, (x,y,s)=>{
  const v = fbm(x/s*6, y/s*6, 6, 6);
  const a = smooth(0.5, 0.78, v);
  const sh = 235 - 40*smooth(0.6,0.9,v);
  return [sh, sh, Math.min(255, sh+10), a*235];
}, {alpha:true});
const cloudFade = makeTex("cloudFade", 128, (x,y,s)=>{
  const d = Math.hypot(x/s-0.5, y/s-0.5)*2; const a = 1-smooth(0.35,1.0,d);
  return [a*255,a*255,a*255,255];
}, {clamp:true});
// fumée
const smokeTex = makeTex("smoke", 64, (x,y,s)=>{
  const d = Math.hypot(x/s-0.5, y/s-0.5)*2; const a = Math.pow(1-clamp(d,0,1), 2);
  return [255,255,255,a*255];
}, {alpha:true, clamp:true});

const fireTex = makeTex("fire", 64, (x,y,s)=>{
  const d = Math.hypot(x/s-0.5, y/s-0.5)*2; const a = Math.pow(1-clamp(d,0,1), 1.6);
  return [255, 200*a+40, 80*a, a*255];
}, {alpha:true, clamp:true});

/* ============================================================
   CIEL
   ============================================================ */
const skyMat = new BABYLON.SkyMaterial("skyMat", scene);
skyMat.backFaceCulling = false;
skyMat.useSunPosition = true;
skyMat.turbidity = 4; skyMat.rayleigh = 1.6; skyMat.luminance = 1.0;
skyMat.mieCoefficient = 0.004; skyMat.mieDirectionalG = 0.85;
skyMat.fogEnabled = false;
const skybox = BABYLON.MeshBuilder.CreateBox("skybox", {size:3000}, scene);
skybox.material = skyMat; skybox.infiniteDistance = true; skybox.isPickable = false;

const cloudMat = new BABYLON.StandardMaterial("cloudMat", scene);
cloudMat.diffuseTexture = cloudTex; cloudMat.useAlphaFromDiffuseTexture = true;
cloudTex.uScale = cloudTex.vScale = 3;
cloudMat.opacityTexture = cloudFade;
cloudMat.emissiveColor = new BABYLON.Color3(1,1,1); cloudMat.disableLighting = true;
cloudMat.backFaceCulling = false; cloudMat.fogEnabled = false;
const clouds = BABYLON.MeshBuilder.CreateGround("clouds", {width:2400, height:2400}, scene);
clouds.position.y = 170; clouds.material = cloudMat; clouds.isPickable = false;

/* ============================================================
   TERRAIN
   ============================================================ */
const terrain = BABYLON.MeshBuilder.CreateGround("terrain", {width:MAP, height:MAP, subdivisions:240, updatable:true}, scene);
{
  const pos = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const idx = terrain.getIndices();
  for(let i=0;i<pos.length;i+=3) pos[i+1] = height(pos[i], pos[i+2]);
  const nrm = []; BABYLON.VertexData.ComputeNormals(pos, idx, nrm);
  const col = new Float32Array(pos.length/3*4);
  for(let i=0,v=0;i<pos.length;i+=3,v+=4){
    const x=pos[i], y=pos[i+1], z=pos[i+2], ny=nrm[i+1];
    const n1 = fbm(x*0.03+3, z*0.03+9, 3), n2 = fbm(x*0.15, z*0.15, 2);
    // herbe (variations)
    let r = lerp(0.28, 0.40, n1), g = lerp(0.47, 0.58, n1), b = lerp(0.16, 0.20, n2);
    // herbe sèche / prairie
    const dry = smooth(0.55, 0.75, fbm(x*0.02-40, z*0.02+13, 3));
    r = lerp(r, 0.55, dry*0.6); g = lerp(g, 0.55, dry*0.4); b = lerp(b, 0.24, dry*0.4);
    // place en terre battue autour du centre-ville
    const dTC = Math.hypot(x-CAMP.x, z-CAMP.z);
    const dirt = (1-smooth(4, 8, dTC + (n2-0.5)*3));
    r = lerp(r, 0.52, dirt); g = lerp(g, 0.42, dirt); b = lerp(b, 0.28, dirt);
    // sable de berge, fond du lac
    const sand = 1 - smooth(0.7, 1.5, y);
    r = lerp(r, 0.76, sand); g = lerp(g, 0.68, sand); b = lerp(b, 0.48, sand);
    const deep = 1 - smooth(-3, 0, y);
    r = lerp(r, 0.35, deep); g = lerp(g, 0.36, deep); b = lerp(b, 0.30, deep);
    // roche sur pentes et sommets
    const rock = Math.max(1 - smooth(0.72, 0.86, ny), smooth(16, 26, y));
    const rv = lerp(0.42, 0.55, n2);
    r = lerp(r, rv, rock); g = lerp(g, rv*0.97, rock); b = lerp(b, rv*0.9, rock);
    col[v]=r; col[v+1]=g; col[v+2]=b; col[v+3]=1;
  }
  terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
  terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, nrm);
  terrain.setVerticesData(BABYLON.VertexBuffer.ColorKind, col);
  terrain.refreshBoundingInfo();
}
const terrainMat = new BABYLON.StandardMaterial("terrainMat", scene);
terrainMat.diffuseTexture = detailTex; detailTex.uScale = detailTex.vScale = 70;
terrainMat.specularColor = new BABYLON.Color3(0.03,0.03,0.03);
terrain.material = terrainMat;
terrain.receiveShadows = true;
terrain.metadata = { kind:'ground' };

/* ============================================================
   EAU
   ============================================================ */
const water = BABYLON.MeshBuilder.CreateGround("water", {width:LAKE.r*3.4, height:LAKE.r*3.4, subdivisions:48}, scene);
water.position.set(LAKE.x, 0, LAKE.z);
water.isPickable = false;
const waterMat = new BABYLON.WaterMaterial("waterMat", scene, new BABYLON.Vector2(512,512));
waterMat.bumpTexture = waterBump;
waterMat.windForce = -6;
waterMat.waveHeight = 0.12;
waterMat.waveLength = 0.08;
waterMat.waveSpeed = 40;
waterMat.bumpHeight = 0.35;
waterMat.windDirection = new BABYLON.Vector2(1, 0.6);
waterMat.waterColor = new BABYLON.Color3(0.12, 0.4, 0.48);
waterMat.colorBlendFactor = 0.22;
waterMat.waterColor2 = new BABYLON.Color3(0.1, 0.35, 0.3);
waterMat.colorBlendFactor2 = 0.15;
waterBump.uScale = waterBump.vScale = 1;
water.material = waterMat;
waterMat.addToRenderList(skybox);
waterMat.addToRenderList(clouds);
waterMat.addToRenderList(terrain);


/* ============================================================
   MATÉRIAUX & AIDES DE MODÉLISATION
   ============================================================ */
const vcMat = new BABYLON.StandardMaterial("vc", scene);
vcMat.specularColor = new BABYLON.Color3(0.04,0.04,0.04);
const C = (r,g,b)=> new BABYLON.Color3(r,g,b);
function paint(mesh, color, jitter=0, flat=true){
  if(flat) mesh.convertToFlatShadedMesh();
  if(jitter){
    const p = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    // déplacement cohérent : même déformation pour sommets confondus
    for(let i=0;i<p.length;i+=3){
      const k = Math.round(p[i]*50)*7 + Math.round(p[i+1]*50)*13 + Math.round(p[i+2]*50)*29;
      p[i]   += (hash(k,1)-0.5)*jitter; p[i+1] += (hash(k,2)-0.5)*jitter; p[i+2] += (hash(k,3)-0.5)*jitter;
    }
    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, p);
    const n=[]; BABYLON.VertexData.ComputeNormals(p, mesh.getIndices(), n);
    mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, n);
  }
  const n = mesh.getTotalVertices(), c = new Float32Array(n*4);
  for(let i=0;i<n;i++){ const s = 1 + (jitter? (hash(i,77)-0.5)*0.12 : 0);
    c[i*4]=color.r*s; c[i*4+1]=color.g*s; c[i*4+2]=color.b*s; c[i*4+3]=1; }
  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, c);
  return mesh;
}
const MB = BABYLON.MeshBuilder;
function part(mesh, color, x=0,y=0,z=0, opts={}){
  mesh.position.set(x,y,z);
  if(opts.ry) mesh.rotation.y = opts.ry;
  if(opts.rx) mesh.rotation.x = opts.rx;
  if(opts.rz) mesh.rotation.z = opts.rz;
  if(opts.sc) mesh.scaling.set(opts.sc[0],opts.sc[1],opts.sc[2]);
  mesh.bakeCurrentTransformIntoVertices();
  return paint(mesh, color, opts.jitter||0, opts.flat!==false);
}
function merge(name, parts){
  const m = BABYLON.Mesh.MergeMeshes(parts, true, true);
  m.name = name; m.material = vcMat; return m;
}


/* ============================================================
   ARBRES (instances)
   ============================================================ */
function makePine(){
  const parts = [ part(MB.CreateCylinder("t",{height:2.2, diameterTop:0.32, diameterBottom:0.5, tessellation:7}), C(0.36,0.24,0.15), 0,1.1,0) ];
  const greens = [C(0.13,0.32,0.18), C(0.15,0.36,0.2), C(0.18,0.4,0.22)];
  for(let i=0;i<4;i++){
    const h = 2.6 - i*0.35, d = 4.2 - i*0.9;
    parts.push(part(MB.CreateCylinder("c",{height:h, diameterTop:0, diameterBottom:d, tessellation:8}), greens[i%3], 0, 2.1 + i*1.25 + h/2, 0, {jitter:0.35, ry:i*0.4}));
  }
  return merge("pine", parts);
}
function makeOak(){
  const parts = [ part(MB.CreateCylinder("t",{height:3, diameterTop:0.4, diameterBottom:0.7, tessellation:7}), C(0.38,0.26,0.16), 0,1.5,0) ];
  const blobs = [[0,4.3,0,2.2],[1.2,3.8,0.4,1.5],[-1.1,3.9,-0.3,1.6],[0.2,5.3,0.6,1.4],[-0.4,3.6,1.1,1.3],[0.5,3.7,-1.1,1.3]];
  const g = [C(0.24,0.42,0.16), C(0.28,0.46,0.18), C(0.21,0.38,0.14)];
  blobs.forEach((b,i)=> parts.push(part(MB.CreateIcoSphere("b",{radius:b[3], subdivisions:1}), g[i%3], b[0],b[1],b[2], {jitter:0.45})));
  return merge("oak", parts);
}

function makeBush(){
  const P=[ part(MB.CreateIcoSphere("b",{radius:1.1, subdivisions:1}), C(0.2,0.4,0.15), 0,0.7,0, {jitter:0.35}) ];
  for(let i=0;i<9;i++){ const a=i*2.3, h=0.5+hash(i,3)*0.7;
    P.push(part(MB.CreateIcoSphere("r",{radius:0.14, subdivisions:1}), C(0.75,0.08,0.2), Math.cos(a)*0.95, h, Math.sin(a)*0.95)); }
  return merge("bush", P);
}
function makeMine(kind){
  const P=[]; const base = kind==='gold' ? C(0.5,0.47,0.42) : C(0.58,0.58,0.56);
  for(let i=0;i<7;i++){
    const a=i*0.9, d= i===0?0:1.2+hash(i,5)*0.8, r=0.8+hash(i,8)*0.7;
    P.push(part(MB.CreateIcoSphere("rk",{radius:r, subdivisions:1}), base, Math.cos(a)*d, r*0.45, Math.sin(a)*d, {jitter:0.5}));
  }
  if(kind==='gold') for(let i=0;i<10;i++){ const a=i*1.7, d=0.6+hash(i,9)*1.6;
    P.push(part(MB.CreateIcoSphere("g",{radius:0.28+hash(i,4)*0.2, subdivisions:0}), C(1,0.78,0.2), Math.cos(a)*d, 0.6+hash(i,2)*0.9, Math.sin(a)*d, {jitter:0.1})); }
  else for(let i=0;i<6;i++){ const a=i*1.3, d=0.8+hash(i,6)*1.2;
    P.push(part(MB.CreateBox("bl",{size:0.55}), C(0.7,0.7,0.68), Math.cos(a)*d, 0.3, Math.sin(a)*d, {ry:a, jitter:0.08})); }
  return merge(kind+"Mine", P);
}


/* ------------------------------------------------------------
   HERBES, FLEURS, ROSEAUX (décor, thin instances)
   ------------------------------------------------------------ */
{
  const blades = [];
  for(let i=0;i<7;i++){
    const a = i*2.4, d = 0.08 + hash(i,11)*0.14, h = 0.35 + hash(i,12)*0.4;
    const gc = C(lerp(0.26,0.38,hash(i,13)), lerp(0.46,0.58,hash(i,14)), 0.16);
    blades.push(part(MB.CreateCylinder("bl",{height:h, diameterTop:0, diameterBottom:0.07, tessellation:3}), gc,
      Math.cos(a)*d, h/2, Math.sin(a)*d, {rx:(hash(i,15)-0.5)*0.6, rz:(hash(i,16)-0.5)*0.6, flat:false}));
  }
  const g = merge("grassSrc", blades);
  const f = merge("flowerSrc", [
    part(MB.CreateCylinder("s",{height:0.4, diameter:0.04, tessellation:4}), C(0.25,0.45,0.15), 0,0.2,0, {flat:false}),
    part(MB.CreateIcoSphere("p",{radius:0.09, subdivisions:0}), C(0.95,0.9,0.4), 0,0.42,0),
  ]);
  const fm = new BABYLON.StandardMaterial("fm", scene); fm.specularColor = C(0,0,0); fm.backFaceCulling=false; fm.twoSidedLighting = true; fm.emissiveColor = C(0.05,0.07,0.02);
  g.material = fm; f.material = fm;
  remplirThin(g, 16000, 300, (x,y,z)=> y>1.6 && y<14 && Math.hypot(x-CAMP.x,z-CAMP.z)>7 && fbm(x*0.05,z*0.05,2)>0.42);
  remplirThin(f, 1800, 280, (x,y,z)=> y>1.6 && y<10 && Math.hypot(x-CAMP.x,z-CAMP.z)>9 && fbm(x*0.03+9,z*0.03,2)>0.55);
  const reed = merge("reedSrc", [0,1,2].map(i=>part(MB.CreateCylinder("r",{height:1.4, diameterTop:0.02, diameterBottom:0.06, tessellation:3}), C(0.42,0.5,0.22), (i-1)*0.12,0.7,(i%2)*0.1, {rz:(i-1)*0.15, flat:false})));
  reed.material = fm;
  remplirThin(reed, 900, MAP-10, (x,y,z)=> y>-0.4 && y<1.1 && Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.4);
}
function remplirThin(mesh, n, area, cond, centre = {x:0, z:0}, echelle = [0.7, 1.5]){
  const mats = []; const M = BABYLON.Matrix;
  let k=0, tries=0;
  while(k<n && tries<n*4){
    tries++;
    const x=centre.x+(Math.random()-0.5)*area, z=centre.z+(Math.random()-0.5)*area;
    const y=height(x,z); if(!cond(x,y,z)) continue;
    const s=echelle[0]+Math.random()*(echelle[1]-echelle[0]);
    mats.push(M.Scaling(s, s*(0.8+Math.random()*0.6), s).multiply(M.RotationY(Math.random()*6.28)).multiply(M.Translation(x,y-0.03,z))); k++;
  }
  const buf = new Float32Array(mats.length*16); mats.forEach((m,i)=>m.copyToArray(buf,i*16));
  mesh.thinInstanceSetBuffer("matrix", buf, 16, true);
  mesh.isPickable = false; mesh.receiveShadows = true; mesh.alwaysSelectAsActiveMesh = true;
}

/* ------------------------------------------------------------
   HEURE : soleil, lune, ciel, brume — de 0 à 24 h
   ------------------------------------------------------------ */
function setHeure(h){
  h = ((h % 24) + 24) % 24;
  const jour = h >= 6 && h < 20;
  let elev, az;
  if (jour){ const k = (h-6)/14; elev = Math.sin(k*Math.PI)*1.05 + 0.04; az = lerp(-Math.PI*0.55, Math.PI*0.55, k) - Math.PI/2; }
  else { const k = ((h-20+24)%24)/10; elev = -Math.sin(k*Math.PI)*0.55 - 0.02; az = lerp(Math.PI*0.45, Math.PI*1.55, k) - Math.PI/2; }
  const dir = new BABYLON.Vector3(Math.cos(elev)*Math.cos(az), Math.sin(elev), Math.cos(elev)*Math.sin(az));
  sun.direction = dir.scale(-1); sun.position = dir.scale(220);
  skyMat.sunPosition = dir.scale(100);
  const low = 1 - smooth(0.05, 0.5, elev);                 // 1 = soleil bas
  const nuit = 1 - smooth(-0.12, 0.06, elev);              // 1 = pleine nuit
  sun.intensity = lerp(1.7, 0.75, low) * (1 - nuit);
  sun.diffuse = new BABYLON.Color3(1, lerp(0.95,0.62,low), lerp(0.86,0.38,low));
  lune.intensity = 0.32 * nuit;
  hemi.intensity = lerp(lerp(0.6, 0.38, low), 0.16, nuit);
  hemi.diffuse = BABYLON.Color3.Lerp(new BABYLON.Color3(lerp(0.75,0.8,low), lerp(0.82,0.66,low), lerp(0.95,0.75,low)), new BABYLON.Color3(0.35,0.42,0.7), nuit);
  hemi.groundColor = BABYLON.Color3.Lerp(new BABYLON.Color3(0.32,0.3,0.24), new BABYLON.Color3(0.05,0.06,0.1), nuit);
  skyMat.turbidity = lerp(3.5, 8, low); skyMat.luminance = lerp(lerp(1.0, 0.85, low), 0.12, nuit);
  scene.fogColor = BABYLON.Color3.Lerp(new BABYLON.Color3(lerp(0.7,0.85,low), lerp(0.8,0.64,low), lerp(0.9,0.55,low)), new BABYLON.Color3(0.03,0.04,0.08), nuit);
  cloudMat.emissiveColor = BABYLON.Color3.Lerp(new BABYLON.Color3(1, lerp(1,0.78,low), lerp(1,0.65,low)), new BABYLON.Color3(0.12,0.14,0.22), nuit);
  if (pipe) pipe.imageProcessing.exposure = lerp(1.25, 1.6, nuit);
  return { nuit, low };
}

/* ------------------------------------------------------------
   POST-TRAITEMENT
   ------------------------------------------------------------ */
const pipe = new BABYLON.DefaultRenderingPipeline("pipe", true, scene, [camera]);
pipe.samples = engine.webGLVersion>=2 ? 4 : 1;
pipe.fxaaEnabled = true;
pipe.bloomEnabled = true; pipe.bloomThreshold = 0.82; pipe.bloomWeight = 0.22; pipe.bloomKernel = 48; pipe.bloomScale = 0.5;
pipe.imageProcessingEnabled = true;
pipe.imageProcessing.toneMappingEnabled = true;
pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipe.imageProcessing.exposure = 1.25; pipe.imageProcessing.contrast = 1.12;
pipe.imageProcessing.vignetteEnabled = true; pipe.imageProcessing.vignetteWeight = 1.6; pipe.imageProcessing.vignetteStretch = 0.4;
pipe.sharpenEnabled = true; pipe.sharpen.edgeAmount = 0.25;

/* ------------------------------------------------------------
   BROUILLARD D'EXPLORATION
   R = zone déjà explorée · G = zone actuellement vue
   ------------------------------------------------------------ */
const FOG_N = 160, FOG_CELL = MAP/FOG_N;
const fogData = new Uint8Array(FOG_N*FOG_N*4);
const fogExplored = new Float32Array(FOG_N*FOG_N);
const fogVis = new Float32Array(FOG_N*FOG_N);
const fogTex = BABYLON.RawTexture.CreateRGBATexture(fogData, FOG_N, FOG_N, scene, false, false, BABYLON.Texture.BILINEAR_SAMPLINGMODE);
fogTex.wrapU = fogTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
function updateFog(viewers){
  fogVis.fill(0);
  for (const [x,z,r] of viewers){
    const i0 = Math.max(0, Math.floor((x-r+HALF)/FOG_CELL)), i1 = Math.min(FOG_N-1, Math.ceil((x+r+HALF)/FOG_CELL));
    const j0 = Math.max(0, Math.floor((z-r+HALF)/FOG_CELL)), j1 = Math.min(FOG_N-1, Math.ceil((z+r+HALF)/FOG_CELL));
    for (let j=j0;j<=j1;j++) for (let i=i0;i<=i1;i++){
      const cx = (i+0.5)*FOG_CELL-HALF, cz = (j+0.5)*FOG_CELL-HALF;
      const v = 1 - smooth(r*0.65, r, Math.hypot(cx-x, cz-z));
      const k = j*FOG_N+i; if (v > fogVis[k]) fogVis[k] = v;
    }
  }
  for (let k=0;k<fogVis.length;k++){
    const e = Math.max(fogExplored[k], Math.min(1, fogVis[k]*1.8));
    fogExplored[k] = e;
    fogData[k*4] = e*255; fogData[k*4+1] = fogVis[k]*255; fogData[k*4+2] = 0; fogData[k*4+3] = 255;
  }
  fogTex.update(fogData);
}
function isExplored(x,z){
  const i = Math.floor((x+HALF)/FOG_CELL), j = Math.floor((z+HALF)/FOG_CELL);
  if (i<0||j<0||i>=FOG_N||j>=FOG_N) return false; return fogExplored[j*FOG_N+i] > 0.35;
}
BABYLON.Effect.ShadersStore["fogOfWarFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform sampler2D fogSampler;
uniform mat4 invProj;
uniform mat4 invView;
uniform float mapSize;
uniform float time;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec4 col = texture2D(textureSampler, vUV);
  float z = texture2D(depthSampler, vUV).r;
  if (z <= 0.0 || z > 1100.0) { gl_FragColor = col; return; }
  vec4 v = invProj * vec4(vUV*2.0-1.0, 0.5, 1.0); v.xyz /= v.w;
  vec3 pv = v.xyz / v.z * z;
  vec3 w = (invView * vec4(pv, 1.0)).xyz;
  // bords irréguliers et légèrement mouvants
  vec2 wob = vec2(n2(w.xz*0.15 + time*0.05), n2(w.xz*0.15 - time*0.04 + 17.0)) - 0.5;
  vec2 fuv = (w.xz + wob*3.0 + mapSize*0.5) / mapSize;
  vec4 f = texture2D(fogSampler, fuv);
  float explored = smoothstep(0.15, 0.75, f.r);
  float visible  = smoothstep(0.1, 0.9, f.g);
  float lum = dot(col.rgb, vec3(0.3, 0.59, 0.11));
  vec3 memory = mix(vec3(lum), col.rgb, 0.35) * 0.48;
  vec3 c = mix(memory, col.rgb, visible);
  float cloud = n2(w.xz*0.05 + time*0.02)*0.5 + n2(w.xz*0.13)*0.5;
  vec3 dark = vec3(0.025, 0.024, 0.03) + vec3(0.03, 0.028, 0.03)*cloud;
  gl_FragColor = vec4(mix(dark, c, explored), col.a);
}`;
const depthRenderer = scene.enableDepthRenderer(camera, false, true, BABYLON.Texture.NEAREST_SAMPLINGMODE, true);
depthRenderer.clearColor = new BABYLON.Color4(0,0,0,1);

let tempsFog = 0;
const fogPP = new BABYLON.PostProcess("fogOfWar", "fogOfWar", ["invProj","invView","mapSize","time"], ["depthSampler","fogSampler"], 1.0, camera);
const _invP = new BABYLON.Matrix(), _invV = new BABYLON.Matrix();
fogPP.onApply = eff => {
  camera.getProjectionMatrix().invertToRef(_invP); camera.getViewMatrix().invertToRef(_invV);
  eff.setTexture("depthSampler", depthRenderer.getDepthMap());
  eff.setTexture("fogSampler", fogTex);
  eff.setMatrix("invProj", _invP); eff.setMatrix("invView", _invV);
  eff.setFloat("mapSize", MAP); eff.setFloat("time", tempsFog);
};

/* ------------------------------------------------------------
   CAMÉRA : déplacement, orbite, zoom, suivi ; clics
   ------------------------------------------------------------ */
const touches = {};
const camEtat = { suivre: null, orbiteAuto: false, cible: null, zoomCible: null };
window.addEventListener('keydown', e=>{ if (e.target.tagName==='INPUT') return; touches[e.code] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', e=>{ touches[e.code] = false; });
window.addEventListener('blur', ()=>{ for (const k in touches) touches[k]=false; });

function majCamera(dt){
  const fwd = camera.getDirection(BABYLON.Axis.Z); fwd.y = 0; fwd.normalize();
  const right = camera.getDirection(BABYLON.Axis.X); right.y = 0; right.normalize();
  let mx=0, mz=0;
  if (touches.KeyW || touches.ArrowUp) mz += 1;
  if (touches.KeyS || touches.ArrowDown) mz -= 1;
  if (touches.KeyA || touches.ArrowLeft) mx -= 1;
  if (touches.KeyD || touches.ArrowRight) mx += 1;
  if (mx || mz){ camEtat.suivre = null; camEtat.cible = null; }
  const speed = (12 + camera.radius*0.9) * dt;
  const t = camera.target;
  t.addInPlace(fwd.scale(mz*speed)).addInPlace(right.scale(mx*speed));
  if (touches.KeyQ) camera.alpha += 1.6*dt;
  if (touches.KeyE) camera.alpha -= 1.6*dt;
  if (camEtat.orbiteAuto) camera.alpha -= 0.15*dt;
  if (camEtat.suivre){
    const p = camEtat.suivre();
    BABYLON.Vector3.LerpToRef(t, new BABYLON.Vector3(p.x, p.y + 1.1, p.z), Math.min(1, dt*5), t);
  } else if (camEtat.cible){
    BABYLON.Vector3.LerpToRef(t, camEtat.cible, Math.min(1, dt*4), t);
    if (BABYLON.Vector3.Distance(t, camEtat.cible) < 0.2) camEtat.cible = null;
  } else t.y = lerp(t.y, Math.max(0, height(t.x, t.z)) + 1, Math.min(1, dt*5));
  if (camEtat.zoomCible){ camera.radius = lerp(camera.radius, camEtat.zoomCible, Math.min(1, dt*3)); if (Math.abs(camera.radius-camEtat.zoomCible) < 0.2) camEtat.zoomCible = null; }
  t.x = clamp(t.x, -HALF+20, HALF-20); t.z = clamp(t.z, -HALF+20, HALF-20);
  for (let i=0;i<6;i++){
    const p = camera.position; const gh = Math.max(0, height(p.x, p.z)) + 1.5;
    if (p.y < gh && camera.beta > camera.lowerBetaLimit){ camera.beta -= 0.02; camera.getViewMatrix(true); } else break;
  }
}

// Souris : glisser (gauche ou molette) = orbite ; clic gauche = action ; clic droit = déplacement
const clics = { surClic: null, surClicDroit: null };
let appui = null;
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('pointerdown', e=>{
  canvas.focus();
  appui = { x:e.offsetX, y:e.offsetY, cx:e.clientX, cy:e.clientY, bouton:e.button, glisse:false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e=>{
  if (!appui) return;
  if (!appui.glisse && Math.hypot(e.offsetX-appui.x, e.offsetY-appui.y) > 5 && appui.bouton !== 2) { appui.glisse = true; canvas.style.cursor = 'grabbing'; }
  if (appui.glisse){
    camera.alpha -= (e.clientX-appui.cx)*0.006;
    camera.beta = clamp(camera.beta - (e.clientY-appui.cy)*0.005, camera.lowerBetaLimit, camera.upperBetaLimit);
    appui.cx = e.clientX; appui.cy = e.clientY; camEtat.orbiteAuto = false;
  }
});
canvas.addEventListener('pointerup', e=>{
  if (!appui) return;
  const a = appui; appui = null; canvas.style.cursor = 'default';
  if (a.glisse) return;
  const pick = scene.pick(e.offsetX, e.offsetY, m => m.isPickable && m.isEnabled() && m.isVisible && m.metadata);
  if (a.bouton === 2) clics.surClicDroit?.(pick, e);
  else if (a.bouton === 0) clics.surClic?.(pick, e);
});

function projeter(v){
  const W=engine.getRenderWidth(), H=engine.getRenderHeight(), k = canvas.clientWidth/W;
  const p = BABYLON.Vector3.Project(v, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(W,H));
  return { x: p.x*k, y: p.y*k, visible: p.z > 0 && p.z < 1 };
}

return {
  engine, scene, camera, sun, hemi, lune, shadowGen, addCaster, waterMat, skyMat, cloudMat, cloudTex, pipe,
  vcMat, C, MB, paint, part, merge, makeTex, smokeTex, fireTex, makePine, makeOak, makeBush, makeMine, remplirThin,
  setHeure, majCamera, camEtat, clics, projeter, terrain,
  majBrouillard(viewers, dt){ tempsFog += dt; updateFog(viewers); }, estExplore: isExplored,
  avancerNuages(dt){ cloudTex.uOffset += dt*0.0035; cloudTex.vOffset += dt*0.0015; },
};
}
