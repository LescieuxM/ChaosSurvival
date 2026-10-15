# Audit technique et sécurité — 14 octobre 2026

Audit du code présent dans la branche de travail, après la maintenance du
navigateur. Les modifications non committées de cette intervention antérieure
ont été conservées. Ce rapport décrit des observations et des tests précis ;
il ne certifie ni l'absence de bugs ni l'absence de vulnérabilités.

## A. Problèmes identifiés

| Référence | Gravité                           | Emplacement                                                           | Reproduction et conséquence                                                                                                                                                                                                     | Statut                                                                                                                                                                                                           |
| --------- | --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1        | Élevée, sur sauvegarde endommagée | `src/story/conversation-thread.js`, getter `state`                    | Charger une conversation v1 avec un historique valide, mais `unread` absent, nul ou malformé. La validation remplaçait toute la conversation et perdait notamment ses Wizz, impossibles à reconstruire depuis les dialogues.    | Corrigé ; test en échec avant correction, réussi après.                                                                                                                                                          |
| A2        | Moyenne                           | `src/ui/messenger.js`, compteur des non lus                           | Une entrée de conversation sauvegardée sans tableau `unread` pouvait faire échouer l'affichage de la liste des contacts, avant même l'ouverture de cette conversation. Une chaîne pouvait aussi produire un compteur incorrect. | Corrigé ; couvert avec A1.                                                                                                                                                                                       |
| A3        | Moyenne                           | `src/story/dialogue.js`, `matches`                                    | Une sauvegarde acceptée contenant un choix dont `unselected` est une chaîne/objet, ou contient `null`, déclenche une exception lors d'une condition sur une réponse non sélectionnée.                                           | Corrigé ; test en échec avant correction, réussi après.                                                                                                                                                          |
| A4        | Faible                            | `src/ui/windows.js`, `enableDrag`                                     | Maintenir le bouton central ou droit sur la barre de titre puis déplacer la souris déplaçait la fenêtre et la marquait comme déplacée.                                                                                          | Corrigé ; test en échec avant correction, réussi après.                                                                                                                                                          |
| A5        | Faible, infrastructure de test    | `scripts/verify-desktop-ui.mjs`, `verifySkyPage`                      | Le parcours attendait quatre sites dans XD Search, alors que VideoTube et Wiki sont déjà implémentés.                                                                                                                           | Attente corrigée pour les six sites ; parcours relancé avec succès.                                                                                                                                              |
| A6        | Faible, infrastructure de test    | Même script, `verifySmileyDialogue`                                   | Le parcours attendait l'absence du contact Turb0 avant sa connexion, alors qu'il est désormais visible hors ligne dès le début.                                                                                                 | Vérification d'un contact unique, initialement hors ligne, puis de sa connexion au délai existant ; parcours relancé avec succès.                                                                                |
| A7        | Faible, prototype inutilisé       | `src/ui/start-menu.js:107`, `tests/start-menu.test.js:56`             | `StartMenu.record` lit `settings.data.applicationUsage`, champ absent des réglages actuels. Le test de persistance échoue. Le jeu n'importe pas ce prototype ; il utilise `StartMenuOrder`.                                     | Non corrigé. Le test reste exécuté et son échec reste visible. Introduire la persistance des applications fréquentes ou retirer ce prototype demande une décision séparée ; aucun blocage du menu actif observé. |
| A8        | Faible, formatage                 | `src/browser/sites/forumjeu/{data.json,index.js,model.js,styles.css}` | `npm run format:check` signale quatre écarts dans ces fichiers non modifiés par l'audit.                                                                                                                                        | Non corrigé : aucun impact fonctionnel identifié.                                                                                                                                                                |

Les reproductions de sauvegardes utilisent des objets et stockages en mémoire,
jamais les données du développeur. A1–A3 concernent des métadonnées incorrectes,
pas une modification des règles narratives.

## B. Corrections effectuées

- `src/story/conversation-thread.js` : validation indépendante des marqueurs
  de lecture ; un tableau invalide devient vide, ses éléments non textuels
  sont filtrés, et les messages valides restent présents.
- `src/ui/messenger.js` : compteur des non lus tolérant les données absentes
  ou incorrectes, y compris pour un contact dont la conversation n'est pas ouverte.
- `src/story/dialogue.js` : les alternatives d'un choix ne sont parcourues
  que si elles forment un tableau ; les entrées nulles ne sont pas interprétées.
  Le choix sélectionné et sa sauvegarde restent conservés.
- `src/ui/windows.js` : seul le bouton gauche commence un déplacement.
- `tests/audit-regressions.test.js` : deux nouveaux tests, chacun avec plusieurs
  formes de sauvegarde endommagée et rechargement du véritable `Progression`.
- `tests/window-movement.test.js` : test des boutons central/droit en plus du
  déplacement gauche et des limites existantes.
- `tests/browser-security.test.js` : test supplémentaire d'une adresse d'un
  million de caractères, d'URL malformées, de faux domaines, d'identifiants de
  connexion, de caractères de contrôle et d'un domaine visuellement similaire.
- `scripts/verify-desktop-ui.mjs` : actualisation des deux attentes obsolètes,
  et ajout d'un parcours ForumJeu accueil → catégorie → discussion → accueil
  dans le test réel du navigateur/Electron.
- `docs/TECHNICAL_SECURITY_AUDIT.md` : présent rapport.

Les identifiants, clés, versions et formats de sauvegarde ne changent pas.
Aucune migration globale, dépendance, modification de dialogue/article/commentaire,
de style, de musique, de difficulté ou de configuration Electron.

## C. Sécurité

### Vulnérabilités confirmées du jeu

Aucune exécution de code arbitraire, ouverture d'URL externe arbitraire ou
lecture du système hôte n'a été reproduite via les champs ou IPC examinés.
A1–A3 sont des défauts de robustesse des données sauvegardées, pas des preuves
de compromission du système hôte.

### Protections contrôlées sans anomalie

- Entrées : `src/main.js`, `electron/main.cjs` ; un seul document de jeu.
  `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`,
  `webviewTag: false` et `webSecurity: true` explicitement configurés.
- `electron/preload.cjs` expose uniquement l'ouverture d'une vidéo par ID et
  les opérations limitées de plein écran. Aucun accès générique au disque,
  à un shell, à Node.js ou à `ipcRenderer` dans le renderer.
- Les trois canaux IPC (`chaos:open-video`, `chaos:get-fullscreen`,
  `chaos:set-fullscreen`) contrôlent le frame principal et l'URL exacte du
  document. Le setter vérifie le type booléen côté main ; la vidéo exige
  un identifiant textuel présent dans les données empaquetées.
- VideoTube : sept associations ID/URL fixes, propriété propre obligatoire,
  format HTTPS YouTube exact ; aucune URL fournie par le renderer n'est
  transmise à `shell.openExternal`. Tests des IDs inconnus, objets, tableaux,
  URL, caractères supplémentaires et frames étrangers ; échecs OS gérés.
- Production : requêtes limitées à `chaos://game`, permissions et téléchargements
  refusés, nouvelles fenêtres, navigation native, redirections et webviews bloqués.
  Développement : origine HTTP/WS loopback exacte seulement, ignorée en version
  empaquetée.
- `electron/local-assets.cjs` restreint la résolution au dossier `dist` et
  refuse les sorties de dossier, chemins Windows, caractères de contrôle,
  origines étrangères et identifiants dans les URL. Le handler accepte seulement
  GET, lit le chemin résolu, ajoute CSP et `nosniff` et gère les erreurs.
- CSP sans scripts inline ni `unsafe-eval`, sans frames, objets, workers ou
  ressources externes. `style-src 'unsafe-inline'` sert aux coordonnées et
  styles dynamiques existants ; ce n'est pas une permission d'exécuter du JavaScript.
- Internet Adventurer résout les URL via les pages enregistrées ; aucune
  navigation fictive ne charge de document distant. Schémas hostiles, faux
  domaines et URL inconnues produisent des erreurs locales.
- Saisies XD Search/Wiki, textes MSN, Bloc-notes et contenus des sites rendus
  comme texte. Les usages d'`innerHTML` examinés servent aux gabarits et icônes
  du développeur, pas à l'interprétation de recherches ou de texte saisi.

Référence utilisée pour l'examen : [recommandations officielles de sécurité
Electron](https://www.electronjs.org/docs/latest/tutorial/security/), notamment
l'isolation, le sandbox, les API preload limitées et la validation des IPC.

### Alertes de dépendances

Commandes npm réellement exécutées, sans installation ni mise à jour :

- `npm audit --json --cache .qa/npm-audit-cache` : **8 alertes modérées**,
  aucune élevée ou critique. Le premier essai en sandbox sans accès au registre
  a échoué ; le contrôle réseau autorisé a ensuite abouti.
- `npm audit --omit=dev --json --cache .qa/npm-audit-cache` : **0 alerte** dans
  la sélection npm de production. Electron est déclaré en devDependency mais
  fournit le runtime de l'application : ce résultat ne certifie pas le binaire
  Electron/Chromium.
- `npm ls --depth=0` : `@electron/asar 3.4.1`, `electron 44.7.0`,
  `electron-builder 26.15.3`, `prettier 3.9.10`, `vite 7.3.7`.

| Dépendance signalée et version installée    | Origine de l'alerte                                                      | Usage et portée constatés                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `sprintf-js 1.1.3`                          | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Précision de formatage non bornée pouvant lever une exception si la chaîne de format est contrôlée ; pas d'utilisation par le code du jeu. |
| `roarr 2.15.4`                              | Dépend de `sprintf-js`                                                   | Journalisation transitive des outils.                                                                                                      |
| `global-agent 3.0.0`                        | Dépend de `roarr`                                                        | Proxy HTTP des outils.                                                                                                                     |
| `@electron/get 3.1.0`                       | Dépend de `global-agent`                                                 | Copie imbriquée dans `app-builder-lib`, téléchargement lors du packaging ; la copie racine est 5.1.0 et n'est pas celle signalée.          |
| `app-builder-lib 26.15.3`                   | Dépendances de packaging signalées                                       | Construction des distributions.                                                                                                            |
| `dmg-builder 26.15.3`                       | Chaîne `app-builder-lib`                                                 | Packaging macOS, pas appelé par la cible Windows portable.                                                                                 |
| `electron-builder-squirrel-windows 26.15.3` | Chaîne `app-builder-lib`                                                 | Cible Squirrel, pas la cible portable du projet.                                                                                           |
| `electron-builder 26.15.3`                  | Dépendances précédentes                                                  | Outil de construction ; pas importé par les pages du jeu.                                                                                  |

Il s'agit d'une alerte racine propagée à plusieurs paquets, pas de huit exploits
distincts démontrés. Aucun flux des entrées du joueur vers une chaîne de format
de cet outil n'a été identifié. Le risque de la chaîne de construction reste
distinct du runtime et ne doit pas être ignoré lors d'une livraison.

L'avis vérifié ne fournit pas de version corrigée de `sprintf-js`. npm propose
`electron-builder 26.5.0` et marque l'opération comme potentiellement incompatible :
c'est une version antérieure à celle installée. Aucun downgrade, override
transitif ou `audit fix --force` n'a été appliqué. Une révision des outils devra
être validée séparément par compilation et packaging Windows.

### Risques potentiels et limites

L'audit suppose l'intégrité des fichiers du jeu installés. Il n'est pas une
analyse des attaques nécessitant de modifier son exécutable, ses fichiers locaux
ou le système hôte. Les futurs sites doivent conserver le rendu textuel et le
routeur interne ; les protections actuelles ne dispensent pas de vérifier leur code.

Aucune mesure de mémoire sur une session de plusieurs heures ni fuzzing exhaustif
n'a été effectué. Les tests ciblés contrôlent néanmoins l'annulation des frames,
la suppression des écouteurs, les relances, les changements d'onglets et les
fermetures répétées des moteurs concernés.

## D. Résultats des tests

Tous les tests utilisent des données en mémoire ou des profils temporaires
distincts sous `.qa`. Aucune sauvegarde utilisateur supprimée.

| Commande exécutée                                                                                                                                                                                        | Résultat                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node --test`                                                                                                                                                                                            | **195/196 réussis** ; seul échec A7, déjà présent avant l'audit (191/192). Aucun test ignoré.    |
| `node --test tests/audit-regressions.test.js` avant correction                                                                                                                                           | Deux échecs reproduisant A1/A3.                                                                  |
| `node --test tests/window-movement.test.js` avant correction de A4                                                                                                                                       | Échec du nouveau test boutons secondaires, trois tests existants réussis.                        |
| `node --test tests/audit-regressions.test.js tests/save.test.js tests/story.test.js tests/smiley-dialogue.test.js tests/replay-reactions.test.js tests/messenger-interface.test.js tests/typing.test.js` | 63 tests réussis après A1–A3.                                                                    |
| `node --test tests/window-movement.test.js tests/browser-security.test.js tests/audit-regressions.test.js`                                                                                               | 12 tests réussis après A4 et le nouveau corpus d'URL.                                            |
| `npm run build`                                                                                                                                                                                          | Réussi : catalogues musicaux/narratifs vérifiés, 119 modules compilés.                           |
| `npm run format:check`                                                                                                                                                                                   | Échec sur les quatre écarts existants A8 ; fichiers modifiés contrôlés séparément avec Prettier. |
| `git diff --check`                                                                                                                                                                                       | Réussi.                                                                                          |

Aucun lint ni outil de vérification de types n'est configuré : aucune commande
de lint/type inventée ou présentée comme exécutée.

Parcours exécutés avec `node scripts/verify-desktop-ui.mjs` suivi des options
ci-dessous, sur le build contenant les corrections :

| Option                        | Résultat et couverture                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--browser-security-electron` | Réussi dans le véritable Electron en production : démarrage, CSP, absence de Node, API fullscreen, entrées hostiles, URL/recherche, erreurs, ForumJeu, onglets/historiques, rechargement, fenêtres, barre des tâches, persistance et New Game. |
| `--messenger-only`            | Réussi : contacts, conversations indépendantes, profils, menus, clavier, options, Wizz, saisie fixe, choix, réception en arrière-plan, non lus et historique.                                                                                  |
| `--window-movement-only`      | Réussi : lancement EXE, déplacement réel des fenêtres arcade/explorateur, limites du bureau, priorité des clics et barre des tâches, fermeture/score/audio.                                                                                    |
| `--desktop-grid-only`         | Réussi : Corbeille, dernière rangée, sélection, cellules sauvegardées, resize et double-clic.                                                                                                                                                  |
| `--new-game-only`             | Réussi : annulation conservatrice, confirmations répétées, remise à zéro des fichiers, positions, menu, MSN, résultats, préférences et tutoriels ; stockage étranger conservé.                                                                 |
| `--notepad-only`              | Réussi : édition, Ctrl+S sur fenêtre active, confirmations Oui/Non/Annuler, Unicode, limite UTF-8, texte inerte, relance et réordre de barre des tâches.                                                                                       |
| `--buddy-only`                | Réussi : activation manuelle, bulles, animations, position responsive, interactions bureau, relance, masquage et New Game.                                                                                                                     |
| `--skypage-only`              | Premier échec A5 corrigé ; passage final réussi : neuf routes, articles/commentaires, ressources locales, historique réel des visites, liens, recherche, onglets, resize, relance et New Game.                                                 |
| `--flashzone-only`            | Réussi : trois jeux, commandes, collisions/replay, resize, suspension du Runner, fermeture/réouverture, recherche, records, relance et New Game.                                                                                               |
| `--videotube-only`            | Réussi : sept vidéos, ressources et données, liens/recherche, boutons, pont externe simulé en réussite/échec, resize et URL hostiles.                                                                                                          |
| `--wiki-only`                 | Réussi : 16 articles, accueil, sommaires, liens, recherche/indexation, hasard, navigation, resize et saisies hostiles.                                                                                                                         |
| `--smiley-dialogue-only`      | Premier échec A6 corrigé ; passage final réussi : victoire réelle de Smiley, réception fenêtre fermée, dix choix sur huit séquences, branches, PixelGirl en ligne, connexion différée de Turb0 et persistance.                                 |

Les parcours contrôlent les exceptions d'exécution et les requêtes ; aucune
nouvelle exception non interceptée ni requête externe des sites constatée.
Le test Electron provoque volontairement un refus CSP pour vérifier son efficacité.

### Vérifications restantes

- Cliquer réellement sur les sept liens VideoTube et vérifier l'ouverture dans
  le navigateur installé du joueur. La chaîne main/preload/bouton a été testée
  avec `shell.openExternal` simulé, sans ouvrir de navigateur externe.
- Effectuer une session prolongée et plusieurs parties complètes de
  ChaosSurvival.exe avec observation mémoire/audio. Ici, lancement, interactions
  et score sont testés dans l'interface ; règles et victoire/replay sont couverts
  par les simulations/unitaires. Aucune partie rythmique complète au chronomètre
  n'a été jouée pendant cet audit.
- Valider le packaging portable Windows après une éventuelle révision des outils.
  Aucun portable n'a été généré dans cette tâche.
- Décider du devenir du prototype `StartMenu` inutilisé et rétablir une suite
  entièrement verte sans introduire ses fonctionnalités dans le menu actif.

## E. Bilan

La couverture automatisée est substantielle pour navigation, sauvegardes,
transitions narratives, choix, scores et cycles de vie. Quatre nouveaux tests
complètent les protections ; les corrections restent limitées à quatre fichiers
runtime. Les sauvegardes valides et les comportements narratifs passent leurs
tests, et des métadonnées incorrectes ne détruisent plus l'historique MSN valide.

Les contrôles de sécurité examinés résistent aux entrées testées. Les alertes
de dépendances concernent la construction ; aucune compromission du runtime
n'est démontrée. Le projet n'est toutefois pas entièrement vert : A7/A8 restent
visibles, et les vérifications manuelles listées ci-dessus restent nécessaires
avant une validation exhaustive de livraison. Aucun changement de branche,
commit, push ou commande Git destructive.
