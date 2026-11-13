// Paramètres de simulation — TOUS PROPOSÉS, à calibrer en jouant.
// Les valeurs propres à un élément (baisse d'un besoin, durée d'un procédé…) sont dans le référentiel ;
// ici ne figurent que les règles générales du moteur.

export const REGLES = {
  besoinsDepart: { 'bes.soif': 70, 'bes.faim': 70, 'bes.repos': 80, 'bes.chaleur': 80, 'bes.securite': 60, 'bes.sante': 100 },

  // Pendant le sommeil, faim et soif baissent moins vite
  actionsSommeil: ['proc.dormir_dehors', 'proc.dormir_abri'],
  facteurBesoinsSommeil: 0.5,

  chaleur: {
    temperatureConfort: 20,   // °C ressentis : au-dessus, la chaleur remonte d'elle-même
    amplitude: 10,            // écart de température qui donne la baisse nominale
    bonusFoyer: 10,           // °C gagnés près d'un feu allumé
    bonusAbri: 5,             // °C gagnés grâce à l'abri
  },

  sante: {
    pertesParHeure: { 'bes.soif': 12, 'bes.faim': 5, 'bes.chaleur': 8, 'bes.repos': 3 },  // quand le besoin est à 0
    besoinsBienEtre: ['bes.soif', 'bes.faim', 'bes.chaleur', 'bes.repos'],
    seuilBienEtre: 40,
    recuperationParHeure: 1,
  },

  // Facteur de durée : un novice met 1,4 × le temps nominal, un expert 0,7 ×
  duree: { novice: 1.4, expert: 0.7 },

  experience: {
    base: 2,                  // points par action réussie…
    parMinute: 1,             // …plus 1 point par minute de durée nominale
    maxParAction: 8,
    partGenerale: 0.3,        // part transmise à la compétence générale (« Taille » → « Travail de la pierre »)
    sansProgression: ['tech.gestes_vitaux'],   // boire, manger, dormir ne font pas progresser
  },

  feu: { combustibleAllumage: 1.5 },

  // La compétence d'observation augmente les chances de comprendre lors d'une expérimentation
  competenceDecouverte: 'comp.experimentation',   // kg de combustible dans un feu qu'on vient d'allumer, par kg de bois utilisé
};

// Paliers de maîtrise : échelle 0-100 PROPOSÉE (seuils non validés)
export const PALIERS = [
  { min: 0, nom: 'novice' }, { min: 10, nom: 'initié' }, { min: 25, nom: 'apprenti' },
  { min: 45, nom: 'compétent' }, { min: 65, nom: 'confirmé' }, { min: 85, nom: 'expert' },
];
export function palierDe(n) { let p = PALIERS[0].nom; for (const x of PALIERS) if (n >= x.min) p = x.nom; return p; }
