// La carte de la phase 1 : chaque source naturelle du référentiel reçoit des lieux dans le monde 3D,
// et les installations de la simulation (foyer, abri, couche) sont construites au campement.
import { height, hash, fbm, lerp, CAMP, LAKE, MAP } from './environnement.js';

/** Point de la rive du lac le plus proche dans une direction donnée (depuis le centre du lac). */
function pointRive(angle) {
  let r = 5;
  while (r < LAKE.r * 1.6 && height(LAKE.x + Math.cos(angle) * r, LAKE.z + Math.sin(angle) * r) < 0.55) r += 0.5;
  return { x: LAKE.x + Math.cos(angle) * r, z: LAKE.z + Math.sin(angle) * r };
}

export function creerCarte(env, ref) {
  const { scene, MB, C, part, merge, paint, vcMat, addCaster, waterMat, makePine, makeOak, makeBush, makeMine, remplirThin } = env;
  const lieux = [];                       // {source, x, z, rayon, meshes, nom}
  const pickable = (meshes, meta) => meshes.forEach(m => { m.metadata = meta; m.isPickable = true; });
  const ajouterLieu = (source, x, z, rayon, meshes, extra = {}) => {
    const lieu = { source, x, z, rayon, meshes, nom: ref.nom(source), ...extra };
    pickable(meshes, { kind: 'source', id: source, lieu });
    lieux.push(lieu); return lieu;
  };
  // Les maillages « sources » des instances restent rendus (sinon leurs instances disparaissent) : on les réduit et on les enterre.
  const cacherSource = m => { m.scaling.setAll(0.0001); m.position.set(CAMP.x, -20, CAMP.z); m.isPickable = false; return m; };
  const poser = (m, x, z, ry = 0, s = 1) => { m.position.set(x, height(x, z) - 0.05, z); m.rotation.y = ry; m.scaling.setAll(s); m.receiveShadows = true; return m; };

  // --- Lac : des points de rive tout autour
  const riveEau = [];
  for (let i = 0; i < 24; i++) { const p = pointRive(i / 24 * Math.PI * 2); riveEau.push(p); }
  const marqueurLac = MB.CreateCylinder("lacPick", { height: 0.5, diameter: LAKE.r * 2.2 }, scene);
  marqueurLac.position.set(LAKE.x, -0.2, LAKE.z); marqueurLac.visibility = 0.001;
  pickable([marqueurLac], { kind: 'source', id: 'src.lac', lieu: null });
  lieux.push({ source: 'src.lac', points: riveEau, rayon: 0.8, meshes: [marqueurLac], nom: ref.nom('src.lac') });

  // --- Arbres : une forêt à l'ouest du campement + arbres épars
  const arbres = [];
  const src = { pine: makePine(), oak: makeOak() };
  Object.values(src).forEach(m => { addCaster(m); m.receiveShadows = true; waterMat.addToRenderList(m); cacherSource(m); });
  const libre = (x, z, r) => {
    const y = height(x, z);
    if (y < 1.3 || y > 20) return false;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 13) return false;
    return !arbres.some(a => Math.hypot(a.x - x, a.z - z) < r);
  };
  // arbre dépouillé (branches et feuillage prélevés) : tronc et quelques branches
  const nuSrc = cacherSource(merge("arbreNu", [
    part(MB.CreateCylinder("t", { height: 3.2, diameterTop: 0.3, diameterBottom: 0.6, tessellation: 7 }), C(0.37, 0.26, 0.16), 0, 1.6, 0),
    ...[0, 1, 2, 3].map(i => part(MB.CreateCylinder("b", { height: 1.4, diameterTop: 0.03, diameterBottom: 0.1, tessellation: 5 }), C(0.35, 0.25, 0.15), Math.cos(i * 1.7) * 0.35, 2.6 + i * 0.25, Math.sin(i * 1.7) * 0.35, { rz: Math.cos(i * 1.7) * 0.9, rx: Math.sin(i * 1.7) * 0.9 })),
    part(MB.CreateIcoSphere("f", { radius: 0.5, subdivisions: 1 }), C(0.3, 0.42, 0.2), 0, 3.4, 0, { jitter: 0.3 }),
  ]));
  addCaster(nuSrc);
  const planter = (x, z, type) => {
    const m = src[type].createInstance("arbre" + arbres.length);
    const s = 0.8 + hash(Math.floor(x * 10), Math.floor(z * 10)) * 0.55, ry = hash(Math.floor(x * 7), Math.floor(z * 3)) * 6.28;
    poser(m, x, z, ry, s);
    const nu = poser(nuSrc.createInstance("nu" + arbres.length), x, z, ry, s); nu.isVisible = false;
    const a = { x, z, m, nu, site: 'arbre_' + arbres.length };
    arbres.push(a);
    return m;
  };
  const foret = (cx, cz, rayon, n, chene) => {
    for (let k = 0, essais = 0; k < n && essais < n * 15; essais++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * rayon, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.abs(x) > MAP / 2 - 10 || Math.abs(z) > MAP / 2 - 10 || !libre(x, z, 2.2)) continue;
      planter(x, z, Math.random() < chene ? 'oak' : 'pine'); k++;
    }
  };
  foret(-32, 0, 20, 70, 0.45);
  foret(-20, 34, 16, 40, 0.6);
  foret(30, -40, 18, 45, 0.3);
  foret(-80, -60, 35, 90, 0.4); foret(90, 70, 40, 100, 0.4); foret(-40, 100, 40, 110, 0.5); foret(110, -90, 35, 80, 0.3);
  for (let i = 0; i < 160; i++) { const x = (Math.random() - 0.5) * (MAP - 30), z = (Math.random() - 0.5) * (MAP - 30); if (fbm(x * 0.02 + 50, z * 0.02, 3) > 0.5 && libre(x, z, 3)) planter(x, z, Math.random() < 0.5 ? 'oak' : 'pine'); }
  const lieuxArbres = arbres.map(a => ({ x: a.x, z: a.z, site: a.site }));
  arbres.forEach(a => pickable([a.m, a.nu], { kind: 'source', id: 'src.arbre', site: a.site, x: a.x, z: a.z }));
  lieux.push({ source: 'src.arbre', points: lieuxArbres, rayon: 1.3, meshes: [], nom: ref.nom('src.arbre') });

  // --- Buissons de baies
  const buissonSrc = cacherSource(makeBush()); addCaster(buissonSrc);
  const buissons = [];
  for (const [cx, cz, n] of [[-9, -16, 5], [18, -20, 3], [-6, 14, 3]]) for (let i = 0; i < n; i++) {
    const x = cx + (hash(i, cx | 0) - 0.5) * 7, z = cz + (hash(cz | 0, i) - 0.5) * 7;
    const m = poser(buissonSrc.createInstance("buisson"), x, z, hash(i, 3) * 6, 0.7 + hash(i, 5) * 0.3);
    buissons.push({ x, z, m, site: 'buisson_' + buissons.length, baies: [] });
  }
  // baies visibles (proportionnelles au stock de la source)
  const baieMat = new BABYLON.StandardMaterial("baieMat", scene); baieMat.diffuseColor = C(0.78, 0.07, 0.2); baieMat.specularColor = C(0.3, 0.1, 0.1);
  const baieSrc = MB.CreateIcoSphere("baie", { radius: 0.09, subdivisions: 1 }, scene); baieSrc.material = baieMat; cacherSource(baieSrc);
  const baies = [];
  buissons.forEach((b, k) => { for (let i = 0; i < 12; i++) { const a = i * 2.4 + k, h = 0.35 + hash(i, k) * 0.7, r = 0.8 * b.m.scaling.x;
    const m = baieSrc.createInstance("b"); m.position.set(b.x + Math.cos(a) * r, b.m.position.y + h, b.z + Math.sin(a) * r); m.isPickable = false; baies.push(m); b.baies.push(m); } });
  ajouterLieu('src.buisson_baies', 0, 0, 1.4, [], { points: buissons.map(b => ({ x: b.x, z: b.z, site: b.site })) });
  buissons.forEach(b => pickable([b.m], { kind: 'source', id: 'src.buisson_baies', site: b.site, x: b.x, z: b.z }));

  // --- Bois mort : tas de branches sèches au sol, à la lisière
  const tasBois = [];
  const fabriquerTas = (i) => merge("tasBois", Array.from({ length: 9 }, (_, k) => part(MB.CreateCylinder("bm", { height: 1.2 + hash(k, i) * 1.2, diameterTop: 0.05, diameterBottom: 0.1, tessellation: 5 }), C(0.45 - hash(k, 9) * 0.1, 0.36, 0.25),
    (hash(k, 1) - 0.5) * 1.4, 0.08 + (k % 3) * 0.07, (hash(k, 2) - 0.5) * 1.4, { rz: Math.PI / 2, ry: hash(k, 4) * 3.14, jitter: 0.03 })));
  [[-15, 4], [-18, -14], [-9, 18], [24, -32], [-26, 22], [-38, 14], [12, -26]].forEach(([x, z], i) => { const m = poser(fabriquerTas(i), x, z, i); addCaster(m); tasBois.push({ x, z, m, site: 'boismort_' + i }); });
  ajouterLieu('src.bois_mort', 0, 0, 1.2, [], { points: tasBois.map(t => ({ x: t.x, z: t.z, site: t.site })) });
  tasBois.forEach(t => pickable([t.m], { kind: 'source', id: 'src.bois_mort', site: t.site, x: t.x, z: t.z }));

  // --- Sous-bois : champignons au pied des arbres
  const champs = [];
  const champMat = new BABYLON.StandardMaterial("champMat", scene); champMat.specularColor = C(0.1, 0.1, 0.1);
  const fabriquerChamps = (i) => merge("champignons", Array.from({ length: 7 }, (_, k) => {
    const x = (hash(k, i) - 0.5) * 1.6, z = (hash(i, k) - 0.5) * 1.6, h = 0.12 + hash(k, 7) * 0.12;
    return [part(MB.CreateCylinder("pied", { height: h, diameter: 0.05, tessellation: 6 }), C(0.92, 0.88, 0.8), x, h / 2, z, { flat: false }),
            part(MB.CreateSphere("chap", { diameter: 0.2, segments: 6, slice: 0.5 }), k % 2 ? C(0.62, 0.3, 0.15) : C(0.75, 0.15, 0.1), x, h, z, { flat: false, sc: [1, 0.7, 1] })];
  }).flat());
  [[-30, 6], [-36, -8], [-24, 30]].forEach(([x, z], i) => { const m = poser(fabriquerChamps(i), x, z); champs.push({ x, z, m, site: 'champ_' + i }); });
  ajouterLieu('src.sous_bois', 0, 0, 0.9, [], { points: champs.map(c => ({ x: c.x, z: c.z, site: c.site })) });
  champs.forEach(c => pickable([c.m], { kind: 'source', id: 'src.sous_bois', site: c.site, x: c.x, z: c.z }));

  // --- Prairie sèche : touffes d'herbes hautes et blondes
  const PRAIRIE = { x: -2, z: -32, r: 10 };
  const touffe = merge("touffe", Array.from({ length: 9 }, (_, i) => { const a = i * 2.3, h = 0.6 + hash(i, 21) * 0.5;
    return part(MB.CreateCylinder("t", { height: h, diameterTop: 0, diameterBottom: 0.06, tessellation: 3 }), C(0.78, 0.68, 0.38), Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12, { rx: (hash(i, 22) - 0.5) * 0.7, rz: (hash(i, 23) - 0.5) * 0.7, flat: false }); }));
  const herbeMat = new BABYLON.StandardMaterial("herbeSeche", scene); herbeMat.specularColor = C(0, 0, 0); herbeMat.backFaceCulling = false; herbeMat.twoSidedLighting = true;
  touffe.material = herbeMat;
  remplirThin(touffe, 1500, PRAIRIE.r * 2.2, (x, y, z) => Math.hypot(x - PRAIRIE.x, z - PRAIRIE.z) < PRAIRIE.r * (0.8 + fbm(x * 0.2, z * 0.2, 2) * 0.4), PRAIRIE, [0.8, 1.5]);
  const prairiePick = MB.CreateDisc("prairiePick", { radius: PRAIRIE.r, tessellation: 24 }, scene);
  prairiePick.rotation.x = Math.PI / 2; prairiePick.position.set(PRAIRIE.x, height(PRAIRIE.x, PRAIRIE.z) + 0.4, PRAIRIE.z); prairiePick.visibility = 0.001;
  ajouterLieu('src.prairie', PRAIRIE.x, PRAIRIE.z, PRAIRIE.r * 0.6, [prairiePick]);

  // --- Galets : une plage de galets sur la rive la plus proche du campement
  const ang = Math.atan2(CAMP.z - LAKE.z, CAMP.x - LAKE.x) + 0.35;
  const plage = pointRive(ang);
  const galetMat = new BABYLON.StandardMaterial("galet", scene); galetMat.diffuseColor = C(0.6, 0.6, 0.58); galetMat.specularColor = C(0.15, 0.15, 0.15);
  const galetSrc = MB.CreateSphere("galet", { diameter: 0.25, segments: 6 }, scene); galetSrc.material = galetMat; cacherSource(galetSrc);
  const galets = [];
  for (let i = 0; i < 70; i++) { const a = hash(i, 31) * 6.28, d = Math.sqrt(hash(i, 32)) * 3.2, x = plage.x + Math.cos(a) * d, z = plage.z + Math.sin(a) * d;
    const g = galetSrc.createInstance("g"); g.position.set(x, Math.max(height(x, z), 0.05) + 0.05, z); g.scaling.set(0.6 + hash(i, 33), 0.4 + hash(i, 34) * 0.3, 0.6 + hash(i, 35)); g.rotation.y = a; galets.push(g); }
  const plagePick = MB.CreateDisc("plagePick", { radius: 3.5, tessellation: 16 }, scene);
  plagePick.rotation.x = Math.PI / 2; plagePick.position.set(plage.x, Math.max(height(plage.x, plage.z), 0.05) + 0.3, plage.z); plagePick.visibility = 0.001;
  ajouterLieu('src.riviere_galets', plage.x, plage.z, 1.5, [plagePick, ...galets]);

  // --- Affleurement de silex
  const silexMat = new BABYLON.StandardMaterial("silex", scene); silexMat.specularColor = C(0.35, 0.35, 0.4); silexMat.specularPower = 40;
  const affleurements = [[-20, -30], [26, 12]].map(([x, z], i) => {
    const m = makeMine('stone'); poser(m, x, z, i * 2); addCaster(m);
    const nod = merge("rognons", Array.from({ length: 8 }, (_, k) => part(MB.CreateIcoSphere("n", { radius: 0.18 + hash(k, i) * 0.12, subdivisions: 1 }), C(0.22, 0.24, 0.3), (hash(k, 41) - 0.5) * 3, 0.2, (hash(k, 42) - 0.5) * 3, { jitter: 0.08 })));
    nod.material = silexMat; poser(nod, x, z, i * 2); nod.parent = null;
    return { x, z, meshes: [m, nod] };
  });
  ajouterLieu('src.affleurement_silex', 0, 0, 2.6, [], { points: affleurements.map((a, i) => ({ x: a.x, z: a.z, site: 'silex_' + i })) });
  affleurements.forEach((a, i) => pickable(a.meshes, { kind: 'source', id: 'src.affleurement_silex', site: 'silex_' + i, x: a.x, z: a.z }));

  // =========================================================================
  // INSTALLATIONS du campement, synchronisées avec la simulation
  // =========================================================================
  const POS_INST = {
    'ins.foyer': { x: CAMP.x, z: CAMP.z, ry: 0 },
    'ins.abri_branchages': { x: CAMP.x - 4.5, z: CAMP.z + 3.5, ry: 2.4 },
    'ins.couche_feuillage': { x: CAMP.x - 4.2, z: CAMP.z + 3.2, ry: 2.4 },
  };
  const V = (x, y, z) => new BABYLON.Vector3(x, y, z);
  function fabriquerFoyer() {
    const P = [];
    for (let i = 0; i < 10; i++) { const a = i * 0.628; P.push(part(MB.CreateIcoSphere("st", { radius: 0.22, subdivisions: 1 }), C(0.5, 0.49, 0.46), Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75, { jitter: 0.1, sc: [1, 0.7, 1] })); }
    P.push(part(MB.CreateCylinder("cendre", { height: 0.05, diameter: 1.3, tessellation: 12 }), C(0.15, 0.13, 0.12), 0, 0.03, 0));
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; const m = MB.CreateCylinder("lg", { height: 1.0, diameter: 0.11, tessellation: 6 });
      m.position.set(Math.cos(a) * 0.25, 0.22, Math.sin(a) * 0.25); m.rotation.y = -a; m.rotation.z = 1.1; P.push(paint((m.bakeCurrentTransformIntoVertices(), m), C(0.3, 0.2, 0.12), 0.02)); }
    return merge("foyer", P);
  }
  function fabriquerAbri() {
    const P = [];
    const pole = (a, b, d, col) => { const dir = b.subtract(a), len = dir.length(); dir.normalize(); const m = MB.CreateCylinder("p", { height: len, diameter: d, tessellation: 5 });
      m.position = a.add(b).scale(0.5); m.rotationQuaternion = new BABYLON.Quaternion(); BABYLON.Quaternion.FromUnitVectorsToRef(BABYLON.Vector3.Up(), dir, m.rotationQuaternion); m.bakeCurrentTransformIntoVertices(); return paint(m, col, 0.02); };
    const bois = C(0.36, 0.26, 0.16);
    P.push(pole(V(-1.6, 0, 0.9), V(-1.6, 1.8, 0.9), 0.1, bois), pole(V(1.6, 0, 0.9), V(1.6, 1.8, 0.9), 0.1, bois), pole(V(-1.8, 1.75, 0.9), V(1.8, 1.75, 0.9), 0.09, bois));
    for (let i = 0; i < 7; i++) { const x = -1.5 + i * 0.5; P.push(pole(V(x, 1.75, 0.9), V(x, 0, -1.3), 0.06, bois)); }
    const toit = MB.CreateBox("toit", { width: 3.6, height: 0.25, depth: 2.9 }); toit.position.set(0, 0.9, -0.2); toit.rotation.x = -0.69; toit.bakeCurrentTransformIntoVertices();
    P.push(paint(toit, C(0.3, 0.46, 0.2), 0.25));
    // touffes de feuillage sur la toiture
    for (let i = 0; i < 21; i++) { const u = (i % 7) / 6 - 0.5, v = (Math.floor(i / 7) - 1) * 0.36, k = hash(i, 77);
      P.push(part(MB.CreateIcoSphere("f", { radius: 0.4 + k * 0.15, subdivisions: 1 }), C(0.26 + k * 0.08, 0.44 + k * 0.08, 0.18), u * 3.2 + (k - 0.5) * 0.3, 0.9 + v * 1.7 + 0.12, -0.2 + v * 2.2, { jitter: 0.12, rx: -0.69, sc: [1.2, 0.45, 1] })); }
    return merge("abri", P);
  }
  function fabriquerCouche() {
    const m = MB.CreateBox("couche", { width: 2.0, height: 0.18, depth: 0.9 }); m.position.y = 0.09; m.bakeCurrentTransformIntoVertices();
    return merge("couche", [paint(m, C(0.36, 0.5, 0.22), 0.18)]);
  }
  const FABRIQUE = { 'ins.foyer': fabriquerFoyer, 'ins.abri_branchages': fabriquerAbri, 'ins.couche_feuillage': fabriquerCouche };
  const vues = new Map();   // uid -> {mesh, feu?}

  // Feu : flammes, braises, fumée, lumière
  const feuSys = new BABYLON.ParticleSystem("feu", 300, scene);
  feuSys.particleTexture = env.fireTex;
  feuSys.minEmitBox = V(-0.25, 0, -0.25); feuSys.maxEmitBox = V(0.25, 0.1, 0.25);
  feuSys.color1 = new BABYLON.Color4(1, 0.65, 0.2, 1); feuSys.color2 = new BABYLON.Color4(1, 0.4, 0.1, 1); feuSys.colorDead = new BABYLON.Color4(0.3, 0.05, 0, 0);
  feuSys.minLifeTime = 0.3; feuSys.maxLifeTime = 0.8; feuSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  feuSys.direction1 = V(-0.15, 1, -0.15); feuSys.direction2 = V(0.15, 1, 0.15); feuSys.updateSpeed = 0.016;
  feuSys.addSizeGradient(0, 0.5); feuSys.addSizeGradient(1, 0.1);
  const fumee = new BABYLON.ParticleSystem("fumee", 200, scene);
  fumee.particleTexture = env.smokeTex; fumee.minEmitBox = V(-0.2, 0, -0.2); fumee.maxEmitBox = V(0.2, 0, 0.2);
  fumee.colorDead = new BABYLON.Color4(0.6, 0.6, 0.6, 0); fumee.minSize = 0.5; fumee.maxSize = 1.1; fumee.minLifeTime = 3; fumee.maxLifeTime = 6;
  fumee.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD; fumee.gravity = V(0.25, 0.5, 0.1);
  fumee.direction1 = V(-0.1, 0.8, -0.1); fumee.direction2 = V(0.2, 1.2, 0.2); fumee.minEmitPower = 0.3; fumee.maxEmitPower = 0.7; fumee.updateSpeed = 0.016;
  fumee.addSizeGradient(0, 0.5); fumee.addSizeGradient(1, 3.2);
  fumee.color1 = new BABYLON.Color4(0.75, 0.75, 0.75, 0.3); fumee.color2 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.22);
  const lumiereFeu = new BABYLON.PointLight("lumiereFeu", V(0, 0, 0), scene);
  lumiereFeu.diffuse = new BABYLON.Color3(1, 0.55, 0.2); lumiereFeu.specular = new BABYLON.Color3(0, 0, 0); lumiereFeu.range = 16; lumiereFeu.intensity = 0;

  function synchroniser(sim, t) {
    const presents = new Set();
    for (const ins of sim.monde.installations) {
      presents.add(ins.uid);
      if (!vues.has(ins.uid)) {
        const p = POS_INST[ins.id] ?? { x: CAMP.x + 3, z: CAMP.z - 3, ry: 0 };
        const mesh = FABRIQUE[ins.id] ? FABRIQUE[ins.id]() : MB.CreateBox(ins.id, { size: 1 }, scene);
        poser(mesh, p.x, p.z, p.ry); addCaster(mesh); waterMat.addToRenderList(mesh);
        pickable([mesh], { kind: 'installation', id: ins.id, x: p.x, z: p.z });
        vues.set(ins.uid, { mesh, id: ins.id, x: p.x, z: p.z });
        if (ins.id === 'ins.foyer') {
          const y = height(p.x, p.z) + 0.15;
          feuSys.emitter = V(p.x, y, p.z); fumee.emitter = V(p.x, y + 1, p.z); lumiereFeu.position = V(p.x, y + 0.8, p.z);
          feuSys.start(); fumee.start();
        }
      }
      if (ins.id === 'ins.foyer') {
        const cap = ref.attr('ins.foyer', 'capacite_kg', 12);
        const k = ins.allume ? Math.min(1, 0.25 + ins.combustible / cap) : 0;
        feuSys.emitRate = ins.allume ? 30 + 200 * k : 2;
        feuSys.minSize = 0.12 + 0.2 * k; feuSys.maxSize = 0.25 + 0.55 * k;
        feuSys.minEmitPower = 0.3 + 0.6 * k; feuSys.maxEmitPower = 0.5 + 1.3 * k;
        fumee.emitRate = ins.allume ? 10 + 10 * k : 4;
        lumiereFeu.intensity = ins.allume ? (0.4 + 1.1 * k) * (1 + Math.sin(t * 13) * 0.1 + Math.sin(t * 29) * 0.06) : 0;
      }
    }
    for (const [uid, v] of vues) if (!presents.has(uid)) { v.mesh.dispose(); vues.delete(uid); if (v.id === 'ins.foyer') { feuSys.stop(); fumee.stop(); lumiereFeu.intensity = 0; } }

    // État de chaque site : baies restantes, arbres dépouillés, tas de bois mort, champignons
    const frac = (src, site) => { const x = sim.site(src, site); return x ? (x.max === Infinity ? 1 : x.stock / x.max) : 1; };
    for (const b of buissons) { const n = Math.round(b.baies.length * Math.min(1, frac('src.buisson_baies', b.site))); b.baies.forEach((m, i) => { m.isVisible = i < n; }); }
    for (const a of arbres) { const nu = frac('src.arbre', a.site) < 0.25; if (a.m.isVisible === nu) { a.m.isVisible = !nu; a.nu.isVisible = nu; } }
    for (const t of tasBois) { const f = frac('src.bois_mort', t.site); t.m.scaling.setAll(Math.max(0.05, 0.35 + 0.65 * f)); t.m.isVisible = f > 0.02; t.m.isPickable = true; }
    for (const c of champs) { const f = frac('src.sous_bois', c.site); c.m.isVisible = f > 0.05; c.m.scaling.setAll(0.4 + 0.6 * f); }
    synchroniserTas(sim);
  }

  // =========================================================================
  // TAS AU SOL et RÉSERVE DU CAMP
  // =========================================================================
  const POS_RESERVE = { x: CAMP.x + 3.2, z: CAMP.z - 2.8 };
  const vuesTas = new Map();   // uid -> {mesh, sig}
  function fabriquerTasSol(t) {
    const P = [], c = t.contenu, a = (k) => (c[k] ?? 0);
    let n = 0;
    const bois = a('res.bois_sec') + a('res.branches_vertes');
    for (let i = 0; i < Math.min(16, Math.ceil(bois / 1.2)); i++, n++) P.push(part(MB.CreateCylinder("l", { height: 1.1, diameter: 0.14, tessellation: 6 }), i % 3 ? C(0.42, 0.3, 0.18) : C(0.36, 0.42, 0.2), (i % 2 - 0.5) * 0.3, 0.08 + Math.floor(i / 2) * 0.11, (i % 5 - 2) * 0.13, { rz: Math.PI / 2, jitter: 0.02 }));
    if (a('res.feuillage') > 0.1) { P.push(part(MB.CreateIcoSphere("f", { radius: 0.35 + Math.min(0.4, a('res.feuillage') * 0.05), subdivisions: 1 }), C(0.3, 0.48, 0.2), 0.7, 0.2, 0, { jitter: 0.1, sc: [1, 0.5, 1] })); n++; }
    const pierres = a('res.silex_brut') + a('res.galet') * 0.5;
    for (let i = 0; i < Math.min(8, Math.ceil(pierres)); i++, n++) P.push(part(MB.CreateIcoSphere("p", { radius: 0.12, subdivisions: 1 }), i % 2 ? C(0.25, 0.27, 0.32) : C(0.6, 0.6, 0.58), -0.6 + (i % 3) * 0.15, 0.1, -0.3 + Math.floor(i / 3) * 0.15, { jitter: 0.04 }));
    const vivres = a('res.baies') + a('res.champignons');
    if (vivres > 0.05) { P.push(part(MB.CreateIcoSphere("v", { radius: 0.18, subdivisions: 1 }), C(0.32, 0.45, 0.2), -0.2, 0.15, 0.55, { jitter: 0.04 })); P.push(part(MB.CreateIcoSphere("b", { radius: 0.06, subdivisions: 0 }), C(0.75, 0.08, 0.2), -0.2, 0.3, 0.55)); n++; }
    for (let i = 0; i < Math.min(4, t.objets.length); i++, n++) P.push(part(MB.CreateBox("o", { width: 0.25, height: 0.08, depth: 0.15 }), C(0.45, 0.45, 0.5), 0.3, 0.05, 0.5 + i * 0.2));
    if (!n || t.camp) P.push(part(MB.CreateCylinder("socle", { height: 0.04, diameter: t.camp ? 2.4 : 1.2, tessellation: 14 }), C(0.4, 0.33, 0.24), 0, 0.02, 0));
    return merge("tas", P);
  }
  function synchroniserTas(sim) {
    const presents = new Set();
    for (const t of sim.monde.tas) {
      presents.add(t.uid);
      const pos = t.camp ? POS_RESERVE : (t.position ?? POS_RESERVE);
      const sig = JSON.stringify([t.contenu, t.objets.length].map(x => typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Math.ceil(v)])) : x));
      const v = vuesTas.get(t.uid);
      if (v && v.sig === sig) continue;
      if (v) v.mesh.dispose();
      const mesh = poser(fabriquerTasSol(t), pos.x, pos.z, 0.4); addCaster(mesh);
      pickable([mesh], { kind: 'tas', uid: t.uid, x: pos.x, z: pos.z });
      vuesTas.set(t.uid, { mesh, sig });
    }
    for (const [uid, v] of vuesTas) if (!presents.has(uid)) { v.mesh.dispose(); vuesTas.delete(uid); }
  }

  /** Déclare dans la simulation un site par arbre, buisson, tas de bois mort, coin à champignons, affleurement. */
  function enregistrerSites(sim) {
    for (const l of lieux) if (l.points?.some(p => p.site)) sim.definirSites(l.source, l.points.map(p => p.site));
  }

  /** Où aller pour un procédé (ou null si l'action se fait sur place). */
  function destination(proc, depuis, sim, siteVise = null) {
    const besoin = Math.max(0.0001, proc.produit.filter(x => ref.type(x.id) === 'ressource').reduce((a, x) => a + x.q, 0));
    const plusProche = (points, src) => points.reduce((best, p) => {
      if (p.site && sim && src && (sim.site(src, p.site)?.stock ?? Infinity) + 1e-9 < besoin) return best;   // site épuisé : on cherche plus loin
      const d = Math.hypot(p.x - depuis.x, p.z - depuis.z); return d < best.d ? { p, d } : best; }, { p: null, d: Infinity }).p;
    const s = proc.requiert.find(id => ref.type(id) === 'source');
    if (s) {
      const l = lieux.find(x => x.source === s); if (!l) return null;
      let p = siteVise ? l.points?.find(q => q.site === siteVise) : null;
      p ??= l.points ? (plusProche(l.points, s) ?? plusProche(l.points, null)) : { x: l.x, z: l.z };
      return { x: p.x, z: p.z, rayon: l.rayon, regarder: p, site: p.site ?? null };
    }
    const ins = proc.requiert.find(id => ref.type(id) === 'installation') ?? proc.entretient[0];
    if (ins && POS_INST[ins]) { const p = POS_INST[ins]; return { x: p.x, z: p.z, rayon: ins === 'ins.foyer' ? 1.6 : 0.3, regarder: p }; }
    const construit = proc.produit.find(s => ref.type(s.id) === 'installation');
    if (construit && POS_INST[construit.id]) { const p = POS_INST[construit.id]; return { x: p.x, z: p.z, rayon: 2.2, regarder: p }; }
    return null;
  }

  return { lieux, synchroniser, destination, enregistrerSites, POS_INST, POS_RESERVE, plage, arbres };
}
