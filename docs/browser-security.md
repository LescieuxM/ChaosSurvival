# Sécurité d’Internet Adventurer

Internet Adventurer est un routeur DOM fictif. Ses adresses ne sont jamais
chargées par Electron, un iframe, un webview, fetch ou shell.openExternal.
Seules les pages déclarées dans `src/browser/registry.js` sont rendues ; les
protocoles autres que HTTP/HTTPS et les routes inconnues produisent une erreur
fictive. HTTP/HTTPS sont ici des identifiants, pas des requêtes Internet.

Les recherches, articles, commentaires, titres et liens affichent leurs textes
avec `textContent` ou `value`. XD Search encode ses paramètres avec
`encodeURIComponent`. Les liens passent par `data-browser-link` ; même un lien
oublié par un futur site ne peut pas naviguer le document hôte. SkyPage valide
les chemins de ses images dans les répertoires locaux avatars/skypage.

## Electron

`electron/security.cjs` centralise les protections natives :

- Node désactivé, isolation du contexte et sandbox conservés ; webview désactivé.
- Preload limité au plein écran et à l'ouverture des vidéos VideoTube par
  identifiant fixe, sans fichiers, commandes ou IPC générique.
  Les handlers IPC vérifient le document et la frame principale de l’émetteur.
- Nouvelles fenêtres, navigations du document/des frames, redirections,
  webviews, téléchargements et permissions refusés.
- Production : seules les requêtes `chaos://game/` sont autorisées. Le handler
  lit les fichiers du bundle `dist` après vérification du chemin ; les chemins
  sortant du bundle, identifiants URL, caractères de contrôle, antislashs et
  flux alternatifs Windows sont refusés. Aucun accès renderer à `file:`.
- Développement : seules les requêtes HTTP et WebSocket de l’origine exacte
  du serveur Vite local sont autorisées. CHAOS_DEV_URL doit désigner localhost
  ou 127.0.0.1. Cette variable est ignorée dans l’application empaquetée.
- CSP : scripts locaux, sans inline/eval ; images, musique, polices locales ;
  aucun objet, frame, worker, formulaire natif ou base URL. Les styles inline
  restent autorisés pour le positionnement/les animations des fenêtres.
  La CSP est envoyée par Electron et par le protocole local. Une CSP HTML
  protège également les vérifications dans le navigateur et autorise les
  WebSockets loopback nécessaires à Vite ; en production Electron, la politique
  supplémentaire retire cette exception.

Ces mécanismes suivent les [recommandations de sécurité Electron](https://www.electronjs.org/docs/latest/tutorial/security/).

VideoTube ajoute une exception explicite à l'ouverture externe : le bouton
« Regarder sur YouTube » envoie seulement l'identifiant au handler
`chaos:open-video`. `electron/video-links.cjs` résout l'URL dans le catalogue
livré, vérifie son format HTTPS YouTube exact et l'émetteur IPC avant d'appeler
`shell.openExternal`. Aucune adresse saisie ou URL du renderer n'est acceptée.
L'ouverture se fait dans le navigateur système ; la CSP et les restrictions
réseau de Chaos Survival ne sont pas assouplies. Détails et liens documentés
dans [videotube.md](videotube.md).

## Ajouter un site

Utiliser le registre, les API DOM textuelles et les ressources incluses dans le
jeu. Ne jamais interpréter le contenu JSON ou les entrées utilisateur comme du
HTML/JavaScript. Les composants de rendu sont du code développeur de confiance,
pas des plugins isolés : la CSP ne remplace pas cette discipline. Toute nouvelle
API preload doit être restreinte et vérifier son émetteur. Les mises à jour
d’Electron et des dépendances restent nécessaires ; ces protections ne sont
pas une garantie contre toutes les vulnérabilités de la plateforme.

## Vérifications

`node --test tests/browser-security.test.js tests/browser.test.js tests/skypage.test.js tests/local-assets.test.js`
vérifie le routage, le rendu textuel, les listes d’origines autorisées, les
handlers natifs et la validation IPC, ainsi que les ressources/sauvegardes.

Après `npm run build`,
`node scripts/verify-desktop-ui.mjs --browser-security-electron` effectue une
vérification ciblée avec un profil Electron temporaire : entrées malveillantes
dans les vrais formulaires, absence de Node, preload limité, script inline
bloqué par CSP, navigation fictive, onglets, ressources, reprise et New Game.
Il ne produit pas d’exécutable portable.
