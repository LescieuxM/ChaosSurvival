# SkyPage

SkyPage est disponible dès le début dans Internet Adventurer :

L’encadré « Vos ami(e)s » de l’accueil répertorie automatiquement tous les blogs
déclarés dans les données du site. Ses liens utilisent la navigation interne ;
il ne crée ni contacts MSN ni comptes et ne modifie pas l’historique de visites.

L’accueil affiche les blogs visités récemment, du plus récent au plus ancien,
sans doublons. Une consultation d’article compte comme une visite de son blog.
Seules les pages effectivement affichées sont enregistrées dans la sauvegarde
du navigateur ; New Game vide cet historique. Les anciennes sauvegardes sans
ce champ démarrent avec une liste vide. Les derniers articles restent indépendants.

- `http://www.skypage.fr/` : accueil et derniers articles.
- `http://www.skypage.fr/pixelgirl` : blog rose de xX_PixelGirl_Xx.
- `http://www.skypage.fr/luna` : blog nocturne de °•.LuNa.°•.
- `http://www.skypage.fr/sk8er_du_93` : skateboard, béton et vert fluo.
- `http://www.skypage.fr/oo_bubble-princess_oo` : bonbons, accessoires, rose et turquoise.

Les cinq routes sont enregistrées dans le registre existant et référencées par
XD Search. Les recherches `skypage`, `blog`, `pixelgirl`, `luna`, `dessins` et
`evanescence` dirigent vers ces pages. TURBO n'a pas de blog.

Les articles et commentaires sont regroupés dans
`src/browser/sites/skypage/data.json` (PixelGirl/Luna) et `secondary-blogs.json`
(Sk8er_du_93/Oo_bubble-princess_oO). Chaque article possède un identifiant
stable, un titre, une date ISO, des paragraphes, des commentaires et, si besoin,
une image locale accompagnée de son texte alternatif. Un lien
`?article=identifiant` affiche un article seul ; l'archive donne aussi accès à
la liste complète. Les titres des articles et les mots-clés de chaque blog
alimentent automatiquement l'index lors du chargement du site.

Les illustrations et petites décorations animées se trouvent dans
`public/skypage/`. Les étoiles et cœurs sont des SVG animés dans l'esprit des
petits GIFs de l'époque. Toutes les ressources restent locales.

Le rendu et les styles sont propres à SkyPage. Il n'y a ni compte utilisateur,
ni édition, ni ajout de commentaires. Le site ne modifie aucune progression
narrative. Le navigateur conserve ses URLs et son historique comme pour les
autres pages ; New Game remet le navigateur à zéro sans changer les blogs.

Vérifications : `node --test tests/skypage.test.js tests/browser.test.js`, puis
après compilation `node scripts/verify-desktop-ui.mjs --skypage-only` avec Edge
sans interface. Ce contrôle vérifie également l'absence de requêtes externes.
