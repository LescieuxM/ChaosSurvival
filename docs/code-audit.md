# Audit et refactorisation du code

Audit du 13 octobre 2026. Cette intervention conserve les contenus, les ressources,
les réglages de difficulté, les délais narratifs et les formats de sauvegarde.

## Constats

- `src/main.js` cumulait la navigation, l'arcade, Messenger, le rendu des fichiers
  reçus et le lancement des mini-jeux. Il reste le point de composition de
  l'application ; ses responsabilités autonomes ont été extraites.
- Le catalogue des mini-jeux, dépendant de `import.meta.glob`, contenait aussi
  le moteur complet de Smiley Catcher. Les tests devaient extraire et réévaluer
  ce code par expressions régulières au lieu d'importer les modules testés.
- Le double-clic et la touche Entrée étaient gérés séparément dans l'explorateur,
  les fichiers reçus et les raccourcis. La sélection des fichiers reçus doublait
  celle du gestionnaire d'icônes.
- La validation des images locales répétait une expression régulière. Une
  variable locale n'était pas utilisée dans le dépôt des icônes. L'écran de
  défaite conservait des alternatives de victoire inaccessibles après le retour
  anticipé vers l'écran de victoire.
- La mélodie du menu était reconstruite à chaque passage du planificateur audio.

## Organisation retenue

| Responsabilité                                                   | Module                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Composition et transitions entre phases                          | `src/main.js`                                               |
| Rendu des fichiers reçus                                         | `src/ui/desktop-files.js`                                   |
| Sélection, quadrillage, glissement et positions sauvegardées     | `src/ui/desktop-icons.js`                                   |
| Activation par double-clic et Entrée                             | `src/utils/activation.js`                                   |
| Catalogue JSON des mini-jeux pour Vite                           | `src/ui/minigame.js`                                        |
| Enregistrement et création des moteurs                           | `src/ui/minigame-registry.js`                               |
| Déblocage, instance active et validation narrative d'un mini-jeu | `src/ui/minigame-launcher.js`                               |
| Moteur Smiley Catcher, déplacé sans changement de ses règles     | `src/minigames/smiley-catcher.js`                           |
| Mise en forme des messages et émoticônes                         | `src/ui/message-text.js`                                    |
| Discussion persistante et événements JSON                        | `src/story/conversation-thread.js`, `src/story/dialogue.js` |

Les exports existants de `ui/minigame.js` et `ui/conversation.js` sont conservés
pour ne pas casser leurs appelants. Le registre accepte les futurs moteurs ; le
gestionnaire de lancement applique les contrôles de déblocage et utilise leur
fonctionnement normal, sans imposer les règles de Smiley aux autres jeux.

## Nettoyage et compatibilité

- Suppression du gestionnaire de sélection redondant, de la variable inutilisée
  et des alternatives de victoire inaccessibles dans la branche de défaite.
- Réutilisation de `localPicture()` pour les deux types d'aperçus d'images.
- Mélodie du menu déplacée dans une constante, sans changer les notes ou le tempo.
- Formatage aligné sur la configuration Prettier existante. Les AST JavaScript et
  les valeurs JSON ont été comparés avant/après cette étape : ils sont identiques.
  Git conserve désormais les fins de ligne LF attendues par Prettier, avec CRLF
  pour les lanceurs batch Windows.
- Erreurs de lancement des mini-jeux acheminées vers la boîte d'erreur existante.
- Les tests de Smiley et du fichier reçu importent les vrais modules ; ils
  n'extraient plus leur implémentation depuis `main.js` ou un fichier Vite.
- Aucune dépendance supprimée : les cinq dépendances déclarées servent au
  développement, au formatage, à Electron, au packaging ou à sa vérification.
- Aucune ressource supprimée : musique, illustrations, avatars et logos sont
  référencés, parfois par les catalogues JSON ou les identifiants d'icônes.
- `.gitignore` couvre déjà les dépendances, builds, exécutables, caches, profils
  de test et outils locaux. Aucun de ces artefacts n'est suivi dans l'index Git.
  Les outils et compilations locaux sont conservés.

## Vérifications

- Référence avant modification : 73 tests réussis.
- Suite automatisée complète : 77 tests réussis, dont les migrations de sauvegardes, les 81 chemins
  de choix de la présentation, les replays, la synchronisation musicale, les
  positions des icônes et les fenêtres/applications.
- Tests supplémentaires pour l'activation commune, le rendu sûr des émoticônes,
  l'ajout d'un moteur au registre et les erreurs de lancement.
- Compilation de production et vérifications des catalogues musicaux/narratifs.
- Test ciblé existant dans Edge sans interface : vrais clics et glissements,
  fichier reçu, Smiley, relancement, sauvegarde, résolution, applications,
  Messenger, menu et lancement du MP3. Pas de lancement d'Electron ni de build
  portable pour cette intervention.
- Audit syntaxique et des imports JavaScript ; contrôle des dépendances entre
  modules et du diff. Le contenu des configurations et ressources du jeu reste inchangé.

## Travaux volontairement reportés

Le découpage intégral de `main.js`, la réécriture de la gestion des fenêtres,
la séparation complète des vues Messenger et la modification des mécanismes
de migration/sauvegarde apporteraient un risque supérieur au bénéfice de ce
nettoyage. Les états asynchrones de pause, les événements narratifs en attente
et les migrations historiques restent en place. Les tests d'intégration de ces
parties conservent quelques extractions de fonctions de `main.js` ; les supprimer
demanderait une refactorisation plus large du cycle de l'application.

Aucun commit, merge ou push Git n'est effectué par cette intervention.

## Maintenance du navigateur — 14 octobre 2026

### Analyse et périmètre

Les sites répétaient sept helpers de création d'éléments textuels et quatre
helpers de liens internes. La normalisation des recherches était dupliquée
entre le registre et Wiki. Le contrôleur d'Internet Adventurer construisait
aussi les boutons d'onglets directement. Ces responsabilités sont maintenant
isolées dans de petits modules, sans nouvelle dépendance.

Le catalogue commun rassemble les registres des sites dans leur ordre antérieur,
qui intervient dans les résultats de recherche de même pertinence. Chaque site
conserve ses données, routes et rendu propre. Les liens restent des commandes
de navigation interne ; leur contenu est affecté avec `textContent`.

### Fichiers concernés

- Ajouts : `src/browser/dom.js`, `src/browser/text.js`,
  `src/browser/sites/index.js`, `src/ui/browser-tabs.js` et
  `tests/browser-dom.test.js`.
- Réutilisation des helpers : `src/browser/registry.js`,
  `src/browser/sites/wiki/model.js`, `src/browser/sites/wiki/render.js`,
  `src/browser/sites/videotube/render.js`, `src/browser/sites/forumjeu/render.js`,
  `src/browser/sites/flashzone/index.js`, `bubble-pop.js`,
  `avoid-the-squares.js` et `pixel-runner.js` dans ce même dossier FlashZone.
- Délégation du rendu des onglets : `src/ui/browser.js`.
- Maintenance du test interactif : `scripts/verify-desktop-ui.mjs` recherche
  explicitement le lien XD Search parmi les résultats plutôt que de supposer
  que « INTERNET » ne renvoie qu'une seule page dans le catalogue actuel.
- Rapport : `docs/code-audit.md`.

Le formatage du renderer ForumJeu a été harmonisé. Aucun texte de jeu, fichier
de données, style, ressource, identifiant, format de sauvegarde ou fichier
Electron n'a été modifié. Les cycles de vie des onglets et des parties restent
dans les contrôleurs existants.

### Vérifications réellement effectuées

- Référence complète avant modification : 188 tests réussis sur 189.
- Suite complète finale (`node --test`) : 191 tests réussis sur 192, dont trois
  nouveaux tests des helpers et des identifiants/actions d'onglets. Le seul
  échec est identique à la référence : `tests/start-menu.test.js:56`, concernant
  `applicationUsage`, absent des réglages actuels. Le prototype `StartMenu`
  visé par ce test n'est pas utilisé par le jeu ; le menu actif utilise
  `StartMenuOrder`. La fonctionnalité obsolète n'a pas été réintroduite.
- Tests ciblés et compilation de production après chacun des deux groupes de
  modifications : réussis, avec vérification des catalogues musicaux/narratifs.
- Comparaison temporaire avant/après : arbres de rendu identiques pour les
  62 pages enregistrées ; empreintes identiques des 93 fichiers de données,
  styles, ressources et fichiers Electron contrôlés.
- `--browser-security-electron` : démarrage réel d'Electron en production,
  recherche, pages d'erreur, historiques indépendants, navigation, onglets,
  déplacement/redimensionnement, barre des tâches, rechargement, sauvegarde,
  fermeture du dernier onglet et New Game. CSP, absence de Node.js dans le
  renderer, preload limité et saisies malveillantes validés.
- `--flashzone-only` : trois jeux, commandes, collisions, replay,
  redimensionnement, suspension/reprise du Runner entre onglets,
  fermeture/réouverture, records, redémarrage et New Game.
- `--wiki-only` : accueil, 16 articles, indexation, sommaires, liens,
  précédent/suivant, recherche insensible aux accents, hasard et saisies hostiles.
- `--videotube-only` : sept pages et miniatures, commentaires, notes, recherche,
  boutons et pont externe simulé en réussite/échec. Aucun navigateur réel ouvert.
- Ces parcours interactifs vérifient les exceptions d'exécution et les requêtes
  réseau : aucun nouvel échec constaté.
- `npm run format:check` signale quatre fichiers ForumJeu non modifiés :
  `data.json`, `index.js`, `model.js`, `styles.css`. Contrôle séparé des fichiers
  modifiés effectué. Aucun outil de lint ou de vérification de types n'est
  configuré dans le dépôt.

### Limites et éléments laissés inchangés

`main.js` et les conversations MSN coordonnent de nombreux états asynchrones,
transitions et événements narratifs. Un découpage supplémentaire présente un
risque sans bénéfice suffisant pour cette intervention. Les sauvegardes,
migrations, moteurs de jeux et protections Electron restent inchangés. Les
cinq dépendances déclarées ont un usage identifié ; aucune n'a été supprimée.
Aucun problème de performance mesuré ne justifie une optimisation spécifique.

ForumJeu a été contrôlé par les tests et la comparaison de ses arbres de pages,
sans parcours interactif dédié. La suite automatisée couvre également bureau,
fenêtres, progression, dialogues et sauvegardes, mais une traversée manuelle
complète du scénario, des profils MSN et de toutes les applications n'a pas été
effectuée. Elle reste à réaliser pour une validation exhaustive de livraison,
ainsi que l'ouverture des liens YouTube dans le navigateur réel du joueur.
Aucun exécutable portable n'a été généré. L'échec préexistant du prototype
`StartMenu` et les quatre écarts de formatage restent à traiter séparément.
