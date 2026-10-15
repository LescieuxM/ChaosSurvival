# FlashZone

Routes disponibles dès le début : `http://www.flashzone.fr/` et
`http://www.flashzone.fr/jeux/bubble-pop`, ainsi que
`http://www.flashzone.fr/jeux/avoid-the-squares`. Elles réutilisent le registre des pages,
XD Search et l’annuaire Sites Web. L’événement `windows-xd:open-url` existant
peut ouvrir la route du jeu depuis un futur lien MSN, sans dialogue ajouté.

`src/browser/sites/flashzone/catalog.json` contient les titres, catégories,
descriptions, vignettes locales, notes/parties fictives et routes. Pour ajouter
un jeu, déclarer sa fiche et associer son identifiant de composant à une fonction
de rendu dans `index.js`. Accueil et référencement suivent le catalogue.
L’accueil affiche une seule grille de vignettes carrées avec leurs titres,
dans l’ordre du catalogue. Les images et titres ouvrent les routes internes.
Les descriptions, catégories, notes et compteurs restent dans les données.

Bubble Pop : 30 secondes de temps monotone (`performance.now`/RAF), bulles de
46 px, 10 points par clic, disparition après 2,6 secondes, maximum de 8 bulles.
Les coordonnées relatives restent dans l’arène lorsque la fenêtre change de
taille. Il n’y a ni Flash/SWF ni réseau ni nouvelle dépendance.

Seul `progression.data.flashzone.bestScores['bubble-pop']` est enregistré via
`progression.save()` après une partie terminée. Une partie abandonnée ne sauvegarde
pas de score ; rien ne déclenche de progression narrative. New Game supprime ce
champ avec la sauvegarde active. Les données absentes/corrompues donnent 0.

Le navigateur propose un callback `onDispose(cleanup)` aux pages : appelé dès
navigation/changement d’onglet, fermeture ou reset. Bubble Pop annule sa RAF et
vide ses cibles. Le navigateur ne monte qu’un onglet à la fois : revenir sur un
onglet Bubble Pop recrée son écran d’accueil. Réduire le navigateur ne détruit
pas la page ; la durée reste de 30 secondes même si les images ralentissent.
Les jeux `.exe` n’utilisent pas ce cycle de vie et restent indépendants.

Tests : `node --test tests/flashzone.test.js tests/browser.test.js tests/browser-security.test.js tests/skypage.test.js`.
Après compilation : `node scripts/verify-desktop-ui.mjs --flashzone-only`
(Edge sans interface, profil temporaire ; aucun Electron/portable).

Avoid the Squares utilise ce même catalogue et le callback de nettoyage de page.
Coordonnées logiques 600×300, joueur 14×14 et obstacles 24×24 : l’arène conserve
le rapport 2:1 et la souris est convertie depuis ses dimensions réelles.
Deux obstacles au départ, puis un toutes les 8 secondes, maximum 8 ; vitesse
progressive (+1,5 % par seconde, plafond ×2,2). Apparitions dans un coin situé
à plus de 100 unités du joueur ; les 750 premières millisecondes protègent le
démarrage. Collisions de rectangles balayés, y compris lors d’un mouvement
rapide de la souris. La simulation est divisée en pas de 10 ms et ignore les
pauses du renderer supérieures à 250 ms pour éviter un rattrapage invisible.

Seul le meilleur temps (millisecondes) est sauvegardé dans
`progression.data.flashzoneBestTimes['avoid-the-squares']`, séparément des scores
Bubble Pop pour préserver son fonctionnement existant. La navigation et les
onglets abandonnent la partie sans record ; masquer le document abandonne
également la manche et restaure l’écran JOUER. Aucun record n’est sauvegardé
avant une collision. New Game efface ce champ. Les Pointer Events/écouteurs et
RAF sont retirés à la destruction. Tests dédiés : `tests/avoid-squares.test.js`.

Pixel Runner : `http://www.flashzone.fr/jeux/pixel-runner`. Espace ou Flèche haut
fait sauter le personnage lorsque le canvas est sélectionné. Simulation locale
480×200, gravité et collisions en pas de 5 ms ; vitesse progressive plafonnée,
caisses, blocs et trous, avec un espacement supérieur à la durée d'un saut.
Seule la meilleure distance est enregistrée dans
`progression.data.flashzoneBestDistances['pixel-runner']`, puis effacée par
New Game. Aucun événement narratif n'est déclenché.

La page déclare `preserveOnTabSwitch` et utilise `onDispose('pause')` / `onResume`
pour suspendre sa RAF lors d'un changement d'onglet. Le navigateur conserve
temporairement son composant et sa manche, indépendamment des autres onglets.
Revenir dans l'onglet reprend sans rattraper le temps de pause. Navigation,
actualisation, fermeture et reset détruisent la manche et ses écouteurs.
Cette conservation est optionnelle : les deux autres jeux restent inchangés.
Tests dédiés : `tests/pixel-runner.test.js`.
