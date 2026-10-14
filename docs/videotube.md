# VideoTube

Site local disponible dès le début : `http://www.videotube.fr/`.
L'accueil et les sept routes `/watch/<identifiant>` sont enregistrés dans le
registre existant ; XD Search et son annuaire les découvrent automatiquement.
Aucun compte, lecteur distant, téléchargement ni événement narratif.

## Organisation et ouverture externe

- `electron/videotube-catalog.json` : catalogue unique, données éditoriales,
  chemins des miniatures et sept entrées d'URL autorisées. Importé
  par Vite et livré dans le dossier Electron du portable.
- `src/browser/sites/videotube/` : rendu textuel sûr, accueil et pages vidéo.
- `public/videotube/` : sept illustrations SVG locales originales.
- `electron/video-links.cjs` : liste autorisée issue exclusivement du catalogue
  livré. Le renderer transmet un **identifiant**, jamais une URL libre.
- `chaosVideo.open(id)` dans le preload appelle `chaos:open-video`. Le processus
  principal vérifie le frame principal et son document avec `trustedSender`,
  refuse les identifiants inconnus/indisponibles, puis vérifie le format HTTPS
  strict `https://www.youtube.com/watch?v=<11 caractères>` avant `shell.openExternal`.

L'action reste un bouton de la page vidéo. Elle ne navigue pas Internet Adventurer,
ne crée pas d'onglet interne et ne modifie pas la sauvegarde. Les clics pendant
une ouverture en cours sont ignorés ; un refus ou un échec produit un message
simple. En aperçu Web sans preload, cette action affiche également un échec,
sans contourner les protections par `window.open`.

`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, CSP locale,
blocage des navigations, fenêtres, téléchargements et requêtes externes restent
inchangés. L'exception porte uniquement sur cette ouverture dans le navigateur
**système**, sur action du joueur. Elle suit les recommandations officielles
[Electron sur openExternal et la validation IPC](https://github.com/electron/electron/blob/main/docs/tutorial/security.md).

## Vérification des vidéos et limites

Recherche documentaire effectuée le **14 octobre 2026**. L'année du catalogue
désigne la vidéo historique, pas la date d'une republication disponible aujourd'hui.
Les compteurs, étoiles et commentaires du jeu sont **fictifs** ; aucune donnée
actuelle de vues n'est présentée comme un compteur historique réel.

| Vidéo                          | Attribution                                                            | URL retenue / état                                                                                  | Preuve historique et vérification du lien                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numa Numa Dance (2004)         | Gary Brolsma                                                           | [Cqd1Gvq-RBY](https://www.youtube.com/watch?v=Cqd1Gvq-RBY), publication officielle de 2017          | [Newgrounds, plateforme d'origine](https://www.newgrounds.com/wiki/about-newgrounds/history/stories/numa-numa) confirme l'origine de 2004 et la republication par Gary. [YouTube, Michael Wesch, 2009](https://blog.youtube/creator-and-artist-stories/curator-of-month-michael-wesch/) témoigne de sa circulation et des reprises sur YouTube en 2009. Le lien de 2017 sert à regarder la vidéo aujourd'hui, **pas** à prouver sa disponibilité en 2009. |
| Chocolate Rain (2007)          | Tay Zonday                                                             | [EwTZ2xpQwpA](https://www.youtube.com/watch?v=EwTZ2xpQwpA)                                          | Métadonnées YouTube : Tay Zonday, 22 avril 2007. [Bilan officiel YouTube du 29 décembre 2007](https://blog.youtube/culture-and-trends/2007-year-in-review-part-2/) confirme sa présence et son auteur.                                                                                                                                                                                                                                                    |
| LEAVE BRITNEY ALONE! (2007)    | Chris Crocker, nom utilisé à l'époque                                  | [ElXi7yDHyWo](https://www.youtube.com/watch?v=ElXi7yDHyWo), lien fourni manuellement ; bouton actif | Lien actuel fourni par le developpeur ; l'ancien lien original kHmvkRoEowc est retire. Les sources historiques de l'audit initial confirment la video de 2007, pas la date ni le statut officiel de cette republication.                                                                                                                                                                                                                                  |
| Dramatic Chipmunk (2007)       | magnets99, auteur du montage initial ; images issues de Hello! Morning | [y8Kyi0WNg40](https://www.youtube.com/watch?v=y8Kyi0WNg40), lien fourni manuellement                | Lien actuel fourni par le developpeur. [The Scope, juillet 2007](https://dai.mun.ca/pdfs/scope/TheScope200707Vol02Num11Issue035.pdf) et [MetaFilter, novembre 2007](https://ask.metafilter.com/77463/DramaticGroundhogFilter) documentent la circulation historique via l'ancien lien a1Y73sPHKxw, pas cette republication.                                                                                                                               |
| Laughing Baby (2006)           | spacelord72                                                            | [HttF5HVYtlQ](https://www.youtube.com/watch?v=HttF5HVYtlQ)                                          | Métadonnées de la page originale vérifiées : spacelord72, 25 août 2006, description revendiquant la création. Cette publication antérieure à 2009 sert de preuve historique.                                                                                                                                                                                                                                                                              |
| Sneezing Baby Panda (2006)     | Auteur original non vérifié : champ `null`, affiché explicitement      | [8d6voO-na6w](https://www.youtube.com/watch?v=8d6voO-na6w), lien fourni manuellement                | Lien actuel fourni par le developpeur. Le [Guardian, avril 2008](https://www.theguardian.com/technology/2008/apr/28/internet.digitalmedia1) cite l'ancien lien FzRH3iTQPrk. Le [Short Films Blog, novembre 2008](https://shortfilmsblog.blogspot.com/2008/11/sneezing-panda.html) situe la diffusion en 2006. L'auteur du tournage reste non verifie.                                                                                                     |
| What What (In the Butt) (2007) | Samwell / Brownmark Films ; réalisation Bobby Ciraldo et Andrew Swant  | [fbGkxcY7YFU](https://www.youtube.com/watch?v=fbGkxcY7YFU)                                          | Page YouTube identifiée, description officielle reproduite avec date du 14 février 2007 sur [Bandmine](https://www.bandmine.com/samdaseed/videos/2/fbGkxcY7YFU). [Stereogum du 16 février 2007](https://stereogum.com/4637/new_samwell_video_what_what_in_the_butt/news) confirme la diffusion à cette époque.                                                                                                                                            |

Les quatre liens de LEAVE BRITNEY ALONE!, Dramatic Chipmunk, Laughing Baby et
Sneezing Baby Panda sont désormais ceux fournis manuellement par le développeur.
Laughing Baby conserve son URL précédente. Les sept boutons sont actifs ; ces
corrections ne changent pas les preuves historiques ni les attributions.

Les outils de consultation n'ont pas permis de lire les vidéos elles-mêmes.
Un lien documenté n'est pas une garantie de lecture future : suppression,
restriction géographique, connexion ou âge peuvent dépendre de YouTube. Aucun
réseau n'est utilisé par le jeu pour surveiller ou remplacer ces liens.

## Miniatures et droits

Les sept SVG ont été écrits pour ce projet avec Codex : illustrations vectorielles
simples de webcam, micro, plaidoyer, rongeur, bébé, pandas et scène musicale.
Pas d'imagegen bitmap, capture vidéo, portrait photographique ni logo YouTube
copié. Les vidéos et les enregistrements audio ne sont pas redistribués.
Les attributions et liens ne constituent pas une licence de ces œuvres ; aucune
autorisation de reproduction n'est revendiquée. Voir aussi `IMAGE_AUDIT.md`.

## Vérifications

Tests ciblés : `node --test tests/videotube.test.js tests/browser.test.js tests/browser-security.test.js`.
Ils couvrent routes, index, liens internes, rendu textuel, boutons indisponibles,
erreurs, clics répétés, identifiants hostiles, origine IPC et la chaîne réelle
composant → preload → handler principal → `shell.openExternal` **simulé**.
Le mock évite d'ouvrir un navigateur externe ou d'effectuer un accès réseau.
Après compilation, `node scripts/verify-desktop-ui.mjs --videotube-only` vérifie
l'accueil, les sept pages, leurs miniatures et les interactions dans Edge sans
interface, avec le pont externe simulé ; pas d'Electron ni portable généré.
