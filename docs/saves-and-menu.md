# Menu et sauvegardes

Le jeu affiche toujours son menu principal au lancement. Sans partie commencée,
seuls **PLAY** et **OPTIONS** apparaissent. PLAY lance le niveau rythmique 1.
Une fois une partie commencée, **CONTINUE**, **NEW GAME** et **OPTIONS** apparaissent.
NEW GAME exige une confirmation et conserve les préférences audio et d'affichage.

## Points de reprise

- Niveau rythmique en cours : reprise au début de ce niveau, sans marquer le niveau terminé.
- Niveau terminé : reprise sur le bureau ou dans la conversation débloquée.
- Conversation en cours : messages reçus, choix, alternatives et fichiers conservés ;
  seul le délai d'un message encore en préparation recommence.
- Conversation terminée : elle est sauvegardée sans retirer ses messages de l'écran.
- Mini-jeu en cours : reprise depuis le bureau avec son fichier ; le mini-jeu
  recommence au début lorsqu'on l'ouvre. Son résultat n'est enregistré qu'à la fin.
- Aventure terminée : retour au bureau, avec les fichiers et conversations conservés.

L'entrée **Démarrer → Menu principal** permet de quitter le niveau, le bureau, MSN ou un
mini-jeu. Il conserve le dernier point de reprise et arrête les animations et sons
de la séquence quittée. Il est indisponible pendant un chargement audio.

## Stockage et intégrité

Les données restent dans le profil utilisateur Electron, indépendamment du
dossier de l'exécutable portable :

- `chaos-survival-story-v1` : partie active, identifiant de partie, chapitre,
  séquence, résultats, conversations débloquées, dialogues, choix, réponses
  non sélectionnées, fichiers et données de dialogue existantes.
- `chaos-survival-history-v1` : parties précédentes archivées lors de NEW GAME.
- `chaos-survival-settings-v1` : volumes musique/bruitages et plein écran.

Chaque écriture localStorage remplace atomiquement un document JSON complet.
NEW GAME écrit l'archive avant la nouvelle partie active : si une écriture échoue,
la partie active reste intacte. Les archives utilisent l'identifiant de partie
pour éviter les doublons lors d'une nouvelle tentative. Un historique corrompu
n'est pas remplacé silencieusement. Une sauvegarde active invalide ramène au menu
PLAY, avec un message explicatif, sans planter le jeu.

**OPTIONS → Effacer toutes mes données…** exige une confirmation, puis supprime
la partie active, les archives, les choix, les préférences, la calibration et les
records. Aucune donnée historique cachée ne subsiste après cette action.

## Extensions futures

`src/config/menu.json` définit les textes et le thème. `variants` peut recevoir
des variantes `{ "whenCompleted": "id-de-sequence", "labels": { ... },
"theme": "nom-du-theme" }`. `menuPresentation` choisit une variante selon la
progression ; `data-theme` permet d'ajouter son style dans `styles-menu.css`.
Le menu conserve un composant dédié, où des éléments temporaires pourront être
ajoutés sans modifier le gameplay ou le moteur de dialogue.

`Progression.onNewGame` est un point d'extension appelé après une nouvelle partie
enregistrée avec succès. Aucun événement narratif n'y est branché actuellement.
Le menu initial reste joyeux et innocent.

La musique de menu est une composition synthétisée locale dans
`src/audio/menu-music.js`, indépendante de l'horloge audio du niveau 1.
Le preload Electron n'expose que les contrôles de plein écran ; aucun accès
Node.js ou système de fichiers n'est donné à l'interface.

## Vérification

```powershell
npm test
npm run dist
npm run verify:portable -- --menu --story
```

Le test portable copie uniquement l'exécutable hors du projet, utilise un profil
jetable, ferme puis relance réellement Electron et vérifie les six parcours du
menu, la corruption, l'effacement et le parcours niveau → MSN → mini-jeu.
Il n'accède pas aux sauvegardes personnelles du joueur.
