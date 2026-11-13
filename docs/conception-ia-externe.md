**Projet JEU — Synthèse générale du système de survie**

Document de référence — État d'avancement au 13 novembre 2026

Nous avons effectué un important travail de conception depuis ton idée initiale : un personnage solitaire qui doit trouver de la nourriture, fabriquer des outils, maîtriser le feu et construire son premier abri.

Notre projet a progressivement évolué vers un **simulateur de survie et de développement d'une civilisation**, depuis les premiers gestes de survie jusqu'à l'ère industrielle.

J'ai également enregistré les décisions validées, notre progression et les travaux restant à réaliser dans la mémoire du projet.

Je distinguerai désormais systématiquement trois statuts :

- **VALIDÉ** : décision que tu as explicitement approuvée.

- **PROPOSÉ** : solution envisagée, mais pas encore définitivement validée.

- **À RÉALISER** : travail non encore effectué.

Cette distinction est importante pour éviter de présenter ultérieurement une simple proposition comme une décision acquise.

**1. La philosophie du jeu**

Notre principe fondateur est le suivant :

**Le besoin provoque l'action, l'action favorise l'apprentissage, l'apprentissage permet de nouvelles réalisations, et ces réalisations créent de nouvelles possibilités, contraintes ou nécessités.**

Par exemple :

**Besoin : se nourrir**

**Cueillette**

**Chasse**

**Nourriture obtenue**

Périssabilité, transport, quantité limitée

**Nouveau besoin : conserver la nourriture**

Séchage, fumage, stockage, protection

**Développement de nouvelles capacités**

Réserves durables, organisation, production alimentaire

Cette logique s'appliquera ensuite à l'agriculture, à l'artisanat, à la métallurgie, aux machines et aux chaînes de production industrielles.

Nous avons aussi retenu que plusieurs solutions techniquement plausibles peuvent satisfaire un même besoin.

L'arbre ne sera donc pas strictement linéaire : **il s'agira d'un réseau de compétences, de connaissances, de ressources et de dépendances croisées.**

**2. Les 19 décisions officiellement validées**

Voici la totalité de nos choix, dans leur ordre de validation.

| **N°** | **Domaine**             | **Décision**                                                 |
|--------|-------------------------|--------------------------------------------------------------|
| 01     | Évolution technologique | Survie primitive jusqu'à l'ère industrielle                  |
| 02     | Réalisme                | Simulation poussée                                           |
| 03     | Acquisition initiale    | Découverte, prérequis, expérimentation et pratique           |
| 04     | Population              | Personnage solitaire puis communauté                         |
| 05     | Autonomie collective    | Gestion par objectifs et priorités                           |
| 06     | Apprentissage           | Naturel et formation dirigée                                 |
| 07     | Ressources              | Modèle hybride : lots et objets individualisés               |
| 08     | Monde                   | Modèle hybride : détail local, simulation agrégée à distance |
| 09     | Temps                   | Continu, pause active et accélération                        |
| 10     | Découvertes             | Émergentes encadrées                                         |
| 11     | Démographie             | Rencontres, accueil et générations                           |
| 12     | Contrôle du joueur      | Hybride évolutif                                             |
| 13     | Échec                   | Conséquences persistantes, reconstruction possible           |
| 14     | Objectifs               | Accomplissements majeurs et poursuite libre                  |
| 15     | Référentiel             | Base structurée et visualisation                             |
| 16     | Granularité             | Compétences hiérarchisées                                    |
| 17     | Maîtrise                | Progression continue avec paliers                            |
| 18     | Oubli                   | Régression pratique légère et récupération rapide            |
| 19     | Propriétés physiques    | Modules normalisés réutilisables                             |

Validation des choix de conception

19 / 19

Les 19 choix identifiés lors de notre cadrage sont validés. Cela ne signifie pas que le référentiel informatique est terminé.

**3. L'évolution du monde et de la communauté**

Nous avons retenu une progression sur plusieurs générations, avec des phases de développement technologique et social.


**Phase 1 — Survie primitive**

Recherche de nourriture et d'eau, protection, premiers outils, abri provisoire.


**Phase 2 — Survie maîtrisée**

Chasse organisée, feu, vêtements, conservation, coopération et partage.


**Phase 3 — Sédentarisation**

Agriculture, élevage, poterie, stockage, bâtiments permanents.


**Phase 4 — Métallurgie**

Extraction minière, combustibles, fours, cuivre, bronze, fer.


**Phase 5 — Mécanisation**

Moulins, engrenages, ateliers spécialisés, énergie hydraulique et éolienne.


**Phase 6 — Révolution industrielle**

Vapeur, chaudières, machines-outils, transmission de puissance, production mécanisée.


**Phase 7 — Industrialisation avancée**

Production électrique, moteurs, réseaux, mécanisation et automatisation simple.

Ces phases sont des **repères de conception**, pas des niveaux obligatoires. Les différentes branches techniques pourront évoluer indépendamment.

La communauté grandira par recrutement et par générations. Chaque nouvel individu apportera des capacités, mais créera également des besoins supplémentaires.

Le joueur pourra incarner des personnages successifs, tout en conservant la possibilité de piloter les objectifs collectifs.

**4. Les règles de simulation**

Nous avons défini les principaux mécanismes devant interagir en permanence.

| **Système**    | **Fonctionnement prévu**                              |
|----------------|-------------------------------------------------------|
| Besoins vitaux | Faim, soif, fatigue, santé, température               |
| Environnement  | Biomes, saisons, climat, faune, flore                 |
| Matières       | Quantités, propriétés, transformations, dégradation   |
| Équipements    | Qualité, efficacité, usure, entretien                 |
| Temps          | Durée des actions et évolution continue du monde      |
| Personnages    | Aptitudes, expérience, santé, vieillissement          |
| Activités      | Travail, déplacements, fabrication, apprentissage     |
| Organisation   | Priorités, affectations, approvisionnement            |
| Risques        | Accidents, maladies, pénuries, destructions           |
| Transmission   | Observation, enseignement, documentation              |
| Développement  | Découvertes, innovations, amélioration des techniques |

Ces mécanismes devront produire des interactions indirectes.

Par exemple, le manque de bois pourra affecter simultanément le chauffage, la cuisine, la construction et certaines fabrications.

Une communauté devra alors réorganiser ses priorités.

Le joueur ne donnera pas nécessairement chaque ordre individuel. Les personnages agiront dans le cadre des objectifs définis, tout en conservant leurs propres besoins.

**5. La structure des compétences**

C'est le cœur de notre projet.

Nous avons retenu trois niveaux complémentaires.

**Aptitude générale**

Exemple : travail du bois

**Spécialisation**

Construction

**Spécialisation**

Fabrication d'outils

Techniques d'assemblage

Techniques de façonnage

La compétence décrit une aptitude évolutive.

La technique représente une méthode connue ou apprise.

Le procédé décrit comment utiliser cette technique avec les ressources, les outils et les conditions appropriés.

L'action représente son exécution réelle dans le jeu.

Nous avons également retenu des compétences transversales : la mesure, par exemple, pourra contribuer à la construction, à la mécanique, à la métallurgie et au contrôle qualité.

**Maîtrise et oubli**

Le principe de progression continue est validé. Nous avons proposé une échelle de 0 à 100 et six paliers : novice, initié, apprenti, compétent, confirmé et expert.

Les seuils précis ne sont pas encore validés.

L'oubli sera léger : nous distinguerons une maîtrise durablement acquise d'une efficacité pratique momentanément diminuée par l'inactivité.

Les valeurs numériques de pénalité, les gains d'expérience et les courbes de progression restent à calibrer.

**6. Le modèle de données**

Nous avons retenu une séparation entre les définitions permanentes et l'état réel d'une partie.

**Référentiel permanent**

Ce qui existe et ce qui est techniquement possible

**Moteur de règles**

Prérequis, transformations, apprentissages, risques

**État de partie**

Ce qui existe réellement, les possessions et les compétences des personnages

**Visualisations**

Compétences, chaînes techniques, dépendances, progression

**Entités prévues**

| **Catégorie**        | **Entités**                         |
|----------------------|-------------------------------------|
| Besoins et objectifs | Besoin, objectif, effet             |
| Connaissances        | Connaissance, compétence, technique |
| Production           | Procédé, opération, action          |
| Matières et moyens   | Ressource, objet, installation      |
| Simulation           | Personnage, communauté, tâche, lot  |
| Monde et règles      | Condition, événement, propriété     |

Les propriétés seront modulaires et normalisées.

Nous avons notamment prévu des modules physiques, thermiques, mécaniques, alimentaires, biologiques, chimiques, énergétiques et de dégradation.

Point essentiel : le moteur pourra connaître les propriétés réelles d'un objet ou d'une plante sans que le personnage les connaisse.

Cela préservera notre mécanisme de découverte.

**Relations entre éléments**

Le système devra gérer plusieurs types de relations :

- Prérequis et conditions : REQUIERT, avec expressions logiques ET, OU, NON.

- Transformations : CONSOMME, PRODUIT, TRANSFORME.

- Utilisations : UTILISE, ALIMENTE, ENTRETIENT.

- Progression : DEBLOQUE, AMELIORE, TRANSMET.

- Conséquences : DEGRADE, SATISFAIT, REDUIT_RISQUE.

Ces noms constituent un vocabulaire de travail. Le dictionnaire technique définitif et les types de relations autorisées restent à finaliser.

Il faudra distinguer les prérequis de découverte, d'apprentissage et d'exécution.

**7. La solution technique envisagée**

**SQLite — Proposition technique retenue pour le prototype**

Stockage relationnel, références, identifiants stables, intégrité et sauvegardes.

**JSON — Conditions et paramètres complexes**

Expressions imbriquées, déclencheurs, effets et règles spécifiques.

**Excel — Consultation et exploitation**

Tableaux filtrables, contrôles, inventaires et éditions structurées.

**Graphe interactif — Visualisation ultérieure**

Navigation entre les compétences, les procédés, les ressources et les relations.

**Précision importante :** nous avons seulement commencé à écrire des exemples de SQL et de JSON. Nous n'avons pas encore créé une base SQLite complète, ni exécuté les validations techniques.

Le schéma présenté précédemment est donc une ébauche, et non un logiciel opérationnel.

**8. Les contrôles de cohérence prévus**

Notre référentiel devra être capable de détecter :

| **Risque**                      | **Contrôle**                                       |
|---------------------------------|----------------------------------------------------|
| Identifiant inexistant          | Vérification des références                        |
| Relation incohérente            | Vérification des types compatibles                 |
| Prérequis impossible            | Analyse des chemins d'accès                        |
| Dépendance circulaire bloquante | Détection des cycles sans solution initiale        |
| Ressource impossible à obtenir  | Vérification des origines et productions           |
| Consommation concurrente        | Réservation des stocks et opérations atomiques     |
| Transformation incohérente      | Vérification des quantités, unités et propriétés   |
| Progression irréalisable        | Simulation de scénarios depuis les états initiaux  |
| Production non soutenable       | Comparaison des besoins et capacités de production |
| Connaissance perdue             | Analyse de la transmission et de la documentation  |

Tous les cycles ne seront pas considérés comme des erreurs.

Par exemple, une première technique métallurgique peut permettre d'obtenir de meilleurs outils, qui permettront ensuite d'améliorer cette même métallurgie.

Nous devrons distinguer une boucle d'amélioration légitime d'une dépendance impossible à initialiser.

**9. Notre état d'avancement réel**

Je veux être précis sur ce point pour la suite du projet.

Situation actuelle

| Philosophie et objectifs du jeu      | Validés      |
|--------------------------------------|--------------|
| 19 décisions structurantes           | Validées     |
| Architecture logique générale        | Définie      |
| Modèle conceptuel des compétences    | Défini       |
| Tables et relations techniques       | Ébauchées    |
| Schéma SQL complet                   | À réaliser   |
| Base SQLite opérationnelle           | À réaliser   |
| Validateurs automatiques             | À réaliser   |
| Inventaire exhaustif des compétences | Non commencé |
| Arbre interactif                     | Non commencé |

**10. La feuille de route restante**

1.  **Finaliser le schéma technique V1.0**

Définir toutes les tables, les champs, les contraintes, les identifiants, les relations et le versionnement.

2.  **Créer le référentiel SQLite initial**

Construire une base vide de compétences, mais contenant sa structure et ses dictionnaires de référence.

3.  **Développer les contrôles automatiques**

Vérifier les prérequis, les unités, les types, les chemins d'accès et les transformations.

4.  **Tester quelques scénarios techniques**

Utiliser des exemples temporaires de cueillette, de feu, d'outillage et de fabrication pour éprouver le modèle. Ces tests ne constitueront pas encore l'inventaire définitif.

5.  **Établir l'inventaire exhaustif**

Recenser les besoins, ressources, connaissances, compétences, techniques et procédés, de la survie primitive à l'industrie.

6.  **Analyser toutes les interactions**

Identifier les prérequis, alternatives, synergies, dépendances croisées et possibilités de progression.

7.  **Construire les visualisations**

Créer plusieurs vues à partir de la base : arbre des compétences, réseau technique, chaînes de production et progression des personnages.

8.  **Tester l'équilibrage de la simulation**

Contrôler les durées, rendements, besoins, pénuries, apprentissages et comportements collectifs.

**11. Ce que je conserve en mémoire pour la suite**

J'ai enregistré les 19 choix validés, la structure générale du système, les distinctions fondamentales entre compétences, techniques, procédés et actions, ainsi que notre état d'avancement.

J'ai également conservé une instruction particulièrement importante : **ne pas commencer à construire ni à remplir l'arbre des compétences avant que le référentiel technique soit suffisamment formalisé et vérifié.**

La mémoire me servira à retrouver notre progression lors des prochaines conversations. Pour les spécifications techniques très détaillées, ce récapitulatif restera toutefois une référence plus fiable qu'un simple souvenir synthétique. Je ne considérerai pas comme réalisé un fichier, un schéma ou un contrôle qui n'a pas effectivement été créé et vérifié.

**Ma conclusion**

Nous sommes passés d'une idée de départ relativement simple à un projet structuré autour de trois principes fondamentaux :

**1. Le réalisme des interactions.** Chaque ressource, action, compétence et réalisation doit avoir une influence concrète sur d'autres éléments.

**2. La progression émergente.** Le personnage et sa communauté progressent parce qu'ils rencontrent des problèmes, découvrent des solutions et perfectionnent leurs techniques.

**3. La cohérence technique.** Les réalisations avancées doivent pouvoir être expliquées à partir des connaissances, des procédés, des ressources et des infrastructures qui les rendent possibles.

Notre prochain jalon est clairement identifié :

**Finaliser et tester le référentiel informatique V1.0, sans encore construire l'arbre des compétences.**

Nous avons maintenant une base de conception stable pour poursuivre le projet méthodiquement, sans repartir de zéro ni modifier involontairement les décisions que tu as déjà validées.
