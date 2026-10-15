# Audit des ressources graphiques

## Ajout VideoTube — 14 octobre 2026

`public/videotube/numa-numa.svg`, `chocolate-rain.svg`,
`leave-britney-alone.svg`, `dramatic-chipmunk.svg`, `laughing-baby.svg`,
`sneezing-baby-panda.svg` et `what-what.svg` : provenance **C**, SVG originaux
écrits avec Codex lors de l'intégration de VideoTube. Aucun fichier d'une vidéo,
miniature YouTube, photographie ni logo externe téléchargé. Il ne s'agit pas
de ressources bitmap générées par imagegen. Les sujets sont évoqués par des
dessins génériques ; pas de portrait réaliste ni reproduction de frame.
Pas de licence externe inventée. Une expertise exhaustive de similarité ou de
marques n'a pas été effectuée. Pour une commercialisation, contrôler aussi
les conditions applicables au code généré et la présentation des références
aux œuvres. Sources, attributions et limites des liens : [videotube.md](videotube.md).

L'inventaire ci-dessous décrit le périmètre de l'audit initial ; cet ajout ne
transforme pas cet audit en certification juridique.

Audit du **14 octobre 2026**, sur les fichiers de la branche de travail. Ce rapport
est un inventaire de provenance et de risques, **pas une certification juridique**.
Aucune image n’a été modifiée, remplacée ou supprimée pendant cet audit.

## Périmètre et preuves

33 fichiers graphiques trouvés dans `public/` : 27 SVG et 6 JPEG. Aucun fichier
graphique supplémentaire trouvé dans `assets/` ou `src/`. Les graphismes SVG
intégrés au JavaScript sont examinés séparément ci-dessous. Les dépendances,
builds et captures `.qa/` ne constituent pas des sources graphiques du jeu et
sont exclus. Les noms de fichiers fictifs de l’Explorateur ne sont pas des
images supplémentaires : ils réutilisent notamment wallpaper/covers.

Examen effectué : fichiers SVG et leurs références, rendu visuel des 33 fichiers
sur des planches locales, prompts, documentation et historique Git disponible.
Les illustrations générées ont également été vues dans les échanges de création.
**Aucune recherche inversée d’images, recherche exhaustive de marques ou expertise
de similarité n’a été effectuée.** Un Git commit atteste la présence d’un fichier,
pas son auteur initial, sa licence ou l’absence de copie.

Codes utilisés dans l’inventaire :

- **G** : génération d’images OpenAI confirmée par les appels `image_gen` de cette
  conversation, puis export JPEG local. Les prompts sont conservés dans
  [skypage-image-prompts.json](skypage-image-prompts.json). Le nom du modèle exact
  n’est pas vérifié : ne pas le présenter comme DALL·E ou un modèle précis.
- **C** : création SVG par écriture de code avec Codex, traçable dans cette
  conversation. Ce n’est ni une photographie externe ni une génération bitmap
  imagegen. Les conditions sur le code généré restent à prendre en compte.
- **U** : **Origine non vérifiée**. Fichier existant sans preuve suffisante de sa
  création initiale ou de sa licence. Un dessin vectoriel simple ne prouve pas
  qu’il est original, humain ou généré par IA.
- **O** : conditions OpenAI vérifiées ci-dessous ; elles ne donnent aucune
  autorisation sur les droits éventuels de tiers.
- **N** : aucune licence propre à cette ressource ou autorisation externe vérifiée.

Pour **chaque U**, il reste à retrouver l’auteur, la source initiale et une licence
ou attestation applicable à la distribution commerciale. Pour **chaque G/C**,
conserver les traces de création et confirmer les conditions du compte utilisé.
Ces tâches s’ajoutent aux vérifications particulières des tableaux.

## Conditions officielles consultées

Sources OpenAI consultées le 14 octobre 2026 :

1. [Conditions Europe, rubrique Content](https://openai.com/policies/eu-terms-of-use/)
   (mise à jour affichée : 16 janvier 2026). Entre OpenAI et l’utilisateur, les
   sorties lui appartiennent dans la mesure permise par la loi. L’utilisateur
   reste responsable des droits de tiers et doit évaluer le résultat ; les
   sorties peuvent être similaires à celles d’autres utilisateurs.
2. [OpenAI Services Agreement, sections 4.1 et 4.4](https://openai.com/policies/services-agreement/)
   : attribution des sorties au client, sous réserve de la loi ; absence
   d’exclusivité garantie. Les contrats Business/API peuvent différer du contrat
   individuel. Le type de compte et les éventuelles conditions particulières
   de cette session ne sont pas vérifiés.
3. [Service Terms, section Codex and Code Generation](https://openai.com/policies/service-terms/)
   : du code généré peut relever de licences tierces, notamment open source.
   Les indemnités éventuelles dépendent du service et de ses conditions ; aucune
   couverture n’est affirmée pour ce projet.

**Interprétation limitée :** ces dispositions permettent d’envisager l’exploitation
commerciale des sorties, sous réserve du contrat applicable et des droits de
tiers. Elles ne sont pas une licence « libre de droits », une garantie
d’originalité, ni une garantie de protection exclusive par le droit d’auteur.
La commercialisation du jeu ne peut donc pas être validée uniquement par cette
lecture des conditions OpenAI.

## Photos SkyPage : provenance confirmée

Toutes : **G**, outil intégré `image_gen` (OpenAI/Codex), conditions **O**.
Créées sans image de référence fournie lors des appels observés. Les prompts
demandent des photos originales, sans marques, filigranes ni mots, et ne citent
aucun artiste ou œuvre à reproduire. Cela confirme l’intention, pas l’absence
absolue de ressemblances dans les sorties.

| Fichier                             | Observation visuelle / risque potentiel                                                | Vérification manuelle restante                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `public/skypage/skater-board.jpg`   | Planche abîmée, motif blanc/noir sans marque lisible. Motif décoratif non identifié.   | Examiner le motif en regard de graphismes de skate connus.                                                   |
| `public/skypage/skater-spot.jpg`    | Gymnase, escalier et graffitis ; aucune signature identifiable à cette résolution.     | Vérifier les graffitis et une éventuelle ressemblance avec un lieu/une œuvre réelle.                         |
| `public/skypage/skater-shoes.jpg`   | Baskets noires, sans logo lisible ; silhouette proche de modèles commerciaux courants. | Vérifier les signes distinctifs, modèles/dessins et marques de chaussures.                                   |
| `public/skypage/skater-fall.jpg`    | Adolescents synthétiques dans une scène de skate ; aucune célébrité identifiée.        | Revoir les visages et vêtements ; aucune correspondance avec une personne réelle n’est exclue par cet audit. |
| `public/skypage/princess-candy.jpg` | Bonbons génériques, pas d’emballage ni marque lisible.                                 | Vérifier les formes éventuellement distinctives ; recherche de similarité si nécessaire.                     |
| `public/skypage/princess-phone.jpg` | Téléphone à touches et strass sans logo lisible ; évoque des appareils de 2009.        | Vérifier le design industriel, le clavier et les objets de marque possibles à l’arrière-plan.                |

Aucune reproduction manifeste d’une photographie précise n’a été identifiée à
l’œil. **Faute de comparaison externe, la règle d’absence de ressemblance
problématique reste partiellement vérifiée pour ces six images.**

## SVG SkyPage : création par code confirmée

Toutes : **C**, assistance Codex par code SVG ; aucun générateur d’images bitmap
utilisé pour ces fichiers ; conditions **O**, aucune licence distincte affirmée.

| Fichier                              | Observation / risques                                                                                | Vérification manuelle restante                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `public/skypage/pixelgirl-paint.svg` | Chat rose carré, ciel étoilé, décor de dessin amateur ; aucune marque ni personnage nommé identifié. | Comparaison si une ressemblance avec un personnage existant est signalée.        |
| `public/skypage/luna-night.svg`      | Rue nocturne géométrique et lampadaire avec filtre de grain ; aucune marque identifiée.              | Relecture d’originalité et conservation du code de création.                     |
| `public/skypage/luna-moon.svg`       | Lune et étoiles stylisées ; aucun logo identifié.                                                    | Vérification d’originalité, sans garantie d’exclusivité sur ces motifs courants. |
| `public/skypage/sparkle.svg`         | Étoile pixelisée animée ; motif courant.                                                             | Comparaison si une source antérieure est connue.                                 |
| `public/skypage/heart.svg`           | Cœur pixelisé animé ; motif courant.                                                                 | Même limite sur l’originalité et l’exclusivité.                                  |
| `public/skypage/candy-sparkle.svg`   | Bonbon rose/turquoise avec scintillement ; forme générique.                                          | Même limite ; garder la trace d’écriture SVG.                                    |

## Autres fichiers : origine initiale non vérifiée

Tous les fichiers ci-dessous : **U — Origine non vérifiée**, générateur non
vérifiable, conditions/licence **N**. L’historique Git et les fichiers ont été
examinés, mais aucune licence de ressource externe ou preuve suffisante de
création initiale n’a été trouvée. [visual-identity.md](visual-identity.md) affirme
que les cinq logos sont dessinés pour le jeu sans fichiers Microsoft : **déclaration
locale utile, mais insuffisante pour certifier la chaîne de droits**.

| Fichier                                | Observation / risque                                                                                                    | Vérification particulière, en plus de la provenance                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `public/favicon.svg`                   | Croix blanche sur carré bleu ; symbole simple.                                                                          | Vérifier une éventuelle identité visuelle tierce proche.                                                                |
| `public/wallpaper.svg`                 | Collines vertes et ciel bleu, composition rappelant clairement « Bliss » de Windows XP ; SVG, pas une photo incorporée. | Déterminer la référence initiale et évaluer les droits sur une adaptation ; le redessin ne garantit pas l’autorisation. |
| `public/avatars/contact-bubble.svg`    | Visage expressif/bulle rose, sans marque identifiée.                                                                    | Comparaison aux mascottes ou émoticônes existantes.                                                                     |
| `public/avatars/contact-modem.svg`     | Routeur/modem stylisé, sans marque identifiée.                                                                          | Modèle ou design de matériel si la source en utilise un.                                                                |
| `public/avatars/contact-skater.svg`    | Skate stylisé, montagne et étoile.                                                                                      | Vérifier une éventuelle illustration source.                                                                            |
| `public/avatars/luna.svg`              | Lune pixelisée violette.                                                                                                | Vérifier l’auteur initial et une éventuelle illustration source.                                                        |
| `public/avatars/offline.svg`           | Silhouette devant CRT, sans personnage identifié.                                                                       | Même vérification ; aucune origine IA déduite de son style.                                                             |
| `public/avatars/pixelgirl.svg`         | Personnage pixelisé violet, sans personnage existant identifié.                                                         | Comparer à des sprites connus si une référence de création existe.                                                      |
| `public/avatars/player.svg`            | Écran avec visage pixelisé.                                                                                             | Vérifier une éventuelle mascotte source.                                                                                |
| `public/avatars/turbo.svg`             | Voiture tunée bleue, pas d’emblème lisible.                                                                             | Examiner le modèle automobile et les signes distinctifs.                                                                |
| `public/covers/best-game-console.svg`  | Borne arcade et petit alien vert pixelisé ; rapprochement possible avec des sprites de Space Invaders.                  | Priorité : comparer le sprite et établir sa création indépendante/les droits ; aucune autorisation Taito vérifiée.      |
| `public/icons/chaos-survival.svg`      | Manette et badge lecture ; aucune marque lisible.                                                                       | Examiner une éventuelle manette de référence.                                                                           |
| `public/icons/computer.svg`            | Ordinateur classique, esthétique XP.                                                                                    | Vérifier qu’aucune icône propriétaire n’a été copiée/redessinée.                                                        |
| `public/icons/folder.svg`              | Dossier jaune, esthétique XP.                                                                                           | Même vérification de source et de dessin propriétaire.                                                                  |
| `public/icons/menu-computer.svg`       | CRT violet avec étoile.                                                                                                 | Retrouver la trace de création initiale.                                                                                |
| `public/icons/recycle-empty.svg`       | Corbeille transparente ; esthétique XP.                                                                                 | Comparer aux icônes système ayant servi de référence.                                                                   |
| `public/logos/windows-xd.svg`          | Quatre rubans rouge/vert/bleu/jaune autour d’une perle ; rapprochement avec l’identité Windows.                         | Examiner confusion de marque et identité visuelle Microsoft, malgré la déclaration de dessin original.                  |
| `public/logos/love-messenger.svg`      | Bulles et cœur, pas le logo MSN officiel identifié à l’œil.                                                             | Évaluer la proximité avec Messenger et le contexte de présentation.                                                     |
| `public/logos/internet-adventurer.svg` | Globe et boussole ; association possible aux identités de navigateurs, notamment Safari.                                | Comparaison des logos et risque de confusion, pas d’autorisation Apple/Microsoft vérifiée.                              |
| `public/logos/media-play.svg`          | Bouton lecture dans un galet bleu/violet.                                                                               | Comparer aux identités des lecteurs multimédias ; triangle seul générique.                                              |
| `public/logos/windows-upgrade.svg`     | Flèche verte sur plateformes bleues.                                                                                    | Comparer aux icônes système de mise à jour de référence.                                                                |

Les observations « aucune marque identifiée » signifient seulement qu’aucune
marque explicite n’a été reconnue lors de cet examen, pas qu’aucun droit n’existe.
Les noms fictifs et le caractère rétro/parodique ne valent pas autorisation.

## Graphismes intégrés au code et au rendu

| Source                                                                                                   | Origine / outil / conditions                                                                                                   | Observation et suite manuelle                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/icons.js` — Buddy                                                                                | U, générateur non vérifié, N. La demande de conception dans cette conversation mentionne explicitement une inspiration Clippy. | Trombone avec deux yeux : rapprochement évident avec Clippy ; vérifier création indépendante et droits sur personnage/design. Aucun fichier Microsoft intégré identifié, ce qui ne règle pas la similarité. |
| `src/ui/icons.js` — picture, drive, disc, document, computer, folder, bin, error, shield, download, help | U, générateur non vérifié, N ; SVG construits dans le code.                                                                    | Symboles système usuels, esthétique XP. Retrouver l’origine de chaque tracé ; absence de fichier externe ne prouve pas l’absence de copie. Certains sont des variantes de secours.                          |
| `src/minigames/smiley-icons.js` — quatre variantes                                                       | U, générateur non vérifié, N ; SVG smileys, cœur et étoile.                                                                    | Formes simples, aucun personnage nommé identifié. Vérifier l’origine des tracés et les variantes de smileys utilisées comme signes distinctifs.                                                             |
| `src/styles-menu.css`, `src/styles-browser.css`, `src/browser/sites/skypage/styles.css` et autres CSS    | Mélange : ajouts SkyPage traçables via Codex, origine initiale des autres styles non vérifiée ; pas de générateur bitmap.      | Dégradés et motifs CSS ne sont pas des photos. L’habillage XP/MSN/Skyblog reste une question d’ensemble (identité visuelle/confusion) hors validation par fichier.                                          |
| Symboles/émoticônes Unicode affichés par l’OS                                                            | Rendu dépendant des polices du système ; fournisseur et conditions exacts non vérifiés ici.                                    | Ne pas attribuer ces glyphes à imagegen. Vérifier séparément les licences si des polices/emoji bitmap sont un jour embarqués ; aucune nouvelle police ajoutée par cet audit.                                |

## Bilan des quatre règles

1. **Outil autorisant l’usage commercial** : outil confirmé pour 6 JPEG, conditions
   OpenAI vérifiées avec les réserves ci-dessus. Compte/contrat exact à confirmer.
   Pour les autres images, ne pas attribuer automatiquement une licence OpenAI.
2. **Création originale sans copie intentionnelle** : appels sans référence et
   prompts originaux confirmés pour ces JPEG, création par code traçable pour
   6 SVG SkyPage. L’originalité juridique des résultats n’est pas certifiée.
   Les 21 autres fichiers nécessitent une preuve de provenance.
3. **Marques/logos/personnages** : aucun logo lisible constaté dans les 6 photos.
   Vérifications prioritaires pour wallpaper/Bliss, Buddy/Clippy, l’alien arcade,
   les logos fictifs et les designs de produits. Aucune autorisation de tiers
   n’a été retrouvée ni inventée.
4. **Absence de ressemblance problématique** : contrôle visuel effectué, mais
   comparaison exhaustive impossible. Les ressemblances signalées demandent
   une revue manuelle avant une décision de commercialisation.

Pour préparer cette décision : conserver prompts, originaux et traces d’auteur ;
retrouver les sources/licences manquantes ; comparer les motifs prioritaires et,
si nécessaire, faire évaluer leur usage et l’habillage global par un spécialiste.
La musique, les textes, les noms de logiciels et les licences des dépendances
nécessitent des audits séparés : ce rapport ne valide pas ces éléments.

## Mention effectivement ajoutée

La zone de crédits musicaux du menu existait dans `src/ui/main-menu.js`. Une
petite ligne y a été ajoutée, sans nouvelle interface de crédits :

> Certaines ressources graphiques de Chaos Survival ont été créées à l'aide des outils de génération d'images par intelligence artificielle intégrés à Codex (OpenAI).

Cette formulation est justifiée par les **6 JPEG confirmés**. Elle n’attribue pas
l’ensemble des ressources à imagegen et ne revendique aucune licence globale.
