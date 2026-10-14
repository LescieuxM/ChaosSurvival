import catalog from './catalog.json' with { type: 'json' };
import { renderBubblePop } from './bubble-pop.js';
import { renderAvoidSquares } from './avoid-the-squares.js';
import { renderPixelRunner } from './pixel-runner.js';
export const FLASH_URL = 'http://www.flashzone.fr/';
export const flashCatalog = catalog;
const components = {
  'bubble-pop': renderBubblePop,
  'avoid-the-squares': renderAvoidSquares,
  'pixel-runner': renderPixelRunner,
};
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(text, url) {
  const element = node('a', text);
  element.href = '#';
  element.dataset.browserLink = url;
  return element;
}
function shell() {
  const root = node('section', undefined, 'flashzone');
  const header = node('header', undefined, 'flashzone-header');
  header.append(
    link(catalog.name, FLASH_URL),
    node('span', 'La pause qui dure une partie de plus !'),
  );
  root.append(header);
  return root;
}
function gameCard(game) {
  const card = node('article', undefined, 'flashzone-card'),
    image = node('img');
  if (!/^\.\/flashzone\/[a-z0-9-]+\.svg$/.test(game.thumbnail))
    throw new Error('Invalid local thumbnail');
  image.src = game.thumbnail;
  image.alt = game.title;
  const thumbnail = link(undefined, game.route);
  thumbnail.append(image);
  card.append(thumbnail, link(game.title, game.route));
  return card;
}
export function renderFlashHome() {
  const root = shell();
  root.append(node('p', catalog.description));
  const grid = node('div', undefined, 'flashzone-grid');
  for (const game of catalog.games) grid.append(gameCard(game));
  root.append(grid);
  return root;
}
export const flashPages = [
  {
    url: FLASH_URL,
    title: catalog.name,
    description: catalog.description,
    keywords: ['flashzone', 'jeux flash', 'jeux gratuits', '2009'],
    render: renderFlashHome,
  },
  ...catalog.games.map((game) => {
    if (!components[game.component]) throw new Error('Unknown local game component');
    return {
      url: game.route,
      title: `${game.title} — ${catalog.name}`,
      description: game.description,
      keywords: ['flashzone', 'jeux flash', 'jeux gratuits', ...game.keywords],
      preserveOnTabSwitch: game.component === 'pixel-runner',
      render(context) {
        const root = shell();
        root.append(
          link('Accueil FlashZone', FLASH_URL),
          components[game.component](context, game),
        );
        return root;
      },
    };
  }),
];
