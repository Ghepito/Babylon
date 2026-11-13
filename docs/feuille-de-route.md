# Feuille de route

Démarche **VALIDÉE** (13/11/2026) : de la jouabilité rapidement, pour tester les concepts palier par palier.
Le découpage en paliers ci-dessous est **PROPOSÉ**.

| Palier | Objectif | Livrable jouable / vérifiable | Statut |
|---|---|---|---|
| 0 | Mise en place du dépôt | Structure, documentation, prototype démo 3 | Fait (13/11) |
| 1 | Référentiel V1 minimal | Schéma SQLite + ~40 éléments de la phase 1 (eau, baies, bois, silex, feu, abri…) + validateurs + export JSON + vue du réseau de dépendances | Livré (13/11) — à valider |
| 2 | Moteur de simulation (sans 3D) | Temps continu (pause, accélération), besoins vitaux, actions avec durée qui consomment et produisent, lots de ressources ; testé par scénarios automatiques | À RÉALISER |
| 3 | Le survivant solitaire | Dans Babylon : un personnage boit, cueille, ramasse du bois, taille un silex, découvre le feu, construit un abri | À RÉALISER |
| 4 | Découvertes et apprentissage | Compétences 0-100 et paliers, oubli léger, propriétés cachées découvertes par l'expérience | À RÉALISER |
| 5 | Communauté | Rencontres, accueil, objectifs et priorités collectifs, tâches automatiques | À RÉALISER |
| 6+ | Phases suivantes | Survie maîtrisée, sédentarisation, métallurgie… une branche technique à la fois | À RÉALISER |

## Principes de simplification PROPOSÉS pour les premiers paliers

- Ressources : tout en **lots** d'abord ; objets individualisés seulement pour les outils (usure).
- Monde : une seule zone détaillée ; la simulation agrégée à distance viendra plus tard.
- Contrôle : ordres directs au personnage d'abord ; objectifs et priorités avec la communauté (palier 5).
- Référentiel : conçu dans SQLite, contrôlé par scripts, **exporté en JSON** pour le jeu (pas de base de données embarquée dans la page).
