# Chaos Survival

Jeu Windows autonome avec Electron. Le gameplay, l'interface et le moteur audio
du projet Vite sont conservés.

## Développement

Avec Node.js 22.12+ (ou 24 LTS) et npm :

```powershell
npm install
npm run dev
```

Le jeu s'ouvre dans sa propre fenêtre Electron. Vite tourne uniquement pendant
le développement et recharge les modifications automatiquement. Fermer la fenêtre
arrête aussi Vite. F12 ouvre les outils de développement.

Le projet possède aussi un lanceur pour le Node local dans `.tools` :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task dev
```

`START-GAME.cmd` utilise ce même lanceur pour ouvrir le jeu en développement.

## Exécutable Windows portable

Sur Windows :

```powershell
npm run dist
```

Ou avec le Node local :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Task dist
```

Le fichier à distribuer est **`release/ChaosSurvival.exe`** (Windows x64).
Il contient Electron, le jeu, `music-lvl1.mp3` et toutes les ressources. Le joueur
double-clique sur cet unique fichier ; aucune installation de Node.js, aucun
navigateur externe et aucun serveur ne sont nécessaires. Le lanceur portable
extrait son contenu dans le dossier temporaire Windows au démarrage.

Envoie uniquement `release/ChaosSurvival.exe` à ton ami. Il peut le placer dans
n'importe quel dossier de son ordinateur Windows 64 bits et le lancer directement.
Le dossier du projet, `assets/`, `dist/` et `node_modules/` ne sont pas nécessaires.

Les fichiers intermédiaires sont générés dans `.tools/msn-portable-build/`, puis toutes
les ressources sont vérifiées avant de copier le portable final dans `release/`.
Un ancien dossier `release/win-unpacked/` n'est pas nécessaire pour jouer avec le
portable et ne doit pas être envoyé. Les premiers builds nécessitent Internet
pour télécharger Electron et les outils d'electron-builder ; jouer est hors ligne.

Pour tester le chargement de production avant de générer l'exécutable :

```powershell
npm run build
npm start
```

Vite utilise des chemins relatifs. Electron charge `dist/` dans l'archive ASAR via
le protocole local `chaos://game/`, y compris le chargement Web Audio de la musique.
Aucun serveur HTTP n'est lancé en production. Les records sont conservés dans
les données utilisateur de l'application Windows. Les accès HTTP, HTTPS et
WebSocket sont bloqués dans la version empaquetée. Chaque lancement utilise une
extraction temporaire distincte, nettoyée à la fermeture, sans installation ni
demande de droits administrateur.

## Commandes du jeu

Le menu principal affiche **PLAY** au premier lancement, puis **CONTINUE** et
**NEW GAME** lorsqu'une partie a commencé. CONTINUE reprend le dernier point de
sauvegarde ; un niveau ou mini-jeu inachevé recommence au début de cette séquence.
NEW GAME demande confirmation et archive la partie précédente.
**OPTIONS** conserve les volumes musique/bruitages et le plein écran entre les
sessions. **Démarrer → Menu principal** permet de revenir au menu depuis le jeu ou le bureau.
Voir [le fonctionnement des sauvegardes](docs/saves-and-menu.md).

- F11 ou Alt+Entrée : entrer / sortir du plein écran.
- Échap : pause / reprise.
- F3 ou bouton ♫ du bandeau : afficher le debug musical et régler le décalage.
- Croix rouge : fermer une fenêtre du jeu.
- Croix en haut à droite du menu principal : masquer le menu. « Démarrer → Chaos Survival » le rouvre.
- Alt+F4 : quitter l'application.

Les conversations MSN, erreurs, publicités, alertes antivirus et faux téléchargements
varient à chaque partie. Leur contenu se modifie dans `src/config/popups.js` ;
leurs introductions et leur cadence sont réglées dans `src/config/chart.json` avec les types `msn`,
`error`, `ad`, `virus` et `download`. Fermer une alerte ou annuler un transfert
rapporte les mêmes points que fermer une fenêtre avec sa croix.

## Conversations MSN et mini-jeu

Le scénario de PixelGirl, ses quatre choix, l'anomalie de 500 ms et le transfert
de SUPER_MEGA_GAME.exe sont intégrés. Les choix attendent une action du joueur
et toutes les alternatives sont sauvegardées. Le fichier fictif ouvre Smiley
Catcher 2009, un mini-jeu de 30 secondes dans une fenêtre XP.

Voir [le guide des dialogues MSN](docs/MSN-dialogues.md) pour écrire des
conversations JSON, des transferts, des conditions sur les réponses non choisies
et remplacer le mini-jeu. Le premier niveau musical est conservé.

## Synchronisation musicale du niveau 1

Le MP3 a été analysé directement avec librosa : durée **86,49 s**, **256 pulsations**,
tempo estimé **185,75 BPM** (environ 186 ; une lecture à moitié vitesse est aussi
possible). La première attaque retenue se situe à **0,02993 s**. Le fichier
`src/config/music-lvl1.analysis.json` contient les timestamps individuels, les
tempos locaux, l'intensité, les candidats de kicks, les accents et les sections
estimées. La résolution de l'analyse est d'environ 10 ms. Les noms intro / montée /
drop / break sont des estimations acoustiques, ajustables dans ce JSON.

L'analyse compare plusieurs tempos candidats avant le suivi des pulsations avec
un tempo local variable, puis aligne les détections sur les attaques du signal.
Cela évite de retenir automatiquement le candidat à 125 BPM, moins cohérent sur
ce morceau. Le BPM affiché sert d'information ; les événements ne sont jamais
programmés à partir d'une grille constante. Le suivi utilise les possibilités de
[tempo variable de librosa](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html).

Le tutoriel commence avec une conversation MSN toutes les 8 pulsations. Erreurs,
publicités, téléchargements et antivirus arrivent progressivement. La cadence
passe à 6, 4 ou 2 pulsations selon l'énergie réelle du morceau et revient à 8
pendant les breaks. Les attaques détectées sur les contretemps déclenchent des
effets décoratifs, sans ajouter de fenêtres. Aucune séquence à un clic par
pulsation n'est imposée dans ce premier niveau.

Trois fenêtres au maximum restent ouvertes. Le directeur adapte l'espacement
au temps de fermeture du joueur, à l'encombrement et au chaos. Une occasion
supprimée n'est jamais remise en file ni pénalisée. Les croix restent accessibles
grâce au placement décalé des barres de titre, y compris après redimensionnement.
Les fenêtres n'ont pas de délai individuel de fermeture ; la jauge conserve sa
pression et ses bonus habituels. Abandonner complètement le bureau peut toujours
faire perdre, tandis qu'un clic toutes les 2,5 à 4 secondes suffit dans les
simulations du niveau complet.

La lecture Web Audio fournit l'unique horloge musicale. `requestAnimationFrame`
consulte cette horloge ; les apparitions et les durées de notifications / wizz
ne dépendent pas de minuteurs accumulés. Après un blocage du rendu, les événements
anciens sont consommés sans rafale de rattrapage. Pause, reprise et redémarrage
suspendent ou réinitialisent la lecture, les événements et le directeur.

Le panneau F3 affiche le BPM global/local, le temps audio/musical, les pulsations
avec leurs timestamps, l'intensité, la section, les prochaines fenêtres possibles,
les suppressions adaptatives et le retard de rendu mesuré. Le décalage manuel va
de −500 à +500 ms, se mémorise pour ce MP3 et peut être réinitialisé. Une valeur
positive retarde les apparitions ; la recalibration ne rejoue aucun événement
déjà consommé. Ce panneau est disponible aussi dans l'EXE.

Pour analyser un nouveau MP3 (outil de développement facultatif, Python 3.14) :

```powershell
python -m venv .tools/audio-analysis
.\.tools\audio-analysis\Scripts\python.exe -m pip install -r scripts/audio-analysis-requirements.txt
.\.tools\audio-analysis\Scripts\python.exe scripts/analyze-music.py
```

Le script produit le JSON et une figure `.qa/music-lvl1-analysis.png`. Mettre à
jour la durée du niveau dans `chart.json` si le morceau change. `npm run build`
vérifie le SHA-256 du MP3 et refuse une analyse périmée. Python et librosa ne
sont **jamais requis par le joueur** : le JSON est intégré au JavaScript de
production et le MP3 à l'archive portable.

## Vérification

```powershell
npm test
npm run format:check
npm run verify:package
npm run verify:portable
npm run verify:portable -- --music
npm run verify:portable -- --story
```

`npm run format` remet en forme les sources avec Prettier. Le HTML du bureau et
les références aux éléments de l'interface sont regroupés dans `src/ui/desktop.js` ;
`src/main.js` orchestre la partie, le son et les interactions.

`verify:package` compare par SHA-256 chaque fichier de `dist/` et d'Electron avec
l'archive du build, ainsi que le MP3 original et les images de `public/`.

`verify:portable` est un test Windows : il copie **uniquement l'EXE** dans un
dossier temporaire extérieur au projet, contenant des espaces et des accents.
Il retire Node.js du PATH du jeu, utilise un profil isolé et vérifie le contenu
de l'archive réellement extraite par le portable, le chargement local de chaque
ressource, le blocage réseau, la musique, la pause/reprise et le score. Le test
ferme ensuite sa propre fenêtre et supprime ses fichiers temporaires.

L'option `--music` teste aussi le panneau F3, le décalage, le redémarrage, les
trois croix à 800 × 600 et une partie complète à un clic toutes les 2,5 secondes,
avec un blocage volontaire du rendu de 1,2 seconde. Compter environ deux minutes.
Le diagnostic maintient sa page de test visible pour éviter qu'un changement
de fenêtre sur le bureau ne déclenche la pause automatique pendant les mesures.

L'option `--story` inclut le test musical complet, puis vérifie la victoire, la
notification, la pause de lecture, les quatre choix, les propositions sauvegardées,
l'anomalie de 500 ms, la reprise, le refus puis l'acceptation du fichier et le
mini-jeu de 30 secondes. Compter environ quatre minutes. Les captures sont
enregistrées dans `.qa/victory.png`, `.qa/pixelgirl-conversation.png`,
`.qa/pixelgirl-small.png` et `.qa/smiley-catcher.png`.

Le rapport est enregistré dans `.qa/portable-verification.json` et une capture
dans `.qa/portable-verification.png`. Node.js est utilisé uniquement par l'outil
de vérification, jamais requis par le joueur.
