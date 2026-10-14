import { WIKI_URL, articleUrl, findArticles, randomArticle } from './model.js';
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function link(text, url) {
  const n = node('a', text);
  n.href = '#';
  n.dataset.browserLink = url;
  return n;
}
function randomButton(context, data) {
  const button = node('button', 'Article au hasard', 'wiki-random');
  button.type = 'button';
  button.addEventListener('click', () => {
    const article = randomArticle(data.articles);
    if (article) context.navigate(articleUrl(article));
  });
  return button;
}
function shell(context, data) {
  const root = node('section', undefined, 'wiki');
  const sidebar = node('aside', undefined, 'wiki-sidebar');
  const logo = link(data.name, WIKI_URL);
  logo.className = 'wiki-logo';
  sidebar.append(logo, node('p', data.motto, 'wiki-motto'));
  const nav = node('nav');
  nav.setAttribute('aria-label', 'Navigation Wiki');
  nav.append(
    link('Accueil', WIKI_URL),
    link('Articles', `${WIKI_URL}articles`),
    randomButton(context, data),
    link('Recherche', `${WIKI_URL}recherche`),
  );
  const form = node('form', undefined, 'wiki-search');
  const input = node('input');
  input.type = 'search';
  input.maxLength = 300;
  input.value = context.url?.searchParams.get('q') ?? '';
  input.setAttribute('aria-label', 'Recherche Wiki');
  const button = node('button', 'Rechercher');
  button.type = 'submit';
  form.append(input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    context.navigate(`${WIKI_URL}recherche?q=${encodeURIComponent(input.value.trim())}`);
  });
  sidebar.append(nav, form);
  const main = node('main', undefined, 'wiki-content');
  root.append(sidebar, main);
  return { root, main };
}
function articleList(articles) {
  const list = node('ul');
  for (const article of articles) {
    const item = node('li');
    item.append(link(article.title, articleUrl(article)));
    list.append(item);
  }
  return list;
}
function themes(main, data) {
  for (const theme of new Set(data.articles.map((article) => article.theme))) {
    const box = node('section', undefined, 'wiki-theme');
    box.append(
      node('h3', theme),
      articleList(data.articles.filter((article) => article.theme === theme)),
    );
    main.append(box);
  }
}
export function renderWikiHome(context, data) {
  const { root, main } = shell(context, data);
  main.append(node('h1', 'Bienvenue sur Wiki'), node('p', data.welcome));
  const columns = node('div', undefined, 'wiki-home-columns');
  const featured = node('section', undefined, 'wiki-box');
  const article = data.articles.find((article) => article.id === data.featured);
  featured.append(
    node('h2', 'Article à la une'),
    link(article.title, articleUrl(article)),
    node('p', article.intro),
  );
  const facts = node('section', undefined, 'wiki-box');
  const list = node('ul');
  for (const fact of data.facts) {
    const article = data.articles.find((article) => article.id === fact.article);
    const item = node('li');
    item.append(node('span', `${fact.text} `), link(article.title, articleUrl(article)));
    list.append(item);
  }
  facts.append(node('h2', 'Le saviez-vous ?'), list);
  columns.append(featured, facts);
  main.append(columns, node('h2', 'Explorer les articles'));
  themes(main, data);
  main.append(randomButton(context, data));
  return root;
}
export function renderWikiArticles(context, data) {
  const { root, main } = shell(context, data);
  main.append(node('h1', 'Articles'));
  themes(main, data);
  return root;
}
export function renderWikiSearch(context, data) {
  const { root, main } = shell(context, data);
  const query = context.url?.searchParams.get('q') ?? '';
  main.append(node('h1', 'Recherche'));
  if (!query.trim()) {
    main.append(node('p', 'Saisissez un titre ou une partie de titre dans le champ de recherche.'));
    return root;
  }
  const results = findArticles(data.articles, query);
  main.append(node('p', `Résultats pour « ${query} » :`, 'wiki-search-query'));
  if (!results.length)
    main.append(node('p', 'Aucun article ne correspond à votre recherche.', 'wiki-empty'));
  else main.append(articleList(results));
  return root;
}
export function renderWikiArticle(context, data, article) {
  const { root, main } = shell(context, data);
  main.append(node('h1', article.title));
  if (article.notice) main.append(node('p', article.notice, 'wiki-notice'));
  if (article.info) {
    const box = node('dl', undefined, 'wiki-infobox');
    for (const [label, value] of article.info) box.append(node('dt', label), node('dd', value));
    main.append(box);
  }
  main.append(node('p', article.intro));
  const toc = node('nav', undefined, 'wiki-toc');
  toc.setAttribute('aria-label', `Sommaire : ${article.title}`);
  toc.append(node('strong', 'Sommaire'));
  const list = node('ol');
  const targets = new Map();
  for (const section of article.sections) {
    const item = node('li');
    const anchor = node('a', section.title);
    anchor.href = '#';
    // Scroll within the current page, without navigating the host or adding history.
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      targets.get(section.id)?.scrollIntoView({ block: 'start' });
    });
    item.append(anchor);
    list.append(item);
  }
  toc.append(list);
  main.append(toc);
  for (const section of article.sections) {
    const box = node('section', undefined, 'wiki-article-section');
    box.dataset.wikiSection = section.id;
    box.append(node('h2', section.title));
    for (const paragraph of section.paragraphs) box.append(node('p', paragraph));
    targets.set(section.id, box);
    main.append(box);
  }
  main.append(
    node('h2', 'Voir aussi'),
    articleList(article.related.map((id) => data.articles.find((article) => article.id === id))),
  );
  main.append(link('Retour à l’accueil de Wiki', WIKI_URL));
  return root;
}
