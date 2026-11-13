#!/usr/bin/env node
// Fait vivre le personnage solitaire en autonomie et écrit le récit dans docs/scenario-solitaire.md
//   node tools/scenario.mjs [jours=7] [graine=1]
import { readFileSync, writeFileSync } from 'node:fs';
import { Simulation, IA, palierDe } from '../src/sim/index.js';

const jours = Number(process.argv[2] ?? 7), graine = Number(process.argv[3] ?? 1);
const ref = JSON.parse(readFileSync(new URL('../data/referentiel.json', import.meta.url), 'utf8'));
const sim = new Simulation(ref, { graine });
const ia = new IA(sim);

const IMPORTANTS = new Set(['debut', 'connaissance', 'decouverte', 'feu_eteint', 'besoin_critique', 'mort', 'objet_casse', 'installation_detruite', 'effet']);
const recit = [], bilans = [], compteur = {};
sim.ecouter(e => {
  if (IMPORTANTS.has(e.type)) recit.push(`| ${e.horloge} | ${e.message} |`);
  if (e.type === 'action_fin') compteur[e.procede] = (compteur[e.procede] ?? 0) + 1;
  if (e.type === 'action_fin' && /proc\.(allumer_feu|construire_abri|faire_couche|faconner_biface)$/.test(e.procede) && compteur[e.procede] === 1)
    recit.push(`| ${e.horloge} | 🏁 **${e.message}** |`);
});

for (let t = 0; t < jours * 86400 && sim.perso.vivant; t += 60) {
  ia.agir(); sim.avancerJeu(60);
  if (Math.round(sim.temps) % 86400 === 20 * 3600) {
    const B = sim.perso.besoins, n = id => Math.round(B[id]);
    bilans.push(`| ${sim.jour} | ${n('bes.soif')} | ${n('bes.faim')} | ${n('bes.repos')} | ${n('bes.chaleur')} | ${n('bes.securite')} | ${n('bes.sante')} | ${sim.monde.installations.map(i => ref.elements.find(e => e.id === i.id).nom.toLowerCase()).join(', ') || '—'} |`);
  }
}

const comp = Object.entries(sim.perso.competences).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  .map(([id, v]) => `| ${ref.elements.find(e => e.id === id).nom} | ${Math.round(v)} | ${palierDe(v)} |`);
const nomProc = id => ref.elements.find(e => e.id === id).nom;
const actions = Object.entries(compteur).sort((a, b) => b[1] - a[1]).map(([id, n]) => `| ${nomProc(id)} | ${n} |`);

writeFileSync(new URL('../docs/scenario-solitaire.md', import.meta.url), `# Scénario « solitaire » — ${jours} jours en autonomie

*Généré par \`node tools/scenario.mjs ${jours} ${graine}\` (graine ${graine}). Le personnage est piloté par l'IA par objectifs ; toutes les valeurs sont provisoires.*

**Résultat : ${sim.perso.vivant ? `vivant au bout de ${jours} jours` : 'mort — ' + sim.journal.find(e => e.type === 'mort').message}.**

## Moments clés

| Quand | Événement |
|---|---|
${recit.join('\n')}

## Besoins chaque soir à 20 h (0-100)

| Jour | Soif | Faim | Repos | Chaleur | Sécurité | Santé | Installations |
|---|---|---|---|---|---|---|---|
${bilans.join('\n')}

## Compétences acquises

| Compétence | Niveau | Palier |
|---|---|---|
${comp.join('\n')}

## Actions réalisées

| Procédé | Nombre |
|---|---|
${actions.join('\n')}
`);
console.log(`Scénario écrit dans docs/scenario-solitaire.md — ${sim.perso.vivant ? 'vivant' : 'mort'}, ${sim.horloge}`);
