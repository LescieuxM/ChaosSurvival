# Conversations MSN

`src/dialogues/pixelgirl-intro.json` contient le scénario fourni : quatre choix
de trois réponses, avec branches qui rejoignent la conversation commune. Chaque
réponse a un identifiant unique. Les messages ne sont jamais effacés et aucune
réponse n'est choisie automatiquement. Les messages arrivent naturellement : aucun
contrôle de pause et remonter dans l'historique ne suspend pas la suite.
« Derniers messages » ramène en bas. Les réponses deviennent visibles après la
séquence complète, y compris ses transitions automatiques. Les anciens choix
restent sauvegardés pendant l'arrivée d'un nouvel événement.

`src/config/contacts.json` distingue les contacts décoratifs (`decorative`, hors
ligne, sans dialogue) des contacts narratifs (`narrative`, avec un identifiant
`dialogue`). Un personnage n'apparaît qu'après le déblocage de son dialogue.
Le bouton « Mes contacts » retrouve la liste sans effacer la discussion.

La première réponse non sélectionnée apparaît 500 ms dans le journal comme une
ligne normale. Elle ne devient pas un message envoyé et PixelGirl ne réagit pas.
Le JSON active cet effet via `anomaly: { "type": "unselectedEcho", "durationMs": 500 }`.

La sauvegarde contient les propositions `choiceOffers`, puis les options
`offered` et `unselected` pour chaque choix. Ces données gardent le texte proposé
à l'époque, même si le scénario est modifié ensuite. L'anomalie ne se rejoue pas
après rechargement. Les anciennes sauvegardes restent disponibles ; les anciennes
conversations sont conservées dans `dialogueArchives` lors d'un changement de `revision`.

## Format des dialogues

Chaque JSON possède `id`, `version: 1`, `revision`, `contact`, `player`, `start`
et une table `nodes`. Un nœud possède des `messages` puis un des champs `choices`,
`next`, `transfer` ou `end: true`. Vite intègre automatiquement tous les JSON du dossier.

```json
{
  "messages": [{ "speaker": "contact", "text": "heyyyy :DDD", "delayMs": 800, "typingMs": 600 }],
  "choices": [
    { "id": "hello-wave", "text": "salut :3", "next": "common", "set": { "mood": "happy" } },
    { "id": "hello-joke", "text": "GG !", "next": "common", "set": { "mood": "playful" } }
  ]
}
```

`delayMs` précède la saisie ; `typingMs` contrôle l'indicateur. Les textes sont
rendus comme texte, sans exécution HTML. Les avatars sont locaux dans `public/avatars/`.
Un message ou une réponse peut utiliser `when: { "flag": "mood", "equals": "happy" }`.
Une conversation future peut aussi dépendre d'une réponse proposée et non sélectionnée :

```json
{
  "choice": {
    "dialogue": "pixelgirl-intro",
    "node": "first-contact",
    "id": "greeting-2",
    "selected": false
  }
}
```

Les boucles de transitions automatiques sont rejetées. Une boucle interactive
de refus de fichier est permise : le joueur reste libre d'accepter plus tard.

## Fichiers fictifs

Un message `type: "file"` inclut `file: { "id", "name", "sizeLabel", "launch" }`.
`speaker: "contact"` propose une réception ; `speaker: "player"` propose un envoi.
Le champ `launch` peut contenir `game` et `sequence`. Un nœud attend le résultat
avec `transfer: { "fileId": "super-mega-game", "accept": "good-luck", "refuse": "refused" }`.

`SUPER_MEGA_GAME.exe` est seulement un élément du faux bureau. Le transfert
affiche une barre et un son, puis ajoute l'icône. Son double-clic lance Smiley
Catcher dans une fenêtre XP. Aucun programme externe n'est créé ni exécuté.
Le fichier reçu est sauvegardé et reste accessible après relancement.

## Réactions aux replays du niveau 1

`src/config/replay-reactions.json` définit le délai de réception (2 secondes), la
première réaction et la rotation des cinq variantes. Les messages sans choix
se trouvent dans `src/dialogues/pixelgirl-replay-*.json` et
utilisent le moteur de dialogue existant. La conversation d'introduction reste
inchangée.

Le premier message arrive à l'échéance des deux secondes ; les suivants
respectent les délais et temps d'écriture du JSON. L'échéance de réception
suivante est sauvegardée pour reprendre sans doublons après fermeture de
Messenger ou redémarrage. Ces événements ne proposent aucune réponse du joueur.

`src/story/replays.js` enregistre chaque lancement réussi de la musique dans
`level1Launches`, même si le niveau est abandonné. Les réactions restent désactivées
tant qu'aucun message de la première rencontre n'a été reçu. Chaque tentative
possède un identifiant et une échéance persistants : une réception ne peut être
répétée après un redémarrage. Les messages restent disponibles avec Messenger
fermé ou réduit. Recevoir un message n'ouvre pas Messenger et ne met pas le jeu
en pause ; le joueur peut ouvrir Messenger pour discuter à son rythme.

PixelGirl possède une seule discussion, sans sélecteur de scénarios. Les fichiers
JSON représentent des événements injectés automatiquement dans ce fil. Le
gestionnaire `src/story/conversation-thread.js` ajoute les messages à l'historique
chronologique du contact dès leur échéance, indépendamment des réponses en
attente. Les questions narratives attendent leur tour : une seule question à la
fois est affichée dans la zone de réponses en bas, après la séquence de messages.
Aucun bouton de réponse n'est inséré dans l'historique. La réponse choisie y
apparaît uniquement comme un message envoyé.
Chaque réponse est liée à son propre événement, sans sélecteur de scénarios.
Un choix ou un transfert en attente n'est jamais perdu. Les anciennes échéances
de cinq secondes encore en attente sont migrées vers le délai de deux secondes.
Les anciens choix de replay en attente sont clôturés à la reprise. Les messages,
réponses déjà envoyées, choix enregistrés et anciennes propositions restent
conservés ; aucune branche de replay n'est relancée.

La sauvegarde `conversations.pixelgirl` conserve l'historique unique, les messages
non lus, l'événement actif et la file des événements prêts. Les états des scripts
restent dans `dialogues` pour reprendre leurs branches, choix et transferts. Les
anciennes sauvegardes sont fusionnées automatiquement, sans modifier les textes
ni les choix. Cette migration est idempotente : relancer le jeu ne duplique pas
les messages. Messenger fermé ou réduit conserve les messages et les réponses
en attente ; les événements sont déclenchés par le jeu et jamais choisis dans
l'interface. NEW GAME archive la partie puis réinitialise ce fil et le compteur.
Effacer les données utilisateur supprime également les archives.

## Remplacer le mini-jeu

`src/config/story.json` enchaîne arcade, conversation et mini-jeu. Le descripteur
`src/minigames/smiley-catcher.json` choisit le moteur et ses réglages. L'interface
`registerMiniGame(engine, factory)` permet de remplacer le gameplay sans modifier
le moteur de dialogues. Le prototype dure 30 secondes et propose pause, score,
combos et retour au bureau, sans condition de défaite.

Le build valide les dialogues, les transferts, les avatars et les références aux jeux.
`npm run verify:portable -- --story` vérifie le parcours complet dans l'EXE hors
du projet : victoire, connexion, choix, anomalie, refus puis transfert, fichier,
mini-jeu et retour au bureau. Les captures sont dans `.qa/`.

Pour réinitialiser uniquement l'histoire en développement, via F12 :

```js
localStorage.removeItem('chaos-survival-story-v1');
location.reload();
```
