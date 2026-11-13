// Babylon — palier 3 : le survivant solitaire en 3D.
// Assemble le moteur (src/sim), l'environnement 3D, la carte, le personnage et l'interface.
import { Simulation, IA, Referentiel, palierDe } from './sim/index.js';
import { creerEnvironnement, CAMP, height } from './render/environnement.js';
import { creerCarte } from './render/carte.js';
import { creerPersonnage } from './render/personnage-modele.js';
import { Agent } from './render/agent.js';

const $ = id => document.getElementById(id);
const fmt = q => (Math.round(q * 100) / 100).toLocaleString('fr-FR');
const CLE = 'babylon.jeu.sauvegarde.v1';
const IMPORTANTS = new Set(['connaissance', 'decouverte', 'feu_eteint', 'besoin_critique', 'mort', 'objet_casse', 'installation_detruite', 'effet', 'competence', 'surcharge', 'debut']);

function chargement(msg) { $('loadmsg').textContent = msg; }
function echec(msg) { $('loadmsg').textContent = 'Impossible de démarrer'; $('err').textContent = msg; }

async function demarrer() {
  if (typeof BABYLON === 'undefined') return echec("Babylon.js n'a pas pu être chargé (connexion internet nécessaire).");
  let json;
  try { json = await (await fetch('data/referentiel.json', { cache: 'no-store' })).json(); }
  catch { return echec("Lecture de data/referentiel.json impossible : ouvrez le jeu via GitHub Pages ou un serveur local."); }
  const REF = new Referentiel(json);

  chargement('Création du monde…');
  const env = creerEnvironnement($('c'));
  const carte = creerCarte(env, REF);
  const rig = creerPersonnage(env, { nom: 'Arok' });

  let sim, ia, agent, desabonner = () => {};
  function nouvellePartie(etat) {
    desabonner();
    sim = etat ? Simulation.restaurer(REF, etat.sim) : new Simulation(REF, { graine: Math.floor(Math.random() * 1e6), nom: 'Arok', heureDepart: 8 });
    ia = new IA(sim);
    carte.enregistrerSites(sim);   // un stock par arbre, buisson, tas de bois mort… (les valeurs sauvegardées sont conservées)
    const depart = etat?.agent ?? { x: CAMP.x + 2, z: CAMP.z - 2, cap: 0 };
    rig.root.position.set(depart.x, height(depart.x, depart.z), depart.z);
    agent = new Agent(sim, rig, carte, { surEvenement: e => { if (e.type === 'refus') toast(`${REF.nom(e.procede)} : ${e.raison}`); } });
    agent.x = depart.x; agent.z = depart.z; agent.cap = depart.cap ?? 0;
    desabonner = sim.ecouter(ev => {
      if (['decouverte', 'connaissance'].includes(ev.type)) annonce(ev.message, 'decouverte');
      if (ev.type === 'mort') annonce(ev.message, 'mort');
      if (ev.type === 'feu_eteint') annonce('🔥 ' + ev.message, 'alerte');
      if (ev.type === 'besoin_critique') toast('⚠️ ' + ev.message);
    });
    $('journal').innerHTML = ''; dernierJournal = 0;
    env.camEtat.suivre = () => agent.position; env.camEtat.zoomCible = 22;
    majVitesses(); rendreHUD(true);
  }

  // ------------------------------------------------------------ interface : vitesse, IA, sauvegarde
  const VITESSES = [[0, '⏸'], [1, '×1'], [5, '×5'], [20, '×20'], [60, '×60']];
  $('vitesses').innerHTML = VITESSES.map(([v, l]) => `<button data-v="${v}" title="${v === 0 ? 'Pause active (Espace)' : '1 s réelle = ' + v + ' min de jeu'}">${l}</button>`).join('');
  $('vitesses').onclick = e => { const b = e.target.closest('button'); if (b) { sim.vitesse = Number(b.dataset.v); majVitesses(); } };
  function majVitesses() { document.querySelectorAll('#vitesses button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === sim.vitesse)); }
  let vitesseAvantPause = 1;
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); if (sim.vitesse) { vitesseAvantPause = sim.vitesse; sim.vitesse = 0; } else sim.vitesse = vitesseAvantPause; majVitesses(); }
    if (e.code === 'KeyF') basculerSuivi();
    if (e.code === 'Escape') fermerMenu();
    if (e.code === 'KeyI') $('ia').click();
  });
  $('bSuivre').onclick = basculerSuivi;
  function basculerSuivi() { env.camEtat.suivre = env.camEtat.suivre ? null : () => agent.position; $('bSuivre').classList.toggle('on', !!env.camEtat.suivre); }
  $('bSauver').onclick = () => { try { localStorage.setItem(CLE, JSON.stringify({ sim: sim.exporterEtat(), agent: { x: agent.x, z: agent.z, cap: agent.cap } })); toast('💾 Partie sauvegardée dans ce navigateur'); } catch { toast('Sauvegarde impossible ici'); } };
  $('bCharger').onclick = () => { try { const e = JSON.parse(localStorage.getItem(CLE)); if (!e) return toast('Aucune sauvegarde'); nouvellePartie(e); toast('📂 Partie reprise'); } catch { toast('Reprise impossible'); } };
  $('bNouvelle').onclick = () => nouvellePartie();
  $('bAide').onclick = () => $('aide').classList.toggle('cache');
  $('aideX').onclick = () => $('aide').classList.add('cache');

  // ------------------------------------------------------------ ordres du joueur
  function reprendreLaMain() { if ($('ia').checked) { $('ia').checked = false; toast('IA autonome désactivée : vous reprenez la main'); } }
  function ordonner(procede, file = false, site = null) {
    fermerMenu(); reprendreLaMain();
    agent.ordonner({ type: 'procede', procede, site }, { file });
    rendreHUD(true);
  }
  // Procédés liés à un élément du monde
  function procedesPour(meta) {
    return sim.procedesConnus().filter(p => {
      if (meta.kind === 'source') return p.requiert.includes(meta.id);
      if (meta.kind === 'installation') return p.requiert.includes(meta.id) || p.entretient.includes(meta.id) || p.utilise.flat().includes(meta.id) || p.optionnels.includes(meta.id)
        || (meta.id === 'ins.foyer' && p.produit.some(s => s.id === 'ins.foyer'));
      return false;
    });
  }
  env.clics.surClic = (pick, ev) => {
    const meta = pick?.hit ? pick.pickedMesh.metadata : null;
    if (meta && (meta.kind === 'source' || meta.kind === 'installation')) return ouvrirMenu(meta, ev);
    if (meta?.kind === 'tas') return ouvrirMenuTas(meta, ev);
    if (meta?.kind === 'perso') return ouvrirMenuPerso(ev);
    fermerMenu();
    if (pick?.hit && pick.pickedPoint && height(pick.pickedPoint.x, pick.pickedPoint.z) > 0.3) {
      if ($('ia').checked) { $('ia').checked = false; toast('IA autonome désactivée : vous reprenez la main'); }
      agent.ordonner({ type: 'aller', x: pick.pickedPoint.x, z: pick.pickedPoint.z });
    }
  };
  env.clics.surClicDroit = env.clics.surClic;

  function ouvrirMenu(meta, ev) {
    const nomEl = REF.nom(meta.id);
    let corps = '';
    if (meta.kind === 'source') {
      const x = meta.site ? sim.site(meta.id, meta.site) : Object.values(sim.monde.sources[meta.id]?.sites ?? {})[0];
      const u = REF.get(meta.id).attributs?.unite_stock ?? '';
      corps += `<div class="info">${x ? (x.stock === Infinity ? 'Inépuisable' : x.stock < 0.05 ? `Épuisé ici — repousse peu à peu (${fmt(x.repousse)} ${u}/jour)` : `Disponible ici : ${fmt(Math.round(x.stock * 10) / 10)} ${u}`) : 'Absent de ce monde'}</div>`;
    } else {
      const ins = sim.installation(meta.id);
      if (ins?.allume !== undefined) corps += `<div class="info">${ins.allume ? `🔥 Allumé — ${fmt(ins.combustible)} kg de bois (≈ ${fmt(ins.combustible / 1.5)} h)` : '❄️ Éteint'}</div>`;
      else if (ins) corps += `<div class="info">Usure ${Math.round(ins.usure)} %</div>`;
    }
    const procs = procedesPour(meta);
    corps += procs.length ? procs.map(p => boutonAction(p, meta.site)).join('') : `<div class="info">Aucune action connue ici… pour l'instant.</div>`;
    afficherMenu(nomEl, corps, ev);
  }
  function ouvrirMenuTas(meta, ev) {
    const t = sim.tas(meta.uid); if (!t) return;
    const lignes = Object.entries(t.contenu).map(([id, q]) => `<button class="act" data-prendre="${t.uid}|${id}">Prendre ${REF.nom(id).toLowerCase()}<small>${fmt(Math.round(q * 100) / 100)} ${REF.get(id).unite}${REF.get(id).unite !== 'kg' ? ` · ${fmt(Math.round(q * sim.masseUnitaire(id) * 10) / 10)} kg` : ''}</small></button>`)
      .concat(t.objets.map(o => `<button class="act" data-prendre="${t.uid}|${o.id}">Prendre ${REF.nom(o.id).toLowerCase()}<small>usure ${Math.round(o.usure)} %</small></button>`));
    const deposables = Object.entries(sim.perso.inventaire).map(([id, q]) => `<button class="act" data-deposer="${t.uid}|${id}">Déposer ${REF.nom(id).toLowerCase()}<small>${fmt(Math.round(q * 100) / 100)} ${REF.get(id).unite} portés</small></button>`)
      .concat([...new Set(sim.perso.objets.map(o => o.id))].map(id => `<button class="act" data-deposer="${t.uid}|${id}">Déposer ${REF.nom(id).toLowerCase()}</button>`));
    afficherMenu(t.camp ? 'Réserve du camp' : 'Tas au sol',
      `<div class="info">${t.camp ? 'Ce qui est ici sert directement aux constructions et au feu du campement.' : 'Ce qui est ici sert aux actions faites à proximité.'}</div>${lignes.join('') || '<div class="info">Vide</div>'}${deposables.length ? '<div class="info" style="margin-top:8px">Déposer ici :</div>' + deposables.join('') : ''}`, ev);
  }
  function ouvrirMenuPerso(ev) {
    const surPlace = sim.procedesConnus().filter(p => !carte.destination(p, agent, sim));
    afficherMenu(`${sim.perso.nom}`, surPlace.map(boutonAction).join(''), ev);
  }
  function boutonAction(p, site = null) {
    const d = sim.disponibilite(p.id, { site, tas: sim.monde.tas.filter(t => t.camp && sim.auCamp(p)).map(t => t.uid) });
    return `<button class="act ${d.ok ? '' : 'ko'}" data-proc="${p.id}"${site ? ` data-site="${site}"` : ''}>${p.nom}<small>${d.ok ? `${duree(sim.dureeEffective(p.id))} · ${resume(p)}` : d.manques.map(m => m.raison).join(' · ')}</small></button>`;
  }
  function afficherMenu(titre, corps, ev) {
    const m = $('menu');
    $('bulle').style.display = 'none';
    m.innerHTML = `<div class="titre">${titre}<span class="x" id="menuX">✕</span></div>${corps}`;
    m.style.display = 'block';
    const W = innerWidth, H = innerHeight, r = m.getBoundingClientRect();
    m.style.left = Math.min(ev.clientX + 12, W - r.width - 10) + 'px';
    m.style.top = Math.min(ev.clientY - 10, H - r.height - 10) + 'px';
    $('menuX').onclick = fermerMenu;
  }
  function fermerMenu() { $('menu').style.display = 'none'; }
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-proc]'); if (!b) return;
    if (b.classList.contains('ko')) { toast(b.querySelector('small')?.textContent || b.title); return; }
    ordonner(b.dataset.proc, e.shiftKey, b.dataset.site || null);
  });
  // Tas au sol : prendre / déposer (Arok s'y rend)
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-prendre],button[data-deposer]'); if (!b) return;
    const [uid, id] = (b.dataset.prendre ?? b.dataset.deposer).split('|');
    const t = sim.tas(Number(uid)); if (!t) return;
    const pos = t.camp ? carte.POS_RESERVE : t.position;
    reprendreLaMain(); fermerMenu();
    agent.ordonner({ type: b.dataset.prendre ? 'prendre' : 'deposer', tas: t.uid, id, x: pos.x, z: pos.z }, { file: e.shiftKey });
  });
  // Poser là où se trouve Arok (dans la réserve s'il est au campement)
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-poser]'); if (!b) return;
    const pos = { x: agent.x, z: agent.z };
    if (Math.hypot(pos.x - CAMP.x, pos.z - CAMP.z) < 9) sim.deposer(b.dataset.poser, Infinity, { camp: true });
    else {
      const proche = sim.monde.tas.find(t => !t.camp && t.position && Math.hypot(t.position.x - pos.x, t.position.z - pos.z) < 2.5);
      sim.deposer(b.dataset.poser, Infinity, proche ? { tas: proche.uid } : { position: pos });
    }
    rendreHUD(true);
  });

  // Survol : nom de l'élément sous la souris
  let survolT = 0;
  $('c').addEventListener('pointermove', e => {
    const n = performance.now(); if (n - survolT < 120) return; survolT = n;
    const p = env.scene.pick(e.offsetX, e.offsetY, m => m.isPickable && m.isVisible && m.metadata && m.metadata.kind !== 'ground');
    const meta = p?.hit ? p.pickedMesh.metadata : null, bulle = $('bulle');
    if (meta && meta.kind !== 'ground') {
      bulle.textContent = meta.kind === 'perso' ? `${sim.perso.nom} — actions sur place` : meta.kind === 'tas' ? (sim.tas(meta.uid)?.camp ? 'Réserve du camp — cliquer' : 'Tas au sol — cliquer')
        : `${REF.nom(meta.id)}${meta.site && sim.site(meta.id, meta.site)?.stock < 0.05 ? ' (épuisé)' : ''} — cliquer pour agir`;
      bulle.style.display = 'block'; bulle.style.left = (e.clientX + 14) + 'px'; bulle.style.top = (e.clientY + 14) + 'px';
      $('c').style.cursor = 'pointer';
    } else { bulle.style.display = 'none'; $('c').style.cursor = 'default'; }
  });

  // ------------------------------------------------------------ messages
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 2600); }
  function annonce(msg, genre) {
    const a = document.createElement('div'); a.className = 'annonce ' + genre; a.textContent = msg;
    $('annonces').appendChild(a); setTimeout(() => a.classList.add('part'), 3800); setTimeout(() => a.remove(), 4600);
  }

  // ------------------------------------------------------------ HUD
  const COULEURS = { 'bes.soif': '#5fb7e8', 'bes.faim': '#e8a23a', 'bes.repos': '#9b7fe0', 'bes.chaleur': '#e2553b', 'bes.securite': '#7bc47f', 'bes.sante': '#f2c14e' };
  let dernierJournal = 0, sigActions = '';
  function rendreHUD(force) {
    const p = sim.perso;
    $('horloge').textContent = sim.horloge;
    $('meteo').textContent = `${sim.nuit ? '🌙' : '☀️'} ${Math.round(sim.temperature)} °C`;
    $('nom').textContent = p.nom + (p.vivant ? '' : ' ☠️');
    $('besoins').innerHTML = REF.parType('besoin').map(b => {
      const v = p.besoins[b.id], crit = v < (b.attributs?.critique_sous ?? 15);
      return `<div class="besoin${crit ? ' crit' : ''}"><span>${b.nom}</span><div class="barre"><i style="width:${v}%;background:${COULEURS[b.id]}"></i></div><b>${Math.round(v)}</b></div>`;
    }).join('');
    const ch = sim.charge, cap = sim.capacite;
    $('charge').innerHTML = `<span>Charge</span><div class="barre"><i style="width:${Math.min(100, ch / cap * 100)}%;background:${ch > cap * 0.9 ? '#e2553b' : '#c9a227'}"></i></div><b>${fmt(Math.round(ch * 10) / 10)}/${cap} kg</b>`;
    const a = p.action;
    let texte = 'Se repose';
    if (!p.vivant) texte = 'Mort';
    else if (agent.phase === 'marche') texte = agent.courant?.type === 'procede' ? `Se rend sur place : ${REF.nom(agent.courant.procede).toLowerCase()}` : 'Marche';
    else if (a) texte = REF.nom(a.procede);
    $('action').innerHTML = `<b>${texte}</b>${a ? `<div class="barre"><i style="width:${a.ecoule / a.duree * 100}%;background:var(--gold)"></i></div>` : ''}${$('ia').checked && ia.motif ? `<div class="motif">IA : ${ia.motif}</div>` : ''}${agent.ordres.length ? `<div class="motif">Ensuite : ${agent.ordres.map(o => o.procede ? REF.nom(o.procede) : 'aller').join(', ')}</div>` : ''}`;

    // Barre d'actions (toutes les actions connues ; celles « ailleurs » font marcher le personnage)
    const connus = sim.procedesConnus();
    const sig = connus.map(pr => pr.id + sim.disponibilite(pr.id).ok).join('|');
    if (sig !== sigActions || force) {
      sigActions = sig;
      $('actions').innerHTML = connus.map(pr => {
        const d = sim.disponibilite(pr.id), loin = !!carte.destination(pr, agent, sim);
        return `<button class="act mini ${d.ok ? '' : 'ko'}" data-proc="${pr.id}" title="${d.ok ? (loin ? 'Il ira sur place' : 'Sur place') + ' · ' + duree(sim.dureeEffective(pr.id)) + ' · ' + resume(pr) : d.manques.map(m => m.raison).join('\n')}">${loin ? '🚶 ' : ''}${pr.nom}</button>`;
      }).join('');
      const inconnues = REF.procedes.size - connus.length;
      $('inconnues').textContent = inconnues ? `❔ ${inconnues} action(s) à découvrir` : '✔ tout est découvert';
    }
    // Panneau de droite
    $('inventaire').innerHTML = Object.entries(p.inventaire).map(([id, q]) => `<li><span>${REF.nom(id)}</span><span>${fmt(q)} ${REF.get(id).unite}<button class="poser" data-poser="${id}" title="Poser au sol">⤓</button></span></li>`).join('') || '<li class="muted">Rien</li>';
    const parType = {}; for (const o of p.objets) (parType[o.id] ??= []).push(o.usure);
    $('objets').innerHTML = Object.entries(parType).map(([id, u]) => `<li><span>${REF.nom(id)}${u.length > 1 ? ' ×' + u.length : ''}</span><span class="muted">usure ${Math.round(Math.max(...u))} %</span></li>`).join('') || '<li class="muted">Aucun</li>';
    const res = sim.reserveCamp;
    $('reserve').innerHTML = res ? (Object.entries(res.contenu).map(([id, q]) => `<li><span>${REF.nom(id)}</span><span>${fmt(Math.round(q * 100) / 100)} ${REF.get(id).unite}</span></li>`).join('')
      + res.objets.map(o => `<li><span>${REF.nom(o.id)}</span><span class="muted">usure ${Math.round(o.usure)} %</span></li>`).join('') || '<li class="muted">Vide</li>') : '<li class="muted">Pas encore de réserve (poser ⤓ au campement)</li>';
    $('savoirs').innerHTML = [...p.connait].map(id => `<span class="tag ${REF.type(id) === 'technique' ? 'tech' : 'con'}">${REF.nom(id)}</span>`).join('');
    $('competences').innerHTML = Object.entries(p.competences).filter(([, v]) => v > 0.05).sort((x, y) => y[1] - x[1])
      .map(([id, v]) => `<li><span>${REF.nom(id)}</span><span class="muted">${Math.floor(v)} · ${palierDe(v)}</span></li>`).join('') || '<li class="muted">Tout est à apprendre</li>';
    // Journal
    const nouveaux = sim.journal.slice(dernierJournal); dernierJournal = sim.journal.length;
    for (const e of nouveaux) {
      if (!IMPORTANTS.has(e.type) && !(e.type === 'action_fin' && e.produits?.length)) continue;
      const d = document.createElement('div'); d.className = e.type; d.innerHTML = `<span class="t">${e.horloge.replace('Jour ', 'J')}</span>${e.message}`;
      $('journal').prepend(d);
    }
    while ($('journal').children.length > 60) $('journal').lastChild.remove();
    $('mortBox').style.display = p.vivant ? 'none' : 'flex';
    if (!p.vivant) $('mortMsg').textContent = sim.journal.find(e => e.type === 'mort')?.message ?? '';
  }
  function duree(s) { return s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`; }
  function resume(pr) {
    const parts = [];
    if (pr.produit.length) parts.push('→ ' + pr.produit.map(s => REF.nom(s.id).toLowerCase()).join(', '));
    const sat = Object.keys(pr.satisfait); if (sat.length) parts.push('+ ' + sat.map(id => REF.nom(id).toLowerCase()).join(', '));
    if (pr.debloque.some(c => !sim.perso.connait.has(c))) parts.push('🔬 expérience');
    return parts.join(' · ');
  }
  $('mortNouvelle').onclick = () => nouvellePartie();

  // ------------------------------------------------------------ boucle
  nouvellePartie();
  let tHUD = 0, tCiel = 0, tFog = 0, tIA = 0, tRendu = 0;
  env.scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(0.1, env.engine.getDeltaTime() / 1000);
    tRendu += dt;
    sim.avancer(dt);
    if ($('ia').checked && sim.vitesse > 0 && !agent.occupe && sim.perso.vivant && (tIA -= dt) <= 0) {
      tIA = 0.2;
      const c = ia.choisir();
      if (c) { ia.motif = c.motif; agent.ordonner({ type: 'procede', procede: c.procede, motif: c.motif }); }
    }
    agent.maj(dt);
    carte.synchroniser(sim, tRendu);
    if ((tCiel -= dt) <= 0) { tCiel = 0.1; env.setHeure(sim.heure); }
    if ((tFog -= dt) <= 0) {
      tFog = 0.15;
      const vues = [[agent.x, agent.z, 24]];
      if (sim.monde.installations.length) vues.push([CAMP.x, CAMP.z, 20]);
      env.majBrouillard(vues, 0.15);
    }
    env.avancerNuages(dt * Math.max(1, Math.min(sim.vitesse, 20)));
    env.majCamera(dt);
    if ((tHUD -= dt) <= 0) { tHUD = 0.2; rendreHUD(); }
  });
  env.setHeure(sim.heure);
  env.scene.executeWhenReady(() => { const l = $('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 900); });
  env.engine.runRenderLoop(() => env.scene.render());
  window.addEventListener('resize', () => env.engine.resize());
  window.__jeu = { get sim() { return sim; }, get agent() { return agent; }, get ia() { return ia; }, env, carte, ordonner };
}

demarrer().catch(e => { console.error(e); echec(e.message); });
