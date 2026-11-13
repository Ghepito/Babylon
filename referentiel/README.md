# Référentiel

Le référentiel décrit **ce qui existe et ce qui est techniquement possible** (définitions permanentes), indépendamment de l'état d'une partie.

Statut : **squelette PROPOSÉ** — le schéma V1 sera finalisé au palier 1, en même temps que les ~40 premiers éléments de la phase 1, puis éprouvé dans le jeu.

## Chaîne de production des données (PROPOSÉE)

```
referentiel/schema.sql        structure (tables, contraintes)
referentiel/donnees/*.sql     contenu (phase 1 d'abord)
        │  tools/construire.py
        ▼
referentiel/babylon.sqlite    base de travail (non versionnée)
        │  tools/valider.py   → références, types, cycles, ressources introuvables…
        │  tools/exporter.py  → data/referentiel.json (lu par le jeu)
        ▼                       referentiel/export.xlsx (consultation)
```

## Entités prévues

| Catégorie | Entités |
|---|---|
| Besoins et objectifs | besoin, objectif, effet |
| Connaissances | connaissance, compétence, technique |
| Production | procédé, opération, action |
| Matières et moyens | ressource, objet, installation |
| Monde et règles | condition, événement, propriété |

L'état de partie (personnages, communauté, tâches, lots) n'est **pas** dans le référentiel : il appartient au moteur (`src/sim/`).
