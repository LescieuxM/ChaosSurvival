import { textElement as node, internalLink as link } from '../../dom.js';
function thumbnail(video) {
  if (!/^\.\/videotube\/[a-z0-9-]+\.svg$/.test(video.thumbnail))
    throw new Error('Invalid local thumbnail');
  const img = node('img');
  img.src = video.thumbnail;
  img.alt = `Illustration : ${video.title}`;
  img.width = 180;
  img.height = 100;
  return img;
}
function shell(homeUrl) {
  const root = node('section', undefined, 'videotube');
  const header = node('header', undefined, 'videotube-header');
  const logo = link(undefined, homeUrl);
  logo.className = 'videotube-logo';
  logo.append(node('span', 'Video'), node('strong', 'Tube'));
  header.append(logo, node('span', 'Diffuse-toi toi-même'));
  root.append(header, link('Accueil', homeUrl));
  return root;
}
function stars(video) {
  const n = node(
    'span',
    '★'.repeat(video.rating) + '☆'.repeat(5 - video.rating),
    'videotube-stars',
  );
  n.setAttribute('aria-label', `Note : ${video.rating} sur 5`);
  return n;
}
const author = (video) => video.author ?? 'Auteur non vérifié';
const views = (video) => `${video.views.toLocaleString('fr-FR')} vues`;
export function renderVideoHome(catalog, homeUrl, route) {
  const root = shell(homeUrl);
  root.append(node('h2', 'Vidéos à partager'));
  const grid = node('div', undefined, 'videotube-grid');
  for (const video of catalog.videos) {
    const card = node('article', undefined, 'videotube-card');
    const imageLink = link(undefined, route(video));
    imageLink.append(thumbnail(video));
    card.append(
      imageLink,
      link(video.title, route(video)),
      node('p', author(video)),
      node('p', views(video)),
      stars(video),
    );
    grid.append(card);
  }
  root.append(
    grid,
    node('small', 'Compteurs, notes et commentaires fictifs.', 'videotube-disclaimer'),
  );
  return root;
}
export function renderVideo({ onDispose }, video, homeUrl) {
  const root = shell(homeUrl);
  root.append(
    node('h2', video.title),
    node('p', `${author(video)} · ${video.year} · ${views(video)}`, 'videotube-meta'),
  );
  const player = node('div', undefined, 'videotube-player');
  const watch = node('button', 'Voir sur VideoTube', 'videotube-watch');
  watch.type = 'button';
  watch.disabled = !video.youtubeUrl;
  player.append(thumbnail(video), watch);
  const status = node(
    'p',
    video.youtubeUrl
      ? 'La vidéo s’ouvre dans votre navigateur Internet.'
      : 'Lien indisponible : aucune publication accessible vérifiée.',
    'videotube-open-status',
  );
  status.setAttribute('role', 'status');
  let disposed = false;
  onDispose?.(() => {
    disposed = true;
  });
  watch.addEventListener('click', async () => {
    if (disposed || watch.disabled) return;
    watch.disabled = true;
    try {
      const response = await globalThis.chaosVideo?.open(video.id);
      if (!disposed)
        status.textContent = response?.ok
          ? 'Vidéo ouverte dans votre navigateur Internet.'
          : 'Impossible d’ouvrir la vidéo. Veuillez réessayer.';
    } catch {
      if (!disposed) status.textContent = 'Impossible d’ouvrir la vidéo. Veuillez réessayer.';
    } finally {
      if (!disposed) watch.disabled = false;
    }
  });
  const comments = node('section', undefined, 'videotube-comments');
  comments.append(node('h3', `Commentaires (${video.comments.length})`));
  for (const comment of video.comments) {
    const row = node('article');
    row.append(node('strong', comment.author), node('p', comment.text));
    comments.append(row);
  }
  root.append(
    player,
    status,
    node('p', video.description, 'videotube-description'),
    stars(video),
    comments,
    node('small', 'Compteurs, notes et commentaires fictifs.', 'videotube-disclaimer'),
  );
  return root;
}
