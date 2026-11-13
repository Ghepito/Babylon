# Décisions de conception

Source : [`conception-ia-externe.md`](conception-ia-externe.md) (synthèse du 13/11/2026).

## Décisions VALIDÉES

| N° | Domaine | Décision |
|---|---|---|
| 01 | Évolution technologique | Survie primitive jusqu'à l'ère industrielle |
| 02 | Réalisme | Simulation poussée |
| 03 | Acquisition initiale | Découverte, prérequis, expérimentation et pratique |
| 04 | Population | Personnage solitaire puis communauté |
| 05 | Autonomie collective | Gestion par objectifs et priorités |
| 06 | Apprentissage | Naturel et formation dirigée |
| 07 | Ressources | Modèle hybride : lots et objets individualisés |
| 08 | Monde | Modèle hybride : détail local, simulation agrégée à distance |
| 09 | Temps | Continu, pause active et accélération |
| 10 | Découvertes | Émergentes encadrées |
| 11 | Démographie | Rencontres, accueil et générations |
| 12 | Contrôle du joueur | Hybride évolutif |
| 13 | Échec | Conséquences persistantes, reconstruction possible |
| 14 | Objectifs | Accomplissements majeurs et poursuite libre |
| 15 | Référentiel | Base structurée et visualisation |
| 16 | Granularité | Compétences hiérarchisées |
| 17 | Maîtrise | Progression continue avec paliers |
| 18 | Oubli | Régression pratique légère et récupération rapide |
| 19 | Propriétés physiques | Modules normalisés réutilisables |
| 20 | Méthode | Jouabilité rapide, concepts testés palier par palier (13/11/2026) |
| 21 | Outillage | Dépôt GitHub `Ghepito/Babylon` (13/11/2026) |
| 22 | Moteur 3D | Babylon.js dans le navigateur (Unreal écarté, jugé trop complexe) |
| 23 | Référentiel V1 | Structure, contenu de la phase 1 et vue réseau validés en l'état (13/11/2026) ; valeurs numériques toujours provisoires |

## PROPOSÉ (non validé)

- Échelle de maîtrise 0-100 avec six paliers : novice, initié, apprenti, compétent, confirmé, expert (seuils à définir).
- Stockage : SQLite pour la conception, JSON pour le jeu, Excel pour la consultation.
- Vocabulaire des relations : REQUIERT (ET/OU/NON), CONSOMME, PRODUIT, TRANSFORME, UTILISE, ALIMENTE, ENTRETIENT, DEBLOQUE, AMELIORE, TRANSMET, DEGRADE, SATISFAIT, REDUIT_RISQUE.
- Saisie du référentiel en fichiers YAML (lisibles, commentables), construits en SQLite puis exportés en JSON/Excel par `tools/referentiel.py`.
- Contenu de la phase 1 : 81 éléments (6 besoins, 8 sources, 10 ressources, 3 objets, 3 installations, 11 compétences, 9 techniques, 6 connaissances, 25 procédés) — voir `referentiel/donnees/phase1/`.
- Valeurs numériques (durées, quantités, baisses des besoins) : provisoires, à calibrer en jouant.
- Moteur (palier 2) : échelle de temps 1 s réelle = 1 min de jeu, règles de besoins, de santé, d'expérience et de découverte, IA par objectifs — voir [`moteur.md`](moteur.md).
- Découpage en paliers : voir [`feuille-de-route.md`](feuille-de-route.md).
