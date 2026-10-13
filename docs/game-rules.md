# Règles et première prise en main

Le niveau rythmique déclare ses règles dans `src/config/chart.json`. Chaque
mini-jeu peut déclarer les siennes dans son fichier JSON de `src/minigames/` :

```json
{
  "rules": {
    "id": "identifiant-unique-du-jeu",
    "title": "Nom du jeu",
    "description": "Objectif de la partie.",
    "controls": ["Commande principale", "Commande de pause"],
    "mechanics": ["Mécanique importante", "Condition de réussite"],
    "illustration": "./covers/illustration-locale.svg"
  }
}
```

L'illustration est facultative. Les identifiants doivent être uniques ; la
compilation vérifie les définitions. Pour reconnaître une ancienne partie
terminée, utiliser l'identifiant de la séquence arcade ou l'identifiant du mini-jeu.

`GameRules` fournit la fenêtre commune. Le lancement passe par `beforeStart()` :
la création du jeu, le démarrage audio et les timers attendent la validation.
Fermer la présentation initiale annule le lancement sans valider le tutoriel.

La sauvegarde active stocke `tutorials[id] = true` après confirmation. Cette
donnée ne valide aucune séquence et ne donne aucune récompense. Une nouvelle
partie réinitialise les tutoriels. Les sauvegardes anciennes restent compatibles ;
les jeux déjà terminés ne demandent pas une présentation obligatoire lors d'un replay.

Le bouton `?` de chaque jeu permet une consultation volontaire via `review()`.
L'arcade suspend et reprend son horloge audio existante. Smiley suspend son
compteur et remet sa référence de frame à zéro lors du retour, sans rattraper
le temps passé à lire. Les moteurs supplémentaires peuvent appeler le callback
`showRules` fourni par le gestionnaire de lancement ; ils doivent respecter
leur état de pause pour suspendre leurs mécaniques.

Vérification ciblée sans Electron :

```sh
node scripts/verify-desktop-ui.mjs --rules-only
```

Ce contrôle utilise le build courant dans Edge sans interface avec un profil de
test temporaire. Il vérifie les présentations initiales, les consultations en
pause, la sauvegarde, les replays et les interactions existantes du bureau.
