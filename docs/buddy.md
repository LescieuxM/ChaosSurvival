# Buddy — assistant Windows XD

Buddy est une application préinstallée du menu Démarrer. Il reste absent avant
sa première activation et n'intervient pas dans les conversations MSN.

Les textes et les durées de sa présentation sont définis dans
`src/config/buddy.json`. Après les trois bulles, il reste discret sur le bureau.
La croix de la bulle ferme celle-ci ; la croix près du trombone masque Buddy.
Une réouverture propose un conseil sans répéter la présentation.

Le composant `src/ui/buddy.js` réutilise la sauvegarde active :
`buddy.opened` mémorise la première ouverture et `buddy.visible` la visibilité.
Les anciennes sauvegardes n'ont rien à migrer. New Game efface cet état avec
le reste de la progression. Le menu principal masque temporairement Buddy.

Pour de futurs événements, `buddy.say(text, { durationMs, animation })` affiche
une bulle seulement si l'assistant a déjà été activé et reste visible. Les
animations disponibles sont `idle`, `presenting`, `explaining`, `celebrating`
et `leaving`. Aucun événement narratif ne l'appelle pour le moment.

Le dessin original du trombone est un SVG local produit par le système d'icônes.
Les animations CSS respectent la préférence de réduction des mouvements.
Le conteneur et ses zones transparentes laissent passer les clics ; seules les
deux croix sont interactives. La barre des tâches reste au-dessus de Buddy.

Vérifications : `node --test tests/buddy.test.js` et, après `npm run build`,
`node scripts/verify-desktop-ui.mjs --buddy-only` (Edge sans interface, pas Electron).
