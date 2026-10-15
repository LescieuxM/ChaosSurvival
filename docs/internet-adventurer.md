# Internet Adventurer et XD Search

Internet Adventurer se lance depuis le bureau ou Démarrer. Il réutilise le
gestionnaire de fenêtres et la barre des tâches de Windows XD. Le coin inférieur
droit permet de redimensionner sa fenêtre. Les onglets et leurs historiques
sont conservés dans `progression.data.browser`, y compris après fermeture ou
redémarrage. New Game supprime cette session ; la prochaine ouverture affiche
un seul onglet XD Search.

Toutes les adresses sont fictives et résolues localement. Aucune URL saisie n'est
utilisée pour une requête réseau, une iframe, une WebView ou un script. Les
contenus utilisent des éléments DOM locaux ; le texte saisi est affiché avec
`textContent`. XD Search, SkyPage, ForumJeu, FlashZone, VideoTube et Wiki sont disponibles.
Wiki propose seize articles, une recherche locale par titre et une navigation
interne ; voir [wiki.md](wiki.md).

VideoTube propose uniquement sur ses pages vidéo une ouverture dans le navigateur
système, via un identifiant et une liste fixe d'URL YouTube côté Electron.
Cette exception ne permet pas d'ouvrir les adresses saisies par le joueur.
Voir [videotube.md](videotube.md) pour les sources et limites des liens.

## Ajouter une page locale

L’accueil XD Search affiche « Sites Web » à partir du même registre. Chaque
page d’accueil disponible enregistrée à la racine `/`, sans paramètre ni erreur,
apparaît une fois, avec son titre (ou `siteName` facultatif) et sa description.
Les sous-pages ne sont pas ajoutées à cet annuaire. Aucun catalogue séparé
n’est nécessaire pour les futurs sites.

Créer un composant dans `src/browser/pages/`, puis l'enregistrer dans
`src/browser/registry.js`. Le navigateur et XD Search utilisent le même registre :

```js
localPages.register({
  url: 'http://www.flashzone.fr/jeux/mon-jeu',
  title: 'Mon jeu',
  description: 'Description courte de cette page.',
  keywords: ['jeux', 'flash', 'arcade'],
  available: (data) => data.flags.monJeuAccessible === true,
  render: ({ url, data, registry, navigate }) => {
    const page = document.createElement('section');
    return page;
  },
});
```

Cet exemple n'est pas enregistré dans le jeu. Une route est définie par son
domaine et son chemin ; le composant peut lire les paramètres avec
`url.searchParams`. Les variantes sans protocole ou sans `www` sont normalisées.
Une page indisponible est exclue de la recherche et renvoie une erreur 404.
`indexable: false` retire uniquement une page de l'index. `error: 'timeout'`
prépare une erreur de délai explicite, sans aléatoire ni véritable attente réseau.

Les liens locaux doivent appeler `navigate(url)` ou utiliser un élément
`<a href="#" data-browser-link="adresse-fictive">`. XD Search classe simplement
les pages accessibles selon le nombre de termes correspondants, sans distinction
de casse ou d'accents.

## Ouvrir une adresse depuis une application

```js
import { openLocalUrl } from './browser.js';
openLocalUrl('http://www.flashzone.fr/jeux/mon-jeu');
```

L'événement interne `windows-xd:open-url` ouvre le navigateur ; s'il est déjà
ouvert, l'adresse apparaît dans un nouvel onglet. Aucun dialogue MSN existant
n'a été modifié pour l'utiliser. Les moteurs de mini-jeux existants et leurs
fichiers `.exe` restent sur le bureau.

## Vérifications

`node --test tests/browser.test.js` couvre URL, registre, recherche, erreurs,
onglets, sauvegardes invalides et New Game. Après `npm run build`,
`node scripts/verify-desktop-ui.mjs --browser-only` vérifie les interactions
réelles, les fenêtres, la persistance et l'absence de requêtes externes dans
Edge sans interface, sans lancer Electron.
