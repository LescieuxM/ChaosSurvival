# Wiki

Wiki est disponible dès le début à `http://www.wiki.fr/`, dans Internet
Adventurer et l'annuaire de XD Search. Le catalogue contient **16 articles** :
les quinze sujets initiaux et **Primates**, ajouté explicitement à la demande.
Chaque texte comporte entre 299 et 343 mots, une introduction, trois sections,
un sommaire et des renvois « Voir aussi ». Quelques encadrés et un bandeau
d'ébauche complètent la présentation, sans contribution interactive.

## Données et navigation

- `src/browser/sites/wiki/data.json` contient le catalogue, les thèmes, l'article
  à la une et les anecdotes. Les thèmes sont déduits des articles pour l'annuaire.
- `model.js` construit les routes `/article/<id>`, filtre les **titres** sans
  tenir compte de la casse et des accents et choisit un article au hasard.
- `render.js` partage la barre latérale et le rendu d'article. Les liens passent
  par `data-browser-link` ou `context.navigate`. Le sommaire fait défiler une
  section de la page courante, sans changer la route ni ajouter d'historique.
- `index.js` enregistre automatiquement les articles pour XD Search. Les pages
  utilitaires `/articles` et `/recherche?q=...` ne sont pas indexées.
- `styles.css` ne cible que `.wiki` et ses composants. Les encadrés s'adaptent
  à la largeur du contenu, notamment quand la fenêtre du navigateur est étroite.

Ajouter un article consiste à ajouter une entrée avec `id`, `title`, `theme`,
`intro`, `sections` et `related`. Chaque section possède son propre identifiant,
un titre et un tableau de paragraphes. `related` référence uniquement les IDs
du catalogue. `info` et `notice` sont facultatifs. Les routes, la recherche,
l'annuaire thématique et le choix aléatoire suivent ces données.

Les recherches utilisent `encodeURIComponent`, `value` et `textContent`.
Aucun HTML d'article, script saisi, lecteur distant, appel réseau ou API Electron
n'est interprété. Les caractères `<` ou les protocoles saisis dans la recherche
restent du texte. Wiki ne crée aucune donnée narrative ; seuls les historiques
habituels du navigateur changent lors de la consultation. Aucun moteur de jeu,
dialogue, système de contacts ou mécanisme de sauvegarde n'a été modifié.

## Rédaction et repères historiques

Les textes sont des synthèses originales rédigées pour le jeu, sans copie des
articles de Wikipédia. Les logiciels propres au jeu sont décrits uniquement
à partir de leurs fonctionnalités visibles ; pas d'éditeur, date de lancement
ou architecture interne inventés. Les références culturelles s'arrêtent à 2009.
La chronologie ci-dessous sert à contrôler les points sensibles, pas à attribuer
tout le contenu à une source unique.

- Internet : [Internet Society, histoire par ses pionniers](https://www.internetsociety.org/internet/history-internet/brief-history-internet/)
  pour ARPANET en 1969 et TCP/IP en 1983 ; [CERN, naissance du Web](https://home.cern/fr/science/computing/birth-web/)
  pour la proposition de 1989 et la distinction entre Internet et Web.
- Adobe Flash : [rapport Adobe de 2006](https://www.adobe.com/content/dam/cc/en/investor-relations/pdfs/ADBE-10Q-Q206-FINAL.pdf)
  confirmant le rachat de Macromedia en 2005 ; [documentation Flash 8 de 2005](https://www.adobe.com/inspire-archive/october2005/allArticles.html)
  pour les contenus multimédias. Aucun événement ultérieur concernant Flash.
- Jeux vidéo : [Smithsonian, histoire des jeux vidéo](https://www.si.edu/spotlight/the-father-of-the-video-game-the-ralph-baer-prototypes-and-electronic-games/video-game-history)
  pour Pong en 1972, arcades et cartouches. Les consoles et titres nommés existaient
  avant 2009 ; aucune console de génération ultérieure n'est introduite.
- Musique électronique : [recherche sur les traditions musicales de Detroit et Chicago](https://digitalcommons.wayne.edu/oa_theses/875/)
  pour distinguer les courants locaux. La publication récente documente l'histoire,
  pas un événement nouveau inséré dans le jeu.
- Chat domestique : [Vigne et al., étude publiée en 2004](https://citeseerx.ist.psu.edu/document?doi=a61bd3f8162c3d46f82ccfb4a434c226f31f2e01&repid=rep1&type=pdf)
  concernant la proximité ancienne avec les humains. Pas de date unique de
  domestication ni de découverte postérieure nécessaire au texte.
- Tour Eiffel : [histoire officielle du monument](https://www.toureiffel.paris/fr/le-monument/histoire)
  pour le chantier de 1887 à 1889 et sa structure. Le texte distingue la hauteur
  initiale des antennes, sans citer la hauteur de 330 mètres atteinte après 2009.
- Système solaire : [résolutions adoptées par l'UAI en 2006](https://www.iau.org/IAU/Iau/News/PR2006/iau-2006-general-assembly-resolution-votes.aspx)
  : huit planètes ; Pluton est une planète naine. Le projet de résolution à douze
  planètes n'est pas présenté comme une décision adoptée.
- Dinosaures : [guide Smithsonian disponible avant 2009](https://www.si.edu/Content/SE/Educator%20Guides/Dinosaurs%203D%20-%20Giants%20of%20the%20Patagonia.pdf)
  pour la diversité, l'appartenance des oiseaux et le repère d'environ 65 millions
  d'années courant à l'époque. Les causes de l'extinction restent présentées
  comme des explications étudiées dans ce contexte.
- Photographie numérique : [documents scientifiques du prix Nobel de 2009](https://www.nobelprize.org/uploads/2018/06/popular-physicsprize2009-1.pdf)
  pour le CCD de 1969. L'article n'annonce ni équipement ni découverte ultérieurs.
- Primates : [taxonomie du centre de recherche du Wisconsin](https://primate.wisc.edu/primate-info-net/av-resources/slidesets/primate-taxonomy-table-of-contents/primate-taxonomy/primate-taxonomy-slideshow/)
  et [Smithsonian, évolution humaine](https://humanorigins.si.edu/education/introduction-human-evolution)
  pour les groupes et les ancêtres communs. L'être humain fait partie des primates,
  sans être décrit comme le descendant d'un chimpanzé actuel.

Ces vérifications documentaires ne constituent pas une revue scientifique
exhaustive. Aucun extrait, image ou logo de ces sites n'est téléchargé dans Wiki.
Les références sont destinées à la maintenance ; elles n'ouvrent aucune adresse
externe depuis les pages du jeu.

## Vérifications

`node --test tests/wiki.test.js tests/browser.test.js tests/browser-security.test.js`
couvre le catalogue, les longueurs, les liens, le sommaire, la recherche,
l'aléatoire, les saisies hostiles et les historiques Précédent/Suivant persistants.
Les suites des autres sites vérifient leur non-régression.

Après compilation : `node scripts/verify-desktop-ui.mjs --wiki-only`, avec Edge
sans interface, profil de test temporaire et aucun lancement d'Electron ni
génération de portable. Le contrôle parcourt les seize articles, teste sommaire,
recherche, navigation, redimensionnement et absence de requêtes externes.
