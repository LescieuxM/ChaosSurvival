# Hopla Hotel — V1

Site local disponible dès le début à `http://www.hoplahotel.fr/` (la saisie
`www.hoplahotel.fr` fonctionne également). L'accueil propose « Entrer dans l'hôtel »
vers `http://www.hoplahotel.fr/salle/hall`, dans le même onglet. XD Search l'affiche
automatiquement dans « Sites Web » et le retrouve avec `hopla hotel` ou `hotel virtuel`.

L'ancienne adresse `www.xdhotel.fr`, y compris `/salle/hall`, reste un alias
vers `www.hoplahotel.fr`. Les historiques d'onglets sauvegardés restent lisibles ;
les nouveaux liens et résultats utilisent exclusivement la nouvelle adresse.
Les noms de fichiers et identifiants internes `xdhotel` sont conservés.

Vérification du renommage : 30 tests ciblés réussis (`tests/xdhotel.test.js`,
`tests/browser.test.js`, `tests/browser-security.test.js`, `tests/save.test.js`),
compilation réussie, parcours `--xdhotel-only` et `--browser-only` réussis.
L'ancien domaine est testé comme alias exact, avec les chemins sauvegardés ;
les domaines ressemblants ne sont pas admis. Le parcours interactif vérifie
le nouveau nom, la nouvelle adresse, la recherche, la marche, les collisions,
ReceptionXD, les onglets et le retour à l'accueil. Pas de nouveau test Electron
ou portable pour ce renommage ; les paramètres de sécurité restent inchangés.

## Module et fichiers

Fichiers créés dans `src/browser/sites/xdhotel/` :

- `data.json` : identité, hall 10 × 10, apparition, meubles, empreintes bloquantes,
  ReceptionXD et sa réplique.
- `model.js` : projection/inversion, limites de grille, obstacles, BFS et
  déplacement interpolé avec quatre orientations.
- `draw.js` : Canvas 2D, murs/sol, personnages et meubles originaux construits
  à partir de formes simples ; ordre de dessin selon la profondeur de grille.
- `render.js` : accueil et client commun, clics, bulle, dimensionnement et nettoyage.
- `index.js` : les deux pages du registre existant.
- `styles.css` : styles limités à Hopla Hotel ; aucun changement de taille globale
  d'Internet Adventurer.

Autres créations : `tests/xdhotel.test.js` et ce document.

Fichiers existants modifiés pour cette tâche :

- `src/browser/sites/index.js` : ajout du registre Hopla Hotel à la suite des sites
  existants, sans changer leur ordre relatif.
- `src/main.js` : un import de styles.
- `tests/browser.test.js` : le nouvel accueil dans l'annuaire attendu.
- `scripts/verify-desktop-ui.mjs` : parcours `--xdhotel-only` et actualisation du
  nombre de sites attendu par le parcours SkyPage.

Les modifications préexistantes du libellé VideoTube et du rapport d'audit ont
été conservées. Aucun changement du navigateur, de son moteur de recherche,
des autres contenus, des mini-jeux, des protections Electron ou des dépendances.

## Choix techniques

Les coordonnées de grille restent distinctes des pixels. BFS explore seulement
les quatre voisins d'une case et refuse les empreintes de meubles et la case
du PNJ. Un nouveau clic valide remplace le chemin restant après la fin du segment
en cours ; cela évite de couper un coin d'obstacle depuis une position fractionnaire.
Un clic impossible conserve le trajet en cours, un clic extérieur est ignoré.

Le rendu interne mesure 400 × 300 et conserve ses pixels lors de la mise à
l'échelle. Un `ResizeObserver` ajuste le client à son espace disponible ; les
petites fenêtres peuvent défiler. La bulle de ReceptionXD dure 4,5 secondes,
est rendue comme texte et se repositionne dans les limites du Canvas au resize.

Chaque rendu du hall possède son propre déplacement, frame et bulle. Le moteur
reste inactif au repos ; il anime la marche et l'expiration d'une bulle à la
demande. La visibilité du document suspend les frames. Le callback `onDispose`
existant annule les frames, déconnecte l'observateur et retire les écouteurs
Canvas/document lors des changements de page/onglet et fermetures.

Aucune position n'est sauvegardée : revenir au hall, y compris après un changement
d'onglet, crée une instance au point d'apparition. Deux onglets ne partagent pas
leurs données mutables. Les URL/historiques restent gérés par le navigateur existant.

Toutes les interactions et ressources sont locales. Aucun compte, chat libre,
multijoueur, serveur, script distant, API système, nouvelle permission ou événement
narratif. Les graphismes sont dessinés par le code, sans sprites externes.

## Ajouter ultérieurement une salle

Décrire une autre salle suivant le schéma actuel (`id`, `name`, `width`, `height`,
`spawn`, `blocked`, `furniture`, `npcs`). Chaque meuble utilise une position,
une taille de footprint et `blocking` ; chaque PNJ possède position, orientation
et dialogue. Conserver des positions libres et des objets à l'intérieur de la grille.

Passer cette définition comme troisième argument de `renderHotelRoom(context,
hotelData, room)` et enregistrer sa route dans `index.js`. Le moteur de marche et
le renderer sont communs. Cette V1 prévoit une présentation adaptée à une grille
10 × 10 ; des salles beaucoup plus grandes demanderaient d'adapter le cadrage,
pas le navigateur. Les nouvelles formes de meubles se dessinent dans `draw.js`.
Aucune sélection de salle ou autre fonctionnalité future n'est implémentée.

## Vérifications effectuées

- `node --test tests/xdhotel.test.js tests/browser.test.js tests/browser-security.test.js` :
  **19 tests réussis**. Projection/inversion, pathfinding, obstacles, destinations
  impossibles, changement de trajet, orientations, ordre de profondeur, isolation,
  clics mis à l'échelle, visibilité et nettoyage ; routes, recherche et sécurité.
- `node --test` : **201/202 réussis**. Le seul échec reste celui du prototype
  inutilisé `StartMenu`, `tests/start-menu.test.js:56`, déjà présent avant cette
  tâche ; aucun nouvel échec.
- `npm run build` : réussi, avec les vérifications musicales/narratives existantes.
- Prettier sur les fichiers concernés et `git diff --check` : réussis.
- `node scripts/verify-desktop-ui.mjs --xdhotel-only` : vrai navigateur Edge
  isolé sur le build de production ; accueil, annuaire/recherche, hall, clics de
  déplacement et changement de destination, refus d'une case de table, NPC/bulle
  et disparition, petite résolution, onglets, précédent/suivant, fermeture et
  réouverture, application Poste de travail. Les données narratives comparées
  restent identiques, aucun champ de persistance Hotel ajouté, aucune requête
  externe ni exception non interceptée constatée.
- `node scripts/verify-desktop-ui.mjs --browser-only` : réussi ; navigateur,
  recherche, erreurs, ForumJeu, historiques indépendants, onglets, fenêtres,
  barre des tâches, persistance et New Game.
- Inspection des captures d'accueil, de hall et de petite résolution sous `.qa`.
  Les premiers passages ont permis de corriger le dimensionnement du Canvas,
  la typographie héritée et la position de bulle avant les passages finaux.

Pas de démarrage Electron ni de génération de portable pour cette tâche : sa
configuration et ses permissions n'ont pas changé. Les autres sites, les scores,
les sauvegardes et transitions narratives sont couverts par la suite automatisée,
sans rejouer manuellement l'ensemble du scénario. Pas de test d'endurance de
plusieurs heures ni de validation d'une grande salle hors du format de cette V1.
