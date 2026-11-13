// Référentiel compilé pour le moteur : index des éléments et des relations, procédés prêts à l'emploi.
// Entrée : le JSON généré par tools/referentiel.py (data/referentiel.json).

export class Referentiel {
  constructor(json) {
    this.json = json;
    this.elements = new Map(json.elements.map(e => [e.id, e]));
    this.sortantes = new Map();
    this.entrantes = new Map();
    for (const r of json.relations) {
      r.contexte ??= 'execution';
      r.parametres ??= {};
      pousser(this.sortantes, r.source, r);
      pousser(this.entrantes, r.cible, r);
    }
    this.depart = json.depart || {};

    // Structure des savoirs
    this.competenceDe = new Map();     // technique -> compétence
    this.parent = new Map();           // compétence -> compétence générale
    this.decouverte = new Map();       // technique -> [prérequis de découverte]
    for (const r of json.relations) {
      if (r.type === 'RELEVE_DE') this.competenceDe.set(r.source, r.cible);
      if (r.type === 'SPECIALISE') this.parent.set(r.source, r.cible);
      if (r.type === 'REQUIERT' && r.contexte === 'decouverte') pousser(this.decouverte, r.source, r.cible);
    }
    for (const t of this.parType('technique')) if (!this.decouverte.has(t.id)) this.decouverte.set(t.id, []);

    // Procédés compilés
    this.procedes = new Map();
    for (const e of this.parType('procede')) this.procedes.set(e.id, this.#compiler(e));

    // Qui produit / débloque quoi (pour la planification)
    this.producteurs = new Map();
    for (const p of this.procedes.values()) {
      for (const s of p.produit) pousser(this.producteurs, s.id, p.id);
      for (const c of p.debloque) pousser(this.producteurs, c, p.id);
    }
  }

  get(id) { return this.elements.get(id); }
  type(id) { return this.elements.get(id)?.type; }
  nom(id) { return this.elements.get(id)?.nom ?? id; }
  parType(type) { return this.json.elements.filter(e => e.type === type); }
  attr(id, cle, defaut) { return this.elements.get(id)?.attributs?.[cle] ?? defaut; }

  /** Valeur d'une propriété « module.cle » (le moteur connaît aussi les propriétés cachées). */
  propriete(id, module, cle) {
    const p = this.elements.get(id)?.proprietes?.[module]?.[cle];
    return p ? (p.valeur ?? p.texte) : undefined;
  }

  /** Probabilité : nombre, ou référence « propriete:res.x/module/cle ». */
  probabilite(p) {
    if (p == null) return 1;
    if (typeof p === 'number') return p;
    const m = /^propriete:([^/]+)\/([^/]+)\/(.+)$/.exec(p);
    return m ? Number(this.propriete(m[1], m[2], m[3]) ?? 0) : 1;
  }

  #compiler(e) {
    const rs = this.sortantes.get(e.id) || [];
    const de = t => rs.filter(r => r.type === t);
    const groupes = new Map();
    const optionnels = [];
    for (const r of de('UTILISE')) {
      if (r.parametres.optionnel) { optionnels.push(r.cible); continue; }
      const g = r.parametres.groupe || r.cible;
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push(r.cible);
    }
    return {
      id: e.id,
      nom: e.nom,
      description: e.description,
      technique: de('MET_EN_OEUVRE')[0]?.cible,
      duree: e.attributs?.duree_s ?? 60,
      condition: e.attributs?.condition ?? null,
      requiert: de('REQUIERT').filter(r => r.contexte === 'execution').map(r => r.cible),
      consomme: de('CONSOMME').map(r => ({ id: r.cible, q: r.quantite })),
      produit: de('PRODUIT').map(r => ({ id: r.cible, q: r.quantite, proba: r.parametres.probabilite ?? null })),
      utilise: [...groupes.values()],
      optionnels,
      degrade: Object.fromEntries(de('DEGRADE').map(r => [r.cible, r.quantite])),
      satisfait: Object.fromEntries(de('SATISFAIT').map(r => [r.cible, r.quantite])),
      aggrave: de('AGGRAVE').map(r => ({ id: r.cible, q: r.quantite, proba: r.parametres.probabilite ?? null })),
      debloque: de('DEBLOQUE').map(r => r.cible),
      conditionsDebloque: Object.fromEntries(de('DEBLOQUE').map(r => [r.cible, { proba: r.parametres.probabilite ?? null, si: r.parametres.si ?? null }])),
      entretient: de('ENTRETIENT').map(r => r.cible),
    };
  }
}

function pousser(map, cle, val) {
  if (!map.has(cle)) map.set(cle, []);
  map.get(cle).push(val);
}
