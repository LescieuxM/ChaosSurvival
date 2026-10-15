import data from './data.json' with { type: 'json' };
import { WIKI_URL, articleUrl } from './model.js';
import {
  renderWikiHome,
  renderWikiArticles,
  renderWikiSearch,
  renderWikiArticle,
} from './render.js';
export const wikiData = data;
export const wikiPages = [
  {
    url: WIKI_URL,
    title: data.name,
    description: data.description,
    keywords: ['wiki', 'encyclopédie', '2009'],
    render: (context) => renderWikiHome(context, data),
  },
  {
    url: `${WIKI_URL}articles`,
    title: 'Articles — Wiki',
    indexable: false,
    render: (context) => renderWikiArticles(context, data),
  },
  {
    url: `${WIKI_URL}recherche`,
    title: 'Recherche — Wiki',
    indexable: false,
    render: (context) => renderWikiSearch(context, data),
  },
  ...data.articles.map((article) => ({
    url: articleUrl(article),
    title: `${article.title} — Wiki`,
    description: article.intro,
    keywords: ['wiki', article.theme, article.title],
    render: (context) => renderWikiArticle(context, data, article),
  })),
];
