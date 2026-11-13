# Consignes pour Claude — projet Babylon

- Langue : tout en **français** (code commenté en français, documentation, messages de commit).
- Ne jamais présenter une proposition comme une décision : utiliser les statuts **VALIDÉ / PROPOSÉ / À RÉALISER** et tenir `docs/decisions.md` à jour (seul Laurent-Olivier valide).
- Avancer par **paliers jouables** (`docs/feuille-de-route.md`) ; ne pas construire l'inventaire exhaustif avant d'avoir un palier jouable qui l'exploite.
- `src/sim/` ne doit dépendre ni de Babylon.js ni du DOM : il doit pouvoir tourner dans Node pour les scénarios de test.
- Le jeu est une page statique (GitHub Pages) : pas d'étape de build obligatoire, modules ES natifs, Babylon.js chargé depuis un CDN.
- Le référentiel source est dans `referentiel/` ; `data/*.json` est **généré** par `tools/` — ne pas l'éditer à la main.
- Tester avant de livrer : scénarios du moteur dans Node, captures du rendu dans Chrome sans écran.
