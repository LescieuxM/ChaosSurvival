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
