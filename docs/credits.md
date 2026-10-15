# Crédits de fin : composant préparé, inactif

`src/config/credits.json` contient les textes. `src/ui/credits.js` est le point
d’entrée avec ses styles ; `credits-view.js` effectue le rendu textuel et gère
uniquement son affichage. Aucun import dans `main.js`, événement, raccourci,
route Internet Adventurer ou bouton joueur n’active cette page. Les crédits
musicaux/IA du menu existant ne sont pas remplacés par cette page.

Pour l’intégration future, **uniquement lorsque le scénario le décidera** :

```js
import { CreditsPage } from './ui/credits.js';
const credits = new CreditsPage(document.querySelector('#app'));
credits.show(); // à appeler au futur point de fin du scénario
credits.hide(); // retrait explicite, sans progression/sauvegarde implicite
```

La construction/importation seule ne monte rien. `show()` réutilise la même
page ; `hide()` la retire et restaure le focus précédent s’il existe encore.
Aucun timer, musique, défilement automatique ou action narrative n’est lancé.
Le futur orchestrateur devra arrêter ses jeux/audio avant l’affichage : le
composant n’intervient pas dans ces systèmes.

La source Pixabay est vérifiée et affichée avec son URL. Le lien n’effectue
aucune navigation native : les protections Electron existantes restent actives.
Une option développeur `onOpenSource(url)` peut être fournie lors de la future
intégration pour traiter explicitement la consultation de cette référence.
Il n’y a actuellement ni ouverture externe ni API système ajoutée.

## Musique : vérification du 14 octobre 2026

La [page officielle du morceau](https://pixabay.com/music/video-games-best-game-console-301284/)
confirme **Best Game Console**, **DJARTMUSIC**, une publication le 18 février
2025, la Pixabay Content License et l’indication **Content ID Registered**.
Le morceau n’est donc pas présenté comme une œuvre du domaine public ou CC0.
Sa publication réelle en 2025 n’est pas une date narrative : le jeu se déroule
en 2009 et cette attribution ne modifie pas son scénario.

Les [conditions Pixabay, sections 5 et 6](https://pixabay.com/service/terms/)
(version affichée : 18 novembre 2024) autorisent les usages commerciaux et non
commerciaux, modifications et adaptations, sous leurs restrictions. La
redistribution autonome du morceau est interdite ; l’attribution est appréciée
mais non obligatoire. Des droits de tiers peuvent nécessiter des permissions
supplémentaires. Le [résumé de licence](https://pixabay.com/service/license-summary/)
ne remplace pas ces conditions complètes.

**Limites** : l’usage comme bande-son d’un jeu original semble compatible avec
ce cadre, mais ce constat n’est pas une certification. Aucun certificat de
téléchargement ou reçu établissant l’origine exacte de `assets/musiclvl1.mp3`
n’a été trouvé dans le projet. Le fichier a été raccourci précédemment ; sa
correspondance binaire avec le téléchargement original n’a pas été vérifiée.
Conserver la preuve de téléchargement et les conditions applicables ; vérifier
les éventuels samples/droits tiers et préparer les justificatifs Content ID
pour les vidéos et streams utilisant la musique. L’attribution seule ne
garantit ni les droits ni l’absence de réclamation.

La mention graphique parle de **certaines ressources** seulement ; la provenance
des six photos générées via Codex/OpenAI est documentée dans
[IMAGE_AUDIT.md](IMAGE_AUDIT.md).

## Musiques des mini-jeux

- **I Love My 8-bit Game Console** — DJARTMUSIC, utilisée pour SmileyCatcher.exe
  depuis `assets/djartmusic-i-love-my-8-bit-game-console-301272.mp3`.
- **Retro Game Arcade** — moodmode, utilisée pour Super Plombier Flash depuis
  `assets/moodmode-retro-game-arcade-236133.mp3`.

Ces deux morceaux sont utilisés sous la Pixabay Content License ; l’attribution
est conservée ici même si elle n’est pas obligatoire. Aucun droit de propriété
sur les morceaux n’est revendiqué.

- **ROBLOX - Time To Win - Skyline Run #1** — jakob_welik, utilisée pour
  BubblePop depuis `assets/jakob_welik-roblox-time-to-win-skyline-run-1-442119.mp3`.
- **Retro Runner** — Bransboynd, utilisée pour PixelRunner depuis
  `assets/bransboynd-retro-runner-548536.mp3`.
- **Neon Amnesia (Club House 2010)** — 9JackJack8, utilisée pour Avoid the
  Squares depuis `assets/9jackjack8-neon-amnesia-club-house-2010-375600.mp3`.

Ces trois morceaux sont utilisés sous la Pixabay Content License. Aucun droit
de propriété sur ces morceaux n’est revendiqué.

- **BubblePop — effet sonore « bubble popping 3 »** — Cherskis, utilisé depuis
  `assets/cherskis-bubble-popping-3-587265.mp3`, sous la Pixabay Content License.
- **Disco** — ProducesPlatinum, utilisé pour la discothèque de Hopla Hotel depuis
  `assets/producesplatinum-disco-483559.mp3`, sous la Pixabay Content License.
- **Hype | Drill Music** — kontraa, utilisée comme musique générale de Hopla
  Hotel depuis `assets/kontraa-hype-drill-music-438398.mp3`, sous la Pixabay
  Content License.
