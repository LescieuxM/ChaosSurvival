# Bloc-notes Windows XD

Les fichiers `.txt` de l’explorateur s’ouvrent dans le Bloc-notes existant, avec
un champ de texte brut. **Fichier → Enregistrer** ou **Ctrl+S** enregistre le
document actif. L’astérisque indique des modifications non enregistrées.
La croix et **Fichier → Quitter** proposent Oui, Non et Annuler.

Les éditions sont conservées dans `textFiles`, champ optionnel de la sauvegarde
active, indexé par `location.id/nom-du-fichier`. Les anciennes sauvegardes n’ont
pas besoin d’être converties. Chaque entrée contient `text` et `original` : les
JSON du système de fichiers restent intacts. Si le texte narratif d’origine
change, la version du joueur reste prioritaire et le Bloc-notes affiche un avis.
Un fichier supprimé du système virtuel n’est pas recréé par sa sauvegarde.
Une nouvelle partie repart des documents d’origine et archive les anciennes
éditions avec la partie précédente ; la suppression des données utilisateur
efface aussi ces éditions et leurs archives.

La limite est de **102 400 octets UTF-8**, vérifiée à chaque saisie et à chaque
enregistrement. Une édition trop grande est refusée entièrement, avec un message
dans la barre d’état. Un document original déjà plus grand reste intégralement
consultable en lecture seule. Un échec de stockage conserve le buffer ouvert et
restaure la version sauvegardée précédente.

Le texte est affiché uniquement via `textarea.value`, jamais interprété. Aucun
accès au système hôte, nouvelle API Electron ou dépendance n’est ajouté.
Enregistrer avant de quitter complètement le jeu ou de changer de phase : les
buffers non enregistrés appartiennent aux fenêtres, pas à la sauvegarde.

Vérification ciblée : `node --test tests/text-files.test.js
tests/messenger-interface.test.js`, puis `npm run build` et
`node scripts/verify-desktop-ui.mjs --notepad-only` pour tester les interactions
dans Edge sans interface, avec un profil isolé, sans lancer Electron.
