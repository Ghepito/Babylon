import { REGLES } from './regles.js';

// IA autonome — PROPOSÉE (palier 2).
// 1. Les besoins urgents passent d'abord (soif, faim, sommeil, froid, feu à entretenir).
// 2. Sinon le personnage poursuit des objectifs (obtenir un feu, un abri, un biface…)
//    par chaînage arrière : « pour X il me faut Y, pour Y il me faut Z… » jusqu'à une action faisable.
// 3. Sinon il expérimente ou fait des réserves.
// Ce même planificateur servira aux « objectifs et priorités » de la communauté (palier 5).

export const OBJECTIFS_DEFAUT = [
  { id: 'ins.foyer', libelle: 'Faire du feu' },
  { id: 'ins.abri_branchages', libelle: 'Construire un abri' },
  { id: 'ins.couche_feuillage', libelle: 'Préparer une couche' },
  { id: 'obj.biface', libelle: 'Façonner un biface' },
];

export const RESERVES_DEFAUT = { 'res.bois_sec': 4, 'res.herbes_seches': 0.4, 'res.galet': 1, 'res.silex_brut': 2, 'res.baies': 0.4 };

export class IA {
  constructor(sim, { objectifs = OBJECTIFS_DEFAUT, reserves = RESERVES_DEFAUT, profondeur = 7 } = {}) {
    this.sim = sim; this.objectifs = objectifs; this.reserves = reserves; this.profondeur = profondeur;
    this.motif = '';
  }

  /** À appeler à chaque mise à jour : lance une action si le personnage est inactif. */
  agir() {
    const s = this.sim;
    if (!s.perso.vivant || s.perso.action || s.perso.file.length) return null;
    const choix = this.choisir();
    if (choix) { s.lancer(choix.procede); this.motif = choix.motif; }
    return choix;
  }

  choisir() {
    const s = this.sim, B = s.perso.besoins;
    const essai = (motif, ...cibles) => { for (const c of cibles) { const p = this.planifier(c.id, c.q ?? 1); if (p) return { procede: p, motif }; } return null; };
    const direct = (motif, id) => s.disponibilite(id).ok ? { procede: id, motif } : null;

    // 1. Urgences
    if (B['bes.soif'] < 55) { const r = s.possede('res.eau', 0.5) ? direct('soif', 'proc.boire') : essai('soif', { id: 'res.eau', q: 0.5 }); if (r) return r; }
    if (B['bes.faim'] < 50) {
      const r = s.possede('res.baies', 0.2) ? direct('faim', 'proc.manger_baies') : essai('faim', { id: 'res.baies', q: 0.2 });
      if (r) return r;
      // en dernier recours : les champignons, tant qu'on ignore qu'ils sont dangereux ou si la faim devient critique
      if (!s.perso.connait.has('con.champignons_toxiques') || B['bes.faim'] < 10) {
        const c = s.possede('res.champignons', 0.2) ? direct('faim', 'proc.manger_champignons') : essai('faim', { id: 'res.champignons', q: 0.2 });
        if (c) return c;
      }
    }
    const feu = s.installation('ins.foyer');
    const besoinDeFeu = s.nuit || B['bes.chaleur'] < 50;
    if (feu?.allume && besoinDeFeu && feu.combustible < 2 && s.possede('res.bois_sec', 1)) { const r = direct('entretenir le feu', 'proc.alimenter_feu'); if (r) return r; }
    if (B['bes.chaleur'] < 35) {
      if (s.installationActive('ins.foyer')) { const r = direct('froid', 'proc.se_rechauffer'); if (r) return r; }
      if (feu) { const r = this.#rallumer('froid : rallumer le feu'); if (r) return r; }
    }
    if (B['bes.repos'] < 20 || (s.nuit && B['bes.repos'] < 70)) {
      if (feu && !feu.allume) { const r = this.#rallumer('rallumer le feu avant la nuit'); if (r) return r; }
      if (feu?.allume && feu.combustible < 4 && s.possede('res.bois_sec', 1)) { const r = direct('charger le feu pour la nuit', 'proc.alimenter_feu'); if (r) return r; }
      const r = s.installation('ins.abri_branchages') ? direct('sommeil', 'proc.dormir_abri') : direct('sommeil', 'proc.dormir_dehors');
      if (r) return r;
    }

    // 2. Objectifs
    for (const o of this.objectifs) {
      if (s.possede(o.id)) continue;
      const p = this.planifier(o.id, 1);
      if (p) return { procede: p, motif: o.libelle };
    }

    // 3. Réserves et expérimentation
    for (const [id, q] of Object.entries(this.reserves)) {
      if (!s.possede(id, q)) { const p = this.planifier(id, q); if (p) return { procede: p, motif: 'faire des réserves' }; }
    }
    for (const p of s.procedesConnus()) {
      if (this.#opportun(p) && p.debloque.some(c => !s.perso.connait.has(c)) && s.disponibilite(p.id).ok) return { procede: p.id, motif: 'expérimenter' };
    }
    if (B['bes.chaleur'] < 70 && s.installationActive('ins.foyer')) return direct('se réchauffer', 'proc.se_rechauffer');
    return null;
  }

  /** On ne dort pas en plein jour pour atteindre un objectif, sauf si l'on est fatigué. */
  #opportun(p) {
    const s = this.sim;
    return !REGLES.actionsSommeil.includes(p.id) || s.nuit || s.perso.besoins['bes.repos'] < 40;
  }

  /** Rallumer le feu seulement avec une réserve de bois suffisante (sinon, aller en chercher). */
  #rallumer(motif) {
    const s = this.sim;
    if (!s.perso.connait.has('tech.allumage_friction')) return null;
    if (!s.possede('res.bois_sec', 3)) { const p = this.planifier('res.bois_sec', 3); return p ? { procede: p, motif: motif + ' (bois)' } : null; }
    const p = this.planifier('ins.foyer', 1);
    return p ? { procede: p, motif } : null;
  }

  /**
   * Chaînage arrière : renvoie un procédé exécutable maintenant qui rapproche de « posséder id (q) ».
   * Les besoins en compétence se règlent en pratiquant la technique correspondante.
   */
  planifier(id, q = 1, profondeur = this.profondeur, vus = new Set()) {
    const s = this.sim, ref = s.ref;
    if (profondeur < 0 || vus.has(id)) return null;
    if (id === 'ins.foyer' ? s.installationActive(id) : s.possede(id, q)) return null;
    vus = new Set(vus).add(id);
    const type = ref.type(id);

    if (type === 'technique') {
      for (const pre of ref.decouverte.get(id) || []) { const p = this.planifier(pre, 1, profondeur - 1, vus); if (p) return p; }
      return null;
    }
    if (type === 'competence') {
      // s'entraîner : un procédé exécutable dont la technique relève de cette compétence (ou d'une spécialisation)
      const candidats = s.procedesConnus().filter(p => relevede(ref, ref.competenceDe.get(p.technique), id) && s.disponibilite(p.id).ok);
      candidats.sort((a, b) => b.duree - a.duree);
      if (candidats[0]) return candidats[0].id;
      for (const p of s.procedesConnus().filter(p => relevede(ref, ref.competenceDe.get(p.technique), id))) {
        const r = this.#debloquer(p.id, profondeur - 1, vus); if (r) return r;
      }
      return null;
    }
    // ressource, objet, installation, connaissance : un procédé qui le produit / débloque
    const producteurs = (ref.producteurs.get(id) || []).map(pid => ref.procedes.get(pid))
      .sort((a, b) => coutProducteur(s, a, id) - coutProducteur(s, b, id));
    for (const p of producteurs) if (this.#opportun(p) && s.perso.connait.has(p.technique) && s.disponibilite(p.id).ok) return p.id;
    for (const p of producteurs) { if (!this.#opportun(p)) continue; const r = this.#debloquer(p.id, profondeur - 1, vus); if (r) return r; }
    return null;
  }

  /** Pour un procédé non exécutable, cherche une action qui lève l'un de ses manques. */
  #debloquer(procId, profondeur, vus) {
    const s = this.sim;
    const { manques } = s.disponibilite(procId);
    for (const m of manques) {
      if (m.condition?.competence) { const r = this.planifier(m.condition.competence, 1, profondeur, vus); if (r) return r; continue; }
      if (m.alternatives) { for (const alt of m.alternatives) { const r = this.planifier(alt, 1, profondeur, vus); if (r) return r; } continue; }
      if (s.ref.type(m.id) === 'source') continue;   // source absente ou épuisée : rien à faire
      const r = this.planifier(m.id, m.quantite ?? 1, profondeur, vus);
      if (r) return r;
    }
    return null;
  }
}

function relevede(ref, comp, cible) { let c = comp; while (c) { if (c === cible) return true; c = ref.parent.get(c); } return false; }

/** Préfère les procédés sûrs et peu coûteux (pas de probabilité, technique déjà connue). */
function coutProducteur(sim, p, id) {
  const sortie = p.produit.find(s => s.id === id);
  let c = p.duree / 60;
  if (sortie?.proba != null) c *= 3;
  if (!sim.perso.connait.has(p.technique)) c += 50;
  if (p.debloque.includes(id)) c += 1;
  return c;
}
