# Référentiel

Le référentiel décrit **ce qui existe et ce qui est techniquement possible** (définitions permanentes), indépendamment de l'état d'une partie.

Statut : **V1 PROPOSÉE** (palier 1) — phase 1 « survie primitive », personnage solitaire.

- 🔎 **Vue interactive du réseau** : [`vues/reseau.html`](../vues/reseau.html) (via GitHub Pages)
- 📋 **Dernier rapport de validation** : [`rapport-validation.md`](rapport-validation.md)
- 📊 **Consultation Excel** : [`export/referentiel.xlsx`](export/referentiel.xlsx) (feuilles Éléments, Relations, Propriétés, Validation)

## Chaîne de production des données

```
referentiel/dictionnaires.yaml   types d'éléments, types de relations autorisées, unités, modules de propriétés
referentiel/donnees/**/*.yaml    contenu, saisi à la main (lisible et commentable)
referentiel/donnees/depart.yaml  scénarios de départ (ce que le personnage sait, ce que le monde contient)
        │
        │  python3 tools/referentiel.py
        ▼
referentiel/babylon.sqlite       base de travail (reconstruite à chaque fois, non versionnée)
referentiel/rapport-validation.md
referentiel/export/referentiel.xlsx
data/referentiel.json            ← lu par le jeu et par la vue réseau
```

Le code de sortie de l'outil est non nul s'il reste une **erreur** : on ne livre pas un référentiel incohérent.

## Types d'éléments

| Préfixe | Type | Rôle |
|---|---|---|
| `bes.` | Besoin | Faim, soif, repos, chaleur, sécurité, santé |
| `src.` | Source naturelle | Lieu de prélèvement (lac, buisson, affleurement…) |
| `res.` | Ressource | Matière comptée en lots (kg, l, unités) |
| `obj.` | Objet | Objet individualisé qui s'use (outils) |
| `ins.` | Installation | Construit et fixe (foyer, abri) |
| `comp.` | Compétence | Aptitude 0-100, hiérarchisée (`specialise:`) |
| `tech.` | Technique | Méthode connue ou à découvrir (`releve_de:` une compétence) |
| `con.` | Connaissance | Savoir acquis par l'expérience |
| `proc.` | Procédé | Application d'une technique ; son exécution en jeu est une **action** |

## Saisir un procédé (exemple commenté)

```yaml
- id: proc.allumer_feu             # identifiant stable : préfixe + nom
  nom: Allumer un feu par friction
  met_en_oeuvre: tech.allumage_friction   # exactement une technique
  duree: 240                       # secondes de jeu
  requiert: [src.prairie]          # présence nécessaire (source, connaissance, installation)
  utilise: [obj.necessaire_feu]    # outil non consommé ; « groupe » = l'un OU l'autre ; « optionnel: true » = bonus
  degrade: {obj.necessaire_feu: 10}        # usure en %
  consomme: {res.herbes_seches: 0.1, res.bois_sec: 1}   # dans l'unité de la ressource
  produit: {ins.foyer: 1}          # ou {quantite: 1, parametres: {probabilite: 0.3}}
  satisfait: {bes.chaleur: 20}     # effet sur un besoin (points)
  aggrave: {bes.sante: 30}
  debloque: [con.combustion]       # connaissance acquise en pratiquant
  condition: {competence: comp.taille, min: 25}   # ET / OU / NON possibles : {"et": [...]}, {"ou": [...]}
```

Une technique se découvre quand tous ses prérequis de découverte sont réunis :

```yaml
- id: tech.allumage_friction
  releve_de: comp.allumage
  decouverte: [con.frottement_chaleur, con.combustion]
```

Les propriétés sont rangées par module ; `cachee: true` = connue du moteur, à découvrir par le personnage :

```yaml
  proprietes:
    biologique: {toxicite: {valeur: 0.4, cachee: true}}
```

## Contrôles effectués

| Contrôle | Ce qui est vérifié |
|---|---|
| Saisie | Préfixes, clés connues, identifiants uniques |
| Références | Toute relation, condition ou scénario pointe vers un élément existant |
| Types | La relation est autorisée entre ces deux types (`dictionnaires.yaml`) |
| Unités / quantités | Unités connues et cohérentes, quantités positives, probabilités dans ]0 ; 1] |
| Structure | Un procédé = une technique ; une technique = une compétence ; hiérarchie sans boucle |
| Origine | Chaque ressource, objet, installation est produit par au moins un procédé |
| Accessibilité | Depuis chaque scénario de départ, tout doit être atteignable (avec la cause du blocage sinon) |
| Besoins | Chaque besoin peut être satisfait par un procédé accessible |
| Cycles | Boucle légitime (amorçable) ou dépendance circulaire bloquante |
| Isolés / découverte | Éléments reliés à rien ; inventaire des propriétés cachées |

À RÉALISER : production non soutenable (bilans besoins / capacités), connaissance perdue (transmission), consommation concurrente (relève du moteur).
