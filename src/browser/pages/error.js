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
  'skypage-timeout': [
    'Internet Adventurer ne peut pas afficher cette page Web',
    'La connexion au serveur a expiré.',
  ],
};
export function renderError(type) {
  const root = document.createElement('section');
  root.className = type === 'skypage-timeout' ? 'browser-error browser-error-ie' : 'browser-error';
  const [title, text] = pageErrors[type] ?? pageErrors.connection;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = text;
  root.append(heading, copy);
  if (type === 'skypage-timeout') {
    const explanation = document.createElement('p');
    explanation.textContent = 'Le site Web met trop de temps à répondre. Cela peut être dû à une connexion Internet trop lente ou à un problème temporaire du serveur.';
    const suggestion = document.createElement('p');
    suggestion.textContent = 'Vous pouvez :';
    const list = document.createElement('ul');
    for (const text of [
      'Vérifier votre connexion Internet.',
      'Actualiser cette page.',
      'Réessayer ultérieurement.',
    ]) {
      const item = document.createElement('li');
      item.textContent = text;
      list.append(item);
    }
    root.append(explanation, suggestion, list);
  }
  return root;
}
