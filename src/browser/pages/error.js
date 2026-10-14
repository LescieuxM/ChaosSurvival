export const pageErrors = {
  connection: [
    'Internet Adventurer ne peut pas afficher cette page Web.',
    "Vérifiez l'adresse saisie et réessayez.",
  ],
  'not-found': [
    'Erreur 404 — Page introuvable',
    "La page demandée n'existe pas ou n'est plus disponible.",
  ],
  timeout: [
    "Le délai d'attente de la connexion est dépassé.",
    'Le serveur met trop de temps à répondre.',
  ],
};
export function renderError(type) {
  const root = document.createElement('section');
  root.className = 'browser-error';
  const [title, text] = pageErrors[type] ?? pageErrors.connection;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = text;
  root.append(heading, copy);
  return root;
}
