# Hopla Hotel — V2

Site local disponible dès le début à `http://www.hoplahotel.fr/`. La saisie
`www.hoplahotel.fr` fonctionne également. L'accueil, « Entrer dans l'hôtel »,
XD Search et l'alias `www.xdhotel.fr` sont conservés. Les fichiers et identifiants
internes `xdhotel` restent inchangés, ainsi que le format des sauvegardes.

## Salles et navigation

Le bouton **Navigateur** ouvre un panneau rétro présentant les cinq salles,
leur description et un bouton **Entrer**. **Fermer**, le bouton Navigateur ou
Échap referment le panneau. Celui-ci suspend la marche tant qu'il est ouvert.
Entrer dans une salle ferme le panneau et ouvre sa route locale dans le même
onglet : l'ancien déplacement est annulé, le nouveau décor est chargé, le nom
est actualisé et l'avatar apparaît au point de départ de cette salle.

| Salle         | Route                | Décor                                                     | PNJ statique   |
| ------------- | -------------------- | --------------------------------------------------------- | -------------- |
| Hall          | `/salle/hall`        | Mobilier et disposition conservés                         | ReceptionHotel |
| Café Hopla    | `/salle/cafe`        | Palette chaude, comptoir, tables, chaises et plante       | CafeMax        |
| Discothèque   | `/salle/discotheque` | Sol coloré, lumières fixes, enceintes et banquette        | DJ_Biscotte    |
| Salon détente | `/salle/detente`     | Tons verts, tapis, canapés, table basse et plantes        | PauseCafe      |
| Salle de jeux | `/salle/jeux`        | Tons bleus, bornes décoratives, affiches, table et chaise | RetroFred      |

Les dialogues sont courts et ordinaires. Les PNJ ne se déplacent pas. La
Discothèque ne joue pas de musique et les bornes de la Salle de jeux restent
décoratives. Le nom visible du réceptionniste est ReceptionHotel ;
son identifiant `reception-xd`, sa position et sa réplique sont conservés.

## Données et moteur commun

Le Hall reste dans `data.room` ; les quatre nouvelles définitions sont dans
`data.rooms`. Le registre et le Navigateur construisent automatiquement leur
liste à partir de ces données. Chaque définition décrit `id`, `name`,
`description`, `width`, `height`, `spawn`, `blocked`, `furniture` et `npcs`.
Les nouvelles salles ajoutent une `palette` et une `decor` facultatives
(zones de sol, affiches et lumières fixes). Les valeurs par défaut conservent
le rendu du Hall. Les cinq grilles mesurent 10 × 10.

La projection isométrique, son inverse, BFS, les collisions et l'interpolation
des déplacements restent dans `model.js`, sans modification. Les empreintes
bloquantes des meubles et PNJ utilisent les règles existantes. Les nouvelles
formes de chaises, enceintes et bornes sont dessinées dans le même Canvas que
les meubles existants ; personnages et mobilier gardent le tri par profondeur.
L'apparence de l'avatar est conservée. Les graphismes sont originaux et réalisés
avec les formes simples du renderer, sans ressource distante.

Pour ajouter une salle utilisant les formes disponibles, ajouter uniquement
une définition à `data.rooms` : sa route et son entrée dans le Navigateur sont
créées automatiquement. Vérifier les limites, les empreintes, le point de départ
libre et l'accessibilité. Une forme de meuble supplémentaire se dessine dans
`draw.js`. Une grille beaucoup plus grande demanderait une adaptation du cadrage.

## Onglets et nettoyage

Chaque rendu possède son propre déplacement, sa bulle et ses frames. Les hooks
existants du navigateur, `preserveOnTabSwitch`, `onDispose('pause')` et `onResume`,
conservent la salle et la position lors d'un changement d'onglet et suspendent
les frames de l'onglet inactif. Deux onglets restent indépendants.

Changer de salle ou de page, fermer l'onglet ou le navigateur nettoie le rendu :
frames annulées, observateur déconnecté et écouteurs retirés. Rouvrir une salle
crée une instance au point de départ. Les URL et historiques restent gérés par
le navigateur existant ; aucune position, salle ou interaction n'est ajoutée
au schéma de sauvegarde. Le retour à l'accueil permet de retrouver le Hall.

Le moteur reste inactif au repos. La marche et l'expiration d'une bulle demandent
les frames nécessaires ; la bulle dure 4,5 secondes. Le Canvas interne de
400 × 300 conserve ses pixels à la mise à l'échelle et s'ajuste à l'espace
disponible avec le `ResizeObserver` existant.

Aucun changement des autres sites, du navigateur global, des sauvegardes,
des événements narratifs, du réseau, d'Electron, des permissions ou des
dépendances. Aucun compte, chat libre, multijoueur, musique ou nouveau mini-jeu.

## Fichiers modifiés pour la V2

- `src/browser/sites/xdhotel/data.json` : descriptions et quatre salles.
- `src/browser/sites/xdhotel/index.js` : routes automatiques des salles et
  conservation des rendus lors des changements d'onglet.
- `src/browser/sites/xdhotel/draw.js` : palettes, décorations et formes de meubles.
- `src/browser/sites/xdhotel/render.js` : Navigateur et suspension/reprise du rendu.
- `src/browser/sites/xdhotel/styles.css` : panneau rétro, styles limités au site.
- `tests/xdhotel.test.js` : contrôles des cinq salles et du cycle de vie.
- `scripts/verify-desktop-ui.mjs` : parcours interactif des cinq salles et onglets.
- `docs/xdhotel.md` : ce document.

## Vérifications effectuées

- `node --test tests/xdhotel.test.js` : **10/10 réussis**. Projection, BFS,
  déplacement, obstacles et profondeur ; cinq grilles, empreintes sans
  chevauchement, points de départ libres et toutes les cases libres reliées ;
  routes, Navigateur, changements répétés, dialogues, isolation et nettoyage.
- `node --test tests/xdhotel.test.js tests/browser.test.js tests/browser-security.test.js tests/pixel-runner.test.js tests/save.test.js` :
  **40/40 réussis**. Routes et recherche, alias exact et sécurité, historiques,
  conservation des onglets, sauvegardes et New Game.
- `node --test` : **205/206 réussis**. Le seul échec concerne le prototype
  inutilisé `StartMenu`, dans `tests/start-menu.test.js:56`, où manque
  `settings.data.applicationUsage` ; aucun changement de ce module pour la V2.
- `npm run build` : réussi, avec les contrôles musicaux et narratifs existants.
- `node scripts/verify-desktop-ui.mjs --xdhotel-only` : réussi dans un vrai
  navigateur Edge isolé sur le build de production. Accueil et recherche,
  Navigateur ouvert/fermé, cinq salles, changements répétés pendant une marche,
  points de départ, déplacements, collisions, PNJ et bulles, redimensionnement,
  états indépendants des onglets, historique, fermeture/réouverture. Aucun
  changement narratif ou nouveau champ de sauvegarde, aucune requête externe
  ni exception non interceptée constatée.
- Inspection visuelle des captures `.qa/hopla-navigator.png`,
  `.qa/hopla-cafe.png`, `.qa/hopla-discotheque.png`, `.qa/hopla-detente.png` et
  `.qa/hopla-jeux.png` : panneau lisible et ambiances distinctes.
- `node scripts/verify-desktop-ui.mjs --browser-only` : réussi. Navigation
  ForumJeu, recherche, erreurs, alias, historiques indépendants, onglets,
  fenêtres et barre des tâches, persistance, fermeture du dernier onglet et
  New Game ; aucune requête externe.

Pas de lancement Electron ni de génération de portable pour cette évolution
locale. Pas de test d'endurance de plusieurs heures ni de validation de grilles
plus grandes. La suite automatisée couvre les autres contenus et applications ;
le scénario narratif complet n'a pas été rejoué manuellement.
