# SkyPage

SkyPage est disponible dès le début dans Internet Adventurer. L’accueil affiche les blogs liés à des contacts Messenger dans « Vos ami(e)s », les derniers articles et les blogs consultés récemment. Les liens utilisent la navigation interne ; ils ne créent pas de contacts et ne modifient pas la progression narrative.

Les visites récentes sont enregistrées après affichage d’une page, sans doublons. Une consultation d’article compte comme une visite de son blog. New Game vide cet historique ; les derniers articles restent indépendants.

- `http://www.skypage.fr/` : accueil et derniers articles.
- `http://www.skypage.fr/pixelgirl` : blog de xX_PixelGirl_Xx.
- `http://www.skypage.fr/luna` : blog de °•.LuNa.•°.
- `http://www.skypage.fr/sk8er_du_93` : skateboard.
- `http://www.skypage.fr/oo_bubble-princess_oo` : bonbons et accessoires.
- `http://www.skypage.fr/cartouchegrise`, `/grillepain_92`, `/disquette44` et `/padsansfil` : blogs publics d’auteurs de ForumJeu.
- `http://www.skypage.fr/k7` : blog musical de K7.
- `http://www.skypage.fr/m0rbid` : blog de x_M0RBID_x.

Les onze routes sont enregistrées dans le registre existant et indexées par XD Search. Les articles et commentaires se trouvent dans `data.json`, `secondary-blogs.json` et `forum-blogs.json`. Les quatre auteurs de ForumJeu restent indépendants des contacts Messenger ; Turb0 commente un article du blog de K7.

Les articles ont un identifiant stable, un titre, une date ISO, des paragraphes et des commentaires. Les illustrations et décorations restent locales dans `public/skypage/`. Le site ne permet ni édition ni ajout de commentaires et ne modifie aucune progression narrative.

Vérifications ciblées : `node --test tests/skypage.test.js tests/browser.test.js`. Le contrôle visuel automatisé peut être lancé après compilation avec `node scripts/verify-desktop-ui.mjs --skypage-only`.
