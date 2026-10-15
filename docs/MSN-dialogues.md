# Conversations MSN

## Après la première victoire à Smiley Catcher

`src/dialogues/pixelgirl-smiley-victory.json` contient huit séquences, dix choix
et 31 réponses possibles. Les branches rejoignent leurs troncs communs dans
le même historique de PixelGirl. Les choix sur les dessins, le smiley MSN et
la rencontre renseignent aussi `pixelgirlDrawingReaction`, `pixelgirlSmiley`
et `pixelgirlMeetingReaction` dans les flags sauvegardés.

La séquence `pixelgirl-smiley-win` suit `super-mega-game` dans `story.json`.
Les replays ne complètent pas une seconde fois cette séquence de mini-jeu et
ne redémarrent pas la conversation. `resumeAfterCompletion` permet aux anciennes
parties ayant déjà terminé Smiley de découvrir la suite sans perdre leurs données.

Le champ facultatif `typingPauseMs` ménage un silence **après** une saisie brève,
avant l'envoi du message : il ne crée aucune entrée fictive dans l'historique.
Les autres dialogues conservent leurs délais. Les délais absolus `receiveDueAt`
permettent aussi aux branches de continuer lorsque MSN est fermé ou réduit.

`completion.stayOnline` conserve le contact en ligne à la fin. Le champ
`completion.connection` programme la connexion d'un contact, ici Turb0 après
2,2 secondes. `DialogueEvents` sauvegarde ce délai puis son état dans
`contactConnections`, sans lancer de conversation. Un contact avec
`connection: true` dans le catalogue n'apparaît qu'après cet événement ; il
peut être consulté mais ne possède encore aucun dialogue narratif.

## Première rencontre et fonctionnalités communes

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
`dialogue`). Un double-clic sur un contact décoratif ouvre la même interface de
conversation, avec un historique vide et l'envoi désactivé. Ce mode ne crée pas
de dialogue sauvegardé et ne marque pas les messages de PixelGirl comme lus.
Chaque contact possède sa propre fenêtre et son bouton de barre des tâches.
La liste des contacts reste indépendante et s'ouvre depuis Démarrer ou le
raccourci Messenger. Un double-clic restaure la conversation existante sans
dupliquer son historique. Fermer les contacts ne ferme pas les discussions.

Un personnage narratif n'apparaît qu'après le déblocage de son dialogue.
Le menu Contacts ouvre la liste et permet de consulter le profil sélectionné.
Les profils affichent uniquement l'avatar local, le pseudonyme, le statut actuel
et le message personnel. Les valeurs par défaut viennent des données des
contacts ; un futur événement pourra remplacer le message via
`progression.data.contactProfiles[id].personalMessage`, puis sauvegarder avec
`progression.save()`. Ces remplacements sont effacés par New Game.
Les menus Fichier, Actions, Outils et Aide proposent fermeture, aperçu des
émoticônes, Wizz local, volume des effets et informations sur l'application.
Les contacts hors ligne ne peuvent pas recevoir de Wizz ni de messages.
Les sons de connexion, message, Wizz et déconnexion sont synthétisés localement.
Les menus acceptent les flèches, Entrée, Échap et se ferment au clic extérieur.
Le contrôleur `src/ui/messenger.js` gère les fenêtres ; les dialogues et leur
historique restent gérés par `ConversationThread` et la sauvegarde existante.
Une conversation non consultée clignote dans la barre des tâches jusqu'à lecture.

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
Lorsque `typingMs` vaut zéro, une partie de `delayMs` sert à afficher la saisie,
selon la longueur du message, sans retarder son envoi. Un message sans aucun délai
reste immédiat. L'indicateur affiche le pseudonyme du contact juste après le
dernier message, dans le contenu défilant du chat. Il disparaît hors saisie,
ne réserve aucun espace permanent et ne fait jamais partie de l'historique
sauvegardé. La lecture d'anciens messages n'impose pas de défilement vers le bas.
Une séquence déjà commencée
continue en arrière-plan lorsque Messenger est réduit ou fermé ; les choix attendent
toujours une action du joueur.
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
l'interface. NEW GAME efface la partie, les anciennes archives, ce fil et le compteur.
Effacer les données utilisateur supprime également toutes les préférences.

## Remplacer le mini-jeu

`src/config/story.json` enchaîne arcade, conversation et mini-jeu. Le descripteur
`src/minigames/smiley-catcher.json` choisit le moteur et ses réglages. L'interface
`registerMiniGame(engine, factory)` permet de remplacer le gameplay sans modifier
le moteur de dialogues. Le prototype dure 30 secondes et propose pause, score,
combos et retour au bureau, sans condition de défaite.

Le build valide les dialogues, les transferts, les avatars et les références aux jeux.
Après `npm run build`, `node scripts/verify-desktop-ui.mjs --messenger-only`
vérifie les fenêtres indépendantes, menus et clavier, profils, options, Wizz,
réception en arrière-plan, replays, choix en attente et reprise après redémarrage.
Ce contrôle utilise Edge sans interface et ne lance pas Electron.
`npm run verify:portable -- --story` vérifie le parcours complet dans l'EXE hors
du projet : victoire, connexion, choix, anomalie, refus puis transfert, fichier,
mini-jeu et retour au bureau. Les captures sont dans `.qa/`.

Pour réinitialiser uniquement l'histoire en développement, via F12 :

```js
localStorage.removeItem('chaos-survival-story-v1');
location.reload();
```
