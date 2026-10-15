# Hopla Hotel — client et conversations ambiantes

## Accès et fenêtre

Le site local `http://www.hoplahotel.fr/` est référencé par XD Search.
Les salles utilisent les routes canoniques `/salle/...`.
Le bouton « Entrer dans l'hôtel » ouvre un client Windows XD indépendant ;
aucune scène n'est montée dans Internet Adventurer.

Le client réutilise `WindowManager` et `DesktopApplications` avec une seule
fenêtre. Une nouvelle demande restaure la salle actuelle. La réduction conserve
l'état ; fermer puis rouvrir recrée le Hall. La fermeture du navigateur Web
ne ferme pas l'hôtel. Aucun processus ou fenêtre native supplémentaire n'est créé.

La zone de jeu remplit l'intérieur au-dessus de la barre grise inférieure,
sur fond noir uni `#000000`. Le Canvas 400 × 300 reste centré, proportionnel
et net avec `image-rendering: pixelated`. La barre de titre Windows XD est
conservée. La barre inférieure contient Navigateur à gauche, un espace central
réservé au futur chat sans champ de saisie et le nom de la salle à droite.
L'accueil Web et les textes supprimés précédemment restent inchangés.

## Navigateur et salles

Le navigateur flottant s'ouvre au-dessus de la scène et se ferme par X, Échap
ou un second clic sur son bouton. Sa barre de titre permet le déplacement,
limité à la zone noire. Sa hauteur suit le contenu, avec défilement interne
si nécessaire. Le panneau et la barre restent utilisables en 320 × 220.

Les cinq salles sont conservées :

| Salle           | PNJ | Habitants                                             |
| --------------- | --: | ----------------------------------------------------- |
| Hall de l'hôtel |   4 | ReceptionHotel, xX-DarkFlo-Xx, Oo-Cerise-oO, Dr-Kebab |
| Café Hopla      |   3 | CafeMax, TiteFolle59, DisquetteBleue                  |
| Discothèque     |   4 | DJ_Biscotte, miss-l0ve, BGdu62, VinyleOrange          |
| Salon détente   |   3 | PauseCafe, Nuage17, BiscuitSec                        |
| Salle de jeux   |   4 | RetroFred, SuperMarioFan, PandaDu93, ClavierFou       |

## Simulation conservée

`data.json` définit les salles, meubles et 18 personnages. Les positions,
apparences, personnalités et textes restent conservés. `conversations.json`
contient 30 échanges, six par salle, avec participants et délais prédéfinis.
Le planificateur choisit des conversations à intervalles variables et évite
ses trois derniers choix. Si tous les échanges sont récents dans une courte
liste, ils redeviennent éligibles pour éviter un silence permanent. Deux échanges
peuvent coexister si leurs participants sont distincts et disponibles pour parler.
Un déplacement en cours ne bloque plus le démarrage ou l'affichage des messages.
Les messages isolés sont moins fréquents.
Les périodes de silence et les délais entre répliques restent présents.

Les délais sont regroupés dans `AMBIENT_TIMING` de `simulation.js` :

- Premier départ après 2,5 à 4,5 secondes, puis délai de la première réplique
  inchangé : les textes actuels apparaissent entre environ 3,2 et 6,4 secondes.
- Conversation suivante après 14 à 26 secondes ; refus reprogrammé après
  1,5 à 3 secondes au lieu d'attendre un intervalle complet.
- Première remarque isolée après 12 à 22 secondes, puis 25 à 45 secondes ;
  une absence de locuteur disponible est également retentée rapidement.

Le joueur et les PNJ utilisent le même `RoomWalk`, la projection existante
et le BFS. Les réservations des trajets évitent les collisions et les échanges
de cases. Un trajet en cours continue pendant la discussion ; les personnages
attendent ensuite la fin de leurs messages avant de repartir.
ReceptionHotel reste fixe. La refonte des bulles ne modifie pas cette logique.

## Bulles et clics

Les répliques ordinaires apparaissent automatiquement, même sans mouvement
ou sélection du joueur. Cliquer sur un PNJ ordinaire ne déclenche plus sa
réplique. L'interaction spécifique de ReceptionHotel dans le Hall reste active.

Il n'y a plus d'étiquette permanente de pseudonyme. Chaque bulle blanche
contient le pseudonyme en gras à gauche, puis le message en texte noir, sans
portrait. La police est compacte, la bordure grise et la pointe discrète.
La largeur peut atteindre 420 pixels pour privilégier les messages horizontaux.

`BubbleHistory` conserve séparément les messages, même ceux d'un même auteur,
avec une limite de huit. La durée varie de six à dix secondes selon la longueur.
Une extinction de 250 ms termine l'affichage, puis le message est retiré.
Cette animation CSS ne crée aucun timer JavaScript supplémentaire et se met
en pause avec la simulation.

`placeBubbles` dispose les messages proches en hauteur côte à côte. Les auteurs
suivent leur ordre spatial ; les messages d'un même auteur gardent leur ordre.
Si la largeur manque, une autre ligne est utilisée. Le placement suit la
projection, l'échelle et le décalage du Canvas dans toute la zone noire.
Il reste borné et évite les chevauchements lorsque l'espace le permet.
Les contenus passent par des nœuds texte, sans interprétation HTML.

## Ressources et limites

Une seule horloge de salle gère conversations et expirations. Un timeout
attend la prochaine échéance ; les frames tournent pendant les déplacements.
Ouvrir le navigateur, réduire le client ou masquer le document suspend l'activité.
Changer de salle ou fermer le client retire bulles, écouteurs, observateur,
timeout et frames. Aucun état social n'est ajouté aux sauvegardes.

Il n'y a ni nouveau personnage, salle, intrigue, inventaire, monnaie, réseau,
API externe, ni chat du joueur. Les très petits affichages peuvent nécessiter
plusieurs lignes ; une scène saturée limite l'évitement des chevauchements.

## Vérifications

- 29 tests Hotel réussis : conversations automatiques dans les cinq rendus sans
  clic, attribution des messages, délais, expiration, clic réservé à la réception,
  placement, déplacements simultanés, changement de salle et nettoyage.
- Premiers messages dans les sept premières secondes aux bornes des délais,
  participant qui parle en marchant, nouvelle tentative rapide après refus,
  reprise du DOM après pause du navigateur et restauration du client.
- Simulations déterministes de dix minutes par salle sans collision ni mutation
  des données, avec variété des échanges et périodes de silence.
- Compilation de production réussie, contrôles musicaux et narratifs inclus.
- Suite complète à la date de cet audit : 224/225. L'échec sans lien avec le
  client Hotel a été résolu depuis par le nettoyage du menu Démarrer historique.
- Contrôle interactif : `node scripts/verify-desktop-ui.mjs --hopla-hotel-only`.

Pas de test Electron ou de portable, ni d'endurance réelle de plusieurs heures.
