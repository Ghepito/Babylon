// L'agent : fait le lien entre le personnage 3D et la simulation.
// Un ordre = « faire tel procédé » (ou « aller là »). L'agent marche jusqu'au bon endroit
// (le temps de jeu passe pendant la marche), lance l'action dans le moteur, puis l'anime.
import { height, smooth } from './environnement.js';

// Posture jouée pendant chaque procédé
const POSE = {
  'proc.puiser_eau': 'accroupi', 'proc.boire': 'boire', 'proc.cueillir_baies': 'cueillir', 'proc.manger_baies': 'manger',
  'proc.ramasser_champignons': 'ramasser', 'proc.manger_champignons': 'manger', 'proc.ramasser_bois_sec': 'ramasser',
  'proc.ramasser_herbes': 'ramasser', 'proc.cueillir_feuillage': 'cueillir', 'proc.ramasser_galet': 'ramasser',
  'proc.ramasser_silex': 'ramasser', 'proc.couper_branches': 'frapper', 'proc.casser_silex': 'tailler',
  'proc.tailler_eclats': 'tailler', 'proc.faconner_biface': 'tailler', 'proc.frotter_bois': 'frotter',
  'proc.essai_braise': 'frotter', 'proc.fabriquer_necessaire_feu': 'tailler', 'proc.allumer_feu': 'frotter',
  'proc.alimenter_feu': 'jeter', 'proc.charger_feu': 'jeter', 'proc.se_rechauffer': 'assis', 'proc.dormir_dehors': 'dormir',
  'proc.construire_abri': 'construire', 'proc.faire_couche': 'ramasser', 'proc.dormir_abri': 'dormir',
};
const OUTIL = new Set(['frapper', 'tailler']);
const VITESSE_MARCHE = 3.2;     // mètres par seconde réelle à la vitesse ×1

export class Agent {
  constructor(sim, rig, carte, { surEvenement } = {}) {
    this.sim = sim; this.rig = rig; this.carte = carte;
    this.x = rig.root.position.x; this.z = rig.root.position.z; this.cap = 0;
    this.ordres = [];          // {type:'procede'|'aller', procede?, x?, z?, motif?}
    this.courant = null;       // ordre en cours
    this.phase = 'repos';      // 'repos' | 'marche' | 'action'
    this.cible = null;
    this.t = 0; this.pose = 'repos'; this.poseAvant = 'repos'; this.melange = 1;
    this.surEvenement = surEvenement || (() => {});
  }

  get occupe() { return !!this.courant || this.ordres.length > 0; }

  /** Remplace ce qui est en cours par un nouvel ordre. */
  ordonner(ordre, { file = false } = {}) {
    if (!file) { this.ordres = []; this.#interrompre(); }
    this.ordres.push(ordre);
  }
  #interrompre() { if (this.phase === 'action' && this.sim.perso.action) this.sim.annuler(); this.courant = null; this.phase = 'repos'; this.cible = null; }

  /** dtReel : secondes réelles écoulées. */
  maj(dtReel) {
    const sim = this.sim;
    this.t += dtReel;
    if (!sim.perso.vivant) { this.ordres = []; this.courant = null; this.phase = 'mort'; this.#animer(dtReel); return; }
    if (sim.vitesse === 0) { this.#animer(0); return; }   // pause active : tout est figé

    if (!this.courant && this.ordres.length) this.#demarrer(this.ordres.shift());

    if (this.phase === 'marche') {
      const v = VITESSE_MARCHE * Math.min(sim.vitesse, 40) * dtReel;
      const dx = this.cible.x - this.x, dz = this.cible.z - this.z, d = Math.hypot(dx, dz);
      if (d <= Math.max(v, this.cible.rayon ?? 0.3)) {
        if (d > (this.cible.rayon ?? 0.3)) { this.x = this.cible.x - dx / d * (this.cible.rayon ?? 0.3); this.z = this.cible.z - dz / d * (this.cible.rayon ?? 0.3); }
        this.#arrive();
      } else {
        let nx = this.x + dx / d * v, nz = this.z + dz / d * v;
        if (height(nx, nz) < 0.3) {   // contourner l'eau en longeant la rive
          for (const a of [0.7, -0.7, 1.4, -1.4]) { const c = Math.cos(a), s = Math.sin(a), rx = (dx / d) * c - (dz / d) * s, rz = (dx / d) * s + (dz / d) * c;
            if (height(this.x + rx * v, this.z + rz * v) >= 0.3) { nx = this.x + rx * v; nz = this.z + rz * v; break; } }
          if (height(nx, nz) < 0.3) { this.#arrive(); }
        }
        this.cap = tourner(this.cap, Math.atan2(nx - this.x, nz - this.z), Math.min(1, dtReel * 10));
        this.x = nx; this.z = nz;
      }
    } else if (this.phase === 'action') {
      if (!sim.perso.action) { this.courant = null; this.phase = 'repos'; }   // terminée (ou interrompue par le moteur)
      else if (this.courant?.regarder) this.cap = tourner(this.cap, Math.atan2(this.courant.regarder.x - this.x, this.courant.regarder.z - this.z), Math.min(1, dtReel * 6));
    }
    this.#animer(dtReel);
  }

  #demarrer(ordre) {
    this.courant = ordre;
    if (ordre.type !== 'procede') {      // aller, prendre dans un tas, déposer dans un tas
      this.cible = { x: ordre.x, z: ordre.z, rayon: ordre.type === 'aller' ? 0.2 : 1.2 }; this.phase = 'marche'; return;
    }
    const proc = this.sim.ref.procedes.get(ordre.procede);
    const dest = this.carte.destination(proc, { x: this.x, z: this.z }, this.sim, ordre.site ?? null);
    ordre.site = dest?.site ?? ordre.site ?? null;
    ordre.lieu = dest ? { x: dest.x, z: dest.z } : { x: this.x, z: this.z };
    const d = this.sim.disponibilite(ordre.procede, this.#options(ordre, proc));
    if (!d.ok) { this.surEvenement({ type: 'refus', procede: ordre.procede, raison: d.manques[0]?.raison }); this.courant = null; return; }
    ordre.regarder = dest?.regarder ?? null;
    if (dest && Math.hypot(dest.x - this.x, dest.z - this.z) > (dest.rayon ?? 0.3) + 0.2) { this.cible = dest; this.phase = 'marche'; }
    else this.#lancer();
  }

  #arrive() {
    const o = this.courant;
    if (o?.type === 'procede') return this.#lancer();
    if (o?.type === 'prendre') this.sim.prendre(o.tas, o.id, o.q ?? Infinity);
    if (o?.type === 'deposer') this.sim.deposer(o.id, o.q ?? Infinity, { tas: o.tas });
    this.courant = null; this.phase = 'repos';
  }

  /** Site visé et tas à portée (à moins de 4 m du lieu de l'action ; la réserve du camp pour les actions au campement). */
  #options(ordre, proc) {
    const lieu = ordre.lieu ?? { x: this.x, z: this.z };
    const tas = this.sim.monde.tas.filter(t => {
      if (t.camp) return this.sim.auCamp(proc) || Math.hypot(this.carte.POS_RESERVE.x - lieu.x, this.carte.POS_RESERVE.z - lieu.z) < 6;
      return t.position && Math.hypot(t.position.x - lieu.x, t.position.z - lieu.z) < 4;
    }).map(t => t.uid);
    return { site: ordre.site ?? null, tas };
  }

  #lancer() {
    const proc = this.sim.ref.procedes.get(this.courant.procede);
    const r = this.sim.lancer(this.courant.procede, this.#options(this.courant, proc));
    if (!r.ok) { this.surEvenement({ type: 'refus', procede: this.courant.procede, raison: r.manques[0]?.raison }); this.courant = null; this.phase = 'repos'; return; }
    this.phase = 'action';
  }

  // ------------------------------------------------------------------ animation
  #animer(dt) {
    const rig = this.rig, sim = this.sim;
    let pose = 'repos';
    if (this.phase === 'mort') pose = 'mort';
    else if (this.phase === 'marche') pose = 'marche';
    else if (this.phase === 'action' && sim.perso.action) pose = POSE[sim.perso.action.procede] ?? 'travail';
    if (pose !== this.pose) { this.poseAvant = this.pose; this.pose = pose; this.melange = 0; }
    this.melange = Math.min(1, this.melange + dt * 5);

    const y = Math.max(height(this.x, this.z), 0);
    rig.root.position.set(this.x, y, this.z);
    rig.root.rotation.y = this.cap;
    const t = this.t * (sim.vitesse > 0 ? Math.min(2.2, 0.8 + sim.vitesse * 0.05) : 0) + 0.0001;
    const P = poseCible(pose, t);
    const H = rig.hips, K = rig.knees, S = rig.shoulders, E = rig.elbows;
    const m = this.melange < 1 ? 0.25 : 1;
    const app = (o, prop, v) => { o[prop] = o[prop] + (v - o[prop]) * m; };
    app(H[0].rotation, 'x', P.h0); app(H[1].rotation, 'x', P.h1); app(K[0].rotation, 'x', P.k0); app(K[1].rotation, 'x', P.k1);
    app(S[0].rotation, 'x', P.s0); app(S[1].rotation, 'x', P.s1); app(E[0].rotation, 'x', P.e0); app(E[1].rotation, 'x', P.e1);
    app(rig.body.position, 'y', P.y); app(rig.body.rotation, 'y', P.tw); app(rig.body.rotation, 'x', P.bx ?? 0);
    app(rig.body.position, 'z', P.bz ?? 0);
    app(rig.head.rotation, 'x', P.hp); app(rig.head.rotation, 'y', P.hy ?? 0);
    rig.tool.isVisible = OUTIL.has(pose);

    // Charges visibles selon ce qui est porté
    const inv = sim.perso.inventaire, porte = id => (inv[id] ?? 0) >= 0.5;
    const c = rig.charges, actif = pose !== 'dormir' && pose !== 'mort';
    c.branches.isVisible = actif && porte('res.branches_vertes');
    c.bois.isVisible = actif && !c.branches.isVisible && porte('res.bois_sec');
    c.feuillage.isVisible = actif && !c.branches.isVisible && porte('res.feuillage');
    c.sac.isVisible = actif && !c.feuillage.isVisible && (porte('res.silex_brut') || porte('res.galet'));
    c.baies.isVisible = actif && ((inv['res.baies'] ?? 0) > 0.1 || (inv['res.champignons'] ?? 0) > 0.1);
  }

  /** Position (pour la caméra). */
  get position() { return { x: this.x, y: Math.max(height(this.x, this.z), 0), z: this.z }; }
}

function tourner(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }

/** Angles des articulations pour chaque posture (t = temps d'animation). */
function poseCible(pose, t) {
  const base = { h0: 0, h1: 0, k0: 0.04, k1: 0.04, s0: 0, s1: 0, e0: -0.12, e1: -0.12, y: 0, tw: 0, hp: 0, hy: 0, bx: 0, bz: 0 };
  switch (pose) {
    case 'marche': { const w = t * 9.5, s = Math.sin(w);
      return { ...base, h0: s * 0.55, h1: -s * 0.55, k0: 0.1 + Math.max(0, Math.sin(w + 1.3)) * 0.95, k1: 0.1 + Math.max(0, Math.sin(w + 1.3 + Math.PI)) * 0.95,
        s0: -s * 0.5, s1: s * 0.5, e0: -0.35, e1: -0.35, y: Math.abs(Math.cos(w)) * 0.05 - 0.02, tw: s * 0.07, hp: 0.05 }; }
    case 'accroupi': case 'boire': { const s = Math.sin(t * 4);
      return { ...base, h0: -1.5, h1: -1.3, k0: 2.0, k1: 1.9, s0: -1.3 + s * 0.15, s1: -1.3 - s * 0.15, e0: -0.9, e1: -0.9, y: -0.42, hp: pose === 'boire' ? 0.6 : 0.4, bx: 0.35 }; }
    case 'ramasser': case 'cueillir': { const s = Math.sin(t * 5); const bas = pose === 'ramasser';
      return { ...base, h0: bas ? -0.9 : -0.2, h1: bas ? -0.5 : 0.1, k0: bas ? 1.4 : 0.2, k1: bas ? 1.0 : 0.1, s0: (bas ? -1.0 : -1.9) + s * 0.35, s1: (bas ? -1.0 : -1.9) - s * 0.35,
        e0: -0.5 - Math.max(0, s) * 0.5, e1: -0.5 - Math.max(0, -s) * 0.5, y: bas ? -0.25 : 0, hp: bas ? 0.45 : -0.2, tw: s * 0.08, bx: bas ? 0.25 : 0 }; }
    case 'manger': { const s = Math.sin(t * 3);
      return { ...base, s1: -1.6 + Math.max(0, s) * 0.4, e1: -1.6 - Math.max(0, s) * 0.3, s0: -0.4, e0: -0.9, hp: 0.15 }; }
    case 'frapper': case 'tailler': case 'construire': {
      const sp = pose === 'tailler' ? 5 : 6, ph = (t * sp) % (Math.PI * 2);
      const up = ph < 3.6 ? smooth(0, 3.6, ph) : 1 - smooth(3.6, 4.4, ph);
      if (pose === 'tailler') return { ...base, h0: -1.5, h1: -1.3, k0: 2.0, k1: 1.9, y: -0.42, bx: 0.3, s1: -0.9 - up * 1.3, e1: -0.6 - up * 0.5, s0: -1.0, e0: -0.8, hp: 0.5 };
      return { ...base, s1: -0.5 - up * 2.4, s0: (-0.5 - up * 2.4) * 0.85, e1: -0.25 - up * 0.6, e0: -0.35 - up * 0.5, h0: -0.25, h1: 0.2, k0: 0.35, k1: 0.15, hp: 0.2 - up * 0.15, tw: (1 - up) * 0.12 }; }
    case 'frotter': { const s = Math.sin(t * 14);
      return { ...base, h0: -1.5, h1: -1.3, k0: 2.0, k1: 1.9, y: -0.42, bx: 0.3, s0: -1.0 + s * 0.12, s1: -1.0 - s * 0.12, e0: -0.9, e1: -0.9, hp: 0.55 }; }
    case 'jeter': { const s = Math.sin(t * 3);
      return { ...base, h0: -0.6, h1: -0.3, k0: 0.9, k1: 0.6, y: -0.15, s0: -1.2 - s * 0.3, s1: -1.2 - s * 0.3, e0: -0.3, e1: -0.3, hp: 0.35 }; }
    case 'assis': { const s = Math.sin(t * 0.8);
      return { ...base, h0: -1.55, h1: -1.55, k0: 1.55, k1: 1.55, y: -0.5, s0: -0.9, s1: -0.9, e0: -0.6, e1: -0.6, hp: 0.15, bx: 0.1 + s * 0.02 }; }
    case 'dormir': case 'mort':
      return { ...base, bx: -Math.PI / 2, y: 0.22, bz: 0.9, h0: -0.2, h1: -0.1, k0: 0.4, k1: 0.2, s0: -0.3, s1: 0.2, e0: -0.8, e1: -0.4, hp: 0.1 + Math.sin(t * 0.7) * 0.02 };
    default: { const s = Math.sin(t * 1.5); return { ...base, s0: s * 0.04, s1: s * 0.04, y: Math.sin(t * 2) * 0.012, hy: Math.sin(t * 0.45) * 0.4 * smooth(0.3, 0.8, Math.sin(t * 0.2)) }; }
  }
}
