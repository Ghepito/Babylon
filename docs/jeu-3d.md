# Le jeu en 3D — palier 3 « le survivant »

Statut : **PROPOSÉ** — livré le 13/11/2026, à valider en jouant : [`jeu.html`](../jeu.html)

## Ce qui est en place

- Le **moteur du palier 2** pilote tout : besoins, actions, découvertes, compétences, feu, transport. La 3D ne fait que le montrer et lui transmettre les ordres.
- **Arok marche réellement** jusqu'au lieu d'une action (lac, buissons, bois mort, arbres, prairie, galets, silex, sous-bois, feu, abri). Le temps de jeu passe pendant la marche : un aller-retour lointain coûte de la soif et de la fatigue.
- **Chaque procédé a sa posture** : accroupi pour puiser, cueillette, ramassage, taille du silex avec la hache de pierre, friction pour le feu, jet de bûches, assis près du feu, couché pour dormir.
- **Ce qu'il porte se voit** : bûches sur l'épaule, fagot de branches, brassée de feuillage, sac de pierres, baies à la ceinture.
- **Les installations apparaissent au campement** quand elles sont construites : foyer (flammes et lumière qui suivent la quantité de bois), abri en appentis, couche de feuillage.
- **Jour et nuit** suivent l'horloge du moteur : soleil, lune, ciel, brume ; la nuit, seul le feu éclaire vraiment.
- **Brouillard d'exploration** : la carte se découvre autour d'Arok.
- Les baies des buissons diminuent quand on les cueille et repoussent.

## Stocks par lieu et stockage au sol

- Arok va à **l'arbre (ou au buisson…) que l'on a cliqué** ; depuis la barre d'actions ou avec l'IA, il va au plus proche qui n'est pas épuisé.
- Un arbre dont on a prélevé les branches apparaît **dépouillé** jusqu'à ce qu'il repousse ; les baies, les tas de bois mort et les champignons diminuent site par site.
- **⤓ dans l'inventaire** : au campement, l'objet va dans la **réserve du camp** (visible près du feu) ; ailleurs, il forme un **tas au sol**.
- **Cliquer un tas** : prendre ce qu'il contient, ou y déposer ce que l'on porte (Arok s'y rend).

## Commandes

| Geste | Effet |
|---|---|
| Clic sur un élément du monde | Menu des actions possibles à cet endroit (avec la raison si impossible) |
| Clic sur Arok | Actions sur place (boire, manger, expérimenter, fabriquer…) |
| Clic au sol | Y aller |
| Barre du bas | Toutes les actions connues ; 🚶 = il ira sur place ; Maj+clic = à la suite |
| Glisser / molette / ZQSD / A E | Caméra |
| Espace · F · I · Échap | Pause · suivre Arok · IA autonome · fermer |

Donner un ordre désactive l'IA autonome (on reprend la main).

## Organisation du code

| Fichier | Rôle |
|---|---|
| `src/jeu.js` | Assemblage : moteur, monde, personnage, interface, boucle |
| `src/render/environnement.js` | Relief, ciel, eau, jour/nuit, ombres, post-traitement, brouillard, caméra |
| `src/render/carte.js` | Lieux des sources du référentiel ; installations synchronisées avec la simulation |
| `src/render/personnage-modele.js` | Le personnage détaillé et ses charges portées |
| `src/render/agent.js` | Lien personnage ↔ moteur : marche, lancement des actions, postures |

L'agent est testé sans 3D (`tests/render/agent.test.mjs`) : avec la marche, l'IA survit 5 jours et construit feu et abri.

## Pistes repérées

- La caméra peut se retrouver derrière les arbres en forêt (zoomer ou tourner).
- Les déchets de taille et le surplus posé au sol ne sont pas encore visibles.
- L'IA n'utilise pas encore la réserve du camp de sa propre initiative.
