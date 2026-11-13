// Scénarios automatiques du moteur — lancer avec : npm test   (ou node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation, IA, Referentiel } from '../../src/sim/index.js';

const JSON_REF = JSON.parse(readFileSync(new URL('../../data/referentiel.json', import.meta.url), 'utf8'));
const REF = new Referentiel(JSON_REF);
const nouvelle = (o = {}) => new Simulation(REF, { graine: 7, ...o });
const heures = h => h * 3600;

/** Fait tourner l'IA autonome pendant une durée de jeu, minute par minute. */
function autonome(sim, secondes, ia = new IA(sim)) {
  for (let t = 0; t < secondes && sim.perso.vivant; t += 60) { ia.agir(); sim.avancerJeu(60); }
  return ia;
}
/** Exécute un procédé jusqu'au bout (échoue si impossible). */
function faire(sim, proc) {
  const d = sim.lancer(proc);
  assert.ok(d.ok, `${proc} impossible : ${d.manques.map(m => m.raison).join(' ; ')}`);
  while (sim.perso.action) sim.avancerJeu(10);
}
/** Répète un procédé jusqu'à obtenir l'élément (découverte ou production aléatoire). */
function jusqua(sim, proc, cible, max = 30) {
  for (let i = 0; i < max && !sim.possede(cible); i++) faire(sim, proc);
  assert.ok(sim.possede(cible), `${cible} jamais obtenu avec ${proc}`);
}

test('le référentiel est compilé : 26 procédés, chacun avec une technique', () => {
  assert.equal(REF.procedes.size, 26);
  for (const p of REF.procedes.values()) assert.ok(p.technique, p.id);
});

test('pause active : à vitesse 0 le temps ne passe pas', () => {
  const sim = nouvelle();
  const t0 = sim.temps, soif = sim.perso.besoins['bes.soif'];
  sim.vitesse = 0; sim.avancer(1000);
  assert.equal(sim.temps, t0);
  assert.equal(sim.perso.besoins['bes.soif'], soif);
  sim.vitesse = 10; sim.avancer(6);   // 6 s réelles × 10 × 60 = 1 heure de jeu
  assert.equal(sim.temps, t0 + 3600);
});

test('les besoins baissent avec le temps (soif : −6 par heure)', () => {
  const sim = nouvelle();
  sim.avancerJeu(heures(5));
  assert.ok(Math.abs(sim.perso.besoins['bes.soif'] - (70 - 30)) < 1e-6);
});

test('sans rien faire, le personnage meurt de soif en un à deux jours', () => {
  const sim = nouvelle();
  sim.avancerJeu(heures(72));
  assert.equal(sim.perso.vivant, false);
  const mort = sim.journal.find(e => e.type === 'mort');
  assert.match(mort.message, /soif/);
  assert.ok(mort.t > heures(8 + 12) && mort.t < heures(8 + 48), `mort à ${mort.horloge}`);
});

test("une action impossible explique pourquoi", () => {
  const sim = nouvelle();
  const d = sim.disponibilite('proc.boire');
  assert.equal(d.ok, false);
  assert.match(d.manques[0].raison, /eau/);
  const feu = sim.disponibilite('proc.allumer_feu');
  assert.match(feu.manques[0].raison, /technique non découverte/);
});

test('boire : puiser puis boire fait remonter la soif', () => {
  const sim = nouvelle();
  const avant = sim.perso.besoins['bes.soif'];
  faire(sim, 'proc.puiser_eau'); faire(sim, 'proc.boire');
  assert.ok(sim.perso.besoins['bes.soif'] > avant + 20);
  assert.equal(sim.quantite('res.eau'), 0);
});

test('la chaîne du feu se découvre par l’expérimentation, puis le feu s’éteint sans bois', () => {
  const sim = nouvelle();
  for (let i = 0; i < 6; i++) faire(sim, 'proc.ramasser_bois_sec');
  faire(sim, 'proc.ramasser_herbes'); faire(sim, 'proc.ramasser_herbes');
  jusqua(sim, 'proc.frotter_bois', 'con.frottement_chaleur');
  jusqua(sim, 'proc.essai_braise', 'con.combustion');
  assert.ok(sim.perso.connait.has('tech.allumage_friction'), 'allumage découvert');
  // il faut un outil coupant pour fabriquer le nécessaire à feu
  faire(sim, 'proc.ramasser_galet');
  for (let i = 0; i < 4; i++) faire(sim, 'proc.ramasser_silex');
  jusqua(sim, 'proc.casser_silex', 'con.silex_tranchant');
  if (!sim.possede('obj.eclat_tranchant')) faire(sim, 'proc.tailler_eclats');
  faire(sim, 'proc.fabriquer_necessaire_feu');
  faire(sim, 'proc.allumer_feu');
  const feu = sim.installation('ins.foyer');
  assert.ok(feu?.allume, 'feu allumé');
  sim.avancerJeu(heures(3));
  assert.equal(feu.allume, false, 'le feu doit s’éteindre sans combustible');
  assert.ok(sim.journal.some(e => e.type === 'feu_eteint'));
});

test('le biface exige un niveau de taille ≥ 25, acquis par la pratique', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.taille_percussion'); sim.perso.connait.add('tech.faconnage_bifacial');
  sim.perso.inventaire['res.galet'] = 1; sim.perso.inventaire['res.silex_brut'] = 12;
  const d = sim.disponibilite('proc.faconner_biface');
  assert.equal(d.ok, false);
  assert.match(d.manques[0].raison, /taille par percussion ≥ 25/i);
  let n = 0;
  while (!sim.disponibilite('proc.faconner_biface').ok && n < 20) { faire(sim, 'proc.tailler_eclats'); n++; }
  assert.ok(sim.niveau('comp.taille') >= 25);
  assert.ok(sim.niveau('comp.travail_pierre') > 0, 'la compétence générale progresse aussi');
  faire(sim, 'proc.faconner_biface');
  assert.ok(sim.possede('obj.biface'));
});

test('les outils s’usent et finissent par casser', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.decoupe');
  sim.perso.objets.push({ uid: 99, id: 'obj.eclat_tranchant', usure: 90 });
  faire(sim, 'proc.couper_branches');
  faire(sim, 'proc.couper_branches');
  assert.equal(sim.possede('obj.eclat_tranchant'), false);
  assert.ok(sim.journal.some(e => e.type === 'objet_casse'));
});

test('les champignons : danger appris seulement en tombant malade', () => {
  const sim = nouvelle({ graine: 3 });
  let malade = false;
  for (let i = 0; i < 30 && !sim.perso.connait.has('con.champignons_toxiques'); i++) {
    faire(sim, 'proc.ramasser_champignons');
    const s = sim.perso.besoins['bes.sante'];
    faire(sim, 'proc.manger_champignons');
    if (sim.perso.besoins['bes.sante'] < s - 20) malade = true;
  }
  assert.ok(sim.perso.connait.has('con.champignons_toxiques'));
  assert.ok(malade, 'la connaissance est venue avec une intoxication');
});

test('déterminisme : même graine, même partie', () => {
  const a = nouvelle({ graine: 11 }), b = nouvelle({ graine: 11 });
  autonome(a, heures(30)); autonome(b, heures(30));
  assert.deepEqual(a.exporterEtat(), b.exporterEtat());
});

test('sauvegarde puis reprise : la partie continue à l’identique', () => {
  const a = nouvelle({ graine: 5 });
  const iaA = autonome(a, heures(20));
  const b = Simulation.restaurer(REF, JSON.parse(JSON.stringify(a.exporterEtat())));
  autonome(a, heures(10), iaA); autonome(b, heures(10));
  assert.deepEqual(b.exporterEtat(), a.exporterEtat());
});

test('l’IA autonome survit 7 jours et atteint ses objectifs (feu, abri, couche, biface)', () => {
  for (const graine of [1, 2, 3, 4, 5]) {
    const sim = nouvelle({ graine });
    autonome(sim, heures(24 * 7));
    assert.ok(sim.perso.vivant, `graine ${graine} : mort — ${sim.journal.find(e => e.type === 'mort')?.message}`);
    for (const id of ['ins.foyer', 'ins.abri_branchages', 'obj.biface'])
      assert.ok(sim.possede(id), `graine ${graine} : ${id} non obtenu`);
    assert.ok(sim.perso.besoins['bes.sante'] > 50, `graine ${graine} : santé ${sim.perso.besoins['bes.sante']}`);
  }
});

test('transport : au-delà de 30 kg, on ne peut plus ramasser et le surplus reste au sol', () => {
  const sim = nouvelle();
  sim.perso.inventaire['res.bois_sec'] = 29;
  faire(sim, 'proc.ramasser_bois_sec');          // +2 kg mais seulement 1 kg de place
  assert.ok(Math.abs(sim.charge - 30) < 1e-6);
  assert.ok(sim.journal.some(e => e.type === 'surcharge'));
  const d = sim.disponibilite('proc.ramasser_bois_sec');
  assert.equal(d.ok, false);
  assert.match(d.manques.at(-1).raison, /trop chargé/);
});

test('transport : on ne porte pas plus de 4 outils', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.taille_percussion');
  sim.perso.inventaire['res.galet'] = 1; sim.perso.inventaire['res.silex_brut'] = 3;
  faire(sim, 'proc.tailler_eclats'); faire(sim, 'proc.tailler_eclats');
  assert.equal(sim.perso.objets.length, 4);
});

test('charger le feu pour la nuit : 3 bûches font tenir le feu au-delà de 4 heures', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.entretien_feu');
  sim.monde.installations.push({ uid: 1, id: 'ins.foyer', usure: 0, allume: true, combustible: 3 });
  sim.perso.inventaire['res.bois_sec'] = 6;
  faire(sim, 'proc.charger_feu'); faire(sim, 'proc.charger_feu');
  assert.ok(sim.installation('ins.foyer').combustible > 8.5);
  sim.avancerJeu(heures(5));
  assert.ok(sim.installation('ins.foyer').allume, 'toujours allumé après 5 h');
});

test('chaque arbre a son propre stock : en épuiser un ne vide pas les autres', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.decoupe');
  sim.perso.objets.push({ uid: 50, id: 'obj.biface', usure: 0 });
  sim.definirSites('src.arbre', ['arbre_1', 'arbre_2']);
  sim.site('src.arbre', 'arbre_1').stock = 3;
  const r = sim.lancer('proc.couper_branches', { site: 'arbre_1' }); assert.ok(r.ok);
  while (sim.perso.action) sim.avancerJeu(10);
  assert.ok(sim.site('src.arbre', 'arbre_1').stock < 0.01, 'arbre 1 épuisé (la repousse commence à peine)');
  assert.ok(sim.site('src.arbre', 'arbre_2').stock >= 40 - 1e-9);
  const d = sim.disponibilite('proc.couper_branches', { site: 'arbre_1' });
  assert.equal(d.ok, false); assert.match(d.manques[0].raison, /épuisé\(e\) ici/);
  assert.ok(sim.disponibilite('proc.couper_branches', { site: 'arbre_2' }).ok);
  assert.ok(sim.disponibilite('proc.couper_branches').ok, 'sans site précisé, un autre arbre convient');
});

test('stockage au sol : déposer, reprendre, et construire avec la réserve du camp', () => {
  const sim = nouvelle();
  sim.perso.connait.add('tech.abri_appentis');
  sim.perso.inventaire['res.branches_vertes'] = 15; sim.perso.inventaire['res.feuillage'] = 8;
  const tas = sim.deposer('res.branches_vertes', 15, { camp: true });
  assert.ok(tas.camp); assert.equal(sim.quantite('res.branches_vertes'), 0);
  assert.ok(sim.disponibilite('proc.construire_abri').ok, 'la réserve du camp sert à construire');
  const sol = sim.deposer('res.feuillage', 3, { position: { x: 1, z: 2 } });
  assert.equal(sim.prendre(sol.uid, 'res.feuillage'), 3);
  assert.ok(!sim.tas(sol.uid), 'un tas vide disparaît');
  while (!sim.perso.action) { sim.lancer('proc.construire_abri'); }
  while (sim.perso.action) sim.avancerJeu(60);
  assert.ok(sim.possede('ins.abri_branchages'));
  assert.equal(sim.reserveCamp.contenu['res.branches_vertes'], undefined);
  const etat = JSON.parse(JSON.stringify(sim.exporterEtat()));
  assert.ok(Simulation.restaurer(REF, etat).reserveCamp, 'la réserve est sauvegardée');
});
