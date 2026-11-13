// Moteur de simulation Babylon — palier 2.
// Indépendant de la 3D et du DOM : tourne dans le navigateur comme dans Node (tests).
//
// Le temps est compté en secondes de jeu. À la vitesse ×1, une seconde réelle = une minute de jeu
// (une journée dure 24 minutes réelles). Vitesse 0 = pause active.

import { Referentiel } from './referentiel.js';
import { Aleatoire } from './aleatoire.js';
import { REGLES, palierDe } from './regles.js';

export const SECONDES_JEU_PAR_SECONDE = 60;
const PAS_MAX = 30;            // pas d'intégration (s de jeu)

export class Simulation {
  /**
   * @param {object|Referentiel} referentiel  JSON exporté ou Referentiel déjà compilé
   * @param {{scenario?:string, graine?:number, nom?:string, heureDepart?:number}} options
   */
  constructor(referentiel, options = {}) {
    this.ref = referentiel instanceof Referentiel ? referentiel : new Referentiel(referentiel);
    const { scenario = 'solitaire', graine = 1, nom = 'Arok', heureDepart = 8 } = options;
    this.options = { scenario, graine, nom, heureDepart };
    this.alea = new Aleatoire(graine);
    this.temps = heureDepart * 3600;
    this.vitesse = 1;
    this.journal = [];
    this.ecouteurs = new Set();
    this.uid = 0;

    const dep = this.ref.depart[scenario];
    if (!dep) throw new Error(`Scénario inconnu : ${scenario}`);
    const connait = dep.filter(id => ['technique', 'connaissance'].includes(this.ref.type(id)));
    const monde = dep.filter(id => this.ref.type(id) === 'source');

    this.monde = {
      sources: Object.fromEntries(monde.map(id => {
        const a = this.ref.get(id).attributs || {};
        const illimite = a.stock === 'illimite';
        return [id, { stock: illimite ? Infinity : (a.stock ?? 10), max: illimite ? Infinity : (a.stock ?? 10), repousse: a.repousse_par_jour ?? 0 }];
      })),
      installations: [],   // {uid, id, usure, combustible?, allume?}
      sol: {},             // ce qui a été laissé au sol (déchets, surplus) : id -> quantité
    };

    this.perso = {
      nom,
      vivant: true,
      besoins: Object.fromEntries(this.ref.parType('besoin').map(b => [b.id, REGLES.besoinsDepart[b.id] ?? 80])),
      inventaire: {},       // ressources en lots : id -> quantité
      objets: [],           // objets individualisés : {uid, id, usure}
      connait: new Set(connait),
      competences: Object.fromEntries(this.ref.parType('competence').map(c => [c.id, 0])),
      action: null,         // {procede, ecoule, duree, satisfaitApplique}
      file: [],             // actions en attente
      alertes: {},          // besoin -> déjà signalé critique
    };
    this.noter('debut', `${nom} s'éveille seul au bord d'un lac.`);
  }

  // ---------------------------------------------------------------- temps
  get jour() { return Math.floor(this.temps / 86400) + 1; }
  get heure() { return (this.temps % 86400) / 3600; }
  get horloge() {
    const h = Math.floor(this.heure), m = Math.floor((this.heure % 1) * 60);
    return `Jour ${this.jour}, ${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  }
  /** Température ambiante (°C) : 22 °C vers 15 h, 6 °C vers 3 h. */
  get temperature() { return 14 + 8 * Math.cos((this.heure - 15) / 24 * 2 * Math.PI); }
  get nuit() { const h = this.heure; return h < 6 || h >= 21; }

  /** Avance selon le temps réel écoulé (en secondes), en tenant compte de la vitesse. */
  avancer(dtReel) { if (this.vitesse > 0) this.avancerJeu(dtReel * this.vitesse * SECONDES_JEU_PAR_SECONDE); }

  /** Avance d'une durée de jeu (en secondes), par petits pas. */
  avancerJeu(dt) {
    while (dt > 0 && this.perso.vivant) {
      const pas = Math.min(PAS_MAX, dt);
      this.#pas(pas);
      dt -= pas;
    }
  }

  #pas(dt) {
    this.temps += dt;
    this.#majMonde(dt);
    this.#majBesoins(dt);
    this.#majAction(dt);
  }

  // ---------------------------------------------------------------- monde
  #majMonde(dt) {
    const jours = dt / 86400;
    for (const s of Object.values(this.monde.sources))
      if (s.stock < s.max) s.stock = Math.min(s.max, s.stock + s.repousse * jours);

    for (const ins of [...this.monde.installations]) {
      const a = this.ref.get(ins.id).attributs || {};
      if (ins.allume) {
        ins.combustible -= (a.consommation_kg_par_heure ?? 0) * dt / 3600;
        if (ins.combustible <= 0) {
          ins.combustible = 0; ins.allume = false;
          this.noter('feu_eteint', `Le feu s'est éteint faute de bois.`, { installation: ins.id });
        }
      }
      const usureJour = this.ref.propriete(ins.id, 'degradation', 'usure_par_jour');
      if (usureJour) {
        ins.usure += usureJour * jours;
        if (ins.usure >= 100) {
          this.monde.installations.splice(this.monde.installations.indexOf(ins), 1);
          this.noter('installation_detruite', `${this.ref.nom(ins.id)} s'est effondré(e), usé(e) par le temps.`, { installation: ins.id });
        }
      }
    }
  }

  installation(id) { return this.monde.installations.find(i => i.id === id); }
  /** Une installation « utilisable » : un foyer doit être allumé. */
  installationActive(id) {
    const i = this.installation(id);
    return !!i && (i.allume === undefined || i.allume);
  }

  // ---------------------------------------------------------------- besoins
  #majBesoins(dt) {
    const p = this.perso, h = dt / 3600, B = p.besoins;
    const dort = p.action && REGLES.actionsSommeil.includes(p.action.procede);
    for (const b of this.ref.parType('besoin')) {
      let baisse = (b.attributs?.baisse_par_heure ?? 0) * h;
      if (dort && b.id !== 'bes.chaleur') baisse *= REGLES.facteurBesoinsSommeil;
      if (b.id === 'bes.chaleur') baisse = this.#variationChaleur(h);
      if (b.id === 'bes.repos' && p.action && !dort) baisse *= 1.2;   // l'activité fatigue
      B[b.id] = clamp(B[b.id] - baisse, 0, 100);
    }
    // Santé : se dégrade quand un besoin vital est épuisé, se rétablit lentement sinon
    const S = REGLES.sante;
    let dSante = 0;
    for (const [besoin, perte] of Object.entries(S.pertesParHeure)) if (B[besoin] <= 0) dSante -= perte * h;
    if (dSante === 0 && S.besoinsBienEtre.every(id => B[id] >= S.seuilBienEtre)) dSante = S.recuperationParHeure * h;
    B['bes.sante'] = clamp(B['bes.sante'] + dSante, 0, 100);

    for (const b of this.ref.parType('besoin')) {
      const seuil = b.attributs?.critique_sous ?? 15;
      if (B[b.id] < seuil && !p.alertes[b.id]) { p.alertes[b.id] = true; this.noter('besoin_critique', `${b.nom} critique !`, { besoin: b.id }); }
      if (B[b.id] >= seuil + 10) p.alertes[b.id] = false;
    }
    if (B['bes.sante'] <= 0 && p.vivant) {
      p.vivant = false; p.action = null; p.file = [];
      const cause = Object.keys(S.pertesParHeure).filter(id => B[id] <= 0).map(id => this.ref.nom(id).toLowerCase()).join(', ');
      this.noter('mort', `${p.nom} est mort (${cause || 'épuisement'}). ${this.horloge}.`);
    }
  }

  /** Variation de chaleur (positive = refroidissement) selon la température ressentie. */
  #variationChaleur(h) {
    const C = REGLES.chaleur;
    let t = this.temperature;
    if (this.installationActive('ins.foyer')) t += C.bonusFoyer;
    if (this.installation('ins.abri_branchages')) t += C.bonusAbri;
    const baisse = this.ref.attr('bes.chaleur', 'baisse_par_heure', 4);
    return baisse * clamp((C.temperatureConfort - t) / C.amplitude, -1.5, 2) * h;
  }

  // ---------------------------------------------------------------- possessions
  quantite(id) {
    const t = this.ref.type(id);
    if (t === 'ressource') return this.perso.inventaire[id] ?? 0;
    if (t === 'objet') return this.perso.objets.filter(o => o.id === id).length;
    if (t === 'installation') return this.monde.installations.filter(i => i.id === id).length;
    if (t === 'technique' || t === 'connaissance') return this.perso.connait.has(id) ? 1 : 0;
    if (t === 'source') return this.monde.sources[id] ? 1 : 0;
    return 0;
  }
  possede(id, q = 1) { return this.quantite(id) >= q - 1e-9; }

  niveau(competence) { return this.perso.competences[competence] ?? 0; }

  /** Masse d'une unité (kg) : 1 pour ce qui se compte en kg, sinon la propriété physique.masse_unitaire. */
  masseUnitaire(id) {
    const e = this.ref.get(id);
    if (e?.unite === 'kg') return 1;
    return Number(this.ref.propriete(id, 'physique', 'masse_unitaire') ?? 0);
  }
  /** Charge portée (kg). */
  get charge() {
    let c = 0;
    for (const [id, q] of Object.entries(this.perso.inventaire)) c += q * this.masseUnitaire(id);
    for (const o of this.perso.objets) c += this.masseUnitaire(o.id);
    return c;
  }
  get capacite() { return REGLES.transport.capaciteKg; }

  /** Poser au sol une quantité d'une ressource portée (ou un objet). */
  deposer(id, q = Infinity) {
    const t = this.ref.type(id);
    if (t === 'ressource') {
      const n = Math.min(q, this.perso.inventaire[id] ?? 0); if (n <= 0) return 0;
      this.#retirer(id, n); this.monde.sol[id] = (this.monde.sol[id] ?? 0) + n;
      this.noter('depot', `${this.perso.nom} pose ${fmt(Math.round(n * 100) / 100)} ${this.#unite(id)} de ${this.ref.nom(id).toLowerCase()}.`, { ressource: id });
      return n;
    }
    if (t === 'objet') {
      const o = this.perso.objets.filter(x => x.id === id).sort((a, b) => b.usure - a.usure)[0]; if (!o) return 0;
      this.perso.objets.splice(this.perso.objets.indexOf(o), 1); this.monde.sol[id] = (this.monde.sol[id] ?? 0) + 1;
      this.noter('depot', `${this.perso.nom} pose ${this.ref.nom(id).toLowerCase()}.`, { objet: id });
      return 1;
    }
    return 0;
  }

  // ---------------------------------------------------------------- actions
  /** Procédés que le personnage connaît (sa technique est connue). */
  procedesConnus() {
    return [...this.ref.procedes.values()].filter(p => this.perso.connait.has(p.technique));
  }

  /**
   * Peut-on exécuter ce procédé maintenant ? Renvoie les manques détaillés (pour l'interface et l'IA).
   * @returns {{ok:boolean, manques:{id:string, raison:string, quantite?:number}[]}}
   */
  disponibilite(procId) {
    const p = this.ref.procedes.get(procId);
    if (!p) return { ok: false, manques: [{ id: procId, raison: 'procédé inconnu' }] };
    const manques = [];
    if (!this.perso.vivant) manques.push({ id: 'vivant', raison: 'le personnage est mort' });
    if (!this.perso.connait.has(p.technique)) manques.push({ id: p.technique, raison: `technique non découverte : ${this.ref.nom(p.technique)}` });
    for (const id of p.requiert) {
      const t = this.ref.type(id);
      if (t === 'source') {
        const s = this.monde.sources[id];
        if (!s) manques.push({ id, raison: `pas de ${this.ref.nom(id).toLowerCase()} dans ce monde` });
        else if (s.stock <= 0.0001 || (this.#prelevement(p) > s.stock + 1e-9)) manques.push({ id, raison: `${this.ref.nom(id)} épuisé(e) pour l'instant` });
      } else if (t === 'installation') {
        if (!this.installationActive(id)) manques.push({ id, raison: this.installation(id) ? `${this.ref.nom(id)} éteint` : `il faut un(e) ${this.ref.nom(id).toLowerCase()}` });
      } else if (!this.possede(id)) manques.push({ id, raison: `il faut savoir : ${this.ref.nom(id)}` });
    }
    for (const c of p.consomme)
      if (!this.possede(c.id, c.q)) manques.push({ id: c.id, quantite: c.q, raison: `il faut ${fmt(c.q)} ${this.#unite(c.id)} de ${this.ref.nom(c.id).toLowerCase()} (${fmt(this.quantite(c.id))})` });
    for (const g of p.utilise)
      if (!g.some(id => this.possede(id))) manques.push({ id: g[0], alternatives: g, raison: `il faut : ${g.map(id => this.ref.nom(id).toLowerCase()).join(' ou ')}` });
    const apport = p.produit.filter(s => this.ref.type(s.id) === 'ressource' || this.ref.type(s.id) === 'objet')
      .reduce((a, s) => a + s.q * this.masseUnitaire(s.id), 0)
      - p.consomme.reduce((a, c) => a + c.q * this.masseUnitaire(c.id), 0);
    if (apport > 0.001 && this.charge + Math.min(apport, 0.5) > this.capacite + 1e-9)
      manques.push({ id: 'transport', raison: `trop chargé (${fmt(Math.round(this.charge * 10) / 10)} / ${this.capacite} kg)` });
    if (p.condition && !this.#condition(p.condition))
      manques.push({ id: p.condition.competence ?? 'condition', condition: p.condition, raison: texteCondition(p.condition, this) });
    return { ok: manques.length === 0, manques };
  }

  #prelevement(p) { return p.produit.filter(s => this.ref.type(s.id) === 'ressource').reduce((a, s) => a + s.q, 0); }
  #unite(id) { return this.ref.get(id)?.unite ?? ''; }

  #condition(c) {
    if (c == null) return true;
    if (typeof c === 'string') return this.possede(c);
    if (Array.isArray(c)) return c.every(x => this.#condition(x));
    if (c.et) return c.et.every(x => this.#condition(x));
    if (c.ou) return c.ou.some(x => this.#condition(x));
    if (c.non) return !this.#condition(c.non);
    if (c.competence) return this.niveau(c.competence) >= (c.min ?? 0);
    return true;
  }

  /** Durée réelle d'un procédé : un novice est plus lent qu'un expert. */
  dureeEffective(procId) {
    const p = this.ref.procedes.get(procId);
    const comp = this.ref.competenceDe.get(p.technique);
    const n = comp ? this.niveau(comp) : 0;
    return p.duree * (REGLES.duree.novice - (REGLES.duree.novice - REGLES.duree.expert) * n / 100);
  }

  /** Lance un procédé (ou le met en file si une action est en cours). */
  lancer(procId, { file = false } = {}) {
    const d = this.disponibilite(procId);
    if (!d.ok) return d;
    if (this.perso.action && file) { this.perso.file.push(procId); return { ok: true, enFile: true, manques: [] }; }
    if (this.perso.action) this.annuler();
    this.perso.action = { procede: procId, ecoule: 0, duree: this.dureeEffective(procId), satisfait: {} };
    this.noter('action_debut', `${this.ref.nom(procId)}…`, { procede: procId });
    return d;
  }

  annuler() {
    const a = this.perso.action;
    if (a) this.noter('action_annulee', `${this.ref.nom(a.procede)} interrompu.`, { procede: a.procede });
    this.perso.action = null;
  }

  #majAction(dt) {
    const p = this.perso;
    if (!p.vivant) return;
    if (!p.action && p.file.length) {
      const suivant = p.file.shift();
      if (!this.lancer(suivant).ok) this.noter('action_impossible', `${this.ref.nom(suivant)} n'est plus possible.`, { procede: suivant });
    }
    const a = p.action;
    if (!a) return;
    const proc = this.ref.procedes.get(a.procede);
    const avant = a.ecoule;
    a.ecoule = Math.min(a.duree, a.ecoule + dt);
    // Les besoins se satisfont progressivement pendant l'action (manger, dormir, se réchauffer…)
    const part = (a.ecoule - avant) / a.duree;
    for (const [b, q] of Object.entries(proc.satisfait)) {
      p.besoins[b] = clamp(p.besoins[b] + q * part, 0, 100);
      a.satisfait[b] = (a.satisfait[b] ?? 0) + q * part;
    }
    if (a.ecoule >= a.duree) this.#terminer(proc);
  }

  #terminer(proc) {
    const p = this.perso;
    p.action = null;
    // Les conditions ont pu changer pendant l'action (ex. feu éteint) : on vérifie les entrées
    for (const c of proc.consomme) if (!this.possede(c.id, c.q)) {
      this.noter('action_echec', `${proc.nom} : il manque ${this.ref.nom(c.id).toLowerCase()}.`, { procede: proc.id }); return;
    }
    // Consommation
    for (const c of proc.consomme) this.#retirer(c.id, c.q);
    // Usure des outils utilisés (le premier disponible de chaque groupe)
    const utilises = proc.utilise.map(g => g.find(id => this.possede(id))).filter(Boolean);
    for (const id of utilises) {
      const u = proc.degrade[id];
      if (u && this.ref.type(id) === 'objet') {
        const o = this.perso.objets.filter(x => x.id === id).sort((a, b) => b.usure - a.usure)[0];
        o.usure += u;
        if (o.usure >= 100) { this.perso.objets.splice(this.perso.objets.indexOf(o), 1); this.noter('objet_casse', `${this.ref.nom(id)} est hors d'usage.`, { objet: id }); }
      }
    }
    for (const [id, u] of Object.entries(proc.degrade)) if (this.ref.type(id) === 'installation' && this.installation(id)) this.installation(id).usure += u;
    // Prélèvement dans la source
    const src = proc.requiert.find(id => this.ref.type(id) === 'source');
    if (src) this.monde.sources[src].stock = Math.max(0, this.monde.sources[src].stock - this.#prelevement(proc));
    // Production
    const produits = [];
    for (const s of proc.produit) {
      if (!this.alea.tirage(this.ref.probabilite(s.proba))) continue;
      this.#ajouter(s.id, s.q, proc);
      produits.push(`${fmt(s.q)} ${this.#unite(s.id)} ${this.ref.nom(s.id).toLowerCase()}`.replace(/\s+/g, ' '));
    }
    // Entretien (alimenter un feu) : le combustible consommé nourrit l'installation
    for (const insId of proc.entretient) {
      const ins = this.installation(insId);
      if (!ins) continue;
      const cap = this.ref.attr(insId, 'capacite_kg', 10);
      const apport = proc.consomme.filter(c => (this.ref.sortantes.get(c.id) || []).some(r => r.type === 'ALIMENTE' && r.cible === insId)).reduce((a, c) => a + c.q, 0);
      ins.combustible = Math.min(cap, (ins.combustible ?? 0) + apport);
    }
    // Effets sur les besoins (satisfaction déjà appliquée progressivement ; on complète l'arrondi)
    let effet = false;
    for (const ag of proc.aggrave) {
      if (!this.alea.tirage(this.ref.probabilite(ag.proba))) continue;
      effet = true;
      p.besoins[ag.id] = clamp(p.besoins[ag.id] - ag.q, 0, 100);
      this.noter('effet', `${proc.nom} : ${this.ref.nom(ag.id).toLowerCase()} −${fmt(ag.q)}.`, { besoin: ag.id });
    }
    this.noter('action_fin', `${proc.nom} terminé${produits.length ? ' → ' + produits.join(', ') : ''}.`, { procede: proc.id, produits });
    // Expérience
    this.#progresser(proc);
    // Connaissances débloquées, puis nouvelles techniques découvertes
    for (const c of proc.debloque) if (!p.connait.has(c)) {
      const cd = proc.conditionsDebloque[c] || {};
      if (cd.si === 'effet' && !effet) continue;
      // chance d'apprendre, augmentée par l'expérience de l'observation et de l'expérimentation
      const chance = this.ref.probabilite(cd.proba) * (1 + this.niveau(REGLES.competenceDecouverte) / 100);
      if (!this.alea.tirage(chance)) { this.noter('essai', `${p.nom} n'en tire encore rien de clair…`, { procede: proc.id }); continue; }
      p.connait.add(c);
      this.noter('connaissance', `💡 ${p.nom} comprend : « ${this.ref.nom(c)} ».`, { connaissance: c });
    }
    this.#decouvrir();
  }

  #ajouter(id, q, proc) {
    const t = this.ref.type(id);
    if (t === 'ressource' && this.ref.attr(id, 'dechet')) {
      // les déchets restent sur place (ils pourront servir plus tard)
      this.monde.sol[id] = (this.monde.sol[id] ?? 0) + q;
    }
    else if (t === 'ressource') {
      const m = this.masseUnitaire(id);
      const place = m > 0 ? Math.max(0, (this.capacite - this.charge) / m) : q;
      const garde = Math.min(q, place);
      if (garde > 1e-9) this.perso.inventaire[id] = (this.perso.inventaire[id] ?? 0) + garde;
      if (q - garde > 1e-6) this.noter('surcharge', `Trop chargé : ${fmt(Math.round((q - garde) * 100) / 100)} ${this.#unite(id)} de ${this.ref.nom(id).toLowerCase()} laissé(s) au sol.`, { ressource: id });
    }
    else if (t === 'objet') for (let i = 0; i < q; i++) {
      if (this.perso.objets.length >= REGLES.transport.outilsMax) {
        // mains pleines : on lâche le plus usé d'un outil en double pour prendre le nouveau
        const doublons = this.perso.objets.filter(o => o.id !== id && this.perso.objets.filter(x => x.id === o.id).length > 1);
        const lache = doublons.sort((a, b) => b.usure - a.usure)[0];
        if (lache) { this.perso.objets.splice(this.perso.objets.indexOf(lache), 1); this.monde.sol[lache.id] = (this.monde.sol[lache.id] ?? 0) + 1; this.noter('surcharge', `Mains pleines : ${this.ref.nom(lache.id).toLowerCase()} usé laissé au sol pour prendre ${this.ref.nom(id).toLowerCase()}.`, { objet: lache.id }); }
      }
      if (this.perso.objets.length >= REGLES.transport.outilsMax || this.charge + this.masseUnitaire(id) > this.capacite + 1e-9) {
        this.noter('surcharge', `Mains pleines : ${this.ref.nom(id).toLowerCase()} laissé au sol.`, { objet: id }); continue;
      }
      this.perso.objets.push({ uid: ++this.uid, id, usure: 0 });
    }
    else if (t === 'installation') {
      const existant = this.installation(id);
      const combustible = this.ref.attr(id, 'consommation_kg_par_heure') != null
        ? proc.consomme.filter(c => (this.ref.sortantes.get(c.id) || []).some(r => r.type === 'ALIMENTE' && r.cible === id)).reduce((a, c) => a + c.q, 0) * REGLES.feu.combustibleAllumage
        : undefined;
      if (existant && combustible !== undefined) { existant.allume = true; existant.combustible = Math.max(existant.combustible, combustible); }
      else this.monde.installations.push({ uid: ++this.uid, id, usure: 0, ...(combustible !== undefined ? { allume: true, combustible } : {}) });
    }
  }

  #retirer(id, q) {
    const t = this.ref.type(id);
    if (t === 'ressource') {
      this.perso.inventaire[id] -= q;
      if (this.perso.inventaire[id] < 1e-9) delete this.perso.inventaire[id];
    } else if (t === 'objet') {
      for (let i = 0; i < q; i++) { const k = this.perso.objets.findIndex(o => o.id === id); if (k >= 0) this.perso.objets.splice(k, 1); }
    }
  }

  #progresser(proc) {
    const X = REGLES.experience;
    if (X.sansProgression.includes(proc.technique)) return;
    const comp = this.ref.competenceDe.get(proc.technique);
    if (!comp) return;
    let gain = (X.base + proc.duree / 60 * X.parMinute) * (1 - this.niveau(comp) / 100) * (X.facteurTechnique[proc.technique] ?? 1);
    gain = Math.min(gain, X.maxParAction);
    let c = comp, part = 1;
    while (c) {
      const avant = this.perso.competences[c];
      this.perso.competences[c] = Math.min(100, avant + gain * part);
      const pa = palierDe(avant), pn = palierDe(this.perso.competences[c]);
      if (pa !== pn) this.noter('competence', `⭐ ${this.ref.nom(c)} : ${pn}.`, { competence: c, palier: pn });
      c = this.ref.parent.get(c); part *= X.partGenerale;
    }
  }

  #decouvrir() {
    let change = true;
    while (change) {
      change = false;
      for (const [tech, prereq] of this.ref.decouverte) {
        if (this.perso.connait.has(tech)) continue;
        if (prereq.length && prereq.every(id => this.possede(id))) {
          this.perso.connait.add(tech); change = true;
          this.noter('decouverte', `✨ Découverte : ${this.ref.nom(tech)} !`, { technique: tech });
        }
      }
    }
  }

  // ---------------------------------------------------------------- journal
  noter(type, message, donnees = {}) {
    const ev = { t: this.temps, horloge: this.horloge, type, message, ...donnees };
    this.journal.push(ev);
    if (this.journal.length > 2000) this.journal.splice(0, this.journal.length - 2000);
    for (const f of this.ecouteurs) f(ev);
  }
  ecouter(f) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }

  // ---------------------------------------------------------------- sauvegarde
  exporterEtat() {
    return JSON.parse(JSON.stringify({
      version: 1, options: this.options, temps: this.temps, vitesse: this.vitesse, uid: this.uid, alea: this.alea.etat,
      monde: { ...this.monde, sources: Object.fromEntries(Object.entries(this.monde.sources).map(([k, s]) => [k, { ...s, stock: s.stock === Infinity ? 'illimite' : s.stock, max: s.max === Infinity ? 'illimite' : s.max }])) },
      perso: { ...this.perso, connait: [...this.perso.connait] },
    }));
  }

  static restaurer(referentiel, etat) {
    const sim = new Simulation(referentiel, etat.options);
    sim.journal = [];
    sim.temps = etat.temps; sim.vitesse = etat.vitesse; sim.uid = etat.uid; sim.alea.etat = etat.alea;
    sim.monde = structuredClone(etat.monde);
    for (const s of Object.values(sim.monde.sources)) { if (s.stock === 'illimite') s.stock = Infinity; if (s.max === 'illimite') s.max = Infinity; }
    sim.perso = { ...structuredClone(etat.perso), connait: new Set(etat.perso.connait) };
    return sim;
  }
}

// ------------------------------------------------------------------ utilitaires
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function fmt(q) { return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100).replace('.', ','); }
function texteCondition(c, sim) {
  if (c.competence) return `il faut ${sim.ref.nom(c.competence).toLowerCase()} ≥ ${c.min} (actuel : ${Math.floor(sim.niveau(c.competence))})`;
  return 'condition non remplie';
}
