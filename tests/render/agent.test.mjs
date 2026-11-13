// L'agent (personnage 3D ↔ moteur) testé sans 3D : un squelette factice et une carte simplifiée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulation, IA, Referentiel } from '../../src/sim/index.js';
import { Agent } from '../../src/render/agent.js';
import { CAMP } from '../../src/render/environnement.js';

const REF = new Referentiel(JSON.parse(readFileSync(new URL('../../data/referentiel.json', import.meta.url), 'utf8')));

const noeud = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { x: 0, y: 0, z: 0 } });
function rigFactice() {
  const charges = Object.fromEntries(['bois', 'branches', 'feuillage', 'sac', 'baies'].map(k => [k, { isVisible: false }]));
  return { root: noeud(), body: noeud(), head: noeud(), hips: [noeud(), noeud()], knees: [noeud(), noeud()], shoulders: [noeud(), noeud()], elbows: [noeud(), noeud()], tool: { isVisible: false }, charges };
}
// Lieux à des distances réalistes du campement (comme sur la vraie carte)
const LIEUX = { 'src.lac': { x: 18, z: 2 }, 'src.buisson_baies': { x: -9, z: -16 }, 'src.sous_bois': { x: -30, z: 6 }, 'src.bois_mort': { x: -15, z: 4 },
  'src.arbre': { x: -14, z: 0 }, 'src.prairie': { x: -2, z: -30 }, 'src.riviere_galets': { x: 16, z: 6 }, 'src.affleurement_silex': { x: -20, z: -30 } };
const carte = {
  destination(proc) {
    const s = proc.requiert.find(id => REF.type(id) === 'source');
    if (s) return { ...LIEUX[s], rayon: 1, regarder: LIEUX[s] };
    const ins = proc.requiert.find(id => REF.type(id) === 'installation') ?? proc.entretient[0] ?? proc.produit.find(x => REF.type(x.id) === 'installation')?.id;
    return ins ? { x: CAMP.x, z: CAMP.z, rayon: 1.5, regarder: CAMP } : null;
  },
};

test('un ordre fait marcher jusqu’au lac puis exécute l’action', () => {
  const sim = new Simulation(REF, { graine: 3 });
  const agent = new Agent(sim, rigFactice(), carte);
  agent.x = CAMP.x; agent.z = CAMP.z;
  agent.ordonner({ type: 'procede', procede: 'proc.puiser_eau' });
  sim.vitesse = 1;
  let marche = false;
  for (let i = 0; i < 400 && !sim.possede('res.eau', 0.5); i++) { sim.avancer(0.05); agent.maj(0.05); if (agent.phase === 'marche') marche = true; }
  assert.ok(marche, 'il a marché');
  assert.ok(sim.possede('res.eau', 0.5), 'il a puisé');
  assert.ok(Math.hypot(agent.x - LIEUX['src.lac'].x, agent.z - LIEUX['src.lac'].z) < 1.5, 'il est au bord du lac');
  assert.ok(sim.temps > 8 * 3600 + 60, 'la marche a pris du temps de jeu');
});

test('un ordre impossible est refusé avec sa raison', () => {
  const sim = new Simulation(REF, { graine: 3 });
  const refus = [];
  const agent = new Agent(sim, rigFactice(), carte, { surEvenement: e => refus.push(e) });
  agent.ordonner({ type: 'procede', procede: 'proc.boire' });
  sim.avancer(0.05); agent.maj(0.05);
  assert.equal(refus[0]?.type, 'refus');
  assert.match(refus[0].raison, /eau/);
});

test('IA + agent avec la marche : le survivant tient 5 jours et fait du feu et un abri', () => {
  for (const graine of [1, 2, 3]) {
    const sim = new Simulation(REF, { graine });
    const ia = new IA(sim);
    const agent = new Agent(sim, rigFactice(), carte);
    agent.x = CAMP.x; agent.z = CAMP.z;
    sim.vitesse = 20;
    for (let t = 0; t < 5 * 86400 && sim.perso.vivant; ) {
      if (!agent.occupe) { const c = ia.choisir(); if (c) agent.ordonner({ type: 'procede', procede: c.procede }); }
      const avant = sim.temps; sim.avancer(0.1); agent.maj(0.1); t += sim.temps - avant;
    }
    assert.ok(sim.perso.vivant, `graine ${graine} : ${sim.journal.find(e => e.type === 'mort')?.message}`);
    assert.ok(sim.possede('ins.foyer') && sim.possede('ins.abri_branchages'), `graine ${graine} : feu ${sim.possede('ins.foyer')}, abri ${sim.possede('ins.abri_branchages')}`);
  }
});
