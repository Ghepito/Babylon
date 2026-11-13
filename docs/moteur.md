# Moteur de simulation (palier 2)

Statut : **PROPOSÉ** — livré le 13/11/2026, à valider en jouant. Toutes les valeurs numériques sont provisoires.

- 🎮 **Console jouable (sans 3D)** : [`vues/simulation.html`](../vues/simulation.html)
- 📖 **Récit d'une partie autonome de 7 jours** : [`scenario-solitaire.md`](scenario-solitaire.md)
- 🧪 **Scénarios de test** : `npm test` (13 scénarios dans `tests/sim/`)

## Organisation du code (`src/sim/`)

| Fichier | Rôle |
|---|---|
| `referentiel.js` | Compile `data/referentiel.json` : index, procédés prêts à l'emploi, qui produit quoi |
| `simulation.js` | Le moteur : temps, monde, besoins, actions, production, usure, découvertes, compétences, journal, sauvegarde |
| `regles.js` | Règles générales et paramètres de calibrage (un seul endroit à modifier) |
| `ia.js` | IA autonome : urgences, puis objectifs par chaînage arrière |
| `aleatoire.js` | Hasard à graine : une même graine rejoue exactement la même partie |

Le moteur ne dépend ni de Babylon.js ni de la page : il tourne aussi dans Node, ce qui permet les tests automatiques.

## Le temps (décision 09 : continu, pause active, accélération)

- À la vitesse ×1, **1 seconde réelle = 1 minute de jeu** : une journée dure 24 minutes.
- Vitesses : pause, ×1, ×5, ×20, ×60, ×240. En pause, on peut toujours consulter et donner des ordres.
- Température : environ 22 °C vers 15 h, 6 °C vers 3 h du matin.

## Les besoins

| Besoin | Baisse | Ce qui le satisfait (phase 1) |
|---|---|---|
| Soif | 6 / h | puiser puis boire |
| Faim | 3 / h | baies (champignons : risqué) |
| Repos | 2,5 / h (+20 % en activité) | dormir dehors, mieux dans l'abri |
| Chaleur | selon la température ressentie (+10 °C près du feu, +5 °C dans l'abri) | feu, abri |
| Sécurité | 1 / h | feu, abri |
| Santé | baisse quand soif, faim, chaleur ou repos sont à 0 ; remonte doucement si tout va bien | sommeil |

Pendant le sommeil, faim et soif baissent deux fois moins vite. Quand la santé atteint 0, le personnage meurt (décision 13 : conséquences persistantes).

## Les actions

Une action est l'exécution d'un procédé du référentiel. Elle est possible si :
la technique est connue, les prérequis présents (source, installation allumée, connaissance), les ressources disponibles,
un outil de chaque groupe « OU » possédé, et les conditions de compétence remplies.
**Sinon, le moteur explique pourquoi** (ex. « il faut 15 kg de branches vertes (3) »).

- **Durée** : un novice met 1,4 × le temps prévu, un expert 0,7 ×.
- **Effets** : consommation, production (parfois aléatoire), usure des outils, effets sur les besoins (progressifs pendant l'action).
- **Expérience** : chaque action fait progresser la compétence de sa technique, et 30 % du gain remonte à la compétence générale. Boire, manger et dormir ne font pas progresser.
- **Paliers** : novice (0), initié (10), apprenti (25), compétent (45), confirmé (65), expert (85).

## Les découvertes (décisions 03 et 10)

- Une **expérimentation** (frotter deux bois, frapper un silex…) a une **chance** d'apporter une connaissance, augmentée par la compétence « Observation et expérimentation ».
- Certaines connaissances ne s'apprennent qu'à ses dépens (le danger des champignons : seulement après une intoxication).
- Dès que les prérequis de découverte d'une technique sont réunis, elle est découverte et de nouvelles actions apparaissent.

## Le feu

Un feu allumé consomme 1,5 kg de bois par heure (capacité 6 kg). Il s'éteint sans entretien ; on le rallume avec le nécessaire à feu. Le bois sec l'alimente (relation `ALIMENTE`).

## L'IA autonome

1. **Urgences** : soif, faim, entretien du feu, froid, sommeil.
2. **Objectifs**, dans l'ordre : faire du feu, construire un abri, préparer une couche, façonner un biface.
   L'IA raisonne à rebours : « pour un biface il faut un niveau 25 en taille → je m'entraîne en taillant des éclats → pour cela il me faut du silex et un galet → je vais en ramasser ».
3. **Réserves et expérimentation** quand tout va bien.

Ce même planificateur servira à la gestion par **objectifs et priorités** de la communauté (décision 05, palier 5).

## Transport (VALIDÉ le 13/11 : « oui pour le transport »)

- À mains nues : **30 kg** au plus et **4 outils** (valeurs PROPOSÉES). Au-delà, le surplus reste au sol (journal « trop chargé »).
- Quand les mains sont pleines, un outil usé en double est lâché pour prendre le nouveau.
- Les déchets de taille (éclats de silex) restent sur l'aire de taille.
- Une action qui ferait dépasser la charge est indisponible : « trop chargé (30 / 30 kg) ». On peut **poser** ce que l'on porte.

## Réglages du 13/11

- Cueillette : progression ×0,3 (« downgrade un peu ») → compétente en une semaine au lieu d'experte.
- Feu : capacité portée à 12 kg et nouvelle action **« Charger le feu pour la nuit (3 bûches) »** ; l'IA fait provision de bois le soir.
- Restes à calibrer : le feu s'éteint encore certaines nuits (vers minuit) quand la provision de bois est insuffisante.
