// Modèles 3D : le personnage détaillé (repris de la démo 3) et les éléments du monde de la phase 1.
// Chaque fonction reçoit l'environnement (env) créé par creerEnvironnement().

export function creerPersonnage(env, { female = false, nom = 'Arok' } = {}) {
  const { scene, MB, C, part, merge, addCaster } = env;
  const charMat = new BABYLON.StandardMaterial("charMat_" + nom, scene);
  charMat.specularColor = C(0.06,0.05,0.04); charMat.specularPower = 24;
  const shade = (c,k) => new BABYLON.Color3(c.r*k, c.g*k, c.b*k);
  const smoothP = (mesh, color, x,y,z, o={}) => part(mesh, color, x,y,z, Object.assign({flat:false}, o));
  const charMesh = (name, parts, parent) => { const m = merge(name, parts); m.material = charMat; m.parent = parent; return m; };
  const skin = C(0.78,0.56,0.42), hair = C(0.2,0.13,0.08), fur = C(0.48,0.34,0.21), fur2 = shade(fur, 0.78), rope = C(0.5,0.4,0.25);
  const id = nom;
  const root = new BABYLON.TransformNode("perso_" + nom, scene);
  const body = new BABYLON.TransformNode("corps_" + nom, scene); body.parent = root;
  const meshes = []; const reg = m => { meshes.push(m); return m; };
  const node = (n, parent, x, y, z) => { const t = new BABYLON.TransformNode(n, scene); t.parent = parent; t.position.set(x,y,z); return t; };

  // ---- jambes : hanche → genou ----
  const hips = [], knees = [];
  [-1, 1].forEach(sx=>{
    const hip = node("hip", body, sx*0.11, 0.93, 0);
    reg(charMesh("thigh", [
      smoothP(MB.CreateCapsule("c",{height:0.52, radius:0.078, tessellation:10}), skin, 0,-0.22,0),
      part(MB.CreateCylinder("fw",{height:0.22, diameterTop:0.2, diameterBottom:0.22, tessellation:9}), fur, 0,-0.07,0, {jitter:0.03}),
    ], hip));
    const knee = node("knee", hip, 0, -0.45, 0);
    reg(charMesh("shin", [
      smoothP(MB.CreateCapsule("c",{height:0.48, radius:0.064, tessellation:10}), skin, 0,-0.21,0),
      part(MB.CreateCylinder("wrap",{height:0.14, diameterTop:0.15, diameterBottom:0.17, tessellation:8}), fur2, 0,-0.36,0, {jitter:0.02}),
      part(MB.CreateBox("foot",{width:0.12, height:0.08, depth:0.24}), fur2, 0,-0.44,0.05, {jitter:0.02}),
      smoothP(MB.CreateTorus("lace",{diameter:0.155, thickness:0.015, tessellation:10}), rope, 0,-0.33,0),
    ], knee));
    hips.push(hip); knees.push(knee);
  });

  // ---- buste & vêtement en peau ----
  const torsoParts = [
    smoothP(MB.CreateCapsule("chest",{height:0.66, radius:0.2, tessellation:12}), skin, 0,1.2,0, {sc:[1,1,0.72]}),
    part(MB.CreateCylinder("tunic",{height:0.52, diameterTop:0.47, diameterBottom:0.58, tessellation:12}), fur, 0,1.0,0, {jitter:0.04, sc:[1,1,0.82]}),
    part(MB.CreateCylinder("fringe",{height:0.1, diameterTop:0.58, diameterBottom:0.64, tessellation:14}), fur2, 0,0.71,0, {jitter:0.05, sc:[1,1,0.84]}),
    smoothP(MB.CreateTorus("belt",{diameter:0.5, thickness:0.045, tessellation:16}), rope, 0,0.95,0, {sc:[1,1,0.84]}),
    part(MB.CreateBox("pouch",{width:0.12, height:0.14, depth:0.07}), fur2, 0.24,0.88,0.06, {jitter:0.02, ry:0.4}),
    part(MB.CreateIcoSphere("tooth",{radius:0.025, subdivisions:0}), C(0.95,0.93,0.85), 0,1.38,0.155, {sc:[0.6,1.4,0.6]}),
    smoothP(MB.CreateTorus("neck",{diameter:0.2, thickness:0.012, tessellation:12}), rope, 0,1.46,0.03, {rx:0.5}),
    smoothP(MB.CreateCylinder("neckS",{height:0.14, diameter:0.13, tessellation:10}), skin, 0,1.53,0),
  ];
  if (female){
    torsoParts.push(part(MB.CreateCylinder("top",{height:0.3, diameterTop:0.42, diameterBottom:0.48, tessellation:12}), fur, 0,1.3,0, {jitter:0.03, sc:[1,1,0.8]}));
  } else {
    // bandoulière en fourrure sur l'épaule gauche
    torsoParts.push(part(MB.CreateBox("strap",{width:0.16, height:0.7, depth:0.4}), fur, -0.07,1.25,0, {rz:-0.62, jitter:0.04}));
  }
  reg(charMesh("torso", torsoParts, body));

  // ---- tête ----
  const head = node("head", body, 0, 1.57, 0);
  const H = [
    smoothP(MB.CreateSphere("skull",{diameter:0.28, segments:14}), skin, 0,0.14,0, {sc:[0.92,1.05,1]}),
    smoothP(MB.CreateSphere("jaw",{diameter:0.2, segments:10}), skin, 0,0.05,0.04, {sc:[1,0.72,1]}),
    smoothP(MB.CreateSphere("brow",{diameter:0.25, segments:10}), shade(skin,0.93), 0,0.185,0.075, {sc:[1,0.28,0.5]}),
    smoothP(MB.CreateSphere("nose",{diameter:0.075, segments:8}), shade(skin,0.96), 0,0.11,0.135, {sc:[1.1,1,1.15]}),
    smoothP(MB.CreateSphere("lips",{diameter:0.07, segments:8}), shade(skin,0.82), 0,0.055,0.125, {sc:[1.3,0.45,0.6]}),
  ];
  [-1,1].forEach(s=>{
    H.push(smoothP(MB.CreateSphere("ear",{diameter:0.075, segments:8}), shade(skin,0.95), s*0.132,0.13,-0.005, {sc:[0.45,1,0.75]}));
    H.push(smoothP(MB.CreateSphere("eye",{diameter:0.048, segments:8}), C(0.95,0.93,0.9), s*0.052,0.145,0.112));
    H.push(smoothP(MB.CreateSphere("iris",{diameter:0.026, segments:6}), C(0.18,0.12,0.08), s*0.052,0.145,0.133));
    H.push(part(MB.CreateBox("eyebrow",{width:0.07, height:0.016, depth:0.03}), shade(hair,0.9), s*0.053,0.183,0.128, {rz:-s*0.12}));
    H.push(smoothP(MB.CreateSphere("cheek",{diameter:0.08, segments:6}), shade(skin,0.97), s*0.065,0.085,0.09, {sc:[1,0.8,0.8]}));
  });
  H.push(part(MB.CreateIcoSphere("hair",{radius:0.155, subdivisions:2}), hair, 0,0.215,-0.045, {jitter:0.05, sc:[1.06,0.9,1.06]}));
  if (female){
    H.push(part(MB.CreateIcoSphere("hairL",{radius:0.13, subdivisions:2}), hair, 0,0.02,-0.11, {jitter:0.05, sc:[1.15,2.1,0.6]}));
    [-1,1].forEach(s=>H.push(part(MB.CreateIcoSphere("hairS",{radius:0.06, subdivisions:1}), hair, s*0.13,0.06,-0.03, {jitter:0.02, sc:[0.7,2.2,0.8]})));
    H.push(smoothP(MB.CreateTorus("band",{diameter:0.3, thickness:0.02, tessellation:16}), C(0.6,0.25,0.15), 0,0.2,-0.01, {rx:-0.25, sc:[1,1,1.05]}));
  } else {
    H.push(part(MB.CreateIcoSphere("beard",{radius:0.115, subdivisions:2}), hair, 0,0.02,0.07, {jitter:0.04, sc:[1.12,1.05,0.75]}));
    H.push(part(MB.CreateIcoSphere("mous",{radius:0.05, subdivisions:1}), hair, 0,0.08,0.13, {jitter:0.015, sc:[1.6,0.5,0.6]}));
    H.push(part(MB.CreateIcoSphere("hairB",{radius:0.12, subdivisions:1}), hair, 0,0.1,-0.11, {jitter:0.04, sc:[1.1,1.2,0.6]}));
  }
  reg(charMesh("head", H, head));

  // ---- bras : épaule → coude ----
  const shoulders = [], elbows = [];
  [-1, 1].forEach(sx=>{
    const sh = node("sh", body, sx*0.26, 1.42, 0); sh.rotation.z = sx*0.1;
    const up = [ smoothP(MB.CreateCapsule("c",{height:0.36, radius:0.062, tessellation:10}), skin, 0,-0.15,0) ];
    if (!female && sx===-1) up.push(part(MB.CreateCylinder("cap",{height:0.18, diameter:0.17, tessellation:9}), fur, 0,-0.04,0, {jitter:0.03}));
    up.push(smoothP(MB.CreateTorus("arml",{diameter:0.13, thickness:0.016, tessellation:10}), rope, 0,-0.2,0));
    reg(charMesh("upArm", up, sh));
    const el = node("elbow", sh, 0, -0.3, 0);
    reg(charMesh("foreArm", [
      smoothP(MB.CreateCapsule("c",{height:0.32, radius:0.053, tessellation:10}), skin, 0,-0.13,0),
      part(MB.CreateCylinder("wrist",{height:0.06, diameter:0.11, tessellation:8}), fur2, 0,-0.22,0),
      smoothP(MB.CreateSphere("hand",{diameter:0.11, segments:8}), skin, 0,-0.3,0.01, {sc:[0.75,1.1,0.95]}),
      smoothP(MB.CreateCapsule("thumb",{height:0.07, radius:0.018, tessellation:6}), skin, -sx*0.035,-0.28,0.045, {rx:0.6}),
    ], el));
    shoulders.push(sh); elbows.push(el);
  });

  // ---- outil : hache de pierre (main droite) ----
  const toolNode = node("tool", elbows[1], 0, -0.3, 0.02);
  const tool = reg(charMesh("axe", [
    part(MB.CreateCylinder("handle",{height:0.62, diameterTop:0.035, diameterBottom:0.045, tessellation:6}), C(0.42,0.3,0.18), 0,0.05,0, {jitter:0.01}),
    part(MB.CreateIcoSphere("blade",{radius:0.075, subdivisions:1}), C(0.42,0.43,0.45), 0,0.33,0.06, {jitter:0.03, sc:[0.55,1,1.6]}),
    smoothP(MB.CreateTorus("bind",{diameter:0.065, thickness:0.02, tessellation:8}), rope, 0,0.3,0),
  ], toolNode));
  toolNode.rotation.x = Math.PI/2;

  // ---- charges portées (visibles selon l'inventaire) ----
  const charges = {
    bois: reg(charMesh("chBois", [0,1,2,3].map(i=>part(MB.CreateCylinder("lg",{height:0.9, diameter:0.09+i*0.01, tessellation:7}), C(0.42-i*0.03,0.3,0.18), (i%2-0.5)*0.08, 1.48+Math.floor(i/2)*0.08, -0.2+(i-1.5)*0.03, {rz:Math.PI/2+(i-1.5)*0.1, jitter:0.02})), body)),
    branches: reg(charMesh("chBranches", [0,1,2,3,4].map(i=>part(MB.CreateCylinder("br",{height:1.6, diameterTop:0.02, diameterBottom:0.06, tessellation:5}), C(0.4,0.32,0.18), (i-2)*0.05, 1.3, -0.22, {rx:1.2+(i-2)*0.08, rz:(i-2)*0.15})).concat([part(MB.CreateIcoSphere("fe",{radius:0.3, subdivisions:1}), C(0.25,0.45,0.18), 0,1.75,-0.85, {jitter:0.1, sc:[1,0.6,1.3]})]), body)),
    feuillage: reg(charMesh("chFeuillage", [part(MB.CreateIcoSphere("fl",{radius:0.32, subdivisions:1}), C(0.28,0.48,0.2), 0,1.25,-0.28, {jitter:0.08, sc:[1.1,1.1,0.8]})], body)),
    sac: reg(charMesh("chSac", [part(MB.CreateIcoSphere("sk",{radius:0.17, subdivisions:1}), shade(fur,0.9), 0,1.12,-0.25, {jitter:0.05, sc:[1,1.1,0.8]}),
      ...[0,1,2].map(i=>part(MB.CreateIcoSphere("st",{radius:0.06, subdivisions:0}), C(0.55,0.55,0.53), (i-1)*0.08, 1.29, -0.25, {jitter:0.02}))], body)),
    baies: reg(charMesh("chBaies", [part(MB.CreateIcoSphere("bs",{radius:0.15, subdivisions:1}), C(0.32,0.45,0.2), 0.28,0.92,0.05, {jitter:0.04}),
      ...[0,1,2,3].map(i=>part(MB.CreateIcoSphere("b",{radius:0.035, subdivisions:0}), C(0.72,0.08,0.18), 0.28+Math.cos(i*1.6)*0.07, 1.05, 0.05+Math.sin(i*1.6)*0.07))], body)),
  };
  Object.values(charges).forEach(m => m.isVisible = false);
  tool.isVisible = false;

  // ---- anneau de sélection ----
  const matRing = new BABYLON.StandardMaterial("ring_" + nom, scene); matRing.emissiveColor = C(0.45,1,0.4); matRing.disableLighting = true; matRing.alpha = 0.8;
  const ring = MB.CreateTorus("ring",{diameter:1.15, thickness:0.06, tessellation:28}, scene);
  ring.material = matRing; ring.parent = root; ring.position.y = 0.06; ring.isPickable = false;

  meshes.forEach(m => addCaster(m));
  const rig = { root, body, head, hips, knees, shoulders, elbows, tool, charges, ring, meshes, nom };
  meshes.forEach(m => { m.metadata = { kind: 'perso', ref: rig }; });
  return rig;
}
