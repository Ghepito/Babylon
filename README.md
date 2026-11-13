# Babylon

Simulateur de survie et de développement d'une civilisation, de la survie primitive jusqu'à l'ère industrielle — rendu 3D dans le navigateur avec [Babylon.js](https://www.babylonjs.com/).

> **Principe fondateur** — Le besoin provoque l'action, l'action favorise l'apprentissage, l'apprentissage permet de nouvelles réalisations, et ces réalisations créent de nouvelles possibilités, contraintes ou nécessités.

## Jouer

- **Prototype actuel (démo 3, ancien concept RTS)** : [`prototypes/demo3-rts/`](prototypes/demo3-rts/index.html) — décor 3D, caméra, brouillard d'exploration, tribu animée, feu à entretenir.
- **Réseau du référentiel (palier 1)** : [`vues/reseau.html`](vues/reseau.html) — besoins, ressources, techniques et procédés de la survie primitive, avec leur validation.
- **Console de simulation (palier 2)** : [`vues/simulation.html`](vues/simulation.html) — le survivant solitaire sans 3D : besoins, actions, découvertes, IA autonome. Voir [`docs/moteur.md`](docs/moteur.md).
- Le jeu en 3D réutilisera ce moteur au palier 3.

Aucune installation : ouvrir `index.html` dans un navigateur récent (connexion internet nécessaire pour charger Babylon.js), ou via GitHub Pages.

## Référentiel

```bash
pip install pyyaml openpyxl
python3 tools/referentiel.py      # construit, valide, exporte
```

Détails : [`referentiel/README.md`](referentiel/README.md).

## Moteur

```bash
npm test                     # scénarios automatiques (Node 20+)
node tools/scenario.mjs 7    # récit d'une semaine en autonomie -> docs/scenario-solitaire.md
```

## Méthode

Avancer **par paliers jouables** : chaque palier enrichit à la fois le référentiel (les données) et le jeu qui l'utilise, pour tester les concepts en jouant plutôt que de tout concevoir à l'avance.

Voir [`docs/feuille-de-route.md`](docs/feuille-de-route.md).

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `docs/` | Conception, décisions validées, feuille de route |
| `referentiel/` | Schéma SQLite et données sources du référentiel (ce qui existe et ce qui est possible) |
| `tools/` | Validateurs de cohérence et export JSON |
| `data/` | JSON généré à partir du référentiel, lu par le jeu |
| `src/sim/` | Moteur de simulation (temps, besoins, actions, compétences) — sans dépendance à la 3D |
| `src/render/` | Rendu Babylon.js (terrain, ciel, eau, personnages, brouillard) |
| `src/ui/` | Interface |
| `prototypes/` | Démos figées des étapes précédentes |

## Statuts utilisés dans la documentation

- **VALIDÉ** : décision explicitement approuvée par Laurent-Olivier.
- **PROPOSÉ** : solution envisagée, pas encore validée.
- **À RÉALISER** : travail non encore effectué.
