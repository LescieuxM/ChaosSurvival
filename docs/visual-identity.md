# Identité des logiciels fictifs

Les noms et les chemins des cinq logos sont définis dans
`src/config/identity.json`. Pour renommer un logiciel, modifier uniquement son
champ `name`. Pour remplacer un logo, conserver un SVG local dans `public/logos/`
et modifier son champ `logo` (`./logos/nom-du-fichier.svg`).

| Application            | Composition originale                                   |
| ---------------------- | ------------------------------------------------------- |
| Windows XD             | Quatre rubans courbes en mouvement autour d'une perle   |
| Windows Love Messenger | Deux bulles turquoise et rose reliées par un cœur doré  |
| Internet Adventurer    | Globe cyan et aiguille de boussole dorée                |
| Windows Media Play     | Galet multimédia bleu/violet, lecture et barres sonores |
| Windows Upgrade        | Plateformes bleues et flèche ascendante verte           |

Les SVG sont dessinés pour le jeu avec dégradés, reflets et ombres, sans images
externes ni fichiers graphiques Microsoft. Ils sont intégrés au portable et
fonctionnent hors ligne. Les anciens identifiants d'icônes `flag`, `msn`, `globe`
et `music` restent des alias techniques afin de préserver les composants.

`src/ui/identity.js` fournit les noms, les ressources et la conversion des
anciennes mentions dans les popups d'arcade. Les JSON narratifs et les données
des sauvegardes ne sont pas réécrits.

Le fichier physique `assets/music-lvl1.mp3` et son analyse musicale ne changent
pas. Son nom visible est **DJARTMUSIC - Best Game Console.mp3**. Crédits fournis :
artiste **DJARTMUSIC**, titre **Best Game Console**, source **Pixabay**. Ces données
sont également centralisées dans `identity.json` et affichées dans le menu.

La page OPTIONS affiche les cinq logos ; le bureau, les fenêtres, les
notifications et la barre des tâches réutilisent les mêmes ressources.
