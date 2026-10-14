# Hopla Hotel — client de bureau

Le site local reste disponible à `http://www.hoplahotel.fr/`, avec le même accueil,
le référencement XD Search et l'alias `www.xdhotel.fr`. Les anciennes routes
`/salle/...` restent reconnues et présentent désormais l'accueil. Aucun client
isométrique n'est monté dans Internet Adventurer.

## Ouverture et fenêtre

« Entrer dans l'hôtel » appelle un callback local `openHotel`, fourni au site par
le navigateur. `client.js` ouvre une fenêtre simulée **Hopla Hotel** avec
`WindowManager.spawn` et `DesktopApplications.attachWindow`/`restore`.
Internet Adventurer reste sur l'accueil, avec le même onglet et le même historique.
Aucun événement global, processus ou fenêtre native n'est ajouté.

Une seule instance peut être ouverte, quel que soit l'onglet utilisé pour la
lancer. Un nouveau clic la restaure et la ramène au premier plan, en conservant
la salle et la position. Fermer Internet Adventurer laisse le client actif.
« Retour à l'accueil » utilise l'API locale du navigateur pour afficher le site
au premier plan.

Les dimensions initiales représentent 94 % de la largeur et de la hauteur
réellement disponibles au-dessus de la barre des tâches, soit environ 88 % de
la surface. Le calcul utilise `movementBounds`, y compris en mode arcade.
Le déplacement, le focus, la réduction, la restauration et la fermeture restent
ceux du gestionnaire existant. Le redimensionnement utilise `resize: both`,
comme Internet Adventurer. Aucun bouton maximiser n'est ajouté.
Un observateur adapte les limites lorsque l'écran change et maintient la fenêtre
dans le bureau.

La scène exploite l'espace intérieur compatible avec ses proportions, avec des
marges réduites et sans plafond de largeur. Le Canvas interne reste à 400 × 300,
avec une mise à l'échelle uniforme et `image-rendering: pixelated`. La conversion
des clics vers ces coordonnées est conservée pour les cases et les PNJ.
La consigne de déplacement et le compteur précédemment supprimés restent absents.

## Salles et moteur commun

Le bouton **Navigateur** propose les cinq salles, leur description et **Entrer**.
**Fermer**, Navigateur ou Échap referment le panneau. Ouvrir ce panneau suspend
la marche ; choisir une salle nettoie le rendu précédent, annule le trajet,
actualise le décor et le nom, puis place l'avatar au point de départ libre.

| Salle           | Identifiant   | Décor                                                 | PNJ            |
| --------------- | ------------- | ----------------------------------------------------- | -------------- |
| Hall de l'hôtel | `hall`        | Disposition et mobilier conservés                     | ReceptionHotel |
| Café Hopla      | `cafe`        | Tons chauds, comptoir, tables, chaises et plante      | CafeMax        |
| Discothèque     | `discotheque` | Piste colorée, lumières fixes, enceintes et banquette | DJ_Biscotte    |
| Salon détente   | `detente`     | Tons verts, tapis, canapés, table basse et plantes    | PauseCafe      |
| Salle de jeux   | `jeux`        | Bornes décoratives, affiches, table et chaise         | RetroFred      |

Le Hall reste dans `data.room`, les autres salles dans `data.rooms`. Le Navigateur
et les routes de compatibilité sont construits automatiquement à partir de ces
définitions. Une salle supplémentaire utilisant les formes disponibles peut être
ajoutée uniquement aux données. Vérifier les limites, les empreintes, le point
d'apparition et la connectivité des cases libres.

Pour cette intégration, `data.json`, `model.js` et `draw.js` ne sont pas modifiés :
salles, meubles, obstacles, couleurs, avatar, dialogues et animations sont
conservés. Les PNJ restent statiques ; la Discothèque n'a pas de musique et les
bornes restent décoratives. La projection, BFS et les collisions sont partagés
par le renderer existant. Aucune logique de moteur n'est ajoutée au navigateur
ou au gestionnaire de fenêtres.

## Cycle de vie et sauvegardes

Deux hooks optionnels de l'instance, `onMinimize` et `onRestore`, suspendent et
reprennent le renderer existant. La réduction conserve la salle et le joueur.
Les autres applications, qui ne définissent pas ces hooks, gardent leur comportement.
Le moteur ne demande des frames que pour une marche ou l'expiration d'une bulle ;
une bulle dure 4,5 secondes.

Changer de salle nettoie l'ancien rendu. Fermer le client ou vider le bureau
annule les frames, déconnecte les observateurs, retire les écouteurs, retire la
tâche et libère l'instance. Une nouvelle ouverture commence dans le Hall.
Le nettoyage existant du menu et de New Game est réutilisé. Aucun état Hotel
n'est ajouté aux sauvegardes, aux préférences ou aux événements narratifs.

## Fichiers de cette modification

- `src/browser/sites/xdhotel/client.js` : nouveau point d'entrée de bureau,
  instance unique, dimensions et cycle de vie.
- `src/browser/sites/xdhotel/index.js` : routes de compatibilité vers l'accueil.
- `src/browser/sites/xdhotel/render.js` : demande d'ouverture depuis le bouton du site.
- `src/browser/sites/xdhotel/styles.css` : fenêtre et scène agrandies, styles limités au client.
- `src/main.js` : branchement du client au navigateur et aux applications.
- `src/ui/browser.js` : callback d'ouverture dans le contexte des pages.
- `src/ui/desktop-apps.js` : deux hooks optionnels de suspension/reprise.
- `tests/xdhotel.test.js` : accueil, singleton, restauration et nettoyage.
- `scripts/verify-desktop-ui.mjs` : parcours de la fenêtre et des cinq salles.
- `docs/xdhotel.md` : ce document.

## Vérifications

- `node --test tests/xdhotel.test.js tests/browser.test.js tests/browser-security.test.js tests/window-movement.test.js tests/save.test.js` :
  **39/39 réussis**, dont 12 tests Hotel. Moteur, données, chemins, collisions,
  dialogues, navigation des salles, instance unique, pause/reprise, fermeture et
  `WindowManager.clear` ; navigation, sécurité, limites des fenêtres et sauvegardes.
- `node --test` : **207/208 réussis**. L'échec préexistant reste dans
  `tests/start-menu.test.js:56`, pour le prototype inutilisé `StartMenu` et son
  champ manquant `settings.data.applicationUsage`. Ce module n'est pas modifié.
- `npm run build` : réussi, avec les contrôles musicaux et narratifs existants.
- `node scripts/verify-desktop-ui.mjs --xdhotel-only` : réussi dans Edge isolé
  sur le build de production. Ouverture unique, accueil/historique conservés,
  dimensions initiales, déplacement de fenêtre, poignée de redimensionnement,
  réduction/restauration depuis la barre des tâches et le site, cinq salles,
  collisions, PNJ/bulles, changements répétés, clics après redimensionnement,
  fermeture indépendante du navigateur, fermeture/relance du client,
  nettoyage du menu et relance après New Game. Aucun changement narratif ou
  champ de sauvegarde Hotel, aucune requête externe ni nouvelle exception.
- `node scripts/verify-desktop-ui.mjs --browser-only` : réussi. ForumJeu,
  recherche, erreurs, alias, historiques indépendants, onglets, fenêtres,
  barre des tâches, persistance, fermeture du dernier onglet et New Game.

Captures de contrôle dans `.qa` : `xdhotel-hall.png`, `xdhotel-small.png`,
`hopla-desktop-window.png`, `hopla-navigator.png` et les quatre nouvelles salles.

Les données et le moteur des salles, les autres sites, les dépendances et les
permissions Electron restent inchangés. Pas de lancement Electron ni de portable,
ni de test d'endurance. Les interactions sont vérifiées à 1280 × 800 et 800 × 600 ;
le scénario narratif complet n'est pas rejoué manuellement.
